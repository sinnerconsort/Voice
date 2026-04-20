// Voice Extension - Stack Management
import { extensionSettings, chatState } from '../core/state.js';
import { saveSettings, saveChatState } from '../core/persistence.js';

/**
 * Get all saved stacks.
 */
export function getStacks() {
    return extensionSettings.stacks || [];
}

/**
 * Get a stack by ID.
 */
export function getStack(id) {
    return getStacks().find(s => s.id === id) || null;
}

/**
 * Activate a saved stack — sets all three tiers at once.
 */
export function activateStack(stackId) {
    const stack = getStack(stackId);
    if (!stack) return false;

    chatState.activeRegister = stack.register || null;
    chatState.activeTempo = stack.tempo || null;
    chatState.activeTexture = stack.texture || null;
    chatState.activeStackId = stackId;

    saveChatState();
    return true;
}

/**
 * Set a single tier manually. Clears activeStackId since
 * the user is now in custom mode.
 */
export function setActiveTier(tier, profileId) {
    switch (tier) {
        case 'register': chatState.activeRegister = profileId; break;
        case 'tempo':    chatState.activeTempo = profileId; break;
        case 'texture':  chatState.activeTexture = profileId; break;
        default: return;
    }
    chatState.activeStackId = null;
    saveChatState();
}

/**
 * Clear a single tier.
 */
export function clearTier(tier) {
    setActiveTier(tier, null);
}

/**
 * Clear all active selections.
 */
export function clearAll() {
    chatState.activeRegister = null;
    chatState.activeTempo = null;
    chatState.activeTexture = null;
    chatState.activeStackId = null;
    saveChatState();
}

/**
 * Save the current active selections as a new stack.
 */
export function saveCurrentAsStack(name, icon, notes) {
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    const stack = {
        id,
        name,
        icon: icon || '📌',
        register: chatState.activeRegister,
        tempo: chatState.activeTempo,
        texture: chatState.activeTexture,
        notes: notes || ''
    };

    if (!extensionSettings.stacks) extensionSettings.stacks = [];
    extensionSettings.stacks.push(stack);
    chatState.activeStackId = id;

    saveSettings();
    saveChatState();
    return stack;
}

/**
 * Delete a saved stack.
 */
export function deleteStack(stackId) {
    const idx = extensionSettings.stacks.findIndex(s => s.id === stackId);
    if (idx === -1) return false;
    extensionSettings.stacks.splice(idx, 1);

    // If this was the active stack, clear it
    if (chatState.activeStackId === stackId) {
        chatState.activeStackId = null;
    }

    saveSettings();
    saveChatState();
    return true;
}

/**
 * Update a saved stack.
 */
export function updateStack(stackId, updates) {
    const stack = getStack(stackId);
    if (!stack) return false;
    Object.assign(stack, updates);
    saveSettings();
    return true;
}

/**
 * Get the currently active combo as a display-friendly object.
 */
export function getActiveCombo() {
    return {
        register: chatState.activeRegister,
        tempo: chatState.activeTempo,
        texture: chatState.activeTexture,
        stackId: chatState.activeStackId,
        isEmpty: !chatState.activeRegister && !chatState.activeTempo && !chatState.activeTexture
    };
}
