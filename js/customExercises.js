// ── Custom exercises ───────────────────────────────────────────────────────────
import { MUSCLE_GROUPS } from './data.js';
import { exercisesAPI }  from './api.js';

const CUSTOM_KEY = 'customExercises';

// ── API normalization ──────────────────────────────────────────────────────────
function normalizeCustomExFromAPI(row) {
  return {
    id:          row.exercise_id,
    apiDbId:     row.id,
    name:        row.name,
    muscleId:    row.muscle_group,
    muscleLabel: row.muscle_group,
    description: row.description || '',
    why:         row.description || '',
    note:        row.note        || '',
    tip:         '',
    images:      [],
    recommended: [],
    sets: {
      muscle:   { series: 3, reps: '8-12',  rest: '90 seg' },
      fat:      { series: 3, reps: '15-20', rest: '45 seg' },
      strength: { series: 5, reps: '3-5',   rest: '3 min'  },
    },
    isCustom: true,
  };
}

// ── API sync ───────────────────────────────────────────────────────────────────
export async function syncCustomExercisesFromAPI() {
  try {
    const rows = await exercisesAPI.getCustom();
    const list = rows.map(normalizeCustomExFromAPI);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn('[customExercises] API sync failed:', err);
    return null;
  }
}

// ── Storage ────────────────────────────────────────────────────────────────────
export function loadCustomExercises() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAll(list) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function addCustomExercise({ name, muscleId, description }) {
  const muscleLabel = MUSCLE_GROUPS[muscleId]?.label ?? muscleId;
  const id = `custom-${Date.now()}`;
  const ex = {
    id,
    name,
    muscleId,
    muscleLabel,
    description: description || '',
    images: [],
    why:  description || '',
    tip:  '',
    recommended: [],
    sets: {
      muscle:   { series: 3, reps: '8-12',  rest: '90 seg' },
      fat:      { series: 3, reps: '15-20', rest: '45 seg' },
      strength: { series: 5, reps: '3-5',   rest: '3 min'  },
    },
    isCustom: true,
  };
  const list = loadCustomExercises();
  list.push(ex);
  saveAll(list);

  exercisesAPI.create({
    exercise_id:  id,
    name:         name,
    muscle_group: muscleLabel,
    description:  description || '',
  }).then(result => {
    const current = loadCustomExercises();
    const idx = current.findIndex(e => e.id === id);
    if (idx !== -1) {
      current[idx].apiDbId = result.id;
      saveAll(current);
    }
  }).catch(err => console.warn('[customExercises] POST failed:', err));

  return ex;
}

export function updateCustomExercise(id, { name, muscleId, description }) {
  const list = loadCustomExercises();
  const idx  = list.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const muscleLabel = MUSCLE_GROUPS[muscleId]?.label ?? muscleId;
  list[idx] = {
    ...list[idx],
    name,
    muscleId,
    muscleLabel,
    description: description || '',
    why: description || '',
  };
  saveAll(list);

  const apiDbId = list[idx].apiDbId;
  if (apiDbId) {
    exercisesAPI.update(apiDbId, { name, muscle_group: muscleLabel, description: description || '' })
      .catch(err => console.warn('[customExercises] PUT failed:', err));
  }

  return list[idx];
}

export function deleteCustomExercise(id) {
  const list    = loadCustomExercises();
  const target  = list.find(e => e.id === id);
  saveAll(list.filter(e => e.id !== id));

  if (target?.apiDbId) {
    exercisesAPI.remove(target.apiDbId)
      .catch(err => console.warn('[customExercises] DELETE failed:', err));
  }
}
