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
// seinGeven/seinLezen: zelf seinen volgens Rutgers afspraken en seinen van anderen gebruiken.
// Ook op makkelijk seinen de computerspelers, zodat Rutger als maat de seinen kan lezen.
export const NIVEAUS = {
  makkelijk: { simulaties: 5, strategie: 'simpel', eindspel: 0, seinGeven: true, seinLezen: false },
  normaal: { simulaties: 100, strategie: 'slim', eindspel: 3, seinGeven: true, seinLezen: true },
  sterk: { simulaties: 300, strategie: 'slim', eindspel: 3, seinGeven: true, seinLezen: true },
};

// ---------- Seinen (Rutgers afspraken, zie CLAUDE.md) ----------
// Een sein is een kaart die wordt bijgespeeld op een slag die de maat op dat moment heeft,
// als er geen troef gevraagd is en de kaart zelf geen troef is (bekennen of afgooien maakt niet uit).
//   7, 8 of 9 → "ik heb de aas van deze kleur"
//   aas        → "ik heb ook de tien van deze kleur"
// Een sein is een sterke aanwijzing, geen zekerheid.

// Eigen ontwerpkeuzes, niet beproefd; bij te stellen na testen:
export const SEIN_FACTOR = 10; // verdeling waarin een sein klopt telt zoveel keer zwaarder
export const SEIN_FACTOR_ZWAK = 2; // idem, als de seiner geen goedkoop eerlijk alternatief had
export const SEIN_BONUS = 3; // voorkeur (in punten) voor een kaart die een waar sein geeft
// Afkeer (in punten) van een kaart die een vals sein zou geven. Bij afgooien kies je vrij welke kleur,
// dus daar hoog (betrouwbare seinen). Bij bekennen is een kleintje vaak gewoon de verstandige kaart
// (Rutgers voorbeeld: ♠H gespeeld om geen vals sein met ♠8 te geven), dus daar laag.
export const SEIN_STRAF = 40; // afgooien
export const SEIN_STRAF_BEKENNEN = 15;

// Troef trekken. In de simulaties kennen alle spelers elkaars kaarten; daardoor lijkt troef trekken
// "altijd later nog kan" en wordt het te weinig gekozen (bekende zwakte van deze methode).
// Daarom een kleine voorkeur voor troef uitkomen door de spelende partij zolang de tegenpartij
// nog troef kan hebben. Eigen ontwerpkeuze, gemeten in RAPPORT-FASE-4.md; bij te stellen.
export const TREK_BONUS = 10;
// Vuistregels: scoren kaarten binnen deze marge (in verschilpunten wij − zij), dan beslist
// een menselijke vuistregel in plaats van het toeval van de simulatie. Eigen ontwerpkeuze.
export const VUISTREGEL_MARGE = 8;

const KLEINTJES = new Set(['7', '8', '9']);

// Geeft het sein dat 'speler' geeft door 'kaart' te spelen op slag 'slagVoor', of null.
export function seinVan(slagVoor, speler, kaart, troef) {
  if (slagVoor.length === 0) return null;
  if (slagVoor[0].kaart.kleur === troef || kaart.kleur === troef) return null;
  const w = huidigeWinnaar(slagVoor, troef);
  if (team(w.speler) !== team(speler)) return null;
  if (KLEINTJES.has(kaart.rang)) return { speler, kaart: { kleur: kaart.kleur, rang: 'A' } };
  if (kaart.rang === 'A') return { speler, kaart: { kleur: kaart.kleur, rang: '10' } };
  return null;
}

// Alle seinen van anderen in dit potje waarvan de genoemde kaart nog onbekend is.
export function seinenVanAnderen(w, onbekend = onbekendeKaarten(w)) {
  const open = new Set(onbekend.map(kaartId));
  const lijst = [];
  for (const kaarten of [...w.slagen.map((s) => s.kaarten), w.slag]) {
    for (let i = 1; i < kaarten.length; i++) {
      const { speler, kaart } = kaarten[i];
      if (speler === w.speler) continue;
      const voor = kaarten.slice(0, i);
      const sein = seinVan(voor, speler, kaart, w.troef);
      if (sein && open.has(kaartId(sein.kaart))) {
        // Bewaar ook de situatie, om later per verdeling te beoordelen of de seiner keus had.
        Object.defineProperty(sein, 'context', { value: { voor, kaart }, enumerable: false });
        lijst.push(sein);
      }
    }
  }
  return lijst;
}

