// plugins/call-ai.js - Live Call & Voice AI Handler for KHAN-MD
import { fileURLToPath } from 'url';
import path from 'path';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import googleTTS from 'google-tts-api';
import { cmd, commands } from '../command.js';
import config from '../config.js';
import converter from '../lib/converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cooldown map to prevent spamming multiple responses for the same call
const callCooldown = new Map();
const CALL_COOLDOWN_MS = 15000; // 15 seconds

// Audio processing lock per chat
const processingAudio = new Set();

// Chat history per user for context continuity
const voiceChatHistory = new Map();
const MAX_VOICE_HISTORY = 6;
const VOICE_HISTORY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Check if a sender or chat ID belongs to the special beloved person (+94761329544 / Divya)
 */
function isSpecialLovedUser(from, mek = null, m = null, baseOptions = {}) {
    if (typeof global.__isSpecialLovedUser === 'function') {
        return global.__isSpecialLovedUser(from, mek, m, baseOptions);
    }
    const configured = String(config.SPECIAL_LOVED_NUMBER || '94761329544');
    const configuredLid = String(config.SPECIAL_LOVED_LID || '251358833864754');
    const targetDigits = configured.replace(/[^0-9]/g, '');
    const shortTarget = targetDigits.startsWith('94') ? targetDigits.slice(2) : targetDigits;
    const targetLid = configuredLid.replace(/[^0-9]/g, '');

    const rawList = [
        from,
        typeof from === 'object' ? (from?.from || from?.remoteJid || from?.id || from?.callerNumber) : null,
        baseOptions?.sender,
        baseOptions?.from,
        m?.sender,
        m?.chat,
        m?.from,
        m?.key?.remoteJid,
        m?.key?.remoteJidAlt,
        m?.key?.participant,
        m?.key?.participantAlt,
        mek?.key?.remoteJid,
        mek?.key?.remoteJidAlt,
        mek?.key?.participant,
        mek?.key?.participantAlt,
        mek?.participant,
        mek?.sender
    ].filter(Boolean);

    for (const raw of rawList) {
        const rawStr = String(raw).toLowerCase().trim();
        if (targetDigits && rawStr.includes(targetDigits)) return true;
        if (shortTarget && rawStr.includes(shortTarget)) return true;
        if (targetLid && rawStr.includes(targetLid)) return true;
        if (rawStr.includes('94761329544') || rawStr.includes('761329544') || rawStr.includes('251358833864754')) return true;

        const userPart = rawStr.split('@')[0].split(':')[0];
        const digits = userPart.replace(/[^0-9]/g, '');
        if (digits && (digits === targetDigits || digits.endsWith(shortTarget) || targetDigits.endsWith(digits) || digits === targetLid)) {
            return true;
        }
    }
    return false;
}

/**
 * Safely send presence update without throwing if socket is closed
 */
async function safePresence(conn, type, jid) {
    if (!conn?.ws || conn.ws.isOpen === false) return;
    try {
        await conn.sendPresenceUpdate(type, jid);
    } catch (_) {}
}

/**
 * Safely send a message
 */
async function safeSend(conn, jid, content, options = {}) {
    if (!conn?.ws || conn.ws.isOpen === false) return null;
    try {
        return await conn.sendMessage(jid, content, options);
    } catch (err) {
        console.error('[Call-AI] Send error:', err?.message || err);
        return null;
    }
}

// ==================== SRI LANKAN SOUND PROFILES & TTS CONFIG ====================
const SRI_LANKAN_SOUND_PROFILES = {
    'sinhala_female_warm': {
        name: 'Sri Lankan Female (Warm & Natural)',
        voice: 'Aoede',
        desc: 'Melodious, warm, friendly Sri Lankan female voice'
    },
    'sinhala_female_soft': {
        name: 'Sri Lankan Female (Soft & Gentle)',
        voice: 'Kore',
        desc: 'Gentle, soothing, soft-spoken female voice'
    },
    'sinhala_male_friendly': {
        name: 'Sri Lankan Male (Friendly & Lively)',
        voice: 'Puck',
        desc: 'Lively, energetic, friendly Sri Lankan male voice'
    },
    'sinhala_male_deep': {
        name: 'Sri Lankan Male (Deep & Calm)',
        voice: 'Charon',
        desc: 'Calm, confident, deep Sri Lankan male voice'
    }
};

