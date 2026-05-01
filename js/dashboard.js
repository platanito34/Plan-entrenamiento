// ── Dashboard page ─────────────────────────────────────────────────────────────
import { goToPage }                              from './router.js';
import { plansAPI, sessionsAPI, weightsAPI }     from './api.js';
import { loadPlans }                             from './plans.js';
import { loadHistory }                           from './history.js';
import { loadWeights }                           from './weights.js';
import { calcCurrentStreak }                     from './achievements.js';

// ── Data sync ──────────────────────────────────────────────────────────────────
async function syncDashboardData() {
  const [plansRes, sessionsRes, weightsRes] = await Promise.allSettled([
    plansAPI.getAll(),
    sessionsAPI.getAll(),
    weightsAPI.getAll(),
  ]);

  if (plansRes.status === 'fulfilled') {
    const plans = plansRes.value.map(p => ({
      id: String(p.id), apiId: p.id, name: p.name,
      goal: p.goal, days: p.days, plan: p.data, generatedAt: p.created_at,
      weekDays: p.week_days || null, isActive: !!p.is_active,
    }));
    localStorage.setItem('gym-plans', JSON.stringify(plans));
    const activePlan = plans.find(p => p.isActive);
    if (activePlan) localStorage.setItem('gym-active-plan-id', activePlan.id);
    else localStorage.removeItem('gym-active-plan-id');
  }

  if (sessionsRes.status === 'fulfilled') {
    const history = sessionsRes.value.map(s => {
      const ex = (typeof s.exercises === 'object' && s.exercises !== null) ? s.exercises : {};
      return {
        apiId: s.id, date: s.completed_at,
        planId: s.plan_id, planName: s.plan_name, dayLabel: s.day_label,
        muscles: s.muscles || [],
        durationSec:  s.duration_minutes ? s.duration_minutes * 60 : 0,
        completed: ex.completed || 0, deferred: ex.deferred || 0,
        notes: s.notes, exercisesLog: ex.log || [], quickLog: ex.quickLog || false,
      };
    });
    localStorage.setItem('gym-history', JSON.stringify(history));
  }

  if (weightsRes.status === 'fulfilled') {
    const map = {};
    for (const row of weightsRes.value) {
      map[row.exercise_id] = {
        workingWeight: parseFloat(row.working_weight) || 0,
        maxWeight:     parseFloat(row.max_weight)     || 0,
        maxDate:       row.max_date   || null,
        lastUpdated:   row.updated_at || null,
        note:          row.note       || '',
        history:       Array.isArray(row.history) ? row.history : [],
      };
    }
    localStorage.setItem('gym-exercise-weights', JSON.stringify(map));
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDays() {
  const today  = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { key: dateKey(d), day: d.getDate(), abbr: ['L','M','X','J','V','S','D'][i], dow: d.getDay() };
  });
}

function suggestNextWorkout(plans, history) {
  if (!plans.length) return null;
  const plan = plans[0];
  if (!plan.plan?.length) return null;

  const lastSession = history.find(s => s.planId === plan.id || s.planName === plan.name);
  if (!lastSession) return { plan, day: plan.plan[0] };

  const lastIdx = plan.plan.findIndex(d => d.label === lastSession.dayLabel);
  const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % plan.plan.length;
  return { plan, day: plan.plan[nextIdx] };
}

function getRecentPRs(weights) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = dateKey(cutoff);

  return Object.entries(weights)
    .filter(([, e]) => e.maxDate && e.maxDate >= cutoffStr && e.maxWeight > 0)
    .sort(([, a], [, b]) => (b.maxDate || '').localeCompare(a.maxDate || ''))
    .slice(0, 3)
    .map(([id, e]) => ({ id, maxWeight: e.maxWeight, maxDate: e.maxDate }));
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

// Returns a Set of JS getDay() values for the active plan's assigned weekdays
const WEEKDAY_NUM = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
};

function getAssignedDow(plans) {
  const activeId = localStorage.getItem('gym-active-plan-id');
  if (!activeId) return new Set();
  const activePlan = plans.find(p => p.id === activeId);
  if (!activePlan?.weekDays) return new Set();
  return new Set(
    Object.values(activePlan.weekDays).map(d => WEEKDAY_NUM[d]).filter(n => n !== undefined)
  );
}

