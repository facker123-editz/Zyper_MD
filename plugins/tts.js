// plugins/tts.js - ESM Version
import { fileURLToPath } from 'url';
import { cmd } from '../command.js';
import googleTTS from 'google-tts-api';

const __filename = fileURLToPath(import.meta.url);

cmd({
    pattern: "tts",
    alias: ["say", "speak"],
    desc: "Convert text to speech with Sri Lankan voice profile",
    category: "ai",
    react: "🎙️",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ *කරුණාකර හඬ බවට පත් කළ යුතු වාක්‍යය ලබා දෙන්න.*\n*උදාහරණ:* `.tts හෙලෝ කොහොමද ඔයාට?`");
        
        // 1. Try Sri Lankan Gemini TTS Profile
        if (typeof global.__textToVoiceNote === 'function') {
            const pttBuf = await global.__textToVoiceNote(q);
            if (pttBuf && pttBuf.length > 0) {
                return await conn.sendMessage(from, {
                    audio: pttBuf,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: mek });
            }
        }

        // 2. Fallback: Google Translate TTS in native Sinhala
        const isSinhala = /[\u0D80-\u0DFF]/.test(q);
        const lang = isSinhala ? 'si' : 'en';
        const url = googleTTS.getAudioUrl(q.slice(0, 200), {
            lang: lang,
            slow: false,
            host: 'https://translate.google.com',
        });
        
        await conn.sendMessage(from, { 
            audio: { url: url }, 
            mimetype: 'audio/mpeg', 
            ptt: true 
        }, { quoted: mek });
        
    } catch (a) {
        reply(`❌ Error: ${a.message || a}`);
    }
});
