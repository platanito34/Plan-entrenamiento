// ── Custom exercises ───────────────────────────────────────────────────────────
import { MUSCLE_GROUPS } from './data.js';

const CUSTOM_KEY = 'customExercises';

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
  return list[idx];
}

export function deleteCustomExercise(id) {
  saveAll(loadCustomExercises().filter(e => e.id !== id));
}
