// ── Exercise weight tracking ───────────────────────────────────────────────────
const WEIGHTS_KEY = 'gym-exercise-weights';

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

// Update working weight, max, and history for an exercise.
// isoDate: ISO string or 'YYYY-MM-DD'
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

  // Upsert today in history
  const idx = entry.history.findIndex(h => h.date === today);
  if (idx !== -1) {
    entry.history[idx].weight = w;
  } else {
    entry.history.push({ date: today, weight: w });
    entry.history.sort((a, b) => a.date.localeCompare(b.date));
  }

  all[exerciseId] = entry;
  saveWeights(all);
  return entry;
}
