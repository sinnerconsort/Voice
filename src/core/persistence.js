// Voice Extension - Persistence
import { extension_settings } from '../../../../extensions.js';
import { chat_metadata, saveSettingsDebounced, saveChatDebounced } from '../../../../../script.js';
import { EXT_ID } from './config.js';
import {
    extensionSettings, setExtensionSettings,
    chatState, setChatState, resetChatState
} from './state.js';

// ═══════════════════════════════════════
// GLOBAL SETTINGS
// ═══════════════════════════════════════

export function loadSettings() {
    if (!extension_settings[EXT_ID]) {
        extension_settings[EXT_ID] = {};
    }

    const saved = extension_settings[EXT_ID];

    // Merge saved into defaults (preserving defaults for missing keys)
    const merged = { ...extensionSettings };
    for (const key of Object.keys(merged)) {
        if (saved[key] !== undefined) {
            merged[key] = saved[key];
        }
    }

    setExtensionSettings(merged);
    extension_settings[EXT_ID] = merged;
}

export function saveSettings() {
    extension_settings[EXT_ID] = { ...extensionSettings };
    saveSettingsDebounced();
}

// ═══════════════════════════════════════
// PER-CHAT STATE
// ═══════════════════════════════════════

export function loadChatState() {
    if (!chat_metadata || !chat_metadata[EXT_ID]) {
        resetChatState();
        return;
    }

    const saved = chat_metadata[EXT_ID];
    const merged = { ...chatState };
    for (const key of Object.keys(merged)) {
        if (saved[key] !== undefined) {
            merged[key] = saved[key];
        }
    }
    setChatState(merged);
}

export function saveChatState() {
    if (!chat_metadata) return;
    chat_metadata[EXT_ID] = { ...chatState };
    saveChatDebounced();
}

// ═══════════════════════════════════════
// LIBRARY MANAGEMENT
// ═══════════════════════════════════════

/**
 * Initialize the profile libraries from defaults if empty.
 * Called once during extension init.
 */
export function initLibraries(defaultRegisters, defaultTempos, defaultTextures) {
    let changed = false;

    if (!extensionSettings.registers || extensionSettings.registers.length === 0) {
        extensionSettings.registers = [...defaultRegisters];
        changed = true;
    }
    if (!extensionSettings.tempos || extensionSettings.tempos.length === 0) {
        extensionSettings.tempos = [...defaultTempos];
        changed = true;
    }
    if (!extensionSettings.textures || extensionSettings.textures.length === 0) {
        extensionSettings.textures = [...defaultTextures];
        changed = true;
    }

    if (changed) {
        saveSettings();
    }
}

/**
 * Initialize saved stacks from defaults if empty.
 */
export function initStacks(defaultStacks) {
    if (!extensionSettings.stacks || extensionSettings.stacks.length === 0) {
        extensionSettings.stacks = [...defaultStacks];
        saveSettings();
    }
}
