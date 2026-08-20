import type { BodyLandmarks, BodyAngles, ExerciseMetrics, NormalizedLandmark } from "./PoseAnalyzer";
import { calculateBodyAngles, getRequiredLandmarks } from "./PoseAnalyzer";

export type ExerciseFamily =
  | "SIDE_MOVEMENT"
  | "LEG_WORK"
  | "ARM_WORK"
  | "CORE"
  | "FULL_BODY";

export type ExerciseName =
  | "STEP_LEFT"
  | "STEP_RIGHT"
  | "KNEE_RAISE_LEFT"
  | "KNEE_RAISE_RIGHT"
  | "HIGH_KNEES"
  | "SQUAT"
  | "JUMP"
  | "LUNGE_LEFT"
  | "LUNGE_RIGHT"
  | "REACH_LEFT"
  | "REACH_RIGHT"
  | "REACH_OVERHEAD"
  | "PUNCH_LEFT"
  | "PUNCH_RIGHT"
  | "DOUBLE_PUNCH"
  | "TORSO_TWIST_LEFT"
  | "TORSO_TWIST_RIGHT"
  | "LEAN_LEFT"
  | "LEAN_RIGHT"
  | "STAR_BURST"
  | "POWER_MOVE"
  | "MARCH"
  | "ARM_CIRCLES";

export interface ExerciseDefinition {
  name: ExerciseName;
  family: ExerciseFamily;
  displayName: string;
  prompt: string;
  icon: string;
  targetJoints: string[];
  detection: (angles: BodyAngles, prevAngles: BodyAngles | null, landmarks: BodyLandmarks) => ExerciseMetrics;
  difficulty: number;
  caloriesPerRep: number;
  zoneAffinity: string[];
}

export interface DetectedExercise {
  name: ExerciseName;
  family: ExerciseFamily;
  metrics: ExerciseMetrics;
  timestamp: number;
}

