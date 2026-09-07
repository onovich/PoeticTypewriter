import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const API_DIR = path.resolve(ROOT_DIR, 'api');
const REMOTE_URL = process.env.POETIC_TYPEWRITER_SMOKE_REMOTE_URL?.replace(/\/+$/, '');
const CLOUDFLARE = Boolean(REMOTE_URL) || process.argv.includes('--cloudflare');
const TEST_PROXY = process.env.POETIC_TYPEWRITER_TEST_PROXY;
if (REMOTE_URL && TEST_PROXY) {
  const { ProxyAgent, setGlobalDispatcher } = await import('../api/node_modules/undici/index.js');
  setGlobalDispatcher(new ProxyAgent(TEST_PROXY));
}

const API_PORT = Number.parseInt(process.env.POETIC_TYPEWRITER_BROWSER_API_PORT ?? '8788', 10);
const WEB_PORT = Number.parseInt(process.env.POETIC_TYPEWRITER_BROWSER_WEB_PORT ?? '4273', 10);
const API_BASE_URL = REMOTE_URL || `http://127.0.0.1:${API_PORT}${CLOUDFLARE ? '/PoeticTypewriter' : ''}`;
const WEB_BASE_URL = CLOUDFLARE ? `${API_BASE_URL}/?mode=daily` : `http://127.0.0.1:${WEB_PORT}/PoeticTypewriter/?mode=daily`;
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
    delays: [55, 85, 65, 95, 75],
    expectedEligibility: 'Not ranked',
    expectedFlags: ['High CPS'],
    expectedValidationStatus: 'suspicious',
    name: 'suspicious',
    noteIncludes: 'Flagged as suspicious',
    shouldAdvance: true,
    unexpectedFlags: ['Hard CPS limit'],
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

  child.expectedShutdown = false;

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on('exit', (code) => {
    if (child.expectedShutdown) {
      return;
    }

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

  child.expectedShutdown = true;

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

function startWebServer({ apiBaseUrl, label, port }) {
  return startCommand({
    args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    cwd: ROOT_DIR,
    env: {
      VITE_API_BASE_URL: apiBaseUrl,
    },
    label,
  });
}

async function readPanelState(page) {
  return page.evaluate(() => {
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const panel = document.querySelector('#challenge-stats-panel');
    const flags = Array.from(document.querySelectorAll('#challenge-stats-flags .challenge-stats-flag')).map((node) =>
      node.textContent.trim(),
    );

    return {
      allTimeBest: text('#challenge-stats-all-time-best'),
      allTimeRank: text('#challenge-stats-all-time-rank'),
      completedItems: window.__POETIC_TYPEWRITER__?.snapshot?.completedItems ?? null,
      currentItemId: window.__POETIC_TYPEWRITER__?.snapshot?.currentItem?.itemId ?? null,
      currentItemText: window.__POETIC_TYPEWRITER__?.snapshot?.currentItem?.text ?? null,
      dataLeaderboardEligible: panel?.dataset.leaderboardEligible ?? null,
      dataValidationStatus: panel?.dataset.validationStatus ?? null,
      dailyBest: text('#challenge-stats-daily-best'),
      dailyRank: text('#challenge-stats-daily-rank'),
      eligibility: text('#challenge-stats-eligibility'),
      flags,
      note: text('#challenge-stats-note'),
      panelHidden: panel?.hidden ?? null,
      progress: text('#challenge-stats-progress'),
      recent: text('#challenge-stats-recent'),
      statusLabel: text('#challenge-stats-status'),
      summary: window.__POETIC_TYPEWRITER__?.summary ?? null,
      title: document.title,
    };
  });
}

function assertDailyReadyState(initialState) {
  assert(initialState.panelHidden === false, 'daily ready: stats panel should be visible');
  assert(initialState.title.includes('awaiting-first-input'), 'daily ready: title missing awaiting-first-input');
  assert(initialState.statusLabel === 'awaiting first input', 'daily ready: wrong status label');
  assert(initialState.dataLeaderboardEligible === 'pending', 'daily ready: leaderboard state should be pending');
  assert(initialState.dataValidationStatus === 'idle', 'daily ready: validation status should be idle');
  assert(initialState.eligibility === 'Rank status pending', 'daily ready: wrong eligibility label');
  assert(initialState.note === 'The timer starts on the first accepted input.', 'daily ready: wrong note');
  assert(initialState.recent === '--', 'daily ready: recent should be empty');
  assert(initialState.dailyBest === '--', 'daily ready: daily best should be empty');
  assert(initialState.dailyRank === '--', 'daily ready: daily rank should be empty');
  assert(initialState.allTimeBest === '--', 'daily ready: all-time best should be empty');
  assert(initialState.allTimeRank === '--', 'daily ready: all-time rank should be empty');
  assert(initialState.flags.length === 0, 'daily ready: should not show suspicious flags');
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

  return readPanelState(page);
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

  return readPanelState(page);
}

async function waitForFallbackFree(page) {
  await page.route(`${API_BASE_URL}/v1/challenge/today`, async (route) => {
    await route.abort('failed');
  });

  await page.goto(WEB_BASE_URL, {
    waitUntil: 'domcontentloaded',
  });

  await page.waitForFunction(
    () => {
      const bridge = window.__POETIC_TYPEWRITER__;
      const panel = document.querySelector('#challenge-stats-panel');

      return (
        bridge?.mode === 'free' &&
        bridge.summary?.mode === 'free' &&
        bridge.summary?.status === 'fallback-free' &&
        document.title === 'Poetic Typewriter | Free' &&
        panel?.hidden === true
      );
    },
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );

  return page.evaluate(() => ({
    bridgeMode: window.__POETIC_TYPEWRITER__?.mode ?? null,
    panelHidden: document.querySelector('#challenge-stats-panel')?.hidden ?? null,
    snapshotMode: window.__POETIC_TYPEWRITER__?.snapshot?.mode ?? null,
    summary: window.__POETIC_TYPEWRITER__?.summary ?? null,
    title: document.title,
  }));
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

  for (const unexpectedFlag of scenario.unexpectedFlags ?? []) {
    assert(!result.flags.includes(unexpectedFlag), `${scenario.name}: unexpected flag ${unexpectedFlag}`);
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
    assertDailyReadyState(initialState);
    if (CLOUDFLARE) {
      const cookie = (await context.cookies()).find((entry) => entry.name === 'pt_player');
      assert(cookie?.path === '/PoeticTypewriter/', 'player cookie must stay within the game subpath');
      assert(cookie.httpOnly, 'player cookie must be HttpOnly');
    }
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

async function runFallbackFreeScenario(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const result = await waitForFallbackFree(page);

    assert(result.bridgeMode === 'free', 'fallback free: bridge mode should be free');
    assert(result.snapshotMode === 'free', 'fallback free: snapshot mode should be free');
    assert(result.summary?.status === 'fallback-free', 'fallback free: wrong runtime status');
    assert(result.summary?.progress === null, 'fallback free: progress should be cleared');
    assert(result.panelHidden === true, 'fallback free: stats panel should be hidden');
    assert(result.title === 'Poetic Typewriter | Free', 'fallback free: wrong title');

    return {
      bridgeMode: result.bridgeMode,
      name: 'fallback-free',
      panelHidden: result.panelHidden,
      status: result.summary?.status ?? null,
      title: result.title,
    };
  } finally {
    await context.close();
  }
}

async function runViewportChecks(browser) {
  const results = [];
  const directory = path.join(ROOT_DIR, '.local', 'screenshots');
  mkdirSync(directory, { recursive: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    try {
      await waitForDailyReady(page);
      await page.screenshot({ path: path.join(directory, `daily-${viewport.width}.png`), fullPage: true });
      const layout = await page.evaluate(() => {
        const poem = document.querySelector('#target-poem').getBoundingClientRect();
        const panel = document.querySelector('.challenge-stats-shell').getBoundingClientRect();
        const keyboard = document.querySelector('#keyboard').getBoundingClientRect();
        return { poemTop: poem.top, poemBottom: poem.bottom, panelBottom: panel.bottom,
          keyboardTop: keyboard.top, keyboardBottom: keyboard.bottom,
          scrollWidth: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight };
      });
      assert(layout.poemTop >= layout.panelBottom, `viewport ${viewport.width}: stats overlap the poem: ${JSON.stringify(layout)}`);
      assert(layout.poemBottom <= layout.keyboardTop, `viewport ${viewport.width}: poem overlaps keyboard`);
      assert(layout.scrollWidth <= layout.width, `viewport ${viewport.width}: horizontal overflow`);
      assert(layout.keyboardBottom <= layout.height, `viewport ${viewport.width}: keyboard is clipped`);
      assert(await page.locator('[data-mode="daily-challenge"]').getAttribute('aria-current') === 'page', 'daily tab is selected');
      assert(await page.locator('#challenge-elapsed').textContent() === '0.0 s', 'timer starts at zero');
      const firstCharacter = await page.evaluate(() => window.__POETIC_TYPEWRITER__.snapshot.currentItem.text[0]);
      await page.keyboard.type(firstCharacter);
      await page.waitForFunction(() => parseFloat(document.querySelector('#challenge-elapsed').textContent) >= 0.2);
      const elapsedBefore = await page.locator('#challenge-elapsed').textContent();
      await page.waitForFunction(previous => document.querySelector('#challenge-elapsed').textContent !== previous, elapsedBefore);
      await page.locator('[data-mode="free"]').click();
      await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary?.mode === 'free');
      assert(await page.locator('[data-mode="free"]').getAttribute('aria-current') === 'page', 'free tab is selected');
      await page.locator('#stage').click({ position: { x: 4, y: 4 } });
      await page.keyboard.type('a');
      await page.waitForFunction(() => document.querySelectorAll('#balloons-container .balloon-char').length > 0);
      await page.screenshot({ path: path.join(directory, `free-${viewport.width}.png`), fullPage: true });
      await page.locator('[data-mode="daily-challenge"]').click();
      await page.waitForFunction(() => window.__POETIC_TYPEWRITER__?.summary?.status === 'awaiting-first-input');
      assert(await page.locator('#challenge-elapsed').textContent() === '0.0 s', 'switching back resets timer');
      results.push({ viewport, layout, freeInput: 'passed', modeTabs: 'passed', liveTimer: 'passed' });
    } finally { await context.close(); }
  }
  return results;
}

async function main() {
  const runningChildren = [];
  let browser = null;

  try {
    if (REMOTE_URL && !new URL(REMOTE_URL).hostname.endsWith('.workers.dev')) {
      throw new Error('Remote smoke writes test scores: use an isolated workers.dev staging environment.');
    }
    if (!REMOTE_URL) {
      await runCommand({
        args: ['run', CLOUDFLARE ? 'cloudflare:migrate:local' : 'db:bootstrap:local'], cwd: API_DIR,
      });
      if (CLOUDFLARE) {
        await runCommand({ args: ['run', 'build:cloudflare'], cwd: ROOT_DIR });
      }
      const apiServer = startCommand({
        args: ['run', CLOUDFLARE ? 'cloudflare:dev' : 'dev', '--', '--local', '--port', String(API_PORT)],
        cwd: API_DIR, label: 'api',
      });
      runningChildren.push(apiServer);
    }

    await waitForUrl(`${API_BASE_URL}/health`, SERVER_BOOT_TIMEOUT_MS);

    if (!CLOUDFLARE) {
      const webServer = startWebServer({ apiBaseUrl: API_BASE_URL, label: 'web', port: WEB_PORT });
      runningChildren.push(webServer);
    }

    await waitForUrl(WEB_BASE_URL, SERVER_BOOT_TIMEOUT_MS);
    if (CLOUDFLARE) {
      const redirect = await fetch(`${API_BASE_URL}?mode=daily`, { redirect: 'manual' });
      assert(redirect.status === 308, 'subpath without slash should redirect');
      assert(redirect.headers.get('Location') === WEB_BASE_URL, 'redirect should preserve the daily mode');
      const origin = new URL(API_BASE_URL).origin;
      for (const pathname of ['/', '/v1/challenge/today', '/PoeticTypewriterOther/']) {
        assert((await fetch(origin + pathname)).status === 404, `application leaked outside subpath: ${pathname}`);
      }
    }

    browser = await chromium.launch({
      headless: true,
      ...(REMOTE_URL && TEST_PROXY ? { proxy: { server: TEST_PROXY } } : {}),
    });

    const results = [];
    for (const scenario of SCENARIOS) {
      results.push(await runScenario(browser, scenario));
    }

    const fallbackResult = await runFallbackFreeScenario(browser);
    const viewports = CLOUDFLARE ? await runViewportChecks(browser) : [];

    console.log(JSON.stringify({ fallback: fallbackResult, scenarios: results, viewports }, null, 2));
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
