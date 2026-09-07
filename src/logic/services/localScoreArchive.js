export const SCORE_ARCHIVE_KEY = 'poetic-typewriter.score-archive.v1';
const score = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const scope = data => typeof data.playerId === 'string' && data.playerId &&
  typeof data.challengeId === 'string' && data.challengeId && /^\d{4}-\d{2}-\d{2}$/.test(data.challengeDate)
  ? JSON.stringify([data.playerId, data.challengeDate, data.challengeId]) : null;

export function createLocalScoreArchive(storage) {
  let memory = {};
  let lastRaw;
  const read = () => {
    try {
      const raw = storage?.getItem(SCORE_ARCHIVE_KEY) ?? null;
      if (raw === lastRaw) return memory;
      lastRaw = raw;
      const stored = JSON.parse(raw ?? 'null');
      if (stored?.version === 1 && stored.records && typeof stored.records === 'object' && !Array.isArray(stored.records)) memory = stored.records;
    } catch { /* Keep this page's archive when storage is blocked or malformed. */ }
    return memory;
  };
  return {
    restore(today) {
      const key = scope(today);
      const cached = key ? read()[key] : null;
      const sameProgress = cached && cached.completedItems === today.completedItems;
      return {
        ...today.stats,
        // Server corrections, including zero, take precedence over a local best.
        dailyBestCps: score(today.stats?.dailyBestCps) ?? score(cached?.dailyBestCps),
        recentCps: sameProgress ? score(cached.recentCps) : null,
        validationStatus: sameProgress && ['accepted', 'suspicious', 'rejected'].includes(cached.validationStatus) ? cached.validationStatus : null,
      };
    },
    save(snapshot) {
      const key = scope(snapshot);
      if (!key) return;
      memory = { ...read(), [key]: {
        playerId: snapshot.playerId, challengeDate: snapshot.challengeDate, challengeId: snapshot.challengeId,
        completedItems: snapshot.completedItems, recentCps: score(snapshot.stats?.recentCps),
        dailyBestCps: score(snapshot.stats?.dailyBestCps), validationStatus: snapshot.stats?.validationStatus ?? null,
      } };
      try {
        const raw = JSON.stringify({ version: 1, records: memory });
        storage?.setItem(SCORE_ARCHIVE_KEY, raw);
        if (storage) lastRaw = raw;
      }
      catch { /* In-memory persistence still works for this page. */ }
    },
  };
}
