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

// Moeilijkheidsniveaus. Eigen voorstel, nog af te stemmen met Rutger (zie RAPPORT-FASE-4.md).
// simulaties: aantal kaartverdelingen per zet; strategie: hoe de simulaties worden uitgespeeld;
// eindspel: aantal laatste slagen dat exact wordt doorgerekend.
export const NIVEAUS = {
  makkelijk: { simulaties: 5, strategie: 'simpel', eindspel: 0 },
  normaal: { simulaties: 100, strategie: 'slim', eindspel: 3 },
  sterk: { simulaties: 300, strategie: 'slim', eindspel: 3 },
};

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

export function kiesSimpel(hand, slag, troef, systeem, speler, spelendTeam, rng) {
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

// ---------- Slimme speelstrategie (met open kaarten, want binnen een simulatie is alles bekend) ----------
const RANG_NAT = ['7', '8', '9', '10', 'B', 'V', 'H', 'A'];

// Heeft een andere speler (dan 'speler') nog een hogere kaart van deze kleur?
function isBaas(k, handen, speler, troef) {
  const st = sterkte(k, troef);
  for (let p = 0; p < 4; p++) {
    if (p === speler) continue;
    for (const c of handen[p]) if (c.kleur === k.kleur && sterkte(c, troef) > st) return false;
  }
  return true;
}

const heeftKleur = (hand, kleur) => hand.some((c) => c.kleur === kleur);

// Kan een van de spelers die nog moeten de huidige winnende kaart nog slaan?
function zekerBinnen(handen, slag, troef, systeem) {
  const gevraagd = slag[0].kaart.kleur;
  const best = huidigeWinnaar(slag, troef);
  let beurt = (slag[slag.length - 1].speler + 1) % 4;
  for (let i = slag.length; i < 4; i++, beurt = (beurt + 1) % 4) {
    if (team(beurt) === team(best.speler)) continue;
    const g = geldigeKaarten(handen[beurt], slag, troef, systeem);
    if (g.some((c) => slaatOver(c, best.kaart, gevraagd, troef))) return false;
  }
  return true;
}

// Waarde van een kaart om weg te gooien: liever geen punten, geen troef, geen baas.
function afgooiWaarde(k, handen, speler, troef) {
  let w = punten(k, troef) * 1.0 + (k.kleur === troef ? 25 + sterkte(k, troef) : 0);
  if (k.kleur !== troef && isBaas(k, handen, speler, troef)) w += 8;
  // Een tien zonder aas erbij is kwetsbaar: liever bewaren dan weggooien is niet altijd beter,
  // maar een kale tien weggooien kost 10 punten.
  return w + sterkte(k, troef) * 0.05;
}

function roemMet(slag, k, troef) {
  return roemInSlag([...slag.map((x) => x.kaart), k], troef).totaal;
}

export function kiesSlim(handen, slag, ctx, speler, rng) {
  const { troef, systeem, spelendTeam } = ctx;
  const hand = handen[speler];
  const g = geldigeKaarten(hand, slag, troef, systeem);
  if (g.length === 1) return g[0];
  const mijnTeam = team(speler);
  const tegen = [0, 1, 2, 3].filter((p) => team(p) !== mijnTeam);
  const maat = (speler + 2) % 4;

  // ----- Uitkomen -----
  if (slag.length === 0) {
    const tegenTroef = tegen.some((p) => heeftKleur(handen[p], troef));
    const mijnTroef = g.filter((k) => k.kleur === troef);
    // Spelende partij: troef trekken met een baastroef zolang de tegenpartij troef heeft.
    if (mijnTeam === spelendTeam && tegenTroef && mijnTroef.length) {
      const baas = mijnTroef.filter((k) => isBaas(k, handen, speler, troef));
      if (baas.length) return baas[0];
    }
    // Baaskaart in een bijkleur, als de tegenpartij niet kan introeven.
    const veiligeKleur = (kleur) =>
      tegen.every((p) => heeftKleur(handen[p], kleur) || !heeftKleur(handen[p], troef));
    const bazen = g.filter((k) => k.kleur !== troef && isBaas(k, handen, speler, troef) && veiligeKleur(k.kleur));
    if (bazen.length) {
      bazen.sort((a, b) => punten(b, troef) - punten(a, troef));
      return bazen[0];
    }
    // Laag naar een kleur waarin de maat de baas heeft.
    const naarMaat = g.filter((k) => k.kleur !== troef && veiligeKleur(k.kleur) &&
      handen[maat].some((c) => c.kleur === k.kleur && isBaas(c, handen, maat, troef)));
    if (naarMaat.length) return naarMaat.reduce((a, b) => (afgooiWaarde(a, handen, speler, troef) <= afgooiWaarde(b, handen, speler, troef) ? a : b));
    // Anders de goedkoopste kaart.
    return g.reduce((a, b) => (afgooiWaarde(a, handen, speler, troef) <= afgooiWaarde(b, handen, speler, troef) ? a : b));
  }

  // ----- Bijspelen -----
  const gevraagd = slag[0].kaart.kleur;
  const w = huidigeWinnaar(slag, troef);
  const slagWaarde = slag.reduce((s, x) => s + punten(x.kaart, troef), 0);
  const scoor = (k, voorOns) => {
    // Hoe goed is het om k te spelen als de slag naar ons (voorOns) of naar hen gaat?
    const r = roemMet(slag, k, troef);
    return voorOns ? punten(k, troef) + r : -(punten(k, troef) + r);
  };

  if (team(w.speler) === mijnTeam) {
    const sleutel = slag.length === 3 || zekerBinnen(handen, slag, troef, systeem);
    if (sleutel) {
      // Maat heeft de slag zeker: punten en roem erbij, maar geen goede troef verspillen.
      let best = null, bestS = -Infinity;
      for (const k of g) {
        const verspilling = k.kleur === troef ? 15 + sterkte(k, troef) * 2 : 0;
        const baasStraf = k.kleur !== troef && isBaas(k, handen, speler, troef) && punten(k, troef) < 10 ? 4 : 0;
        const sc = scoor(k, true) - verspilling - baasStraf;
        if (sc > bestS) { bestS = sc; best = k; }
      }
      return best;
    }
  }

  const winnend = g.filter((k) => slaatOver(k, w.kaart, gevraagd, troef));
  if (winnend.length) {
    const zeker = winnend.filter((k) => zekerBinnen(handen, [...slag, { speler, kaart: k }], troef, systeem));
    if (zeker.length && team(w.speler) !== mijnTeam) {
      // Zeker winnen: liefst met punten uit een bijkleur, met troef zo laag mogelijk.
      let best = null, bestS = -Infinity;
      for (const k of zeker) {
        const sc = k.kleur === troef ? -sterkte(k, troef) * 3 - punten(k, troef) * 0.5 : scoor(k, true);
        if (sc > bestS) { bestS = sc; best = k; }
      }
      return best;
    }
    if (team(w.speler) !== mijnTeam && slagWaarde + roemInSlag(slag.map((x) => x.kaart), troef).totaal >= 10) {
      // Waardevolle slag maar niet zeker: probeer met de sterkste kaart.
      let best = winnend[0];
      for (const k of winnend) if (slaatOver(k, best, gevraagd, troef)) best = k;
      return best;
    }
  }
  // Niet winnen: zo weinig mogelijk weggeven (ook geen roem voor de tegenpartij).
  let best = null, bestS = Infinity;
  for (const k of g) {
    const sc = afgooiWaarde(k, handen, speler, troef) + roemMet(slag, k, troef);
    if (sc < bestS) { bestS = sc; best = k; }
  }
  return best;
}

// ---------- Eindspel exact (alfa-bèta met open kaarten) ----------
export const EINDSPEL_SLAGEN = 3;

function scoreEind(slagen, ctx, mijnTeam) {
  // Zelfde telling als uitslag() in potje.js, maar zonder tussenobjecten (sneller).
  let p0 = 0, p1 = 0, r0 = 0, r1 = 0, s0 = 0;
  for (const s of slagen) {
    if (team(s.winnaar) === 0) { p0 += s.punten; r0 += s.roem.totaal; s0++; } else { p1 += s.punten; r1 += s.roem.totaal; }
  }
  const sp = ctx.spelendTeam;
  if (s0 === 8 && sp === 0) r0 += 100;
  if (s0 === 0 && sp === 1) r1 += 100;
  let t0 = p0 + r0, t1 = p1 + r1;
  if (sp === 0 ? t0 <= t1 : t1 <= t0) {
    const alle = r0 + r1;
    if (sp === 0) { t0 = 0; t1 = 162 + alle; } else { t1 = 0; t0 = 162 + alle; }
  }
  return mijnTeam === 0 ? t0 - t1 : t1 - t0;
}

function zoek(handen, slag, slagen, beurt, ctx, mijnTeam, alfa, beta) {
  if (slagen.length === 8) return scoreEind(slagen, ctx, mijnTeam);
  const g = geldigeKaarten(handen[beurt], slag, ctx.troef, ctx.systeem);
  const max = team(beurt) === mijnTeam;
  let best = max ? -Infinity : Infinity;
  const hand = handen[beurt];
  for (const k of g) {
    const i = hand.indexOf(k);
    hand.splice(i, 1);
    slag.push({ speler: beurt, kaart: k });
    let v;
    if (slag.length < 4) {
      v = zoek(handen, slag, slagen, (beurt + 1) % 4, ctx, mijnTeam, alfa, beta);
    } else {
      const winnaar = huidigeWinnaar(slag, ctx.troef).speler;
      const kaarten = slag.map((x) => x.kaart);
      const afgerond = {
        kaarten: slag.slice(), winnaar,
        punten: slagPunten(kaarten, ctx.troef) + (slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0),
        roem: roemInSlag(kaarten, ctx.troef),
      };
      slagen.push(afgerond);
      const oud = slag.splice(0, 4);
      v = zoek(handen, slag, slagen, winnaar, ctx, mijnTeam, alfa, beta);
      slag.push(...oud);
      slagen.pop();
    }
    slag.pop();
    hand.splice(i, 0, k);
    if (max) { if (v > best) best = v; if (best > alfa) alfa = best; }
    else { if (v < best) best = v; if (best < beta) beta = best; }
    if (alfa >= beta) break;
  }
  return best;
}

export function eindspelWaarde(handen, slag, slagen, beurt, ctx, mijnTeam) {
  return zoek(handen.map((h) => h.slice()), slag.slice(), slagen.slice(), beurt, ctx, mijnTeam, -Infinity, Infinity);
}

// Speelt het potje verder uit. handen worden aangepast (geef kopieën mee).
function speelUit(handen, slag, slagen, beurt, ctx, rng) {
  const { troef, systeem, spelendTeam } = ctx;
  slag = slag.slice();
  slagen = slagen.slice();
  while (slagen.length < 8) {
    const hand = handen[beurt];
    const k = ctx.strategie === 'simpel'
      ? kiesSimpel(hand, slag, troef, systeem, beurt, spelendTeam, rng)
      : kiesSlim(handen, slag, ctx, beurt, rng);
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
// bekendeHanden: alleen voor metingen (een AI die alle kaarten ziet), nooit in het spel.
export function kiesKaart(w, { simulaties = NIVEAUS.normaal.simulaties, rng = Math.random, strategie = 'slim', eindspel = EINDSPEL_SLAGEN, bekendeHanden = null } = {}) {
  const geldig = geldigeKaarten(w.hand, w.slag, w.troef, w.systeem);
  if (geldig.length === 1) return { kaart: geldig[0], scores: null };
  const ctx = { troef: w.troef, systeem: w.systeem, spelendTeam: w.spelendTeam, strategie };
  const exact = 8 - w.slagen.length <= eindspel;
  const onbekend = onbekendeKaarten(w);
  const uit = uitsluitingen(w, onbekend);
  const totalen = new Array(geldig.length).fill(0);
  const beurtNa = (w.speler + 1) % 4;
  for (let n = 0; n < simulaties; n++) {
    const handen = bekendeHanden ? bekendeHanden.map((h) => h.slice()) : trekVerdeling(w, uit, onbekend, rng);
    for (let i = 0; i < geldig.length; i++) {
      const kopie = handen.map((h) => h.slice());
      const k = geldig[i];
      kopie[w.speler] = kopie[w.speler].filter((c) => !(c.kleur === k.kleur && c.rang === k.rang));
      const slag = [...w.slag, { speler: w.speler, kaart: k }];
      let v;
      if (exact) {
        // Eindspel: exact doorrekenen in deze verdeling.
        const hulp = [...w.slag, { speler: w.speler, kaart: k }];
        if (hulp.length < 4) v = eindspelWaarde(kopie, hulp, w.slagen, beurtNa, ctx, team(w.speler));
        else {
          const winnaar = huidigeWinnaar(hulp, w.troef).speler;
          const kaarten = hulp.map((x) => x.kaart);
          const afgerond = { kaarten: hulp, winnaar, punten: slagPunten(kaarten, w.troef) + (w.slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0), roem: roemInSlag(kaarten, w.troef) };
          v = eindspelWaarde(kopie, [], [...w.slagen, afgerond], winnaar, ctx, team(w.speler));
        }
        totalen[i] += v;
        continue;
      }
      let u;
      if (slag.length < 4) {
        u = speelUit(kopie, slag, w.slagen, beurtNa, ctx, rng);
      } else {
        // De slag is met deze kaart vol: eerst afronden.
        const winnaar = huidigeWinnaar(slag, w.troef).speler;
        const kaarten = slag.map((x) => x.kaart);
        const afgerond = {
          kaarten: slag, winnaar,
          punten: slagPunten(kaarten, w.troef) + (w.slagen.length === 7 ? PUNTEN_LAATSTE_SLAG : 0),
          roem: roemInSlag(kaarten, w.troef),
        };
        u = speelUit(kopie, [], [...w.slagen, afgerond], winnaar, ctx, rng);
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
  speler, deler, systeem = 'amsterdams', simulaties = DRAAI_SIMULATIES, drempel = DRAAI_DREMPEL, rng = Math.random, strategie = 'slim',
} = {}) {
  const ids = new Set(hand.map(kaartId));
  const rest = maakDeck().filter((k) => !ids.has(kaartId(k)));
  const ctx = { troef: kleur, systeem, spelendTeam: team(speler), strategie };
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
