// Serialize switches so a fast series of clicks never interleaves DOM updates.
export function createTransitions(root) {
  let queue = Promise.resolve();
  const fade = async (elements, from, to) => {
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const animations = elements.map(element => element.animate([{ opacity: from }, { opacity: to }], {
      duration, easing: 'ease-in-out', fill: 'forwards',
    }));
    await Promise.all(animations.map(animation => animation.finished));
    return animations;
  };
  return (kind, change) => {
    const run = async () => {
      root.dataset.transition = kind;
      // Language includes the complete panels so their reflow happens invisibly.
      const elements = kind === 'mode' ? [root.querySelector('#stage'), root.querySelector('.locale-switch')]
        : [...root.querySelectorAll('.app-toolbar, #stage, .key-legend, .guide-link')];
      let out = [], into = [];
      try {
        out = await fade(elements, 1, 0);
        await change();
        into = await fade(elements, 0, 1);
      } finally {
        [...out, ...into].forEach(animation => animation.cancel());
        delete root.dataset.transition;
      }
    };
    queue = queue.then(run, run);
    return queue;
  };
}
