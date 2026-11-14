// Tekent de speeltafel volgens het ontwerp.

import { kaartId, team } from '../regels/kaarten.js';
import { stand } from '../regels/potje.js';
import { geldigMetReden, redenTekst } from '../regels/geldig.js';
import { AANTAL_POTJES, potjeNummer } from '../regels/partij.js';
import { kaartHtml, rugHtml, symbool, symboolSprite, kaartNaam, ROOD } from './kaart.js';

const KLEURNAAM = { klaveren: 'Klaveren', ruiten: 'Ruiten', harten: 'Harten', schoppen: 'Schoppen' };
export const SPELERS = [
  { naam: 'Jij', initiaal: 'J', rol: '', plek: 'zuid', klasse: 'jij' },
  { naam: 'West', initiaal: 'W', rol: 'Tegenstander', plek: 'west', klasse: '' },
  { naam: 'Maat', initiaal: 'M', rol: 'Jouw maat · computer', plek: 'noord', klasse: 'maat' },
  { naam: 'Oost', initiaal: 'O', rol: 'Tegenstander', plek: 'oost', klasse: '' },
];
const ROEMNAAM = {
  driekaart: 'Driekaart', vierkaart: 'Vierkaart', stuk: 'Stuk',
  vierBoeren: 'Vier boeren', vierGelijk: 'Vier gelijke', pit: 'Pit',
};
const IKOON = {
  huis: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  tandwiel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/><circle cx="12" cy="12" r="6.6"/></svg>',
  terug: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
  lijst: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="13" width="7" height="7" rx="1.5"/><rect x="14" y="13" width="7" height="7" rx="1.5"/></svg>',
};

