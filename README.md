# Drones Autonomous System

Repository for drone mission planning, flight control algorithms, and multi-model agent execution.

## 🛠️ Multi-Model Runner Skill (`skills/multi-model-runner`)

Integrates external model execution (`opencode run`, `codex exec`) with **TypeSafe Jev (System One AI)** evaluation.

### Quick Start:

```bash
# Run task using default fast model (mimo-v2.5-free) evaluated with Jev
node skills/multi-model-runner/scripts/model-runner.mjs "Write a PID controller for altitude hold in Python"

# Run with high-capacity model
node skills/multi-model-runner/scripts/model-runner.mjs -m opencode-go/qwen3.8-flash "Analyze flight log telemetry"
```
