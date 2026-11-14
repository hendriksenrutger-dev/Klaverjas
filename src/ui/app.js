// Spelverloop: koppelt de spelregels aan het scherm en de computerspelers.

import * as R from '../regels/index.js';
import { vraagKaart, vraagDraai } from '../ai/client.js';
import { render } from './tafel.js';
import * as geluid from './geluid.js';
import { laadInstellingen, bewaarInstellingen, laadPartij, bewaarPartij } from './opslag.js';

const snel = new URLSearchParams(location.search).has('snel'); // voor automatische tests
// Computerspelers "denken" zichtbaar 0,5 tot 1 seconde (ook als het rekenen sneller gaat).
const denktijd = () => (snel ? 0 : 350 + Math.random() * 300);
const SLAG_PAUZE = snel ? 0 : 1000;
const MELDING_TIJD = snel ? 0 : 1500;

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
function computerZet(vraagFn, doeFn) {
  const token = ++beurtToken;
  const minimaal = new Promise((ok) => setTimeout(ok, denktijd()));
  Promise.all([vraagFn(), minimaal])
    .then(([antwoord]) => {
      if (token !== beurtToken) return;
      if (PAUZE.has(spel.venster) || spel.scherm === 'start') uitgesteld = () => doeFn(antwoord);
      else doeFn(antwoord);
    })
    .catch((fout) => console.error('Computerspeler:', fout));
}

// Welke delen van de toestand bewaard worden (alles is gewone data, dus JSON).
const BEWAAR = ['partij', 'fase', 'handen', 'draaien', 'draaiKeuzes', 'potje', 'laatsteSlag', 'uitslag', 'verzaakReden'];

function teken() {
  // Niet opnieuw tekenen terwijl er in een tekstveld getypt wordt.
  const typen = document.activeElement?.matches?.('input[data-naam]');
  if (!typen) render(document.getElementById('app'), spel, acties);
  spel.nieuweKaart = null; // volgende keer tekenen: niet opnieuw animeren
  if (spel.partij) bewaarPartij(Object.fromEntries(BEWAAR.map((k) => [k, spel[k]])));
}

// Regels-instellingen voor een (nieuwe) partij.
function regelInstellingen() {
  const i = spel.instellingen;
  return { systeem: i.systeem, rondesVoorOpnieuwDelen: i.rondesVoorOpnieuwDelen, verzaakbescherming: i.verzaakbescherming };
}

function nieuwePartij() {
  spel.partij = R.nieuwePartij({ instellingen: regelInstellingen(), eersteDeler: Math.floor(Math.random() * 4) });
  spel.laatsteSlag = null;
  spel.venster = null;
  spel.scherm = 'tafel';
  startRonde();
}

function startRonde() {
  beurtToken++;
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
  spel.nieuweKaart = R.kaartId(spel.draaien.kaart);
  geluid.kaartNeer();
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
  if (spel.fase === 'draaien' && spel.draaien.beurt !== JIJ) {
    const s = spel.draaien.beurt;
    const d = spel.draaien;
    computerZet(
      () => vraagDraai(spel.handen[s], d.kaart.kleur, { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }, spel.instellingen.niveau),
      (keuze) => draai(s, keuze),
    );
  } else if (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt !== JIJ) {
    const s = spel.potje.beurt;
    computerZet(() => vraagKaart(spel.potje, s, spel.instellingen.niveau), (kaart) => speel(s, kaart));
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
      }, snel ? 0 : 600);
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
    }, SLAG_PAUZE + (spel.roemMelding ? 400 : 0));
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
        volgende();
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

// Plaatjes van heer, vrouw en boer vooraf laden en decoderen, zodat een gespeelde kaart
// meteen met tekening verschijnt (niet eerst even wit).
const plaatjes = [];
for (const kleur of R.KLEUREN) {
  for (const rang of ['H', 'V', 'B']) {
    const img = new Image();
    img.src = new URL(`../../assets/kaarten/${kleur}-${rang}.webp`, import.meta.url).href;
    img.decode?.().catch(() => {});
    plaatjes.push(img);
  }
}

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
