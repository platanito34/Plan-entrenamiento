import { GOALS, SPLITS, MUSCLE_GROUPS } from './data.js';
import { state } from './state.js';
import { initRouter, goToPage } from './router.js';
import { renderPlansPage, savePlan, updatePlan } from './plans.js';
import { renderSessionPage } from './session.js';
import { renderHistoryPage } from './history.js';
import { loadWeights, setWorkingWeight } from './weights.js';
import { renderExercisesPage }                          from './exercises.js';
import { renderProgressPage }                           from './progress.js';
import { checkAchievements, refreshSideNavStreak }      from './achievements.js';
import { loadCustomExercises }                          from './customExercises.js';

// ── DOM references ─────────────────────────────────────────────────────────────
const app   = document.getElementById('app');
const toast = document.getElementById('toast');

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, duration = 3500) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function updateProgressBar(activeStep) {
  document.querySelectorAll('.progress-step').forEach(el => {
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n === activeStep);
    el.classList.toggle('done',   n < activeStep);
  });
  document.querySelectorAll('.progress-connector').forEach(el => {
    const n = Number(el.dataset.after);
    el.classList.toggle('done', n < activeStep);
  });
}

// ── Animation helpers ──────────────────────────────────────────────────────────

// Animate a panel whose height starts at 0 via CSS.
// open=true  → height 0 → scrollHeight → auto
// open=false → height scrollHeight → 0
function animatePanel(panel, open) {
  if (open === panel.classList.contains('open')) return;
  if (panel.dataset.animating) return;
  panel.dataset.animating = '1';

  if (open) {
    panel.classList.add('open');
    panel.style.height    = '0';
    panel.style.overflow  = 'hidden';
    void panel.offsetHeight;                         // force reflow
    panel.style.transition = 'height 0.22s ease';
    panel.style.height     = panel.scrollHeight + 'px';
    panel.addEventListener('transitionend', () => {
      panel.style.height    = 'auto';
      panel.style.overflow  = '';
      panel.style.transition = '';
      delete panel.dataset.animating;
    }, { once: true });
  } else {
    const h = panel.getBoundingClientRect().height;
    if (h === 0) { panel.classList.remove('open'); delete panel.dataset.animating; return; }
    panel.style.height    = h + 'px';
    panel.style.overflow  = 'hidden';
    void panel.offsetHeight;
    panel.style.transition = 'height 0.22s ease';
    panel.style.height     = '0';
    panel.addEventListener('transitionend', () => {
      panel.style.height    = '';
      panel.style.overflow  = '';
      panel.style.transition = '';
      panel.classList.remove('open');
      delete panel.dataset.animating;
    }, { once: true });
  }
}

