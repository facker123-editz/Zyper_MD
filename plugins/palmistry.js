// plugins/palmistry.js - Authentic Sri Lankan & Vedic Palmistry AI
import { fileURLToPath } from 'url';
import path from 'path';
import { cmd, commands } from '../command.js';
import config from '../config.js';
import { downloadMediaMessage } from '../lib/handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Active processing lock per chat to prevent parallel duplicate calls
const activePalmChats = new Set();
// Processed message IDs to avoid double-processing
const processedMsgIds = new Set();

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
 * Safely send a message with automatic reconnection retry
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
            const isConnClosed = errMsg.includes('Connection Closed') || errMsg.includes('precondition') || statusCode === 428;

            if (isConnClosed && attempt < maxRetries) {
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
            console.error(`[Palmistry] Message send error on attempt ${attempt}:`, errMsg);
            return null;
        }
    }
    return null;
}

/**
 * Robustly extract image buffer from quoted or direct message
 */
async function extractImageMedia(conn, mek, m) {
    try {
        // 1. Quoted message
        const quoted = mek?.quoted || m?.quoted;
        if (quoted) {
            const mime = quoted.mimetype || quoted.msg?.mimetype || '';
            if (quoted.mtype === 'imageMessage' || /image/.test(mime)) {
                if (typeof quoted.download === 'function') {
                    const buf = await quoted.download();
                    if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                        return { buffer: buf, mimeType: mime || 'image/jpeg' };
                    }
                }
                const buf = await downloadMediaMessage(quoted);
                if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                    return { buffer: buf, mimeType: mime || 'image/jpeg' };
                }
            }
        }

        // 2. Direct message in m
        if (m) {
            const mime = m.mimetype || m.msg?.mimetype || '';
            if (m.mtype === 'imageMessage' || /image/.test(mime)) {
                if (typeof m.download === 'function') {
                    const buf = await m.download();
                    if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                        return { buffer: buf, mimeType: mime || 'image/jpeg' };
                    }
                }
                const buf = await downloadMediaMessage(m);
                if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                    return { buffer: buf, mimeType: mime || 'image/jpeg' };
                }
            }
        }

        // 3. Direct message in mek
        if (mek?.message?.imageMessage) {
            const mime = mek.message.imageMessage.mimetype || 'image/jpeg';
            if (typeof mek.download === 'function') {
                const buf = await mek.download();
                if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                    return { buffer: buf, mimeType: mime };
                }
            }
            const buf = await downloadMediaMessage(mek);
            if (buf && Buffer.isBuffer(buf) && buf.length > 0) {
                return { buffer: buf, mimeType: mime };
            }
        }
    } catch (err) {
        console.error('[Palmistry] Error extracting media:', err?.message || err);
    }
    return null;
}

/**
 * Conduct authentic Sri Lankan & Vedic Palmistry Analysis with Google Gemini Vision
 */
