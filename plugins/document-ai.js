// plugins/document-ai.js - Live PDF, Notes & Document AI Assistant for KHAN-MD
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { cmd, commands } from '../command.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Max document size: 25MB (Gemini inlineData limit is ~20-25MB)
const MAX_DOC_SIZE_BYTES = 25 * 1024 * 1024;

// Active Document Sessions: Map<chatId, DocumentSession>
// Allows users to upload a document once and ask multiple follow-up questions!
const activeDocSessions = new Map();
const DOC_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

// Cooldown and active processing tracking
const activeProcessingChats = new Set();
const processedDocMsgIds = new Set();

/**
 * Format bytes into human readable string (KB, MB)
 */
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Safely send message with reconnection retry
 */
async function safeSendMessage(conn, jid, content, options = {}, maxRetries = 3) {
    if (!conn) return null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (!conn.ws || conn.ws.isOpen === false) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
        }

        try {
            return await conn.sendMessage(jid, content, options);
        } catch (err) {
            const errMsg = err?.message || '';
            const statusCode = err?.output?.statusCode;
            const isConnectionClosed = 
                errMsg.includes('Connection Closed') || 
                errMsg.includes('precondition') || 
                statusCode === 428 ||
                err?.data === null;

            if (isConnectionClosed && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }

            if (options.quoted && attempt === maxRetries) {
                try {
                    const fallbackOptions = { ...options };
                    delete fallbackOptions.quoted;
                    return await conn.sendMessage(jid, content, fallbackOptions);
                } catch (_) {}
            }

            console.error(`[Document-AI] Message delivery error on attempt ${attempt}:`, errMsg);
            return null;
        }
    }
    return null;
}

/**
 * Safely send presence update
 */
async function safeSendPresence(conn, type, jid) {
    if (!conn?.ws || conn.ws.isOpen === false) return;
    try {
        await conn.sendPresenceUpdate(type, jid);
    } catch (_) {}
}

/**
 * Extract clean plain text from DOCX buffer using AdmZip
 */
