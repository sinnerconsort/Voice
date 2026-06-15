// Voice Extension - UI
import { extensionSettings, chatState, setIsPanelOpen, isPanelOpen } from '../core/state.js';
import { saveSettings, saveChatState } from '../core/persistence.js';
import { TIERS, TIER_INFO } from '../core/config.js';
import { getProfiles, getProfile, exportLibrary, importLibrary } from './library.js';
import {
    getStacks, activateStack, setActiveTier, clearTier,
    clearAll, saveCurrentAsStack, deleteStack, getActiveCombo
} from './stacks.js';
import { getInjectionPreview } from './injection.js';
import { getAutopilotStatus, setAutopilot, isAutopilotAvailable } from './autopilot.js';
import {
    SOUL_QUESTIONS, getPalette, setPalette, deletePalette, getEntityName, getEntityKey,
    compilePalette, computeSoulStack, applySoulStack, getWeight, listConnectionProfiles
} from './palette.js';

// ═══════════════════════════════════════
// FAB (Floating Action Button)
// ═══════════════════════════════════════

export function createFAB() {
    if ($('#voice-fab').length) return;

    const pos = extensionSettings.fabPosition || { top: 'calc(var(--topBarBlockSize) + 120px)', right: '12px' };

    const fab = $(`
        <div id="voice-fab" style="
            position: fixed;
            top: ${pos.top};
            right: ${pos.right};
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--SmartThemeBlurTintColor, #1a1a2e);
            border: 1px solid var(--SmartThemeBorderColor, #444);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 31000;
            font-size: 18px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            user-select: none;
            touch-action: none;
        " title="Voice">🎙️</div>
    `);

    $('body').append(fab);
    makeFABInteractive(fab[0]);
}

// Unified tap + drag for the FAB.
// We do NOT rely on the synthetic `click` event (flaky on mobile after any
// finger movement). Instead we detect the tap ourselves on touchend/mouseup
// and preventDefault on touchend to suppress the synthetic click entirely.
function makeFABInteractive(el) {
    const DRAG_THRESHOLD = 6; // px of movement before it counts as a drag, not a tap
    let active = false;
    let wasDragged = false;
    let startX, startY, startTop, startRight;

    function begin(x, y) {
        const rect = el.getBoundingClientRect();
        startX = x;
        startY = y;
        startTop = rect.top;
        startRight = window.innerWidth - rect.right;
        active = true;
        wasDragged = false;
    }

    // Returns true if this movement is (or has become) a drag.
    function move(x, y) {
        if (!active) return false;
        const dx = x - startX;
        const dy = y - startY;
        if (!wasDragged && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
            return false;
        }
        wasDragged = true;
        const newTop = Math.max(0, startTop + dy);
        const newRight = Math.max(0, startRight - dx);
        requestAnimationFrame(() => {
            el.style.top = `${newTop}px`;
            el.style.right = `${newRight}px`;
        });
        return true;
    }

    function end() {
        if (!active) return;
        active = false;
        if (wasDragged) {
            extensionSettings.fabPosition = { top: el.style.top, right: el.style.right };
            saveSettings();
        } else {
            togglePanel(); // clean tap → toggle, every time
        }
    }

    // ── Touch (mobile) ──
    el.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        begin(t.clientX, t.clientY);
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (move(t.clientX, t.clientY)) e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchend', (e) => {
        // Kill the synthetic mouse click that would otherwise fire after this.
        e.preventDefault();
        end();
    }, { passive: false });

    el.addEventListener('touchcancel', () => {
        active = false;
        wasDragged = false;
    });

    // ── Mouse (desktop) ── synthetic clicks are suppressed above, so this
    // only runs for real mouse input and won't double-fire with touch.
    el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        begin(e.clientX, e.clientY);
        const onMove = (ev) => move(ev.clientX, ev.clientY);
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            end();
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ═══════════════════════════════════════
// PANEL
// ═══════════════════════════════════════

