// Voice Extension - Persistence
import { extension_settings } from '../../../../../extensions.js';
import { chat_metadata, saveSettingsDebounced, saveChatDebounced } from '../../../../../../script.js';
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

// ═══════════════════════════════════════
// MIGRATIONS
// ═══════════════════════════════════════

/**
 * v1.2.1 — append the six new default profiles + two stacks to existing
 * installs. Version-gated and id-checked, so user edits are untouched and
 * deliberately deleted OLD defaults are never resurrected (only ids
 * introduced in this migration are eligible).
 */
export function migrateLibraries(defaultRegisters, defaultTempos, defaultTextures, defaultStacks) {
    const NEW_IDS_V2 = {
        registers: ['havoc', 'fathom'],
        textures: ['crosstalk', 'genius_loci', 'cold_arithmetic', 'undertow'],
        stacks: ['deep_water', 'donnybrook'],
    };

    if ((extensionSettings.settingsVersion || 1) >= 2) return;

    let added = 0;
    const appendMissing = (list, defaults, ids) => {
        for (const id of ids) {
            if (list.find(x => x.id === id)) continue;
            const def = defaults.find(x => x.id === id);
            if (def) { list.push({ ...def }); added++; }
        }
    };

    appendMissing(extensionSettings.registers, defaultRegisters, NEW_IDS_V2.registers);
    appendMissing(extensionSettings.textures, defaultTextures, NEW_IDS_V2.textures);
    appendMissing(extensionSettings.stacks, defaultStacks, NEW_IDS_V2.stacks);

    extensionSettings.settingsVersion = 2;
    saveSettings();
    if (added && typeof toastr !== 'undefined') {
        toastr.info(`Library grew: ${added} new profiles/stacks (HAVOC, FATHOM, CROSSTALK, GENIUS LOCI, COLD ARITHMETIC, UNDERTOW)`, '🎙️ Voice', { timeOut: 6000 });
    }
}
