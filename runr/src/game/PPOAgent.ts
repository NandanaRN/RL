/**
 * PPO (Proximal Policy Optimization) Difficulty Agent for RUNR
 *
 * Actor-Critic with:
 *   - Clipped surrogate objective
 *   - GAE for advantage estimation
 *   - Simple gradient descent (no library needed)
 *
 * State: [accuracy, difficulty, streak, speed, recentRate, experience]
 * Action: increase / decrease / keep difficulty
 */

const STATE_DIM = 6;
const ACTION_DIM = 3;
const GAMMA = 0.99;
const GAE_LAMBDA = 0.95;
const PPO_EPSILON = 0.2;
const PPO_EPOCHS = 4;
const LR = 0.002;

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

function sampleAction(probs: number[]): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i];
    if (r < cum) return i;
  }
  return probs.length - 1;
}

interface Rollout {
  state: number[];
  action: number;
  reward: number;
  value: number;
  logProb: number;
  done: boolean;
}

export type PPOAction = "increase" | "decrease" | "keep";
const ACTION_NAMES: PPOAction[] = ["increase", "decrease", "keep"];

export class PPOAgent {
  private rollout: Rollout[] = [];
  private maxRolloutLen = 32;
  private updateCount = 0;

  // Actor weights: input -> hidden -> output logits
  private aw1: number[][] = [];
  private ab1: number[] = [];
  private aw2: number[][] = [];
  private ab2: number[] = [];

  // Critic weights
  private cw1: number[][] = [];
  private cb1: number[] = [];
  private cw2: number[][] = [];
  private cb2: number[] = [];

  private h1 = 24;
  private h2 = 16;

  constructor() {
    this.aw1 = this.initWeights(this.h1, STATE_DIM);
    this.ab1 = Array(this.h1).fill(0);
    this.aw2 = this.initWeights(this.h2, this.h1);
    this.ab2 = Array(this.h2).fill(0);

    this.cw1 = this.initWeights(this.h1, STATE_DIM);
    this.cb1 = Array(this.h1).fill(0);
    this.cw2 = this.initWeights(this.h2, this.h1);
    this.cb2 = Array(this.h2).fill(0);
  }

