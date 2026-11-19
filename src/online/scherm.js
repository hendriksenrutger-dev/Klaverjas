// Schermen voor online spelen: tafel maken of meedoen, en de wachtruimte.

const PLEKNAAM = ['Zuid', 'West', 'Noord', 'Oost'];
const veilig = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function regelTekst(r = {}) {
  return [
    r.systeem === 'rotterdams' ? 'Rotterdams' : 'Amsterdams',
    r.troefkeuze === 'verplicht' ? 'troefkeuze verplicht' : 'troef draaien',
    r.verzaakbescherming === false ? 'zonder verzaakbescherming' : 'met verzaakbescherming',
  ].join(' · ');
}

function kiesScherm(o, regels) {
  return `<main class="online">
    <h1>Online spelen</h1>
    <label class="online-veld">Jouw naam
      <input type="text" maxlength="16" data-online="naam" value="${veilig(o.naam)}" autocomplete="off" enterkeyhint="done" placeholder="Bijvoorbeeld Rutger"></label>
    <div class="online-blokken">
      <section class="online-blok">
        <h2>Tafel maken</h2>
        <p class="licht">${regelTekst(regels)}<br>Dit zijn jouw instellingen; je kunt ze vooraf aanpassen bij Instellingen.</p>
        <button class="knop goud" data-actie="onlineMaak" ${o.bezig ? 'disabled' : ''}>Tafel maken</button>
      </section>
      <section class="online-blok">
        <h2>Meedoen</h2>
        <label class="online-veld">Code van de tafel
          <input type="text" maxlength="4" data-online="code" value="${veilig(o.code)}" autocomplete="off" autocapitalize="characters" enterkeyhint="go" placeholder="ABCD"></label>
        <button class="knop goud" data-actie="onlineMeedoen" ${o.bezig ? 'disabled' : ''}>Meedoen</button>
      </section>
    </div>
    ${o.fout ? `<p class="online-fout">${veilig(o.fout)}</p>` : ''}
    <div class="venster-knoppen"><button class="knop" data-actie="onlineTerug">Terug</button></div>
  </main>`;
}

function wachtScherm(o) {
  const b = o.beeld;
  const ik = b.ik;
  const bezet = new Map(b.plekken.map((p) => [p.plek, p]));
  const makerNaam = b.plekken.find((p) => p.maker)?.naam ?? 'de maker';
  // Jij zit altijd onderaan; de anderen rond de tafel zoals aan een echte tafel.
  const positie = ['onder', 'links', 'boven', 'rechts'];
  const stoel = (plek) => {
    const p = bezet.get(plek);
    const wij = (plek - ik + 4) % 2 === 0;
    const pos = positie[(plek - ik + 4) % 4];
    if (p) {
      return `<div class="online-stoel ${pos} ${plek === ik ? 'ik' : ''}">
        <b>${veilig(p.naam)}</b>
        <span>${PLEKNAAM[plek]} · ${plek === ik ? 'jij' : wij ? 'jouw maat' : 'tegenstander'}${p.maker ? ' · maker' : ''}</span></div>`;
    }
    return `<div class="online-stoel ${pos} vrij">
      <b>Computer</b><span>${PLEKNAAM[plek]} · ${wij ? 'jouw maat' : 'tegenstander'}</span>
      ${b.status === 'wachten' ? `<button class="knop licht klein" data-actie="onlinePlek" data-plek="${plek}">Hier zitten</button>` : ''}</div>`;
  };
  const gestart = b.status !== 'wachten';
  return `<main class="online">
    <h1>Tafel <span class="online-code">${veilig(b.code)}</span></h1>
    <p class="licht">${regelTekst(b.regels)}</p>
    ${gestart ? '' : `<div class="venster-knoppen"><button class="knop licht" data-actie="onlineDeel">Link delen</button></div>`}
    <div class="online-tafel">
      ${[0, 1, 2, 3].map(stoel).join('')}
      <div class="online-midden">${gestart ? 'Gestart' : `${b.plekken.length} van 4`}</div>
    </div>
    ${gestart
      ? '<p class="online-melding">De tafel is gestart. Het spelen zelf komt in de volgende stap van de bouw.</p>'
      : b.maker
        ? '<p class="licht">Lege plekken speelt de computer. Start als iedereen er is.</p>'
        : `<p class="licht">Wachten tot ${veilig(makerNaam)} de tafel start.</p>`}
    ${o.fout ? `<p class="online-fout">${veilig(o.fout)}</p>` : ''}
    <div class="venster-knoppen">
      <button class="knop" data-actie="onlineVerlaat">${b.maker && !gestart ? 'Tafel opheffen' : 'Verlaten'}</button>
      ${b.maker && !gestart ? `<button class="knop goud" data-actie="onlineStart" ${o.bezig ? 'disabled' : ''}>Start</button>` : ''}
    </div>
  </main>`;
}

export function onlineScherm(o, regels) {
  return `<div class="laken"></div>${o.beeld ? wachtScherm(o) : kiesScherm(o, regels)}`;
}
