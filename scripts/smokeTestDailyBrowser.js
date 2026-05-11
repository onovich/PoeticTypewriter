import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const API_DIR = path.resolve(ROOT_DIR, 'api');

const API_PORT = Number.parseInt(process.env.POETIC_TYPEWRITER_BROWSER_API_PORT ?? '8788', 10);
const WEB_PORT = Number.parseInt(process.env.POETIC_TYPEWRITER_BROWSER_WEB_PORT ?? '4273', 10);
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_BASE_URL = `http://127.0.0.1:${WEB_PORT}/PoeticTypewriter/?mode=daily`;
const SERVER_BOOT_TIMEOUT_MS = 60000;
const STEP_TIMEOUT_MS = 30000;

const SCENARIOS = [
  {
    delays: [150, 210, 170, 230, 160],
    expectedEligibility: 'Ranked run',
    expectedFlags: [],
    expectedValidationStatus: 'accepted',
    name: 'accepted',
    noteIncludes: 'leaderboard-eligible',
    shouldAdvance: true,
  },
  {
    delays: [420],
    expectedEligibility: 'Not ranked',
    expectedFlags: ['Uniform input sample'],
    expectedValidationStatus: 'suspicious',
    name: 'suspicious',
    noteIncludes: 'Flagged as suspicious',
    shouldAdvance: true,
  },
  {
    delays: [20],
    expectedEligibility: 'Not ranked',
    expectedFlags: ['High CPS', 'Hard CPS limit'],
    expectedValidationStatus: 'rejected',
    name: 'rejected',
    noteIncludes: 'Run rejected by server validation',
    shouldAdvance: false,
  },
];

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function getSpawnSpec(command, args) {
  if (process.platform !== 'win32') {
    return {
      args,
      command,
    };
  }

  return {
    args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    command: 'cmd.exe',
  };
}

function getTaskKillCommand() {
  return process.platform === 'win32' ? 'taskkill.exe' : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runCommand({ args, cwd, env }) {
  const spawnSpec = getSpawnSpec(getNpmCommand(), args);
  const child = spawn(spawnSpec.command, spawnSpec.args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    shell: false,
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code));
  });

  if (exitCode !== 0) {
    throw new Error(`command failed: npm ${args.join(' ')}`);
  }
}

