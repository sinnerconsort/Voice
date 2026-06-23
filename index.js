// ═══════════════════════════════════════════════════════════════
// VOICE — Prose Direction Extension for SillyTavern
// v1.3.1 — VoiceAPI (read surface for other extensions) + prose floor
//
// Three-tier prose direction: Register + Tempo + Texture
// Manual selection with saved stack combos.
// Lean injection (~30-80 tokens) to guide writing style
// without competing with character cards or presets.
// ═══════════════════════════════════════════════════════════════

import {
    getContext,
    extension_settings
} from '../../../extensions.js';

import {
    eventSource,
    event_types
} from '../../../../script.js';

// Core
import { EXT_NAME, EXT_ID, EXT_VERSION, TIERS } from './src/core/config.js';
import { extensionSettings, chatState } from './src/core/state.js';
import { loadSettings, saveSettings, loadChatState, saveChatState, initLibraries, initStacks, initFloor, migrateLibraries } from './src/core/persistence.js';

// Data (defaults)
import { DEFAULT_REGISTERS } from './src/data/registers.js';
import { DEFAULT_TEMPOS } from './src/data/tempos.js';
import { DEFAULT_TEXTURES } from './src/data/textures.js';
import { DEFAULT_STACKS } from './src/core/config.js';
import { DEFAULT_FLOOR_GROUPS } from './src/data/floor.js';

// Systems
import { injectVoice, clearInjection, buildInjection, buildDirective } from './src/systems/injection.js';
import { buildFloorInjection } from './src/systems/floor.js';
import { getActiveCombo } from './src/systems/stacks.js';
import { getProfile } from './src/systems/library.js';
import { runAutopilot, applyVadTempo } from './src/systems/autopilot.js';
import { createFAB, createPanel, renderAll, updateFABIndicator, destroyUI } from './src/systems/ui.js';

// ═══════════════════════════════════════
// SETTINGS PANEL (Extensions tab)
// ═══════════════════════════════════════

