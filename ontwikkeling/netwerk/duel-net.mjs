// Optie B: duel van de computer met het netwerk in de proefpotjes tegen de huidige.
// Gebruik: node ontwikkeling/netwerk/duel-net.mjs <netbestand> <sims met netwerk> <delingen> <zaad>
import fs from 'node:fs';
import { duelKaart } from '../duel.mjs';
import { netUitJson } from '../../src/ai/netwerk.js';
const [, , bestand, sims = '100', n = '150', z = '1', vanaf = '0'] = process.argv;
const net = netUitJson(JSON.parse(fs.readFileSync(bestand)));
const basis = { sims: 100, draaiStrategie: 'simpel' };
const start = Date.now();
console.log(`netwerk ${sims} (vanaf slag ${+vanaf + 1}) vs normaal 100`, JSON.stringify(duelKaart({ ...basis, sims: +sims, net, netVanaf: +vanaf }, basis, +n, +z)), `${Math.round((Date.now() - start) / 1000)} s`);
