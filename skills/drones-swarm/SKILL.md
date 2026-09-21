---
name: drones-swarm
description: >-
  Coordinates and distributes mission tasks concurrently among OpenAI Codex, Claude Code, and OpenCode
  agents simultaneously, using TypeSafe Jev (System One AI) as the real-time supervisor to specialize roles,
  evaluate candidate solutions, reach swarm consensus, and select the optimal implementation.
---

# 🛸 Drones Swarm Coordinator & Multi-Agent Supervisor

The **`drones-swarm`** skill orchestrates a heterogeneous multi-agent swarm composed of **OpenAI Codex**, **Claude Code**, and **OpenCode**, with **TypeSafe Jev (System One AI)** acting as the central intelligence and supervisory layer.

---

## 🏗️ Architecture & Orchestration Flow

```mermaid
flowchart TD
    MissionReq["User / Mission Task"] --> SupervisorTriage["1. Jev Supervisor Triage<br>(Role Specialization)"]
    
    subgraph SwarmExecution ["2. Concurrent Swarm Execution"]
        SupervisorTriage --> Codex["Codex Agent<br>(Algorithmic Core)"]
        SupervisorTriage --> Claude["Claude Code Agent<br>(Architecture & Failsafes)"]
        SupervisorTriage --> OpenCode["OpenCode Agent<br>(Practical Prototyping)"]
    end

    Codex --> Outputs["Candidate Solutions"]
    Claude --> Outputs
    OpenCode --> Outputs

    Outputs --> JevAudit["3. Jev Cross-Audit & Consensus<br>(Feasibility, Quality, Hallucination Check)"]
    JevAudit --> SelectedOutput["4. Winning Implementation Applied"]
```

---

## ⚡ Agent Role Specialization via Jev

1. **Codex Agent (`codex exec`)**:
   - Specialized in mathematical modeling, control theory (PID, LQR), state estimation, and rigorous unit testing.
2. **Claude Code Agent (`claude`)**:
   - Specialized in clean architecture, type contracts, boundary failsafes (e.g. Return-to-Home / low battery safety), and documentation.
3. **OpenCode Agent (`opencode run`)**:
   - Specialized in rapid prototyping, hardware I/O protocols (MAVLink, ROS2, serial telemetry), and modular utility functions.
4. **TypeSafe Jev Supervisor (`askJev`)**:
   - **System One decisions in ~250ms**:
     - Determines domain classification (`algorithm_and_control`, `navigation_and_pathfinding`, etc.).
     - Rates swarm consensus and mutual consistency (`swarmConsensusScore`).
     - Selects the best performing solution (`bestPerformingAgent`).
     - Flags drone flight safety compliance (`overallMissionFeasibility`).

---

## 🚀 Usage

### Run Simultaneous Swarm Execution

```bash
# Run with all active agents (OpenCode, Codex, Claude)
node skills/drones-swarm/scripts/swarm-orchestrator.mjs "Implement a quadcopter attitude Kalman filter with gyro and accelerometer fusion in Python"

# Run with specific agent subset
node skills/drones-swarm/scripts/swarm-orchestrator.mjs --agents opencode,codex "Write an obstacle avoidance algorithm using simulated 2D LiDAR range data"

# Output structured JSON for automated pipelines
node skills/drones-swarm/scripts/swarm-orchestrator.mjs --json "Calculate drone optimal path using Dubins paths"
```

### Direct Shortcut (npm)

```bash
npm run swarm "Design a failsafe protocol for signal loss in PX4 autopilot"
```

---

## 📊 Sample Output

```text
=============================================================
       🛸 DRONES SWARM COORDINATOR & JEV SUPERVISOR
=============================================================
🎯 Misión:           Implement a quadcopter attitude Kalman filter
🌐 Dominio:          ALGORITHM_AND_CONTROL
🏆 Agente Ganador:   CODEX (Confianza: 96%)
📊 Consenso Swarm:   2.85 / 3
🛡️ Viabilidad Vuelo: APROBADO ✔ (98%)
-------------------------------------------------------------
⏱️ DESEMPEÑO DEL ENJAMBRE:
  ⭐ [GANADOR] codex     : ✔ Exitoso en 2340ms
     opencode  : ✔ Exitoso en 1890ms
     claude    : ✔ Exitoso en 3100ms
-------------------------------------------------------------
📄 SOLUCIÓN SELECCIONADA (CODEX):
[Robust attitude estimation code]
=============================================================
```
