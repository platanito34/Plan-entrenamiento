// ── Mis ejercicios page ────────────────────────────────────────────────────────
import { loadPlans }                                                    from './plans.js';
import { loadWeights, setWorkingWeight, setExerciseNote, syncWeightsFromAPI } from './weights.js';
import { loadCustomExercises, addCustomExercise,
         updateCustomExercise, deleteCustomExercise,
         syncCustomExercisesFromAPI }                                   from './customExercises.js';
import { favoritesAPI }                                                 from './api.js';

// ── Favorites ─────────────────────────────────────────────────────────────────
const FAV_KEY = 'gym-favorites';

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveFavorites(set) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
}

async function syncFavoritesFromAPI() {
  try {
    const rows = await favoritesAPI.getAll();
    const favs = new Set(rows.map(r => r.exercise_id));
    localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
    return favs;
  } catch (err) {
    console.warn('[favorites] API sync failed:', err);
    return null;
  }
}

function toggleFavorite(id) {
  const favs = loadFavorites();
  const adding = !favs.has(id);
  if (adding) { favs.add(id); } else { favs.delete(id); }
  saveFavorites(favs);

  if (adding) {
    favoritesAPI.add(id).catch(err => console.warn('[favorites] POST failed:', err));
  } else {
    favoritesAPI.remove(id).catch(err => console.warn('[favorites] DELETE failed:', err));
  }

  return adding;
}

// ── Module state ───────────────────────────────────────────────────────────────
let _exercises = [];
let _weights   = {};
let _favorites = new Set();
let _filter    = 'all';
let _query     = '';
let _editingId = null;  // null = create mode, string = edit mode

// ── Panel HTML ─────────────────────────────────────────────────────────────────
function buildPanelHtml() {
  return `
    <div class="ex-panel-overlay" id="ex-panel-overlay"></div>
    <div class="ex-panel" id="ex-panel" role="dialog" aria-modal="true" aria-labelledby="ex-panel-title">
      <div class="ex-panel-handle"></div>
      <div class="ex-panel-scroll">
        <div class="ex-panel-header">
          <h3 class="ex-panel-title" id="ex-panel-title">Nuevo ejercicio</h3>
          <button class="ex-panel-close" id="ex-panel-close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="ex-create-form" novalidate>
          <div class="ex-form-field">
            <label class="ex-form-label" for="ex-form-name">
              Nombre <span class="ex-form-required">*</span>
            </label>
            <input type="text" class="ex-form-input" id="ex-form-name"
                   placeholder="Ej: Curl martillo unilateral" maxlength="60" autocomplete="off">
            <span class="ex-form-error" id="ex-form-name-err">El nombre es obligatorio.</span>
          </div>
          <div class="ex-form-field">
            <label class="ex-form-label" for="ex-form-muscle">
              Grupo muscular <span class="ex-form-required">*</span>
            </label>
            <select class="ex-form-input" id="ex-form-muscle">
              <option value="">Seleccionar...</option>
              <option value="pecho">Pecho</option>
              <option value="espalda">Espalda</option>
              <option value="hombros">Hombros</option>
              <option value="biceps">Bíceps</option>
              <option value="triceps">Tríceps</option>
              <option value="cuadriceps">Cuádriceps</option>
              <option value="isquiotibiales">Isquios</option>
              <option value="gluteos">Glúteos</option>
              <option value="gemelos">Gemelos</option>
              <option value="abdominales">Abdomen</option>
            </select>
            <span class="ex-form-error" id="ex-form-muscle-err">Selecciona un grupo muscular.</span>
          </div>
          <div class="ex-form-field">
            <label class="ex-form-label" for="ex-form-desc">
              Descripción <span class="ex-form-optional">(opcional)</span>
            </label>
            <textarea class="ex-form-input ex-form-textarea" id="ex-form-desc"
                      maxlength="400" placeholder="Cómo se hace el ejercicio..."></textarea>
            <div class="ex-form-counter-row">
              <span></span>
              <span class="ex-form-counter" id="ex-form-desc-counter">0/400</span>
            </div>
          </div>
          <div class="ex-form-field">
            <label class="ex-form-label" for="ex-form-note">
              Nota personal <span class="ex-form-optional">(opcional)</span>
            </label>
            <textarea class="ex-form-input ex-form-textarea" id="ex-form-note"
                      maxlength="300"
                      placeholder="Ej: Sentí tensión en muñeca, bajar peso cuando esté cansado..."></textarea>
            <div class="ex-form-counter-row">
              <span></span>
              <span class="ex-form-counter" id="ex-form-note-counter">0/300</span>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" id="ex-form-submit">Crear ejercicio</button>
        </form>
      </div>
    </div>
    <button class="ex-fab" id="ex-fab" type="button" aria-label="Añadir ejercicio">+</button>`;
}

