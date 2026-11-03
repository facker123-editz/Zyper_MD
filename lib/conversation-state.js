// lib/conversation-state.js - Persistent Multi-Step Conversation State Manager for KHAN-MD
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store directory and file path
const STORE_DIR = path.join(__dirname, '../store');
const DB_FILE = path.join(STORE_DIR, 'conversations.json');
const BACKUP_FILE = path.join(STORE_DIR, 'conversations.backup.json');

// Session expiry for IN-PROGRESS conversations: 48 hours of inactivity
// Note: Approved projects NEVER expire and are stored permanently!
const IN_PROGRESS_TIMEOUT_MS = 48 * 60 * 60 * 1000;

/**
 * Ensure store directory exists
 */
function ensureStoreDir() {
    try {
        if (!fs.existsSync(STORE_DIR)) {
            fs.mkdirSync(STORE_DIR, { recursive: true });
        }
    } catch (e) {
        console.error('[ConvState] Error creating store dir:', e.message);
    }
}

/**
 * Safely load the conversations database from disk
 */
export function loadDatabase() {
    ensureStoreDir();
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            if (raw && raw.trim()) {
                const data = JSON.parse(raw);
                return {
                    activeSessions: data.activeSessions || {},
                    approvedProjects: data.approvedProjects || {}
                };
            }
        }
    } catch (err) {
        console.error('[ConvState] Error reading conversations.json, trying backup:', err.message);
        // Try fallback to backup if main file was corrupted
        try {
            if (fs.existsSync(BACKUP_FILE)) {
                const backupRaw = fs.readFileSync(BACKUP_FILE, 'utf8');
                if (backupRaw && backupRaw.trim()) {
                    const data = JSON.parse(backupRaw);
                    return {
                        activeSessions: data.activeSessions || {},
                        approvedProjects: data.approvedProjects || {}
                    };
                }
            }
        } catch (backupErr) {
            console.error('[ConvState] Error reading backup file:', backupErr.message);
        }
    }

    return {
        activeSessions: {},
        approvedProjects: {}
    };
}

/**
 * Safely save the conversations database to disk atomically
 */
export function saveDatabase(data) {
    ensureStoreDir();
    try {
        const payload = JSON.stringify({
            activeSessions: data.activeSessions || {},
            approvedProjects: data.approvedProjects || {},
            lastSavedAt: new Date().toISOString()
        }, null, 2);

        // Atomic write: write to temp file first, then replace
        const tempFile = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempFile, payload, 'utf8');
        fs.renameSync(tempFile, DB_FILE);

        // Periodically update backup file
        try {
            fs.writeFileSync(BACKUP_FILE, payload, 'utf8');
        } catch (_) {}

        return true;
    } catch (err) {
        console.error('[ConvState] Error saving conversations.json:', err.message);
        return false;
    }
}

/**
 * Clean up expired in-progress sessions (approved projects are NEVER removed)
 */
function cleanupExpiredSessions(db) {
    const now = Date.now();
    let modified = false;

    for (const userId in db.activeSessions) {
        const session = db.activeSessions[userId];
        if (session && session.updatedAt && (now - session.updatedAt > IN_PROGRESS_TIMEOUT_MS)) {
            console.log(`[ConvState] Removing expired in-progress session for ${userId}`);
            delete db.activeSessions[userId];
            modified = true;
        }
    }

    if (modified) {
        saveDatabase(db);
    }
}

/**
 * Check if user has an active in-progress conversation
 */
export function hasActiveSession(userId) {
    if (!userId) return false;
    const db = loadDatabase();
    cleanupExpiredSessions(db);
    return !!db.activeSessions[userId];
}

/**
 * Retrieve active session for a user (or null if none)
 */
export function getActiveSession(userId) {
    if (!userId) return null;
    const db = loadDatabase();
    cleanupExpiredSessions(db);
    return db.activeSessions[userId] || null;
}

/**
 * Start a new multi-step conversation session
 */
