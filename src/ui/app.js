// Spelverloop: koppelt de spelregels aan het scherm en de computerspelers.

import * as R from '../regels/index.js';
import { vraagKaart, vraagDraai } from '../ai/client.js';
import { render } from './tafel.js';
import * as geluid from './geluid.js';

const snel = new URLSearchParams(location.search).has('snel'); // voor automatische tests
// Computerspelers "denken" zichtbaar 0,5 tot 1 seconde (ook als het rekenen sneller gaat).
const denktijd = () => (snel ? 0 : 500 + Math.random() * 450);
const NIVEAU = 'normaal'; // wordt een instelling in fase 6
const SLAG_PAUZE = snel ? 0 : 1400;
const MELDING_TIJD = snel ? 0 : 1800;

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
  // Namen van de spelers. Standaard windrichtingen; zelf namen kiezen wordt een instelling (fase 6).
  namen: ['Zuid', 'West', 'Noord', 'Oost'],
  nieuweKaart: null, // kaartId die net op tafel kwam (alleen die krijgt de animatie)
  roemMelding: null,
  uitslag: null,
};

let timer = null;
let beurtToken = 0; // voorkomt dat een oud AI-antwoord in een nieuwe situatie wordt toegepast
function later(fn, ms) {
  clearTimeout(timer);
  timer = setTimeout(fn, ms);
}

// Laat een computerspeler rekenen en wacht daarnaast minstens de denktijd.
function computerZet(vraagFn, doeFn) {
  const token = ++beurtToken;
  const minimaal = new Promise((ok) => setTimeout(ok, denktijd()));
  Promise.all([vraagFn(), minimaal])
    .then(([antwoord]) => {
      if (token === beurtToken) doeFn(antwoord);
    })
    .catch((fout) => console.error('Computerspeler:', fout));
}

function teken() {
  render(document.getElementById('app'), spel, acties);
  spel.nieuweKaart = null; // volgende keer tekenen: niet opnieuw animeren
}

function nieuwePartij() {
  spel.partij = R.nieuwePartij({ eersteDeler: Math.floor(Math.random() * 4) });
  spel.laatsteSlag = null;
  spel.venster = null;
  startRonde();
}

function startRonde() {
  beurtToken++;
  const { handen, draaien } = R.deelRonde(spel.partij);
  spel.handen = handen;
  spel.draaien = draaien;
  spel.draaiKeuzes = {};
  spel.nieuweKaart = R.kaartId(draaien.kaart);
  spel.potje = null;
  geluid.schudden();
  spel.uitslag = null;
  spel.gekozen = null;
  spel.laatsteSlag = null;
  spel.fase = 'draaien';
  volgende();
}

function volgende() {
  teken();
  if (spel.fase === 'draaien' && spel.draaien.beurt !== JIJ) {
    const s = spel.draaien.beurt;
    const d = spel.draaien;
    computerZet(
      () => vraagDraai(spel.handen[s], d.kaart.kleur, { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }),
      (keuze) => draai(s, keuze),
    );
  } else if (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt !== JIJ) {
    const s = spel.potje.beurt;
    computerZet(() => vraagKaart(spel.potje, s, NIVEAU), (kaart) => speel(s, kaart));
  }
}

function draai(speler, keuze) {
  const vorigeKaart = spel.draaien.kaart;
  spel.draaien = R.beslis(spel.draaien, speler, keuze);
  spel.draaiKeuzes[speler] = keuze;
  const u = spel.draaien.uitkomst;

  if (u?.soort === 'spelen') {
    spel.potje = R.startPotje(spel.partij, spel.handen, u);
    spel.fase = 'spelen';
    volgende();
  } else if (u?.soort === 'opnieuwDelen') {
    spel.fase = 'opnieuwDelen';
    teken();
    later(() => {
      spel.partij = R.naOpnieuwDelen(spel.partij);
      startRonde();
    }, MELDING_TIJD);
  } else {
    if (spel.draaien.kaart !== vorigeKaart) {
      // Iedereen paste: even laten zien, dan de nieuwe kaart.
      teken();
      later(() => {
        spel.draaiKeuzes = {};
        spel.nieuweKaart = R.kaartId(spel.draaien.kaart);
        geluid.kaartNeer();
        volgende();
      }, snel ? 0 : 900);
      return;
    }
    volgende();
  }
}

function speel(speler, kaart) {
  const voor = spel.potje;
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
    }, SLAG_PAUZE + (spel.roemMelding ? 600 : 0));
    return;
  }
  volgende();
}

function eindPotje() {
  spel.uitslag = R.uitslag(spel.potje);
  spel.partij = R.rondPotjeAf(spel.partij, spel.potje);
  spel.fase = R.partijKlaar(spel.partij) ? 'partijKlaar' : 'potjeKlaar';
  teken();
}

const acties = {
  draai(keuze) {
    if (spel.fase === 'draaien' && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst) {
      draai(JIJ, keuze);
    }
  },
  tikKaart(id) {
    if (spel.venster || spel.fase !== 'spelen' || spel.getoondeSlag || spel.potje.beurt !== JIJ) return;
    const hand = spel.potje.handen[JIJ];
    const kaart = hand.find((k) => R.kaartId(k) === id);
    if (!kaart) return;
    const mag = R.geldigVoor(spel.potje, JIJ).some((k) => R.kaartId(k) === id);
    if (!mag && spel.potje.verzaakbescherming) return;
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
  open(naam) {
    spel.venster = naam;
    teken();
  },
  sluit() {
    spel.venster = null;
    teken();
  },
};

// Geluid mag pas na een eerste aanraking.
window.addEventListener('pointerdown', geluid.ontgrendel, { once: false, passive: true });

// Voor automatische tests en foutzoeken.
window.klaverjas = { spel, acties, regels: R };

nieuwePartij();
