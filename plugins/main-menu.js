// plugins/menu.js - ESM Version
import { fileURLToPath } from 'url';
import path from 'path';
import config from '../config.js';
import { cmd, commands } from '../command.js';
import { runtime } from '../lib/functions.js';
import axios from 'axios';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function for small caps text
const toSmallCaps = (text) => {
    if (!text || typeof text !== 'string') return '';
    const smallCapsMap = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
        'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
        's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
        'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ',
        'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ',
        'S': 's', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
    };
    return text.split('').map(char => smallCapsMap[char] || char).join('');
};

// Format category with your exact styles
const formatCategory = (category, cmds) => {
    const validCmds = cmds.filter(cmd => cmd.pattern && cmd.pattern.trim() !== '');
    if (validCmds.length === 0) return '';
    
    let title = `\n\`『 ${category.toUpperCase()} 』\`\n╭───────────────────⊷\n`;
    let body = validCmds.map(cmd => {
        const commandName = cmd.pattern || '';
        return `*┋ ⬡ ${toSmallCaps(commandName)}*`;
    }).join('\n');
    let footer = `\n╰───────────────────⊷`;
    return `${title}${body}${footer}`;
};

// Format menu options with same font style as category
const formatMenuOptions = (categories) => {
    let menuOptions = '';
    let optionNumber = 1;
    
    categories.forEach(cat => {
        const displayName = toSmallCaps(cat.charAt(0).toUpperCase() + cat.slice(1));
        const menuText = toSmallCaps(' Menu');
        menuOptions += `*┋ ⬡ ${optionNumber} ${displayName}${menuText}*\n`;
        optionNumber++;
    });
    
    return menuOptions;
};

const commonContextInfo = (sender) => ({
    mentionedJid: [sender],
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
        newsletterName: config.BOT_NAME,
        serverMessageId: 143
    }
});

// Function to validate media URL and determine type
const getMediaType = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    const urlLower = url.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (imageExtensions.some(ext => urlLower.endsWith(ext))) return 'image';
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.gif'];
    if (videoExtensions.some(ext => urlLower.endsWith(ext))) return 'video';
    return null;
};

// Get all categories and organize them - SORTED ALPHABETICALLY
const getCategorizedCommands = () => {
    const commandsArray = Array.isArray(commands) ? commands : Object.values(commands);
    let totalCommands = commandsArray.length;
    const categories = [...new Set(commandsArray.map(c => c.category))].filter(cat => 
        cat && cat.trim() !== '' && cat !== 'undefined'
    );
    
    // Sort categories alphabetically (A to Z)
    const sortedCategories = categories.sort((a, b) => a.localeCompare(b));
    
    const categorized = {};
    sortedCategories.forEach(cat => {
        const categoryCommands = commandsArray.filter(c => c.category === cat);
        const validCommands = categoryCommands.filter(cmd => cmd.pattern && cmd.pattern.trim() !== '');
        if (validCommands.length > 0) categorized[cat] = validCommands;
    });
    return { categorized, totalCommands };
};

