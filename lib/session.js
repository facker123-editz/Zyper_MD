import fsSync from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { File } from 'megajs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadSession(sessionDir, config) {
    try {
        if (!config.SESSION_ID) {
            console.log('No SESSION_ID provided - QR login will be generated');
            return null;
        }

        console.log('[⏳] Downloading creds data...');
        
        const credsPath = path.join(sessionDir, 'creds.json');
        
        // Check session format
        if (config.SESSION_ID.startsWith('JK~')) {
            console.log('[🔰] Downloading MEGA.nz session...');
            const megaFileId = config.SESSION_ID.replace("JK~", "");
            const filer = File.fromURL(`https://mega.nz/file/${megaFileId}`);
                
            const data = await new Promise((resolve, reject) => {
                filer.download((err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            // Ensure directory exists
            if (!fsSync.existsSync(sessionDir)) {
                fsSync.mkdirSync(sessionDir, { recursive: true });
            }
            
            fsSync.writeFileSync(credsPath, data);
            console.log('[✅] MEGA session downloaded successfully');
            return JSON.parse(data.toString());
            
        } else if (config.SESSION_ID.startsWith('IK~')) {
            console.log('🔁 Detected Base64 Session Format');
            const [header, b64data] = config.SESSION_ID.split('~');

            if (header !== "IK" || !b64data) {
                throw new Error("❌ Invalid session format. Expected 'IK~...'");
            }

            const cleanB64 = b64data.replace('...', '');
            const decodedData = Buffer.from(cleanB64, 'base64').toString('utf-8');

            // Ensure directory exists
            if (!fsSync.existsSync(sessionDir)) {
                fsSync.mkdirSync(sessionDir, { recursive: true });
            }

            fsSync.writeFileSync(credsPath, decodedData, "utf8");
            console.log("✅ KHAN-MD Session Loaded Successfully from Base64");
            return JSON.parse(decodedData);
            
        } else {
            console.log('❌ Unknown SESSION_ID format. Must start with JK~ or IK~');
            return null;
        }
    } catch (error) {
        console.error('❌ Error loading session:', error.message);
        console.log('Will generate QR code instead');
        return null;
    }
}

export default loadSession;
