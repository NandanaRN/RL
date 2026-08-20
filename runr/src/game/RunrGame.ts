import Phaser from "phaser";
import type { ExerciseName, ExerciseDefinition } from "../pose/MovementAnalyzer";
import { getExerciseByName } from "./ExerciseSystem";
import sfx from "../audio/sfx";

type GamePhase = "calibration" | "countdown" | "running" | "zone_transition" | "complete";

interface WorkoutChallenge {
  exercise: ExerciseDefinition;
  progress: number;
  completed: boolean;
  accuracy: number;
}

export default class RunrGame extends Phaser.Scene {
  private phase: GamePhase = "calibration";
  private calibrationProgress = 0;
  private calibrationFrames = 0;
  private requiredCalibrationFrames = 60;

  private challenges: WorkoutChallenge[] = [];
  private currentChallengeIndex = 0;
  private zoneStartTime = 0;
  private zoneDuration = 0;
  private currentZone = "warmup";

  private character!: Phaser.GameObjects.Container;
  private characterParts!: {
    head: Phaser.GameObjects.Ellipse;
    torso: Phaser.GameObjects.Rectangle;
    leftArm: Phaser.GameObjects.Rectangle;
    rightArm: Phaser.GameObjects.Rectangle;
    leftLeg: Phaser.GameObjects.Rectangle;
    rightLeg: Phaser.GameObjects.Rectangle;
  };

  private challengeText!: Phaser.GameObjects.Text;
  private zoneText!: Phaser.GameObjects.Text;
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBarBg!: Phaser.GameObjects.Graphics;
  private accuracyText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private nextExerciseText!: Phaser.GameObjects.Text;

  private stats = {
    score: 0,
    calories: 0,
    exercisesCompleted: 0,
    totalAccuracy: 0,
    zone: "warmup",
    intensity: "LOW",
    duration: 0,
  };

  private updateStatsCallback: ((stats: typeof this.stats) => void) | null = null;
  private onExerciseComplete: ((exercise: ExerciseName, accuracy: number) => void) | null = null;
  private onZoneChange: ((zone: string) => void) | null = null;
  private onSequenceReady: ((exercises: ExerciseName[]) => void) | null = null;

  constructor() {
    super("RunrGame");
  }

  create() {
    this.cameras.main.setBackgroundColor("#07111f");
    this.createCharacter();
    this.createUI();
    this.createBackground();
    this.setupInput();

    this.time.delayedCall(1000, () => {
      this.phase = "calibration";
      this.calibrationProgress = 0;
      this.calibrationFrames = 0;
    });

    const readCallback = <T>(key: string): T | null => {
      try { return this.registry.get(key) as T ?? null; } catch { return null; }
    };
    this.updateStatsCallback = readCallback<(s: typeof this.stats) => void>("updateStats");
    this.onZoneChange = readCallback<(z: string) => void>("onZoneChange");
    this.onExerciseComplete = readCallback<(e: ExerciseName, a: number) => void>("onExerciseComplete");
    this.onSequenceReady = readCallback<(e: ExerciseName[]) => void>("onSequenceReady");
  }

  private createCharacter() {
    this.character = this.add.container(550, 400);

    this.characterParts = {
      head: this.add.ellipse(0, -120, 40, 45, 0xf5c9a6),
      torso: this.add.rectangle(0, -40, 60, 80, 0x22d3ee),
      leftArm: this.add.rectangle(-50, -40, 18, 70, 0x22d3ee),
      rightArm: this.add.rectangle(50, -40, 18, 70, 0x22d3ee),
      leftLeg: this.add.rectangle(-15, 30, 20, 80, 0x0ea5e9),
      rightLeg: this.add.rectangle(15, 30, 20, 80, 0x0ea5e9),
    };

    for (const part of Object.values(this.characterParts)) {
      part.setStrokeStyle(2, 0xffffff, 0.6);
      part.setOrigin(0.5, 0.5);
      this.character.add(part);
    }

    this.characterParts.leftArm.setOrigin(0.5, 0);
    this.characterParts.rightArm.setOrigin(0.5, 0);
    this.characterParts.leftLeg.setOrigin(0.5, 0);
    this.characterParts.rightLeg.setOrigin(0.5, 0);
  }