// ── Main renderer ──────────────────────────────────────────────────────────────
export async function renderExercisesPage() {
  // Sync favorites, weights, and custom exercises from API in parallel
  await Promise.allSettled([
    syncFavoritesFromAPI(),
    syncWeightsFromAPI(),
    syncCustomExercisesFromAPI(),
  ]);

  _weights   = loadWeights();
  _favorites = loadFavorites();

  // Collect exercises from all saved plans
  const exMap = new Map();
  for (const plan of loadPlans()) {
    for (const day of plan.plan) {
      for (const section of day.sections) {
        for (const ex of section.exercises) {
          const id = ex.id ?? ex.name;
          if (!exMap.has(id)) {
            exMap.set(id, {
              id,
              name:        ex.name,
              images:      ex.images ?? [],
              muscleLabel: section.muscleLabel ?? '',
              isCustom:    !!ex.isCustom,
            });
          }
        }
      }
    }
  }

  // Merge ALL custom exercises (even those not in any plan yet)
  for (const ce of loadCustomExercises()) {
    if (!exMap.has(ce.id)) {
      exMap.set(ce.id, {
        id:          ce.id,
        name:        ce.name,
        images:      ce.images ?? [],
        muscleLabel: ce.muscleLabel ?? '',
        isCustom:    true,
      });
    } else {
      exMap.get(ce.id).isCustom = true;
    }
  }

  _exercises = [...exMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const app = document.getElementById('app');

  if (_exercises.length === 0) {
    app.innerHTML = `
      <div class="view-wrapper">
        <div class="view-header">
          <h2 class="view-title">Mis ejercicios</h2>
        </div>
        <div class="plans-empty">
          <p class="plans-empty-title">Sin ejercicios</p>
          <p class="plans-empty-text">Crea un plan o añade ejercicios personalizados para verlos aquí.</p>
        </div>
      </div>
      ${buildPanelHtml()}`;
    attachPanelListeners();
    return;
  }

  const muscleLabels = [
    ...new Set(_exercises.map(e => e.muscleLabel).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'es'));

  const filterOptions = [
    { value: 'all',       label: 'Todos' },
    { value: 'favorites', label: '♥ Favoritos' },
    ...muscleLabels.map(m => ({ value: m, label: m })),
  ];

  const chipHtml = filterOptions.map(o =>
    `<button class="ex-filter-chip${_filter === o.value ? ' active' : ''}" data-filter="${o.value}" type="button">${o.label}</button>`
  ).join('');

  const selectHtml = filterOptions.map(o =>
    `<option value="${o.value}"${_filter === o.value ? ' selected' : ''}>${o.label}</option>`
  ).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <h2 class="view-title">Mis ejercicios</h2>
        <p class="view-subtitle" id="ex-subtitle"></p>
      </div>

      <div class="ex-search-wrap">
        <svg class="ex-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="search" class="ex-search-input" id="ex-search"
               placeholder="Buscar ejercicio…" autocomplete="off" spellcheck="false"
               value="${escAttr(_query)}">
      </div>

      <div class="ex-filters" id="ex-filters">${chipHtml}</div>

      <div class="ex-filter-select-wrap">
        <select class="ex-filter-select" id="ex-filter-select" aria-label="Filtrar por grupo muscular">
          ${selectHtml}
        </select>
      </div>

      <div id="ex-list-wrap"></div>
    </div>
    ${buildPanelHtml()}`;

  function setFilter(value) {
    _filter = value;
    document.querySelectorAll('.ex-filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.filter === value)
    );
    const sel = document.getElementById('ex-filter-select');
    if (sel) sel.value = value;
    applyFilters();
  }

  document.getElementById('ex-search').addEventListener('input', e => {
    _query = e.target.value.trim();
    applyFilters();
  });
  document.querySelectorAll('.ex-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => setFilter(chip.dataset.filter));
  });
  document.getElementById('ex-filter-select').addEventListener('change', e => {
    setFilter(e.target.value);
  });

  attachPanelListeners();
  applyFilters();
}

// ── Panel open / close ─────────────────────────────────────────────────────────
function attachPanelListeners() {
  const overlay  = document.getElementById('ex-panel-overlay');
  const closeBtn = document.getElementById('ex-panel-close');
  const fab      = document.getElementById('ex-fab');
  const form     = document.getElementById('ex-create-form');
  const descTa   = document.getElementById('ex-form-desc');
  const noteTa   = document.getElementById('ex-form-note');
  const descCtr  = document.getElementById('ex-form-desc-counter');
  const noteCtr  = document.getElementById('ex-form-note-counter');

  if (!fab) return;

  fab.addEventListener('click', () => openCreatePanel());
  closeBtn?.addEventListener('click', closePanel);
  overlay?.addEventListener('click', closePanel);

  descTa?.addEventListener('input', () => {
    if (descCtr) descCtr.textContent = `${descTa.value.length}/400`;
  });
  noteTa?.addEventListener('input', () => {
    if (noteCtr) noteCtr.textContent = `${noteTa.value.length}/300`;
  });

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const nameInput   = document.getElementById('ex-form-name');
    const muscleInput = document.getElementById('ex-form-muscle');
    const nameErr     = document.getElementById('ex-form-name-err');
    const muscleErr   = document.getElementById('ex-form-muscle-err');

    let valid = true;
    if (!nameInput?.value.trim()) {
      nameErr?.classList.add('visible');
      valid = false;
    } else {
      nameErr?.classList.remove('visible');
    }
    if (!muscleInput?.value) {
      muscleErr?.classList.add('visible');
      valid = false;
    } else {
      muscleErr?.classList.remove('visible');
    }
    if (!valid) return;

    const noteVal = noteTa?.value.trim() ?? '';
    const editingNow = _editingId;

    if (editingNow) {
      updateCustomExercise(editingNow, {
        name:        nameInput.value.trim(),
        muscleId:    muscleInput.value,
        description: descTa?.value.trim() ?? '',
      });
      if (noteVal !== '') setExerciseNote(editingNow, noteVal);
    } else {
      const ex = addCustomExercise({
        name:        nameInput.value.trim(),
        muscleId:    muscleInput.value,
        description: descTa?.value.trim() ?? '',
      });
      if (noteVal !== '') setExerciseNote(ex.id, noteVal);
    }

    closePanel();
    document.dispatchEvent(new CustomEvent('show-toast', {
      detail: editingNow ? '✓ Ejercicio actualizado' : '✓ Ejercicio creado',
    }));
    renderExercisesPage();
  });
}

function openCreatePanel() {
  _editingId = null;
  const title   = document.getElementById('ex-panel-title');
  const submit  = document.getElementById('ex-form-submit');
  const nameI   = document.getElementById('ex-form-name');
  const muscI   = document.getElementById('ex-form-muscle');
  const descTa  = document.getElementById('ex-form-desc');
  const noteTa  = document.getElementById('ex-form-note');
  const descCtr = document.getElementById('ex-form-desc-counter');
  const noteCtr = document.getElementById('ex-form-note-counter');

  if (title)  title.textContent  = 'Nuevo ejercicio';
  if (submit) submit.textContent = 'Crear ejercicio';
  if (nameI)  nameI.value  = '';
  if (muscI)  muscI.value  = '';
  if (descTa) { descTa.value = ''; if (descCtr) descCtr.textContent = '0/400'; }
  if (noteTa) { noteTa.value = ''; if (noteCtr) noteCtr.textContent = '0/300'; }
  document.querySelectorAll('.ex-form-error').forEach(el => el.classList.remove('visible'));
  openPanel();
}

function openEditPanel(id) {
  _editingId = id;
  const customs     = loadCustomExercises();
  const ex          = customs.find(e => e.id === id);
  if (!ex) return;
  const currentNote = loadWeights()[id]?.note ?? '';

  const title   = document.getElementById('ex-panel-title');
  const submit  = document.getElementById('ex-form-submit');
  const nameI   = document.getElementById('ex-form-name');
  const muscI   = document.getElementById('ex-form-muscle');
  const descTa  = document.getElementById('ex-form-desc');
  const noteTa  = document.getElementById('ex-form-note');
  const descCtr = document.getElementById('ex-form-desc-counter');
  const noteCtr = document.getElementById('ex-form-note-counter');

  if (title)  title.textContent  = 'Editar ejercicio';
  if (submit) submit.textContent = 'Guardar cambios';
  if (nameI)  nameI.value = ex.name;
  if (muscI)  muscI.value = ex.muscleId;
  if (descTa) {
    descTa.value = ex.description || '';
    if (descCtr) descCtr.textContent = `${descTa.value.length}/400`;
  }
  if (noteTa) {
    noteTa.value = currentNote;
    if (noteCtr) noteCtr.textContent = `${currentNote.length}/300`;
  }
  document.querySelectorAll('.ex-form-error').forEach(el => el.classList.remove('visible'));
  openPanel();
}

function openPanel() {
  document.getElementById('ex-panel-overlay')?.classList.add('visible');
  document.getElementById('ex-panel')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  document.getElementById('ex-panel-overlay')?.classList.remove('visible');
  document.getElementById('ex-panel')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Filter + re-render list ────────────────────────────────────────────────────
function applyFilters() {
  let filtered = _exercises;

  if (_filter === 'favorites') {
    filtered = filtered.filter(ex => _favorites.has(ex.id));
  } else if (_filter !== 'all') {
    filtered = filtered.filter(ex => ex.muscleLabel === _filter);
  }

  if (_query) {
    const q = _query.toLowerCase();
    filtered = filtered.filter(ex => ex.name.toLowerCase().includes(q));
  }

  const sub  = document.getElementById('ex-subtitle');
  const wrap = document.getElementById('ex-list-wrap');
  if (!wrap) return;

  if (filtered.length === 0) {
    const msg = _query
      ? `No se encontraron ejercicios para "<strong>${_query}</strong>"`
      : 'Sin ejercicios en este filtro.';
    wrap.innerHTML = `<p class="ex-empty-msg">${msg}</p>`;
    if (sub) sub.textContent = '0 ejercicios';
    return;
  }

  if (sub) sub.textContent = `${filtered.length} ejercicio${filtered.length !== 1 ? 's' : ''}`;
  wrap.innerHTML = `<div class="ex-list">${filtered.map(buildExItem).join('')}</div>`;

  // Heart toggle
  wrap.querySelectorAll('[data-fav-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.favToggle;
      toggleFavorite(id);
      _favorites = loadFavorites();
      const nowFav = _favorites.has(id);
      btn.classList.toggle('active', nowFav);
      btn.setAttribute('aria-label', nowFav ? 'Quitar de favoritos' : 'Añadir a favoritos');
      if (_filter === 'favorites') applyFilters();
    });
  });

  // Expand / collapse history
  wrap.querySelectorAll('[data-ex-toggle]').forEach(header => {
    header.addEventListener('click', () => {
      const id   = header.dataset.exToggle;
      const hist = document.getElementById(`ex-hist-${id}`);
      const chev = document.querySelector(`[data-ex-chevron="${id}"]`);
      if (!hist) return;
      const willOpen = !hist.classList.contains('open');
      toggleHeightPanel(hist, willOpen);
      if (chev) chev.classList.toggle('open', willOpen);
    });
  });

  // Note textarea — show save button on change
  wrap.querySelectorAll('[data-note-id]').forEach(ta => {
    const id      = ta.dataset.noteId;
    const counter = wrap.querySelector(`[data-note-counter="${id}"]`);
    const saveBtn = wrap.querySelector(`[data-note-save="${id}"]`);
    ta.addEventListener('input', () => {
      if (counter) counter.textContent = `${ta.value.length}/300`;
      if (saveBtn) saveBtn.style.display = ta.value !== ta.dataset.noteOriginal ? '' : 'none';
    });
  });

  // Note save
  wrap.querySelectorAll('[data-note-save]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.noteSave;
      const ta = wrap.querySelector(`[data-note-id="${id}"]`);
      if (!ta) return;
      setExerciseNote(id, ta.value);
      _weights = loadWeights();
      ta.dataset.noteOriginal = ta.value;
      btn.style.display = 'none';
      document.dispatchEvent(new CustomEvent('show-toast', { detail: '✓ Nota guardada' }));
    });
  });

  // Weight edit — open inline editor
  wrap.querySelectorAll('[data-weight-edit]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id      = btn.dataset.weightEdit;
      const display = document.getElementById(`ex-wdisplay-${id}`);
      const editor  = document.getElementById(`ex-weditor-${id}`);
      const input   = document.getElementById(`ex-winput-${id}`);
      if (!display || !editor) return;
      display.style.display = 'none';
      editor.style.display  = 'flex';
      input?.focus();
      input?.select();
    });
  });

  // Weight edit — cancel
  wrap.querySelectorAll('[data-weight-cancel]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id      = btn.dataset.weightCancel;
      const display = document.getElementById(`ex-wdisplay-${id}`);
      const editor  = document.getElementById(`ex-weditor-${id}`);
      if (!display || !editor) return;
      editor.style.display  = 'none';
      display.style.display = '';
    });
  });

  // Weight edit — save
  wrap.querySelectorAll('[data-weight-save]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id    = btn.dataset.weightSave;
      const input = document.getElementById(`ex-winput-${id}`);
      const val   = parseFloat(input?.value);
      if (isNaN(val) || val < 0) return;

      const prevMax = _weights[id]?.maxWeight ?? 0;
      setWorkingWeight(id, val, new Date().toISOString());
      _weights = loadWeights();
      const wd = _weights[id];

      // Close editor, update displayed value
      const display = document.getElementById(`ex-wdisplay-${id}`);
      const editor  = document.getElementById(`ex-weditor-${id}`);
      const wvalEl  = document.getElementById(`ex-wval-${id}`);
      const wmaxEl  = document.getElementById(`ex-wmaxval-${id}`);
      if (editor)  editor.style.display  = 'none';
      if (display) display.style.display = '';
      if (wvalEl)  wvalEl.textContent    = val + ' kg';
      if (wmaxEl)  wmaxEl.textContent    =
        wd?.maxWeight ? `${wd.maxWeight} kg${wd.maxDate ? ' · ' + fmtDate(wd.maxDate) : ''}` : '—';

      // Update header weight chips
      const headerWeights = wrap.querySelector(`[data-ex-toggle="${id}"]`)?.querySelector('.ex-item-weights');
      if (headerWeights) {
        headerWeights.innerHTML = `
          <span class="ex-weight-chip">
            ${val} kg<span class="ex-weight-tag">trabajo</span>
          </span>
          ${wd?.maxWeight ? `<span class="ex-weight-chip ex-weight-chip-max">
            ${wd.maxWeight} kg
            <span class="ex-weight-tag">máx${wd.maxDate ? ' · ' + fmtDate(wd.maxDate) : ''}</span>
          </span>` : ''}`;
      }

      // Refresh history list
      const histList = wrap.querySelector(`#ex-hist-${id} .ex-hist-list`);
      if (histList) {
        const hist = wd?.history ?? [];
        histList.innerHTML = hist.length > 0
          ? hist.slice().reverse().map(h => `
              <div class="ex-hist-row">
                <span class="ex-hist-date">${fmtDate(h.date)}</span>
                <span class="ex-hist-weight">${h.weight} kg</span>
              </div>`).join('')
          : '<p class="ex-hist-empty">Sin registros de peso todavía.</p>';
      }

      // Refresh mini chart
      const exItem   = wrap.querySelector(`[data-ex-toggle="${id}"]`)?.closest('.ex-item');
      const chartWrap = exItem?.querySelector('.ex-chart-wrap');
      const newHist   = wd?.history ?? [];
      if (exItem) {
        if (newHist.length >= 2) {
          const svg = buildWeightChart(newHist);
          if (chartWrap) {
            chartWrap.innerHTML = svg;
          } else {
            const cw = document.createElement('div');
            cw.className = 'ex-chart-wrap';
            cw.innerHTML = svg;
            exItem.querySelector('.ex-item-header')?.after(cw);
          }
        }
      }

      const isRecord = val > prevMax;
      document.dispatchEvent(new CustomEvent('show-toast', {
        detail: isRecord ? '🏆 ¡Nuevo récord personal!' : '✓ Peso actualizado',
      }));
    });
  });

  // Edit custom exercise
  wrap.querySelectorAll('[data-edit-custom]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openEditPanel(btn.dataset.editCustom);
    });
  });

  // Delete custom exercise
  wrap.querySelectorAll('[data-delete-custom]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este ejercicio personalizado? Esta acción no se puede deshacer.')) return;
      deleteCustomExercise(btn.dataset.deleteCustom);
      document.dispatchEvent(new CustomEvent('show-toast', { detail: '✓ Ejercicio eliminado' }));
      renderExercisesPage();
    });
  });
}