const klein = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// ---------- Bovenbalk ----------
function balk(spel) {
  const { partij, potje, draaien } = spel;
  let troef;
  if (potje) {
    const wie = potje.spelendTeam === 0 ? 'wij spelen' : 'zij spelen';
    troef = `<div class="troeflabel"><span class="troefrond ${ROOD.has(potje.troef) ? 'rood' : ''}">${symbool(potje.troef)}</span>Troef · ${KLEURNAAM[potje.troef]} <span class="licht">· ${wie}</span></div>`;
  } else if (draaien) {
    troef = '<div class="troeflabel stil">Troef bepalen…</div>';
  } else troef = '';
  const nr = Math.min(potjeNummer(partij), AANTAL_POTJES);
  return `<header class="balk">
    <div class="balk-links"><button class="knop ikoon" data-actie="open" data-venster="menu" aria-label="Menu">${IKOON.huis}</button></div>
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
  const s = SPELERS[i];
  const speelt = spel.potje && spel.draaien?.uitkomst?.speler === i;
  const aanBeurt =
    (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt === i) ||
    (spel.fase === 'draaien' && !spel.draaien.uitkomst && spel.draaien.beurt === i);
  const labels = [];
  if (speelt) labels.push('<span class="label speelt">Speelt</span>');
  if (spel.fase === 'draaien' || spel.fase === 'opnieuwDelen') {
    if (spel.partij.deler === i) labels.push('<span class="label deelt">Deelt</span>');
    if (spel.draaiKeuzes[i] === 'passen') labels.push('<span class="label past">Past</span>');
  }
  const aantal = spel.potje ? spel.potje.handen[i].length : spel.handen?.[i]?.length ?? 0;
  const ruggen = i === 0 ? '' : `<div class="ruggen">${rugHtml().repeat(aantal)}</div>`;
  return `<div class="speler ${s.plek} ${s.klasse} ${aanBeurt ? 'aan-beurt' : ''}">
    <div class="avatar">${s.initiaal}</div>
    <div class="speler-tekst">
      <div class="naam">${s.naam}${labels.join('')}</div>
      ${s.rol ? `<div class="rol">${s.rol}</div>` : ''}
      ${ruggen}
    </div>
  </div>`;
}

// ---------- Midden van de tafel ----------
function midden(spel) {
  if (spel.fase === 'draaien' || spel.fase === 'opnieuwDelen') {
    const d = spel.draaien;
    const jij = spel.fase === 'draaien' && d.beurt === 0 && !d.uitkomst;
    const tekst = spel.fase === 'opnieuwDelen'
      ? 'Iedereen past. <strong>Er wordt opnieuw gedeeld.</strong>'
      : `Voorgestelde troef: <strong>${KLEURNAAM[d.kaart.kleur]}</strong>${d.rondes ? ` · ronde ${d.rondes + 1}` : ''}`;
    return `<div class="midden"><div class="draaien">
      <div class="stapel ${spel.nieuweKaart === kaartId(d.kaart) ? 'nieuw' : ''}">${rugHtml()}${kaartHtml(d.kaart)}</div>
      <div class="draai-tekst">${tekst}</div>
      ${jij ? `<div class="draai-knoppen">
        <button class="knop goud" data-actie="draai" data-keuze="spelen">Spelen</button>
        <button class="knop licht" data-actie="draai" data-keuze="passen">Passen</button></div>` : ''}
    </div></div>`;
  }
  if (!spel.potje) return '';
  const opTafel = spel.getoondeSlag ?? spel.potje.slag;
  const winnaar = spel.getoondeSlag && !spel.potje.verzaking ? spel.potje.slagen.at(-1).winnaar : null;
  const plekken = SPELERS.map((s, i) => {
    const gespeeld = opTafel.find((x) => x.speler === i);
    if (gespeeld) {
      const nieuw = spel.nieuweKaart === kaartId(gespeeld.kaart) ? 'nieuw' : '';
      return `<div class="slagplek ${s.plek} ${nieuw} ${winnaar === i ? 'winnaar' : ''}">${kaartHtml(gespeeld.kaart)}</div>`;
    }
    if (i === 0) return '<div class="slagplek zuid"><div class="jouw-kaart">Jouw kaart</div></div>';
    return '';
  }).join('');
  const roem = spel.roemMelding
    ? `<div class="roem"><span class="ster">★</span>${spel.roemMelding.items.map((r) => `${ROEMNAAM[r.soort]} · ${r.punten}`).join(' + ')} roem</div>`
    : '';
  return `<div class="midden">${plekken}${roem}</div>`;
}

// ---------- Hint ----------
function hint(spel) {
  if (spel.fase === 'draaien') {
    if (spel.draaien.uitkomst) return '';
    return spel.draaien.beurt === 0
      ? `<strong>Jouw beurt</strong> · spelen of passen op ${klein(KLEURNAAM[spel.draaien.kaart.kleur])}?`
      : `${SPELERS[spel.draaien.beurt].naam} denkt na…`;
  }
  if (spel.fase === 'opnieuwDelen') return 'Opnieuw delen…';
  if (spel.fase !== 'spelen') return '';
  const p = spel.potje;
  if (spel.getoondeSlag) {
    const w = p.slagen.at(-1).winnaar;
    return w === 0 ? 'Jij hebt de slag' : `${SPELERS[w].naam} heeft de slag`;
  }
  if (p.beurt !== 0) return `${SPELERS[p.beurt].naam} denkt na…`;
  if (spel.gekozen) return '<strong>Tik nog een keer</strong> om te spelen';
  const g = geldigMetReden(p.handen[0], p.slag, p.troef, p.systeem);
  if (g.reden === 'uitkomen') return '<strong>Jouw beurt</strong> · jij komt uit';
  return `<strong>Jouw beurt</strong> · ${klein(redenTekst(g.reden, g.gevraagd))}`;
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
  const kaarten = spel.potje ? spel.potje.handen[0] : spel.handen?.[0] ?? [];
  const gesorteerd = sorteerHand(kaarten, spel.potje?.troef ?? null);
  const p = spel.potje;
  const mijnBeurt = spel.fase === 'spelen' && !spel.getoondeSlag && p.beurt === 0;
  const geldig = mijnBeurt ? new Set(geldigMetReden(p.handen[0], p.slag, p.troef, p.systeem).kaarten.map(kaartId)) : null;
  const n = gesorteerd.length;
  return `<div class="hand">${gesorteerd
    .map((k, i) => {
      const id = kaartId(k);
      const grijs = geldig && !geldig.has(id) ? 'grijs' : '';
      const op = spel.gekozen === id ? 'opgetild' : '';
      const m = i - (n - 1) / 2;
      return `<div class="handplek" style="--hoek:${(m * 2.6).toFixed(1)}deg;--y:${(m * m * 1.6).toFixed(1)}px">${kaartHtml(k, { klasse: `${grijs} ${op}`, id })}</div>`;
    })
    .join('')}</div>`;
}

function knoppenRechts(spel) {
  if (!spel.potje) return '';
  return `<div class="knoppen-rechts">
    <button class="knop" data-actie="open" data-venster="laatsteSlag" ${spel.laatsteSlag ? '' : 'disabled'}>${IKOON.terug}Laatste slag</button>
    <button class="knop" data-actie="open" data-venster="gespeeld">${IKOON.lijst}Gespeeld</button>
  </div>`;
}

// ---------- Vensters ----------
function venster(inhoud, sluitbaar = true) {
  return `<div class="venster-achter" ${sluitbaar ? 'data-actie="sluit"' : ''}><div class="venster" data-binnen>${inhoud}</div></div>`;
}

function laatsteSlagVenster(spel) {
  const s = spel.laatsteSlag;
  return venster(`<h2>Laatste slag</h2>
    <p class="sub">Gewonnen door ${SPELERS[s.winnaar].naam} · ${s.punten} punten${s.roem.totaal ? ` · ${s.roem.totaal} roem` : ''}</p>
    <div class="rij-kaarten">${s.kaarten.map((x) => `<div class="met-naam ${x.speler === s.winnaar ? 'winnaar' : ''}">${kaartHtml(x.kaart)}<div>${SPELERS[x.speler].naam}</div></div>`).join('')}</div>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Sluiten</button></div>`);
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
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Sluiten</button></div>`);
}

