// Troef bepalen door te draaien van een aparte, geschudde stapel.

import { team } from './kaarten.js';

export function nieuwDraaien({ stapel, deler, maxRondes = 2 }) {
  if (maxRondes !== 2 && maxRondes !== 3) throw new Error('maxRondes is 2 of 3');
  return {
    stapel,
    positie: 0,
    kaart: stapel[0],
    gepast: [], // kleuren waarop iedereen al gepast heeft
    rondes: 0,
    pasTeller: 0,
    deler,
    beurt: (deler + 1) % 4,
    maxRondes,
    uitkomst: null, // { soort: 'spelen', troef, speler, team } of { soort: 'opnieuwDelen' }
  };
}

export function beslis(d, speler, keuze) {
  if (d.uitkomst) throw new Error('Het draaien is al afgelopen');
  if (speler !== d.beurt) throw new Error(`Speler ${speler} is niet aan de beurt`);

  if (keuze === 'spelen') {
    return { ...d, uitkomst: { soort: 'spelen', troef: d.kaart.kleur, speler, team: team(speler) } };
  }
  if (keuze !== 'passen') throw new Error(`Onbekende keuze: ${keuze}`);

  const pasTeller = d.pasTeller + 1;
  if (pasTeller < 4) return { ...d, pasTeller, beurt: (speler + 1) % 4 };

  // Iedereen heeft gepast op deze kleur.
  const gepast = [...d.gepast, d.kaart.kleur];
  const rondes = d.rondes + 1;
  if (rondes >= d.maxRondes) {
    return { ...d, gepast, rondes, pasTeller: 0, uitkomst: { soort: 'opnieuwDelen' } };
  }
  // Doordraaien tot er een kleur verschijnt waarop nog niet gepast is.
  let positie = d.positie + 1;
  while (gepast.includes(d.stapel[positie].kleur)) positie++;
  return {
    ...d,
    gepast,
    rondes,
    pasTeller: 0,
    positie,
    kaart: d.stapel[positie],
    beurt: (d.deler + 1) % 4,
  };
}

// Alle kaarten die tot nu toe gedraaid zijn (ook de overgeslagen).
export function gedraaideKaarten(d) {
  return d.stapel.slice(0, d.positie + 1);
}
