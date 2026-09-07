export const FREE_DECK_KEY = 'poetic-typewriter.free-deck.v1';

// A draw is consumed when shown, including a sentence abandoned by mode switching.
// Read before each draw so sequential tabs and reloads share the same daily history.
export function createFreePoemDeck({ poems, storage, now = () => new Date(), random = Math.random }) {
  const pool = [...new Set(poems)];
  if (!pool.length) throw new Error('Free poem library cannot be empty');
  const valid = new Set(pool);
  let memory = null;
  let storageAvailable = Boolean(storage);
  return {
    next() {
      const day = now().toISOString().slice(0, 10);
      let saved = memory;
      if (storageAvailable) {
        try {
          const raw = storage.getItem(FREE_DECK_KEY);
          try { saved = raw ? JSON.parse(raw) : memory; }
          catch { saved = memory; }
        } catch { storageAvailable = false; }
      }
      const seen = new Set(saved?.day === day && Array.isArray(saved.seen) ? saved.seen.filter(text => valid.has(text)) : []);
      let available = pool.filter(text => !seen.has(text));
      if (!available.length) {
        seen.clear();
        available = pool.length > 1 ? pool.filter(text => text !== saved?.last) : [...pool];
      }
      const index = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)));
      const text = available[index];
      seen.add(text);
      memory = { day, seen: [...seen], last: text };
      if (storageAvailable) {
        try { storage.setItem(FREE_DECK_KEY, JSON.stringify(memory)); }
        catch { storageAvailable = false; }
      }
      return text;
    },
  };
}
