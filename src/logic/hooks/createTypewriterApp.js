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
    if (rootElement.dataset.transition) return;
    const inputResult = engine.handleInput(key);
    const trackerSnapshot = tracker.recordInput(inputResult);

    options.onInputProcessed?.({
      inputResult,
      trackerSnapshot,
    });

    if (!inputResult.poemCompleted) {
      return inputResult;
    }

    lastCompletedRun = tracker.finishRun();
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
    engine.update(Date.now() / 1000);
    const elapsedText = `${(Math.floor(tracker.getElapsedMs() / 100) / 10).toFixed(1)} ${options.i18n.t('seconds')}`;
    if (elapsedElement.textContent !== elapsedText) elapsedElement.textContent = elapsedText;
    animationFrameId = window.requestAnimationFrame(frameLoop);
  };

  window.addEventListener('keydown', onKeyDown);
  const onResize = () => engine.refreshLayout();
  window.addEventListener('resize', onResize);
  engine.loadNextPoem();
  frameLoop();

  return {
    refreshLayout() { engine.refreshLayout(); },
    getLastCompletedRun() {
      return lastCompletedRun;
    },
    setPoems(poems, options = {}) {
      tracker.reset();
      engine.setPoems(poems, { resetIndex: options.resetIndex, poemSource: options.poemSource });

      if (options.loadImmediately) {
        engine.loadNextPoem();
      }
    },
    dispose() {
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
