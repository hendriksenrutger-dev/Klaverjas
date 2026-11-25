// Straf voor een vals sein vergelijken: team A met een andere straf, team B met de huidige.
// Gebruik: node ontwikkeling/sein-duel.mjs <straf> <delingen> <zaad>
import { duel } from './duel.mjs';
const A = await import('../src/ai/simulatie.js');
const [, , straf, n = '200', z = '1'] = process.argv;
const basis = { sims: 40, draaiStrategie: 'slim', draaiGeleerd: true };
const start = Date.now();
console.log('straf', straf, JSON.stringify(duel({ ...basis, straf: +straf }, { ...basis, straf: A.SEIN_STRAF }, +n, +z)), `${Math.round((Date.now() - start) / 1000)} s`);
