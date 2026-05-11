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
    animationFrameId = window.requestAnimationFrame(frameLoop);
  };

  window.addEventListener('keydown', onKeyDown);
  engine.loadNextPoem();
  frameLoop();

  return {
    getLastCompletedRun() {
      return lastCompletedRun;
    },
    setPoems(poems, options = {}) {
      engine.setPoems(poems, { resetIndex: options.resetIndex });

      if (options.loadImmediately) {
        engine.loadNextPoem();
      }
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      pointerHandlers.forEach(({ keyElement, triggerKey }) => {
        keyElement.removeEventListener('touchstart', triggerKey);
        keyElement.removeEventListener('mousedown', triggerKey);
      });
      window.cancelAnimationFrame(animationFrameId);
      engine.dispose();
    },
  };
}