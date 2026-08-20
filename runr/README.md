# RUNR — AI Body-Controlled Endless Runner

> **Academic Project:** Applied Reinforcement Learning
> **Author:** Nandana R Nair | Reg No: 030 | MCA B

**RUNR** is a browser-based AI exergaming application where the **player's body becomes the controller**. Using real-time computer vision and a Proximal Policy Optimization (PPO) reinforcement learning agent, RUNR adapts the game's difficulty according to the player's performance.

The system combines **MediaPipe Pose Landmarker, real-time body movement detection, Phaser, React, FastAPI, and PPO reinforcement learning** to create an interactive workout experience without requiring handheld controllers, keyboards, or wearable sensors.

---

##  Live Demo

* **Frontend:** https://rl-cyan.vercel.app
* **Backend API:** https://rl-production-6eb6.up.railway.app
* **GitHub Repository:** https://github.com/NandanaRN/RL

---

##  Problem Statement

Traditional fitness and endless-runner games generally rely on:

* Keyboard, mouse, or handheld controllers
* Fixed difficulty progression
* Limited physical interaction
* No real-time understanding of player movement
* Generic gameplay that does not adapt to individual fitness or skill levels

This creates a gap between **gaming and physical exercise**, particularly for users who find conventional workout applications repetitive or difficult to engage with.

###  Proposed Solution

RUNR transforms an endless runner into a **body-controlled workout experience**.

A webcam captures the player's movements, MediaPipe extracts body landmarks, and the movement detection system converts physical actions into game controls. At the same time, a PPO reinforcement learning agent continuously evaluates player performance and adjusts the game difficulty.

The goal is to maintain an appropriate **challenge level** so that the player remains engaged while performing physical movements.

---

##  Key Features

###  Controller-Free Body Tracking

RUNR uses a standard webcam to detect the player's body without requiring external sensors or wearable devices.

* Real-time pose estimation
* 33 body landmarks
* Approximately 30 FPS processing
* Browser-based webcam access

###  Body-Based Game Controls

The player's physical movements directly control the character.

| Body Movement     | Game Action              |
| ----------------- | ------------------------ |
| Lean Left         | Move to left lane        |
| Neutral Position  | Stay in current lane     |
| Lean Right        | Move to right lane       |
| Jump / Raise Arms | Jump over obstacles      |
| Squat / Duck      | Avoid overhead obstacles |

###  Adaptive Reinforcement Learning

A PPO agent observes player performance and dynamically adjusts the game's difficulty.

The agent can:

* Increase difficulty
* Decrease difficulty
* Maintain current difficulty

This allows RUNR to provide a more personalized gameplay experience rather than following a fixed difficulty curve.

###  Endless Runner Gameplay

The game contains:

* Three running lanes
* Dynamic obstacle generation
* Low barriers
* Overhead obstacles
* Side obstacles
* Three-life system
* Real-time performance tracking
* Adaptive difficulty

---

#  System Architecture

```text
                    ┌─────────────────────┐
                    │      Webcam         │
                    │     ~30 FPS         │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ MediaPipe Pose      │
                    │ Landmarker           │
                    │ 33 Body Landmarks   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Pose Analyzer /     │
                    │ Movement Detector   │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
        ┌─────────────────┐        ┌──────────────────┐
        │ Game Controls   │        │ Player Metrics   │
        │                 │        │                  │
        │ Jump            │        │ Accuracy         │
        │ Duck            │        │ Streak           │
        │ Lean Left       │        │ Speed            │
        │ Lean Right      │        │ Recent Rate      │
        └────────┬────────┘        │ Experience       │
                 │                 └────────┬─────────┘
                 │                          │
                 │                          ▼
                 │                ┌──────────────────┐
                 │                │ PPO Actor-Critic │
                 │                │ Agent            │
                 │                └────────┬─────────┘
                 │                         │
                 │                         ▼
                 │                ┌──────────────────┐
                 │                │ Difficulty       │
                 │                │ Adaptation       │
                 │                └────────┬─────────┘
                 │                         │
                 └────────────┬────────────┘
                              ▼
                    ┌─────────────────────┐
                    │   RUNR Game Engine  │
                    │ Phaser + React      │
                    └─────────────────────┘
```

---

#  Reinforcement Learning

RUNR uses **Proximal Policy Optimization (PPO)** to adapt game difficulty according to player performance.

Instead of manually defining a fixed difficulty progression, the agent learns to select difficulty adjustments based on the current state of the player.

## State Space

The PPO agent observes six features:

```text
State = [
    accuracy,
    difficulty,
    streak,
    speed,
    recentRate,
    experience
]
```

| Feature      | Description                                  |
| ------------ | -------------------------------------------- |
| `accuracy`   | Percentage of obstacles successfully avoided |
| `difficulty` | Current game difficulty                      |
| `streak`     | Consecutive successful obstacle interactions |
| `speed`      | Current gameplay speed                       |
| `recentRate` | Recent performance rate                      |
| `experience` | Player's accumulated gameplay experience     |

---

## Action Space

The agent has three discrete actions:

```text
0 → Decrease Difficulty
1 → Maintain Difficulty
2 → Increase Difficulty
```

The selected action modifies the game's difficulty and consequently affects obstacle generation and gameplay intensity.

---

##  Reward Function

The reward function encourages successful obstacle avoidance while maintaining an appropriate challenge level.

