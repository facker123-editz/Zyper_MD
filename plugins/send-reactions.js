import { cmd } from '../command.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';

// ========== FIX: Get __filename in ES module ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegPath.path);

// ========== GENERATE RANDOM USER-AGENT WITH CRYPTO ==========
function generateRandomUserAgent() {
    // Random prefix (1-3 characters)
    const prefixLength = crypto.randomInt(1, 4);
    let prefix = '';
    for (let i = 0; i < prefixLength; i++) {
        const char = String.fromCharCode(crypto.randomInt(97, 123)); // a-z
        prefix += char;
    }
    
    // Random suffix (1-3 characters)
    const suffixLength = crypto.randomInt(1, 4);
    let suffix = '';
    for (let i = 0; i < suffixLength; i++) {
        const char = String.fromCharCode(crypto.randomInt(97, 123)); // a-z
        suffix += char;
    }
    
    // Randomly choose between Jawad or Khan
    const baseNames = ['jawad', 'khan'];
    const baseName = baseNames[crypto.randomInt(0, baseNames.length)];
    
    // Randomly add extra letters in middle (0-2 characters)
    const extraLength = crypto.randomInt(0, 3);
    let extra = '';
    for (let i = 0; i < extraLength; i++) {
        const char = String.fromCharCode(crypto.randomInt(97, 123)); // a-z
        extra += char;
    }
    
    // Build the name
    let name = '';
    if (crypto.randomInt(0, 2) === 0) {
        // Prefix + base + extra + suffix
        name = prefix + baseName + extra + suffix;
    } else {
        // Prefix + extra + base + suffix
        name = prefix + extra + baseName + suffix;
    }
    
    // Ensure minimum length (at least 5 chars)
    while (name.length < 5) {
        const char = String.fromCharCode(crypto.randomInt(97, 123));
        name += char;
    }
    
    // Clean up - ensure no empty parts and valid format
    name = name.replace(/[^a-z]/g, '');
    
    // Add -best.js suffix with version
    return `${name}-best.js / 6.6.0`;
}

// ========== FETCH GIF FROM NEKOS.BEST ==========
async function getNekosGif(action) {
    // Generate ONE random User-Agent for this request
    const userAgent = generateRandomUserAgent();
    
    const apiUrl = `https://nekos.best/api/v2/${action}`;
    const response = await axios.get(apiUrl, {
        headers: {
            'User-Agent': userAgent
        }
    });
    
    const gifUrl = response.data.results[0].url;
    
    // Fetch the GIF using the SAME User-Agent
    const gifResponse = await axios.get(gifUrl, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': userAgent
        },
        timeout: 15000
    });
    
    return gifResponse.data;
}

// ========== CONVERT GIF TO VIDEO ==========
async function gifToVideo(gifBuffer) {
    const filename = crypto.randomBytes(6).toString('hex');
    const gifPath = path.join(tmpdir(), `${filename}.gif`);
    const mp4Path = path.join(tmpdir(), `${filename}.mp4`);

    fs.writeFileSync(gifPath, gifBuffer);

    await new Promise((resolve, reject) => {
        ffmpeg(gifPath)
            .outputOptions([
                "-movflags faststart",
                "-pix_fmt yuv420p",
                "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2"
            ])
            .on("error", (err) => {
                console.error("❌ ffmpeg conversion error:", err);
                reject(new Error("Could not process GIF to video."));
            })
            .on("end", resolve)
            .save(mp4Path);
    });

    const videoBuffer = fs.readFileSync(mp4Path);
    fs.unlinkSync(gifPath);
    fs.unlinkSync(mp4Path);

    return videoBuffer;
}