async function analyzePalmistryWithAI(imageBuffer, mimeType = 'image/jpeg', userPrompt = '') {
    const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    if (!apiKey) return { success: false, error: 'GEMINI_API_KEY is not configured.' };

    const base64Data = imageBuffer.toString('base64');
    const cleanMime = mimeType.split(';')[0].trim() || 'image/jpeg';
    const botName = config.BOT_NAME || "Zypher MD";

    const systemInstruction = `You are an acclaimed Master Astrologer and Sri Lankan & Vedic Palmistry Expert (ප්‍රවීණ හස්ත රේඛා ශාස්ත්‍රඥ / සාමුද්‍රිකා ශාස්ත්‍රඥ).
Your mission is to examine the provided photograph of a human palm/hand and perform an authentic, serious, comprehensive, and accurate Hastha Rekha Shasthra (හස්ත රේඛා ශාස්ත්‍රය / Samudrika Shastra) future prediction in Sinhala.

CRITICAL FIRST STEP:
1. Examine the image carefully. Does this photograph clearly depict a human palm with hand lines suitable for palmistry?
2. If the image is NOT a human palm/hand (e.g. face, selfie, dog, cat, car, document, food, meme, landscape, receipt, clothing, random object), you MUST respond with ONLY:
NOT_PALM
Do not explain, do not apologize, just output: NOT_PALM

3. If it IS a human palm with visible lines:
Conduct an authentic, deeply accurate, respectful, and complete Sri Lankan & Vedic Palmistry reading and future prediction in Sinhala.

Follow this exact authentic structure:

🔮 *— හස්ත රේඛා ශාස්ත්‍රය සහ අනාගත අනාවැකි —* ✋
_සමුද්‍රිකා ශාස්ත්‍රය සහ පාරම්පරික ජ්‍යොතිෂ විද්‍යාව ඇසුරෙන්_

━━━━━━━━━━━━━━━━━━━━━
📌 *1. අත්ල වර්ගීකරණය සහ මූලික ලක්ෂණ:*
• *පරීක්ෂා කළ අත:* [දකුණු අත (ක්‍රියාකාරී දෛවය සහ වර්තමාන/අනාගත කර්මය) හෝ වම් අත (උපන් වාසනාව සහ සහජ ශක්තීන්) යන්න හඳුනාගෙන සඳහන් කරන්න]
• *අත්ලේ මූලධර්මය (Element):* [පඨවි (Earth) / වායෝ (Air) / ආපෝ (Water) / තේජෝ (Fire) හස්තය සහ අත්ලේ හැඩය]
• *පෞරුෂ ලක්ෂණ:* [අත්ලේ හැඩය, ඇඟිලි පිහිටීම සහ සමේ ස්වභාවය අනුව මූලික ගතිගුණ]

━━━━━━━━━━━━━━━━━━━━━
🌿 *2. ප්‍රධාන රේඛා පරීක්ෂාව සහ ශක්තිය:*
• 🧬 *ජීවන රේඛාව (Life Line):* [ආයුෂ, කායික නිරෝගීබව, ශක්තිය, සහ ජීවිතයේ ප්‍රධාන සෞඛ්‍ය පෙරළි]
• 🧠 *ශීර්ෂ රේඛාව / මාතෘ රේඛාව (Head Line):* [බුද්ධි මට්ටම, මතක ශක්තිය, තීරණ ගැනීමේ හැකියාව, තාර්කික හෝ නිර්මාණශීලී චින්තනය, අධ්‍යාපනය]
• ❤️ *හෘදය රේඛාව (Heart Line):* [චිත්තවේග, අවංකභාවය, ආදරය, විවාහය සහ පවුල් සබඳතා කෙරෙහි දක්වන බැඳීම]
• 🔱 *භාග්‍ය රේඛාව / දෛව රේඛාව (Fate Line):* [වෘත්තීය සාර්ථකත්වය, රැකියා වෙනස්වීම්, ධන වාසනාව, ආර්ථික ස්ථාවරත්වය ලබන වයස]
• ☀️ *සූර්ය රේඛාව / කීර්ති රේඛාව (Sun Line):* [සමාජ පිළිගැනීම, කීර්තිය, ප්‍රසිද්ධිය, උසස් සමාජ ගෞරවය]
• 💍 *විවාහ රේඛාව (Marriage Line):* [විවාහය සිදුවන දළ වයස් සීමාව සහ යුග දිවියේ සාර්ථකත්වය]

━━━━━━━━━━━━━━━━━━━━━
🪐 *3. ග්‍රහ මණ්ඩල පරීක්ෂාව (Planetary Mounts):*
• *ගුරු මණ්ඩලය (Jupiter):* [නායකත්වය සහ ආත්ම විශ්වාසය]
• *ශනි මණ්ඩලය (Saturn):* [කර්මය, විනය, ඉවසීම සහ බාධක ජයගැනීම]
• *රවි මණ්ඩලය (Sun):* [වාසනාව සහ කීර්තිය]
• *බුධ මණ්ඩලය (Mercury):* [ව්‍යාපාරික ඥානය සහ සන්නිවේදනය]
• *ශුක්‍ර මණ්ඩලය (Venus):* [ආදරය, සුඛෝපභෝගී ජීවිතය, ප්‍රේමය සහ ආකර්ෂණය]
• *චන්ද්‍ර මණ්ඩලය (Moon):* [කල්පනා ශක්තිය, නිර්මාණශීලිත්වය, සංචාර සහ විදේශ ගමන් වාසනාව]
• *කුජ මණ්ඩල (Mars):* [ධෛර්යය සහ නොපසුබට උත්සාහය]

━━━━━━━━━━━━━━━━━━━━━
✨ *4. විශේෂ ශුභ / අශුභ සලකුණු (Special Marks):*
[අත්ලේ දිස්වන ත්‍රිකෝණ (Triangles - ධන වාසනාව), මත්ස්‍ය ලක්ෂණය (Fish Sign - මහා ධන යෝග), යව සලකුණ / බුද්ධ අක්ෂිය (Buddha's eye on thumb - සහජ ඥානය හා ආරක්ෂාව), රහස්‍ය කුරුසය (Mystic Cross), මණිබන්ධන රේඛා ආදිය විස්තර කරන්න]

━━━━━━━━━━━━━━━━━━━━━
🌟 *5. අනාගත අනාවැකි සහ ප්‍රධාන කාල පරිච්ඡේද (Future Predictions):*
• 🌱 *තරුණ අවධිය (වයස 20 - 30):* [අධ්‍යාපනය, මුල් කාලීන අභියෝග හා රැකියා ආරම්භය]
• 👑 *මැදි විය (වයස 31 - 45 - ස්වර්ණමය යුගය):* [ජීවිතයේ ස්ථාවර වීම, ව්‍යාපාර හෝ රැකියා උසස්වීම්, දේපළ හා යාන වාහන හිමිකම්]
• 🍂 *පරිණත අවධිය (වයස 46+):* [ආර්ථික නිදහස, සමාජ ගෞරවය සහ සැනසිලිදායක විශ්‍රාමික දිවිය]
• 💰 *ධන වාසනාව සහ ආර්ථිකය:* [ධනය ඉපයීමේ ප්‍රධාන මාවත්, ධන යෝග උදාවන කාල]
• 💍 *ආදරය සහ විවාහ දිවිය:* [සාර්ථක යුග දිවියක් ගතකිරීම සහ සහකරුගෙන් ලැබෙන දායකත්වය]
• ✈️ *විදේශ ගමන් හෝ පදිංචිය:* [විදේශගත වීමේ ඉඩකඩ සහ ප්‍රතිඵල]

━━━━━━━━━━━━━━━━━━━━━
💎 *6. ජ්‍යොතිෂමය උපදෙස් සහ අපල දුරුකිරීමේ ප්‍රතිකර්ම:*
• 🟢 *ජයග්‍රාහී වර්ණ:* [සුදුසු වර්ණ]
• 🔢 *වාසනාවන්ත අංක:* [Lucky numbers]
• 🧭 *ශුභ දිශාව:* [Auspicious direction]
• 🪷 *ධන වාසනාව හා සෙත සලසා ගැනීමට:* [කළ යුතු පින්කම් / බෝධි පූජා / ආධ්‍යාත්මික වත්පිළිවෙත්]

> *🔮 ${botName} Authentic Palmistry AI*

Rules for text:
- Deliver the entire reading in beautiful, authentic, traditional Sinhala.
- If the user asked a specific question in their message (e.g. "mata job ekak lebeida", "foreign travel thiyeda", "marriage eka kohomada"), answer that specific aspect with extra depth.
- Do NOT sound like a robotic AI; sound like an experienced, wise, respectful, and compassionate Sri Lankan astrologer/palmist.`;

    const userText = userPrompt && userPrompt.trim()
        ? `මගේ අත්ලේ ඡායාරූපය පරීක්ෂා කර සම්පූර්ණ හස්ත රේඛා ශාස්ත්‍රය අනුව අනාගතය පවසන්න. මගේ විශේෂ ප්‍රශ්නය/සටහන: ${userPrompt}`
        : `මගේ අත්ලේ ඡායාරූපය පරීක්ෂා කර සම්පූර්ණ හස්ත රේඛා ශාස්ත්‍රය අනුව අනාගත අනාවැකි පවසන්න.`;

    const payload = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{
            role: 'user',
            parts: [
                { inline_data: { mime_type: cleanMime, data: base64Data } },
                { text: userText }
            ]
        }]
    };

    const models = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3.8-flash'
    ];

    for (const model of models) {
        try {
            console.log(`[Palmistry] Analyzing palm using ${model}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(35000)
            });

            if (res.status === 200) {
                const data = await res.json();
                const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (replyText) {
                    if (replyText.startsWith('NOT_PALM') || replyText === 'NOT_PALM') {
                        return { success: false, notPalm: true };
                    }
                    return { success: true, reading: replyText, model };
                }
            } else {
                console.warn(`[Palmistry] ${model} returned status ${res.status}`);
            }
        } catch (err) {
            console.warn(`[Palmistry] Error with ${model}:`, err?.message || err);
        }
    }

    return { success: false, error: 'Could not connect to Astrological AI service. Please try again.' };
}

// ==================== PALMISTRY COMMAND ====================
cmd({
    pattern: "reka",
    alias: ["palm", "hastha", "athereka", "palmistry", "shasthra", "handreading", "athla", "rekha", "shasthraya"],
    desc: "Read palm lines and accurately predict future using authentic Palmistry (හස්ත රේඛා ශාස්ත්‍රය)",
    category: "ai",
    react: "🔮",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, args, q, reply, isGroup, sender }) => {
    const msgId = mek?.key?.id || m?.id;
    if (msgId) processedMsgIds.add(msgId);

    try {
        const media = await extractImageMedia(conn, mek, m);

        if (!media) {
            const botName = config.BOT_NAME || "Zypher MD";
            return reply(
                `🔮 *හස්ත රේඛා ශාස්ත්‍රය (Palmistry & Future Prediction)* ✋\n\n` +
                `ඔබගේ අත්ලෙහි රේඛා පැහැදිලිව පෙනෙන පරිදි ලබාගත් ඡායාරූපයකට (Palm Photo) reply කරමින් *.reka* යොදා එවන්න (හෝ ඡායාරූපය යොමු කරන විට Caption එක ලෙස *.reka* යොදා එවන්න).\n\n` +
                `📌 *නිවැරදි ප්‍රතිඵල ලබාගැනීමට උපදෙස්:*\n` +
                `• අත්ල හොඳින් ආලෝකමත් ස්ථානයක තබා ඡායාරූපය ගන්න.\n` +
                `• ප්‍රධාන රේඛා (ජීවන, ශීර්ෂ, හෘදය, භාග්‍ය) පැහැදිලිව පෙනෙන බව තහවුරු කරගන්න.\n` +
                `• දකුණු අත හෝ වම් අත දෙකම පරීක්ෂා කළ හැක.\n\n` +
                `> 🔮 _${botName} Authentic Palmistry AI_`
            );
        }

        if (activePalmChats.has(from)) {
            return reply("⏳ *කරුණාකර මොහොතක් රැඳී සිටින්න, ඔබගේ අත්ලේ රේඛා මේ වන විටත් පරීක්ෂා කරමින් පවතී...*");
        }
        activePalmChats.add(from);

        await safeSendReaction(conn, from, '🔮', mek.key);
        await safeSendPresence(conn, 'composing', from);

        const result = await analyzePalmistryWithAI(media.buffer, media.mimeType, q || '');

        if (!result.success) {
            if (result.notPalm) {
                await safeSendReaction(conn, from, '❌', mek.key);
                return reply(
                    `❌ *හස්ත රේඛා හඳුනාගත නොහැකි විය!*\n\n` +
                    `ඔබ එවන ලද ඡායාරූපයෙහි මිනිස් අත්ලක් හෝ අතේ රේඛා පැහැදිලිව හඳුනාගත නොහැක.\n` +
                    `කරුණාකර ඔබගේ අත්ල සහ රේඛා (Life line, Head line, Heart line) හොඳින් පෙනෙන පරිදි ලබාගත් පැහැදිලි ඡායාරූපයක් (Clear Palm photo) යොමු කරන්න.`
                );
            }
            await safeSendReaction(conn, from, '❌', mek.key);
            return reply(`❌ *හස්ත රේඛා පරීක්ෂා කිරීමේදී දෝෂයක් සිදුවිය:* ${result.error || 'නැවත උත්සාහ කරන්න.'}`);
        }

        await safeSendMessage(conn, from, { text: result.reading }, { quoted: mek });
        await safeSendReaction(conn, from, '✨', mek.key);

    } catch (err) {
        console.error('[Palmistry] Command error:', err);
        await safeSendReaction(conn, from, '❌', mek.key);
        reply("❌ *දෝෂයක් සිදුවිය. කරුණාකර නැවත උත්සාහ කරන්න.*");
    } finally {
        activePalmChats.delete(from);
    }
});

// ==================== AUTO PALM IMAGE LISTENER ====================
// Automatically detects when a user sends a palm image in DM or with palmistry keywords
cmd({
    on: "body"
}, async (conn, mek, m, baseOptions) => {
    const { from, body, isCmd, isGroup } = baseOptions || {};

    try {
        if (!from || from === 'status@broadcast' || from.endsWith('@newsletter') || from.endsWith('@broadcast')) return;

        const msgId = mek?.key?.id || m?.id;
        if (msgId && processedMsgIds.has(msgId)) return;

        // Skip explicit bot commands with prefix
        const prefix = config.PREFIX || '.';
        const text = typeof body === 'string' ? body.trim() : '';
        if (isCmd || text.startsWith(prefix)) return;

        const hasImage = !!(
            mek?.message?.imageMessage ||
            m?.mtype === 'imageMessage' ||
            mek?.quoted?.mtype === 'imageMessage' ||
            m?.quoted?.mtype === 'imageMessage'
        );

        if (!hasImage) return;

        // Palmistry keywords detection
        const palmRegex = /(?:reka|rekha|hastha|shasthra|athe\s*reka|athla|palm|palmistry|hand\s*reading|රේඛා|හස්ත|ශාස්ත්‍ර|අත්ල|අනාගතේ|අතේ\s*රේඛා)/i;
        const matchesPalmKeyword = palmRegex.test(text);

        // Decide whether to auto-check:
        // 1. Explicitly matched palmistry keyword in caption or message
        // 2. Or received in private 1-on-1 chat (Inbox/DM)
        let shouldCheck = false;
        if (matchesPalmKeyword) {
            shouldCheck = true;
        } else if (!isGroup && (mek?.message?.imageMessage || m?.mtype === 'imageMessage')) {
            // Direct image in inbox - check if it's a palm photo
            shouldCheck = true;
        }

        if (!shouldCheck) return;

        if (activePalmChats.has(from)) return;

        const media = await extractImageMedia(conn, mek, m);
        if (!media) return;

        activePalmChats.add(from);
        if (msgId) processedMsgIds.add(msgId);

        // If user explicitly asked with keywords, send visual reaction right away
        if (matchesPalmKeyword) {
            await safeSendReaction(conn, from, '🔮', mek.key);
            await safeSendPresence(conn, 'composing', from);
        }

        const result = await analyzePalmistryWithAI(media.buffer, media.mimeType, text);

        if (!result.success) {
            // If it was NOT a palm:
            // Only alert the user if they explicitly requested palm reading!
            // If they just sent a random photo (selfie/meme) in inbox, quietly ignore.
            if (result.notPalm && matchesPalmKeyword) {
                await safeSendReaction(conn, from, '❌', mek.key);
                await safeSendMessage(conn, from, {
                    text: `❌ *හස්ත රේඛා හඳුනාගත නොහැකි විය!*\n\nඔබ එවන ලද ඡායාරූපයෙහි මිනිස් අත්ලක් හෝ අතේ රේඛා පැහැදිලිව හඳුනාගත නොහැක. කරුණාකර ඔබගේ අත්ල සහ රේඛා හොඳින් පෙනෙන පරිදි ලබාගත් පැහැදිලි ඡායාරූපයක් (Clear Palm photo) යොමු කරන්න.`
                }, { quoted: mek });
            }
            return;
        }

        // It IS a verified palm image!
        await safeSendReaction(conn, from, '🔮', mek.key);
        await safeSendPresence(conn, 'composing', from);

        await safeSendMessage(conn, from, { text: result.reading }, { quoted: mek });
        await safeSendReaction(conn, from, '✨', mek.key);

    } catch (err) {
        console.error('[Palmistry] Auto-listener error:', err?.message || err);
    } finally {
        activePalmChats.delete(from);
    }
});

export { analyzePalmistryWithAI, extractImageMedia };

