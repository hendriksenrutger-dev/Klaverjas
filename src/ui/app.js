// Spelverloop: koppelt de spelregels aan het scherm en de computerspelers.

import * as R from '../regels/index.js';
import { vraagKaart, vraagDraai, vraagVerplicht, analyseerKaart, analyseerDraai, analyseerVerplicht, vraagKaartUitWaarneming } from '../ai/client.js';
import { beoordeelKaart, legeVergelijking, telOp, GELIJKWAARDIG } from '../ai/vergelijk.js';
import { render } from './tafel.js';
import * as geluid from './geluid.js';
import { laadPlaatjes } from './plaatjes.js';
import { laadInstellingen, bewaarInstellingen, laadPartij, bewaarPartij, laadStatistiek, bewaarStatistiek, laadVoortgang, bewaarVoortgang, laadLogboek, bewaarLogboek, laadOnline, bewaarOnline } from './opslag.js';
import { rpc, luister, server } from '../online/verbinding.js';
import { tafelVoor, draaiVoor } from '../online/tafel.js';
import { potjeRecord, voegToe, legLogboek, exportTekst } from './logboek.js';
import { STAPPEN, LEER_REGELS, compleetVoortgang, telLeerPotje, hintUitleg, roemUitleg, seinUitleg, draaiUitleg } from './leren.js';
import { LESSEN, beoordeel, lesKlaar, alleLessenKlaar } from './lessen.js';
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
  // Leren klaverjassen
  leren: null, // { stap } tijdens een oefenpartij, anders null
  voortgang: compleetVoortgang(laadVoortgang()),
  hulpMelding: null, // uitleg onder de tafel (hulp en hint)
  hintBezig: false,
  nieuweStap: null, // net vrijgespeelde stap, voor de uitslag
  les: null, // { nr, deel: 'uitleg'|'opdracht'|'klaar', pagina, opdracht, antwoord, uitslag }
  logboek: laadLogboek() ?? legLogboek(), // eigen partijen, om later van te leren
  draaiLog: [], // keuzes bij het draaien in het lopende potje
  partijId: null,
  tweedeKans: null, // { soort: 'draai'|'kaart', keuze, tekst, knop } als je anders kiest dan de computer
  wachtOpAdvies: false,
};

// ---------- Tweede kans (leren, stap 2 en 3) ----------
// Zodra jij aan de beurt bent, rekent de computer al mee; bij je keuze ligt het advies dan klaar.
let advies = null; // { sleutel, belofte }
function adviesVoor() {
  if (!stapInfo()?.tweedeKans) return null;
  if (spel.fase === 'spelen' && spel.potje.beurt === JIJ && !spel.getoondeSlag) {
    const p = spel.potje;
    if (advies?.sleutel !== p) advies = { sleutel: p, belofte: analyseerKaart(p, JIJ).catch(() => null) };
    return advies;
  }
  const d = spel.draaien;
  if (spel.fase === 'draaien' && !d.verplicht && d.beurt === JIJ && !d.uitkomst && !spel.draaiMelding) {
    if (advies?.sleutel !== d) {
      advies = { sleutel: d, belofte: analyseerDraai(spel.handen[JIJ], d.kaart.kleur, { speler: JIJ, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }).catch(() => null) };
    }
    return advies;
  }
  return null;
}

// Vergelijkt jouw keuze met het advies. Roept doe() aan als het goed is of als je doorzet.
let gezien = null; // { sleutel, keuze }: je zag het advies al en kiest opnieuw hetzelfde → doorgaan
const zelfdeKeuze = (a, b) => (typeof a === 'string' ? a === b : a.kleur === b.kleur && a.rang === b.rang);
function metTweedeKans(soort, keuze, doe) {
  const a = adviesVoor();
  if (!a) return doe();
  const sleutel = a.sleutel;
  if (gezien?.sleutel === sleutel && zelfdeKeuze(gezien.keuze, keuze)) return doe();
  spel.wachtOpAdvies = true;
  teken();
  a.belofte.then((r) => {
    spel.wachtOpAdvies = false;
    if (sleutel !== (soort === 'draai' ? spel.draaien : spel.potje)) return teken();
    if (!r) return doe();
    if (soort === 'draai') {
      if (r === keuze) return doe();
      gezien = { sleutel, keuze };
      spel.tweedeKans = { soort, keuze, doe, tekst: draaiUitleg(spel.handen[JIJ], spel.draaien.kaart.kleur, r), knop: keuze === 'spelen' ? 'Toch spelen' : 'Toch passen' };
      return teken();
    }
    const b = beoordeelKaart(r.scores ?? [], r.kaart, keuze);
    if (b.oordeel !== 'minder' || -b.verschil < GELIJKWAARDIG) return doe();
    const p = spel.potje;
    const uitleg = hintUitleg({ hand: p.handen[JIJ], slag: p.slag, troef: p.troef, spelendTeam: p.spelendTeam, speler: JIJ }, R.geldigVoor(p, JIJ), r.kaart);
    const naamKaart = (k) => `${{ klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' }[k.kleur]}${k.rang}`;
    gezien = { sleutel, keuze };
    spel.tweedeKans = {
      soort, keuze, doe,
      tekst: `De computer zou ${naamKaart(r.kaart)} spelen. ${uitleg} Volgens de computer levert dat gemiddeld ${-b.verschil} punten meer op dan ${naamKaart(keuze)}.`,
      knop: `Toch ${naamKaart(keuze)}`,
    };
    teken();
  });
}

