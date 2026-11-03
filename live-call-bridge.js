// live-call-bridge.js - Two-Way Real-Time VoIP + AI Voice Call Bridge for ZYPHER MD
import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import googleTTS from 'google-tts-api';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws-call' });

const PORT = process.env.CALL_PORT || 3000;
const GEMINI_API_KEY = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Active Call State
let activeCall = {
    inProgress: false,
    callerNumber: null,
    callerName: null,
    startTime: null,
    history: []
};

let callStats = {
    totalCalls: 0,
    aiReplies: 0
};

// Connected WebSocket Clients (Web Dashboard / Audio Channels)
const connectedClients = new Set();

wss.on('connection', (ws) => {
    connectedClients.add(ws);
    console.log(`[VoIP-Bridge] 🟢 WebRTC Client connected. Total: ${connectedClients.size}`);

    // Send initial stats
    ws.send(JSON.stringify({
        type: 'CALL_STATS',
        callCount: callStats.totalCalls,
        aiReplies: callStats.aiReplies
    }));

    if (activeCall.inProgress) {
        ws.send(JSON.stringify({
            type: 'INCOMING_CALL',
            callerNumber: activeCall.callerNumber,
            callerName: activeCall.callerName
        }));
    }

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            await handleClientMessage(ws, msg);
        } catch (err) {
            console.error('[VoIP-Bridge] WS message parse error:', err?.message || err);
        }
    });

    ws.on('close', () => {
        connectedClients.delete(ws);
        console.log(`[VoIP-Bridge] 🔴 WebRTC Client disconnected. Remaining: ${connectedClients.size}`);
    });
});

/**
 * Broadcast message to all connected dashboard / WebRTC clients
 */
function broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const client of connectedClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

/**
 * Handle incoming messages from the WebRTC Dashboard / Audio Streamer
 */
async function handleClientMessage(ws, msg) {
    switch (msg.type) {
        case 'CALL_ANSWERED':
            activeCall.inProgress = true;
            activeCall.startTime = Date.now();
            console.log('[VoIP-Bridge] 📞 Call Answered! Two-Way Live Audio Active.');
            broadcast({ type: 'CALL_CONNECTED' });
            break;

        case 'CALL_HANGUP':
            console.log('[VoIP-Bridge] 📵 Call ended by client.');
            endActiveCall();
            break;

        case 'CALLER_SPEECH':
            await processCallerSpeech(msg);
            break;
    }
}

/**
 * End current active call
 */
function endActiveCall() {
    activeCall.inProgress = false;
    activeCall.callerNumber = null;
    activeCall.callerName = null;
    activeCall.startTime = null;
    activeCall.history = [];
    broadcast({ type: 'CALL_ENDED' });
}

/**
 * Convert Raw 16kHz 16-bit PCM Buffer into standard WAV Buffer
 */
function pcmToWav(pcmBuffer, sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmBuffer.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // Linear PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmBuffer.length, 40);

    return Buffer.concat([header, pcmBuffer]);
}

/**
 * Clean & prepare Sinhala text for speech synthesis
 */
