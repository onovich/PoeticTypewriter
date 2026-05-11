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
    mode: snapshot.mode,
    recentCps: snapshot.stats.recentCps,
    status: snapshot.status,
    validationStatus: snapshot.stats.validationStatus,
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