const stapInfo = () => (spel.leren ? STAPPEN[spel.leren.stap] : null);
const hulpAan = () => Boolean(stapInfo()?.hulp);
const niveau = () => stapInfo()?.niveau ?? spel.instellingen.niveau;

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
const BEWAAR = ['partij', 'fase', 'handen', 'draaien', 'draaiKeuzes', 'potje', 'laatsteSlag', 'uitslag', 'verzaakReden', 'analyses', 'vergelijking', 'leren', 'draaiLog', 'partijId'];

function teken() {
  // Niet opnieuw tekenen terwijl er in een tekstveld getypt wordt.
  const typen = document.activeElement?.matches?.('input[data-naam], input[data-online]');
  if (!typen) render(document.getElementById('app'), spel.scherm === 'onlineTafel' ? onlineTafel() : spel, acties);
  spel.nieuweKaart = null; // volgende keer tekenen: niet opnieuw animeren
  if (spel.online?.lokaal && !typen) spel.online.lokaal.nieuweKaart = null; // online net zo
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
  if (spel.partij) bewaarPartij(Object.fromEntries(BEWAAR.map((k) => [k, spel[k]])), spel.leren ? 'leer' : 'gewoon');
}

// Lopende zetten en timers stoppen (bij wisselen tussen gewone partij en oefenpartij).
function stopLopend() {
  clearTimeout(timer);
  beurtToken++;
  uitgesteld = null;
}
// App gaat naar de achtergrond of sluit: meteen opslaan.
addEventListener('pagehide', bewaarNu);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') bewaarNu();
  // Terug in de app (scherm weer aan): online meteen de tafel bijwerken.
  else if (spel.online?.spel) vernieuwSpel();
});
window.addEventListener('online', () => { if (spel.online?.spel) vernieuwSpel(); });

// Regels-instellingen voor een (nieuwe) partij.
function regelInstellingen() {
  if (spel.leren) return { ...LEER_REGELS };
  const i = spel.instellingen;
  return { systeem: i.systeem, rondesVoorOpnieuwDelen: i.rondesVoorOpnieuwDelen, verzaakbescherming: i.verzaakbescherming, troefkeuze: i.troefkeuze };
}

function nieuwePartij(leren = null) {
  if (spel.partij) bewaarNu(); // de vorige (gewone of oefen-)partij eerst veilig opslaan
  stopLopend();
  spel.leren = leren;
  spel.partijId = new Date().toISOString();
  spel.hulpMelding = null;
  spel.nieuweStap = null;
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
  spel.tweedeKans = null;
  advies = null;
  spel.hulpMelding = null;
  spel.nieuweStap = null;
  // Alleen de vergelijking van het vorige en het huidige potje bewaren.
  const nr = spel.partij.potjes.length;
  spel.analyses = (spel.analyses ?? []).filter((a) => a.potje >= nr - 1);
  uitgesteld = null;
  const { handen, draaien } = R.deelRonde(spel.partij);
  spel.handen = handen;
  spel.draaien = draaien;
  spel.draaiKeuzes = {};
  spel.draaiLog = [];
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
  adviesVoor(); // tweede kans: de computer rekent alvast mee als jij aan de beurt bent
  if (spel.fase === 'draaien' && spel.draaien.verplicht && !spel.draaien.uitkomst && spel.draaien.beurt !== JIJ) {
    // Verplicht spelen: de voorhand kiest zelf troef.
    const s = spel.draaien.beurt;
    computerZet(
      () => vraagVerplicht(spel.handen[s], { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }, niveau()),
      (kleur) => kiesTroef(s, kleur),
      denktijdDraai(),
    );
  } else if (spel.fase === 'draaien' && !spel.draaien.uitkomst && !spel.draaiMelding && spel.draaien.beurt !== JIJ) {
    const s = spel.draaien.beurt;
    const d = spel.draaien;
    computerZet(
      () => vraagDraai(spel.handen[s], d.kaart.kleur, { speler: s, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }, niveau()),
      (keuze) => draai(s, keuze),
      denktijdDraai(),
    );
  } else if (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt !== JIJ) {
    const s = spel.potje.beurt;
    computerZet(() => vraagKaart(spel.potje, s, niveau()), (kaart) => speel(s, kaart));
  }
}

