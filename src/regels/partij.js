// Een partij van 16 potjes.

import { maakDeck, schud, deel } from './kaarten.js';
import { nieuwDraaien } from './draaien.js';
import { nieuwPotje, uitslag } from './potje.js';
import { AMSTERDAMS } from './geldig.js';

export const AANTAL_POTJES = 16;

export const STANDAARD_INSTELLINGEN = Object.freeze({
  systeem: AMSTERDAMS, // of 'rotterdams'
  rondesVoorOpnieuwDelen: 2, // of 3
  verzaakbescherming: true,
  // Wie deelt opnieuw na rondpassen. Afgesproken met Rutger: dezelfde deler.
  opnieuwDelenDoor: 'zelfde',
});

export function nieuwePartij({ instellingen = {}, eersteDeler = 0 } = {}) {
  return {
    instellingen: { ...STANDAARD_INSTELLINGEN, ...instellingen },
    deler: eersteDeler,
    potjes: [], // uitslagen
    totaal: [0, 0],
  };
}

export function partijKlaar(partij) {
  return partij.potjes.length >= AANTAL_POTJES;
}

export function potjeNummer(partij) {
  return partij.potjes.length + 1;
}

// Schudt en deelt, en legt een aparte geschudde stapel klaar om te draaien.
export function deelRonde(partij, rng = Math.random) {
  const handen = deel(schud(maakDeck(), rng), partij.deler);
  const draaien = nieuwDraaien({
    stapel: schud(maakDeck(), rng),
    deler: partij.deler,
    maxRondes: partij.instellingen.rondesVoorOpnieuwDelen,
  });
  return { handen, draaien };
}

// Na rondpassen: niemand speelt, het potje telt niet mee.
export function naOpnieuwDelen(partij) {
  const deler = partij.instellingen.opnieuwDelenDoor === 'volgende' ? (partij.deler + 1) % 4 : partij.deler;
  return { ...partij, deler };
}

// Start het potje nadat iemand heeft gekozen om te spelen.
// Uitkomen gaat de tafel rond: altijd de speler links van de deler.
export function startPotje(partij, handen, draaiUitkomst) {
  if (draaiUitkomst?.soort !== 'spelen') throw new Error('Er speelt niemand');
  return nieuwPotje({
    handen,
    troef: draaiUitkomst.troef,
    spelendTeam: draaiUitkomst.team,
    uitkomer: (partij.deler + 1) % 4,
    systeem: partij.instellingen.systeem,
    verzaakbescherming: partij.instellingen.verzaakbescherming,
  });
}

export function rondPotjeAf(partij, potje) {
  if (partijKlaar(partij)) throw new Error('De partij is al afgelopen');
  const u = uitslag(potje);
  return {
    ...partij,
    potjes: [...partij.potjes, u],
    totaal: [partij.totaal[0] + u.totaal[0], partij.totaal[1] + u.totaal[1]],
    deler: (partij.deler + 1) % 4,
  };
}