const EXERCISES: ExerciseDefinition[] = [
  {
    name: "STEP_LEFT",
    family: "SIDE_MOVEMENT",
    displayName: "Step Left",
    prompt: "Step to your LEFT",
    icon: "⬅️",
    targetJoints: ["left_hip", "left_knee"],
    difficulty: 1,
    caloriesPerRep: 0.5,
    zoneAffinity: ["warmup", "cardio", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leanDelta = angles.torso_lean - prevAngles.torso_lean;
      const isLeft = leanDelta < -3;
      return {
        accuracy: isLeft ? Math.min(100, Math.abs(leanDelta) * 10) : 0,
        range_of_motion: Math.abs(leanDelta),
        speed: Math.abs(leanDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "STEP_RIGHT",
    family: "SIDE_MOVEMENT",
    displayName: "Step Right",
    prompt: "Step to your RIGHT",
    icon: "➡️",
    targetJoints: ["right_hip", "right_knee"],
    difficulty: 1,
    caloriesPerRep: 0.5,
    zoneAffinity: ["warmup", "cardio", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leanDelta = angles.torso_lean - prevAngles.torso_lean;
      const isRight = leanDelta > 3;
      return {
        accuracy: isRight ? Math.min(100, Math.abs(leanDelta) * 10) : 0,
        range_of_motion: Math.abs(leanDelta),
        speed: Math.abs(leanDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "KNEE_RAISE_LEFT",
    family: "LEG_WORK",
    displayName: "Left Knee Raise",
    prompt: "Raise your LEFT knee",
    icon: "🦵",
    targetJoints: ["left_hip", "left_knee"],
    difficulty: 2,
    caloriesPerRep: 1.2,
    zoneAffinity: ["warmup", "cardio", "strength"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const kneeDelta = prevAngles.left_knee - angles.left_knee;
      const hipDelta = prevAngles.left_hip - angles.left_hip;
      const raised = kneeDelta > 25 && hipDelta > 10;
      return {
        accuracy: raised ? Math.min(100, kneeDelta * 2) : 0,
        range_of_motion: Math.max(0, kneeDelta),
        speed: Math.max(0, kneeDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "KNEE_RAISE_RIGHT",
    family: "LEG_WORK",
    displayName: "Right Knee Raise",
    prompt: "Raise your RIGHT knee",
    icon: "🦵",
    targetJoints: ["right_hip", "right_knee"],
    difficulty: 2,
    caloriesPerRep: 1.2,
    zoneAffinity: ["warmup", "cardio", "strength"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const kneeDelta = prevAngles.right_knee - angles.right_knee;
      const hipDelta = prevAngles.right_hip - angles.right_hip;
      const raised = kneeDelta > 25 && hipDelta > 10;
      return {
        accuracy: raised ? Math.min(100, kneeDelta * 2) : 0,
        range_of_motion: Math.max(0, kneeDelta),
        speed: Math.max(0, kneeDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "HIGH_KNEES",
    family: "LEG_WORK",
    displayName: "High Knees",
    prompt: "Run in place - HIGH KNEES!",
    icon: "🏃",
    targetJoints: ["left_hip", "right_hip", "left_knee", "right_knee"],
    difficulty: 3,
    caloriesPerRep: 2.0,
    zoneAffinity: ["cardio"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leftUp = prevAngles.left_knee - angles.left_knee > 30;
      const rightUp = prevAngles.right_knee - angles.right_knee > 30;
      const alternating = leftUp !== rightUp;
      const avgKneeDelta = ((prevAngles.left_knee - angles.left_knee) + (prevAngles.right_knee - angles.right_knee)) / 2;
      return {
        accuracy: alternating && avgKneeDelta > 25 ? Math.min(100, avgKneeDelta * 2) : 0,
        range_of_motion: Math.max(0, avgKneeDelta),
        speed: Math.max(0, avgKneeDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "SQUAT",
    family: "LEG_WORK",
    displayName: "Squat",
    prompt: "SQUAT down and hold",
    icon: "🏋️",
    targetJoints: ["left_hip", "right_hip", "left_knee", "right_knee"],
    difficulty: 3,
    caloriesPerRep: 1.8,
    zoneAffinity: ["strength", "fullbody"],
    detection: (angles, _prevAngles, _landmarks) => {
      const kneeAvg = (angles.left_knee + angles.right_knee) / 2;
      const hipAvg = (angles.left_hip + angles.right_hip) / 2;
      const isSquat = kneeAvg < 120 && hipAvg > 80;
      const depth = Math.max(0, 160 - kneeAvg);
      return {
        accuracy: isSquat ? Math.min(100, depth * 1.5) : 0,
        range_of_motion: depth,
        speed: 0,
        hold_time: isSquat ? 1 : 0,
      };
    },
  },
  {
    name: "JUMP",
    family: "LEG_WORK",
    displayName: "Jump",
    prompt: "JUMP!",
    icon: "⬆️",
    targetJoints: ["left_knee", "right_knee", "left_ankle", "right_ankle"],
    difficulty: 3,
    caloriesPerRep: 2.5,
    zoneAffinity: ["cardio", "fullbody"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const hipYDelta = (prevAngles.left_hip + prevAngles.right_hip) / 2 - (_landmarks.left_hip.y + _landmarks.right_hip.y) / 2;
      const kneeExtension = (angles.left_knee + angles.right_knee) / 2 - (prevAngles.left_knee + prevAngles.right_knee) / 2;
      const jumped = hipYDelta > 0.03 && kneeExtension > 15;
      return {
        accuracy: jumped ? Math.min(100, hipYDelta * 500 + kneeExtension) : 0,
        range_of_motion: hipYDelta * 100,
        speed: hipYDelta * 100,
        hold_time: 0,
      };
    },
  },
  {
    name: "REACH_LEFT",
    family: "ARM_WORK",
    displayName: "Left Reach",
    prompt: "REACH LEFT arm out",
    icon: "👈",
    targetJoints: ["left_shoulder", "left_elbow"],
    difficulty: 1,
    caloriesPerRep: 0.4,
    zoneAffinity: ["warmup", "recovery", "cardio"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const shoulderDelta = angles.left_shoulder - prevAngles.left_shoulder;
      const elbowExtension = 180 - angles.left_elbow;
      const reached = shoulderDelta > 20 && elbowExtension > 150;
      return {
        accuracy: reached ? Math.min(100, shoulderDelta * 2 + (elbowExtension - 150)) : 0,
        range_of_motion: shoulderDelta,
        speed: shoulderDelta,
        hold_time: 0,
      };
    },
  },
  {
    name: "REACH_RIGHT",
    family: "ARM_WORK",
    displayName: "Right Reach",
    prompt: "REACH RIGHT arm out",
    icon: "👉",
    targetJoints: ["right_shoulder", "right_elbow"],
    difficulty: 1,
    caloriesPerRep: 0.4,
    zoneAffinity: ["warmup", "recovery", "cardio"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const shoulderDelta = angles.right_shoulder - prevAngles.right_shoulder;
      const elbowExtension = 180 - angles.right_elbow;
      const reached = shoulderDelta > 20 && elbowExtension > 150;
      return {
        accuracy: reached ? Math.min(100, shoulderDelta * 2 + (elbowExtension - 150)) : 0,
        range_of_motion: shoulderDelta,
        speed: shoulderDelta,
        hold_time: 0,
      };
    },
  },
  {
    name: "REACH_OVERHEAD",
    family: "ARM_WORK",
    displayName: "Overhead Reach",
    prompt: "BOTH ARMS UP!",
    icon: "🙌",
    targetJoints: ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow"],
    difficulty: 2,
    caloriesPerRep: 0.8,
    zoneAffinity: ["warmup", "fullbody", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leftUp = angles.left_shoulder > 140 && (180 - angles.left_elbow) > 160;
      const rightUp = angles.right_shoulder > 140 && (180 - angles.right_elbow) > 160;
      const bothUp = leftUp && rightUp;
      return {
        accuracy: bothUp ? Math.min(100, (angles.left_shoulder + angles.right_shoulder - 280) / 2 * 3) : 0,
        range_of_motion: (angles.left_shoulder + angles.right_shoulder) / 2,
        speed: 0,
        hold_time: bothUp ? 1 : 0,
      };
    },
  },
  {
    name: "PUNCH_LEFT",
    family: "ARM_WORK",
    displayName: "Left Punch",
    prompt: "PUNCH with LEFT!",
    icon: "👊",
    targetJoints: ["left_shoulder", "left_elbow"],
    difficulty: 2,
    caloriesPerRep: 0.6,
    zoneAffinity: ["cardio", "fullbody"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const elbowDelta = prevAngles.left_elbow - angles.left_elbow;
      const shoulderDelta = angles.left_shoulder - prevAngles.left_shoulder;
      const punched = elbowDelta > 40 && shoulderDelta > 10;
      return {
        accuracy: punched ? Math.min(100, elbowDelta * 1.5) : 0,
        range_of_motion: elbowDelta,
        speed: elbowDelta * 2,
        hold_time: 0,
      };
    },
  },
  {
    name: "PUNCH_RIGHT",
    family: "ARM_WORK",
    displayName: "Right Punch",
    prompt: "PUNCH with RIGHT!",
    icon: "👊",
    targetJoints: ["right_shoulder", "right_elbow"],
    difficulty: 2,
    caloriesPerRep: 0.6,
    zoneAffinity: ["cardio", "fullbody"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const elbowDelta = prevAngles.right_elbow - angles.right_elbow;
      const shoulderDelta = angles.right_shoulder - prevAngles.right_shoulder;
      const punched = elbowDelta > 40 && shoulderDelta > 10;
      return {
        accuracy: punched ? Math.min(100, elbowDelta * 1.5) : 0,
        range_of_motion: elbowDelta,
        speed: elbowDelta * 2,
        hold_time: 0,
      };
    },
  },
  {
    name: "DOUBLE_PUNCH",
    family: "ARM_WORK",
    displayName: "Double Punch",
    prompt: "DOUBLE PUNCH!",
    icon: "👊👊",
    targetJoints: ["left_shoulder", "right_shoulder", "left_elbow", "right_elbow"],
    difficulty: 3,
    caloriesPerRep: 1.2,
    zoneAffinity: ["fullbody", "cardio"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leftElbowDelta = prevAngles.left_elbow - angles.left_elbow;
      const rightElbowDelta = prevAngles.right_elbow - angles.right_elbow;
      const bothPunched = leftElbowDelta > 40 && rightElbowDelta > 40;
      const avgDelta = (leftElbowDelta + rightElbowDelta) / 2;
      return {
        accuracy: bothPunched ? Math.min(100, avgDelta * 1.2) : 0,
        range_of_motion: avgDelta,
        speed: avgDelta * 1.5,
        hold_time: 0,
      };
    },
  },
  {
    name: "TORSO_TWIST_LEFT",
    family: "CORE",
    displayName: "Twist Left",
    prompt: "TWIST your torso LEFT",
    icon: "🔄",
    targetJoints: ["torso"],
    difficulty: 2,
    caloriesPerRep: 0.5,
    zoneAffinity: ["warmup", "core", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const twistDelta = angles.torso_twist - prevAngles.torso_twist;
      const twisted = twistDelta < -10;
      return {
        accuracy: twisted ? Math.min(100, Math.abs(twistDelta) * 5) : 0,
        range_of_motion: Math.abs(twistDelta),
        speed: Math.abs(twistDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "TORSO_TWIST_RIGHT",
    family: "CORE",
    displayName: "Twist Right",
    prompt: "TWIST your torso RIGHT",
    icon: "🔄",
    targetJoints: ["torso"],
    difficulty: 2,
    caloriesPerRep: 0.5,
    zoneAffinity: ["warmup", "core", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const twistDelta = angles.torso_twist - prevAngles.torso_twist;
      const twisted = twistDelta > 10;
      return {
        accuracy: twisted ? Math.min(100, Math.abs(twistDelta) * 5) : 0,
        range_of_motion: Math.abs(twistDelta),
        speed: Math.abs(twistDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "LEAN_LEFT",
    family: "CORE",
    displayName: "Lean Left",
    prompt: "LEAN your body LEFT",
    icon: "↙️",
    targetJoints: ["torso"],
    difficulty: 1,
    caloriesPerRep: 0.3,
    zoneAffinity: ["warmup", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leanDelta = angles.torso_lean - prevAngles.torso_lean;
      const leaned = leanDelta < -5;
      return {
        accuracy: leaned ? Math.min(100, Math.abs(leanDelta) * 8) : 0,
        range_of_motion: Math.abs(leanDelta),
        speed: Math.abs(leanDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "LEAN_RIGHT",
    family: "CORE",
    displayName: "Lean Right",
    prompt: "LEAN your body RIGHT",
    icon: "↘️",
    targetJoints: ["torso"],
    difficulty: 1,
    caloriesPerRep: 0.3,
    zoneAffinity: ["warmup", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leanDelta = angles.torso_lean - prevAngles.torso_lean;
      const leaned = leanDelta > 5;
      return {
        accuracy: leaned ? Math.min(100, Math.abs(leanDelta) * 8) : 0,
        range_of_motion: Math.abs(leanDelta),
        speed: Math.abs(leanDelta),
        hold_time: 0,
      };
    },
  },
  {
    name: "STAR_BURST",
    family: "FULL_BODY",
    displayName: "Star Burst",
    prompt: "STAR BURST - Arms wide, legs apart!",
    icon: "⭐",
    targetJoints: ["left_shoulder", "right_shoulder", "left_hip", "right_hip"],
    difficulty: 4,
    caloriesPerRep: 3.0,
    zoneAffinity: ["fullbody"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const armSpreadDelta = angles.arm_spread - prevAngles.arm_spread;
      const hipWidth = Math.abs(_landmarks.left_hip.x - _landmarks.right_hip.x);
      const spread = armSpreadDelta > 15 && hipWidth > 0.25;
      return {
        accuracy: spread ? Math.min(100, armSpreadDelta * 3 + hipWidth * 200) : 0,
        range_of_motion: armSpreadDelta,
        speed: armSpreadDelta,
        hold_time: spread ? 1 : 0,
      };
    },
  },
  {
    name: "POWER_MOVE",
    family: "FULL_BODY",
    displayName: "Power Move",
    prompt: "SQUAT → STAND → REACH UP!",
    icon: "🔥",
    targetJoints: ["full_body"],
    difficulty: 5,
    caloriesPerRep: 4.0,
    zoneAffinity: ["fullbody"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const wasSquat = (prevAngles.left_knee + prevAngles.right_knee) / 2 < 120;
      const nowStand = (angles.left_knee + angles.right_knee) / 2 > 160;
      const armsUp = angles.left_shoulder > 140 && angles.right_shoulder > 140;
      const powered = wasSquat && nowStand && armsUp;
      return {
        accuracy: powered ? 90 : 0,
        range_of_motion: powered ? 100 : 0,
        speed: powered ? 100 : 0,
        hold_time: 0,
      };
    },
  },
  {
    name: "MARCH",
    family: "LEG_WORK",
    displayName: "March",
    prompt: "MARCH in place",
    icon: "🚶",
    targetJoints: ["left_knee", "right_knee"],
    difficulty: 1,
    caloriesPerRep: 0.8,
    zoneAffinity: ["warmup", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leftUp = prevAngles.left_knee - angles.left_knee > 15;
      const rightUp = prevAngles.right_knee - angles.right_knee > 15;
      const alternating = leftUp !== rightUp;
      return {
        accuracy: alternating ? 80 : 0,
        range_of_motion: Math.max(prevAngles.left_knee - angles.left_knee, prevAngles.right_knee - angles.right_knee),
        speed: 0,
        hold_time: 0,
      };
    },
  },
  {
    name: "ARM_CIRCLES",
    family: "ARM_WORK",
    displayName: "Arm Circles",
    prompt: "ARM CIRCLES forward",
    icon: "🔄",
    targetJoints: ["left_shoulder", "right_shoulder"],
    difficulty: 1,
    caloriesPerRep: 0.3,
    zoneAffinity: ["warmup", "recovery"],
    detection: (angles, prevAngles, _landmarks) => {
      if (!prevAngles) return { accuracy: 0, range_of_motion: 0, speed: 0, hold_time: 0 };
      const leftCircle = Math.abs(angles.left_shoulder - prevAngles.left_shoulder) > 10;
      const rightCircle = Math.abs(angles.right_shoulder - prevAngles.right_shoulder) > 10;
      return {
        accuracy: leftCircle && rightCircle ? 75 : 0,
        range_of_motion: Math.max(
          Math.abs(angles.left_shoulder - prevAngles.left_shoulder),
          Math.abs(angles.right_shoulder - prevAngles.right_shoulder)
        ),
        speed: 0,
        hold_time: 0,
      };
    },
  },
];

export class MovementAnalyzer {
  private prevAngles: BodyAngles | null = null;
  private exerciseHistory: DetectedExercise[] = [];
  private currentSequence: ExerciseName[] = [];
  private sequenceIndex = 0;
  private lastDetectionTime = 0;
  private cooldownMs = 800;

  reset() {
    this.prevAngles = null;
    this.exerciseHistory = [];
    this.currentSequence = [];
    this.sequenceIndex = 0;
    this.lastDetectionTime = 0;
  }

  setSequence(exercises: ExerciseName[]) {
    this.currentSequence = exercises;
    this.sequenceIndex = 0;
  }

  getCurrentTarget(): ExerciseDefinition | null {
    if (this.sequenceIndex >= this.currentSequence.length) return null;
    return EXERCISES.find((e) => e.name === this.currentSequence[this.sequenceIndex]) ?? null;
  }

  getAllExercises(): ExerciseDefinition[] {
    return EXERCISES;
  }

  getExercisesByFamily(family: ExerciseFamily): ExerciseDefinition[] {
    return EXERCISES.filter((e) => e.family === family);
  }

  getExercisesByZone(zone: string): ExerciseDefinition[] {
    return EXERCISES.filter((e) => e.zoneAffinity.includes(zone));
  }

  analyze(landmarks: NormalizedLandmark[]): DetectedExercise | null {
    const body = getRequiredLandmarks(landmarks);
    if (!body) return null;

    const angles = calculateBodyAngles(body);
    const now = Date.now();

    if (now - this.lastDetectionTime < this.cooldownMs) {
      this.prevAngles = angles;
      return null;
    }

    let bestMatch: { exercise: ExerciseDefinition; metrics: ExerciseMetrics } | null = null;
    let bestScore = 0;

    const candidates = this.currentSequence.length > 0
      ? this.currentSequence.map((n) => EXERCISES.find((e) => e.name === n)!).filter(Boolean)
      : EXERCISES;

    for (const exercise of candidates) {
      const metrics = exercise.detection(angles, this.prevAngles, body);
      const score = metrics.accuracy * 0.6 + metrics.range_of_motion * 0.2 + metrics.speed * 0.2;
      if (score > bestScore && metrics.accuracy > 40) {
        bestScore = score;
        bestMatch = { exercise, metrics };
      }
    }

    this.prevAngles = angles;

    if (bestMatch && bestMatch.metrics.accuracy > 50) {
      this.lastDetectionTime = now;
      const detected: DetectedExercise = {
        name: bestMatch.exercise.name,
        family: bestMatch.exercise.family,
        metrics: bestMatch.metrics,
        timestamp: now,
      };
      this.exerciseHistory.push(detected);

      if (this.sequenceIndex < this.currentSequence.length &&
          this.currentSequence[this.sequenceIndex] === bestMatch.exercise.name) {
        this.sequenceIndex++;
      }

      return detected;
    }

    return null;
  }

  getHistory(): DetectedExercise[] {
    return this.exerciseHistory;
  }

  getSequenceProgress(): { current: number; total: number; completed: boolean } {
    return {
      current: this.sequenceIndex,
      total: this.currentSequence.length,
      completed: this.sequenceIndex >= this.currentSequence.length,
    };
  }
}

export { EXERCISES };