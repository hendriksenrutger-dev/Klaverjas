// Spelverloop: koppelt de spelregels aan het scherm en de computerspelers.

import * as R from '../regels/index.js';
import { vraagKaart, vraagDraai, vraagVerplicht, analyseerKaart, analyseerDraai, analyseerVerplicht } from '../ai/client.js';
import { beoordeelKaart, legeVergelijking, telOp } from '../ai/vergelijk.js';
import { render } from './tafel.js';
import * as geluid from './geluid.js';
import { laadPlaatjes } from './plaatjes.js';
import { laadInstellingen, bewaarInstellingen, laadPartij, bewaarPartij, laadStatistiek, bewaarStatistiek } from './opslag.js';
import { compleet, legeStatistiek, telPotje, telPartij, telVergelijk } from './statistiek.js';

const snel = new URLSearchParams(location.search).has('snel'); // voor automatische tests
// Computerspelers "denken" zichtbaar 0,5 tot 1 seconde (ook als het rekenen sneller gaat).
const denktijd = () => (snel ? 0 : 350 + Math.random() * 300);
// Bij spelen of passen denken de computers iets langer, zodat je kunt volgen wie wat kiest.
const denktijdDraai = () => (snel ? 0 : 600 + Math.random() * 300);
const AANKONDIGING = snel ? 0 : 1800; // "Oost speelt · troef Ruiten"
const IEDEREEN_PAST = snel ? 0 : 1100;
const SLAG_PAUZE = snel ? 0 : 1000;
const MELDING_TIJD = snel ? 0 : 2000;

const JIJ = 0;

const spel = {
  partij: null,
  fase: 'start', // draaien | spelen | potjeKlaar | partijKlaar | opnieuwDelen
  handen: null,
  draaien: null,
  draaiKeuzes: {}, // speler -> 'passen' voor de huidige gedraaide kaart
  potje: null,
  gekozen: null, // kaartId van de opgetilde kaart
  getoondeSlag: null, // afgeronde slag die nog even blijft liggen
  laatsteSlag: null, // vorige slag, om terug te kijken
  venster: null, // laatsteSlag | gespeeld | menu | nieuwBevestig | instellingen
  verzaakReden: null,
  instellingen: laadInstellingen(), // ook de namen en het niveau
  scherm: 'start', // start | tafel
  bewaard: null, // korte samenvatting van een bewaarde partij, voor het beginscherm
  get namen() {
    return this.instellingen.namen;
  },
  nieuweKaart: null, // kaartId die net op tafel kwam (alleen die krijgt de animatie)
  roemMelding: null,
  uitslag: null,
  // Vergelijk met de computer (instelling): per kaart/keuze van jou wat de computer had gedaan.
  analyses: [], // { soort: 'kaart'|'draai', potje, slag?, ... }
  vergelijking: null, // totalen over de partij
  analyseBezig: 0,
  statistiek: compleet(laadStatistiek()), // over alle partijen, los van de lopende partij
  wisVraag: false, // eerste tik op "Statistieken wissen"
  statSysteem: null, // welk tabblad van de statistieken (standaard het ingestelde systeem)
};

let timer = null;
let beurtToken = 0; // voorkomt dat een oud AI-antwoord in een nieuwe situatie wordt toegepast
function later(fn, ms) {
  clearTimeout(timer);
  timer = setTimeout(fn, ms);
}

// Zolang deze vensters open zijn, wacht het spel (bijv. tijdens het typen van een naam).
const PAUZE = new Set(['instellingen', 'menu', 'nieuwBevestig']);
let uitgesteld = null;

// Laat een computerspeler rekenen en wacht daarnaast minstens de denktijd.
function computerZet(vraagFn, doeFn, tijd = denktijd()) {
  const token = ++beurtToken;
  const minimaal = new Promise((ok) => setTimeout(ok, tijd));
  Promise.all([vraagFn(), minimaal])
    .then(([antwoord]) => {
      if (token !== beurtToken) return;
      if (PAUZE.has(spel.venster) || spel.scherm === 'start') uitgesteld = () => doeFn(antwoord);
      else doeFn(antwoord);
    })
    .catch((fout) => console.error('Computerspeler:', fout));
}

