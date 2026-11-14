// Meet hoe vaak de AI "spelen" kiest, per soort hand (aantal troeven, boer, negen).
// Uitkomst gaat als tabel in src/ai/simulatie.js (SPEELKANS).
const R = await import('../src/regels/index.js');
const A = await import('../src/ai/simulatie.js');
const rng = R.maakRng(+(process.argv[2] || 1));
const n = +(process.argv[3] || 2000);
const tel = {};
for (let i = 0; i < n; i++) {
  const hand = R.schud(R.maakDeck(), rng).slice(0, 8);
  const kleur = R.KLEUREN[i % 4];
  const k = A.kenmerk(hand, kleur);
  const r = A.kiesDraai(hand, kleur, { speler: 1, deler: (i % 4), rng, simulaties: 60 });
  tel[k] ??= [0, 0];
  tel[k][1]++;
  if (r.keuze === 'spelen') tel[k][0]++;
}
console.log(JSON.stringify(tel));