function kiesTroef(speler, kleur) {
  spel.draaien = R.kiesTroef(spel.draaien, speler, kleur);
  spel.draaiLog = [...(spel.draaiLog ?? []), { speler, kleur, keuze: 'verplicht' }];
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
  spel.draaiLog = [...(spel.draaiLog ?? []), { speler, kleur: vorigeKaart.kleur, keuze }];
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
  return spel.instellingen.vergelijk && spel.partij && !spel.leren;
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
  if (speler === JIJ) spel.hulpMelding = null;
  // Hulp (leren): melding als je maat seint.
  if (hulpAan() && speler === 2) {
    const sein = seinUitleg(voor.slag, 2, kaart, voor.troef, spel.namen[2]);
    if (sein) spel.hulpMelding = sein;
  }
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
    if (hulpAan() && spel.roemMelding) spel.hulpMelding = roemUitleg(slag.roem);
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
  if (spel.leren) {
    // Oefenpartij: telt niet in de statistieken, wel in de voortgang van het leerpad.
    const r = telLeerPotje(spel.voortgang, spel.leren.stap);
    spel.voortgang = r.voortgang;
    spel.nieuweStap = r.nieuweStap;
    bewaarVoortgang(spel.voortgang);
  } else {
    // Logboek: dit potje vastleggen (alleen gewone partijen).
    try {
      spel.logboek = voegToe(spel.logboek, potjeRecord({
        partijId: spel.partijId ?? 'onbekend', nr: spel.partij.potjes.length, deler: spel.potje.uitkomer === undefined ? null : (spel.potje.uitkomer + 3) % 4,
        handen: spel.handen, draaiLog: spel.draaiLog, potje: spel.potje, uitslag: spel.uitslag,
        stand: spel.partij.totaal.map((t, i) => t - spel.uitslag.totaal[i]), // stand vóór dit potje
        niveau: spel.instellingen.niveau, troefkeuze: spel.partij.instellingen.troefkeuze ?? 'traditioneel',
      }));
      bewaarLogboek(spel.logboek);
    } catch (fout) {
      console.warn('Logboek:', fout);
    }
    spel.statistiek = telPotje(spel.statistiek, spel.uitslag, spel.potje.spelendTeam, spel.potje.systeem);
    if (spel.fase === 'partijKlaar') spel.statistiek = telPartij(spel.statistiek, spel.partij.totaal, spel.partij.instellingen.systeem);
    bewaarStatistiek(spel.statistiek);
  }
  teken();
}

