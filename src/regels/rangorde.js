// Rangorde, puntwaarden en de winnaar van een slag.

// Van laag naar hoog.
const ORDE_TROEF = ['7', '8', 'V', 'H', '10', 'A', '9', 'B'];
const ORDE_NIET_TROEF = ['7', '8', '9', 'B', 'V', 'H', '10', 'A'];

const PUNTEN_TROEF = { B: 20, 9: 14, A: 11, 10: 10, H: 4, V: 3, 8: 0, 7: 0 };
const PUNTEN_NIET_TROEF = { A: 11, 10: 10, H: 4, V: 3, B: 2, 9: 0, 8: 0, 7: 0 };

export const PUNTEN_LAATSTE_SLAG = 10;
export const PUNTEN_PER_POTJE = 162; // 152 kaartpunten + 10 voor de laatste slag

export function punten(k, troef) {
  return k.kleur === troef ? PUNTEN_TROEF[k.rang] : PUNTEN_NIET_TROEF[k.rang];
}

// Sterkte binnen de eigen kleur (0..7). Troef en niet-troef hebben een eigen volgorde.
export function sterkte(k, troef) {
  return (k.kleur === troef ? ORDE_TROEF : ORDE_NIET_TROEF).indexOf(k.rang);
}

// Wint kaart a van kaart b, gegeven de gevraagde kleur?
export function slaatOver(a, b, gevraagd, troef) {
  const aTroef = a.kleur === troef;
  const bTroef = b.kleur === troef;
  if (aTroef !== bTroef) return aTroef;
  if (a.kleur !== b.kleur) return a.kleur === gevraagd; // b is dan niet gevraagd of ook niet
  return sterkte(a, troef) > sterkte(b, troef);
}

// slag: [{ speler, kaart }] in speelvolgorde. Geeft het winnende element terug.
export function huidigeWinnaar(slag, troef) {
  if (slag.length === 0) return null;
  const gevraagd = slag[0].kaart.kleur;
  let best = slag[0];
  for (let i = 1; i < slag.length; i++) {
    if (slaatOver(slag[i].kaart, best.kaart, gevraagd, troef)) best = slag[i];
  }
  return best;
}

export function slagPunten(kaarten, troef) {
  return kaarten.reduce((som, k) => som + punten(k, troef), 0);
}