function extractTextFromDocx(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const xml = zip.readAsText('word/document.xml');
        if (!xml) return null;

        // Replace paragraph breaks and remove XML tags
        const text = xml
            .replace(/<w:p[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        return text || null;
    } catch (e) {
        console.warn('[Document-AI] Failed to extract DOCX text:', e?.message || e);
        return null;
    }
}

/**
 * Detect file type and extract suitable Gemini input parts from document buffer
 */
function processDocumentBuffer(buffer, fileName = '', mimetype = '') {
    const ext = path.extname(fileName || '').toLowerCase();
    const mime = (mimetype || '').toLowerCase();

    // 1. PDF Document
    if (ext === '.pdf' || mime.includes('pdf')) {
        return {
            type: 'pdf',
            geminiPart: {
                inlineData: {
                    mimeType: 'application/pdf',
                    data: buffer.toString('base64')
                }
            },
            text: null
        };
    }

    // 2. Word Document (DOCX)
    if (ext === '.docx' || mime.includes('wordprocessingml') || mime.includes('docx')) {
        const docxText = extractTextFromDocx(buffer);
        if (docxText) {
            // Trim if text exceeds ~150,000 characters to stay within token limits
            const safeText = docxText.length > 150000 ? docxText.slice(0, 150000) + '\n\n[Content truncated due to size]' : docxText;
            return {
                type: 'docx',
                geminiPart: { text: `[Content of Word Document: "${fileName}"]\n\n${safeText}` },
                text: safeText
            };
        }
    }

    // 3. Plain Text, Notes, Markdown, JSON, Code files
    const isTextFile = 
        ext === '.txt' || ext === '.text' || ext === '.md' || ext === '.json' || 
        ext === '.csv' || ext === '.rtf' || ext === '.py' || ext === '.js' || 
        ext === '.html' || ext === '.css' || mime.startsWith('text/') || 
        mime.includes('json') || mime.includes('markdown');

    if (isTextFile) {
        const rawText = buffer.toString('utf8');
        const safeText = rawText.length > 150000 ? rawText.slice(0, 150000) + '\n\n[Content truncated due to size]' : rawText;
        return {
            type: 'text',
            geminiPart: { text: `[Content of Document/Note: "${fileName}"]\n\n${safeText}` },
            text: safeText
        };
    }

    // 4. Scanned Image Document (Photo of note / page)
    const isImageFile = 
        ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || 
        mime.startsWith('image/');

    if (isImageFile) {
        const imgMime = mime.startsWith('image/') ? mime : (ext === '.png' ? 'image/png' : 'image/jpeg');
        return {
            type: 'image',
            geminiPart: {
                inlineData: {
                    mimeType: imgMime,
                    data: buffer.toString('base64')
                }
            },
            text: null
        };
    }

    // Default fallback: Try text extraction
    try {
        const rawText = buffer.toString('utf8');
        // Basic check if it looks like readable text
        const nonPrintableCount = (rawText.slice(0, 500).match(/[\x00-\x08\x0E-\x1F]/g) || []).length;
        if (nonPrintableCount < 5) {
            const safeText = rawText.length > 150000 ? rawText.slice(0, 150000) : rawText;
            return {
                type: 'text',
                geminiPart: { text: `[Content of Document: "${fileName}"]\n\n${safeText}` },
                text: safeText
            };
        }
    } catch (_) {}

    return null;
}

/**
 * Query Gemini AI using document contents and question/prompt
 */
async function queryDocumentWithGemini(session, userPrompt, chatId = null) {
    const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    if (!apiKey || !session || !session.geminiPart) return null;

    const botName = config.BOT_NAME || "Zypher MD";
    const ownerName = config.OWNER_NAME || "Shenura Nimnada";

    const systemPrompt = `You are ${botName}, an expert Academic, Study, and Document AI Assistant created by ${ownerName}.
You have been provided with an uploaded document or study note named "${session.fileName}".
Your objective is to help the user understand, study, analyze, and learn from this document.

Guidelines:
1. Provide accurate, thorough, and insightful answers strictly based on the provided document.
2. Reply in the exact same language the user asks in (Sinhala, Singlish, or English). If the user writes in Sinhala or Singlish, reply naturally in Sinhala/Singlish!
3. Format your answers beautifully using WhatsApp markdown:
   - *Bold headings* and key concepts.
   - Clear bullet points (•) for readability.
   - Numbered steps (1., 2.) for procedures or rankings.
   - Code blocks (\`\`\`) for code or mathematical formulas.
4. If asked for a "Summary" (සාරාංශය): Provide an executive summary followed by core themes and key conclusions.
5. If asked for "Short Notes" (කෙටි සටහන්): Structure them into high-yield, point-form revision notes perfect for exam prep.
6. If asked for "Questions / Quiz / MCQs" (ප්‍රශ්න පත්‍ර): Formulate 3-5 exam-style questions with accurate answers and brief explanations.
7. If asked for "Translation" (පරිවර්තනය): Translate the requested sections accurately into the target language.
8. If the user's question cannot be answered using the document, politely mention that this information is not found in the document, but provide general guidance if appropriate.`;

    // Build conversation history (up to 6 turns)
    const historyTurns = (session.history || []).slice(-6);

    const contents = [
        // 1. Initial turn: Introduce the document
        {
            role: 'user',
            parts: [
                { text: `Here is the document: "${session.fileName}". Please study and reference this document for all subsequent questions:` },
                session.geminiPart
            ]
        },
        {
            role: 'model',
            parts: [
                { text: `I have thoroughly read and indexed "${session.fileName}". What would you like to know or learn from it?` }
            ]
        },
        // 2. Prior Q&A turns
        ...historyTurns,
        // 3. Current user question
        {
            role: 'user',
            parts: [{ text: userPrompt }]
        }
    ];

    const models = [
        'gemini-3.1-flash-lite-preview',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash'
    ];

    const payload = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents
    };

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(18000)
            });

            if (res.status === 200) {
                const data = await res.json();
                const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (replyText) {
                    // Update session history
                    session.history.push({ role: 'user', parts: [{ text: userPrompt }] });
                    session.history.push({ role: 'model', parts: [{ text: replyText }] });
                    session.lastUpdated = Date.now();
                    return replyText;
                }
            }
        } catch (e) {
            // Try next model if timeout or rate limit
        }
    }

    return null;
}

