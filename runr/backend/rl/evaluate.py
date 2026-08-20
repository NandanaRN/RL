from stable_baselines3 import PPO
from runr_environment import RUNREnvironment


env = RUNREnvironment()

model = PPO.load("runr_ppo", env=env)

print("\nRUNR RL AGENT EVALUATION")
print("=" * 40)

obs, _ = env.reset()

for step in range(20):

    action, _ = model.predict(
        obs,
        deterministic=True
    )

    action_names = [
        "DECREASE",
        "MAINTAIN",
        "INCREASE",
        "RECOVERY"
    ]

    print(
        f"Step {step + 1:02d} | "
        f"Intensity: {obs[0]:.2f} | "
        f"Accuracy: {obs[1]:.2f} | "
        f"Fatigue: {obs[2]:.2f} | "
        f"Difficulty: {obs[4]:.1f} | "
        f"Combo: {obs[6]:.2f} | "
        f"Action: {action_names[int(action)]}"
    )

    obs, reward, terminated, truncated, _ = env.step(
        int(action)
    )

    if terminated or truncated:
        obs, _ = env.reset()

print("\nEvaluation complete.")