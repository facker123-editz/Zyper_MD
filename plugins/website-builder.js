// plugins/website-builder.js - Multi-Step Conversation & Persistent Website Builder for KHAN-MD
import { fileURLToPath } from 'url';
import path from 'path';
import { cmd, commands } from '../command.js';
import config from '../config.js';
import {
    getActiveSession,
    hasActiveSession,
    startSession,
    updateSession,
    cancelSession,
    approveSession,
    getUserApprovedProjects,
    getApprovedProject
} from '../lib/conversation-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Safely send presence update without throwing if socket is closed
 */
async function safeSendPresence(conn, type, jid) {
    if (!conn?.ws || conn.ws.isOpen === false) return;
    try {
        await conn.sendPresenceUpdate(type, jid);
    } catch (_) {}
}

/**
 * Safely send emoji reaction without throwing if socket is closed
 */
async function safeSendReaction(conn, jid, emoji, key) {
    if (!conn?.ws || conn.ws.isOpen === false || !emoji || !key) return;
    try {
        await conn.sendMessage(jid, { react: { text: emoji, key: key } });
    } catch (_) {}
}

/**
 * Safely send a message with retry
 */
async function safeSendMessage(conn, jid, content, options = {}, maxRetries = 3) {
    if (!conn) return null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (!conn.ws || conn.ws.isOpen === false) {
            await new Promise(r => setTimeout(r, 1200 * attempt));
        }

        try {
            return await conn.sendMessage(jid, content, options);
        } catch (err) {
            const errMsg = err?.message || '';
            const statusCode = err?.output?.statusCode;
            const isConnClosed = errMsg.includes('Connection Closed') || errMsg.includes('precondition') || statusCode === 428;

            if (isConnClosed && attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1800 * attempt));
                continue;
            }

            if (options.quoted && attempt === maxRetries) {
                try {
                    const fallback = { ...options };
                    delete fallback.quoted;
                    return await conn.sendMessage(jid, content, fallback);
                } catch (_) {}
            }
            return null;
        }
    }
    return null;
}

/**
 * Detect if user is triggering the Website Builder flow naturally
 */
export function isWebsiteBuilderTrigger(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase();

    // Sinhala triggers
    if (/(?:website|වෙබ්සයිට්|වෙබ්\s*සයිට්|web)\s*(?:එකක්\s*)?(?:හදන්න|හදලා\s*දෙන්න|හදන්න\s*ඕන|හදන්න\s*ඕනේ|design\s*කරන්න|create\s*කරන්න|make\s*කරන්න)/i.test(clean)) {
        return true;
    }
    // Singlish triggers
    if (/(?:website|web|web\s*site)\s*(?:ekak\s*)?(?:hadanna|hadala\s*denna|hadanna\s*ona|hadanna\s*one|create\s*karanna|design\s*karanna)/i.test(clean)) {
        return true;
    }
    // English triggers
    if (/^(?:make|build|create|design|develop)\s+(?:a\s+)?(?:website|web\s*app|web\s*page|web\s*project)(?:\s+please|\s+for\s+me)?$/i.test(clean) ||
        /^(?:i\s+want\s+to\s+(?:build|make|create|develop)\s+(?:a\s+)?website)$/i.test(clean) ||
        /^(?:website\s+(?:development|builder|making|creation))$/i.test(clean)) {
        return true;
    }

    return false;
}

/**
 * Detect if user is asking to view their approved projects
 */
export function isProjectQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim().toLowerCase();

    if (/(?:මගේ|mage|my)\s*(?:website\s*)?(?:project|projects|ප්\u200Dරොජෙක්ට්)(?:\s*eka|\s*eke|\s*monawada)?/i.test(clean)) {
        return true;
    }
    if (/^(?:approved\s+projects?|my\s+projects?|show\s+my\s+project)$/i.test(clean)) {
        return true;
    }
    return false;
}

/**
 * Generate full Architectural Blueprint and Implementation Guide using Gemini AI
 */