/**
 * Get a quick 1-sentence topic / title summary of the uploaded document
 */
async function getQuickDocumentTopic(session) {
    const prompt = "In 1 short sentence (under 15 words) in Sinhala and English, state what topic, subject, or lesson this document is about. Format: 'විෂය / Topic: <summary>'";
    try {
        const res = await queryDocumentWithGemini(session, prompt);
        if (res) return res.split('\n')[0].replace(/[*_#]/g, '').trim();
    } catch (_) {}
    return session.fileName;
}

/**
 * Handle incoming WhatsApp Document message
 */
async function handleIncomingDocument(sock, mek, docMsg) {
    if (!sock || !mek || !docMsg) return;

    const from = mek.key?.remoteJid;
    if (!from || from === 'status@broadcast' || from.endsWith('@newsletter') || from.endsWith('@broadcast')) return;

    const msgId = mek.key?.id;
    if (msgId && processedDocMsgIds.has(msgId)) return;
    if (msgId) {
        processedDocMsgIds.add(msgId);
        if (processedDocMsgIds.size > 200) {
            const oldest = Array.from(processedDocMsgIds).slice(0, 50);
            oldest.forEach(id => processedDocMsgIds.delete(id));
        }
    }

    const botJid = sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
    const botLid = sock?.user?.id ? sock.user.id.split(':')[0] + '@lid' : null;

    if (mek.key?.fromMe) {
        if (from !== botJid) return;
    }

    const isDocAiEnabled = (config.DOCUMENT_AI || 'true').toLowerCase() !== 'false';
    if (!isDocAiEnabled) return;

    const chatbotMode = (config.CHATBOT || 'on').toLowerCase();
    if (chatbotMode === 'off' || chatbotMode === 'false') return;

    const isGroup = from.endsWith('@g.us');

    // In groups, only trigger if bot is mentioned or if document has caption addressing bot or user quoted bot
    if (isGroup) {
        const caption = (docMsg.caption || '').trim().toLowerCase();
        const botName = (config.BOT_NAME || 'Zypher MD').toLowerCase();
        const contextInfo = docMsg.contextInfo;
        const quotedParticipant = contextInfo?.participant;
        const mentionedJids = contextInfo?.mentionedJid || [];

        const isQuoted = quotedParticipant && (quotedParticipant === botJid || quotedParticipant === botLid);
        const isMentioned = (botJid && mentionedJids.includes(botJid)) || (botLid && mentionedJids.includes(botLid));
        const hasBotMention = caption.includes('bot') || caption.includes(botName);

        if (!isQuoted && !isMentioned && !hasBotMention) {
            return; // In groups, ignore normal shared docs unless bot is addressed
        }
    }

    if (activeProcessingChats.has(from)) return;
    activeProcessingChats.add(from);

    try {
        const fileName = docMsg.fileName || 'Document.pdf';
        const mimetype = docMsg.mimetype || 'application/pdf';
        const fileLength = Number(docMsg.fileLength || 0);
        const userCaption = (docMsg.caption || '').trim();

        console.log(`[Document-AI] 📄 Processing document "${fileName}" (${formatFileSize(fileLength)}) from ${from}...`);

        // Check file size limit
        if (fileLength > MAX_DOC_SIZE_BYTES) {
            await safeSendMessage(sock, from, {
                text: `⚠️ *FILE SIZE TOO LARGE*\n\n> ඔබ එවූ ලේඛනය (${formatFileSize(fileLength)}) ඉතා විශාලය. උපරිම ගොනු ප්‍රමාණය *25 MB* වේ.\n> කරුණාකර 25 MB ට අඩු PDF හෝ Document එකක් එවන්න.`
            }, { quoted: mek });
            return;
        }

        // Show typing indicator in WhatsApp
        await safeSendPresence(sock, 'composing', from);

        // Download document buffer from WhatsApp servers
        const stream = await downloadContentFromMessage(docMsg, 'document');
        let docBuffer = Buffer.from([]);
        for await (const chunk of stream) {
            docBuffer = Buffer.concat([docBuffer, chunk]);
        }

        if (!docBuffer || docBuffer.length === 0) {
            console.warn('[Document-AI] Empty document buffer received');
            return;
        }

        // Process buffer for Gemini (PDF, DOCX, TXT, Image)
        const processed = processDocumentBuffer(docBuffer, fileName, mimetype);
        if (!processed) {
            await safeSendMessage(sock, from, {
                text: `❌ *නොගැලපෙන ගොනු ආකෘතියක් (Unsupported Format)*\n\n> කරුණාකර *PDF (.pdf)*, *Word (.docx)*, *Text (.txt)*, හෝ *Notes* ගොනුවක් එවන්න.`
            }, { quoted: mek });
            return;
        }

        // Create new active document session
        const session = {
            fileName: fileName,
            mimetype: mimetype,
            fileSize: fileLength,
            formattedSize: formatFileSize(fileLength),
            geminiPart: processed.geminiPart,
            extractedText: processed.text,
            type: processed.type,
            timestamp: Date.now(),
            lastUpdated: Date.now(),
            history: []
        };

        // Cache session
        activeDocSessions.set(from, session);

        // CASE 1: User uploaded document WITH a specific question or instruction in caption
        if (userCaption) {
            const answer = await queryDocumentWithGemini(session, userCaption, from);
            if (answer) {
                const responseText = 
`📄 *DOCUMENT AI ANSWER* 🤖
📌 *File:* _${fileName}_

${answer}

> 💡 _තවත් ප්‍රශ්න ඇසීමට කෙලින්ම Chat එකට පණිවිඩයක් එවන්න. ලේඛනය ඉවත් කිරීමට:_ *.doc clear*`;

                await safeSendMessage(sock, from, { text: responseText }, { quoted: mek });
                return;
            }
        }

        // CASE 2: User uploaded document WITHOUT caption -> Send interactive welcome card
        const quickTopic = await getQuickDocumentTopic(session);
        const botName = config.BOT_NAME || "Zypher MD";

        const welcomeCard = 
`📄 *DOCUMENT RECEIVED & READY* 🤖

📌 *ගොනුව (File):* ${fileName} (${session.formattedSize})
📑 *මාතෘකාව (Topic):* ${quickTopic || 'Study & Reference Material'}

✨ *මට මෙම Document එකෙන් ඔබට කළ හැකි දේවල්:*
• 📝 *සාරාංශය (Summary):* _"මේක summarize කරන්න"_
• 📌 *කෙටි සටහන් (Short Notes):* _"Exam එකට short notes හදන්න"_
• ❓ *ප්‍රශ්න ඇසීම (Q&A):* _ඕනෑම ප්‍රශ්නයක් විමසන්න_
• 🎯 *Quiz / MCQs:* _"MCQ ප්‍රශ්න 5ක් හදන්න"_
• 🌐 *පරිවර්තනය (Translation):* _"මේක සිංහලට පරිවර්තනය කරන්න"_

💬 *දැන්ම ඔබේ ප්‍රශ්නය හෝ අවශ්‍යතාව මෙම Chat එකට එවන්න!*
_Powered by ${botName} & Google Gemini AI_`;

        await safeSendMessage(sock, from, { text: welcomeCard }, { quoted: mek });

    } catch (err) {
        console.error('[Document-AI] Error handling document:', err?.message || err);
        await safeSendMessage(sock, from, {
            text: `❌ *ලේඛනය කියවීමේදී දෝෂයක් ඇති විය.* කරුණාකර නැවත උත්සාහ කරන්න.`
        }, { quoted: mek });
    } finally {
        activeProcessingChats.delete(from);
    }
}

/**
 * Attach document message listener to Baileys socket
 */
function attachDocumentHandler(sock) {
    if (!sock) return;
    if (sock._documentAiHandlerAttached) return;
    sock._documentAiHandlerAttached = true;

    console.log('✅ [Document-AI] PDF, Notes & Document AI Assistant attached to socket');

    // Listen for incoming WhatsApp messages to catch documents
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!Array.isArray(messages)) return;
        for (const mek of messages) {
            try {
                if (!mek.message) continue;

                // Extract document message if present
                const docMsg = mek.message.documentMessage ||
                               mek.message.documentWithCaptionMessage?.message?.documentMessage ||
                               mek.message.ephemeralMessage?.message?.documentMessage ||
                               mek.message.viewOnceMessage?.message?.documentMessage;

                if (!docMsg) continue;

                await handleIncomingDocument(sock, mek, docMsg);
            } catch (e) {
                console.error('[Document-AI] messages.upsert document error:', e?.message || e);
            }
        }
    });
}

