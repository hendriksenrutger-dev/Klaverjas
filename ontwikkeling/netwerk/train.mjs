// Optie B, stap 2: het netwerk trainen op het oefenmateriaal en meten.
// Gebruik: node ontwikkeling/netwerk/train.mjs <data.jsonl> <uit.json> [rondes] [verborgen,lagen]
// Leert per stand de exacte beste kaart (zachte doelverdeling over de geldige kaarten).
// Meet op 10% apart gehouden standen: hoe vaak de beste kaart gekozen wordt en hoeveel punten
// er gemiddeld verloren gaan ten opzichte van de beste kaart, voor het netwerk én voor kiesSlim.
import fs from 'node:fs';
import readline from 'node:readline';
import { kenmerken, AANTAL_KENMERKEN, maakNet, vooruit, netNaarJson, kleurVolgorde, kaartIndex } from '../../src/ai/netwerk.js';

const [, , bestand, uit, rondesArg = '15', vormArg = '128,64'] = process.argv;
const MET_SLIM = process.env.SLIM === '1'; // kiesSlims keuze als extra invoer
const T = 4; // temperatuur van de doelverdeling, in punten
const kaart = (id) => { const [kleur, rang] = id.split('-'); return { kleur, rang }; };

// ---------- Inlezen ----------
const X = [], M = [], Y = [], V = [], S = [];
const rl = readline.createInterface({ input: fs.createReadStream(bestand) });
for await (const regel of rl) {
  if (!regel) continue;
  const r = JSON.parse(regel);
  const handen = r.h.map((h) => h.map(kaart));
  const slag = r.s.map(([speler, k]) => ({ speler, kaart: kaart(k) }));
  const slagen = r.sl.map(([winnaar, punten, roem]) => ({ winnaar, punten, roem: { totaal: roem } }));
  const ctx = { troef: r.t, systeem: r.sy, spelendTeam: r.sp };
  const v = kleurVolgorde(r.t);
  const basis = kenmerken(handen, slag, slagen, r.b, ctx);
  if (MET_SLIM) { const x = new Float32Array(AANTAL_KENMERKEN + 32); x.set(basis); x[AANTAL_KENMERKEN + kaartIndex(kaart(r.slim), v)] = 1; X.push(x); } else X.push(basis);
  const mask = new Float32Array(32).fill(0), waarde = new Float32Array(32).fill(-1e9);
  let max = -Infinity;
  for (const [id, w] of r.w) { const i = kaartIndex(kaart(id), v); mask[i] = 1; waarde[i] = w; if (w > max) max = w; }
  const doel = new Float32Array(32);
  let som = 0;
  for (let i = 0; i < 32; i++) if (mask[i]) { doel[i] = Math.exp((waarde[i] - max) / T); som += doel[i]; }
  for (let i = 0; i < 32; i++) doel[i] /= som;
  M.push(mask); Y.push(doel); V.push(waarde); S.push(kaartIndex(kaart(r.slim), v));
}
const N = X.length;
const nTest = Math.floor(N * 0.1);
console.log('standen', N, 'test', nTest);

// ---------- Netwerk en Adam ----------
const vorm = [AANTAL_KENMERKEN + (MET_SLIM ? 32 : 0), ...vormArg.split(',').map(Number), 32];
let zaad = 7;
const rng = () => ((zaad = (zaad * 1103515245 + 12345) >>> 0) / 2 ** 32);
const net = maakNet(vorm, rng);
const L = net.lagen.length;
const adam = net.lagen.map((l) => ({ mw: new Float32Array(l.w.length), vw: new Float32Array(l.w.length), mb: new Float32Array(l.b.length), vb: new Float32Array(l.b.length) }));
const grad = net.lagen.map((l) => ({ w: new Float32Array(l.w.length), b: new Float32Array(l.b.length) }));
const act = net.lagen.map((l) => new Float32Array(l.uit));
const delta = net.lagen.map((l) => new Float32Array(l.uit));
let stap = 0;

function maskedSoftmax(y, mask, p) {
  let max = -Infinity;
  for (let i = 0; i < 32; i++) if (mask[i] && y[i] > max) max = y[i];
  let s = 0;
  for (let i = 0; i < 32; i++) { p[i] = mask[i] ? Math.exp(y[i] - max) : 0; s += p[i]; }
  for (let i = 0; i < 32; i++) p[i] /= s;
}

