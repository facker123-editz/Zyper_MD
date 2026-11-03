// plugins/repo.js - ESM Version
import { fileURLToPath } from 'url';
import path from 'path';
import config from '../config.js';
import { cmd } from '../command.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to validate media URL and determine type
const getMediaType = (url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return null;
    }
    
    const urlLower = url.toLowerCase();
    
    // Check image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (imageExtensions.some(ext => urlLower.endsWith(ext))) {
        return 'image';
    }
    
    // Check video extensions
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.gif'];
    if (videoExtensions.some(ext => urlLower.endsWith(ext))) {
        return 'video';
    }
    
    return null;
};

cmd({
    pattern: "repo",
    alias: ["sc", "script", "repository"],
    desc: "Fetch information about a GitHub repository.",
    react: "📂",
    category: "main",
    filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
    const githubRepoURL = config.REPO || 'https://github.com/JawadYT36/KHAN-MD';

    try {
        // Show typing presence before processing
        await conn.sendPresenceUpdate('composing', from);
        
        // Extract username and repo name from the URL
        const [, username, repoName] = githubRepoURL.match(/github\.com\/([^/]+)\/([^/]+)/);

        // Fetch repository details using GitHub API with axios
        const response = await axios.get(`https://api.github.com/repos/${username}/${repoName}`);
        
        const repoData = response.data;

        // Get pair link from config
        const pairLink = config.WEBPAIR || 'https://khanmd-pairx.onrender.com';
        
        // Format the repository information in new stylish format
        const formattedInfo = `
╭─〔 *KHAN-MD REPOSITORY* 〕
│
├─ *📌 Repository Name:* ${repoData.name}
├─ *👑 Owner:* ${username}
├─ *⭐ Stars:* ${repoData.stargazers_count}
├─ *⑂ Forks:* ${repoData.forks_count}
├─ *📝 Description:* ${repoData.description || 'World Best WhatsApp Bot powered by KHAN-MD'}
│
├─ *🔗 GitHub Link:*
│   ${repoData.html_url}
│
├─ *🤖 Pair Link:*
│   ${pairLink}
│
╰─ *⚡ Powered by KHAN-MD*
`.trim();

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

        // Send an image with the formatted info as a caption using config.BOT_MEDIA_URL
        await conn.sendMessage(from, {
            ...mediaData,
            caption: formattedInfo,
            contextInfo: { 
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.NEWSLETTERID || '120363426563532140@newsletter',
                    newsletterName: config.BOT_NAME || 'KHAN-MD',
                    serverMessageId: 143
                }
            }
        }, { quoted: mek });

    } catch (error) {
        console.error("Error in repo command:", error);
        reply("❌ Sorry, something went wrong while fetching the repository information. Please try again later.");
    }
});