// Global hook for socket creation
const prevDocSocketHook = global.__onWASocketCreated;
global.__onWASocketCreated = (sock) => {
    if (typeof prevDocSocketHook === 'function') prevDocSocketHook(sock);
    attachDocumentHandler(sock);
};

global.__attachDocumentHandler = attachDocumentHandler;

// Check if socket is already available
if (global.__currentWASocket) {
    attachDocumentHandler(global.__currentWASocket);
}

// ==================== DOCUMENT AI & FOLLOW-UP CHAT HANDLER ====================
cmd({
    on: "body"
}, async (conn, mek, m, baseOptions) => {
    const { from, body, isCmd, isGroup } = baseOptions;

    if (conn) {
        global.__currentWASocket = conn;
        if (!conn._documentAiHandlerAttached) {
            attachDocumentHandler(conn);
        }
    }

    try {
        if (!body || typeof body !== 'string') return;
        const cleanBody = body.trim();
        if (!cleanBody) return;

        // Ignore commands (they are processed by command router)
        const prefix = config.PREFIX || '.';
        if (isCmd || cleanBody.startsWith(prefix)) return;

        // Check if there is an active document session for this chat
        const session = activeDocSessions.get(from);
        if (!session) return;

        // Check session timeout (30 minutes)
        const now = Date.now();
        if (now - session.lastUpdated > DOC_SESSION_TIMEOUT_MS) {
            activeDocSessions.delete(from);
            return;
        }

        // In groups, only answer if bot is quoted or mentioned
        if (isGroup) {
            const botJid = conn?.user?.id ? conn.user.id.split(':')[0] + '@s.whatsapp.net' : null;
            const botLid = conn?.user?.id ? conn.user.id.split(':')[0] + '@lid' : null;
            const quotedSender = baseOptions.quoted?.sender || mek?.message?.extendedTextMessage?.contextInfo?.participant;
            const isQuoted = baseOptions.quoted?.fromMe || (quotedSender && (quotedSender === botJid || quotedSender === botLid));
            const mentionedJids = m?.mentionedJid || mek?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isMentioned = (botJid && mentionedJids.includes(botJid)) || (botLid && mentionedJids.includes(botLid));

            if (!isQuoted && !isMentioned) return;
        }

        // Prevent parallel duplicate queries
        if (activeProcessingChats.has(from)) return;
        activeProcessingChats.add(from);

        await safeSendPresence(conn, 'composing', from);

        const answer = await queryDocumentWithGemini(session, cleanBody, from);

        if (answer) {
            const replyMsg = 
`📄 *${session.fileName}*
━━━━━━━━━━━━━━━━━━━
${answer}

> 💡 _තවත් ප්‍රශ්න අසන්න. ලේඛනය ඉවත් කිරීමට:_ *.doc clear*`;

            await safeSendMessage(conn, from, { text: replyMsg }, { quoted: mek });
        }
    } catch (err) {
        console.error('[Document-AI] Follow-up query error:', err?.message || err);
    } finally {
        activeProcessingChats.delete(from);
    }
});

