// ── Historial page ─────────────────────────────────────────────────────────────

const HISTORY_KEY = 'gym-history';

// ── Storage ────────────────────────────────────────────────────────────────────
export function saveSession(record) {
  const history = loadHistory();
  history.unshift(record);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(secs) {
  if (!secs || secs <= 0) return '0 min';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}

// ── Stats ──────────────────────────────────────────────────────────────────────
function calcStats(history) {
  const today = new Date();

  // ── Week days ──────────────────────────────────────────────────────────────
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekKeySet = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekKeySet.add(dateKey(d));
  }
  const weekDays = new Set(
    history.filter(s => weekKeySet.has(s.date.slice(0, 10))).map(s => s.date.slice(0, 10))
  ).size;

  // ── Month stats ────────────────────────────────────────────────────────────
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthSessions = history.filter(s => s.date.startsWith(ym));
  const monthDays     = new Set(monthSessions.map(s => s.date.slice(0, 10))).size;
  const monthTotalSec = monthSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const monthTimeStr  = formatDuration(monthTotalSec);

  // ── Streak ─────────────────────────────────────────────────────────────────
  const trainedKeys = new Set(history.map(s => s.date.slice(0, 10)));
  let streak = 0;
  const d = new Date(today);
  while (trainedKeys.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return { weekDays, monthDays, monthTimeStr, streak };
}

// ── Views ──────────────────────────────────────────────────────────────────────
const DAY_ABBR   = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                     'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function buildWeekView(history) {
  const today  = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const cells = DAY_ABBR.map((abbr, i) => {
    const d         = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key       = dateKey(d);
    const isTrained = history.some(s => s.date.startsWith(key));
    const isToday   = key === dateKey(today);
    return `
      <button class="week-cell" data-day-key="${key}" type="button"
              aria-label="${abbr} ${d.getDate()}${isTrained ? ' — entrenado' : ''}">
        <span class="week-abbr">${abbr}</span>
        <span class="week-circle${isTrained ? ' trained' : ''}${isToday ? ' today' : ''}">
          ${d.getDate()}
        </span>
      </button>`;
  }).join('');

  return `<div class="week-grid">${cells}</div>`;
}

