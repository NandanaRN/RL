import type { ExerciseName, ExerciseDefinition, ExerciseFamily } from "../pose/MovementAnalyzer";
import { EXERCISES } from "../pose/MovementAnalyzer";

export type WorkoutZone =
  | "warmup"
  | "cardio"
  | "strength"
  | "core"
  | "fullbody"
  | "recovery";

export interface ZoneConfig {
  name: string;
  displayName: string;
  description: string;
  color: string;
  icon: string;
  durationRange: [number, number];
  primaryFamilies: ExerciseFamily[];
  intensity: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  exercises: ExerciseName[];
  transitionZones: WorkoutZone[];
}

export const WORKOUT_ZONES: Record<WorkoutZone, ZoneConfig> = {
  warmup: {
    name: "warmup",
    displayName: "WARM UP",
    description: "Gentle movements to prepare your body",
    color: "#38bdf8",
    icon: "🌅",
    durationRange: [60, 90],
    primaryFamilies: ["ARM_WORK", "SIDE_MOVEMENT", "LEG_WORK"],
    intensity: "LOW",
    exercises: [
      "ARM_CIRCLES",
      "REACH_LEFT",
      "REACH_RIGHT",
      "REACH_OVERHEAD",
      "MARCH",
      "STEP_LEFT",
      "STEP_RIGHT",
      "LEAN_LEFT",
      "LEAN_RIGHT",
      "TORSO_TWIST_LEFT",
      "TORSO_TWIST_RIGHT",
    ],
    transitionZones: ["cardio"],
  },
  cardio: {
    name: "cardio",
    displayName: "CARDIO",
    description: "High-intensity movements to elevate heart rate",
    color: "#f97316",
    icon: "🔥",
    durationRange: [90, 180],
    primaryFamilies: ["LEG_WORK", "ARM_WORK", "SIDE_MOVEMENT"],
    intensity: "HIGH",
    exercises: [
      "HIGH_KNEES",
      "JUMP",
      "KNEE_RAISE_LEFT",
      "KNEE_RAISE_RIGHT",
      "PUNCH_LEFT",
      "PUNCH_RIGHT",
      "DOUBLE_PUNCH",
      "STEP_LEFT",
      "STEP_RIGHT",
      "MARCH",
    ],
    transitionZones: ["strength", "fullbody", "recovery"],
  },
  strength: {
    name: "strength",
    displayName: "STRENGTH",
    description: "Resistance-based movements for muscle building",
    color: "#a855f7",
    icon: "💪",
    durationRange: [60, 120],
    primaryFamilies: ["LEG_WORK", "CORE", "ARM_WORK"],
    intensity: "HIGH",
    exercises: [
      "SQUAT",
      "LUNGE_LEFT",
      "LUNGE_RIGHT",
      "KNEE_RAISE_LEFT",
      "KNEE_RAISE_RIGHT",
      "PUNCH_LEFT",
      "PUNCH_RIGHT",
      "REACH_OVERHEAD",
    ],
    transitionZones: ["cardio", "core", "fullbody", "recovery"],
  },
  core: {
    name: "core",
    displayName: "CORE",
    description: "Torso-focused movements for stability",
    color: "#22d3ee",
    icon: "🎯",
    durationRange: [45, 90],
    primaryFamilies: ["CORE", "SIDE_MOVEMENT"],
    intensity: "MEDIUM",
    exercises: [
      "TORSO_TWIST_LEFT",
      "TORSO_TWIST_RIGHT",
      "LEAN_LEFT",
      "LEAN_RIGHT",
      "STEP_LEFT",
      "STEP_RIGHT",
      "MARCH",
    ],
    transitionZones: ["strength", "recovery", "warmup"],
  },
  fullbody: {
    name: "fullbody",
    displayName: "FULL BODY",
    description: "Compound movements engaging everything",
    color: "#fbbf24",
    icon: "⭐",
    durationRange: [60, 120],
    primaryFamilies: ["FULL_BODY", "LEG_WORK", "ARM_WORK", "CORE"],
    intensity: "VERY_HIGH",
    exercises: [
      "STAR_BURST",
      "POWER_MOVE",
      "SQUAT",
      "HIGH_KNEES",
      "DOUBLE_PUNCH",
      "REACH_OVERHEAD",
      "JUMP",
    ],
    transitionZones: ["recovery", "cardio"],
  },
  recovery: {
    name: "recovery",
    displayName: "RECOVERY",
    description: "Low-intensity movements to cool down",
    color: "#4ade80",
    icon: "🌿",
    durationRange: [45, 90],
    primaryFamilies: ["ARM_WORK", "SIDE_MOVEMENT", "LEG_WORK"],
    intensity: "LOW",
    exercises: [
      "ARM_CIRCLES",
      "REACH_LEFT",
      "REACH_RIGHT",
      "REACH_OVERHEAD",
      "MARCH",
      "STEP_LEFT",
      "STEP_RIGHT",
      "LEAN_LEFT",
      "LEAN_RIGHT",
      "TORSO_TWIST_LEFT",
      "TORSO_TWIST_RIGHT",
    ],
    transitionZones: ["warmup"],
  },
};

