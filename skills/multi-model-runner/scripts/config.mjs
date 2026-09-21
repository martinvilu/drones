/**
 * config.mjs
 * 
 * Cost tier configuration & model presets for Drones autonomous swarm
 * Priority default: 'economy' (low-cost / free tier models first)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TIERS = {
  // Lowest cost / Free tier (Default entry mode)
  economy: {
    name: 'economy',
    description: 'Zero/Ultra-low cost models. Fast turnaround and minimal token expense.',
    opencodeModel: 'opencode/mimo-v2.5-free',
    alternativeFreeModels: [
      'opencode/nemotron-3.5-lightning-free',
      'opencode/ling-3.0-flash-fin-free',
      'opencode/muse-spark-1.3-contributor-free'
    ],
    codexModel: 'gpt-4o-mini',
    claudeModel: 'claude-3-5-haiku-latest',
    primaryAgents: ['opencode'] // Start single/lean or with free models
  },

  // Balanced tier: Cost-efficient fast frontier models
  balanced: {
    name: 'balanced',
    description: 'Great speed and higher reasoning capability at moderate token cost.',
    opencodeModel: 'opencode-go/qwen3.8-flash',
    codexModel: 'gpt-4o-mini',
    claudeModel: 'claude-3-5-sonnet-latest',
    primaryAgents: ['opencode', 'codex']
  },

  // Maximum capability: Frontier high-reasoning models (escalated via Jev recommendation)
  premium: {
    name: 'premium',
    description: 'Maximum mathematical, architectural, and reasoning capacity.',
    opencodeModel: 'opencode-go/qwen3.8-max',
    codexModel: 'o3-mini',
    claudeModel: 'claude-3-7-sonnet-latest',
    primaryAgents: ['opencode', 'codex', 'claude']
  }
};

export function resolveCurrentTier() {
  // Check env variable
  if (process.env.DRONES_MODE && TIERS[process.env.DRONES_MODE.toLowerCase()]) {
    return TIERS[process.env.DRONES_MODE.toLowerCase()];
  }

  // Check local .dronesrc or .env.local
  const configPath = resolve(process.cwd(), '.dronesrc');
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (parsed.mode && TIERS[parsed.mode.toLowerCase()]) {
        return TIERS[parsed.mode.toLowerCase()];
      }
    } catch {}
  }

  // Default is unconditionally ECONOMY (low cost first)
  return TIERS.economy;
}