export function startSession(userId, flow = 'website_builder', initialData = {}) {
    if (!userId) return null;
    const db = loadDatabase();

    const newSession = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: userId,
        flow: flow,
        stepIndex: 1, // 1: techStack, 2: features, 3: design, 4: deployment, 5: review/approval
        state: 'in_progress', // 'in_progress' | 'awaiting_approval'
        data: {
            techStack: '',
            features: '',
            design: '',
            deployment: '',
            ...initialData
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        restoredFromRestart: false
    };

    db.activeSessions[userId] = newSession;
    saveDatabase(db);
    console.log(`[ConvState] New ${flow} session started for ${userId}`);
    return newSession;
}

/**
 * Update an active session with new data, next step, and timestamp
 */
export function updateSession(userId, updates = {}) {
    if (!userId) return null;
    const db = loadDatabase();
    const session = db.activeSessions[userId];

    if (!session) return null;

    if (updates.data) {
        session.data = { ...session.data, ...updates.data };
    }
    if (typeof updates.stepIndex === 'number') {
        session.stepIndex = updates.stepIndex;
    }
    if (updates.state) {
        session.state = updates.state;
    }
    if (updates.flow) {
        session.flow = updates.flow;
    }

    session.updatedAt = Date.now();
    db.activeSessions[userId] = session;
    saveDatabase(db);
    return session;
}

/**
 * Cancel and delete an active session
 */
export function cancelSession(userId) {
    if (!userId) return false;
    const db = loadDatabase();
    if (db.activeSessions[userId]) {
        delete db.activeSessions[userId];
        saveDatabase(db);
        console.log(`[ConvState] Cancelled session for ${userId}`);
        return true;
    }
    return false;
}

/**
 * Generate a friendly human-readable Project ID
 * e.g., WEB-2026-X82F
 */
function generateProjectId(prefix = 'WEB') {
    const year = new Date().getFullYear();
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${year}-${randomHex}`;
}

/**
 * Mark active session as APPROVED, save into approvedProjects permanently,
 * and clear active in-progress session.
 */
export function approveSession(userId, approvedBlueprint) {
    if (!userId) return null;
    const db = loadDatabase();
    const active = db.activeSessions[userId];

    if (!active) return null;

    const projectId = generateProjectId(active.flow === 'website_builder' ? 'WEB' : 'PRJ');
    const approvedRecord = {
        id: projectId,
        userId: userId,
        flow: active.flow,
        data: { ...active.data },
        approvedPlan: approvedBlueprint || '',
        approvedAt: new Date().toISOString(),
        approvedTimestamp: Date.now(),
        status: 'approved'
    };

    if (!Array.isArray(db.approvedProjects[userId])) {
        db.approvedProjects[userId] = [];
    }

    // Save permanently!
    db.approvedProjects[userId].push(approvedRecord);

    // Delete in-progress session since it's now completed and approved
    delete db.activeSessions[userId];

    saveDatabase(db);
    console.log(`[ConvState] Session APPROVED and permanently saved as ${projectId} for ${userId}`);
    return approvedRecord;
}

/**
 * Get all approved projects for a user
 */
export function getUserApprovedProjects(userId) {
    if (!userId) return [];
    const db = loadDatabase();
    return db.approvedProjects[userId] || [];
}

/**
 * Get a specific approved project by ID or the most recent one
 */
export function getApprovedProject(userId, projectId = null) {
    const list = getUserApprovedProjects(userId);
    if (!list || list.length === 0) return null;

    if (!projectId) {
        // Return latest approved project
        return list[list.length - 1];
    }

    const cleanId = projectId.trim().toUpperCase().replace(/^#/, '');
    return list.find(p => p.id.toUpperCase() === cleanId) || null;
}

/**
 * Delete an approved project if user specifically requests
 */
export function deleteApprovedProject(userId, projectId) {
    if (!userId || !projectId) return false;
    const db = loadDatabase();
    const list = db.approvedProjects[userId];
    if (!Array.isArray(list)) return false;

    const cleanId = projectId.trim().toUpperCase().replace(/^#/, '');
    const index = list.findIndex(p => p.id.toUpperCase() === cleanId);
    if (index > -1) {
        list.splice(index, 1);
        db.approvedProjects[userId] = list;
        saveDatabase(db);
        return true;
    }
    return false;
}

export default {
    loadDatabase,
    saveDatabase,
    hasActiveSession,
    getActiveSession,
    startSession,
    updateSession,
    cancelSession,
    approveSession,
    getUserApprovedProjects,
    getApprovedProject,
    deleteApprovedProject
};

