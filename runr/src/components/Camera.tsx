import { useEffect, useRef, useState, useCallback } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

interface CameraProps {
  onMovement: (landmarks: NormalizedLandmark[]) => void;
}

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
  [25, 27], [26, 28],
];

export default function Camera({ onMovement }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastLandmarks = useRef<NormalizedLandmark[] | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState("");
  const [detectedPose, setDetectedPose] = useState("NONE");

  const classifyPose = useCallback((lm: NormalizedLandmark[]): string => {
    if (!lm || lm.length < 29) return "NONE";
    const leftWrist = lm[15];
    const rightWrist = lm[16];
    const leftShoulder = lm[11];
    const rightShoulder = lm[12];
    const leftHip = lm[23];
    const rightHip = lm[24];
    const leftKnee = lm[25];
    const rightKnee = lm[26];

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const wristY = Math.min(leftWrist.y, rightWrist.y);
    const hipY = (leftHip.y + rightHip.y) / 2;

    if (wristY < shoulderY - 0.12) return "JUMP (arms up)";
    if (hipY > shoulderY + 0.18) return "DUCK (squat)";

    const lean = ((leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2) * 100;
    if (lean < -4) return "LEAN LEFT";
    if (lean > 4) return "LEAN RIGHT";

    const leftKneeUp = leftKnee.y < hipY - 0.08;
    const rightKneeUp = rightKnee.y < hipY - 0.08;
    if (leftKneeUp || rightKneeUp) return "KNEE UP";

    return "STANDING";
  }, []);

  const drawPose = useCallback((lm: NormalizedLandmark[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(34,211,238,0.4)";
    ctx.lineWidth = 2;
    for (const [a, b] of BONES) {
      if (!lm[a] || !lm[b]) continue;
      ctx.beginPath();
      ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
      ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
      ctx.stroke();
    }

    ctx.fillStyle = "#22d3ee";
    for (const point of lm) {
      if (!point) continue;
      ctx.beginPath();
      ctx.arc((1 - point.x) * w, point.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame = 0;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported by this browser.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });

        if (!videoRef.current) throw new Error("Camera video element not found.");

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        poseLandmarkerRef.current = poseLandmarker;
        setCameraReady(true);
        setError("");

        const detect = () => {
          if (!videoRef.current || !poseLandmarkerRef.current) return;

          try {
            const result = poseLandmarkerRef.current.detectForVideo(
              videoRef.current,
              performance.now()
            );

            if (result?.landmarks.length > 0) {
              const lm = result.landmarks[0];
              lastLandmarks.current = lm;
              onMovement(lm);
              drawPose(lm);
              setDetectedPose(classifyPose(lm));
            } else {
              setDetectedPose("NO BODY");
            }
          } catch (e) {
            console.error("Pose detection error:", e);
          }

          animationFrame = requestAnimationFrame(detect);
        };

        detect();
      } catch (err) {
        console.error("Camera/Pose Error:", err);
        setError(err instanceof Error ? err.message : "Failed to start body tracking");
      }
    }

    start();

    return () => {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onMovement, drawPose, classifyPose]);

  return (
    <div className="camera">
      <video ref={videoRef} className="camera-video" muted playsInline />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {!cameraReady && !error && (
        <div className="camera-status">INITIALIZING BODY TRACKING...</div>
      )}
      {error && <div className="camera-status error">{error}</div>}
      {cameraReady && !error && (
        <div className="camera-status ready">
          {detectedPose}
        </div>
      )}
    </div>
  );
}
