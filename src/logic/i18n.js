export const LOCALE_KEY = 'poetic-typewriter.locale';
export const messages = {
  en: {
    title: 'Poetic Typewriter', modes: 'Writing mode', free: 'Free writing', daily: 'Daily challenge',
    language: 'Language', elapsed: 'Time', seconds: 's', best: 'Today’s best', rank: 'Today’s rank',
    progress: 'Sentence {current} of {total}', cps: '{value} chars/s', speedUnit: 'chars/s', backspace: 'Delete', space: 'Space',
    loading: 'Preparing today’s words…', submitting: 'Saving your result…', completed: 'All done for today.',
    accepted: 'Last sentence · {speed}', suspicious: 'Result saved · excluded from rankings.',
    rejected: 'Result not counted. Try this sentence again.', error: 'Couldn’t save this result. Please try again.',
    fallback: 'Daily challenge is unavailable. Enjoy free writing for now.',
  },
  'zh-CN': {
    title: '诗意打字机', modes: '写作模式', free: '自由模式', daily: '每日挑战',
    language: '语言', elapsed: '本句用时', seconds: '秒', best: '今日最佳', rank: '今日排名',
    progress: '第 {current} / {total} 句', cps: '{value} 字符/秒', speedUnit: '字符/秒', backspace: '删除', space: '空格',
    loading: '正在准备今日诗句…', submitting: '正在保存成绩…', completed: '今日挑战已完成。',
    accepted: '上一句 · {speed}', suspicious: '成绩已保存，本次不计入排名。',
    rejected: '本次成绩未计入，请重试这一句。', error: '成绩暂未保存，请稍后重试。',
    fallback: '每日挑战暂不可用，先享受自由书写吧。',
  },
};

export function resolveLocale(saved, languages = []) {
  if (Object.hasOwn(messages, saved)) return saved;
  const language = languages.find(value => typeof value === 'string' && value.length);
  return /^zh(?:-|$)/i.test(language ?? '') ? 'zh-CN' : 'en';
}

export function createI18n({ storage, languages = [] } = {}) {
  let saved;
  try { saved = storage?.getItem(LOCALE_KEY); } catch { /* Private browsing can disable storage. */ }
  let locale = resolveLocale(saved, languages);
  return {
    get locale() { return locale; },
    setLocale(next) {
      if (!Object.hasOwn(messages, next)) return;
      locale = next;
      try { storage?.setItem(LOCALE_KEY, next); } catch { /* Keep the in-memory choice. */ }
    },
    t(key, values = {}) {
      return (messages[locale][key] ?? messages.en[key] ?? key)
        .replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
    },
  };
}
