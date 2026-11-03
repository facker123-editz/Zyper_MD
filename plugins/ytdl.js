//---------------------------------------------------------------------------
//           ZYPHER MD - YOUTUBE MUSIC & VIDEO DOWNLOADER
//---------------------------------------------------------------------------
//  🎧 ULTRA-FAST MULTI-SOURCE DOWNLOAD ENGINE WITH CONCURRENT RACING
//  🎬 SUPPORTS AUDIO (MP3) & VIDEO (MP4) DOWNLOADS INSTANTLY
//---------------------------------------------------------------------------

import { fileURLToPath } from 'url';
import { cmd } from '../command.js';
import config from '../config.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import yts from 'yt-search';

const __filename = fileURLToPath(import.meta.url);

// ══════════════════════════════════════════════
// ⚡ IN-MEMORY CACHE FOR HIGH PERFORMANCE
// ══════════════════════════════════════════════

const mediaCache = new Map();

function getCachedMedia(url, type) {
    const key = `${type}_${url}`;
    const item = mediaCache.get(key);
    if (item && (Date.now() - item.time < 3600000)) { // 1 hour TTL
        return item.data;
    }
    mediaCache.delete(key);
    return null;
}

function setCachedMedia(url, type, data) {
    const key = `${type}_${url}`;
    if (mediaCache.size > 200) {
        const firstKey = mediaCache.keys().next().value;
        mediaCache.delete(firstKey);
    }
    mediaCache.set(key, { data, time: Date.now() });
}

// ══════════════════════════════════════════════
// 🎨 STYLISH TEXT HELPERS
// ══════════════════════════════════════════════

const toSmallCaps = (text) => {
    const map = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ',
        'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ',
        'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.split('').map(c => map[c.toLowerCase()] || c).join('');
};

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatViews = (views) => {
    if (!views) return 'N/A';
    if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toLocaleString();
};

// ══════════════════════════════════════════════
// 🔗 YOUTUBE URL HELPERS
// ══════════════════════════════════════════════

function getVideoId(url) {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

function isYouTubeUrl(text) {
    return text && (text.includes('youtube.com') || text.includes('youtu.be'));
}

// ══════════════════════════════════════════════
// 🔐 SAVETUBE VIP ENGINE (AES-128-CBC)
// ══════════════════════════════════════════════

const SAVETUBE_KEY = 'C5D58EF67A7584E4A29F6C35BBC4EB12';

function decodeSaveTube(enc) {
    try {
        const data = Buffer.from(enc, 'base64');
        const iv = data.slice(0, 16);
        const content = data.slice(16);
        const key = Buffer.from(SAVETUBE_KEY, 'hex');
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch {
        return null;
    }
}

async function fetchSaveTubeAudio(videoUrl) {
    const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', { timeout: 4000 });
    const cdn = cdnRes.data?.cdn;
    if (!cdn) throw new Error('No SaveTube CDN');

    const infoRes = await axios.post(`https://${cdn}/v2/info`, { url: videoUrl }, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://save-tube.com/'
        },
        timeout: 5000
    });

    const info = decodeSaveTube(infoRes.data?.data);
    if (!info?.key) throw new Error('No SaveTube key');

    const dlRes = await axios.post(`https://${cdn}/download`, {
        downloadType: 'audio',
        quality: '128',
        key: info.key
    }, {
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://save-tube.com/'
        },
        timeout: 6000
    });

    const dlUrl = dlRes.data?.data?.downloadUrl;
    if (dlUrl) {
        return { type: 'url', url: dlUrl, source: 'SaveTube' };
    }
    throw new Error('SaveTube no downloadUrl');
}

// ══════════════════════════════════════════════
// 🎵 ULTRA-FAST AUDIO DOWNLOAD ENGINE (RACE)
// ══════════════════════════════════════════════

// Provider 1: Nexray Fast MP3 API (~1.3s)
async function fetchNexrayAudio(videoUrl) {
    const res = await axios.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl = res.data?.status && res.data?.result?.url ? res.data.result.url : null;
    if (dlUrl) {
        return { type: 'url', url: dlUrl, source: 'Nexray' };
    }
    throw new Error('Nexray failed');
}