function menuVenster() {
  return venster(`<h2>Menu</h2>
    <div class="menu-lijst">
      <button class="knop goud" data-actie="sluit">Verder spelen</button>
      <button class="knop" data-actie="open" data-venster="nieuwBevestig">Nieuwe partij</button>
    </div>`);
}

function nieuwBevestigVenster() {
  return venster(`<h2>Nieuwe partij?</h2><p class="sub">De lopende partij gaat verloren.</p>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Annuleren</button>
    <button class="knop goud" data-actie="nieuwePartij">Nieuwe partij</button></div>`);
}

function instellingenVenster(spel) {
  const i = spel.partij.instellingen;
  return venster(`<h2>Instellingen</h2>
    <p class="sub">Aanpassen komt in fase 6. Dit zijn de huidige waarden:</p>
    <table class="uitslag"><tr><td>Systeem</td><td>${i.systeem === 'amsterdams' ? 'Amsterdams' : 'Rotterdams'}</td></tr>
    <tr><td>Opnieuw delen na</td><td>${i.rondesVoorOpnieuwDelen} rondes</td></tr>
    <tr><td>Verzaakbescherming</td><td>${i.verzaakbescherming ? 'Aan' : 'Uit'}</td></tr></table>
    <div class="venster-knoppen"><button class="knop" data-actie="sluit">Sluiten</button></div>`);
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
    uitleg = `<span class="melding-rood">${SPELERS[v.speler].naam} speelde ${kaartNaam(v.kaart)}, maar dat mocht niet.</span><br>${g ? `${redenTekst(g.reden, g.gevraagd)}.<br>` : ''}De tegenpartij krijgt 162 + 100 punten en alle roem.`;
  } else if (u.nat) {
    kop = wijSpelen ? 'Wij zijn nat' : 'Zij zijn nat';
    uitleg = 'De tegenpartij krijgt alle punten en alle roem.';
  } else if (u.pit !== null) {
    kop = u.pit === 0 ? 'Pit voor wij!' : 'Pit voor zij!';
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
    <p class="stand">Stand na ${spel.partij.potjes.length} van ${AANTAL_POTJES}: Wij <b>${t[0]}</b> · Zij <b>${t[1]}</b></p>
    ${klaar ? `<p class="eindstand">${t[0] > t[1] ? 'Wij winnen de partij!' : t[0] < t[1] ? 'Zij winnen de partij.' : 'Gelijkspel.'}</p>` : ''}
    <div class="venster-knoppen">${klaar
      ? '<button class="knop goud" data-actie="nieuwePartij">Nieuwe partij</button>'
      : '<button class="knop goud" data-actie="volgendPotje">Volgend potje</button>'}</div>`, false);
}

function vensters(spel) {
  if (spel.fase === 'potjeKlaar' || spel.fase === 'partijKlaar') return uitslagVenster(spel);
  switch (spel.venster) {
    case 'laatsteSlag': return spel.laatsteSlag ? laatsteSlagVenster(spel) : '';
    case 'gespeeld': return spel.potje ? gespeeldVenster(spel) : '';
    case 'menu': return menuVenster();
    case 'nieuwBevestig': return nieuwBevestigVenster();
    case 'instellingen': return instellingenVenster(spel);
    default: return '';
  }
}

// ---------- Alles samen ----------
export function render(el, spel, acties) {
  el.innerHTML = `${symboolSprite()}
    <div class="laken"></div>
    ${balk(spel)}
    ${ditPotje(spel)}
    ${[2, 1, 3, 0].map((i) => spelerHtml(spel, i)).join('')}
    ${midden(spel)}
    ${knoppenRechts(spel)}
    <div class="hint">${hint(spel)}</div>
    ${hand(spel)}
    ${vensters(spel)}`;
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
      else acties[actie]?.();
    });
  }
}
