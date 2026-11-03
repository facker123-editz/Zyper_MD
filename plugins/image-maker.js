// plugins/image-maker.js - TextMaker & Image Maker Plugin (ESM)
// Converted from gist: https://gist.github.com/ajithaajitha952/ff75b87b4a2a716a5b7e3e9c556a0f4a
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import { cmd } from '../command.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * High-performance, robust TextPro & EPhoto360 image generator
 */
export async function createEffectImage(pageUrl, texts) {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const textArray = Array.isArray(texts) ? texts : [texts];

    // 1. Initial GET request to extract cookies and hidden tokens
    const res = await axios.get(pageUrl, {
        headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 15000
    });

    const cookies = res.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
    const $ = cheerio.load(res.data);
    const token = $('input[name="token"]').val();
    const buildServer = $('input[name="build_server"]').val();
    const buildServerId = $('input[name="build_server_id"]').val();

    if (!token) {
        throw new Error('Could not parse security token from generator service.');
    }

    // 2. Submit form with user text payload
    const form = new FormData();
    for (const t of textArray) {
        form.append('text[]', t);
    }
    form.append('submit', 'Go');
    form.append('token', token);
    if (buildServer) form.append('build_server', buildServer);
    if (buildServerId) form.append('build_server_id', buildServerId);

    const postRes = await axios.post(pageUrl, form, {
        headers: {
            ...form.getHeaders(),
            'User-Agent': userAgent,
            'Cookie': cookies,
            'Referer': pageUrl
        },
        timeout: 20000
    });

    // 3. Extract JSON payload for create-image endpoint
    const $$ = cheerio.load(postRes.data);
    const formValue = $$('#form_value').first().text().trim() ||
                      $$('input[name="form_value_input"]').val() ||
                      $$('#form_value_input').val();

    if (!formValue) {
        throw new Error('Server returned an empty generation response.');
    }

    const jsonPayload = JSON.parse(formValue);
    const origin = new URL(pageUrl).origin;
    const createUrl = `${origin}/effect/create-image`;

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(jsonPayload)) {
        if (Array.isArray(v)) {
            v.forEach(val => params.append(`${k}[]`, val));
        } else {
            params.append(k, v);
        }
    }

    // 4. Request image generation
    const createRes = await axios.post(createUrl, params.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': userAgent,
            'Cookie': cookies,
            'Referer': pageUrl,
            'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 25000
    });

    if (!createRes.data || !createRes.data.success) {
        throw new Error(createRes.data?.info || 'Failed to render image.');
    }

    const imagePath = createRes.data.fullsize_image || createRes.data.image;
    const server = buildServer || jsonPayload.build_server || origin;
    const fullImageUrl = imagePath.startsWith('http')
        ? imagePath
        : `${server.replace(/\/$/, '')}/${imagePath.replace(/^\//, '')}`;

    return fullImageUrl;
}

