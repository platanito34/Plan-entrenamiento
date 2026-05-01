// ── Mis planes page ────────────────────────────────────────────────────────────
import { goToPage }                              from './router.js';
import { saveSession, loadHistory }              from './history.js';
import { checkAchievements, refreshSideNavStreak } from './achievements.js';
import { plansAPI }                              from './api.js';

const PLANS_KEY      = 'gym-plans';
const MIGRATED_KEY   = '_gym_migrated';
const ACTIVE_PLAN_KEY = 'gym-active-plan-id';

// ── Active plan helpers ────────────────────────────────────────────────────────
export function getActivePlanId() {
  return localStorage.getItem(ACTIVE_PLAN_KEY);
}

function setActivePlanId(id) {
  if (id != null) localStorage.setItem(ACTIVE_PLAN_KEY, String(id));
  else localStorage.removeItem(ACTIVE_PLAN_KEY);
}

// ── API normalization ──────────────────────────────────────────────────────────
function normalizePlanFromAPI(p) {
  return {
    id:          String(p.id),
    apiId:       p.id,
    name:        p.name,
    goal:        p.goal,
    days:        p.days,
    plan:        p.data,
    generatedAt: p.created_at,
    weekDays:    p.week_days || null,
    isActive:    !!p.is_active,
  };
}

// ── API sync ───────────────────────────────────────────────────────────────────
async function syncPlansFromAPI() {
  try {
    const apiPlans = await plansAPI.getAll();
    const plans = apiPlans.map(normalizePlanFromAPI);
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
    const activePlan = plans.find(p => p.isActive);
    setActivePlanId(activePlan?.id ?? null);   // store local string ID
    return plans;
  } catch (err) {
    console.warn('[plans] API sync failed:', err);
    return null;
  }
}

// ── Storage helpers ────────────────────────────────────────────────────────────
export function loadPlans() {
  try {
    const raw   = localStorage.getItem(PLANS_KEY);
    const plans = raw ? JSON.parse(raw) : [];
    migrateOld(plans);
    return Array.isArray(plans) ? plans : [];
  } catch {
    return [];
  }
}

function migrateOld(plans) {
  if (localStorage.getItem(MIGRATED_KEY)) return;
  try {
    const old = localStorage.getItem('gym-plan');
    if (old) {
      const parsed = JSON.parse(old);
      if (parsed?.goal && !plans.some(p => p.id === 'v1')) {
        const LABELS = { muscle: 'Ganar músculo', fat: 'Perder grasa', strength: 'Fuerza máxima' };
        plans.unshift({
          ...parsed,
          id:   'v1',
          name: `${LABELS[parsed.goal] ?? parsed.goal} · ${parsed.days} días`,
        });
        localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
      }
    }
  } catch { /* ignore malformed data */ }
  localStorage.setItem(MIGRATED_KEY, '1');
}

export function savePlan(plan) {
  const plans = loadPlans();
  plans.unshift(plan);
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));

  plansAPI.create(plan.name, plan.goal, plan.days, plan.plan, plan.weekDays)
    .then(result => {
      const current = loadPlans();
      const idx = current.findIndex(p => p.id === plan.id);
      if (idx !== -1) {
        current[idx].apiId = result.id;
        localStorage.setItem(PLANS_KEY, JSON.stringify(current));
      }
    })
    .catch(err => console.warn('[plans] POST failed:', err));
}

export function deletePlan(id) {
  const plans  = loadPlans();
  const target = plans.find(p => p.id === id);
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans.filter(p => p.id !== id)));

  if (target?.id === getActivePlanId()) {
    setActivePlanId(null);
  }

  if (target?.apiId) {
    plansAPI.remove(target.apiId)
      .catch(err => console.warn('[plans] DELETE failed:', err));
  }
}

export function updatePlan(updatedPlan) {
  const plans = loadPlans();
  const idx   = plans.findIndex(p => p.id === updatedPlan.id);
  if (idx !== -1) {
    plans[idx] = updatedPlan;
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));

    const apiId = updatedPlan.apiId;
    if (apiId) {
      plansAPI.update(apiId, updatedPlan.name, updatedPlan.goal, updatedPlan.days, updatedPlan.plan, updatedPlan.weekDays)
        .catch(err => console.warn('[plans] PUT failed:', err));
    }
  }
}

// ── Last-session helpers ───────────────────────────────────────────────────────
function getLastSession(planId, planName) {
  const history = loadHistory();
  return history.find(s => s.planId === planId || s.planName === planName) ?? null;
}