export type WorkoutPhase = "calibration" | "running" | "transition" | "complete";

export interface WorkoutSequence {
  zone: WorkoutZone;
  exercises: ExerciseName[];
  targetDuration: number;
  startTime: number;
}

export class ExerciseSystem {
  private currentZone: WorkoutZone = "warmup";
  private currentSequence: WorkoutSequence | null = null;
  private zoneHistory: WorkoutZone[] = [];
  private totalSessionTime = 0;
  private zoneStartTime = 0;
  private onZoneChange: ((zone: WorkoutZone) => void) | null = null;
  private onExercisePrompt: ((exercise: ExerciseDefinition) => void) | null = null;
  private onSequenceComplete: (() => void) | null = null;
  private phase: WorkoutPhase = "calibration";
  private calibrationComplete = false;
  private currentExerciseIndex = 0;
  private exerciseStartTime = 0;
  private holdExercises: Set<ExerciseName> = new Set(["SQUAT", "REACH_OVERHEAD", "STAR_BURST"]);

  setCallbacks(
    onZoneChange: (zone: WorkoutZone) => void,
    onExercisePrompt: (exercise: ExerciseDefinition) => void,
    onSequenceComplete: () => void
  ) {
    this.onZoneChange = onZoneChange;
    this.onExercisePrompt = onExercisePrompt;
    this.onSequenceComplete = onSequenceComplete;
  }

  setCalibrationComplete() {
    this.calibrationComplete = true;
    this.phase = "running";
    this.startZone("warmup");
  }

  getPhase(): WorkoutPhase {
    return this.phase;
  }

  isCalibrated(): boolean {
    return this.calibrationComplete;
  }

  getCurrentZone(): WorkoutZone {
    return this.currentZone;
  }

  getZoneConfig(zone: WorkoutZone): ZoneConfig {
    return WORKOUT_ZONES[zone];
  }

  getCurrentZoneConfig(): ZoneConfig {
    return WORKOUT_ZONES[this.currentZone];
  }

  getZoneProgress(): { elapsed: number; target: number; progress: number } {
    if (!this.currentSequence) return { elapsed: 0, target: 0, progress: 0 };
    const elapsed = (Date.now() - this.zoneStartTime) / 1000;
    const target = this.currentSequence.targetDuration;
    return {
      elapsed,
      target,
      progress: Math.min(1, elapsed / target),
    };
  }

  getCurrentExercise(): ExerciseDefinition | null {
    if (!this.currentSequence || this.currentExerciseIndex >= this.currentSequence.exercises.length) {
      return null;
    }
    const name = this.currentSequence.exercises[this.currentExerciseIndex];
    return EXERCISES.find((ex: ExerciseDefinition) => ex.name === name) ?? null;
  }

  getNextExercise(): ExerciseDefinition | null {
    if (!this.currentSequence || this.currentExerciseIndex + 1 >= this.currentSequence.exercises.length) {
      return null;
    }
    const name = this.currentSequence.exercises[this.currentExerciseIndex + 1];
    return EXERCISES.find((ex: ExerciseDefinition) => ex.name === name) ?? null;
  }

