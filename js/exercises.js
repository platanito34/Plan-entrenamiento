// ── Mis ejercicios page ────────────────────────────────────────────────────────
import { loadPlans }                     from './plans.js';
import { loadWeights, setWorkingWeight } from './weights.js';

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

function toggleFavorite(id) {
  const favs = loadFavorites();
  if (favs.has(id)) { favs.delete(id); } else { favs.add(id); }
  saveFavorites(favs);
  return favs.has(id);
}

// ── Module state (persists across navigations for UX continuity) ───────────────
let _exercises = [];
let _weights   = {};
let _favorites = new Set();
let _filter    = 'all';   // 'all' | 'favorites' | muscle label string
let _query     = '';

// ── Main renderer ──────────────────────────────────────────────────────────────
export function renderExercisesPage() {
  _weights   = loadWeights();
  _favorites = loadFavorites();

  // Collect unique exercises from all plans, capturing muscleLabel from section
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
            });
          }
        }
      }
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
          <p class="plans-empty-text">Crea un plan para ver tus ejercicios aquí.</p>
        </div>
      </div>`;
    return;
  }

  // Derive muscle labels for filter chips from the actual exercise list
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
               value="${_query}">
      </div>

      <div class="ex-filters" id="ex-filters">${chipHtml}</div>

      <div class="ex-filter-select-wrap">
        <select class="ex-filter-select" id="ex-filter-select" aria-label="Filtrar por grupo muscular">
          ${selectHtml}
        </select>
      </div>

      <div id="ex-list-wrap"></div>
    </div>`;

  // Shared setter — keeps both UIs in sync
  function setFilter(value) {
    _filter = value;
    // Sync chips
    document.querySelectorAll('.ex-filter-chip').forEach(c =>
      c.classList.toggle('active', c.dataset.filter === value)
    );
    // Sync select
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

  applyFilters();
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
      // Always re-read from localStorage as ground truth for the visual state
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
      togglePanel(hist, willOpen);
      if (chev) chev.classList.toggle('open', willOpen);
    });
  });
}

// ── Build a single exercise card ──────────────────────────────────────────────
function buildExItem(ex, i) {
  const data     = _weights[ex.id] ?? null;
  const workingW = data?.workingWeight ?? null;
  const maxW     = data?.maxWeight     ?? null;
  const history  = data?.history       ?? [];
  const isFav    = _favorites.has(ex.id);
  const hasExtra = history.length > 0;
  const chartHtml = history.length >= 2 ? buildWeightChart(history) : '';

  const histRows = history.length > 0
    ? history.slice().reverse().map(h => `
        <div class="ex-hist-row">
          <span class="ex-hist-date">${fmtDate(h.date)}</span>
          <span class="ex-hist-weight">${h.weight} kg</span>
        </div>`).join('')
    : '<p class="ex-hist-empty">Sin registros de peso todavía.</p>';

  return `
    <div class="ex-item stagger-item" style="animation-delay:${i * 30}ms">
      <div class="ex-item-header" data-ex-toggle="${ex.id}">
        ${ex.images[0]
          ? `<img src="${ex.images[0]}" alt="${ex.name}" class="ex-item-thumb" loading="lazy">`
          : '<div class="ex-item-thumb ex-item-thumb-placeholder"></div>'}
        <div class="ex-item-info">
          <h3 class="ex-item-name">${ex.name}</h3>
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
        <span class="ex-expand-chevron${hasExtra ? '' : ' ex-chevron-hidden'}"
              data-ex-chevron="${ex.id}">▾</span>
      </div>
      ${chartHtml ? `<div class="ex-chart-wrap">${chartHtml}</div>` : ''}
      <div class="ex-history" id="ex-hist-${ex.id}">
        <div class="ex-history-inner">${histRows}</div>
      </div>
    </div>`;
}

// ── Smooth height toggle ───────────────────────────────────────────────────────
function togglePanel(el, open) {
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

  const pts = history.map((h, i) => {
    const x = PX + (i / (history.length - 1)) * iW;
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

// ── Date helper ────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}
