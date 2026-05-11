import { APP_MODES } from '../../data/modes.js';

const DEFAULT_STATS = {
  allTimeBestCps: null,
  allTimeRank: null,
  dailyBestCps: null,
  dailyRank: null,
  leaderboardEligible: null,
  recentCps: null,
  suspiciousFlags: [],
  validationStatus: null,
};

const DEFAULT_SNAPSHOT = {
  challengeId: null,
  challengeDate: null,
  completedItems: 0,
  currentItem: null,
  error: null,
  lastCompletedRun: null,
  mode: APP_MODES.FREE,
  runToken: null,
  status: 'idle',
  stats: DEFAULT_STATS,
  totalItems: 0,
};

function normalizeStats(statsPatch = {}) {
  return {
    ...DEFAULT_STATS,
    ...statsPatch,
  };
}

export function createChallengeSessionStore(initialSnapshot = {}) {
  let snapshot = {
    ...DEFAULT_SNAPSHOT,
    ...initialSnapshot,
    stats: normalizeStats(initialSnapshot.stats),
  };
  const listeners = new Set();

  const emit = () => {
    listeners.forEach((listener) => listener(snapshot));
  };

  return {
    getSnapshot() {
      return snapshot;
    },
    patch(patch) {
      snapshot = {
        ...snapshot,
        ...patch,
        stats: patch.stats ? normalizeStats({ ...snapshot.stats, ...patch.stats }) : snapshot.stats,
      };
      emit();
      return snapshot;
    },
    reset(nextSnapshot = {}) {
      snapshot = {
        ...DEFAULT_SNAPSHOT,
        ...nextSnapshot,
        stats: normalizeStats(nextSnapshot.stats),
      };
      emit();
      return snapshot;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}