function daysAgo(isoDate) {
  const diff = Math.floor((Date.now() - new Date(isoDate)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
}

// ── Smooth panel toggle ────────────────────────────────────────────────────────
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

// ── Weekday label helper ───────────────────────────────────────────────────────
const WEEKDAY_LABELS = {
  monday: 'L', tuesday: 'M', wednesday: 'X',
  thursday: 'J', friday: 'V', saturday: 'S', sunday: 'D',
};
const WEEKDAY_FULL = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};

function buildWeekDaysBadges(weekDays) {
  if (!weekDays) return '';
  const badges = Object.entries(weekDays).map(([label, day]) =>
    `<span class="myplan-wd-badge" title="${label}">${WEEKDAY_LABELS[day] ?? day}</span>`
  ).join('');
  return `<div class="myplan-wd-row">${badges}</div>`;
}

// ── Page renderer ──────────────────────────────────────────────────────────────
export async function renderPlansPage() {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="view-wrapper"><div class="view-header"><h2 class="view-title">Mis planes</h2></div><div class="loading-spinner-wrap"><div class="loading-spinner"></div></div></div>`;

  const fresh = await syncPlansFromAPI();
  const plans = fresh ?? loadPlans();

  if (plans.length === 0) {
    app.innerHTML = `
      <div class="view-wrapper">
        <div class="view-header">
          <h2 class="view-title">Mis planes</h2>
        </div>
        <div class="plans-empty">
          <div class="plans-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="8" y1="16" x2="12" y2="16"/>
            </svg>
          </div>
          <p class="plans-empty-title">Sin planes guardados</p>
          <p class="plans-empty-text">Crea tu primer plan de entrenamiento semanal.</p>
          <button class="btn btn-primary" id="btn-go-create" type="button">Crear plan</button>
        </div>
      </div>`;
    document.getElementById('btn-go-create').addEventListener('click', () => goToPage('planner'));
    return;
  }

  const activePlanId = getActivePlanId();   // local string ID (e.g. '1m2n3o4p')

  const cardsHtml = plans.map((plan, i) => {
    const isActive = plan.id === activePlanId;

    const daysHtml = plan.plan.map(d => `
      <li class="myplan-day">
        <span class="myplan-day-letter">${d.letter}</span>
        <span class="myplan-day-label">${d.label}</span>
      </li>`).join('');

    const lastSession  = getLastSession(plan.id, plan.name);
    const lastSessHtml = lastSession
      ? `<p class="myplan-last-session">Último entreno: ${lastSession.dayLabel} · ${daysAgo(lastSession.date)}</p>`
      : '';

    const weekDaysHtml = buildWeekDaysBadges(plan.weekDays);

    const dayOptions = plan.plan.map(d =>
      `<option value="${d.label}">${d.letter} · ${d.label}</option>`
    ).join('');

    return `
      <div class="myplan-card stagger-item${isActive ? ' myplan-card--active' : ''}" style="animation-delay:${i * 60}ms">
        <div class="myplan-header">
          <div class="myplan-header-left">
            <p class="myplan-name">${plan.name}${isActive ? '<span class="myplan-active-badge">ACTIVO</span>' : ''}</p>
            <p class="myplan-date">${formatDate(plan.generatedAt)}</p>
          </div>
        </div>
        ${weekDaysHtml}
        <ul class="myplan-days">${daysHtml}</ul>
        ${lastSessHtml}
        <div class="myplan-actions">
          <div class="myplan-primary-row">
            <button class="btn btn-primary" data-action="start" data-id="${plan.id}" type="button">Empezar sesión</button>
            ${isActive
              ? `<button class="btn btn-ghost btn-sm btn-deactivate" data-action="deactivate" data-id="${plan.id}" type="button">Desactivar</button>`
              : `<button class="btn btn-ghost btn-sm" data-action="activate" data-id="${plan.id}" type="button">Activar</button>`
            }
          </div>
          <div class="myplan-secondary-row">
            <button class="btn btn-ghost btn-sm" data-action="weights" data-id="${plan.id}" type="button">Pesos</button>
            <button class="btn btn-ghost btn-sm" data-action="edit"    data-id="${plan.id}" type="button">Editar</button>
            <button class="btn-ghost-danger"      data-action="delete"  data-id="${plan.id}" type="button">Eliminar</button>
          </div>
        </div>
        <button class="myplan-quick-log-btn" data-action="quick-log" data-id="${plan.id}" type="button">
          + Registrar sesión rápida
        </button>
        <div class="quick-log-panel" id="ql-${plan.id}">
          <div class="quick-log-inner">
            <h4 class="quick-log-title">Registrar sesión</h4>
            <div class="quick-log-field">
              <label class="quick-log-label" for="ql-day-${plan.id}">Día del plan</label>
              <select class="quick-log-select" id="ql-day-${plan.id}">${dayOptions}</select>
            </div>
            <div class="quick-log-field">
              <label class="quick-log-label" for="ql-dur-${plan.id}">
                Duración <span class="quick-log-optional">(min, opcional)</span>
              </label>
              <input type="number" class="quick-log-input" id="ql-dur-${plan.id}"
                     placeholder="45" min="1" max="300" inputmode="numeric">
            </div>
            <div class="quick-log-field">
              <label class="quick-log-label" for="ql-notes-${plan.id}">
                Notas <span class="quick-log-optional">(opcional)</span>
              </label>
              <textarea class="quick-log-textarea" id="ql-notes-${plan.id}"
                        maxlength="200" placeholder="¿Cómo fue el entrenamiento?"></textarea>
              <span class="quick-log-char-count" id="ql-cc-${plan.id}">0 / 200</span>
            </div>
            <div class="quick-log-actions">
              <button class="btn btn-ghost btn-sm" data-action="ql-cancel" data-id="${plan.id}" type="button">Cancelar</button>
              <button class="btn btn-primary btn-sm" data-action="ql-save" data-id="${plan.id}" type="button">Guardar sesión</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <h2 class="view-title">Mis planes</h2>
        <p class="view-subtitle">${plans.length} plan${plans.length !== 1 ? 'es' : ''} guardado${plans.length !== 1 ? 's' : ''}</p>
      </div>
      <div class="myplans-list">${cardsHtml}</div>
    </div>`;

  // ── Action listeners ───────────────────────────────────────────────────────
  app.querySelectorAll('[data-action="start"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = plans.find(p => p.id === btn.dataset.id);
      if (plan) goToPage('session', plan);
    });
  });

  app.querySelectorAll('[data-action="activate"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = plans.find(p => p.id === btn.dataset.id);
      if (!plan) return;
      setActivePlanId(plan.id);
      if (plan.apiId) {
        plansAPI.activate(plan.apiId).catch(err => console.warn('[plans] activate failed:', err));
      }
      renderPlansPage();
    });
  });

  app.querySelectorAll('[data-action="deactivate"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = plans.find(p => p.id === btn.dataset.id);
      if (!plan) return;
      setActivePlanId(null);
      if (plan.apiId) {
        plansAPI.deactivate(plan.apiId).catch(err => console.warn('[plans] deactivate failed:', err));
      }
      renderPlansPage();
    });
  });

  app.querySelectorAll('[data-action="weights"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = plans.find(p => p.id === btn.dataset.id);
      if (plan) goToPage('plan-weights', plan);
    });
  });

  app.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = plans.find(p => p.id === btn.dataset.id);
      if (plan) goToPage('edit-plan', plan);
    });
  });

  app.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar este plan? Esta acción no se puede deshacer.')) {
        deletePlan(btn.dataset.id);
        renderPlansPage();
      }
    });
  });

  // ── Quick log listeners ────────────────────────────────────────────────────
  app.querySelectorAll('[data-action="quick-log"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`ql-${btn.dataset.id}`);
      if (panel) togglePanel(panel, !panel.classList.contains('open'));
    });
  });

  app.querySelectorAll('[data-action="ql-cancel"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`ql-${btn.dataset.id}`);
      if (panel) togglePanel(panel, false);
    });
  });

  plans.forEach(plan => {
    const ta = document.getElementById(`ql-notes-${plan.id}`);
    const cc = document.getElementById(`ql-cc-${plan.id}`);
    if (ta && cc) {
      ta.addEventListener('input', () => {
        cc.textContent = `${ta.value.length} / 200`;
      });
    }
  });

  app.querySelectorAll('[data-action="ql-save"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const plan  = plans.find(p => p.id === id);
      if (!plan) return;

      const dayLabel = document.getElementById(`ql-day-${id}`)?.value ?? plan.plan[0]?.label ?? '';
      const durVal   = document.getElementById(`ql-dur-${id}`)?.value;
      const notes    = document.getElementById(`ql-notes-${id}`)?.value?.trim() ?? '';
      const durSec   = durVal ? Math.round(parseFloat(durVal) * 60) : 0;
      const day      = plan.plan.find(d => d.label === dayLabel);
      const muscles  = day ? day.sections.map(s => s.muscleLabel) : [];

      saveSession({
        date:        new Date().toISOString(),
        planId:      plan.id,
        planName:    plan.name,
        dayLabel,
        muscles,
        durationSec: durSec,
        completed:   0,
        deferred:    0,
        notes:       notes || undefined,
        quickLog:    true,
      });
      checkAchievements();
      refreshSideNavStreak();

      const panel = document.getElementById(`ql-${id}`);
      if (panel) togglePanel(panel, false);
      renderPlansPage();
      document.dispatchEvent(new CustomEvent('show-toast', { detail: '✓ Sesión guardada' }));
    });
  });
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}