export function createPanel() {
    if ($('#voice-panel').length) return;

    const panel = $(`
        <div id="voice-panel" style="
            display: none;
            position: fixed;
            top: 50px;
            right: 8px;
            width: min(360px, calc(100vw - 16px));
            max-height: calc(100vh - 120px);
            background: var(--SmartThemeBlurTintColor, #1a1a2e);
            border: 1px solid var(--SmartThemeBorderColor, #444);
            border-radius: 12px;
            z-index: 31001;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0,0,0,0.5);
            font-family: var(--mainFontFamily, sans-serif);
            color: var(--SmartThemeBodyColor, #ccc);
        ">
            <!-- Header -->
            <div id="voice-header" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                border-bottom: 1px solid var(--SmartThemeBorderColor, #333);
                background: rgba(0,0,0,0.2);
            ">
                <span style="font-weight: 600; font-size: 14px;">🎙️ Voice</span>
                <div id="voice-active-label" style="font-size: 11px; opacity: 0.7; flex: 1; text-align: center; padding: 0 8px;"></div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span id="voice-autopilot-btn" title="Autopilot: follow Lexicon scene type" style="cursor: pointer; font-size: 14px; opacity: 0.4;">✈️</span>
                    <span id="voice-clear-btn" title="Clear all selections" style="cursor: pointer; font-size: 12px; opacity: 0.5;">🗑️</span>
                    <span id="voice-close-btn" title="Close" style="cursor: pointer; font-size: 16px; opacity: 0.7; padding: 2px 4px;">✕</span>
                </div>
            </div>

            <!-- Tabs -->
            <div id="voice-tabs" style="
                display: flex;
                border-bottom: 1px solid var(--SmartThemeBorderColor, #333);
            ">
                <div class="voice-tab" data-tab="stacks" style="flex:1; text-align:center; padding:8px; cursor:pointer; font-size:12px; border-bottom: 2px solid transparent;">📦 Stacks</div>
                <div class="voice-tab" data-tab="picker" style="flex:1; text-align:center; padding:8px; cursor:pointer; font-size:12px; border-bottom: 2px solid transparent;">🎨 Picker</div>
                <div class="voice-tab" data-tab="preview" style="flex:1; text-align:center; padding:8px; cursor:pointer; font-size:12px; border-bottom: 2px solid transparent;">👁️ Preview</div>
                <div class="voice-tab" data-tab="soul" style="flex:1; text-align:center; padding:8px; cursor:pointer; font-size:12px; border-bottom: 2px solid transparent;">✨ Soul</div>
            </div>

            <!-- Tab Content -->
            <div id="voice-content" style="
                overflow-y: auto;
                max-height: calc(100vh - 220px);
                padding: 10px;
            ">
                <div id="voice-tab-stacks"></div>
                <div id="voice-tab-picker" style="display:none;"></div>
                <div id="voice-tab-preview" style="display:none;"></div>
                <div id="voice-tab-soul" style="display:none;"></div>
            </div>
        </div>
    `);

    $('body').append(panel);

    // Tab switching
    panel.find('.voice-tab').on('click', function() {
        const tab = $(this).data('tab');
        switchTab(tab);
    });

    // Close button
    $('#voice-close-btn').on('click', () => {
        togglePanel();
    });

    // Clear button
    $('#voice-clear-btn').on('click', () => {
        clearAll();
        renderAll();
        updateFABIndicator();
    });

    // Autopilot toggle
    $('#voice-autopilot-btn').on('click', () => {
        const status = getAutopilotStatus();
        if (!status.enabled && !isAutopilotAvailable()) {
            toastr.warning('Lexicon isn\'t active — autopilot needs Lexicon v2.1+ for scene detection', '🎙️ Voice', { timeOut: 4500 });
            return;
        }
        setAutopilot(!status.enabled);
        saveSettings();
        updateAutopilotButton();
        toastr.info(
            status.enabled ? 'Autopilot off — manual control' : 'Autopilot on — Voice follows Lexicon scene changes',
            '🎙️ Voice', { timeOut: 3000 }
        );
    });

    updateAutopilotButton();
    switchTab(extensionSettings.activeTab || 'stacks');
}

/**
 * Refresh the autopilot button to reflect current status:
 * dim ✈️ = off, bright ✈️ = engaged, ⏸️ = paused by manual override.
 */
export function updateAutopilotButton() {
    const btn = $('#voice-autopilot-btn');
    if (!btn.length) return;
    const status = getAutopilotStatus();

    if (!status.enabled) {
        btn.text('✈️').css({ opacity: '0.4', filter: 'grayscale(1)' })
            .attr('title', 'Autopilot off — tap to follow Lexicon scene type');
    } else if (status.paused) {
        btn.text('⏸️').css({ opacity: '0.9', filter: 'none' })
            .attr('title', `Autopilot paused (manual override) — resumes on scene change${status.sceneLabel ? ` · current: ${status.sceneLabel}` : ''}`);
    } else {
        btn.text('✈️').css({ opacity: '1', filter: 'none' })
            .attr('title', `Autopilot ON${status.sceneLabel ? ` · scene: ${status.sceneLabel}` : ' — waiting for first scene'}`);
    }
}

