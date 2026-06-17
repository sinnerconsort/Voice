// Voice Extension - Prompt Injection
import { setExtensionPrompt, extension_prompt_types } from '../../../../../../script.js';
import { INJECTION_ID, TIERS } from '../core/config.js';
import { chatState, extensionSettings } from '../core/state.js';
import { getProfile } from './library.js';
import { getPalette, computeSoulStack, shouldIncludeFlavor, markFlavorInjected } from './palette.js';
import { buildFloorInjection } from './floor.js';

/**
 * Build the per-scene [VOICE DIRECTIVE] block from the active selections.
 * Returns '' when nothing scene-level is active.
 */
function buildDirective() {
    let register = getProfile(TIERS.REGISTER, chatState.activeRegister);
    let tempo = getProfile(TIERS.TEMPO, chatState.activeTempo);
    let texture = getProfile(TIERS.TEXTURE, chatState.activeTexture);

    const palette = getPalette();

    // Soul default: when nothing is active, the world's soul stack fills in.
    // An explicit pick or stack always wins — this only shapes the default.
    if (!register && !tempo && !texture && palette && extensionSettings.useSoulDefault) {
        const soul = computeSoulStack(palette);
        register = getProfile(TIERS.REGISTER, soul.register);
        tempo = getProfile(TIERS.TEMPO, soul.tempo);
        texture = getProfile(TIERS.TEXTURE, soul.texture);
    }

    if (!register && !tempo && !texture && !(palette?.flavor?.length)) return '';

    const parts = [];

    // Header
    parts.push('[VOICE DIRECTIVE]');

    // World soul flavor (≤2 lines, ≤25 tokens)
    if (palette && shouldIncludeFlavor()) {
        parts.push(`World soul: ${palette.flavor.join(' ')}`);
    }

    if (register) {
        parts.push(`Scene register — ${register.name}: ${register.injection}`);
    }

    if (tempo) {
        parts.push(`Prose tempo — ${tempo.name}: ${tempo.injection}`);
    }

    if (texture) {
        parts.push(`Prose texture — ${texture.name}: ${texture.injection}`);
    }

    // Nothing actually made it in (e.g. palette present but flavor off,
    // no active picks) — inject nothing rather than an empty shell.
    if (parts.length === 1) return '';

    parts.push('[/VOICE DIRECTIVE]');

    return parts.join('\n');
}

/**
 * The full Voice injection: the per-scene directive (if any) plus the always-on
 * prose floor (if enabled). Either can be empty; the floor stands alone when no
 * scene voice is active. Returns '' only when both are empty.
 *
 * Target: ~30-80 tokens for the directive, ~20-60 for a full floor.
 */
export function buildInjection() {
    const directive = buildDirective();
    const floor = buildFloorInjection();
    return [directive, floor].filter(Boolean).join('\n');
}

/**
 * Inject the current Voice directive into the prompt.
 * Called on GENERATION_STARTED.
 */
export function injectVoice() {
    if (!extensionSettings.enabled) {
        clearInjection();
        return;
    }

    const injection = buildInjection();

    if (!injection) {
        clearInjection();
        return;
    }

    // Track flavor delivery for sceneChange mode
    if (injection.includes('World soul:')) {
        markFlavorInjected();
    }

    setExtensionPrompt(
        INJECTION_ID,
        injection,
        extension_prompt_types.IN_CHAT,
        1,      // depth 1 = before the last user message
        false   // not a separator
    );
}

/**
 * Clear the Voice injection.
 */
export function clearInjection() {
    setExtensionPrompt(
        INJECTION_ID,
        '',
        extension_prompt_types.IN_CHAT,
        1,
        false
    );
}

/**
 * Get a preview of what would be injected (for UI display).
 */
export function getInjectionPreview() {
    const injection = buildInjection();
    if (!injection) return { text: 'No voice active', tokens: 0 };

    // Rough token estimate (~4 chars per token)
    const tokens = Math.ceil(injection.length / 4);

    return { text: injection, tokens };
}
