from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from stable_baselines3 import PPO
import numpy as np


app = FastAPI(
    title="RUNR RL API",
    description="Adaptive fitness game RL controller"
)

# Allow any origin to reach the RL API. In production
# this should be restricted to your domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


model = PPO.load("rl/runr_ppo.zip")


class PlayerState(BaseModel):
    intensity: float
    accuracy: float
    fatigue: float
    duration: float
    difficulty: float
    performance: float
    combo: float = 0.0
    steps: float = 0.0
    distance: float = 0.0


@app.get("/")
def root():
    return {
        "status": "RUNR RL ONLINE",
        "agent": "PPO",
        "observation": [
            "intensity",
            "accuracy",
            "fatigue",
            "duration",
            "difficulty",
            "performance",
            "combo",
        ],
    }


@app.post("/rl/decide")
def decide(state: PlayerState):

    observation = np.array([
        state.intensity,
        state.accuracy,
        state.fatigue,
        state.duration,
        state.difficulty,
        state.performance,
        state.combo,
    ], dtype=np.float32)

    action, _ = model.predict(
        observation,
        deterministic=True
    )

    action_names = [
        "DECREASE",
        "MAINTAIN",
        "INCREASE",
        "RECOVERY"
    ]

    action_name = action_names[int(action)]

    new_difficulty = state.difficulty

    if action_name == "INCREASE":
        new_difficulty += 1

    elif action_name == "DECREASE":
        new_difficulty -= 1

    elif action_name == "RECOVERY":
        new_difficulty -= 1

    new_difficulty = max(
        1,
        min(10, new_difficulty)
    )

    new_difficulty = int(round(new_difficulty))

    # -------------------------
    # BALANCE CALCULATION
    # -------------------------

    performance_score = state.performance
    fatigue_score = 100 - state.fatigue
    accuracy_score = state.accuracy
    combo_score = state.combo * 15

    # Fitness-oriented scoring: reward actual body movement
    steps_score = min(state.steps * 2, 30)
    distance_score = min(state.distance / 100, 20)

    balance = (
        0.30 * performance_score
        + 0.20 * accuracy_score
        + 0.25 * fatigue_score
        + 0.10 * combo_score
        + 0.10 * steps_score
        + 0.05 * distance_score
    )

    balance = max(0, min(100, balance))

    if balance >= 80:
        balance_status = "OPTIMAL"

    elif balance >= 60:
        balance_status = "STABLE"

    elif balance >= 40:
        balance_status = "UNSTABLE"

    else:
        balance_status = "OVERLOADED"

    return {
        "action": action_name,
        "difficulty": new_difficulty,
        "intensity": state.intensity,
        "fatigue": state.fatigue,
        "balance": round(balance, 2),
        "balance_status": balance_status,
    }