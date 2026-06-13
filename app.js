'use strict';

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem('chronomancer');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.round === 'number' && Array.isArray(parsed.characters)) {
      return parsed;
    }
  } catch (_) {}
  return { round: 1, characters: [] };
}

function saveState(s) {
  localStorage.setItem('chronomancer', JSON.stringify(s));
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem('chronomancer-templates');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}
  return [];
}

function saveTemplates(t) {
  localStorage.setItem('chronomancer-templates', JSON.stringify(t));
}

// ─── State Mutations (pure) ───────────────────────────────────────────────────

function advanceRound(s) {
  return {
    ...s,
    round: s.round + 1,
    characters: s.characters.map(char => ({
      ...char,
      effects: char.effects
        .map(e => ({ ...e, duration: e.duration - 1 }))
        .filter(e => e.duration > 0),
    })),
  };
}

function addNpc(s, name) {
  const char = { id: uid(), name: name.trim(), templateId: null, effects: [] };
  return { ...s, characters: [...s.characters, char] };
}

function addPc(s, template) {
  const char = { id: uid(), name: template.name, templateId: template.id, effects: [] };
  return { ...s, characters: [...s.characters, char] };
}

function removeCharacter(s, charId) {
  return { ...s, characters: s.characters.filter(c => c.id !== charId) };
}

function addEffect(s, charId, name, rawDuration) {
  const duration = Math.max(1, parseInt(rawDuration, 10));
  const effect = { id: uid(), name: name.trim(), duration, initialDuration: duration };
  return {
    ...s,
    characters: s.characters.map(c =>
      c.id === charId ? { ...c, effects: [...c.effects, effect] } : c
    ),
  };
}

function removeEffect(s, charId, effectId) {
  return {
    ...s,
    characters: s.characters.map(c =>
      c.id === charId ? { ...c, effects: c.effects.filter(e => e.id !== effectId) } : c
    ),
  };
}

// ─── Template Mutations (pure) ────────────────────────────────────────────────

function addTemplate(templates, name, abilities) {
  return [...templates, { id: uid(), name: name.trim(), abilities }];
}

function removeTemplate(templates, templateId) {
  return templates.filter(t => t.id !== templateId);
}

