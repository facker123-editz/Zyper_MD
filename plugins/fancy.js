// plugins/font.js - ESM Version
import { fileURLToPath } from 'url';
import { cmd } from '../command.js';
import { allFonts, convertText } from '../lib/fonts.js';

const __filename = fileURLToPath(import.meta.url);

// Main font command - shows all fonts with numbering
cmd({
  pattern: "font",
  alias: ["fancy", "stylish", "textstyle"],
  react: "✍️",
  desc: "Convert text into all available fancy fonts",
  category: "tools",
  use: ".font <text>",
  filename: __filename
}, async (conn, m, store, { from, q, reply }) => {
  try {
    if (!q) {
      return reply(`✍️ Use .fancy to convert your text into stylish font`);
    }

    let resultText = `✨ *Fancy Fonts Converter* ✨\n\n`;
    
    let count = 0;
    for (let i = 0; i < allFonts.length; i++) {
      const converted = convertText(q, allFonts[i]);
      if (converted !== q) {
        count++;
        resultText += `${count}. ${converted}\n`;
      }
    }
    
    resultText += `\n\n> *Powered by JawadTechX*`;

    // Split into multiple messages if too long (WhatsApp limit ~64k chars)
    if (resultText.length > 64000) {
      const chunks = resultText.match(/[\s\S]{1,64000}/g) || [];
      for (const chunk of chunks) {
        await conn.sendMessage(from, { text: chunk }, { quoted: m });
      }
    } else {
      await conn.sendMessage(from, { text: resultText }, { quoted: m });
    }

  } catch (error) {
    console.error("❌ Error in font command:", error);
    reply("⚠️ An error occurred while converting fonts. Please try again.");
  }
});
