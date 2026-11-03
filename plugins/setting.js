// plugins/settings.js - ESM Version
import { fileURLToPath } from 'url';
import { setPrefix } from '../lib/prefix.js';
import { cmd } from '../command.js';
import config from '../config.js';
import fs from 'fs';
import { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, sleep, fetchJson, lidToPhone, cleanPN } from '../lib/functions.js';
import path from 'path';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);

// Placeholder for soft reload function
async function reloadConfig() {
    console.log("Configuration reloaded without restart.");
}

// Helper function to convert target to proper format
async function getTargetJid(conn, target) {
    if (!target) return null;
    
    if (target.includes('@s.whatsapp.net')) return target;
    
    if (target.includes('@lid')) {
        const phoneNumber = await lidToPhone(conn, target);
        return phoneNumber + '@s.whatsapp.net';
    }
    
    return target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
}

// Helper function to extract number from JID
function extractNumber(jid) {
    if (!jid) return '';
    return jid.split('@')[0];
}

// Helper function to validate if target is a valid number
function isValidNumber(target) {
    if (!target) return false;
    const number = target.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '');
    return number.length >= 10;
}

// ==================== PREFIX COMMAND ====================
cmd({
    pattern: "setprefix",
    alias: ["prefix"],
    react: "🪄",
    desc: "Change the bot's command prefix.",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const newPrefix = args[0];
    if (!newPrefix) return reply("*❌ Provide new prefix. Example: .setprefix !*");
    
    if (newPrefix.length !== 1) {
        return reply("*❌ Prefix must be a single character!*");
    }
    
    const isEmoji = /[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u.test(newPrefix);
    
    if (isEmoji) {
        return reply("*❌ Emojis are not allowed as prefix!*");
    }

    setPrefix(newPrefix);
    config.PREFIX = newPrefix;
    process.env.PREFIX = newPrefix;
    
    await reloadConfig();

    return reply(`*✅ Prefix updated to: ${newPrefix}*\n\n*Example: ${newPrefix}menu*`);
});

// ==================== MODE COMMAND ====================
cmd({
    pattern: "mode",
    alias: ["setmode", "mod"],
    react: "✅",
    desc: "Set bot mode to private or public.",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const currentMode = config.MODE || "public";

    if (!args[0]) {
        return reply(`📌 Current mode: *${currentMode}*\n\nUsage: .mode private OR .mode public`);
    }

    const modeArg = args[0].toLowerCase();

    if (["private", "public"].includes(modeArg)) {
        config.MODE = modeArg;
        process.env.MODE = modeArg;
        await reloadConfig();
        await reply(`✅ Bot mode is now set to *${modeArg.toUpperCase()}*.`);
    } else {
        return reply("❌ Invalid mode. Please use `.mode private` or `.mode public`.");
    }
});

// ==================== BOT IMAGE COMMAND ====================

cmd({
    pattern: "botdp",
    alias: ["setbotimage", "botpic", "botimage"],
    desc: "Set the bot's image URL",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply, from, quoted }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let imageUrl = args[0];

        // ImgBB API Key
        const IMGBB_API_KEY = '18794cfaf8958832a1166f3eae1e9a8c';

        // If no URL provided but replied to an image
        if (!imageUrl && m.quoted) {
            const quotedMsg = m.quoted;
            const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
            
            if (!mimeType || !mimeType.startsWith("image")) {
                return reply("❌ Please reply to an image.");
            }

            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            const mediaBuffer = await quotedMsg.download();

            // Upload to ImgBB
            const form = new FormData();
            form.append('key', IMGBB_API_KEY);
            form.append('image', mediaBuffer.toString('base64'));
            form.append('name', 'botdp');

            const response = await axios.post("https://api.imgbb.com/1/upload", form, {
                headers: form.getHeaders(),
                timeout: 60000
            });

            imageUrl = response.data?.data?.url;

            if (!imageUrl) {
                throw new Error("ImgBB upload failed - no URL returned");
            }

            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

        // If URL provided directly
        if (!imageUrl || !imageUrl.startsWith("http")) {
            return reply("❌ Provide a valid image URL or reply to an image.");
        }

        // Update config
        config.BOT_MEDIA_URL = imageUrl;
        process.env.BOT_MEDIA_URL = imageUrl;

        // Send success message with the image
        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: `✅ *Bot Image Updated Successfully!*\n\n📁 *New URL:* ${imageUrl}\n\n> © Updated by JawadTechX 💜`
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${err.message || err}`);
    }
});


// ==================== SET BOT NAME ====================
cmd({
    pattern: "botname",
    alias: ["setbotname"],
    desc: "Set the bot's name",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("❗ Only the bot owner can use this command.");
    
    const newName = args.join(" ").trim();
    if (!newName) return reply("❌ Provide a bot name.");

    config.BOT_NAME = newName;
    process.env.BOT_NAME = newName;

    await reply(`✅ Bot name updated to: *${newName}*`);
});

// ==================== SET OWNER NAME ====================
cmd({
    pattern: "ownername",
    alias: ["setownername"],
    desc: "Set the owner's name",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("❗ Only the bot owner can use this command.");
    
    const name = args.join(" ").trim();
    if (!name) return reply("❌ Provide an owner name.");

    config.OWNER_NAME = name;
    process.env.OWNER_NAME = name;

    await reply(`✅ Owner name updated to: *${name}*`);
});

// ==================== SET OWNER NUMBER ====================
cmd({
    pattern: "setowner",
    desc: "Set the bot owner number",
    category: "setting",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let target = m.mentionedJid?.[0] || (m.quoted?.sender ?? null);

        if (!target && args[0]) {
            const cleanedNumber = args[0].replace(/[^0-9]/g, '');
            if (cleanedNumber && cleanedNumber.length >= 10) {
                target = cleanedNumber + "@s.whatsapp.net";
            }
        }

        if (!target || !isValidNumber(target)) {
            return reply("⚠️ Please provide a valid number!\n\n*Usage:* `.setowner @user` or `.setowner 923427582273` or reply to a message");
        }

        target = await getTargetJid(conn, target);
        if (!target) return reply("❌ Invalid target format.");

        const ownerNumber = extractNumber(target);

        config.OWNER_NUMBER = ownerNumber;
        process.env.OWNER_NUMBER = ownerNumber;

        await reply(`✅ *Owner number updated to:* ${ownerNumber}`);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

// ==================== SET BOT DESCRIPTION ====================
cmd({
    pattern: "description",
    alias: ["setdesc", "botdesc"],
    react: "📝",
    desc: "Set the bot's description message",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

        const newDescription = args.join(' ').trim();
        if (!newDescription) {
            return reply(`❌ *Please provide a description*\n\n*Example:* .description ⚡ Powered by JawadTechX\n\n*Current:* ${config.DESCRIPTION || 'Not set'}`);
        }

        config.DESCRIPTION = newDescription;
        process.env.DESCRIPTION = newDescription;

        await reply(`✅ *Bot description updated successfully!*\n\n*New Description:*\n${newDescription}`);
    } catch (error) {
        console.error('Error in setdescription command:', error);
        reply(`❌ Error: ${error.message}`);
    }
});

// ==================== REJECT MESSAGE ====================
cmd({
    pattern: "rejectmsg",
    alias: ["setrejectmsg"],
    desc: "Set anti-call reject message",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("❗ Only the bot owner can use this command.");
    
    const message = args.join(" ").trim();
    if (!message) return reply("❌ Provide a reject message.");

    config.REJECT_MSG = message;
    process.env.REJECT_MSG = message;

    await reply(`✅ Reject message updated to: *${message}*`);
});

// ==================== ANTI-DELETE PATH ====================
cmd({
    pattern: "delpath",
    alias: ["antideletepath", "deletepath"],
    react: "🗑️",
    desc: "Set where to send deleted messages (inbox/same)",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

        const path = args[0]?.toLowerCase();
        
        if (path === "inbox") {
            config.ANTI_DELETE_PATH = "inbox";
            process.env.ANTI_DELETE_PATH = "inbox";
            await reply("🗑️ *Anti-delete path set to INBOX*\n_Deleted messages will be sent to your inbox_");
        } 
        else if (path === "same") {
            config.ANTI_DELETE_PATH = "same";
            process.env.ANTI_DELETE_PATH = "same";
            await reply("🗑️ *Anti-delete path set to SAME*\n_Deleted messages will be sent to the same chat_");
        } 
        else {
            const current = config.ANTI_DELETE_PATH || "inbox";
            await reply(`*🗑️ Anti-delete Path*\n\n*Current:* ${current}\n\n*Options:*\n• inbox - Send to your inbox\n• same - Send to same chat\n\n*Example:* .delpath inbox`);
        }
    } catch (error) {
        return reply(`*Error:* ${error.message}`);
    }
});

// ==================== ANTI-EDIT PATH ====================
cmd({
    pattern: "editpath",
    alias: ["antieditpath", "editpath"],
    react: "✏️",
    desc: "Set where to send edited messages (inbox/same)",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

        const path = args[0]?.toLowerCase();
        
        if (path === "inbox") {
            config.ANTIEDIT_PATH = "inbox";
            process.env.ANTIEDIT_PATH = "inbox";
            await reply("✏️ *Anti-edit path set to INBOX*\n_Edited messages will be sent to your inbox_");
        } 
        else if (path === "same") {
            config.ANTIEDIT_PATH = "same";
            process.env.ANTIEDIT_PATH = "same";
            await reply("✏️ *Anti-edit path set to SAME*\n_Edited messages will be sent to the same chat_");
        } 
        else {
            const current = config.ANTIEDIT_PATH || "inbox";
            await reply(`*✏️ Anti-edit Path*\n\n*Current:* ${current}\n\n*Options:*\n• inbox - Send to your inbox\n• same - Send to same chat\n\n*Example:* .editpath inbox`);
        }
    } catch (error) {
        return reply(`*Error:* ${error.message}`);
    }
});

// ==================== BAN COMMANDS ====================

cmd({
    pattern: "ban",
    alias: ["block"],
    desc: "Ban a user from using the bot",
    category: "setting",
    react: "🔨",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply, botNumber2, sender }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let target = m.mentionedJid?.[0] || (m.quoted?.sender ?? null);

        if (!target && args[0]) {
            const cleanedNumber = args[0].replace(/[^0-9]/g, '');
            if (cleanedNumber && cleanedNumber.length >= 10) {
                target = cleanedNumber + "@s.whatsapp.net";
            }
        }

        if (!target || !isValidNumber(target)) {
            return reply("⚠️ Please provide a target to ban!\n\n*Usage:* `.ban @user` or `.ban 92342758****` or reply to a message");
        }

        target = await getTargetJid(conn, target);
        if (!target) return reply("❌ Invalid target format.");

        if (target === conn.user.id.split(':')[0] + '@s.whatsapp.net' || target === botNumber2) 
            return reply("🤖 I can't ban myself!");
        
        if (target.includes(extractNumber(config.OWNER_NUMBER))) {
            return reply("👑 Cannot ban the owner!");
        }

        let bannedList = Array.isArray(config.BANNED) ? [...config.BANNED] : [];

        if (bannedList.includes(target)) {
            return reply("❌ This user is already banned!");
        }

        bannedList.push(target);
        config.BANNED = bannedList;
        process.env.BANNED = bannedList.join(',');

        await reply(`✅ *Banned Successfully*`);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

cmd({
    pattern: "unban",
    alias: ["unblock"],
    desc: "Unban a user from using the bot",
    category: "setting",
    react: "🔓",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let target = m.mentionedJid?.[0] || (m.quoted?.sender ?? null);

        if (!target && args[0]) {
            const cleanedNumber = args[0].replace(/[^0-9]/g, '');
            if (cleanedNumber && cleanedNumber.length >= 10) {
                target = cleanedNumber + "@s.whatsapp.net";
            }
        }

        if (!target || !isValidNumber(target)) {
            return reply("⚠️ Please provide a target to unban!\n\n*Usage:* `.unban @user` or `.unban 92342758****` or reply to a message");
        }

        target = await getTargetJid(conn, target);
        if (!target) return reply("❌ Invalid target format.");

        let bannedList = Array.isArray(config.BANNED) ? [...config.BANNED] : [];

        if (!bannedList.includes(target)) {
            return reply("❌ This user is not banned!");
        }

        bannedList = bannedList.filter(user => user !== target);
        config.BANNED = bannedList;
        process.env.BANNED = bannedList.join(',');

        await reply(`✅ *Unbanned Successfully*`);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

cmd({
    pattern: "banlist",
    alias: ["banned", "blocklist"],
    desc: "Show list of banned users",
    category: "setting",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let bannedList = Array.isArray(config.BANNED) ? config.BANNED.filter(s => s && s.length > 0) : [];

        if (bannedList.length === 0) {
            return reply("📋 *No banned users found.*");
        }

        let bannedText = "╭─〔 🚫 *BANNED USERS* 〕\n";
        bannedList.forEach((user, index) => {
            const number = extractNumber(user);
            bannedText += `├─ ${index + 1}. ${number}\n`;
        });
        bannedText += "╰─────────────────";

        await reply(bannedText);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

// ==================== SUDO COMMANDS ====================

cmd({
    pattern: "addsudo",
    alias: ["sudo"],
    desc: "Add a user to sudo list",
    category: "setting",
    react: "➕",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, botNumber2, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let target = m.mentionedJid?.[0] || (m.quoted?.sender ?? null);

        if (!target && args[0]) {
            const cleanedNumber = args[0].replace(/[^0-9]/g, '');
            if (cleanedNumber && cleanedNumber.length >= 10) {
                target = cleanedNumber + "@s.whatsapp.net";
            }
        }

        if (!target || !isValidNumber(target)) {
            return reply("⚠️ Please provide a target to add as sudo!\n\n*Usage:* `.addsudo @user` or `.addsudo 92342758****` or reply to a message");
        }

        target = await getTargetJid(conn, target);
        if (!target) return reply("❌ Invalid target format.");

        if (target === conn.user.id.split(':')[0] + '@s.whatsapp.net' || target === botNumber2) 
            return reply("🤖 Bot is already sudo!");
        
        if (target.includes(extractNumber(config.OWNER_NUMBER))) {
            return reply("👑 Owner already has sudo privileges!");
        }

        let sudoList = Array.isArray(config.SUDO) ? [...config.SUDO] : [];

        if (sudoList.includes(target)) {
            return reply("❌ This user is already in sudo list!");
        }

        sudoList.push(target);
        config.SUDO = sudoList;
        process.env.SUDO = sudoList.join(',');

        await reply(`✅ *Sudo Added Successfully*`);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

cmd({
    pattern: "delsudo",
    alias: ["removesudo", "rmsudo"],
    desc: "Remove a user from sudo list",
    category: "setting",
    react: "➖",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let target = m.mentionedJid?.[0] || (m.quoted?.sender ?? null);

        if (!target && args[0]) {
            const cleanedNumber = args[0].replace(/[^0-9]/g, '');
            if (cleanedNumber && cleanedNumber.length >= 10) {
                target = cleanedNumber + "@s.whatsapp.net";
            }
        }

        if (!target || !isValidNumber(target)) {
            return reply("⚠️ Please provide a target to remove from sudo!\n\n*Usage:* `.delsudo @user` or `.delsudo 92342758****` or reply to a message");
        }

        target = await getTargetJid(conn, target);
        if (!target) return reply("❌ Invalid target format.");

        if (target.includes(extractNumber(config.OWNER_NUMBER))) {
            return reply("👑 Cannot remove the owner from sudo!");
        }

        let sudoList = Array.isArray(config.SUDO) ? [...config.SUDO] : [];

        if (!sudoList.includes(target)) {
            return reply("❌ This user is not in sudo list!");
        }

        sudoList = sudoList.filter(user => user !== target);
        config.SUDO = sudoList;
        process.env.SUDO = sudoList.join(',');

        await reply(`✅ *Sudo Deleted Successfully*`);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

cmd({
    pattern: "sudolist",
    alias: ["sudoers", "sudoerslist"],
    desc: "Show list of sudo users",
    category: "setting",
    react: "📋",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let sudoList = Array.isArray(config.SUDO) ? config.SUDO.filter(s => s && s.length > 0) : [];

        const ownerNumber = extractNumber(config.OWNER_NUMBER);

        let sudoText = "╭─〔 👑 *SUDO USERS* 〕\n";
        sudoText += `├─ *Owner:* ${ownerNumber}\n`;
        
        if (sudoList.length === 0) {
            sudoText += "├─ *No additional sudo users*\n";
        } else {
            sudoList.forEach((user, index) => {
                const number = extractNumber(user);
                sudoText += `├─ ${index + 1}. ${number}\n`;
            });
        }
        sudoText += "╰─────────────────";

        await reply(sudoText);

    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

// ==================== ANTI-CALL ====================
cmd({
    pattern: "anti-call",
    react: "🫟",
    alias: ["anticall"],
    desc: "Enable or disable anti-call feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ANTI_CALL = "true";
        process.env.ANTI_CALL = "true";
        await reloadConfig();
        return reply("*✅ Anti-call has been enabled*");
    } else if (status === "off") {
        config.ANTI_CALL = "false";
        process.env.ANTI_CALL = "false";
        await reloadConfig();
        return reply("*❌ Anti-call has been disabled*");
    } else {
        return reply(`*Example: anti-call on/off*`);
    }
});

// ==================== MENTION REPLY ====================
cmd({
    pattern: "mentionreply",
    alias: ["mention"],
    desc: "Enable or disable mention reply feature",
    react: "🔗",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.MENTION_REPLY = "true";
        process.env.MENTION_REPLY = "true";
        return reply("Mention Reply feature is now enabled.");
    } else if (status === "off") {
        config.MENTION_REPLY = "false";
        process.env.MENTION_REPLY = "false";
        return reply("Mention Reply feature is now disabled.");
    } else {
        return reply(`_example: .mention on_`);
    }
});

// ==================== ANTI-DELETE ====================
cmd({
    pattern: "antidelete",
    alias: ["ad", "anti-delete", "antidel"],
    react: "🗑️",
    desc: "Enable/Disable anti-delete feature to show deleted messages",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the bot owner can use this command!*");

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.ANTI_DELETE = "true";
        process.env.ANTI_DELETE = "true";
        return reply("🗑️ *Anti-delete is now ENABLED*");
    } else if (status === "off") {
        config.ANTI_DELETE = "false";
        process.env.ANTI_DELETE = "false";
        return reply("🗑️ *Anti-delete is now DISABLED*");
    } else {
        return reply(`*🗑️ Anti-delete Command*\n\n• *on* - Enable\n• *off* - Disable\n\n*Example:* .antidelete on`);
    }
});

// ==================== ANTI-EDIT ====================
cmd({
    pattern: "antiedit",
    react: "✏️",
    alias: ["anti-edit", "anti-edit-message"],
    desc: "Enable or disable anti-edit feature\nModes: on/off",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Only the owner can use this command!*");

        if (args[0] === "on") {
            config.ANTI_EDIT = "true";
            process.env.ANTI_EDIT = "true";
            await reply("✏️ *Anti-edit feature is now ENABLED*");
        } 
        else if (args[0] === "off") {
            config.ANTI_EDIT = "false";
            process.env.ANTI_EDIT = "false";
            await reply("✏️ *Anti-edit feature is now DISABLED*");
        } 
        else {
            await reply(`*Invalid input! Use:*\n\n• *on* - Enable\n• *off* - Disable\n\n*Example:* .antiedit on`);
        }
    } catch (error) {
        return reply(`*Error:* ${error.message}`);
    }
});

// ==================== ANTI-LINK ====================
cmd({
    pattern: "antilink",
    alias: ["anti-link"],
    desc: "Enable or disable anti-link feature in groups",
    category: "setting",
    react: "🔗",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Only the owner can use this command!*");

        const option = args[0]?.toLowerCase();

        if (option === "on") {
            config.ANTI_LINK = "true";
            process.env.ANTI_LINK = "true";
            await reply("🔗 *Anti-link is now ENABLED* (Remove Mode)");
        } else if (option === "off") {
            config.ANTI_LINK = "false";
            process.env.ANTI_LINK = "false";
            await reply("🔗 *Anti-link is now DISABLED*");
        } else if (option === "delete") {
            config.ANTI_LINK = "delete";
            process.env.ANTI_LINK = "delete";
            await reply("🗑️ *Anti-link set to DELETE mode*");
        } else if (option === "warn") {
            config.ANTI_LINK = "warn";
            process.env.ANTI_LINK = "warn";
            await reply("⚠️ *Anti-link set to WARN mode*");
        } else {
            const current = config.ANTI_LINK || "false";
            let statusText = current === "true" ? "ON (Delete)" : 
                            current === "false" ? "OFF" : 
                            current.toUpperCase();
            await reply(`*🔗 Anti-link Status: ${statusText}*\n\n*Options:*\n• on - Enable (delete)\n• off - Disable\n• delete - Delete links\n• warn - Warn only\n\n*Example:* .antilink on`);
        }
    } catch (error) {
        return reply(`*Error:* ${error.message}`);
    }
});

// ==================== WELCOME SETTINGS COMMAND (No Image URL) ====================
cmd({
    pattern: "setwelcome",
    alias: ["welcomemsg", "setwelcomemsg"],
    desc: "Set welcome message\n\n*Placeholders:*\n• @user - Mention new member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply, text }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        if (text && text.trim()) {
            config.WELCOME_MESSAGE = text.trim();
            process.env.WELCOME_MESSAGE = text.trim();
            
            await reply(`✅ Welcome message updated!\n\n*New Message:*\n${text.trim()}\n\n*Placeholders:*\n• @user - Mention new member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time`);
        } else {
            await reply(`*Current Welcome Message:*\n${config.WELCOME_MESSAGE || 'Default message'}\n\n*Status:* ${config.WELCOME === "true" ? '✅ Enabled' : '❌ Disabled'}\n\n*To update:*\n.sendwelcome your message here\n\n*Placeholders:*\n• @user - Mention new member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time`);
        }
    } catch (err) {
        console.error(err);
        reply(`❌ Error: ${err.message || err}`);
    }
});

// ==================== GOODBYE SETTINGS COMMAND (No Image URL) ====================
cmd({
    pattern: "setgoodbye",
    alias: ["goodbyemsg", "setgoodbyemsg"],
    desc: "Set goodbye message\n\n*Placeholders:*\n• @user - Mention leaving member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time",
    category: "setting",
    react: "✅",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply, text }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        if (text && text.trim()) {
            config.GOODBYE_MESSAGE = text.trim();
            process.env.GOODBYE_MESSAGE = text.trim();
            
            await reply(`✅ Goodbye message updated!\n\n*New Message:*\n${text.trim()}\n\n*Placeholders:*\n• @user - Mention leaving member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time`);
        } else {
            await reply(`*Current Goodbye Message:*\n${config.GOODBYE_MESSAGE || 'Default message'}\n\n*Status:* ${config.GOODBYE === "true" ? '✅ Enabled' : '❌ Disabled'}\n\n*To update:*\n.sendgoodbye your message here\n\n*Placeholders:*\n• @user - Mention leaving member\n• @group - Group name\n• @desc - Group description\n• @count - Total members\n• @bot - Bot name\n• @time - Current time`);
        }
    } catch (err) {
        console.error(err);
        reply(`❌ Error: ${err.message || err}`);
    }
});

// ==================== WELCOME ON/OFF COMMAND ====================
cmd({
    pattern: "welcome",
    alias: ["welcomeswitch"],
    react: "✅",
    desc: "Enable or disable welcome messages for new members",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.WELCOME = "true";
        process.env.WELCOME = "true";
        return reply("✅ Welcome messages are now enabled.");
    } else if (status === "off") {
        config.WELCOME = "false";
        process.env.WELCOME = "false";
        return reply("❌ Welcome messages are now disabled.");
    } else {
        return reply(`*Usage:* .welcome on/off\n*Current Status:* ${config.WELCOME === "true" ? '✅ Enabled' : '❌ Disabled'}\n\n*Example:* .welcome on`);
    }
});

// ==================== GOODBYE ON/OFF COMMAND ====================
cmd({
    pattern: "goodbye",
    alias: ["goodbyeswitch"],
    react: "✅",
    desc: "Enable or disable goodbye messages for leaving members",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.GOODBYE = "true";
        process.env.GOODBYE = "true";
        return reply("✅ Goodbye messages are now enabled.");
    } else if (status === "off") {
        config.GOODBYE = "false";
        process.env.GOODBYE = "false";
        return reply("❌ Goodbye messages are now disabled.");
    } else {
        return reply(`*Usage:* .goodbye on/off\n*Current Status:* ${config.GOODBYE === "true" ? '✅ Enabled' : '❌ Disabled'}\n\n*Example:* .goodbye on`);
    }
});

// ==================== AUTO-REACT ====================
cmd({
    pattern: "autoreact",
    alias: ["auto-react"],
    react: "🫟",
    desc: "Enable or disable the autoreact feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_REACT = "true";
        process.env.AUTO_REACT = "true";
        await reply("✅ *Auto-react is now ENABLED*");
    } else if (status === "off") {
        config.AUTO_REACT = "false";
        process.env.AUTO_REACT = "false";
        await reply("❌ *Auto-react is now DISABLED*");
    } else {
        await reply(`*Example: .autoreact on*`);
    }
});

// ==================== AUTO-STATUS-VIEW ====================
cmd({
    pattern: "statusview",
    desc: "Enable or disable auto-viewing of statuses",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STATUS_SEEN = "true";
        process.env.AUTO_STATUS_SEEN = "true";
        return reply("✅ *Auto-status-view is now ENABLED*");
    } else if (status === "off") {
        config.AUTO_STATUS_SEEN = "false";
        process.env.AUTO_STATUS_SEEN = "false";
        return reply("❌ *Auto-status-view is now DISABLED*");
    } else {
        return reply(`Example: .statusview on`);
    }
});

// ==================== READ MESSAGE ====================
cmd({
    pattern: "autoread",
    desc: "Enable or disable read message feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.READ_MESSAGE = "true";
        process.env.READ_MESSAGE = "true";
        return reply("✅ *Read message feature is now ENABLED*");
    } else if (status === "off") {
        config.READ_MESSAGE = "false";
        process.env.READ_MESSAGE = "false";
        return reply("❌ *Read message feature is now DISABLED*");
    } else {
        return reply(`_example: .autoread on_`);
    }
});

// ==================== ALWAYS ONLINE ====================
cmd({
    pattern: "alwaysonline",
    alias: ["online", "always-online"],
    react: "🟢",
    desc: "Enable always online presence for the bot",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.ALWAYS_ONLINE = "true";
        process.env.ALWAYS_ONLINE = "true";
        return reply("🟢 *Always online is now ENABLED*");
    } else if (status === "off") {
        config.ALWAYS_ONLINE = "false";
        process.env.ALWAYS_ONLINE = "false";
        return reply("🟢 *Always online is now DISABLED*");
    } else {
        return reply(`*Example:* .alwaysonline on`);
    }
});

// ==================== AUTO-TYPING ====================
cmd({
    pattern: "autotyping",
    alias: ["auto-typing", "typing"],
    react: "⌨️",
    desc: "Enable auto-typing presence for the bot",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.AUTO_TYPING = "true";
        process.env.AUTO_TYPING = "true";
        return reply("⌨️ *Auto-typing is now ENABLED for both inbox and groups*");
    } else if (status === "ib") {
        config.AUTO_TYPING = "inbox";
        process.env.AUTO_TYPING = "inbox";
        return reply("⌨️ *Auto-typing is now ENABLED for inbox only*");
    } else if (status === "gc") {
        config.AUTO_TYPING = "group";
        process.env.AUTO_TYPING = "group";
        return reply("⌨️ *Auto-typing is now ENABLED for groups only*");
    } else if (status === "off") {
        config.AUTO_TYPING = "false";
        process.env.AUTO_TYPING = "false";
        return reply("⌨️ *Auto-typing is now DISABLED*");
    } else {
        return reply(`*⌨️ Auto-typing Command*\n\n• *on* - Enable for both\n• *ib* - Enable for inbox only\n• *gc* - Enable for groups only\n• *off* - Disable\n\n*Example:* .autotyping on`);
    }
});

// ==================== AUTO RECORDING ====================
cmd({
    pattern: "autorecording",
    alias: ["recording", "auto-recording"],
    react: "🎙️",
    desc: "Enable auto-recording presence for the bot",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.AUTO_RECORDING = "true";
        process.env.AUTO_RECORDING = "true";
        return reply("🎙️ *Auto-recording is now ENABLED for both inbox and groups*");
    } else if (status === "ib") {
        config.AUTO_RECORDING = "inbox";
        process.env.AUTO_RECORDING = "inbox";
        return reply("🎙️ *Auto-recording is now ENABLED for inbox only*");
    } else if (status === "gc") {
        config.AUTO_RECORDING = "group";
        process.env.AUTO_RECORDING = "group";
        return reply("🎙️ *Auto-recording is now ENABLED for groups only*");
    } else if (status === "off") {
        config.AUTO_RECORDING = "false";
        process.env.AUTO_RECORDING = "false";
        return reply("🎙️ *Auto-recording is now DISABLED*");
    } else {
        return reply(`*🎙️ Auto-recording Command*\n\n• *on* - Enable for both\n• *ib* - Enable for inbox only\n• *gc* - Enable for groups only\n• *off* - Disable\n\n*Example:* .autorecording on`);
    }
});

// ==================== AUTO-DOWNLOADER ====================
cmd({
    pattern: "autodl",
    alias: ["downloader", "auto-downloader"],
    react: "📥",
    desc: "Enable/disable auto-downloader feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    
    if (status === "on") {
        config.AUTO_DOWNLOADER = "true";
        process.env.AUTO_DOWNLOADER = "true";
        return reply("📥 *Auto-downloader is now ENABLED for both inbox and groups*");
    } else if (status === "ib") {
        config.AUTO_DOWNLOADER = "inbox";
        process.env.AUTO_DOWNLOADER = "inbox";
        return reply("📥 *Auto-downloader is now ENABLED for inbox only*");
    } else if (status === "gc") {
        config.AUTO_DOWNLOADER = "group";
        process.env.AUTO_DOWNLOADER = "group";
        return reply("📥 *Auto-downloader is now ENABLED for groups only*");
    } else if (status === "owner") {
        config.AUTO_DOWNLOADER = "owner";
        process.env.AUTO_DOWNLOADER = "owner";
        return reply("📥 *Auto-downloader is now ENABLED for owner only*");
    } else if (status === "off") {
        config.AUTO_DOWNLOADER = "false";
        process.env.AUTO_DOWNLOADER = "false";
        return reply("📥 *Auto-downloader is now DISABLED*");
    } else {
        return reply(`*📥 Auto-downloader Command*\n\n• *on* - Enable for both\n• *ib* - Enable for inbox only\n• *gc* - Enable for groups only\n• *owner* - Enable for owner only\n• *off* - Disable\n\n*Example:* .autodl on`);
    }
});

// ==================== AUTO-STICKER ====================
cmd({
    pattern: "autosticker",
    alias: ["auto-sticker"],
    react: "🫟",
    desc: "Enable or disable auto-sticker feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_STICKER = "true";
        process.env.AUTO_STICKER = "true";
        return reply("✅ *Auto-sticker is now ENABLED*");
    } else if (status === "off") {
        config.AUTO_STICKER = "false";
        process.env.AUTO_STICKER = "false";
        return reply("❌ *Auto-sticker is now DISABLED*");
    } else {
        return reply(`_example: .autosticker on_`);
    }
});

// ==================== AUTO-REPLY ====================
cmd({
    pattern: "autoreply",
    alias: ["auto-reply"],
    react: "🫟",
    desc: "Enable or disable auto-reply feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.AUTO_REPLY = "true";
        process.env.AUTO_REPLY = "true";
        return reply("✅ *Auto-reply is now ENABLED*");
    } else if (status === "off") {
        config.AUTO_REPLY = "false";
        process.env.AUTO_REPLY = "false";
        return reply("❌ *Auto-reply is now DISABLED*");
    } else {
        return reply(`*Example: .autoreply on*`);
    }
});

// ==================== ADMIN EVENTS ====================
cmd({
    pattern: "adminaction",
    alias: ["adminevent"],
    desc: "Enable or disable admin event notifications",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ADMIN_ACTION = "true";
        process.env.ADMIN_ACTION = "true";
        return reply("✅ *Admin event notifications are now ENABLED*");
    } else if (status === "off") {
        config.ADMIN_ACTION = "false";
        process.env.ADMIN_ACTION = "false";
        return reply("❌ *Admin event notifications are now DISABLED*");
    } else {
        return reply(`Example: .adminaction on`);
    }
});

// ==================== OWNER REACT ====================
cmd({
    pattern: "ownerreact",
    alias: ["owner-react", "selfreact", "self-react"],
    react: "👑",
    desc: "Enable or disable the owner react feature",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    if (!isCreator) return reply("*📛 Only the owner can use this command!*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.OWNER_REACT = "true";
        process.env.OWNER_REACT = "true";
        await reply("👑 *Owner react is now ENABLED*");
    } else if (status === "off") {
        config.OWNER_REACT = "false";
        process.env.OWNER_REACT = "false";
        await reply("👑 *Owner react is now DISABLED*");
    } else {
        await reply(`*Example: .ownerreact on*`);
    }
});



// ==================== SET REACTION EMOJIS ====================
cmd({
    pattern: "reactemojis",
    alias: ["setemojis", "setreaction", "reacts"],
    react: "🔥",
    desc: "Set emojis for auto message reactions (max 50)\nExample: .reacts 🚫,🙃,😂,🥺",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Owner only!*");

        const input = args.join(' ').trim();
        if (!input) {
            const currentEmojis = Array.isArray(config.REACT_EMOJIS) 
                ? config.REACT_EMOJIS.join(', ') 
                : "❤️, 🔥, 👍, 😍, 😂, 😮, 😎, 🥰";
            return reply(`❌ *Example:* .reacts 🚫,🙃,😂,🥺\n\n*Current:* ${currentEmojis}`);
        }

        if (!input.includes(',')) {
            return reply('❌ *Use commas to separate emojis*\n*Example:* .reacts 🚫,🙃,😂,🥺');
        }
        
        const emojis = input.split(',').map(e => e.trim()).filter(e => e.length > 0);
        
        if (emojis.length === 0) return reply('❌ *No valid emojis provided*');
        if (emojis.length > 50) return reply('❌ *Maximum 50 emojis allowed*');

        config.REACT_EMOJIS = emojis;
        process.env.REACT_EMOJIS = emojis.join(',');

        await reply(`✅ *Reaction emojis set!*\n\n${emojis.join(' ')}\n\n*Total: ${emojis.length} emojis*`);
        
    } catch (error) {
        await reply(`❌ Error: ${error.message}`);
    }
});

// ==================== SET OWNER EMOJIS ====================
cmd({
    pattern: "owneremoji",
    react: "👑",
    desc: "Set emojis for owner reactions (max 50)\nExample: .owneremoji 👑,💎,🤖,⚡,🚫",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { args, isCreator, reply }) => {
    try {
        if (!isCreator) return reply("*📛 Owner only!*");

        const input = args.join(' ').trim();
        if (!input) {
            const currentEmojis = Array.isArray(config.OWNER_EMOJIS) 
                ? config.OWNER_EMOJIS.join(', ') 
                : "👑, 💎, ⭐, ✨, 🔥, 💯";
            return reply(`❌ *Example:* .owneremoji 👑,💎,🤖,⚡,🚫\n\n*Current:* ${currentEmojis}`);
        }

        if (!input.includes(',')) {
            return reply('❌ *Use commas to separate emojis*\n*Example:* .owneremoji 👑,💎,🤖,⚡,🚫');
        }
        
        const emojis = input.split(',').map(e => e.trim()).filter(e => e.length > 0);
        
        if (emojis.length === 0) return reply('❌ *No valid emojis provided*');
        if (emojis.length > 50) return reply('❌ *Maximum 50 emojis allowed*');

        config.OWNER_EMOJIS = emojis;
        process.env.OWNER_EMOJIS = emojis.join(',');

        await reply(`✅ *Owner emojis set!*\n\n${emojis.join(' ')}\n\n*Total: ${emojis.length} emojis*`);
        
    } catch (error) {
        await reply(`❌ Error: ${error.message}`);
    }
});

// ==================== HELP/SETTINGS GUIDE ====================
cmd({
    pattern: "setting",
    alias: ["settings", "help", "config", "env"],
    react: "📚",
    desc: "Show how to enable/disable bot settings",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        let guideText = `╭─〔 📚 *SETTINGS GUIDE* 〕\n`;
        guideText += `├─ *How To Manage The Settings*\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 🤖 *BOT CORE* 〕\n`;
        guideText += `├─ *Set Prefix:* .setprefix .\n`;
        guideText += `├─ *Set Mode:* .mode public / .mode private\n`;
        guideText += `├─ *Set Bot Name:* .botname KHAN-MD\n`;
        guideText += `├─ *Set Owner Name:* .ownername JawadTech\n`;
        guideText += `├─ *Set Owner Number:* .setowner 923427582273\n`;
        guideText += `├─ *Set Bot Image:* .botdp (reply to image)\n`;
        guideText += `├─ *Set Description:* .description Text\n`;
        guideText += `├─ *Status Msg:* .statusmsg Text\n`;
        guideText += `├─ *Reject Msg:* .rejectmsg Text\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 🛡️ *ANTI FEATURES* 〕\n`;
        guideText += `├─ *Anti-Call:* .anti-call on / off\n`;
        guideText += `├─ *Anti-Delete:* .antidelete on / off\n`;
        guideText += `├─ *Anti-Edit:* .antiedit on / off\n`;
        guideText += `├─ *Anti-Link:* .antilink on / off / delete / warn\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 🚫 *BAN/SUDO* 〕\n`;
        guideText += `├─ *Ban User:* .ban @user\n`;
        guideText += `├─ *Unban User:* .unban @user\n`;
        guideText += `├─ *Ban List:* .banlist\n`;
        guideText += `├─ *Add Sudo:* .addsudo @user\n`;
        guideText += `├─ *Del Sudo:* .delsudo @user\n`;
        guideText += `├─ *Sudo List:* .sudolist\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 👋 *WELCOME* 〕\n`;
        guideText += `├─ *Welcome:* .welcome on / off\n`;
        guideText += `├─ *Set Welcome Msg:* .setwelcome your message\n`;
        guideText += `├─ *Goodbye:* .goodbye on / off\n`;
        guideText += `├─ *Set Goodbye Msg:* .setgoodbye your message\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 😊 *REACTIONS* 〕\n`;
        guideText += `├─ *Auto React:* .autoreact on / off\n`;
        guideText += `├─ *Owner React:* .ownerreact on / off\n`;
        guideText += `├─ *Status View:* .statusview on / off\n`;
        guideText += `├─ *Mention Reply:* .mentionreply on / off\n`;
        guideText += `├─ *Set React Emojis:* .reactemojis ❤️,🔥,👍\n`;
        guideText += `├─ *Set Owner Emojis:* .owneremoji 👑,💎,🤖\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 📱 *PRESENCE* 〕\n`;
        guideText += `├─ *Always Online:* .alwaysonline on / off\n`;
        guideText += `├─ *Auto Typing:* .autotyping on / ib / gc / off\n`;
        guideText += `├─ *Auto Recording:* .autorecording on / ib / gc / off\n`;
        guideText += `├─ *Read Message:* .autoread on / off\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 📥 *AUTO FEATURES* 〕\n`;
        guideText += `├─ *Auto Downloader:* .autodl on / ib / gc / owner / off\n`;
        guideText += `├─ *Auto Sticker:* .autosticker on / off\n`;
        guideText += `├─ *Auto Reply:* .autoreply on / off\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `╭─〔 👑 *ADMIN* 〕\n`;
        guideText += `├─ *Admin Events:* .adminaction on / off\n`;
        guideText += `╰─────────────────\n\n`;

        guideText += `> ${config.DESCRIPTION || 'KHAN-MD'}`;

        await reply(guideText);
    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});

// ==================== ENV LIST ====================
cmd({
    pattern: "envlist",
    alias: ["showconfig", "configlist"],
    react: "📋",
    desc: "Show all current bot configuration values",
    category: "setting",
    filename: __filename
}, async (conn, mek, m, { isCreator, reply }) => {
    try {
        if (!isCreator) return reply("❗ Only the bot owner can use this command.");

        const formatValue = (val) => {
            if (val === undefined || val === null) return 'Not Set';
            if (Array.isArray(val)) {
                if (val.length === 0) return 'None';
                return val.map(v => {
                    if (typeof v === 'string' && v.includes('@s.whatsapp.net')) return v.split('@')[0];
                    return v;
                }).join(', ');
            }
            return val;
        };

        let envText = `╭─〔 📋 *CURRENT CONFIGURATION* 〕\n`;
        envText += `├─ *Bot Name:* ${config.BOT_NAME || 'KHAN-MD'}\n`;
        envText += `├─ *Owner:* ${config.OWNER_NAME || 'JawadTech'}\n`;
        envText += `├─ *Owner Number:* ${config.OWNER_NUMBER || 'Not Set'}\n`;
        envText += `├─ *Prefix:* ${config.PREFIX || '.'}\n`;
        envText += `├─ *Mode:* ${config.MODE || 'private'}\n`;
        envText += `├─ *Version:* ${config.VERSION || '10.0 Beta'}\n`;
        envText += `├─ *Description:* ${config.DESCRIPTION || 'Not Set'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 🛡️ *ANTI FEATURES* 〕\n`;
        envText += `├─ *ANTI_CALL:* ${config.ANTI_CALL || 'false'}\n`;
        envText += `├─ *ANTI_DELETE:* ${config.ANTI_DELETE || 'true'}\n`;
        envText += `├─ *ANTI_EDIT:* ${config.ANTI_EDIT || 'false'}\n`;
        envText += `├─ *ANTI_LINK:* ${config.ANTI_LINK || 'false'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 🚫 *BAN/SUDO* 〕\n`;
        envText += `├─ *Banned:* ${formatValue(config.BANNED)}\n`;
        envText += `├─ *Sudo:* ${formatValue(config.SUDO)}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 👋 *WELCOME* 〕\n`;
        envText += `├─ *WELCOME:* ${config.WELCOME || 'false'}\n`;
        envText += `├─ *WELCOME_MESSAGE:* ${config.WELCOME_MESSAGE || 'Default'}\n`;
        envText += `├─ *GOODBYE:* ${config.GOODBYE || 'false'}\n`;
        envText += `├─ *GOODBYE_MESSAGE:* ${config.GOODBYE_MESSAGE || 'Default'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 😊 *REACTIONS* 〕\n`;
        envText += `├─ *AUTO_REACT:* ${config.AUTO_REACT || 'false'}\n`;
        envText += `├─ *OWNER_REACT:* ${config.OWNER_REACT || 'false'}\n`;
        envText += `├─ *AUTO_LIKE_STATUS:* ${config.AUTO_LIKE_STATUS || 'false'}\n`;
        envText += `├─ *AUTO_STATUS_REPLY:* ${config.AUTO_STATUS_REPLY || 'false'}\n`;
        envText += `├─ *AUTO_STATUS_SEEN:* ${config.AUTO_STATUS_SEEN || 'true'}\n`;
        envText += `├─ *MENTION_REPLY:* ${config.MENTION_REPLY || 'false'}\n`;
        envText += `├─ *STATUS_LIKE_EMOJIS:* ${formatValue(config.STATUS_LIKE_EMOJIS)}\n`;
        envText += `├─ *REACT_EMOJIS:* ${formatValue(config.REACT_EMOJIS)}\n`;
        envText += `├─ *OWNER_EMOJIS:* ${formatValue(config.OWNER_EMOJIS)}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 📱 *PRESENCE* 〕\n`;
        envText += `├─ *ALWAYS_ONLINE:* ${config.ALWAYS_ONLINE || 'false'}\n`;
        envText += `├─ *AUTO_TYPING:* ${config.AUTO_TYPING || 'false'}\n`;
        envText += `├─ *AUTO_RECORDING:* ${config.AUTO_RECORDING || 'false'}\n`;
        envText += `├─ *READ_MESSAGE:* ${config.READ_MESSAGE || 'false'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 📥 *AUTO FEATURES* 〕\n`;
        envText += `├─ *AUTO_DOWNLOADER:* ${config.AUTO_DOWNLOADER || 'false'}\n`;
        envText += `├─ *AUTO_STICKER:* ${config.AUTO_STICKER || 'false'}\n`;
        envText += `├─ *AUTO_REPLY:* ${config.AUTO_REPLY || 'false'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 👑 *ADMIN* 〕\n`;
        envText += `├─ *ADMIN_ACTION:* ${config.ADMIN_ACTION || 'false'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `╭─〔 📝 *MESSAGES* 〕\n`;
        envText += `├─ *AUTO_STATUS_MSG:* ${config.AUTO_STATUS_MSG || 'Not Set'}\n`;
        envText += `├─ *REJECT_MSG:* ${config.REJECT_MSG || 'Not Set'}\n`;
        envText += `╰─────────────────\n\n`;

        envText += `> Use .setting to see how to change these values`;

        await reply(envText);
    } catch (error) {
        console.error(error);
        reply(`❌ Error: ${error.message}`);
    }
});
