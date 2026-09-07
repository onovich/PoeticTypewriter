import { APP_MODES, resolveAppMode } from '../../data/modes.js';
import { FREE_MODE_POEMS } from '../../data/freePoems.js';
import { mountApp } from '../../App.js';
import { createChallengeSessionStore } from '../services/challengeSessionStore.js';
import { CompetitionClient } from '../services/competitionClient.js';

function getRuntimeConfig() {
  return {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim(),
    defaultMode: import.meta.env.VITE_DEFAULT_MODE ?? APP_MODES.FREE,
    enableRuntimeLogs: import.meta.env.DEV || import.meta.env.VITE_ENABLE_RUNTIME_LOGS === 'true',
  };
}

function getDailyProgressLabel(snapshot) {
  if (!snapshot.totalItems) {
    return '0/0';
  }

  if (!snapshot.currentItem) {
    return `${snapshot.totalItems}/${snapshot.totalItems}`;
  }

  return `${snapshot.completedItems + 1}/${snapshot.totalItems}`;
}

function buildDocumentTitle(snapshot) {
  if (snapshot.mode !== APP_MODES.DAILY_CHALLENGE) {
    return 'Poetic Typewriter | Free';
  }

  const parts = ['Poetic Typewriter', `Daily ${getDailyProgressLabel(snapshot)}`];

  if (snapshot.stats.recentCps !== null) {
    parts.push(`${snapshot.stats.recentCps.toFixed(2)} cps`);
  }

  if (snapshot.stats.validationStatus) {
    parts.push(snapshot.stats.validationStatus);
  } else if (snapshot.status) {
    parts.push(snapshot.status);
  }

  return parts.join(' | ');
}

function buildRuntimeSummary(snapshot) {
  return {
    completedItems: snapshot.completedItems,
    currentItem: snapshot.currentItem?.text ?? null,
    dailyBestCps: snapshot.stats.dailyBestCps,
    dailyRank: snapshot.stats.dailyRank,
    error: snapshot.error,
    leaderboardEligible: snapshot.stats.leaderboardEligible,
    mode: snapshot.mode,
    progress: snapshot.mode === APP_MODES.DAILY_CHALLENGE ? getDailyProgressLabel(snapshot) : null,
    recentCps: snapshot.stats.recentCps,
    status: snapshot.status,
    validationStatus: snapshot.stats.validationStatus,
  };
}

function createRuntimeSignature(snapshot) {
  return JSON.stringify({
    completedItems: snapshot.completedItems,
    currentItemId: snapshot.currentItem?.itemId ?? null,
    errorCode: snapshot.error?.code ?? null,
    leaderboardEligible: snapshot.stats.leaderboardEligible,
    mode: snapshot.mode,
    recentCps: snapshot.stats.recentCps,
    status: snapshot.status,
    validationStatus: snapshot.stats.validationStatus,
  });
}

function formatCpsValue(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${value.toFixed(2)} cps` : '--';
}

function formatRankValue(value) {
  return Number.isInteger(value) && value > 0 ? `#${value}` : '--';
}

function formatStatusLabel(snapshot) {
  if (snapshot.error?.code) {
    return 'error';
  }

  if (snapshot.stats.validationStatus) {
    return snapshot.stats.validationStatus.replace(/-/g, ' ');
  }

  return (snapshot.status || 'idle').replace(/-/g, ' ');
}

function formatLeaderboardEligibility(snapshot) {
  if (snapshot.stats.leaderboardEligible === true) {
    return 'Ranked run';
  }

  if (snapshot.stats.leaderboardEligible === false) {
    return 'Not ranked';
  }

  return 'Rank status pending';
}

function formatSuspiciousFlag(flag) {
  switch (flag) {
    case 'elapsed_below_server_floor':
      return 'Below server floor';
    case 'expired_token':
      return 'Expired token';
    case 'hard_cps_limit':
      return 'Hard CPS limit';
    case 'high_cps':
      return 'High CPS';
    case 'high_submission_rate':
      return 'High submission rate';
    case 'uniform_input_sample':
      return 'Uniform input sample';
    default:
      return flag.replace(/_/g, ' ');
  }
}

