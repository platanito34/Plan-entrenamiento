// ── Achievements & Streaks ─────────────────────────────────────────────────────

const ACHIEVEMENTS_KEY = 'gym-achievements';
const HISTORY_KEY      = 'gym-history';
const PLANS_KEY        = 'gym-plans';

// ── Definitions ────────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
  { id: 'first-session', icon: '🏋️', name: 'Primera sesión',  desc: 'Completa tu primera sesión' },
  { id: 'streak-3',      icon: '🔥', name: 'En racha',         desc: '3 días seguidos entrenando' },
  { id: 'full-week',     icon: '💪', name: 'Semana completa',  desc: 'Entrena todos los días de tu plan en una semana' },
  { id: 'streak-7',      icon: '🚀', name: 'Constante',        desc: '7 días de racha' },
  { id: 'streak-14',     icon: '👊', name: 'Imparable',        desc: '14 días de racha' },
  { id: 'streak-30',     icon: '🏆', name: 'Leyenda',          desc: '30 días de racha' },
  { id: 'first-plan',    icon: '📋', name: 'Planificador',     desc: 'Crea tu primer plan' },
  { id: 'variety',       icon: '⚡', name: 'Variedad',         desc: 'Crea 3 planes diferentes' },
  { id: 'centurion',     icon: '💯', name: 'Centurión',        desc: 'Completa 100 sesiones' },
  { id: 'first-month',   icon: '🎯', name: 'Primer mes',       desc: 'Entrena durante 30 días en total' },
  { id: 'no-excuses',    icon: '💀', name: 'Sin excusas',      desc: 'Completa una sesión un lunes antes de las 9h' },
  { id: 'night-owl',     icon: '🌙', name: 'Noctámbulo',       desc: 'Completa una sesión después de las 21h' },
];

// ── Storage ────────────────────────────────────────────────────────────────────
export function loadAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAchievements(earned) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(earned));
}

// ── Streak helpers ─────────────────────────────────────────────────────────────
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreak(history) {
  const trainedKeys = new Set(history.map(s => s.date.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  while (trainedKeys.has(dateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getCurrentStreak() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(history) ? calcStreak(history) : 0;
  } catch { return 0; }
}

// ── Side nav streak badge ──────────────────────────────────────────────────────
export function refreshSideNavStreak() {
  const el = document.getElementById('side-nav-streak');
  if (!el) return;
  const streak = getCurrentStreak();
  if (streak > 0) {
    el.textContent = `🔥 ${streak} día${streak !== 1 ? 's' : ''} de racha`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

// ── "Full week" check ──────────────────────────────────────────────────────────
// Returns true if any Mon–Sun week has at least planDays unique training days.
function hasFullWeek(history, planDays) {
  const weekMap = new Map();
  for (const s of history) {
    const d   = new Date(s.date.slice(0, 10) + 'T00:00:00');
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk  = dateKey(mon);
    if (!weekMap.has(wk)) weekMap.set(wk, new Set());
    weekMap.get(wk).add(s.date.slice(0, 10));
  }
  for (const days of weekMap.values()) {
    if (days.size >= planDays) return true;
  }
  return false;
}

// ── Main check — call after every session save or plan save ───────────────────
// Returns array of newly-unlocked achievement objects.
export function checkAchievements() {
  let history, plans;
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    plans   = JSON.parse(localStorage.getItem(PLANS_KEY)   || '[]');
    if (!Array.isArray(history)) history = [];
    if (!Array.isArray(plans))   plans   = [];
  } catch { return []; }

  const earned     = loadAchievements();
  const now        = new Date().toISOString();
  const newlyEarned = [];

  function earn(id) {
    if (!earned[id]) {
      earned[id] = now;
      newlyEarned.push(id);
    }
  }

  const streak     = calcStreak(history);
  const uniqueDays = new Set(history.map(s => s.date.slice(0, 10))).size;
  const planDays   = plans.length > 0 ? (plans[plans.length - 1].days || 5) : 5;

  if (history.length >= 1)   earn('first-session');
  if (streak >= 3)            earn('streak-3');
  if (streak >= 7)            earn('streak-7');
  if (streak >= 14)           earn('streak-14');
  if (streak >= 30)           earn('streak-30');
  if (hasFullWeek(history, planDays)) earn('full-week');
  if (plans.length >= 1)     earn('first-plan');
  if (plans.length >= 3)     earn('variety');
  if (history.length >= 100) earn('centurion');
  if (uniqueDays >= 30)      earn('first-month');

  if (history.some(s => {
    const d = new Date(s.date);
    return d.getDay() === 1 && d.getHours() < 9;
  })) earn('no-excuses');

  if (history.some(s => new Date(s.date).getHours() >= 21)) earn('night-owl');

  if (newlyEarned.length > 0) {
    saveAchievements(earned);
    // Notify each newly earned achievement
    for (const id of newlyEarned) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) {
        document.dispatchEvent(new CustomEvent('show-achievement-toast', { detail: ach }));
      }
    }
  }

  return newlyEarned.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
}

// ── Achievements HTML section (for progress page) ──────────────────────────────
export function buildAchievementsSection() {
  const earned = loadAchievements();

  const cards = ACHIEVEMENTS.map(a => {
    const earnedDate = earned[a.id];
    if (earnedDate) {
      const dateStr = new Date(earnedDate).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      return `
        <div class="ach-card ach-earned" title="${a.desc}">
          <span class="ach-icon">${a.icon}</span>
          <span class="ach-name">${a.name}</span>
          <span class="ach-date">${dateStr}</span>
        </div>`;
    }
    return `
      <div class="ach-card ach-locked" title="${a.desc}">
        <span class="ach-icon">${a.icon}</span>
        <span class="ach-name">${a.name}</span>
        <span class="ach-desc">${a.desc}</span>
      </div>`;
  }).join('');

  const total  = ACHIEVEMENTS.length;
  const done   = Object.keys(earned).length;

  return `
    <div class="ach-section">
      <div class="ach-header">
        <h3 class="ach-title">Logros</h3>
        <span class="ach-counter">${done} / ${total}</span>
      </div>
      <div class="ach-grid">${cards}</div>
    </div>`;
}