async function generateArchitectureBlueprint(sessionData) {
    const apiKey = config.GEMINI_API_KEY || "AQ.Ab8RN6LcZfcpXqsy2kRjlPHe05mQ7-29TyW1yVWAxSLa25CQZQ";
    const botName = config.BOT_NAME || "Zypher MD";

    const prompt = `You are a Principal Software Solutions Architect and Senior Full-Stack Engineer at a top tech company.
The client has provided their verified requirements for a website project:
- Tech Stack: ${sessionData.techStack}
- Core Features & Functionality: ${sessionData.features}
- Design & UI/UX Style: ${sessionData.design}
- Deployment & Cloud Hosting: ${sessionData.deployment}

Please generate a comprehensive, highly structured, professional Architectural Blueprint & Technical Implementation Guide for this project.
Format the output cleanly in WhatsApp Markdown (*bold*, _italic_, bullet points, code blocks where helpful).
Language: Clear English with bilingual Sinhala greetings/friendly notes.

Include the following structured sections:
1. 🏛️ *System Architecture & Technical Strategy*
   - Architectural pattern (e.g. Monolithic vs Modular/Microservices, SSR vs CSR, API architecture)
   - Why the selected Tech Stack (${sessionData.techStack}) is ideal and how components connect
2. ⚡ *Feature Specifications & Backend Logic*
   - Detailed breakdown of each feature requested (${sessionData.features})
   - Database schema overview (Tables/Collections, Key relations)
   - Authentication & Authorization strategy (JWT, OAuth, Sessions)
3. 🎨 *UI/UX & Frontend Design System*
   - Design philosophy according to client request (${sessionData.design})
   - Recommended color palette, typography, and responsive layout guidelines
   - Component structure (Header, Hero, Feature grid, Admin view, Footer)
4. 🚀 *Deployment, DevOps & Hosting Roadmap*
   - Step-by-step deployment guide for ${sessionData.deployment}
   - CI/CD automation & Environment configuration (.env essentials)
   - SSL, Custom Domain, CDN caching & Performance optimization
5. 🛡️ *Security & Production Readiness Checklist*
   - Critical security practices (CORS, Rate Limiting, Input Validation, HTTPS)
6. 📅 *Phased Development Milestones (Timeline)*
   - Phase 1: Setup & DB schema
   - Phase 2: Core Features & APIs
   - Phase 3: Frontend UI & Polish
   - Phase 4: Testing & Production Launch

End with an encouraging summary indicating that this technical specification is approved and ready for execution.`;

    const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.5-flash', 'gemini-3.8-flash'];
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                }),
                signal: AbortSignal.timeout(18000)
            });

            if (res.status === 200) {
                const data = await res.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (text) return text;
            }
        } catch (_) {
            // Try next model on error/timeout
        }
    }

    // Fallback if AI call failed
    return `🏛️ *PROJECT ARCHITECTURAL BLUEPRINT*

🛠️ *1. Technology Stack Architecture*
• Selected Stack: ${sessionData.techStack}
• Layered Architecture: Client Presentation Layer ➔ REST/GraphQL API Gateway ➔ Core Service Layer ➔ Database Engine.

⚡ *2. Core Feature Implementation*
• Requirements: ${sessionData.features}
• Authentication: JWT Bearer Tokens with Secure HTTP-Only Cookies.
• Database Schema: Normalized relational or document schema with indexing on primary lookup keys.

🎨 *3. UI/UX & Design Guidelines*
• Style: ${sessionData.design}
• Mobile-first 100% responsive grid with modern component modularity.

🚀 *4. Deployment & Infrastructure*
• Hosting Environment: ${sessionData.deployment}
• Production Setup: Automated Git CI/CD, SSL Certificate (Let's Encrypt / Cloudflare), Environment Variables security.`;
}

/**
 * Main Multi-Step Message Handler
 * Returns true if the message was handled by the multi-step conversation flow.
 */
