// Tekent de speeltafel volgens het ontwerp.

import { kaartId, team } from '../regels/kaarten.js';
import { stand } from '../regels/potje.js';
import { redenTekst } from '../regels/geldig.js';
import { AANTAL_POTJES, potjeNummer } from '../regels/partij.js';
import { kaartHtml, rugHtml, symbool, symboolSprite, kaartNaam, ROOD, SYMBOOL } from './kaart.js';
import { patchHtml } from './patch.js';
import { vulPlaatjes } from './plaatjes.js';

const KLEURNAAM = { klaveren: 'Klaveren', ruiten: 'Ruiten', harten: 'Harten', schoppen: 'Schoppen' };
const PLEKKEN = [
  { rol: '', plek: 'zuid', klasse: 'jij' },
  { rol: 'Tegenstander', plek: 'west', klasse: '' },
  { rol: 'Jouw maat · computer', plek: 'noord', klasse: 'maat' },
  { rol: 'Tegenstander', plek: 'oost', klasse: '' },
];
// Naam zoals hij in zinnen verschijnt: speler 0 is altijd "Jij".
let NAMEN = ['Zuid', 'West', 'Noord', 'Oost'];
const naam = (i) => (i === 0 ? 'Jij' : NAMEN[i]);
const IKOON = {
  huis: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  tandwiel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/><circle cx="12" cy="12" r="6.6"/></svg>',
  terug: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
  lijst: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/></svg>',
};


// ---------- Bovenbalk ----------
function balk(spel) {
  const { partij, potje, draaien } = spel;
  let troef;
  if (potje) {
    const wie = potje.spelendTeam === 0 ? 'wij spelen' : 'zij spelen';
    troef = `<div class="troeflabel"><span class="troefrond ${ROOD.has(potje.troef) ? 'rood' : ''}">${symbool(potje.troef)}</span>Troef · ${KLEURNAAM[potje.troef]} <span class="licht">· ${wie}</span></div>`;
  } else if (draaien) {
    troef = `<div class="troeflabel stil">${spel.fase === 'delen' ? 'Schudden en delen…' : 'Troef bepalen…'}</div>`;
  } else troef = '';
  const nr = Math.min(potjeNummer(partij), AANTAL_POTJES);
  return `<header class="balk">
    <div class="balk-links"><button class="knop ikoon" data-actie="naarStart" aria-label="Beginscherm">${IKOON.huis}</button></div>
    <div class="score">
      <div class="score-team wij"><span class="score-label">Wij</span><span class="score-getal">${partij.totaal[0]}</span></div>
      <div class="potjenr">${nr} / ${AANTAL_POTJES}</div>
      <div class="score-team zij"><span class="score-getal">${partij.totaal[1]}</span><span class="score-label">Zij</span></div>
    </div>
    <div class="balk-rechts">${troef}<button class="knop ikoon" data-actie="open" data-venster="instellingen" aria-label="Instellingen">${IKOON.tandwiel}</button></div>
  </header>`;
}

function ditPotje(spel) {
  if (!spel.potje) return '';
  const { punten, roem } = stand(spel.potje);
  return `<section class="dit-potje"><h3>Dit potje</h3>
    <table><tr><th></th><th>Punten</th><th>Roem</th></tr>
    <tr class="wij"><td>Wij</td><td>${punten[0]}</td><td>${roem[0]}</td></tr>
    <tr><td>Zij</td><td>${punten[1]}</td><td>${roem[1]}</td></tr></table>
  </section>`;
}

// ---------- Spelers ----------
function spelerHtml(spel, i) {
  const s = PLEKKEN[i];
  const n = NAMEN[i];
  const speelt = spel.draaien?.uitkomst?.soort === 'spelen' && spel.draaien.uitkomst.speler === i;
  const aanBeurt =
    (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt === i) ||
    (spel.fase === 'draaien' && !spel.draaien.uitkomst && !spel.draaiMelding && spel.draaien.beurt === i);
  const labels = [];
  if (speelt) labels.push('<span class="label speelt">Speelt</span>');

  if (spel.fase === 'draaien' || spel.fase === 'opnieuwDelen' || spel.fase === 'delen') {
    if (spel.partij.deler === i) labels.push('<span class="label deelt">Deelt</span>');
  }
  const aantal = spel.fase === 'delen' ? spel.zichtbaar?.[i] ?? 0
    : spel.potje ? spel.potje.handen[i].length : spel.handen?.[i]?.length ?? 0;
  const ruggen = i === 0 ? '' : `<div class="ruggen">${rugHtml().repeat(aantal)}</div>`;
  return `<div class="speler ${s.plek} ${s.klasse} ${aanBeurt ? 'aan-beurt' : ''}">
    <div class="avatar">${n.charAt(0).toUpperCase()}</div>
    <div class="speler-tekst">
      <div class="naam">${n}${labels.join('')}</div>
      ${aanBeurt && i !== 0 && spel.fase === 'spelen'
        ? '<div class="rol denkt">denkt na<span class="puntjes"><i>.</i><i>.</i><i>.</i></span></div>'
        : s.rol ? `<div class="rol">${s.rol}</div>` : ''}
      ${ruggen}
    </div>
  </div>`;
}

