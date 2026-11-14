// Tekent de speeltafel. Eenvoudige versie voor fase 2; het echte ontwerp volgt in fase 3.

import { kaartId, team } from '../regels/kaarten.js';
import { geldigVoor, stand } from '../regels/potje.js';
import { AANTAL_POTJES, potjeNummer } from '../regels/partij.js';

const SYMBOOL = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const KLEURNAAM = { klaveren: 'Klaveren', ruiten: 'Ruiten', harten: 'Harten', schoppen: 'Schoppen' };
const RANGNAAM = { A: 'aas', H: 'heer', V: 'vrouw', B: 'boer', 10: 'tien', 9: 'negen', 8: 'acht', 7: 'zeven' };
function kaartNaam(k) {
  return `${KLEURNAAM[k.kleur].toLowerCase()}${RANGNAAM[k.rang]}`;
}
const SPELERS = [
  { naam: 'Jij', rol: '', plek: 'zuid' },
  { naam: 'West', rol: 'Tegenstander', plek: 'west' },
  { naam: 'Maat', rol: 'Jouw maat · computer', plek: 'noord' },
  { naam: 'Oost', rol: 'Tegenstander', plek: 'oost' },
];
const ROEMNAAM = {
  driekaart: 'Driekaart', vierkaart: 'Vierkaart', stuk: 'Stuk',
  vierBoeren: 'Vier boeren', vierGelijk: 'Vier gelijke', pit: 'Pit',
};

function kaartHtml(k, { klasse = '', id = false } = {}) {
  const rood = k.kleur === 'harten' || k.kleur === 'ruiten';
  const s = SYMBOOL[k.kleur];
  return `<div class="kaart ${rood ? 'rood' : ''} ${klasse}" ${id ? `data-kaart="${kaartId(k)}"` : ''}>
    <span class="hoek">${k.rang}<br>${s}</span>
    <span class="midden">${s}</span>
    <span class="hoek onder">${k.rang}<br>${s}</span>
  </div>`;
}

function topbalk(spel) {
  const { partij, potje, draaien } = spel;
  let troef = '';
  const troefKleur = potje?.troef;
  if (troefKleur) {
    const wie = potje.spelendTeam === 0 ? 'wij spelen' : 'zij spelen';
    troef = `<div class="troeflabel"><span class="troefsymbool ${['harten', 'ruiten'].includes(troefKleur) ? 'rood' : ''}">${SYMBOOL[troefKleur]}</span>Troef · ${KLEURNAAM[troefKleur]} · ${wie}</div>`;
  } else if (draaien) {
    troef = `<div class="troeflabel stil">Troef bepalen…</div>`;
  }
  const nr = Math.min(potjeNummer(partij), AANTAL_POTJES);
  return `<header class="balk">
    <button class="knop" data-actie="nieuwePartij" title="Nieuwe partij">⌂</button>
    <div class="score">
      <span class="wij">Wij ${partij.totaal[0]}</span>
      <span class="potjenr">${nr} / ${AANTAL_POTJES}</span>
      <span class="zij">Zij ${partij.totaal[1]}</span>
    </div>
    ${troef}
  </header>`;
}

function ditPotje(spel) {
  if (!spel.potje) return '';
  const { punten, roem } = stand(spel.potje);
  return `<div class="paneel dit-potje">
    <div class="paneel-titel">Dit potje</div>
    <table><tr><th></th><th>Punten</th><th>Roem</th></tr>
    <tr><td>Wij</td><td>${punten[0]}</td><td>${roem[0]}</td></tr>
    <tr><td>Zij</td><td>${punten[1]}</td><td>${roem[1]}</td></tr></table>
  </div>`;
}

function spelerHtml(spel, i) {
  const s = SPELERS[i];
  const speelt = spel.potje && team(i) === spel.potje.spelendTeam && spel.draaien?.uitkomst?.speler === i;
  const aanBeurt =
    (spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt === i) ||
    (spel.fase === 'draaien' && !spel.draaien.uitkomst && spel.draaien.beurt === i);
  const keuze = spel.fase === 'draaien' && spel.draaiKeuzes[i] === 'passen' ? '<span class="past">Past</span>' : '';
  const deler = spel.partij.deler === i && spel.fase !== 'potjeKlaar' && spel.fase !== 'partijKlaar' ? '<span class="deler">Deelt</span>' : '';
  const aantal = spel.potje ? spel.potje.handen[i].length : spel.handen?.[i]?.length ?? 0;
  const ruggen = i === 0 ? '' : `<div class="ruggen">${'<span class="rug"></span>'.repeat(aantal)}</div>`;
  return `<div class="speler ${s.plek} ${aanBeurt ? 'aan-beurt' : ''}">
    <div class="avatar">${s.naam[0]}</div>
    <div class="naam">${s.naam}${speelt ? '<span class="speelt">Speelt</span>' : ''}${deler}${keuze}</div>
    ${s.rol ? `<div class="rol">${s.rol}</div>` : ''}
    ${ruggen}
  </div>`;
}