export async function handleWebsiteBuilderMessage(userText, conn, mek, m, baseOptions) {
    const from = baseOptions.from;
    const clean = userText.trim();
    const lower = clean.toLowerCase();

    // 1. Check if user has an active session
    let session = getActiveSession(from);

    // If no active session, check if user is triggering a new website build
    if (!session) {
        if (isWebsiteBuilderTrigger(clean)) {
            await safeSendReaction(conn, from, '🌐', mek.key);
            session = startSession(from, 'website_builder');

            const introText =
`🌐 *WEBSITE BUILDER — MULTI-STEP CONVERSATION*
━━━━━━━━━━━━━━━━━━━━━━━━
ආයුබෝවන්! ඔබගේ අලුත් Website එකේ සම්පූර්ණ Blueprint එක සහ Architectural Specification එක පියවරෙන් පියවර සකසමු! 🚀

*පියවර 1/4: Tech Stack (තාක්ෂණික පද්ධතිය)*
ඔබ කැමති හෝ නිර්දේශ කරන Frontend, Backend හෝ Framework එක කුමක්ද?

💡 *උදාහරණ:*
• *MERN Stack:* Next.js / React + Node.js + MongoDB
• *Modern Full-Stack:* Next.js 14 + PostgreSQL + Prisma
• *CMS:* WordPress / WooCommerce / Shopify
• *Python / PHP:* Django, FastAPI, Laravel
• *Static / Light:* HTML5 + Tailwind CSS + JavaScript
_(ඔබට තෝරාගැනීමට අපහසු නම් 'recommend' හෝ 'හිතලා දාන්න' කියන්න)_
━━━━━━━━━━━━━━━━━━━━━━━━
_💡 ඕනෑම මොහොතක 'cancel' කීමෙන් මෙය අවලංගු කළ හැක._`;

            await safeSendMessage(conn, from, { text: introText }, { quoted: mek });
            return true;
        }

        // Check if user is asking for their approved project
        if (isProjectQuery(clean)) {
            const projects = getUserApprovedProjects(from);
            if (!projects || projects.length === 0) {
                const emptyMsg =
`📌 *ඔබ මෙතෙක් අනුමත කළ (Approved) Website Projects කිසිවක් නැත.*

අලුත් Website එකක් පියවරෙන් පියවර සැලසුම් කරගැනීමට:
👉 *"website එකක් හදන්න"* හෝ *.website* කියන්න! 🚀`;
                await safeSendMessage(conn, from, { text: emptyMsg }, { quoted: mek });
                return true;
            }

            // Return latest approved project
            const latest = projects[projects.length - 1];
            const projectCard =
`📂 *ඔබගේ අනුමත WEBSITE PROJECT BLUEPRINT*
━━━━━━━━━━━━━━━━━━━━━━━━
🆔 *Project ID:* #${latest.id}
📅 *Approved Date:* ${new Date(latest.approvedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}
💾 *Status:* ස්ථිරව සුරක්ෂිතයි (Persistent in Database)
━━━━━━━━━━━━━━━━━━━━━━━━
🛠 *Tech Stack:* ${latest.data.techStack}
⚡ *Features:* ${latest.data.features}
🎨 *Design:* ${latest.data.design}
🚀 *Deployment:* ${latest.data.deployment}
━━━━━━━━━━━━━━━━━━━━━━━━
${latest.approvedPlan}
━━━━━━━━━━━━━━━━━━━━━━━━
_🔒 Bot එක restart වුවද ඔබගේ මෙම Approved Project State එක කිසිදා මැකී යන්නේ නැත._`;

            await safeSendMessage(conn, from, { text: projectCard }, { quoted: mek });
            return true;
        }

        return false;
    }

    // ========================================================
    // USER HAS AN ACTIVE MULTI-STEP SESSION (IN PROGRESS)
    // ========================================================

    // 2. Handle cancellation
    if (/^(?:cancel|stop|exit|abort|අවලංගු\s*කරන්න|අවලංගු|එපා)$/i.test(lower)) {
        cancelSession(from);
        await safeSendReaction(conn, from, '❌', mek.key);
        await safeSendMessage(conn, from, {
            text: `❌ *Website Builder multi-step conversation එක අවලංගු කරන ලදී.*\nඔබට නැවත අවශ්‍ය වූ විට *"website එකක් හදන්න"* කියන්න.`
        }, { quoted: mek });
        return true;
    }

    // 3. Handle status/progress query
    if (/^(?:status|progress|තත්වය|පියවර)$/i.test(lower)) {
        const stepNum = session.stepIndex;
        const statusMsg =
`📊 *WEBSITE BUILDER PROGRESS*
━━━━━━━━━━━━━━━━━━━━━━━━
📌 *වත්මන් පියවර:* ${stepNum <= 4 ? `පියවර ${stepNum}/4` : 'සමාලෝචනය සහ අනුමැතිය (Review & Approval)'}
🛠 *Tech Stack:* ${session.data.techStack || '_තවම ලබාදී නැත_'}
⚡ *Features:* ${session.data.features || '_තවම ලබාදී නැත_'}
🎨 *Design:* ${session.data.design || '_තවම ලබාදී නැත_'}
🚀 *Deployment:* ${session.data.deployment || '_තවම ලබාදී නැත_'}
━━━━━━━━━━━━━━━━━━━━━━━━
_ඉදිරියට යාමට ඔබගේ පිළිතුර ලබාදෙන්න, නැතහොත් 'cancel' කියන්න._`;
        await safeSendMessage(conn, from, { text: statusMsg }, { quoted: mek });
        return true;
    }

    // Check if session was restored after a bot restart
    const restartNote = session.restoredFromRestart ? `_(🔄 Session state restored from database after bot restart)_\n\n` : '';
    if (session.restoredFromRestart) {
        session.restoredFromRestart = false;
        updateSession(from, { restoredFromRestart: false });
    }

    // STEP 1: Tech Stack Answered ➔ Move to Step 2 (Features)
    if (session.stepIndex === 1) {
        let techAnswer = clean;
        if (/^(?:recommend|recomended|hithala danna|hoda ekak danna|hodama eka|suggest|හිතලා දාන්න|හොඳ එකක්)$/i.test(lower)) {
            techAnswer = "Recommended: Next.js 14 (App Router) + Node.js + Express + MongoDB + Tailwind CSS";
        }

        updateSession(from, {
            data: { techStack: techAnswer },
            stepIndex: 2
        });

        await safeSendReaction(conn, from, '🛠️', mek.key);

        const step2Msg =
`${restartNote}✅ *Tech Stack:* ${techAnswer} සටහන් කරගත්තා! 🚀

━━━━━━━━━━━━━━━━━━━━━━━━
*පියවර 2/4: Core Features (අවශ්‍ය අංග සහ පහසුකම්)*
Website එකේ අඩංගු විය යුතු මූලික අංග සහ ක්‍රියාකාරීත්වයන් (Features & Functionality) මොනවාද?

💡 *උදාහරණ:*
• User Registration & Login (Google / Email OAuth)
• Shopping Cart & Online Payments (Stripe / PayHere / PayPal)
• Admin Dashboard & Analytics
• Dynamic Blog / Articles / Content Management
• Contact Form & Email Notifications
• Live Chat / WhatsApp AI Integration
• Product Catalog & Search/Filter
━━━━━━━━━━━━━━━━━━━━━━━━
_💡 ඕනෑම වේලාවක 'cancel' කීමෙන් මෙය අවලංගු කළ හැක._`;

        await safeSendMessage(conn, from, { text: step2Msg }, { quoted: mek });
        return true;
    }

    // STEP 2: Features Answered ➔ Move to Step 3 (Design)
    if (session.stepIndex === 2) {
        let featuresAnswer = clean;
        if (/^(?:recommend|hithala danna|standard|හිතලා දාන්න)$/i.test(lower)) {
            featuresAnswer = "User Authentication, Responsive Product/Content Catalog, Contact Form, Admin Dashboard, SEO Optimization";
        }

        updateSession(from, {
            data: { features: featuresAnswer },
            stepIndex: 3
        });

        await safeSendReaction(conn, from, '⚡', mek.key);

        const step3Msg =
`${restartNote}✅ *Core Features:* සාර්ථකව සටහන් කරගත්තා!

━━━━━━━━━━━━━━━━━━━━━━━━
*පියවර 3/4: Design & UI/UX (පෙනුම සහ නිර්මාණය)*
Website එකේ Theme එක, Layout Style එක සහ පෙනුම කෙබඳු විය යුතුද?

💡 *උදාහරණ:*
• *Modern Minimalist:* Clean, spacious, sleek typography
• *Dark Theme:* Futuristic, Neon accents, Glassmorphism
• *Corporate/Business:* Professional, trust-building, elegant
• *E-Commerce Style:* Product-focused, high conversion layout
• *Color Palette:* (උදා: Deep Blue & White, Black & Gold, Vibrant Purple)
• *Responsive:* Mobile-First 100% Responsive with animations
━━━━━━━━━━━━━━━━━━━━━━━━`;

        await safeSendMessage(conn, from, { text: step3Msg }, { quoted: mek });
        return true;
    }

    // STEP 3: Design Answered ➔ Move to Step 4 (Deployment)
    if (session.stepIndex === 3) {
        let designAnswer = clean;
        if (/^(?:recommend|hithala danna|modern|lassana ekak|හිතලා දාන්න)$/i.test(lower)) {
            designAnswer = "Modern Minimalist Dark & Light Theme with Tailwind CSS and sleek animations";
        }

        updateSession(from, {
            data: { design: designAnswer },
            stepIndex: 4
        });

        await safeSendReaction(conn, from, '🎨', mek.key);

        const step4Msg =
`${restartNote}✅ *Design & UI/UX:* සටහන් කරගත්තා!

━━━━━━━━━━━━━━━━━━━━━━━━
*පියවර 4/4: Deployment & Hosting (හෝස්ටිං සහ ඩොමේන්)*
Website එක Host කිරීමට බලාපොරොත්තු වන Cloud Server එක සහ Domain මොනවාද?

💡 *උදාහරණ:*
• *Cloud Server:* Vercel, Netlify, Render, Railway
• *VPS / Dedicated:* Ubuntu VPS (DigitalOcean / AWS EC2) + Nginx
• *Traditional:* cPanel / Shared Hosting
• *Database Cloud:* MongoDB Atlas, Supabase, Firebase
• *Domain:* Custom Domain (.com / .lk / .org) + Cloudflare SSL
_(නිර්දේශ අවශ්‍ය නම් 'recommend' කියන්න)_
━━━━━━━━━━━━━━━━━━━━━━━━`;

        await safeSendMessage(conn, from, { text: step4Msg }, { quoted: mek });
        return true;
    }

    // STEP 4: Deployment Answered ➔ Move to Review & Approval
    if (session.stepIndex === 4) {
        let deployAnswer = clean;
        if (/^(?:recommend|hithala danna|hoda ekak|හිතලා දාන්න)$/i.test(lower)) {
            deployAnswer = "Frontend on Vercel + Backend on Render/Ubuntu VPS + MongoDB Atlas + Cloudflare SSL";
        }

        updateSession(from, {
            data: { deployment: deployAnswer },
            stepIndex: 5,
            state: 'awaiting_approval'
        });

        await safeSendReaction(conn, from, '📋', mek.key);

        const reviewCard =
`${restartNote}📋 *WEBSITE SPECIFICATION — REVIEW SUMMARY*
━━━━━━━━━━━━━━━━━━━━━━━━
📌 *පියවර සියල්ල සම්පූර්ණයි! ඔබ ලබාදුන් සම්පූර්ණ තොරතුරු පහත පරිදි වේ:*

🛠 *1. Tech Stack:*
${session.data.techStack}

⚡ *2. Core Features:*
${session.data.features}

🎨 *3. Design & UI/UX:*
${session.data.design}

🚀 *4. Deployment & Hosting:*
${deployAnswer}
━━━━━━━━━━━━━━━━━━━━━━━━
❓ *මෙම තොරතුරු සියල්ල නිවැරදිද?*

👉 මෙම සැලැස්ම අනුමත කර සම්පූර්ණ Architectural Blueprint එක generate කිරීමට:
   *'approve'* හෝ *'yes'* හෝ *'හරි'* කියන්න.

👉 යම් පියවරක් වෙනස් කිරීමට අවශ්‍ය නම්:
   *'edit'* හෝ *'change'* කියන්න.

👉 අත්හැරීමට:
   *'cancel'* කියන්න.
━━━━━━━━━━━━━━━━━━━━━━━━
_🔒 අනුමත වූ පසු මෙම Approved State එක Database එකෙහි ස්ථිරව සුරක්ෂිත වේ (Bot restart වුවද කිසිදා නැති නොවේ)._`;

        await safeSendMessage(conn, from, { text: reviewCard }, { quoted: mek });
        return true;
    }

    // STEP 5: Review & Approval Handling
    if (session.stepIndex === 5 || session.state === 'awaiting_approval') {
        // Handle Edit request
        if (/^(?:edit|change|වෙනස්\s*කරන්න|වෙනස්|modify)$/i.test(lower)) {
            const editPrompt =
`🔄 *වෙනස් කිරීමට අවශ්‍ය පියවර කුමක්ද?*

1: Tech Stack
2: Core Features
3: Design & UI/UX
4: Deployment & Hosting

_කරුණාකර අංකය (1, 2, 3 හෝ 4) එවන්න._`;
            await safeSendMessage(conn, from, { text: editPrompt }, { quoted: mek });
            return true;
        }

        // Handle step selection for edit
        if (/^[1-4]$/.test(lower) || /^(?:tech|features?|design|deploy|hosting)/i.test(lower)) {
            let targetStep = 1;
            if (lower === '1' || lower.includes('tech')) targetStep = 1;
            else if (lower === '2' || lower.includes('feature')) targetStep = 2;
            else if (lower === '3' || lower.includes('design')) targetStep = 3;
            else if (lower === '4' || lower.includes('deploy') || lower.includes('hosting')) targetStep = 4;

            updateSession(from, { stepIndex: targetStep, state: 'in_progress' });
            const stepNames = { 1: "Tech Stack", 2: "Core Features", 3: "Design & UI/UX", 4: "Deployment & Hosting" };
            await safeSendMessage(conn, from, {
                text: `✏️ *පියවර ${targetStep} (${stepNames[targetStep]}) වෙනස් කිරීම:*\nකරුණාකර නව තොරතුරු ඇතුළත් කරන්න:`
            }, { quoted: mek });
            return true;
        }

        // Handle Approval: "approve", "yes", "හරි", "ok", "confirm", "hari"
        if (/^(?:approve|approved|yes|ow|හරි|ඔව්|ok|okay|confirm|හරි\s*අනුමතයි|yes\s*approve)$/i.test(lower)) {
            await safeSendReaction(conn, from, '🚀', mek.key);
            await safeSendPresence(conn, 'composing', from);

            await safeSendMessage(conn, from, {
                text: `⏳ *ඔබගේ Website සැලැස්ම අනුමත විය! Principal Architect AI මඟින් සම්පූර්ණ Architecture Blueprint & Technical Guide සකස් කරමින් පවතී...*`
            }, { quoted: mek });

            // Generate comprehensive blueprint with Gemini AI
            const blueprint = await generateArchitectureBlueprint(session.data);

            // Permanently approve and persist into store/conversations.json
            const approvedProject = approveSession(from, blueprint);

            const approvedCard =
`✅ *WEBSITE SPECIFICATION APPROVED & SAVED!* 🚀
━━━━━━━━━━━━━━━━━━━━━━━━
🆔 *Project ID:* #${approvedProject.id}
📅 *Approved Date:* ${new Date(approvedProject.approvedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}
💾 *Storage Status:* ස්ථිරව සුරක්ෂිත කරන ලදී (Persistent Storage)
━━━━━━━━━━━━━━━━━━━━━━━━
${blueprint}
━━━━━━━━━━━━━━━━━━━━━━━━
🔒 *State Persistence Guarantee:*
Bot එක restart වුවද ඔබගේ මෙම Approved Project State එක කිසිදා අහිමි නොවේ!

🔍 ඕනෑම අවස්ථාවක මෙම Approved Project එක නැවත බැලීමට:
👉 *.myproject* හෝ *"මගේ website project එක"* කියන්න.
━━━━━━━━━━━━━━━━━━━━━━━━`;

            await safeSendMessage(conn, from, { text: approvedCard }, { quoted: mek });
            return true;
        }

        // If user said something else during approval state, gently prompt them
        const reminderMsg =
`⚠️ *කරුණාකර ඔබගේ තීරණය තහවුරු කරන්න:*

👉 අනුමත කිරීමට: *'approve'* හෝ *'yes'* හෝ *'හරි'* කියන්න.
👉 යම් පියවරක් සංස්කරණය කිරීමට: *'edit'* කියන්න.
👉 අවලංගු කිරීමට: *'cancel'* කියන්න.`;

        await safeSendMessage(conn, from, { text: reminderMsg }, { quoted: mek });
        return true;
    }

    return false;
}