// ===============================
// COMMAND 1: menu (Interactive Selection)
// ===============================
cmd({
    pattern: "menu",
    alias: ["m", "help"],
    desc: "Show all bot commands in selection menu",
    category: "main",
    react: "⚡",
    filename: __filename
},
async (conn, mek, m, { from, sender, pushname, reply }) => {
    try {
        await conn.sendPresenceUpdate('composing', from);
        
        const { categorized, totalCommands } = getCategorizedCommands();
        const availableCategories = Object.keys(categorized);
        const menuOptions = formatMenuOptions(availableCategories);

        const caption = `*╭┈───〔 ${config.BOT_NAME} 〕┈───⊷*
*├▢ Owner:* ${config.OWNER_NAME}
*├▢ Prefix:* ${config.PREFIX}
*├▢ Version:* ${config.VERSION}
*├▢ Plugins:* ${totalCommands}
*├▢ Runtime:* ${runtime(process.uptime())}
*╰───────────────────⊷*
*╭───⬡ SELECT MENU ⬡───*
${menuOptions}*╰───────────────────⊷*

> *ʀᴇᴘʟʏ ᴡɪᴛʜ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴛᴏ sᴇʟᴇᴄᴛ ᴍᴇɴᴜ (1-${availableCategories.length})*`;

        let mainMenuMedia;
        const localImagePath = path.join(__dirname, '../lib/khanmd.jpg');
        const mediaType = getMediaType(config.BOT_MEDIA_URL);
        
        if (mediaType === 'image' || mediaType === 'video') {
            try {
                await axios.head(config.BOT_MEDIA_URL, { timeout: 3000 });
                mainMenuMedia = { [mediaType]: { url: config.BOT_MEDIA_URL } };
            } catch (serverError) {
                console.log('Media server down, using local image');
                mainMenuMedia = { image: { url: localImagePath } };
            }
        } else {
            mainMenuMedia = { image: { url: localImagePath } };
        }

        const sentMsg = await conn.sendMessage(from, {
            ...mainMenuMedia,
            caption: caption,
            contextInfo: commonContextInfo(sender)
        }, { quoted: mek });

        const messageID = sentMsg.key.id;
        
        // Create listener function
        const menuListener = async (msgData) => {
            const receivedMsg = msgData.messages[0];
            if (!receivedMsg.message) return;

            const receivedText = receivedMsg.message.conversation || receivedMsg.message.extendedTextMessage?.text;
            const senderID = receivedMsg.key.remoteJid;
            const isReplyToBot = receivedMsg.message.extendedTextMessage?.contextInfo?.stanzaId === messageID;

            if (isReplyToBot) {
                // Close event immediately
                conn.ev.off("messages.upsert", menuListener);
                
                await conn.sendMessage(senderID, { react: { text: '⬇️', key: receivedMsg.key } });

                const selectedNumber = parseInt(receivedText);
                if (selectedNumber >= 1 && selectedNumber <= availableCategories.length) {
                    const selectedCategory = availableCategories[selectedNumber - 1];
                    const categoryCommands = categorized[selectedCategory];
                    const displayName = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);
                    
                    const categorySection = formatCategory(selectedCategory, categoryCommands);
                    
                    let categoryMenu = `*╭┈───〔 ${displayName} Menu 〕┈───⊷*\n`;
                    categoryMenu += `*├▢ 📜 Category:* ${selectedCategory}\n`;
                    categoryMenu += `*├▢ 🔢 Total Commands:* ${categoryCommands.length}\n`;
                    categoryMenu += `*╰───────────────────⊷*`;
                    categoryMenu += `${categorySection}\n\n`;
                    categoryMenu += `> *ᴜsᴇ ${config.PREFIX}ᴍᴇɴᴜ ᴛᴏ sᴇᴇ ᴀʟʟ ᴍᴇɴᴜs ᴀɢᴀɪɴ*`;

                    let categoryMedia;
                    const categoryMediaType = getMediaType(config.BOT_MEDIA_URL);
                    
                    if (categoryMediaType === 'image' || categoryMediaType === 'video') {
                        try {
                            await axios.head(config.BOT_MEDIA_URL, { timeout: 3000 });
                            categoryMedia = { [categoryMediaType]: { url: config.BOT_MEDIA_URL } };
                        } catch (serverError) {
                            categoryMedia = { image: { url: localImagePath } };
                        }
                    } else {
                        categoryMedia = { image: { url: localImagePath } };
                    }

                    await conn.sendMessage(senderID, {
                        ...categoryMedia,
                        caption: categoryMenu,
                        contextInfo: commonContextInfo(receivedMsg.key.participant || receivedMsg.key.remoteJid)
                    }, { quoted: receivedMsg });
                } else {
                    await conn.sendMessage(senderID, {
                        text: `❌ *Invalid selection! Please reply with a valid number (1-${availableCategories.length}).*`,
                        contextInfo: commonContextInfo(receivedMsg.key.participant || receivedMsg.key.remoteJid)
                    }, { quoted: receivedMsg });
                }
            }
        };
        
        // Add listener
        conn.ev.on("messages.upsert", menuListener);
        
        // Auto cleanup after 15 seconds if no selection
        setTimeout(() => {
            conn.ev.off("messages.upsert", menuListener);
            console.log('🧹 Menu listener cleaned up (timeout)');
        }, 20000);

    } catch (e) {
        console.error(e);
        reply(`❌ Error:\n${e.message}`);
    }
});