// ---------- Midden van de tafel ----------
function midden(spel) {
  if (spel.fase === 'delen') {
    return `<div class="midden"><div class="delen-midden"><div class="stapel stapel-delen ${spel.schudt ? 'schudt' : ''}">${rugHtml()}${rugHtml()}${rugHtml()}</div></div></div>`;
  }
  if (spel.fase === 'draaien' || spel.fase === 'opnieuwDelen') {
    const d = spel.draaien;
    const m = spel.draaiMelding;
    const jij = spel.fase === 'draaien' && d.beurt === 0 && !d.uitkomst && !m;
    const kleur = m?.kleur ?? d.kaart.kleur;
    const sym = (k) => `<span class="bubbel-sym ${ROOD.has(k) ? 'rood' : ''}">${symbool(k)}</span>`;
    // Midden: alleen de voorgestelde kleur, groot, in een rond schijfje.
    const schijf = `<div class="troef-schijf ${ROOD.has(kleur) ? 'rood' : ''} ${m?.soort === 'speelt' ? 'gekozen' : ''} ${m?.soort === 'iedereenPast' || spel.fase === 'opnieuwDelen' ? 'gepast' : ''}" data-sleutel="schijf-${kleur}">${symbool(kleur)}</div>`;
    // Op de plek van elke speler zijn keuze, als tekstballon die even ploft.
    const bubbels = PLEKKEN.map((pl, i) => {
      let inhoud = null;
      let soort = '';
      if (m?.soort === 'speelt' && m.speler === i) { soort = 'speelt'; inhoud = `Ik speel ${sym(kleur)}`; }
      else if (spel.draaiKeuzes[i] === 'passen') { soort = 'past'; inhoud = 'Ik pas'; }
      else if (i !== 0 && spel.fase === 'draaien' && !d.uitkomst && !m && d.beurt === i) {
        soort = 'denkt'; inhoud = '<span class="puntjes"><i>•</i><i>•</i><i>•</i></span>';
      }
      if (i === 0 && jij) {
        return `<div class="bubbel-plek zuid" data-sleutel="bubbel-zuid-knoppen"><div class="draai-knoppen">
          <button class="knop goud" data-actie="draai" data-keuze="spelen">Spelen</button>
          <button class="knop licht" data-actie="draai" data-keuze="passen">Passen</button></div></div>`;
      }
      if (!inhoud) return '';
      return `<div class="bubbel-plek ${pl.plek}" data-sleutel="bubbel-${pl.plek}-${soort}"><div class="bubbel ${soort}">${inhoud}</div></div>`;
    }).join('');
    return `<div class="midden">${schijf}${bubbels}</div>`;
  }
  if (!spel.potje) return '';
  const opTafel = spel.getoondeSlag ?? spel.potje.slag;
  const winnaar = spel.getoondeSlag && !spel.potje.verzaking ? spel.potje.slagen.at(-1).winnaar : null;
  const plekken = PLEKKEN.map((s, i) => {
    const gespeeld = opTafel.find((x) => x.speler === i);
    if (gespeeld) {
      const nieuw = spel.nieuweKaart === kaartId(gespeeld.kaart) ? 'nieuw' : '';
      return `<div class="slagplek ${s.plek} ${nieuw} ${winnaar === i ? 'winnaar' : ''}" data-sleutel="plek-${s.plek}">${kaartHtml(gespeeld.kaart)}</div>`;
    }
    if (i === 0) return '<div class="slagplek zuid" data-sleutel="plek-zuid"><div class="jouw-kaart">Jouw kaart</div></div>';
    return '';
  }).join('');
  const RICHTING = { noord: '0deg', oost: '90deg', zuid: '180deg', west: '270deg' };
  const pijl = winnaar !== null
    ? `<div class="pijl" style="--richting:${RICHTING[PLEKKEN[winnaar].plek]}"><svg viewBox="0 0 64 64"><defs><linearGradient id="pijlgoud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2a6"/><stop offset="1" stop-color="#d4ad4f"/></linearGradient></defs><path d="M32 4 58 34H42v26H22V34H6z" fill="url(#pijlgoud)" stroke="#7a5c12" stroke-width="2" stroke-linejoin="round"/></svg></div>`
    : '';
  const roem = spel.roemMelding
    ? `<div class="roem"><span class="ster">★</span>${spel.roemMelding.totaal}<span class="woord">roem</span></div>`
    : '';
  return `<div class="midden">${plekken}${pijl}${roem}</div>`;
}