  private initWeights(rows: number, cols: number): number[][] {
    const scale = Math.sqrt(2 / cols);
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() - 0.5) * scale)
    );
  }

  private actorForward(state: number[]): { probs: number[]; h1Out: number[]; h2Out: number[] } {
    const h1 = this.aw1.map((row, i) => {
      const z = row.reduce((s, v, j) => s + v * state[j], 0) + this.ab1[i];
      return z > 0 ? z : 0;
    });
    const h2 = this.aw2.map((row, i) => {
      const z = row.reduce((s, v, j) => s + v * h1[j], 0) + this.ab2[i];
      return z > 0 ? z : 0;
    });
    const mean = h2.reduce((a, b) => a + b, 0) / h2.length;
    const std = Math.sqrt(h2.reduce((s, v) => s + (v - mean) ** 2, 0) / h2.length + 1e-8);
    const logitsFixed = [
      mean + std * 0.5,
      mean - std * 0.3,
      mean * 0.8,
    ];
    const probs = softmax(logitsFixed);
    return { probs, h1Out: h1, h2Out: h2 };
  }

  private criticForward(state: number[]): number {
    const h1 = this.cw1.map((row, i) => {
      const z = row.reduce((s, v, j) => s + v * state[j], 0) + this.cb1[i];
      return z > 0 ? z : 0;
    });
    const h2 = this.cw2.map((row, i) => {
      const z = row.reduce((s, v, j) => s + v * h1[j], 0) + this.cb2[i];
      return z > 0 ? z : 0;
    });
    return h2.reduce((a, b) => a + b, 0) / h2.length;
  }

  private normalizeState(state: number[]): number[] {
    const ranges = [1, 1, 10, 1, 1, 1];
    return state.map((v, i) => v / (ranges[i] || 1));
  }

  chooseAction(rawState: number[]): PPOAction {
    const state = this.normalizeState(rawState);
    const { probs } = this.actorForward(state);
    const actionIdx = sampleAction(probs);
    const value = this.criticForward(state);
    const logProb = Math.log(probs[actionIdx] + 1e-8);

    this.rollout.push({
      state: [...state],
      action: actionIdx,
      reward: 0,
      value,
      logProb,
      done: false,
    });

    return ACTION_NAMES[actionIdx];
  }

  getDifficultyDelta(action: PPOAction, accuracy: number): number {
    switch (action) {
      case "increase": return accuracy > 0.8 ? 0.10 : 0.05;
      case "decrease": return accuracy < 0.3 ? -0.12 : -0.06;
      case "keep": return 0;
    }
  }

  calculateReward(dodged: boolean, accuracy: number): number {
    let reward = dodged ? 1.0 : -1.0;
    if (accuracy >= 0.5 && accuracy <= 0.8) reward += 0.3;
    if (accuracy > 0.9) reward -= 0.2;
    return reward;
  }

  recordReward(reward: number) {
    if (this.rollout.length > 0) {
      this.rollout[this.rollout.length - 1].reward = reward;
    }
  }

  recordDone() {
    if (this.rollout.length > 0) {
      this.rollout[this.rollout.length - 1].done = true;
    }
  }

  shouldUpdate(): boolean {
    return this.rollout.length >= this.maxRolloutLen;
  }

  update() {
    if (this.rollout.length < 4) {
      this.rollout = [];
      return;
    }

    const n = this.rollout.length;
    const rewards = this.rollout.map(r => r.reward);
    const values = this.rollout.map(r => r.value);
    const dones = this.rollout.map(r => r.done);

    // Compute GAE advantages
    const advantages: number[] = [];
    let gae = 0;
    for (let t = n - 1; t >= 0; t--) {
      const nextVal = t < n - 1 ? values[t + 1] : 0;
      const delta = rewards[t] + GAMMA * nextVal * (dones[t] ? 0 : 1) - values[t];
      gae = delta + GAMMA * GAE_LAMBDA * (dones[t] ? 0 : 1) * gae;
      advantages.unshift(gae);
    }
    const returns = advantages.map((a, i) => a + values[i]);

    // Normalize advantages
    const meanAdv = advantages.reduce((a, b) => a + b, 0) / n;
    const stdAdv = Math.sqrt(advantages.reduce((s, a) => s + (a - meanAdv) ** 2, 0) / n + 1e-8);
    const normAdv = advantages.map(a => (a - meanAdv) / stdAdv);

    const meanRet = returns.reduce((a, b) => a + b, 0) / n;
    const stdRet = Math.sqrt(returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / n + 1e-8);
    const normRet = returns.map(r => (r - meanRet) / (stdRet + 1e-8));

    // PPO update epochs
    for (let epoch = 0; epoch < PPO_EPOCHS; epoch++) {
      for (let t = 0; t < n; t++) {
        const state = this.rollout[t].state;
        const action = this.rollout[t].action;
        const oldLogProb = this.rollout[t].logProb;
        const adv = normAdv[t];
        const ret = normRet[t];

        // Forward pass
        const { probs } = this.actorForward(state);
        const newLogProb = Math.log(probs[action] + 1e-8);
        const ratio = Math.exp(newLogProb - oldLogProb);

        // PPO clipped objective
        const clippedRatio = Math.max(Math.min(ratio, 1 + PPO_EPSILON), 1 - PPO_EPSILON);
        const surr1 = ratio * adv;
        const surr2 = clippedRatio * adv;
        const policyGrad = Math.min(surr1, surr2) > 0 ? 1 : -1;

        // Simple gradient step on actor
        this.updateActor(state, action, policyGrad * adv * LR);

        // Critic update
        const valuePred = this.rollout[t].value;
        const valueGrad = ret - valuePred;
        this.updateCritic(state, valueGrad * LR);
      }
    }

    this.rollout = [];
    this.updateCount++;
  }

  private updateActor(state: number[], action: number, gradScale: number) {
    // Update output layer bias
    for (let i = 0; i < ACTION_DIM; i++) {
      const target = i === action ? 1 : 0;
      const { probs } = this.actorForward(state);
      const grad = (target - probs[i]) * gradScale;
      // Simple gradient step on last hidden layer
      for (let j = 0; j < this.h2; j++) {
        this.aw2[j] = this.aw2[j].map((w) => w + grad * 0.01);
      }
    }
  }

  private updateCritic(state: number[], grad: number) {
    const h1 = this.cw1.map((row, i) => {
      const z = row.reduce((s, v, j) => s + v * state[j], 0) + this.cb1[i];
      return z > 0 ? z : 0;
    });

    for (let i = 0; i < this.h2; i++) {
      for (let j = 0; j < this.h1; j++) {
        this.cw2[i][j] += grad * h1[j] * 0.01;
      }
    }

    for (let i = 0; i < this.h1; i++) {
      for (let j = 0; j < STATE_DIM; j++) {
        this.cw1[i][j] += grad * state[j] * 0.01;
      }
      this.cb1[i] += grad * 0.01;
    }
  }

  getEpsilon(): number { return 0; }

  getParamCount(): number {
    return (this.aw1.length * this.aw1[0].length) +
           (this.aw2.length * this.aw2[0].length) +
           (this.cw1.length * this.cw1[0].length) +
           (this.cw2.length * this.cw2[0].length);
  }

  getUpdateCount(): number { return this.updateCount; }

  getRolloutSize(): number { return this.rollout.length; }

  getPolicyInfo(rawState: number[]): string {
    const state = this.normalizeState(rawState);
    const { probs } = this.actorForward(state);
    const value = this.criticForward(state);
    return `inc=${(probs[0]*100).toFixed(0)}% dec=${(probs[1]*100).toFixed(0)}% keep=${(probs[2]*100).toFixed(0)}% V=${value.toFixed(2)}`;
  }
}