// Provider 2: Tioo Backend API (~2.0s)
async function fetchTiooAudio(videoUrl) {
    const res = await axios.get(`https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(videoUrl)}`, {
        headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
        timeout: 6000
    });
    if (res.data?.status && res.data?.mp3) {
        return { type: 'url', url: res.data.mp3, source: 'Tioo' };
    }
    throw new Error('Tioo failed');
}

// Provider 3: @distube/ytdl-core fallback
async function fetchYtdlCoreAudio(videoUrl) {
    const { Ytdl } = await import('@distube/ytdl-core');
    const yt = new Ytdl({ clients: ['web_embedded', 'tv', 'mweb'] });
    const tempFile = path.join(os.tmpdir(), `zy_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);
    const stream = await yt.download(videoUrl, {
        filter: { hasAudio: true, hasVideo: false },
        quality: 'highestaudio'
    });

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tempFile);
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        stream.on('error', reject);
        setTimeout(() => reject(new Error('Download timeout')), 15000);
    });

    if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 1000) {
        return { type: 'file', filePath: tempFile, source: 'ytdl-core' };
    }
    throw new Error('ytdl-core file empty');
}

async function fetchAudioSource(videoUrl) {
    // 1. Check in-memory cache
    const cached = getCachedMedia(videoUrl, 'audio');
    if (cached) return cached;

    // 2. Fast Parallel Race: Nexray & Tioo concurrently (first to resolve wins)
    try {
        const result = await Promise.any([
            fetchNexrayAudio(videoUrl),
            fetchTiooAudio(videoUrl)
        ]);
        setCachedMedia(videoUrl, 'audio', result);
        return result;
    } catch { /* proceed to fallbacks */ }

    // 3. Fallback: SaveTube VIP Engine
    try {
        const result = await fetchSaveTubeAudio(videoUrl);
        setCachedMedia(videoUrl, 'audio', result);
        return result;
    } catch { /* proceed to fallbacks */ }

    // 4. Fallback: ytdl-core local extraction
    try {
        const result = await fetchYtdlCoreAudio(videoUrl);
        return result;
    } catch { /* all providers exhausted */ }

    return null;
}

// ══════════════════════════════════════════════
// 🎬 ULTRA-FAST VIDEO DOWNLOAD ENGINE (RACE)
// ══════════════════════════════════════════════

// Provider 1: Tioo Backend Video
async function fetchTiooVideo(videoUrl) {
    const res = await axios.get(`https://backend1.tioo.eu.org/youtube?url=${encodeURIComponent(videoUrl)}`, {
        headers: { 'User-Agent': 'btch/6.4.0', 'X-Client-Version': '6.4.0' },
        timeout: 7000
    });
    if (res.data?.status && res.data?.mp4) {
        return { type: 'url', url: res.data.mp4, source: 'Tioo' };
    }
    throw new Error('Tioo no video');
}