function switchTab(tabName) {
    extensionSettings.activeTab = tabName;

    $('.voice-tab').css({
        'border-bottom': '2px solid transparent',
        'opacity': '0.6'
    });
    $(`.voice-tab[data-tab="${tabName}"]`).css({
        'border-bottom': '2px solid var(--SmartThemeQuoteColor, #e94560)',
        'opacity': '1'
    });

    $('#voice-tab-stacks, #voice-tab-picker, #voice-tab-preview, #voice-tab-soul').hide();
    $(`#voice-tab-${tabName}`).show();

    // Render the active tab
    switch (tabName) {
        case 'stacks':  renderStacksTab(); break;
        case 'picker':  renderPickerTab(); break;
        case 'preview': renderPreviewTab(); break;
        case 'soul':    renderSoulTab(); break;
    }
}

// Holds the bound outside-dismiss handler so we can remove it on close.
let outsidePointerHandler = null;

function bindOutsideDismiss() {
    if (outsidePointerHandler) return;
    outsidePointerHandler = (e) => {
        const panel = document.getElementById('voice-panel');
        const fab = document.getElementById('voice-fab');
        if (!panel) return;
        // Ignore taps inside the panel itself...
        if (panel.contains(e.target)) return;
        // ...and on the FAB, which runs its own toggle on touchend/mouseup.
        if (fab && fab.contains(e.target)) return;
        closePanel();
    };
    // Defer one tick so the very tap that opened the panel can't close it.
    setTimeout(() => {
        if (!outsidePointerHandler) return;
        document.addEventListener('touchstart', outsidePointerHandler, { passive: true });
        document.addEventListener('mousedown', outsidePointerHandler, true);
    }, 0);
}

function unbindOutsideDismiss() {
    if (!outsidePointerHandler) return;
    document.removeEventListener('touchstart', outsidePointerHandler, { passive: true });
    document.removeEventListener('mousedown', outsidePointerHandler, true);
    outsidePointerHandler = null;
}

export function openPanel() {
    $('#voice-panel').show();
    setIsPanelOpen(true);
    renderAll();
    bindOutsideDismiss();
}

export function closePanel() {
    $('#voice-panel').hide();
    setIsPanelOpen(false);
    unbindOutsideDismiss();
}

export function togglePanel() {
    if ($('#voice-panel').is(':visible')) {
        closePanel();
    } else {
        openPanel();
    }
}

// ═══════════════════════════════════════
// STACKS TAB
// ═══════════════════════════════════════

