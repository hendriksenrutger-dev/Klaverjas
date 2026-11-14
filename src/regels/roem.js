// Roem in een slag. Roem gaat naar het team dat de slag wint.

import { RANGEN } from './kaarten.js';

export const ROEM = {
  driekaart: 20,
  vierkaart: 50,
  stuk: 20, // heer + vrouw van troef in dezelfde slag
  vierBoeren: 200,
  vierGelijk: 100, // vier azen, tienen, heren of vrouwen
  pit: 100, // bonus als de spelende partij alle slagen haalt
};

// Vier zevens, achten of negens leveren geen roem op.
const VIER_GELIJK_WAARDE = { B: ROEM.vierBoeren, A: ROEM.vierGelijk, 10: ROEM.vierGelijk, H: ROEM.vierGelijk, V: ROEM.vierGelijk };

// kaarten: de (maximaal 4) kaarten van een slag.
// Geeft { totaal, items: [{ soort, punten }] }.
export function roemInSlag(kaarten, troef) {
  const items = [];

  // Reeksen: opeenvolgend in natuurlijke volgorde 7-8-9-10-B-V-H-A, zelfde kleur.
  const perKleur = new Map();
  for (const k of kaarten) {
    if (!perKleur.has(k.kleur)) perKleur.set(k.kleur, new Set());
    perKleur.get(k.kleur).add(RANGEN.indexOf(k.rang));
  }
  for (const indices of perKleur.values()) {
    let langste = 0;
    for (const i of indices) {
      if (indices.has(i - 1)) continue; // geen begin van een reeks
      let lengte = 1;
      while (indices.has(i + lengte)) lengte++;
      langste = Math.max(langste, lengte);
    }
    if (langste >= 4) items.push({ soort: 'vierkaart', punten: ROEM.vierkaart });
    else if (langste === 3) items.push({ soort: 'driekaart', punten: ROEM.driekaart });
  }

  // Stuk, los van een eventuele reeks.
  const heeft = (rang) => kaarten.some((k) => k.kleur === troef && k.rang === rang);
  if (heeft('H') && heeft('V')) items.push({ soort: 'stuk', punten: ROEM.stuk });

  // Vier gelijke kaarten.
  if (kaarten.length === 4 && kaarten.every((k) => k.rang === kaarten[0].rang)) {
    const waarde = VIER_GELIJK_WAARDE[kaarten[0].rang];
    if (waarde) {
      items.push({ soort: kaarten[0].rang === 'B' ? 'vierBoeren' : 'vierGelijk', punten: waarde });
    }
  }

  return { totaal: items.reduce((s, i) => s + i.punten, 0), items };
}
