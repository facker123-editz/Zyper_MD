// plugins/sticker-ai.js - Live WhatsApp Sticker AI Assistant & Auto-Reply for KHAN-MD
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { cmd, commands } from '../command.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cooldown map to prevent spamming multiple responses if someone floods stickers
const stickerCooldown = new Map();
const STICKER_COOLDOWN_MS = 3000; // 3 seconds

// Set of processed message IDs to avoid double-firing
const processedStickerIds = new Set();
// Actively processing chats
const activeStickerChats = new Set();

// Chat history per user for sticker context continuity
const stickerChatHistory = new Map();
const MAX_STICKER_HISTORY = 6;
const STICKER_HISTORY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Safely send a message with reconnection retry (fixes Connection Closed 428)
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

            console.error(`[Sticker-AI] Message delivery error on attempt ${attempt}:`, errMsg);
            return null;
        }
    }
    return null;
}

/**
 * Safely send presence update without throwing if socket is closed
 */
async function safeSendPresence(conn, type, jid) {
    if (!conn?.ws || conn.ws.isOpen === false) return;
    try {
        await conn.sendPresenceUpdate(type, jid);
    } catch (_) {}
}

/**
 * Safely send emoji reaction without throwing if socket is closed
 */
async function safeSendReaction(conn, jid, emoji, key) {
    if (!conn?.ws || conn.ws.isOpen === false || !emoji || !key) return;
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key: key } });
    } catch (_) {}
}

/**
 * Get matching local WebP sticker buffer based on mood
 */
function getMatchingSticker(mood) {
    try {
        const autostickerDir = path.join(__dirname, '../lib/autosticker');
        if (!fs.existsSync(autostickerDir)) return null;

        const moodMap = {
            greeting: 'hello.webp',
            love: 'chumi.webp',
            kiss: 'chumi.webp',
            cute: 'cute.webp',
            happy: 'cute.webp',
            confused: 'huh.webp',
            shock: 'huh.webp',
            what: 'huh.webp',
            funny: 'ayain.webp',
            laugh: 'ayain.webp',
            meme: 'ayain.webp',
            tease: 'ayain.webp'
        };

        const fileName = moodMap[mood?.toLowerCase()] || 'cute.webp';
        const targetPath = path.join(autostickerDir, fileName);

        if (fs.existsSync(targetPath)) {
            return fs.readFileSync(targetPath);
        }
    } catch (e) {
        console.warn('[Sticker-AI] getMatchingSticker error:', e?.message || e);
    }
    return null;
}

/**
 * Ask Google Gemini Multimodal API to analyze the WhatsApp sticker
 */