function startCommand({ args, cwd, env, label }) {
  const spawnSpec = getSpawnSpec(getNpmCommand(), args);
  const child = spawn(spawnSpec.command, spawnSpec.args, {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${label}] exited with code ${code}\n`);
    }
  });

  return child;
}

async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }

      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

function cleanupProcess(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    const taskKill = getTaskKillCommand();
    if (taskKill) {
      spawnSync(taskKill, ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      });
      return;
    }
  }

  child.kill('SIGTERM');
}

async function waitForDailyReady(page) {
  await page.goto(WEB_BASE_URL, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForFunction(
    () => {
      const bridge = window.__POETIC_TYPEWRITER__;
      const panel = document.querySelector('#challenge-stats-panel');

      return (
        bridge?.summary?.mode === 'daily-challenge' &&
        bridge.summary.status === 'awaiting-first-input' &&
        Boolean(bridge.snapshot?.currentItem?.text) &&
        panel?.dataset.leaderboardEligible === 'pending'
      );
    },
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );

  return page.evaluate(() => ({
    completedItems: window.__POETIC_TYPEWRITER__.snapshot.completedItems,
    currentItemId: window.__POETIC_TYPEWRITER__.snapshot.currentItem?.itemId ?? null,
    currentItemText: window.__POETIC_TYPEWRITER__.snapshot.currentItem?.text ?? null,
    progress: window.__POETIC_TYPEWRITER__.summary.progress,
    title: document.title,
  }));
}

async function typeText(page, text, delays) {
  await page.evaluate(
    async ({ nextText, nextDelays }) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      for (let index = 0; index < nextText.length; index += 1) {
        if (index > 0) {
          await sleep(nextDelays[(index - 1) % nextDelays.length]);
        }

        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            bubbles: true,
            key: nextText[index],
          }),
        );
      }
    },
    {
      nextDelays: delays,
      nextText: text,
    },
  );
}

async function waitForOutcome(page, expectedValidationStatus) {
  await page.waitForFunction(
    (status) => {
      const bridge = window.__POETIC_TYPEWRITER__;
      const panel = document.querySelector('#challenge-stats-panel');

      return (
        bridge?.summary?.validationStatus === status &&
        bridge.summary.status === 'awaiting-first-input' &&
        panel?.dataset.validationStatus === status
      );
    },
    expectedValidationStatus,
    { timeout: STEP_TIMEOUT_MS },
  );

  return page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const flags = Array.from(document.querySelectorAll('#challenge-stats-flags .challenge-stats-flag')).map((node) =>
      node.textContent.trim(),
    );
    const panel = document.querySelector('#challenge-stats-panel');

    return {
      completedItems: window.__POETIC_TYPEWRITER__.snapshot.completedItems,
      currentItemId: window.__POETIC_TYPEWRITER__.snapshot.currentItem?.itemId ?? null,
      dataLeaderboardEligible: panel?.dataset.leaderboardEligible ?? null,
      dataValidationStatus: panel?.dataset.validationStatus ?? null,
      eligibility: text('#challenge-stats-eligibility'),
      flags,
      note: text('#challenge-stats-note'),
      progress: text('#challenge-stats-progress'),
      summary: window.__POETIC_TYPEWRITER__.summary,
      title: document.title,
    };
  });
}

function assertScenarioResult(initialState, scenario, result) {
  assert(result.summary.validationStatus === scenario.expectedValidationStatus, `${scenario.name}: wrong validation status`);
  assert(result.dataValidationStatus === scenario.expectedValidationStatus, `${scenario.name}: wrong panel validation status`);
  assert(result.eligibility === scenario.expectedEligibility, `${scenario.name}: wrong eligibility label`);
  assert(result.title.includes(scenario.expectedValidationStatus), `${scenario.name}: title missing validation status`);
  assert(result.note?.includes(scenario.noteIncludes), `${scenario.name}: note missing expected text`);

  const expectedLeaderboardEligible = scenario.expectedValidationStatus === 'accepted';
  assert(result.summary.leaderboardEligible === expectedLeaderboardEligible, `${scenario.name}: wrong leaderboard eligibility`);
  assert(
    result.dataLeaderboardEligible === String(expectedLeaderboardEligible),
    `${scenario.name}: wrong panel leaderboard eligibility`,
  );

  for (const expectedFlag of scenario.expectedFlags) {
    assert(result.flags.includes(expectedFlag), `${scenario.name}: missing flag ${expectedFlag}`);
  }

  if (scenario.expectedFlags.length === 0) {
    assert(result.flags.length === 0, `${scenario.name}: expected no flags`);
  }

  if (scenario.shouldAdvance) {
    assert(result.completedItems === initialState.completedItems + 1, `${scenario.name}: completed count did not advance`);
    assert(result.currentItemId !== initialState.currentItemId, `${scenario.name}: current item did not advance`);
  } else {
    assert(result.completedItems === initialState.completedItems, `${scenario.name}: completed count should stay put`);
    assert(result.currentItemId === initialState.currentItemId, `${scenario.name}: current item should stay the same`);
  }
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const initialState = await waitForDailyReady(page);
    await typeText(page, initialState.currentItemText, scenario.delays);
    const result = await waitForOutcome(page, scenario.expectedValidationStatus);

    assertScenarioResult(initialState, scenario, result);

    return {
      dataLeaderboardEligible: result.dataLeaderboardEligible,
      dataValidationStatus: result.dataValidationStatus,
      eligibility: result.eligibility,
      flags: result.flags,
      name: scenario.name,
      note: result.note,
      progressAfter: result.progress,
      progressBefore: initialState.progress,
      title: result.title,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const runningChildren = [];
  let browser = null;

  try {
    await runCommand({
      args: ['run', 'db:bootstrap:local'],
      cwd: API_DIR,
    });

    const apiServer = startCommand({
      args: ['run', 'dev', '--', '--local', '--port', String(API_PORT)],
      cwd: API_DIR,
      label: 'api',
    });
    runningChildren.push(apiServer);

    await waitForUrl(`${API_BASE_URL}/health`, SERVER_BOOT_TIMEOUT_MS);

    const webServer = startCommand({
      args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(WEB_PORT), '--strictPort'],
      cwd: ROOT_DIR,
      env: {
        VITE_API_BASE_URL: API_BASE_URL,
      },
      label: 'web',
    });
    runningChildren.push(webServer);

    await waitForUrl(WEB_BASE_URL, SERVER_BOOT_TIMEOUT_MS);

    browser = await chromium.launch({
      headless: true,
    });

    const results = [];
    for (const scenario of SCENARIOS) {
      results.push(await runScenario(browser, scenario));
    }

    console.log(JSON.stringify({ scenarios: results }, null, 2));
  } finally {
    if (browser) {
      await browser.close();
    }

    for (const child of runningChildren.reverse()) {
      cleanupProcess(child);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});