function renderStacksTab() {
    const container = $('#voice-tab-stacks');
    const stacks = getStacks();
    const combo = getActiveCombo();

    let html = '';

    // Save-current-as-stack button (only if something is active)
    if (!combo.isEmpty && !combo.stackId) {
        html += `
            <div id="voice-save-stack" style="
                display: flex; gap: 8px; margin-bottom: 10px;
                padding: 8px; border: 1px dashed var(--SmartThemeBorderColor, #555);
                border-radius: 8px; cursor: pointer; align-items: center;
                opacity: 0.7; font-size: 12px;
            ">
                <span>💾</span>
                <span>Save current combo as stack...</span>
            </div>
        `;
    }

    if (stacks.length === 0) {
        html += '<div style="text-align:center; opacity:0.5; padding:20px; font-size:12px;">No stacks saved yet. Pick profiles in the Picker tab, then save the combo here.</div>';
    }

    for (const stack of stacks) {
        const isActive = combo.stackId === stack.id;
        const reg = getProfile(TIERS.REGISTER, stack.register);
        const tmp = getProfile(TIERS.TEMPO, stack.tempo);
        const tex = getProfile(TIERS.TEXTURE, stack.texture);

        html += `
            <div class="voice-stack-card" data-id="${stack.id}" style="
                padding: 10px 12px;
                margin-bottom: 8px;
                border-radius: 8px;
                border: 1px solid ${isActive ? 'var(--SmartThemeQuoteColor, #e94560)' : 'var(--SmartThemeBorderColor, #444)'};
                background: ${isActive ? 'rgba(233,69,96,0.1)' : 'rgba(0,0,0,0.15)'};
                cursor: pointer;
                transition: border-color 0.2s;
            ">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-weight:600; font-size:13px;">${stack.icon || '📌'} ${stack.name}</span>
                    <span class="voice-stack-delete" data-id="${stack.id}" style="opacity:0.4; font-size:11px; cursor:pointer;">✕</span>
                </div>
                <div style="font-size:11px; opacity:0.6; margin-bottom:4px;">
                    ${reg ? `${reg.icon} ${reg.name}` : '—'}
                    ${tmp ? ` · ${tmp.icon} ${tmp.name}` : ''}
                    ${tex ? ` · ${tex.icon} ${tex.name}` : ''}
                </div>
                ${stack.notes ? `<div style="font-size:10px; opacity:0.5; font-style:italic;">${stack.notes}</div>` : ''}
            </div>
        `;
    }

    // Import/Export at bottom
    html += `
        <div style="display:flex; gap:8px; margin-top:12px; padding-top:8px; border-top:1px solid var(--SmartThemeBorderColor, #333);">
            <button id="voice-export-btn" class="menu_button" style="flex:1; font-size:11px; padding:6px;">📤 Export</button>
            <button id="voice-import-btn" class="menu_button" style="flex:1; font-size:11px; padding:6px;">📥 Import</button>
        </div>
    `;

    container.html(html);

    // Wire events
    container.find('.voice-stack-card').on('click', function(e) {
        if ($(e.target).hasClass('voice-stack-delete')) return;
        const id = $(this).data('id');
        activateStack(id);
        renderAll();
        updateFABIndicator();
    });

    container.find('.voice-stack-delete').on('click', function(e) {
        e.stopPropagation();
        const id = $(this).data('id');
        if (confirm('Delete this stack?')) {
            deleteStack(id);
            renderStacksTab();
            updateFABIndicator();
        }
    });

    $('#voice-save-stack').on('click', () => showSaveStackDialog());

    $('#voice-export-btn').on('click', () => {
        const data = exportLibrary();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'voice-library.json';
        a.click();
        URL.revokeObjectURL(url);
        toastr.success('Library exported');
    });

    $('#voice-import-btn').on('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const count = importLibrary(ev.target.result);
                if (count >= 0) {
                    toastr.success(`Imported ${count} profiles`);
                    renderAll();
                } else {
                    toastr.error('Import failed — invalid JSON');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    });
}

function showSaveStackDialog() {
    const dialog = $(`
        <div id="voice-save-dialog" style="
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6); z-index: 32000;
            display: flex; align-items: center; justify-content: center;
        ">
            <div style="
                background: var(--SmartThemeBlurTintColor, #1a1a2e);
                border: 1px solid var(--SmartThemeBorderColor, #444);
                border-radius: 12px; padding: 16px; width: min(300px, 90vw);
            ">
                <div style="font-weight:600; margin-bottom:12px;">Save Stack</div>
                <input id="voice-stack-name" type="text" placeholder="Stack name..." style="
                    width:100%; padding:8px; margin-bottom:8px;
                    background: rgba(0,0,0,0.3); border: 1px solid var(--SmartThemeBorderColor, #444);
                    border-radius: 6px; color: inherit; font-size: 13px;
                " />
                <input id="voice-stack-icon" type="text" placeholder="Icon (emoji)" maxlength="4" style="
                    width:60px; padding:8px; margin-bottom:8px;
                    background: rgba(0,0,0,0.3); border: 1px solid var(--SmartThemeBorderColor, #444);
                    border-radius: 6px; color: inherit; font-size: 13px; text-align: center;
                " />
                <input id="voice-stack-notes" type="text" placeholder="Notes (optional)" style="
                    width:100%; padding:8px; margin-bottom:12px;
                    background: rgba(0,0,0,0.3); border: 1px solid var(--SmartThemeBorderColor, #444);
                    border-radius: 6px; color: inherit; font-size: 13px;
                " />
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button id="voice-save-cancel" class="menu_button" style="font-size:12px; padding:6px 12px;">Cancel</button>
                    <button id="voice-save-confirm" class="menu_button" style="font-size:12px; padding:6px 12px;">Save</button>
                </div>
            </div>
        </div>
    `);

    $('body').append(dialog);

    $('#voice-save-cancel').on('click', () => dialog.remove());
    $('#voice-save-confirm').on('click', () => {
        const name = $('#voice-stack-name').val().trim();
        if (!name) { toastr.warning('Name is required'); return; }
        const icon = $('#voice-stack-icon').val().trim() || '📌';
        const notes = $('#voice-stack-notes').val().trim();
        saveCurrentAsStack(name, icon, notes);
        dialog.remove();
        renderAll();
        updateFABIndicator();
        toastr.success(`Stack "${name}" saved`);
    });
}

