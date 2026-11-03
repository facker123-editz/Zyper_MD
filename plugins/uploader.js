import { fileURLToPath } from 'url';
import { cmd } from '../command.js';
import axios from 'axios';
import FormData from 'form-data';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ImgBB API Key (free, working)
const IMGBB_API_KEY = '18794cfaf8958832a1166f3eae1e9a8c';

cmd({
  pattern: "url",
  alias: ["imgtourl", "imgurl", "tourl", "geturl", "upload"],
  react: '🖇',
  desc: "Upload image to ImgBB and get URL",
  category: "utility",
  use: ".tourl [reply to image]",
  filename: __filename
}, async (conn, mek, m, { from, reply, quoted }) => {
  try {
    const quotedMsg = m.quoted || m;
    const mimeType = (quotedMsg.msg || quotedMsg).mimetype || '';
    
    if (!mimeType || !mimeType.includes('image')) {
      return reply("❌ Please reply to an image");
    }

    await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

    const mediaBuffer = await quotedMsg.download();

    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', mediaBuffer.toString('base64'));
    form.append('name', 'jawadmd');  // ✅ Just "jawadtech" - no timestamp

    const response = await axios.post("https://api.imgbb.com/1/upload", form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    const imageUrl = response.data?.data?.url;

    if (!imageUrl) throw "Upload failed";

    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    // Simple response
    await reply(`✅ *Image Successfully Uploaded*\n\n- ${imageUrl}`);

  } catch (error) {
    console.error("Tourl error:", error);
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
    await reply(`❌ Error: ${error.message || error}`);
  }
});
      