// Kaarten die een speler vanaf een bepaald moment nog gespeeld heeft (om zijn hand van toen terug te rekenen).
function laterGespeeld(w, speler, voor) {
  const res = [];
  let na = false;
  for (const kaarten of [...w.slagen.map((s) => s.kaarten), w.slag]) {
    for (let i = 0; i < kaarten.length; i++) {
      if (!na && kaarten.slice(0, i).length === voor.length && kaarten[i].speler === speler &&
          voor.every((x, j) => kaarten[j] === x)) na = true;
      if (na && kaarten[i].speler === speler) res.push(kaarten[i].kaart);
    }
  }
  return res;
}

// Gewicht van een getrokken verdeling. Klopt een sein niet, dan telt de verdeling minder mee:
// - had de seiner (in deze verdeling) geen andere kaart zonder vals sein: gewicht blijft 1 (gedwongen);
// - had hij alleen dure eerlijke alternatieven (troef, tien, aas, of iets dat een tien/aas kaal
//   achterlaat): een zwakke aanwijzing, gewicht 1/factorZwak;
// - had hij een goedkoop eerlijk alternatief: een sterke aanwijzing, gewicht 1/factor.
// - bij bekennen (in plaats van afgooien) altijd hooguit een zwakke aanwijzing.
export function seinGewicht(handen, seinen, factor = SEIN_FACTOR, w = null, factorZwak = SEIN_FACTOR_ZWAK) {
  let g = 1;
  const heeft = (hand, k) => hand.some((c) => c.kleur === k.kleur && c.rang === k.rang);
  for (const s of seinen) {
    if (heeft(handen[s.speler], s.kaart)) continue;
    if (!s.context || !w) { g /= factor; continue; }
    const toen = [...handen[s.speler], ...laterGespeeld(w, s.speler, s.context.voor)];
    const opties = geldigeKaarten(toen, s.context.voor, w.troef, w.systeem);
    const gespeeld = s.context.kaart;
    const eerlijk = opties.filter((k) => {
      if (k.kleur === gespeeld.kleur && k.rang === gespeeld.rang) return false;
      const ander = seinVan(s.context.voor, s.speler, k, w.troef);
      return !ander || heeft(toen, ander.kaart);
    });
    if (eerlijk.length === 0) continue; // gedwongen: de kaart zegt niets
    // Bij bekennen is een kleintje vaak gewoon de verstandige kaart: hooguit een zwakke aanwijzing.
    if (gespeeld.kleur === s.context.voor[0].kaart.kleur) { g /= factorZwak; continue; }
    const goedkoop = eerlijk.some((k) => {
      if (k.kleur === w.troef || k.rang === '10' || k.rang === 'A') return false;
      const rest = toen.filter((c) => c.kleur === k.kleur && c !== k);
      return !(rest.length === 1 && (rest[0].rang === '10' || rest[0].rang === 'A'));
    });
    g /= goedkoop ? factor : factorZwak;
  }
  return g;
}

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
    uitkomer: potje.uitkomer ?? null,
    kiezer: potje.kiezer ?? null,
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
    // Spelende partij: troef trekken zolang de tegenpartij troef heeft.
    if (mijnTeam === spelendTeam && tegenTroef && mijnTroef.length) {
      // Met een baastroef altijd.
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

// ---------- Wat het draaien verraadt ----------
// Wie troef kiest, heeft meestal een sterke troefhand; wie op die kleur past, meestal niet.
// Kenmerk van een hand voor een troefkleur: aantal troeven (0-5+), boer, negen.
export function kenmerk(hand, troef) {
  const t = hand.filter((k) => k.kleur === troef);
  const n = Math.min(t.length, 5);
  return `${n}${t.some((k) => k.rang === 'B') ? 'B' : '-'}${t.some((k) => k.rang === '9') ? '9' : '-'}`;
}

// Kans dat de AI "spelen" kiest, per kenmerk. Gemeten met ontwikkeling/draaitabel.mjs (6000 handen),
// afgerond en begrensd tussen 0,02 en 0,98 (een mens kan altijd anders kiezen).
export const SPEELKANS = {
  '0--': 0.02, '1--': 0.02, '1-9': 0.02, '1B-': 0.04,
  '2--': 0.02, '2-9': 0.04, '2B-': 0.19, '2B9': 0.69,
  '3--': 0.03, '3-9': 0.18, '3B-': 0.56, '3B9': 0.92,
  '4--': 0.17, '4-9': 0.38, '4B-': 0.84, '4B9': 0.98,
  '5--': 0.69, '5-9': 0.79, '5B-': 0.98, '5B9': 0.98,
};

// Begin-hand van speler q in een getrokken verdeling: zijn huidige kaarten plus wat hij al speelde.
function beginHand(handen, w, q) {
  const gespeeld = [...w.slagen.flatMap((s) => s.kaarten), ...w.slag].filter((x) => x.speler === q).map((x) => x.kaart);
  return [...handen[q], ...gespeeld];
}

// Gewicht van een verdeling op grond van het draaien: de kiezer had waarschijnlijk sterke troef,
// wie vóór hem op deze kleur paste waarschijnlijk niet.
export function draaiGewicht(handen, w) {
  if (w.kiezer === null || w.kiezer === undefined || w.uitkomer === null || w.uitkomer === undefined) return 1;
  let g = 1;
  for (let q = w.uitkomer; ; q = (q + 1) % 4) {
    const kans = SPEELKANS[kenmerk(beginHand(handen, w, q), w.troef)] ?? 0.5;
    if (q === w.kiezer) {
      if (q !== w.speler) g *= kans;
      break;
    }
    if (q !== w.speler) g *= 1 - kans;
  }
  return g;
}

// ---------- Kaart kiezen ----------
// bekendeHanden: alleen voor metingen (een AI die alle kaarten ziet), nooit in het spel.
export function kiesKaart(w, {
  simulaties = NIVEAUS.normaal.simulaties, rng = Math.random, strategie = 'slim', eindspel = EINDSPEL_SLAGEN,
  seinGeven = true, seinLezen = true, seinFactor = SEIN_FACTOR, bekendeHanden = null, trekken = true,
  trekBonus = TREK_BONUS, seinStraf = SEIN_STRAF, seinStrafBekennen = SEIN_STRAF_BEKENNEN,
  draaiInfo = true, vuistregels = true, marge = VUISTREGEL_MARGE,
} = {}) {
  const geldig = geldigeKaarten(w.hand, w.slag, w.troef, w.systeem);
  if (geldig.length === 1) return { kaart: geldig[0], scores: null };
  const ctx = { troef: w.troef, systeem: w.systeem, spelendTeam: w.spelendTeam, strategie, trekken };
  const exact = 8 - w.slagen.length <= eindspel;
  const onbekend = onbekendeKaarten(w);
  const uit = uitsluitingen(w, onbekend);
  const seinen = seinLezen && !bekendeHanden ? seinenVanAnderen(w, onbekend) : [];
  const totalen = new Array(geldig.length).fill(0);
  let gewichtSom = 0;
  const beurtNa = (w.speler + 1) % 4;
  for (let n = 0; n < simulaties; n++) {
    const handen = bekendeHanden ? bekendeHanden.map((h) => h.slice()) : trekVerdeling(w, uit, onbekend, rng);
    const gewicht = (seinen.length ? seinGewicht(handen, seinen, seinFactor, w) : 1)
      * (draaiInfo && !bekendeHanden ? draaiGewicht(handen, w) : 1);
    gewichtSom += gewicht;
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
        totalen[i] += gewicht * v;
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
      totalen[i] += gewicht * verschil(u, w.speler);
    }
  }
  const gemiddeld = totalen.map((t) => t / gewichtSom);
  // Zelf seinen: een waar sein krijgt een kleine voorkeur, een vals sein een afkeer.
  const gespeeld = new Set([...w.slagen.flatMap((s) => s.kaarten), ...w.slag].map((x) => kaartId(x.kaart)));
  const seinCorrectie = geldig.map((k) => {
    if (!seinGeven) return 0;
    const sein = seinVan(w.slag, w.speler, k, w.troef);
    if (!sein || gespeeld.has(kaartId(sein.kaart))) return 0;
    const waar = w.hand.some((c) => c.kleur === sein.kaart.kleur && c.rang === sein.kaart.rang);
    if (waar) return SEIN_BONUS;
    const bekent = w.slag.length > 0 && k.kleur === w.slag[0].kaart.kleur;
    return -(bekent ? seinStrafBekennen : seinStraf);
  });
  // Troef trekken: voorkeur als de spelende partij uitkomt en er nog troef bij anderen kan zitten.
  const trekCorrectie = geldig.map(() => 0);
  if (trekBonus && w.slag.length === 0 && team(w.speler) === w.spelendTeam) {
    const mijnTroef = w.hand.filter((k) => k.kleur === w.troef);
    const elders = onbekend.filter((k) => k.kleur === w.troef);
    if (mijnTroef.length && elders.length) {
      const hoogsteElders = Math.max(...elders.map((k) => sterkte(k, w.troef)));
      geldig.forEach((k, i) => {
        if (k.kleur !== w.troef) return;
        if (sterkte(k, w.troef) > hoogsteElders) trekCorrectie[i] = trekBonus;
        else if (mijnTroef.length >= elders.length) trekCorrectie[i] = trekBonus / 2;
      });
    }
  }
  const totaal = (i) => gemiddeld[i] + seinCorrectie[i] + trekCorrectie[i];
  let best = 0;
  for (let i = 1; i < geldig.length; i++) {
    if (totaal(i) > totaal(best)) best = i;
  }
  const regel = geldig.map((k) => (vuistregels ? vuistregelStraf(w, k, onbekend) : 0));
  if (vuistregels && regel[best] > 0) {
    // Binnen de marge de kaart die geen vuistregel breekt (bij gelijke straf: hoogste score).
    for (let i = 0; i < geldig.length; i++) {
      if (totaal(best) - totaal(i) > marge) continue;
      if (regel[i] < regel[best] || (regel[i] === regel[best] && totaal(i) > totaal(best))) best = i;
    }
  }
  return {
    kaart: geldig[best],
    scores: geldig.map((k, i) => ({ kaart: k, gemiddeld: gemiddeld[i], sein: seinCorrectie[i], trek: trekCorrectie[i], regel: regel[i] })),
  };
}

