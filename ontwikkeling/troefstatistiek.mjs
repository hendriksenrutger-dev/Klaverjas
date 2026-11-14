// Hoe vaak trekt de spelende partij troef bij uitkomen? Met voorbeelden.
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const rng = R.maakRng(+(process.argv[2] || 5));
const trekken = process.argv[3] !== 'oud';
const S = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const t = (k) => S[k.kleur] + k.rang;
let kansen = 0, getrokken = 0; const voorbeelden = [];
for (let g = 0; g < 60; g++) {
  const handen = R.deel(R.schud(R.maakDeck(), rng), g % 4);
  const troef = R.KLEUREN[g % 4];
  let p = R.nieuwPotje({ handen, troef, spelendTeam: g % 2, uitkomer: (g + 1) % 4 });
  while (!p.klaar) {
    const s = p.beurt;
    const r = A.kiesKaart(A.waarneming(p, s), { simulaties: 100, rng, trekken });
    if (p.slag.length === 0 && R.team(s) === p.spelendTeam) {
      const mijn = p.handen[s].filter((k) => k.kleur === troef).length;
      const tegen = [0, 1, 2, 3].filter((q) => R.team(q) !== R.team(s)).map((q) => p.handen[q].filter((k) => k.kleur === troef).length);
      if (mijn >= 3 && tegen.some((n) => n > 0) && p.handen[s].some((k) => k.kleur !== troef)) {
        kansen++;
        const tr = r.kaart.kleur === troef; if (tr) getrokken++;
        if (!tr && voorbeelden.length < 4) {
          const sc = r.scores.map((x) => `${t(x.kaart)}:${x.gemiddeld.toFixed(0)}`).join(' ');
          voorbeelden.push(`slag ${p.slagen.length + 1}, troef ${S[troef]}, hand ${p.handen[s].map(t).join(' ')} | tegen troef: ${tegen.join('+')} | speelt ${t(r.kaart)}\n    scores: ${sc}`);
        }
      }
    }
    p = R.speelKaart(p, s, r.kaart);
  }
}
console.log(`${trekken ? 'nieuw' : 'oud'}: spelende partij komt uit met ≥3 troef, tegenpartij heeft nog troef: ${kansen}x, troef getrokken ${getrokken}x (${Math.round((100 * getrokken) / kansen)}%)`);
console.log(voorbeelden.join('\n'));
