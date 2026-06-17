// Voice Extension - State Management
import { EXT_ID } from './config.js';

// ═══════════════════════════════════════
// GLOBAL SETTINGS (persisted)
// ═══════════════════════════════════════

export let extensionSettings = {
    settingsVersion: 1,
    enabled: true,

    // Autopilot: Lexicon scene type drives full stack swaps
    autopilot: false,

    // Profile libraries (defaults + user-added)
    registers: [],
    tempos: [],
    textures: [],

    // Saved stacks
    stacks: [],

    // Soul palettes (per-world, keyed by character avatar / group id)
    palettes: {},
    useSoulDefault: true,            // soul stack fills in when nothing is active
    paletteCompileProfile: 'current',
    paletteTokenBudget: 2000,

    // Prose Floor: always-on craft rules injected beneath the scene picks
    proseFloor: {
        enabled: true,
        groups: []   // seeded from data/floor.js via initFloor()
    },

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
    recentTextures: [],

    // Autopilot tracking
    lastAutoScene: null,
    autoPaused: false,

    // Soul palette flavor tracking (sceneChange mode)
    lastFlavorRegister: null
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
        recentTextures: [],
        lastAutoScene: null,
        autoPaused: false,
        lastFlavorRegister: null
    };
}