// ==================== COMMAND REGISTRATIONS ====================

// 1. .website command
cmd({
    pattern: "website",
    alias: ["buildweb", "createweb", "webbuilder", "sitebuilder"],
    desc: "Start multi-step website builder conversation",
    category: "tools",
    react: "🌐",
    filename: __filename
}, async (conn, mek, m, baseOptions) => {
    const { from, reply } = baseOptions;
    const session = getActiveSession(from);

    if (session) {
        return reply(
            `⚠️ *ඔබට දැනටමත් ක්‍රියාකාරී Website Builder session එකක් පවතී (පියවර ${session.stepIndex}/4).*` +
            `\n\n• ඉදිරියට යාමට ඔබගේ පිළිතුර එවන්න.` +
            `\n• වත්මන් තත්ත්වය බැලීමට *.website status* කියන්න.` +
            `\n• අලුතින් පටන් ගැනීමට *.cancelweb* කියන්න.`
        );
    }

    await handleWebsiteBuilderMessage("website එකක් හදන්න", conn, mek, m, baseOptions);
});

// 2. .myproject command
cmd({
    pattern: "myproject",
    alias: ["myprojects", "myweb", "approvedproject", "webproject"],
    desc: "View approved persistent website projects",
    category: "tools",
    react: "📂",
    filename: __filename
}, async (conn, mek, m, baseOptions) => {
    const { from, q, reply } = baseOptions;
    const projects = getUserApprovedProjects(from);

    if (!projects || projects.length === 0) {
        return reply(
            `📌 *ඔබ මෙතෙක් අනුමත කළ (Approved) Website Projects කිසිවක් නැත.*\n\n` +
            `අලුත් එකක් සැලසුම් කිරීමට: *.website* හෝ *"website එකක් හදන්න"* කියන්න! 🚀`
        );
    }

    // If specific ID requested
    if (q) {
        const found = getApprovedProject(from, q);
        if (!found) {
            return reply(`❌ *Project ID #${q} හමු නොවීය.*`);
        }
        const card =
`📂 *WEBSITE PROJECT BLUEPRINT*
━━━━━━━━━━━━━━━━━━━━━━━━
🆔 *Project ID:* #${found.id}
📅 *Approved Date:* ${new Date(found.approvedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}
💾 *Status:* ස්ථිරව සුරක්ෂිතයි (Persistent in Database)
━━━━━━━━━━━━━━━━━━━━━━━━
🛠 *Tech Stack:* ${found.data.techStack}
⚡ *Features:* ${found.data.features}
🎨 *Design:* ${found.data.design}
🚀 *Deployment:* ${found.data.deployment}
━━━━━━━━━━━━━━━━━━━━━━━━
${found.approvedPlan}`;
        return reply(card);
    }

    // If multiple projects exist, show list
    if (projects.length > 1) {
        let listText = `📂 *ඔබගේ අනුමත WEBSITE PROJECTS ලැයිස්තුව (${projects.length})*\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        projects.forEach((p, idx) => {
            listText += `*${idx + 1}. Project ID:* #${p.id}\n`;
            listText += `   📅 ${new Date(p.approvedAt).toLocaleDateString()}\n`;
            listText += `   🛠 Stack: ${p.data.techStack}\n\n`;
        });
        listText += `━━━━━━━━━━━━━━━━━━━━━━━━\n_💡 සම්පූර්ණ Blueprint එක බැලීමට: *.myproject <Project ID>* එවන්න._`;
        return reply(listText);
    }

    // If single project, display it directly
    const latest = projects[0];
    const card =
