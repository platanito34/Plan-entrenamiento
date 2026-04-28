import { MUSCLE_GROUPS, SPLITS } from './data.js';

export const state = {
  goal: null,   // 'muscle' | 'fat' | 'strength'
  days: null,   // 2 | 3 | 4 | 5 | 6

  // { muscleGroupId: Set<exerciseId> }
  selectedExercises: {},

  // Custom scheme overrides — key: `${muscleId}:${exId}`, value: { series, reps, rest }
  customSchemes: {},

  // Tracks goal+days used when selections were last initialised.
  _initGoal: null,
  _initDays: null,

  setGoal(goal) {
    if (this.goal !== goal) {
      this.goal = goal;
      this._initGoal = null;
      this.selectedExercises = {};
      this.customSchemes = {};
    }
  },

  setDays(days) {
    if (this.days !== days) {
      this.days = days;
      this._initDays = null;      // force re-init when entering step 3
    }
  },

  // Pre-select exercises per muscle group based on how many groups share that session.
  // 1 group → 5 exercises, 2 → 4, 3 → 3, 4+ → 2.
  // Priority: recommended for current goal first, then fill in list order.
  // Runs only once per goal+days combination.
  initSelections() {
    if (this._initGoal === this.goal && this._initDays === this.days) return;
    this.selectedExercises = {};
    this.customSchemes = {};

    const split = SPLITS[this.days];
    const sessionSizeByMuscle = {};
    for (const day of split.days) {
      const size = day.muscles.length;
      for (const muscleId of day.muscles) {
        if (!(muscleId in sessionSizeByMuscle)) sessionSizeByMuscle[muscleId] = size;
      }
    }

    for (const [groupId, group] of Object.entries(MUSCLE_GROUPS)) {
      const sessionSize = sessionSizeByMuscle[groupId] ?? 1;
      const n = sessionSize >= 4 ? 2 : sessionSize === 3 ? 3 : sessionSize === 2 ? 4 : 5;
      const rec    = group.exercises.filter(ex =>  ex.recommended.includes(this.goal));
      const others = group.exercises.filter(ex => !ex.recommended.includes(this.goal));
      const pool   = [...rec, ...others];
      this.selectedExercises[groupId] = new Set(pool.slice(0, n).map(ex => ex.id));
    }

    this._initGoal = this.goal;
    this._initDays = this.days;
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
    this._initGoal         = null;
    this._initDays         = null;
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
