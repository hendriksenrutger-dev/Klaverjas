// Optie B: een klein netwerk dat in de proefpotjes van de simulatie een kaart kiest, als
// slimmere vervanger van kiesSlim. Het ziet, net als kiesSlim, alle handen (in een proefpotje
// is de verdeling al gekozen). Getraind op exact doorgerekende standen (ontwikkeling/netwerk/).
//
// Kleuren worden omgezet zodat troef altijd kleur 0 is; spelers relatief (0 = wie aan de beurt
// is, 1 = links, 2 = maat, 3 = rechts). Zo hoeft het netwerk elke situatie maar één keer te leren.

import { KLEUREN, team } from '../regels/kaarten.js';
import { huidigeWinnaar } from '../regels/rangorde.js';
import { geldigeKaarten } from '../regels/geldig.js';

const RANGEN = ['7', '8', '9', '10', 'B', 'V', 'H', 'A'];
const RANG_I = Object.fromEntries(RANGEN.map((r, i) => [r, i]));

export const AANTAL_KENMERKEN = 32 * 4 + 32 * 3 + 4 + 4 + 4 + 9;

// Volgorde van de kleuren: troef eerst, de rest in vaste volgorde.
export function kleurVolgorde(troef) {
  return [troef, ...KLEUREN.filter((k) => k !== troef)];
}

export function kaartIndex(k, volgorde) {
  return volgorde.indexOf(k.kleur) * 8 + RANG_I[k.rang];
}

export function indexKaart(i, volgorde) {
  return { kleur: volgorde[i >> 3], rang: RANGEN[i & 7] };
}

// Stand → getallen. ctx: { troef, systeem, spelendTeam }.
export function kenmerken(handen, slag, slagen, beurt, ctx, uit = new Float32Array(AANTAL_KENMERKEN)) {
  uit.fill(0);
  const v = kleurVolgorde(ctx.troef);
  const rel = (p) => (p - beurt + 4) % 4;
  for (let p = 0; p < 4; p++) {
    const r = rel(p);
    for (const k of handen[p]) uit[r * 32 + kaartIndex(k, v)] = 1;
  }
  let o = 128;
  for (const x of slag) uit[o + (rel(x.speler) - 1) * 32 + kaartIndex(x.kaart, v)] = 1;
  o += 96;
  if (slag.length) {
    uit[o + v.indexOf(slag[0].kaart.kleur)] = 1;
    uit[o + 4 + rel(huidigeWinnaar(slag, ctx.troef).speler)] = 1;
  }
  o += 8;
  uit[o + slag.length] = 1;
  o += 4;
  const mijn = team(beurt);
  let pm = 0, pz = 0, rm = 0, rz = 0, sm = 0, sz = 0;
  for (const s of slagen) {
    if (team(s.winnaar) === mijn) { pm += s.punten; rm += s.roem.totaal; sm++; } else { pz += s.punten; rz += s.roem.totaal; sz++; }
  }
  uit[o++] = slagen.length / 8;
  uit[o++] = ctx.spelendTeam === mijn ? 1 : 0;
  uit[o++] = ctx.systeem === 'rotterdams' ? 1 : 0;
  uit[o++] = pm / 162;
  uit[o++] = pz / 162;
  uit[o++] = rm / 100;
  uit[o++] = rz / 100;
  uit[o++] = sm / 8;
  uit[o++] = sz / 8;
  return uit;
}

// ---------- Netwerk: lagen met ReLU, laatste laag 32 uitgangen (één per kaart) ----------
// gewichten: { lagen: [{ w: Float32Array(in*uit), b: Float32Array(uit), in, uit }] }

export function vooruit(net, x, tussen = null) {
  let a = x;
  for (let l = 0; l < net.lagen.length; l++) {
    const { w, b, in: n, uit: m } = net.lagen[l];
    const y = tussen ? tussen[l] : new Float32Array(m);
    for (let j = 0; j < m; j++) y[j] = b[j];
    for (let i = 0; i < n; i++) {
      const ai = a[i];
      if (ai === 0) continue;
      const rij = i * m;
      for (let j = 0; j < m; j++) y[j] += ai * w[rij + j];
    }
    if (l < net.lagen.length - 1) for (let j = 0; j < m; j++) if (y[j] < 0) y[j] = 0;
    a = y;
  }
  return a;
}

export function maakNet(groottes, rng = Math.random) {
  const lagen = [];
  for (let l = 0; l + 1 < groottes.length; l++) {
    const n = groottes[l], m = groottes[l + 1];
    const w = new Float32Array(n * m);
    const s = Math.sqrt(2 / n);
    for (let i = 0; i < w.length; i++) w[i] = (rng() * 2 - 1) * s * Math.sqrt(3);
    lagen.push({ w, b: new Float32Array(m), in: n, uit: m });
  }
  return { lagen };
}

export function netNaarJson(net) {
  return { lagen: net.lagen.map((l) => ({ in: l.in, uit: l.uit, w: Array.from(l.w, (x) => +x.toFixed(5)), b: Array.from(l.b, (x) => +x.toFixed(5)) })) };
}

export function netUitJson(j) {
  return { lagen: j.lagen.map((l) => ({ in: l.in, uit: l.uit, w: Float32Array.from(l.w), b: Float32Array.from(l.b) })) };
}

// Kies een kaart met het netwerk (zelfde aanroep als kiesSlim).
const buf = new Float32Array(AANTAL_KENMERKEN);
export function kiesNet(net, handen, slag, slagen, beurt, ctx) {
  const g = geldigeKaarten(handen[beurt], slag, ctx.troef, ctx.systeem);
  if (g.length === 1) return g[0];
  const y = vooruit(net, kenmerken(handen, slag, slagen, beurt, ctx, buf));
  const v = kleurVolgorde(ctx.troef);
  let best = g[0], bs = -Infinity;
  for (const k of g) { const s = y[kaartIndex(k, v)]; if (s > bs) { bs = s; best = k; } }
  return best;
}