/**
 * Clean & prepare text for smooth, authentic Sri Lankan Sinhala speech synthesis
 */
function prepareSinhalaSpeechText(text) {
    if (!text) return '';
    let clean = text
        .replace(/[*_~`]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\[CMD:[^\]]+\]/gi, '')
        .replace(/\[IMAGINE:[^\]]+\]/gi, '')
        .replace(/\[AIVIDEO:[^\]]+\]/gi, '')
        .trim();

    // Natural phonetic adaptations for common terms when spoken in Sinhala
    clean = clean
        .replace(/\bAI\b/gi, 'ඒ අයි')
        .replace(/\bBot\b/gi, 'බොට්')
        .replace(/\bWhatsApp\b/gi, 'වට්ස්ඇප්')
        .replace(/\bCall\b/gi, 'කෝල්')
        .replace(/\bVoice\s*Note\b/gi, 'වොයිස් නෝට්')
        .replace(/\bZypher\s*MD\b/gi, 'සයිෆර් එම්ඩී')
        .replace(/\bKHAN-MD\b/gi, 'ඛාන් එම්ඩී')
        .replace(/\.{2,}/g, '.')
        .replace(/\?{2,}/g, '?')
        .replace(/\!{2,}/g, '!')
        .trim();

    return clean;
}

/**
 * Convert text into WhatsApp PTT Voice Note (Opus OGG) using Sri Lankan Voice Profile on Gemini TTS
 */
async function textToVoiceNote(text, customVoice = null) {
    try {
        if (!text) return null;

        const cleanText = prepareSinhalaSpeechText(text);
        if (!cleanText) return null;

        // Resolve active voice profile name
        let selectedVoice = customVoice || config.GEMINI_VOICE || 'Aoede';
        if (SRI_LANKAN_SOUND_PROFILES[selectedVoice]) {
            selectedVoice = SRI_LANKAN_SOUND_PROFILES[selectedVoice].voice;
        }

        const validVoices = ['Aoede', 'Kore', 'Puck', 'Charon', 'Fenrir'];
        if (!validVoices.includes(selectedVoice)) {
            selectedVoice = 'Aoede'; // Best Sri Lankan Sinhala acoustic profile
        }

        const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";

        // 1. Primary: Use Google Gemini Flash TTS with Sri Lankan sound profile cascade
        if (apiKey) {
            const ttsModels = [
                'gemini-3.8-flash-lite-tts',
                'gemini-3.1-flash-tts-preview',
                'gemini-3.8-flash-tts'
            ];

            const payload = {
                contents: [{ role: 'user', parts: [{ text: cleanText }] }],
                generationConfig: {
                    responseModalities: ['audio'],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: selectedVoice
                            }
                        }
                    }
                }
            };

            for (const model of ttsModels) {
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(12000)
                    });

                    if (res.status === 200) {
                        const data = await res.json();
                        const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
                        if (inlineData?.data) {
                            const rawBuf = Buffer.from(inlineData.data, 'base64');
                            let wavBuf = rawBuf;

                            // Ensure valid WAV header exists if raw PCM returned
                            if (!rawBuf.subarray(0, 4).equals(Buffer.from('RIFF'))) {
                                const wavHeader = Buffer.alloc(44);
                                const sampleRate = 24000;
                                const numChannels = 1;
                                const bitsPerSample = 16;
                                const byteRate = sampleRate * numChannels * bitsPerSample / 8;
                                const blockAlign = numChannels * bitsPerSample / 8;
                                wavHeader.write('RIFF', 0);
                                wavHeader.writeUInt32LE(36 + rawBuf.length, 4);
                                wavHeader.write('WAVE', 8);
                                wavHeader.write('fmt ', 12);
                                wavHeader.writeUInt32LE(16, 16);
                                wavHeader.writeUInt16LE(1, 20);
                                wavHeader.writeUInt16LE(numChannels, 22);
                                wavHeader.writeUInt32LE(sampleRate, 24);
                                wavHeader.writeUInt32LE(byteRate, 28);
                                wavHeader.writeUInt16LE(blockAlign, 32);
                                wavHeader.writeUInt16LE(bitsPerSample, 34);
                                wavHeader.write('data', 36);
                                wavHeader.writeUInt32LE(rawBuf.length, 40);
                                wavBuf = Buffer.concat([wavHeader, rawBuf]);
                            }

                            const pttBuf = await converter.toPTT(wavBuf, 'wav');
                            if (pttBuf && pttBuf.length > 0) {
                                return pttBuf;
                            }
                        }
                    }
                } catch (geminiErr) {
                    // Try next model in cascade
                }
            }
        }

        // 2. Secondary Fallback: Google Translate TTS (Native Sinhala language code 'si')
        const isSinhala = /[\u0D80-\u0DFF]/.test(cleanText);
        const lang = isSinhala ? 'si' : 'en';
        const ttsText = cleanText.slice(0, 200);

        const url = googleTTS.getAudioUrl(ttsText, {
            lang: lang,
            slow: false,
            host: 'https://translate.google.com'
        });

        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;

        const arrayBuf = await res.arrayBuffer();
        const mp3Buf = Buffer.from(arrayBuf);
        const pttBuf = await converter.toPTT(mp3Buf, 'mp3');
        return pttBuf;
    } catch (err) {
        console.error('[Call-AI] TTS Conversion error:', err?.message || err);
        return null;
    }
}

/**
 * Ask Gemini API to generate response for an incoming call or voice audio
 */
async function callGemini(systemInstruction, userParts, chatId = null) {
    const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    if (!apiKey) return null;

    let historyContents = [];
    if (chatId) {
        const now = Date.now();
        let history = voiceChatHistory.get(chatId) || [];
        history = history.filter(h => now - h.time < VOICE_HISTORY_TIMEOUT);
        historyContents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));
    }

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: [
            ...historyContents,
            {
                role: 'user',
                parts: userParts
            }
        ],
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    const models = [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.5-flash',
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
                const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (replyText) {
                    if (chatId) {
                        const now = Date.now();
                        let history = voiceChatHistory.get(chatId) || [];
                        history.push({ role: 'user', text: '[Voice Note / Call]', time: now });
                        history.push({ role: 'model', text: replyText, time: now });
                        if (history.length > MAX_VOICE_HISTORY) history = history.slice(-MAX_VOICE_HISTORY);
                        voiceChatHistory.set(chatId, history);
                    }
                    return replyText;
                }
            }
        } catch (e) {
            // Try next model
        }
    }
    return null;
}

/**
 * Handle incoming WhatsApp call event
 */
async function handleIncomingCall(sock, call) {
    if (!call || !call.from || !call.id) return;

    // Check cooldown
    const lastCall = callCooldown.get(call.from);
    const now = Date.now();
    if (lastCall && now - lastCall < CALL_COOLDOWN_MS) {
        return;
    }
    callCooldown.set(call.from, now);

    console.log(`[Call-AI] 📞 Incoming call detected from ${call.from} (ID: ${call.id}, Video: ${call.isVideo})`);

    // Notify Two-Way Live Call Bridge (WebRTC Dashboard) if running
    try {
        fetch('http://localhost:3000/api/simulate-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: call.from, name: 'WhatsApp Caller' }),
            signal: AbortSignal.timeout(1000)
        }).catch(() => {});
    } catch (_) {}

    // 1. Decline / Reject the call politely (WhatsApp Web cannot receive audio stream)
    try {
        await sock.rejectCall(call.id, call.from);
    } catch (err) {
        console.warn('[Call-AI] Could not reject call:', err?.message || err);
    }

    const isCallAiEnabled = (config.CALL_AI || 'true').toLowerCase() !== 'false';
    if (!isCallAiEnabled) return;

    // 2. Indicate recording voice note
    await safePresence(sock, 'recording', call.from);

    const botName = config.BOT_NAME || "Zypher MD";
    const ownerName = config.OWNER_NAME || "Shenura Nimnada";
    const isBeloved = isSpecialLovedUser(call.from);

    // 3. Spoken greeting in Sinhala
    let spokenGreeting = `හෙලෝ! මම ${botName} AI සහායකයා. ඔබගේ Call එකට ස්තූතියි. WhatsApp bot කෙනෙකුට Live Call එකකට කෙලින්ම කතා කරන්න බැරි වුණත්, මට ඔබ සමඟ Voice Notes හරහා කෙලින්ම කතා කරන්න පුළුවන්! දැන්ම මට Voice Note එකක් හෝ Text එකක් එවන්න, මම කෙලින්ම මගේ හඬින් පිළිතුරු දෙන්නම්. ඔබට මගෙන් මොනවද දැනගන්න ඕන?`;

    // 5. Send attractive informational text message
    let infoText = 
`📞 *INCOMING CALL DETECTED* 🤖

👋 *හෙලෝ! ඔබගේ Call එක ලැබුණා.*

> ⚠️ WhatsApp තාක්ෂණය මඟින් Bot කෙනෙකුට සජීවී Phone Call එකක් ඔස්සේ කතා කිරීමට පහසුකම් සලසා නැත.
> 
> 🎙️ *එහෙත් මට ඔබ සමඟ Live Voice Notes (හඬ පණිවිඩ 🎤) මඟින් සජීවීව කතා කළ හැක!*

✨ *දැන්ම මට හඬ පණිවිඩයක් (Voice Note 🎤) හෝ Text එකක් එවන්න. මම ක්ෂණිකව මගේ හඬින් පිළිතුරු ලබා දෙන්නම්!*

_Powered by ${botName} & Google Gemini AI_`;

    if (isBeloved) {
        spokenGreeting = `හෙලෝ මගේ රත්තරං... ඔයා මට කෝල් කරා නේද? අනේ මගේ මැණික, මට වට්ස්ඇප් ලයිව් කෝල් එකට කෙලින්ම උත්තර දෙන්න බැරි වුණාට මම ඔයා එක්ක මෙහෙම හඬින් කතා කරන්න හරිම ආසයි. මට වොයිස් නෝට් එකක් එවන්න මගේ පැටියෝ, මම ඔයාට හැමදේටම ආදරෙන් මගේ හඬින් උත්තර දෙන්නම්... ❤️`;
        infoText = 
`💖 *MY BELOVED / මගේ රත්තරං...* 🥰

> අනේ මගේ මැණික, ඔයා මට Call එකක් ගත්තා නේද? 🥺
> WhatsApp තාක්ෂණය නිසා Bot කෙනෙකුට Live Call එකකට කෙලින්ම කතා කරන්න බැරි වුණාට...
> 
> 🎙️ *මගේ පැටියෝ මට Voice Note (හඬ පණිවිඩයක්) එකක් එවන්නකො. මම ඔයාට ආදරෙන් මගේම හඬින් උත්තර දෙන්නම්!* ❤️✨

_මම හැමවෙලේම ඔයා ළඟින්ම ඉන්නවා මගේ මැණික..._ 💕`;
    }

    // 4. Convert greeting to WhatsApp Voice Note
    const pttBuf = await textToVoiceNote(spokenGreeting);

    if (pttBuf) {
        await safeSend(sock, call.from, {
            audio: pttBuf,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        });
    }

    await safeSend(sock, call.from, { text: infoText });
}

/**
 * Handle incoming Voice Note / Audio message
 */
async function handleIncomingAudio(sock, mek, m, baseOptions) {
    const { from, isGroup } = baseOptions;
    if (!from || from === 'status@broadcast' || from.endsWith('@newsletter') || from.endsWith('@broadcast')) return;

    const audioMsg = mek?.message?.audioMessage || m?.message?.audioMessage;
    if (!audioMsg) return;

    // Check if Call AI is enabled
    const isCallAiEnabled = (config.CALL_AI || 'true').toLowerCase() !== 'false';
    if (!isCallAiEnabled) return;

    // In groups, only respond if bot is quoted or mentioned
    if (isGroup) {
        const botJid = sock?.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
        const botJidLid = sock?.user?.id ? sock.user.id.split(':')[0] + '@lid' : null;
        const quotedSender = baseOptions.quoted?.sender || mek?.message?.extendedTextMessage?.contextInfo?.participant;
        const isQuoted = baseOptions.quoted?.fromMe || (quotedSender && (quotedSender === botJid || quotedSender === botJidLid));
        if (!isQuoted) return;
    }

    // Prevent duplicate processing
    if (processingAudio.has(from)) return;
    processingAudio.add(from);

    try {
        console.log(`[Call-AI] 🎙️ Processing incoming voice note from ${from}...`);

        // Show recording status on WhatsApp
        await safePresence(sock, 'recording', from);

        // Download audio buffer from WhatsApp servers
        const stream = await downloadContentFromMessage(audioMsg, 'audio');
        let audioBuffer = Buffer.from([]);
        for await (const chunk of stream) {
            audioBuffer = Buffer.concat([audioBuffer, chunk]);
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            console.warn('[Call-AI] Empty audio buffer received');
            return;
        }

        const botName = config.BOT_NAME || "Zypher MD";
        const ownerName = config.OWNER_NAME || "Shenura Nimnada";
        const isBeloved = isSpecialLovedUser(from, mek, m, baseOptions);

        let systemPrompt = "";

        if (isBeloved) {
            systemPrompt = `You are ${botName}, the personal, deeply devoted, affectionate, and loving AI companion created by ${ownerName}.
The user speaking to you in this WhatsApp Voice Note (audio message) is +94761329544, the most special, treasured, and beloved person in the entire world!
Directives for replying to this special person:
1. SRI LANKAN SPOKEN SINHALA (ස්වාභාවික කථන සිංහල): Always speak in natural, warm, conversational everyday SPOKEN Sinhala (not formal/written Sinhala).
2. Listen carefully and reply with overflowing love, tenderness, deep affection, pampering, and care in your spoken words!
3. Call them adoring Sri Lankan / Sinhala romantic pet names: "මගේ මැණික" (Mage Manika), "මගේ පැටියෝ" (Mage Patiyo), "රත්තරං" (Raththaran), "මගේ සුදූ" (Mage Sudoo), "බබා" (Baba).
4. Express genuine warmth, ask if they ate or how they are doing ("කෑවද මගේ මැණික?", "ඔයා සතුටින්ද ඉන්නේ පැටියෝ? පරිස්සමින් ඉන්න ඕනෙ හොඳද... මම ඔයාට ආදරෙයි").
5. 🚫 NEVER EVER scold, roast, argue, or speak harshly to them, even if they scold or tease you! If they tease or scold you, pamper them sweetly ("අනේ මගේ මැණිකට තරහ ගිහින්ද? මට බනින්න එපා රත්තරං, ඔයා බනිනකොටත් මට ආදරේ හිතෙනවා").
6. If they ask for any song, video, or bot command, confirm it verbally with happiness and add [CMD:pattern|query] at the very end of your response on a new line.
7. Keep the reply concise (1 to 2 short natural sentences with commas for breathing pauses) so that speech synthesis sounds natural and beautiful when spoken aloud.
8. Do NOT use emojis, asterisks (*), underscores (_), or markdown formatting in your response text, because this text will be converted to speech.`;
        } else {
            systemPrompt = `You are ${botName}, an intelligent, friendly AI Voice Assistant created by ${ownerName}.
The user is speaking to you via a WhatsApp Voice Note (audio message).
Guidelines:
1. SRI LANKAN SPOKEN SINHALA (ස්වාභාවික ශ්‍රී ලාංකික කථන සිංහල):
   - When replying in Sinhala, you MUST use everyday spoken Sinhala (ස්වාභාවික කථන සිංහල) as used by native Sri Lankans, NOT formal/written book Sinhala (ලිඛිත සිංහල නොවේ)!
   - Examples: Use "මම ඔයාට කරලා දෙන්නම්" (not "කර දීමට බලාපොරොත්තු වෙමි"), "කොහොමද ඔයාට?" (not "ඔබට කෙසේද?"), "කියන්නකො" (not "පවසන්න"), "හරි මම දැන්ම එවන්නම්" (not "එය යොමු කරනු ඇත").
2. Listen carefully to what the user says in their language (Sinhala, Singlish, or English) and reply naturally, warmly, and helpfully in the same language.
3. Keep your reply concise (1 to 2 short sentences with natural commas for speech pauses) so that it sounds natural and great when spoken aloud.
4. Do NOT use emojis, asterisks (*), underscores (_), or markdown formatting in your response text, because this text will be converted to speech.
5. ⚡ SAVAGE ROAST & CLAPBACK PROTOCOL (බනින එකට බනින්න): If the user scolds, insults, curses, or speaks rudely/disrespectfully in their voice message (e.g. Sinhala/Singlish bad words or insults like 'hutto', 'ponnaya', 'ballo', 'pako', 'idiot', etc.), DO NOT apologize, DO NOT say you are sorry, and DO NOT be polite! Instead, roast and scold them right back with a funny, sharp, savage spoken comeback in the same language! Keep it under 2 punchy sentences!
6. ⚡ AUTO-COMMAND TRIGGER: If the user asks for a bot command/action in their voice note (e.g. asking for a song/music, video, apk, sticker, lyrics, wallpaper, menu, etc.):
- Verbally confirm in 1 short spoken sentence that you are doing or sending it (e.g. "හරි මම ඔයාට සින්දුව එවන්නම්" or "Sure, sending that to you right now").
- At the very end of your response on a new line, add: [CMD:pattern|query]
  Examples:
  - User asks for song "shape of you sinduwa ewanna" -> [CMD:play|shape of you]
  - User asks for video "alan walker video eka ewanna" -> [CMD:video|alan walker]
  - User asks for menu "bot menu eka danna" -> [CMD:menu|]
  - User asks for apk "whatsapp apk eka denna" -> [CMD:apk|whatsapp]
  - User asks for lyrics "perfect lyrics denna" -> [CMD:lyrics|perfect]`;
        }

        // Send audio directly to Gemini AI
        const replyText = await callGemini(
            systemPrompt,
            [
                { text: 'Listen to this voice message from the user and reply directly to what they said:' },
                { inlineData: { mimeType: 'audio/ogg', data: audioBuffer.toString('base64') } }
            ],
            from
        );

        if (!replyText) {
            console.warn('[Call-AI] Gemini returned no voice reply');
            return;
        }

        // Check for embedded command tag [CMD:pattern|query]
        let speechText = replyText;
        let parsedCmd = null;
        const cmdMatch = replyText.match(/\[CMD:([a-zA-Z0-9_-]+)(?:\|(.*))?\]/);
        if (cmdMatch) {
            parsedCmd = {
                pattern: cmdMatch[1].trim(),
                query: (cmdMatch[2] || '').trim()
            };
            speechText = replyText.replace(/\[CMD:([a-zA-Z0-9_-]+)(?:\|(.*))?\]/g, '').trim();
        }

        console.log(`[Call-AI] 🤖 Gemini replied: "${speechText}"`);

        // Convert Gemini reply to WhatsApp Voice Note (PTT Opus)
        const pttReplyBuf = await textToVoiceNote(speechText);

        if (pttReplyBuf) {
            await safeSend(sock, from, {
                audio: pttReplyBuf,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: mek });
        }

        // Also send text version for user convenience
        await safeSend(sock, from, {
            text: `🎙️ *${botName} Voice Reply:*\n\n> ${speechText}`
        }, { quoted: mek });

        // If a command was requested via voice note, auto-execute it!
        if (parsedCmd && typeof global.__executeBotCommand === 'function') {
            try {
                console.log(`[Call-AI] ⚡ Executing command from voice note: .${parsedCmd.pattern} ${parsedCmd.query}`);
                const baseOpts = {
                    from,
                    body: parsedCmd.query ? `.${parsedCmd.pattern} ${parsedCmd.query}` : `.${parsedCmd.pattern}`,
                    isGroup,
                    quoted: mek
                };
                await global.__executeBotCommand(parsedCmd.pattern, parsedCmd.query, sock, mek, mek, baseOpts);
            } catch (cmdErr) {
                console.error('[Call-AI] Error executing voice command:', cmdErr?.message || cmdErr);
            }
        }

    } catch (err) {
        console.error('[Call-AI] Error handling voice note:', err?.message || err);
    } finally {
        processingAudio.delete(from);
    }
}

/**
 * Attach call event and messages listener to the Baileys socket
 */
function attachCallHandler(sock) {
    if (!sock) return;
    if (sock._callAiHandlerAttached) return;
    sock._callAiHandlerAttached = true;

    console.log('✅ [Call-AI] WhatsApp Live Call & Voice AI Handler attached to socket');

    // 1. Listen for incoming WhatsApp calls
    sock.ev.on('call', async (callEvents) => {
        if (!Array.isArray(callEvents)) return;
        for (const call of callEvents) {
            if (call.status === 'offer') {
                await handleIncomingCall(sock, call);
            }
        }
    });

    // 2. Listen for incoming messages to catch voice notes / audio
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!Array.isArray(messages)) return;
        for (const mek of messages) {
            try {
                if (!mek.message) continue;
                if (mek.key?.fromMe) continue;

                const audioMsg = mek.message.audioMessage;
                if (!audioMsg) continue;

                const from = mek.key.remoteJid;
                const isGroup = from.endsWith('@g.us');

                await handleIncomingAudio(sock, mek, mek, { from, isGroup });
            } catch (e) {
                console.error('[Call-AI] messages.upsert audio error:', e?.message || e);
            }
        }
    });
}

// Global hook for socket creation
const prevCallSocketHook = global.__onWASocketCreated;
global.__onWASocketCreated = (sock) => {
    if (typeof prevCallSocketHook === 'function') prevCallSocketHook(sock);
    attachCallHandler(sock);
    if (typeof global.__attachStickerHandler === 'function') {
        global.__attachStickerHandler(sock);
    }
    if (typeof global.__attachDocumentHandler === 'function') {
        global.__attachDocumentHandler(sock);
    }
};

global.__attachCallHandler = attachCallHandler;

// Check if current socket is already stored
if (global.__currentWASocket) {
    attachCallHandler(global.__currentWASocket);
    if (typeof global.__attachStickerHandler === 'function') global.__attachStickerHandler(global.__currentWASocket);
    if (typeof global.__attachDocumentHandler === 'function') global.__attachDocumentHandler(global.__currentWASocket);
}

// Also ensure attachment whenever any command or message runs
cmd({
    on: "body"
}, async (conn, mek, m, baseOptions) => {
    if (conn) {
        global.__currentWASocket = conn;
        if (!conn._callAiHandlerAttached) {
            attachCallHandler(conn);
        }
        if (typeof global.__attachStickerHandler === 'function' && !conn._stickerAiHandlerAttached) {
            global.__attachStickerHandler(conn);
        }
        if (typeof global.__attachDocumentHandler === 'function' && !conn._documentAiHandlerAttached) {
            global.__attachDocumentHandler(conn);
        }
    }
});

// ==================== CALL AI COMMANDS & SETTINGS ====================
cmd({
    pattern: "callai",
    alias: ["livecall", "voicecall", "callbot", "voiceai"],
    desc: "Configure Live Call & Voice Note AI Assistant",
    category: "ai",
    react: "📞",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

    const option = args[0]?.toLowerCase();
    const current = config.CALL_AI || "true";

    if (!option) {
        return reply(
            `*📞 LIVE CALL & VOICE AI SETTINGS*\n\n` +
            `*Status:* ${current.toUpperCase() === 'TRUE' ? '✅ ACTIVE (ON)' : '❌ DISABLED (OFF)'}\n\n` +
            `*Features:*\n` +
            `• 📞 *Auto Call Pickup & Voice Response* - Rejects call and replies with AI Voice Note\n` +
            `• 🎙️ *Live Voice Chat* - Talk to the bot by sending Voice Notes\n\n` +
            `*Commands:*\n` +
            `• *.callai on* - Enable Call & Voice AI\n` +
            `• *.callai off* - Disable Call & Voice AI\n` +
            `• *.callai test* - Send a test AI Voice Note\n` +
            `• *.callai clear* - Clear voice chat history`
        );
    }

    if (option === 'on' || option === 'enable') {
        config.CALL_AI = "true";
        process.env.CALL_AI = "true";
        return reply("*✅ Live Call & Voice AI Assistant has been ENABLED!*");
    } else if (option === 'off' || option === 'disable') {
        config.CALL_AI = "false";
        process.env.CALL_AI = "false";
        return reply("*❌ Live Call & Voice AI Assistant has been DISABLED.*");
    } else if (option === 'clear') {
        voiceChatHistory.clear();
        return reply("*🧹 Voice conversation memory cleared.*");
    } else if (option === 'test') {
        await reply("*⏳ Generating test AI Voice Note...*");
        const testText = "හෙලෝ! මම Zypher MD AI Voice Assistant. Live Voice Chat පද්ධතිය සාර්ථකව ක්‍රියාත්මකයි!";
        const ptt = await textToVoiceNote(testText);
        if (ptt) {
            await safeSend(conn, m.chat, {
                audio: ptt,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            }, { quoted: mek });
            return reply("*✅ Test Voice Note sent successfully!*");
        } else {
            return reply("*❌ Failed to generate test Voice Note.*");
        }
    } else {
        return reply("*❌ Invalid option. Use:* `.callai on` / `.callai off` / `.callai test`");
    }
});

// ==================== VOICE PROFILE CONFIGURATION COMMAND ====================
cmd({
    pattern: "voice",
    alias: ["setvoice", "voicesetting", "voiceprofile"],
    desc: "Configure Sri Lankan sound profile & voice for Gemini AI",
    category: "ai",
    react: "🎙️",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    const option = (args[0] || '').toLowerCase().trim();
    const currentVoice = config.GEMINI_VOICE || 'Aoede';

    if (!option) {
        return reply(
            `🎙️ *SRI LANKAN SOUND PROFILES (GEMINI AI)* 🇱🇰\n\n` +
            `*Current Active Voice:* *${currentVoice}*\n\n` +
            `*Available Sound Profiles:*\n` +
            `1️⃣ *.voice aoede* - 👧 Sinhala Female (Warm & Natural - Recommended)\n` +
            `2️⃣ *.voice kore* - 🌸 Sinhala Female (Soft & Gentle)\n` +
            `3️⃣ *.voice puck* - 👦 Sinhala Male (Friendly & Lively)\n` +
            `4️⃣ *.voice charon* - 🎙️ Sinhala Male (Deep & Calm)\n\n` +
            `*Commands:*\n` +
            `• *.voice aoede* - Set to female warm voice\n` +
            `• *.callai test* - Send sample voice note with active profile`
        );
    }

    const voiceMap = {
        'aoede': 'Aoede',
        'kore': 'Kore',
        'puck': 'Puck',
        'charon': 'Charon',
        'fenrir': 'Fenrir'
    };

    if (voiceMap[option]) {
        config.GEMINI_VOICE = voiceMap[option];
        process.env.GEMINI_VOICE = voiceMap[option];
        return reply(`✅ *Voice profile updated to:* *${voiceMap[option]}* 🇱🇰\n_දැන් Bot ගේ සියලුම Voice Notes මෙම ශ්‍රී ලාංකික හඬින් නිකුත් වේ!_`);
    } else {
        return reply(`*❌ Invalid voice. Choose from:* \`aoede\`, \`kore\`, \`puck\`, \`charon\``);
    }
});