function midden(spel) {
  if (spel.fase === 'draaien' || spel.fase === 'opnieuwDelen') {
    const d = spel.draaien;
    const jij = spel.fase === 'draaien' && d.beurt === 0 && !d.uitkomst;
    const tekst = spel.fase === 'opnieuwDelen'
      ? 'Iedereen past. Er wordt opnieuw gedeeld.'
      : `Voorgestelde troef: ${KLEURNAAM[d.kaart.kleur]}${d.gepast.length ? ` · ronde ${d.rondes + 1}` : ''}`;
    return `<div class="draaien">
      ${kaartHtml(d.kaart, { klasse: 'gedraaid' })}
      <div class="draai-tekst">${tekst}</div>
      ${jij ? `<div class="draai-knoppen">
        <button class="knop groot" data-actie="draai" data-keuze="spelen">Spelen</button>
        <button class="knop groot" data-actie="draai" data-keuze="passen">Passen</button></div>` : ''}
    </div>`;
  }
  if (!spel.potje) return '';
  const opTafel = spel.getoondeSlag ?? spel.potje.slag;
  const plekken = SPELERS.map((s, i) => {
    const gespeeld = opTafel.find((x) => x.speler === i);
    if (gespeeld) return `<div class="slagplek ${s.plek}">${kaartHtml(gespeeld.kaart)}</div>`;
    if (i === 0) return `<div class="slagplek zuid"><div class="leeg">Jouw kaart</div></div>`;
    return '';
  }).join('');
  const roem = spel.roemMelding
    ? `<div class="roem">★ ${spel.roemMelding.items.map((r) => `${ROEMNAAM[r.soort]} · ${r.punten}`).join(' + ')} roem</div>`
    : '';
  return `<div class="slag">${plekken}${roem}</div>`;
}

function hint(spel) {
  if (spel.fase === 'draaien') {
    return spel.draaien.beurt === 0 && !spel.draaien.uitkomst
      ? `Jouw beurt · spelen of passen op ${KLEURNAAM[spel.draaien.kaart.kleur].toLowerCase()}?`
      : `${SPELERS[spel.draaien.beurt].naam} denkt na…`;
  }
  if (spel.fase !== 'spelen') return '';
  const p = spel.potje;
  if (spel.getoondeSlag) {
    const w = p.slagen.at(-1).winnaar;
    return w === 0 ? 'Jij hebt de slag' : `${SPELERS[w].naam} heeft de slag`;
  }
  if (p.beurt !== 0) return `${SPELERS[p.beurt].naam} denkt na…`;
  if (spel.gekozen) return 'Tik nog een keer om te spelen';
  if (p.slag.length === 0) return 'Jouw beurt · jij komt uit';
  const gevraagd = p.slag[0].kaart.kleur;
  const kanBekennen = p.handen[0].some((k) => k.kleur === gevraagd);
  if (kanBekennen) {
    return gevraagd === p.troef
      ? `Jouw beurt · troef gevraagd, je moet ${KLEURNAAM[gevraagd].toLowerCase()} bekennen`
      : `Jouw beurt · je moet ${KLEURNAAM[gevraagd].toLowerCase()} bekennen`;
  }
  const geldig = geldigVoor(p, 0);
  if (geldig.every((k) => k.kleur === p.troef) && p.handen[0].some((k) => k.kleur !== p.troef)) {
    return 'Jouw beurt · je moet troeven';
  }
  return 'Jouw beurt';
}

function hand(spel) {
  const kaarten = spel.potje ? spel.potje.handen[0] : spel.handen?.[0] ?? [];
  const sorteer = sorteerHand(kaarten, spel.potje?.troef);
  const mijnBeurt = spel.fase === 'spelen' && !spel.getoondeSlag && spel.potje.beurt === 0;
  const geldig = mijnBeurt ? new Set(geldigVoor(spel.potje, 0).map(kaartId)) : null;
  const n = sorteer.length;
  return `<div class="hand">${sorteer
    .map((k, i) => {
      const id = kaartId(k);
      const grijs = geldig && !geldig.has(id) ? 'grijs' : '';
      const op = spel.gekozen === id ? 'opgetild' : '';
      const hoek = (i - (n - 1) / 2) * 3;
      return `<div class="handplek" style="--hoek:${hoek}deg; --y:${Math.abs(i - (n - 1) / 2) ** 2 * 1.2}px">${kaartHtml(k, { klasse: `${grijs} ${op}`, id: true })}</div>`;
    })
    .join('')}</div>`;
}

