#!/usr/bin/env node
/**
 * swarm-orchestrator.mjs
 * 
 * Multi-Service Coding Swarm Coordinator ("Drones")
 * Dispatches and coordinates software engineering tasks concurrently across:
 * - OpenCode (`opencode run`)
 * - OpenAI Codex (`codex exec`)
 * - GitHub Copilot (`copilot -p`)
 * - Claude Code (`claude --print`)
 * 
 * Supervised in real time by TypeSafe Jev (System One AI) to assign roles,
 * evaluate code solutions, verify correctness, and select the optimal implementation.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { resolveCurrentTier, TIERS } from './config.mjs';

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
    usage: 'node swarm-orchestrator.mjs [--mode economy|balanced|premium] [--agents opencode,codex,copilot,claude] [--model <opencode-model>] "Coding task instructions..."'
  }));
  process.exit(1);
}

// 3. Spawning Agent Execution Runners (Adapters for Multi-Service Providers)
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
    } else if (agentName === 'copilot') {
      // GitHub Copilot CLI non-interactive prompt mode (-p / --prompt)
      cmd = 'copilot';
      cmdArgs = ['-p', prompt];
    } else if (agentName === 'claude') {
      // Claude Code CLI non-interactive mode
      cmd = 'claude';
      cmdArgs = ['--print', prompt];
    } else {
      return resolveResult({
        agent: agentName,
        success: false,
        durationMs: 0,
        output: '',
        error: `Unknown agent service: ${agentName}`
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
  console.error(`\n🛸 [Drones Swarm] Orchestrating coding task across services...`);
  console.error(`📋 Task:            "${taskDescription}"`);
  console.error(`⚙️ Cost Mode:       ${costMode.toUpperCase()} (OpenCode Model: ${opencodeModel})`);
  console.error(`🛰️ Active Services: ${selectedAgents.join(', ')}`);

  // Step A: Jev Task Triage & Multi-Service Specialization
  console.error(`🔍 [Jev Supervisor] Triaging task and specializing service roles...`);
  let roleAssignment = {};
  try {
    const rolePlan = await askJev({
      model: 'jev-latest',
      state: {
        task: taskDescription,
        availableServices: selectedAgents
      },
      questions: {
        taskCategory: {
          type: 'choice',
          instructions: 'What primary software engineering category does this task belong to?',
          criteria: {
            backend_and_api: 'Backend logic, server endpoints, data persistence, and APIs',
            frontend_and_ui: 'Web components, styling, DOM interactions, frontend state',
            algorithms_and_math: 'Core computation, complex algorithms, data structures, parsing',
            testing_and_devops: 'Unit/integration tests, CI/CD, automation scripts, Docker',
            refactoring_and_typing: 'Code refactoring, type annotations, error handling, clean architecture'
          }
        },
        codexSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for OpenAI Codex?',
          criteria: {
            algorithmic_core: 'Implement mathematical algorithms and core logic functions',
            test_and_verification: 'Write unit tests, boundary validations, and edge case assertions',
            architecture_scaffold: 'Design classes, data contracts, and structural interfaces'
          }
        },
        copilotSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for GitHub Copilot?',
          criteria: {
            idiomatic_completion: 'Generate idiomatic, battle-tested standard code patterns and libraries',
            cli_and_integration: 'Produce CLI handlers, ecosystem tooling, and script integration',
            boilerplate_and_glue: 'Write clean boilerplate, data wrappers, and standard interfaces'
          }
        },
        claudeSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for Claude Code?',
          criteria: {
            code_review_refactor: 'Refactor code, enforce clean architecture, and eliminate code smells',
            documentation_and_types: 'Add type annotations, docstrings, and architectural explanations',
            defensive_robustness: 'Analyze safety edge cases, error resilience, and boundaries'
          }
        },
        opencodeSpecialization: {
          type: 'choice',
          instructions: 'What role is best suited for OpenCode?',
          criteria: {
            implementation_generation: 'Generate modular, practical implementation code',
            utility_scripts: 'Write I/O utilities, logging, and data parsers',
            rapid_prototyping: 'Draft initial working script prototype'
          }
        }
      }
    });

    roleAssignment = {
      category: rolePlan.answers.taskCategory.choice,
      codexRole: rolePlan.answers.codexSpecialization.choice,
      copilotRole: rolePlan.answers.copilotSpecialization.choice,
      claudeRole: rolePlan.answers.claudeSpecialization.choice,
      opencodeRole: rolePlan.answers.opencodeSpecialization.choice
    };
    console.error(`🎯 [Jev Supervisor] Task Category: ${roleAssignment.category}`);
  } catch (err) {
    console.error(`⚠️ [Jev Warning] Role assignment fallback: ${err.message}`);
    roleAssignment = { category: 'general_coding' };
  }

  // Step B: Dispatch Concurrent Execution Across Swarm
  console.error(`🚀 [Drones Swarm] Launching simultaneous execution across active services...`);
  
  const tasks = selectedAgents.map(agent => {
    let tailoredPrompt = taskDescription;
    if (agent === 'codex') {
      tailoredPrompt = `[Role: ${roleAssignment.codexRole || 'Algorithmic Implementation'}]\nTask: ${taskDescription}\nProvide concise, production-ready code.`;
    } else if (agent === 'copilot') {
      tailoredPrompt = `[Role: ${roleAssignment.copilotRole || 'Idiomatic Implementation'}]\nTask: ${taskDescription}\nProvide idiomatic and clean code.`;
    } else if (agent === 'claude') {
      tailoredPrompt = `[Role: ${roleAssignment.claudeRole || 'Clean Architecture & Robustness'}]\nTask: ${taskDescription}\nFocus on clean design and robust error handling.`;
    } else if (agent === 'opencode') {
      tailoredPrompt = `[Role: ${roleAssignment.opencodeRole || 'Modular Prototype'}]\nTask: ${taskDescription}\nProvide practical modular code.`;
    }
    return runAgent(agent, tailoredPrompt);
  });

  const swarmResults = await Promise.all(tasks);

  // Step C: Jev Evaluation, Cross-Audit & Selection
  console.error(`⚖️ [Jev Supervisor] Evaluating service outputs and selecting best solution...`);
  
  const candidateSummaries = swarmResults.map(r => ({
    service: r.agent,
    success: r.success,
    durationMs: r.durationMs,
    outputPreview: r.output.slice(0, 1000)
  }));

  try {
    const supervisorRes = await askJev({
      model: 'jev-latest',
      state: {
        task: taskDescription,
        category: roleAssignment.category,
        serviceOutputs: candidateSummaries
      },
      questions: {
        bestPerformingService: {
          type: 'choice',
          instructions: 'Which service generated the cleanest, most complete and functional solution?',
          criteria: {
            opencode: 'OpenCode generated the best practical implementation',
            codex: 'OpenAI Codex generated the superior algorithmic/structured implementation',
            copilot: 'GitHub Copilot generated the most idiomatic, clean implementation',
            claude: 'Claude Code generated the most resilient, well-architected solution',
            none_acceptable: 'None of the outputs met production quality'
          }
        },
        swarmConsensusScore: {
          type: 'score',
          instructions: 'Rate the technical consistency and agreement across the service outputs.',
          criteria: [
            'Conflicting or completely invalid code across services',
            'Different patterns with minor discrepancies or missing pieces',
            'Strong consensus on code architecture, libraries, and logic',
            'Exemplary consensus and production-grade software engineering'
          ]
        },
        codeQualityAndReadability: {
          type: 'score',
          instructions: 'Rate the overall quality and maintainability of the winning code.',
          criteria: [
            'Messy, broken syntax, or unhandled exceptions',
            'Working but unidiomatic with minor styling or logic gaps',
            'Clean, readable, well structured and idiomatic code',
            'Exemplary code with clear modularity, typing, and documentation'
          ]
        },
        readyToIntegrate: {
          type: 'noul',
          instructions: 'Is the winning code ready to be integrated into the codebase without fundamental rewrite?'
        }
      }
    });

    const sv = supervisorRes.answers;
    const bestService = sv.bestPerformingService.choice;
    const winningResult = swarmResults.find(r => r.agent === bestService) || swarmResults[0];

    const finalReport = {
      task: taskDescription,
      costMode,
      category: roleAssignment.category,
      supervisor: {
        selectedWinner: bestService,
        winnerConfidence: sv.bestPerformingService.confidence,
        consensusScore: sv.swarmConsensusScore.score,
        consensusMax: 3,
        codeQuality: sv.codeQualityAndReadability.score,
        codeQualityMax: 3,
        readyToIntegrate: sv.readyToIntegrate.noul > 0.6,
        readyProbability: sv.readyToIntegrate.noul
      },
      services: swarmResults.map(r => ({
        service: r.agent,
        success: r.success,
        durationMs: r.durationMs,
        isWinner: r.agent === bestService,
        outputLength: r.output.length
      })),
      winningOutput: winningResult.output
    };

    if (jsonMode) {
      console.log(JSON.stringify(finalReport, null, 2));
    } else {
      console.log('\n=============================================================');
      console.log('       🛸 DRONES MULTI-SERVICE SWARM & JEV SUPERVISOR');
      console.log('=============================================================');
      console.log(`📋 Tarea:             ${taskDescription}`);
      console.log(`📁 Categoría:         ${roleAssignment.category.toUpperCase()}`);
      console.log(`⚙️ Modo de Costo:     ${costMode.toUpperCase()}`);
      console.log(`🏆 Servicio Ganador:  ${bestService.toUpperCase()} (Confianza: ${(sv.bestPerformingService.confidence * 100).toFixed(0)}%)`);
      console.log(`📊 Consenso Swarm:    ${sv.swarmConsensusScore.score.toFixed(2)} / 3`);
      console.log(`⭐ Calidad Código:    ${sv.codeQualityAndReadability.score.toFixed(2)} / 3`);
      console.log(`🛡️ Listo para Aplicar:${sv.readyToIntegrate.noul > 0.6 ? ' SÍ ✔' : ' REQUIERE REVISIÓN ❌'} (${(sv.readyToIntegrate.noul * 100).toFixed(0)}%)`);
      console.log('-------------------------------------------------------------');
      console.log('⏱️ DESEMPEÑO POR SERVICIO:');
      for (const res of swarmResults) {
        const tag = res.agent === bestService ? '⭐ [GANADOR]' : '  ';
        console.log(`  ${tag} ${res.agent.padEnd(10)}: ${res.success ? '✔ Exitoso' : '❌ Fallo'} en ${res.durationMs}ms`);
      }
      console.log('-------------------------------------------------------------');
      console.log(`📄 SOLUCIÓN SELECCIONADA (${bestService.toUpperCase()}):`);
      console.log(winningResult.output);
      console.log('=============================================================\n');
    }

  } catch (err) {
    console.error(`❌ [Jev Error] Swarm supervision error: ${err.message}`);
    const fallback = swarmResults.find(r => r.success) || swarmResults[0];
    console.log(fallback.output);
  }
}

coordinateSwarm();
