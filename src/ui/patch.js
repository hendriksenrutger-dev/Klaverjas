// Werkt het scherm bij zonder alles opnieuw te tekenen: bestaande elementen blijven staan en worden
// alleen aangepast. Zo worden kaarten (en hun plaatjes) niet steeds opnieuw opgebouwd.
// Elementen met data-sleutel worden op sleutel herkend (bijv. een kaart), de rest op volgorde.

const sjabloon = document.createElement('template');

export function patchHtml(doel, html) {
  sjabloon.innerHTML = html;
  patchKinderen(doel, sjabloon.content);
}

function sleutel(n) {
  return n.nodeType === 1 ? n.getAttribute('data-sleutel') : null;
}

function zelfdeSoort(a, b) {
  return a.nodeType === b.nodeType && a.nodeName === b.nodeName && sleutel(a) === sleutel(b);
}

function patchKinderen(oudOuder, nieuwOuder) {
  const oud = [...oudOuder.childNodes];
  const metSleutel = new Map();
  for (const n of oud) {
    const k = sleutel(n);
    if (k !== null) metSleutel.set(k, n);
  }
  const gebruikt = new Set();
  let i = 0;
  for (const nieuw of [...nieuwOuder.childNodes]) {
    const k = sleutel(nieuw);
    let kandidaat = null;
    if (k !== null) kandidaat = metSleutel.get(k) ?? null;
    else {
      // Zonder sleutel: het eerstvolgende ongebruikte oude kind van dezelfde soort.
      while (i < oud.length && (gebruikt.has(oud[i]) || sleutel(oud[i]) !== null)) i++;
      if (i < oud.length && zelfdeSoort(oud[i], nieuw)) kandidaat = oud[i];
    }
    const plek = oudOuder.childNodes[gebruikt.size] ?? null;
    if (kandidaat && !gebruikt.has(kandidaat) && zelfdeSoort(kandidaat, nieuw)) {
      werkBij(kandidaat, nieuw);
      if (kandidaat !== plek) oudOuder.insertBefore(kandidaat, plek);
      gebruikt.add(kandidaat);
      if (k === null) i++;
    } else {
      oudOuder.insertBefore(nieuw, plek);
      gebruikt.add(nieuw);
    }
  }
  for (const n of [...oudOuder.childNodes]) if (!gebruikt.has(n)) n.remove();
}

function werkBij(oud, nieuw) {
  if (oud.nodeType === 3 || oud.nodeType === 8) {
    if (oud.nodeValue !== nieuw.nodeValue) oud.nodeValue = nieuw.nodeValue;
    return;
  }
  // Attributen gelijk trekken ('open' van <details> laten zoals de gebruiker het zette).
  const behoud = (naam) => naam === 'open' && oud.nodeName === 'DETAILS';
  for (const a of [...oud.attributes]) if (!nieuw.hasAttribute(a.name) && !behoud(a.name)) oud.removeAttribute(a.name);
  for (const a of [...nieuw.attributes]) if (oud.getAttribute(a.name) !== a.value) oud.setAttribute(a.name, a.value);
  // Tekstvelden: niet overschrijven terwijl iemand typt.
  if (oud.nodeName === 'INPUT') {
    if (document.activeElement !== oud && oud.value !== nieuw.getAttribute('value')) oud.value = nieuw.getAttribute('value') ?? '';
    return;
  }
  patchKinderen(oud, nieuw);
}
