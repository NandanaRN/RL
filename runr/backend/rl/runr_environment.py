import gymnasium as gym
from gymnasium import spaces
import numpy as np


class RUNREnvironment(gym.Env):
    """
    RUNR adaptive workout environment.

    The agent observes the player's current
    workout condition and chooses how to adapt
    game difficulty.

    Observation (7 dims):
        0: intensity      (0..1)   - how hard the run feels
        1: accuracy       (0..1)   - successful moves / moves that mattered
        2: fatigue        (0..1)   - accumulated strain
        3: duration       (0..1)   - session progress
        4: difficulty     (1..10)  - current level
        5: performance    (0..1)   - score/pace health
        6: combo          (0..1)   - consecutive successful moves

    Action (4):
        0: decrease difficulty
        1: maintain
        2: increase difficulty
        3: recovery mode
    """

    metadata = {"render_modes": []}

    def __init__(self):
        super().__init__()

        self.observation_space = spaces.Box(
            low=np.array([
                0.0,   # intensity
                0.0,   # accuracy
                0.0,   # fatigue
                0.0,   # duration
                1.0,   # difficulty
                0.0,   # performance
                0.0,   # combo
            ], dtype=np.float32),

            high=np.array([
                1.0,
                1.0,
                1.0,
                1.0,
                10.0,
                1.0,
                1.0,
            ], dtype=np.float32),
        )

        self.action_space = spaces.Discrete(4)

        self.state = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        self.state = np.array([
            0.5,   # intensity
            0.8,   # accuracy
            0.2,   # fatigue
            0.0,   # duration
            3.0,   # difficulty
            0.7,   # performance
            0.4,   # combo
        ], dtype=np.float32)

        return self.state, {}

    def step(self, action):

        intensity = self.state[0]
        accuracy = self.state[1]
        fatigue = self.state[2]
        duration = self.state[3]
        difficulty = self.state[4]
        performance = self.state[5]
        combo = self.state[6]

        # Simulate how the player responds
        # to the agent's decision.

        if action == 0:
            # Decrease difficulty
            difficulty -= 1
            intensity -= 0.08
            fatigue -= 0.05
            combo = max(0.0, combo - 0.05)

        elif action == 1:
            # Maintain
            intensity += 0.01
            fatigue += 0.02
            combo = min(1.0, combo + 0.08)

        elif action == 2:
            # Increase difficulty
            difficulty += 1
            intensity += 0.08
            fatigue += 0.06
            combo = min(1.0, combo + 0.15)

        elif action == 3:
            # Recovery
            intensity -= 0.12
            fatigue -= 0.12
            combo = max(0.0, combo - 0.20)

        # Keep values within realistic bounds
        intensity = np.clip(intensity, 0.0, 1.0)
        fatigue = np.clip(fatigue, 0.0, 1.0)
        difficulty = np.clip(difficulty, 1.0, 10.0)
        combo = np.clip(combo, 0.0, 1.0)

        # Performance is highest when
        # intensity is challenging but sustainable.
        target_intensity = 0.65

        performance = 1.0 - abs(
            intensity - target_intensity
        )

        # Chained moves lift performance.
        performance += combo * 0.15

        performance = np.clip(
            performance,
            0.0,
            1.0
        )

        # Accuracy degrades under heavy fatigue.
        accuracy = np.clip(
            accuracy - max(0, fatigue - 0.7) * 0.05,
            0.0,
            1.0
        )

        duration = np.clip(
            duration + 0.01,
            0.0,
            1.0
        )

        self.state = np.array([
            intensity,
            accuracy,
            fatigue,
            duration,
            difficulty,
            performance,
            combo,
        ], dtype=np.float32)

        # Reward:
        # Encourage effective intensity,
        # good movement and sustainable fatigue.
        reward = (
            performance * 2.0
            + accuracy
            - fatigue * 1.2
        )

        # Landing in the sweet spot is rewarded.
        if 0.6 <= intensity <= 0.7:
            reward += 0.3

        # Avoid runaway difficulty.
        if difficulty >= 9:
            reward -= 1.0

        # Penalize excessive fatigue.
        if fatigue > 0.85:
            reward -= 2.0

        terminated = False

        # End simulated session after enough time.
        truncated = duration >= 1.0

        return (
            self.state,
            float(reward),
            terminated,
            truncated,
            {},
        )