// ===============================
// COMMAND 2: menu2 (Full Menu - All Commands)
// ===============================
cmd({
    pattern: "menu2",
    alias: ["allmenu", "fullmenu"],
    use: '.menu2',
    desc: "Show all bot commands",
    category: "main",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, sender, reply }) => {
    try {
        // Show typing presence before processing
        await conn.sendPresenceUpdate('composing', from);
        
        // Convert commands object to array if needed
        const commandsArray = Array.isArray(commands) ? commands : Object.values(commands);
        let totalCommands = commandsArray.length;
        
        // Get all unique categories and filter out undefined/null categories
        const categories = [...new Set(commandsArray.map(c => c.category))].filter(cat => 
            cat && cat.trim() !== '' && cat !== 'undefined'
        );
        
        // Sort categories alphabetically (A to Z)
        const sortedCategories = categories.sort((a, b) => a.localeCompare(b));
        
        // Organize commands by category and filter out empty categories
        const categorized = {};
        sortedCategories.forEach(cat => {
            const categoryCommands = commandsArray.filter(c => c.category === cat);
            // Only add category if it has valid commands
            const validCommands = categoryCommands.filter(cmd => cmd.pattern && cmd.pattern.trim() !== '');
            if (validCommands.length > 0) {
                categorized[cat] = validCommands;
            }
        });

        // Build menu sections - sorted alphabetically
        let menuSections = '';
        for (const [category, cmds] of Object.entries(categorized)) {
            if (cmds && cmds.length > 0) {
                const section = formatCategory(category, cmds);
                if (section !== '') {
                    menuSections += section;
                }
            }
        }

        // Main menu text with new bar styles
        let dec = `*╭┈───〔 ${config.BOT_NAME} 〕┈───⊷*
*├✦ Owner:* ${config.OWNER_NAME}
*├✦ Commands:* ${totalCommands}
*├✦ Runtime:* ${runtime(process.uptime())}
*├✦ Prefix:* ${config.PREFIX}
*├✦ Mode:* ${config.MODE}
*├✦ Version:* ${config.VERSION}
*╰───────────────────⊷*
${menuSections}

> ${config.DESCRIPTION || ''}`;

        // Determine which media to use
        let mediaData;
        const localImagePath = path.join(__dirname, '../lib/khanmd.jpg');
        
        // First check if config has valid media URL
        const mediaType = getMediaType(config.BOT_MEDIA_URL);
        
        if (mediaType === 'image' || mediaType === 'video') {
            try {
                // Check if server is accessible (timeout after 3 seconds)
                await axios.head(config.BOT_MEDIA_URL, { timeout: 3000 });
                // Server is up, use the URL media
                mediaData = { 
                    [mediaType]: { url: config.BOT_MEDIA_URL } 
                };
            } catch (serverError) {
                // Server is down or inaccessible, use local image
                console.log('Media server down, using local image:', serverError.message);
                mediaData = { image: { url: localImagePath } };
            }
        } else {
            // Invalid media URL format, use local image
            mediaData = { image: { url: localImagePath } };
        }

        await conn.sendMessage(from, { 
            ...mediaData,
            caption: dec, 
            contextInfo: { 
                mentionedJid: [sender], 
                forwardingScore: 999, 
                isForwarded: true, 
                forwardedNewsletterMessageInfo: { 
                    newsletterJid: config.NEWSLETTERID || '120363333617104318@newsletter', 
                    newsletterName: config.BOT_NAME, 
                    serverMessageId: 143 
                } 
            } 
        }, { quoted: m });

    } catch (e) { 
        console.log(e); 
        reply(`Error: ${e.message}`); 
    } 
});