// ==================== LURK COMMAND ====================
cmd({
    pattern: "lurk",
    desc: "Send a lurk reaction GIF.",
    category: "fun",
    react: "👀",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is lurking @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is lurking everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("lurk");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .lurk command:", error);
        reply(`❌ *Error in .lurk command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== KILL COMMAND ====================
cmd({
    pattern: "kill",
    desc: "Send a kill reaction GIF.",
    category: "fun",
    react: "💀",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        // Use "shoot" as kill since there's no dedicated kill category
        const category = "shoot";

        let message = mentionedUser
            ? `${sender} killed @${mentionedUser.split("@")[0]} 💀`
            : isGroup
            ? `${sender} killed everyone! 💀`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif(category);
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .kill command:", error);
        reply(`❌ *Error in .kill command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== MARIGE COMMAND ====================  <-- PASTE HERE
cmd({
  pattern: "marige",
  alias: ["shadi", "marriage", "wedding"],
  desc: "Randomly pairs two users for marriage with a wedding GIF",
  react: "💍",
  category: "fun",
  filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, reply }) => {
  try {
    if (!isGroup) return reply("❌ This command can only be used in groups!");
    
    const groupMetadata = await conn.groupMetadata(from);
    if (!groupMetadata?.participants) return reply("⚠️ Couldn't fetch group members.");
    
    const participants = groupMetadata.participants.map(user => user.id);
    const botNumber = conn.user.id;
    
    const eligibleParticipants = participants.filter(id => id !== sender && id !== botNumber);
    
    if (eligibleParticipants.length < 1) return reply("❌ Not enough participants to perform a marriage!");
    
    const randomIndex = Math.floor(Math.random() * eligibleParticipants.length);
    const randomPair = eligibleParticipants[randomIndex];
    
    let gifBuffer = await getNekosGif("hug");
    let videoBuffer = await gifToVideo(gifBuffer);
    
    const message = `💍 *Shadi Mubarak!* 💒\n\n👰 @${sender.split("@")[0]} + 🤵 @${randomPair.split("@")[0]}\n\nMay you both live happily ever after! 💖`;
    
    await conn.sendMessage(
      from, 
      { 
        video: videoBuffer, 
        caption: message, 
        gifPlayback: true, 
        mentions: [sender, randomPair] 
      }, 
      { quoted: mek }
    );
    
  } catch (error) {
    console.error("❌ Error in .marige command:", error);
    reply(`❌ *Error in .marige command:*\n\`\`\`${error.message}\`\`\``);
  }
});


// ==================== SHOOT COMMAND ====================
cmd({
    pattern: "shoot",
    desc: "Send a shoot reaction GIF.",
    category: "fun",
    react: "🔫",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} shot @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} shot everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("shoot");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .shoot command:", error);
        reply(`❌ *Error in .shoot command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SLEEP COMMAND ====================
cmd({
    pattern: "sleep",
    desc: "Send a sleep reaction GIF.",
    category: "fun",
    react: "😴",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is sleeping with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is sleeping!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("sleep");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .sleep command:", error);
        reply(`❌ *Error in .sleep command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== CLAP COMMAND ====================
cmd({
    pattern: "clap",
    desc: "Send a clap reaction GIF.",
    category: "fun",
    react: "👏",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} clapped for @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} clapped for everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("clap");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .clap command:", error);
        reply(`❌ *Error in .clap command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SHRUG COMMAND ====================
cmd({
    pattern: "shrug",
    desc: "Send a shrug reaction GIF.",
    category: "fun",
    react: "🤷",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} shrugged at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} shrugged at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("shrug");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .shrug command:", error);
        reply(`❌ *Error in .shrug command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== STARE COMMAND ====================
cmd({
    pattern: "stare",
    desc: "Send a stare reaction GIF.",
    category: "fun",
    react: "👀",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is staring at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is staring at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("stare");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .stare command:", error);
        reply(`❌ *Error in .stare command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== WAVE COMMAND ====================
cmd({
    pattern: "wave",
    desc: "Send a wave reaction GIF.",
    category: "fun",
    react: "👋",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} waved at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is waving at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("wave");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .wave command:", error);
        reply(`❌ *Error in .wave command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== POKE COMMAND ====================
cmd({
    pattern: "poke",
    desc: "Send a poke reaction GIF.",
    category: "fun",
    react: "👉",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} poked @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} poked everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("poke");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .poke command:", error);
        reply(`❌ *Error in .poke command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== CONFUSED COMMAND ====================
cmd({
    pattern: "confused",
    desc: "Send a confused reaction GIF.",
    category: "fun",
    react: "😕",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is confused by @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is confused!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("confused");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .confused command:", error);
        reply(`❌ *Error in .confused command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SMILE COMMAND ====================
cmd({
    pattern: "smile",
    desc: "Send a smile reaction GIF.",
    category: "fun",
    react: "😁",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} smiled at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is smiling at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("smile");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .smile command:", error);
        reply(`❌ *Error in .smile command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== PECK COMMAND ====================
cmd({
    pattern: "peck",
    desc: "Send a peck reaction GIF.",
    category: "fun",
    react: "🐦",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} pecked @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} pecked everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("peck");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .peck command:", error);
        reply(`❌ *Error in .peck command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== WINK COMMAND ====================
cmd({
    pattern: "wink",
    desc: "Send a wink reaction GIF.",
    category: "fun",
    react: "😉",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} winked at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is winking at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("wink");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .wink command:", error);
        reply(`❌ *Error in .wink command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SIP COMMAND ====================
cmd({
    pattern: "sip",
    desc: "Send a sip reaction GIF.",
    category: "fun",
    react: "☕",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is sipping with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is sipping!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("sip");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .sip command:", error);
        reply(`❌ *Error in .sip command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BLUSH COMMAND ====================
cmd({
    pattern: "blush",
    desc: "Send a blush reaction GIF.",
    category: "fun",
    react: "😊",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is blushing at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is blushing!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("blush");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .blush command:", error);
        reply(`❌ *Error in .blush command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SMUG COMMAND ====================
cmd({
    pattern: "smug",
    desc: "Send a smug reaction GIF.",
    category: "fun",
    react: "😏",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is smug at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is feeling smug!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("smug");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .smug command:", error);
        reply(`❌ *Error in .smug command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== TICKLE COMMAND ====================
cmd({
    pattern: "tickle",
    desc: "Send a tickle reaction GIF.",
    category: "fun",
    react: "🤣",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} tickled @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} tickled everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("tickle");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .tickle command:", error);
        reply(`❌ *Error in .tickle command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== YEET COMMAND ====================
cmd({
    pattern: "yeet",
    desc: "Send a yeet reaction GIF.",
    category: "fun",
    react: "💨",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} yeeted @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is yeeting everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("yeet");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .yeet command:", error);
        reply(`❌ *Error in .yeet command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== THINK COMMAND ====================
cmd({
    pattern: "think",
    desc: "Send a think reaction GIF.",
    category: "fun",
    react: "🤔",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is thinking about @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is thinking!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("think");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .think command:", error);
        reply(`❌ *Error in .think command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== HIGHFIVE COMMAND ====================
cmd({
    pattern: "highfive",
    desc: "Send a high-five reaction GIF.",
    category: "fun",
    react: "✋",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} gave a high-five to @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is high-fiving everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("highfive");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .highfive command:", error);
        reply(`❌ *Error in .highfive command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== FEED COMMAND ====================
cmd({
    pattern: "feed",
    desc: "Send a feed reaction GIF.",
    category: "fun",
    react: "🍕",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is feeding @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is feeding everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("feed");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .feed command:", error);
        reply(`❌ *Error in .feed command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== WAG COMMAND ====================
cmd({
    pattern: "wag",
    desc: "Send a wag reaction GIF.",
    category: "fun",
    react: "🐕",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} wagged at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} wagged at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("wag");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .wag command:", error);
        reply(`❌ *Error in .wag command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BITE COMMAND ====================
cmd({
    pattern: "bite",
    desc: "Send a bite reaction GIF.",
    category: "fun",
    react: "🦷",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} bit @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is biting everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("bite");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .bite command:", error);
        reply(`❌ *Error in .bite command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== TEEHEE COMMAND ====================
cmd({
    pattern: "teehee",
    desc: "Send a teehee reaction GIF.",
    category: "fun",
    react: "😜",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} teehee'd at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} teehee'd at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("teehee");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .teehee command:", error);
        reply(`❌ *Error in .teehee command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SHOCKED COMMAND ====================
cmd({
    pattern: "shocked",
    desc: "Send a shocked reaction GIF.",
    category: "fun",
    react: "😮",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is shocked by @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is shocked!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("shocked");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .shocked command:", error);
        reply(`❌ *Error in .shocked command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BLEH COMMAND ====================
cmd({
    pattern: "bleh",
    desc: "Send a bleh reaction GIF.",
    category: "fun",
    react: "😝",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} bleh'd at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} bleh'd at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("bleh");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .bleh command:", error);
        reply(`❌ *Error in .bleh command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BORED COMMAND ====================
cmd({
    pattern: "bored",
    desc: "Send a bored reaction GIF.",
    category: "fun",
    react: "😑",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is bored by @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is bored!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("bored");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .bored command:", error);
        reply(`❌ *Error in .bored command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== NOM COMMAND ====================
cmd({
    pattern: "nom",
    desc: "Send a nom reaction GIF.",
    category: "fun",
    react: "🍽️",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is nomming @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is nomming everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("nom");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .nom command:", error);
        reply(`❌ *Error in .nom command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== NYA COMMAND ====================
cmd({
    pattern: "nya",
    desc: "Send a nya reaction GIF.",
    category: "fun",
    react: "🐱",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} nya'd at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} nya'd at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("nya");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .nya command:", error);
        reply(`❌ *Error in .nya command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== YAWN COMMAND ====================
cmd({
    pattern: "yawn",
    desc: "Send a yawn reaction GIF.",
    category: "fun",
    react: "🥱",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} yawned at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} yawned at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("yawn");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .yawn command:", error);
        reply(`❌ *Error in .yawn command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== FACEPALM COMMAND ====================
cmd({
    pattern: "facepalm",
    desc: "Send a facepalm reaction GIF.",
    category: "fun",
    react: "🤦",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} facepalmed at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} facepalmed at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("facepalm");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .facepalm command:", error);
        reply(`❌ *Error in .facepalm command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== CUDDLE COMMAND ====================
cmd({
    pattern: "cuddle",
    desc: "Send a cuddle reaction GIF.",
    category: "fun",
    react: "🤗",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} cuddled @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is cuddling everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("cuddle");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .cuddle command:", error);
        reply(`❌ *Error in .cuddle command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== KICK COMMAND ====================
cmd({
    pattern: "kick",
    desc: "Send a kick reaction GIF.",
    category: "fun",
    react: "🦶",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} kicked @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} kicked everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("kick");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .kick command:", error);
        reply(`❌ *Error in .kick command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== HAPPY COMMAND ====================
cmd({
    pattern: "happy",
    desc: "Send a happy reaction GIF.",
    category: "fun",
    react: "😄",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is happy with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is happy!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("happy");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .happy command:", error);
        reply(`❌ *Error in .happy command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== CARRY COMMAND ====================
cmd({
    pattern: "carry",
    desc: "Send a carry reaction GIF.",
    category: "fun",
    react: "🏃",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} carried @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} carried everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("carry");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .carry command:", error);
        reply(`❌ *Error in .carry command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== HUG COMMAND ====================
cmd({
    pattern: "hug",
    desc: "Send a hug reaction GIF.",
    category: "fun",
    react: "🤗",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} hugged @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is hugging everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("hug");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .hug command:", error);
        reply(`❌ *Error in .hug command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== KABEDON COMMAND ====================
cmd({
    pattern: "kabedon",
    desc: "Send a kabedon reaction GIF.",
    category: "fun",
    react: "🧱",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} kabedon'd @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} kabedon'd everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("kabedon");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .kabedon command:", error);
        reply(`❌ *Error in .kabedon command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BAKA COMMAND ====================
cmd({
    pattern: "baka",
    desc: "Send a baka reaction GIF.",
    category: "fun",
    react: "😤",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} called @${mentionedUser.split("@")[0]} baka`
            : isGroup
            ? `${sender} called everyone baka!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("baka");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .baka command:", error);
        reply(`❌ *Error in .baka command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BONK COMMAND ====================
cmd({
    pattern: "bonk",
    desc: "Send a bonk reaction GIF.",
    category: "fun",
    react: "🔨",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} bonked @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} bonked everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("bonk");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .bonk command:", error);
        reply(`❌ *Error in .bonk command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== PAT COMMAND ====================
cmd({
    pattern: "pat",
    desc: "Send a pat reaction GIF.",
    category: "fun",
    react: "🫂",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} patted @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is patting everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("pat");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .pat command:", error);
        reply(`❌ *Error in .pat command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== ANGRY COMMAND ====================
cmd({
    pattern: "angry",
    desc: "Send an angry reaction GIF.",
    category: "fun",
    react: "😡",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is angry at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is angry!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("angry");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .angry command:", error);
        reply(`❌ *Error in .angry command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SPIN COMMAND ====================
cmd({
    pattern: "spin",
    desc: "Send a spin reaction GIF.",
    category: "fun",
    react: "🔄",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} spun @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} spun everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("spin");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .spin command:", error);
        reply(`❌ *Error in .spin command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SHAKE COMMAND ====================
cmd({
    pattern: "shake",
    desc: "Send a shake reaction GIF.",
    category: "fun",
    react: "🤝",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} shook @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} shook everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("shake");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .shake command:", error);
        reply(`❌ *Error in .shake command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== RUN COMMAND ====================
cmd({
    pattern: "run",
    desc: "Send a run reaction GIF.",
    category: "fun",
    react: "🏃",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} ran from @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} ran from everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("run");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .run command:", error);
        reply(`❌ *Error in .run command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== NOD COMMAND ====================
cmd({
    pattern: "nod",
    desc: "Send a nod reaction GIF.",
    category: "fun",
    react: "🙂",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} nodded at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} nodded at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("nod");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .nod command:", error);
        reply(`❌ *Error in .nod command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== NOPE COMMAND ====================
cmd({
    pattern: "nope",
    desc: "Send a nope reaction GIF.",
    category: "fun",
    react: "🙅",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} said nope to @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} said nope to everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("nope");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .nope command:", error);
        reply(`❌ *Error in .nope command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== KISS COMMAND ====================
cmd({
    pattern: "kiss",
    desc: "Send a kiss reaction GIF.",
    category: "fun",
    react: "💋",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} kissed @${mentionedUser.split("@")[0]} 🥰`
            : isGroup
            ? `${sender} kissed everyone! 💋`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("kiss");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .kiss command:", error);
        reply(`❌ *Error in .kiss command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== DANCE COMMAND ====================
cmd({
    pattern: "dance",
    desc: "Send a dance reaction GIF.",
    category: "fun",
    react: "💃",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} danced with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is dancing with everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("dance");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .dance command:", error);
        reply(`❌ *Error in .dance command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== PUNCH COMMAND ====================
cmd({
    pattern: "punch",
    desc: "Send a punch reaction GIF.",
    category: "fun",
    react: "👊",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} punched @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} punched everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("punch");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .punch command:", error);
        reply(`❌ *Error in .punch command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== HANDSHAKE COMMAND ====================
cmd({
    pattern: "handshake",
    desc: "Send a handshake reaction GIF.",
    category: "fun",
    react: "🤝",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} shook hands with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} shook hands with everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("handshake");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .handshake command:", error);
        reply(`❌ *Error in .handshake command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SLAP COMMAND ====================
cmd({
    pattern: "slap",
    desc: "Send a slap reaction GIF.",
    category: "fun",
    react: "✊",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} slapped @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} slapped everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("slap");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .slap command:", error);
        reply(`❌ *Error in .slap command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== CRY COMMAND ====================
cmd({
    pattern: "cry",
    desc: "Send a crying reaction GIF.",
    category: "fun",
    react: "😢",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is crying over @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is crying!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("cry");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .cry command:", error);
        reply(`❌ *Error in .cry command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== LAPPILLOW COMMAND ====================
cmd({
    pattern: "lappillow",
    desc: "Send a lappillow reaction GIF.",
    category: "fun",
    react: "🛏️",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is using @${mentionedUser.split("@")[0]} as a lap pillow`
            : isGroup
            ? `${sender} is using everyone as a lap pillow!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("lappillow");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .lappillow command:", error);
        reply(`❌ *Error in .lappillow command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== POUT COMMAND ====================
cmd({
    pattern: "pout",
    desc: "Send a pout reaction GIF.",
    category: "fun",
    react: "😤",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} pouted at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} pouted at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("pout");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .pout command:", error);
        reply(`❌ *Error in .pout command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== BLOWKISS COMMAND ====================
cmd({
    pattern: "blowkiss",
    desc: "Send a blowkiss reaction GIF.",
    category: "fun",
    react: "😘",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} blew a kiss to @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} blew kisses to everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("blowkiss");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .blowkiss command:", error);
        reply(`❌ *Error in .blowkiss command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== HANDHOLD COMMAND ====================
cmd({
    pattern: "handhold",
    desc: "Send a hand-holding reaction GIF.",
    category: "fun",
    react: "🤝",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} is holding hands with @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} wants to hold hands with everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("handhold");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .handhold command:", error);
        reply(`❌ *Error in .handhold command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== SALUTE COMMAND ====================
cmd({
    pattern: "salute",
    desc: "Send a salute reaction GIF.",
    category: "fun",
    react: "🫡",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} saluted @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} saluted everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("salute");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .salute command:", error);
        reply(`❌ *Error in .salute command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== THUMBSUP COMMAND ====================
cmd({
    pattern: "thumbsup",
    desc: "Send a thumbsup reaction GIF.",
    category: "fun",
    react: "👍",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} gave a thumbs up to @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} gave a thumbs up to everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("thumbsup");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .thumbsup command:", error);
        reply(`❌ *Error in .thumbsup command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== LAUGH COMMAND ====================
cmd({
    pattern: "laugh",
    desc: "Send a laugh reaction GIF.",
    category: "fun",
    react: "😂",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} laughed at @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} is laughing at everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("laugh");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .laugh command:", error);
        reply(`❌ *Error in .laugh command:*\n\`\`\`${error.message}\`\`\``);
    }
});

// ==================== TABLEFLIP COMMAND ====================
cmd({
    pattern: "tableflip",
    desc: "Send a tableflip reaction GIF.",
    category: "fun",
    react: "😶",
    filename: __filename,
    use: "@tag (optional)",
}, async (conn, mek, m, { args, q, reply }) => {
    try {
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let isGroup = m.isGroup;

        let message = mentionedUser
            ? `${sender} flipped a table on @${mentionedUser.split("@")[0]}`
            : isGroup
            ? `${sender} flipped a table on everyone!`
            : `> © Powered By JawadTechX 🖤`;

        let gifBuffer = await getNekosGif("tableflip");
        let videoBuffer = await gifToVideo(gifBuffer);
        
        await conn.sendMessage(
            mek.chat,
            { video: videoBuffer, caption: message, gifPlayback: true, mentions: [mek.sender, mentionedUser].filter(Boolean) },
            { quoted: mek }
        );
    } catch (error) {
        console.error("❌ Error in .tableflip command:", error);
        reply(`❌ *Error in .tableflip command:*\n\`\`\`${error.message}\`\`\``);
    }
});