// Voice Extension - Library Management
import { extensionSettings } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { TIERS } from '../core/config.js';

/**
 * Get the profile array for a given tier.
 */
export function getProfiles(tier) {
    switch (tier) {
        case TIERS.REGISTER: return extensionSettings.registers || [];
        case TIERS.TEMPO:    return extensionSettings.tempos || [];
        case TIERS.TEXTURE:  return extensionSettings.textures || [];
        default: return [];
    }
}

/**
 * Find a profile by ID within a tier.
 */
export function getProfile(tier, id) {
    if (!id) return null;
    return getProfiles(tier).find(p => p.id === id) || null;
}

/**
 * Add a new profile to a tier.
 */
export function addProfile(tier, profile) {
    const profiles = getProfiles(tier);
    if (profiles.find(p => p.id === profile.id)) {
        console.warn(`[Voice] Profile ${profile.id} already exists in ${tier}`);
        return false;
    }
    profiles.push(profile);
    saveSettings();
    return true;
}

/**
 * Update an existing profile.
 */
export function updateProfile(tier, id, updates) {
    const profiles = getProfiles(tier);
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    profiles[idx] = { ...profiles[idx], ...updates };
    saveSettings();
    return true;
}

/**
 * Remove a profile by ID.
 */
export function removeProfile(tier, id) {
    const profiles = getProfiles(tier);
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    profiles.splice(idx, 1);
    saveSettings();
    return true;
}

/**
 * Export the full library as JSON for sharing.
 */
export function exportLibrary() {
    return JSON.stringify({
        version: 1,
        registers: extensionSettings.registers,
        tempos: extensionSettings.tempos,
        textures: extensionSettings.textures,
        stacks: extensionSettings.stacks
    }, null, 2);
}

/**
 * Import profiles from JSON. Merges — doesn't overwrite existing.
 */
export function importLibrary(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        let added = 0;

        const importTier = (tier, incoming) => {
            if (!Array.isArray(incoming)) return;
            for (const profile of incoming) {
                if (!profile.id || !profile.name || !profile.injection) continue;
                if (addProfile(tier, profile)) added++;
            }
        };

        importTier(TIERS.REGISTER, data.registers);
        importTier(TIERS.TEMPO, data.tempos);
        importTier(TIERS.TEXTURE, data.textures);

        // Import stacks
        if (Array.isArray(data.stacks)) {
            for (const stack of data.stacks) {
                if (!stack.id || !stack.name) continue;
                const existing = extensionSettings.stacks.find(s => s.id === stack.id);
                if (!existing) {
                    extensionSettings.stacks.push(stack);
                    added++;
                }
            }
        }

        saveSettings();
        return added;
    } catch (e) {
        console.error('[Voice] Import failed:', e);
        return -1;
    }
}
