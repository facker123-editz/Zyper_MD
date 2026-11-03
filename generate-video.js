import { GoogleGenAI } from '@google/genai';
import { writeFileSync } from 'fs';
import config from './config.js';

// Load API key from config or environment
const apiKey = config.GEMINI_API_KEY || process.env['GEMINI_API_KEY'];
if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in config.js or process.env!');
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: apiKey,
});

// Note: The Google GenAI Interactions API strictly requires snake_case 'thinking_level'
const generationConfig = {
    max_output_tokens: 65536,
    thinking_level: 'high',
};

async function main() {
    const inputPrompt = process.argv.slice(2).join(' ').trim() || 'A glowing futuristic neon cybernetic orb spinning in slow motion, cinematic 8k';
    const outputPath = 'output.mp4';

    console.log(`🎬 Generating video with Gemini Omni 1.1 Flash...`);
    console.log(`📝 Prompt: "${inputPrompt}"`);
    console.log(`⏱️ Duration: 10s | Thinking Level: high\n`);

    try {
        const interaction = await ai.interactions.create({
            model: 'models/gemini-omni-1.1-flash',
            input: inputPrompt,
            generation_config: generationConfig,
            response_modalities: ['video'],
            response_format: {
                type: 'video',
                duration: '10s',
            },
        });

        if (interaction.steps) {
            for (const step of interaction.steps) {
                if (step.type === 'model_output' && step.content) {
                    for (const part of step.content) {
                        if (part.type === 'text') {
                            console.log(`[Model Text]:`, part.text);
                        } else if (part.type === 'video') {
                            await downloadVideo(ai, part, outputPath);
                        }
                    }
                }
            }
        }
        console.log('✅ Video generation completed!');
    } catch (err) {
        console.error('❌ Video generation failed:', err?.message || err);
        if (err?.status === 429 || String(err?.message).includes('Free Tier') || String(err?.message).includes('limit: 0')) {
            console.log('\n💡 [Notice]: Google Gemini Video Generation model (gemini-omni-1.1-flash) requires a Paid Tier (Pay-As-You-Go) API Key.');
            console.log('Free tier accounts currently have 0 requests/day quota for video generation.');
            console.log('Enable billing on Google AI Studio (https://aistudio.google.com) to use this model.');
        }
    }
}

async function downloadVideo(ai, videoOutput, outputPath) {
    if (!videoOutput) return;

    if (videoOutput.data) {
        const videoBuffer = Buffer.from(videoOutput.data, 'base64');
        writeFileSync(outputPath, new Uint8Array(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength));
        console.log(`💾 Saved video to ${outputPath}`);
        return;
    }

    if (videoOutput.video?.data) {
        const videoBuffer = Buffer.from(videoOutput.video.data, 'base64');
        writeFileSync(outputPath, new Uint8Array(videoBuffer.buffer, videoBuffer.byteOffset, videoBuffer.byteLength));
        console.log(`💾 Saved video to ${outputPath}`);
        return;
    }
}

main();

