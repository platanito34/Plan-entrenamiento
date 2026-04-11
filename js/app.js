import { GOALS, SPLITS, MUSCLE_GROUPS } from './data.js';
import { state } from './state.js';

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

// ── Navigation ─────────────────────────────────────────────────────────────────
const RENDERERS = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };

function navigate(step) {
  updateProgressBar(step);
  RENDERERS[step]();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
// Called when the user opens an exercise details panel.
// Swaps the loading placeholder for the two exercise-position images.
function loadImages(container) {
  container.dataset.requested = 'true';           // prevent duplicate calls

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

// ── Step 3 — Selección de ejercicios ──────────────────────────────────────────
function renderStep3() {
  state.initSelections();
  const relevantMuscles = getRelevantMuscles();

  const accordionHtml = Object.entries(MUSCLE_GROUPS).map(([groupId, group]) => {
    const isRelevant = relevantMuscles.has(groupId);
    const count = state.countSelected(groupId);
    const total = group.exercises.length;

    const exercisesHtml = group.exercises.map(ex => {
      const isChecked = state.isSelected(groupId, ex.id);
      const isRec     = ex.recommended.includes(state.goal);
      const scheme    = ex.sets[state.goal];

      return `
        <div class="exercise-row">
          <div class="exercise-row-main">
            <label class="exercise-check-label">
              <input
                class="exercise-check"
                type="checkbox"
                data-muscle="${groupId}"
                data-id="${ex.id}"
                ${isChecked ? 'checked' : ''}
              >
              <span class="exercise-name-text">${ex.name}</span>
            </label>
            ${isRec ? '<span class="badge-rec">Recomendado</span>' : ''}
            <button class="exercise-details-btn" data-row="${groupId}-${ex.id}" type="button">
              Detalles <span class="details-chevron">▾</span>
            </button>
          </div>
          <div class="exercise-details" id="details-${groupId}-${ex.id}">
            <div class="exercise-images-container loading"
                 id="imgs-${groupId}-${ex.id}"
                 data-img0="${ex.images[0]}"
                 data-img1="${ex.images[1] ?? ''}"
                 data-name="${ex.name}">
              <span class="gif-loading-text">Cargando...</span>
            </div>
            <p class="exercise-why">${ex.why}</p>
            <p class="exercise-tip"><strong>Técnica:</strong> ${ex.tip}</p>
            <div class="exercise-scheme">
              <span class="scheme-item">${scheme.series} series</span>
              <span class="scheme-sep">×</span>
              <span class="scheme-item">${scheme.reps}</span>
              <span class="scheme-sep">·</span>
              <span class="scheme-item scheme-rest">${scheme.rest} descanso</span>
            </div>
          </div>
        </div>`;
    }).join('');

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
          <div class="accordion-exercises">${exercisesHtml}</div>
        </div>
      </div>`;
  }).join('');

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

  // Back
  document.getElementById('btn-back').addEventListener('click', () => navigate(2));

  // Accordion toggles
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = document.querySelector(`.accordion-group[data-group="${btn.dataset.toggle}"]`);
      group.classList.toggle('open');
    });
  });

  // Exercise checkboxes
  document.querySelectorAll('.exercise-check').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const { muscle, id } = checkbox.dataset;
      state.toggle(muscle, id);

      // Update counter in header
      const count = state.countSelected(muscle);
      const total = MUSCLE_GROUPS[muscle].exercises.length;
      document.getElementById(`count-${muscle}`).textContent = `${count}/${total}`;

      // Clear warning if user added exercises
      if (count > 0) {
        document.querySelector(`.accordion-group[data-group="${muscle}"]`)
          ?.classList.remove('warn');
      }
    });
  });

  // Exercise detail toggles + lazy GIF load
  document.querySelectorAll('.exercise-details-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowId   = btn.dataset.row;
      const details = document.getElementById(`details-${rowId}`);
      const isOpen  = details.classList.toggle('open');
      btn.classList.toggle('open', isOpen);

      if (isOpen) {
        const imgContainer = document.getElementById(`imgs-${rowId}`);
        if (imgContainer && !imgContainer.dataset.requested) {
          loadImages(imgContainer);
        }
      }
    });
  });

  // Generate button
  document.getElementById('btn-generate').addEventListener('click', validateAndContinue);
}

// ── Step 3 helpers ─────────────────────────────────────────────────────────────
function getRelevantMuscles() {
  return new Set(SPLITS[state.days].days.flatMap(d => d.muscles));
}

function validateAndContinue() {
  const relevant = getRelevantMuscles();
  const empty = [...relevant].filter(m => state.countSelected(m) === 0);

  if (empty.length > 0) {
    empty.forEach(m => {
      document.querySelector(`.accordion-group[data-group="${m}"]`)
        ?.classList.add('warn');
    });
    const names = empty.map(m => MUSCLE_GROUPS[m].label).join(', ');
    showToast(`Sin ejercicios en: ${names}. Se omitirán en el plan.`, 5000);
  }

  navigate(4);
}

// ── Step 4 — Plan generado ─────────────────────────────────────────────────────
function buildPlan() {
  return SPLITS[state.days].days.map((day, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C…
    const sections = day.muscles
      .map(muscleId => {
        const group    = MUSCLE_GROUPS[muscleId];
        const selected = state.selectedExercises[muscleId] ?? new Set();
        const exercises = [...selected]
          .map(exId => group.exercises.find(e => e.id === exId))
          .filter(Boolean);
        return { muscleLabel: group.label, exercises };
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

  // ── Builds the HTML for a single day card ─────────────────────────────────
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

  // ── Navigate to a day ──────────────────────────────────────────────────────
  function goToDay(newIdx, dir) {
    if (busy || newIdx === idx || newIdx < 0 || newIdx >= total) return;
    busy = true;
    idx  = newIdx;

    // Swap card content
    const viewport = document.getElementById('carousel-viewport');
    viewport.innerHTML = dayCardHtml(plan[idx]);
    const card = document.getElementById('carousel-card');
    card.classList.add(dir === 'next' ? 'carousel-enter-right' : 'carousel-enter-left');
    card.addEventListener('animationend', () => {
      card.classList.remove('carousel-enter-right', 'carousel-enter-left');
      busy = false;
    }, { once: true });

    // Counter
    document.getElementById('carousel-counter').textContent = `Día ${idx + 1} de ${total}`;

    // Dots
    document.querySelectorAll('.carousel-dot').forEach((dot, i) =>
      dot.classList.toggle('active', i === idx)
    );

    // Arrows
    document.getElementById('carousel-prev').disabled = idx === 0;
    document.getElementById('carousel-next').disabled = idx === total - 1;
  }

  // ── Arrow buttons ──────────────────────────────────────────────────────────
  document.getElementById('carousel-prev').addEventListener('click', () => goToDay(idx - 1, 'prev'));
  document.getElementById('carousel-next').addEventListener('click', () => goToDay(idx + 1, 'next'));

  // ── Dot buttons ────────────────────────────────────────────────────────────
  document.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const newIdx = Number(dot.dataset.dot);
      goToDay(newIdx, newIdx > idx ? 'next' : 'prev');
    });
  });

  // ── Swipe support ──────────────────────────────────────────────────────────
  let touchStartX = 0;
  const vp = document.getElementById('carousel-viewport');
  vp.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  vp.addEventListener('touchend',   e => {
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) goToDay(idx + (delta > 0 ? 1 : -1), delta > 0 ? 'next' : 'prev');
  }, { passive: true });

  // ── Footer buttons ─────────────────────────────────────────────────────────
  document.getElementById('btn-edit').addEventListener('click', () => navigate(3));
  document.getElementById('btn-save').addEventListener('click', handleSavePlan);
}

function handleSavePlan() {
  const payload = {
    goal:        state.goal,
    days:        state.days,
    generatedAt: new Date().toISOString(),
    plan:        buildPlan(),
  };
  localStorage.setItem('gym-plan', JSON.stringify(payload));

  const btn = document.getElementById('btn-save');
  btn.textContent = 'Guardado';
  btn.disabled = true;
  showToast('Plan guardado en este dispositivo');
  setTimeout(() => {
    btn.textContent = 'Guardar plan';
    btn.disabled = false;
  }, 2500);
}

// ── Init ───────────────────────────────────────────────────────────────────────
navigate(1);