// Provider 2: Nexray Video API
async function fetchNexrayVideo(videoUrl) {
    const res = await axios.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`, {
        timeout: 7000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data?.status && res.data?.result?.url) {
        return { type: 'url', url: res.data.result.url, source: 'Nexray' };
    }
    throw new Error('Nexray no video');
}

// Provider 3: ytdl-core local extraction
async function fetchYtdlCoreVideo(videoUrl) {
    const { Ytdl } = await import('@distube/ytdl-core');
    const yt = new Ytdl({ clients: ['web_embedded', 'tv', 'mweb'] });
    const tempFile = path.join(os.tmpdir(), `zy_video_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`);
    const stream = await yt.download(videoUrl, {
        filter: f => f.itag === 18 || (f.hasVideo && f.hasAudio)
    });

    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(tempFile);
        stream.pipe(out);
        out.on('finish', resolve);
        out.on('error', reject);
        stream.on('error', reject);
        setTimeout(() => reject(new Error('Download timeout')), 20000);
    });

    if (fs.existsSync(tempFile) && fs.statSync(tempFile).size > 1000) {
        return { type: 'file', filePath: tempFile, source: 'ytdl-core' };
    }
    throw new Error('ytdl-core video empty');
}

async function fetchVideoSource(videoUrl) {
    // 1. Check in-memory cache
    const cached = getCachedMedia(videoUrl, 'video');
    if (cached) return cached;

    // 2. Fast Parallel Race: Tioo & Nexray concurrently
    try {
        const result = await Promise.any([
            fetchTiooVideo(videoUrl),
            fetchNexrayVideo(videoUrl)
        ]);
        setCachedMedia(videoUrl, 'video', result);
        return result;
    } catch { /* proceed to fallback */ }

    // 3. Fallback: ytdl-core local extraction
    try {
        const result = await fetchYtdlCoreVideo(videoUrl);
        return result;
    } catch { /* all providers exhausted */ }

    return null;
}

// ══════════════════════════════════════════════
// 📤 MEDIA SENDER HELPER (WITH BUFFER FALLBACK)
// ══════════════════════════════════════════════

async function sendMedia(conn, from, mek, m, media, vid, isAudio = true) {
    if (media.type === 'url') {
        try {
            if (isAudio) {
                await conn.sendMessage(from, {
                    audio: { url: media.url },
                    mimetype: "audio/mpeg",
                    fileName: `${vid.title}.mp3`,
                    ptt: false,
                    contextInfo: {
                        externalAdReply: {
                            title: vid.title,
                            body: `🎧 ${vid.author?.name || 'YouTube'}`,
                            thumbnailUrl: vid.thumbnail,
                            mediaType: 2,
                            mediaUrl: vid.url,
                            sourceUrl: vid.url
                        }
                    }
                }, { quoted: mek });
            } else {
                await conn.sendMessage(from, {
                    video: { url: media.url },
                    caption: `🎬 *${vid.title}*\n📺 *${vid.author?.name || 'Unknown'}*\n⏱️ *${vid.timestamp || 'N/A'}*\n\n> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                            newsletterName: config.BOT_NAME || 'Zypher MD',
                            serverMessageId: 143
                        }
                    }
                }, { quoted: mek });
            }
        } catch (sendErr) {
            // Fallback: If streaming via Baileys direct URL failed, download buffer and send
            const res = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 20000 });
            const buffer = Buffer.from(res.data);
            if (isAudio) {
                await conn.sendMessage(from, {
                    audio: buffer,
                    mimetype: "audio/mpeg",
                    fileName: `${vid.title}.mp3`,
                    ptt: false,
                    contextInfo: {
                        externalAdReply: {
                            title: vid.title,
                            body: `🎧 ${vid.author?.name || 'YouTube'}`,
                            thumbnailUrl: vid.thumbnail,
                            mediaType: 2,
                            mediaUrl: vid.url,
                            sourceUrl: vid.url
                        }
                    }
                }, { quoted: mek });
            } else {
                await conn.sendMessage(from, {
                    video: buffer,
                    caption: `🎬 *${vid.title}*\n📺 *${vid.author?.name || 'Unknown'}*\n⏱️ *${vid.timestamp || 'N/A'}*\n\n> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`
                }, { quoted: mek });
            }
        }
    } else if (media.type === 'file') {
        try {
            const buffer = fs.readFileSync(media.filePath);
            if (isAudio) {
                await conn.sendMessage(from, {
                    audio: buffer,
                    mimetype: "audio/mpeg",
                    fileName: `${vid.title}.mp3`,
                    ptt: false,
                    contextInfo: {
                        externalAdReply: {
                            title: vid.title,
                            body: `🎧 ${vid.author?.name || 'YouTube'}`,
                            thumbnailUrl: vid.thumbnail,
                            mediaType: 2,
                            mediaUrl: vid.url,
                            sourceUrl: vid.url
                        }
                    }
                }, { quoted: mek });
            } else {
                await conn.sendMessage(from, {
                    video: buffer,
                    caption: `🎬 *${vid.title}*\n📺 *${vid.author?.name || 'Unknown'}*\n⏱️ *${vid.timestamp || 'N/A'}*\n\n> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`
                }, { quoted: mek });
            }
        } finally {
            try { fs.unlinkSync(media.filePath); } catch (e) {}
        }
    }
}

