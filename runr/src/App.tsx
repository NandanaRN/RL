import { useCallback, useEffect, useRef, useState } from "react";

import Phaser from "phaser";
import RunnerGame from "./game/RunnerGame";
import Camera from "./components/Camera";
import { getRequiredLandmarks } from "./pose/PoseAnalyzer";

import "./index.css";

function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);

  const [gamePhase, setGamePhase] = useState<"ready" | "running" | "gameover">("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [difficulty, setDifficulty] = useState(0);
  const [detectedAction, setDetectedAction] = useState("NONE");
  const [accuracy, setAccuracy] = useState(0);
  const lastActionTime = useRef(0);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 1100,
      height: 650,
      parent: gameRef.current,
      backgroundColor: "#050a14",
      scene: [RunnerGame],
    });

    gameInstance.current = game;

    return () => {
      game.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const game = gameInstance.current;
      if (!game) return;
      const scene = game.scene.getScene("RunnerGame") as RunnerGame;
      if (!scene) return;
      setGamePhase(scene.getPhase());
      setScore(scene.getScore());
      setLives(scene.getLives());
      setDifficulty(scene.getDifficulty());
      setAccuracy(scene.getAccuracy());
    }, 100);
    return () => clearInterval(id);
  }, []);

  const lastActionState = useRef<string>("standing");

  const handleMovement = useCallback((landmarks: import("@mediapipe/tasks-vision").NormalizedLandmark[]) => {
    const game = gameInstance.current;
    if (!game) return;
    const scene = game.scene.getScene("RunnerGame") as RunnerGame;
    if (!scene) return;

    scene.receivePose(landmarks);

    const body = getRequiredLandmarks(landmarks);
    if (!body) return;

    const now = Date.now();
    if (now - lastActionTime.current < 400) return;

    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const hipY = (leftHip.y + rightHip.y) / 2;
    const wristY = Math.min(leftWrist.y, rightWrist.y);
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const hipCenterX = (leftHip.x + rightHip.x) / 2;
    const lean = (shoulderCenterX - hipCenterX) * 100;

    const armsUp = wristY < shoulderY - 0.08;
    const crouching = hipY > shoulderY + 0.10;
    const leanLeft = lean < -2.5;
    const leanRight = lean > 2.5;

    let action: string | null = null;
    let currentState = "standing";

    if (armsUp) {
      currentState = "jump";
      if (lastActionState.current !== "jump") action = "jump";
    } else if (crouching) {
      currentState = "duck";
      if (lastActionState.current !== "duck") action = "duck";
    } else if (leanLeft) {
      currentState = "left";
      if (lastActionState.current !== "left") action = "left";
    } else if (leanRight) {
      currentState = "right";
      if (lastActionState.current !== "right") action = "right";
    }

    lastActionState.current = currentState;

    if (action) {
      lastActionTime.current = now;
      setDetectedAction(action.toUpperCase());
      scene.receiveAction(action as "jump" | "duck" | "left" | "right");
      setTimeout(() => setDetectedAction("NONE"), 500);
    }
  }, []);

  return (
    <main className="runr-app">
      <header className="runr-header">
        <div>
          <div className="runr-logo">RUNR</div>
          <div className="runr-tagline">BODY CONTROLLED RUNNER</div>
        </div>
        <div className="live-status online">
          <span className="live-dot" style={{
            background: gamePhase === "running" ? "#4ade80" : gamePhase === "gameover" ? "#ff4444" : "#fbbf24",
            boxShadow: `0 0 12px ${gamePhase === "running" ? "#4ade80" : gamePhase === "gameover" ? "#ff4444" : "#fbbf24"}`,
          }} />
          {gamePhase === "running" ? "PLAYING" : gamePhase === "gameover" ? "GAME OVER" : "READY"}
        </div>
      </header>

      <section className="play-area">
        <div className="game-shell">
          <div className="game-header">
            <div>
              <span>RUNR ARENA</span>
              <small>BODY CONTROLLED</small>
            </div>
            <div className="level" style={{ borderColor: "#22d3ee", color: "#22d3ee" }}>
              AI DIFF: {Math.round(difficulty * 100)}%
            </div>
          </div>

          <div ref={gameRef} className="game-container" />
        </div>

        <aside className="camera-panel">
          <div className="camera-heading">
            <div>
              <span className="eyebrow">MOTION INPUT</span>
              <h3>BODY TRACKING</h3>
            </div>
            <span className="tracking">● TRACKING</span>
          </div>

          <Camera onMovement={handleMovement} />

          <div className="cam-readout">
            <div className="cam-readout-move">
              <span>DETECTED ACTION</span>
              <strong style={{ color: detectedAction !== "NONE" ? "#4ade80" : "#64748b" }}>
                {detectedAction}
              </strong>
            </div>

            <div className="cam-readout-accuracy">
              <span>ACCURACY</span>
              <strong style={{ color: accuracy >= 0.7 ? "#4ade80" : accuracy >= 0.4 ? "#fbbf24" : "#ff7373" }}>
                {Math.round(accuracy * 100)}%
              </strong>
            </div>

            <div className="cam-readout-zone">
              <span>STATUS</span>
              <strong style={{ color: gamePhase === "running" ? "#4ade80" : "#fbbf24" }}>
                {gamePhase === "running" ? "RUNNING" : gamePhase === "gameover" ? "OVER" : "WAITING"}
              </strong>
            </div>
          </div>

          <div className="zone-progress">
            <div className="zone-progress-bar">
              <div style={{ width: `${difficulty * 100}%`, background: "linear-gradient(90deg, #4ade80, #fbbf24, #ff4444)" }} />
            </div>
            <div className="zone-progress-labels">
              <span>EASY</span>
              <span>HARD</span>
            </div>
          </div>

          <div className="next-exercise">
            <span>LIVES</span>
            <strong style={{ color: "#ff4444", fontSize: "20px" }}>
              {"♥".repeat(Math.max(0, lives))}{"♡".repeat(Math.max(0, 3 - lives))}
            </strong>
          </div>
        </aside>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>SCORE</span>
          <strong>{score.toLocaleString()}</strong>
        </div>

        <div className="stat-card">
          <span>LIVES</span>
          <strong style={{ color: "#ff4444" }}>
            {"♥".repeat(Math.max(0, lives))}{"♡".repeat(Math.max(0, 3 - lives))}
          </strong>
        </div>

        <div className="stat-card">
          <span>AI DIFFICULTY</span>
          <strong style={{ color: "#a855f7" }}>
            {Math.round(difficulty * 100)}%
          </strong>
        </div>

        <div className="stat-card">
          <span>ACCURACY</span>
          <strong style={{ color: accuracy >= 0.7 ? "#4ade80" : accuracy >= 0.4 ? "#fbbf24" : "#64748b" }}>
            {Math.round(accuracy * 100)}%
          </strong>
        </div>

        <div className="stat-card">
          <span>LAST MOVE</span>
          <strong style={{ color: detectedAction !== "NONE" ? "#22d3ee" : "#64748b" }}>
            {detectedAction}
          </strong>
        </div>

        <div className="stat-card">
          <span>PHASE</span>
          <strong style={{ color: gamePhase === "running" ? "#4ade80" : gamePhase === "gameover" ? "#ff4444" : "#fbbf24" }}>
            {gamePhase.toUpperCase()}
          </strong>
        </div>
      </section>
    </main>
  );
}

export default App;