// 40 Effects metadata map
export const EFFECTS = [
    { id: 1, name: 'Thunder', pattern: 'thunder', url: 'https://textpro.me/create-thunder-text-effect-online-881.html', emoji: '⚡', isTwoText: false },
    { id: 2, name: 'Breakwall', pattern: 'breakwall', url: 'https://textpro.me/break-wall-text-effect-871.html', emoji: '🧱', isTwoText: false },
    { id: 3, name: 'Sky', pattern: 'sky', url: 'https://textpro.me/create-a-cloud-text-effect-on-the-sky-online-1004.html', emoji: '☁️', isTwoText: false },
    { id: 4, name: '3D Stone', pattern: '3dstone', url: 'https://textpro.me/create-a-3d-stone-text-effect-online-for-free-1073.html', emoji: '🪨', isTwoText: false },
    { id: 5, name: 'Magma', pattern: 'magma', url: 'https://textpro.me/create-a-magma-hot-text-effect-online-1030.html', emoji: '🌋', isTwoText: false },
    { id: 6, name: 'Beach', pattern: 'beach', url: 'https://textpro.me/sand-writing-text-effect-online-990.html', emoji: '🏖️', isTwoText: false },
    { id: 7, name: '3D Space', pattern: '3dspace', url: 'https://textpro.me/create-space-text-effects-online-free-1042.html', emoji: '🌌', isTwoText: true },
    { id: 8, name: 'Anonymous', pattern: 'anonymous', url: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html', emoji: '🎭', isTwoText: false },
    { id: 9, name: 'Avengers', pattern: 'avengers', url: 'https://en.ephoto360.com/create-logo-3d-style-avengers-online-427.html', emoji: '🛡️', isTwoText: true },
    { id: 10, name: 'Dragon', pattern: 'dragon', url: 'https://en.ephoto360.com/dragon-fire-text-effect-111.html', emoji: '🐉', isTwoText: false },
    { id: 11, name: 'Galaxy', pattern: 'galaxy', url: 'https://en.ephoto360.com/collage-art-galaxy-angel-wings-745.html', emoji: '✨', isTwoText: false },
    { id: 12, name: 'Football', pattern: 'football', url: 'https://en.ephoto360.com/create-football-team-logo-online-free-671.html', emoji: '⚽', isTwoText: false },
    { id: 13, name: 'Arena', pattern: 'arena', url: 'https://en.ephoto360.com/generate-banner-arena-of-valor-aov-with-name-440.html', emoji: '⚔️', isTwoText: false },
    { id: 14, name: 'Alice', pattern: 'alice', url: 'https://en.ephoto360.com/general-fiora-lol-cover-43.html', emoji: '👑', isTwoText: false },
    { id: 15, name: '3D Silver', pattern: '3dsilver', url: 'https://en.ephoto360.com/3d-silver-text-effect-273.html', emoji: '🥈', isTwoText: true },
    { id: 16, name: 'Horse', pattern: 'horse', url: 'https://en.ephoto360.com/create-digital-tiger-logo-video-effect-723.html', emoji: '🐎', isTwoText: true },
    { id: 17, name: 'Spiderman', pattern: 'spiderman', url: 'https://textpro.me/create-spiderman-logo-style-text-effect-online-983.html', emoji: '🕷️', isTwoText: true },
    { id: 18, name: 'League', pattern: 'league', url: 'https://en.ephoto360.com/create-photo-premier-league-cup-263.html', emoji: '🏆', isTwoText: true },
    { id: 19, name: 'Sunshadow', pattern: 'sunshadow', url: 'https://en.ephoto360.com/sunlight-shadow-text-204.html', emoji: '☀️', isTwoText: false },
    { id: 20, name: 'Balloon', pattern: 'balloon', url: 'https://en.ephoto360.com/create-love-balloons-cards-334.html', emoji: '🎈', isTwoText: true },
    { id: 21, name: 'Firework', pattern: 'firework', url: 'https://en.ephoto360.com/vibrant-fireworks-text-effect-535.html', emoji: '🎆', isTwoText: false },
    { id: 22, name: 'Captain', pattern: 'captain', url: 'https://en.ephoto360.com/create-a-cinematic-captain-america-text-effect-online-715.html', emoji: '⭐', isTwoText: true },
    { id: 23, name: 'Blood', pattern: 'blood', url: 'https://textpro.me/blood-text-on-the-frosted-glass-941.html', emoji: '🩸', isTwoText: false },
    { id: 24, name: 'Glue', pattern: 'glue', url: 'https://textpro.me/create-3d-glue-text-effect-with-realistic-style-986.html', emoji: '🧴', isTwoText: false },
    { id: 25, name: 'Master', pattern: 'master', url: 'https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html', emoji: '🥋', isTwoText: false },
    { id: 26, name: '3D Gold', pattern: '3dgold', url: 'https://en.ephoto360.com/christmas-and-new-year-glittering-3d-golden-text-effect-794.html', emoji: '🥇', isTwoText: true },
    { id: 27, name: 'Pubg3', pattern: 'pubg3', url: 'https://en.ephoto360.com/pubg-logo-maker-cute-character-online-617.html', emoji: '🎯', isTwoText: false },
    { id: 28, name: 'Fireeffect', pattern: 'fireeffect', url: 'https://en.ephoto360.com/text-firework-effect-356.html', emoji: '🔥', isTwoText: false },
    { id: 29, name: 'Typography', pattern: 'typography', url: 'https://en.ephoto360.com/typography-maker-online-5-343.html', emoji: '✍️', isTwoText: false },
    { id: 30, name: 'Monkey', pattern: 'monkey', url: 'https://textpro.me/create-wolf-logo-black-white-937.html', emoji: '🐵', isTwoText: true },
    { id: 31, name: 'Horror', pattern: 'horror', url: 'https://textpro.me/create-a-cinematic-horror-text-effect-1045.html', emoji: '👻', isTwoText: false },
    { id: 32, name: 'Tiger', pattern: 'tiger', url: 'https://en.ephoto360.com/create-digital-tiger-logo-video-effect-723.html', emoji: '🐯', isTwoText: true },
    { id: 33, name: 'Heart', pattern: 'heart', url: 'https://en.ephoto360.com/text-heart-flashlight-188.html', emoji: '❤️', isTwoText: false },
    { id: 34, name: 'Sandsummer', pattern: 'sandsummer', url: 'https://en.ephoto360.com/write-in-sand-summer-beach-online-free-595.html', emoji: '🏖️', isTwoText: false },
    { id: 35, name: 'Leaves', pattern: 'leaves', url: 'https://textpro.me/natural-leaves-text-effect-931.html', emoji: '🍃', isTwoText: false },
    { id: 36, name: 'Flora', pattern: 'flora', url: 'https://en.ephoto360.com/general-fiora-lol-cover-43.html', emoji: '🌸', isTwoText: false },
    { id: 37, name: 'Fabric', pattern: 'fabric', url: 'https://textpro.me/fabric-text-effect-online-964.html', emoji: '🧵', isTwoText: false },
    { id: 38, name: 'Lighttext', pattern: 'lighttext', url: 'https://textpro.me/create-a-futuristic-technology-neon-light-text-effect-1006.html', emoji: '💡', isTwoText: false },
    { id: 39, name: 'Thunder2', pattern: 'thunder2', url: 'https://textpro.me/create-thunder-text-effect-online-881.html', emoji: '🌩️', isTwoText: false },
    { id: 40, name: 'Leaf', pattern: 'leaf', url: 'https://en.ephoto360.com/write-letters-on-the-leaves-248.html', emoji: '🌿', isTwoText: false }
];

/**
 * Parses user input for single or dual text effects
 */
function parseTextInputs(input, isTwoText, defaultSecond = 'MD') {
    const clean = (input || '').trim();
    if (!clean) return null;

    if (!isTwoText) {
        return [clean];
    }

    if (clean.includes(';') || clean.includes('|')) {
        const parts = clean.split(/[;|]/).map(s => s.trim()).filter(Boolean);
        return [parts[0] || 'Text1', parts[1] || parts[0] || defaultSecond];
    }

    const words = clean.split(/\s+/);
    if (words.length >= 2) {
        return [words[0], words.slice(1).join(' ')];
    }

    return [clean, defaultSecond];
}

/**
 * Shared handler function to execute effect generation
 */
async function handleEffectGeneration(conn, mek, from, reply, effect, rawInput) {
    const botName = config.BOT_NAME || 'Zypher MD';
    const texts = parseTextInputs(rawInput, effect.isTwoText, botName);

    if (!texts) {
        const usageExample = effect.isTwoText
            ? `.${effect.pattern} Text1;Text2  (or .${effect.pattern} Text1 Text2)`
            : `.${effect.pattern} Your Text`;
        return reply(`⚠️ *Please provide text for this effect!*\n\n*Example:* \`${usageExample}\``);
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const imageUrl = await createEffectImage(effect.url, texts);

        const caption = `*🎨 Effect:* ${effect.name} ${effect.emoji || ''}\n*📝 Text:* ${texts.join(' | ')}\n\n> © Powered by ${botName}`;

        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (err) {
        console.error(`[ImageMaker] Error generating "${effect.name}":`, err.message || err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ *Failed to generate image:* ${err.message || 'Server timeout, please try again.'}`);
    }
}

// ==================== 1. MAIN MENU COMMAND ====================
cmd({
    pattern: "npack",
    alias: ["textmaker", "imagemaker", "textmenu", "makermenu", "logomaker"],
    react: "🎨",
    desc: "Textmaker & Image Maker Plugin Menu",
    category: "textmaker",
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    const botName = config.BOT_NAME || 'Zypher MD';
    let menuText = '```' +
`╔════════════════
║  ➪𝑻𝑬𝑿𝑻 𝑴𝑨𝑲𝑬𝑹 𝑷𝑳𝑼𝑮𝑰𝑵☘︎
╚═══════════════
ꪶᴛᴇxᴛ ᴍᴀᴋᴇʀ ᴘʟᴜɢɪɴ 𝙱𝚈 ${botName}𖣘
╔════════════════
║
║ ༆𝗔𝗩𝗔𝗜𝗟𝗔𝗕𝗟𝗘 𝗢𝗣𝗧𝗜𝗢𝗡𝗦𖣘
╔════════════════\n`;

    EFFECTS.forEach((eff) => {
        const num = String(eff.id).padEnd(2, ' ');
        const extra = eff.isTwoText ? ' (2 text)' : '';
        menuText += `║ ${num})  ${eff.name}${extra}\n`;
    });

    menuText += `╚════════════════\n` + '```';
    menuText += `\n*📌 Usage:* \`.<command> <text>\`\n*📌 Example:* \`.thunder ${botName}\`\n*📌 2-Text Example:* \`.3dsilver Text1;Text2\`\n*📌 Or by Number:* \`.maker 1 ${botName}\`\n\n> © ${botName}`;

    await conn.sendMessage(from, { text: menuText }, { quoted: mek });
});

// ==================== 2. UNIFIED MAKER COMMAND ====================
cmd({
    pattern: "maker",
    alias: ["imaker", "tmaker"],
    react: "✨",
    desc: "Generate text effect by number or effect name",
    category: "textmaker",
    use: ".maker <effect_number_or_name> <text>",
    filename: __filename
}, async (conn, mek, m, { reply, q, args, from }) => {
    if (!args[0]) {
        return reply(`*🎨 Use:* \`.maker <number_or_name> <text>\`\n*Example:* \`.maker 1 ${config.BOT_NAME || 'Zypher MD'}\` or \`.maker thunder Hello\``);
    }

    const target = args[0].toLowerCase();
    const effect = EFFECTS.find(e => String(e.id) === target || e.pattern === target || e.name.toLowerCase() === target);

    if (!effect) {
        return reply(`❌ *Unknown effect "${args[0]}".* Type \`.npack\` to see all 40 available options!`);
    }

    const rawInput = args.slice(1).join(' ').trim();
    await handleEffectGeneration(conn, mek, from, reply, effect, rawInput);
});

// ==================== 3. INDIVIDUAL COMMANDS FOR ALL 40 EFFECTS ====================
for (const effect of EFFECTS) {
    const aliases = [];
    if (effect.pattern === 'captain') aliases.push('captainamerica');
    if (effect.pattern === 'pubg3') aliases.push('pubg');

    cmd({
        pattern: effect.pattern,
        alias: aliases,
        react: effect.emoji || "🎨",
        desc: `Generate ${effect.name} text effect image`,
        category: "textmaker",
        use: `.${effect.pattern} ${effect.isTwoText ? '<text1;text2>' : '<text>'}`,
        filename: __filename
    }, async (conn, mek, m, { reply, q, text, args, from }) => {
        const rawInput = (q || text || args.join(' ')).trim();
        await handleEffectGeneration(conn, mek, from, reply, effect, rawInput);
    });
}

