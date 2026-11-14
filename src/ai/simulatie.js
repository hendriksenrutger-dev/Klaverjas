// Simulatie-AI (Monte Carlo met bepaalde kaartverdelingen, ook wel PIMC).
// Puur JavaScript zonder DOM, zodat het in een Web Worker én in Node (tests) draait.
//
// Per zet:
// 1. Bepaal wat de speler weet (waarneming): eigen hand, gespeelde kaarten, en welke
//    kaarten andere spelers zeker níet hebben (afgeleid uit hun eerdere zetten).
// 2. Trek vaak een willekeurige verdeling van de onbekende kaarten die daarbij past.
// 3. Speel per geldige kaart het potje uit met een snelle eenvoudige strategie.
// 4. Kies de kaart met het beste gemiddelde: eigen punten + roem min die van de
//    tegenpartij, met nat en pit meegerekend.

import { maakDeck, kaartId, team, zelfdeKaart } from '../regels/kaarten.js';
import { geldigeKaarten } from '../regels/geldig.js';
import { huidigeWinnaar, slaatOver, slagPunten, punten, sterkte, PUNTEN_LAATSTE_SLAG } from '../regels/rangorde.js';
import { roemInSlag } from '../regels/roem.js';
import { uitslag } from '../regels/potje.js';

// Aantal simulaties per zet per niveau. Eigen voorstel, nog af te stemmen met Rutger.
export const NIVEAUS = { makkelijk: 5, normaal: 100, sterk: 400 };

// Drempel voor spelen bij het draaien: verwacht verschil (wij − zij) in punten.
// Getest tegen -20, 0, 25 en 40: 10 gaf het beste resultaat (zie RAPPORT-FASE-4.md).
// Eigen keuze, na testen bij te stellen.
export const DRAAI_DREMPEL = 10;
export const DRAAI_SIMULATIES = 150;

// ---------- Waarneming: alleen wat de speler mag weten ----------
export function waarneming(potje, speler) {
  return {
    speler,
    hand: potje.handen[speler].slice(),
    troef: potje.troef,
    spelendTeam: potje.spelendTeam,
    systeem: potje.systeem,
    slagen: potje.slagen,
    slag: potje.slag.slice(),
    aantallen: potje.handen.map((h) => h.length),
  };
}

function onbekendeKaarten(w) {
  const bekend = new Set(w.hand.map(kaartId));
  for (const s of w.slagen) for (const x of s.kaarten) bekend.add(kaartId(x.kaart));
  for (const x of w.slag) bekend.add(kaartId(x.kaart));
  return maakDeck().filter((k) => !bekend.has(kaartId(k)));
}

// Per speler de kaarten die hij zeker niet heeft. Een kaart c valt af als de gespeelde
// kaart X niet geldig was geweest wanneer de speler c (ook) had gehad.
export function uitsluitingen(w, onbekend = onbekendeKaarten(w)) {
  const uit = [new Set(), new Set(), new Set(), new Set()];
  const verloop = [...w.slagen.map((s) => s.kaarten), w.slag];
  for (const kaarten of verloop) {
    for (let i = 1; i < kaarten.length; i++) {
      const { speler: p, kaart: X } = kaarten[i];
      if (p === w.speler) continue;
      const voor = kaarten.slice(0, i);
      for (const c of onbekend) {
        const id = kaartId(c);
        if (uit[p].has(id)) continue;
        const g = geldigeKaarten([X, c], voor, w.troef, w.systeem);
        if (!g.some((k) => zelfdeKaart(k, X))) uit[p].add(id);
      }
    }
  }
  return uit;
}