  getSequenceProgress(): { current: number; total: number; completed: boolean } {
    if (!this.currentSequence) return { current: 0, total: 0, completed: true };
    return {
      current: this.currentExerciseIndex,
      total: this.currentSequence.exercises.length,
      completed: this.currentExerciseIndex >= this.currentSequence.exercises.length,
    };
  }

  private generateSequence(zone: WorkoutZone): ExerciseName[] {
    const config = WORKOUT_ZONES[zone];
    const exercises = [...config.exercises];
    const sequenceLength = Math.floor(config.durationRange[0] / 8) + Math.floor(Math.random() * 4);
    const result: ExerciseName[] = [];

    for (let i = 0; i < sequenceLength; i++) {
      const family = config.primaryFamilies[Math.floor(Math.random() * config.primaryFamilies.length)];
      const familyExercises = exercises.filter((exName: ExerciseName) => {
        const def = EXERCISES.find((exDef: ExerciseDefinition) => exDef.name === exName);
        return def?.family === family;
      });
      const pool = familyExercises.length > 0 ? familyExercises : exercises;
      result.push(pool[Math.floor(Math.random() * pool.length)] as ExerciseName);
    }

    return result;
  }

  startZone(zone: WorkoutZone) {
    this.currentZone = zone;
    this.zoneHistory.push(zone);
    this.zoneStartTime = Date.now();

    const config = WORKOUT_ZONES[zone];
    const duration = config.durationRange[0] + Math.random() * (config.durationRange[1] - config.durationRange[0]);
    const exercises = this.generateSequence(zone);

    this.currentSequence = {
      zone,
      exercises,
      targetDuration: duration,
      startTime: Date.now(),
    };
    this.currentExerciseIndex = 0;
    this.exerciseStartTime = Date.now();

    this.phase = "running";
    this.onZoneChange?.(zone);
    this.promptCurrentExercise();
  }

  private promptCurrentExercise() {
    const exercise = this.getCurrentExercise();
    if (exercise) {
      this.exerciseStartTime = Date.now();
      this.onExercisePrompt?.(exercise);
    }
  }

  advanceExercise() {
    this.currentExerciseIndex++;
    if (!this.currentSequence || this.currentExerciseIndex >= this.currentSequence.exercises.length) {
      this.onSequenceComplete?.();
      this.transitionZone();
    } else {
      this.promptCurrentExercise();
    }
  }

  private transitionZone() {
    this.phase = "transition";
    const config = WORKOUT_ZONES[this.currentZone];
    const nextZone = config.transitionZones[Math.floor(Math.random() * config.transitionZones.length)];

    setTimeout(() => {
      this.startZone(nextZone);
    }, 3000);
  }

  update(deltaTime: number) {
    this.totalSessionTime += deltaTime;

    if (this.phase !== "running" || !this.currentSequence) return;

    const exercise = this.getCurrentExercise();
    if (!exercise) return;

    const exerciseElapsed = (Date.now() - this.exerciseStartTime) / 1000;
    const maxHoldTime = this.holdExercises.has(exercise.name) ? 8 : 5;

    if (exerciseElapsed > maxHoldTime) {
      this.advanceExercise();
    }
  }

  getSessionStats(): {
    totalTime: number;
    currentZone: WorkoutZone;
    zoneProgress: number;
    zonesCompleted: WorkoutZone[];
    exercisesCompleted: number;
  } {
    const progress = this.getZoneProgress();
    return {
      totalTime: Math.floor(this.totalSessionTime / 1000),
      currentZone: this.currentZone,
      zoneProgress: progress.progress,
      zonesCompleted: [...new Set(this.zoneHistory)].filter((z) => z !== this.currentZone),
      exercisesCompleted: this.currentExerciseIndex,
    };
  }

  getIntensityFromZone(): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
    return WORKOUT_ZONES[this.currentZone].intensity;
  }

  getDifficultyFromZone(): number {
    const intensities = { LOW: 1, MEDIUM: 3, HIGH: 5, VERY_HIGH: 7 };
    return intensities[WORKOUT_ZONES[this.currentZone].intensity];
  }
}

export function getExerciseByName(name: ExerciseName): ExerciseDefinition | undefined {
  return EXERCISES.find((ex: ExerciseDefinition) => ex.name === name);
}