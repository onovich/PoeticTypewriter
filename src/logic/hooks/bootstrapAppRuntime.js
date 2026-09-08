import { APP_MODES, resolveAppMode } from '../../data/modes.js';
import { FREE_MODE_POEMS } from '../../data/freePoems.js';
import { mountApp } from '../../App.js';
import { createChallengeSessionStore } from '../services/challengeSessionStore.js';
import { CompetitionClient } from '../services/competitionClient.js';
import { createI18n } from '../i18n.js';
import { syncPresentation } from '../../view/components/runtimePresentation.js';
import { createTransitions } from '../../view/transitions.js';
import { createFreePoemDeck } from '../services/freePoemDeck.js';
import { createLocalScoreArchive } from '../services/localScoreArchive.js';
import { createCompletionHistory } from '../services/completionHistory.js';

export async function bootstrapAppRuntime(rootElement) {
  const config = {
    apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '').trim(),
    defaultMode: import.meta.env.VITE_DEFAULT_MODE ?? APP_MODES.FREE,
    enableRuntimeLogs: import.meta.env.DEV || import.meta.env.VITE_ENABLE_RUNTIME_LOGS === 'true',
  };
  let storage;
  try { storage = window.localStorage; } catch { /* Storage is optional. */ }
  const i18n = createI18n({ storage, languages: navigator.languages ?? [navigator.language] });
  const freeDeck = createFreePoemDeck({ poems: FREE_MODE_POEMS, storage });
  const store = createChallengeSessionStore();
  const scoreArchive = createLocalScoreArchive(storage);
  const completionHistory = createCompletionHistory(storage);
  const client = config.apiBaseUrl ? new CompetitionClient({ baseUrl: config.apiBaseUrl }) : null;
  const transition = createTransitions(rootElement);
  let generation = 0;
  let activeRun = null;
  let activeRunPromise = null;
  const isDaily = () => store.getSnapshot().mode === APP_MODES.DAILY_CHALLENGE;
  const clearRun = () => { activeRun = null; activeRunPromise = null; };
  const nextPoems = item => item?.text ? [item.text] : [];

  const ensureRunStarted = () => {
    if (!isDaily() || !client) return Promise.resolve(null);
    const snapshot = store.getSnapshot();
    if (!snapshot.challengeId || !snapshot.currentItem) return Promise.resolve(null);
    if (activeRun) return Promise.resolve(activeRun);
    if (activeRunPromise) return activeRunPromise;
    const requestGeneration = generation;
    store.patch({ error: null, status: 'starting-run' });
    activeRunPromise = client.startRun({ challengeId: snapshot.challengeId, itemId: snapshot.currentItem.itemId })
      .then(run => {
        if (generation !== requestGeneration) return null;
        activeRun = { challengeId: snapshot.challengeId, currentItem: snapshot.currentItem, runToken: run.runToken };
        store.patch({ runToken: run.runToken, status: 'ready' });
        return activeRun;
      }).finally(() => { if (generation === requestGeneration) activeRunPromise = null; });
    return activeRunPromise;
  };

  const app = mountApp(rootElement, {
    i18n,
    poems: [],
    onIdleReset: () => {
      generation++;
      clearRun();
      if (isDaily()) store.patch({ runToken: null, error: null, lastCompletedRun: null, status: 'awaiting-first-input' });
    },
    onInputProcessed: ({ inputResult }) => {
      if (!isDaily() || !inputResult.accepted || inputResult.inputKind !== 'char' || activeRun || activeRunPromise) return;
      const requestGeneration = generation;
      ensureRunStarted().catch(error => {
        if (generation === requestGeneration) store.patch({ error: { code: error.code ?? 'run_start_failed' }, status: 'run-start-failed' });
      });
    },
    onRunCompleted: async runMetrics => {
      if (!isDaily() || !client || !runMetrics) return;
      const requestGeneration = generation;
      try {
        const run = await ensureRunStarted();
        if (generation !== requestGeneration || !run) return;
        store.patch({ error: null, lastCompletedRun: runMetrics, status: 'submitting' });
        const summary = await client.completeRun({
          backspaceCount: runMetrics.backspaceCount, challengeId: run.challengeId,
          elapsedMs: runMetrics.elapsedMs, inputSample: runMetrics.inputSample,
          itemId: run.currentItem.itemId, runToken: run.runToken, typedLength: runMetrics.typedLength,
        });
        if (generation !== requestGeneration) return;
        const previous = store.getSnapshot();
        completionHistory.record(previous, run.currentItem, runMetrics, summary);
        const nextItem = summary.nextItem ?? null;
        clearRun();
        app.setPoems(nextPoems(nextItem), { resetIndex: true });
        store.patch({
          completedItems: summary.validationStatus !== 'rejected'
            ? (nextItem ? previous.completedItems + 1 : previous.totalItems) : previous.completedItems,
          currentItem: nextItem, error: null, runToken: null,
          stats: {
            allTimeBestCps: summary.allTimeBestCps, allTimeRank: summary.allTimeRank,
            dailyBestCps: summary.dailyBestCps, dailyRank: summary.dailyRank,
            leaderboardEligible: summary.leaderboardEligible, recentCps: summary.recentCps,
            suspiciousFlags: summary.suspiciousFlags, validationStatus: summary.validationStatus,
          },
          status: nextItem ? 'awaiting-first-input' : 'completed',
        });
      } catch (error) {
        if (generation !== requestGeneration) return;
        clearRun();
        const item = store.getSnapshot().currentItem;
        app.setPoems(nextPoems(item), { loadImmediately: true, resetIndex: true });
        store.patch({ error: { code: error.code ?? 'run_submit_failed' }, status: 'run-submit-failed', runToken: null });
      }
    },
  });

  const runtime = { app, config, store, i18n };
  const bridge = { app, config, getSnapshot: () => store.getSnapshot() };
  window.__POETIC_TYPEWRITER__ = bridge;
  store.subscribe(snapshot => {
    snapshot.completion = completionHistory.summarize(snapshot);
    if (snapshot.mode === APP_MODES.DAILY_CHALLENGE && ['awaiting-first-input', 'completed'].includes(snapshot.status)) scoreArchive.save(snapshot);
    runtime.mode = snapshot.mode;
    bridge.mode = snapshot.mode;
    bridge.snapshot = snapshot;
    bridge.summary = {
      completedItems: snapshot.completedItems, currentItem: snapshot.currentItem?.text ?? null,
      dailyBestCps: snapshot.stats.dailyBestCps, dailyRank: snapshot.stats.dailyRank,
      error: snapshot.error, leaderboardEligible: snapshot.stats.leaderboardEligible,
      mode: snapshot.mode, recentCps: snapshot.stats.recentCps, status: snapshot.status,
      progress: snapshot.mode === APP_MODES.DAILY_CHALLENGE ? `${snapshot.completedItems + (snapshot.currentItem ? 1 : 0)}/${snapshot.totalItems}` : null,
      validationStatus: snapshot.stats.validationStatus,
    };
    syncPresentation(rootElement, snapshot, i18n);
    app.refreshLayout();
  });

  // Load starts after the old content fades out; late results belong only to their session.
  const loadMode = mode => {
    const requestGeneration = ++generation;
    clearRun();
    const daily = mode === APP_MODES.DAILY_CHALLENGE && Boolean(client);
    app.setPoems([], { loadImmediately: true, resetIndex: true, poemSource: daily ? null : () => freeDeck.next() });
    store.reset({ mode: daily ? APP_MODES.DAILY_CHALLENGE : APP_MODES.FREE, status: daily ? 'loading-challenge' : 'ready' });
    if (!daily) return Promise.resolve();
    return client.getTodayChallenge().then(today => {
      if (generation !== requestGeneration) return;
      app.setPoems(nextPoems(today.currentItem), { loadImmediately: true, resetIndex: true });
      store.patch({
        playerId: today.playerId, challengeDate: today.challengeDate, challengeId: today.challengeId,
        completedItems: today.completedItems, currentItem: today.currentItem,
        stats: { ...scoreArchive.restore(today), leaderboardEligible: null },
        totalItems: today.totalItems, status: today.currentItem ? 'awaiting-first-input' : 'completed',
      });
    }).catch(error => {
      if (generation !== requestGeneration) return;
      app.setPoems([], { loadImmediately: true, resetIndex: true, poemSource: () => freeDeck.next() });
      store.patch({ mode: APP_MODES.FREE, status: 'fallback-free', error: { code: error.code ?? 'challenge_bootstrap_failed' } });
    });
  };

  rootElement.querySelectorAll('[data-mode]').forEach(tab => tab.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void transition('mode', () => {
      if (tab.dataset.mode === store.getSnapshot().mode) return;
      history.pushState(null, '', tab.href);
      void loadMode(tab.dataset.mode);
    });
  }));
  rootElement.querySelector('.completion-free').addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    rootElement.querySelector('[data-mode="free"]').click();
  });
  window.addEventListener('popstate', () => {
    const mode = resolveAppMode(window.location.search, config.defaultMode);
    void transition('mode', () => { void loadMode(mode); });
  });
  rootElement.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
    void transition('language', () => {
      i18n.setLocale(button.dataset.locale);
      syncPresentation(rootElement, store.getSnapshot(), i18n);
      app.refreshLayout();
    });
  }));
  await loadMode(resolveAppMode(window.location.search, config.defaultMode));
  return runtime;
}
