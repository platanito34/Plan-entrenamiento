import { MUSCLE_GROUPS } from './data.js';

export const state = {
  goal: null,   // 'muscle' | 'fat' | 'strength'
  days: null,   // 2 | 3 | 4 | 5 | 6

  // { muscleGroupId: Set<exerciseId> }
  selectedExercises: {},

  // Tracks which goal was used when selections were last initialised,
  // so that switching goal resets the defaults.
  _initGoal: null,

  setGoal(goal) {
    if (this.goal !== goal) {
      this.goal = goal;
      this._initGoal = null;      // force re-init when entering step 3
      this.selectedExercises = {};
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
    if (s.has(exerciseId)) s.delete(exerciseId);
    else s.add(exerciseId);
  },

  countSelected(muscleId) {
    return this.selectedExercises[muscleId]?.size ?? 0;
  },
};