// ══════════════════════════════════════════════════════════════
// 🎧 COMMAND: .play — Quick Audio Download
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: "play",
    alias: ["p", "audio", "ytmp3", "playme"],
    desc: "Search & download YouTube audio instantly",
    category: "download",
    react: "🎧",
    filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
    try {
        if (!text) return reply(`❌ *Song name එක දෙන්න!*\n\n*Usage:*\n> .play Manike Mage Hithe\n> .play https://youtu.be/...`);

        await conn.sendPresenceUpdate('composing', from);

        let url = text;
        let vid = null;

        if (text.startsWith('http://') || text.startsWith('https://')) {
            if (!isYouTubeUrl(text)) {
                return reply("❌ *Valid YouTube URL එකක් දෙන්න!*");
            }
            const videoId = getVideoId(text);
            if (!videoId) return reply("❌ *Invalid YouTube URL!*");
            vid = await yts({ videoId });
        } else {
            const search = await yts(text);
            if (!search.videos || !search.videos.length) {
                return reply(`❌ *"${text}" කියලා song එකක් හම්බුනේ නෑ!*\n\n> වෙන name එකක් try කරන්න 🔍`);
            }
            vid = search.videos[0];
            url = vid.url;
        }

        if (!vid) return reply("❌ *Results හම්බුනේ නෑ!*");

        // ⚡ In-flight parallel prefetch: start audio download right away!
        const audioPromise = fetchAudioSource(url);

        // Send info card with thumbnail concurrently
        const infoCard = `╭━━━〔 *🎧 MUSIC DOWNLOAD* 〕━━━╮
│
├ 🎵 *Title:* ${vid.title}
├ 👤 *Artist:* ${vid.author?.name || 'Unknown'}
├ ⏱️ *Duration:* ${vid.timestamp || 'N/A'}
├ 👁️ *Views:* ${formatViews(vid.views)}
│
├ ⏳ *Downloading audio...*
│
╰━━━ *${config.BOT_NAME || 'Zypher MD'}* ━━━╯`;

        const sendCardPromise = conn.sendMessage(from, {
            image: { url: vid.thumbnail },
            caption: infoCard,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'Zypher MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek }).catch(() => {});

        // Wait for both concurrently
        const [media] = await Promise.all([audioPromise, sendCardPromise]);
        if (!media) {
            return reply("❌ *Download fail උනා!* සෝරි, පස්සේ try කරන්න. 😔");
        }

        await sendMedia(conn, from, mek, m, media, vid, true);
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (err) {
        console.error("❌ PLAY ERROR:", err);
        reply("❌ *Error එකක් ආවා!* පස්සේ try කරන්න. 🔄");
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    }
});

// ══════════════════════════════════════════════════════════════
// 📹 COMMAND: .video — Quick Video Download
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: "video",
    alias: ["ytv", "ytmp4", "vd", "vid"],
    desc: "Search & download YouTube video",
    category: "download",
    react: "📹",
    filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
    try {
        if (!text) return reply(`🎥 *Video name එක දෙන්න!*\n\n*Usage:*\n> .video Manike Mage Hithe\n> .video https://youtu.be/...`);

        await conn.sendPresenceUpdate('composing', from);

        let url = text;
        let vid = null;

        if (text.startsWith('http://') || text.startsWith('https://')) {
            if (!isYouTubeUrl(text)) {
                return reply("❌ *Valid YouTube URL එකක් දෙන්න!*");
            }
            const videoId = getVideoId(text);
            if (!videoId) return reply("❌ *Invalid YouTube URL!*");
            vid = await yts({ videoId });
        } else {
            const search = await yts(text);
            if (!search.videos || !search.videos.length) {
                return reply(`❌ *"${text}" කියලා video එකක් හම්බුනේ නෑ!*`);
            }
            vid = search.videos[0];
            url = vid.url;
        }

        if (!vid) return reply("❌ *Results හම්බුනේ නෑ!*");

        // ⚡ In-flight parallel prefetch: start video download right away!
        const videoPromise = fetchVideoSource(url);

        const infoCard = `╭━━━〔 *📹 VIDEO DOWNLOAD* 〕━━━╮
│
├ 🎬 *Title:* ${vid.title}
├ 📺 *Channel:* ${vid.author?.name || 'Unknown'}
├ ⏱️ *Duration:* ${vid.timestamp || 'N/A'}
├ 👁️ *Views:* ${formatViews(vid.views)}
│
├ ⏳ *Downloading video...*
│
╰━━━ *${config.BOT_NAME || 'Zypher MD'}* ━━━╯`;

        const sendCardPromise = conn.sendMessage(from, {
            image: { url: vid.thumbnail },
            caption: infoCard,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'Zypher MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek }).catch(() => {});

        const [media] = await Promise.all([videoPromise, sendCardPromise]);
        if (!media) {
            return reply("❌ *Video download fail උනා!* පස්සේ try කරන්න. 😔");
        }

        await sendMedia(conn, from, mek, m, media, vid, false);
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error("❌ VIDEO ERROR:", e);
        reply("❌ *Error එකක් ආවා!* පස්සේ try කරන්න. 🔄");
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    }
});

// ══════════════════════════════════════════════════════════════
// 🎶 COMMAND: .song — Interactive (Choose Audio/Video/Document)
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: "song",
    alias: ["yt", "music", "ytdl"],
    desc: "Download YouTube song or video (interactive selection)",
    category: "download",
    react: "🎶",
    filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
    try {
        if (!text) return reply(`🎶 *Song/Video name එක type කරන්න*\n\n*Usage:*\n> .song Manike Mage Hithe\n> .song Alone Alan Walker\n> .song https://youtu.be/...`);

        await conn.sendPresenceUpdate('composing', from);

        let vid = null;
        let url = text;

        if (text.startsWith('http://') || text.startsWith('https://')) {
            if (!isYouTubeUrl(text)) {
                return reply("❌ *Valid YouTube URL එකක් දෙන්න!*");
            }
            const videoId = getVideoId(text);
            if (!videoId) return reply("❌ *Invalid YouTube URL!*");
            vid = await yts({ videoId });
        } else {
            const search = await yts(text);
            if (!search.videos || !search.videos.length) {
                return reply(`❌ *"${text}" කියලා results හම්බුනේ නෑ!*`);
            }
            vid = search.videos[0];
            url = vid.url;
        }

        if (!vid) return reply("❌ *Results හම්බුනේ නෑ!*");

        // Interactive selection card
        const selectionCard = `╭━━━〔 *🎶 ${toSmallCaps('YT Downloader')}* 〕━━━╮
│
├ 🎵 *Title:* ${vid.title}
├ 📺 *Channel:* ${vid.author?.name || 'Unknown'}
├ ⏱️ *Duration:* ${vid.timestamp || 'N/A'}
├ 👁️ *Views:* ${formatViews(vid.views)}
├ 🔗 *URL:* ${vid.url}
│
╰━━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 *📋 FORMAT SELECT* 〕━━╮
│
│  *1* ➜ 🎧 Audio (MP3)
│  *2* ➜ 📹 Video (MP4)
│  *3* ➜ 📄 Document (File)
│
╰━━━━━━━━━━━━━━━━━━━━━╯

> 💡 *Reply with 1, 2 or 3*
> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`;

        const sent = await conn.sendMessage(from, {
            image: { url: vid.thumbnail },
            caption: selectionCard,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'Zypher MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

        const msgId = sent.key.id;

        // Listen for user's reply
        const songListener = async (msgData) => {
            try {
                const received = msgData.messages[0];
                if (!received?.message) return;

                const selected = received.message.conversation ||
                    received.message.extendedTextMessage?.text || '';
                const replyToBot = received.message.extendedTextMessage?.contextInfo?.stanzaId === msgId;

                if (!replyToBot) return;

                conn.ev.off("messages.upsert", songListener);
                await conn.sendMessage(from, { react: { text: '⬇️', key: received.key } });

                const choice = selected.trim();

                if (choice === "1") {
                    // Audio download (concurrent fetch!)
                    const mediaPromise = fetchAudioSource(vid.url);
                    const statusPromise = conn.sendMessage(from, {
                        text: `⏳ *Audio downloading...*\n🎵 ${vid.title}`
                    }, { quoted: received }).catch(() => {});

                    const [media] = await Promise.all([mediaPromise, statusPromise]);
                    if (!media) {
                        return await conn.sendMessage(from, {
                            text: "❌ *Audio download fail උනා!* පස්සේ try කරන්න."
                        }, { quoted: received });
                    }

                    await sendMedia(conn, from, mek, m, media, vid, true);
                    await conn.sendMessage(from, { react: { text: '✅', key: received.key } });

                } else if (choice === "2") {
                    // Video download (concurrent fetch!)
                    const mediaPromise = fetchVideoSource(vid.url);
                    const statusPromise = conn.sendMessage(from, {
                        text: `⏳ *Video downloading...*\n🎬 ${vid.title}`
                    }, { quoted: received }).catch(() => {});

                    const [media] = await Promise.all([mediaPromise, statusPromise]);
                    if (!media) {
                        return await conn.sendMessage(from, {
                            text: "❌ *Video download fail උනා!* පස්සේ try කරන්න."
                        }, { quoted: received });
                    }

                    await sendMedia(conn, from, mek, m, media, vid, false);
                    await conn.sendMessage(from, { react: { text: '✅', key: received.key } });

                } else if (choice === "3") {
                    // Document download
                    const mediaPromise = fetchAudioSource(vid.url);
                    const statusPromise = conn.sendMessage(from, {
                        text: `⏳ *Document downloading...*\n📄 ${vid.title}`
                    }, { quoted: received }).catch(() => {});

                    const [media] = await Promise.all([mediaPromise, statusPromise]);
                    if (!media) {
                        return await conn.sendMessage(from, {
                            text: "❌ *Download fail උනා!* පස්සේ try කරන්න."
                        }, { quoted: received });
                    }

                    if (media.type === 'url') {
                        const response = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 30000 });
                        await conn.sendMessage(from, {
                            document: Buffer.from(response.data),
                            fileName: `${vid.title}.mp3`,
                            mimetype: 'audio/mpeg',
                            caption: `📄 *${vid.title}*\n👤 *${vid.author?.name || 'Unknown'}*\n\n> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`
                        }, { quoted: received });
                    } else if (media.type === 'file') {
                        try {
                            const buffer = fs.readFileSync(media.filePath);
                            await conn.sendMessage(from, {
                                document: buffer,
                                fileName: `${vid.title}.mp3`,
                                mimetype: 'audio/mpeg',
                                caption: `📄 *${vid.title}*\n👤 *${vid.author?.name || 'Unknown'}*\n\n> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`
                            }, { quoted: received });
                        } finally {
                            try { fs.unlinkSync(media.filePath); } catch (e) {}
                        }
                    }

                    await conn.sendMessage(from, { react: { text: '✅', key: received.key } });

                } else {
                    await conn.sendMessage(from, {
                        text: `❌ *Invalid selection!*\n\n> Reply with:\n> *1* ➜ 🎧 Audio\n> *2* ➜ 📹 Video\n> *3* ➜ 📄 Document`
                    }, { quoted: received });
                }
            } catch (listenerErr) {
                console.error("Song listener error:", listenerErr);
            }
        };

        conn.ev.on("messages.upsert", songListener);

        // Auto-remove listener after 60 seconds
        setTimeout(() => {
            conn.ev.off("messages.upsert", songListener);
        }, 60000);

    } catch (e) {
        console.error("❌ SONG ERROR:", e);
        reply(`❌ *Error: ${e.message}*`);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
    }
});

