// Toont een potje zet voor zet, om de keuzes van de AI te beoordelen.
// Gebruik: node ontwikkeling/verloop.mjs [zaad]
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const zaad = +(process.argv[2] || 1);
const rng = R.maakRng(zaad);
const S = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const t = (k) => S[k.kleur] + k.rang;
const NAMEN = ['Zuid', 'West', 'Noord', 'Oost'];
const handen = R.deel(R.schud(R.maakDeck(), rng), 3);
const stapel = R.schud(R.maakDeck(), rng);
let d = R.nieuwDraaien({ stapel, deler: 3 });
while (!d.uitkomst) {
  const r = A.kiesDraai(handen[d.beurt], d.kaart.kleur, { speler: d.beurt, deler: 3, rng });
  console.log(`${NAMEN[d.beurt]} ${r.keuze} op ${d.kaart.kleur} (verwacht ${r.gemiddeld.toFixed(0)})`);
  d = R.beslis(d, d.beurt, r.keuze);
}
if (d.uitkomst.soort !== 'spelen') { console.log('opnieuw delen'); process.exit(); }
const sorteer = (h, tr) => h.slice().sort((a, b) => (a.kleur === tr) - (b.kleur === tr) || a.kleur.localeCompare(b.kleur) || R.sterkte(b, tr) - R.sterkte(a, tr));
console.log(`\nTroef ${d.uitkomst.troef}, ${NAMEN[d.uitkomst.speler]} speelt`);
for (let p = 0; p < 4; p++) console.log(NAMEN[p].padEnd(6), sorteer(handen[p], d.uitkomst.troef).map(t).join(' '));
let p = R.nieuwPotje({ handen, troef: d.uitkomst.troef, spelendTeam: d.uitkomst.team, uitkomer: 0 });
while (!p.klaar) {
  const s = p.beurt;
  const r = A.kiesKaart(A.waarneming(p, s), { simulaties: 100, rng });
  const opties = r.scores ? '  [' + r.scores.map((x) => `${t(x.kaart)}:${x.gemiddeld.toFixed(0)}`).join(' ') + ']' : '';
  console.log(`  ${NAMEN[s].padEnd(6)} ${t(r.kaart)}${opties}`);
  p = R.speelKaart(p, s, r.kaart);
  if (p.slag.length === 0) {
    const sl = p.slagen.at(-1);
    console.log(`  -> ${NAMEN[sl.winnaar]} (${sl.punten}${sl.roem.totaal ? ' + ' + sl.roem.totaal + ' roem' : ''})`);
  }
}
const u = R.uitslag(p);
console.log('Uitslag wij/zij', u.totaal, u.nat ? 'NAT' : '', u.pit !== null ? 'PIT' : '');
