// Voice Extension - Prose Floor (injection + UI)
//
// buildFloorInjection() — the always-on [PROSE FLOOR] block, appended after the
// per-scene [VOICE DIRECTIVE] by injection.js. Independent of any active pick.
//
// renderFloorTab() — the Floor tab: master toggle, per-group toggles + editable
// rule textareas, add/remove custom groups, live token estimate, reset.
//
// No imports from ui.js (avoids a circular dependency) — this module only edits
// state and re-renders its own tab. Switching to Preview re-reads the floor.

import { extensionSettings } from '../core/state.js';
import { saveSettings } from '../core/persistence.js';
import { DEFAULT_FLOOR_GROUPS } from '../data/floor.js';

const FLOOR_OPEN = '[PROSE FLOOR]';
const FLOOR_CLOSE = '[/PROSE FLOOR]';

// ═══════════════════════════════════════
// INJECTION
// ═══════════════════════════════════════

/**
 * Build the always-on prose-floor block. Returns '' when the floor is off or
 * every enabled group is empty — so it never injects a hollow shell.
 */
export function buildFloorInjection() {
    const f = extensionSettings.proseFloor;
    if (!f || !f.enabled) return '';

    const active = (f.groups || []).filter(g => g && g.enabled && g.rules && g.rules.trim());
    if (!active.length) return '';

    const parts = [FLOOR_OPEN];
    for (const g of active) parts.push(g.rules.trim());
    parts.push(FLOOR_CLOSE);
    return parts.join('\n');
}

/** Rough token estimate (~4 chars/token), matching injection.js's preview. */
function floorTokenEstimate() {
    const text = buildFloorInjection();
    return text ? Math.ceil(text.length / 4) : 0;
}

// ═══════════════════════════════════════
// UI
// ═══════════════════════════════════════

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Ensure the proseFloor object exists and is shaped correctly. */
function ensureFloor() {
    if (!extensionSettings.proseFloor || typeof extensionSettings.proseFloor !== 'object') {
        extensionSettings.proseFloor = { enabled: true, groups: [] };
    }
    if (!Array.isArray(extensionSettings.proseFloor.groups)) {
        extensionSettings.proseFloor.groups = [];
    }
    if (typeof extensionSettings.proseFloor.enabled !== 'boolean') {
        extensionSettings.proseFloor.enabled = true;
    }
    return extensionSettings.proseFloor;
}

const ROW_INPUT = 'width:100%; box-sizing:border-box; font-size:12px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:6px;';
const BTN = 'background: rgba(255,255,255,0.06); border: 1px solid var(--SmartThemeBorderColor, #444); border-radius: 8px; padding: 7px 10px; font-size: 12px; cursor: pointer; text-align: center;';

export function renderFloorTab() {
    const container = $('#voice-tab-floor');
    if (!container.length) return;

    const f = ensureFloor();
    const tokens = floorTokenEstimate();

    let groupsHtml = '';
    f.groups.forEach((g, i) => {
        const isDefault = DEFAULT_FLOOR_GROUPS.some(d => d.id === g.id);
        groupsHtml += `
            <div style="margin-bottom: 12px; padding: 8px; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:8px; background:rgba(0,0,0,0.12);">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <label class="checkbox_label" style="display:flex; align-items:center; gap:6px; flex:1; cursor:pointer;">
                        <input type="checkbox" class="voice-floor-group-toggle" data-i="${i}" ${g.enabled ? 'checked' : ''}>
                        <input type="text" class="voice-floor-group-label" data-i="${i}" value="${escapeHtml(g.label || '')}" placeholder="Group name" style="font-size:12px; font-weight:600; background:transparent; color:inherit; border:none; border-bottom:1px solid transparent; flex:1; padding:2px 0;">
                    </label>
                    ${isDefault ? '' : `<span class="voice-floor-group-del" data-i="${i}" title="Delete group" style="cursor:pointer; opacity:0.5; font-size:13px; padding:0 4px;">✕</span>`}
                </div>
                <textarea class="voice-floor-group-rules" data-i="${i}" rows="3" placeholder="Rule text injected when this group is on..." style="${ROW_INPUT}">${escapeHtml(g.rules || '')}</textarea>
            </div>
        `;
    });

    const html = `
        <div style="margin-bottom: 10px;">
            <label class="checkbox_label" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                <input type="checkbox" id="voice-floor-master" ${f.enabled ? 'checked' : ''}>
                <span>Prose Floor</span>
            </label>
            <p style="font-size: 11px; opacity: 0.6; margin: 4px 0 0 0;">
                Always-on craft rules, injected beneath your scene picks as <code>[PROSE FLOOR]</code>. Toggle groups to control the token cost; edit any rule in place.
            </p>
        </div>

        <div style="opacity:${f.enabled ? '1' : '0.45'}; pointer-events:${f.enabled ? 'auto' : 'none'};">
            ${groupsHtml}
            <div style="display:flex; gap:8px; margin-top:4px;">
                <div id="voice-floor-add" style="${BTN} flex:1;">+ Add group</div>
                <div id="voice-floor-reset" style="${BTN}" title="Restore the seeded default groups">↺ Reset</div>
            </div>
        </div>

        <div style="margin-top: 10px; font-size: 11px; opacity: 0.6; text-align:right;">
            Floor injection: ~<span id="voice-floor-tokens">${tokens}</span> tokens
        </div>
    `;

    container.html(html);

    const refreshTokens = () => {
        $('#voice-floor-tokens').text(floorTokenEstimate());
    };

    // Master toggle
    container.find('#voice-floor-master').on('change', function() {
        ensureFloor().enabled = $(this).prop('checked');
        saveSettings();
        renderFloorTab();
    });

    // Per-group enable
    container.find('.voice-floor-group-toggle').on('change', function() {
        const i = +$(this).data('i');
        const g = ensureFloor().groups[i];
        if (g) { g.enabled = $(this).prop('checked'); saveSettings(); refreshTokens(); }
    });

    // Per-group label (live edit, no re-render so the field keeps focus)
    container.find('.voice-floor-group-label').on('input', function() {
        const i = +$(this).data('i');
        const g = ensureFloor().groups[i];
        if (g) { g.label = $(this).val(); saveSettings(); }
    });

    // Per-group rules (live edit + live token count)
    container.find('.voice-floor-group-rules').on('input', function() {
        const i = +$(this).data('i');
        const g = ensureFloor().groups[i];
        if (g) { g.rules = $(this).val(); saveSettings(); refreshTokens(); }
    });

    // Delete custom group
    container.find('.voice-floor-group-del').on('click', function() {
        const i = +$(this).data('i');
        ensureFloor().groups.splice(i, 1);
        saveSettings();
        renderFloorTab();
    });

    // Add custom group
    container.find('#voice-floor-add').on('click', function() {
        ensureFloor().groups.push({
            id: 'custom_' + Date.now(),
            label: 'Custom',
            enabled: true,
            rules: ''
        });
        saveSettings();
        renderFloorTab();
    });

    // Reset to seeded defaults
    container.find('#voice-floor-reset').on('click', function() {
        if (typeof toastr !== 'undefined') {
            // confirm-by-toast is overkill; use a native confirm where available
        }
        const ok = (typeof window !== 'undefined' && window.confirm)
            ? window.confirm('Restore the default Prose Floor groups? Custom groups and edits will be replaced.')
            : true;
        if (!ok) return;
        ensureFloor().groups = JSON.parse(JSON.stringify(DEFAULT_FLOOR_GROUPS));
        extensionSettings.proseFloor.enabled = true;
        saveSettings();
        renderFloorTab();
    });
}
