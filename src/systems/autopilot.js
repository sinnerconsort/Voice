// Voice Extension - Autopilot
// Reads Lexicon's current scene type and swaps the full Voice stack
// (register + tempo + texture) when the scene changes.
//
// Manual override semantics: picking any tier or stack by hand pauses
// autopilot FOR THE CURRENT SCENE. When Lexicon detects a new scene
// type, autopilot resumes and swaps again.
//
// Requires Lexicon v2.1+ (window.LexiconAPI.getCurrentSceneType).
// Checked at generation time, not init — load order doesn't matter.

import { extensionSettings, chatState } from '../core/state.js';
import { saveChatState } from '../core/persistence.js';
import { TIERS } from '../core/config.js';
import { getProfile } from './library.js';
import { getPalette } from './palette.js';

// Lexicon scene type → palette override key
const SCENE_TO_OVERRIDE = { action: 'violence', intimate: 'intimacy' };

// ═══════════════════════════════════════
// SCENE → STACK MAPPING
// ═══════════════════════════════════════
// Keys match Lexicon's SCENE_TYPES. Values are Voice profile IDs.
// Tweak these to taste — any register/tempo/texture ID in your
// library works, including custom ones.

export const SCENE_STACKS = {
    social: {
        register: 'sediment',          // drama, subtext, interpersonal
        tempo: 'syncopation',          // irregular, surprising
        texture: 'parlour_warfare',    // formal, verbal, cutting
        label: '💬 Social',
    },
    private: {
        register: 'domestic',          // mundane, warm, quiet
        tempo: 'diminuendo',           // cooling, receding, aftermath
        texture: 'bare_stage',         // minimal, stripped
        label: '🌙 Private',
    },
    investigation: {
        register: 'palimpsest',        // mystery, layers, secrets
        tempo: 'syncopation',          // off-rhythm discovery
        texture: 'telescoping',        // zoom in, zoom out
        label: '🔍 Investigation',
    },
    action: {
        register: 'havoc',             // combat, kinetic, spatial
        tempo: 'pulp',                 // fast, sharp, punchy
        texture: 'somatic_ledger',     // body-first, visceral
        label: '⚔️ Action',
    },
    intimate: {
        register: 'heartthrob',        // yearning, desire
        tempo: 'sustained',            // flowing, hypnotic
        texture: 'ritual_surrender',   // slow, devotional
        label: '💛 Intimate',
    },
    ritual: {
        register: 'gravitas',          // continuity, consequence
        tempo: 'diminuendo',           // quiet processing
        texture: 'refrain',            // repetition, callback
        label: '🕯️ Ritual',
    },
};

// ═══════════════════════════════════════
// CORE
// ═══════════════════════════════════════

/**
 * Is autopilot currently able to run?
 * Lexicon presence is checked live so load order never matters.
 */
export function isAutopilotAvailable() {
    return typeof window.LexiconAPI?.getCurrentSceneType === 'function'
        && window.LexiconAPI?.isActive?.() === true;
}

/**
 * Get current autopilot status for UI display.
 */
export function getAutopilotStatus() {
    return {
        enabled: extensionSettings.autopilot === true,
        available: isAutopilotAvailable(),
        paused: chatState.autoPaused === true,
        scene: chatState.lastAutoScene || null,
        sceneLabel: chatState.lastAutoScene
            ? (SCENE_STACKS[chatState.lastAutoScene]?.label || chatState.lastAutoScene)
            : null,
    };
}

/**
 * Toggle autopilot on/off (global setting).
 * Turning it on clears any pause so it engages on the next generation.
 */
export function setAutopilot(on) {
    extensionSettings.autopilot = !!on;
    if (on) {
        chatState.autoPaused = false;
        chatState.lastAutoScene = null; // force re-apply on next generation
        saveChatState();
    }
}

/**
 * Called from stacks.js when the user manually changes anything.
 * Pauses autopilot for the current scene — it resumes when the
 * scene type changes.
 */
export function pauseForManualOverride() {
    if (extensionSettings.autopilot !== true) return;
    if (chatState.autoPaused === true) return;
    chatState.autoPaused = true;
    saveChatState();
    if (typeof toastr !== 'undefined') {
        toastr.info('You took the wheel — autopilot resumes on the next scene change', '🎙️ Voice', { timeOut: 3500 });
    }
}

/**
 * Apply the mapped stack for a scene type directly to chat state.
 * Deliberately bypasses setActiveTier/activateStack so it doesn't
 * trigger the manual-override pause. Skips any profile ID that
 * doesn't exist in the library (e.g. user deleted a default).
 */
function applySceneStack(sceneType) {
    const map = SCENE_STACKS[sceneType];
    if (!map) return false;

    // Soul palette scene overrides: a world's compiled palette may pin one
    // tier for violence/intimacy scenes (e.g. "violence is slow and visceral"
    // → texture: somatic_ledger). Override is applied on top of the mapping.
    const effective = { register: map.register, tempo: map.tempo, texture: map.texture };
    const overrideKey = SCENE_TO_OVERRIDE[sceneType];
    const palette = getPalette();
    if (overrideKey && palette?.sceneOverrides?.[overrideKey]) {
        const ov = palette.sceneOverrides[overrideKey];
        for (const type of ['register', 'tempo', 'texture']) {
            if (ov[type]) effective[type] = ov[type];
        }
    }

    const reg = getProfile(TIERS.REGISTER, effective.register);
    const tmp = getProfile(TIERS.TEMPO, effective.tempo);
    const tex = getProfile(TIERS.TEXTURE, effective.texture);

    // If the entire mapped stack is missing from the library, bail
    if (!reg && !tmp && !tex) return false;

    chatState.activeRegister = reg ? effective.register : null;
    chatState.activeTempo = tmp ? effective.tempo : null;
    chatState.activeTexture = tex ? effective.texture : null;
    chatState.activeStackId = null;
    saveChatState();
    return true;
}

/**
 * Main entry point — call on GENERATION_STARTED, before injectVoice().
 * Returns true if a swap happened (so the caller can refresh UI).
 */
export function runAutopilot() {
    if (extensionSettings.autopilot !== true) return false;
    if (!isAutopilotAvailable()) return false;

    let scene = null;
    try {
        scene = window.LexiconAPI.getCurrentSceneType();
    } catch (e) {
        console.warn('[Voice] Autopilot scene fetch failed:', e);
        return false;
    }

    if (!scene) return false;

    // Same scene as last applied — nothing to do.
    // (This is also what keeps a manual override sticky: while the
    // scene doesn't change, we never touch the user's picks.)
    if (scene === chatState.lastAutoScene) return false;

    // Scene changed — autopilot resumes even if it was paused.
    chatState.lastAutoScene = scene;
    chatState.autoPaused = false;

    const applied = applySceneStack(scene);
    if (applied) {
        const label = SCENE_STACKS[scene]?.label || scene;
        if (typeof toastr !== 'undefined') {
            toastr.info(`Scene shift → ${label}`, '🎙️ Voice Autopilot', { timeOut: 3000 });
        }
        console.log(`[Voice] Autopilot swapped stack for scene: ${scene}`);
    } else {
        saveChatState(); // still persist lastAutoScene
    }
    return applied;
}