// ==================== EXPLICIT DOCUMENT COMMANDS ====================
cmd({
    pattern: "doc",
    alias: ["pdf", "notesai", "study", "askdoc", "document"],
    desc: "Ask questions, summarize, or extract notes from uploaded PDF or Document",
    category: "ai",
    react: "📄",
    filename: __filename
}, async (conn, mek, m, { args, q, reply, from, isCreator }) => {
    const subCmd = args[0]?.toLowerCase();

    // 1. Info Command: .doc info
    if (subCmd === 'info') {
        const session = activeDocSessions.get(from);
        if (!session) {
            return reply(`📄 *DOCUMENT AI STATUS*\n\n> සක්‍රීය ලේඛනයක් නොමැත.\n> කරුණාකර PDF හෝ Document එකක් Chat එකට upload කරන්න.`);
        }
        const activeMinutes = Math.round((Date.now() - session.timestamp) / 60000);
        return reply(
            `📄 *ACTIVE DOCUMENT SESSION*\n\n` +
            `📌 *ගොනුව:* ${session.fileName}\n` +
            `📊 *ප්‍රමාණය:* ${session.formattedSize}\n` +
            `📂 *වර්ගය:* ${session.type.toUpperCase()}\n` +
            `⏱️ *සක්‍රීය වී:* මිනිත්තු ${activeMinutes} කට පෙර\n` +
            `💬 *ප්‍රශ්න ගණන:* ${Math.round(session.history.length / 2)}\n\n` +
            `> 💡 _ප්‍රශ්න ඇසීමට:_ *.doc <ප්‍රශ්නය>* හෝ කෙලින්ම Text එකක් එවන්න.\n` +
            `> 🗑️ _ඉවත් කිරීමට:_ *.doc clear*`
        );
    }

    // 2. Clear Command: .doc clear
    if (subCmd === 'clear' || subCmd === 'reset') {
        if (activeDocSessions.has(from)) {
            activeDocSessions.delete(from);
            return reply(`✅ *ලේඛනය මතකයෙන් ඉවත් කරන ලදී (Document cleared).*`);
        } else {
            return reply(`ℹ️ *ඉවත් කිරීමට සක්‍රීය ලේඛනයක් නොමැත.*`);
        }
    }

    // 3. Toggle Command: .doc on / off
    if (subCmd === 'on' || subCmd === 'enable') {
        if (!isCreator) return reply("*📛 Only the bot owner can use this setting!*");
        config.DOCUMENT_AI = "true";
        process.env.DOCUMENT_AI = "true";
        return reply("*✅ Document & PDF AI Assistant has been ENABLED!*");
    } else if (subCmd === 'off' || subCmd === 'disable') {
        if (!isCreator) return reply("*📛 Only the bot owner can use this setting!*");
        config.DOCUMENT_AI = "false";
        process.env.DOCUMENT_AI = "false";
        return reply("*❌ Document & PDF AI Assistant has been DISABLED.*");
    }

    // 4. Handle Quoted Document (User replied to an earlier document message)
    let targetSession = activeDocSessions.get(from);
    const quotedDocMsg = 
        mek?.quoted?.message?.documentMessage || 
        m?.quoted?.message?.documentMessage ||
        mek?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

    if (quotedDocMsg) {
        try {
            await safeSendPresence(conn, 'composing', from);
            const stream = await downloadContentFromMessage(quotedDocMsg, 'document');
            let docBuffer = Buffer.from([]);
            for await (const chunk of stream) {
                docBuffer = Buffer.concat([docBuffer, chunk]);
            }

            if (docBuffer && docBuffer.length > 0) {
                const fileName = quotedDocMsg.fileName || 'Quoted_Document.pdf';
                const processed = processDocumentBuffer(docBuffer, fileName, quotedDocMsg.mimetype);
                if (processed) {
                    targetSession = {
                        fileName: fileName,
                        mimetype: quotedDocMsg.mimetype || 'application/pdf',
                        fileSize: docBuffer.length,
                        formattedSize: formatFileSize(docBuffer.length),
                        geminiPart: processed.geminiPart,
                        extractedText: processed.text,
                        type: processed.type,
                        timestamp: Date.now(),
                        lastUpdated: Date.now(),
                        history: []
                    };
                    activeDocSessions.set(from, targetSession);
                }
            }
        } catch (e) {
            console.error('[Document-AI] Error downloading quoted doc:', e?.message || e);
        }
    }

    // If still no document is available:
    if (!targetSession) {
        return reply(
            `📄 *DOCUMENT & NOTES AI ASSISTANT*\n\n` +
            `*භාවිතා කරන ආකාරය:*\n` +
            `1️⃣ PDF හෝ Document එකක් Chat එකට upload කරන්න (Caption එක සමඟ හෝ නැතිව).\n` +
            `2️⃣ නැතහොත් කලින් එවූ Document එකකට reply කර *.doc <ප්‍රශ්නය>* ලෙස ටයිප් කරන්න.\n\n` +
            `*විධාන උදාහරණ:*\n` +
            `• *.doc summarize* - සම්පූර්ණ ලේඛනයේ සාරාංශයක් ලබාගැනීම\n` +
            `• *.doc short notes* - විභාගයට කෙටි සටහන් ලබාගැනීම\n` +
            `• *.doc exam questions* - ප්‍රශ්න සහ පිළිතුරු 5ක් සෑදීම\n` +
            `• *.doc info* - සක්‍රීය ලේඛනයේ තොරතුරු බැලීම\n` +
            `• *.doc clear* - ලේඛනය ඉවත් කිරීම`
        );
    }

    // Default question if none provided: Summarize
    let userQuery = q ? q.trim() : 'Summarize this document comprehensively with key bullet points in Sinhala and English.';
    if (subCmd === 'summary' || subCmd === 'summarize') {
        userQuery = 'Summarize this document comprehensively with key bullet points in Sinhala and English.';
    } else if (subCmd === 'notes' || subCmd === 'shortnotes') {
        userQuery = 'Create structured, clear short notes with key takeaways from this document in Sinhala and English.';
    } else if (subCmd === 'quiz' || subCmd === 'exam' || subCmd === 'mcq') {
        userQuery = 'Generate 5 high-yield exam questions (with correct answers and brief explanations) based on this document.';
    }

    try {
        await safeSendPresence(conn, 'composing', from);
        const answer = await queryDocumentWithGemini(targetSession, userQuery, from);

        if (answer) {
            const replyMsg = 
`📄 *${targetSession.fileName}*
━━━━━━━━━━━━━━━━━━━
${answer}

> 💡 _තවත් ප්‍රශ්න අසන්න. ලේඛනය ඉවත් කිරීමට:_ *.doc clear*`;

            await safeSendMessage(conn, from, { text: replyMsg }, { quoted: mek });
        } else {
            return reply(`❌ *ලේඛනය විශ්ලේෂණය කිරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.*`);
        }
    } catch (e) {
        return reply(`❌ *Error:* ${e?.message || e}`);
    }
});

export {
    attachDocumentHandler,
    handleIncomingDocument,
    activeDocSessions
};

