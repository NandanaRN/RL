import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

import type { PoseLandmarkerResult } from "@mediapipe/tasks-vision";

export default class PoseDetector {
  private poseLandmarker: PoseLandmarker | null = null;

  async initialize() {
    console.log("RUNR: Loading MediaPipe...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    console.log("RUNR: MediaPipe WASM loaded.");

    this.poseLandmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

            delegate: "CPU",
          },

          runningMode: "VIDEO",
          numPoses: 1,

          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
      );

    console.log("RUNR: Pose Landmarker ready.");
  }

  detect(
    video: HTMLVideoElement,
    timestamp: number
  ): PoseLandmarkerResult | null {
    if (!this.poseLandmarker) {
      return null;
    }

    return this.poseLandmarker.detectForVideo(
      video,
      timestamp
    );
  }
}