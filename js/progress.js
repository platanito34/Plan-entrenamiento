// ── Mi progreso page ───────────────────────────────────────────────────────────
// Body measurements tracking with SVG line charts and goal-aware indicators.

import { buildAchievementsSection } from './achievements.js';
import { progressAPI }              from './api.js';

const PROGRESS_KEY = 'gym-body-progress';
const PLANS_KEY    = 'gym-plans';

// ── API normalization ──────────────────────────────────────────────────────────
function progressRecordToAPI(r) {
  return {
    date:        r.date,
    weight:      r.weight      ?? null,
    height:      r.height      ?? null,
    chest:       r.chest       ?? null,
    waist:       r.waist       ?? null,
    hips:        r.hips        ?? null,
    bicep_right: r.bicepR      ?? null,
    bicep_left:  r.bicepL      ?? null,
    thigh_right: r.thighR      ?? null,
    thigh_left:  r.thighL      ?? null,
  };
}

function normalizeProgressFromAPI(r) {
  const rec = {
    apiId:  r.id,
    date:   r.date,
  };
  if (r.weight      != null) rec.weight = parseFloat(r.weight);
  if (r.height      != null) rec.height = parseFloat(r.height);
  if (r.chest       != null) rec.chest  = parseFloat(r.chest);
  if (r.waist       != null) rec.waist  = parseFloat(r.waist);
  if (r.hips        != null) rec.hips   = parseFloat(r.hips);
  if (r.bicep_right != null) rec.bicepR = parseFloat(r.bicep_right);
  if (r.bicep_left  != null) rec.bicepL = parseFloat(r.bicep_left);
  if (r.thigh_right != null) rec.thighR = parseFloat(r.thigh_right);
  if (r.thigh_left  != null) rec.thighL = parseFloat(r.thigh_left);
  return rec;
}

async function syncProgressFromAPI() {
  try {
    const rows    = await progressAPI.getAll();
    const records = rows.map(normalizeProgressFromAPI);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(records));
    return records;
  } catch (err) {
    console.warn('[progress] API sync failed:', err);
    return null;
  }
}

// ── Storage ────────────────────────────────────────────────────────────────────
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProgress(records) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(records));
}

// ── Metric definitions ─────────────────────────────────────────────────────────
const METRIC_LIST = [
  { key: 'weight', label: 'Peso',             unit: 'kg', group: 'main' },
  { key: 'height', label: 'Altura',           unit: 'cm', group: 'main' },
  { key: 'chest',  label: 'Pecho',            unit: 'cm', group: 'medidas' },
  { key: 'waist',  label: 'Cintura',          unit: 'cm', group: 'medidas' },
  { key: 'hips',   label: 'Cadera',           unit: 'cm', group: 'medidas' },
  { key: 'bicepR', label: 'Bíceps derecho',   unit: 'cm', group: 'medidas' },
  { key: 'bicepL', label: 'Bíceps izquierdo', unit: 'cm', group: 'medidas' },
  { key: 'thighR', label: 'Muslo derecho',    unit: 'cm', group: 'medidas' },
  { key: 'thighL', label: 'Muslo izquierdo',  unit: 'cm', group: 'medidas' },
];

function metaFor(key) {
  return METRIC_LIST.find(m => m.key === key) ?? { key, label: key, unit: '' };
}

// ── Module state ───────────────────────────────────────────────────────────────
let _records = [];
let _metric  = 'weight';
let _period  = 'all';
let _goal    = null;   // 'fat' | 'muscle' | 'strength' | null

// ── Goal detection ─────────────────────────────────────────────────────────────
function detectGoal() {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    const plans = raw ? JSON.parse(raw) : [];
    if (plans.length === 0) return null;
    const latest = plans[plans.length - 1];
    return latest.goal ?? null;
  } catch { return null; }
}

// ── Period filter ──────────────────────────────────────────────────────────────
function filterByPeriod(records, period) {
  if (period === 'all') return records;
  const now  = new Date();
  const months = period === '1m' ? 1 : period === '3m' ? 3 : 6;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  return records.filter(r => new Date(r.date) >= cutoff);
}