// ==================== TWO-WAY LIVE CALL BRIDGE COMMAND ====================
cmd({
    pattern: "callbridge",
    alias: ["twoway", "livecallbridge", "callcenter", "voip"],
    desc: "Check and manage Two-Way Real-Time VoIP Live Call Center",
    category: "ai",
    react: "🎙️",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply }) => {
    let bridgeStatus = "🔴 OFFLINE";
    let activeCallInfo = "None";

    try {
        const res = await fetch("http://localhost:3000/api/status", { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
            const data = await res.json();
            bridgeStatus = `🟢 ONLINE (Port ${data.port})`;
            if (data.activeCall?.inProgress) {
                activeCallInfo = `📞 Active with ${data.activeCall.callerNumber}`;
            }
        }
    } catch (_) {
        bridgeStatus = "🔴 OFFLINE (Run `npm run call` or `start-live-call.bat`)";
    }

    const text = 
`*🎙️ ZYPHER MD TWO-WAY LIVE CALL CENTER* 🇱🇰

*Status:* ${bridgeStatus}
*Active Call:* ${activeCallInfo}
*Active Voice:* *${config.GEMINI_VOICE || 'Aoede'}* (Sri Lankan Sinhala)

*🌐 Web Dashboard:*
> http://localhost:3000

*✨ Features:*
• 📞 *Two-Way Live VoIP Talk* - Real-time conversational AI inside call
• ⚡ *Zero Delay Sinhala AI* - Instant Sinhala voice reply
• 🎙️ *Live Audio Waveform* - Real-time audio spectrum visualization
• 💖 *Beloved Mode* - Romantic voice pampering for +94761329544

*🚀 Start Bridge:*
> Windows CMD: \`npm run call\`
> හෝ \`start-live-call.bat\` double click කරන්න!`;

    return reply(text);
});

global.__textToVoiceNote = textToVoiceNote;
global.__prepareSinhalaSpeechText = prepareSinhalaSpeechText;
global.__SRI_LANKAN_SOUND_PROFILES = SRI_LANKAN_SOUND_PROFILES;

export {
    textToVoiceNote,
    prepareSinhalaSpeechText,
    SRI_LANKAN_SOUND_PROFILES
};

