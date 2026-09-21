/**
 * config.mjs
 * 
 * Cost tier configuration & agent presets for Drones multi-service swarm
 * Supports: OpenCode, OpenAI Codex, GitHub Copilot, Claude Code
 * Priority default: 'economy' (zero-cost / free-tier models first)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TIERS = {
  // Lowest cost / Free tier (Default entry mode)
  economy: {
    name: 'economy',
    description: 'Zero/Ultra-low cost models. Prioritizes free OpenCode community models and fast single-agent passes.',
    opencodeModel: 'opencode/mimo-v2.5-free',
    alternativeFreeModels: [
      'opencode/nemotron-3.5-lightning-free',
      'opencode/ling-3.0-flash-fin-free',
      'opencode/muse-spark-1.3-contributor-free'
    ],
    codexModel: 'gpt-4o-mini',
    copilotArgs: ['-p'],
    primaryAgents: ['opencode'] // Start single/lean with free models
  },

  // Balanced tier: Fast, cost-efficient frontier models across services
  balanced: {
    name: 'balanced',
    description: 'High speed and solid reasoning at moderate token cost. Combines OpenCode Flash + Copilot / Codex.',
    opencodeModel: 'opencode-go/qwen3.8-flash',
    codexModel: 'gpt-4o-mini',
    primaryAgents: ['opencode', 'copilot']
  },

  // Maximum capability: Full multi-service swarm with highest-reasoning models
  premium: {
    name: 'premium',
    description: 'Maximum software engineering capacity across all available providers.',
    opencodeModel: 'opencode-go/qwen3.8-max',
    codexModel: 'o3-mini',
    primaryAgents: ['opencode', 'codex', 'copilot', 'claude']
  }
};

export function resolveCurrentTier() {
  if (process.env.DRONES_MODE && TIERS[process.env.DRONES_MODE.toLowerCase()]) {
    return TIERS[process.env.DRONES_MODE.toLowerCase()];
  }

  const configPath = resolve(process.cwd(), '.dronesrc');
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (parsed.mode && TIERS[parsed.mode.toLowerCase()]) {
        return TIERS[parsed.mode.toLowerCase()];
      }
    } catch {}
  }

  // Default is unconditionally ECONOMY (free/low-cost first)
  return TIERS.economy;
}