  private createUI() {
    this.zoneText = this.add.text(550, 30, "WARM UP", {
      fontFamily: "Arial",
      fontSize: "28px",
      fontStyle: "bold",
      color: "#38bdf8",
      align: "center",
    }).setOrigin(0.5).setDepth(10);

    this.challengeText = this.add.text(550, 150, "CALIBRATING...", {
      fontFamily: "Arial",
      fontSize: "36px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "center",
    }).setOrigin(0.5).setDepth(10);

    this.promptText = this.add.text(550, 210, "Stand in view of camera", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#94a3b8",
      align: "center",
    }).setOrigin(0.5).setDepth(10);

    this.progressBarBg = this.add.graphics().setDepth(10);
    this.progressBarBg.fillStyle(0x1e293b, 1);
    this.progressBarBg.fillRoundedRect(150, 260, 800, 20, 10);

    this.progressBar = this.add.graphics().setDepth(10);

    this.accuracyText = this.add.text(550, 300, "Accuracy: --%", {
      fontFamily: "Arial",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#22d3ee",
      align: "center",
    }).setOrigin(0.5).setDepth(10);

    this.nextExerciseText = this.add.text(550, 340, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#64748b",
      align: "center",
    }).setOrigin(0.5).setDepth(10);

    this.statsText = this.add.text(50, 50, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#e2e8f0",
      lineSpacing: 6,
    }).setDepth(10);

    this.updateStatsDisplay();
  }

  private createBackground() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0b1a2e, 0x0b1a2e, 0x04101f, 0x04101f, 1);
    g.fillRect(0, 0, 1100, 650);

    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, 1100);
      const y = Phaser.Math.Between(0, 650);
      const size = Phaser.Math.Between(2, 6);
      g.fillStyle(0x38bdf8, Phaser.Math.FloatBetween(0.1, 0.4));
      g.fillCircle(x, y, size);
    }
  }

  private setupInput() {
    this.input.keyboard?.once("keydown", () => sfx.unlock());
    this.input.on("pointerdown", () => sfx.unlock());
  }

  update(_time: number, delta: number) {
    if (this.phase === "calibration") {
      this.updateCalibration(delta);
    } else if (this.phase === "countdown") {
      // handled by timer
    } else if (this.phase === "running") {
      this.updateRunning(delta);
    } else if (this.phase === "zone_transition") {
      // handled by timer
    }

    this.updateStatsDisplay();
  }

  private updateCalibration(_delta: number) {
    this.calibrationFrames++;
    this.calibrationProgress = Math.min(1, this.calibrationFrames / this.requiredCalibrationFrames);

    this.challengeText.setText("CALIBRATING...");
    this.promptText.setText(this.calibrationProgress < 1 ? "Stand in view of camera" : "Calibration complete!");

    this.drawProgressBar(this.calibrationProgress, "#38bdf8");

    if (this.calibrationProgress >= 1) {
      this.phase = "countdown";
      this.startCountdown();
    }
  }

  private startCountdown() {
    let count = 3;
    this.challengeText.setText(String(count));
    this.promptText.setText("Get ready!");
    sfx.countdown();

    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        count--;
        if (count > 0) {
          this.challengeText.setText(String(count));
          sfx.countdown();
        } else {
          this.phase = "running";
          this.challengeText.setText("");
          this.promptText.setText("");
          sfx.go();
          this.startZone("warmup");
        }
      },
    });
  }

  private startZone(zone: string) {
    this.currentZone = zone;
    const configs: Record<string, { duration: number; exercises: ExerciseName[] }> = {
      warmup: { duration: 75, exercises: ["ARM_CIRCLES", "REACH_LEFT", "REACH_RIGHT", "REACH_OVERHEAD", "MARCH", "STEP_LEFT", "STEP_RIGHT", "LEAN_LEFT", "LEAN_RIGHT", "TORSO_TWIST_LEFT", "TORSO_TWIST_RIGHT"] },
      cardio: { duration: 120, exercises: ["HIGH_KNEES", "JUMP", "KNEE_RAISE_LEFT", "KNEE_RAISE_RIGHT", "PUNCH_LEFT", "PUNCH_RIGHT", "DOUBLE_PUNCH", "STEP_LEFT", "STEP_RIGHT"] },
      strength: { duration: 90, exercises: ["SQUAT", "KNEE_RAISE_LEFT", "KNEE_RAISE_RIGHT", "PUNCH_LEFT", "PUNCH_RIGHT", "REACH_OVERHEAD"] },
      core: { duration: 60, exercises: ["TORSO_TWIST_LEFT", "TORSO_TWIST_RIGHT", "LEAN_LEFT", "LEAN_RIGHT", "STEP_LEFT", "STEP_RIGHT", "MARCH"] },
      fullbody: { duration: 90, exercises: ["STAR_BURST", "POWER_MOVE", "SQUAT", "HIGH_KNEES", "DOUBLE_PUNCH", "REACH_OVERHEAD", "JUMP"] },
      recovery: { duration: 60, exercises: ["ARM_CIRCLES", "REACH_LEFT", "REACH_RIGHT", "REACH_OVERHEAD", "MARCH", "STEP_LEFT", "STEP_RIGHT", "LEAN_LEFT", "LEAN_RIGHT"] },
    };

    const config = configs[zone] || configs.warmup;
    this.zoneDuration = config.duration;
    this.zoneStartTime = Date.now();

    this.challenges = config.exercises.map((name) => {
      const exercise = getExerciseByName(name)!;
      return { exercise, progress: 0, completed: false, accuracy: 0 };
    });

    this.currentChallengeIndex = 0;
    this.zoneText.setText(zone.toUpperCase());
    this.zoneText.setColor(configs[zone] ? (zone === "warmup" ? "#38bdf8" : zone === "cardio" ? "#f97316" : zone === "strength" ? "#a855f7" : zone === "core" ? "#22d3ee" : zone === "fullbody" ? "#fbbf24" : "#4ade80") : "#38bdf8");

    this.onZoneChange?.(zone);
    this.onSequenceReady?.(config.exercises);
    this.promptNextChallenge();
  }

  private promptNextChallenge() {
    if (this.currentChallengeIndex >= this.challenges.length) {
      this.completeZone();
      return;
    }

    const challenge = this.challenges[this.currentChallengeIndex];
    this.challengeText.setText(challenge.exercise.displayName);
    this.challengeText.setColor(challenge.exercise.icon ? "#ffffff" : "#ffffff");
    this.promptText.setText(challenge.exercise.prompt);
    this.accuracyText.setText("Accuracy: --%");

    const next = this.currentChallengeIndex + 1 < this.challenges.length
      ? this.challenges[this.currentChallengeIndex + 1].exercise.displayName
      : "Zone complete";
    this.nextExerciseText.setText(`Next: ${next}`);
  }

  private updateRunning(_delta: number) {
    const zoneElapsed = (Date.now() - this.zoneStartTime) / 1000;
    const zoneProgress = Math.min(1, zoneElapsed / this.zoneDuration);
    this.drawProgressBar(zoneProgress, this.getZoneColor(this.currentZone));

    this.stats.duration = Math.floor(zoneElapsed);
    this.stats.zone = this.currentZone;
    this.stats.intensity = this.getZoneIntensity(this.currentZone);
  }

  private drawProgressBar(progress: number, color: string) {
    this.progressBar.clear();
    const fillColor = Phaser.Display.Color.HexStringToColor(color).color;
    this.progressBar.fillStyle(fillColor, 1);
    this.progressBar.fillRoundedRect(150, 260, 800 * progress, 20, 10);
  }

  private getZoneColor(zone: string): string {
    const colors: Record<string, string> = {
      warmup: "#38bdf8",
      cardio: "#f97316",
      strength: "#a855f7",
      core: "#22d3ee",
      fullbody: "#fbbf24",
      recovery: "#4ade80",
    };
    return colors[zone] || "#38bdf8";
  }

  private getZoneIntensity(zone: string): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" {
    const intensities: Record<string, "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"> = {
      warmup: "LOW",
      cardio: "HIGH",
      strength: "HIGH",
      core: "MEDIUM",
      fullbody: "VERY_HIGH",
      recovery: "LOW",
    };
    return intensities[zone] || "LOW";
  }

  private completeZone() {
    this.phase = "zone_transition";
    this.challengeText.setText("ZONE COMPLETE!");
    this.promptText.setText("Transitioning...");
    this.nextExerciseText.setText("");

    const nextZones: Record<string, string[]> = {
      warmup: ["cardio"],
      cardio: ["strength", "fullbody", "recovery"],
      strength: ["cardio", "core", "fullbody", "recovery"],
      core: ["strength", "recovery", "warmup"],
      fullbody: ["recovery", "cardio"],
      recovery: ["warmup"],
    };

    const nextZone = nextZones[this.currentZone]?.[0] || "warmup";

    this.time.delayedCall(3000, () => {
      this.startZone(nextZone);
    });
  }

  public receiveExerciseResult(exerciseName: ExerciseName, accuracy: number, _metrics: { range_of_motion: number; speed: number }) {
    if (this.phase !== "running") return;

    const currentChallenge = this.challenges[this.currentChallengeIndex];
    if (!currentChallenge || currentChallenge.completed) return;
    if (currentChallenge.exercise.name !== exerciseName) return;

    currentChallenge.completed = true;
    currentChallenge.accuracy = accuracy;
    currentChallenge.progress = 1;

    this.stats.exercisesCompleted++;
    this.stats.totalAccuracy += accuracy;
    const points = Math.round(100 * (accuracy / 100) * currentChallenge.exercise.difficulty);
    this.stats.score += points;
    this.stats.calories += currentChallenge.exercise.caloriesPerRep;

    this.accuracyText.setText(`Accuracy: ${Math.round(accuracy)}%`);
    this.accuracyText.setColor(accuracy >= 80 ? "#4ade80" : accuracy >= 60 ? "#fbbf24" : "#ff7373");

    this.animateCharacterForExercise(exerciseName);
    this.showAccuracyPopup(accuracy);
    sfx.combo(Math.min(this.stats.exercisesCompleted, 20));

    this.onExerciseComplete?.(exerciseName, accuracy);

    this.time.delayedCall(1500, () => {
      this.currentChallengeIndex++;
      this.promptNextChallenge();
    });
  }

  private animateCharacterForExercise(exerciseName: ExerciseName) {
    const anims: Record<string, () => void> = {
      STEP_LEFT: () => this.tweenCharacter({ leftLeg: -30, rightLeg: 10, torso: -15 }),
      STEP_RIGHT: () => this.tweenCharacter({ leftLeg: 10, rightLeg: -30, torso: 15 }),
      KNEE_RAISE_LEFT: () => this.tweenCharacter({ leftLeg: -60, leftKnee: -40 }),
      KNEE_RAISE_RIGHT: () => this.tweenCharacter({ rightLeg: -60, rightKnee: -40 }),
      HIGH_KNEES: () => this.tweenCharacter({ leftLeg: -50, rightLeg: -50, leftKnee: -30, rightKnee: -30 }),
      SQUAT: () => this.tweenCharacter({ leftLeg: 20, rightLeg: 20, leftKnee: 60, rightKnee: 60, torso: 30 }),
      JUMP: () => this.tweenCharacter({ leftLeg: -40, rightLeg: -40, leftKnee: -20, rightKnee: -20, character: -80 }),
      REACH_LEFT: () => this.tweenCharacter({ leftArm: -120, leftElbow: 10 }),
      REACH_RIGHT: () => this.tweenCharacter({ rightArm: -120, rightElbow: 10 }),
      REACH_OVERHEAD: () => this.tweenCharacter({ leftArm: -160, rightArm: -160, leftElbow: -10, rightElbow: -10 }),
      PUNCH_LEFT: () => this.tweenCharacter({ leftArm: -140, leftElbow: -30 }),
      PUNCH_RIGHT: () => this.tweenCharacter({ rightArm: -140, rightElbow: -30 }),
      DOUBLE_PUNCH: () => this.tweenCharacter({ leftArm: -140, rightArm: -140, leftElbow: -30, rightElbow: -30 }),
      TORSO_TWIST_LEFT: () => this.tweenCharacter({ torso: -30, leftArm: -20, rightArm: 20 }),
      TORSO_TWIST_RIGHT: () => this.tweenCharacter({ torso: 30, leftArm: 20, rightArm: -20 }),
      LEAN_LEFT: () => this.tweenCharacter({ torso: -25, leftLeg: -15, rightLeg: 15 }),
      LEAN_RIGHT: () => this.tweenCharacter({ torso: 25, leftLeg: 15, rightLeg: -15 }),
      STAR_BURST: () => this.tweenCharacter({ leftArm: -180, rightArm: -180, leftLeg: -30, rightLeg: 30, leftElbow: -10, rightElbow: -10 }),
      POWER_MOVE: () => this.tweenCharacter({ leftLeg: 20, rightLeg: 20, leftKnee: 60, rightKnee: 60, leftArm: -160, rightArm: -160, leftElbow: -10, rightElbow: -10, character: -40 }),
      MARCH: () => this.tweenCharacter({ leftLeg: -30, rightLeg: 10, leftKnee: -20 }),
      ARM_CIRCLES: () => this.tweenCharacter({ leftArm: -120, rightArm: -120, leftElbow: 45, rightElbow: 45 }),
    };

    anims[exerciseName]?.();
  }

  private tweenCharacter(targets: Record<string, number>) {
    const defaults = {
      leftLeg: 0, rightLeg: 0, leftKnee: 0, rightKnee: 0,
      leftArm: 0, rightArm: 0, leftElbow: 0, rightElbow: 0,
      torso: 0, character: 0,
    };
    const t = { ...defaults, ...targets };

    const duration = 300;

    if (t.leftLeg !== 0) this.tweens.add({ targets: this.characterParts.leftLeg, rotation: Phaser.Math.DegToRad(t.leftLeg), duration, yoyo: true, ease: "Power2" });
    if (t.rightLeg !== 0) this.tweens.add({ targets: this.characterParts.rightLeg, rotation: Phaser.Math.DegToRad(t.rightLeg), duration, yoyo: true, ease: "Power2" });
    if (t.leftKnee !== 0) this.tweens.add({ targets: this.characterParts.leftLeg, y: 30 + t.leftKnee, duration, yoyo: true, ease: "Power2" });
    if (t.rightKnee !== 0) this.tweens.add({ targets: this.characterParts.rightLeg, y: 30 + t.rightKnee, duration, yoyo: true, ease: "Power2" });
    if (t.leftArm !== 0) this.tweens.add({ targets: this.characterParts.leftArm, rotation: Phaser.Math.DegToRad(t.leftArm), duration, yoyo: true, ease: "Power2" });
    if (t.rightArm !== 0) this.tweens.add({ targets: this.characterParts.rightArm, rotation: Phaser.Math.DegToRad(t.rightArm), duration, yoyo: true, ease: "Power2" });
    if (t.leftElbow !== 0) this.tweens.add({ targets: this.characterParts.leftArm, scaleY: 1 + t.leftElbow / 100, duration, yoyo: true, ease: "Power2" });
    if (t.rightElbow !== 0) this.tweens.add({ targets: this.characterParts.rightArm, scaleY: 1 + t.rightElbow / 100, duration, yoyo: true, ease: "Power2" });
    if (t.torso !== 0) this.tweens.add({ targets: this.characterParts.torso, rotation: Phaser.Math.DegToRad(t.torso), duration, yoyo: true, ease: "Power2" });
    if (t.character !== 0) this.tweens.add({ targets: this.character, y: 400 + t.character, duration, yoyo: true, ease: "Power2" });
  }

  private showAccuracyPopup(accuracy: number) {
    const text = this.add.text(550, 380, `${Math.round(accuracy)}%`, {
      fontFamily: "Arial",
      fontSize: "48px",
      fontStyle: "bold",
      color: accuracy >= 80 ? "#4ade80" : accuracy >= 60 ? "#fbbf24" : "#ff7373",
      stroke: "#000000",
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20);

    this.tweens.add({
      targets: text,
      y: 300,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      ease: "Cubic.easeOut",
      onComplete: () => text.destroy(),
    });
  }

  private updateStatsDisplay() {
    this.statsText.setText([
      `SCORE: ${this.stats.score.toLocaleString()}`,
      `CALORIES: ${this.stats.calories.toFixed(1)} kcal`,
      `EXERCISES: ${this.stats.exercisesCompleted}`,
      `AVG ACCURACY: ${this.stats.exercisesCompleted > 0 ? Math.round(this.stats.totalAccuracy / this.stats.exercisesCompleted) : 0}%`,
      `ZONE: ${this.stats.zone.toUpperCase()}`,
      `INTENSITY: ${this.stats.intensity}`,
      `TIME: ${this.stats.duration}s`,
    ].join("\n"));

    if (this.updateStatsCallback) {
      this.updateStatsCallback({ ...this.stats });
    }
  }

  public setUpdateStatsCallback(cb: (stats: typeof this.stats) => void) {
    this.updateStatsCallback = cb;
  }

  public setExerciseCompleteCallback(cb: (exercise: ExerciseName, accuracy: number) => void) {
    this.onExerciseComplete = cb;
  }

  public setZoneChangeCallback(cb: (zone: string) => void) {
    this.onZoneChange = cb;
  }

  public setSequenceReadyCallback(cb: (exercises: ExerciseName[]) => void) {
    this.onSequenceReady = cb;
  }

  public getPhase(): GamePhase {
    return this.phase;
  }

  public isCalibrated(): boolean {
    return this.calibrationProgress >= 1;
  }
}