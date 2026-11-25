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
import { kiesNet } from './netwerk.js';
import { geleerdVerschil } from './draaigeleerd.js';

// Moeilijkheidsniveaus. Eigen voorstel, nog af te stemmen met Rutger (zie RAPPORT-FASE-4.md).
// simulaties: aantal kaartverdelingen per zet; strategie: hoe de simulaties worden uitgespeeld;
// eindspel: aantal laatste slagen dat exact wordt doorgerekend.
// seinGeven/seinLezen: zelf seinen volgens Rutgers afspraken en seinen van anderen gebruiken.
// Ook op makkelijk seinen de computerspelers, zodat Rutger als maat de seinen kan lezen.
export const NIVEAUS = {
  makkelijk: { simulaties: 5, strategie: 'simpel', eindspel: 0, seinGeven: true, seinLezen: false },
  normaal: { simulaties: 100, strategie: 'slim', eindspel: 3, seinGeven: true, seinLezen: true, exactVanaf: 5, exactTop: 3, exactSims: 24 },
  sterk: { simulaties: 300, strategie: 'slim', eindspel: 3, seinGeven: true, seinLezen: true, exactVanaf: 5, exactTop: 4, exactSims: 40 },
};

// ---------- Seinen (Rutgers afspraken, zie CLAUDE.md) ----------
// Een sein is een kaart die wordt bijgespeeld op een slag die de maat op dat moment heeft,
// en de kaart zelf geen troef is (bekennen of afgooien maakt niet uit). Bij troef gevraagd alleen als
// de maat zelf troef trekt (uitkomt met troef) en de slag heeft (Rutgers afspraak).
//   7, 8 of 9 → "ik heb de aas van deze kleur"
//   aas        → "ik heb ook de tien van deze kleur"
// Een sein is een sterke aanwijzing, geen zekerheid.

// Eigen ontwerpkeuzes, niet beproefd; bij te stellen na testen:
export const SEIN_FACTOR = 10; // verdeling waarin een sein klopt telt zoveel keer zwaarder
export const SEIN_FACTOR_AAS = 10; // idem voor een bijgespeelde aas: altijd sterk (Rutger)
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
// Spekken (een aas of tien bijgooien op een slag die je maat niet heeft en die je er zelf niet
// mee wint): Rutger wil dat strenger. Alleen als elke andere kaart minstens zoveel punten slechter
// scoort, mag het toch. Eigen ontwerpkeuze, bij te stellen.
export const SPEK_MARGE = 20;

// Niet uitkomen met een tien als de aas van die kleur nog bij de tegenpartij kan zitten, ook niet als hij
// gedekt is (Rutger: houd hem achter, dan wordt hij misschien nog een slag of spek je hem bij je maat).
// Zit de aas zeker bij je maat, dan geldt de regel niet en beslist de simulatie (Rutger: je maat
// hoeft de aas niet bij te leggen, dat is een keuze).
// Even streng als spekken. De kale-tienregel blijft daarnaast gewoon gelden.
export const TIEN_UIT_MARGE = 20;

// Niet over je maat heen troeven als hij de slag zeker heeft: je speelt als laatste (Rutgers potje:
// Noord ♥A op Zuids ♣H), of wie na je komt kan zijn kaart niet meer slaan (Rutgers potje: Noord ♦10
// op Zuids vrije ♠V). Troeven kost dan alleen je troef. Streng: alleen als elke andere kaart
// minstens zoveel punten slechter scoort. Eigen ontwerpkeuze, bij te stellen.
export const MAAT_TROEF_MARGE = 40;
export function isTroefOpMaat(w, k, onbekend = onbekendeKaarten(w)) {
  if (!w.slag.length || k.kleur !== w.troef || w.slag[0].kaart.kleur === w.troef) return false;
  if (team(huidigeWinnaar(w.slag, w.troef).speler) !== team(w.speler)) return false;
  if (w.slag.length === 3) return true;
  // Kan een speler na mij nog een kaart hebben die de slag van mijn maat wint?
  const uit = uitsluitingen(w, onbekend);
  for (let i = 1; i <= 3 - w.slag.length; i++) {
    const p = (w.speler + i) % 4;
    if (onbekend.some((c) => !uit[p].has(kaartId(c)) && huidigeWinnaar([...w.slag, { speler: p, kaart: c }], w.troef).speler === p)) return false;
  }
  return true;
}
export function isTienUitkomst(w, k, onbekend = onbekendeKaarten(w)) {
  return w.slag.length === 0 && k.rang === '10' && k.kleur !== w.troef
    && bijTegenpartij(w, onbekend).some((c) => c.kleur === k.kleur && c.rang === 'A');
}

// Geeft kaart k roem weg op een slag die niet naar ons gaat (na deze kaart)? Zo'n kaart is geen
// goed alternatief voor spekken (Rutgers voorbeeld: Noord ♦B bij ♦V ♦H gaf 20 roem in plaats van ♠10).
export function geeftRoemWeg(w, k) {
  if (!w.slag.length) return false;
  const na = [...w.slag, { speler: w.speler, kaart: k }];
  if (team(huidigeWinnaar(na, w.troef).speler) === team(w.speler)) return false;
  return roemInSlag(na.map((x) => x.kaart), w.troef).totaal > roemInSlag(w.slag.map((x) => x.kaart), w.troef).totaal;
}

