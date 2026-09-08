export function syncPresentation(root, snapshot, i18n) {
  const { t } = i18n;
  const daily = snapshot.mode === 'daily-challenge';
  const completed = daily && snapshot.status === 'completed';
  const loading = daily && ['booting', 'loading-challenge'].includes(snapshot.status);
  const stage = root.querySelector('#stage');
  stage.dataset.completed = String(completed);
  root.querySelector('#challenge-completion').hidden = !completed;
  const speed = value => typeof value === 'number' && value > 0 ? t('cps', { value: value.toFixed(2) }) : '—';
  root.querySelector('#completion-average').textContent = speed(snapshot.completion?.averageCps);
  root.querySelector('#completion-best').textContent = speed(snapshot.stats.dailyBestCps);
  const difference = snapshot.completion?.differenceCps;
  root.querySelector('#completion-comparison').textContent = typeof difference === 'number'
    ? t('completionComparison', { date: snapshot.completion.previousDate, value: `${difference >= 0 ? '+' : '−'}${Math.abs(difference).toFixed(2)}` })
    : t(snapshot.completion?.averageCps ? 'completionFirst' : 'completionMissing');
  stage.dataset.challengeLoading = String(loading);
  stage.dataset.challengeReady = String(!loading && (daily || snapshot.status === 'fallback-free'));
  stage.setAttribute('aria-busy', String(loading));
  document.documentElement.lang = i18n.locale;
  document.title = `${t('seoTitle')} · ${t(daily ? 'daily' : 'free')}`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
  root.querySelector('.guide-link').href = `guide/${i18n.locale === 'zh-CN' ? 'zh' : 'en'}/`;
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
  for (const [selector, value] of [
    ['#challenge-stats-recent', snapshot.stats.recentCps],
    ['#challenge-stats-daily-best', snapshot.stats.dailyBestCps],
  ]) {
    const element = root.querySelector(selector);
    element.textContent = typeof value === 'number' && value > 0 ? value.toFixed(2) : '--';
    const unit = document.createElement('small');
    unit.textContent = t('speedUnit');
    element.append(unit);
  }
  root.querySelector('#challenge-stats-daily-rank').textContent = snapshot.stats.dailyRank > 0 ? `#${snapshot.stats.dailyRank}` : '--';
  root.querySelector('#challenge-elapsed').setAttribute('aria-label', t('elapsed'));
  let note = '';
  if (snapshot.status === 'fallback-free') note = t('fallback');
  else if (snapshot.error) note = t('error');
  else if (completed) note = '';
  else if (['suspicious', 'rejected'].includes(snapshot.stats.validationStatus)) note = t(snapshot.stats.validationStatus);
  const noteElement = root.querySelector('#challenge-stats-note');
  noteElement.textContent = note;
  noteElement.hidden = !note;
}
