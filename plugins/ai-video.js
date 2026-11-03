// plugins/ai-video.js - Video Generator using @google/genai (Gemini Omni 1.1 Flash)
import { fileURLToPath } from 'url';
import path from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { GoogleGenAI } from '@google/genai';
import { cmd } from '../command.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Downloads / saves base64 video buffer to disk
 * Exact function requested by user
 */
export async function downloadVideo(ai, videoOutput, outputPath) {
    if (!videoOutput) return null;

    if (videoOutput.data) {
        const videoBuffer = Buffer.from(videoOutput.data, 'base64');
        writeFileSync(outputPath, new Uint8Array(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength));
        console.log(`💾 Saved video to ${outputPath}`);
        return videoBuffer;
    }

    if (videoOutput.video?.data) {
        const videoBuffer = Buffer.from(videoOutput.video.data, 'base64');
        writeFileSync(outputPath, new Uint8Array(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength));
        console.log(`💾 Saved video to ${outputPath}`);
        return videoBuffer;
    }

    if (videoOutput.inlineData?.data) {
        const videoBuffer = Buffer.from(videoOutput.inlineData.data, 'base64');
        writeFileSync(outputPath, new Uint8Array(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength));
        console.log(`💾 Saved video to ${outputPath}`);
        return videoBuffer;
    }

    return null;
}

/**
 * Extracts raw buffer from video output part
 */
export function extractVideoBuffer(videoOutput) {
    if (!videoOutput) return null;

    if (typeof videoOutput.data === 'string') {
        return Buffer.from(videoOutput.data, 'base64');
    }
    if (videoOutput.video?.data) {
        return Buffer.from(videoOutput.video.data, 'base64');
    }
    if (videoOutput.inlineData?.data) {
        return Buffer.from(videoOutput.inlineData.data, 'base64');
    }
    if (Buffer.isBuffer(videoOutput.data)) {
        return videoOutput.data;
    }
    return null;
}

/**
 * Generates AI Video using Google GenAI interactions API (Gemini Omni 1.1 Flash)
 * @param {string} prompt Video description prompt
 * @param {object} [options] Optional configuration
 * @returns {Promise<{ buffer: Buffer, text: string, model: string }>}
 */
export async function generateAIVideo(prompt, options = {}) {
    const apiKey = options.apiKey || config.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    const ai = new GoogleGenAI({ apiKey });

    // Note: The API strictly requires snake_case 'thinking_level'
    const generationConfig = {
        max_output_tokens: options.max_output_tokens || 65536,
        thinking_level: options.thinking_level || options.thinkingLevel || 'high',
    };

    const modelsToTry = [
        options.model || 'models/gemini-omni-1.1-flash',
        'models/gemini-omni-flash-preview'
    ];

    const duration = options.duration || '10s';

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            console.log(`[AI-Video] Requesting Google GenAI video (${model})...`);
            const interaction = await ai.interactions.create({
                model: model,
                input: prompt,
                generation_config: generationConfig,
                response_modalities: ['video'],
                response_format: {
                    type: 'video',
                    duration: duration,
                },
            });

            let videoBuffer = null;
            let textOutput = '';

            if (interaction?.steps) {
                for (const step of interaction.steps) {
                    if (step.type === 'model_output' && step.content) {
                        for (const part of step.content) {
                            if (part.type === 'text') {
                                textOutput += (part.text || '') + '\n';
                                console.log('[AI-Video Text]:', part.text);
                            } else if (part.type === 'video') {
                                if (options.outputPath) {
                                    videoBuffer = await downloadVideo(ai, part, options.outputPath);
                                } else {
                                    videoBuffer = extractVideoBuffer(part);
                                }
                            }
                        }
                    }
                }
            }

            if (videoBuffer) {
                return {
                    buffer: videoBuffer,
                    text: textOutput.trim(),
                    model: model.replace('models/', ''),
                    duration: duration
                };
            }
        } catch (err) {
            console.warn(`[AI-Video] Model ${model} failed:`, err?.message || err);
            lastError = err;
            // If Free tier quota limit is 0, trying another Gemini omni model won't bypass the tier quota
            if (err?.status === 429 || String(err?.message).includes('Free Tier') || String(err?.message).includes('limit: 0')) {
                break;
            }
        }
    }

    if (lastError) throw lastError;
    return null;
}

// ==================== BOT COMMAND ====================
cmd({
    pattern: "aivideo",
    alias: ["genvideo", "videoai", "genvid", "vidgen", "omnivideo", "aivid"],
    react: "🎬",
    desc: "Generate AI Video using Google GenAI (Gemini Omni 1.1 Flash)",
    category: "ai",
    use: ".aivideo <prompt>",
    filename: __filename
}, async (conn, mek, m, { reply, q, text, args, from }) => {
    try {
        const prompt = (q || text || args.join(" ")).trim();
        if (!prompt) {
            return reply(
                "🎬 *Please describe what video you want to create!*\n\n" +
                "*Example:* `.aivideo a glowing futuristic neon cybernetic orb spinning in slow motion, cinematic 8k`\n" +
                "*Duration:* 10 seconds\n" +
                "*Tip:* You can also say in chat: _\"video ekak hadanna [description]\"_"
            );
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(
            `🎬 *Creating AI Video with Google Gemini Omni 1.1 Flash...*\n\n` +
            `📝 *Prompt:* ${prompt}\n` +
            `⏱️ *Duration:* 10s\n` +
            `🧠 *Thinking Level:* High\n\n` +
            `⏳ _Processing video generation, please wait 30 - 60 seconds..._`
        );

        const result = await generateAIVideo(prompt);

        if (!result || !result.buffer) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ *Failed to generate video. No video data received from model.*");
        }

        const botName = config.BOT_NAME || "Zypher MD";
        await conn.sendMessage(from, {
            video: result.buffer,
            caption: `🎬 *Google Gemini AI Video*\n\n📝 *Prompt:* ${prompt}\n⏱️ *Duration:* ${result.duration}\n⚙️ *Model:* ${result.model}\n\n> © Powered by ${botName}`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('[AI-Video] Command error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });

        const isQuotaError = 
            err?.status === 429 || 
            String(err?.message).includes('Rate limit') || 
            String(err?.message).includes('Free Tier') || 
            String(err?.message).includes('limit: 0');

        if (isQuotaError) {
            return reply(
                `⚠️ *Google Gemini Video Generation Quota Notice*\n\n` +
                `Google Gemini Video Generation (\`gemini-omni-1.1-flash\`) සඳහා **Paid Tier / Billing enabled** Gemini API Key එකක් අවශ්‍ය වේ.\n\n` +
                `Google Free Tier එකේ වීඩියෝ generation quota එක 0 ක් (requests per day: 0) ලෙස සීමා කර ඇත.\n\n` +
                `🔑 *Fix කරගන්නා ආකාරය:*\n` +
                `1. https://aistudio.google.com වෙත පිවිසෙන්න.\n` +
                `2. Project එකට Billing (Pay-As-You-Go) සම්බන්ධ කරන්න.\n` +
                `3. අලුත් API Key එකක් ගෙන \`config.js\` හෝ \`config.env\` හි \`GEMINI_API_KEY\` එකට දමන්න.`
            );
        }

        reply(`❌ Video generation error: ${err.message || err}`);
    }
});