// Doortrekken (Rutger: standaardstrategie). Kom je uit als spelende partij, kan er nog troef bij een
// ander zitten en heb je een troef die boven alle troeven buiten je hand zit, trek dan met die troef.
// Even streng als spekken, met een ruimere marge: soms wijk je af, maar alleen als het duidelijk beter is.
export const TREK_MARGE = 40;
// Onbekende troeven die nog bij de tegenpartij kunnen zitten. Troef die alleen nog bij je maat kan
// zitten, hoef je niet te trekken (Rutgers voorbeeld Noord ♠10: dan trek je je maats ♠V weg).
// Algemener: alle onbekende kaarten die nog bij de tegenpartij kunnen zitten. De vuistregels gebruiken
// dit voor gevaar van de tegenpartij; een kaart die zeker bij je maat zit, is geen gevaar.
const tegenCache = new WeakMap();
export function bijTegenpartij(w, onbekend = onbekendeKaarten(w)) {
  const c = tegenCache.get(w);
  if (c && c.onbekend === onbekend) return c.kaarten;
  const uit = uitsluitingen(w, onbekend);
  const tegen = [0, 1, 2, 3].filter((p) => team(p) !== team(w.speler));
  const kaarten = onbekend.filter((k) => tegen.some((p) => !uit[p].has(kaartId(k))));
  tegenCache.set(w, { onbekend, kaarten });
  return kaarten;
}
export function troefBijTegenpartij(w, onbekend = onbekendeKaarten(w)) {
  return bijTegenpartij(w, onbekend).filter((c) => c.kleur === w.troef);
}
export function trekKaarten(w, onbekend = onbekendeKaarten(w)) {
  if (w.slag.length || team(w.speler) !== w.spelendTeam) return [];
  const elders = troefBijTegenpartij(w, onbekend);
  if (!elders.length) return [];
  const mijn = w.hand.filter((c) => c.kleur === w.troef);
  const baas = mijn.filter((c) => elders.every((o) => sterkte(c, w.troef) > sterkte(o, w.troef)));
  if (baas.length) return baas;
  // Ook doortrekken als je de slag verliest (Rutger): je hebt minstens zoveel troef als er nog
  // buiten je hand is, en je hebt nog 3 of meer mooie kaarten in een andere kleur (azen, tienen of
  // vrije kaarten) die je niet ingetroefd wilt zien. Dan met je laagste troef.
  const mooi = w.hand.filter((c) => c.kleur !== w.troef && (c.rang === 'A' || c.rang === '10' || isVrijeKaart(c, bijTegenpartij(w, onbekend), w.troef)));
  if (mijn.length && mijn.length >= elders.length && mooi.length >= 3) {
    return [mijn.reduce((a, b) => (sterkte(b, w.troef) < sterkte(a, w.troef) ? b : a))];
  }
  return [];
}

// Als tegenpartij kom je niet met troef uit (Rutger: dat moet je niet doen). Streng, net als spekken.
export const TROEF_UIT_MARGE = 60; // was 40; Rutger: als tegenpartij liever je troef bewaren om een slag te kapen
export function isTroefUitTegen(w, k) {
  return w.slag.length === 0 && team(w.speler) !== w.spelendTeam && k.kleur === w.troef;
}

// Aas en tien van dezelfde kleur, op een slag die naar ons gaat: speel de aas, niet de tien
// (Rutger). De tien wordt dan de hoogste kaart, het levert een punt meer op en het is een eerlijk
// sein ("ik heb ook de tien"). Geeft de tien in plaats van de aas, of omgekeerd.
export function aasVoorTien(w, k, geldig) {
  if (!w.slag.length || k.rang !== '10' || k.kleur === w.troef) return null;
  const aas = geldig.find((c) => c.kleur === k.kleur && c.rang === 'A');
  if (!aas) return null;
  const metAas = huidigeWinnaar([...w.slag, { speler: w.speler, kaart: aas }], w.troef).speler;
  const metTien = huidigeWinnaar([...w.slag, { speler: w.speler, kaart: k }], w.troef).speler;
  const roem = (c) => roemInSlag([...w.slag.map((x) => x.kaart), c], w.troef).totaal;
  return team(metAas) === team(w.speler) && team(metTien) === team(w.speler) && roem(aas) >= roem(k) ? aas : null;
}

// Geen troef uitkomen als de tegenpartij geen troef meer kan hebben (Rutger: bewaar die vrije troef,
// dan haal je er later een slag mee, met een beetje geluk de laatste; en zit de rest bij je maat, dan
// trek je die maar weg). Streng, net als doortrekken.
export const TROEF_BEWAAR_MARGE = 40;
export function isTroefZonderNut(w, k, onbekend = onbekendeKaarten(w)) {
  return w.slag.length === 0 && k.kleur === w.troef && !troefBijTegenpartij(w, onbekend).length
    && w.hand.some((c) => c.kleur !== w.troef);
}

// Is kaart k hier spekken?
export function isSpek(w, k) {
  if (!w.slag.length || punten(k, w.troef) < 10) return false;
  if (team(huidigeWinnaar(w.slag, w.troef).speler) === team(w.speler)) return false;
  const na = [...w.slag, { speler: w.speler, kaart: k }];
  return huidigeWinnaar(na, w.troef).speler !== w.speler;
}

const KLEINTJES = new Set(['7', '8', '9']);
const HOGE = new Set(['10', 'B', 'V', 'H']);

// Klopt sein s met deze hand? Een afsein (niet: true) klopt als de kaart er juist niet in zit.
export function seinKlopt(s, hand) {
  const heeft = hand.some((c) => c.kleur === s.kaart.kleur && c.rang === s.kaart.rang);
  return s.niet ? !heeft : heeft;
}

