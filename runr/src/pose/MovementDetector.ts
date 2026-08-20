import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Movement =
  | "IDLE"
  | "LEFT"
  | "RIGHT"
  | "JUMP"
  | "SLIDE";

export default class MovementDetector {
  private previousHipY = 0.5;
  private previousTime = performance.now();

  detect(landmarks: NormalizedLandmark[]): Movement {
    if (!landmarks || landmarks.length < 33) {
      return "IDLE";
    }

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    const shoulderX =
      (leftShoulder.x + rightShoulder.x) / 2;

    const hipX =
      (leftHip.x + rightHip.x) / 2;

    const hipY =
      (leftHip.y + rightHip.y) / 2;

    const kneeY =
      (leftKnee.y + rightKnee.y) / 2;

    const now = performance.now();

    const verticalMovement =
      this.previousHipY - hipY;

    const timeDifference =
      now - this.previousTime;

    this.previousHipY = hipY;
    this.previousTime = now;

    // JUMP
    if (
      timeDifference < 400 &&
      verticalMovement > 0.025
    ) {
      return "JUMP";
    }

    // LEFT / RIGHT
    const lean =
      hipX - shoulderX;

    if (lean < -0.045) {
      return "LEFT";
    }

    if (lean > 0.045) {
      return "RIGHT";
    }

    // SLIDE / CROUCH
    const crouchAmount =
      kneeY - hipY;

    if (crouchAmount < 0.20) {
      return "SLIDE";
    }

    return "IDLE";
  }
}