// ---------- Hint ----------
function hint(spel) {
  if (spel.fase === 'draaien') {
    const m = spel.draaiMelding;
    const kleurNaam = (k) => KLEURNAAM[k].toLowerCase();
    if (m?.soort === 'speelt') return `<strong>${naam(m.speler)}</strong> speelt · troef ${kleurNaam(m.kleur)}`;
    if (m?.soort === 'iedereenPast') return 'Iedereen past';
    if (spel.draaien.uitkomst) return '';
    const vraag = `troef ${kleurNaam(spel.draaien.kaart.kleur)}?`;
    return spel.draaien.beurt === 0
      ? `<strong>Jouw beurt</strong> · ${vraag}`
      : `${naam(spel.draaien.beurt)} denkt na · ${vraag}`;
  }
  if (spel.fase === 'opnieuwDelen') return 'Iedereen past · <strong>opnieuw delen</strong>';
  if (spel.fase !== 'spelen') return '';
  const p = spel.potje;
  if (spel.getoondeSlag) {
    const w = p.slagen.at(-1).winnaar;
    return w === 0 ? 'Deze slag is <strong>voor jou</strong>' : `Deze slag is voor <strong>${naam(w)}</strong>`;
  }
  if (p.beurt !== 0) return `${naam(p.beurt)} denkt na…`;
  if (spel.gekozen) return '<strong>Tik nog een keer</strong> om te spelen';
  // Korte hint zonder uitleg (de grijze kaarten laten zien wat mag).
  return '<strong>Jouw beurt</strong>';
}

// ---------- Hand ----------
const KLEURVOLGORDE = ['schoppen', 'harten', 'klaveren', 'ruiten']; // zwart en rood afwisselend
const NIET_TROEF = ['A', '10', 'H', 'V', 'B', '9', '8', '7'];
const TROEF = ['B', '9', 'A', '10', 'H', 'V', '8', '7'];

