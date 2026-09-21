#!/usr/bin/env node
/**
 * swarm-orchestrator.mjs
 * 
 * Multi-Agent Drone Swarm Coordinator
 * Dispatches and coordinates subtasks concurrently across Codex, Claude Code, and OpenCode,
 * supervising execution and synthesis with TypeSafe Jev (System One AI).
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// 1. Resolve TypeSafe API Key
function resolveApiKey() {
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;
  const localEnv = resolve(process.cwd(), '.env.local');
  if (existsSync(localEnv)) {
    const match = readFileSync(localEnv, 'utf-8').match(/TYPESAFE_API_KEY=([^\r\n]+)/);
    if (match) return match[1].trim();
  }
  const homeEnv = resolve(homedir(), '.env');
  if (existsSync(homeEnv)) {
    const match = readFileSync(homeEnv, 'utf-8').match(/TYPESAFE_API_KEY=([^\r\n]+)/);
    if (match) return match[1].trim();
  }
  return undefined;
}

async function askJev({ state, questions, model = 'jev-latest' }) {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY not found in env, .env.local, or ~/.env');
  }

  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ state, model, questions })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TypeSafe API error ${res.status}: ${errText}`);
  }

  return await res.json();
}

import { resolveCurrentTier, TIERS } from './config.mjs';

// 2. Parse CLI Arguments & Cost Mode
const activeTier = resolveCurrentTier();
const args = process.argv.slice(2);
let taskDescription = '';
let selectedAgents = [...activeTier.primaryAgents];
let opencodeModel = activeTier.opencodeModel;
let costMode = activeTier.name;
let jsonMode = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--mode' && args[i + 1]) {
    const requested = args[++i].toLowerCase();
    if (TIERS[requested]) {
      costMode = requested;
      opencodeModel = TIERS[requested].opencodeModel;
      selectedAgents = [...TIERS[requested].primaryAgents];
    }
  } else if (a === '--agents' && args[i + 1]) {
    selectedAgents = args[++i].split(',').map(s => s.trim().toLowerCase());
  } else if (a === '--model' || a === '-m') {
    opencodeModel = args[++i];
  } else if (a === '--json') {
    jsonMode = true;
  } else if (!a.startsWith('-')) {
    taskDescription = args.slice(i).join(' ');
    break;
  }
}

if (!taskDescription) {
  console.error(JSON.stringify({
    error: 'Missing task description',
    usage: 'node swarm-orchestrator.mjs [--mode economy|balanced|premium] [--agents opencode,codex,claude] [--model <opencode-model>] "Mission description..."'
  }));
  process.exit(1);
}

// 3. Spawning Agent Execution Runners
function runAgent(agentName, prompt) {
  return new Promise((resolveResult) => {
    const start = Date.now();
    let cmd = '';
    let cmdArgs = [];

    if (agentName === 'opencode') {
      cmd = 'opencode';
      cmdArgs = ['run', '-m', opencodeModel, prompt];
    } else if (agentName === 'codex') {
      cmd = 'codex';
      cmdArgs = ['exec', prompt];
    } else if (agentName === 'claude') {
      // Direct claude CLI if installed or simulated runner
      cmd = 'claude';
      cmdArgs = ['--print', prompt];
    } else {
      return resolveResult({
        agent: agentName,
        success: false,
        durationMs: 0,
        output: '',
        error: `Unknown agent type: ${agentName}`
      });
    }

    let stdout = '';
    let stderr = '';
    let proc;

    try {
      proc = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolveResult({
        agent: agentName,
        success: false,
        durationMs: Date.now() - start,
        output: '',
        error: `Failed to spawn ${cmd}: ${e.message}`
      });
    }

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      resolveResult({
        agent: agentName,
        success: false,
        durationMs: Date.now() - start,
        output: stdout,
        error: err.message
      });
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - start;
      const combined = (stdout + (code !== 0 ? `\nStderr:\n${stderr}` : '')).trim();
      resolveResult({
        agent: agentName,
        success: code === 0,
        exitCode: code,
        durationMs,
        output: combined || stderr.trim() || 'No output produced',
        error: code !== 0 ? `Process exited with code ${code}` : null
      });
    });
  });
}

// 4. Main Swarm Orchestration Loop
async function coordinateSwarm() {
  console.error(`\n🛸 [Drones Swarm] Orchestrating task: "${taskDescription}"`);
  console.error(`⚙️ Working Mode:    ${costMode.toUpperCase()} (Model: ${opencodeModel})`);
  console.error(`🛰️ Active Agents:   ${selectedAgents.join(', ')}`);

  // Step A: Jev Task Triage & Role Specialization
  console.error(`🔍 [Jev Supervisor] Analyzing task and specializing agent roles...`);
  let roleAssignment = {};
  try {
    const rolePlan = await askJev({
      model: 'jev-latest',
      state: {
        mission: taskDescription,
        availableAgents: selectedAgents
      },
      questions: {
        taskType: {
          type: 'choice',
          instructions: 'What primary domain category does this drone task belong to?',
          criteria: {
            algorithm_and_control: 'Flight dynamics, PID controllers, sensor fusion (IMU, Kalman), telemetry',
            navigation_and_pathfinding: 'Waypoint navigation, obstacle avoidance, GPS/SLAM coordinates, Haversine',
            mission_architecture: 'State machines, mission coordination, API interfaces, safety fail-safes',
            general_coding: 'General scripting, testing, utilities'
          }
        },
        codexSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for the OpenAI Codex agent?',
          criteria: {
            algorithmic_core: 'Implement mathematical algorithms and core logic functions',
            test_and_verification: 'Write unit tests, boundary validations, and edge case assertions',
            architecture_scaffold: 'Design classes, data contracts, and structural interfaces'
          }
        },
        claudeSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for the Claude Code agent?',
          criteria: {
            code_review_refactor: 'Refactor code, enforce clean architecture, and eliminate code smells',
            documentation_and_types: 'Add type annotations, docstrings, and architectural explanations',
            defensive_fail_safes: 'Analyze safety edge cases, battery failsafes, and exception resilience'
          }
        },
        opencodeSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for the OpenCode agent?',
          criteria: {
            implementation_generation: 'Generate modular implementation code for the task',
            telemetry_utilities: 'Write I/O utilities, logging, and data parsers',
            rapid_prototyping: 'Draft initial functional script prototype'
          }
        }
      }
    });

    roleAssignment = {
      domain: rolePlan.answers.taskType.choice,
      codexRole: rolePlan.answers.codexSpecialization.choice,
      claudeRole: rolePlan.answers.claudeSpecialization.choice,
      opencodeRole: rolePlan.answers.opencodeSpecialization.choice
    };
    console.error(`🎯 [Jev Supervisor] Roles assigned: Domain=${roleAssignment.domain}`);
  } catch (err) {
    console.error(`⚠️ [Jev Warning] Role assignment fallback: ${err.message}`);
    roleAssignment = { domain: 'general_coding' };
  }

  // Step B: Dispatch Concurrent Execution Across Swarm
  console.error(`🚀 [Drones Swarm] Launching simultaneous execution across agents...`);
  
  const tasks = selectedAgents.map(agent => {
    let tailoredPrompt = taskDescription;
    if (agent === 'codex') {
      tailoredPrompt = `[Role: ${roleAssignment.codexRole || 'Algorithmic Implementation'}]\nTask: ${taskDescription}\nProvide precise, robust code.`;
    } else if (agent === 'claude') {
      tailoredPrompt = `[Role: ${roleAssignment.claudeRole || 'Clean Architecture & Failsafes'}]\nTask: ${taskDescription}\nFocus on clean patterns and resilience.`;
    } else if (agent === 'opencode') {
      tailoredPrompt = `[Role: ${roleAssignment.opencodeRole || 'Implementation Prototype'}]\nTask: ${taskDescription}\nImplement practical modular solution.`;
    }
    return runAgent(agent, tailoredPrompt);
  });

  const swarmResults = await Promise.all(tasks);

  // Step C: Jev Evaluation, Cross-Audit & Selection
  console.error(`⚖️ [Jev Supervisor] Evaluating agent outputs and ranking best solution...`);
  
  const candidateSummaries = swarmResults.map(r => ({
    agent: r.agent,
    success: r.success,
    durationMs: r.durationMs,
    outputPreview: r.output.slice(0, 1000)
  }));

  try {
    const supervisorRes = await askJev({
      model: 'jev-latest',
      state: {
        missionTask: taskDescription,
        domain: roleAssignment.domain,
        agentOutputs: candidateSummaries
      },
      questions: {
        bestPerformingAgent: {
          type: 'choice',
          instructions: 'Which agent produced the highest quality, most accurate and complete solution for this drone task?',
          criteria: {
            opencode: 'OpenCode provided the best, most practical and complete solution',
            codex: 'Codex provided the superior algorithmic and precise code implementation',
            claude: 'Claude provided the most resilient, well-structured and elegant solution',
            none_acceptable: 'None of the outputs met the quality standards; revisions required'
          }
        },
        swarmConsensusScore: {
          type: 'score',
          instructions: 'Rate the technical consistency, safety, and correctness across the swarm outputs.',
          criteria: [
            'Conflicting or invalid approaches with severe errors or crashes',
            'Disparate implementations with minor inconsistencies or gaps',
            'Strong consensus on algorithm and structure with good implementations',
            'Exemplary agreement on drone standards, math, and robust fail-safes'
          ]
        },
        overallMissionFeasibility: {
          type: 'noul',
          instructions: 'Are the produced solutions safe and viable to be integrated into an autonomous drone workflow?'
        }
      }
    });

    const sv = supervisorRes.answers;
    const bestAgent = sv.bestPerformingAgent.choice;
    const winningResult = swarmResults.find(r => r.agent === bestAgent) || swarmResults[0];

    const finalReport = {
      mission: taskDescription,
      domain: roleAssignment.domain,
      supervisor: {
        selectedWinner: bestAgent,
        winnerConfidence: sv.bestPerformingAgent.confidence,
        consensusScore: sv.swarmConsensusScore.score,
        consensusMax: 3,
        missionFeasible: sv.overallMissionFeasibility.noul > 0.6,
        feasibilityProbability: sv.overallMissionFeasibility.noul
      },
      agentResults: swarmResults.map(r => ({
        agent: r.agent,
        success: r.success,
        durationMs: r.durationMs,
        isWinner: r.agent === bestAgent,
        outputLength: r.output.length
      })),
      winningOutput: winningResult.output
    };

    if (jsonMode) {
      console.log(JSON.stringify(finalReport, null, 2));
    } else {
      console.log('\n=============================================================');
      console.log('       🛸 DRONES SWARM COORDINATOR & JEV SUPERVISOR');
      console.log('=============================================================');
      console.log(`🎯 Misión:           ${taskDescription}`);
      console.log(`🌐 Dominio:          ${roleAssignment.domain.toUpperCase()}`);
      console.log(`🏆 Agente Ganador:   ${bestAgent.toUpperCase()} (Confianza: ${(sv.bestPerformingAgent.confidence * 100).toFixed(0)}%)`);
      console.log(`📊 Consenso Swarm:   ${sv.swarmConsensusScore.score.toFixed(2)} / 3`);
      console.log(`🛡️ Viabilidad Vuelo: ${sv.overallMissionFeasibility.noul > 0.6 ? 'APROBADO ✔' : 'REQUIERE REVISIÓN ❌'} (${(sv.overallMissionFeasibility.noul * 100).toFixed(0)}%)`);
      console.log('-------------------------------------------------------------');
      console.log('⏱️ DESEMPEÑO DEL ENJAMBRE:');
      for (const res of swarmResults) {
        const tag = res.agent === bestAgent ? '⭐ [GANADOR]' : '  ';
        console.log(`  ${tag} ${res.agent.padEnd(10)}: ${res.success ? '✔ Exitoso' : '❌ Fallo'} en ${res.durationMs}ms`);
      }
      console.log('-------------------------------------------------------------');
      console.log(`📄 SOLUCIÓN SELECCIONADA (${bestAgent.toUpperCase()}):`);
      console.log(winningResult.output);
      console.log('=============================================================\n');
    }

  } catch (err) {
    console.error(`❌ [Jev Error] Swarm supervision error: ${err.message}`);
    // Output fastest or first successful result
    const fallback = swarmResults.find(r => r.success) || swarmResults[0];
    console.log(fallback.output);
  }
}

coordinateSwarm();
