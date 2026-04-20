// Voice Extension - State Management
import { EXT_ID } from './config.js';

// ═══════════════════════════════════════
// GLOBAL SETTINGS (persisted)
// ═══════════════════════════════════════

export let extensionSettings = {
    settingsVersion: 1,
    enabled: true,

    // Profile libraries (defaults + user-added)
    registers: [],
    tempos: [],
    textures: [],

    // Saved stacks
    stacks: [],

    // UI state
    panelOpen: false,
    activeTab: 'stacks',

    // FAB position
    fabPosition: {
        top: 'calc(var(--topBarBlockSize) + 120px)',
        right: '12px'
    }
};

// ═══════════════════════════════════════
// PER-CHAT STATE
// ═══════════════════════════════════════

export let chatState = {
    // Currently active selections (by ID)
    activeRegister: null,
    activeTempo: null,
    activeTexture: null,

    // If using a saved stack, its ID
    activeStackId: null,

    // History of recent selections for anti-repetition
    recentRegisters: [],
    recentTempos: [],
    recentTextures: []
};

// ═══════════════════════════════════════
// RUNTIME FLAGS (not persisted)
// ═══════════════════════════════════════

export let isEnabled = true;
export let isPanelOpen = false;

// ═══════════════════════════════════════
// SETTERS
// ═══════════════════════════════════════

export function setExtensionSettings(val) { extensionSettings = val; }
export function setChatState(val) { chatState = val; }
export function setIsEnabled(val) { isEnabled = val; }
export function setIsPanelOpen(val) { isPanelOpen = val; }

export function resetChatState() {
    chatState = {
        activeRegister: null,
        activeTempo: null,
        activeTexture: null,
        activeStackId: null,
        recentRegisters: [],
        recentTempos: [],
        recentTextures: []
    };
}
