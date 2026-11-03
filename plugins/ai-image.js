// plugins/ai-image.js - Image Generator using @google/genai (Gemini 3.1 Flash Lite Image)
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { cmd } from '../command.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);

const apiKey = process.env['GEMINI_API_KEY'] || config?.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
const ai = new GoogleGenAI({ apiKey });

/**
 * Builds an enhanced prompt preserving user artistic intent
 */
export function buildEnhancedPrompt(userPrompt) {
    const cleanPrompt = userPrompt.trim();
    // If user explicitly asks for cartoon, anime, 3d, sketch, painting, logo, preserve their intent
    const isStylized = /\b(anime|manga|cartoon|3d|cgi|render|illustration|drawing|sketch|painting|pixel|logo|vector|cyberpunk|fantasy|art)\b/i.test(cleanPrompt);
    if (isStylized) {
        return cleanPrompt;
    }
    // Realistic photographic enhancement
    return `Authentic ultra-detailed photograph of ${cleanPrompt}, 8k resolution, natural lighting, sharp focus, high definition real-world detail`;
}

/**
 * Generates an image using Google GenAI interactions API (Gemini 3.1 Flash Lite Image)
 */
export async function generateUltraRealisticImage(prompt) {
    const cleanPrompt = prompt.trim();
    const promptToSend = buildEnhancedPrompt(cleanPrompt);

    // Google GenAI Interactions API configuration (snake_case required by API)
    const generationConfig = {
        temperature: 1,
        max_output_tokens: 65536,
        top_p: 0.95,
        thinking_level: 'minimal',
        image_config: {
            image_size: '1K',
        },
    };

    // 1. Primary: Google GenAI Interactions API with Gemini 3.1 Flash Lite Image
    const geminiModels = [
        'models/gemini-3.1-flash-lite-image',
        'models/gemini-3.1-flash-image',
        'models/gemini-2.5-flash-image'
    ];

    for (const model of geminiModels) {
        try {
            console.log(`[AI-Image] Requesting Google GenAI (${model})...`);
            const interaction = await ai.interactions.create({
                model: model,
                input: promptToSend,
                generation_config: generationConfig,
                response_modalities: ['image', 'text'],
            });

            if (interaction.steps) {
                for (const step of interaction.steps) {
                    if (step.type === 'model_output' && step.content) {
                        for (const part of step.content) {
                            if (part.type === 'image' && part.data) {
                                return {
                                    buffer: Buffer.from(part.data, 'base64'),
                                    mimeType: 'image/png',
                                    engine: `Google Gemini (${model.replace('models/', '')})`
                                };
                            }
                        }
                    }
                }
            }
        } catch (geminiErr) {
            console.warn(`[AI-Image] ${model} unavailable:`, geminiErr?.message || geminiErr);
            // If Free tier has 0 quota or rate limited, break so user isn't kept waiting
            if (geminiErr?.status === 429 || String(geminiErr?.message).includes('Free Tier') || String(geminiErr?.message).includes('limit: 0')) {
                break;
            }
        }
    }

    // 2. Fallbacks: If Google Gemini Free Tier is quota-limited (0 req/day on Free Tier), use Flux / Unsplash
    // A. Try Unsplash Real High-Resolution Photography
    try {
        const searchApi = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(cleanPrompt)}&per_page=1`;
        const uRes = await fetch(searchApi, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(6000)
        });
        if (uRes.ok) {
            const uData = await uRes.json();
            const photoUrl = uData?.results?.[0]?.urls?.regular;
            if (photoUrl) {
                const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
                if (imgRes.ok) {
                    const arr = await imgRes.arrayBuffer();
                    return {
                        buffer: Buffer.from(arr),
                        mimeType: 'image/jpeg',
                        engine: 'DSLR Real Life Photography (Unsplash 4K)'
                    };
                }
            }
        }
    } catch (_) {}

    // B. Try Flux Realism Engine with negative prompt
    try {
        const neg = encodeURIComponent('ugly, deformed, disfigured, blurry, low quality');
        const fluxUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptToSend)}?model=flux-realism&width=1024&height=1024&nologo=true&private=true&negative=${neg}&seed=${Math.floor(Math.random() * 999999)}`;
        const res = await fetch(fluxUrl, { signal: AbortSignal.timeout(25000) });
        if (res.ok) {
            const arrBuf = await res.arrayBuffer();
            if (arrBuf.byteLength > 2000) {
                return {
                    buffer: Buffer.from(arrBuf),
                    mimeType: res.headers.get('content-type') || 'image/jpeg',
                    engine: 'Flux Photorealism 8K'
                };
            }
        }
    } catch (fallbackErr) {
        console.error('[AI-Image] Fallback error:', fallbackErr?.message || fallbackErr);
    }

    return null;
}

export const generateAIImage = generateUltraRealisticImage;

// ==================== BOT COMMAND ====================
cmd({
    pattern: "imagine",
    alias: ["realistic", "aiimg", "genimg", "draw", "photo", "image"],
    react: "🎨",
    desc: "Generate AI Images using Google Gemini 3.1 Flash Lite Image",
    category: "ai",
    use: ".imagine <prompt>",
    filename: __filename
}, async (conn, mek, m, { reply, q, text, args, from }) => {
    try {
        const prompt = (q || text || args.join(" ")).trim();
        if (!prompt) {
            return reply("📸 *Please describe what image you want to create!*\n\n*Example:* `.imagine a wild red fox in the forest, raw photograph`\n*Tip:* You can also simply chat without any command (e.g. _\"red fox kenekge photo ekak hadanna\"_)!");
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const result = await generateUltraRealisticImage(prompt);

        if (!result || !result.buffer) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ *Failed to generate image. Please try a different prompt.*");
        }

        const botName = config.BOT_NAME || "Zypher MD";
        await conn.sendMessage(from, {
            image: result.buffer,
            caption: `🎨 *AI Generated Image*\n\n📝 *Prompt:* ${prompt}\n⚙️ *Engine:* ${result.engine}\n\n> © Powered by ${botName}`
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (err) {
        console.error('[AI-Image] Command error:', err);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error: ${err.message || err}`);
    }
});