| Event                            | Reward |
| -------------------------------- | -----: |
| Obstacle Dodged                  | `+1.0` |
| Obstacle Hit                     | `-1.0` |
| Appropriate Challenge / Fun Zone | `+0.3` |
| Under-Challenging / Too Easy     | `-0.2` |

The overall objective is to keep the player challenged without making the game unnecessarily difficult.

---

##  PPO Configuration

| Parameter           |           Value |
| ------------------- | --------------: |
| Algorithm           |             PPO |
| Network             |    Actor-Critic |
| Input Features      |               6 |
| Hidden Layers       |         24 → 16 |
| Output Actions      |               3 |
| Clip Range          |           `0.2` |
| Discount Factor `γ` |          `0.99` |
| GAE `λ`             |          `0.95` |
| Rollout Length      |        32 steps |
| State Observation   | Every 20 frames |

---

#  RUNR Gameplay & RL Workflow

```text
Player
   │
   ▼
Physical Body Movement
   │
   ▼
Webcam
   │
   ▼
MediaPipe Pose Detection
   │
   ▼
Movement Classification
   │
   ├── Jump
   ├── Duck
   ├── Lean Left
   └── Lean Right
          │
          ▼
      Game Action
          │
          ▼
    Obstacle Interaction
          │
          ▼
    Player Performance
          │
          ▼
     PPO Agent
          │
          ▼
 Difficulty Adjustment
          │
          ▼
Next Game State
```

This creates a continuous feedback loop between the **player, game environment, and reinforcement learning agent**.

---

# 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Phaser
* HTML5 Canvas

### Computer Vision

* MediaPipe Pose Landmarker
* Real-time webcam processing
* Body landmark analysis

### Reinforcement Learning

* Python
* PyTorch
* Proximal Policy Optimization (PPO)
* Actor-Critic architecture

### Backend

* FastAPI
* Uvicorn

### Deployment

* Vercel — Frontend
* Railway — Backend

---

# 🎮 How to Play

### 1. Open RUNR

Visit:

https://rl-cyan.vercel.app

### 2. Allow Camera Access

Allow webcam permissions when requested by the browser.

### 3. Position Yourself

Stand approximately **4–6 feet away** from the webcam.

Make sure your body and feet are visible within the camera frame.

### 4. Control the Character With Your Body

| Movement          | Action     |
| ----------------- | ---------- |
| Lean Left         | Move left  |
| Lean Right        | Move right |
| Jump / Raise Arms | Jump       |
| Squat / Duck      | Duck       |

### 5. Avoid Obstacles

Successfully avoid obstacles to maintain your lives and improve your performance.

As you play, the RL agent observes your performance and dynamically adjusts the difficulty.

---

#  Local Setup

## Prerequisites

Make sure the following are installed:

* Node.js `18+`
* Python `3.10+`
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/NandanaRN/RL.git
cd RL/runr
```

---

## 2. Install Frontend Dependencies

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

---

## 3. Setup Backend

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

### Windows

```bash
.\venv\Scripts\activate
```

### macOS / Linux

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

---

#  Environment Variables

Create a `.env` file inside the `runr/` directory.

```env
VITE_API_URL=http://localhost:8000
```

For production deployment, configure the environment variable with the deployed backend URL.

---

#  Project Structure

```text
RL/
│
└── runr/
    │
    ├── src/
    │   ├── components/
    │   │   └── Camera.tsx
    │   │
    │   ├── pose/
    │   │   ├── PoseDetector.ts
    │   │   └── MovementDetector.ts
    │   │
    │   └── App.tsx
    │
    ├── backend/
    │   ├── main.py
    │   ├── train.py
    │   ├── evaluate.py
    │   └── requirements.txt
    │
    ├── package.json
    ├── vite.config.ts
    ├── .env
    └── README.md
```

---

#  Trade-offs & Limitations

RUNR demonstrates the feasibility of combining computer vision, browser-based interaction, and reinforcement learning, but the current system has several limitations.

### Camera Dependency

The system requires a webcam with sufficient visibility of the player's body.

### Lighting Conditions

Poor lighting can reduce the reliability of pose estimation and movement classification.

### Camera Position

The player needs to remain within an appropriate distance and camera frame for accurate movement detection.

### Browser Permissions

Camera access depends on browser permissions and supported webcam APIs.

### RL Adaptation Time

The PPO policy requires sufficient interaction data before it can effectively adapt to an individual player's performance.

### Movement Classification

Fast or ambiguous movements may occasionally be classified incorrectly because the system relies on pose landmarks rather than dedicated motion sensors.

---

#  Future Enhancements

Potential future improvements include:

* Personalized player profiles
* More exercise-based movements
* Full-body workout sequences
* Better fatigue estimation
* Player-specific PPO policies
* Improved reward shaping
* More obstacle types
* Difficulty adaptation based on workout intensity
* Calorie expenditure estimation
* Multiplayer workout modes
* Mobile and tablet optimization
* Voice-based feedback
* Progress dashboards and workout history

---

#  Academic Contribution

RUNR demonstrates how **reinforcement learning can be applied beyond traditional games** by using an RL agent to personalize a physical activity experience.

The project integrates three major components:

```text
Computer Vision
       +
Interactive Game Environment
       +
Reinforcement Learning
       ↓
Adaptive AI Exergaming
```

Rather than using reinforcement learning simply to control a game character, RUNR uses the agent to **adapt the environment to the human player**.

This makes the project an example of a **human-in-the-loop reinforcement learning application**, where player behavior continuously influences the environment's future decisions.

---

#  License

This project was developed for **academic evaluation purposes** as part of the MCA program.

---