// ── Points for current metric + period ────────────────────────────────────────
function getPoints() {
  const subset = filterByPeriod(_records, _period);
  return subset
    .filter(r => r[_metric] !== undefined && r[_metric] !== null && r[_metric] !== '')
    .map(r => ({ date: r.date, value: parseFloat(r[_metric]) }))
    .filter(p => !isNaN(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
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

// ── Summary cards ──────────────────────────────────────────────────────────────
function buildSummary() {
  const weightPoints  = _records.filter(r => r.weight != null).sort((a, b) => a.date.localeCompare(b.date));
  const heightPoints  = _records.filter(r => r.height != null).sort((a, b) => a.date.localeCompare(b.date));

  function card(label, pts, unit, lowerIsGood) {
    if (pts.length === 0) {
      return `
        <div class="pg-card">
          <p class="pg-card-label">${label}</p>
          <p class="pg-card-value">—</p>
        </div>`;
    }
    const latest = pts[pts.length - 1].value ?? parseFloat(pts[pts.length - 1][pts[pts.length - 1].weight !== undefined ? 'weight' : 'bodyFat']);
    const latestVal = typeof latest === 'number' ? latest : parseFloat(pts[pts.length - 1].weight ?? pts[pts.length - 1].bodyFat);

    let chgHtml = '';
    if (pts.length >= 2) {
      const prev = typeof pts[pts.length - 2].value === 'number'
        ? pts[pts.length - 2].value
        : parseFloat(pts[pts.length - 2].weight ?? pts[pts.length - 2].bodyFat);
      const diff = latestVal - prev;
      if (!isNaN(diff) && diff !== 0) {
        const arrow    = diff > 0 ? '▲' : '▼';
        const good     = lowerIsGood ? diff < 0 : diff > 0;
        const cls      = good ? 'pg-chg-good' : (diff === 0 ? 'pg-chg-neutral' : 'pg-chg-bad');
        chgHtml = `<span class="pg-chg ${cls}">${arrow} ${Math.abs(diff).toFixed(1)} ${unit}</span>`;
      }
    }

    const displayVal = typeof latestVal === 'number' ? latestVal.toFixed(1) : '—';
    return `
      <div class="pg-card">
        <p class="pg-card-label">${label}</p>
        <p class="pg-card-value">${displayVal} <span class="pg-card-unit">${unit}</span></p>
        ${chgHtml}
      </div>`;
  }

  const fatGoal      = _goal === 'fat';
  const weightGood   = _goal === 'fat';   // losing weight is good for fat loss goal
  const fatGood      = true;              // lower body fat is always good

  // Simplify: extract numeric values properly
  function latestNumeric(pts, key) {
    for (let i = pts.length - 1; i >= 0; i--) {
      const v = parseFloat(pts[i][key] ?? pts[i].value);
      if (!isNaN(v)) return v;
    }
    return null;
  }

  function cardSimple(label, pts, key, unit, lowerIsGood) {
    if (pts.length === 0) {
      return `<div class="pg-card"><p class="pg-card-label">${label}</p><p class="pg-card-value">—</p></div>`;
    }
    const latestV = latestNumeric(pts, key);
    if (latestV === null) return `<div class="pg-card"><p class="pg-card-label">${label}</p><p class="pg-card-value">—</p></div>`;

    let chgHtml = '';
    if (pts.length >= 2) {
      const prevV = latestNumeric(pts.slice(0, pts.length - 1), key);
      if (prevV !== null) {
        const diff = latestV - prevV;
        if (diff !== 0) {
          const arrow = diff > 0 ? '▲' : '▼';
          const good  = lowerIsGood ? diff < 0 : diff > 0;
          const cls   = good ? 'pg-chg-good' : 'pg-chg-bad';
          chgHtml = `<span class="pg-chg ${cls}">${arrow} ${Math.abs(diff).toFixed(1)} ${unit}</span>`;
        }
      }
    }
    return `
      <div class="pg-card">
        <p class="pg-card-label">${label}</p>
        <p class="pg-card-value">${latestV.toFixed(1)} <span class="pg-card-unit">${unit}</span></p>
        ${chgHtml}
      </div>`;
  }

  const wLower = _goal === 'fat';   // fat-loss goal: losing weight is good

  // Height card: no change arrow (height doesn't meaningfully change)
  function cardHeight(pts) {
    const latestV = latestNumeric(pts, 'height');
    if (latestV === null) return `<div class="pg-card"><p class="pg-card-label">Altura</p><p class="pg-card-value">—</p></div>`;
    return `
      <div class="pg-card">
        <p class="pg-card-label">Altura</p>
        <p class="pg-card-value">${latestV.toFixed(0)} <span class="pg-card-unit">cm</span></p>
      </div>`;
  }

  return `
    <div class="pg-summary">
      ${cardSimple('Peso', weightPoints, 'weight', 'kg', wLower)}
      ${cardHeight(heightPoints)}
    </div>`;
}

// ── SVG chart ──────────────────────────────────────────────────────────────────
function buildChart(points) {
  const selectFallback = `
    <select class="pg-chart-select" id="pg-metric-select" aria-label="Métrica visualizada">
      ${METRIC_LIST.map(m => `<option value="${m.key}"${m.key === _metric ? ' selected' : ''}>${m.label}</option>`).join('')}
    </select>`;

  if (points.length === 0) {
    return `<div class="pg-chart-wrap pg-chart-wrap-short">${selectFallback}<p class="pg-chart-empty-msg">Sin datos para este período.</p></div>`;
  }

  if (points.length === 1) {
    const { value, date } = points[0];
    const meta = metaFor(_metric);
    return `<div class="pg-chart-wrap pg-chart-wrap-short">${selectFallback}
      <div class="pg-chart-single">
        <span class="pg-chart-single-val">${value.toFixed(1)} ${meta.unit}</span>
        <span class="pg-chart-single-date">${fmtDate(date)}</span>
      </div>
    </div>`;
  }

  const W = 320, H = 120, PX = 32, PY = 12, PB = 28;
  const iW = W - PX * 2;
  const iH = H - PY - PB;

  const vals   = points.map(p => p.value);
  const minV   = Math.min(...vals);
  const maxV   = Math.max(...vals);
  const range  = maxV - minV || 1;
  const meta   = metaFor(_metric);
  const n      = points.length;

  const coords = points.map((p, i) => {
    const x = PX + (i / (n - 1)) * iW;
    const y = PY + (1 - (p.value - minV) / range) * iH;
    return { x, y, ...p };
  });

  const line   = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const lastC  = coords[n - 1];
  const areaClose = `${lastC.x.toFixed(1)},${(PY + iH).toFixed(1)} ${PX},${(PY + iH).toFixed(1)}`;
  const area   = `${line} ${areaClose}`;

  // min/max indices
  const maxIdx = vals.indexOf(maxV);
  const minIdx = vals.indexOf(minV);

  const dots = coords.map((c, i) => {
    const isMax = i === maxIdx;
    const isMin = i === minIdx;
    const cls   = isMax ? ' pg-pt-max' : isMin ? ' pg-pt-min' : '';
    const r     = (isMax || isMin) ? 5 : 3.5;
    return `<circle class="pg-pt${cls}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}"
              r="${r}" data-idx="${i}" data-val="${c.value.toFixed(1)}" data-date="${c.date}"/>`;
  }).join('');

  // y-axis labels (2)
  const yLabels = [
    `<text class="pg-ylabel" x="${PX - 4}" y="${(PY + 4).toFixed(1)}" text-anchor="end">${maxV.toFixed(1)}</text>`,
    `<text class="pg-ylabel" x="${PX - 4}" y="${(PY + iH).toFixed(1)}" text-anchor="end">${minV.toFixed(1)}</text>`,
  ].join('');

  // x-axis labels (first + last)
  const xLabels = [
    `<text class="pg-xlabel" x="${PX}" y="${H - 4}" text-anchor="middle">${fmtDate(points[0].date)}</text>`,
    `<text class="pg-xlabel" x="${(W - PX).toFixed(1)}" y="${H - 4}" text-anchor="middle">${fmtDate(points[n - 1].date)}</text>`,
  ].join('');

  // grid lines
  const midY = (PY + (PY + iH)) / 2;
  const grid = `
    <line class="pg-grid" x1="${PX}" y1="${PY}" x2="${W - PX}" y2="${PY}"/>
    <line class="pg-grid" x1="${PX}" y1="${midY.toFixed(1)}" x2="${W - PX}" y2="${midY.toFixed(1)}"/>
    <line class="pg-grid" x1="${PX}" y1="${PY + iH}" x2="${W - PX}" y2="${PY + iH}"/>`;

  // value label on last point
  const extLabel = `<text class="pg-ext-label" x="${(lastC.x + 6).toFixed(1)}" y="${(lastC.y + 4).toFixed(1)}">${lastC.value.toFixed(1)} ${meta.unit}</text>`;

  const selectHtml = METRIC_LIST.map(m =>
    `<option value="${m.key}"${m.key === _metric ? ' selected' : ''}>${m.label}</option>`
  ).join('');

  return `
    <div class="pg-chart-wrap">
      <select class="pg-chart-select" id="pg-metric-select" aria-label="Métrica visualizada">
        ${selectHtml}
      </select>
      <svg class="pg-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="pg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stop-color="#f97316" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}
        ${yLabels}
        ${xLabels}
        <polygon class="pg-area" points="${area}"/>
        <polyline class="pg-line" points="${line}"/>
        ${dots}
        ${extLabel}
      </svg>
      <div class="pg-chart-hint" id="pg-hint" hidden></div>
    </div>`;
}

// ── History list ───────────────────────────────────────────────────────────────
function buildHistory() {
  if (_records.length === 0) return '';

  const rows = _records
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r, i) => {
      const chips = METRIC_LIST
        .filter(m => r[m.key] !== undefined && r[m.key] !== null && r[m.key] !== '')
        .map(m => `<span class="pg-hist-chip">${m.label}: ${r[m.key]} ${m.unit}</span>`)
        .join('');

      // find true index in unsorted _records
      const trueIdx = _records.indexOf(r);

      return `
        <div class="pg-hist-entry">
          <div class="pg-hist-header">
            <span class="pg-hist-date">${fmtDate(r.date)}</span>
            <button class="pg-hist-del" data-del="${r.date}" type="button" aria-label="Eliminar registro">✕</button>
          </div>
          <div class="pg-hist-chips">${chips}</div>
        </div>`;
    }).join('');

  return `
    <div class="pg-hist-section">
      <h3 class="pg-hist-title">Historial de medidas</h3>
      ${rows}
    </div>`;
}

// ── Bottom sheet panel ─────────────────────────────────────────────────────────
function buildPanel() {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div class="pg-panel-overlay" id="pg-panel-overlay" aria-hidden="true"></div>
    <div class="pg-panel" id="pg-panel" role="dialog" aria-modal="true" aria-label="Añadir medidas" hidden>
      <div class="pg-panel-handle"></div>
      <div class="pg-panel-content">
        <div class="pg-panel-head">
          <h3 class="pg-panel-title">Añadir medidas</h3>
          <button class="pg-panel-close" id="pg-panel-close" type="button" aria-label="Cerrar">✕</button>
        </div>

        <div class="pg-form-row pg-form-row-single">
          <label class="pg-form-label" for="pg-date">Fecha</label>
          <input type="date" class="pg-form-input" id="pg-date" value="${today}" max="${today}">
        </div>

        <div class="pg-form-section-title">Peso y composición</div>
        <div class="pg-form-row pg-form-row-2">
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-weight">Peso (kg)</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-weight"
                   placeholder="70.0" min="0" step="0.1">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-height">Altura (cm)</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-height"
                   placeholder="175" min="0" max="300" step="1">
          </div>
        </div>

        <div class="pg-form-section-title">Medidas corporales (cm)</div>
        <div class="pg-form-row pg-form-row-2">
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-chest">Pecho</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-chest" placeholder="100" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-waist">Cintura</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-waist" placeholder="80" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-hips">Cadera</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-hips" placeholder="95" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-bicepR">Bíceps derecho</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-bicepR" placeholder="35" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-bicepL">Bíceps izquierdo</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-bicepL" placeholder="35" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-thighR">Muslo derecho</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-thighR" placeholder="55" min="0" step="0.5">
          </div>
          <div class="pg-form-field">
            <label class="pg-form-label" for="pg-thighL">Muslo izquierdo</label>
            <input type="number" inputmode="decimal" class="pg-form-input" id="pg-thighL" placeholder="55" min="0" step="0.5">
          </div>
        </div>

        <button class="btn btn-primary btn-full pg-save-btn" id="pg-save" type="button">Guardar medidas</button>
      </div>
    </div>`;
}

// ── Panel open / close ─────────────────────────────────────────────────────────
function openPanel() {
  const panel   = document.getElementById('pg-panel');
  const overlay = document.getElementById('pg-panel-overlay');
  if (!panel) return;
  panel.hidden = false;
  overlay.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    panel.classList.add('open');
    overlay.classList.add('visible');
  });
}

function closePanel() {
  const panel   = document.getElementById('pg-panel');
  const overlay = document.getElementById('pg-panel-overlay');
  if (!panel) return;
  panel.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
  panel.addEventListener('transitionend', () => {
    panel.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }, { once: true });
}

// ── Save handler ───────────────────────────────────────────────────────────────
function handleSave() {
  const date    = document.getElementById('pg-date')?.value;
  if (!date) return;

  const weight = document.getElementById('pg-weight')?.value;
  const height = document.getElementById('pg-height')?.value;
  const chest  = document.getElementById('pg-chest')?.value;
  const waist  = document.getElementById('pg-waist')?.value;
  const hips   = document.getElementById('pg-hips')?.value;
  const bicepR = document.getElementById('pg-bicepR')?.value;
  const bicepL = document.getElementById('pg-bicepL')?.value;
  const thighR = document.getElementById('pg-thighR')?.value;
  const thighL = document.getElementById('pg-thighL')?.value;

  // Require at least one value
  const any = [weight, height, chest, waist, hips, bicepR, bicepL, thighR, thighL].some(v => v !== '' && v !== null && v !== undefined);
  if (!any) {
    document.getElementById('pg-save')?.classList.add('shake');
    setTimeout(() => document.getElementById('pg-save')?.classList.remove('shake'), 500);
    return;
  }

  const record = { date };
  if (weight !== '') record.weight = parseFloat(weight);
  if (height !== '') record.height = parseFloat(height);
  if (chest  !== '') record.chest  = parseFloat(chest);
  if (waist  !== '') record.waist  = parseFloat(waist);
  if (hips   !== '') record.hips   = parseFloat(hips);
  if (bicepR !== '') record.bicepR = parseFloat(bicepR);
  if (bicepL !== '') record.bicepL = parseFloat(bicepL);
  if (thighR !== '') record.thighR = parseFloat(thighR);
  if (thighL !== '') record.thighL = parseFloat(thighL);

  // Replace record for same date or append
  const idx = _records.findIndex(r => r.date === date);
  if (idx >= 0) {
    _records[idx] = { ..._records[idx], ...record };
  } else {
    _records.push(record);
  }
  _records.sort((a, b) => a.date.localeCompare(b.date));
  saveProgress(_records);

  // Sync to API (fire-and-forget)
  progressAPI.create(progressRecordToAPI(record))
    .then(result => {
      // Store the API-assigned id in the local record for future deletes
      const i = _records.findIndex(r => r.date === date);
      if (i !== -1 && result.id) {
        _records[i].apiId = result.id;
        saveProgress(_records);
      }
    })
    .catch(err => console.warn('[progress] POST failed:', err));

  closePanel();

  // Partial re-render (summary + chart + history)
  updateView();
}

// ── Partial view update (after data change) ────────────────────────────────────
function updateView() {
  const summaryEl = document.getElementById('pg-summary-wrap');
  const chartEl   = document.getElementById('pg-chart-wrap');
  const histEl    = document.getElementById('pg-hist-wrap');
  if (summaryEl) summaryEl.innerHTML = buildSummary();
  if (chartEl) {
    chartEl.innerHTML = buildChart(getPoints());
    attachChartListeners();
    attachChartSelectListener();
  }
  if (histEl) {
    histEl.innerHTML = buildHistory();
    attachHistoryListeners();
  }
  const achEl = document.getElementById('pg-ach-wrap');
  if (achEl) achEl.innerHTML = buildAchievementsSection();
}

// ── Metric select (inside chart card) listener ─────────────────────────────────
function attachChartSelectListener() {
  const sel = document.getElementById('pg-metric-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    _metric = sel.value;
    const chartEl = document.getElementById('pg-chart-wrap');
    if (!chartEl) return;
    chartEl.innerHTML = buildChart(getPoints());
    attachChartListeners();
    attachChartSelectListener();
  });
}

// ── Chart dot hover / click listeners ─────────────────────────────────────────
function attachChartListeners() {
  const hint = document.getElementById('pg-hint');
  if (!hint) return;
  const meta = metaFor(_metric);

  document.querySelectorAll('.pg-pt').forEach(dot => {
    function showHint() {
      const val  = dot.dataset.val;
      const date = dot.dataset.date;
      hint.textContent = `${fmtDate(date)} · ${val} ${meta.unit}`;
      hint.hidden = false;
    }
    function hideHint() { hint.hidden = true; }
    dot.addEventListener('mouseenter', showHint);
    dot.addEventListener('focus',      showHint);
    dot.addEventListener('mouseleave', hideHint);
    dot.addEventListener('blur',       hideHint);
    dot.addEventListener('click',      () => hint.hidden ? showHint() : hideHint());
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', `${fmtDate(dot.dataset.date)}: ${dot.dataset.val} ${meta.unit}`);
  });
}

// ── History delete listeners ───────────────────────────────────────────────────
function attachHistoryListeners() {
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const date   = btn.dataset.del;
      const target = _records.find(r => r.date === date);
      if (!target) return;
      _records = _records.filter(r => r.date !== date);
      saveProgress(_records);
      updateView();

      if (target.apiId) {
        progressAPI.remove(target.apiId)
          .catch(err => console.warn('[progress] DELETE failed:', err));
      }
    });
  });
}

// ── Main renderer ──────────────────────────────────────────────────────────────
export async function renderProgressPage() {
  const fresh = await syncProgressFromAPI();
  _records = fresh ?? loadProgress();
  _goal    = detectGoal();

  const app = document.getElementById('app');

  const periodBtns = [
    { key: '1m', label: '1 mes' },
    { key: '3m', label: '3 meses' },
    { key: '6m', label: '6 meses' },
    { key: 'all', label: 'Todo' },
  ].map(p =>
    `<button class="pg-period-btn${_period === p.key ? ' active' : ''}" data-period="${p.key}" type="button">${p.label}</button>`
  ).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <h2 class="view-title">Mi progreso</h2>
        <p class="view-subtitle">Medidas corporales y evolución</p>
      </div>

      <div id="pg-summary-wrap">${buildSummary()}</div>

      <div class="pg-period-row">${periodBtns}</div>

      <div id="pg-chart-wrap">${buildChart(getPoints())}</div>

      <div id="pg-hist-wrap">${buildHistory()}</div>

      <div id="pg-ach-wrap">${buildAchievementsSection()}</div>
    </div>

    ${buildPanel()}

    <button class="pg-fab" id="pg-fab" type="button" aria-label="Añadir medidas">+</button>`;

  // Period button listeners
  document.querySelectorAll('.pg-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _period = btn.dataset.period;
      document.querySelectorAll('.pg-period-btn').forEach(b => b.classList.toggle('active', b === btn));
      const chartWrap = document.getElementById('pg-chart-wrap');
      if (chartWrap) {
        chartWrap.innerHTML = buildChart(getPoints());
        attachChartListeners();
        attachChartSelectListener();
      }
    });
  });

  // FAB
  document.getElementById('pg-fab')?.addEventListener('click', openPanel);

  // Panel close
  document.getElementById('pg-panel-close')?.addEventListener('click', closePanel);
  document.getElementById('pg-panel-overlay')?.addEventListener('click', closePanel);

  // Save
  document.getElementById('pg-save')?.addEventListener('click', handleSave);

  // ESC key
  document.addEventListener('keydown', handlePanelEsc);

  // Chart dots + select
  attachChartListeners();
  attachChartSelectListener();

  // History deletes
  attachHistoryListeners();
}

function handlePanelEsc(e) {
  if (e.key === 'Escape') {
    const panel = document.getElementById('pg-panel');
    if (panel && !panel.hidden) closePanel();
  }
}