const p = new Float32Array(32);
function leer(idx, lr) {
  for (const g of grad) { g.w.fill(0); g.b.fill(0); }
  let verlies = 0;
  for (const n of idx) {
    const x = X[n];
    vooruit(net, x, act);
    maskedSoftmax(act[L - 1], M[n], p);
    for (let i = 0; i < 32; i++) { delta[L - 1][i] = p[i] - Y[n][i]; if (Y[n][i] > 0) verlies -= Y[n][i] * Math.log(p[i] + 1e-9); }
    for (let l = L - 1; l >= 0; l--) {
      const { w, in: ni, uit: m } = net.lagen[l];
      const inp = l === 0 ? x : act[l - 1];
      const d = delta[l];
      const g = grad[l];
      for (let j = 0; j < m; j++) g.b[j] += d[j];
      for (let i = 0; i < ni; i++) {
        const a = inp[i];
        if (a === 0) continue;
        const rij = i * m;
        for (let j = 0; j < m; j++) g.w[rij + j] += a * d[j];
      }
      if (l > 0) {
        const vorige = delta[l - 1];
        for (let i = 0; i < ni; i++) {
          if (inp[i] <= 0) { vorige[i] = 0; continue; } // ReLU
          let s = 0;
          const rij = i * m;
          for (let j = 0; j < m; j++) s += w[rij + j] * d[j];
          vorige[i] = s;
        }
      }
    }
  }
  stap++;
  const b1 = 0.9, b2 = 0.999, c1 = 1 - b1 ** stap, c2 = 1 - b2 ** stap, k = 1 / idx.length;
  for (let l = 0; l < L; l++) {
    const lg = net.lagen[l], g = grad[l], a = adam[l];
    for (const [par, gr, m1, m2] of [[lg.w, g.w, a.mw, a.vw], [lg.b, g.b, a.mb, a.vb]]) {
      for (let i = 0; i < par.length; i++) {
        const gg = gr[i] * k + (par === lg.w ? 1e-5 * par[i] : 0);
        m1[i] = b1 * m1[i] + (1 - b1) * gg;
        m2[i] = b2 * m2[i] + (1 - b2) * gg * gg;
        par[i] -= lr * (m1[i] / c1) / (Math.sqrt(m2[i] / c2) + 1e-8);
      }
    }
  }
  return verlies / idx.length;
}

function meet(van, tot) {
  let goedNet = 0, goedSlim = 0, verliesNet = 0, verliesSlim = 0;
  for (let n = van; n < tot; n++) {
    const y = vooruit(net, X[n]);
    let best = -1, bs = -Infinity, max = -Infinity;
    for (let i = 0; i < 32; i++) if (M[n][i]) { if (y[i] > bs) { bs = y[i]; best = i; } if (V[n][i] > max) max = V[n][i]; }
    verliesNet += max - V[n][best]; if (V[n][best] === max) goedNet++;
    verliesSlim += max - V[n][S[n]]; if (V[n][S[n]] === max) goedSlim++;
  }
  const n = tot - van;
  return { net: `${(100 * goedNet / n).toFixed(1)}% beste kaart, ${(verliesNet / n).toFixed(2)} punt verlies`, slim: `${(100 * goedSlim / n).toFixed(1)}% beste kaart, ${(verliesSlim / n).toFixed(2)} punt verlies` };
}

const volgorde = Array.from({ length: N - nTest }, (_, i) => i + nTest);
const rondes = +rondesArg;
for (let r = 0; r < rondes; r++) {
  for (let i = volgorde.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]]; }
  const lr = 0.002 * (r < rondes * 0.6 ? 1 : r < rondes * 0.85 ? 0.3 : 0.1);
  let v = 0, nb = 0;
  for (let i = 0; i < volgorde.length; i += 256) { v += leer(volgorde.slice(i, i + 256), lr); nb++; }
  const m = meet(0, nTest);
  console.log(`ronde ${r + 1}: verlies ${(v / nb).toFixed(3)} · netwerk ${m.net} · kiesSlim ${m.slim}`);
}
fs.writeFileSync(uit, JSON.stringify({ vorm, metSlim: MET_SLIM, gemaakt: new Date().toISOString(), standen: N, ...netNaarJson(net) }));
console.log('opgeslagen', uit, `${Math.round(fs.statSync(uit).size / 1024)} kB`);