function syncSuspiciousFlags(flagsElement, suspiciousFlags) {
  const flags = Array.isArray(suspiciousFlags) ? suspiciousFlags.filter(Boolean) : [];
  flagsElement.hidden = flags.length === 0;

  if (flags.length === 0) {
    flagsElement.replaceChildren();
    return;
  }

  const chips = flags.map((flag) => {
    const chip = document.createElement('span');
    chip.className = 'challenge-stats-flag';
    chip.textContent = formatSuspiciousFlag(flag);
    return chip;
  });

  flagsElement.replaceChildren(...chips);
}

function buildStatsNote(snapshot) {
  if (snapshot.error?.message) {
    return snapshot.error.message;
  }

  if (snapshot.stats.leaderboardEligible === true) {
    return 'Latest run is leaderboard-eligible. Stats refreshed from the server.';
  }

  if (snapshot.stats.validationStatus === 'suspicious' && snapshot.stats.leaderboardEligible === false) {
    return 'Flagged as suspicious. Progress kept, rankings unchanged.';
  }

  if (snapshot.stats.validationStatus === 'rejected' && snapshot.stats.leaderboardEligible === false) {
    return 'Run rejected by server validation.';
  }

  if (snapshot.status === 'awaiting-first-input') {
    return 'The timer starts on the first accepted input.';
  }

  if (snapshot.status === 'submitting') {
    return 'Submitting the latest run to the server...';
  }

  if (snapshot.status === 'loading-challenge' || snapshot.status === 'booting') {
    return 'Loading today\'s challenge and ranking snapshot...';
  }

  if (snapshot.status === 'completed') {
    return 'Today\'s challenge is complete.';
  }

  return 'Daily challenge stats stay in sync with the server.';
}