// Welke delen van de toestand bewaard worden (alles is gewone data, dus JSON).
const BEWAAR = ['partij', 'fase', 'handen', 'draaien', 'draaiKeuzes', 'potje', 'laatsteSlag', 'uitslag', 'verzaakReden', 'analyses', 'vergelijking'];

function teken() {
  // Niet opnieuw tekenen terwijl er in een tekstveld getypt wordt.
  const typen = document.activeElement?.matches?.('input[data-naam]');
  if (!typen) render(document.getElementById('app'), spel, acties);
  spel.nieuweKaart = null; // volgende keer tekenen: niet opnieuw animeren
  // Opslaan pas na een animatie, zodat een vliegende kaart niet hapert.
  bewaarLater();
}

function bewaarLater() {
  clearTimeout(bewaarTimer);
  if (spel.partij) bewaarTimer = setTimeout(bewaarNu, 400);
}

let bewaarTimer = null;
function bewaarNu() {
  clearTimeout(bewaarTimer);
  if (spel.partij) bewaarPartij(Object.fromEntries(BEWAAR.map((k) => [k, spel[k]])));
}
// App gaat naar de achtergrond of sluit: meteen opslaan.
addEventListener('pagehide', bewaarNu);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') bewaarNu(); });

// Regels-instellingen voor een (nieuwe) partij.
function regelInstellingen() {
  const i = spel.instellingen;
  return { systeem: i.systeem, rondesVoorOpnieuwDelen: i.rondesVoorOpnieuwDelen, verzaakbescherming: i.verzaakbescherming, troefkeuze: i.troefkeuze };
}

function nieuwePartij() {
  spel.partij = R.nieuwePartij({ instellingen: regelInstellingen(), eersteDeler: Math.floor(Math.random() * 4) });
  spel.laatsteSlag = null;
  spel.venster = null;
  spel.scherm = 'tafel';
  spel.analyses = [];
  spel.vergelijking = legeVergelijking();
  analyseSessie++;
  startRonde();
}

function startRonde() {
  beurtToken++;
  // Alleen de vergelijking van het vorige en het huidige potje bewaren.
  const nr = spel.partij.potjes.length;
  spel.analyses = (spel.analyses ?? []).filter((a) => a.potje >= nr - 1);
  uitgesteld = null;
  const { handen, draaien } = R.deelRonde(spel.partij);
  spel.handen = handen;
  spel.draaien = draaien;
  spel.draaiKeuzes = {};
  spel.potje = null;
  spel.getoondeSlag = null;
  spel.roemMelding = null;
  spel.uitslag = null;
  spel.gekozen = null;
  spel.laatsteSlag = null;
  spel.draaiMelding = null;
  schudEnDeel(beurtToken);
}

const wacht = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Eerst schudden (geluid, de stapel ligt in het midden), daarna delen in pakjes van 3-2-3
// rond de tafel, links van de deler beginnend: elk pakje vliegt naar zijn speler, met een tikje.
async function schudEnDeel(token) {
  spel.fase = 'delen';
  spel.zichtbaar = [0, 0, 0, 0];
  teken();
  if (!snel) {
    await geluid.gereed();
    const duur = geluid.schudden();
    spel.schudt = true;
    teken();
    await wacht(duur ? duur * 1000 - 150 : 700);
    spel.schudt = false;
    for (const [ronde, aantal] of [3, 2, 3].entries()) {
      for (let n = 1; n <= 4; n++) {
        if (token !== beurtToken) return;
        const speler = (spel.partij.deler + n) % 4;
        vliegPakje(speler);
        geluid.deelTik();
        await wacht(110);
        spel.zichtbaar[speler] += aantal;
        teken();
        await wacht(40);
      }
      if (ronde < 2) await wacht(120);
    }
    await wacht(200);
  }
  if (token !== beurtToken) return;
  spel.zichtbaar = null;
  spel.fase = 'draaien';
  if (spel.draaien.kaart) {
    spel.nieuweKaart = R.kaartId(spel.draaien.kaart);
    geluid.kaartNeer();
  }
  volgende();
}

