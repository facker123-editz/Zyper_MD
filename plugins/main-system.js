import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { rmSync, existsSync } from 'fs';
import { cmd } from '../command.js';
import { sleep } from '../lib/functions.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);

cmd({
    pattern: "update",
    alias: ["sync", "reboot", "restart"],
    react: "🚀",
    desc: "update the bot",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, {
    from, quoted, body, isCmd, command, args, q,
    isGroup, sender, senderNumber, botNumber2, botNumber,
    pushname, isMe, isOwner, isCreator, groupMetadata,
    groupName, participants, groupAdmins, isBotAdmins,
    isAdmins, reply
}) => {
    try {
        if (!isCreator) {
            return reply("🚫 *This command is only for the bot owner (creator).*");
        }

        // Send react immediately
        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });
        
        // Wait 1000ms
        await sleep(800);
        
        // Send update message and wait for it to complete
        const messageSent = await reply("*♻️ Updating and restarting the bot*...");
        
        // Wait for message to be delivered
        await sleep(800);
        
        // Remove plugins folder
        const pluginsPath = './plugins';
        if (existsSync(pluginsPath)) {
            try {
                rmSync(pluginsPath, { recursive: true, force: true });
                console.log('Plugins folder removed successfully');
            } catch (err) {
                console.error('Error removing plugins folder:', err);
            }
        }
        
        // Send ✅ react after message
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        
        // Wait 3000ms to ensure everything is sent
        await sleep(2000);
        
        // Execute restart
        exec("pm2 restart all");
        
    } catch (e) {
        console.log(e);
        reply(`${e}`);
    }
});
