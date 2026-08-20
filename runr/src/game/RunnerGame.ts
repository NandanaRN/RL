import Phaser from "phaser";
import { PPOAgent, type PPOAction } from "./PPOAgent";

type GameAction = "idle" | "jump" | "duck" | "left" | "right";
type GamePhase = "ready" | "running" | "gameover";

interface Obstacle {
  type: "barrier" | "beam" | "left_wall" | "right_wall";
  sprite: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  z: number;
  lane: number;
  hit: boolean;
}

export default class RunnerGame extends Phaser.Scene {
  private phase: GamePhase = "ready";
  private score = 0;
  private lives = 3;

  private roadCenterX = 550;
  private roadBottom = 540;
  private roadTop = 100;
  private laneWidth = 130;
  private playerLane = 0;
  private playerScreenX = 550;

  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Rectangle;
  private playerHead!: Phaser.GameObjects.Ellipse;
  private playerArmL!: Phaser.GameObjects.Rectangle;
  private playerArmR!: Phaser.GameObjects.Rectangle;
  private playerLegL!: Phaser.GameObjects.Rectangle;
  private playerLegR!: Phaser.GameObjects.Rectangle;
  private playerShadow!: Phaser.GameObjects.Ellipse;

  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = 2200;
  private scrollSpeed = 0.35;
  private baseSpeed = 0.35;

  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;
  private hintBanner!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private poseLabel!: Phaser.GameObjects.Text;
  private diffBar!: Phaser.GameObjects.Graphics;
  private rlInfoText!: Phaser.GameObjects.Text;

  private rlDifficulty = 0.2;
  private successWindow: number[] = [];
  private totalSuccesses = 0;
  private totalAttempts = 0;
  private actionCooldown = 0;

  private rlAgent = new PPOAgent();
  private lastRLAction: PPOAction = "keep";
  private dodgeStreak = 0;
  private rlUpdateTimer = 0;

  private runTimer = 0;
  private runSpeed = 8;
  private isJumping = false;
  private isDucking = false;
  private currentPose = "STANDING";
  private lastLeanState = "center";

