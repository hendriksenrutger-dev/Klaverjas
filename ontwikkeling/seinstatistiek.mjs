// Meet hoe vaak een herkend sein klopt bij computerspelers die zelf seinen.
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const rng = R.maakRng(+(process.argv[2] || 1));
const telling = {};
const tel = (soort, waar) => { telling[soort] ??= { waar: 0, totaal: 0 }; telling[soort].totaal++; if (waar) telling[soort].waar++; };
for (let g = 0; g < +(process.argv[3] || 60); g++) {
  const handen = R.deel(R.schud(R.maakDeck(), rng), g % 4);
  const troef = R.KLEUREN[g % 4];
  let p = R.nieuwPotje({ handen, troef, spelendTeam: g % 2, uitkomer: (g + 1) % 4 });
  while (!p.klaar) {
    const s = p.beurt;
    const { kaart } = A.kiesKaart(A.waarneming(p, s), { simulaties: 40, rng });
    const sein = A.seinVan(p.slag, s, kaart, troef);
    if (sein) {
      const gespeeld = [...p.slagen.flatMap((x) => x.kaarten), ...p.slag].some((x) => x.kaart.kleur === sein.kaart.kleur && x.kaart.rang === sein.kaart.rang);
      if (!gespeeld) {
        const waar = p.handen[s].some((c) => c.kleur === sein.kaart.kleur && c.rang === sein.kaart.rang);
        const bekent = kaart.kleur === p.slag[0].kaart.kleur;
        const kleinOfAas = sein.kaart.rang === 'A' ? 'kleintje' : 'aas';
        // Had hij een andere keus die geen (vals) sein was?
        const geldig = R.geldigVoor(p, s);
        const keus = geldig.some((k) => !A.seinVan(p.slag, s, k, troef));
        tel(`${kleinOfAas} ${bekent ? 'bekennen' : 'afgooien'} ${keus ? 'met keus' : 'gedwongen'}`, waar);
      }
    }
    p = R.speelKaart(p, s, kaart);
  }
}
for (const [k, v] of Object.entries(telling).sort()) console.log(k.padEnd(32), `${v.waar}/${v.totaal}`, `${Math.round((100 * v.waar) / v.totaal)}%`);