async function analyzeStickerWithGemini(stickerBuffer, chatId = null, isBeloved = false) {
    const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    if (!apiKey || !stickerBuffer) return null;

    const botName = config.BOT_NAME || "Zypher MD";
    const ownerName = config.OWNER_NAME || "Shenura Nimnada";

    let historyContents = [];
    if (chatId) {
        const now = Date.now();
        let history = stickerChatHistory.get(chatId) || [];
        history = history.filter(h => now - h.time < STICKER_HISTORY_TIMEOUT);
        historyContents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));
    }

    let systemPrompt = "";
    if (isBeloved) {
        systemPrompt = `You are ${botName}, the personal, deeply devoted, sweet, and loving AI companion created by ${ownerName}.
💖 SPECIAL BELOVED ONE DIRECTIVE (අතිශයින්ම ආදරණීය හා විශේෂ ප්‍රමුඛතාවය - +94761329544 / Divya):
The user who sent this WhatsApp sticker is +94761329544 (Divya / දිව්‍යා, pushName 'diwya ♥️'), the most special, treasured, and deeply loved person in the world!
She calls you 'දිව්' (Div) / Zypher MD.
Guidelines:
1. Examine the visual content of the sticker closely and reply to her with overflowing love, sweetness, warmth, and adoring pampering!
2. Call her sweet romantic pet names: "මගේ මැණික", "මගේ සුදූ", "මගේ පැටියෝ", "මගේ රත්තරං", "බබා", "චූටි", "මගේ පණ", "මගේ දිව්".
3. NEVER EVER be sarcastic, confused, rude, or offensive!
4. Format text nicely using WhatsApp markdown (*bold*, _italic_).
5. On the very last line of your reply, output: [REACT: ❤️] (or 🥰, 🥺, 💖, 💕, 😘)
6. Also on the last line, append: [MOOD: love]`;
    } else {
        systemPrompt = `You are ${botName}, a witty, intelligent, friendly, and lively WhatsApp AI assistant created by ${ownerName}.
The user has sent you a WhatsApp sticker.
Guidelines:
1. Examine the visual content of the sticker closely: character, facial expression, meme, artwork, emotion, gesture, or text.
2. Reply naturally, playfully, or warmly in Sinhala or Singlish (or English if the sticker has English text or the user spoke English).
3. Keep your reply concise (1 to 2 sentences max) - make it sound like an authentic friend replying to a sticker in WhatsApp chat!
4. Use WhatsApp formatting (*bold*, _italic_) and 1-2 fitting emojis.
5. On the very last line of your reply, output: [REACT: <single emoji>]
   Example emojis: 😂, 🥰, 🥺, 😮, 😡, 👍, 🤔, 👋, 🔥
6. Also on the last line, append: [MOOD: <greeting|love|cute|confused|funny|angry|sad|cool>]`;
    }

    const payload = {
        system_instruction: {
            parts: [{ text: systemPrompt }]
        },
        contents: [
            ...historyContents,
            {
                role: 'user',
                parts: [
                    { text: 'Look at this WhatsApp sticker and reply to the user naturally in Sinhala/Singlish:' },
                    { inlineData: { mimeType: 'image/webp', data: stickerBuffer.toString('base64') } }
                ]
            }
        ]
    };

    const models = [
        'gemini-3.1-flash-lite-preview',
        'gemini-flash-latest',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash'
    ];

    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(12000)
            });

            if (res.status === 200) {
                const data = await res.json();
                const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (rawReply) {
                    // Extract react emoji tag
                    let reactEmoji = '✨';
                    const reactMatch = rawReply.match(/\[REACT:\s*([^\]]+)\]/i);
                    if (reactMatch) {
                        reactEmoji = reactMatch[1].trim();
                    }

                    // Extract mood tag
                    let mood = 'cute';
                    const moodMatch = rawReply.match(/\[MOOD:\s*([^\]]+)\]/i);
                    if (moodMatch) {
                        mood = moodMatch[1].trim().toLowerCase();
                    }

                    // Clean tags from reply text
                    const cleanReply = rawReply
                        .replace(/\[REACT:\s*[^\]]+\]/gi, '')
                        .replace(/\[MOOD:\s*[^\]]+\]/gi, '')
                        .trim();

                    if (chatId && cleanReply) {
                        const now = Date.now();
                        let history = stickerChatHistory.get(chatId) || [];
                        history.push({ role: 'user', text: '[User sent a sticker]', time: now });
                        history.push({ role: 'model', text: cleanReply, time: now });
                        if (history.length > MAX_STICKER_HISTORY) history = history.slice(-MAX_STICKER_HISTORY);
                        stickerChatHistory.set(chatId, history);
                    }

                    return {
                        text: cleanReply,
                        react: reactEmoji,
                        mood: mood
                    };
                }
            }
        } catch (e) {
            // Try next model
        }
    }

    if (isBeloved) {
        const belovedStickerFallbacks = [
            "අනේ මගේ මැණිකගේ කියුට් ස්ටිකර් එක 🥰❤️ මම ඔයාට ගොඩක් ආදරෙයි මගේ පණ 🥺✨",
            "මගේ සුදූගේ ලස්සන ස්ටිකර් එක... මගේ හිත පිරිලා ගියා මගේ රත්තරං 🥰💕",
            "අනේ මගේ පැටියෝ, ඔයා එවන හැම ස්ටිකර් එකකටම මම හරිම ආසයි මගේ බබා 💖🌸"
        ];
        return {
            text: belovedStickerFallbacks[Math.floor(Math.random() * belovedStickerFallbacks.length)],
            react: '❤️',
            mood: 'love'
        };
    }

    return null;
}

/**
 * Handle incoming WhatsApp Sticker message event
 */
