export const site = 'https://game.onovich.com/PoeticTypewriter/';

const guides = {
  en: {
    lang: 'en', title: 'Poetry Typing Practice: How to Play | Poetic Typewriter',
    description: 'Learn how to practice English typing with Poetic Typewriter: free mode, daily ten-line challenges, characters per second, and daily resets.',
    heading: 'A quiet moment for your words.', eyebrow: 'POETIC TYPEWRITER · HOW TO PLAY',
    intro: 'Poetic Typewriter is a free browser typing game. Practice short English poetic lines on a vintage keyboard, one character at a time. No account or installation is required.',
    play: 'Start typing', daily: 'Try today’s challenge', other: '中文说明',
    sections: [
      ['How do I play?', 'Type the displayed English line using your keyboard or the on-screen keys. The lines use lowercase English letters and spaces. Use Delete / Backspace to correct input. Finish the line to move on.'],
      ['Free practice, at your pace', 'Free mode has no daily completion limit. Lines are drawn randomly from a library of 415 unique short poetic lines. Within a UTC day, your browser tries every line before beginning another cycle. Refreshing the page keeps this history when browser storage is available.'],
      ['Ten lines each day', 'Daily challenge offers the same ten distinct lines to all players on the same day. Finish those ten lines to complete the challenge. A new challenge starts at 00:00 UTC (08:00 in Beijing). Lines may appear again on another day; uniqueness is guaranteed within each day’s set.'],
      ['Understanding your results', 'Time starts with your first input. Speed is measured in characters per second, not words per minute. The panel shows the current line’s time, your most recent result, today’s best speed and today’s rank. Results are checked before they can count toward rankings.'],
      ['Language and saved preferences', 'Choose English or Chinese from the top navigation. Your saved choice takes priority over the browser language on your next visit. The practice lines remain in English. Free-mode history and language preferences are stored in your browser; clearing site data resets them.'],
      ['A small practice habit', 'Begin with a few relaxed lines in free mode, then try the daily ten when you want a finish line. Focus on comfortable, accurate input before chasing a faster result. The game is free to play in a modern browser with JavaScript enabled.'],
    ],
  },
  zh: {
    lang: 'zh-CN', title: '英文诗句打字练习与每日挑战玩法｜诗意打字机',
    description: '了解诗意打字机的英文打字练习玩法：无限自由模式、每日十句挑战、字符每秒速率、换日时间与本地语言记忆。免费在线体验复古打字机。',
    heading: '留一点时间，给眼前的诗句。', eyebrow: '诗意打字机 · 玩法说明',
    intro: '诗意打字机是一款免费的浏览器英文打字游戏。用复古键盘逐字输入简短诗句，在安静的界面中练习。无需注册账号，也无需安装软件。',
    play: '开始自由练习', daily: '参加今日挑战', other: 'English guide',
    sections: [
      ['如何开始？', '使用实体键盘或屏幕上的按键，输入画面中的英文诗句。题目仅含英文小写字母与空格，可以使用删除键或 Backspace 修正输入。完成当前诗句后进入下一句。'],
      ['自由模式：按自己的节奏练习', '自由模式没有每日完成数量限制。系统从 415 条不重复的简短英文诗句中随机出题，在同一个 UTC 日期内优先遍历题库，再开始下一轮。浏览器存储可用时，刷新页面仍会保留当天的出题记录。'],
      ['每日挑战：每天十句', '同一天的所有玩家面对相同的十条诗句，当天这十句互不重复，完成十句即可结束今日挑战。新挑战在 UTC 00:00，也就是北京时间早上 08:00 开始。不同日期可能再次出现相同诗句，去重保证针对当天题目。'],
      ['如何阅读成绩？', '本句用时从第一次输入开始计算。速度单位为字符/秒，并非单词/分钟。统计区依次显示本句用时、最近成绩、今日最佳速度和今日排名。成绩经过校验后，符合条件的结果才会进入排名。'],
      ['语言与本地记忆', '顶部可手动切换中文和英文界面，下次访问优先使用上次保存的选择，没有记录时采用浏览器语言。练习题目始终为英文。语言偏好和自由模式出题记录保存在当前浏览器中，清除站点数据会重置这些记录。'],
      ['给练习留一个轻松的入口', '先用自由模式输入几句，再用每日十句给这次练习一个终点。可以先关注舒适、准确的输入，再逐渐尝试提高速度。游戏免费，需要支持 JavaScript 的现代浏览器。'],
    ],
  },
};

export function seoAssets() {
  const assets = Object.entries(guides).map(([key, g]) => {
    const url = `${site}guide/${key}/`;
    const other = key === 'en' ? 'zh' : 'en';
    return { fileName: `guide/${key}/index.html`, source: `<!doctype html>
<html lang="${g.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${g.title}</title><meta name="description" content="${g.description}"><link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${site}guide/en/"><link rel="alternate" hreflang="zh-CN" href="${site}guide/zh/"><link rel="alternate" hreflang="x-default" href="${site}guide/en/">
<meta property="og:type" content="website"><meta property="og:title" content="${g.title}"><meta property="og:description" content="${g.description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${site}social-preview.png"><meta name="twitter:card" content="summary_large_image">
<link rel="sitemap" type="application/xml" href="${site}sitemap.xml">
<style>:root{color-scheme:dark;font-family:Georgia,'Songti SC','SimSun',serif;color:#d4cdbf;background:#1a1a1a}*{box-sizing:border-box}body{margin:0}main{max-width:740px;margin:auto;padding:48px 24px 64px}nav{display:flex;justify-content:space-between;gap:20px;font:13px/1.5 system-ui,sans-serif}a{color:#d5c3a3;text-underline-offset:5px}a:focus-visible{outline:2px solid #d5c3a3;outline-offset:5px}.eyebrow{margin-top:72px;font:11px/1.8 system-ui,sans-serif;letter-spacing:.14em;color:#aaa296}h1{font-weight:400;font-size:clamp(28px,5vw,42px);line-height:1.4;margin:20px 0}p{font-size:16px;line-height:1.95;color:#bdb7ab}h2{font-size:21px;font-weight:400;margin:40px 0 10px}.actions{display:flex;flex-wrap:wrap;gap:20px;margin:28px 0 44px;padding-bottom:30px;border-bottom:1px solid #39372f}footer{margin-top:48px;font-size:13px;color:#aaa296}</style></head>
<body><main><nav aria-label="${key === 'en' ? 'Navigation' : '导航'}"><a href="../../">Poetic Typewriter</a><a href="../${other}/" lang="${guides[other].lang}" hreflang="${guides[other].lang}">${g.other}</a></nav>
<p class="eyebrow">${g.eyebrow}</p><h1>${g.heading}</h1><p>${g.intro}</p><div class="actions"><a href="../../?mode=free">${g.play}</a><a href="../../?mode=daily">${g.daily}</a></div>
${g.sections.map(([heading, body]) => `<section><h2>${heading}</h2><p>${body}</p></section>`).join('\n')}
<footer>Poetic Typewriter · Onovich</footer></main></body></html>` };
  });
  assets.push({ fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[site, `${site}guide/en/`, `${site}guide/zh/`].map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n` });
  return assets;
}