export function sorteerHand(kaarten, troef) {
  // Troef vooraan; daarna de andere kleuren zo dat rood en zwart elkaar afwisselen.
  const kleuren = KLEURVOLGORDE.filter((k) => kaarten.some((c) => c.kleur === k && k !== troef));
  const volgorde = [];
  if (troef) volgorde.push(troef);
  const isRood = (k) => ROOD.has(k);
  let rest = kleuren.slice();
  while (rest.length) {
    const vorige = volgorde.at(-1);
    const idx = vorige ? rest.findIndex((k) => isRood(k) !== isRood(vorige)) : 0;
    volgorde.push(rest.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return kaarten.slice().sort((a, b) => {
    if (a.kleur !== b.kleur) return volgorde.indexOf(a.kleur) - volgorde.indexOf(b.kleur);
    const orde = a.kleur === troef ? TROEF : NIET_TROEF;
    return orde.indexOf(a.rang) - orde.indexOf(b.rang);
  });
}

function hand(spel) {
  // Tijdens het delen: alleen de ruggen van de kaarten die al gedeeld zijn.
  if (spel.fase === 'delen') {
    return `<div class="hand">${rugHtml().repeat(spel.zichtbaar?.[0] ?? 0)}</div>`;
  }
  const kaarten = spel.potje ? spel.potje.handen[0] : spel.handen?.[0] ?? [];
  const gesorteerd = sorteerHand(kaarten, spel.potje?.troef ?? null);
  // Geen grijze kaarten: Rutger kent de regels. Met verzaakbescherming schudt een kaart die niet mag.
  return `<div class="hand">${gesorteerd
    .map((k) => {
      const id = kaartId(k);
      return kaartHtml(k, { klasse: spel.gekozen === id ? 'opgetild' : '', id });
    })
    .join('')}</div>`;
}

function troefGroot(spel) {
  if (!spel.potje) return '';
  const t = spel.potje.troef;
  return `<div class="troef-groot ${ROOD.has(t) ? 'rood' : ''}" aria-label="Troef ${KLEURNAAM[t]}">${symbool(t)}<span class="troef-groot-tekst">Troef</span></div>`;
}

function knoppenRechts(spel) {
  if (!spel.potje) return '';
  return `<div class="knoppen-rechts">
    <button class="knop" data-actie="open" data-venster="laatsteSlag" ${spel.laatsteSlag ? '' : 'disabled'}>${IKOON.terug}Laatste slag</button>
    <button class="knop" data-actie="open" data-venster="gespeeld">${IKOON.lijst}Gespeeld</button>
  </div>`;
}

// ---------- Vensters ----------
// Alleen een venster dat net opengaat krijgt de infade-animatie (niet bij elke hertekening).
let vorigVenster = null;
let ditVenster = null;
function venster(inhoud, sluitbaar = true, naam = 'venster') {
  ditVenster = naam;
  const nieuw = naam !== vorigVenster ? 'nieuw' : '';
  return `<div class="venster-achter ${nieuw}" ${sluitbaar ? 'data-actie="sluit"' : ''}><div class="venster" data-binnen>${inhoud}</div></div>`;
}

function laatsteSlagVenster(spel) {
  const s = spel.laatsteSlag;
  return venster(`<h2>Laatste slag</h2>
    <p class="sub">Gewonnen door ${naam(s.winnaar)} · ${s.punten} punten${s.roem.totaal ? ` · ${s.roem.totaal} roem` : ''}</p>
    <div class="rij-kaarten">${s.kaarten.map((x) => `<div class="met-naam ${x.speler === s.winnaar ? 'winnaar' : ''}">${kaartHtml(x.kaart)}<div>${naam(x.speler)}</div></div>`).join('')}</div>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Sluiten</button></div>`, true, 'laatsteSlag');
}

function gespeeldVenster(spel) {
  const p = spel.potje;
  const weg = new Set([...p.slagen.flatMap((s) => s.kaarten), ...p.slag].map((x) => kaartId(x.kaart)));
  const mijn = new Set(p.handen[0].map(kaartId));
  const kleuren = [p.troef, ...KLEURVOLGORDE.filter((k) => k !== p.troef)];
  const rijen = kleuren.map((kleur) => {
    const orde = kleur === p.troef ? TROEF : NIET_TROEF;
    const rood = ROOD.has(kleur) ? 'rood' : '';
    return `<div class="kleurkop ${rood}">${symbool(kleur)}${KLEURNAAM[kleur]}${kleur === p.troef ? '<span class="troef">troef</span>' : ''}</div>` +
      orde.map((rang) => {
        const id = `${kleur}-${rang}`;
        const st = weg.has(id) ? `weg ${rood}` : mijn.has(id) ? 'mijn' : '';
        return `<div class="cel ${st}">${rang}</div>`;
      }).join('');
  }).join('');
  return venster(`<h2>Gespeeld</h2><p class="sub">Dit potje · ${p.slagen.length} van 8 slagen</p>
    <div class="gespeeld">${rijen}</div>
    <div class="legenda"><span>Wit: gespeeld</span><span>Goud: in jouw hand</span><span>Gestippeld: nog bij anderen</span></div>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Sluiten</button></div>`, true, 'gespeeld');
}

function menuVenster() {
  return venster(`<h2>Menu</h2>
    <div class="menu-lijst">
      <button class="knop goud" data-actie="sluit">Verder spelen</button>
      <button class="knop" data-actie="open" data-venster="nieuwBevestig">Nieuwe partij</button>
    </div>`, true, 'menu');
}

function nieuwBevestigVenster() {
  return venster(`<h2>Nieuwe partij?</h2><p class="sub">De lopende partij gaat verloren.</p>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Annuleren</button>
    <button class="knop goud" data-actie="nieuwePartij">Nieuwe partij</button></div>`, true, 'nieuwBevestig');
}

function keuzeRij(label, sleutel, huidig, opties, uitleg = '') {
  return `<div class="instelling">
    <div class="instelling-label">${label}${uitleg ? `<span class="instelling-uitleg">${uitleg}</span>` : ''}</div>
    <div class="segment">${opties.map(([waarde, tekst]) =>
      `<button class="segment-knop ${String(huidig) === String(waarde) ? 'aan' : ''}" data-actie="instelling" data-sleutel="${sleutel}" data-waarde="${waarde}">${tekst}</button>`).join('')}</div>
  </div>`;
}

function instellingenVenster(spel) {
  const i = spel.instellingen;
  const namen = [1, 2, 3].map((k) => `<label class="naam-veld"><span>${['', 'Links', 'Maat (boven)', 'Rechts'][k]}</span>
    <input type="text" maxlength="16" data-naam="${k}" value="${i.namen[k].replace(/"/g, '&quot;')}" autocomplete="off" enterkeyhint="done"></label>`).join('');
  return venster(`<h2>Instellingen</h2>
    <div class="instellingen">
      ${keuzeRij('Spelregels', 'systeem', i.systeem, [['amsterdams', 'Amsterdams'], ['rotterdams', 'Rotterdams']], 'Vanaf het volgende potje')}
      ${keuzeRij('Opnieuw delen na', 'rondes', i.rondesVoorOpnieuwDelen, [[2, '2 rondes passen'], [3, '3 rondes passen']], 'Vanaf het volgende potje')}
      ${keuzeRij('Verzaakbescherming', 'verzaakbescherming', i.verzaakbescherming ? 'aan' : 'uit', [['aan', 'Aan'], ['uit', 'Uit']], 'Aan: alleen kaarten die mogen zijn speelbaar')}
      ${keuzeRij('Computerspelers', 'niveau', i.niveau, [['makkelijk', 'Makkelijk'], ['normaal', 'Normaal'], ['sterk', 'Sterk']])}
      ${keuzeRij('Geluid', 'geluid', i.geluid ? 'aan' : 'uit', [['aan', 'Aan'], ['uit', 'Uit']], 'Schudden en kaarten leggen')}
      ${keuzeRij('Vergelijk met de computer', 'vergelijk', i.vergelijk ? 'aan' : 'uit', [['aan', 'Aan'], ['uit', 'Uit']], 'Na elk potje: wat de computer met jouw kaarten had gedaan')}
      <div class="instelling">
        <div class="instelling-label">Namen</div>
        <div class="namen">${namen}</div>
      </div>
    </div>
    <div class="venster-knoppen"><button class="knop goud" data-actie="sluit">Klaar</button></div>`, true, 'instellingen');
}

// ---------- Vergelijk met de computer ----------
const kort = (k) => `<span class="kaartje ${ROOD.has(k.kleur) ? 'rood' : 'zwart'}">${SYMBOOL[k.kleur]}${k.rang}</span>`;

// Analyses van het potje dat in de uitslag staat.
function analysesUitslag(spel) {
  const nr = spel.partij.potjes.length - 1;
  return (spel.analyses ?? []).filter((a) => a.potje === nr);
}

// Klein label onder jouw kaart in "Bekijk alle slagen".
function vergelijkLabel(spel, slagIndex) {
  if (!spel.instellingen.vergelijk) return '';
  const a = analysesUitslag(spel).find((x) => x.soort === 'kaart' && x.slag === slagIndex);
  if (!a) return spel.analyseBezig ? '<div class="vgl">…</div>' : '';
  if (a.oordeel === 'zelfde') return '<div class="vgl zelfde" title="De computer speelde dezelfde kaart">✓</div>';
  if (a.oordeel === 'gelijkwaardig') return `<div class="vgl" title="Computer: andere kaart, even goed">≈ ${kort(a.computer)}</div>`;
  const n = Math.abs(a.verschil);
  return `<div class="vgl ${a.oordeel}" title="Kaart van de computer, gemiddeld verschil in punten">${kort(a.computer)}<small>gem. ${n} ${a.oordeel === 'minder' ? 'beter' : 'minder'}</small></div>`;
}

function puntenZin(n) {
  if (n === 0) return 'even goed als de computer';
  return `naar schatting gemiddeld ${Math.abs(n)} ${Math.abs(n) === 1 ? 'punt' : 'punten'} ${n > 0 ? 'beter' : 'minder'} dan de computer`;
}

function vergelijkBlok(spel) {
  if (!spel.instellingen.vergelijk) return '';
  const lijst = analysesUitslag(spel);
  const kaarten = lijst.filter((a) => a.soort === 'kaart');
  const regels = [];
  if (kaarten.length) {
    const tel = (o) => kaarten.filter((a) => a.oordeel === o).length;
    const anders = tel('beter') + tel('minder');
    // Alleen duidelijke verschillen tellen mee; "even goed" telt als 0.
    const som = kaarten.filter((a) => a.oordeel === 'beter' || a.oordeel === 'minder').reduce((n, a) => n + a.verschil, 0);
    regels.push(`<b>Dit potje:</b> ${tel('zelfde')}× dezelfde kaart, ${tel('gelijkwaardig')}× even goed, ${anders}× anders · ${puntenZin(som)}`);
  }
  for (const d of lijst.filter((a) => a.soort === 'draai')) {
    const woord = (k) => (k === 'spelen' ? 'gespeeld' : 'gepast');
    regels.push(`<b>Spelen of passen op ${SYMBOOL[d.kleur]}:</b> jij hebt ${woord(d.jij)}, ${d.jij === d.computer ? 'de computer ook' : `de computer had ${woord(d.computer)}`}`);
  }
  const v = spel.vergelijking;
  if (v?.kaarten > kaarten.length) {
    regels.push(`<b>Deze partij:</b> ${v.zelfde + v.gelijkwaardig} van ${v.kaarten} kaarten zoals de computer of even goed · ${puntenZin(v.punten)}${v.draaien ? ` · spelen of passen ${v.draaiAnders} van ${v.draaien} keer anders` : ''}`);
  }
  if (spel.analyseBezig) regels.push('<span class="licht">De computer rekent nog…</span>');
  if (!regels.length) return '';
  return `<div class="vergelijk-blok"><div class="vergelijk-kop">Vergeleken met de computer</div>
    ${regels.map((r) => `<p>${r}</p>`).join('')}
    <p class="vergelijk-uitleg">Een schatting vooraf, met wat jij toen wist; niet wat het achteraf opleverde. De computer kan zich ook vergissen.</p></div>`;
}

function slagenOverzicht(spel) {
  const slagen = spel.potje.slagen;
  if (!slagen.length) return '';
  const rijen = slagen.map((s, i) => {
    const wij = team(s.winnaar) === 0;
    const roem = s.roem.totaal ? ` + ${s.roem.totaal} roem` : '';
    return `<div class="slag-rij">
      <div class="slag-info"><b>Slag ${i + 1}</b><span class="${wij ? 'wij' : ''}">${wij ? 'Wij' : 'Zij'}</span> · ${s.punten} punten${roem}</div>
      <div class="slag-kaarten">${s.kaarten.map((x) => `<div class="met-naam ${x.speler === s.winnaar ? 'winnaar' : ''}">${kaartHtml(x.kaart)}<div>${naam(x.speler)}</div>${x.speler === 0 ? vergelijkLabel(spel, i) : ''}</div>`).join('')}</div>
    </div>`;
  }).join('');
  const uitleg = spel.instellingen.vergelijk
    ? '<p class="vergelijk-uitleg">Onder jouw kaart: ✓ dezelfde kaart als de computer, ≈ een andere kaart die (bijna) even goed is, of de kaart van de computer met hoeveel die gemiddeld beter of minder was.</p>'
    : '';
  return `<details class="slagen-overzicht"><summary>Bekijk alle slagen</summary><div class="slagen-lijst">${uitleg}${rijen}</div></details>`;
}

// Alle handen zoals ze bij het begin van het potje gedeeld waren, rond de tafel.
function handenVenster(spel) {
  const troef = spel.potje.troef;
  const speler = spel.draaien?.uitkomst?.speler;
  const blok = (i) => {
    const kaarten = sorteerHand(spel.handen[i], troef);
    return `<div class="handen-blok ${PLEKKEN[i].plek}">
      <div class="handen-naam"><b>${naam(i)}</b>${i === speler ? '<span class="label speelt">Speelde</span>' : ''}</div>
      <div class="hand-kaarten">${kaarten.map((k) => kaartHtml(k)).join('')}</div>
    </div>`;
  };
  return venster(`<h2>Alle handen</h2>
    <p class="sub">Zoals ze gedeeld waren · troef ${KLEURNAAM[troef].toLowerCase()}</p>
    <div class="handen-tafel">
      ${blok(2)}${blok(1)}
      <div class="handen-midden ${ROOD.has(troef) ? 'rood' : ''}">${symbool(troef)}</div>
      ${blok(3)}${blok(0)}
    </div>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Terug</button></div>`, true, 'handen');
}

function uitslagVenster(spel) {
  const u = spel.uitslag;
  const wijSpelen = spel.potje.spelendTeam === 0;
  let kop = 'Potje gespeeld';
  let uitleg = `${wijSpelen ? 'Wij' : 'Zij'} speelden en haalden het.`;
  if (u.verzaakt) {
    const v = u.verzaakt;
    kop = 'Verzaakt!';
    const g = spel.verzaakReden;
    uitleg = `<span class="melding-rood">${naam(v.speler)} speelde ${kaartNaam(v.kaart)}, maar dat mocht niet.</span><br>${g ? `${redenTekst(g.reden, g.gevraagd)}.<br>` : ''}De tegenpartij krijgt 162 + 100 punten en alle roem.`;
  } else if (u.nat) {
    kop = wijSpelen ? 'Wij zijn nat' : 'Zij zijn nat';
    uitleg = 'De tegenpartij krijgt alle punten en alle roem.';
  } else if (u.pit !== null) {
    kop = 'Pit!';
    uitleg = 'Alle slagen gehaald: 100 roem extra.';
  }
  const klaar = spel.fase === 'partijKlaar';
  const t = spel.partij.totaal;
  return venster(`<h2>${kop}</h2><p class="sub">${uitleg}</p>
    <table class="uitslag">
      <tr><th></th><th>Punten</th><th>Roem</th><th>Totaal</th></tr>
      <tr class="wij"><td>Wij</td><td>${u.punten[0]}</td><td>${u.roem[0]}</td><td>${u.totaal[0]}</td></tr>
      <tr><td>Zij</td><td>${u.punten[1]}</td><td>${u.roem[1]}</td><td>${u.totaal[1]}</td></tr>
    </table>
    ${vergelijkBlok(spel)}
    ${slagenOverzicht(spel)}
    <p class="stand">Stand na ${spel.partij.potjes.length} van ${AANTAL_POTJES}: Wij <b>${t[0]}</b> · Zij <b>${t[1]}</b></p>
    ${klaar ? `<p class="eindstand">${t[0] > t[1] ? 'Wij winnen de partij!' : t[0] < t[1] ? 'Zij winnen de partij.' : 'Gelijkspel.'}</p>` : ''}
    <div class="venster-knoppen">${spel.handen ? '<button class="knop" data-actie="open" data-venster="handen">Alle handen</button>' : ''}${klaar
      ? '<button class="knop" data-actie="naarStart">Beginscherm</button><button class="knop goud" data-actie="nieuwePartij">Nieuwe partij</button>'
      : '<button class="knop goud" data-actie="volgendPotje">Volgend potje</button>'}</div>`, false, `uitslag-${spel.partij.potjes.length}`);
}

function vensters(spel) {
  ditVenster = null;
  const html = vensterHtml(spel);
  vorigVenster = ditVenster;
  return html;
}

function vensterHtml(spel) {
  if (spel.fase === 'potjeKlaar' || spel.fase === 'partijKlaar') {
    return spel.venster === 'handen' && spel.handen ? handenVenster(spel) : uitslagVenster(spel);
  }
  switch (spel.venster) {
    case 'laatsteSlag': return spel.laatsteSlag ? laatsteSlagVenster(spel) : '';
    case 'gespeeld': return spel.potje ? gespeeldVenster(spel) : '';
    case 'menu': return menuVenster();
    case 'nieuwBevestig': return nieuwBevestigVenster();
    case 'instellingen': return instellingenVenster(spel);
    default: return '';
  }
}

// ---------- Beginscherm ----------
function beginscherm(spel) {
  const i = spel.instellingen;
  const loopt = spel.partij ? spel.fase !== 'partijKlaar' : Boolean(spel.bewaard);
  const info = spel.partij
    ? { potje: Math.min(potjeNummer(spel.partij), AANTAL_POTJES), totaal: spel.partij.totaal }
    : spel.bewaard;
  const waaier = [
    { kleur: 'klaveren', rang: 'B' }, { kleur: 'harten', rang: 'A' },
    { kleur: 'schoppen', rang: 'H' }, { kleur: 'ruiten', rang: 'V' },
  ].map((k, n) => `<div class="start-kaart" style="--n:${n - 1.5}">${kaartHtml(k)}</div>`).join('');
  return `<div class="laken"></div>
    <main class="start">
      <div class="start-waaier">${waaier}</div>
      <div class="start-kolom">
        <h1>Klaverjas</h1>
        <p class="start-sub">${i.systeem === 'amsterdams' ? 'Amsterdams' : 'Rotterdams'} · computerspelers ${i.niveau}</p>
        <div class="start-knoppen">
          ${loopt ? `<button class="knop goud start-knop" data-actie="verderSpelen">Verder spelen
            <span class="start-knop-sub">Potje ${info.potje} van ${AANTAL_POTJES} · Wij ${info.totaal[0]} – Zij ${info.totaal[1]}</span></button>` : ''}
          <button class="knop ${loopt ? 'licht' : 'goud'} start-knop" data-actie="nieuwePartijVraag">Nieuwe partij</button>
          <button class="knop licht start-knop" data-actie="open" data-venster="instellingen">Instellingen</button>
        </div>
      </div>
    </main>`;
}

// De kleursymbolen staan één keer buiten het steeds opnieuw getekende deel,
// zodat kaarten nooit even zonder symbolen in beeld komen.
function zorgVoorSprite() {
  if (document.getElementById('kleursymbolen')) return;
  const div = document.createElement('div');
  div.id = 'kleursymbolen';
  div.innerHTML = symboolSprite();
  document.body.prepend(div);
}

// ---------- Alles samen ----------
export function render(el, spel, acties) {
  NAMEN = spel.namen;
  if (spel.scherm === 'start') {
    zorgVoorSprite();
    patchHtml(el, `${beginscherm(spel)}${spel.venster === 'instellingen' ? instellingenVenster(spel) : spel.venster === 'nieuwBevestig' ? nieuwBevestigVenster() : ''}`);
    vulPlaatjes(el);
    koppel(el, acties);
    return;
  }
  zorgVoorSprite();
  // Posities van vóór het bijwerken: daarvandaan vliegt een gespeelde kaart en schuift de hand.
  const voor = new Map();
  for (const k of el.querySelectorAll('.hand [data-kaart]')) voor.set(k.dataset.kaart, k.getBoundingClientRect());
  patchHtml(el, `
    <div class="laken"></div>
    ${balk(spel)}
    ${ditPotje(spel)}
    ${[2, 1, 3].map((i) => spelerHtml(spel, i)).join('')}
    ${midden(spel)}
    ${troefGroot(spel)}
    ${knoppenRechts(spel)}
    <div class="hint">${hint(spel)}</div>
    ${hand(spel)}
    ${vensters(spel)}`);
  vulPlaatjes(el);
  koppel(el, acties);
  if (spel.nieuweKaart) vliegNaarSlag(el, spel.nieuweKaart, voor);
  schuifHand(el, voor);
}

const VLIEG_MS = 300;
const VLIEG_EASING = 'cubic-bezier(.2,.75,.3,1)';

// Een gespeelde kaart vliegt vanaf de speler naar zijn plek op tafel: vanaf jouw hand,
// of vanaf de kaarten van de computerspeler. Alleen transform: dat loopt soepel op de tablet.
function vliegNaarSlag(el, id, voor) {
  const kaart = el.querySelector(`.slagplek.nieuw [data-sleutel="${id}"]`) ?? el.querySelector('.slagplek.nieuw .kaart');
  if (!kaart || kaart.dataset.gevlogen === id) return;
  kaart.dataset.gevlogen = id;
  const plek = kaart.closest('.slagplek');
  const naar = kaart.getBoundingClientRect();
  let van = voor.get(id);
  if (!van) {
    const p = PLEKKEN.find((x) => plek.classList.contains(x.plek))?.plek;
    const bron = el.querySelector(`.speler.${p} .ruggen .kaart:last-child`) ?? el.querySelector(`.speler.${p} .avatar`);
    van = bron?.getBoundingClientRect();
  }
  if (!van || !naar.width) return;
  // Verschuiving in schermpixels, omgerekend naar het (licht gedraaide) assenstelsel van de plek.
  const m = new DOMMatrix(getComputedStyle(plek).transform);
  const hoek = Math.atan2(m.b, m.a);
  const dx = van.left + van.width / 2 - (naar.left + naar.width / 2);
  const dy = van.top + van.height / 2 - (naar.top + naar.height / 2);
  const x = dx * Math.cos(-hoek) - dy * Math.sin(-hoek);
  const y = dx * Math.sin(-hoek) + dy * Math.cos(-hoek);
  const schaal = Math.max(0.3, Math.min(1.2, van.width / naar.width));
  const graden = (-hoek * 180) / Math.PI;
  kaart.animate(
    [
      { transform: `translate(${x}px, ${y}px) rotate(${graden}deg) scale(${schaal})` },
      { transform: 'none' },
    ],
    { duration: VLIEG_MS, easing: VLIEG_EASING },
  );
}

// Na het spelen van een kaart schuiven de overige kaarten in je hand vloeiend dicht.
function schuifHand(el, voor) {
  if (!voor.size) return;
  for (const k of el.querySelectorAll('.hand [data-kaart]')) {
    const oud = voor.get(k.dataset.kaart);
    if (!oud) continue;
    const nu = k.getBoundingClientRect();
    const dx = oud.left - nu.left;
    const dy = oud.top - nu.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    k.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 260, easing: VLIEG_EASING });
  }
}

function koppel(el, acties) {
  if (!el.dataset.luistert) {
    el.dataset.luistert = '1';
    el.addEventListener('click', (e) => {
      const kaart = e.target.closest('.hand [data-kaart]');
      if (kaart) return acties.tikKaart(kaart.dataset.kaart);
      const knop = e.target.closest('[data-actie]');
      if (!knop || knop.disabled) return;
      // Klik binnen een venster sluit het niet, behalve op een knop.
      if (knop.classList.contains('venster-achter') && e.target.closest('[data-binnen]')) return;
      const { actie } = knop.dataset;
      if (actie === 'draai') acties.draai(knop.dataset.keuze);
      else if (actie === 'open') acties.open(knop.dataset.venster);
      else if (actie === 'instelling') acties.instelling(knop.dataset.sleutel, knop.dataset.waarde);
      else acties[actie]?.();
    });
    // Namen: opslaan bij verlaten van het veld of op Enter.
    el.addEventListener('change', (e) => {
      const veld = e.target.closest('[data-naam]');
      if (veld) acties.naam(Number(veld.dataset.naam), veld.value);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('[data-naam]')) e.target.blur();
    });
  }
}
