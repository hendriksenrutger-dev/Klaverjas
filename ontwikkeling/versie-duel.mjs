// Duel tussen de huidige code en een oudere versie (bijvoorbeeld main in een aparte map).
// Gebruik: node ontwikkeling/versie-duel.mjs <map met oude versie> <delingen> <zaad>
// Zelfde opzet als duelKaart: contract neutraal bepaald, elke deling twee keer met teams omgewisseld.
import path from 'node:path';
const [, , oudMap, n = '150', z = '1'] = process.argv;
const R = await import('../src/regels/index.js');
const NIEUW = await import('../src/ai/simulatie.js');
const OUD = await import(path.resolve(oudMap, 'src/ai/simulatie.js'));
// SEINF=<getal>: andere seinfactor (kleintjes) voor de nieuwe versie, om te meten.
const extra = process.env.SEINF ? { seinFactor: +process.env.SEINF } : {};
const speler = (A, rng) => ({ kaart: (p, s) => A.kiesKaart(A.waarneming(p, s), { ...A.NIVEAUS.normaal, ...(A === NIEUW ? extra : {}), rng }).kaart });
let verschil = 0, gespeeld = 0;
const per = [];
for (let d = 0; d < +n; d++) {
  const rng = R.maakRng(+z * 1000 + d);
  const handen = R.deel(R.schud(R.maakDeck(), rng), d % 4);
  const stapel = R.schud(R.maakDeck(), rng);
  const drng = R.maakRng(+z * 7919 + d);
  let dr = R.nieuwDraaien({ stapel, deler: d % 4, maxRondes: 2 });
  while (!dr.uitkomst) dr = R.beslis(dr, dr.beurt, NIEUW.kiesDraai(handen[dr.beurt], dr.kaart.kleur, { speler: dr.beurt, deler: d % 4, rng: drng, strategie: 'simpel' }).keuze);
  if (dr.uitkomst.soort !== 'spelen') continue;
  let som = 0;
  for (const om of [false, true]) {
    const krng = R.maakRng(+z * 104729 + d);
    const a = speler(NIEUW, krng), b = speler(OUD, krng);
    const sp = om ? [b, a, b, a] : [a, b, a, b];
    let p = R.nieuwPotje({ handen: handen.map((h) => h.slice()), troef: dr.uitkomst.troef, spelendTeam: dr.uitkomst.team, uitkomer: (d % 4 + 1) % 4, kiezer: dr.uitkomst.speler });
    while (!p.klaar) p = R.speelKaart(p, p.beurt, sp[p.beurt].kaart(p, p.beurt));
    const u = R.uitslag(p);
    const tA = om ? 1 : 0;
    som += u.totaal[tA] - u.totaal[1 - tA];
  }
  gespeeld += 2; verschil += som; per.push(som / 2);
}
const gem = verschil / gespeeld;
const sd = Math.sqrt(per.reduce((t, x) => t + (x - gem) ** 2, 0) / (per.length - 1));
console.log(JSON.stringify({ nieuwMinOud: +gem.toFixed(2), foutmarge: +(2 * sd / Math.sqrt(per.length)).toFixed(2), gespeeld, verschillend: per.filter((x) => x !== 0).length }));