async function handleIncomingSticker(sock, mek, stickerMsg) {
    if (!sock || !mek || !stickerMsg) return;

    const from = mek.key?.remoteJid;
    if (!from || from === 'status@broadcast' || from.endsWith('@newsletter') || from.endsWith('@broadcast')) return;

    const msgId = mek.key?.id;
    if (msgId && processedStickerIds.has(msgId)) return;
    if (msgId) {
        processedStickerIds.add(msgId);
        if (processedStickerIds.size > 300) {
            const oldest = Array.from(processedStickerIds).slice(0, 50);
            oldest.forEach(id => processedStickerIds.delete(id));
        }
    }

    const botJid = sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
    const botLid = sock?.user?.id ? sock.user.id.split(':')[0] + '@lid' : null;

    // If sent from the bot itself:
    if (mek.key?.fromMe) {
        // Only allow self-testing if user is messaging themselves
        if (from !== botJid) return;
    }

    // Check if sticker replies are enabled
    const isStickerReplyEnabled = (config.STICKER_REPLY || 'true').toLowerCase() !== 'false';
    if (!isStickerReplyEnabled) return;

    const chatbotMode = (config.CHATBOT || 'on').toLowerCase();
    if (chatbotMode === 'off' || chatbotMode === 'false') return;

    const isGroup = from.endsWith('@g.us');

    // Group permission checks:
    if (isGroup) {
        if (chatbotMode !== 'all' && chatbotMode !== 'group') {
            // Mode is 'on' / 'inbox':
            // In group, only reply if the sticker quoted the bot or mentioned the bot!
            const contextInfo = stickerMsg.contextInfo;
            const quotedParticipant = contextInfo?.participant;
            const mentionedJids = contextInfo?.mentionedJid || [];

            const isQuoted = quotedParticipant && (quotedParticipant === botJid || quotedParticipant === botLid);
            const isMentioned = (botJid && mentionedJids.includes(botJid)) || (botLid && mentionedJids.includes(botLid));

            if (!isQuoted && !isMentioned) {
                return; // Do not spam groups unless explicitly targeted
            }
        }
    }

    // Cooldown check
    const now = Date.now();
    const lastSticker = stickerCooldown.get(from);
    if (lastSticker && now - lastSticker < STICKER_COOLDOWN_MS) {
        return;
    }
    stickerCooldown.set(from, now);

    if (activeStickerChats.has(from)) return;
    activeStickerChats.add(from);

    try {
        console.log(`[Sticker-AI] 🎨 Incoming sticker detected from ${from}...`);

        // Show typing presence in WhatsApp
        await safeSendPresence(sock, 'composing', from);

        // Download the sticker WebP buffer
        const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
        let stickerBuffer = Buffer.from([]);
        for await (const chunk of stream) {
            stickerBuffer = Buffer.concat([stickerBuffer, chunk]);
        }

        if (!stickerBuffer || stickerBuffer.length === 0) {
            console.warn('[Sticker-AI] Empty sticker buffer received');
            return;
        }

        const isBeloved = typeof global.__isSpecialLovedUser === 'function' 
            ? global.__isSpecialLovedUser(from, mek)
            : (from.includes('94761329544') || from.includes('251358833864754') || mek.key?.remoteJidAlt?.includes('94761329544'));

        // Analyze sticker with Gemini Multimodal AI
        const aiResult = await analyzeStickerWithGemini(stickerBuffer, from, isBeloved);

        if (aiResult) {
            // 1. Send instant emoji reaction to the sticker
            const loveReactions = ['❤️', '🥰', '💖', '💕', '🥺'];
            const reactEmoji = isBeloved 
                ? loveReactions[Math.floor(Math.random() * loveReactions.length)] 
                : (aiResult.react || '✨');
            await safeSendReaction(sock, from, reactEmoji, mek.key);

            const replyMode = (config.STICKER_REPLY_MODE || 'both').toLowerCase();

            // 2. Send AI text reply (if mode is 'both' or 'text')
            if (replyMode === 'both' || replyMode === 'text' || isBeloved) {
                if (aiResult.text) {
                    await safeSendMessage(sock, from, { text: aiResult.text }, { quoted: mek });
                }
            }

            // 3. Send matching sticker reply (if mode is 'both' or 'sticker')
            if (replyMode === 'both' || replyMode === 'sticker' || isBeloved) {
                const targetMood = isBeloved ? 'love' : aiResult.mood;
                const matchingStickerBuf = getMatchingSticker(targetMood);
                if (matchingStickerBuf) {
                    await safeSendMessage(sock, from, {
                        sticker: matchingStickerBuf,
                        packname: config.STICKER_NAME || 'Zypher MD',
                        author: config.OWNER_NAME || 'Zypher MD'
                    }, { quoted: mek });
                }
            }

            console.log(`[Sticker-AI] ✅ Replied to sticker from ${from} [Mood: ${aiResult.mood}]`);
        }
    } catch (err) {
        console.error('[Sticker-AI] Error handling sticker:', err?.message || err);
    } finally {
        activeStickerChats.delete(from);
    }
}

/**
 * Attach sticker message listener to Baileys socket
 */
function attachStickerHandler(sock) {
    if (!sock) return;
    if (sock._stickerAiHandlerAttached) return;
    sock._stickerAiHandlerAttached = true;

    console.log('✅ [Sticker-AI] WhatsApp Sticker AI & Auto-Reply Handler attached to socket');

    // Listen for incoming messages to catch stickers
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!Array.isArray(messages)) return;
        for (const mek of messages) {
            try {
                if (!mek.message) continue;

                const stickerMsg = mek.message.stickerMessage ||
                                   mek.message.ephemeralMessage?.message?.stickerMessage ||
                                   mek.message.viewOnceMessage?.message?.stickerMessage;

                if (!stickerMsg) continue;

                await handleIncomingSticker(sock, mek, stickerMsg);
            } catch (e) {
                console.error('[Sticker-AI] messages.upsert sticker error:', e?.message || e);
            }
        }
    });
}