// ══════════════════════════════════════════════════════════════
// 🔎 COMMAND: .yts — YouTube Search
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: "yts",
    alias: ["ytsearch", "searchyt", "youtubesearch"],
    desc: "Search YouTube for videos",
    category: "search",
    react: "🔎",
    filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
    try {
        if (!text) return reply(`🔍 *Search keyword එක type කරන්න!*\n\n*Usage:*\n> .yts Manike Mage Hithe\n> .yts Alan Walker`);

        await conn.sendPresenceUpdate('composing', from);

        const search = await yts(text);

        if (!search.videos || !search.videos.length) {
            return reply(`❌ *"${text}" කියලා results හම්බුනේ නෑ!*`);
        }

        const results = search.videos.slice(0, 10);

        let msg = `╭━━━〔 *🔎 ${toSmallCaps('YouTube Search')}* 〕━━━╮\n`;
        msg += `│ 🔍 *Query:* ${text}\n`;
        msg += `│ 📊 *Found:* ${search.videos.length} results\n`;
        msg += `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

        results.forEach((video, i) => {
            msg += `*${i + 1}.* ${video.title}\n`;
            msg += `├ 🔗 ${video.url}\n`;
            msg += `├ ⏱️ ${video.timestamp} | 👁️ ${formatViews(video.views)}\n`;
            msg += `├ 📺 ${video.author?.name || 'Unknown'}\n`;
            msg += `╰──────────────\n\n`;
        });

        msg += `> 💡 *Copy URL and use .play or .video*\n`;
        msg += `> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`;

        await conn.sendMessage(from, {
            text: msg.trim(),
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'Zypher MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.error('YTS Error:', e);
        reply(`❌ *Search error!*\n\`\`\`${e.message}\`\`\``);
    }
});

