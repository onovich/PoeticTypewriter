import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, messages, resolveLocale, LOCALE_KEY } from '../src/logic/i18n.js';

test('saved locale wins, browser Chinese variants match, unsupported languages fall back', () => {
  assert.equal(resolveLocale('en', ['zh-CN']), 'en');
  assert.equal(resolveLocale('zh-CN', ['en-US']), 'zh-CN');
  assert.equal(resolveLocale('invalid', ['zh-TW', 'en']), 'zh-CN');
  assert.equal(resolveLocale(null, ['fr-FR', 'en']), 'en');
  assert.equal(resolveLocale(null, []), 'en');
});
test('translation keys match and manual selection survives a new session', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages['zh-CN']).sort());
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const i18n = createI18n({ storage, languages: ['en-US'] });
  i18n.setLocale('zh-CN');
  assert.equal(values.get(LOCALE_KEY), 'zh-CN');
  assert.equal(createI18n({ storage, languages: ['en'] }).locale, 'zh-CN');
  assert.equal(i18n.t('progress', { current: 2, total: 100 }), '第 2 / 100 句');
});
test('blocked storage does not prevent loading or changing language', () => {
  const storage = { getItem() { throw Error(); }, setItem() { throw Error(); } };
  const i18n = createI18n({ storage, languages: ['zh-CN'] });
  i18n.setLocale('en');
  assert.equal(i18n.t('free'), 'Free writing');
  i18n.setLocale('invalid');
  assert.equal(i18n.locale, 'en');
});