// Hoe erg een kaart een menselijke vuistregel breekt (0 = niet).
// - Als tegenpartij kom je niet met troef uit.
// - Een kaart die nog een slag kan worden gooi je niet weg op een slag die je er niet mee wint:
//   een vrije kaart (niemand anders heeft nog een hogere), of een kaart die gedekt is door je
//   eigen hogere kaarten (zoals een heer naast je aas, met de tien nog in het spel).
export function vuistregelStraf(w, k, onbekend = onbekendeKaarten(w)) {
  if (w.slag.length === 0) {
    return team(w.speler) !== w.spelendTeam && k.kleur === w.troef ? 1 : 0;
  }
  if (k.kleur === w.troef || punten(k, w.troef) === 0) return 0;
  const hoger = (c) => c.kleur === k.kleur && sterkte(c, w.troef) > sterkte(k, w.troef);
  const hogerElders = onbekend.filter(hoger).length;
  const hogerZelf = w.hand.filter(hoger).length;
  if (hogerElders > 0) {
    // Gedekte kaart (zoals een heer naast je aas): alleen bij afgooien, niet bij bekennen.
    if (hogerElders > hogerZelf || k.kleur === w.slag[0].kaart.kleur) return 0;
  }
  const wint = huidigeWinnaar([...w.slag, { speler: w.speler, kaart: k }], w.troef).speler === w.speler;
  return wint ? 0 : 1;
}

// ---------- Spelen of passen bij het draaien ----------
// Speelt de hand vaak uit met deze troef (andere handen willekeurig) en speelt als het
// verwachte verschil (wij − zij) boven de drempel ligt.
export function kiesDraai(hand, kleur, {
  speler, deler, systeem = 'amsterdams', simulaties = DRAAI_SIMULATIES, drempel = DRAAI_DREMPEL, rng = Math.random, strategie = 'slim', trekken = true,
} = {}) {
  const ids = new Set(hand.map(kaartId));
  const rest = maakDeck().filter((k) => !ids.has(kaartId(k)));
  const ctx = { troef: kleur, systeem, spelendTeam: team(speler), strategie, trekken };
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