function buildMonthView(history, year, month) {
  const today      = new Date();
  const firstDay   = new Date(year, month, 1);
  const lastDay    = new Date(year, month + 1, 0);
  const startOff   = (firstDay.getDay() + 6) % 7; // Mon = 0

  const cells = [];
  for (let i = 0; i < startOff; i++) {
    cells.push(`<div class="month-cell empty"></div>`);
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date      = new Date(year, month, d);
    const key       = dateKey(date);
    const isTrained = history.some(s => s.date.startsWith(key));
    const isToday   = key === dateKey(today);
    cells.push(`
      <button class="month-cell${isTrained ? ' trained' : ''}${isToday ? ' today' : ''}"
              data-day-key="${key}" type="button" aria-label="${d} ${MONTH_NAMES[month]}">
        ${d}
      </button>`);
  }

  const headersHtml = DAY_ABBR.map(a => `<div class="month-head">${a}</div>`).join('');

  return `
    <div class="month-nav-row">
      <button class="carousel-arrow" id="hist-prev-month" type="button" aria-label="Mes anterior">←</button>
      <span class="month-title">${MONTH_NAMES[month]} ${year}</span>
      <button class="carousel-arrow" id="hist-next-month" type="button" aria-label="Mes siguiente">→</button>
    </div>
    <div class="month-grid">
      ${headersHtml}
      ${cells.join('')}
    </div>`;
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function buildDetail(history, key) {
  const sessions = history.filter(s => s.date.startsWith(key));
  if (!sessions.length) return '';

  const cardsHtml = sessions.map((s, i) => {
    const timeStr     = new Date(s.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const durationStr = formatDuration(s.durationSec);
    const musclesHtml = (s.muscles || []).map(m =>
      `<span class="muscle-badge">${m}</span>`
    ).join('');
    const deferredHtml = s.deferred > 0
      ? `<span class="hist-deferred">${s.deferred} pospuesto${s.deferred !== 1 ? 's' : ''}</span>`
      : '';

    return `
      <div class="hist-detail-card stagger-item" style="animation-delay:${i * 60}ms">
        <div class="hist-detail-header">
          <div class="hist-detail-meta">
            <p class="hist-detail-name">${s.planName} · ${s.dayLabel}</p>
            <p class="hist-detail-time">${timeStr} · ${durationStr}</p>
          </div>
          <div class="hist-detail-nums">
            <span>${s.completed} ej.</span>
            ${deferredHtml}
          </div>
        </div>
        ${musclesHtml ? `<div class="hist-muscles">${musclesHtml}</div>` : ''}
      </div>`;
  }).join('');

  return `<div class="hist-detail">${cardsHtml}</div>`;
}

// ── Page renderer ──────────────────────────────────────────────────────────────
export function renderHistoryPage() {
  const history = loadHistory();
  const app     = document.getElementById('app');
  const stats   = calcStats(history);

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <h2 class="view-title">Historial</h2>
        <p class="view-subtitle">Tu actividad de entrenamiento</p>
      </div>

      <div class="hist-streak-card${stats.streak === 0 ? ' hist-streak-zero' : ''}">
        <span class="hist-streak-fire">${stats.streak > 0 ? '🔥' : '💤'}</span>
        <div class="hist-streak-body">
          <span class="hist-streak-num">${stats.streak}</span>
          <span class="hist-streak-unit">día${stats.streak !== 1 ? 's' : ''}</span>
        </div>
        <span class="hist-streak-label">racha actual</span>
      </div>

      <div class="hist-stats">
        <div class="hist-stat">
          <span class="hist-stat-num">${stats.weekDays}</span>
          <span class="hist-stat-lbl">Esta semana</span>
        </div>
        <div class="hist-stat">
          <span class="hist-stat-num">${stats.monthDays}</span>
          <span class="hist-stat-lbl">Este mes</span>
        </div>
        <div class="hist-stat">
          <span class="hist-stat-num">${stats.monthTimeStr}</span>
          <span class="hist-stat-lbl">Tiempo mes</span>
        </div>
      </div>

      <div class="hist-toggle">
        <button class="hist-toggle-btn active" data-view="week" type="button">Semana</button>
        <button class="hist-toggle-btn" data-view="month" type="button">Mes</button>
      </div>

      <div id="hist-view"></div>
      <div id="hist-detail-wrap"></div>
    </div>`;

  // ── Internal state ─────────────────────────────────────────────────────────
  let _view  = 'week';
  let _year  = new Date().getFullYear();
  let _month = new Date().getMonth();

  // ── Day click handler ──────────────────────────────────────────────────────
  function attachDayListeners() {
    document.querySelectorAll('[data-day-key]').forEach(el => {
      el.addEventListener('click', () => {
        const key    = el.dataset.dayKey;
        const wrap   = document.getElementById('hist-detail-wrap');
        const html   = buildDetail(history, key);
        wrap.innerHTML = html;
        if (html) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  // ── Render current view ────────────────────────────────────────────────────
  function showView() {
    const container = document.getElementById('hist-view');
    document.getElementById('hist-detail-wrap').innerHTML = '';

    if (_view === 'week') {
      container.innerHTML = buildWeekView(history);
    } else {
      container.innerHTML = buildMonthView(history, _year, _month);

      document.getElementById('hist-prev-month').addEventListener('click', () => {
        _month--;
        if (_month < 0) { _month = 11; _year--; }
        showView();
      });
      document.getElementById('hist-next-month').addEventListener('click', () => {
        _month++;
        if (_month > 11) { _month = 0; _year++; }
        showView();
      });
    }

    attachDayListeners();
  }

  // ── Toggle listeners ───────────────────────────────────────────────────────
  app.querySelectorAll('.hist-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _view = btn.dataset.view;
      app.querySelectorAll('.hist-toggle-btn').forEach(b =>
        b.classList.toggle('active', b === btn));
      showView();
    });
  });

  showView();
}