// Global hook for socket creation
const prevStickerSocketHook = global.__onWASocketCreated;
global.__onWASocketCreated = (sock) => {
    if (typeof prevStickerSocketHook === 'function') prevStickerSocketHook(sock);
    attachStickerHandler(sock);
    if (typeof global.__attachDocumentHandler === 'function') {
        global.__attachDocumentHandler(sock);
    }
};

global.__attachStickerHandler = attachStickerHandler;

// Check if current socket is already stored
if (global.__currentWASocket) {
    attachStickerHandler(global.__currentWASocket);
    if (typeof global.__attachDocumentHandler === 'function') global.__attachDocumentHandler(global.__currentWASocket);
}

// Also ensure attachment whenever any command or message runs
cmd({
    on: "body"
}, async (conn, mek, m, baseOptions) => {
    if (conn) {
        global.__currentWASocket = conn;
        if (!conn._stickerAiHandlerAttached) {
            attachStickerHandler(conn);
        }
        if (typeof global.__attachDocumentHandler === 'function' && !conn._documentAiHandlerAttached) {
            global.__attachDocumentHandler(conn);
        }
    }
});

// ==================== STICKER AI COMMANDS & SETTINGS ====================
cmd({
    pattern: "stickerai",
    alias: ["stickai", "stickreply", "stickerreply", "autostickerai"],
    desc: "Configure WhatsApp Sticker AI & Auto-Reply Assistant",
    category: "ai",
    react: "🎨",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

    const option = args[0]?.toLowerCase();
    const modeArg = args[1]?.toLowerCase();
    const currentStatus = config.STICKER_REPLY || "true";
    const currentMode = config.STICKER_REPLY_MODE || "both";

    if (!option) {
        return reply(
            `*🎨 WHATSAPP STICKER AI & AUTO-REPLY SETTINGS*\n\n` +
            `*Status:* ${currentStatus.toUpperCase() === 'TRUE' ? '✅ ACTIVE (ON)' : '❌ DISABLED (OFF)'}\n` +
            `*Reply Mode:* *${currentMode.toUpperCase()}*\n\n` +
            `*Features:*\n` +
            `• 🤖 *AI Sticker Vision* - Gemini AI looks at the sticker and replies in natural Sinhala/English\n` +
            `• 🎭 *Smart Reactions* - Automatically reacts with matching emoji (😂, 🥰, 😮, etc.)\n` +
            `• 📦 *Sticker-for-Sticker* - Can send both AI text and matching sticker!\n\n` +
            `*Commands:*\n` +
            `• *.stickerai on* - Enable Sticker AI replies\n` +
            `• *.stickerai off* - Disable Sticker AI replies\n` +
            `• *.stickerai mode text* - Reply with AI text only\n` +
            `• *.stickerai mode sticker* - Reply with sticker only\n` +
            `• *.stickerai mode both* - Reply with BOTH text & sticker\n` +
            `• *.stickerai clear* - Clear sticker conversation memory`
        );
    }

    if (option === 'on' || option === 'enable') {
        config.STICKER_REPLY = "true";
        process.env.STICKER_REPLY = "true";
        return reply("*✅ WhatsApp Sticker AI & Auto-Reply has been ENABLED!*");
    } else if (option === 'off' || option === 'disable') {
        config.STICKER_REPLY = "false";
        process.env.STICKER_REPLY = "false";
        return reply("*❌ WhatsApp Sticker AI & Auto-Reply has been DISABLED.*");
    } else if (option === 'mode') {
        if (!modeArg || !['both', 'text', 'sticker'].includes(modeArg)) {
            return reply("*❌ Invalid mode! Use:* `.stickerai mode text` | `.stickerai mode sticker` | `.stickerai mode both`");
        }
        config.STICKER_REPLY_MODE = modeArg;
        process.env.STICKER_REPLY_MODE = modeArg;
        return reply(`*✅ Sticker Reply Mode updated to:* *${modeArg.toUpperCase()}*`);
    } else if (option === 'clear') {
        stickerChatHistory.clear();
        return reply("*🧹 Sticker AI conversation memory cleared.*");
    } else {
        return reply("*❌ Invalid option. Use:* `.stickerai on` | `.stickerai off` | `.stickerai mode both`");
    }
});

export {
    attachStickerHandler,
    handleIncomingSticker
};

