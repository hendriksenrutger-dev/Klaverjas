// Hoe lang duurt een zet als de laatste N slagen exact worden doorgerekend?
// Gebruik: node ontwikkeling/denktijd.mjs <eindspel> [potjes]
// Meet per zet de rekentijd (100 simulaties) en toont gemiddelde, 95% en maximum.
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const eindspel = +(process.argv[2] || 3);
const potjes = +(process.argv[3] || 20);
const rng = R.maakRng(7);
const tijden = [];
for (let g = 0; g < potjes; g++) {
  const handen = R.deel(R.schud(R.maakDeck(), rng), g % 4);
  let p = R.nieuwPotje({ handen, troef: R.KLEUREN[g % 4], spelendTeam: g % 2, uitkomer: (g + 1) % 4, kiezer: g % 4 });
  while (!p.klaar) {
    const s = p.beurt;
    const t0 = performance.now();
    const r = A.kiesKaart(A.waarneming(p, s), { ...A.NIVEAUS.normaal, rng, eindspel });
    tijden.push(performance.now() - t0);
    p = R.speelKaart(p, s, r.kaart);
  }
}
tijden.sort((a, b) => a - b);
const gem = tijden.reduce((a, b) => a + b, 0) / tijden.length;
console.log(`eindspel ${eindspel}: gemiddeld ${gem.toFixed(0)} ms, 95% ${tijden[Math.floor(tijden.length * 0.95)].toFixed(0)} ms, max ${tijden.at(-1).toFixed(0)} ms (${tijden.length} zetten)`);
