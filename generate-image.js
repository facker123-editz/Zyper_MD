import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import config from './config.js';

// API Key from environment or config.js
const apiKey = process.env['GEMINI_API_KEY'] || config?.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";

if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in environment or config.js!');
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: apiKey,
});

// Note: Google GenAI Interactions API strictly requires snake_case properties
const generationConfig = {
    temperature: 1,
    max_output_tokens: 65536,
    top_p: 0.95,
    thinking_level: 'minimal',
    image_config: {
        image_size: '1K',
    },
};

async function main() {
    const inputPrompt = process.argv.slice(2).join(' ').trim() || 'A majestic wild lion in the golden savannah sunset, national geographic photography, 8k resolution';
    const outputPath = 'output.png';

    console.log(`🎨 Generating image with Gemini 3.1 Flash Lite Image...`);
    console.log(`📝 Prompt: "${inputPrompt}"`);
    console.log(`📐 Image Size: 1K | Thinking Level: minimal\n`);

    try {
        const interaction = await ai.interactions.create({
            model: 'models/gemini-3.1-flash-lite-image',
            input: inputPrompt,
            generation_config: generationConfig,
            response_modalities: ['image', 'text'],
        });

        let imageSaved = false;

        if (interaction.steps) {
            for (const step of interaction.steps) {
                if (step.type === 'model_output' && step.content) {
                    for (const part of step.content) {
                        if (part.type === 'text') {
                            console.log(`[Model Text]:`, part.text);
                        } else if (part.type === 'image' && part.data) {
                            const imageBuffer = Buffer.from(part.data, 'base64');
                            writeFileSync(outputPath, new Uint8Array(imageBuffer.buffer, imageBuffer.byteOffset, imageBuffer.byteLength));
                            console.log(`✅ Image saved to ${outputPath}`);
                            imageSaved = true;
                        }
                    }
                }
            }
        }

        if (!imageSaved) {
            console.warn('⚠️ No image was returned in the interaction steps.');
        }
    } catch (err) {
        console.error('❌ Generation failed:', err?.message || err);
        if (err?.status === 429 || String(err?.message).includes('Free Tier') || String(err?.message).includes('limit: 0')) {
            console.log('\n💡 [Notice]: The model "gemini-3.1-flash-lite-image" requires a Paid Tier (Pay-As-You-Go) API key on Google AI Studio.');
            console.log('Free Tier accounts have a limit of 0 requests/day for this model.');
            console.log('To use this model, set a billing-enabled GEMINI_API_KEY in your environment or config.js.');
        }
    }
}

main();

