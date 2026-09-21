# Drones Autonomous System

Repository for drone mission planning, flight control algorithms, and multi-model agent execution.

## 🛠️ Included Skills

### 1. Multi-Model Runner (`skills/multi-model-runner`)
Integrates external model execution (`opencode run`, `codex exec`) with **TypeSafe Jev (System One AI)** evaluation.

### 2. Drones Swarm Coordinator (`skills/drones-swarm`)
Simultaneously coordinates tasks across **OpenAI Codex**, **Claude Code**, and **OpenCode**, using **TypeSafe Jev** as supervisor for role specialization, cross-validation, and selecting the optimal solution.

### Quick Start:

```bash
# Multi-agent swarm execution with Jev supervisor
node skills/drones-swarm/scripts/swarm-orchestrator.mjs "Write a PID attitude controller in Python"

# Run single model task evaluated with Jev
node skills/multi-model-runner/scripts/model-runner.mjs "Write a Haversine waypoint distance formula"
```
