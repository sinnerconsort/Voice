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

    $('#form_sheld').append(fab);
    fab.on('click', togglePanel);
    makeFABDraggable(fab[0]);
}

function makeFABDraggable(el) {
    let isDragging = false;
    let wasDragged = false;
    let startX, startY, startTop, startRight;

    el.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = el.getBoundingClientRect();
        startTop = rect.top;
        startRight = window.innerWidth - rect.right;
        isDragging = true;
        wasDragged = false;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) wasDragged = true;
        if (!wasDragged) return;

        e.preventDefault();
        const newTop = startTop + dy;
        const newRight = startRight - dx;

        requestAnimationFrame(() => {
            el.style.top = `${Math.max(0, newTop)}px`;
            el.style.right = `${Math.max(0, newRight)}px`;
        });
    }, { passive: false });

    el.addEventListener('touchend', () => {
        isDragging = false;
        if (wasDragged) {
            extensionSettings.fabPosition = {
                top: el.style.top,
                right: el.style.right
            };
            saveSettings();
            // Prevent click from firing after drag
            el.addEventListener('click', (e) => e.stopImmediatePropagation(), { once: true, capture: true });
        }
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
            top: calc(var(--topBarBlockSize, 40px) + 8px);
            right: 8px;
            width: min(360px, calc(100vw - 16px));
            max-height: calc(100vh - var(--topBarBlockSize, 40px) - 80px);
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
                <div style="display: flex; gap: 6px;">
                    <span id="voice-clear-btn" title="Clear all" style="cursor: pointer; font-size: 14px; opacity: 0.6;">✖</span>
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
            </div>

            <!-- Tab Content -->
            <div id="voice-content" style="
                overflow-y: auto;
                max-height: calc(100vh - var(--topBarBlockSize, 40px) - 180px);
                padding: 10px;
            ">
                <div id="voice-tab-stacks"></div>
                <div id="voice-tab-picker" style="display:none;"></div>
                <div id="voice-tab-preview" style="display:none;"></div>
            </div>
        </div>
    `);

    $('#form_sheld').append(panel);

    // Tab switching
    panel.find('.voice-tab').on('click', function() {
        const tab = $(this).data('tab');
        switchTab(tab);
    });

    // Clear button
    $('#voice-clear-btn').on('click', () => {
        clearAll();
        renderAll();
        updateFABIndicator();
    });

    switchTab(extensionSettings.activeTab || 'stacks');
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

    $('#voice-tab-stacks, #voice-tab-picker, #voice-tab-preview').hide();
    $(`#voice-tab-${tabName}`).show();

    // Render the active tab
    switch (tabName) {
        case 'stacks':  renderStacksTab(); break;
        case 'picker':  renderPickerTab(); break;
        case 'preview': renderPreviewTab(); break;
    }
}

export function togglePanel() {
    const panel = $('#voice-panel');
    if (panel.is(':visible')) {
        panel.hide();
        setIsPanelOpen(false);
    } else {
        panel.show();
        setIsPanelOpen(true);
        renderAll();
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
    const activeTab = extensionSettings.activeTab || 'stacks';
    switch (activeTab) {
        case 'stacks':  renderStacksTab(); break;
        case 'picker':  renderPickerTab(); break;
        case 'preview': renderPreviewTab(); break;
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
// CLEANUP
// ═══════════════════════════════════════

export function destroyUI() {
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
