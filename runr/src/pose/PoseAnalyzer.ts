import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type { NormalizedLandmark };

export type LandmarkName =
  | "nose"
  | "left_eye_inner"
  | "left_eye"
  | "left_eye_outer"
  | "right_eye_inner"
  | "right_eye"
  | "right_eye_outer"
  | "left_ear"
  | "right_ear"
  | "mouth_left"
  | "mouth_right"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_pinky"
  | "right_pinky"
  | "left_index"
  | "right_index"
  | "left_thumb"
  | "right_thumb"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle"
  | "left_heel"
  | "right_heel"
  | "left_foot_index"
  | "right_foot_index";

export const LANDMARK_INDICES: Record<LandmarkName, number> = {
  nose: 0,
  left_eye_inner: 1,
  left_eye: 2,
  left_eye_outer: 3,
  right_eye_inner: 4,
  right_eye: 5,
  right_eye_outer: 6,
  left_ear: 7,
  right_ear: 8,
  mouth_left: 9,
  mouth_right: 10,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_pinky: 17,
  right_pinky: 18,
  left_index: 19,
  right_index: 20,
  left_thumb: 21,
  right_thumb: 22,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  left_heel: 29,
  right_heel: 30,
  left_foot_index: 31,
  right_foot_index: 32,
};

export interface BodyLandmarks {
  [name: string]: NormalizedLandmark | undefined;
  nose: NormalizedLandmark;
  left_shoulder: NormalizedLandmark;
  right_shoulder: NormalizedLandmark;
  left_elbow: NormalizedLandmark;
  right_elbow: NormalizedLandmark;
  left_wrist: NormalizedLandmark;
  right_wrist: NormalizedLandmark;
  left_hip: NormalizedLandmark;
  right_hip: NormalizedLandmark;
  left_knee: NormalizedLandmark;
  right_knee: NormalizedLandmark;
  left_ankle: NormalizedLandmark;
  right_ankle: NormalizedLandmark;
}

export interface BodyAngles {
  left_elbow: number;
  right_elbow: number;
  left_shoulder: number;
  right_shoulder: number;
  left_hip: number;
  right_hip: number;
  left_knee: number;
  right_knee: number;
  left_ankle: number;
  right_ankle: number;
  torso_lean: number;
  torso_twist: number;
  arm_spread: number;
}

export interface CalibrationData {
  visibility: Record<string, number>;
  ranges: {
    left_reach: number;
    right_reach: number;
    knee_height: number;
    jump_height: number;
    torso_rotation: number;
  };
  center: {
    hip_x: number;
    hip_y: number;
    shoulder_x: number;
    shoulder_y: number;
  };
}

export interface ExerciseMetrics {
  accuracy: number;
  range_of_motion: number;
  speed: number;
  hold_time: number;
}

export function getLandmark(landmarks: NormalizedLandmark[], name: LandmarkName): NormalizedLandmark | undefined {
  return landmarks[LANDMARK_INDICES[name]];
}

export function getRequiredLandmarks(landmarks: NormalizedLandmark[]): BodyLandmarks | null {
  const required: LandmarkName[] = [
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
  ];

  const result: Partial<BodyLandmarks> = {};
  for (const key of required) {
    const lm = getLandmark(landmarks, key);
    if (!lm || lm.visibility < 0.3) return null;
    result[key] = lm;
  }
  return result as BodyLandmarks;
}

export function calculateAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

export function calculateBodyAngles(landmarks: BodyLandmarks): BodyAngles {
  const left_shoulder_angle = calculateAngle(landmarks.left_elbow, landmarks.left_shoulder, landmarks.left_hip);
  const right_shoulder_angle = calculateAngle(landmarks.right_elbow, landmarks.right_shoulder, landmarks.right_hip);
  const left_elbow_angle = calculateAngle(landmarks.left_shoulder, landmarks.left_elbow, landmarks.left_wrist);
  const right_elbow_angle = calculateAngle(landmarks.right_shoulder, landmarks.right_elbow, landmarks.right_wrist);
  const left_hip_angle = calculateAngle(landmarks.left_shoulder, landmarks.left_hip, landmarks.left_knee);
  const right_hip_angle = calculateAngle(landmarks.right_shoulder, landmarks.right_hip, landmarks.right_knee);
  const left_knee_angle = calculateAngle(landmarks.left_hip, landmarks.left_knee, landmarks.left_ankle);
  const right_knee_angle = calculateAngle(landmarks.right_hip, landmarks.right_knee, landmarks.right_ankle);

  const shoulder_center_x = (landmarks.left_shoulder.x + landmarks.right_shoulder.x) / 2;
  const hip_center_x = (landmarks.left_hip.x + landmarks.right_hip.x) / 2;
  const torso_lean = (shoulder_center_x - hip_center_x) * 100;

  const shoulder_width = Math.abs(landmarks.left_shoulder.x - landmarks.right_shoulder.x);
  const hip_width = Math.abs(landmarks.left_hip.x - landmarks.right_hip.x);
  const torso_twist = ((shoulder_center_x - hip_center_x) / ((shoulder_width + hip_width) / 2)) * 100;

  const wrist_spread = Math.abs(landmarks.left_wrist.x - landmarks.right_wrist.x);
  const arm_spread = (wrist_spread / shoulder_width) * 100;

  return {
    left_shoulder: left_shoulder_angle,
    right_shoulder: right_shoulder_angle,
    left_elbow: left_elbow_angle,
    right_elbow: right_elbow_angle,
    left_hip: left_hip_angle,
    right_hip: right_hip_angle,
    left_knee: left_knee_angle,
    right_knee: right_knee_angle,
    left_ankle: 0,
    right_ankle: 0,
    torso_lean,
    torso_twist,
    arm_spread,
  };
}

export function calibrateBody(landmarks: NormalizedLandmark[]): CalibrationData | null {
  const body = getRequiredLandmarks(landmarks);
  if (!body) return null;

  const angles = calculateBodyAngles(body);

  const shoulder_center_x = (body.left_shoulder.x + body.right_shoulder.x) / 2;
  const shoulder_center_y = (body.left_shoulder.y + body.right_shoulder.y) / 2;
  const hip_center_x = (body.left_hip.x + body.right_hip.x) / 2;
  const hip_center_y = (body.left_hip.y + body.right_hip.y) / 2;

  const left_reach = Math.abs(body.left_wrist.x - shoulder_center_x) * 100;
  const right_reach = Math.abs(body.right_wrist.x - shoulder_center_x) * 100;
  const knee_height = 100 - body.left_knee.y * 100;
  const jump_height = 100 - body.left_ankle.y * 100;

  const visibility: Record<string, number> = {};
  for (const [name, idx] of Object.entries(LANDMARK_INDICES)) {
    visibility[name] = landmarks[idx]?.visibility ?? 0;
  }

  return {
    visibility,
    ranges: {
      left_reach,
      right_reach,
      knee_height,
      jump_height,
      torso_rotation: Math.abs(angles.torso_twist),
    },
    center: {
      hip_x: hip_center_x,
      hip_y: hip_center_y,
      shoulder_x: shoulder_center_x,
      shoulder_y: shoulder_center_y,
    },
  };
}