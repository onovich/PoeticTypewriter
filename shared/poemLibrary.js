import { CLASSIC_POEMS } from './classicPoems.js';

export const POEM_LIBRARY = Object.freeze(CLASSIC_POEMS.map(poem => poem.text));
const byText = new Map(CLASSIC_POEMS.map(poem => [poem.text, poem]));
export const getPoemAttribution = text => byText.get(text) ?? null;
