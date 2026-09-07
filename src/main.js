import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/special-elite/latin-400.css';
import './styles.css';
import { bootstrapAppRuntime } from './logic/hooks/bootstrapAppRuntime.js';

const root = document.querySelector('#app');

bootstrapAppRuntime(root);
