import { createTypewriterApp } from './logic/hooks/createTypewriterApp.js';
import { renderTypewriterScreen } from './view/screens/typewriterScreen.js';

export function mountApp(rootElement) {
  rootElement.innerHTML = renderTypewriterScreen();
  return createTypewriterApp(rootElement);
}