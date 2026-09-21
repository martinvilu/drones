# Drones: Multi-Service Agent Swarm Coordinator

> **Universal multi-agent coding coordinator for OpenCode, OpenAI Codex, GitHub Copilot, and Claude Code, supervised in real-time by TypeSafe Jev (System One AI).**

---

## 🎯 What is Drones?

**Drones** distributes and coordinates coding tasks simultaneously across multiple AI coding services and CLI tools:
- **OpenCode** (`opencode run`)
- **GitHub Copilot CLI** (`copilot -p`)
- **OpenAI Codex** (`codex exec`)
- **Claude Code** (`claude --print`)

Rather than relying on a single provider or running wasteful token-heavy debates between LLMs, **Drones uses TypeSafe Jev (System One AI)** as an ultra-fast (~250ms), objective supervisor to specialize roles, assess consensus, score code quality, and pick the best implementation.

---

## 💰 Cost Modes (Default: Economy)

Drones starts by default in **`economy`** mode ($0 tokens / free models):

1. **`economy`** *(Default)*: Uses free community models (e.g. `opencode/mimo-v2.5-free`, `nemotron-3.5-lightning-free`).
2. **`balanced`**: Fast, cost-efficient frontier models (e.g. `opencode-go/qwen3.8-flash` + GitHub Copilot).
3. **`premium`**: High-reasoning concurrent multi-agent swarm (Codex + Copilot + Claude + OpenCode Max).

Configure via CLI (`--mode balanced`), config file (`.dronesrc`), or `DRONES_MODE` environment variable.

---

## 🚀 Quick Start

```bash
# 1. Run task in default economy mode
node skills/drones-swarm/scripts/swarm-orchestrator.mjs "Write a debounced search hook in React with TypeScript"

# 2. Run across OpenCode and GitHub Copilot concurrently
node skills/drones-swarm/scripts/swarm-orchestrator.mjs --agents opencode,copilot "Write a JWT authentication middleware in Express"

# 3. Balanced mode with Jev evaluation
npm run swarm "Implement binary search tree with self-balancing rotation"
```