  private bgBuildingPool: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("RunnerGame");
  }

  create() {
    this.cameras.main.setBackgroundColor("#080c18");
    this.phase = "ready";
    this.score = 0;
    this.lives = 3;
    this.playerLane = 0;
    this.playerScreenX = this.roadCenterX;
    this.obstacles = [];
    this.spawnTimer = 0;
    this.scrollSpeed = this.baseSpeed;
    this.rlDifficulty = 0.2;
    this.successWindow = [];
    this.totalSuccesses = 0;
    this.totalAttempts = 0;
    this.actionCooldown = 0;
    this.runTimer = 0;
    this.isJumping = false;
    this.isDucking = false;

    this.createScenery();
    this.createRoad();
    this.createPlayer();
    this.createUI();
    this.showReadyScreen();
  }

  private laneX(lane: number): number {
    return this.roadCenterX + lane * this.laneWidth;
  }

  private createScenery() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x080c18, 0x080c18, 0x0f1828, 0x0f1828, 1);
    g.fillRect(0, 0, 1100, 650);

    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, 1100);
      const y = Phaser.Math.Between(0, this.roadTop + 30);
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.6));
      g.fillCircle(x, y, Phaser.Math.FloatBetween(0.5, 2));
    }

    for (let i = 0; i < 8; i++) {
      const bx = Phaser.Math.Between(0, 1100);
      const bw = Phaser.Math.Between(30, 80);
      const bh = Phaser.Math.Between(20, 60);
      const by = this.roadTop - bh + 20;
      const b = this.add.rectangle(bx, by, bw, bh, 0x0f1828, 0.6);
      b.setStrokeStyle(1, 0x1a2a40, 0.3);
      this.bgBuildingPool.push(b);
    }
  }

  private createRoad() {
    const rg = this.add.graphics();
    rg.fillStyle(0x111a28, 1);
    rg.beginPath();
    rg.moveTo(this.roadCenterX - 240, this.roadBottom + 60);
    rg.lineTo(this.roadCenterX + 240, this.roadBottom + 60);
    rg.lineTo(this.roadCenterX + 70, this.roadTop);
    rg.lineTo(this.roadCenterX - 70, this.roadTop);
    rg.closePath();
    rg.fill();

    rg.lineStyle(2, 0x22d3ee, 0.25);
    rg.beginPath();
    rg.moveTo(this.roadCenterX - 240, this.roadBottom + 60);
    rg.lineTo(this.roadCenterX - 70, this.roadTop);
    rg.stroke();
    rg.beginPath();
    rg.moveTo(this.roadCenterX + 240, this.roadBottom + 60);
    rg.lineTo(this.roadCenterX + 70, this.roadTop);
    rg.stroke();

    rg.lineStyle(1, 0x22d3ee, 0.06);
    for (let lane = -1; lane <= 1; lane += 2) {
      const xBot = this.roadCenterX + lane * (this.laneWidth / 2);
      const xTop = this.roadCenterX + lane * 22;
      rg.beginPath();
      rg.moveTo(xBot, this.roadBottom + 60);
      rg.lineTo(xTop, this.roadTop);
      rg.stroke();
    }
  }

  private createPlayer() {
    const playerY = this.roadBottom - 40;
    this.player = this.add.container(this.roadCenterX, playerY);

    this.playerShadow = this.add.ellipse(0, 45, 50, 12, 0x000000, 0.3);

    this.playerLegL = this.add.rectangle(-9, 18, 11, 28, 0x0ea5e9);
    this.playerLegR = this.add.rectangle(9, 18, 11, 28, 0x0ea5e9);
    this.playerBody = this.add.rectangle(0, -10, 34, 36, 0x22d3ee);
    this.playerArmL = this.add.rectangle(-22, -10, 9, 26, 0x22d3ee);
    this.playerArmR = this.add.rectangle(22, -10, 9, 26, 0x22d3ee);
    this.playerHead = this.add.ellipse(0, -34, 20, 22, 0xf5c9a6);

    for (const p of [this.playerLegL, this.playerLegR, this.playerBody, this.playerArmL, this.playerArmR]) {
      p.setOrigin(0.5, 0);
      p.setStrokeStyle(1, 0xffffff, 0.4);
    }
    this.playerHead.setStrokeStyle(1, 0xffffff, 0.3);

    this.player.add([this.playerShadow, this.playerLegL, this.playerLegR, this.playerBody, this.playerArmL, this.playerArmR, this.playerHead]);
    this.player.setDepth(5);
  }

  private createUI() {
    this.scoreText = this.add.text(30, 20, "SCORE: 0", {
      fontFamily: "Arial", fontSize: "22px", fontStyle: "bold",
      color: "#e2e8f0", stroke: "#000", strokeThickness: 3,
    }).setDepth(10);

    this.livesText = this.add.text(30, 50, "LIVES: ♥♥♥", {
      fontFamily: "Arial", fontSize: "20px", fontStyle: "bold",
      color: "#ff4444", stroke: "#000", strokeThickness: 3,
    }).setDepth(10);

    this.actionText = this.add.text(550, 470, "", {
      fontFamily: "Arial", fontSize: "28px", fontStyle: "bold",
      color: "#22d3ee", align: "center",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.hintBanner = this.add.container(550, 40);
    const hb = this.add.rectangle(0, 0, 360, 34, 0xfbbf24, 0.15);
    hb.setStrokeStyle(1, 0xfbbf24, 0.5);
    this.hintText = this.add.text(0, 0, "", {
      fontFamily: "Arial", fontSize: "15px", fontStyle: "bold",
      color: "#fbbf24",
    }).setOrigin(0.5);
    this.hintBanner.add([hb, this.hintText]);
    this.hintBanner.setDepth(10);

    this.poseLabel = this.add.text(550, 620, "YOUR POSE: STANDING", {
      fontFamily: "Arial", fontSize: "13px", fontStyle: "bold",
      color: "#22d3ee", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    this.diffBar = this.add.graphics().setDepth(10);
    this.drawDiffBar();
  }

  private drawDiffBar() {
    this.diffBar.clear();
    this.diffBar.fillStyle(0x1a2332, 1);
    this.diffBar.fillRoundedRect(1020, 20, 50, 8, 4);
    const c = this.rlDifficulty < 0.4 ? 0x4ade80 : this.rlDifficulty < 0.7 ? 0xfbbf24 : 0xff4444;
    this.diffBar.fillStyle(c, 1);
    this.diffBar.fillRoundedRect(1020, 20, 50 * this.rlDifficulty, 8, 4);

    if (this.rlInfoText) {
      this.rlInfoText.setText(`PPO: ${this.lastRLAction.toUpperCase()} | params=${this.rlAgent.getParamCount()} | updates=${this.rlAgent.getUpdateCount()}`);
    }
  }

  private showReadyScreen() {
    const overlay = this.add.rectangle(550, 325, 1100, 650, 0x000000, 0.75).setDepth(20);

    const title = this.add.text(550, 150, "RUNR", {
      fontFamily: "Arial", fontSize: "72px", fontStyle: "bold",
      color: "#22d3ee", stroke: "#000", strokeThickness: 8,
    }).setOrigin(0.5).setDepth(21);

    const sub = this.add.text(550, 215, "BODY CONTROLLED RUNNER", {
      fontFamily: "Arial", fontSize: "20px", fontStyle: "bold",
      color: "#94a3b8", letterSpacing: 4,
    }).setOrigin(0.5).setDepth(21);

    const instr = this.add.text(550, 310, [
      "HOW TO PLAY:",
      "",
      "  Raise arms up     =  JUMP over barriers",
      "  Squat down         =  DUCK under beams",
      "  Lean LEFT            =  Dodge to LEFT lane",
      "  Lean RIGHT           =  Dodge to RIGHT lane",
      "",
      "  You ARE the character!",
      "  Move your body to dodge obstacles!",
    ].join("\n"), {
      fontFamily: "Arial", fontSize: "14px", color: "#cbd5e1",
      lineSpacing: 5, align: "center",
    }).setOrigin(0.5).setDepth(21);

    const btn = this.add.text(550, 460, "[ MOVE YOUR BODY TO START ]", {
      fontFamily: "Arial", fontSize: "18px", fontStyle: "bold",
      color: "#fbbf24",
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: btn, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard?.once("keydown", () => {
      [overlay, title, sub, instr, btn].forEach(c => c.destroy());
      this.phase = "running";
    });
  }

  private showGameOver() {
    this.phase = "gameover";
    this.obstacles.forEach(o => { o.sprite.destroy(); o.text.destroy(); });
    this.obstacles = [];

    this.add.rectangle(550, 325, 1100, 650, 0x000000, 0.8).setDepth(20);
    this.add.text(550, 170, "GAME OVER", {
      fontFamily: "Arial", fontSize: "56px", fontStyle: "bold",
      color: "#ff4444", stroke: "#000", strokeThickness: 8,
    }).setOrigin(0.5).setDepth(21);

    this.add.text(550, 250, `SCORE: ${this.score}`, {
      fontFamily: "Arial", fontSize: "32px", fontStyle: "bold",
      color: "#fbbf24",
    }).setOrigin(0.5).setDepth(21);

    this.add.text(550, 300, `AI DIFFICULTY: ${Math.round(this.rlDifficulty * 100)}%`, {
      fontFamily: "Arial", fontSize: "16px", color: "#a855f7",
    }).setOrigin(0.5).setDepth(21);

    const acc = this.totalAttempts > 0 ? Math.round((this.totalSuccesses / this.totalAttempts) * 100) : 0;
    this.add.text(550, 335, `ACCURACY: ${acc}%`, {
      fontFamily: "Arial", fontSize: "14px", color: "#64748b",
    }).setOrigin(0.5).setDepth(21);

    const restart = this.add.text(550, 410, "[ PRESS ANY KEY TO RESTART ]", {
      fontFamily: "Arial", fontSize: "20px", fontStyle: "bold",
      color: "#4ade80",
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: restart, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard?.once("keydown", () => this.scene.restart());
  }

  update(_time: number, delta: number) {
    if (this.phase !== "running") {
      this.animateRunning(delta / 1000);
      return;
    }

    const dt = delta / 1000;

    this.updateRL();
    this.scrollSpeed = this.baseSpeed + this.rlDifficulty * 0.5;
    this.spawnInterval = Math.max(900, 2200 - this.rlDifficulty * 1400);

    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnObstacle();
    }

    this.updateObstacles(dt);
    this.checkCollisions();
    this.animateRunning(dt);
    this.updatePlayerLane(dt);
    this.updateUI();
  }

  private animateRunning(dt: number) {
    this.runTimer += dt * this.runSpeed;

    if (this.isJumping) {
      this.playerArmL.rotation = Phaser.Math.Linear(this.playerArmL.rotation, Phaser.Math.DegToRad(-120), 0.2);
      this.playerArmR.rotation = Phaser.Math.Linear(this.playerArmR.rotation, Phaser.Math.DegToRad(120), 0.2);
      this.playerLegL.rotation = Phaser.Math.Linear(this.playerLegL.rotation, Phaser.Math.DegToRad(20), 0.2);
      this.playerLegR.rotation = Phaser.Math.Linear(this.playerLegR.rotation, Phaser.Math.DegToRad(-20), 0.2);
    } else if (this.isDucking) {
      this.playerArmL.rotation = Phaser.Math.Linear(this.playerArmL.rotation, Phaser.Math.DegToRad(40), 0.2);
      this.playerArmR.rotation = Phaser.Math.Linear(this.playerArmR.rotation, Phaser.Math.DegToRad(-40), 0.2);
      this.playerLegL.rotation = Phaser.Math.Linear(this.playerLegL.rotation, Phaser.Math.DegToRad(-30), 0.2);
      this.playerLegR.rotation = Phaser.Math.Linear(this.playerLegR.rotation, Phaser.Math.DegToRad(30), 0.2);
    } else {
      const legSwing = Math.sin(this.runTimer) * 30;
      this.playerLegL.rotation = Phaser.Math.Linear(this.playerLegL.rotation, Phaser.Math.DegToRad(legSwing), 0.3);
      this.playerLegR.rotation = Phaser.Math.Linear(this.playerLegR.rotation, Phaser.Math.DegToRad(-legSwing), 0.3);

      const armSwing = Math.sin(this.runTimer) * 20;
      this.playerArmL.rotation = Phaser.Math.Linear(this.playerArmL.rotation, Phaser.Math.DegToRad(-armSwing - 10), 0.3);
      this.playerArmR.rotation = Phaser.Math.Linear(this.playerArmR.rotation, Phaser.Math.DegToRad(armSwing - 10), 0.3);

      const bodyBob = Math.abs(Math.sin(this.runTimer * 2)) * 2;
      this.playerBody.y = Phaser.Math.Linear(this.playerBody.y, -10 - bodyBob, 0.3);
    }
  }

  private updatePlayerLane(dt: number) {
    const targetX = this.laneX(this.playerLane);
    this.playerScreenX = Phaser.Math.Linear(this.playerScreenX, targetX, dt * 10);
    this.player.x = this.playerScreenX;

    const lean = (this.playerScreenX - this.roadCenterX) / this.laneWidth;
    this.playerBody.rotation = Phaser.Math.Linear(
      this.playerBody.rotation,
      Phaser.Math.DegToRad(lean * -8),
      0.15
    );

    const roadY = Phaser.Math.Linear(this.roadBottom + 60, this.roadTop, 0.08);
    this.playerShadow.y = roadY - this.player.y + 45;
    this.playerShadow.setScale(1, 0.3);
  }

  private spawnObstacle() {
    const types: Obstacle["type"][] = ["barrier", "beam", "left_wall", "right_wall"];
    const weights = [
      1 - this.rlDifficulty * 0.3,
      0.3 + this.rlDifficulty * 0.4,
      0.3 + this.rlDifficulty * 0.2,
      0.3 + this.rlDifficulty * 0.2,
    ];
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let type: Obstacle["type"] = "barrier";
    for (let i = 0; i < types.length; i++) {
      r -= weights[i];
      if (r <= 0) { type = types[i]; break; }
    }

    let lane = Phaser.Math.Between(-1, 1);
    let color = 0xff4444;
    let label = "";
    let w = 90;
    let h = 22;

    switch (type) {
      case "barrier":
        lane = Phaser.Math.Between(-1, 1);
        color = 0xff4444;
        label = "JUMP!";
        w = 90; h = 22;
        break;
      case "beam":
        lane = Phaser.Math.Between(-1, 1);
        color = 0xff8800;
        label = "DUCK!";
        w = 90; h = 55;
        break;
      case "left_wall":
        lane = -1;
        color = 0xff00ff;
        label = "GO RIGHT!";
        w = 60; h = 70;
        break;
      case "right_wall":
        lane = 1;
        color = 0x00ff88;
        label = "GO LEFT!";
        w = 60; h = 70;
        break;
    }

    const sprite = this.add.rectangle(0, 0, w, h, color, 0.85);
    sprite.setStrokeStyle(2, 0xffffff, 0.6);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial", fontSize: "11px", fontStyle: "bold",
      color: "#ffffff", stroke: "#000", strokeThickness: 2,
    }).setOrigin(0.5);

    this.obstacles.push({ type, sprite, text, z: 1.0, lane, hit: false });
  }

  private updateObstacles(dt: number) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.z -= this.scrollSpeed * dt;

      if (ob.z <= -0.1) {
        ob.sprite.destroy();
        ob.text.destroy();
        this.obstacles.splice(i, 1);
        continue;
      }

      const t = Phaser.Math.Clamp(1 - ob.z, 0, 1);
      const screenY = Phaser.Math.Linear(this.roadTop + 20, this.roadBottom - 30, t);
      const scale = Phaser.Math.Linear(0.12, 1.0, t);

      const roadHalfTop = 70;
      const roadHalfBot = 240;
      const roadHalf = Phaser.Math.Linear(roadHalfTop, roadHalfBot, t);
      const laneXVal = this.laneX(ob.lane);
      const clampedX = Phaser.Math.Clamp(laneXVal, this.roadCenterX - roadHalf + 40, this.roadCenterX + roadHalf - 40);

      ob.sprite.setPosition(clampedX, screenY);
      ob.sprite.setScale(scale);
      ob.sprite.setAlpha(Phaser.Math.Linear(0.2, 1, t));
      ob.text.setPosition(clampedX, screenY - ob.sprite.displayHeight * scale / 2 - 12 * scale);
      ob.text.setScale(scale);
      ob.text.setAlpha(Phaser.Math.Linear(0.2, 1, t));
    }
  }

  private checkCollisions() {
    const px = this.player.x;
    const hitW = 40;

    for (const ob of this.obstacles) {
      if (ob.hit) continue;
      if (ob.z > 0.22 || ob.z < -0.02) continue;

      const ox = ob.sprite.x;
      const ow = ob.sprite.displayWidth;

      if (Math.abs(px - ox) < (hitW + ow) / 2) {
        if (ob.type === "barrier" && this.isJumping) continue;
        if (ob.type === "beam" && this.isDucking) continue;

        ob.hit = true;
        this.onHit();
        return;
      }
    }
  }

  private onHit() {
    this.lives--;
    this.cameras.main.shake(200, 0.015);
    this.playerBody.setFillStyle(0xff0000);
    this.time.delayedCall(300, () => this.playerBody.setFillStyle(0x22d3ee));

    const hitText = this.add.text(this.player.x, this.player.y - 70, "-1 LIFE!", {
      fontFamily: "Arial", fontSize: "28px", fontStyle: "bold",
      color: "#ff4444", stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: hitText, y: hitText.y - 50, alpha: 0, duration: 1000, onComplete: () => hitText.destroy() });

    this.totalAttempts++;
    this.successWindow.push(0);
    if (this.successWindow.length > 10) this.successWindow.shift();
    this.dodgeStreak = 0;
    this.learnFromOutcome(false);
    this.updateLivesDisplay();

    if (this.lives <= 0) this.showGameOver();
  }

  private updateLivesDisplay() {
    this.livesText.setText(`LIVES: ${"♥".repeat(Math.max(0, this.lives))}${"♡".repeat(Math.max(0, 3 - this.lives))}`);
  }

  private updateRL() {
    this.rlUpdateTimer++;
    if (this.rlUpdateTimer % 20 !== 0) return;

    const accuracy = this.totalAttempts > 0 ? this.totalSuccesses / this.totalAttempts : 0.5;
    const state = [
      accuracy,
      this.rlDifficulty,
      this.dodgeStreak,
      this.scrollSpeed,
      this.successWindow.length > 0 ? this.successWindow.reduce((a, b) => a + b, 0) / this.successWindow.length : 0.5,
      Math.min(1, this.totalAttempts / 50),
    ];

    const action = this.rlAgent.chooseAction(state);
    const delta = this.rlAgent.getDifficultyDelta(action, accuracy);

    this.rlDifficulty = Phaser.Math.Clamp(this.rlDifficulty + delta, 0.05, 1.0);
    this.lastRLAction = action;
    this.drawDiffBar();
  }

  private learnFromOutcome(dodged: boolean) {
    const accuracy = this.totalAttempts > 0 ? this.totalSuccesses / this.totalAttempts : 0.5;
    const reward = this.rlAgent.calculateReward(dodged, accuracy);
    this.rlAgent.recordReward(reward);

    if (this.rlAgent.shouldUpdate()) {
      this.rlAgent.recordDone();
      this.rlAgent.update();
    }
  }

  private updateUI() {
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.poseLabel.setText(`YOU: ${this.currentPose} | LANE: ${this.playerLane === -1 ? "LEFT" : this.playerLane === 0 ? "CENTER" : "RIGHT"}`);

    let hint = "";
    for (const ob of this.obstacles) {
      if (ob.hit || ob.z > 0.5 || ob.z < 0.1) continue;
      switch (ob.type) {
        case "barrier": hint = "JUMP! (raise arms)"; break;
        case "beam": hint = "DUCK! (squat down)"; break;
        case "left_wall": hint = "LEAN RIGHT!"; break;
        case "right_wall": hint = "LEAN LEFT!"; break;
      }
      break;
    }
    this.hintText.setText(hint);
  }

  public receivePose(landmarks: { x: number; y: number; z: number; visibility?: number }[]) {
    if (!landmarks || landmarks.length < 27) return;

    const ls = landmarks[11];
    const rs = landmarks[12];
    const lw = landmarks[15];
    const rw = landmarks[16];
    const lh = landmarks[23];
    const rh = landmarks[24];

    const shoulderY = (ls.y + rs.y) / 2;
    const hipY = (lh.y + rh.y) / 2;
    const wristY = Math.min(lw.y, rw.y);
    const shoulderCenterX = (ls.x + rs.x) / 2;
    const hipCenterX = (lh.x + rh.x) / 2;
    const lean = (shoulderCenterX - hipCenterX) * 100;

    const armsUp = wristY < shoulderY - 0.08;
    const squatting = hipY > shoulderY + 0.12;

    const armLAngle = Math.atan2(lw.y - ls.y, lw.x - ls.x);
    const armRAngle = Math.atan2(rw.y - rs.y, rw.x - rs.x);

    if (!this.isJumping && !this.isDucking) {
      this.playerArmL.rotation = Phaser.Math.Linear(
        this.playerArmL.rotation,
        armLAngle + Phaser.Math.DegToRad(90),
        0.4
      );
      this.playerArmR.rotation = Phaser.Math.Linear(
        this.playerArmR.rotation,
        armRAngle + Phaser.Math.DegToRad(-90),
        0.4
      );
    }

    if (squatting && !this.isJumping) {
      this.isDucking = true;
      this.player.setScale(1, 0.55);
      this.currentPose = "DUCKING";
    } else if (armsUp && !this.isDucking) {
      this.isJumping = true;
      this.tweens.add({
        targets: this.player,
        y: this.roadBottom - 120,
        duration: 200,
        yoyo: true,
        ease: "Power2",
        onComplete: () => { this.isJumping = false; },
      });
      this.currentPose = "JUMPING";
    } else if (!squatting && !armsUp) {
      this.isDucking = false;
      this.player.setScale(1, 1);
    }

    if (lean < -2.5 && this.lastLeanState !== "left") {
      this.lastLeanState = "left";
      if (this.playerLane > -1) {
        this.playerLane--;
        this.currentPose = "LEAN LEFT";
      }
    } else if (lean > 2.5 && this.lastLeanState !== "right") {
      this.lastLeanState = "right";
      if (this.playerLane < 1) {
        this.playerLane++;
        this.currentPose = "LEAN RIGHT";
      }
    } else if (Math.abs(lean) < 1.5) {
      this.lastLeanState = "center";
      if (this.isJumping) this.currentPose = "JUMPING";
      else if (this.isDucking) this.currentPose = "DUCKING";
      else this.currentPose = "STANDING";
    }
  }

  public receiveAction(action: GameAction) {
    if (this.phase === "ready") {
      this.phase = "running";
      return;
    }
    if (this.phase !== "running") return;
    if (this.actionCooldown > 0) return;

    this.actionCooldown = 0.35;
    this.actionText.setText(action.toUpperCase());
    this.time.delayedCall(500, () => this.actionText.setText(""));

    let dodgeSuccess = false;

    for (const ob of this.obstacles) {
      if (ob.hit || ob.z > 0.35 || ob.z < 0.05) continue;

      if (
        (action === "jump" && ob.type === "barrier") ||
        (action === "duck" && ob.type === "beam") ||
        (action === "left" && ob.type === "right_wall") ||
        (action === "right" && ob.type === "left_wall")
      ) {
        dodgeSuccess = true;
        ob.hit = true;
        this.score += 10;
        this.showDodgeEffect(ob);
        break;
      }
    }

    this.totalAttempts++;
    if (dodgeSuccess) {
      this.score += 5;
      this.totalSuccesses++;
      this.successWindow.push(1);
      this.dodgeStreak++;
    } else {
      this.successWindow.push(0);
      this.dodgeStreak = 0;
    }
    if (this.successWindow.length > 10) this.successWindow.shift();
    this.learnFromOutcome(dodgeSuccess);
  }

  private showDodgeEffect(ob: Obstacle) {
    const txt = this.add.text(ob.sprite.x, ob.sprite.y - 30, "+15", {
      fontFamily: "Arial", fontSize: "24px", fontStyle: "bold",
      color: "#4ade80", stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, scale: 1.3, duration: 700, onComplete: () => txt.destroy() });

    ob.sprite.setFillStyle(0x4ade80);
    this.tweens.add({ targets: [ob.sprite, ob.text], alpha: 0, duration: 200,
      onComplete: () => { ob.sprite.destroy(); ob.text.destroy(); },
    });
  }

  public getPhase(): GamePhase { return this.phase; }
  public getScore(): number { return this.score; }
  public getLives(): number { return this.lives; }
  public getDifficulty(): number { return this.rlDifficulty; }
  public getAccuracy(): number {
    return this.totalAttempts > 0 ? this.totalSuccesses / this.totalAttempts : 0;
  }
}
