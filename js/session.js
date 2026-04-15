// ── Sesión activa ──────────────────────────────────────────────────────────────
import { goToPage }                         from './router.js';
import { saveSession }                      from './history.js';
import { getExerciseData, setWorkingWeight } from './weights.js';
import { checkAchievements, refreshSideNavStreak } from './achievements.js';

// ── Session state ──────────────────────────────────────────────────────────────
let _plan           = null;
let _exercises      = [];   // flat list for the chosen day (may be reordered by defer)
let _goal           = 'muscle';
let _dayIdx         = -1;   // index of the selected day in _plan.plan
let _exIdx          = 0;    // current exercise index
let _setsTotal      = 0;    // total sets for current exercise
let _completed      = 0;    // exercises fully completed this session
let _deferred       = 0;    // total "dejar para después" taps
let _exercisesLog   = [];   // log entry per completed exercise
let _startTime      = 0;
let _timer          = null;
let _timerSecs      = 0;
let _totalRestSecs  = 0;    // total seconds for current rest period (for ring progress)

// ── Web Audio beep ─────────────────────────────────────────────────────────────
function beep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type              = 'sine';
    osc.frequency.value   = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* AudioContext not available */ }
}

function stopTimer() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

// ── Public entry ───────────────────────────────────────────────────────────────
export function renderSessionPage(planData) {
  _plan = planData;
  _goal = planData.goal;
  stopTimer();
  renderDayPicker();
}