// Een pakje kaartruggen vliegt van de stapel in het midden naar de plek van de speler.
function vliegPakje(speler) {
  const van = document.querySelector('.stapel-delen');
  const doelSel = speler === JIJ ? '.hand' : `.speler.${['zuid', 'west', 'noord', 'oost'][speler]} .ruggen`;
  const naar = document.querySelector(doelSel);
  if (!van || !naar) return;
  const a = van.getBoundingClientRect();
  const b = naar.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'vliegend';
  el.innerHTML = van.querySelector('.kaart.rug')?.outerHTML ?? '';
  el.style.left = `${a.left}px`;
  el.style.top = `${a.top}px`;
  el.style.width = `${a.width}px`;
  el.style.height = `${a.height}px`;
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const schaal = speler === JIJ ? 0.9 : 0.35;
  const draai = (Math.random() - 0.5) * 30;
  el.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${schaal}) rotate(${draai}deg)`, opacity: 0.9 },
    ],
    { duration: 220, easing: 'cubic-bezier(.3,.7,.4,1)' },
  ).onfinish = () => el.remove();
}

function volgende() {
  teken();
  if (spel.fase === 'draaien' && spel.draaien.verplicht && !spel.draaien.uitkomst && spel.draaien.beurt !== JIJ) {
    // Verplicht spelen: de voorhand kiest zelf troef.
    const s = spel.draaien.beurt;
    computerZet(
      () => vraagVerplicht(spel.handen[s], { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }, spel.instellingen.niveau),
      (kleur) => kiesTroef(s, kleur),
      denktijdDraai(),
    );
  } else if (spel.fase === 'draaien' && !spel.draaien.uitkomst && !spel.draaiMelding && spel.draaien.beurt !== JIJ) {
    const s = spel.draaien.beurt;
    const d = spel.draaien;
    computerZet(
      () => vraagDraai(spel.handen[s], d.kaart.kleur, { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }, spel.instellingen.niveau),
      (keuze) => draai(s, keuze),
      denktijdDraai(),
    );
  } else if (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt !== JIJ) {
    const s = spel.potje.beurt;
    computerZet(() => vraagKaart(spel.potje, s, spel.instellingen.niveau), (kaart) => speel(s, kaart));
  }
}

function kiesTroef(speler, kleur) {
  spel.draaien = R.kiesTroef(spel.draaien, speler, kleur);
  const u = spel.draaien.uitkomst;
  spel.draaiMelding = { soort: 'speelt', speler, kleur: u.troef };
  teken();
  later(() => {
    spel.draaiMelding = null;
    begin(u);
  }, AANKONDIGING);
}

function draai(speler, keuze) {
  const vorigeKaart = spel.draaien.kaart;
  spel.draaien = R.beslis(spel.draaien, speler, keuze);
  spel.draaiKeuzes[speler] = keuze;
  const u = spel.draaien.uitkomst;

  if (u?.soort === 'spelen') {
    // Eerst duidelijk aankondigen wie speelt, dan pas het potje beginnen.
    spel.draaiMelding = { soort: 'speelt', speler, kleur: u.troef };
    teken();
    later(() => {
      spel.draaiMelding = null;
      begin(u);
    }, AANKONDIGING);
  } else if (u?.soort === 'opnieuwDelen') {
    spel.fase = 'opnieuwDelen';
    teken();
    later(() => {
      spel.partij = R.naOpnieuwDelen(spel.partij);
      startRonde();
    }, MELDING_TIJD);
  } else {
    if (spel.draaien.kaart !== vorigeKaart) {
      // Iedereen paste: dat eerst laten zien (met de oude kleur), dan de nieuwe kleur.
      spel.draaiMelding = { soort: 'iedereenPast', kleur: vorigeKaart.kleur };
      teken();
      later(() => {
        spel.draaiMelding = null;
        spel.draaiKeuzes = {};
        spel.nieuweKaart = R.kaartId(spel.draaien.kaart);
        geluid.kaartNeer();
        volgende();
      }, IEDEREEN_PAST);
      return;
    }
    volgende();
  }
}

function begin(uitkomst) {
  spel.potje = R.startPotje(spel.partij, spel.handen, uitkomst);
  spel.fase = 'spelen';
  volgende();
}

// ---------- Vergelijk met de computer ----------
let analyseSessie = 0; // een nieuwe partij negeert antwoorden die nog onderweg waren

function vergelijkAan() {
  return spel.instellingen.vergelijk && spel.partij;
}

function verwerkAnalyse(sessie, a) {
  if (sessie !== analyseSessie) return;
  spel.analyseBezig = Math.max(0, spel.analyseBezig - 1);
  if (a) {
    if (a.soort === 'kaart') {
      spel.statistiek = telVergelijk(spel.statistiek, a.oordeel, spel.potje?.systeem ?? spel.partij?.instellingen.systeem);
      bewaarStatistiek(spel.statistiek);
    }
    spel.analyses = [...(spel.analyses ?? []), a];
    spel.vergelijking = telOp(spel.vergelijking ?? legeVergelijking(), a);
  }
  if (spel.scherm === 'tafel' && ['potjeKlaar', 'partijKlaar'].includes(spel.fase)) teken();
  else bewaarLater();
}

function vergelijkKaart(voor, kaart) {
  if (!vergelijkAan()) return;
  const geldig = R.geldigVoor(voor, JIJ);
  if (geldig.length < 2 || !geldig.some((k) => R.zelfdeKaart(k, kaart))) return;
  const sessie = analyseSessie;
  const basis = { soort: 'kaart', potje: spel.partij.potjes.length, slag: voor.slagen.length, kaart };
  spel.analyseBezig++;
  analyseerKaart(voor, JIJ)
    .then((r) => verwerkAnalyse(sessie, { ...basis, computer: r.kaart, ...beoordeelKaart(r.scores, r.kaart, kaart) }))
    .catch(() => verwerkAnalyse(sessie, null));
}

function vergelijkDraai(keuze) {
  if (!vergelijkAan()) return;
  const d = spel.draaien;
  const sessie = analyseSessie;
  const basis = { soort: 'draai', potje: spel.partij.potjes.length, kleur: d.kaart.kleur, jij: keuze };
  spel.analyseBezig++;
  analyseerDraai(spel.handen[JIJ], d.kaart.kleur, { speler: JIJ, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem })
    .then((computer) => verwerkAnalyse(sessie, { ...basis, computer }))
    .catch(() => verwerkAnalyse(sessie, null));
}

function vergelijkTroef(kleur) {
  if (!vergelijkAan()) return;
  const sessie = analyseSessie;
  const basis = { soort: 'troef', potje: spel.partij.potjes.length, jij: kleur };
  spel.analyseBezig++;
  analyseerVerplicht(spel.handen[JIJ], { speler: JIJ, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem })
    .then((computer) => verwerkAnalyse(sessie, { ...basis, computer }))
    .catch(() => verwerkAnalyse(sessie, null));
}

function speel(speler, kaart) {
  const voor = spel.potje;
  if (speler === JIJ) vergelijkKaart(voor, kaart);
  spel.verzaakReden = R.geldigMetReden(voor.handen[speler], voor.slag, voor.troef, voor.systeem);
  spel.potje = R.speelKaart(voor, speler, kaart);
  spel.nieuweKaart = R.kaartId(kaart);
  geluid.kaartNeer();
  spel.gekozen = null;

  if (spel.potje.verzaking) {
    spel.getoondeSlag = spel.potje.slag;
    eindPotje();
    return;
  }

  if (spel.potje.slagen.length > voor.slagen.length) {
    const slag = spel.potje.slagen.at(-1);
    spel.getoondeSlag = slag.kaarten;
    spel.roemMelding = slag.roem.totaal > 0 ? slag.roem : null;
    teken();
    later(() => {
      spel.laatsteSlag = slag;
      spel.getoondeSlag = null;
      spel.roemMelding = null;
      if (spel.potje.klaar) eindPotje();
      else volgende();
    }, SLAG_PAUZE + (spel.roemMelding ? 400 : 0));
    return;
  }
  volgende();
}

function eindPotje() {
  spel.uitslag = R.uitslag(spel.potje);
  spel.partij = R.rondPotjeAf(spel.partij, spel.potje);
  spel.fase = R.partijKlaar(spel.partij) ? 'partijKlaar' : 'potjeKlaar';
  spel.statistiek = telPotje(spel.statistiek, spel.uitslag, spel.potje.spelendTeam, spel.potje.systeem);
  if (spel.fase === 'partijKlaar') spel.statistiek = telPartij(spel.statistiek, spel.partij.totaal, spel.partij.instellingen.systeem);
  bewaarStatistiek(spel.statistiek);
  teken();
}

const acties = {
  kiesTroef(kleur) {
    if (spel.fase === 'draaien' && spel.draaien.verplicht && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst && R.KLEUREN.includes(kleur)) {
      vergelijkTroef(kleur);
      kiesTroef(JIJ, kleur);
    }
  },
  draai(keuze) {
    if (spel.fase === 'draaien' && !spel.draaien.verplicht && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst && !spel.draaiMelding) {
      vergelijkDraai(keuze);
      draai(JIJ, keuze);
    }
  },
  tikKaart(id) {
    if (spel.venster || spel.fase !== 'spelen' || spel.getoondeSlag || spel.potje.beurt !== JIJ) return;
    const hand = spel.potje.handen[JIJ];
    const kaart = hand.find((k) => R.kaartId(k) === id);
    if (!kaart) return;
    const mag = R.geldigVoor(spel.potje, JIJ).some((k) => R.kaartId(k) === id);
    if (!mag && spel.potje.verzaakbescherming) {
      // Mag niet: de kaart schudt kort (geen uitleg, geen grijze kaarten).
      document.querySelector(`.hand [data-kaart="${id}"]`)?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
        { duration: 260 },
      );
      return;
    }
    if (spel.gekozen === id) speel(JIJ, kaart);
    else {
      spel.gekozen = id;
      teken();
    }
  },
  volgendPotje() {
    if (spel.fase === 'potjeKlaar') startRonde();
  },
  nieuwePartij() {
    nieuwePartij();
  },
  // Beginscherm
  nieuwePartijVraag() {
    if (heeftLopendePartij()) acties.open('nieuwBevestig');
    else nieuwePartij();
  },
  verderSpelen() {
    spel.venster = null;
    if (spel.partij) {
      spel.scherm = 'tafel';
      teken();
      if (uitgesteld) {
        const f = uitgesteld;
        uitgesteld = null;
        f();
      }
    } else if (!hervat()) nieuwePartij();
  },
  statSysteem(systeem) {
    if (['amsterdams', 'rotterdams'].includes(systeem)) spel.statSysteem = systeem;
    teken();
  },
  wisStatistiek() {
    // Twee tikken: de eerste vraagt om bevestiging.
    if (!spel.wisVraag) {
      spel.wisVraag = true;
    } else {
      spel.statistiek = legeStatistiek();
      bewaarStatistiek(spel.statistiek);
      spel.wisVraag = false;
    }
    teken();
  },
  naarStart() {
    spel.scherm = 'start';
    spel.venster = null;
    spel.gekozen = null;
    teken();
  },
  open(naam) {
    spel.venster = naam;
    teken();
  },
  sluit() {
    spel.venster = null;
    spel.wisVraag = false;
    teken();
    if (uitgesteld) {
      const f = uitgesteld;
      uitgesteld = null;
      f();
    }
  },
  // Een instelling wijzigen. Systeem en aantal rondes gelden vanaf het volgende potje,
  // verzaakbescherming, niveau, geluid en namen meteen.
  instelling(sleutel, waarde) {
    const i = { ...spel.instellingen };
    if (sleutel === 'systeem' && ['amsterdams', 'rotterdams'].includes(waarde)) i.systeem = waarde;
    else if (sleutel === 'rondes' && ['2', '3'].includes(String(waarde))) i.rondesVoorOpnieuwDelen = Number(waarde);
    else if (sleutel === 'verzaakbescherming') i.verzaakbescherming = waarde === true || waarde === 'aan';
    else if (sleutel === 'niveau' && ['makkelijk', 'normaal', 'sterk'].includes(waarde)) i.niveau = waarde;
    else if (sleutel === 'geluid') i.geluid = waarde === true || waarde === 'aan';
    else if (sleutel === 'vergelijk') i.vergelijk = waarde === true || waarde === 'aan';
    else if (sleutel === 'gespeeld') i.gespeeld = waarde === true || waarde === 'aan';
    else if (sleutel === 'troefkeuze' && ['traditioneel', 'verplicht'].includes(waarde)) i.troefkeuze = waarde;
    else return;
    spel.instellingen = i;
    geluid.zetGeluid(i.geluid);
    bewaarInstellingen(i);
    if (spel.partij) spel.partij = { ...spel.partij, instellingen: { ...spel.partij.instellingen, ...regelInstellingen() } };
    if (spel.potje && sleutel === 'verzaakbescherming') spel.potje = { ...spel.potje, verzaakbescherming: i.verzaakbescherming };
    teken();
  },
  naam(index, tekst) {
    if (![1, 2, 3].includes(index)) return;
    const namen = [...spel.instellingen.namen];
    const schoon = String(tekst).trim().slice(0, 16);
    namen[index] = schoon || ['Zuid', 'West', 'Noord', 'Oost'][index];
    spel.instellingen = { ...spel.instellingen, namen };
    bewaarInstellingen(spel.instellingen);
    teken();
  },
};

function heeftLopendePartij() {
  if (spel.partij) return spel.fase !== 'partijKlaar';
  return Boolean(spel.bewaard);
}

// Samenvatting van een bewaarde, nog niet afgelopen partij (of null).
function bewaardeSamenvatting() {
  const b = laadPartij();
  if (!b?.partij || !b.fase || b.fase === 'partijKlaar') return null;
  return { potje: R.potjeNummer(b.partij), totaal: b.partij.totaal };
}

// Een bewaarde partij hervatten. Geeft false als er niets (bruikbaars) bewaard is.
function hervat() {
  const bewaard = laadPartij();
  if (!bewaard?.partij || !bewaard.fase) return false;
  spel.scherm = 'tafel';
  try {
    for (const k of BEWAAR) spel[k] = bewaard[k] ?? null;
    spel.draaiKeuzes ??= {};
    spel.analyses ??= [];
    spel.vergelijking ??= legeVergelijking();
    spel.analyseBezig = 0;
    analyseSessie++;
    spel.venster = null;
    spel.gekozen = null;
    spel.getoondeSlag = null;
    spel.roemMelding = null;
    if (spel.potje && !spel.laatsteSlag) spel.laatsteSlag = spel.potje.slagen.at(-1) ?? null;
    switch (spel.fase) {
      case 'opnieuwDelen':
        spel.partij = R.naOpnieuwDelen(spel.partij);
        startRonde();
        break;
      case 'spelen':
        if (spel.potje.klaar) eindPotje();
        else volgende();
        break;
      case 'delen':
      case 'draaien':
        spel.fase = 'draaien';
        spel.zichtbaar = null;
        spel.draaiMelding = null;
        if (spel.draaien.uitkomst?.soort === 'spelen') begin(spel.draaien.uitkomst);
        else if (spel.draaien.uitkomst?.soort === 'opnieuwDelen') {
          spel.partij = R.naOpnieuwDelen(spel.partij);
          startRonde();
        } else volgende();
        break;
      case 'potjeKlaar':
      case 'partijKlaar':
        teken();
        break;
      default:
        return false;
    }
    return true;
  } catch (fout) {
    console.error('Bewaarde partij kon niet worden hervat:', fout);
    return false;
  }
}

geluid.zetGeluid(spel.instellingen.geluid);

// Plaatjes van heer, vrouw en boer vooraf laden en decoderen; ze worden op canvas getekend.
laadPlaatjes(new URL('../../assets/kaarten/', import.meta.url));

// Geluid mag pas na een eerste aanraking.
window.addEventListener('pointerdown', geluid.ontgrendel, { once: false, passive: true });

// Voor automatische tests en foutzoeken.
window.klaverjas = { spel, acties, regels: R };

// Beginscherm tonen; de partij gaat pas verder na "Verder spelen".
spel.bewaard = bewaardeSamenvatting();
teken();

// Offline spelen en installeren op het startscherm.
if ('serviceWorker' in navigator && !snel) {
  navigator.serviceWorker.register('./klaverjas-sw.js').catch((fout) => console.warn('Service worker:', fout));
}