// ── Sections ───────────────────────────────────────────────────────────────────
function buildGreeting(userName) {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const days = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio',
                  'agosto','septiembre','octubre','noviembre','diciembre'];
  const now = new Date();
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]}`;

  return `
    <div class="db-greeting">
      <p class="db-greeting-text">${greeting}, <span class="db-greeting-name">${userName}</span></p>
      <p class="db-date">${dateStr}</p>
    </div>`;
}

function buildStreakCard(streak) {
  if (streak === 0) {
    return `
      <div class="db-card db-streak-card db-streak-zero">
        <span class="db-streak-emoji">💪</span>
        <div class="db-streak-body">
          <p class="db-streak-label">Sin racha activa</p>
          <p class="db-streak-sub">Entrena hoy para empezar una racha</p>
        </div>
      </div>`;
  }
  return `
    <div class="db-card db-streak-card">
      <span class="db-streak-emoji">🔥</span>
      <div class="db-streak-body">
        <p class="db-streak-num">${streak} <span class="db-streak-unit">día${streak !== 1 ? 's' : ''}</span></p>
        <p class="db-streak-label">de racha</p>
      </div>
    </div>`;
}

function buildWeekBar(history, plans) {
  const weekDays    = getWeekDays();
  const trained     = new Set(history.map(s => s.date.slice(0, 10)));
  const todayKey    = dateKey(new Date());
  const count       = weekDays.filter(d => trained.has(d.key)).length;
  const assignedDow = getAssignedDow(plans);

  const cells = weekDays.map(d => {
    const done       = trained.has(d.key);
    const isToday    = d.key === todayKey;
    const isAssigned = assignedDow.has(d.dow);
    const dotClass   = [
      'db-week-dot',
      done                     ? 'trained'  : '',
      isToday                  ? 'today'    : '',
      isAssigned && !done      ? 'assigned' : '',
    ].filter(Boolean).join(' ');

    return `
      <div class="db-week-cell">
        <span class="db-week-abbr${isToday ? ' today' : ''}">${d.abbr}</span>
        <span class="${dotClass}">${d.day}</span>
      </div>`;
  }).join('');

  return `
    <div class="db-card">
      <div class="db-card-header">
        <p class="db-card-title">Esta semana</p>
        <span class="db-card-badge">${count} / 7 días</span>
      </div>
      <div class="db-week-bar">${cells}</div>
    </div>`;
}

function buildNextWorkout(suggestion) {
  if (!suggestion) {
    return `
      <div class="db-card db-next-card">
        <p class="db-card-title">Próximo entreno</p>
        <p class="db-next-empty">Crea tu primer plan para ver sugerencias aquí.</p>
        <button class="btn btn-primary db-next-btn" id="db-btn-create" type="button">Crear plan</button>
      </div>`;
  }
  const { plan, day } = suggestion;
  const muscles = (day.sections || []).map(s => s.muscleLabel).join(' · ') || '—';
  return `
    <div class="db-card db-next-card">
      <div class="db-card-header">
        <p class="db-card-title">Próximo entreno</p>
        <span class="db-card-badge db-card-badge-accent">${plan.name}</span>
      </div>
      <p class="db-next-day">${day.letter} · ${day.label}</p>
      <p class="db-next-muscles">${muscles}</p>
      <button class="btn btn-primary db-next-btn"
              id="db-btn-start" data-plan-id="${plan.id}" type="button">
        Empezar sesión →
      </button>
    </div>`;
}

function buildRecentPRs(prs) {
  if (!prs.length) {
    return `
      <div class="db-card">
        <p class="db-card-title">Récords personales</p>
        <p class="db-empty-msg">Aún no tienes récords. ¡A por ello!</p>
      </div>`;
  }
  const rows = prs.map(pr => `
    <div class="db-pr-row">
      <span class="db-pr-name">${pr.id}</span>
      <div class="db-pr-right">
        <span class="db-pr-weight">${pr.maxWeight} kg</span>
        <span class="db-pr-date">${fmtDate(pr.maxDate)}</span>
      </div>
    </div>`).join('');

  return `
    <div class="db-card">
      <p class="db-card-title">Récords recientes <span class="db-card-badge">30 días</span></p>
      <div class="db-pr-list">${rows}</div>
    </div>`;
}

function buildQuickActions(hasPlans) {
  return `
    <div class="db-card">
      <p class="db-card-title">Accesos rápidos</p>
      <div class="db-actions-grid">
        <button class="db-action-btn" id="db-qa-start" type="button" ${!hasPlans ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>Empezar sesión</span>
        </button>
        <button class="db-action-btn" id="db-qa-plans" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span>Mis planes</span>
        </button>
        <button class="db-action-btn" id="db-qa-history" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>Historial</span>
        </button>
        <button class="db-action-btn" id="db-qa-progress" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <span>Mi progreso</span>
        </button>
      </div>
    </div>`;
}

// ── Main renderer ──────────────────────────────────────────────────────────────
export async function renderDashboardPage() {
  const app = document.getElementById('app');

  const user = JSON.parse(localStorage.getItem('gymapp_user') || '{}');
  const userName = user.nombre || 'atleta';
  app.innerHTML = `
    <div class="view-wrapper">
      ${buildGreeting(userName)}
      <div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>
    </div>`;

  await syncDashboardData();

  const plans   = loadPlans();
  const history = loadHistory();
  const weights = loadWeights();

  const streak     = calcCurrentStreak(history);
  const suggestion = suggestNextWorkout(plans, history);
  const recentPRs  = getRecentPRs(weights);

  app.innerHTML = `
    <div class="view-wrapper db-wrapper">
      ${buildGreeting(userName)}
      ${buildStreakCard(streak)}
      ${buildWeekBar(history, plans)}
      ${buildNextWorkout(suggestion)}
      ${buildRecentPRs(recentPRs)}
      ${buildQuickActions(plans.length > 0)}
    </div>`;

  // ── Event listeners ────────────────────────────────────────────────────────
  document.getElementById('db-btn-create')?.addEventListener('click', () => goToPage('planner'));

  const startBtn = document.getElementById('db-btn-start');
  if (startBtn && suggestion) {
    startBtn.addEventListener('click', () => goToPage('session', suggestion.plan));
  }

  document.getElementById('db-qa-start')?.addEventListener('click', () => {
    if (plans.length) goToPage('session', plans[0]);
  });
  document.getElementById('db-qa-plans')?.addEventListener('click', () => goToPage('my-plans'));
  document.getElementById('db-qa-history')?.addEventListener('click', () => goToPage('history'));
  document.getElementById('db-qa-progress')?.addEventListener('click', () => goToPage('progress'));
}
