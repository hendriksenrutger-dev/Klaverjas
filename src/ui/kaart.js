// Kaartontwerp: eigen cijferkaarten en azen in SVG, heer/vrouw/boer met de plaatjes van Byron Knoll.

export const SYMBOOL = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
export const ROOD = new Set(['harten', 'ruiten']);

// Eigen getekende kleursymbolen (viewBox 0 0 100 100).
const VORMEN = {
  harten:
    '<path d="M50 90C47 86 6 60 6 32 6 16 18 6 31 6c9 0 15 5 19 12C54 11 60 6 69 6c13 0 25 10 25 26 0 28-41 54-44 58z"/>',
  ruiten: '<path d="M50 3C60 20 74 37 90 50 74 63 60 80 50 97 40 80 26 63 10 50 26 37 40 20 50 3z"/>',
  schoppen:
    '<path d="M50 4C56 18 94 38 94 62c0 14-10 22-21 22-9 0-15-4-19-10 1 10 5 17 13 22H33c8-5 12-12 13-22-4 6-10 10-19 10C16 84 6 76 6 62 6 38 44 18 50 4z"/>',
  klaveren:
    '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="58" r="20"/><circle cx="73" cy="58" r="20"/>' +
    '<path d="M44 50h12c0 22 4 34 13 46H31c9-12 13-24 13-46z"/>',
};

export function symboolSprite() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(VORMEN)
    .map(([k, v]) => `<symbol id="s-${k}" viewBox="0 0 100 100">${v}</symbol>`)
    .join('')}</svg>`;
}

export function symbool(kleur, klasse = '') {
  return `<svg class="sym ${klasse}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-${kleur}"/></svg>`;
}

// Posities (x, y in % van het binnenvlak), volgens het standaardpatroon.
const PIPS = {
  7: [[22, 12], [78, 12], [50, 31], [22, 50], [78, 50], [22, 88], [78, 88]],
  8: [[22, 12], [78, 12], [50, 31], [22, 50], [78, 50], [50, 69], [22, 88], [78, 88]],
  9: [[22, 12], [78, 12], [22, 37], [78, 37], [50, 50], [22, 63], [78, 63], [22, 88], [78, 88]],
  10: [[22, 12], [78, 12], [50, 25], [22, 37], [78, 37], [22, 63], [78, 63], [50, 75], [22, 88], [78, 88]],
};

const RANGNAAM = { A: 'aas', H: 'heer', V: 'vrouw', B: 'boer', 10: 'tien', 9: 'negen', 8: 'acht', 7: 'zeven' };
export function kaartNaam(k) {
  return `${k.kleur}${RANGNAAM[k.rang]}`;
}

function hoek(k, onder = false) {
  return `<div class="index ${onder ? 'onder' : ''}"><span class="rang ${k.rang === '10' ? 'tien' : ''}">${k.rang}</span>${symbool(k.kleur)}</div>`;
}

function midden(k) {
  if (k.rang === 'A') return `<div class="aas"><div class="aas-rond">${symbool(k.kleur)}</div></div>`;
  if (k.rang === 'H' || k.rang === 'V' || k.rang === 'B') {
    return `<div class="plaatje"><img src="assets/kaarten/${k.kleur}-${k.rang}.webp" alt="" draggable="false"></div>`;
  }
  return `<div class="pips">${PIPS[k.rang]
    .map(([x, y]) => `<span class="pip ${y > 50 ? 'om' : ''}" style="left:${x}%;top:${y}%">${symbool(k.kleur)}</span>`)
    .join('')}</div>`;
}

// Volledige kaart. opties: { klasse, id, data }
export function kaartHtml(k, { klasse = '', id = null } = {}) {
  return `<div class="kaart ${ROOD.has(k.kleur) ? 'rood' : 'zwart'} ${klasse}" ${id ? `data-kaart="${id}"` : ''} aria-label="${kaartNaam(k)}">
    ${hoek(k)}${midden(k)}${hoek(k, true)}
  </div>`;
}

export function rugHtml(klasse = '') {
  return `<div class="kaart rug ${klasse}"><div class="rug-vlak"><div class="rug-embleem">${symbool('klaveren')}</div></div></div>`;
}
