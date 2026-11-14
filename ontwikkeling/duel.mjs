// Laat computerteams tegen elkaar spelen om instellingen van de AI te vergelijken.
// Gebruik: node ontwikkeling/duel.mjs sims | drempel | makkelijk
// Duel: team 0 (spelers 0,2) met config A tegen team 1 met config B.
// Elke deling wordt twee keer gespeeld met de teams omgewisseld (duplicaat), om toeval te dempen.
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const W = await import('../src/ai/willekeurig.js');

function speler(cfg, rng) {
  return {
    draai: (hand, kleur, speler, deler) => cfg.random ? W.kiesDraai(rng) : A.kiesDraai(hand, kleur, { speler, deler, rng, drempel: cfg.drempel ?? A.DRAAI_DREMPEL, simulaties: cfg.draaiSims ?? A.DRAAI_SIMULATIES, strategie: cfg.draaiStrategie ?? cfg.strategie ?? 'slim', trekken: cfg.draaiTrekken ?? cfg.trekken }).keuze,
    kaart: (potje, s) => cfg.random ? W.kiesKaart(R.geldigVoor(potje, s), rng) : A.kiesKaart(A.waarneming(potje, s), { simulaties: cfg.sims, rng, strategie: cfg.strategie ?? 'slim', trekken: cfg.trekken, trekBonus: cfg.trekBonus ?? A.TREK_BONUS, eindspel: cfg.eindspel ?? A.EINDSPEL_SLAGEN, seinGeven: cfg.geven ?? true, seinStraf: cfg.straf, seinStrafBekennen: cfg.strafBekennen, draaiInfo: cfg.draaiInfo ?? true, vuistregels: cfg.vuist ?? true, marge: cfg.marge ?? A.VUISTREGEL_MARGE, seinLezen: cfg.lezen ?? true, seinFactor: cfg.factor ?? A.SEIN_FACTOR, bekendeHanden: cfg.vals ? potje.handen : null }).kaart,
  };
}

function speelDeling(spelers, handen, stapel, deler) {
  let d = R.nieuwDraaien({ stapel, deler, maxRondes: 2 });
  while (!d.uitkomst) d = R.beslis(d, d.beurt, spelers[d.beurt].draai(handen[d.beurt], d.kaart.kleur, d.beurt, deler));
  if (d.uitkomst.soort !== 'spelen') return null;
  let p = R.nieuwPotje({ handen, troef: d.uitkomst.troef, spelendTeam: d.uitkomst.team, uitkomer: (deler + 1) % 4, kiezer: d.uitkomst.speler });
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
if (mode === 'slim') {
  console.log('slim vs simpel', duel({ sims: 100 }, { sims: 100, strategie: 'simpel', eindspel: 0 }, +(process.argv[3] || 150), 5));
}
if (mode === 'eindspel') {
  console.log('slim+eindspel vs slim zonder', duel({ sims: 100 }, { sims: 100, eindspel: 0 }, +(process.argv[3] || 150), 6));
}
if (mode === 'drempel2') {
  for (const dr of [0, 20]) console.log('drempel', dr, 'vs 10', duel({ sims: 60, drempel: dr }, { sims: 60, drempel: 10 }, 200, 8));
}
if (mode === 'kaartspel') {
  // Alleen het kaartspel vergelijken: beide teams draaien met dezelfde (simpele) beoordeling.
  console.log('kaartspel slim vs simpel', duel({ sims: 100, draaiStrategie: 'simpel', eindspel: 0 }, { sims: 100, strategie: 'simpel', eindspel: 0 }, +(process.argv[3] || 150), 9));
  console.log('eindspel aan vs uit (simpel)', duel({ sims: 100, strategie: 'simpel', eindspel: 3 }, { sims: 100, strategie: 'simpel', eindspel: 0 }, +(process.argv[3] || 150), 10));
}
if (mode === 'vals') {
  console.log('valsspeler vs normaal', duel({ sims: 20, vals: true, draaiStrategie: 'simpel' }, { sims: 100, draaiStrategie: 'simpel' }, +(process.argv[3] || 100), 12));
}
if (mode === 'vuist') {
  // node duel.mjs vuist <delingen> <zaad> <marge>
  const [, , , n, z, m] = process.argv;
  console.log('vuistregels (marge', +(m || A.VUISTREGEL_MARGE), ') vs zonder', duel({ sims: 100, marge: +(m || A.VUISTREGEL_MARGE) }, { sims: 100, vuist: false }, +(n || 150), +(z || 21)));
}
if (mode === 'groot') {
  // node duel.mjs groot <vergelijking> <delingen> <zaad>
  const [, , , welke, n, z] = process.argv;
  const V = {
    kaart: [{ sims: 100, draaiStrategie: 'simpel' }, { sims: 100, strategie: 'simpel', eindspel: 0 }],
    draai: [{ sims: 100, strategie: 'simpel', eindspel: 0, draaiStrategie: 'slim' }, { sims: 100, strategie: 'simpel', eindspel: 0, draaiStrategie: 'simpel' }],
    sims: [{ sims: 300 }, { sims: 100 }],
    lezen: [{ sims: 100 }, { sims: 100, lezen: false }],
    lezen10: [{ sims: 100, factor: 10 }, { sims: 100, lezen: false }],
    geven: [{ sims: 100 }, { sims: 100, geven: false }],
    factor2: [{ sims: 100, factor: 2 }, { sims: 100 }],
    factor10: [{ sims: 100, factor: 10 }, { sims: 100 }],
    makkelijk: [{ sims: 5, strategie: 'simpel', eindspel: 0 }, { sims: 100 }],
    trekken: [{ sims: 100 }, { sims: 100, trekken: false }],
    straf15: [{ sims: 100 }, { sims: 100, straf: 40 }],
    draaiInfo: [{ sims: 100 }, { sims: 100, draaiInfo: false }],
    strafSplit: [{ sims: 100 }, { sims: 100, straf: 40, strafBekennen: 40 }],
    trekBonus: [{ sims: 100 }, { sims: 100, trekBonus: 0 }],
    trekBonus20: [{ sims: 100, trekBonus: 20 }, { sims: 100, trekBonus: 0 }],
    trekkenKaart: [{ sims: 100, draaiTrekken: false }, { sims: 100, trekken: false }],
    eind4: [{ sims: 100, eindspel: 4 }, { sims: 100, eindspel: 3 }],
  }[welke];
  console.log(JSON.stringify({ welke, zaad: +z, ...duel(V[0], V[1], +n, +z) }));
}
