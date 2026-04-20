// Voice Extension - Core Configuration
export const EXT_NAME = 'Voice';
export const EXT_ID = 'voice';
export const EXT_VERSION = '1.0.0';

// Injection identifier for setExtensionPrompt
export const INJECTION_ID = 'voice-directive';

// Tiers
export const TIERS = {
    REGISTER: 'register',
    TEMPO: 'tempo',
    TEXTURE: 'texture'
};

// Tier display info
export const TIER_INFO = {
    [TIERS.REGISTER]: { label: 'Register', icon: '🎬', desc: 'What the scene is about' },
    [TIERS.TEMPO]:    { label: 'Tempo',    icon: '🎵', desc: 'How the prose moves' },
    [TIERS.TEXTURE]:  { label: 'Texture',  icon: '🖋️', desc: 'What each sentence feels like' }
};

// Default stacks (pre-built combos)
export const DEFAULT_STACKS = [
    {
        id: 'jed_mode',
        name: 'Jed Mode',
        icon: '🏠',
        register: 'tripwire',
        tempo: 'pulp',
        texture: 'domestic_malignancy',
        notes: 'The friendly neighbor with the knife drawer'
    },
    {
        id: 'ghost_face',
        name: 'Ghost Face',
        icon: '🔪',
        register: 'carrion',
        tempo: 'staccato',
        texture: 'somatic_ledger',
        notes: 'Hunt mode. Body-first. No poetry.'
    },
    {
        id: 'danny_hollow',
        name: 'Danny Hollow',
        icon: '🕳️',
        register: 'sediment',
        tempo: 'diminuendo',
        texture: 'bare_stage',
        notes: 'The gap between personas. Nothing there.'
    },
    {
        id: 'pining_hours',
        name: 'Pining Hours',
        icon: '💔',
        register: 'heartthrob',
        tempo: 'crescendo',
        texture: 'ritual_surrender',
        notes: 'The yearning that builds until it bleeds'
    },
    {
        id: 'dread_domestic',
        name: 'Dread Domestic',
        icon: '🏚️',
        register: 'linger',
        tempo: 'sustained',
        texture: 'domestic_malignancy',
        notes: 'The wrong house. The too-normal house.'
    },
    {
        id: 'investigation',
        name: 'Investigation',
        icon: '🔍',
        register: 'palimpsest',
        tempo: 'syncopation',
        texture: 'telescoping',
        notes: 'Clue-finding. Zoom in, zoom out. Off-rhythm.'
    },
    {
        id: 'comedy_of_errors',
        name: 'Comedy of Errors',
        icon: '🎪',
        register: 'wilt',
        tempo: 'staccato',
        texture: 'switchback',
        notes: 'Everything collapsing, hilariously, backwards'
    },
    {
        id: 'elysium_gothic',
        name: 'Elysium Gothic',
        icon: '🏛️',
        register: 'scoria',
        tempo: 'crescendo',
        texture: 'foxglove',
        notes: 'Beautiful architecture. Poisonous history.'
    }
];
