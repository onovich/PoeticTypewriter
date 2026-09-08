export const COMPLETION_KEY = 'poetic-typewriter.completions.v1';
const keyFor = s => JSON.stringify([s.playerId, s.challengeDate, s.challengeId]);
const validScope = s => Boolean(s.playerId && s.challengeId && /^\d{4}-\d{2}-\d{2}$/.test(s.challengeDate));
export function createCompletionHistory(storage) {
  let records = {};
  let lastRaw;
  const read = () => {
    try {
      const raw = storage?.getItem(COMPLETION_KEY) ?? null;
      if (raw === lastRaw) return records;
      lastRaw = raw;
      const value = JSON.parse(raw ?? 'null');
      if (value?.version === 1 && value.records && typeof value.records === 'object' && !Array.isArray(value.records)) records = value.records;
    } catch { /* Local history is optional. */ }
    return records;
  };
  return {
    record(snapshot, item, metrics, result) {
      if (!validScope(snapshot) || result.validationStatus !== 'accepted' || !(metrics.elapsedMs > 0)) return;
      const key = keyFor(snapshot);
      const old = read()[key];
      records[key] = { playerId: snapshot.playerId, date: snapshot.challengeDate,
        runs: { ...old?.runs, [item.itemId]: { chars: item.text.length, elapsedMs: metrics.elapsedMs } },
        total: snapshot.totalItems, completed: !result.nextItem };
      try {
        const raw = JSON.stringify({ version: 1, records });
        storage?.setItem(COMPLETION_KEY, raw);
        if (storage) lastRaw = raw;
      } catch { /* Retain memory. */ }
    },
    summarize(snapshot) {
      if (!validScope(snapshot)) return null;
      const all = read();
      const average = record => {
        const runs = Object.values(record?.runs ?? {});
        if (!record?.completed || runs.length !== record.total || !runs.length ||
          runs.some(run => !(run?.chars > 0) || !Number.isFinite(run.chars) || !(run.elapsedMs > 0) || !Number.isFinite(run.elapsedMs))) return null;
        return runs.reduce((sum, run) => sum + run.chars, 0) * 1000 / runs.reduce((sum, run) => sum + run.elapsedMs, 0);
      };
      const current = snapshot.completedItems === snapshot.totalItems ? average(all[keyFor(snapshot)]) : null;
      const previous = Object.values(all).filter(r => r?.playerId === snapshot.playerId && typeof r.date === 'string' && r.date < snapshot.challengeDate && average(r) !== null)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return { averageCps: current, previousDate: previous?.date ?? null,
        differenceCps: current !== null && previous ? current - average(previous) : null };
    },
  };
}
