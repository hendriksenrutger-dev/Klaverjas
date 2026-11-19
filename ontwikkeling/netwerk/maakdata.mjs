// Optie B, stap 1: oefenmateriaal maken voor het netwerk.
// Speelt willekeurige potjes (kiesSlim, met af en toe een willekeurige kaart voor afwisseling)
// en rekent standen met nog 6 slagen of minder exact door (open kaarten): de waarde van elke
// geldige kaart. Schrijft één regel JSON per stand.
// Gebruik: node ontwikkeling/netwerk/maakdata.mjs <uitbestand.jsonl> <minuten> [kernen]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

if (isMainThread) {
  const [, , uit, minuten = '60', kernen = '4'] = process.argv;
  const stream = fs.createWriteStream(uit, { flags: 'a' });
  let n = 0;
  const eind = Date.now() + +minuten * 60000;
  for (let i = 0; i < +kernen; i++) {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { eind, zaad: Date.now() + i } });
    w.on('message', (regel) => { stream.write(regel + '\n'); if (++n % 1000 === 0) console.log(new Date().toISOString(), n); });
    w.on('error', (e) => console.error(e));
  }
} else {
  const { maakDeck, kaartId, team, KLEUREN } = await import('../../src/regels/kaarten.js');
  const { kiesSlim, kaartWaarden } = await import('../../src/ai/simulatie.js');
  const { geldigeKaarten } = await import('../../src/regels/geldig.js');
  const { huidigeWinnaar, slagPunten, sterkte, PUNTEN_LAATSTE_SLAG } = await import('../../src/regels/rangorde.js');
  const { roemInSlag } = await import('../../src/regels/roem.js');
  const { eind } = workerData;
  const rng = Math.random;
  const id = kaartId;
  while (Date.now() < eind) {
    const d = maakDeck();
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    const handen = [0, 1, 2, 3].map((p) => d.slice(p * 8, p * 8 + 8));
    const troef = KLEUREN[Math.floor(rng() * 4)];
    // Wie speelt: wie de sterkste troef heeft (zoals bij het draaien ongeveer).
    const kracht = (h) => h.filter((k) => k.kleur === troef).reduce((s, k) => s + 2 + sterkte(k, troef), 0);
    const kiezer = [0, 1, 2, 3].reduce((a, b) => (kracht(handen[b]) > kracht(handen[a]) ? b : a));
    const ctx = { troef, systeem: rng() < 0.7 ? 'amsterdams' : 'rotterdams', spelendTeam: team(kiezer), strategie: 'slim' };
    let beurt = Math.floor(rng() * 4);
    let slag = [], slagen = [];
    while (slagen.length < 8) {
      const g = geldigeKaarten(handen[beurt], slag, troef, ctx.systeem);
      const slim = kiesSlim(handen, slag, ctx, beurt, rng);
      if (g.length > 1 && slagen.length >= 2 && rng() < 0.25) {
        const waarden = kaartWaarden(handen, slag, slagen, beurt, ctx);
        parentPort.postMessage(JSON.stringify({
          h: handen.map((x) => x.map(id)), s: slag.map((x) => [x.speler, id(x.kaart)]),
          sl: slagen.map((x) => [x.winnaar, x.punten, x.roem.totaal]),
          b: beurt, t: troef, sy: ctx.systeem, sp: ctx.spelendTeam,
          w: waarden.map((x) => [id(x.kaart), x.waarde]), slim: id(slim),
        }));
      }
      const k = rng() < 0.15 ? g[Math.floor(rng() * g.length)] : slim;
      handen[beurt].splice(handen[beurt].indexOf(k), 1);
      slag.push({ speler: beurt, kaart: k });
      if (slag.length < 4) { beurt = (beurt + 1) % 4; continue; }
      const winnaar = huidigeWinnaar(slag, troef).speler;
      const kaarten = slag.map((x) => x.kaart);
      slagen.push({ kaarten: slag, winnaar, punten: slagPunten(kaarten, troef) + (slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0), roem: roemInSlag(kaarten, troef) });
      slag = [];
      beurt = winnaar;
    }
  }
  process.exit(0);
}
