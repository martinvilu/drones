#!/usr/bin/env node
/**
 * model-runner.mjs
 * 
 * Dispatch coding and reasoning prompts to OpenCode, OpenAI Codex, or other direct runners,
 * evaluate the output with TypeSafe Jev (System One), and optionally apply or report.
 * 
 * Providers supported:
 * 1. opencode: `opencode run -m <provider/model> --format default`
 * 2. codex:    `codex exec "<prompt>"`
 */

import { spawnSync, execSync } from 'node:child_process';
import { askJev } from './client.mjs';

import { resolveCurrentTier, TIERS } from './config.mjs';

function parseArgs() {
  const activeTier = resolveCurrentTier();
  const args = process.argv.slice(2);
  const options = {
    provider: 'opencode',
    mode: activeTier.name,
    model: activeTier.opencodeModel,
    task: '',
    evaluate: true,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mode' && args[i + 1]) {
      const req = args[++i].toLowerCase();
      if (TIERS[req]) {
        options.mode = req;
        options.model = TIERS[req].opencodeModel;
      }
    } else if (arg === '--provider' && args[i + 1]) {
      options.provider = args[++i];
    } else if (arg === '-m' || arg === '--model') {
      options.model = args[++i];
    } else if (arg === '--no-eval') {
      options.evaluate = false;
    } else if (arg === '--json') {
      options.json = true;
    } else if (!arg.startsWith('-')) {
      options.task = args.slice(i).join(' ');
      break;
    }
  }

  return options;
}

const opts = parseArgs();

if (!opts.task) {
  console.error(JSON.stringify({
    error: 'Missing task description',
    usage: 'node model-runner.mjs [--provider opencode|codex] [-m model_name] "Task instructions..."'
  }));
  process.exit(1);
}

// 1. Dispatch prompt to chosen backend
console.error(`[Runner] Executing task via ${opts.provider} (model: ${opts.model})...`);
let rawOutput = '';
const startTime = Date.now();

if (opts.provider === 'opencode') {
  const result = spawnSync('opencode', ['run', '-m', opts.model, opts.task], {
    encoding: 'utf-8',
    maxBuffer: 15 * 1024 * 1024
  });

  if (result.error) {
    console.error(JSON.stringify({ error: `Failed to spawn opencode: ${result.error.message}` }));
    process.exit(1);
  }
  rawOutput = (result.stdout || '') + (result.stderr || '');
} else if (opts.provider === 'codex') {
  const result = spawnSync('codex', ['exec', opts.task], {
    encoding: 'utf-8',
    maxBuffer: 15 * 1024 * 1024
  });

  if (result.error) {
    console.error(JSON.stringify({ error: `Failed to spawn codex: ${result.error.message}` }));
    process.exit(1);
  }
  rawOutput = (result.stdout || '') + (result.stderr || '');
} else if (opts.provider === 'copilot') {
  const result = spawnSync('copilot', ['-p', opts.task], {
    encoding: 'utf-8',
    maxBuffer: 15 * 1024 * 1024
  });

  if (result.error) {
    console.error(JSON.stringify({ error: `Failed to spawn copilot: ${result.error.message}` }));
    process.exit(1);
  }
  rawOutput = (result.stdout || '') + (result.stderr || '');
} else {
  console.error(JSON.stringify({ error: `Unsupported provider: ${opts.provider}. Available: opencode, codex, copilot` }));
  process.exit(1);
}

const durationMs = Date.now() - startTime;
const outputSnippet = rawOutput.length > 3000 ? rawOutput.slice(0, 3000) + '\n...[truncated for evaluation]...' : rawOutput;

// 2. Evaluate output using TypeSafe Jev (System One)
async function evaluateOutput() {
  if (!opts.evaluate) {
    console.log(rawOutput);
    return;
  }

  console.error(`[Jev] Evaluating output quality, completeness, and safety with Jev System One...`);

  try {
    const res = await askJev({
      model: 'jev-latest',
      state: {
        taskRequest: opts.task,
        provider: opts.provider,
        modelName: opts.model,
        durationMs,
        rawOutputSnippet: outputSnippet
      },
      questions: {
        taskCompleted: {
          type: 'noul',
          instructions: 'Does the model output effectively and cleanly solve or answer the requested task?'
        },
        outputQuality: {
          type: 'score',
          instructions: 'Rate the technical correctness, precision, and code quality of the model output.',
          criteria: [
            'Incomplete, broken code, hallucinated syntax, or non-functional rambling',
            'Partially working with missing imports, minor syntax flaws, or unhandled edges',
            'Good, clean and functioning implementation matching the specifications',
            'Exemplary, elegant, robust and well documented solution'
          ]
        },
        hasHallucinationOrLeak: {
          type: 'noul',
          instructions: 'Are there signs of hallucination, broken markdown, infinite loops, or leaked system tokens in the output?'
        },
        actionRecommendation: {
          type: 'choice',
          instructions: 'What action should the supervisory Antigravity agent take with this output?',
          criteria: {
            accept_and_apply: 'The output is solid, safe and ready to be integrated or applied directly',
            require_human_review: 'The output is helpful but requires minor verification or developer touches',
            retry_with_stronger_model: 'The output is inadequate or flawed; retry using a higher capability model (e.g. qwen3.8-max, deepseek-v4-pro)'
          }
        }
      }
    });

    const ans = res.answers;
    const report = {
      task: opts.task,
      provider: opts.provider,
      model: opts.model,
      durationMs,
      evaluation: {
        taskCompleted: ans.taskCompleted.noul > 0.6,
        confidence: ans.taskCompleted.confidence,
        qualityScore: ans.outputQuality.score,
        qualityMax: 3,
        cleanOutputProbability: 1 - ans.hasHallucinationOrLeak.noul,
        recommendedAction: ans.actionRecommendation.choice,
        decisionConfidence: ans.actionRecommendation.confidence
      },
      output: rawOutput.trim()
    };

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('\n============================================================');
      console.log('🤖 MULTI-MODEL EXECUTION & JEV EVALUATION REPORT');
      console.log('============================================================');
      console.log(`⚡ Proveedor/Modelo:  ${opts.provider} / ${opts.model} (${durationMs}ms)`);
      console.log(`🎯 Tarea:             ${opts.task}`);
      console.log(`✅ Tarea Cumplida:    ${report.evaluation.taskCompleted ? 'SÍ ✔' : 'NO ❌'} (Prob: ${(ans.taskCompleted.noul * 100).toFixed(0)}%)`);
      console.log(`⭐ Calidad Técnica:   ${ans.outputQuality.score.toFixed(2)} / 3 (Confianza: ${(ans.outputQuality.confidence * 100).toFixed(0)}%)`);
      console.log(`🛡️ Acción Sugerida:   ${ans.actionRecommendation.choice}`);
      console.log('------------------------------------------------------------');
      console.log('📄 SALIDA GENERADA:');
      console.log(rawOutput.trim());
      console.log('============================================================\n');
    }

  } catch (err) {
    console.error(`[Jev Warning] Failed to run Jev evaluation: ${err.message}`);
    console.log(rawOutput);
  }
}

evaluateOutput();
