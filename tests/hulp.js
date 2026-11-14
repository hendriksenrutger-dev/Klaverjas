// Korte notatie voor tests: 'hB' = harten boer, 's10' = schoppen tien,
// k = klaveren, r = ruiten, h = harten, s = schoppen.
const KLEUR = { k: 'klaveren', r: 'ruiten', h: 'harten', s: 'schoppen' };

export function K(code) {
  return { kleur: KLEUR[code[0]], rang: code.slice(1) };
}

export function Ks(codes) {
  return codes.split(' ').filter(Boolean).map(K);
}

export function code(k) {
  const letter = Object.keys(KLEUR).find((l) => KLEUR[l] === k.kleur);
  return letter + k.rang;
}

export function codes(kaarten) {
  return kaarten.map(code).sort();
}

// Slag op tafel: begint bij speler 'start', kaarten in speelvolgorde.
export function slag(start, codesStr) {
  return Ks(codesStr).map((kaart, i) => ({ speler: (start + i) % 4, kaart }));
}
