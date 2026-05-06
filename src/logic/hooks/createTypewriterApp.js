import { TypewriterEngine } from '../engine/typewriterEngine.js';

export function createTypewriterApp(rootElement) {
  const elements = {
    paperSlotArea: rootElement.querySelector('#paper-slot-area'),
    balloonsContainer: rootElement.querySelector('#balloons-container'),
    svgCanvas: rootElement.querySelector('#string-canvas'),
    targetPoemContainer: rootElement.querySelector('#target-poem'),
    keyboardKeys: Array.from(rootElement.querySelectorAll('.skeuo-key')),
  };

  const engine = new TypewriterEngine(elements);
  let animationFrameId = 0;

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

  const onKeyDown = (event) => {
    engine.handleInput(event.key);
    highlightVisualKey(event.key);
  };

  const pointerHandlers = elements.keyboardKeys.map((keyElement) => {
    const triggerKey = (event) => {
      event.preventDefault();
      const key = keyElement.getAttribute('data-key');
      engine.handleInput(key);
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