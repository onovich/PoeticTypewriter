export class PretextEngine {
  constructor() {
    this.targetSpans = [];
  }

  init(container, text) {
    container.innerHTML = '';
    this.targetSpans = [];

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const span = document.createElement('span');
      span.innerText = char === ' ' ? '\u00A0' : char;
      span.className = 'inline-block transition-opacity duration-500';
      container.appendChild(span);
      this.targetSpans.push({ char, element: span });
    }
  }

  getGlyphMetrics(index) {
    if (index < 0 || index >= this.targetSpans.length) {
      return null;
    }

    const rect = this.targetSpans[index].element.getBoundingClientRect();

    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }
}