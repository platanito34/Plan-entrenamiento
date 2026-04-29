// ── Exercise weight tracking ───────────────────────────────────────────────────
import { weightsAPI } from './api.js';

const WEIGHTS_KEY = 'gym-exercise-weights';

// ── API normalization ──────────────────────────────────────────────────────────
function normalizeWeightsFromAPI(rows) {
  const map = {};
  for (const row of rows) {
    map[row.exercise_id] = {
      workingWeight: parseFloat(row.working_weight) || 0,
      maxWeight:     parseFloat(row.max_weight)     || 0,
      maxDate:       row.max_date   || null,
      lastUpdated:   row.updated_at || null,
      note:          row.note       || '',
      history:       Array.isArray(row.history) ? row.history : [],
    };
  }
  return map;
}

// ── API sync ───────────────────────────────────────────────────────────────────
export async function syncWeightsFromAPI() {
  try {
    const rows = await weightsAPI.getAll();
    const map  = normalizeWeightsFromAPI(rows);
    localStorage.setItem(WEIGHTS_KEY, JSON.stringify(map));
    return map;
  } catch (err) {
    console.warn('[weights] API sync failed:', err);
    return null;
  }
}

// ── Storage ────────────────────────────────────────────────────────────────────
export function loadWeights() {
  try {
    const raw = localStorage.getItem(WEIGHTS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return (typeof obj === 'object' && obj !== null) ? obj : {};
  } catch { return {}; }
}

function saveWeights(data) {
  localStorage.setItem(WEIGHTS_KEY, JSON.stringify(data));
}

export function getExerciseData(exerciseId) {
  return loadWeights()[exerciseId] ?? null;
}

export function setWorkingWeight(exerciseId, weight, isoDate) {
  const all   = loadWeights();
  const entry = all[exerciseId] ?? {
    workingWeight: 0,
    maxWeight:     0,
    maxDate:       null,
    lastUpdated:   null,
    history:       [],
  };
  const w     = parseFloat(weight) || 0;
  const today = String(isoDate).slice(0, 10);

  entry.workingWeight = w;
  entry.lastUpdated   = today;

  if (w > (entry.maxWeight || 0)) {
    entry.maxWeight = w;
    entry.maxDate   = today;
  }

  const idx = entry.history.findIndex(h => h.date === today);
  if (idx !== -1) {
    entry.history[idx].weight = w;
  } else {
    entry.history.push({ date: today, weight: w });
    entry.history.sort((a, b) => a.date.localeCompare(b.date));
  }

  all[exerciseId] = entry;
  saveWeights(all);

  weightsAPI.update(exerciseId, {
    working_weight: entry.workingWeight,
    max_weight:     entry.maxWeight,
    max_date:       entry.maxDate,
    note:           entry.note   || null,
    history:        entry.history,
  }).catch(err => console.warn('[weights] PUT failed:', err));

  return entry;
}

export function setExerciseNote(exerciseId, note) {
  const all   = loadWeights();
  const entry = all[exerciseId] ?? {
    workingWeight: 0,
    maxWeight:     0,
    maxDate:       null,
    lastUpdated:   null,
    history:       [],
  };
  entry.note      = note;
  all[exerciseId] = entry;
  saveWeights(all);

  weightsAPI.update(exerciseId, {
    working_weight: entry.workingWeight,
    max_weight:     entry.maxWeight,
    max_date:       entry.maxDate,
    note:           note,
    history:        entry.history,
  }).catch(err => console.warn('[weights] PUT (note) failed:', err));
}
