// ═══════════════════════════════════════════════════════════════
// VOICE — Prose Direction Extension for SillyTavern
// v1.0.0
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
import { EXT_NAME, EXT_ID } from './src/core/config.js';
import { extensionSettings, chatState } from './src/core/state.js';
import { loadSettings, saveSettings, loadChatState, saveChatState, initLibraries, initStacks } from './src/core/persistence.js';

// Data (defaults)
import { DEFAULT_REGISTERS } from './src/data/registers.js';
import { DEFAULT_TEMPOS } from './src/data/tempos.js';
import { DEFAULT_TEXTURES } from './src/data/textures.js';
import { DEFAULT_STACKS } from './src/core/config.js';

// Systems
import { injectVoice, clearInjection } from './src/systems/injection.js';
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
            getStacks: () => extensionSettings.stacks
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