function cleanSinhalaSpeechText(text) {
    if (!text) return '';
    return text
        .replace(/[*_~`#\[\]\(\)]/g, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]/gu, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\bAI\b/gi, 'ඒ අයි')
        .replace(/\bBot\b/gi, 'බොට්')
        .replace(/\bWhatsApp\b/gi, 'වට්ස්ඇප්')
        .replace(/\bCall\b/gi, 'කෝල්')
        .replace(/\bZypher\b/gi, 'සයිෆර්')
        .trim();
}

/**
 * Synthesize Sinhala Speech into MP3/Audio Base64
 */
async function generateSinhalaAudio(text, voiceProfile = 'Aoede') {
    const cleanText = cleanSinhalaSpeechText(text);
    if (!cleanText) return null;

    try {
        // Fallback or Primary: Google TTS API with native Sinhala support ('si')
        const ttsUrl = googleTTS.getAudioUrl(cleanText.slice(0, 200), {
            lang: 'si',
            slow: false,
            host: 'https://translate.google.com'
        });

        const res = await fetch(ttsUrl, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return {
                audioBase64: base64,
                mimeType: 'audio/mpeg'
            };
        }
    } catch (err) {
        console.error('[VoIP-Bridge] TTS error:', err?.message || err);
    }
    return null;
}

/**
 * Check if the caller is the special loved person (+94761329544 / Divya)
 */
function isSpecialLovedNumber(number) {
    if (!number) return false;
    const clean = String(number).replace(/[^0-9]/g, '');
    return clean.includes('94761329544') || clean.endsWith('761329544') || clean.includes('251358833864754');
}

/**
 * Process Caller's Live Speech Buffer through Gemini AI
 */
async function processCallerSpeech(msg) {
    const { audio: base64Audio, sampleRate = 16000, voice = 'Aoede' } = msg;
    if (!base64Audio) return;

    broadcast({ type: 'AI_THINKING' });

    try {
        const rawPcm = Buffer.from(base64Audio, 'base64');
        const wavBuffer = pcmToWav(rawPcm, sampleRate);
        const wavBase64 = wavBuffer.toString('base64');

        const isBeloved = isSpecialLovedNumber(activeCall.callerNumber);
        const botName = config.BOT_NAME || "Zypher MD";
        const ownerName = config.OWNER_NAME || "Shenura Nimnada";

        let systemInstruction = "";

        if (isBeloved) {
            systemInstruction = `You are ${botName}, the deeply affectionate, loving, devoted personal voice companion created by ${ownerName}.
You are in a live phone call conversation with the most special, treasured, and beloved person in the entire world (+94761329544)!
Directives:
1. Speak in natural, warm, conversational everyday SPOKEN Sinhala (ස්වාභාවික කථන සිංහල), never formal book Sinhala!
2. Call them sweet romantic pet names: "මගේ මැණික", "මගේ පැටියෝ", "රත්තරං", "මගේ සුදූ", "බබා".
3. Reply with deep care, pampering, and affection in 1 to 2 short natural spoken sentences.
4. No markdown, no asterisks, no emojis. Plain words to be spoken aloud.`;
        } else {
            systemInstruction = `You are ${botName}, a smart, friendly, natural Sri Lankan AI Voice Call companion created by ${ownerName}.
You are in an active live WhatsApp phone call conversation with the caller.
Directives:
1. SRI LANKAN SPOKEN SINHALA (ස්වාභාවික ශ්‍රී ලාංකික කථන සිංහල): Speak in natural, everyday spoken Sinhala as people speak in real calls (e.g. "මම ඔයාට කරලා දෙන්නම්", "කොහොමද ඔයාට?", "කියන්නකො"). NEVER use formal written/book Sinhala!
2. Listen to what the caller says (in Sinhala, Singlish, or English) and reply naturally, warmly, and helpfully.
3. Keep your reply VERY CONCISE (1 to 2 short sentences with natural commas for speech pauses) suitable for a live phone call!
4. No markdown, no asterisks (*), no emojis, no bullet points. Only plain words that sound good when spoken aloud!`;
        }

        const payload = {
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [
                ...activeCall.history,
                {
                    role: 'user',
                    parts: [
                        { text: 'Listen to the caller speaking in this audio clip and reply directly in spoken Sinhala:' },
                        { inlineData: { mimeType: 'audio/wav', data: wavBase64 } }
                    ]
                }
            ]
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            const errBody = await res.text();
            console.error('[VoIP-Bridge] Gemini API error:', res.status, errBody);
            return;
        }

        const data = await res.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (replyText) {
            console.log(`[VoIP-Bridge] 🤖 AI Spoken Reply: "${replyText}"`);

            // Save conversation history (last 4 turns)
            activeCall.history.push({ role: 'user', parts: [{ text: '[Caller Voice]' }] });
            activeCall.history.push({ role: 'model', parts: [{ text: replyText }] });
            if (activeCall.history.length > 6) activeCall.history = activeCall.history.slice(-6);

            callStats.aiReplies++;

            // Broadcast transcript to UI
            broadcast({
                type: 'TRANSCRIPT',
                role: 'ai',
                text: replyText
            });

            // Convert to Sinhala speech audio
            const ttsResult = await generateSinhalaAudio(replyText, voice);
            if (ttsResult) {
                // Stream synthesized audio back to caller
                broadcast({
                    type: 'AI_AUDIO_CHUNK',
                    audioBase64: ttsResult.audioBase64,
                    mimeType: ttsResult.mimeType
                });
            }
        }
    } catch (err) {
        console.error('[VoIP-Bridge] Speech processing error:', err?.message || err);
    }
}

/**
 * External function to notify the bridge of an incoming WhatsApp call
 */
export function notifyIncomingCall(callerNumber, callerName = 'WhatsApp User') {
    callStats.totalCalls++;
    activeCall.inProgress = true;
    activeCall.callerNumber = callerNumber;
    activeCall.callerName = callerName;

    console.log(`[VoIP-Bridge] 🔔 Incoming WhatsApp call from ${callerNumber} (${callerName})`);

    broadcast({
        type: 'INCOMING_CALL',
        callerNumber,
        callerName
    });
}

/**
 * External function to notify call ended
 */
export function notifyCallEnded(callerNumber) {
    console.log(`[VoIP-Bridge] 📴 Call ended from ${callerNumber}`);
    endActiveCall();
}

// REST Endpoints
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        bridgeOnline: true,
        port: PORT,
        activeCall,
        stats: callStats,
        connectedClients: connectedClients.size
    });
});

app.post('/api/simulate-call', (req, res) => {
    const { number = '+94788108090', name = 'Test Caller' } = req.body;
    notifyIncomingCall(number, name);
    res.json({ success: true, message: `Simulated call triggered from ${number}` });
});

app.post('/api/test-voice', async (req, res) => {
    const { text = 'හෙලෝ! මම සයිෆර් එම්ඩී.', voice = 'Aoede' } = req.body;
    const result = await generateSinhalaAudio(text, voice);
    if (result) {
        res.json({ success: true, ...result });
    } else {
        res.status(500).json({ success: false, error: 'Voice generation failed' });
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 ZYPHER MD TWO-WAY REAL-TIME VOIP CALL BRIDGE ONLINE!`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🎙️ WebSocket: ws://localhost:${PORT}/ws-call`);
    console.log(`========================================================\n`);
});

export default {
    notifyIncomingCall,
    notifyCallEnded,
    server
};

