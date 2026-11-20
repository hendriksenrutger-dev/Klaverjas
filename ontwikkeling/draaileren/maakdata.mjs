// Spelen of passen leren, stap 1: oefenmateriaal.
// Per deling verloopt het draaien zoals in het spel (huidige computer). Bij een twijfelachtige
// beslissing wordt het potje twee keer verder gespeeld: één keer "spelen" en één keer "passen"
// (daarna kiezen de anderen zoals altijd; rondpassen = 0). Beide keren speelt de computer het potje
// uit op niveau normaal, zonder open kaarten. Doel: verschil (spelen − passen) voor het team van de kiezer.
// Gebruik: node ontwikkeling/draaileren/maakdata.mjs <uit.jsonl> <minuten> [kernen]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

if (isMainThread) {
  const [, , uit, minuten = '60', kernen = '4'] = process.argv;
  const stream = fs.createWriteStream(uit, { flags: 'a' });
  let n = 0;
  const eind = Date.now() + +minuten * 60000;
  for (let i = 0; i < +kernen; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { eind, zaad: (Date.now() % 1e6) * 10 + i } });
    w.on('message', (regel) => { stream.write(regel + '\n'); if (++n % 200 === 0) console.log(new Date().toISOString(), n); });
    w.on('error', (e) => console.error(e));
  }
} else {
  const R = await import('../../src/regels/index.js');
  const A = await import('../../src/ai/simulatie.js');
  const { eind, zaad } = workerData;
  const rng = R.maakRng(zaad);
  const id = R.kaartId;
  const team = R.team;

  // Speel het draaien verder vanaf d met de huidige computer; geeft het potje (of null bij rondpassen).
  function verder(d, handen) {
    while (!d.uitkomst) {
      const s = d.beurt;
      const k = A.kiesDraai(handen[s], d.kaart.kleur, { speler: s, deler: d.deler, rng }).keuze;
      d = R.beslis(d, s, k);
    }
    return d.uitkomst.soort === 'spelen' ? d : null;
  }
  function speelUit(d, handen, speler) {
    if (!d) return 0; // rondpassen: opnieuw delen, potje telt niet
    let p = R.nieuwPotje({ handen: handen.map((h) => h.slice()), troef: d.uitkomst.troef, spelendTeam: d.uitkomst.team, uitkomer: (d.deler + 1) % 4, kiezer: d.uitkomst.speler });
    while (!p.klaar) p = R.speelKaart(p, p.beurt, A.kiesKaart(A.waarneming(p, p.beurt), { ...A.NIVEAUS.normaal, rng }).kaart);
    const u = R.uitslag(p);
    const t = team(speler);
    return u.totaal[t] - u.totaal[1 - t];
  }

  while (Date.now() < eind) {
    const deler = Math.floor(rng() * 4);
    const handen = R.deel(R.schud(R.maakDeck(), rng), deler);
    let d = R.nieuwDraaien({ stapel: R.schud(R.maakDeck(), rng), deler, maxRondes: 2 });
    while (!d.uitkomst) {
      const s = d.beurt;
      const kleur = d.kaart.kleur;
      const g = A.kiesDraai(handen[s], kleur, { speler: s, deler, rng }).gemiddeld;
      // Alleen twijfelgevallen: daar maakt een betere beslissing verschil.
      if (Math.abs(g - 10) < 70 && rng() < 0.6) {
        const spelen = speelUit(R.beslis(d, s, 'spelen'), handen, s);
        const passen = speelUit(verder(R.beslis(d, s, 'passen'), handen), handen, s);
        parentPort.postMessage(JSON.stringify({
          hand: handen[s].map(id), troef: kleur, plek: (s - deler + 4) % 4, ronde: d.rondes, pasTeller: d.pasTeller,
          gepast: d.gepast, g: Math.round(g * 10) / 10, spelen, passen,
        }));
      }
      d = R.beslis(d, s, g > A.DRAAI_DREMPEL ? 'spelen' : 'passen');
    }
  }
  process.exit(0);
}