// Animate accordion — open class on .accordion-group, height on .accordion-body
function animateAccordion(group, open) {
  if (open === group.classList.contains('open')) return;
  const body = group.querySelector('.accordion-body');
  if (!body || body.dataset.animating) return;
  body.dataset.animating = '1';

  if (open) {
    group.classList.add('open');
    body.style.height    = '0';
    body.style.overflow  = 'hidden';
    void body.offsetHeight;
    body.style.transition = 'height 0.25s ease';
    body.style.height     = body.scrollHeight + 'px';
    body.addEventListener('transitionend', () => {
      body.style.height    = 'auto';
      body.style.overflow  = '';
      body.style.transition = '';
      delete body.dataset.animating;
    }, { once: true });
  } else {
    body.style.height    = body.getBoundingClientRect().height + 'px';
    body.style.overflow  = 'hidden';
    void body.offsetHeight;
    body.style.transition = 'height 0.25s ease';
    body.style.height     = '0';
    body.addEventListener('transitionend', () => {
      body.style.height    = '';
      body.style.overflow  = '';
      body.style.transition = '';
      group.classList.remove('open');
      delete body.dataset.animating;
    }, { once: true });
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
const RENDERERS = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };
let _plannerStep = 1;

function navigate(step, dir = null) {
  const prev = _plannerStep;
  _plannerStep = step;
  if (dir === null) dir = step > prev ? 'right' : step < prev ? 'left' : null;
  updateProgressBar(step);
  RENDERERS[step]();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (dir) {
    const wrapper = app.querySelector('.view-wrapper');
    if (wrapper) {
      const cls = dir === 'right' ? 'step-enter-right' : 'step-enter-left';
      wrapper.classList.add(cls);
      wrapper.addEventListener('animationend', () => wrapper.classList.remove(cls), { once: true });
    }
  }
}

// ── Step 1 — Objetivo ──────────────────────────────────────────────────────────
function renderStep1() {
  const cards = Object.entries(GOALS).map(([id, g]) => {
    const isSelected = state.goal === id;
    return `
      <button class="goal-card${isSelected ? ' selected' : ''}" data-goal="${id}" type="button">
        <span class="goal-card-tag">${g.tag}</span>
        <span class="goal-card-title">${g.label}</span>
        <p class="goal-card-description">${g.description}</p>
        <ul class="goal-card-traits">
          ${g.traits.map(t => `<li class="goal-card-trait">${t}</li>`).join('')}
        </ul>
      </button>`;
  }).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <h2 class="view-title">¿Cuál es tu objetivo?</h2>
        <p class="view-subtitle">Elige el que mejor se adapte a lo que buscas ahora mismo</p>
      </div>
      <div class="goals-grid">${cards}</div>
    </div>`;

  app.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', () => {
      state.setGoal(card.dataset.goal);
      navigate(2);
    });
  });
}

// ── Step 2 — Días por semana ───────────────────────────────────────────────────
function renderStep2() {
  const options = Object.entries(SPLITS).map(([d, split]) => {
    const isSelected = state.days === Number(d);
    return `
      <button class="day-option${isSelected ? ' selected' : ''}" data-days="${d}" type="button">
        <span class="day-option-num">${d}</span>
        <span class="day-option-split">${split.name}</span>
      </button>`;
  }).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <button class="btn-back" id="btn-back" type="button">← Atrás</button>
        <div>
          <h2 class="view-title">Días de entrenamiento</h2>
          <p class="view-subtitle">¿Cuántos días a la semana puedes entrenar?</p>
        </div>
      </div>
      <div class="days-grid">${options}</div>
    </div>`;

  document.getElementById('btn-back').addEventListener('click', () => navigate(1));

  app.querySelectorAll('.day-option').forEach(btn => {
    btn.addEventListener('click', () => {
      state.setDays(Number(btn.dataset.days));
      navigate(3);
    });
  });
}

// ── Image lazy loader ──────────────────────────────────────────────────────────
function loadImages(container) {
  container.dataset.requested = 'true';

  const src0 = container.dataset.img0;
  const src1 = container.dataset.img1;
  if (!src0) { container.remove(); return; }

  const name = container.dataset.name ?? '';

  const makeImg = (src, label) => {
    const img = document.createElement('img');
    img.src       = src;
    img.alt       = `${name} — ${label}`;
    img.className = 'exercise-img';
    img.loading   = 'lazy';
    return img;
  };

  container.innerHTML = '';
  container.classList.remove('loading');
  container.appendChild(makeImg(src0, 'posición inicial'));
  if (src1 && src1 !== src0) container.appendChild(makeImg(src1, 'posición final'));
}

// ── Shared accordion HTML builders ────────────────────────────────────────────

function buildExerciseRowHtml(muscleId, ex, goalId) {
  const isChecked    = state.isSelected(muscleId, ex.id);
  const isRec        = ex.recommended.includes(goalId);
  const baseScheme   = ex.sets[goalId];
  const custom       = state.getScheme(muscleId, ex.id);
  const scheme       = custom ? { ...baseScheme, ...custom } : baseScheme;
  const hasCustom    = !!custom;

  return `
    <div class="exercise-row${isChecked ? ' exercise-checked' : ''}" id="row-${muscleId}-${ex.id}">
      <div class="exercise-row-main">
        <label class="exercise-check-label">
          <input class="exercise-check" type="checkbox"
                 data-muscle="${muscleId}" data-id="${ex.id}" ${isChecked ? 'checked' : ''}>
          <span class="exercise-name-text">${ex.name}</span>
          ${hasCustom ? '<span class="scheme-custom-dot" title="Personalizado" aria-label="Personalizado"></span>' : ''}
        </label>
        ${ex.isCustom ? '<span class="badge-personal">Personal</span>' : isRec ? '<span class="badge-rec">Recomendado</span>' : ''}
        <button class="exercise-edit-btn" data-edit-toggle="${muscleId}:${ex.id}"
                type="button" title="Editar series y repeticiones" aria-label="Editar">✏</button>
        <button class="exercise-details-btn" data-row="${muscleId}-${ex.id}" type="button">
          Detalles <span class="details-chevron">▾</span>
        </button>
      </div>
      <div class="exercise-edit-panel" id="edit-panel-${muscleId}-${ex.id}">
        <div class="edit-panel-inner">
          <div class="edit-panel-inputs">
            <label class="edit-input-label">
              <span class="edit-input-name">Series</span>
              <input type="number" class="edit-input" data-edit-field="series"
                     min="1" max="10" value="${scheme.series}">
            </label>
            <label class="edit-input-label">
              <span class="edit-input-name">Reps</span>
              <input type="text" class="edit-input" data-edit-field="reps"
                     value="${scheme.reps}" placeholder="8-12">
            </label>
            <label class="edit-input-label">
              <span class="edit-input-name">Descanso</span>
              <input type="text" class="edit-input" data-edit-field="rest"
                     value="${scheme.rest}" placeholder="90 seg">
            </label>
          </div>
          <div class="edit-panel-actions">
            <button class="btn btn-sm btn-primary" data-edit-save="${muscleId}:${ex.id}" type="button">Guardar</button>
            <button class="btn btn-sm btn-ghost"   data-edit-reset="${muscleId}:${ex.id}" type="button">Restaurar</button>
          </div>
        </div>
      </div>
      <div class="exercise-details" id="details-${muscleId}-${ex.id}">
        <div class="exercise-images-container loading"
             id="imgs-${muscleId}-${ex.id}"
             data-img0="${ex.images[0] ?? ''}"
             data-img1="${ex.images[1] ?? ''}"
             data-name="${ex.name}">
          <span class="gif-loading-text">Cargando...</span>
        </div>
        <p class="exercise-why">${ex.why}</p>
        <p class="exercise-tip"><strong>Técnica:</strong> ${ex.tip}</p>
        <div class="exercise-scheme" id="scheme-display-${muscleId}-${ex.id}">
          <span class="scheme-item">${scheme.series} series</span>
          <span class="scheme-sep">×</span>
          <span class="scheme-item">${scheme.reps}</span>
          <span class="scheme-sep">·</span>
          <span class="scheme-item scheme-rest">${scheme.rest} descanso</span>
        </div>
      </div>
    </div>`;
}

function buildAccordionHtml() {
  const goalId          = state.goal;
  const relevantMuscles = getRelevantMuscles();
  const customAll       = loadCustomExercises();

  return Object.entries(MUSCLE_GROUPS).map(([groupId, group]) => {
    const isRelevant    = relevantMuscles.has(groupId);
    const customForGroup = customAll.filter(ce => ce.muscleId === groupId);
    const allExercises  = [...group.exercises, ...customForGroup];
    const count         = state.countSelected(groupId);
    const total         = allExercises.length;
    const exHtml        = allExercises.map(ex => buildExerciseRowHtml(groupId, ex, goalId)).join('');

    return `
      <div class="accordion-group" data-group="${groupId}">
        <button class="accordion-header" data-toggle="${groupId}" type="button">
          <div class="accordion-header-left">
            <span class="accordion-muscle-name">${group.label}</span>
            ${isRelevant ? '<span class="accordion-plan-tag">En tu plan</span>' : ''}
          </div>
          <div class="accordion-header-right">
            <span class="accordion-count" id="count-${groupId}">${count}/${total}</span>
            <span class="accordion-chevron">▾</span>
          </div>
        </button>
        <div class="accordion-body">
          <div class="accordion-exercises">${exHtml}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Shared scheme display updater ──────────────────────────────────────────────
function updateSchemeDisplay(muscleId, exId, scheme, hasCustom) {
  const display = document.getElementById(`scheme-display-${muscleId}-${exId}`);
  if (display) {
    display.innerHTML = `
      <span class="scheme-item">${scheme.series} series</span>
      <span class="scheme-sep">×</span>
      <span class="scheme-item">${scheme.reps}</span>
      <span class="scheme-sep">·</span>
      <span class="scheme-item scheme-rest">${scheme.rest} descanso</span>`;
  }
  const row = document.getElementById(`row-${muscleId}-${exId}`);
  if (row) {
    let dot = row.querySelector('.scheme-custom-dot');
    if (hasCustom && !dot) {
      dot = document.createElement('span');
      dot.className = 'scheme-custom-dot';
      dot.title     = 'Personalizado';
      dot.setAttribute('aria-label', 'Personalizado');
      row.querySelector('.exercise-name-text')?.after(dot);
    } else if (!hasCustom && dot) {
      dot.remove();
    }
  }
}

// ── Shared accordion listener attachment ──────────────────────────────────────
function attachAccordionListeners(container) {
  // 1. Accordion header toggle
  container.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = container.querySelector(`.accordion-group[data-group="${btn.dataset.toggle}"]`);
      if (group) animateAccordion(group, !group.classList.contains('open'));
    });
  });

  // 2. Checkbox changes
  container.querySelectorAll('.exercise-check').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const { muscle: muscleId, id: exId } = checkbox.dataset;
      state.toggle(muscleId, exId);

      const count = state.countSelected(muscleId);
      const total = (MUSCLE_GROUPS[muscleId]?.exercises.length ?? 0)
                  + loadCustomExercises().filter(ce => ce.muscleId === muscleId).length;
      document.getElementById(`count-${muscleId}`).textContent = `${count}/${total}`;

      if (count > 0) {
        document.querySelector(`.accordion-group[data-group="${muscleId}"]`)
          ?.classList.remove('warn');
      }

      // Show / hide edit button via CSS class on row
      const row = document.getElementById(`row-${muscleId}-${exId}`);
      if (row) row.classList.toggle('exercise-checked', checkbox.checked);

      // Close edit panel when unchecking
      if (!checkbox.checked) {
        const editPanel = document.getElementById(`edit-panel-${muscleId}-${exId}`);
        if (editPanel?.classList.contains('open')) {
          animatePanel(editPanel, false);
          document.querySelector(`[data-edit-toggle="${muscleId}:${exId}"]`)
            ?.classList.remove('active');
        }
      }
    });
  });

  // 3. Exercise details toggle
  container.querySelectorAll('.exercise-details-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId   = btn.dataset.row;
      const details = document.getElementById(`details-${rowId}`);
      if (!details) return;
      const willOpen = !details.classList.contains('open');
      btn.classList.toggle('open', willOpen);
      animatePanel(details, willOpen);
      if (willOpen) {
        const imgC = document.getElementById(`imgs-${rowId}`);
        if (imgC && !imgC.dataset.requested) loadImages(imgC);
      }
    });
  });

  // 4. Edit button toggle
  container.querySelectorAll('[data-edit-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key       = btn.dataset.editToggle;
      const [mId, eId] = key.split(':');
      const panel     = document.getElementById(`edit-panel-${mId}-${eId}`);
      if (!panel) return;
      const willOpen = !panel.classList.contains('open');
      btn.classList.toggle('active', willOpen);
      animatePanel(panel, willOpen);
    });
  });

  // 5. Edit panel — save
  container.querySelectorAll('[data-edit-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key        = btn.dataset.editSave;
      const [mId, eId] = key.split(':');
      const panel      = document.getElementById(`edit-panel-${mId}-${eId}`);
      if (!panel) return;
      const series = parseInt(panel.querySelector('[data-edit-field="series"]').value, 10) || 3;
      const reps   = panel.querySelector('[data-edit-field="reps"]').value.trim()   || '8-12';
      const rest   = panel.querySelector('[data-edit-field="rest"]').value.trim()   || '90 seg';
      state.setScheme(mId, eId, { series, reps, rest });
      updateSchemeDisplay(mId, eId, { series, reps, rest }, true);

      // Auto-select exercise if it wasn't checked yet
      if (!state.isSelected(mId, eId)) {
        state.toggle(mId, eId);
        const checkbox = container.querySelector(`.exercise-check[data-muscle="${mId}"][data-id="${eId}"]`);
        if (checkbox) checkbox.checked = true;
        const row = document.getElementById(`row-${mId}-${eId}`);
        if (row) row.classList.add('exercise-checked');
        const total = (MUSCLE_GROUPS[mId]?.exercises.length ?? 0)
                    + loadCustomExercises().filter(ce => ce.muscleId === mId).length;
        const countEl = document.getElementById(`count-${mId}`);
        if (countEl) countEl.textContent = `${state.countSelected(mId)}/${total}`;
        document.querySelector(`.accordion-group[data-group="${mId}"]`)?.classList.remove('warn');
      }

      animatePanel(panel, false);
      document.querySelector(`[data-edit-toggle="${key}"]`)?.classList.remove('active');
    });
  });

  // 6. Edit panel — restore defaults
  container.querySelectorAll('[data-edit-reset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key        = btn.dataset.editReset;
      const [mId, eId] = key.split(':');
      state.resetScheme(mId, eId);
      const ex = MUSCLE_GROUPS[mId]?.exercises.find(e => e.id === eId)
              ?? loadCustomExercises().find(e => e.id === eId);
      if (!ex) return;
      const def = ex.sets[state.goal];
      updateSchemeDisplay(mId, eId, def, false);
      const panel = document.getElementById(`edit-panel-${mId}-${eId}`);
      if (panel) {
        panel.querySelector('[data-edit-field="series"]').value = def.series;
        panel.querySelector('[data-edit-field="reps"]').value   = def.reps;
        panel.querySelector('[data-edit-field="rest"]').value   = def.rest;
      }
    });
  });
}

// ── Step 3 — Selección de ejercicios ──────────────────────────────────────────
function renderStep3() {
  state.initSelections();

  const accordionHtml = buildAccordionHtml();

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <button class="btn-back" id="btn-back" type="button">← Atrás</button>
        <div>
          <h2 class="view-title">Elige tus ejercicios</h2>
          <p class="view-subtitle">Los marcados como <strong>Recomendado</strong> son los más eficaces para tu objetivo</p>
        </div>
      </div>
      <div class="accordion" id="accordion">${accordionHtml}</div>
      <div class="step-footer">
        <button class="btn btn-primary btn-full" id="btn-generate" type="button">
          Generar plan →
        </button>
      </div>
    </div>`;

  document.getElementById('btn-back').addEventListener('click', () => navigate(2));
  document.getElementById('btn-generate').addEventListener('click', validateAndContinue);

  attachAccordionListeners(document.getElementById('accordion'));
}

// ── Step 3 helpers ─────────────────────────────────────────────────────────────
function getRelevantMuscles() {
  return new Set(SPLITS[state.days].days.flatMap(d => d.muscles));
}

function validateAndContinue() {
  const relevant = getRelevantMuscles();
  const empty    = [...relevant].filter(m => state.countSelected(m) === 0);

  if (empty.length > 0) {
    empty.forEach(m => {
      document.querySelector(`.accordion-group[data-group="${m}"]`)?.classList.add('warn');
    });
    const names = empty.map(m => MUSCLE_GROUPS[m].label).join(', ');
    showToast(`Sin ejercicios en: ${names}. Se omitirán en el plan.`, 5000);
  }

  navigate(4);
}

// ── Step 4 — Plan generado ─────────────────────────────────────────────────────
function buildPlan() {
  return SPLITS[state.days].days.map((day, idx) => {
    const letter   = String.fromCharCode(65 + idx);
    const sections = day.muscles
      .map(muscleId => {
        const group    = MUSCLE_GROUPS[muscleId];
        const selected = state.selectedExercises[muscleId] ?? new Set();
        const exercises = [...selected]
          .map(exId => {
            const ex     = group.exercises.find(e => e.id === exId);
            if (!ex) return null;
            const custom = state.getScheme(muscleId, exId);
            if (!custom) return ex;
            // Clone with custom scheme for current goal
            return {
              ...ex,
              sets: { ...ex.sets, [state.goal]: { ...ex.sets[state.goal], ...custom } },
            };
          })
          .filter(Boolean);
        return { muscleLabel: group.label, muscleId, exercises };
      })
      .filter(s => s.exercises.length > 0);

    return { letter, label: day.label, sections };
  });
}

function renderStep4() {
  const plan     = buildPlan();
  const goalData = GOALS[state.goal];
  const split    = SPLITS[state.days];
  const total    = plan.length;
  let   idx      = 0;
  let   busy     = false;

  function dayCardHtml(day) {
    const sectionsHtml = day.sections.length > 0
      ? day.sections.map(section => {
          const exHtml = section.exercises.map(ex => {
            const s = ex.sets[state.goal];
            return `
              <li class="plan-exercise-item">
                <span class="plan-exercise-name">${ex.name}</span>
                <span class="plan-exercise-scheme">${s.series} × ${s.reps} · ${s.rest}</span>
              </li>`;
          }).join('');
          return `
            <div class="plan-section">
              <div class="plan-section-muscle">${section.muscleLabel}</div>
              <ul class="plan-section-exercises">${exHtml}</ul>
            </div>`;
        }).join('')
      : '<p class="plan-no-exercises">Sin ejercicios seleccionados para este día</p>';

    return `
      <div class="plan-day-card" id="carousel-card">
        <div class="plan-day-header">
          <span class="plan-day-letter">${day.letter}</span>
          <span class="plan-day-title">${day.label}</span>
        </div>
        ${sectionsHtml}
      </div>`;
  }

  const dotsHtml = plan.map((_, i) =>
    `<button class="carousel-dot${i === 0 ? ' active' : ''}" data-dot="${i}" type="button" aria-label="Día ${i + 1}"></button>`
  ).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <div></div>
        <div>
          <h2 class="view-title">Tu plan semanal</h2>
          <p class="view-subtitle">${goalData.label} · ${state.days} días / semana</p>
        </div>
      </div>
      <div class="plan-meta">
        <span class="plan-meta-badge">${goalData.label} — ${split.name}</span>
      </div>

      <div class="carousel">
        <div class="carousel-nav">
          <button class="carousel-arrow" id="carousel-prev" type="button" aria-label="Día anterior" disabled>←</button>
          <span class="carousel-counter" id="carousel-counter">Día 1 de ${total}</span>
          <button class="carousel-arrow" id="carousel-next" type="button" aria-label="Día siguiente"${total <= 1 ? ' disabled' : ''}>→</button>
        </div>
        <div class="carousel-viewport" id="carousel-viewport">
          ${dayCardHtml(plan[0])}
        </div>
        <div class="carousel-dots">${dotsHtml}</div>
      </div>

      <div class="plan-footer">
        <button class="btn btn-secondary" id="btn-edit" type="button">← Volver a editar</button>
        <button class="btn btn-primary"   id="btn-save" type="button">Guardar plan</button>
      </div>
    </div>`;

  function goToDay(newIdx, dir) {
    if (busy || newIdx === idx || newIdx < 0 || newIdx >= total) return;
    busy = true;
    idx  = newIdx;

    const viewport = document.getElementById('carousel-viewport');
    viewport.innerHTML = dayCardHtml(plan[idx]);
    const card = document.getElementById('carousel-card');
    card.classList.add(dir === 'next' ? 'carousel-enter-right' : 'carousel-enter-left');
    card.addEventListener('animationend', () => {
      card.classList.remove('carousel-enter-right', 'carousel-enter-left');
      busy = false;
    }, { once: true });

    document.getElementById('carousel-counter').textContent = `Día ${idx + 1} de ${total}`;
    document.querySelectorAll('.carousel-dot').forEach((dot, i) =>
      dot.classList.toggle('active', i === idx)
    );
    document.getElementById('carousel-prev').disabled = idx === 0;
    document.getElementById('carousel-next').disabled = idx === total - 1;
  }

  document.getElementById('carousel-prev').addEventListener('click', () => goToDay(idx - 1, 'prev'));
  document.getElementById('carousel-next').addEventListener('click', () => goToDay(idx + 1, 'next'));

  document.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const newIdx = Number(dot.dataset.dot);
      goToDay(newIdx, newIdx > idx ? 'next' : 'prev');
    });
  });

  let touchStartX = 0;
  const vp = document.getElementById('carousel-viewport');
  vp.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener('touchend',   e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) goToDay(idx + (delta > 0 ? 1 : -1), delta > 0 ? 'next' : 'prev');
  }, { passive: true });

  document.getElementById('btn-edit').addEventListener('click', () => navigate(3));
  document.getElementById('btn-save').addEventListener('click', handleSavePlan);
}

function handleSavePlan() {
  const plan = {
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    goal:        state.goal,
    days:        state.days,
    name:        `${GOALS[state.goal].label} · ${state.days} días`,
    generatedAt: new Date().toISOString(),
    plan:        buildPlan(),
  };
  savePlan(plan);
  checkAchievements();

  const btn = document.getElementById('btn-save');
  btn.textContent = 'Guardado ✓';
  btn.disabled    = true;
  showToast('Plan guardado en Mis planes');
  setTimeout(() => {
    btn.textContent = 'Guardar plan';
    btn.disabled    = false;
  }, 2500);
}

// ── Edit plan page ─────────────────────────────────────────────────────────────
function renderEditPlanPage(originalPlan) {
  state.loadFromPlan(originalPlan);

  function buildEditHtml() {
    const goalBtns = Object.entries(GOALS).map(([id, g]) =>
      `<button class="edit-option-btn${state.goal === id ? ' active' : ''}" data-goal="${id}" type="button">${g.label}</button>`
    ).join('');

    const daysBtns = [2, 3, 4, 5, 6].map(d =>
      `<button class="edit-option-btn${state.days === d ? ' active' : ''}" data-days="${d}" type="button">${d} días</button>`
    ).join('');

    return `
      <div class="view-wrapper">
        <div class="view-header">
          <button class="btn-back" id="btn-cancel-edit" type="button">← Cancelar</button>
          <div>
            <h2 class="view-title">Editar plan</h2>
            <p class="view-subtitle">${originalPlan.name}</p>
          </div>
        </div>

        <div class="edit-meta-section">
          <h3 class="edit-meta-label">Objetivo</h3>
          <div class="edit-option-grid" id="edit-goal-grid">${goalBtns}</div>
        </div>

        <div class="edit-meta-section">
          <h3 class="edit-meta-label">Días por semana</h3>
          <div class="edit-option-grid" id="edit-days-grid">${daysBtns}</div>
        </div>

        <h3 class="edit-meta-label">Ejercicios</h3>
        <div class="accordion" id="edit-accordion">${buildAccordionHtml()}</div>

        <div class="step-footer">
          <button class="btn btn-ghost" id="btn-cancel-edit-footer" type="button">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-edit" type="button">Guardar cambios</button>
        </div>
      </div>`;
  }

  function rerenderAccordion() {
    const container = document.getElementById('edit-accordion');
    if (!container) return;
    container.innerHTML = buildAccordionHtml();
    attachAccordionListeners(container);
  }

  app.innerHTML = buildEditHtml();

  // Cancel
  ['btn-cancel-edit', 'btn-cancel-edit-footer'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => goToPage('my-plans'));
  });

  // Goal selector
  document.getElementById('edit-goal-grid').querySelectorAll('[data-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newGoal = btn.dataset.goal;
      if (newGoal === state.goal) return;
      if (!confirm(`Cambiar a "${GOALS[newGoal].label}" limpiará las series y repeticiones personalizadas. ¿Continuar?`)) return;
      state.goal = newGoal;
      state._initGoal = null;
      state.clearCustomSchemes();
      document.querySelectorAll('#edit-goal-grid [data-goal]').forEach(b =>
        b.classList.toggle('active', b.dataset.goal === newGoal)
      );
      rerenderAccordion();
    });
  });

  // Days selector
  document.getElementById('edit-days-grid').querySelectorAll('[data-days]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newDays = Number(btn.dataset.days);
      if (newDays === state.days) return;
      if (!confirm(`Cambiar a ${newDays} días reorganizará los grupos musculares del plan. ¿Continuar?`)) return;
      state.days = newDays;
      document.querySelectorAll('#edit-days-grid [data-days]').forEach(b =>
        b.classList.toggle('active', Number(b.dataset.days) === newDays)
      );
      rerenderAccordion();
    });
  });

  // Save
  document.getElementById('btn-save-edit').addEventListener('click', () => {
    const updatedPlan = {
      ...originalPlan,
      goal:        state.goal,
      days:        state.days,
      name:        `${GOALS[state.goal].label} · ${state.days} días`,
      plan:        buildPlan(),
    };
    updatePlan(updatedPlan);
    goToPage('my-plans');
    showToast('Plan actualizado');
  });

  attachAccordionListeners(document.getElementById('edit-accordion'));
}

// ── Plan weights page ──────────────────────────────────────────────────────────
function renderPlanWeightsPage(plan) {
  const weights = loadWeights();

  const daysHtml = plan.plan.map(day => {
    const rowsHtml = day.sections.flatMap(s => s.exercises).map(ex => {
      const id   = ex.id ?? ex.name;
      const data = weights[id] ?? null;
      return `
        <div class="pw-ex-row">
          <div class="pw-ex-info">
            <span class="pw-ex-name">${ex.name}</span>
            <span class="pw-ex-meta">
              ${data?.maxWeight   ? `Máx: ${data.maxWeight} kg${data.maxDate ? ' · ' + fmtShortDate(data.maxDate) : ''}` : 'Sin registros'}
            </span>
            ${data?.lastUpdated ? `<span class="pw-ex-meta">Actualizado: ${fmtShortDate(data.lastUpdated)}</span>` : ''}
          </div>
          <div class="pw-input-wrap">
            <input type="number" inputmode="decimal" class="pw-weight-input"
                   data-ex-id="${id}" value="${data?.workingWeight ?? ''}"
                   placeholder="0" min="0" step="0.5" aria-label="Peso de trabajo ${ex.name}">
            <span class="pw-kg">kg</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="pw-day">
        <h3 class="pw-day-title">
          <span class="pw-day-letter">${day.letter}</span>
          ${day.label}
        </h3>
        ${rowsHtml}
      </div>`;
  }).join('');

  app.innerHTML = `
    <div class="view-wrapper">
      <div class="view-header">
        <button class="btn-back" id="btn-back-pw" type="button">← Mis planes</button>
        <div>
          <h2 class="view-title">Pesos de trabajo</h2>
          <p class="view-subtitle">${plan.name}</p>
        </div>
      </div>
      <div class="pw-list">${daysHtml}</div>
      <div class="step-footer">
        <button class="btn btn-primary btn-full" id="btn-save-pw" type="button">Guardar cambios</button>
      </div>
    </div>`;

  document.getElementById('btn-back-pw').addEventListener('click', () => goToPage('my-plans'));

  document.getElementById('btn-save-pw').addEventListener('click', () => {
    const today = new Date().toISOString();
    app.querySelectorAll('.pw-weight-input').forEach(input => {
      const val = parseFloat(input.value);
      if (!isNaN(val) && val > 0) {
        setWorkingWeight(input.dataset.exId, val, today);
      }
    });
    goToPage('my-plans');
    showToast('Pesos guardados');
  });
}

function fmtShortDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short',
    });
  } catch { return iso; }
}

// ── Init ───────────────────────────────────────────────────────────────────────
initRouter((page, data) => {
  if      (page === 'my-plans')     renderPlansPage();
  else if (page === 'session')      renderSessionPage(data);
  else if (page === 'history')      renderHistoryPage();
  else if (page === 'edit-plan')    renderEditPlanPage(data);
  else if (page === 'plan-weights') renderPlanWeightsPage(data);
  else if (page === 'exercises')    renderExercisesPage();
  else if (page === 'progress')     renderProgressPage();
  else                              navigate(_plannerStep);

  // Page fade-in for non-planner pages (planner uses step transitions)
  if (page !== 'planner') {
    const wrapper = app.querySelector('.view-wrapper, .session-screen, .session-completion');
    if (wrapper) {
      wrapper.classList.add('page-fade-in');
      wrapper.addEventListener('animationend', () => wrapper.classList.remove('page-fade-in'), { once: true });
    }
  }
});

// ── Side nav ───────────────────────────────────────────────────────────────────
const hamburger  = document.getElementById('hamburger-btn');
const sideNav    = document.getElementById('side-nav');
const navOverlay = document.getElementById('side-nav-overlay');
const navClose   = document.getElementById('side-nav-close');

function openSideNav() {
  sideNav.classList.add('open');
  navOverlay.classList.add('visible');
  hamburger.classList.add('nav-open');
  hamburger.setAttribute('aria-expanded', 'true');
}

function closeSideNav() {
  sideNav.classList.remove('open');
  navOverlay.classList.remove('visible');
  hamburger.classList.remove('nav-open');
  hamburger.setAttribute('aria-expanded', 'false');
}

hamburger.addEventListener('click', openSideNav);
navClose.addEventListener('click', closeSideNav);
navOverlay.addEventListener('click', closeSideNav);

document.querySelectorAll('.side-nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    goToPage(btn.dataset.page);
    closeSideNav();
  });
});

// Close side nav on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sideNav.classList.contains('open')) closeSideNav();
});

// ── Toast bridge (plans.js fires this event) ───────────────────────────────────
document.addEventListener('show-toast', e => showToast(e.detail));

// ── Achievement toast (achievements.js fires this event) ───────────────────────
document.addEventListener('show-achievement-toast', e => {
  const { icon, name } = e.detail;
  clearTimeout(toastTimer);
  toast.textContent = `${icon} ¡Logro desbloqueado! ${name}`;
  toast.classList.add('visible', 'toast-achievement');
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible', 'toast-achievement');
  }, 4000);
});

navigate(1);
refreshSideNavStreak();