// ── Build a single exercise card ──────────────────────────────────────────────
function buildExItem(ex, i) {
  const data     = _weights[ex.id] ?? null;
  const workingW = data?.workingWeight ?? null;
  const maxW     = data?.maxWeight     ?? null;
  const history  = data?.history       ?? [];
  const note     = data?.note          ?? '';
  const isFav    = _favorites.has(ex.id);
  const chartHtml = history.length >= 2 ? buildWeightChart(history) : '';

  const histRows = history.length > 0
    ? history.slice().reverse().map(h => `
        <div class="ex-hist-row">
          <span class="ex-hist-date">${fmtDate(h.date)}</span>
          <span class="ex-hist-weight">${h.weight} kg</span>
        </div>`).join('')
    : '<p class="ex-hist-empty">Sin registros de peso todavía.</p>';

  const thumbHtml = ex.images[0]
    ? `<img src="${ex.images[0]}" alt="${escAttr(ex.name)}" class="ex-item-thumb" loading="lazy">`
    : ex.isCustom
      ? `<div class="ex-item-thumb ex-thumb-initials" aria-hidden="true">${getInitials(ex.name)}</div>`
      : '<div class="ex-item-thumb ex-item-thumb-placeholder"></div>';

  const customActionsHtml = ex.isCustom ? `
    <div class="ex-custom-actions">
      <button class="btn btn-sm btn-ghost" data-edit-custom="${ex.id}" type="button">✏ Editar</button>
      <button class="btn btn-sm btn-ghost ex-delete-btn" data-delete-custom="${ex.id}" type="button">🗑 Eliminar</button>
    </div>` : '';

  return `
    <div class="ex-item stagger-item" style="animation-delay:${i * 30}ms">
      <div class="ex-item-header" data-ex-toggle="${ex.id}">
        ${thumbHtml}
        <div class="ex-item-info">
          <div class="ex-item-name-row">
            <h3 class="ex-item-name">${escHtml(ex.name)}</h3>
            ${ex.isCustom ? '<span class="badge-personal">Personal</span>' : ''}
          </div>
          <div class="ex-item-weights">
            <span class="ex-weight-chip">
              ${workingW !== null ? workingW + ' kg' : '—'}
              <span class="ex-weight-tag">trabajo</span>
            </span>
            ${maxW ? `<span class="ex-weight-chip ex-weight-chip-max">
              ${maxW} kg
              <span class="ex-weight-tag">máx${data.maxDate ? ' · ' + fmtDate(data.maxDate) : ''}</span>
            </span>` : ''}
          </div>
        </div>
        <button class="ex-fav-btn${isFav ? ' active' : ''}" data-fav-toggle="${ex.id}"
                type="button" aria-label="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">♥</button>
        <span class="ex-expand-chevron" data-ex-chevron="${ex.id}">▾</span>
      </div>
      ${chartHtml ? `<div class="ex-chart-wrap">${chartHtml}</div>` : ''}
      <div class="ex-history" id="ex-hist-${ex.id}">
        <div class="ex-history-inner">
          <div class="ex-weight-editor-bar">
            <div class="ex-wbar-row">
              <div class="ex-wbar-item">
                <span class="ex-wbar-label">Peso de trabajo</span>
                <div class="ex-wbar-display" id="ex-wdisplay-${ex.id}">
                  <span class="ex-wbar-value" id="ex-wval-${ex.id}">${workingW !== null ? workingW + ' kg' : '—'}</span>
                  <button class="ex-wbar-edit-btn" data-weight-edit="${ex.id}" type="button" aria-label="Editar peso de trabajo">✏</button>
                </div>
                <div class="ex-wbar-editor" id="ex-weditor-${ex.id}" style="display:none">
                  <input type="number" inputmode="decimal" class="ex-wbar-input"
                         id="ex-winput-${ex.id}"
                         value="${workingW !== null ? workingW : ''}"
                         placeholder="0" min="0" step="0.5"
                         aria-label="Peso de trabajo en kg">
                  <span class="ex-wbar-unit">kg</span>
                  <button class="btn btn-sm btn-primary" data-weight-save="${ex.id}" type="button">Guardar</button>
                  <button class="btn btn-sm btn-ghost"   data-weight-cancel="${ex.id}" type="button">Cancelar</button>
                </div>
              </div>
              <div class="ex-wbar-item ex-wbar-item-max">
                <span class="ex-wbar-label">Peso máximo</span>
                <span class="ex-wbar-value ex-wbar-value-max" id="ex-wmaxval-${ex.id}">
                  ${maxW ? `${maxW} kg${data.maxDate ? ' · ' + fmtDate(data.maxDate) : ''}` : '—'}
                </span>
              </div>
            </div>
          </div>
          <div class="ex-hist-list">${histRows}</div>
          <div class="ex-note-section">
            <div class="ex-note-head">
              <span class="ex-note-label">Mis notas</span>
              <span class="ex-note-counter" data-note-counter="${ex.id}">${note.length}/300</span>
            </div>
            <textarea class="ex-note-textarea"
                      data-note-id="${ex.id}"
                      data-note-original="${escAttr(note)}"
                      maxlength="300"
                      placeholder="Añade una nota sobre este ejercicio… (ej: bajar peso, cuidar la espalda, sentí dolor en hombro...)">${escHtml(note)}</textarea>
            <button class="btn btn-sm btn-primary ex-note-save"
                    data-note-save="${ex.id}" type="button"
                    style="display:none">Guardar nota</button>
          </div>
          ${customActionsHtml}
        </div>
      </div>
    </div>`;
}

