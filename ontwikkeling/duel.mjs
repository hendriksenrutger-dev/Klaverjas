// Laat computerteams tegen elkaar spelen om instellingen van de AI te vergelijken.
// Gebruik: node ontwikkeling/duel.mjs sims | drempel | makkelijk
// Duel: team 0 (spelers 0,2) met config A tegen team 1 met config B.
// Elke deling wordt twee keer gespeeld met de teams omgewisseld (duplicaat), om toeval te dempen.
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const W = await import('../src/ai/willekeurig.js');

function speler(cfg, rng) {
  return {
    draai: (hand, kleur, speler, deler) => cfg.random ? W.kiesDraai(rng) : A.kiesDraai(hand, kleur, { speler, deler, rng, drempel: cfg.drempel ?? A.DRAAI_DREMPEL, simulaties: cfg.draaiSims ?? A.DRAAI_SIMULATIES }).keuze,
    kaart: (potje, s) => cfg.random ? W.kiesKaart(R.geldigVoor(potje, s), rng) : A.kiesKaart(A.waarneming(potje, s), { simulaties: cfg.sims, rng }).kaart,
  };
}

function speelDeling(spelers, handen, stapel, deler) {
  let d = R.nieuwDraaien({ stapel, deler, maxRondes: 2 });
  while (!d.uitkomst) d = R.beslis(d, d.beurt, spelers[d.beurt].draai(handen[d.beurt], d.kaart.kleur, d.beurt, deler));
  if (d.uitkomst.soort !== 'spelen') return null;
  let p = R.nieuwPotje({ handen, troef: d.uitkomst.troef, spelendTeam: d.uitkomst.team, uitkomer: (deler + 1) % 4 });
  while (!p.klaar) p = R.speelKaart(p, p.beurt, spelers[p.beurt].kaart(p, p.beurt));
  return { u: R.uitslag(p), spelend: p.spelendTeam };
}

export function duel(cfgA, cfgB, delingen, zaad = 1) {
  const rng = R.maakRng(zaad);
  let verschil = 0, natA = 0, natB = 0, speeltA = 0, speeltB = 0, gespeeld = 0;
  for (let n = 0; n < delingen; n++) {
    const handen = R.deel(R.schud(R.maakDeck(), rng), n % 4);
    const stapel = R.schud(R.maakDeck(), rng);
    for (const omgekeerd of [false, true]) {
      const a = speler(cfgA, rng), b = speler(cfgB, rng);
      const spelers = omgekeerd ? [b, a, b, a] : [a, b, a, b];
      const r = speelDeling(spelers, handen.map((h) => h.slice()), stapel, n % 4);
      if (!r) continue;
      gespeeld++;
      const tA = omgekeerd ? 1 : 0;
      verschil += r.u.totaal[tA] - r.u.totaal[1 - tA];
      if (r.spelend === tA) { speeltA++; if (r.u.nat) natA++; } else { speeltB++; if (r.u.nat) natB++; }
    }
  }
  return { gemVerschilPerPotje: +(verschil / gespeeld).toFixed(1), gespeeld, speeltA, natA, speeltB, natB };
}

const [, , mode] = process.argv;
if (mode === 'sims') {
  console.log('60 vs willekeurig', duel({ sims: 60 }, { random: true }, 100));
  console.log('15 vs 60', duel({ sims: 15 }, { sims: 60 }, 150));
  console.log('200 vs 60', duel({ sims: 200 }, { sims: 60 }, 150));
  console.log('600 vs 200', duel({ sims: 600 }, { sims: 200 }, 100));
}
if (mode === 'drempel') {
  for (const dr of [-20, 0, 10, 25, 40]) console.log('drempel', dr, 'vs 10', duel({ sims: 40, drempel: dr }, { sims: 40, drempel: 10 }, 250, 7));
}
if (mode === 'makkelijk') {
  console.log('5 vs 60', duel({ sims: 5 }, { sims: 60 }, 200, 3));
  console.log('2 vs 60', duel({ sims: 2 }, { sims: 60 }, 200, 3));
}
