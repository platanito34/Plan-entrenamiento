import { MUSCLE_GROUPS } from './data.js';

export const state = {
  goal: null,   // 'muscle' | 'fat' | 'strength'
  days: null,   // 2 | 3 | 4 | 5 | 6

  // { muscleGroupId: Set<exerciseId> }
  selectedExercises: {},

  // Custom scheme overrides — key: `${muscleId}:${exId}`, value: { series, reps, rest }
  customSchemes: {},

  // Tracks which goal was used when selections were last initialised,
  // so that switching goal resets the defaults.
  _initGoal: null,

  setGoal(goal) {
    if (this.goal !== goal) {
      this.goal = goal;
      this._initGoal = null;      // force re-init when entering step 3
      this.selectedExercises = {};
      this.customSchemes = {};
    }
  },

  setDays(days) {
    this.days = days;
  },

  // Pre-select all exercises whose recommended[] includes the current goal.
  // Runs only once per goal; subsequent calls are no-ops unless goal changed.
  initSelections() {
    if (this._initGoal === this.goal) return;
    this.selectedExercises = {};
    this.customSchemes = {};
    for (const [groupId, group] of Object.entries(MUSCLE_GROUPS)) {
      this.selectedExercises[groupId] = new Set(
        group.exercises
          .filter(ex => ex.recommended.includes(this.goal))
          .map(ex => ex.id)
      );
    }
    this._initGoal = this.goal;
  },

  isSelected(muscleId, exerciseId) {
    return this.selectedExercises[muscleId]?.has(exerciseId) ?? false;
  },

  toggle(muscleId, exerciseId) {
    if (!this.selectedExercises[muscleId]) {
      this.selectedExercises[muscleId] = new Set();
    }
    const s = this.selectedExercises[muscleId];
    if (s.has(exerciseId)) {
      s.delete(exerciseId);
      delete this.customSchemes[`${muscleId}:${exerciseId}`];
    } else {
      s.add(exerciseId);
    }
  },

  countSelected(muscleId) {
    return this.selectedExercises[muscleId]?.size ?? 0;
  },

  // ── Custom scheme methods ─────────────────────────────────────────────────────

  getScheme(muscleId, exId) {
    return this.customSchemes[`${muscleId}:${exId}`] ?? null;
  },

  setScheme(muscleId, exId, scheme) {
    this.customSchemes[`${muscleId}:${exId}`] = { ...scheme };
  },

  resetScheme(muscleId, exId) {
    delete this.customSchemes[`${muscleId}:${exId}`];
  },

  clearCustomSchemes() {
    this.customSchemes = {};
  },

  // ── Load state from a saved plan (for plan editing) ───────────────────────────
  loadFromPlan(plan) {
    this.goal              = plan.goal;
    this.days              = plan.days;
    this._initGoal         = null; // so planner re-inits properly if user returns to step 3
    this.customSchemes     = {};
    this.selectedExercises = {};

    for (const day of plan.plan) {
      for (const section of day.sections) {
        // Use stored muscleId (new plans), fall back to label lookup (old plans)
        const muscleId = section.muscleId ?? this._labelToMuscleId(section.muscleLabel);
        if (!muscleId) continue;

        if (!this.selectedExercises[muscleId]) {
          this.selectedExercises[muscleId] = new Set();
        }

        for (const ex of section.exercises) {
          this.selectedExercises[muscleId].add(ex.id);

          // Detect custom scheme: compare stored sets[goal] vs data.js defaults
          const defEx = MUSCLE_GROUPS[muscleId]?.exercises.find(e => e.id === ex.id);
          if (defEx && ex.sets?.[plan.goal]) {
            const def    = defEx.sets[plan.goal];
            const actual = ex.sets[plan.goal];
            if (
              String(actual.series) !== String(def.series) ||
              actual.reps !== def.reps ||
              actual.rest !== def.rest
            ) {
              this.customSchemes[`${muscleId}:${ex.id}`] = {
                series: actual.series,
                reps:   actual.reps,
                rest:   actual.rest,
              };
            }
          }
        }
      }
    }
  },

  _labelToMuscleId(label) {
    for (const [id, group] of Object.entries(MUSCLE_GROUPS)) {
      if (group.label === label) return id;
    }
    return null;
  },
};
