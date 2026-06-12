// Voice Extension - Soul Palette
// Once-per-world calibration: a six-question interview compiled (via a
// utility model) into weights over the live library + 1-2 flavor lines.
// The compiler is a MIXER, not a writer — it can only distribute weight
// across vocabulary that already exists. See voice-soul-palette-design.md.

import { getContext } from '../../../../../extensions.js';
import { extensionSettings, chatState } from '../core/state.js';
import { saveSettings, saveChatState } from '../core/persistence.js';
import { TIERS } from '../core/config.js';
import { getProfiles, getProfile } from './library.js';

// ═══════════════════════════════════════
// INTERVIEW
// ═══════════════════════════════════════

export const SOUL_QUESTIONS = [
    { id: 'senses', label: 'Senses', hint: 'What does the air taste or smell like here? Which sense dominates daily life? What would a stranger notice first?' },
    { id: 'unspoken', label: 'Unspoken', hint: 'What emotions go unspoken in this world? What lies beneath everyday interactions?' },
    { id: 'rhythm', label: 'Rhythm', hint: 'Is life fast and kinetic or slow and deliberate? Does tension build slowly or explode without warning? Do scenes end in action, or in silence?' },
    { id: 'speech', label: 'Speech', hint: 'How do people talk — clipped and defensive, or long and winding? Who speaks loudly, who whispers? What topics get avoided?' },
    { id: 'violence_intimacy', label: 'Violence & intimacy', hint: 'What does violence feel like here — quick and clean, or slow and visceral? How do people touch — freely, rarely, with suspicion? Is intimacy dangerous, transactional, sacred?' },
    { id: 'quiet', label: 'Quiet', hint: 'When things go quiet, is that peaceful or threatening? What does hope look like here — or does it exist at all?' },
    { id: 'humor', label: 'Humor (optional)', hint: 'Is humor a weapon, a shield, or forgotten?' },
];

// ═══════════════════════════════════════
// ENTITY KEYING (MMC v3 pattern)
// ═══════════════════════════════════════

export function getEntityKey() {
    try {
        const ctx = getContext();
        if (ctx.groupId) return `group:${ctx.groupId}`;
        const char = ctx.characters?.[ctx.characterId];
        return char?.avatar || null;
    } catch (e) {
        return null;
    }
}

export function getEntityName() {
    try {
        const ctx = getContext();
        if (ctx.groupId) {
            const group = ctx.groups?.find(g => g.id === ctx.groupId);
            return group?.name || 'this group';
        }
        return ctx.characters?.[ctx.characterId]?.name || 'this world';
    } catch (e) {
        return 'this world';
    }
}

// ═══════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════

export function getPalette() {
    const key = getEntityKey();
    if (!key) return null;
    if (!extensionSettings.palettes) extensionSettings.palettes = {};
    return extensionSettings.palettes[key] || null;
}

export function setPalette(palette) {
    const key = getEntityKey();
    if (!key) return false;
    if (!extensionSettings.palettes) extensionSettings.palettes = {};
    extensionSettings.palettes[key] = palette;
    saveSettings();
    return true;
}

export function deletePalette() {
    const key = getEntityKey();
    if (!key || !extensionSettings.palettes) return;
    delete extensionSettings.palettes[key];
    saveSettings();
}

// ═══════════════════════════════════════
// COMPILER
// ═══════════════════════════════════════

function buildLibraryBlock() {
    const lines = [];
    const tierLabel = { [TIERS.REGISTER]: 'REGISTERS', [TIERS.TEMPO]: 'TEMPOS', [TIERS.TEXTURE]: 'TEXTURES' };
    for (const tier of [TIERS.REGISTER, TIERS.TEMPO, TIERS.TEXTURE]) {
        lines.push(`${tierLabel[tier]}:`);
        for (const p of getProfiles(tier)) {
            lines.push(`- ${p.id} ("${p.name}"): ${p.injection}`);
        }
    }
    return lines.join('\n');
}

