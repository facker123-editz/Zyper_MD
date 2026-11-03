// config.js - ESM Version
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (fs.existsSync(path.resolve('config.env'))) {
  dotenv.config({ path: path.resolve('config.env') });
}

// Helper to convert "true"/"false" strings to actual boolean
function convertToBool(text, trueValue = 'true') {
  return text === trueValue;
}

export default {
  // ===== BOT CORE SETTINGS =====
  SESSION_ID: process.env.SESSION_ID || "IK~eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiMERRaTNDbHllMHV2SjljNVorY1dXYzIydUFPSGpPNFZDS0M5ajJ4MFhGUT0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiNXJpcGpVL3BsSFQ4OUhONmo5NTk0aTRrNlY0ODhuNWNiM3hsYkV3cDNBcz0ifX0sInBhaXJpbmdFcGhlbWVyYWxLZXlQYWlyIjp7InByaXZhdGUiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiI0SkhMZXNkeDhHMkdYeWhIci9MSEgwZG5uZ2NCZEdQVFFJR3B5SW00TFV3PSJ9LCJwdWJsaWMiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJhQXNMeTNwdXN5TDd2TDNVMlBnWHkxdWg5cUFpeDBKcVhNYlVhQ1lwUDBVPSJ9fSwic2lnbmVkSWRlbnRpdHlLZXkiOnsicHJpdmF0ZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6ImtGeldhNTBudkZXcmVuMHF2aUJiT3dCc2hhTnpnWFNRVzQzZStlZUJUMmc9In0sInB1YmxpYyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IjVqSUVza1Z5Wk8va0NVblFDc3Jqc2JsVnpSSDJGaE9hMVd2aFRQeTkzVjQ9In19LCJzaWduZWRQcmVLZXkiOnsia2V5UGFpciI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoib0hXeHcra08rU2RCd1QreUJJWG9qV0wyRFlBM2FOWThqL2dnMUsrc0NHdz0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiS0hYRURyd0xFK0NBWEpkZmswWWR4T2RPeVR6eXgxSUNUa214eHZITVVVVT0ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IjdiblBLQ043ZC9xd2NqeDFUVmFZYk9NVjdRTGZEZ2p5ZG1Hc1RsdEx2L1lBNGRLSGRLR3J2TzZZZlF1eWx2UGRxK3JPNUdURHFiNmVRcXk0U3hQM2lBPT0ifSwia2V5SWQiOjF9LCJyZWdpc3RyYXRpb25JZCI6MTg3LCJhZHZTZWNyZXRLZXkiOiJWL09jQjUvbHZmQ2tPWDNsd1NmVjhqcUVNZ3VaT1JnNWFvampicVE1eTVNPSIsInByb2Nlc3NlZEhpc3RvcnlNZXNzYWdlcyI6W3sia2V5Ijp7InJlbW90ZUppZCI6IjI0NDAyNjI4NjA5NzBAbGlkIiwiZnJvbU1lIjp0cnVlLCJpZCI6IkE1NzNFQTIwQjkyNEExMjBCMjBFNzM5NTAzMEU0NjI0IiwicGFydGljaXBhbnQiOiIiLCJhZGRyZXNzaW5nTW9kZSI6ImxpZCJ9LCJtZXNzYWdlVGltZXN0YW1wIjoxNzkzMTcyNzQ3fSx7ImtleSI6eyJyZW1vdGVKaWQiOiIyNDQwMjYyODYwOTcwQGxpZCIsImZyb21NZSI6dHJ1ZSwiaWQiOiJBNUE5QUIxRDE4N0IxNkE3OTFEMzYyODgwOTYzMzQyNyIsInBhcnRpY2lwYW50IjoiIiwiYWRkcmVzc2luZ01vZGUiOiJsaWQifSwibWVzc2FnZVRpbWVzdGFtcCI6MTc5MzE3Mjc0N30seyJrZXkiOnsicmVtb3RlSmlkIjoiMjQ0MDI2Mjg2MDk3MEBsaWQiLCJmcm9tTWUiOnRydWUsImlkIjoiQTVFODEwNDY3ODFGMDBDOEZCMkJGRjExOUE3MEEwRkUiLCJwYXJ0aWNpcGFudCI6IiIsImFkZHJlc3NpbmdNb2RlIjoibGlkIn0sIm1lc3NhZ2VUaW1lc3RhbXAiOjE3OTMxNzI3NDd9LHsia2V5Ijp7InJlbW90ZUppZCI6IjI0NDAyNjI4NjA5NzBAbGlkIiwiZnJvbU1lIjp0cnVlLCJpZCI6IkE1NENFRUE0QjdFRDM5Q0U0N0RFNDRBRjBBOUEwN0M2IiwicGFydGljaXBhbnQiOiIiLCJhZGRyZXNzaW5nTW9kZSI6ImxpZCJ9LCJtZXNzYWdlVGltZXN0YW1wIjoxNzkzMTcyNzQ3fSx7ImtleSI6eyJyZW1vdGVKaWQiOiIyNDQwMjYyODYwOTcwQGxpZCIsImZyb21NZSI6dHJ1ZSwiaWQiOiJBNTU3RDIzQzU0Nzc3N0M3MkI3NzVDQzk3ODIwMjkzMCIsInBhcnRpY2lwYW50IjoiIiwiYWRkcmVzc2luZ01vZGUiOiJsaWQifSwibWVzc2FnZVRpbWVzdGFtcCI6MTc5MzE3Mjc1MX1dLCJuZXh0UHJlS2V5SWQiOjgxMywiZmlyc3RVbnVwbG9hZGVkUHJlS2V5SWQiOjgxMywiYWNjb3VudFN5bmNDb3VudGVyIjoxLCJhY2NvdW50U2V0dGluZ3MiOnsidW5hcmNoaXZlQ2hhdHMiOmZhbHNlfSwicmVnaXN0ZXJlZCI6dHJ1ZSwicGFpcmluZ0NvZGUiOiJRN0hYMlQ1WiIsIm1lIjp7ImlkIjoiOTQ3ODgxMDgwOTA6MkBzLndoYXRzYXBwLm5ldCIsIm5hbWUiOiJ6eXBoZXIgbWQiLCJsaWQiOiIyNDQwMjYyODYwOTcwOjJAbGlkIn0sImFjY291bnQiOnsiZGV0YWlscyI6IkNQQ2V1S2dHRVBySmh0Y0dHQUlnQUNnQSIsImFjY291bnRTaWduYXR1cmVLZXkiOiJLdXFjQ2xodGRtOUIzMlRVQWdVZm9PeTBpVms3TnpSYkFyWmVLaE8xY2pnPSIsImFjY291bnRTaWduYXR1cmUiOiJvUVhaMUpXQTdac3I2NUxoTFRlN1BxWlhNemREakhGR3lnR05qZXdEQVFtSmsyTnhwNGJJdGl6bGZaZXVCY1RnQkxuci8wVENzMHI5bWdMWUJsSnJEdz09IiwiZGV2aWNlU2lnbmF0dXJlIjoiTGhqMWthKzUvYWhjWEtIZG9jNDA2QmdXU1dMSFhGUU9tNnBjeUlSOGcrck9ML2M1RU1Ua0pLZVIwV1RPelA0MENlWml4Ly9pbXo2eG5YUVV6b2FVaWc9PSJ9LCJzaWduYWxJZGVudGl0aWVzIjpbeyJpZGVudGlmaWVyIjp7Im5hbWUiOiIyNDQwMjYyODYwOTcwOjJAbGlkIiwiZGV2aWNlSWQiOjB9LCJpZGVudGlmaWVyS2V5Ijp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiQlNycW5BcFliWFp2UWQ5azFBSUZINkRzdElsWk96YzBXd0syWGlvVHRYSTQifX1dLCJwbGF0Zm9ybSI6InNtYmEiLCJyb3V0aW5nSW5mbyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkNBVUlFZ2dOIn0sImxhc3RBY2NvdW50U3luY1RpbWVzdGFtcCI6MTc5MzE3Mjc0NCwibGFzdFByb3BIYXNoIjoiNFk1d2trIiwibXlBcHBTdGF0ZUtleUlkIjoiQUFBQUFQNmEifQ==",
  PREFIX: process.env.PREFIX || ".",
  CHATBOT: process.env.CHATBOT || "on",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ",
  BOT_NAME: process.env.BOT_NAME || "Zypher MD",
  MODE: process.env.MODE || "public",
  REPO: process.env.REPO || "https://github.com/JawadTechYT/KHAN-MD",
  WEBPAIR: process.env.WEBPAIR || "https://khanmd-pairx.onrender.com",
  NEWSLETTERID: process.env.NEWSLETTERID || "120363426563532140@newsletter",

  // ===== OWNER & DEVELOPER SETTINGS =====
  OWNER_NUMBER: process.env.OWNER_NUMBER || "94788108090",
  OWNER_NAME: process.env.OWNER_NAME || "Shenura Nimnada",
  SPECIAL_LOVED_NUMBER: process.env.SPECIAL_LOVED_NUMBER || "94761329544",
  SPECIAL_LOVED_LID: process.env.SPECIAL_LOVED_LID || "251358833864754",
  SPECIAL_LOVED_NAME: process.env.SPECIAL_LOVED_NAME || "Divya (දිව්‍යා / දිව්)",
  SUDO: process.env.SUDO
    ? process.env.SUDO.split(',').map(s => s.trim())
    : ["123@lid"],
  BANNED: process.env.BANNED
    ? process.env.BANNED.split(',').map(s => s.trim())
    : [],
  STATUS_LIKE_EMOJIS: process.env.STATUS_LIKE_EMOJIS
    ? process.env.STATUS_LIKE_EMOJIS.split(',').map(e => e.trim())
    : ["❤️", "🔥", "👍", "😍", "💯"],
  REACT_EMOJIS: process.env.REACT_EMOJIS
    ? process.env.REACT_EMOJIS.split(',').map(e => e.trim())
    : ["❤️", "🔥", "👍", "😍", "😂", "😮", "😎", "🥰", "👋", "🤝", "💯", "✨", "⭐", "🎉", "🤗", "😊", "🙌", "💪", "👏", "✅", "🎈", "🎊", "🏆", "⚡", "💫", "👌", "🤙", "💖", "💕", "💗", "👑", "💎", "🌟", "🎯", "🎨", "🎭", "🎪", "🎢", "🎡", "🎠"],
  OWNER_EMOJIS: process.env.OWNER_EMOJIS
    ? process.env.OWNER_EMOJIS.split(',').map(e => e.trim())
    : ["👑", "💎", "⭐", "✨", "🔥", "💯", "✅", "🎉", "🤖", "⚡", "💫", "🌟", "🏆", "👾", "🚀", "💪", "🎯", "🔱", "♾️", "⚜️"],
  LINK_WARNINGS: process.env.LINK_WARNINGS
    ? process.env.LINK_WARNINGS.split(',').map(s => s.trim()).filter(s => s)
    : [],

  // ===== HEROKU SETTINGS =====
  HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
  HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || "",

  // ===== AUTO-RESPONSE SETTINGS =====
  AUTO_REPLY: process.env.AUTO_REPLY || "true",
  AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY || "false",
  AUTO_STATUS_MSG: process.env.AUTO_STATUS_MSG || "*Zypher MD VIEWED YOUR STATUS 🤖*",
  READ_MESSAGE: process.env.READ_MESSAGE || "false",
  REJECT_MSG: process.env.REJECT_MSG || "*📞 ᴄαℓℓ ɴσт αℓℓσωє∂ ιɴ тнιѕ ɴᴜмвєʀ уσυ ∂σɴт нανє ᴘєʀмιѕѕισɴ 📵*",

  // ===== REACTION SETTINGS =====
  AUTO_REACT: process.env.AUTO_REACT || "false",
  OWNER_REACT: process.env.OWNER_REACT || "false",
  STICKER_NAME: process.env.STICKER_NAME || "Zypher MD",
  AUTO_STICKER: process.env.AUTO_STICKER || "false",
  STICKER_REPLY: process.env.STICKER_REPLY || "true",
  STICKER_REPLY_MODE: process.env.STICKER_REPLY_MODE || "both",
  DOCUMENT_AI: process.env.DOCUMENT_AI || "true",
  AUTO_VOICE: process.env.AUTO_VOICE || "false",
  VOICE_PROFILE: process.env.VOICE_PROFILE || "bodi",
  GEMINI_VOICE: process.env.GEMINI_VOICE || "Bodi",
  STATUS_SENDER: process.env.STATUS_SENDER || "true",

  // ===== AUTO PRESENCE SETTINGS =====
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "true",
  AUTO_TYPING: process.env.AUTO_TYPING || "false",
  AUTO_RECORDING: process.env.AUTO_RECORDING || "false",

  // ===== ANTI FEATURES SETTINGS =====
  ANTI_LINK: process.env.ANTI_LINK || "true",
  ANTI_STATUS: process.env.ANTI_STATUS || "true",
  ANTI_BAD_WORD: process.env.ANTI_BAD_WORD || "false",
  BOT_ROAST: process.env.BOT_ROAST || "false",

  // ===== MEDIA & AUTOMATION =====
  MENTION_REPLY: process.env.MENTION_REPLY || "false",
  MENU_IMAGE_URL: process.env.MENU_IMAGE_URL || "https://files.catbox.moe/qvtnzu.png",
  BOT_MEDIA_URL: process.env.BOT_MEDIA_URL || "https://files.catbox.moe/qvtnzu.png",
  AUDIO_URL: process.env.AUDIO_URL || 'https://files.catbox.moe/0toicz.mp3',
  AUTO_DOWNLOADER: process.env.AUTO_DOWNLOADER || "false",

  // ===== SECURITY & ANTI-FEATURES =====
  ANTI_DELETE: process.env.ANTI_DELETE || "true",
  ANTI_DELETE_PATH: process.env.ANTI_DELETE_PATH || "inbox",
  ANTI_CALL: process.env.ANTI_CALL || "false",
  CALL_AI: process.env.CALL_AI || "true",
  CALL_AI_VOICE: process.env.CALL_AI_VOICE || "true",
  ANTI_SPAM: process.env.ANTI_SPAM || "false",
  ANTI_VV: process.env.ANTI_VV || "true",
  ANTI_BOT: process.env.ANTI_BOT || "false",
  PM_BLOCKER: process.env.PM_BLOCKER || "false",
  ANTI_MENTION: process.env.ANTI_MENTION || "false",
  ANTI_STATUS_MENTION: process.env.ANTI_STATUS_MENTION || "false",
  ANTI_EDIT: process.env.ANTI_EDIT || "true",
  ANTIEDIT_PATH: process.env.ANTIEDIT_PATH || "inbox",

  // ===== BOT BEHAVIOR & APPEARANCE =====
  DESCRIPTION: process.env.DESCRIPTION || "*© ᴘᴏᴡᴇʀᴇᴅ ʙʏ Jᴀᴡᴀᴅ TᴇᴄʜX*",
  AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || "true",
  AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN || "true",
  AUTO_BIO: process.env.AUTO_BIO || "false",

  // ===== WELCOME & GOODBYE SETTINGS =====
  WELCOME: process.env.WELCOME || "false",
  GOODBYE: process.env.GOODBYE || "false",
  ADMIN_ACTION: process.env.ADMIN_ACTION || "false",
  WELCOME_MESSAGE: process.env.WELCOME_MESSAGE || "*_@user joined the group, welcome! 🎉_*",
  GOODBYE_MESSAGE: process.env.GOODBYE_MESSAGE || "*_@user has left the group, we will miss them! 👋_*",

  VERSION: process.env.VERSION || "10.0 Bᴇᴛᴀ",
  TIMEZONE: process.env.TIMEZONE || "Asia/Colombo",
};