const acties = {
  kiesTroef(kleur) {
    if (spel.scherm === 'onlineTafel') return onlineZet({ soort: 'troef', kleur });
    if (spel.fase === 'draaien' && spel.draaien.verplicht && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst && R.KLEUREN.includes(kleur)) {
      vergelijkTroef(kleur);
      kiesTroef(JIJ, kleur);
    }
  },
  draai(keuze) {
    if (spel.scherm === 'onlineTafel') return onlineZet({ soort: 'draai', keuze });
    if (spel.wachtOpAdvies) return;
    if (spel.fase === 'draaien' && !spel.draaien.verplicht && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst && !spel.draaiMelding) {
      spel.tweedeKans = null;
      metTweedeKans('draai', keuze, () => {
        vergelijkDraai(keuze);
        draai(JIJ, keuze);
      });
    }
  },
  tweedeKansOpnieuw() {
    spel.tweedeKans = null;
    spel.gekozen = null;
    teken();
  },
  tweedeKansToch() {
    const t = spel.tweedeKans;
    if (!t) return;
    spel.tweedeKans = null;
    t.doe();
  },
  tikKaart(id) {
    if (spel.scherm === 'onlineTafel') return onlineTik(id);
    if (spel.venster || spel.fase !== 'spelen' || spel.getoondeSlag || spel.potje.beurt !== JIJ) return;
    const hand = spel.potje.handen[JIJ];
    const kaart = hand.find((k) => R.kaartId(k) === id);
    if (!kaart) return;
    const mag = R.geldigVoor(spel.potje, JIJ).some((k) => R.kaartId(k) === id);
    if (!mag && spel.potje.verzaakbescherming) {
      // Mag niet: de kaart schudt kort (geen grijze kaarten). Bij hulp (leren) ook de reden.
      if (hulpAan()) {
        const p = spel.potje;
        const g = R.geldigMetReden(hand, p.slag, p.troef, p.systeem);
        spel.hulpMelding = `${R.redenTekst(g.reden, g.gevraagd)}.`;
        teken();
      }
      document.querySelector(`.hand [data-kaart="${id}"]`)?.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
        { duration: 260 },
      );
      return;
    }
    if (spel.wachtOpAdvies) return;
    if (spel.tweedeKans) { spel.tweedeKans = null; spel.gekozen = id; return teken(); }
    if (spel.gekozen === id) metTweedeKans('kaart', kaart, () => speel(JIJ, kaart));
    else {
      spel.gekozen = id;
      teken();
    }
  },
  volgendPotje() {
    if (spel.scherm === 'onlineTafel') return onlineZet({ soort: 'volgende' });
    if (spel.fase === 'potjeKlaar') startRonde();
  },
  nieuwePartij() {
    if (spel.scherm === 'onlineTafel') return onlineStartSpel();
    nieuwePartij();
  },
  // Beginscherm
  nieuwePartijVraag() {
    if (heeftLopendePartij()) acties.open('nieuwBevestig');
    else nieuwePartij();
  },
  verderSpelen() {
    spel.venster = null;
    if (spel.partij && spel.leren) {
      // Van een oefenpartij terug naar de gewone partij.
      bewaarNu();
      stopLopend();
      spel.leren = null;
      spel.partij = null;
    }
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
  // Logboek exporteren: delen (bijv. via mail of WhatsApp) of anders downloaden.
  async exporteerLogboek() {
    const tekst = exportTekst(spel.logboek);
    const naam = `klaverjassen-logboek-${new Date().toISOString().slice(0, 10)}.json`;
    const bestand = new File([tekst], naam, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [bestand] })) {
        await navigator.share({ files: [bestand], title: 'Klaverjassen logboek' });
        return;
      }
    } catch (fout) {
      if (fout?.name === 'AbortError') return; // delen geannuleerd
    }
    const url = URL.createObjectURL(bestand);
    const a = document.createElement('a');
    a.href = url;
    a.download = naam;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
    if (spel.scherm === 'onlineTafel') { spel.scherm = 'start'; spel.venster = null; stopOnline(); return teken(); }
    bewaarNu();
    spel.scherm = 'start';
    spel.venster = null;
    spel.gekozen = null;
    spel.bewaard = bewaardeSamenvatting();
    teken();
  },
  // Leren klaverjassen: een stap starten of daarin verdergaan.
  leerStap(stap) {
    stap = Number(stap);
    if (!STAPPEN[stap] || stap > spel.voortgang.open) return;
    spel.venster = null;
    if (spel.leren?.stap === stap && spel.partij && spel.fase !== 'partijKlaar') {
      spel.scherm = 'tafel';
      teken();
      if (uitgesteld) { const f = uitgesteld; uitgesteld = null; f(); }
      return;
    }
    const bewaard = laadPartij('leer');
    if (bewaard?.leren?.stap === stap && bewaard.fase !== 'partijKlaar') {
      if (spel.partij) bewaarNu();
      stopLopend();
      if (hervat('leer')) return;
    }
    nieuwePartij({ stap });
  },
  // ---------- Lessen ----------
  startLes(nr) {
    nr = Number(nr);
    if (!LESSEN.some((l) => l.nr === nr)) return;
    bewaarNu();
    stopLopend();
    spel.les = { nr, deel: 'uitleg', pagina: 0, opdracht: 0, antwoord: null, uitslag: null };
    spel.scherm = 'les';
    spel.venster = null;
    teken();
  },
  lesVolgende() {
    const l = spel.les;
    if (!l) return;
    const les = LESSEN.find((x) => x.nr === l.nr);
    if (l.deel === 'uitleg') {
      if (l.pagina < les.uitleg.length - 1) l.pagina++;
      else Object.assign(l, { deel: 'opdracht', opdracht: 0, antwoord: null, uitslag: null });
    } else if (l.deel === 'opdracht' && l.uitslag?.goed) {
      if (l.opdracht < les.opdrachten.length - 1) Object.assign(l, { opdracht: l.opdracht + 1, antwoord: null, uitslag: null });
      else {
        l.deel = 'klaar';
        const v = lesKlaar(spel.voortgang, l.nr);
        // Alle lessen klaar: stap 2 (oefenen met open kaarten) gaat open.
        if (alleLessenKlaar(v) && v.open < 2) { v.open = 2; l.stapOpen = true; }
        spel.voortgang = v;
        bewaarVoortgang(v);
      }
    } else if (l.deel === 'klaar') {
      const volgende = LESSEN.find((x) => x.nr === l.nr + 1);
      if (volgende) return acties.startLes(volgende.nr);
      return acties.lesStop();
    }
    teken();
  },
  lesTerug() {
    const l = spel.les;
    if (l?.deel === 'uitleg' && l.pagina > 0) { l.pagina--; teken(); }
  },
  lesAntwoord(waarde) {
    const l = spel.les;
    if (!l || l.deel !== 'opdracht' || l.uitslag?.goed) return;
    const o = LESSEN.find((x) => x.nr === l.nr).opdrachten[l.opdracht];
    const antwoord = o.soort === 'keuze' ? Number(waarde) : o.hand.find((k) => R.kaartId(k) === waarde);
    if (antwoord === undefined) return;
    l.antwoord = waarde;
    l.uitslag = beoordeel(o, antwoord);
    teken();
  },
  lesStop() {
    spel.les = null;
    spel.scherm = 'start';
    spel.venster = 'lessen';
    spel.bewaard = bewaardeSamenvatting();
    teken();
  },
  // Hint: de computer stelt een kaart (of spelen/passen) voor, met uitleg uit vaste regels.
  hint() {
    if (!stapInfo()?.hint || spel.hintBezig || spel.venster) return;
    if (spel.fase === 'spelen' && spel.potje.beurt === JIJ && !spel.getoondeSlag) {
      const p = spel.potje;
      spel.hintBezig = true;
      teken();
      analyseerKaart(p, JIJ).then((r) => {
        spel.hintBezig = false;
        if (spel.potje !== p) return teken();
        const geldig = R.geldigVoor(p, JIJ);
        spel.gekozen = R.kaartId(r.kaart);
        const uitleg = hintUitleg({ hand: p.handen[JIJ], slag: p.slag, troef: p.troef, spelendTeam: p.spelendTeam, speler: JIJ }, geldig, r.kaart);
        // Dwingt een spelregel de keuze af (troeven, overtroeven …), dan die regel erbij.
        const g = R.geldigMetReden(p.handen[JIJ], p.slag, p.troef, p.systeem);
        const regel = ['uitkomen', 'bekennen', 'vrij'].includes(g.reden) || geldig.length === 1 ? '' : `${R.redenTekst(g.reden, g.gevraagd)}. `;
        spel.hulpMelding = regel + uitleg;
        teken();
      }).catch(() => { spel.hintBezig = false; teken(); });
    } else if (spel.fase === 'draaien' && !spel.draaien.verplicht && spel.draaien.beurt === JIJ && !spel.draaien.uitkomst && !spel.draaiMelding) {
      const d = spel.draaien;
      spel.hintBezig = true;
      teken();
      analyseerDraai(spel.handen[JIJ], d.kaart.kleur, { speler: JIJ, deler: spel.partij.deler, systeem: spel.partij.instellingen.systeem }).then((keuze) => {
        spel.hintBezig = false;
        if (spel.draaien !== d) return teken();
        spel.hulpMelding = keuze === 'spelen'
          ? 'Advies: spelen. Volgens de computer haal je met deze troef gemiddeld genoeg punten.'
          : 'Advies: passen. Volgens de computer is deze troef te zwak voor jouw kaarten.';
        teken();
      }).catch(() => { spel.hintBezig = false; teken(); });
    }
  },
  open(naam) {
    if (spel.scherm === 'onlineTafel') { spel.online.lokaal.venster = naam; return teken(); }
    spel.venster = naam;
    teken();
  },
  sluit() {
    if (spel.scherm === 'onlineTafel') { spel.online.lokaal.venster = null; return teken(); }
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
    if (spel.partij && !spel.leren) spel.partij = { ...spel.partij, instellingen: { ...spel.partij.instellingen, ...regelInstellingen() } };
    if (spel.potje && !spel.leren && sleutel === 'verzaakbescherming') spel.potje = { ...spel.potje, verzaakbescherming: i.verzaakbescherming };
    teken();
  },
  // ---------- Online spelen (stap 2: tafel maken, meedoen, wachtruimte) ----------
  async onlineOpen(code = '') {
    stopLopend();
    const bewaard = laadOnline();
    spel.scherm = 'online';
    spel.venster = null;
    spel.online = { naam: bewaard.naam ?? '', code: code || '', beeld: null, token: null, fout: null, bezig: false, spel: null, lokaal: {} };
    teken();
    // Zat je nog aan een tafel? Dan meteen terug naar die wachtruimte.
    if (bewaard.code && bewaard.token && (!code || code === bewaard.code)) {
      try {
        const beeld = await rpc('klaverjas_beeld', { p_code: bewaard.code, p_token: bewaard.token });
        if (beeld?.ik !== null && beeld?.ik !== undefined) {
          aanTafel(bewaard.code, bewaard.token, beeld);
          if (beeld.status === 'spelen') vernieuwSpel();
        }
      } catch {
        bewaarOnline({ apparaat: bewaard.apparaat, naam: bewaard.naam });
      }
    }
  },
  onlineVeld(veld, waarde) {
    if (!spel.online) return;
    if (veld === 'naam') spel.online.naam = String(waarde).trim().slice(0, 16);
    if (veld === 'code') spel.online.code = String(waarde).trim().toUpperCase().slice(0, 4);
  },
  async onlineMaak() {
    const o = spel.online;
    if (!o.naam) return onlineFout('Vul eerst je naam in.');
    const i = spel.instellingen;
    const regels = { systeem: i.systeem, troefkeuze: i.troefkeuze, verzaakbescherming: i.verzaakbescherming, rondesVoorOpnieuwDelen: i.rondesVoorOpnieuwDelen };
    await onlineDoe(async () => {
      const r = await rpc('klaverjas_maak', { p_naam: o.naam, p_regels: regels, p_apparaat: apparaat() });
      aanTafel(r.beeld.code, r.token, r.beeld);
    });
  },
  async onlineMeedoen() {
    const o = spel.online;
    if (!o.naam) return onlineFout('Vul eerst je naam in.');
    if (o.code.length !== 4) return onlineFout('De code bestaat uit 4 tekens.');
    await onlineDoe(async () => {
      const r = await rpc('klaverjas_meedoen', { p_code: o.code, p_naam: o.naam, p_apparaat: apparaat() });
      aanTafel(r.beeld.code, r.token, r.beeld);
    });
  },
  async onlinePlek(plek) {
    const o = spel.online;
    await onlineDoe(async () => {
      o.beeld = await rpc('klaverjas_kies_plek', { p_code: o.beeld.code, p_token: o.token, p_plek: plek });
    });
  },
  async onlineStart() {
    const o = spel.online;
    await onlineDoe(async () => {
      await onlineStartSpel();
    });
  },
  async onlineVerlaat() {
    const o = spel.online;
    try { await rpc('klaverjas_verlaat', { p_code: o.beeld.code, p_token: o.token }); } catch { /* weg is weg */ }
    weg();
    teken();
  },
  onlineTerug() {
    // De tafel blijft bestaan; via "Online spelen" kom je terug in de wachtruimte.
    stopOnline();
    spel.online = null;
    spel.scherm = 'start';
    teken();
  },
  async onlineDeel() {
    const code = spel.online?.beeld?.code;
    if (!code) return;
    const link = `${location.origin}${location.pathname}?tafel=${code}`;
    const tekst = `Kom klaverjassen! Tafel ${code}: ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Klaverjassen', text: tekst, url: link });
      else { await navigator.clipboard.writeText(link); onlineFout('De link is gekopieerd.'); }
    } catch { /* delen geannuleerd */ }
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

// ---------- Online: hulpfuncties ----------
let stopLuisteren = null;
function stopOnline() {
  stopLuisteren?.();
  stopLuisteren = null;
  for (const t of onlineTimers) clearTimeout(t);
  onlineTimers = [];
  computerBezig = null;
}
function onlineFout(tekst) {
  if (!spel.online) return;
  spel.online.fout = tekst;
  teken();
}
// Eigen kenmerk van dit apparaat, zodat het maar één keer aan dezelfde tafel kan zitten.
function apparaat() {
  const b = laadOnline();
  if (b.apparaat) return b.apparaat;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
  bewaarOnline({ ...b, apparaat: id });
  return id;
}
async function onlineDoe(f) {
  const o = spel.online;
  if (!o || o.bezig) return;
  // Toetsenbord dicht: anders blijft het scherm staan (er wordt niet getekend tijdens het typen).
  document.activeElement?.blur?.();
  o.bezig = true;
  o.fout = null;
  teken();
  try {
    await f();
  } catch (fout) {
    o.fout = fout.message;
  }
  o.bezig = false;
  teken();
}
function aanTafel(code, token, beeld) {
  const o = spel.online;
  o.code = code;
  o.token = token;
  o.beeld = beeld;
  bewaarOnline({ ...laadOnline(), naam: o.naam, code, token });
  stopOnline();
  stopLuisteren = luister(code, async (seintje) => {
    if (seintje?.weg) { weg('De maker heeft de tafel opgeheven.'); return teken(); }
    try {
      if (spel.online?.spel || spel.online?.beeld?.status === 'spelen') return vernieuwSpel();
      const nieuw = await rpc('klaverjas_beeld', { p_code: code, p_token: token });
      if (spel.online?.token !== token) return;
      if (nieuw.versie !== spel.online.beeld?.versie) { spel.online.beeld = nieuw; teken(); }
      if (nieuw.status === 'spelen') vernieuwSpel();
    } catch (fout) {
      if (/bestaat niet/.test(fout.message)) { weg('De tafel bestaat niet meer.'); teken(); }
    }
  });
  teken();
}
// ---------- Online: het spel zelf ----------
const ONLINE_SLAG_PAUZE = 1200;
const ONLINE_DRAAI_MELDING = 1800;
let onlineTimers = [];
let computerBezig = null;

function onlineTafel() {
  const o = spel.online;
  return tafelVoor(o.spel, { ...o.lokaal, instellingen: spel.instellingen });
}

async function onlineStartSpel() {
  const o = spel.online;
  const antw = await server({ actie: 'start', code: o.beeld.code, token: o.token });
  verwerkSpel(antw);
}

async function vernieuwSpel() {
  const o = spel.online;
  if (!o?.token) return;
  try {
    const antw = await server({ actie: 'zicht', code: o.beeld?.code ?? o.code, token: o.token });
    if (spel.online !== o) return;
    zetVerbinding(true);
    if (antw.zicht) verwerkSpel(antw);
  } catch (fout) {
    if (/bestaat niet|zit niet/.test(fout.message)) { weg('De tafel bestaat niet meer.'); spel.scherm = 'online'; teken(); }
    else if (/verbinding|internet|fetch/i.test(fout.message)) zetVerbinding(false);
  }
}

// Melding onder de tafel zolang de verbinding weg is. Intussen blijft de app elke 4 seconden kijken;
// na 30 seconden speelt de computer tijdelijk jouw plek, tot je er weer bent.
function zetVerbinding(goed) {
  const l = spel.online?.lokaal;
  if (!l || l.verbindingWeg === !goed) return;
  l.verbindingWeg = !goed;
  if (spel.scherm === 'onlineTafel') teken();
}

// Nieuw antwoord van de server verwerken: alleen tekenen als er iets veranderd is, en de
// overgangen zichtbaar maken (slag blijft even liggen, "Noord speelt", "Iedereen past").
function verwerkSpel(antw) {
  const o = spel.online;
  const oud = o.spel;
  if (oud?.zicht && antw.zicht.zetten === oud.zicht.zetten && antw.zicht.opnieuwGedeeld === oud.zicht.opnieuwGedeeld) {
    o.spel = antw;
    return planComputer();
  }
  o.spel = antw;
  o.lokaal ??= {};
  const l = o.lokaal;
  const z = antw.zicht;
  const zo = oud?.zicht;
  if (spel.scherm !== 'onlineTafel') { spel.scherm = 'onlineTafel'; spel.venster = null; l.venster = null; }
  l.gekozen = null;
  // Nieuwe kaart op tafel: alleen die krijgt de animatie (en een tikje).
  const nieuweSlag = zo?.potje && z.potje && z.partij.aantalPotjes === zo.partij.aantalPotjes && z.potje.slagen.length > zo.potje.slagen.length;
  const opTafel = nieuweSlag ? z.potje.slagen.at(-1).kaarten : z.potje?.slag ?? [];
  const gezien = new Set([...(zo?.potje?.slag ?? []), ...(o.lokaal.getoondeSlag ?? [])].map((x) => R.kaartId(x.kaart)));
  const nieuw = opTafel.find((x) => !gezien.has(R.kaartId(x.kaart)));
  l.nieuweKaart = nieuw ? R.kaartId(nieuw.kaart) : null;
  if (nieuw) geluid.kaartNeer();
  if (nieuweSlag) {
    l.getoondeSlag = z.potje.slagen.at(-1).kaarten;
    const roem = z.potje.slagen.at(-1).roem;
    l.roemMelding = roem?.totaal ? roem : null;
    na(ONLINE_SLAG_PAUZE, () => { l.getoondeSlag = null; l.roemMelding = null; teken(); });
  } else if (!z.potje) l.getoondeSlag = null;
  if (zo && zo.fase === 'draaien' && z.potje && z.laatsteDraai) {
    l.draaiMelding = { soort: 'speelt', speler: z.laatsteDraai.speler, kleur: z.laatsteDraai.kleur };
    na(ONLINE_DRAAI_MELDING, () => { l.draaiMelding = null; teken(); });
  }
  if (zo && z.opnieuwGedeeld > zo.opnieuwGedeeld) {
    l.opnieuwDelen = true;
    na(1500, () => { l.opnieuwDelen = false; teken(); });
  }
  teken();
  planComputer();
}

function na(ms, f) {
  onlineTimers.push(setTimeout(f, snel ? 0 : ms));
}

// De maker speelt de zetten van de computers op lege plekken en voor wie even weg is. Is de
// maker zelf weg, dan doet een andere speler het (de server bepaalt wie en stuurt dan de vraag).
function planComputer() {
  const o = spel.online;
  const vraag = o?.spel?.computer;
  if (!vraag) return;
  const sleutel = `${o.spel.zicht.zetten}-${vraag.plek}`;
  if (computerBezig === sleutel) return;
  computerBezig = sleutel;
  const niveau = spel.instellingen.niveau;
  const start = Date.now();
  const wacht = vraag.soort === 'kaart' ? denktijd() + (o.lokaal?.getoondeSlag ? ONLINE_SLAG_PAUZE : 0) : denktijdDraai() + (o.lokaal?.draaiMelding ? ONLINE_DRAAI_MELDING : 0);
  const keuze = vraag.soort === 'kaart'
    ? vraagKaartUitWaarneming(vraag.waarneming, niveau).then((kaart) => ({ soort: 'kaart', kaart }))
    : vraag.soort === 'draai'
      ? vraagDraai(vraag.hand, vraag.kleur, vraag.opties, niveau).then((keuze) => ({ soort: 'draai', keuze }))
      : vraagVerplicht(vraag.hand, vraag.opties, niveau).then((kleur) => ({ soort: 'troef', kleur }));
  keuze.then(async (zet) => {
    await new Promise((ok) => setTimeout(ok, Math.max(0, wacht - (Date.now() - start))));
    if (spel.online !== o || computerBezig !== sleutel) return;
    try {
      verwerkSpel(await server({ actie: 'zet', code: o.beeld.code, token: o.token, zet, als: vraag.plek }));
    } catch (fout) {
      console.warn('Computerzet:', fout);
      computerBezig = null;
      vernieuwSpel();
    }
  });
}

async function onlineZet(zet) {
  const o = spel.online;
  if (!o?.spel || o.bezig) return;
  o.bezig = true;
  try {
    verwerkSpel(await server({ actie: 'zet', code: o.beeld.code, token: o.token, zet }));
  } catch (fout) {
    o.lokaal.venster = null;
    if (/internet/.test(fout.message)) zetVerbinding(false);
    else alert(fout.message);
    vernieuwSpel();
  }
  o.bezig = false;
}

function onlineTik(id) {
  const o = spel.online;
  const tafel = onlineTafel();
  if (tafel.venster || tafel.fase !== 'spelen' || tafel.getoondeSlag || tafel.potje.beurt !== 0) return;
  const kaart = tafel.potje.handen[0].find((k) => R.kaartId(k) === id);
  if (!kaart) return;
  const mag = R.geldigVoor(tafel.potje, 0).some((k) => R.kaartId(k) === id);
  if (!mag && tafel.potje.verzaakbescherming) {
    document.querySelector(`.hand [data-kaart="${id}"]`)?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
      { duration: 260 },
    );
    return;
  }
  if (o.lokaal.gekozen === id) { o.lokaal.gekozen = null; return onlineZet({ soort: 'kaart', kaart }); }
  o.lokaal.gekozen = id;
  teken();
}

function weg(melding = null) {
  stopOnline();
  const o = spel.online;
  bewaarOnline({ apparaat: laadOnline().apparaat, naam: o?.naam ?? '' });
  if (o) { o.beeld = null; o.token = null; o.fout = melding; }
}

function heeftLopendePartij() {
  if (spel.partij && !spel.leren) return spel.fase !== 'partijKlaar';
  return Boolean(spel.bewaard);
}

// Samenvatting van een bewaarde, nog niet afgelopen partij (of null).
function bewaardeSamenvatting() {
  const b = laadPartij();
  if (!b?.partij || !b.fase || b.fase === 'partijKlaar') return null;
  return { potje: R.potjeNummer(b.partij), totaal: b.partij.totaal };
}

// Een bewaarde partij hervatten. Geeft false als er niets (bruikbaars) bewaard is.
function hervat(soort = 'gewoon') {
  const bewaard = laadPartij(soort);
  if (!bewaard?.partij || !bewaard.fase) return false;
  stopLopend();
  spel.hulpMelding = null;
  spel.nieuweStap = null;
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

// Geopend via een uitnodigingslink (?tafel=ABCD): meteen naar online spelen.
const uitnodiging = new URLSearchParams(location.search).get('tafel');
if (uitnodiging) acties.onlineOpen(uitnodiging.toUpperCase().slice(0, 4));

// Offline spelen en installeren op het startscherm.
if ('serviceWorker' in navigator && !snel) {
  navigator.serviceWorker.register('./klaverjas-sw.js').catch((fout) => console.warn('Service worker:', fout));
}