function buildCompilerPrompt(answers) {
    const answerLines = SOUL_QUESTIONS
        .filter(q => answers[q.id] && answers[q.id].trim())
        .map(q => `${q.label}: ${answers[q.id].trim()}`)
        .join('\n');

    return [
        'You are a palette mixer for a prose-direction system. You do NOT write prose or invent style advice. You distribute weight across an existing vocabulary to match a described world.',
        '',
        'THE VOCABULARY (the only ids you may use, spelled exactly as shown before the parentheses):',
        buildLibraryBlock(),
        '',
        'THE WORLD, described by its creator:',
        answerLines,
        '',
        'Produce a palette as JSON. Rules:',
        '1. WEIGHTS: For each category (registers, tempos, textures), pick AT MOST 4 ids and weight them -3 to +3. Positive = this world leans here by default. Negative = this world actively avoids this. Prefer 2-3 strong weights over many weak ones. Every weight must be traceable to something the creator actually said — if no answer supports a weight, do not add one.',
        '2. NEVER invent ids. Use only vocabulary ids from the list above, exactly. If nothing in a category fits, return an empty object for that category.',
        '3. FLAVOR: At most 2 lines, each 12 words or fewer, capturing what is most specific and unusual about this world\'s feel. Write them as atmospheric craft-notes in the same voice as the vocabulary glosses — truths, not instructions. Generic advice ("be vivid", "show don\'t tell") is forbidden. Prefer the creator\'s own phrasing. If the answers are too thin for a distinctive line, return fewer lines or none.',
        '4. SCENE OVERRIDES: Only if an answer explicitly characterizes violence or intimacy may you pin ONE vocabulary id to that scene type. Otherwise omit the key.',
        '5. Respond with ONLY the JSON object. No preamble, no markdown fences, no commentary.',
        '',
        '{',
        '  "weights": {',
        '    "registers": {"id": -3},',
        '    "tempos": {"id": 3},',
        '    "textures": {"id": 2}',
        '  },',
        '  "flavor": ["line", "line"],',
        '  "sceneOverrides": {',
        '    "violence": {"register": "id"},',
        '    "intimacy": {"texture": "id"}',
        '  }',
        '}',
    ].join('\n');
}

function resolveProfileId(name) {
    const cm = getContext()?.extensionSettings?.connectionManager;
    if (!cm) return null;
    if (!name || name === 'current') return cm.selectedProfile || null;
    const p = (cm.profiles || []).find(x => x.name === name || x.id === name);
    return p ? p.id : null;
}

export function listConnectionProfiles() {
    const cm = getContext()?.extensionSettings?.connectionManager;
    return (cm?.profiles || []).map(p => p.name);
}

