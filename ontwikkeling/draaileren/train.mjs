// Spelen of passen leren, stap 2: uit het oefenmateriaal leren wanneer spelen beter is.
// Model: lineaire regressie (ridge) van (spelen − passen) op kenmerken van de hand plus de
// huidige schatting g. Meet met 5-voudige kruisvalidatie hoeveel punten per beslissing het
// geleerde besluit oplevert t.o.v. het huidige (spelen als g > 10).
// Gebruik: node ontwikkeling/draaileren/train.mjs <data.jsonl> [uit.json]
import fs from 'node:fs';

const [, , bestand, uit] = process.argv;
const rijen = fs.readFileSync(bestand, 'utf8').split('\n').filter(Boolean).map((r) => JSON.parse(r));
const TROEFVOLG = ['B', '9', 'A', '10', 'H', 'V', '8', '7'];

export function kenmerkenDraai(r) {
  const h = r.hand.map((id) => { const [kleur, rang] = id.split('-'); return { kleur, rang }; });
  const tr = h.filter((k) => k.kleur === r.troef);
  const heeft = (rang) => tr.some((k) => k.rang === rang);
  const n = tr.length;
  const anderen = h.filter((k) => k.kleur !== r.troef);
  const azen = anderen.filter((k) => k.rang === 'A').length;
  const tienMetAas = anderen.filter((k) => k.rang === '10' && anderen.some((a) => a.kleur === k.kleur && a.rang === 'A')).length;
  const kaleTien = anderen.filter((k) => k.rang === '10' && !anderen.some((a) => a.kleur === k.kleur && a.rang === 'A')).length;
  const kleurenZonder = ['harten', 'ruiten', 'klaveren', 'schoppen'].filter((k) => k !== r.troef && !h.some((x) => x.kleur === k)).length;
  return [
    1, r.g / 50,
    n === 1 ? 1 : 0, n === 2 ? 1 : 0, n === 3 ? 1 : 0, n >= 4 ? 1 : 0,
    heeft('B') ? 1 : 0, heeft('9') ? 1 : 0, heeft('A') ? 1 : 0, heeft('10') ? 1 : 0,
    heeft('H') && heeft('V') ? 1 : 0,
    n === 2 && heeft('B') ? 1 : 0, n === 2 && heeft('B') && heeft('9') ? 1 : 0,
    azen / 3, tienMetAas / 2, kaleTien / 2, kleurenZonder,
    r.plek === 1 ? 1 : 0, r.plek === 2 ? 1 : 0, r.plek === 3 ? 1 : 0,
    r.ronde, r.gepast.length / 3,
    (n <= 2 ? 1 : 0) * azen / 3,
  ];
}

function ridge(X, y, lambda = 1) {
  const p = X[0].length;
  const A = Array.from({ length: p }, () => new Float64Array(p));
  const b = new Float64Array(p);
  for (let n = 0; n < X.length; n++) {
    const x = X[n];
    for (let i = 0; i < p; i++) { b[i] += x[i] * y[n]; for (let j = 0; j < p; j++) A[i][j] += x[i] * x[j]; }
  }
  for (let i = 1; i < p; i++) A[i][i] += lambda;
  // Gauss
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < p; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[p] / r[i]);
}
const voorspel = (w, x) => w.reduce((s, wi, i) => s + wi * x[i], 0);

const X = rijen.map(kenmerkenDraai);
const y = rijen.map((r) => r.spelen - r.passen);
const N = X.length;

// Kruisvalidatie
const K = 5;
let nu = [], geleerd = [], altijd = [];
const verschilAlleen = [];
for (let f = 0; f < K; f++) {
  const tr = [], te = [];
  for (let n = 0; n < N; n++) (n % K === f ? te : tr).push(n);
  const w = ridge(tr.map((n) => X[n]), tr.map((n) => y[n]), 5);
  for (const n of te) {
    const kiesNu = rijen[n].g > 10, kiesG = voorspel(w, X[n]) > 0;
    nu.push(kiesNu ? y[n] : 0); geleerd.push(kiesG ? y[n] : 0);
    if (kiesNu !== kiesG) verschilAlleen.push((kiesG ? 1 : -1) * y[n]);
  }
}
const gem = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const fout = (a) => { const m = gem(a); return 1.96 * Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length / a.length); };
console.log('beslissingen', N);
console.log('huidig (g>10):', gem(nu).toFixed(2), 'geleerd:', gem(geleerd).toFixed(2), 'per beslissing');
const d = nu.map((x, i) => geleerd[i] - x);
console.log('geleerd − huidig:', gem(d).toFixed(2), '±', fout(d).toFixed(2), `(anders gekozen in ${verschilAlleen.length} = ${(100 * verschilAlleen.length / N).toFixed(1)}%)`);

// Per groep: schatting g tegen echte uitkomst
const groep = (r) => {
  const h = r.hand.filter((id) => id.startsWith(r.troef));
  const n = h.length, B = h.includes(r.troef + '-B');
  const azen = r.hand.filter((id) => id.endsWith('-A') && !id.startsWith(r.troef)).length;
  return `${n} troef${B ? ' met boer' : ' zonder boer'}${n === 2 ? (azen >= 2 ? ', 2+ azen' : ', 0-1 aas') : ''}`;
};
const groepen = {};
for (let n = 0; n < N; n++) { const k = groep(rijen[n]); (groepen[k] ??= []).push(n); }
console.log('\ngroep | aantal | computer schat (g−10) | echt (spelen−passen)');
for (const [k, ix] of Object.entries(groepen).sort()) {
  if (ix.length < 40) continue;
  console.log(k.padEnd(32), String(ix.length).padStart(5), gem(ix.map((n) => rijen[n].g - 10)).toFixed(1).padStart(7), gem(ix.map((n) => y[n])).toFixed(1).padStart(7), '±', fout(ix.map((n) => y[n])).toFixed(1));
}

const w = ridge(X, y, 5);
console.log('\ngewichten', w.map((x) => x.toFixed(1)).join(' '));
if (uit) fs.writeFileSync(uit, JSON.stringify(w));
