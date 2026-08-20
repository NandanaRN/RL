from stable_baselines3 import PPO
from runr_environment import RUNREnvironment


env = RUNREnvironment()

model = PPO(
    "MlpPolicy",
    env,
    verbose=1,
    learning_rate=0.0003,
    n_steps=256,
    batch_size=64,
    gamma=0.99,
    ent_coef=0.01,
)

print("Training RUNR RL agent...")

model.learn(
    total_timesteps=50000
)

model.save("runr_ppo")

print("Training complete!")
print("Saved as runr_ppo")