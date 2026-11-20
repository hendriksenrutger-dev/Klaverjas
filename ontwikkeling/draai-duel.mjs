// Spelen of passen vergelijken: team A en B spelen hetzelfde kaartspel, alleen het draaien verschilt.
// Gebruik: node ontwikkeling/draai-duel.mjs <pas|d0|d20|d5|d15> <delingen> <zaad>
import { duel } from './duel.mjs';
const [, , welke, n = '200', z = '1'] = process.argv;
import fs from 'node:fs';
const basis = { sims: 40, draaiStrategie: 'slim' };
const V = {
  pas: [{ ...basis, pasLezen: true }, { ...basis }],
  d0: [{ ...basis, drempel: 0 }, { ...basis }],
  d5: [{ ...basis, drempel: 5 }, { ...basis }],
  d15: [{ ...basis, drempel: 15 }, { ...basis }],
  d20: [{ ...basis, drempel: 20 }, { ...basis }],
  geleerd: [{ ...basis, geleerd: process.env.W && JSON.parse(fs.readFileSync(process.env.W)) }, { ...basis }],
  s300: [{ ...basis, draaiSims: 300 }, { ...basis }],
}[welke];
const start = Date.now();
console.log(welke, JSON.stringify(duel(V[0], V[1], +n, +z)), `${Math.round((Date.now() - start) / 1000)} s`);