`📂 *ඔබගේ අනුමත WEBSITE PROJECT BLUEPRINT*
━━━━━━━━━━━━━━━━━━━━━━━━
🆔 *Project ID:* #${latest.id}
📅 *Approved Date:* ${new Date(latest.approvedAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}
💾 *Status:* ස්ථිරව සුරක්ෂිතයි (Persistent in Database)
━━━━━━━━━━━━━━━━━━━━━━━━
🛠 *Tech Stack:* ${latest.data.techStack}
⚡ *Features:* ${latest.data.features}
🎨 *Design:* ${latest.data.design}
🚀 *Deployment:* ${latest.data.deployment}
━━━━━━━━━━━━━━━━━━━━━━━━
${latest.approvedPlan}
━━━━━━━━━━━━━━━━━━━━━━━━
_🔒 Bot එක restart වුවද මෙම Approved State එක කිසිදා මැකී යන්නේ නැත._`;
    return reply(card);
});

// 3. .cancelweb command
cmd({
    pattern: "cancelweb",
    alias: ["stopweb", "exitweb"],
    desc: "Cancel active website builder conversation",
    category: "tools",
    react: "❌",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const cancelled = cancelSession(from);
    if (cancelled) {
        return reply(`❌ *ක්‍රියාකාරී Website Builder conversation එක අවලංගු කරන ලදී.*`);
    } else {
        return reply(`ℹ️ *ඔබට දැනට ක්‍රියාකාරී Website Builder session එකක් නොමැත.*`);
    }
});