// ── Day picker ─────────────────────────────────────────────────────────────────
function renderDayPicker() {
  const app      = document.getElementById('app');
  const daysHtml = _plan.plan.map((day, i) => {
    const count = day.sections.reduce((sum, s) => sum + s.exercises.length, 0);
    return `
      <button class="session-day-btn" data-idx="${i}" type="button">
        <span class="session-day-letter">${day.letter}</span>
        <div class="session-day-info">
          <span class="session-day-name">${day.label}</span>
          <span class="session-day-count">${count} ejercicio${count !== 1 ? 's' : ''}</span>
        </div>
        <span class="session-day-arrow">→</span>
      </button>`;
  }).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <button class="btn-back" id="btn-back-plans" type="button">← Mis planes</button>
        <div>
          <h2 class="view-title">Elegir día</h2>
          <p class="view-subtitle">${_plan.name}</p>
        </div>
      </div>
      <div class="session-days">${daysHtml}</div>
    </div>`;

  document.getElementById('btn-back-plans').addEventListener('click', () => goToPage('my-plans'));
  document.querySelectorAll('.session-day-btn').forEach(btn => {
    btn.addEventListener('click', () => startSession(Number(btn.dataset.idx)));
  });
}

// ── Session start ──────────────────────────────────────────────────────────────
function startSession(dayIdx) {
  const day  = _plan.plan[dayIdx];
  _exercises = day.sections.flatMap(s =>
    s.exercises.map(ex => ({ ...ex, _section: s.muscleLabel }))
  );
  _dayIdx        = dayIdx;
  _exIdx         = 0;
  _completed     = 0;
  _deferred      = 0;
  _exercisesLog  = [];
  _startTime     = Date.now();
  stopTimer();
  renderExercise();
}

// ── Exercise screen ────────────────────────────────────────────────────────────
function renderExercise() {
  if (_exIdx >= _exercises.length) { renderCompletion(); return; }
  stopTimer();

  const ex      = _exercises[_exIdx];
  const scheme  = ex.sets[_goal] ?? ex.sets.muscle;
  _setsTotal    = parseInt(scheme.series, 10) || 3;
  const total   = _exercises.length;
  const pct     = Math.round((_exIdx / total) * 100);
  const restSec = parseRest(scheme.rest);

  // Initialise per-exercise log on first visit
  if (!ex._setsLog) {
    ex._setsLog = Array.from({ length: _setsTotal }, () => ({
      reps: scheme.reps, completed: false,
    }));
  }
  // Initialise session weight on first visit (persists across defer)
  if (ex._sessionWeight === undefined) {
    const stored       = getExerciseData(ex.id ?? ex.name);
    ex._sessionWeight  = stored?.workingWeight ?? null;
    ex._weightModified = false;
  }

  const imgsHtml = Array.isArray(ex.images) && ex.images.length > 0
    ? `<div class="session-images">
         <img src="${ex.images[0]}" alt="${ex.name} — inicio" class="session-img" loading="lazy">
         ${ex.images[1] ? `<img src="${ex.images[1]}" alt="${ex.name} — final" class="session-img" loading="lazy">` : ''}
       </div>`
    : '';

  const wLabel = ex._sessionWeight !== null ? `${ex._sessionWeight} kg` : '—';

  const rowsHtml = ex._setsLog.map((row, i) => `
    <div class="session-set-row${row.completed ? ' done' : ''}" data-set-row="${i}">
      <span class="set-num">${i + 1}</span>
      <input type="text" inputmode="numeric" class="set-input set-reps"
             data-set-r="${i}" value="${row.reps}">
      <button class="set-check-btn${row.completed ? ' done' : ''}"
              data-set-idx="${i}" type="button" aria-label="Marcar serie ${i + 1}">✓</button>
    </div>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="session-screen">
      <div class="session-topbar">
        <button class="session-exit-btn" id="btn-exit" type="button" aria-label="Salir">✕</button>
        <div class="session-prog-wrap">
          <span class="session-prog-label">Ejercicio ${_exIdx + 1} de ${total}</span>
          <div class="session-prog-track"><div class="session-prog-fill" style="width:${pct}%"></div></div>
        </div>
      </div>

      ${imgsHtml}

      <div class="session-body">
        <p class="session-muscle">${ex._section}</p>
        <h2 class="session-exname">${ex.name}</h2>
        <div class="exercise-scheme session-scheme">
          <span class="scheme-item">${scheme.series} series</span>
          <span class="scheme-sep">×</span>
          <span class="scheme-item">${scheme.reps}</span>
          <span class="scheme-sep">·</span>
          <span class="scheme-item scheme-rest">${scheme.rest} descanso</span>
        </div>

        <div class="session-weight-bar">
          <div class="session-weight-info">
            <span class="session-weight-label">Peso de trabajo</span>
            <strong class="session-weight-val" id="weight-val">${wLabel}</strong>
          </div>
          <button class="btn btn-sm btn-ghost" id="btn-edit-weight" type="button">✏ Editar</button>
        </div>
        <div class="session-weight-editor" id="weight-editor">
          <input type="number" inputmode="decimal" class="session-weight-input" id="weight-input"
                 value="${ex._sessionWeight ?? ''}" placeholder="0" min="0" step="0.5"
                 aria-label="Nuevo peso de trabajo">
          <span class="session-weight-unit">kg</span>
          <button class="btn btn-sm btn-primary" id="btn-ok-weight" type="button">Aceptar</button>
        </div>

        <div class="session-sets-table">
          <div class="session-sets-header">
            <span>Serie</span>
            <span>Reps</span>
            <span></span>
          </div>
          ${rowsHtml}
        </div>
      </div>

      <div class="session-footer">
        <button class="btn btn-primary btn-full" id="btn-done" type="button">
          Siguiente ejercicio →
        </button>
        <button class="btn btn-ghost" id="btn-defer" type="button">
          Dejar para después
        </button>
      </div>
    </div>`;

  document.getElementById('btn-exit').addEventListener('click', confirmExit);

  // Weight editor toggle
  const weightEditor = document.getElementById('weight-editor');
  document.getElementById('btn-edit-weight').addEventListener('click', () => {
    const visible = weightEditor.style.display === 'flex';
    weightEditor.style.display = visible ? 'none' : 'flex';
    if (!visible) document.getElementById('weight-input').focus();
  });

  document.getElementById('btn-ok-weight').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('weight-input').value);
    if (!isNaN(val) && val >= 0) {
      ex._sessionWeight  = val;
      ex._weightModified = true;
      document.getElementById('weight-val').textContent = val + ' kg';
    }
    weightEditor.style.display = 'none';
  });

  // ✓ row buttons — optional, snapshot reps on toggle
  document.querySelectorAll('.set-check-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i   = Number(btn.dataset.setIdx);
      const row = ex._setsLog[i];
      const rEl = document.querySelector(`[data-set-r="${i}"]`);
      row.reps      = rEl ? rEl.value : row.reps;
      row.completed = !row.completed;
      const rowEl = document.querySelector(`[data-set-row="${i}"]`);
      if (rowEl) rowEl.classList.toggle('done', row.completed);
      btn.classList.toggle('done', row.completed);
    });
  });

  document.getElementById('btn-done').addEventListener('click', () => {
    // Snapshot final reps values
    ex._setsLog.forEach((row, i) => {
      const rEl = document.querySelector(`[data-set-r="${i}"]`);
      if (rEl) row.reps = rEl.value;
    });
    _exercisesLog.push({
      exerciseId:   ex.id ?? ex.name,
      exerciseName: ex.name,
      weight:       ex._sessionWeight,
      sets: ex._setsLog.map((row, i) => ({
        series:    i + 1,
        reps:      row.reps,
        completed: row.completed,
      })),
    });
    _completed++;
    _exIdx++;

    // Ask to persist weight only if user changed it during this exercise
    if (ex._weightModified && ex._sessionWeight !== null) {
      if (confirm(`¿Guardar ${ex._sessionWeight} kg como nuevo peso de trabajo para "${ex.name}"?`)) {
        setWorkingWeight(ex.id ?? ex.name, ex._sessionWeight, new Date().toISOString());
      }
    }

    renderRest(restSec, renderExercise);
  });

  document.getElementById('btn-defer').addEventListener('click', () => {
    ex._setsLog.forEach((row, i) => {
      const rEl = document.querySelector(`[data-set-r="${i}"]`);
      if (rEl) row.reps = rEl.value;
    });
    _exercises.push(_exercises.splice(_exIdx, 1)[0]);
    _deferred++;
    stopTimer();
    renderExercise();
  });
}

// ── Rest screen ────────────────────────────────────────────────────────────────
const RING_R   = 54;
const RING_C   = +(2 * Math.PI * RING_R).toFixed(2); // ≈ 339.29

function ringOffset(secsLeft, total) {
  if (total <= 0) return 0;
  return +((1 - secsLeft / total) * RING_C).toFixed(2);
}

function clockStr(secs) {
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
}

function renderRest(seconds, onDone) {
  stopTimer();
  _timerSecs     = seconds;
  _totalRestSecs = seconds;

  document.getElementById('app').innerHTML = `
    <div class="session-screen session-rest-screen">
      <div class="session-topbar">
        <button class="session-exit-btn" id="btn-exit-rest" type="button" aria-label="Salir">✕</button>
        <span class="session-prog-label">Descansando</span>
      </div>
      <div class="session-rest-body">
        <p class="session-rest-heading">Descanso</p>
        <div class="rest-ring-wrap">
          <svg class="rest-ring-svg" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="rest-ring-bg" cx="60" cy="60" r="${RING_R}"/>
            <circle class="rest-ring-fg" id="rest-ring-fg" cx="60" cy="60" r="${RING_R}"
                    stroke-dasharray="${RING_C}"
                    stroke-dashoffset="${ringOffset(_timerSecs, _totalRestSecs)}"
                    transform="rotate(-90 60 60)"/>
          </svg>
          <span class="rest-ring-time" id="rest-clock">${clockStr(_timerSecs)}</span>
        </div>
        <button class="btn btn-secondary" id="btn-skip" type="button">Saltar descanso →</button>
      </div>
    </div>`;

  document.getElementById('btn-exit-rest').addEventListener('click', confirmExit);
  document.getElementById('btn-skip').addEventListener('click', () => { stopTimer(); onDone(); });

  _timer = setInterval(() => {
    _timerSecs--;
    if (_timerSecs <= 0) {
      stopTimer();
      beep();
      onDone();
    } else {
      const clock = document.getElementById('rest-clock');
      if (clock) clock.textContent = clockStr(_timerSecs);
      const ring = document.getElementById('rest-ring-fg');
      if (ring) ring.style.strokeDashoffset = ringOffset(_timerSecs, _totalRestSecs);
    }
  }, 1000);
}

// ── Completion screen ──────────────────────────────────────────────────────────
function renderCompletion() {
  stopTimer();
  const secs  = Math.floor((Date.now() - _startTime) / 1000);

  saveSession({
    date:          new Date().toISOString(),
    planId:        _plan.id,
    planName:      _plan.name,
    dayLabel:      _plan.plan[_dayIdx].label,
    muscles:       _plan.plan[_dayIdx].sections.map(s => s.muscleLabel),
    durationSec:   secs,
    completed:     _completed,
    deferred:      _deferred,
    exercisesLog:  _exercisesLog,
  });
  checkAchievements();
  refreshSideNavStreak();
  const min   = Math.floor(secs / 60);
  const sec   = secs % 60;
  const tStr  = min > 0 ? `${min} min${sec ? ' ' + sec + ' seg' : ''}` : `${sec} seg`;

  document.getElementById('app').innerHTML = `
    <div class="session-completion">
      <div class="completion-check">✓</div>
      <h2 class="completion-title">¡Sesión completada!</h2>
      <p class="completion-sub">Buen trabajo. Sigue así.</p>
      <div class="completion-stats">
        <div class="completion-stat">
          <span class="completion-stat-num">${_completed}</span>
          <span class="completion-stat-lbl">Ejercicios</span>
        </div>
        <div class="completion-stat">
          <span class="completion-stat-num">${tStr}</span>
          <span class="completion-stat-lbl">Tiempo</span>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-finish" type="button">Volver a Mis planes</button>
    </div>`;

  document.getElementById('btn-finish').addEventListener('click', () => goToPage('my-plans'));
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function confirmExit() {
  if (confirm('¿Salir de la sesión? El progreso no se guardará.')) {
    stopTimer();
    goToPage('my-plans');
  }
}

function parseRest(str) {
  if (!str) return 90;
  const s = str.toLowerCase();
  const n = parseInt(s.match(/\d+/)?.[0] ?? '90', 10);
  if (s.includes('min')) return n * 60;
  if (s.includes('seg')) return n;
  return 90;
}