// ── Smooth height toggle ───────────────────────────────────────────────────────
function toggleHeightPanel(el, open) {
  if (open === el.classList.contains('open')) return;
  if (open) {
    el.classList.add('open');
    el.style.height   = '0';
    el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'height 0.22s ease';
    el.style.height     = el.scrollHeight + 'px';
    el.addEventListener('transitionend', () => {
      el.style.height = 'auto'; el.style.overflow = ''; el.style.transition = '';
    }, { once: true });
  } else {
    el.style.height   = el.getBoundingClientRect().height + 'px';
    el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'height 0.22s ease';
    el.style.height     = '0';
    el.addEventListener('transitionend', () => {
      el.style.height = ''; el.style.overflow = ''; el.style.transition = '';
      el.classList.remove('open');
    }, { once: true });
  }
}

// ── SVG line chart ─────────────────────────────────────────────────────────────
function buildWeightChart(history) {
  const W = 300, H = 56, PX = 6, PY = 8;
  const iW = W - PX * 2, iH = H - PY * 2;
  const vals = history.map(h => h.weight);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const pts = history.map((h, idx) => {
    const x = PX + (idx / (history.length - 1)) * iW;
    const y = PY + (1 - (h.weight - minV) / range) * iH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = pts.join(' ');
  const [lx, ly] = pts[pts.length - 1].split(',');
  const area = `${line} ${(PX + iW).toFixed(1)},${PY + iH} ${PX},${PY + iH}`;

  return `
    <svg class="weight-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon class="chart-area"  points="${area}"/>
      <polyline class="chart-line" points="${line}"/>
      <circle   class="chart-dot"  cx="${lx}" cy="${ly}" r="3"/>
    </svg>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