// ══════════════════════════════════════════════════════════════
// 🎤 COMMAND: .lyrics — Song Lyrics Search
// ══════════════════════════════════════════════════════════════

cmd({
    pattern: "lyrics",
    alias: ["lyric", "songlyrics"],
    desc: "Search for song lyrics",
    category: "search",
    react: "🎤",
    filename: __filename
}, async (conn, mek, m, { from, text, reply }) => {
    try {
        if (!text) return reply(`🎤 *Song name එක type කරන්න!*\n\n*Usage:*\n> .lyrics Shape of You\n> .lyrics Manike Mage Hithe`);

        await conn.sendPresenceUpdate('composing', from);

        // Try lyrics API
        let lyrics = null;
        let songTitle = text;
        let artist = '';

        try {
            const res = await axios.get(`https://lyrist.vercel.app/api/${encodeURIComponent(text)}`, { timeout: 10000 });
            if (res.data?.lyrics) {
                lyrics = res.data.lyrics;
                songTitle = res.data.title || text;
                artist = res.data.artist || '';
            }
        } catch (e) { /* fallback */ }

        // Fallback API
        if (!lyrics) {
            try {
                const res = await axios.get(`https://some-random-api.com/others/lyrics?title=${encodeURIComponent(text)}`, { timeout: 10000 });
                if (res.data?.lyrics) {
                    lyrics = res.data.lyrics;
                    songTitle = res.data.title || text;
                    artist = res.data.author || '';
                }
            } catch (e) { /* no lyrics found */ }
        }

        if (!lyrics) {
            return reply(`❌ *"${text}" කියලා lyrics හම්බුනේ නෑ!*\n\n> වෙන song name එකක් try කරන්න 🎤`);
        }

        // Truncate if too long for WhatsApp
        if (lyrics.length > 4000) {
            lyrics = lyrics.substring(0, 4000) + '\n\n... (truncated)';
        }

        const lyricsMsg = `╭━━━〔 *🎤 LYRICS* 〕━━━╮
│
├ 🎵 *Song:* ${songTitle}
${artist ? `├ 👤 *Artist:* ${artist}` : ''}
│
╰━━━━━━━━━━━━━━━━━━━━━╯

${lyrics}

> ⚡ *${config.BOT_NAME || 'Zypher MD'}*`;

        await conn.sendMessage(from, {
            text: lyricsMsg,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'Zypher MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (e) {
        console.error("LYRICS Error:", e);
        reply(`❌ *Lyrics search error!*`);
    }
});
