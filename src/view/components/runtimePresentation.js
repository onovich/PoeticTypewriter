export function syncPresentation(root, snapshot, i18n) {
  const { t } = i18n;
  const daily = snapshot.mode === 'daily-challenge';
  document.documentElement.lang = i18n.locale;
  document.title = `${t('title')} · ${t(daily ? 'daily' : 'free')}`;
  root.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  root.querySelector('.mode-tabs').setAttribute('aria-label', t('modes'));
  root.querySelector('.locale-switch').setAttribute('aria-label', t('language'));
  root.querySelector('[data-key="Backspace"]').setAttribute('aria-label', t('backspace'));
  root.querySelector('[data-key=" "]').setAttribute('aria-label', t('space'));
  root.querySelectorAll('[data-locale]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.locale === i18n.locale)));
  root.querySelectorAll('[data-mode]').forEach(tab => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', tab.dataset.mode === 'free' ? 'free' : 'daily');
    tab.href = url;
    if (tab.dataset.mode === snapshot.mode) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  const panel = root.querySelector('#challenge-stats-panel');
  panel.hidden = !daily;
  root.querySelector('#stage').dataset.activeMode = snapshot.mode;
  panel.querySelector('section').setAttribute('aria-label', t('daily'));
  panel.dataset.leaderboardEligible = snapshot.stats.leaderboardEligible === null ? 'pending' : String(snapshot.stats.leaderboardEligible);
  panel.dataset.validationStatus = snapshot.stats.validationStatus ?? 'idle';
  const current = snapshot.currentItem ? snapshot.completedItems + 1 : snapshot.totalItems;
  root.querySelector('#challenge-stats-progress').textContent = t('progress', { current, total: snapshot.totalItems });
  const cps = value => typeof value === 'number' && value > 0 ? t('cps', { value: value.toFixed(2) }) : '--';
  const best = root.querySelector('#challenge-stats-daily-best');
  best.textContent = snapshot.stats.dailyBestCps > 0 ? snapshot.stats.dailyBestCps.toFixed(2) : '--';
  if (snapshot.stats.dailyBestCps > 0) {
    const unit = document.createElement('small');
    unit.textContent = t('speedUnit');
    best.append(unit);
  }
  root.querySelector('#challenge-stats-daily-rank').textContent = snapshot.stats.dailyRank > 0 ? `#${snapshot.stats.dailyRank}` : '--';
  root.querySelector('#challenge-elapsed').setAttribute('aria-label', t('elapsed'));
  let note = '';
  if (snapshot.status === 'fallback-free') note = t('fallback');
  else if (snapshot.error) note = t('error');
  else if (snapshot.status === 'completed') note = t('completed');
  else if (snapshot.status === 'submitting') note = t('submitting');
  else if (['booting', 'loading-challenge'].includes(snapshot.status)) note = t('loading');
  else if (snapshot.stats.validationStatus) note = t(snapshot.stats.validationStatus, { speed: cps(snapshot.stats.recentCps) });
  const noteElement = root.querySelector('#challenge-stats-note');
  noteElement.textContent = note;
  noteElement.hidden = !note;
}