function updateTemplate(templates, templateId, name, abilities) {
  return templates.map(t =>
    t.id === templateId ? { ...t, name: name.trim(), abilities } : t
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID();
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function effectClass(effect) {
  const { duration, initialDuration } = effect;
  if (initialDuration <= 5 && duration === 1) return 'effect-warn';
  if (initialDuration > 5 && duration <= 3) return 'effect-warn';
  return 'effect-ok';
}

// ─── HTML Builders ────────────────────────────────────────────────────────────

function buildEffectRow(effect, charId) {
  const cls = effectClass(effect);
  return `
    <div class="effect-row">
      <span class="effect-name">${esc(effect.name)}</span>
      <span class="effect-badge ${cls}">${effect.duration} rnd</span>
      <button class="remove-effect-btn"
        data-char-id="${esc(charId)}"
        data-effect-id="${esc(effect.id)}"
        title="Remove effect">✕</button>
    </div>`;
}

function buildAddEffectFormPc(charId, abilities) {
  const options = abilities.map(a =>
    `<option value="${esc(a.name)}" data-duration="${a.defaultDuration}">${esc(a.name)} (${a.defaultDuration} rnd)</option>`
  ).join('');
  return `
    <div class="add-effect-form" data-char-id="${esc(charId)}">
      <select class="ability-select" data-char-id="${esc(charId)}">
        <option value="">— pick ability —</option>
        ${options}
        <option value="__custom__">Custom…</option>
      </select>
      <input type="text" class="custom-name-input hidden" placeholder="Effect name" />
      <input type="number" class="duration-input" min="1" max="999" placeholder="Rnd" />
      <button class="btn btn-sm add-effect-btn" data-char-id="${esc(charId)}">Add</button>
    </div>`;
}

function buildAddEffectFormManual(charId) {
  return `
    <div class="add-effect-form" data-char-id="${esc(charId)}">
      <input type="text" class="effect-name-input" placeholder="Effect name" />
      <input type="number" class="duration-input" min="1" max="999" placeholder="Rnd" />
      <button class="btn btn-sm add-effect-btn" data-char-id="${esc(charId)}">Add</button>
    </div>`;
}

function buildCharacterCard(char, template) {
  const isPC = !!char.templateId;
  const hasAbilities = template && template.abilities.length > 0;
  const effectsHtml = char.effects.map(e => buildEffectRow(e, char.id)).join('');
  const addFormHtml = hasAbilities
    ? buildAddEffectFormPc(char.id, template.abilities)
    : buildAddEffectFormManual(char.id);

  return `
    <div class="character-card" data-char-id="${esc(char.id)}">
      <div class="card-header">
        <div class="card-title">
          <span class="char-name">${esc(char.name)}</span>
          <span class="type-badge ${isPC ? 'badge-pc' : 'badge-npc'}">${isPC ? 'PC' : 'NPC'}</span>
        </div>
        <button class="remove-char-btn" data-char-id="${esc(char.id)}">Remove</button>
      </div>
      <div class="effects-list">
        ${effectsHtml || '<p class="no-effects">No active effects</p>'}
      </div>
      ${addFormHtml}
    </div>`;
}

// ─── Modal HTML Builders ──────────────────────────────────────────────────────

function buildTemplateRow(template) {
  const chipsHtml = template.abilities.length > 0
    ? template.abilities.map(a =>
        `<span class="ability-chip">${esc(a.name)} · ${a.defaultDuration} rnd</span>`
      ).join('')
    : '<span class="no-abilities">No abilities</span>';

  return `
    <div class="template-row" data-template-id="${esc(template.id)}">
      <div class="template-info">
        <strong>${esc(template.name)}</strong>
        <div class="abilities-chip-list">${chipsHtml}</div>
      </div>
      <div class="template-actions">
        <button class="btn btn-sm btn-secondary edit-template-btn" data-template-id="${esc(template.id)}">Edit</button>
        <button class="btn btn-sm btn-danger delete-template-btn" data-template-id="${esc(template.id)}">Delete</button>
      </div>
    </div>`;
}

function buildAbilityInputRow(name = '', duration = '') {
  return `
    <div class="ability-row">
      <input type="text" class="ability-name-input" placeholder="Ability name" value="${esc(name)}" />
      <input type="number" class="ability-duration-input" placeholder="Rnd" min="1" value="${esc(duration)}" />
      <button class="btn btn-icon remove-ability-row-btn" title="Remove row">✕</button>
    </div>`;
}

function buildTemplateForm(existing) {
  const name = existing ? existing.name : '';
  const abilitiesHtml = existing
    ? existing.abilities.map(a => buildAbilityInputRow(a.name, a.defaultDuration)).join('')
    : '';
  return `
    <div class="template-form" data-template-id="${existing ? esc(existing.id) : ''}">
      <input type="text" class="template-name-input" placeholder="PC name" value="${esc(name)}" />
      <div class="abilities-form-list">${abilitiesHtml}</div>
      <button class="btn btn-sm btn-ghost add-ability-row-btn">+ Add Ability</button>
      <div class="form-actions">
        <button class="btn btn-sm save-template-btn">Save</button>
        <button class="btn btn-sm btn-ghost cancel-template-btn">Cancel</button>
      </div>
    </div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

let state = loadState();
let templates = loadTemplates();

function render() {
  document.getElementById('round-number').textContent = state.round;

  const grid = document.getElementById('characters-grid');
  if (state.characters.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <p>No characters in the tracker.</p>
        <p>Add an NPC or PC below to get started.</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.characters.map(char => {
    const template = templates.find(t => t.id === char.templateId) || null;
    return buildCharacterCard(char, template);
  }).join('');
}

function renderModal() {
  const body = document.getElementById('modal-body');
  body.innerHTML = templates.length === 0
    ? '<p class="no-templates">No PC templates yet.</p>'
    : templates.map(buildTemplateRow).join('');
}

// ─── Handler Functions ────────────────────────────────────────────────────────

function handleAbilitySelectChange(select) {
  const form = select.closest('.add-effect-form');
  const durationInput = form.querySelector('.duration-input');
  const customInput = form.querySelector('.custom-name-input');

  if (select.value === '__custom__') {
    customInput.classList.remove('hidden');
    durationInput.value = '';
    customInput.focus();
  } else if (select.value) {
    customInput.classList.add('hidden');
    durationInput.value = select.options[select.selectedIndex].dataset.duration || '';
  } else {
    customInput.classList.add('hidden');
    durationInput.value = '';
  }
}

function handleAddEffect(btn) {
  const charId = btn.dataset.charId;
  const form = btn.closest('.add-effect-form');
  const select = form.querySelector('.ability-select');
  const customInput = form.querySelector('.custom-name-input');
  const nameInput = form.querySelector('.effect-name-input');
  const durationInput = form.querySelector('.duration-input');

  const name = select
    ? (select.value === '__custom__' ? customInput.value.trim() : select.value)
    : nameInput.value.trim();
  const duration = durationInput.value;

  if (!name || !duration || parseInt(duration, 10) < 1) return;

  state = addEffect(state, charId, name, duration);
  saveState(state);
  render();
}

function handleSaveTemplate(form) {
  const templateId = form.dataset.templateId || null;
  const name = form.querySelector('.template-name-input').value.trim();
  if (!name) return;

  const abilities = Array.from(form.querySelectorAll('.ability-row'))
    .map(row => ({
      name: row.querySelector('.ability-name-input').value.trim(),
      defaultDuration: parseInt(row.querySelector('.ability-duration-input').value, 10),
    }))
    .filter(a => a.name && a.defaultDuration >= 1);

  templates = templateId
    ? updateTemplate(templates, templateId, name, abilities)
    : addTemplate(templates, name, abilities);

  saveTemplates(templates);
  renderModal();
  render();
}

function showTemplateEditForm(templateId) {
  renderModal();
  const existing = templateId ? templates.find(t => t.id === templateId) : null;
  const formHtml = buildTemplateForm(existing);

  if (templateId) {
    const row = document.querySelector(`.template-row[data-template-id="${templateId}"]`);
    if (row) row.outerHTML = formHtml;
  } else {
    const body = document.getElementById('modal-body');
    const noTemplates = body.querySelector('.no-templates');
    if (noTemplates) noTemplates.remove();
    body.insertAdjacentHTML('beforeend', formHtml);
  }

  document.querySelector('.template-form .template-name-input')?.focus();
}

// ─── Event Delegation ─────────────────────────────────────────────────────────

document.addEventListener('click', function (e) {
  const removeCharBtn = e.target.closest('.remove-char-btn');
  if (removeCharBtn) {
    state = removeCharacter(state, removeCharBtn.dataset.charId);
    saveState(state);
    render();
    return;
  }

  const removeEffectBtn = e.target.closest('.remove-effect-btn');
  if (removeEffectBtn) {
    state = removeEffect(state, removeEffectBtn.dataset.charId, removeEffectBtn.dataset.effectId);
    saveState(state);
    render();
    return;
  }

  const addEffectBtn = e.target.closest('.add-effect-btn');
  if (addEffectBtn) {
    handleAddEffect(addEffectBtn);
    return;
  }

  if (e.target === document.getElementById('modal-overlay')) {
    e.target.classList.add('hidden');
    return;
  }

  const editTemplateBtn = e.target.closest('.edit-template-btn');
  if (editTemplateBtn) {
    showTemplateEditForm(editTemplateBtn.dataset.templateId);
    return;
  }

  const deleteTemplateBtn = e.target.closest('.delete-template-btn');
  if (deleteTemplateBtn) {
    const templateId = deleteTemplateBtn.dataset.templateId;
    const template = templates.find(t => t.id === templateId);
    if (template && confirm(`Delete PC template "${template.name}"?`)) {
      templates = removeTemplate(templates, templateId);
      saveTemplates(templates);
      renderModal();
      render();
    }
    return;
  }

  const addAbilityRowBtn = e.target.closest('.add-ability-row-btn');
  if (addAbilityRowBtn) {
    const list = addAbilityRowBtn.closest('.template-form').querySelector('.abilities-form-list');
    list.insertAdjacentHTML('beforeend', buildAbilityInputRow());
    list.lastElementChild.querySelector('.ability-name-input').focus();
    return;
  }

  const removeAbilityRowBtn = e.target.closest('.remove-ability-row-btn');
  if (removeAbilityRowBtn) {
    removeAbilityRowBtn.closest('.ability-row').remove();
    return;
  }

  const saveTemplateBtn = e.target.closest('.save-template-btn');
  if (saveTemplateBtn) {
    handleSaveTemplate(saveTemplateBtn.closest('.template-form'));
    return;
  }

  const cancelTemplateBtn = e.target.closest('.cancel-template-btn');
  if (cancelTemplateBtn) {
    renderModal();
    return;
  }
});

document.addEventListener('change', function (e) {
  if (e.target.classList.contains('ability-select')) {
    handleAbilitySelectChange(e.target);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    if (e.target.id === 'npc-name-input') {
      document.getElementById('npc-confirm-btn').click();
      return;
    }
    if (e.target.classList.contains('duration-input')) {
      e.target.closest('.add-effect-form')?.querySelector('.add-effect-btn')?.click();
      return;
    }
    if (e.target.classList.contains('effect-name-input') || e.target.classList.contains('custom-name-input')) {
      e.target.closest('.add-effect-form')?.querySelector('.duration-input')?.focus();
      return;
    }
  }

  if (e.key === 'Escape') {
    const modal = document.getElementById('modal-overlay');
    if (!modal.classList.contains('hidden')) { modal.classList.add('hidden'); return; }
    if (!document.getElementById('add-npc-form').classList.contains('hidden')) {
      document.getElementById('npc-cancel-btn').click(); return;
    }
    if (!document.getElementById('add-pc-form').classList.contains('hidden')) {
      document.getElementById('pc-cancel-btn').click(); return;
    }
  }
});

// ─── Direct Event Listeners ───────────────────────────────────────────────────

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Reset session? This will remove all characters and set the round back to 1.')) return;
  state = { round: 1, characters: [] };
  saveState(state);
  render();
});

document.getElementById('advance-round-btn').addEventListener('click', () => {
  state = advanceRound(state);
  saveState(state);
  render();
});

document.getElementById('add-npc-btn').addEventListener('click', () => {
  document.getElementById('add-npc-form').classList.remove('hidden');
  document.getElementById('add-pc-form').classList.add('hidden');
  document.getElementById('npc-name-input').focus();
});

document.getElementById('npc-confirm-btn').addEventListener('click', () => {
  const input = document.getElementById('npc-name-input');
  if (!input.value.trim()) return;
  state = addNpc(state, input.value);
  saveState(state);
  render();
  input.value = '';
  document.getElementById('add-npc-form').classList.add('hidden');
});

document.getElementById('npc-cancel-btn').addEventListener('click', () => {
  document.getElementById('npc-name-input').value = '';
  document.getElementById('add-npc-form').classList.add('hidden');
});

document.getElementById('add-pc-btn').addEventListener('click', () => {
  const select = document.getElementById('pc-template-select');
  if (templates.length === 0) {
    select.innerHTML = '<option value="">No templates — use "Manage PCs" first</option>';
  } else {
    select.innerHTML =
      '<option value="">— select a PC —</option>' +
      templates.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  }
  document.getElementById('add-pc-form').classList.remove('hidden');
  document.getElementById('add-npc-form').classList.add('hidden');
});

document.getElementById('pc-confirm-btn').addEventListener('click', () => {
  const templateId = document.getElementById('pc-template-select').value;
  if (!templateId) return;
  const template = templates.find(t => t.id === templateId);
  if (!template) return;
  state = addPc(state, template);
  saveState(state);
  render();
  document.getElementById('add-pc-form').classList.add('hidden');
});

document.getElementById('pc-cancel-btn').addEventListener('click', () => {
  document.getElementById('add-pc-form').classList.add('hidden');
});

document.getElementById('manage-pcs-btn').addEventListener('click', () => {
  renderModal();
  document.getElementById('modal-overlay').classList.remove('hidden');
});

document.getElementById('modal-close-btn').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
});

document.getElementById('add-template-btn').addEventListener('click', () => {
  showTemplateEditForm(null);
});

document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chronomancer-session.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('export-pcs-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chronomancer-pcs.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-pcs-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        alert('Invalid PC file: expected a JSON array.');
        return;
      }
      if (!confirm('This will replace all current PC templates. Continue?')) return;
      templates = data;
      saveTemplates(templates);
      renderModal();
      render();
    } catch {
      alert('Could not parse the JSON file.');
    }
  };
  reader.readAsText(file);
  this.value = '';
});

document.getElementById('import-file').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (typeof data.round !== 'number' || !Array.isArray(data.characters)) {
        alert('Invalid session file: expected "round" and "characters" fields.');
        return;
      }
      state = data;
      saveState(state);
      render();
    } catch {
      alert('Could not parse the JSON file.');
    }
  };
  reader.readAsText(file);
  this.value = '';
});

// ─── Init ─────────────────────────────────────────────────────────────────────

render();
