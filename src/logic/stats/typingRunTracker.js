export class TypingRunTracker {
  constructor(options = {}) {
    this.now = options.now ?? (() => performance.now());
    this.sampleSize = options.sampleSize ?? 5;
    this.reset();
  }

  reset() {
    this.poemText = '';
    this.startedAtMs = null;
    this.lastInputAtMs = null;
    this.backspaceCount = 0;
    this.inputSample = [];
    this.lastCompletedRun = null;
  }

  startRun(poemText, startedAtMs) {
    this.poemText = poemText;
    this.startedAtMs = startedAtMs;
    this.lastInputAtMs = startedAtMs;
    this.backspaceCount = 0;
    this.inputSample = [];
  }

  recordInput(inputResult) {
    if (!inputResult.accepted) {
      return null;
    }

    const timestampMs = this.now();

    if (inputResult.inputKind === 'char') {
      if (this.startedAtMs === null || this.poemText !== inputResult.poemText) {
        this.startRun(inputResult.poemText, timestampMs);
      } else {
        const deltaMs = timestampMs - this.lastInputAtMs;
        if (this.inputSample.length < this.sampleSize) {
          this.inputSample.push(Math.round(deltaMs));
        }
        this.lastInputAtMs = timestampMs;
      }
    }

    if (inputResult.inputKind === 'backspace' && this.startedAtMs !== null) {
      this.backspaceCount += 1;
    }

    return {
      backspaceCount: this.backspaceCount,
      inputSample: [...this.inputSample],
      poemText: this.poemText,
    };
  }

  finishRun() {
    if (this.startedAtMs === null || !this.poemText) {
      return null;
    }

    const finishedAtMs = this.now();
    const elapsedMs = Math.max(1, Math.round(finishedAtMs - this.startedAtMs));
    const typedLength = this.poemText.length;
    const cps = Number((typedLength / (elapsedMs / 1000)).toFixed(2));

    this.lastCompletedRun = {
      poemText: this.poemText,
      typedLength,
      elapsedMs,
      backspaceCount: this.backspaceCount,
      inputSample: [...this.inputSample],
      cps,
    };

    this.poemText = '';
    this.startedAtMs = null;
    this.lastInputAtMs = null;
    this.backspaceCount = 0;
    this.inputSample = [];

    return this.lastCompletedRun;
  }

  getLastCompletedRun() {
    return this.lastCompletedRun;
  }

  getElapsedMs() {
    return this.startedAtMs === null
      ? (this.lastCompletedRun?.elapsedMs ?? 0)
      : Math.max(0, this.now() - this.startedAtMs);
  }
}