// ═══════════════════════════════════════
// PICKER TAB
// ═══════════════════════════════════════

function renderPickerTab() {
    const container = $('#voice-tab-picker');
    const combo = getActiveCombo();

    let html = '';

    for (const tier of [TIERS.REGISTER, TIERS.TEMPO, TIERS.TEXTURE]) {
        const info = TIER_INFO[tier];
        const profiles = getProfiles(tier);
        const activeId = tier === TIERS.REGISTER ? combo.register
                       : tier === TIERS.TEMPO ? combo.tempo
                       : combo.texture;

        html += `
            <div style="margin-bottom: 14px;">
                <div style="
                    font-size: 12px; font-weight: 600; margin-bottom: 6px;
                    display: flex; align-items: center; gap: 6px;
                ">
                    <span>${info.icon}</span>
                    <span>${info.label}</span>
                    <span style="font-weight: 400; opacity: 0.5; font-size: 10px;">${info.desc}</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        `;

        for (const p of profiles) {
            const isActive = p.id === activeId;
            html += `
                <div class="voice-profile-chip" data-tier="${tier}" data-id="${p.id}" title="${p.tagline}\n\n${p.injection}" style="
                    padding: 4px 10px;
                    border-radius: 16px;
                    font-size: 11px;
                    cursor: pointer;
                    border: 1px solid ${isActive ? 'var(--SmartThemeQuoteColor, #e94560)' : 'var(--SmartThemeBorderColor, #555)'};
                    background: ${isActive ? 'rgba(233,69,96,0.15)' : 'rgba(0,0,0,0.15)'};
                    color: ${isActive ? 'var(--SmartThemeQuoteColor, #e94560)' : 'inherit'};
                    transition: all 0.15s;
                    white-space: nowrap;
                ">${p.icon} ${p.name}</div>
            `;
        }

        // Clear button for tier
        if (activeId) {
            html += `
                <div class="voice-profile-chip voice-clear-tier" data-tier="${tier}" style="
                    padding: 4px 10px;
                    border-radius: 16px;
                    font-size: 11px;
                    cursor: pointer;
                    border: 1px dashed var(--SmartThemeBorderColor, #555);
                    background: transparent;
                    opacity: 0.5;
                    white-space: nowrap;
                ">✕ clear</div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    }

    container.html(html);

    // Wire chip clicks
    container.find('.voice-profile-chip:not(.voice-clear-tier)').on('click', function() {
        const tier = $(this).data('tier');
        const id = $(this).data('id');

        // Toggle: click active to deactivate
        const combo = getActiveCombo();
        const currentId = tier === TIERS.REGISTER ? combo.register
                        : tier === TIERS.TEMPO ? combo.tempo
                        : combo.texture;

        if (currentId === id) {
            clearTier(tier);
        } else {
            setActiveTier(tier, id);
        }

        renderAll();
        updateFABIndicator();
    });

    container.find('.voice-clear-tier').on('click', function() {
        clearTier($(this).data('tier'));
        renderAll();
        updateFABIndicator();
    });
}

// ═══════════════════════════════════════
// PREVIEW TAB
// ═══════════════════════════════════════

function renderPreviewTab() {
    const container = $('#voice-tab-preview');
    const preview = getInjectionPreview();
    const combo = getActiveCombo();

    let html = '';

    if (combo.isEmpty) {
        html = `<div style="text-align:center; opacity:0.5; padding:20px; font-size:12px;">No voice active. Pick a stack or choose profiles in the Picker tab.</div>`;
    } else {
        html = `
            <div style="margin-bottom: 8px; font-size: 11px; opacity: 0.6;">
                Estimated injection: ~${preview.tokens} tokens
            </div>
            <pre style="
                background: rgba(0,0,0,0.3);
                border: 1px solid var(--SmartThemeBorderColor, #444);
                border-radius: 8px;
                padding: 10px;
                font-size: 11px;
                line-height: 1.5;
                white-space: pre-wrap;
                word-break: break-word;
                max-height: 300px;
                overflow-y: auto;
            ">${escapeHtml(preview.text)}</pre>
        `;
    }

    container.html(html);
}

// ═══════════════════════════════════════
// SHARED RENDER
// ═══════════════════════════════════════

export function renderAll() {
    updateActiveLabel();
    updateAutopilotButton();
    const activeTab = extensionSettings.activeTab || 'stacks';
    switch (activeTab) {
        case 'stacks':  renderStacksTab(); break;
        case 'picker':  renderPickerTab(); break;
        case 'preview': renderPreviewTab(); break;
        case 'soul':    renderSoulTab(); break;
    }
}

function updateActiveLabel() {
    const combo = getActiveCombo();
    const label = $('#voice-active-label');

    if (combo.isEmpty) {
        label.text('No voice active');
        return;
    }

    if (combo.stackId) {
        const stack = getStacks().find(s => s.id === combo.stackId);
        label.text(stack ? `${stack.icon} ${stack.name}` : 'Custom');
        return;
    }

    // Custom combo - show tier abbreviations
    const parts = [];
    const reg = getProfile(TIERS.REGISTER, combo.register);
    const tmp = getProfile(TIERS.TEMPO, combo.tempo);
    const tex = getProfile(TIERS.TEXTURE, combo.texture);
    if (reg) parts.push(`${reg.icon}`);
    if (tmp) parts.push(`${tmp.icon}`);
    if (tex) parts.push(`${tex.icon}`);
    label.text(parts.join(' · ') || 'Custom');
}

export function updateFABIndicator() {
    const combo = getActiveCombo();
    const fab = $('#voice-fab');
    if (combo.isEmpty) {
        fab.css('border-color', 'var(--SmartThemeBorderColor, #444)');
    } else {
        fab.css('border-color', 'var(--SmartThemeQuoteColor, #e94560)');
    }
}


// ═══════════════════════════════════════
// SOUL TAB (palette interview + card)
// ═══════════════════════════════════════

const SOUL_BTN = 'background: rgba(255,255,255,0.06); border: 1px solid var(--SmartThemeBorderColor, #444); border-radius: 8px; padding: 7px 10px; font-size: 12px; cursor: pointer; text-align: center;';
let soulCompiling = false;
let soulDraft = null;         // compiled-but-unsaved palette
let soulShowInterview = false;

function weightChips(cat, weights) {
    const entries = Object.entries(weights?.[cat] || {}).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<span style="opacity:0.4;">—</span>';
    return entries.map(([id, w]) =>
        `<span style="display:inline-block; margin:2px; padding:2px 7px; border-radius:9px; font-size:11px; background:${w > 0 ? 'rgba(120,200,120,0.15)' : 'rgba(220,120,120,0.15)'}; border:1px solid var(--SmartThemeBorderColor, #444);">${escapeHtml(id)} ${w > 0 ? '+' : ''}${w}</span>`
    ).join('');
}

function renderInterviewForm(palette) {
    const answers = palette?.answers || {};
    let html = '';
    for (const q of SOUL_QUESTIONS) {
        html += `
            <div style="margin-bottom:8px;">
                <div style="font-size:11px; font-weight:600; margin-bottom:2px;">${q.label}</div>
                <textarea class="voice-soul-answer" data-q="${q.id}" rows="2" placeholder="${escapeHtml(q.hint)}" style="width:100%; box-sizing:border-box; font-size:12px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:6px;">${escapeHtml(answers[q.id] || '')}</textarea>
            </div>`;
    }

    const profiles = listConnectionProfiles();
    const selProfile = extensionSettings.paletteCompileProfile || 'current';
    html += `
        <div style="display:flex; gap:8px; align-items:center; margin:8px 0; flex-wrap:wrap;">
            <select id="voice-soul-profile" style="flex:1; min-width:120px; font-size:12px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:4px;">
                <option value="current" ${selProfile === 'current' ? 'selected' : ''}>current profile</option>
                ${profiles.map(p => `<option value="${escapeHtml(p)}" ${selProfile === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
            </select>
            <input id="voice-soul-budget" type="number" min="500" step="500" value="${extensionSettings.paletteTokenBudget || 2000}" title="Token budget" style="width:74px; font-size:12px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:4px;">
        </div>
        <div style="font-size:10px; opacity:0.55; margin-bottom:8px;">Reasoning models spend tokens on hidden thinking first — prefer a non-reasoning utility model (GLM-4.7), or raise the budget to 4000+.</div>
        <div id="voice-soul-compile" style="${SOUL_BTN} ${soulCompiling ? 'opacity:0.5; pointer-events:none;' : ''}">${soulCompiling ? '⏳ Compiling…' : '✨ Compile palette'}</div>`;
    return html;
}

function renderPaletteCard(pal, isDraft) {
    const soul = computeSoulStack(pal);
    const soulParts = [soul.register, soul.tempo, soul.texture].filter(Boolean);
    let html = `
        <div style="border:1px solid ${isDraft ? 'var(--SmartThemeQuoteColor, #e94560)' : 'var(--SmartThemeBorderColor, #444)'}; border-radius:10px; padding:10px; margin-bottom:10px; background:rgba(0,0,0,0.18);">
            ${isDraft ? '<div style="font-size:11px; font-weight:600; margin-bottom:6px;">Proposed palette — review before saving</div>' : ''}
            <div style="font-size:11px; opacity:0.8; margin-bottom:4px;">Flavor (edit freely, ≤2 lines):</div>
            <input class="voice-soul-flavor" data-i="0" type="text" maxlength="110" value="${escapeHtml(pal.flavor?.[0] || '')}" style="width:100%; box-sizing:border-box; font-size:12px; margin-bottom:4px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:5px;">
            <input class="voice-soul-flavor" data-i="1" type="text" maxlength="110" value="${escapeHtml(pal.flavor?.[1] || '')}" style="width:100%; box-sizing:border-box; font-size:12px; margin-bottom:6px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:5px;">
            <div style="font-size:11px; margin:4px 0;">🎬 ${weightChips('registers', pal.weights)}</div>
            <div style="font-size:11px; margin:4px 0;">🎵 ${weightChips('tempos', pal.weights)}</div>
            <div style="font-size:11px; margin:4px 0;">🖋️ ${weightChips('textures', pal.weights)}</div>
            ${Object.keys(pal.sceneOverrides || {}).length ? `<div style="font-size:11px; margin:4px 0; opacity:0.8;">Overrides: ${escapeHtml(Object.entries(pal.sceneOverrides).map(([k, v]) => `${k}→${Object.values(v)[0]}`).join(', '))}</div>` : ''}
            <div style="font-size:11px; margin:6px 0 2px; opacity:0.8;">Soul stack: ${soulParts.length ? escapeHtml(soulParts.join(' · ')) : '—'}</div>
        </div>`;

    if (isDraft) {
        html += `
            <div style="display:flex; gap:8px;">
                <div id="voice-soul-save" style="${SOUL_BTN} flex:1;">💾 Save palette</div>
                <div id="voice-soul-discard" style="${SOUL_BTN} flex:1;">🗑️ Discard</div>
            </div>`;
    } else {
        const mode = pal.flavorMode || 'always';
        html += `
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
                <span style="font-size:11px;">Flavor:</span>
                <select id="voice-soul-flavormode" style="flex:1; font-size:12px; background:rgba(0,0,0,0.25); color:inherit; border:1px solid var(--SmartThemeBorderColor, #444); border-radius:6px; padding:4px;">
                    <option value="always" ${mode === 'always' ? 'selected' : ''}>every turn</option>
                    <option value="sceneChange" ${mode === 'sceneChange' ? 'selected' : ''}>on register change</option>
                    <option value="off" ${mode === 'off' ? 'selected' : ''}>off</option>
                </select>
            </div>
            <label class="checkbox_label" style="display:flex; align-items:center; gap:6px; font-size:12px; margin-bottom:8px;">
                <input type="checkbox" id="voice-soul-default" ${extensionSettings.useSoulDefault ? 'checked' : ''}>
                <span>Soul stack fills in when nothing is active</span>
            </label>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <div id="voice-soul-apply" style="${SOUL_BTN} flex:1; min-width:90px;">🎙️ Apply soul stack</div>
                <div id="voice-soul-edit" style="${SOUL_BTN} flex:1; min-width:90px;">${soulShowInterview ? '▲ Hide answers' : '✏️ Edit answers'}</div>
                <div id="voice-soul-delete" style="${SOUL_BTN} min-width:44px;" title="Delete palette">🗑️</div>
            </div>`;
    }
    return html;
}

function renderSoulTab() {
    const container = $('#voice-tab-soul');
    if (!container.length) return;

    const key = getEntityKey();
    if (!key) {
        container.html('<div style="text-align:center; opacity:0.5; padding:20px; font-size:12px;">Open a character or group chat to give its world a soul.</div>');
        return;
    }

    const pal = getPalette();
    let html = `<div style="font-size:12px; margin-bottom:8px;"><b>Soul of ${escapeHtml(getEntityName())}</b>${pal ? ` <span style="opacity:0.5; font-size:10px;">compiled ${pal.compiledAt ? new Date(pal.compiledAt).toLocaleDateString() : ''}</span>` : ''}</div>`;

    if (soulDraft) {
        html += renderPaletteCard(soulDraft, true);
    } else if (pal) {
        html += renderPaletteCard(pal, false);
        if (soulShowInterview) {
            html += `<div style="margin-top:10px; border-top:1px solid var(--SmartThemeBorderColor, #333); padding-top:8px;">${renderInterviewForm(pal)}</div>`;
        }
    } else {
        html += `<div style="font-size:11px; opacity:0.7; margin-bottom:8px;">Six questions, answered once. Don't describe how prose should be written — describe what's <i>true here</i>. The compiler only weights your existing library; your phrasing is the signal.</div>`;
        html += renderInterviewForm(null);
    }

    container.html(html);
    bindSoulHandlers(container);
}

function collectAnswers(container) {
    const answers = {};
    container.find('.voice-soul-answer').each(function () {
        const q = $(this).data('q');
        const v = $(this).val().trim();
        if (v) answers[q] = v;
    });
    return answers;
}

function bindSoulHandlers(container) {
    container.find('#voice-soul-compile').on('click', async function () {
        if (soulCompiling) return;
        const answers = collectAnswers(container);
        if (!Object.keys(answers).length) {
            toastr.warning('Answer at least one question first', '🎙️ Voice Soul');
            return;
        }
        extensionSettings.paletteCompileProfile = container.find('#voice-soul-profile').val() || 'current';
        extensionSettings.paletteTokenBudget = Number(container.find('#voice-soul-budget').val()) || 2000;
        saveSettings();

        soulCompiling = true;
        renderSoulTab();
        try {
            const compiled = await compilePalette(answers);
            soulDraft = {
                ...compiled,
                answers,
                world: getEntityName(),
                flavorMode: getPalette()?.flavorMode || 'always',
                compiledAt: Date.now(),
                version: 1,
            };
            toastr.success('Palette compiled — review and save', '🎙️ Voice Soul');
        } catch (e) {
            console.error('[Voice] Palette compile failed:', e);
            toastr.error(String(e?.message || e), '🎙️ Voice Soul', { timeOut: 8000 });
        } finally {
            soulCompiling = false;
            renderSoulTab();
        }
    });

    container.find('#voice-soul-save').on('click', function () {
        if (!soulDraft) return;
        // pull any flavor edits made on the draft card
        const flavor = [];
        container.find('.voice-soul-flavor').each(function () {
            const v = $(this).val().trim();
            if (v) flavor.push(v.slice(0, 110));
        });
        soulDraft.flavor = flavor.slice(0, 2);
        setPalette(soulDraft);
        soulDraft = null;
        soulShowInterview = false;
        toastr.success('Soul saved for this world', '🎙️ Voice Soul');
        renderSoulTab();
        updateFABIndicator();
    });

    container.find('#voice-soul-discard').on('click', function () {
        soulDraft = null;
        renderSoulTab();
    });

    container.find('#voice-soul-edit').on('click', function () {
        soulShowInterview = !soulShowInterview;
        renderSoulTab();
    });

    container.find('#voice-soul-delete').on('click', function () {
        deletePalette();
        soulDraft = null;
        soulShowInterview = false;
        toastr.info('Palette deleted', '🎙️ Voice Soul');
        renderSoulTab();
    });

    container.find('#voice-soul-apply').on('click', function () {
        if (applySoulStack()) {
            toastr.success('Soul stack applied', '🎙️ Voice');
            renderAll();
            updateFABIndicator();
        } else {
            toastr.warning('No positive weights to apply', '🎙️ Voice Soul');
        }
    });

    container.find('#voice-soul-flavormode').on('change', function () {
        const pal = getPalette();
        if (!pal) return;
        pal.flavorMode = $(this).val();
        setPalette(pal);
    });

    container.find('#voice-soul-default').on('change', function () {
        extensionSettings.useSoulDefault = $(this).prop('checked');
        saveSettings();
    });

    // live flavor edits on a SAVED palette persist directly
    if (!soulDraft) {
        container.find('.voice-soul-flavor').on('change', function () {
            const pal = getPalette();
            if (!pal) return;
            const flavor = [];
            container.find('.voice-soul-flavor').each(function () {
                const v = $(this).val().trim();
                if (v) flavor.push(v.slice(0, 110));
            });
            pal.flavor = flavor.slice(0, 2);
            setPalette(pal);
        });
    }
}

// ═══════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════

export function destroyUI() {
    unbindOutsideDismiss();
    $('#voice-fab').remove();
    $('#voice-panel').remove();
    $('#voice-save-dialog').remove();
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
