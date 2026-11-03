// plugins/pinterest.js - ESM Version
import { fileURLToPath } from 'url';
import { cmd } from '../command.js';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);

cmd({
    pattern: "img",
    alias: ["image", "pinterest", "searchimg"],
    react: "🦋",
    desc: "Search images from Pinterest",
    category: "fun",
    use: ".img <keywords>",
    filename: __filename
}, async (conn, mek, m, { reply, args, from }) => {
    try {
        const query = args.join(" ");
        if (!query) {
            return reply("🖼️ Please provide a search query\nExample: .img Imran Khan");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const url = `https://api.nexray.eu.cc/search/pinterest?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url);

        if (!response.data?.status || !response.data.result?.length) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ No images found. Try different keywords");
        }

        const results = response.data.result;
        const selectedImages = results
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);

        for (const imageUrl of selectedImages) {
            if (imageUrl.images_url) {
                await conn.sendMessage(
                    from,
                    { 
                        image: { url: imageUrl.images_url },
                        caption: `📷 Result for: ${query}\n> © Powered by JawadTechX`
                    },
                    { quoted: mek }
                );
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (error) {
        console.error('Pinterest Search Error:', error);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error: ${error.message || "Failed to fetch images"}`);
    }
});
