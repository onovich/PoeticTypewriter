import { GAME_PHASES, TIMINGS } from '../../data/config.js';
import { easeInCubic, easeOutQuad } from './easing.js';
import { PretextEngine } from './pretextEngine.js';
import { getPoemAttribution } from '../../../shared/poemLibrary.js';

export class TypewriterEngine {
  constructor(elements, options = {}) {
    this.elements = elements;
    this.poems = [];
    this.pretextEngine = new PretextEngine();
    this.currentPoemIndex = 0;
    this.currentPoem = '';
    this.typedIndex = 0;
    this.typedText = '';
    this.isInputLocked = false;
    this.activeBalloons = [];
    this.gameState = GAME_PHASES.TYPING;
    this.timers = new Set();
    this.phaseTransitionScheduled = false;
    this.setPoems(options.poems, { resetIndex: true });
  }

  setPoems(poems, options = {}) {
    this.poemSource = options.poemSource ?? null;
    this.poems = Array.isArray(poems) ? poems.filter(Boolean) : [];

    if (options.resetIndex !== false) {
      this.currentPoemIndex = 0;
    }
  }

  loadNextPoem() {
    this.clearTimers();
    this.phaseTransitionScheduled = false;

    if (this.poems.length === 0 && !this.poemSource) {
      this.currentPoem = '';
      this.updateAttribution();
      this.pretextEngine.init(this.elements.targetPoemContainer, this.currentPoem);
      this.elements.targetPoemContainer.classList.remove('fade-out');
      this.typedIndex = 0;
      this.typedText = '';
      this.isInputLocked = false;
      this.gameState = GAME_PHASES.TYPING;
      this.activeBalloons = [];
      this.elements.balloonsContainer.innerHTML = '';
      this.elements.svgCanvas.innerHTML = '';
      return;
    }

    this.currentPoem = this.poemSource ? this.poemSource() : this.poems[this.currentPoemIndex];
    this.updateAttribution();
    this.pretextEngine.init(this.elements.targetPoemContainer, this.currentPoem);
    this.elements.targetPoemContainer.classList.remove('fade-out');

    this.typedIndex = 0;
    this.typedText = '';
    this.isInputLocked = false;
    this.gameState = GAME_PHASES.TYPING;
    this.activeBalloons = [];
    this.elements.balloonsContainer.innerHTML = '';
    this.elements.svgCanvas.innerHTML = '';

    if (!this.poemSource) this.currentPoemIndex = (this.currentPoemIndex + 1) % this.poems.length;
  }

