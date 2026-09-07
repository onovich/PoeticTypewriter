import { FREE_MODE_POEMS } from '../../data/freePoems.js';
import { TypewriterEngine } from '../engine/typewriterEngine.js';
import { TypingRunTracker } from '../stats/typingRunTracker.js';

export function createTypewriterApp(rootElement, options = {}) {
  const elements = {
    paperSlotArea: rootElement.querySelector('#paper-slot-area'),
    balloonsContainer: rootElement.querySelector('#balloons-container'),
    svgCanvas: rootElement.querySelector('#string-canvas'),
    targetPoemContainer: rootElement.querySelector('#target-poem'),
    keyboardKeys: Array.from(rootElement.querySelectorAll('.skeuo-key')),
  };

  const engine = new TypewriterEngine(elements, {
    poems: options.poems ?? FREE_MODE_POEMS,
  });
  const tracker = new TypingRunTracker();
  const elapsedElement = rootElement.querySelector('#challenge-elapsed');
  let animationFrameId = 0;
  let lastCompletedRun = null;
  const idleTimeoutMs = 3 * 60 * 1000;
  let idleTimer = 0, lastActivity = null, resetting = false, revision = 0;
  let idleAnimations = [];
  const clearIdle = () => { clearTimeout(idleTimer); idleTimer = 0; lastActivity = null; };
  const renderElapsed = () => {
    const text = `${(Math.floor(tracker.getElapsedMs() / 100) / 10).toFixed(1)} ${options.i18n.t('seconds')}`;
    if (elapsedElement.textContent !== text) elapsedElement.textContent = text;
  };
  const resetIdleRun = async () => {
    if (resetting || tracker.startedAtMs === null) return;
    const token = ++revision;
    resetting = true;
    clearIdle();
    tracker.reset();
    lastCompletedRun = null;
    renderElapsed();
    options.onIdleReset?.();
    const targets = [elements.targetPoemContainer, elements.balloonsContainer, elements.svgCanvas];
    const duration = document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    idleAnimations = targets.map(element => element.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' }));
    await Promise.allSettled(idleAnimations.map(a => a.finished));
    if (token !== revision) return;
    engine.resetCurrentPoem();
    idleAnimations.forEach(a => a.cancel());
    idleAnimations = [elements.targetPoemContainer.animate([{ opacity: 0 }, { opacity: 1 }], { duration })];
    await Promise.allSettled(idleAnimations.map(a => a.finished));
    if (token !== revision) return;
    idleAnimations = [];
    resetting = false;
    wake();
  };
  const expireIfNeeded = () => {
    if (lastActivity !== null && Date.now() - lastActivity >= idleTimeoutMs) {
      void resetIdleRun();
      return true;
    }
    return resetting;
  };
  const armIdle = () => {
    clearTimeout(idleTimer);
    lastActivity = Date.now();
    idleTimer = setTimeout(() => { expireIfNeeded(); }, idleTimeoutMs);
  };

  const highlightVisualKey = (key) => {
    let searchKey = key.toLowerCase();
    if (key === 'Backspace') {
      searchKey = 'Backspace';
    }
    if (key === ' ') {
      searchKey = ' ';
    }

    const keyElement = rootElement.querySelector(`.skeuo-key[data-key="${searchKey}"]`);
    if (!keyElement) {
      return;
    }

    keyElement.classList.add('active-state');
    window.setTimeout(() => keyElement.classList.remove('active-state'), 100);
  };

  const processInput = (key) => {
    if (expireIfNeeded()) return;
    if (rootElement.dataset.transition) return;
    const inputResult = engine.handleInput(key);
    const trackerSnapshot = tracker.recordInput(inputResult);
    if (inputResult.accepted && tracker.startedAtMs !== null) armIdle();
    wake();

    options.onInputProcessed?.({
      inputResult,
      trackerSnapshot,
    });

    if (!inputResult.poemCompleted) {
      return inputResult;
    }

    lastCompletedRun = tracker.finishRun();
    clearIdle();
    options.onRunCompleted?.(lastCompletedRun);

    return inputResult;
  };

  const onKeyDown = (event) => {
    if (event.target.closest?.('a, button, input, textarea, select') || event.ctrlKey || event.metaKey || event.altKey) return;
    processInput(event.key);
    highlightVisualKey(event.key);
  };

  const pointerHandlers = elements.keyboardKeys.map((keyElement) => {
    const triggerKey = (event) => {
      event.preventDefault();
      const key = keyElement.getAttribute('data-key');
      processInput(key);
      keyElement.classList.add('active-state');
      window.setTimeout(() => keyElement.classList.remove('active-state'), 100);
    };

    keyElement.addEventListener('touchstart', triggerKey, { passive: false });
    keyElement.addEventListener('mousedown', triggerKey);

    return { keyElement, triggerKey };
  });

  const frameLoop = () => {
    animationFrameId = 0;
    if (document.hidden || expireIfNeeded()) return;
    engine.update(Date.now() / 1000);
    renderElapsed();
    if (engine.activeBalloons.length || engine.timers.size || tracker.startedAtMs !== null) wake();
  };
  const wake = () => {
    if (!animationFrameId && !document.hidden && !resetting) animationFrameId = window.requestAnimationFrame(frameLoop);
  };
  const onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(animationFrameId); animationFrameId = 0; }
    else if (!expireIfNeeded()) wake();
  };
  document.addEventListener('visibilitychange', onVisibility);

  window.addEventListener('keydown', onKeyDown);
  const onResize = () => engine.refreshLayout();
  window.addEventListener('resize', onResize);
  engine.loadNextPoem();
  frameLoop();

  return {
    refreshLayout() { engine.refreshLayout(); renderElapsed(); wake(); },
    getLastCompletedRun() {
      return lastCompletedRun;
    },
    setPoems(poems, options = {}) {
      revision++;
      clearIdle();
      resetting = false;
      idleAnimations.forEach(a => a.cancel());
      idleAnimations = [];
      tracker.reset();
      engine.setPoems(poems, { resetIndex: options.resetIndex, poemSource: options.poemSource });

      if (options.loadImmediately) {
        engine.loadNextPoem();
      }
      renderElapsed();
      wake();
    },
    dispose() {
      revision++;
      clearIdle();
      idleAnimations.forEach(a => a.cancel());
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      pointerHandlers.forEach(({ keyElement, triggerKey }) => {
        keyElement.removeEventListener('touchstart', triggerKey);
        keyElement.removeEventListener('mousedown', triggerKey);
      });
      window.cancelAnimationFrame(animationFrameId);
      engine.dispose();
    },
  };
}
