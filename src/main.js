import './styles.css';
import { bootstrapAppRuntime } from './logic/hooks/bootstrapAppRuntime.js';

const root = document.querySelector('#app');

bootstrapAppRuntime(root);