// Stap 1 "computer beter laten spelen": hoeveel valt er te winnen?
// Gebruik: node ontwikkeling/bovengrens.mjs <vals|sterk|eindspel4|eindspel5> <delingen> <zaad>
// - vals: een computer die alle kaarten ziet (zelfde rekenmethode) tegen normaal. Bovengrens van
//   wat beter inschatten van de kaartverdeling kan opleveren.
// - sterk: 300 simulaties tegen 100 (normaal).
// - eindspel4/5: de laatste 4 of 5 slagen exact doorrekenen in plaats van 3.
// Beide teams draaien (spelen/passen) op dezelfde manier, zodat alleen het kaartspel verschilt.
import { duelKaart } from './duel.mjs';

const [, , welke, n = '150', z = '41'] = process.argv;
const basis = { sims: 100, draaiStrategie: 'simpel' };
const A = {
  gelijk: { ...basis },
  vals: { ...basis, vals: true, sims: 20 },
  sterk: { ...basis, sims: 300 },
  eindspel4: { ...basis, eindspel: 4 },
  eindspel5: { ...basis, eindspel: 5 },
  gedekt: { ...basis, slim: { gedekt: true, maatNeemt: false } },
  maatNeemt: { ...basis, slim: { gedekt: false, maatNeemt: true } },
  regelGedekt: { ...basis, gedektRegel: true },
  zonderLijst: { ...basis, regels: (await import('../src/ai/simulatie.js')).GEEN_NIEUWE_REGELS },
  zonderNieuweRegels: { ...basis, regels: { uitkomen: false, bijgooien: false, troefGevraagd: false } },
  alleenUitkomen: { ...basis, regels: { uitkomen: true, bijgooien: false, troefGevraagd: false } },
  alleenBijgooien: { ...basis, regels: { uitkomen: false, bijgooien: true, troefGevraagd: false } },
  alleenTroef: { ...basis, regels: { uitkomen: false, bijgooien: false, troefGevraagd: true } },
  geenVuistregels: { ...basis, vuist: false },
  zonderSpek: { ...basis, spekMarge: 0 },
  zonderTien: { ...basis, tien: false },
  zonderTrekHoog: { ...basis, regels: { ...(await import('../src/ai/simulatie.js')).VUISTREGELS, trekHoog: false } },
  beide: { ...basis, slim: { gedekt: true, maatNeemt: true } },
}[welke];
if (!A) throw new Error('onbekende vergelijking');
const start = Date.now();
console.log(welke, 'vs normaal', duelKaart(A, basis, +n, +z), `${Math.round((Date.now() - start) / 1000)} s`);