async function addExtensionSettings() {
    const html = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>🎙️ Voice</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div style="padding: 4px 0;">
                    <label class="checkbox_label" style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="voice-enabled" ${extensionSettings.enabled ? 'checked' : ''}>
                        <span>Enable Voice</span>
                    </label>
                    <p style="font-size: 11px; opacity: 0.6; margin: 4px 0;">
                        Three-tier prose direction: Register (scene shape) + Tempo (rhythm) + Texture (sentence feel).
                        Tap the 🎙️ button to pick a voice stack or build a custom combo.
                    </p>
                </div>
            </div>
        </div>
    `;

    $('#extensions_settings2').append(html);

    $('#voice-enabled').on('change', function() {
        extensionSettings.enabled = $(this).prop('checked');
        saveSettings();

        if (extensionSettings.enabled) {
            initUI();
        } else {
            clearInjection();
            destroyUI();
        }
    });
}

// ═══════════════════════════════════════
// UI INITIALIZATION
// ═══════════════════════════════════════

function initUI() {
    createFAB();
    createPanel();
    updateFABIndicator();
}

// ═══════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════

function onChatChanged() {
    loadChatState();
    if (extensionSettings.enabled) {
        renderAll();
        updateFABIndicator();
    }
}

function onGenerationStarted() {
    if (extensionSettings.enabled) {
        // Autopilot first — if the scene changed, swap the stack so
        // this generation uses the new voice.
        try {
            const swapped = runAutopilot();
            if (swapped) {
                renderAll();
                updateFABIndicator();
            }
        } catch (e) {
            console.warn('[Voice] Autopilot error (continuing with current stack):', e);
        }
        // VAD: let the character's arousal modulate pace this generation.
        try {
            if (applyVadTempo()) {
                renderAll();
                updateFABIndicator();
            }
        } catch (e) {
            console.warn('[Voice] VAD tempo error (continuing):', e);
        }
        injectVoice();
    }
}

function registerEvents() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
}

// ═══════════════════════════════════════
// MAIN INITIALIZATION
// ═══════════════════════════════════════

jQuery(async () => {
    try {
        console.log(`[${EXT_NAME}] Starting initialization...`);

        // 1. Load global settings
        try {
            loadSettings();
        } catch (e) {
            console.error(`[${EXT_NAME}] Settings load failed:`, e);
        }

        // 2. Initialize default libraries (only if empty)
        try {
            initLibraries(DEFAULT_REGISTERS, DEFAULT_TEMPOS, DEFAULT_TEXTURES);
            initStacks(DEFAULT_STACKS);
            initFloor(DEFAULT_FLOOR_GROUPS);
            migrateLibraries(DEFAULT_REGISTERS, DEFAULT_TEMPOS, DEFAULT_TEXTURES, DEFAULT_STACKS);
        } catch (e) {
            console.error(`[${EXT_NAME}] Library init failed:`, e);
        }

        // 3. Add settings panel to Extensions tab
        try {
            await addExtensionSettings();
        } catch (e) {
            console.error(`[${EXT_NAME}] Settings panel failed:`, e);
        }

        // 4. Register events (always — even if disabled, for chat switch tracking)
        try {
            registerEvents();
        } catch (e) {
            console.error(`[${EXT_NAME}] Event registration failed:`, e);
            throw e;
        }

        // 5. Initialize UI if enabled
        if (extensionSettings.enabled) {
            try {
                initUI();
            } catch (e) {
                console.error(`[${EXT_NAME}] UI init failed:`, e);
            }
        }

        // 6. Load per-chat state if a chat exists
        try {
            const ctx = getContext();
            if (ctx?.chat?.length > 0) {
                loadChatState();
                if (extensionSettings.enabled) {
                    renderAll();
                    updateFABIndicator();
                }
            }
        } catch (e) {
            console.error(`[${EXT_NAME}] Chat state load failed:`, e);
        }

        // 7. Expose for debugging (address bar: javascript:Voice.getState())
        window.Voice = {
            getState: () => ({ settings: extensionSettings, chat: chatState }),
            getLibrary: () => ({
                registers: extensionSettings.registers,
                tempos: extensionSettings.tempos,
                textures: extensionSettings.textures
            }),
            getStacks: () => extensionSettings.stacks,
            getPalettes: () => extensionSettings.palettes,
            getFloor: () => extensionSettings.proseFloor
        };

        // ── Public read API for the suite (Palimpsest, Codex, Chronicler…) ──
        // Mirrors LexiconAPI/CodexAPI conventions: isActive() + camelCase getters.
        // All getters are defensive and return '' / safe shapes, never throw.
        window.VoiceAPI = {
            version: EXT_VERSION,

            // Is Voice enabled and able to contribute direction this turn?
            isActive: () => extensionSettings.enabled === true,

            // Full prose direction for this turn: scene directive + always-on
            // floor. '' when nothing is active. This is the string a consumer
            // appends to its own generation prompt.
            getInjection: () => { try { return buildInjection() || ''; } catch (e) { return ''; } },

            // Just the per-scene [VOICE DIRECTIVE] block ('' if no scene voice).
            getDirective: () => { try { return buildDirective() || ''; } catch (e) { return ''; } },

            // Just the always-on [PROSE FLOOR] block ('' if floor off/empty).
            getFloor: () => { try { return buildFloorInjection() || ''; } catch (e) { return ''; } },

            // Structured snapshot for display/logic (names + ids, never throws).
            getActiveVoice: () => {
                try {
                    const combo = getActiveCombo();
                    const reg = getProfile(TIERS.REGISTER, combo.register);
                    const tmp = getProfile(TIERS.TEMPO, combo.tempo);
                    const tex = getProfile(TIERS.TEXTURE, combo.texture);
                    return {
                        isEmpty: !!combo.isEmpty,
                        stackId: combo.stackId || null,
                        register: reg ? { id: reg.id, name: reg.name } : null,
                        tempo:    tmp ? { id: tmp.id, name: tmp.name } : null,
                        texture:  tex ? { id: tex.id, name: tex.name } : null,
                        floorEnabled: !!(extensionSettings.proseFloor && extensionSettings.proseFloor.enabled)
                    };
                } catch (e) {
                    return { isEmpty: true, stackId: null, register: null, tempo: null, texture: null, floorEnabled: false };
                }
            }
        };

        console.log(`[${EXT_NAME}] ✅ Loaded successfully`);

    } catch (e) {
        console.error(`[${EXT_NAME}] ❌ Critical failure:`, e);
        toastr.error(
            'Voice failed to initialize. Check console.',
            'Voice Error',
            { timeOut: 10000 }
        );
    }
});