const KLEURVOLGORDE = ['schoppen', 'harten', 'klaveren', 'ruiten']; // zwart/rood afwisselend
const RANGVOLGORDE = ['A', '10', 'H', 'V', 'B', '9', '8', '7'];
const TROEFVOLGORDE = ['B', '9', 'A', '10', 'H', 'V', '8', '7'];
function sorteerHand(kaarten, troef) {
  return kaarten.slice().sort((a, b) => {
    if (a.kleur !== b.kleur) {
      if (a.kleur === troef) return -1;
      if (b.kleur === troef) return 1;
      return KLEURVOLGORDE.indexOf(a.kleur) - KLEURVOLGORDE.indexOf(b.kleur);
    }
    const orde = a.kleur === troef ? TROEFVOLGORDE : RANGVOLGORDE;
    return orde.indexOf(a.rang) - orde.indexOf(b.rang);
  });
}

function knoppenRechtsonder(spel) {
  if (!spel.potje) return '';
  return `<div class="knoppen-rechts">
    <button class="knop" data-actie="wisselLaatsteSlag" ${spel.laatsteSlag ? '' : 'disabled'}>Laatste slag</button>
  </div>`;
}

function laatsteSlagVenster(spel) {
  if (!spel.toonLaatsteSlag || !spel.laatsteSlag) return '';
  const s = spel.laatsteSlag;
  return `<div class="venster-achter" data-actie="wisselLaatsteSlag"><div class="venster">
    <h2>Laatste slag</h2>
    <div class="rij-kaarten">${s.kaarten.map((x) => `<div class="met-naam">${kaartHtml(x.kaart)}<div>${SPELERS[x.speler].naam}</div></div>`).join('')}</div>
    <p>Gewonnen door ${SPELERS[s.winnaar].naam} · ${s.punten} punten${s.roem.totaal ? ` · ${s.roem.totaal} roem` : ''}</p>
    <button class="knop">Sluiten</button>
  </div></div>`;
}

function uitslagVenster(spel) {
  if (spel.fase !== 'potjeKlaar' && spel.fase !== 'partijKlaar') return '';
  const u = spel.uitslag;
  let kop = 'Potje afgelopen';
  let uitleg = '';
  if (u.verzaakt) {
    kop = 'Verzaakt!';
    const v = u.verzaakt;
    uitleg = `${SPELERS[v.speler].naam} speelde ${kaartNaam(v.kaart)}, maar dat mocht niet. De tegenpartij krijgt 162 + 100 punten en alle roem.`;
  } else if (u.nat) {
    kop = spel.potje.spelendTeam === 0 ? 'Wij zijn nat' : 'Zij zijn nat';
  } else if (u.pit !== null) {
    kop = u.pit === 0 ? 'Pit voor wij!' : 'Pit voor zij!';
  }
  const partijKlaar = spel.fase === 'partijKlaar';
  const t = spel.partij.totaal;
  const eind = partijKlaar
    ? `<p class="eindstand">${t[0] > t[1] ? 'Wij winnen de partij!' : t[0] < t[1] ? 'Zij winnen de partij.' : 'Gelijkspel.'}</p>`
    : '';
  return `<div class="venster-achter"><div class="venster">
    <h2>${kop}</h2>
    ${uitleg ? `<p>${uitleg}</p>` : ''}
    <table class="uitslag">
      <tr><th></th><th>Punten</th><th>Roem</th><th>Totaal</th></tr>
      <tr><td>Wij</td><td>${u.punten[0]}</td><td>${u.roem[0]}</td><td>${u.totaal[0]}</td></tr>
      <tr><td>Zij</td><td>${u.punten[1]}</td><td>${u.roem[1]}</td><td>${u.totaal[1]}</td></tr>
    </table>
    <p>Stand na ${spel.partij.potjes.length} van ${AANTAL_POTJES} potjes: Wij ${t[0]} · Zij ${t[1]}</p>
    ${eind}
    ${partijKlaar
      ? '<button class="knop groot" data-actie="nieuwePartij">Nieuwe partij</button>'
      : '<button class="knop groot" data-actie="volgendPotje">Volgend potje</button>'}
  </div></div>`;
}

export function render(el, spel, acties) {
  el.innerHTML = `
    ${topbalk(spel)}
    <main class="tafel">
      <div class="laken"></div>
      ${ditPotje(spel)}
      ${[2, 1, 3, 0].map((i) => spelerHtml(spel, i)).join('')}
      ${midden(spel)}
      ${knoppenRechtsonder(spel)}
    </main>
    <div class="hint">${hint(spel)}</div>
    ${hand(spel)}
    ${laatsteSlagVenster(spel)}
    ${uitslagVenster(spel)}
  `;
  if (!el.dataset.luistert) {
    el.dataset.luistert = '1';
    el.addEventListener('click', (e) => {
      const kaart = e.target.closest('[data-kaart]');
      if (kaart && kaart.closest('.hand')) return acties.tikKaart(kaart.dataset.kaart);
      const knop = e.target.closest('[data-actie]');
      if (!knop || knop.disabled) return;
      const actie = knop.dataset.actie;
      if (actie === 'draai') acties.draai(knop.dataset.keuze);
      else acties[actie]?.();
    });
  }
}