  updateAttribution() {
    const element = this.elements.targetPoemContainer.parentElement?.querySelector('#poem-attribution');
    if (!element) return;
    const poem = getPoemAttribution(this.currentPoem);
    element.replaceChildren();
    element.hidden = !poem;
    if (!poem) return;
    const link = document.createElement('a');
    link.href = 'https://www.gutenberg.org/ebooks/19221';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${poem.author} · ${poem.title}`;
    link.title = poem.original;
    element.append(link);
  }

  handleInput(key) {
    const baseResult = {
      accepted: false,
      inputKind: 'ignored',
      key,
      poemText: this.currentPoem,
      typedText: this.typedText,
      typedIndex: this.typedIndex,
      poemCompleted: false,
      isCorrect: null,
      expectedChar: null,
    };

    if (this.isInputLocked) {
      return baseResult;
    }

    if (key === 'Backspace') {
      const accepted = this.removeLastBalloon();

      return {
        ...baseResult,
        accepted,
        inputKind: 'backspace',
        typedText: this.typedText,
        typedIndex: this.typedIndex,
      };
    }

    if (key.length !== 1 || this.typedIndex >= this.currentPoem.length) {
      return baseResult;
    }

    const char = key.toLowerCase();
    const targetChar = this.currentPoem[this.typedIndex];
    const isCorrect = char === targetChar;

    this.typedText += char;

    if (char !== ' ') {
      this.spawnBalloon(char, this.typedIndex, isCorrect);
    }

    this.typedIndex += 1;
    const poemCompleted = this.typedText === this.currentPoem;

    if (poemCompleted) {
      this.isInputLocked = true;
      this.gameState = GAME_PHASES.WAITING_TO_RISE;
      this.phaseTransitionScheduled = false;
    }

    return {
      accepted: true,
      inputKind: 'char',
      key: char,
      poemText: this.currentPoem,
      typedText: this.typedText,
      typedIndex: this.typedIndex,
      poemCompleted,
      isCorrect,
      expectedChar: targetChar,
    };
  }

  removeLastBalloon() {
    if (this.typedIndex <= 0) {
      return false;
    }

    this.typedIndex -= 1;
    this.typedText = this.typedText.slice(0, -1);

    const balloonToDrop = this.activeBalloons.find((balloon) => balloon.index === this.typedIndex);
    if (balloonToDrop && balloonToDrop.state !== 'dead') {
      balloonToDrop.state = 'falling';
      balloonToDrop.fallProgress = 0;
      balloonToDrop.startX = balloonToDrop.currentX;
      balloonToDrop.startY = balloonToDrop.currentY;
    }

    return true;
  }

  resetCurrentPoem() {
    this.clearTimers();
    this.phaseTransitionScheduled = false;
    this.typedIndex = 0;
    this.typedText = '';
    this.isInputLocked = false;
    this.gameState = GAME_PHASES.TYPING;
    this.activeBalloons = [];
    this.elements.balloonsContainer.innerHTML = '';
    this.elements.svgCanvas.innerHTML = '';
    this.pretextEngine.init(this.elements.targetPoemContainer, this.currentPoem);
    this.elements.targetPoemContainer.classList.remove('fade-out');
  }

  measureAttachment(balloon) {
    this.textContext ??= document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(balloon.element);
    this.textContext.font = `${style.fontSize} ${style.fontFamily}`;
    const metrics = this.textContext.measureText(balloon.char);
    const size = parseFloat(style.fontSize);
    const height = balloon.element.offsetHeight;
    const baseline = (height - (metrics.fontBoundingBoxAscent ?? size * .8) - (metrics.fontBoundingBoxDescent ?? size * .2)) / 2 + (metrics.fontBoundingBoxAscent ?? size * .8);
    balloon.attachmentHeight = height;
    balloon.inkGap = Math.max(0, height - baseline - metrics.actualBoundingBoxDescent - 1);
  }

  updateBalloonPath(balloon, startX, startY, bend) {
    const radians = (balloon.currentRot ?? 0) * Math.PI / 180;
    const radius = balloon.attachmentHeight / 2 - balloon.inkGap;
    this.updatePath(balloon.pathElement, startX, startY,
      balloon.currentX - Math.sin(radians) * radius,
      balloon.currentY - balloon.attachmentHeight / 2 + Math.cos(radians) * radius, bend);
  }

  spawnBalloon(char, index, isCorrect) {
    const metrics = this.pretextEngine.getGlyphMetrics(index);
    if (!metrics) {
      return;
    }

    const originCoords = this.getOriginCoordsForAlphabet(char);
    const stageRect = this.elements.balloonsContainer.getBoundingClientRect();
    const balloonElement = document.createElement('div');
    balloonElement.className = `balloon-char ${!isCorrect ? 'error' : ''}`;
    balloonElement.innerText = char;
    balloonElement.style.transform = 'translate(-50%, -100%)';
    this.elements.balloonsContainer.appendChild(balloonElement);

    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
    pathElement.setAttribute('stroke-width', '1');
    pathElement.setAttribute('fill', 'none');
    this.elements.svgCanvas.appendChild(pathElement);

    this.activeBalloons.push({
      id: Math.random(),
      index,
      char,
      isCorrect,
      element: balloonElement,
      pathElement,
      state: 'rising',
      progress: 0,
      speed: 0.02 + Math.random() * 0.01,
      originX: originCoords.x,
      originY: originCoords.y,
      startX: originCoords.x,
      startY: originCoords.y,
      targetX: metrics.x - stageRect.left,
      targetY: metrics.y - stageRect.top,
      currentX: originCoords.x,
      currentY: originCoords.y,
      swayOffset: Math.random() * Math.PI * 2,
      currentRot: 0,
      velX: 0,
      velY: 0,
      rotVel: 0,
      opacity: 1,
      fallProgress: 0,
      retractProgress: 0,
    });
    this.measureAttachment(this.activeBalloons.at(-1));
  }

  getOriginCoordsForAlphabet(char) {
    const slotRect = this.elements.paperSlotArea.getBoundingClientRect();
    const stageRect = this.elements.balloonsContainer.getBoundingClientRect();
    const startY = slotRect.top - stageRect.top;
    const charCode = char.toLowerCase().charCodeAt(0);
    let alphabetIndex = charCode - 97;

    if (alphabetIndex < 0 || alphabetIndex > 25) {
      alphabetIndex = 12;
    }

    const padding = slotRect.width * 0.1;
    const usableWidth = slotRect.width - padding * 2;
    const step = usableWidth / 25;
    const startX = slotRect.left - stageRect.left + padding + step * alphabetIndex;

    return { x: startX, y: startY };
  }

  refreshLayout() {
    const rect = this.elements.balloonsContainer.getBoundingClientRect();
    for (const balloon of this.activeBalloons) {
      this.measureAttachment(balloon);
      const metrics = this.pretextEngine.getGlyphMetrics(balloon.index);
      if (!metrics) continue;
      const origin = this.getOriginCoordsForAlphabet(balloon.char);
      balloon.originX = origin.x;
      balloon.originY = origin.y;
      balloon.targetX = metrics.x - rect.left;
      balloon.targetY = metrics.y - rect.top;
    }
  }

  update(currentTimeSeconds) {
    for (let index = this.activeBalloons.length - 1; index >= 0; index -= 1) {
      const balloon = this.activeBalloons[index];
      const windBend = Math.sin(currentTimeSeconds * 1.5 + balloon.swayOffset) * 30;

      switch (balloon.state) {
        case 'rising':
          balloon.progress += balloon.speed;
          if (balloon.progress >= 1) {
            balloon.progress = 1;
            balloon.state = 'swaying';
          }

          this.updateRisingBalloon(balloon, windBend);
          break;
        case 'swaying':
          this.updateSwayingBalloon(balloon, currentTimeSeconds, windBend);
          break;
        case 'falling':
          if (this.updateFallingBalloon(balloon)) {
            this.destroyBalloon(index, true);
          }
          break;
        case 'success_retracting':
          this.updateRetractingBalloon(balloon, currentTimeSeconds, windBend);
          break;
        case 'hovering':
          balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%)) rotate(${balloon.currentRot}deg)`;
          break;
        case 'blowing_away':
          if (this.updateBlowingBalloon(balloon, currentTimeSeconds)) {
            this.destroyBalloon(index, false);
          }
          break;
        default:
          break;
      }
    }

    this.updatePhaseTransitions();
  }

  updateRisingBalloon(balloon, windBend) {
    const easeValue = easeOutQuad(balloon.progress);
    balloon.currentX = balloon.startX + (balloon.targetX - balloon.startX) * easeValue;
    balloon.currentY = balloon.startY + (balloon.targetY - balloon.startY) * easeValue;
    balloon.currentRot = 0;

    balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%))`;
    this.updateBalloonPath(balloon, balloon.originX, balloon.originY, windBend * balloon.progress);
  }

  updateSwayingBalloon(balloon, currentTimeSeconds, windBend) {
    balloon.currentRot = Math.sin(currentTimeSeconds * 2 + balloon.swayOffset) * 6;
    const swayX = Math.sin(currentTimeSeconds * 1.5 + balloon.swayOffset) * 3;
    balloon.currentX = balloon.targetX + swayX;
    balloon.currentY = balloon.targetY;
    balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%)) rotate(${balloon.currentRot}deg)`;
    this.updateBalloonPath(balloon, balloon.originX, balloon.originY, windBend);
  }

  updateFallingBalloon(balloon) {
    balloon.fallProgress += 0.08;
    if (balloon.fallProgress >= 1) {
      return true;
    }

    const fallValue = easeInCubic(balloon.fallProgress);
    balloon.currentX = balloon.startX + (balloon.originX - balloon.startX) * fallValue;
    balloon.currentY = balloon.startY + (balloon.originY - balloon.startY) * fallValue;
    balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%)) rotate(${balloon.currentRot}deg)`;
    this.updateBalloonPath(balloon, balloon.originX, balloon.originY, 0);

    return false;
  }

  updateRetractingBalloon(balloon, currentTimeSeconds, windBend) {
    balloon.retractProgress += 0.05;
    if (balloon.retractProgress >= 1) {
      balloon.pathElement.remove();
      balloon.state = 'hovering';
      return;
    }

    const retractY = balloon.originY + (balloon.currentY - balloon.originY) * balloon.retractProgress;
    const retractX = balloon.originX + (balloon.currentX - balloon.originX) * balloon.retractProgress;
    this.updateBalloonPath(balloon, retractX, retractY, windBend * (1 - balloon.retractProgress));

    balloon.currentRot = Math.sin(currentTimeSeconds * 2 + balloon.swayOffset) * 6;
    balloon.currentX = balloon.targetX + Math.sin(currentTimeSeconds * 1.5 + balloon.swayOffset) * 3;
    balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%)) rotate(${balloon.currentRot}deg)`;
  }

  updateBlowingBalloon(balloon, currentTimeSeconds) {
    balloon.velX += 0.03;
    balloon.velX *= 0.98;
    balloon.velY += Math.cos(currentTimeSeconds * 3 + balloon.swayOffset) * 0.03;
    balloon.velY *= 0.95;
    balloon.currentX += balloon.velX;
    balloon.currentY += balloon.velY;
    balloon.currentRot += balloon.rotVel;
    balloon.opacity -= 0.007;

    if (balloon.opacity <= 0) {
      return true;
    }

    const blurAmount = (1 - balloon.opacity) * 6;
    balloon.element.style.transform = `translate(calc(${balloon.currentX}px - 50%), calc(${balloon.currentY}px - 100%)) rotate(${balloon.currentRot}deg)`;
    balloon.element.style.opacity = `${balloon.opacity}`;
    balloon.element.style.filter = `blur(${blurAmount}px)`;

    return false;
  }

  updatePhaseTransitions() {
    if (this.gameState === GAME_PHASES.WAITING_TO_RISE) {
      const allRisen = this.activeBalloons.every((balloon) => balloon.state === 'swaying' || balloon.state === 'dead');
      if (allRisen && this.activeBalloons.length > 0 && !this.phaseTransitionScheduled) {
        this.gameState = GAME_PHASES.WAITING_TO_RETRACT;
        this.phaseTransitionScheduled = true;
        this.schedule(() => {
          this.gameState = GAME_PHASES.RETRACTING;
          this.phaseTransitionScheduled = false;
          this.activeBalloons.forEach((balloon) => {
            if (balloon.state === 'swaying') {
              balloon.state = 'success_retracting';
              balloon.retractProgress = 0;
            }
          });
        }, TIMINGS.admireDelayMs);
      }
    }

    if (this.gameState === GAME_PHASES.RETRACTING) {
      const allRetracted = this.activeBalloons.every((balloon) => balloon.state === 'hovering' || balloon.state === 'dead');
      if (allRetracted && this.activeBalloons.length > 0 && !this.phaseTransitionScheduled) {
        this.gameState = GAME_PHASES.HOVERING;
        this.phaseTransitionScheduled = true;
        this.schedule(() => {
          this.gameState = GAME_PHASES.BLOWING;
          this.phaseTransitionScheduled = false;
          this.activeBalloons.forEach((balloon) => {
            if (balloon.state === 'hovering') {
              balloon.state = 'blowing_away';
              balloon.velX = 1.5 + Math.random();
              balloon.velY = (Math.random() - 0.5) * 1.5;
              balloon.rotVel = (Math.random() - 0.5) * 3;
            }
          });

          this.elements.targetPoemContainer.classList.add('fade-out');

          this.schedule(() => {
            this.loadNextPoem();
          }, TIMINGS.reloadDelayMs);
        }, TIMINGS.hoverDelayMs);
      }
    }
  }

  updatePath(pathElement, startX, startY, endX, endY, bendAmount) {
    if (!pathElement) {
      return;
    }

    const midX = (startX + endX) / 2 + bendAmount;
    const midY = (startY + endY) / 2;
    pathElement.setAttribute('d', `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`);
  }

  schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);

    this.timers.add(timer);
  }

  clearTimers() {
    this.timers.forEach((timer) => window.clearTimeout(timer));
    this.timers.clear();
  }

  destroyBalloon(index, removePath) {
    const balloon = this.activeBalloons[index];
    balloon.element.remove();
    if (removePath && balloon.pathElement) {
      balloon.pathElement.remove();
    }
    balloon.state = 'dead';
    this.activeBalloons.splice(index, 1);
  }

  dispose() {
    this.clearTimers();
  }
}
