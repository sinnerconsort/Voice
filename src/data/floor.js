// Voice Extension - Prose Floor defaults
//
// The "floor" is the always-on layer beneath the per-scene picks: a small set
// of positive craft directives that hold regardless of Register/Tempo/Texture.
// It injects unconditionally (when enabled) as its own [PROSE FLOOR] block so
// it can stand alone even when no voice is active.
//
// Design rule (hard-won): ban CONSTRUCTIONS, not common words. Forbidding a
// frequent word ("stay", "meat") makes the model neurotic — it fixates on the
// token and editorialises about the ban mid-reasoning. Distinctive multi-token
// scaffolds ("not once, but twice") are safe to name because the model doesn't
// reflexively reach for them. Everything here is framed as positive direction,
// not a naked ban list, for the same reason.
//
// Each group is independently toggleable and the rule text is fully editable
// in the Floor tab, so this is just the seed — tune it live on-device.

export const DEFAULT_FLOOR_GROUPS = [
    {
        id: 'emphasis',
        label: 'Emphasis tics',
        enabled: true,
        rules: 'State emphasis once and plainly; let concrete detail carry the weight, not insistence. Do not use antithesis scaffolds for emphasis: avoid "not once, but twice", "not just X but Y", "wasn\'t merely A, it was B", "more than just", and "not X, but Y".'
    },
    {
        id: 'noecho',
        label: 'No echo',
        enabled: true,
        rules: 'React to the user\'s most recent message; never restate, paraphrase, quote, or summarise their actions or dialogue back to them. Answer with new sensory input, reaction, or consequence instead.'
    },
    {
        id: 'showtell',
        label: 'Show, don\'t tell',
        enabled: true,
        rules: 'Convey emotion through action, behaviour, and concrete sensory detail rather than naming the feeling or cataloguing micro-expressions (no "dilated pupils", "breath hitching", "jaw clenched").'
    }
];
