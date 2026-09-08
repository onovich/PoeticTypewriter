export const LOCALE_KEY = 'poetic-typewriter.locale';
export const messages = {
  en: {
    completionEyebrow: 'TEN LINES · A MOMENT WELL SPENT', completionTitle: 'Today’s words are yours.',
    completionAverage: 'Ten-line average', completionBest: 'My fastest line today',
    completionComparison: 'Compared with {date}: {value} chars/s', completionFirst: 'A quiet milestone. Another awaits tomorrow.',
    completionMissing: 'A full ten-line record is needed for an average.',
    completionReturn: 'New words arrive at 00:00 UTC. See you tomorrow.', completionFree: 'Continue in free writing',
    guide: 'Guide', seoTitle: 'Poetic Typewriter — Free Poetry Typing Practice',
    description: 'Practice English typing with short poetic lines and a vintage typewriter. Enjoy endless free practice or a daily ten-line challenge with speed tracking.',
    title: 'Poetic Typewriter', modes: 'Writing mode', free: 'Free writing', daily: 'Daily challenge',
    language: 'Language', elapsed: 'Time', seconds: 's', recent: 'Recent', best: 'My best', rank: 'My rank',
    progress: 'Sentence {current} of {total}', cps: '{value} chars/s', speedUnit: 'chars/s', backspace: 'Delete', space: 'Space',
    loading: 'Preparing today’s words…', completed: 'All done for today.',
    suspicious: 'Result saved · excluded from rankings.',
    rejected: 'Result not counted. Try this sentence again.', error: 'Couldn’t save this result. Please try again.',
    fallback: 'Daily challenge is unavailable. Enjoy free writing for now.',
  },
  'zh-CN': {
    completionEyebrow: '十句诗 · 一段静心时光', completionTitle: '今日的诗，已写完。',
    completionAverage: '十句平均速度', completionBest: '我的今日最快单句',
    completionComparison: '相比 {date}：{value} 字符/秒', completionFirst: '一段完整的练习，明日再续。',
    completionMissing: '完整记录十句成绩后，可查看平均速度。',
    completionReturn: '新诗句于北京时间 08:00 到来，明天见。', completionFree: '继续自由书写',
    guide: '说明', seoTitle: '诗意打字机 — 免费英文诗句打字练习',
    description: '用复古打字机练习简短英文诗句，体验无限自由模式或每日十句挑战，记录打字速度。免费在线游玩，支持中文与英文界面。',
    title: '诗意打字机', modes: '写作模式', free: '自由模式', daily: '每日挑战',
    language: '语言', elapsed: '本句用时', seconds: '秒', recent: '最近成绩', best: '我的今日最佳', rank: '我的今日排名',
    progress: '第 {current} / {total} 句', cps: '{value} 字符/秒', speedUnit: '字符/秒', backspace: '删除', space: '空格',
    loading: '正在准备今日诗句…', completed: '今日挑战已完成。',
    suspicious: '成绩已保存，本次不计入排名。',
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