// Geeft het sein dat 'speler' geeft door 'kaart' te spelen op slag 'slagVoor', of null.
//   kleintje (7, 8, 9)      → "ik heb de aas"
//   aas                     → "ik heb ook de tien"
//   tien, boer, vrouw, heer → afseinen: "ik heb de aas niet" (Rutger, 20 november 2026) → { niet: true }
export function seinVan(slagVoor, speler, kaart, troef) {
  if (slagVoor.length === 0) return null;
  if (kaart.kleur === troef) return null;
  const w = huidigeWinnaar(slagVoor, troef);
  if (team(w.speler) !== team(speler)) return null;
  // Troef gevraagd: alleen als de maat zelf troef trekt (en de slag heeft).
  if (slagVoor[0].kaart.kleur === troef && slagVoor[0].speler !== w.speler) return null;
  if (KLEINTJES.has(kaart.rang)) return { speler, kaart: { kleur: kaart.kleur, rang: 'A' } };
  if (kaart.rang === 'A') return { speler, kaart: { kleur: kaart.kleur, rang: '10' } };
  if (HOGE.has(kaart.rang)) return { speler, kaart: { kleur: kaart.kleur, rang: 'A' }, niet: true };
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

// Tien-uitkomst lezen (Rutger: niemand komt uit met een tien als hij de aas niet heeft).
// Komt een ander uit met een tien (geen troef) terwijl de aas van die kleur nog onbekend is,
// dan heeft hij die aas waarschijnlijk. Verdelingen waarin dat niet zo is, tellen minder mee.
export const TIEN_FACTOR = 4; // eigen ontwerpkeuze, bij te stellen

export function tienUitkomsten(w, onbekend = onbekendeKaarten(w)) {
  const open = new Set(onbekend.map(kaartId));
  const lijst = [];
  for (const kaarten of [...w.slagen.map((s) => s.kaarten), w.slag]) {
    const eerste = kaarten[0];
    if (!eerste || eerste.speler === w.speler || eerste.kaart.rang !== '10' || eerste.kaart.kleur === w.troef) continue;
    const aas = { kleur: eerste.kaart.kleur, rang: 'A' };
    if (open.has(kaartId(aas))) lijst.push({ speler: eerste.speler, kaart: aas });
  }
  return lijst;
}

export function tienGewicht(handen, lijst, factor = TIEN_FACTOR) {
  let g = 1;
  for (const t of lijst) if (!handen[t.speler].some((c) => c.kleur === t.kaart.kleur && c.rang === 'A')) g /= factor;
  return g;
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
  for (const s of seinen) {
    if (seinKlopt(s, handen[s.speler])) continue;
    // Een aas bijspelen ("ik heb ook de tien") is altijd een sterk sein (Rutger: niemand gooit
    // zomaar een aas weg). Een kleintje kan ook weg om een reeks in een andere kleur te houden;
    // daarvoor blijft de beoordeling hieronder (keus gehad, goedkoop alternatief).
    if (!s.niet && s.kaart.rang === '10') { g /= SEIN_FACTOR_AAS; continue; }
    if (!s.context || !w) { g /= factor; continue; }
    const toen = [...handen[s.speler], ...laterGespeeld(w, s.speler, s.context.voor)];
    const opties = geldigeKaarten(toen, s.context.voor, w.troef, w.systeem);
    const gespeeld = s.context.kaart;
    const eerlijk = opties.filter((k) => {
      if (k.kleur === gespeeld.kleur && k.rang === gespeeld.rang) return false;
      const ander = seinVan(s.context.voor, s.speler, k, w.troef);
      return !ander || seinKlopt(ander, toen);
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
// Passen lezen: wie al gepast heeft op een kleur, heeft daarin waarschijnlijk geen sterke troef.
// Een verdeling telt zwaarder naarmate die passen er beter bij passen (kans op passen volgens SPEELKANS).
export function pasGewicht(handen, gepast, speler) {
  let g = 1;
  for (const [p, kleur] of gepast) if (p !== speler) g *= 1 - (SPEELKANS[kenmerk(handen[p], kleur)] ?? 0.5);
  return g;
}

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

// Verbeteringen van de speelstrategie, los aan/uit te zetten om ze met duels te meten.
// gedekt: een kaart die gedekt is door eigen hogere kaarten (heer naast aas) niet weggooien.
// maatNeemt: niet zelf overnemen als de maat na jou de slag zeker wint (duiken).
// baasHouden: in de snelle speelstijl gooit de maat geen vrije kaart (zoals een aas die zeker wint)
// weg op een slag die zijn maat al heeft; die kaart haalt later zelf een slag (Rutgers potje met ♦9).
export const SLIM_OPTIES = { gedekt: false, maatNeemt: false, baasHouden: true };

// Kan deze kaart nog een slag worden: niet meer hogere kaarten bij anderen dan bij mezelf?
function kanSlagWorden(k, handen, speler, troef) {
  const st = sterkte(k, troef);
  let elders = 0, zelf = 0;
  for (let p = 0; p < 4; p++) {
    for (const c of handen[p]) if (c.kleur === k.kleur && sterkte(c, troef) > st) p === speler ? zelf++ : elders++;
  }
  return elders <= zelf;
}

// Wint de maat (die na mij nog moet) deze slag zeker, wat ik ook laag bijspeel?
function maatWintZeker(handen, slag, speler, troef, systeem) {
  const maat = (speler + 2) % 4;
  if (slag.some((x) => x.speler === maat)) return false;
  const gevraagd = slag[0].kaart.kleur;
  // De maat moet na mij en voor de laatste tegenstander, of als laatste spelen.
  const g = geldigeKaarten(handen[maat], slag, troef, systeem);
  return g.some((m) => {
    const proef = [...slag, { speler: maat, kaart: m }];
    if (huidigeWinnaar(proef, troef).speler !== maat) return false;
    // Tegenstanders die na de maat nog moeten, mogen hem niet kunnen slaan.
    let b = (maat + 1) % 4;
    for (let i = 0; i < 4; i++, b = (b + 1) % 4) {
      if (b === speler || slag.some((x) => x.speler === b) || b === maat) continue;
      if (team(b) === team(speler)) continue;
      if (geldigeKaarten(handen[b], proef, troef, systeem).some((c) => slaatOver(c, m, gevraagd, troef))) return false;
    }
    return true;
  });
}

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
function afgooiWaarde(k, handen, speler, troef, opties = SLIM_OPTIES) {
  let w = punten(k, troef) * 1.0 + (k.kleur === troef ? 25 + sterkte(k, troef) : 0);
  if (k.kleur !== troef && isBaas(k, handen, speler, troef)) w += 8;
  else if (opties.gedekt && k.kleur !== troef && punten(k, troef) > 0 && kanSlagWorden(k, handen, speler, troef)) w += 6;
  // Een tien zonder aas erbij is kwetsbaar: liever bewaren dan weggooien is niet altijd beter,
  // maar een kale tien weggooien kost 10 punten.
  return w + sterkte(k, troef) * 0.05;
}

function roemMet(slag, k, troef) {
  return roemInSlag([...slag.map((x) => x.kaart), k], troef).totaal;
}

export function kiesSlim(handen, slag, ctx, speler, rng) {
  const { troef, systeem, spelendTeam } = ctx;
  const opties = ctx.opties ?? SLIM_OPTIES;
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
    if (naarMaat.length) return naarMaat.reduce((a, b) => (afgooiWaarde(a, handen, speler, troef, opties) <= afgooiWaarde(b, handen, speler, troef, opties) ? a : b));
    // Anders de goedkoopste kaart.
    return g.reduce((a, b) => (afgooiWaarde(a, handen, speler, troef, opties) <= afgooiWaarde(b, handen, speler, troef, opties) ? a : b));
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
        const vrij = k.kleur !== troef && isBaas(k, handen, speler, troef);
        const baasStraf = vrij && opties.baasHouden && k.kleur !== gevraagd ? 15 : vrij && punten(k, troef) < 10 ? 4 : 0;
        const sc = scoor(k, true) - verspilling - baasStraf;
        if (sc > bestS) { bestS = sc; best = k; }
      }
      return best;
    }
  }

  const winnend = g.filter((k) => slaatOver(k, w.kaart, gevraagd, troef));
  if (opties.maatNeemt && winnend.length && team(w.speler) !== mijnTeam && maatWintZeker(handen, slag, speler, troef, systeem)) {
    // Duiken: de maat neemt hem zeker, dus zelf niet overnemen maar punten bijgeven die toch binnenkomen.
    let best = null, bestS = -Infinity;
    for (const k of g) {
      const verspilling = k.kleur === troef ? 15 + sterkte(k, troef) * 2 : 0;
      const sc = punten(k, troef) - verspilling - afgooiWaarde(k, handen, speler, troef, opties) * 0.01;
      if (sc > bestS) { bestS = sc; best = k; }
    }
    return best;
  }
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
    const sc = afgooiWaarde(k, handen, speler, troef, opties) + roemMet(slag, k, troef);
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

// Exacte waarde (open kaarten) van elke geldige kaart voor de speler die aan de beurt is.
// Gebruikt om oefenmateriaal voor het netwerk te maken (ontwikkeling/netwerk/).
export function kaartWaarden(handen, slag, slagen, beurt, ctx) {
  const h = handen.map((x) => x.slice());
  const s = slag.slice();
  const sl = slagen.slice();
  const mijn = team(beurt);
  return geldigeKaarten(h[beurt], s, ctx.troef, ctx.systeem).map((k) => {
    const i = h[beurt].indexOf(k);
    h[beurt].splice(i, 1);
    s.push({ speler: beurt, kaart: k });
    let v;
    if (s.length < 4) v = zoek(h, s, sl, (beurt + 1) % 4, ctx, mijn, -Infinity, Infinity);
    else {
      const winnaar = huidigeWinnaar(s, ctx.troef).speler;
      const kaarten = s.map((x) => x.kaart);
      sl.push({ kaarten: s.slice(), winnaar, punten: slagPunten(kaarten, ctx.troef) + (sl.length === 7 ? PUNTEN_LAATSTE_SLAG : 0), roem: roemInSlag(kaarten, ctx.troef) });
      const oud = s.splice(0, 4);
      v = zoek(h, s, sl, winnaar, ctx, mijn, -Infinity, Infinity);
      s.push(...oud);
      sl.pop();
    }
    s.pop();
    h[beurt].splice(i, 0, k);
    return { kaart: k, waarde: v };
  });
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
      : ctx.net && slagen.length >= (ctx.netVanaf ?? 0) ? kiesNet(ctx.net, handen, slag, slagen, beurt, ctx) // optie B (proef)
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
// Standaardinstellingen van de computer (zie NIVEAUS voor de niveaus).
function opties(o = {}) {
  const {
  simulaties = NIVEAUS.normaal.simulaties, rng = Math.random, strategie = 'slim', eindspel = EINDSPEL_SLAGEN,
  seinGeven = true, seinLezen = true, seinFactor = SEIN_FACTOR, bekendeHanden = null, trekken = true,
  trekBonus = TREK_BONUS, seinStraf = SEIN_STRAF, seinStrafBekennen = SEIN_STRAF_BEKENNEN,
  draaiInfo = true, vuistregels = true, marge = VUISTREGEL_MARGE, spekMarge = SPEK_MARGE, tienUitMarge = TIEN_UIT_MARGE, trekMarge = TREK_MARGE, troefUitMarge = TROEF_UIT_MARGE, troefBewaarMarge = TROEF_BEWAAR_MARGE, maatTroefMarge = MAAT_TROEF_MARGE, tienLezen = true, tienFactor = TIEN_FACTOR, slimOpties = SLIM_OPTIES, gedektRegel = true, vuistregelSet = VUISTREGELS,
  exactVanaf = 0, exactTop = 3, exactSims = 40, netwerk = null, netVanaf = 0,
  } = o;
  return { simulaties, rng, strategie, eindspel, seinGeven, seinLezen, seinFactor, bekendeHanden, trekken, trekBonus, seinStraf, seinStrafBekennen,
    draaiInfo, vuistregels, marge, spekMarge, tienUitMarge, trekMarge, troefUitMarge, troefBewaarMarge, maatTroefMarge, tienLezen, tienFactor, slimOpties, gedektRegel, vuistregelSet, exactVanaf, exactTop, exactSims, netwerk, netVanaf };
}

// Rekent voor de gegeven kaarten de gewogen totalen uit over 'simulaties' verdelingen
// (exact doorgerekend of met de snelle speelstijl). Los te gebruiken, zodat meerdere workers
// tegelijk kunnen rekenen.
export function rekenTotalen(w, o, geldig, simulaties, exact) {
  const { rng, strategie, seinLezen, seinFactor, bekendeHanden, trekken, draaiInfo, tienLezen, tienFactor, slimOpties, netwerk, netVanaf } = opties(o);
  const ctx = { troef: w.troef, systeem: w.systeem, spelendTeam: w.spelendTeam, strategie, trekken, opties: slimOpties, net: netwerk, netVanaf };
  const onbekend = onbekendeKaarten(w);
  const uit = uitsluitingen(w, onbekend);
  const seinen = seinLezen && !bekendeHanden ? seinenVanAnderen(w, onbekend) : [];
  const tienen = tienLezen && !bekendeHanden ? tienUitkomsten(w, onbekend) : [];
  const totalen = new Array(geldig.length).fill(0);
  let gewichtSom = 0;
  const beurtNa = (w.speler + 1) % 4;
  for (let n = 0; n < simulaties; n++) {
    const handen = bekendeHanden ? bekendeHanden.map((h) => h.slice()) : trekVerdeling(w, uit, onbekend, rng);
    const gewicht = (seinen.length ? seinGewicht(handen, seinen, seinFactor, w) : 1)
      * (draaiInfo && !bekendeHanden ? draaiGewicht(handen, w) : 1)
      * (tienen.length ? tienGewicht(handen, tienen, tienFactor) : 1);
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
  return { totalen, gewichtSom };
}

// Voorkeuren bovenop de berekening: zelf seinen en troef trekken.
function correcties(w, o, geldig, onbekend) {
  const { seinGeven, trekBonus, seinStraf, seinStrafBekennen } = o;
  // Zelf seinen: een waar sein krijgt een kleine voorkeur, een vals sein een afkeer.
  const gespeeld = new Set([...w.slagen.flatMap((s) => s.kaarten), ...w.slag].map((x) => kaartId(x.kaart)));
  const seinCorrectie = geldig.map((k) => {
    if (!seinGeven) return 0;
    const sein = seinVan(w.slag, w.speler, k, w.troef);
    if (!sein || gespeeld.has(kaartId(sein.kaart))) return 0;
    if (seinKlopt(sein, w.hand)) return SEIN_BONUS;
    const bekent = w.slag.length > 0 && k.kleur === w.slag[0].kaart.kleur;
    return -(bekent ? seinStrafBekennen : seinStraf);
  });
  // Seinen gaat nooit voor zekere slagen (Rutger, na Noord ♦10 op Zuids vrije ♠V): zou je een vals
  // sein alleen vermijden door een kaart weg te geven die zeker nog een slag wordt, dan telt de straf niet.
  if (seinCorrectie.some((c) => c < 0)) {
    const tegen = bijTegenpartij(w, onbekend);
    const geenTroefMeer = !tegen.some((c) => c.kleur === w.troef);
    const zeker = (k) => isVrijeKaart(k, tegen, w.troef) && (k.kleur === w.troef || geenTroefMeer);
    if (geldig.every((k, i) => seinCorrectie[i] < 0 || zeker(k))) seinCorrectie.forEach((c, i) => { if (c < 0) seinCorrectie[i] = 0; });
  }
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
  return { seinCorrectie, trekCorrectie };
}

// Eerst grof, dan exact (optie A, op Rutgers verzoek): zijn er nog 'exactVanaf' slagen of minder te
// spelen, dan worden de 'exactTop' beste kaarten van de gewone berekening exact doorgerekend in
// 'exactSims' verdelingen. De andere kaarten schuiven mee met het gemiddelde verschil.
export function exactNodig(w, o) {
  const x = opties(o);
  const resten = 8 - w.slagen.length;
  return !x.bekendeHanden && x.exactTop > 0 && resten > x.eindspel && resten <= x.exactVanaf;
}

export function kortelijst(w, o, geldig, gemiddeld) {
  const x = opties(o);
  const { seinCorrectie, trekCorrectie } = correcties(w, x, geldig, onbekendeKaarten(w));
  const totaal = (i) => gemiddeld[i] + seinCorrectie[i] + trekCorrectie[i];
  const volgorde = geldig.map((_, i) => i).sort((a, b) => totaal(b) - totaal(a));
  const kort = volgorde.filter((i) => totaal(volgorde[0]) - totaal(i) <= 40).slice(0, x.exactTop);
  // Kaarten die een strenge regel voorschrijft (doortrekken) altijd exact meenemen: juist daar
  // vergist de snelle speelstijl zich.
  if (x.vuistregels && x.trekMarge > 0) {
    for (const t of trekKaarten(w)) {
      const i = geldig.findIndex((k) => zelfdeKaart(k, t));
      if (i >= 0 && !kort.includes(i)) kort.push(i);
    }
  }
  return kort;
}

export function verfijn(gemiddeld, kort, exactGem) {
  const verschil = kort.reduce((s, i, j) => s + exactGem[j] - gemiddeld[i], 0) / kort.length;
  const nieuw = gemiddeld.map((g) => g + verschil);
  kort.forEach((i, j) => { nieuw[i] = exactGem[j]; });
  return nieuw;
}

export function kiesKaart(w, o = {}) {
  const x = opties(o);
  const geldig = geldigeKaarten(w.hand, w.slag, w.troef, w.systeem);
  if (geldig.length === 1) return { kaart: geldig[0], scores: null };
  const exact = 8 - w.slagen.length <= x.eindspel;
  const r = rekenTotalen(w, x, geldig, x.simulaties, exact);
  let gemiddeld = r.totalen.map((t) => t / r.gewichtSom);
  if (exactNodig(w, x)) {
    const kort = kortelijst(w, x, geldig, gemiddeld);
    const e = rekenTotalen(w, x, kort.map((i) => geldig[i]), x.exactSims, true);
    gemiddeld = verfijn(gemiddeld, kort, e.totalen.map((t) => t / e.gewichtSom));
  }
  return beslis(w, x, geldig, gemiddeld);
}

// De keuze zelf: berekening plus voorkeuren, vuistregels en de strenge regels.
export function beslis(w, o, geldig, gemiddeld) {
  const { vuistregels, marge, spekMarge, tienUitMarge, trekMarge, troefUitMarge, troefBewaarMarge, maatTroefMarge, gedektRegel, vuistregelSet } = opties(o);
  const onbekend = onbekendeKaarten(w);
  const { seinCorrectie, trekCorrectie } = correcties(w, opties(o), geldig, onbekend);
  const totaal = (i) => gemiddeld[i] + seinCorrectie[i] + trekCorrectie[i];
  let best = 0;
  for (let i = 1; i < geldig.length; i++) {
    if (totaal(i) > totaal(best)) best = i;
  }
  const regel = geldig.map((k) => (vuistregels ? vuistregelStraf(w, k, onbekend, gedektRegel, vuistregelSet) : 0));
  if (vuistregels && regel[best] > 0) {
    // Binnen de marge de kaart die geen vuistregel breekt (bij gelijke straf: hoogste score).
    for (let i = 0; i < geldig.length; i++) {
      if (totaal(best) - totaal(i) > marge) continue;
      if (regel[i] < regel[best] || (regel[i] === regel[best] && totaal(i) > totaal(best))) best = i;
    }
  }
  // Niet spekken, tenzij elke andere kaart duidelijk slechter is.
  if (vuistregels && spekMarge > 0 && isSpek(w, geldig[best])) {
    let alt = -1;
    for (let i = 0; i < geldig.length; i++) {
      if (isSpek(w, geldig[i]) || geeftRoemWeg(w, geldig[i]) || totaal(best) - totaal(i) > spekMarge) continue;
      if (alt < 0 || regel[i] < regel[alt] || (regel[i] === regel[alt] && totaal(i) > totaal(alt))) alt = i;
    }
    if (alt >= 0) best = alt;
  }
  // Niet over je maat heen troeven als laatste in de slag, tenzij elke andere kaart duidelijk slechter is.
  if (vuistregels && maatTroefMarge > 0 && isTroefOpMaat(w, geldig[best], onbekend)) {
    let alt = -1;
    for (let i = 0; i < geldig.length; i++) {
      if (isTroefOpMaat(w, geldig[i], onbekend) || totaal(best) - totaal(i) > maatTroefMarge) continue;
      if (alt < 0 || regel[i] < regel[alt] || (regel[i] === regel[alt] && totaal(i) > totaal(alt))) alt = i;
    }
    if (alt >= 0) best = alt;
  }
  // Doortrekken met je hoogste troef, tenzij een andere kaart duidelijk beter is.
  if (vuistregels && trekMarge > 0) {
    const trek = trekKaarten(w, onbekend);
    if (trek.length && !trek.some((t) => zelfdeKaart(t, geldig[best]))) {
      let alt = -1;
      for (let i = 0; i < geldig.length; i++) {
        if (!trek.some((t) => zelfdeKaart(t, geldig[i])) || totaal(best) - totaal(i) > trekMarge) continue;
        if (alt < 0 || totaal(i) > totaal(alt)) alt = i;
      }
      if (alt >= 0) best = alt;
    }
  }
  // Geen troef uitkomen als niemand anders nog troef heeft, tenzij elke andere kaart duidelijk slechter is.
  if (vuistregels && troefBewaarMarge > 0 && isTroefZonderNut(w, geldig[best], onbekend)) {
    let alt = -1;
    for (let i = 0; i < geldig.length; i++) {
      if (geldig[i].kleur === w.troef || totaal(best) - totaal(i) > troefBewaarMarge) continue;
      if (alt < 0 || regel[i] < regel[alt] || (regel[i] === regel[alt] && totaal(i) > totaal(alt))) alt = i;
    }
    if (alt >= 0) best = alt;
  }
  // Tegenpartij: niet met troef uitkomen, tenzij elke andere kaart duidelijk slechter is.
  if (vuistregels && troefUitMarge > 0 && isTroefUitTegen(w, geldig[best])) {
    let alt = -1;
    for (let i = 0; i < geldig.length; i++) {
      if (isTroefUitTegen(w, geldig[i]) || totaal(best) - totaal(i) > troefUitMarge) continue;
      if (alt < 0 || regel[i] < regel[alt] || (regel[i] === regel[alt] && totaal(i) > totaal(alt))) alt = i;
    }
    if (alt >= 0) best = alt;
  }
  // Niet uitkomen met een tien zonder de aas, tenzij elke andere kaart duidelijk slechter is.
  if (vuistregels && tienUitMarge > 0 && isTienUitkomst(w, geldig[best], onbekend)) {
    let alt = -1;
    for (let i = 0; i < geldig.length; i++) {
      if (isTienUitkomst(w, geldig[i], onbekend) || totaal(best) - totaal(i) > tienUitMarge) continue;
      if (alt < 0 || regel[i] < regel[alt] || (regel[i] === regel[alt] && totaal(i) > totaal(alt))) alt = i;
    }
    if (alt >= 0) best = alt;
  }
  // Aas en tien van dezelfde kleur op een slag van ons: de aas (Rutger).
  if (vuistregels) {
    const aas = aasVoorTien(w, geldig[best], geldig);
    if (aas) best = geldig.findIndex((c) => zelfdeKaart(c, aas));
  }
  return {
    kaart: geldig[best],
    scores: geldig.map((k, i) => ({ kaart: k, gemiddeld: gemiddeld[i], sein: seinCorrectie[i], trek: trekCorrectie[i], regel: regel[i] })),
  };
}

// Hoe erg een kaart een menselijke vuistregel breekt (0 = niet). Regels uit Rutgers voorbeelden.
// - Als tegenpartij kom je niet met troef uit.
// - Een kaart die nog een slag kan worden (vrij, of gedekt bij afgooien) gooi je niet weg
//   op een slag die je er niet mee wint.
// - Uitkomen: let op roem; zonder de hoogste kaart van een kleur kom je uit met de laagste
//   kaart die geen roem kan opleveren.
// - Punten bijgooien alleen als je maat de slag al heeft.
// - Troef gevraagd en je kunt niet overtroeven: de goedkoopste troef, en geen troef die nog
//   een slag kan worden.
export const VUISTREGELS = {
  uitkomen: true, bijgooien: true, troefGevraagd: true,
  // Uit VUISTREGELS.md (goedgekeurd door Rutger):
  trekNiet: true, // 4: geen troef trekken als niemand anders nog troef kan hebben
  laagsteWinnaar: true, // 19: als laatste winnen met de laagste kaart die genoeg is
  trekHoog: true, // Rutgers voorbeeld (West ♠7): trek met een troef die zeker wint als je die hebt
  innen: true, // 5 en 9: vrije azen en tienen binnenhalen
  maatKleur: true, // 6 en 10: de kleur van je maat (sein of eerder uitgekomen) naspelen
  kaleTien: true, // 11: niet uitkomen met een kale tien
  nietOverMaat: true, // 16: niet over je maat heen troeven
  tweedeHandLaag: true, // 17
  derdeHandHoog: true, // 18
  geenRoemWeg: true, // 21: geen roem afmaken op een slag van de tegenpartij
  roemKlaarleggen: true, // Rutgers voorbeeld (Noord ♦7 bij ♦9): geen roem klaarleggen voor een tegenstander na je
  tienBeschermen: true, // 22: een tien niet bijspelen zolang de aas nog bij de tegenpartij kan zitten
  lageTroefBewaren: true, // 24: je laatste troef bewaren voor de laatste slagen
};
export const GEEN_NIEUWE_REGELS = Object.fromEntries(Object.keys(VUISTREGELS).map((k) => [k, ['uitkomen', 'bijgooien', 'troefGevraagd'].includes(k)]));

const isVrijeKaart = (k, onbekend, troef) => !onbekend.some((c) => c.kleur === k.kleur && sterkte(c, troef) > sterkte(k, troef));

// Kleuren waarin je maat sterk is: waarin hij seinde, of waarmee hij eerder uitkwam (geen troef).
function maatKleuren(w, onbekend) {
  const maat = (w.speler + 2) % 4;
  const kleuren = new Set();
  for (const sein of seinenVanAnderen(w, onbekend)) if (sein.speler === maat && !sein.niet) kleuren.add(sein.kaart.kleur);
  for (const sl of w.slagen) if (sl.kaarten[0].speler === maat && sl.kaarten[0].kaart.kleur !== w.troef) kleuren.add(sl.kaarten[0].kaart.kleur);
  return kleuren;
}

// Kan deze kaart in een slag roem maken met kaarten die nog bij anderen zitten?
function roemGevaar(k, onbekend, troef) {
  const open = new Set(onbekend.filter((c) => c.kleur === k.kleur).map((c) => RANG_NAT.indexOf(c.rang)));
  const r = RANG_NAT.indexOf(k.rang);
  for (const [a, b] of [[r - 2, r - 1], [r - 1, r + 1], [r + 1, r + 2]]) if (open.has(a) && open.has(b)) return true;
  if (k.kleur === troef && (k.rang === 'H' || k.rang === 'V')) return open.has(RANG_NAT.indexOf(k.rang === 'H' ? 'V' : 'H'));
  return false;
}

export function vuistregelStraf(w, k, onbekend = onbekendeKaarten(w), gedektRegel = false, regels = VUISTREGELS) {
  const troef = w.troef;
  const hoger = (c) => c.kleur === k.kleur && sterkte(c, troef) > sterkte(k, troef);
  // Kaarten die nog bij de tegenpartij kunnen zitten (niet: kaarten die zeker bij je maat zitten).
  const tegen = bijTegenpartij(w, onbekend);
  if (w.slag.length === 0) {
    let straf = team(w.speler) !== w.spelendTeam && k.kleur === troef ? 1 : 0;
    if (regels.uitkomen && k.kleur !== troef) {
      const eigen = w.hand.filter((c) => c.kleur === k.kleur);
      // Een kaart waar niemand meer boven zit, wint meestal zelf: dan is roem juist goed.
      const kIsBaas = !onbekend.some(hoger);
      if (!kIsBaas && roemGevaar(k, onbekend, troef)) straf++;
      // Zonder de hoogste kaart van deze kleur: de laagste kaart die geen roem kan geven.
      const baas = !onbekend.some((c) => c.kleur === k.kleur && eigen.every((e) => sterkte(c, troef) > sterkte(e, troef)));
      if (!baas) {
        const veilig = eigen.filter((c) => !roemGevaar(c, onbekend, troef));
        const laagste = (veilig.length ? veilig : eigen).reduce((a, b) => (sterkte(b, troef) < sterkte(a, troef) ? b : a));
        if (laagste.rang !== k.rang) straf++;
      }
    }
    const geenTroefElders = !tegen.some((c) => c.kleur === troef);
    const eigenTroef = w.hand.some((c) => c.kleur === troef);
    if (regels.trekNiet && k.kleur === troef && geenTroefElders) straf++;
    // Troef trekken: heb je een troef boven alle troeven die nog buiten zijn, trek dan daarmee.
    if (regels.trekHoog && k.kleur === troef && !geenTroefElders) {
      const boven = (c) => tegen.every((o) => o.kleur !== troef || sterkte(c, troef) > sterkte(o, troef));
      if (!boven(k) && w.hand.some((c) => c.kleur === troef && boven(c))) straf++;
    }
    // Vrije azen en tienen innen als spelende partij, na het troeftrekken. (Als tegenpartij is een
    // aas uitkomen goed, maar geen plicht: Rutger vond ♠A of ♦8 allebei goed.)
    const tegenpartij = team(w.speler) !== w.spelendTeam;
    const vrij = w.hand.filter((c) => c.kleur !== troef && punten(c, troef) >= 10 && isVrijeKaart(c, tegen, troef));
    if (regels.innen && vrij.length && !tegenpartij && (geenTroefElders || !eigenTroef)
      && !(k.kleur !== troef && isVrijeKaart(k, tegen, troef))) straf++;
    // De kleur van je maat naspelen.
    if (regels.maatKleur) {
      const mk = maatKleuren(w, onbekend);
      if (mk.size && w.hand.some((c) => mk.has(c.kleur)) && !mk.has(k.kleur)) straf++;
    }
    // Niet uitkomen met een kale tien (de aas zit nog bij een ander).
    if (regels.kaleTien && k.kleur !== troef && k.rang === '10' && tegen.some((c) => c.kleur === k.kleur && c.rang === 'A')) straf++;
    // Je laatste troef bewaren voor de laatste slagen.
    if (regels.lageTroefBewaren && k.kleur === troef && w.slagen.length < 6 && w.hand.filter((c) => c.kleur === troef).length === 1
      && !trekKaarten(w, onbekend).some((t) => zelfdeKaart(t, k))) straf++; // doortrekken gaat voor
    return straf;
  }
  const na = [...w.slag, { speler: w.speler, kaart: k }];
  const wint = huidigeWinnaar(na, troef).speler === w.speler;
  const gevraagd = w.slag[0].kaart.kleur;
  const voor = huidigeWinnaar(w.slag, troef);
  const maatHeeft = team(voor.speler) === team(w.speler);
  const geldig = geldigeKaarten(w.hand, w.slag, troef, w.systeem);
  let straf = 0;
  // 19: als laatste in de slag win je met de laagste kaart die genoeg is.
  if (regels.laagsteWinnaar && w.slag.length === 3 && wint
    && geldig.some((c) => c.kleur === k.kleur && sterkte(c, troef) < sterkte(k, troef)
      && huidigeWinnaar([...w.slag, { speler: w.speler, kaart: c }], troef).speler === w.speler)) straf++;
  // Niet over je maat heen troeven.
  if (regels.nietOverMaat && maatHeeft && k.kleur === troef && gevraagd !== troef) straf++;
  // Tweede hand laag: niet hoger dan nodig in de gevraagde kleur, tenzij de slag dan zeker is.
  if (regels.tweedeHandLaag && w.slag.length === 1 && k.kleur === gevraagd && gevraagd !== troef && !isVrijeKaart(k, tegen, troef)) {
    const lager = geldig.some((c) => c.kleur === gevraagd && sterkte(c, troef) < sterkte(k, troef));
    if (lager) straf++;
  }
  // Derde hand hoog: kan de laatste speler (tegenpartij) de slag nog nemen, speel dan je vrije kaart.
  if (regels.derdeHandHoog && w.slag.length === 2 && gevraagd !== troef && !(k.kleur === gevraagd && isVrijeKaart(k, tegen, troef))) {
    const baasKaart = geldig.find((c) => c.kleur === gevraagd && isVrijeKaart(c, tegen, troef) && slaatOver(c, voor.kaart, gevraagd, troef));
    if (baasKaart && voor.kaart.kleur === gevraagd && !isVrijeKaart(voor.kaart, tegen, troef)) straf++;
  }
  // Geen roem afmaken op een slag die de tegenpartij heeft.
  if (regels.geenRoemWeg && !wint && !maatHeeft) {
    const meer = roemInSlag(na.map((x) => x.kaart), troef).totaal - roemInSlag(w.slag.map((x) => x.kaart), troef).totaal;
    if (meer > 0) straf++;
  }
  // Geen roem klaarleggen: speelt er na jou nog een tegenstander, leg dan geen kaart waarmee
  // één onbekende kaart van hem roem maakt (zoals ♦7 bij ♦9: de ♦8 maakt een driekaart).
  // Niet als jouw kaart de slag zeker wint: dan is die roem juist voor jullie (Rutgers voorbeeld:
  // Noord ♣B bij ♣V ♣A, de ♣H van Oost maakt 70 roem voor Noord).
  const zeker = wint && tegen.every((u) => huidigeWinnaar([...na, { speler: -1, kaart: u }], troef).speler === w.speler);
  if (regels.roemKlaarleggen && !maatHeeft && !zeker) {
    const naJou = [1, 2, 3].slice(0, 3 - w.slag.length).map((i) => (w.speler + i) % 4);
    if (naJou.some((p) => team(p) !== team(w.speler))) {
      const zonder = w.slag.map((x) => x.kaart);
      const met = na.map((x) => x.kaart);
      const basis = roemInSlag(met, troef).totaal;
      if (tegen.some((u) => roemInSlag([...met, u], troef).totaal - basis > roemInSlag([...zonder, u], troef).totaal - roemInSlag(zonder, troef).totaal)) straf++;
    }
  }
  // Een tien niet bijspelen zolang de aas nog bij de tegenpartij kan zitten.
  if (regels.tienBeschermen && k.kleur !== troef && k.rang === '10' && tegen.some((c) => c.kleur === k.kleur && c.rang === 'A')) {
    if (!wint && !(maatHeeft && w.slag.length === 3)) straf++;
  }
  // Je laatste troef bewaren voor de laatste slagen (niet bij troef gevraagd: dan moet je).
  if (regels.lageTroefBewaren && k.kleur === troef && gevraagd !== troef && w.slagen.length < 6
    && w.hand.filter((c) => c.kleur === troef).length === 1 && geldig.some((c) => c.kleur !== troef)) straf++;
  if (wint) return straf;
  if (k.kleur === troef) {
    if (regels.troefGevraagd && gevraagd === troef) {
      const elders = tegen.filter(hoger).length;
      if (elders <= w.hand.filter(hoger).length) straf++; // kan nog een slag worden
      const opties = geldigeKaarten(w.hand, w.slag, troef, w.systeem).filter((c) => c.kleur === troef);
      if (opties.some((c) => punten(c, troef) < punten(k, troef))) straf++;
    }
    return straf;
  }
  const elders = tegen.filter(hoger).length;
  // Gedekte kaart (zoals een heer naast je eigen aas), alleen bij afgooien. Gemeten: kost niets.
  const gedekt = gedektRegel && elders > 0 && elders <= w.hand.filter(hoger).length && k.kleur !== gevraagd;
  if ((elders === 0 || gedekt) && punten(k, troef) > 0) straf++;
  // Punten bijgooien alleen als je maat de slag al heeft.
  if (regels.bijgooien && punten(k, troef) > 0) {
    const voor = huidigeWinnaar(w.slag, troef).speler;
    if (team(voor) !== team(w.speler)) straf++;
  }
  return straf;
}

// ---------- Troef kiezen bij verplicht spelen ----------
// De voorhand moet spelen: hij kiest de kleur met de beste verwachte uitkomst.
export function kiesVerplicht(hand, opties = {}) {
  const scores = ['klaveren', 'ruiten', 'harten', 'schoppen'].map((kleur) => ({ kleur, gemiddeld: kiesDraai(hand, kleur, opties).gemiddeld }));
  const best = scores.reduce((a, b) => (b.gemiddeld > a.gemiddeld ? b : a));
  return { kleur: best.kleur, scores };
}

// ---------- Spelen of passen bij het draaien ----------
// Speelt de hand vaak uit met deze troef (andere handen willekeurig) en speelt als het
// verwachte verschil (wij − zij) boven de drempel ligt.
export function kiesDraai(hand, kleur, {
  speler, deler, systeem = 'amsterdams', simulaties = DRAAI_SIMULATIES, drempel = DRAAI_DREMPEL, rng = Math.random, strategie = 'slim', trekken = true,
  gepast = [], pasLezen = false, // gemeten: levert niets op (zie CLAUDE.md), daarom uit
  geleerd = strategie === 'slim', // geleerd spelen/passen (draaigeleerd.js); makkelijk houdt de drempel
} = {}) {
  const ids = new Set(hand.map(kaartId));
  const rest = maakDeck().filter((k) => !ids.has(kaartId(k)));
  const ctx = { troef: kleur, systeem, spelendTeam: team(speler), strategie, trekken };
  let som = 0, gewichten = 0;
  const lees = pasLezen && gepast.some(([p]) => p !== speler);
  for (let n = 0; n < simulaties; n++) {
    const geschud = schudIn(rest.slice(), rng);
    const handen = [[], [], [], []];
    handen[speler] = hand.slice();
    let pos = 0;
    for (let p = 0; p < 4; p++) if (p !== speler) handen[p] = geschud.slice(pos, (pos += 8));
    const g = lees ? pasGewicht(handen, gepast, speler) : 1;
    gewichten += g;
    som += g * verschil(speelUit(handen, [], [], (deler + 1) % 4, ctx, rng), speler);
  }
  const gemiddeld = som / gewichten;
  if (geleerd) {
    const verwacht = geleerdVerschil(hand, kleur, gemiddeld, speler, deler, gepast);
    return { keuze: verwacht > 0 ? 'spelen' : 'passen', gemiddeld, verwacht };
  }
  return { keuze: gemiddeld > drempel ? 'spelen' : 'passen', gemiddeld };
}