function repairJson(text) {
    let t = String(text || '').trim();
    t = t.replace(/```(?:json)?/gi, '').trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start === -1) throw new Error('no JSON object in response');
    t = end > start ? t.slice(start, end + 1) : t.slice(start);
    try { return JSON.parse(t); } catch (e) { /* try repairs */ }
    // trailing commas
    let r = t.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(r); } catch (e) { /* try closing */ }
    // truncated — close open braces/brackets
    const opens = (r.match(/{/g) || []).length - (r.match(/}/g) || []).length;
    const openA = (r.match(/\[/g) || []).length - (r.match(/]/g) || []).length;
    r = r + ']'.repeat(Math.max(0, openA)) + '}'.repeat(Math.max(0, opens));
    return JSON.parse(r);
}

/**
 * Validate raw compiler output against the LIVE library.
 * Unknown ids are dropped (reported, not silent). Weights clamped to [-3,3],
 * max 4 per tier. Flavor max 2 lines. Returns { palette, dropped }.
 */
export function validatePalette(raw) {
    const dropped = [];
    const tierMap = { registers: TIERS.REGISTER, tempos: TIERS.TEMPO, textures: TIERS.TEXTURE };
    const weights = { registers: {}, tempos: {}, textures: {} };

    for (const [cat, tier] of Object.entries(tierMap)) {
        const src = raw?.weights?.[cat] || {};
        const entries = Object.entries(src)
            .filter(([id, w]) => {
                if (!getProfile(tier, id)) { dropped.push(`${cat}:${id}`); return false; }
                return Number.isFinite(Number(w)) && Number(w) !== 0;
            })
            .map(([id, w]) => [id, Math.max(-3, Math.min(3, Math.round(Number(w))))])
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
            .slice(0, 4);
        weights[cat] = Object.fromEntries(entries);
    }

    const flavor = (Array.isArray(raw?.flavor) ? raw.flavor : [])
        .filter(l => typeof l === 'string' && l.trim())
        .map(l => l.trim().slice(0, 110))
        .slice(0, 2);

    const sceneOverrides = {};
    for (const sceneKey of ['violence', 'intimacy']) {
        const ov = raw?.sceneOverrides?.[sceneKey];
        if (!ov || typeof ov !== 'object') continue;
        const [[type, id] = []] = Object.entries(ov);
        const tier = { register: TIERS.REGISTER, tempo: TIERS.TEMPO, texture: TIERS.TEXTURE }[type];
        if (tier && getProfile(tier, id)) {
            sceneOverrides[sceneKey] = { [type]: id };
        } else if (id) {
            dropped.push(`override:${sceneKey}:${id}`);
        }
    }

    return { palette: { weights, flavor, sceneOverrides }, dropped };
}

/**
 * Run the compiler. Returns a validated draft palette (not yet saved).
 */
export async function compilePalette(answers) {
    const ctx = getContext();
    if (!ctx.ConnectionManagerRequestService) {
        throw new Error('ConnectionManagerRequestService unavailable — update SillyTavern');
    }
    const profileId = resolveProfileId(extensionSettings.paletteCompileProfile);
    if (!profileId) throw new Error('No connection profile resolved — pick one in the Soul tab');

    const prompt = buildCompilerPrompt(answers);
    const budget = Number(extensionSettings.paletteTokenBudget) || 2000;

    const response = await ctx.ConnectionManagerRequestService.sendRequest(
        profileId,
        [{ role: 'user', content: prompt }],
        budget,
        { extractData: true, includePreset: true, includeInstruct: false },
        {},
    );

    const text = typeof response === 'string' ? response : (response?.content ?? '');
    const raw = repairJson(text);
    const { palette, dropped } = validatePalette(raw);

    if (dropped.length && typeof toastr !== 'undefined') {
        toastr.warning(`Dropped unknown ids: ${dropped.join(', ')}`, '🎙️ Voice Soul', { timeOut: 6000 });
    }

    return palette;
}

// ═══════════════════════════════════════
// RUNTIME ACCESS
// ═══════════════════════════════════════

/**
 * Top positively-weighted id per tier — the world's default stack.
 */
export function computeSoulStack(palette) {
    const pick = (cat, tier) => {
        const entries = Object.entries(palette?.weights?.[cat] || {})
            .filter(([, w]) => w > 0)
            .sort((a, b) => b[1] - a[1]);
        return entries.length && getProfile(tier, entries[0][0]) ? entries[0][0] : null;
    };
    return {
        register: pick('registers', TIERS.REGISTER),
        tempo: pick('tempos', TIERS.TEMPO),
        texture: pick('textures', TIERS.TEXTURE),
    };
}

/**
 * Weight lookup for UI ordering/markers. Returns 0 when unweighted.
 */
export function getWeight(tier, id) {
    const pal = getPalette();
    if (!pal) return 0;
    const cat = { [TIERS.REGISTER]: 'registers', [TIERS.TEMPO]: 'tempos', [TIERS.TEXTURE]: 'textures' }[tier];
    return pal.weights?.[cat]?.[id] || 0;
}

/**
 * Should flavor lines be included this generation?
 */
export function shouldIncludeFlavor() {
    const pal = getPalette();
    if (!pal || !pal.flavor?.length) return false;
    const mode = pal.flavorMode || 'always';
    if (mode === 'off') return false;
    if (mode === 'always') return true;
    // sceneChange: include only when the active register differs from last flavored one
    return chatState.lastFlavorRegister !== chatState.activeRegister;
}

export function markFlavorInjected() {
    chatState.lastFlavorRegister = chatState.activeRegister;
    saveChatState();
}

/**
 * Apply the soul stack directly to chat state (autopilot-style:
 * bypasses manual-override pause).
 */
export function applySoulStack() {
    const pal = getPalette();
    if (!pal) return false;
    const soul = computeSoulStack(pal);
    if (!soul.register && !soul.tempo && !soul.texture) return false;
    chatState.activeRegister = soul.register;
    chatState.activeTempo = soul.tempo;
    chatState.activeTexture = soul.texture;
    chatState.activeStackId = null;
    saveChatState();
    return true;
}