function schudIn(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Trekt een verdeling van de onbekende kaarten over de andere spelers die past bij
// de uitsluitingen en het aantal kaarten per speler.
export function trekVerdeling(w, uit, onbekend, rng = Math.random) {
  const anderen = [0, 1, 2, 3].filter((p) => p !== w.speler);
  for (let poging = 0; poging < 60; poging++) {
    const handen = [[], [], [], []];
    handen[w.speler] = w.hand.slice();
    const ruimte = w.aantallen.slice();
    const kaarten = schudIn(onbekend.slice(), rng)
      .map((k) => ({ k, id: kaartId(k), n: anderen.filter((p) => !uit[p].has(kaartId(k))).length }))
      .sort((a, b) => a.n - b.n);
    let ok = true;
    for (const { k, id } of kaarten) {
      const mogelijk = anderen.filter((p) => ruimte[p] > 0 && !uit[p].has(id));
      if (mogelijk.length === 0) { ok = false; break; }
      let r = rng() * mogelijk.reduce((s, p) => s + ruimte[p], 0);
      let gekozen = mogelijk[0];
      for (const p of mogelijk) { r -= ruimte[p]; if (r < 0) { gekozen = p; break; } }
      handen[gekozen].push(k);
      ruimte[gekozen]--;
    }
    if (ok) return handen;
  }
  // Noodgeval (zou niet moeten gebeuren): verdeel zonder uitsluitingen.
  const handen = [[], [], [], []];
  handen[w.speler] = w.hand.slice();
  const rest = schudIn(onbekend.slice(), rng);
  for (const p of anderen) handen[p] = rest.splice(0, w.aantallen[p]);
  return handen;
}

// ---------- Snelle speelstrategie voor het uitspelen ----------
function laagste(kaarten, troef) {
  let best = kaarten[0];
  let bestW = Infinity;
  for (const k of kaarten) {
    const w = punten(k, troef) + (k.kleur === troef ? 30 : 0) + sterkte(k, troef) * 0.1;
    if (w < bestW) { bestW = w; best = k; }
  }
  return best;
}

function meestePunten(kaarten, troef) {
  const nietTroef = kaarten.filter((k) => k.kleur !== troef);
  const kandidaten = nietTroef.length ? nietTroef : kaarten;
  let best = kandidaten[0];
  for (const k of kandidaten) if (punten(k, troef) > punten(best, troef)) best = k;
  return best;
}

export function kiesSnel(hand, slag, troef, systeem, speler, spelendTeam, rng) {
  const g = geldigeKaarten(hand, slag, troef, systeem);
  if (g.length === 1) return g[0];
  if (slag.length === 0) {
    const azen = g.filter((k) => k.rang === 'A' && k.kleur !== troef);
    if (azen.length) return azen[Math.floor(rng() * azen.length)];
    if (team(speler) === spelendTeam) {
      const boer = g.find((k) => k.kleur === troef && k.rang === 'B');
      if (boer) return boer;
    }
    return laagste(g, troef);
  }
  const gevraagd = slag[0].kaart.kleur;
  const w = huidigeWinnaar(slag, troef);
  const laatste = slag.length === 3;
  if (team(w.speler) === team(speler)) {
    const troefInSlag = slag.some((x) => x.kaart.kleur === troef);
    const veilig =
      laatste ||
      (w.kaart.kleur === troef && w.kaart.rang === 'B') ||
      (w.kaart.rang === 'A' && !troefInSlag && gevraagd !== troef);
    return veilig ? meestePunten(g, troef) : laagste(g, troef);
  }
  const winnend = g.filter((k) => slaatOver(k, w.kaart, gevraagd, troef));
  if (winnend.length) {
    if (laatste) return laagste(winnend, troef);
    // Niet als laatste: met de sterkste winnende kaart, zodat hij minder snel overgenomen wordt.
    let best = winnend[0];
    for (const k of winnend) if (slaatOver(k, best, gevraagd, troef)) best = k;
    return best;
  }
  return laagste(g, troef);
}

// Speelt het potje verder uit. handen worden aangepast (geef kopieën mee).
function speelUit(handen, slag, slagen, beurt, ctx, rng) {
  const { troef, systeem, spelendTeam } = ctx;
  slag = slag.slice();
  slagen = slagen.slice();
  while (slagen.length < 8) {
    const hand = handen[beurt];
    const k = kiesSnel(hand, slag, troef, systeem, beurt, spelendTeam, rng);
    const i = hand.findIndex((c) => c.kleur === k.kleur && c.rang === k.rang);
    hand.splice(i, 1);
    slag.push({ speler: beurt, kaart: k });
    if (slag.length < 4) { beurt = (beurt + 1) % 4; continue; }
    const winnaar = huidigeWinnaar(slag, troef).speler;
    const kaarten = slag.map((x) => x.kaart);
    slagen.push({
      kaarten: slag,
      winnaar,
      punten: slagPunten(kaarten, troef) + (slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0),
      roem: roemInSlag(kaarten, troef),
    });
    slag = [];
    beurt = winnaar;
  }
  return uitslag({ klaar: true, verzaking: null, spelendTeam, slagen });
}

function verschil(u, speler) {
  const t = team(speler);
  return u.totaal[t] - u.totaal[1 - t];
}

// ---------- Kaart kiezen ----------
export function kiesKaart(w, { simulaties = NIVEAUS.normaal, rng = Math.random } = {}) {
  const geldig = geldigeKaarten(w.hand, w.slag, w.troef, w.systeem);
  if (geldig.length === 1) return { kaart: geldig[0], scores: null };
  const onbekend = onbekendeKaarten(w);
  const uit = uitsluitingen(w, onbekend);
  const totalen = new Array(geldig.length).fill(0);
  const beurtNa = (w.speler + 1) % 4;
  for (let n = 0; n < simulaties; n++) {
    const handen = trekVerdeling(w, uit, onbekend, rng);
    for (let i = 0; i < geldig.length; i++) {
      const kopie = handen.map((h) => h.slice());
      const k = geldig[i];
      kopie[w.speler] = kopie[w.speler].filter((c) => !(c.kleur === k.kleur && c.rang === k.rang));
      const slag = [...w.slag, { speler: w.speler, kaart: k }];
      let u;
      if (slag.length < 4) {
        u = speelUit(kopie, slag, w.slagen, beurtNa, w, rng);
      } else {
        // De slag is met deze kaart vol: eerst afronden.
        const winnaar = huidigeWinnaar(slag, w.troef).speler;
        const kaarten = slag.map((x) => x.kaart);
        const afgerond = {
          kaarten: slag, winnaar,
          punten: slagPunten(kaarten, w.troef) + (w.slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0),
          roem: roemInSlag(kaarten, w.troef),
        };
        u = speelUit(kopie, [], [...w.slagen, afgerond], winnaar, w, rng);
      }
      totalen[i] += verschil(u, w.speler);
    }
  }
  let best = 0;
  for (let i = 1; i < geldig.length; i++) if (totalen[i] > totalen[best]) best = i;
  return {
    kaart: geldig[best],
    scores: geldig.map((k, i) => ({ kaart: k, gemiddeld: totalen[i] / simulaties })),
  };
}

// ---------- Spelen of passen bij het draaien ----------
// Speelt de hand vaak uit met deze troef (andere handen willekeurig) en speelt als het
// verwachte verschil (wij − zij) boven de drempel ligt.
export function kiesDraai(hand, kleur, {
  speler, deler, systeem = 'amsterdams', simulaties = DRAAI_SIMULATIES, drempel = DRAAI_DREMPEL, rng = Math.random,
} = {}) {
  const ids = new Set(hand.map(kaartId));
  const rest = maakDeck().filter((k) => !ids.has(kaartId(k)));
  const ctx = { troef: kleur, systeem, spelendTeam: team(speler) };
  let som = 0;
  for (let n = 0; n < simulaties; n++) {
    const geschud = schudIn(rest.slice(), rng);
    const handen = [[], [], [], []];
    handen[speler] = hand.slice();
    let pos = 0;
    for (let p = 0; p < 4; p++) if (p !== speler) handen[p] = geschud.slice(pos, (pos += 8));
    som += verschil(speelUit(handen, [], [], (deler + 1) % 4, ctx, rng), speler);
  }
  const gemiddeld = som / simulaties;
  return { keuze: gemiddeld > drempel ? 'spelen' : 'passen', gemiddeld };
}