function attachChallengeStatsPanel(runtime, rootElement) {
  const panel = rootElement.querySelector('#challenge-stats-panel');
  if (!panel) {
    return;
  }

  const modeElement = panel.querySelector('#challenge-stats-mode');
  const progressElement = panel.querySelector('#challenge-stats-progress');
  const statusElement = panel.querySelector('#challenge-stats-status');
  const eligibilityElement = panel.querySelector('#challenge-stats-eligibility');
  const recentElement = panel.querySelector('#challenge-stats-recent');
  const dailyBestElement = panel.querySelector('#challenge-stats-daily-best');
  const dailyRankElement = panel.querySelector('#challenge-stats-daily-rank');
  const allTimeBestElement = panel.querySelector('#challenge-stats-all-time-best');
  const allTimeRankElement = panel.querySelector('#challenge-stats-all-time-rank');
  const flagsElement = panel.querySelector('#challenge-stats-flags');
  const noteElement = panel.querySelector('#challenge-stats-note');

  runtime.store.subscribe((snapshot) => {
    const isDailyMode = snapshot.mode === APP_MODES.DAILY_CHALLENGE;
    rootElement.querySelectorAll('.mode-tab').forEach((tab) => {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', tab.dataset.mode === APP_MODES.FREE ? 'free' : 'daily');
      tab.href = url.toString();
      if (tab.dataset.mode === snapshot.mode) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    panel.hidden = !isDailyMode;

    if (!isDailyMode) {
      return;
    }

    modeElement.textContent = 'Daily Challenge';
    progressElement.textContent = getDailyProgressLabel(snapshot);
    statusElement.textContent = formatStatusLabel(snapshot);
    eligibilityElement.textContent = formatLeaderboardEligibility(snapshot);
    recentElement.textContent = formatCpsValue(snapshot.stats.recentCps);
    dailyBestElement.textContent = formatCpsValue(snapshot.stats.dailyBestCps);
    dailyRankElement.textContent = formatRankValue(snapshot.stats.dailyRank);
    allTimeBestElement.textContent = formatCpsValue(snapshot.stats.allTimeBestCps);
    allTimeRankElement.textContent = formatRankValue(snapshot.stats.allTimeRank);
    syncSuspiciousFlags(flagsElement, snapshot.stats.suspiciousFlags);
    noteElement.textContent = buildStatsNote(snapshot);
    panel.dataset.leaderboardEligible =
      snapshot.stats.leaderboardEligible === null ? 'pending' : String(snapshot.stats.leaderboardEligible);
    panel.dataset.validationStatus = snapshot.stats.validationStatus ?? 'idle';
  });
}

function attachRuntimeObservers(runtime) {
  let lastSignature = '';

  runtime.store.subscribe((snapshot) => {
    document.title = buildDocumentTitle(snapshot);

    if (!runtime.config.enableRuntimeLogs) {
      return;
    }

    const nextSignature = createRuntimeSignature(snapshot);
    if (nextSignature === lastSignature) {
      return;
    }

    lastSignature = nextSignature;
    console.info('[PoeticTypewriter]', buildRuntimeSummary(snapshot));
  });
}

function createDebugBridge(runtime) {
  const bridge = {
    app: runtime.app,
    config: runtime.config,
    getSnapshot: () => runtime.store.getSnapshot(),
    mode: runtime.mode,
    summary: null,
  };

  window.__POETIC_TYPEWRITER__ = bridge;
  runtime.store.subscribe((snapshot) => {
    bridge.mode = snapshot.mode;
    bridge.snapshot = snapshot;
    bridge.summary = buildRuntimeSummary(snapshot);
  });
}

function normalizeNextPoems(item) {
  if (!item?.text) {
    return [];
  }

  return [item.text];
}

export async function bootstrapAppRuntime(rootElement) {
  const config = getRuntimeConfig();
  const requestedMode = resolveAppMode(window.location.search, config.defaultMode);
  const isDailyMode = requestedMode === APP_MODES.DAILY_CHALLENGE && Boolean(config.apiBaseUrl);
  const store = createChallengeSessionStore({
    mode: isDailyMode ? APP_MODES.DAILY_CHALLENGE : APP_MODES.FREE,
    status: isDailyMode ? 'booting' : 'ready',
  });
  const client = isDailyMode ? new CompetitionClient({ baseUrl: config.apiBaseUrl }) : null;
  let activeRun = null;
  let activeRunPromise = null;

  const clearActiveRun = () => {
    activeRun = null;
    activeRunPromise = null;
  };

  const startRunForItem = async (challengeId, item) => {
    if (!client || !item?.itemId) {
      clearActiveRun();
      store.patch({
        currentItem: item ?? null,
        error: null,
        runToken: null,
        status: item ? 'awaiting-first-input' : 'completed',
      });
      return null;
    }

    if (
      activeRun &&
      activeRun.challengeId === challengeId &&
      activeRun.currentItem?.itemId === item.itemId
    ) {
      return activeRun;
    }

    if (activeRunPromise) {
      return activeRunPromise;
    }

    store.patch({
      currentItem: item,
      error: null,
      runToken: null,
      status: 'starting-run',
    });

    activeRunPromise = client
      .startRun({
        challengeId,
        itemId: item.itemId,
      })
      .then((run) => {
        activeRun = {
          challengeId,
          currentItem: item,
          runToken: run.runToken,
        };
        store.patch({
          currentItem: item,
          error: null,
          runToken: run.runToken,
          status: 'ready',
        });

        return activeRun;
      })
      .catch((error) => {
        activeRun = null;
        throw error;
      })
      .finally(() => {
        activeRunPromise = null;
      });

    return activeRunPromise;
  };

  const ensureRunStarted = async () => {
    const snapshot = store.getSnapshot();

    if (!snapshot.challengeId || !snapshot.currentItem) {
      return null;
    }

    return startRunForItem(snapshot.challengeId, snapshot.currentItem);
  };

  const app = mountApp(rootElement, {
    onInputProcessed: ({ inputResult }) => {
      if (!client || !inputResult.accepted || inputResult.inputKind !== 'char') {
        return;
      }

      if (activeRun || activeRunPromise) {
        return;
      }

      ensureRunStarted().catch((error) => {
        store.patch({
          error: {
            code: error.code ?? 'run_start_failed',
            message: error.message,
          },
          status: 'run-start-failed',
        });
      });
    },
    onRunCompleted: async (runMetrics) => {
      if (!client || !runMetrics) {
        return;
      }

      const runContext = await ensureRunStarted();
      if (!runContext) {
        return;
      }

      store.patch({
        error: null,
        lastCompletedRun: runMetrics,
        status: 'submitting',
      });

      try {
        const summary = await client.completeRun({
          backspaceCount: runMetrics.backspaceCount,
          challengeId: runContext.challengeId,
          elapsedMs: runMetrics.elapsedMs,
          inputSample: runMetrics.inputSample,
          itemId: runContext.currentItem.itemId,
          runToken: runContext.runToken,
          typedLength: runMetrics.typedLength,
        });

        const previousSnapshot = store.getSnapshot();
        const didAdvance = summary.validationStatus !== 'rejected';
        const nextItem = summary.nextItem ?? null;
        clearActiveRun();
        app.setPoems(normalizeNextPoems(nextItem), {
          resetIndex: true,
        });

        store.patch({
          completedItems: didAdvance
            ? (nextItem ? previousSnapshot.completedItems + 1 : previousSnapshot.totalItems)
            : previousSnapshot.completedItems,
          currentItem: nextItem,
          error: null,
          stats: {
            allTimeBestCps: summary.allTimeBestCps,
            allTimeRank: summary.allTimeRank,
            dailyBestCps: summary.dailyBestCps,
            dailyRank: summary.dailyRank,
            leaderboardEligible: summary.leaderboardEligible,
            recentCps: summary.recentCps,
            suspiciousFlags: summary.suspiciousFlags,
            validationStatus: summary.validationStatus,
          },
          runToken: null,
          status: nextItem ? 'awaiting-first-input' : 'completed',
        });
      } catch (error) {
        store.patch({
          error: {
            code: error.code ?? 'run_submit_failed',
            message: error.message,
          },
          status: 'run-submit-failed',
        });

        try {
          clearActiveRun();
          await ensureRunStarted();
        } catch (retryError) {
          store.patch({
            error: {
              code: retryError.code ?? 'run_restart_failed',
              message: retryError.message,
            },
            status: 'run-restart-failed',
          });
        }
      }
    },
    poems: isDailyMode ? [] : FREE_MODE_POEMS,
  });

  const runtime = {
    app,
    config,
    mode: isDailyMode ? APP_MODES.DAILY_CHALLENGE : APP_MODES.FREE,
    store,
  };

  attachChallengeStatsPanel(runtime, rootElement);
  attachRuntimeObservers(runtime);
  createDebugBridge(runtime);

  if (!isDailyMode) {
    return runtime;
  }

  try {
    store.patch({
      error: null,
      status: 'loading-challenge',
    });

    const todayChallenge = await client.getTodayChallenge();
    const nextPoems = normalizeNextPoems(todayChallenge.currentItem);

    store.patch({
      challengeDate: todayChallenge.challengeDate,
      challengeId: todayChallenge.challengeId,
      completedItems: todayChallenge.completedItems,
      currentItem: todayChallenge.currentItem,
      error: null,
      runToken: null,
      stats: {
        allTimeBestCps: todayChallenge.stats?.allTimeBestCps,
        allTimeRank: todayChallenge.stats?.allTimeRank,
        dailyBestCps: todayChallenge.stats?.dailyBestCps,
        dailyRank: todayChallenge.stats?.dailyRank,
        leaderboardEligible: null,
      },
      status: todayChallenge.currentItem ? 'awaiting-first-input' : 'completed',
      totalItems: todayChallenge.totalItems,
    });

    app.setPoems(nextPoems, {
      loadImmediately: true,
      resetIndex: true,
    });
  } catch (error) {
    app.setPoems(FREE_MODE_POEMS, {
      loadImmediately: true,
      resetIndex: true,
    });

    store.patch({
      error: {
        code: error.code ?? 'challenge_bootstrap_failed',
        message: error.message,
      },
      mode: APP_MODES.FREE,
      status: 'fallback-free',
    });
    runtime.mode = APP_MODES.FREE;
  }

  return runtime;
}
