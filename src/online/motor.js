// Spelverloop van een online tafel. Draait op de server (Supabase-functie) en is puur:
// geen opslag, geen scherm. De staat bevat alle kaarten; zicht() geeft per plek alleen
// wat die speler mag zien.

import * as R from '../regels/index.js';

// Nieuwe partij. regels: { systeem, troefkeuze, verzaakbescherming, rondesVoorOpnieuwDelen }.
export function start(regels = {}, rng = Math.random) {
  const instellingen = {
    systeem: regels.systeem === 'rotterdams' ? 'rotterdams' : 'amsterdams',
    troefkeuze: regels.troefkeuze === 'verplicht' ? 'verplicht' : 'traditioneel',
    verzaakbescherming: regels.verzaakbescherming !== false,
    rondesVoorOpnieuwDelen: regels.rondesVoorOpnieuwDelen === 3 ? 3 : 2,
  };
  const partij = R.nieuwePartij({ instellingen, eersteDeler: Math.floor(rng() * 4) });
  return deel({ partij, opnieuwGedeeld: 0, zetten: 0 }, rng);
}

function deel(staat, rng) {
  const { handen, draaien } = R.deelRonde(staat.partij, rng);
  return { ...staat, fase: 'draaien', handen, draaien, keuzes: [], potje: null, uitslag: null, laatsteDraai: null };
}

// Voert een zet uit van de speler op 'plek'. Gooit een fout als de zet niet mag.
// zet: { soort: 'draai', keuze } | { soort: 'troef', kleur } | { soort: 'kaart', kaart } | { soort: 'volgende' }
export function doe(staat, plek, zet, rng = Math.random) {
  let s = { ...staat, zetten: (staat.zetten ?? 0) + 1 };
  if (zet.soort === 'draai') {
    if (s.fase !== 'draaien' || s.draaien.verplicht) throw new Error('Nu wordt er niet gedraaid');
    const kleur = s.draaien.kaart.kleur;
    const draaien = R.beslis(s.draaien, plek, zet.keuze);
    s = { ...s, draaien, keuzes: [...s.keuzes, { speler: plek, kleur, keuze: zet.keuze }] };
    if (draaien.uitkomst?.soort === 'spelen') return begin(s);
    if (draaien.uitkomst?.soort === 'opnieuwDelen') {
      return deel({ ...s, partij: R.naOpnieuwDelen(s.partij), opnieuwGedeeld: s.opnieuwGedeeld + 1 }, rng);
    }
    return s;
  }
  if (zet.soort === 'troef') {
    if (s.fase !== 'draaien' || !s.draaien.verplicht) throw new Error('Nu kies je geen troef');
    return begin({ ...s, draaien: R.kiesTroef(s.draaien, plek, zet.kleur) });
  }
  if (zet.soort === 'kaart') {
    if (s.fase !== 'spelen') throw new Error('Er wordt nu niet gespeeld');
    const potje = R.speelKaart(s.potje, plek, zet.kaart);
    s = { ...s, potje };
    if (!potje.klaar) return s;
    const uitslag = R.uitslag(potje);
    const partij = R.rondPotjeAf(s.partij, potje);
    return { ...s, partij, uitslag, fase: R.partijKlaar(partij) ? 'partijKlaar' : 'potjeKlaar' };
  }
  if (zet.soort === 'volgende') {
    if (s.fase !== 'potjeKlaar') throw new Error('Het potje is nog niet klaar');
    return deel(s, rng);
  }
  throw new Error('Onbekende zet');
}

function begin(s) {
  const u = s.draaien.uitkomst;
  const potje = R.startPotje(s.partij, s.handen, u);
  return { ...s, fase: 'spelen', potje, laatsteDraai: { speler: u.speler, kleur: u.troef } };
}

// Wie moet nu iets doen? Geeft { plek, soort } of null.
export function aanZet(staat) {
  if (staat.fase === 'draaien') return { plek: staat.draaien.beurt, soort: staat.draaien.verplicht ? 'troef' : 'draai' };
  if (staat.fase === 'spelen') return { plek: staat.potje.beurt, soort: 'kaart' };
  return null;
}

// Wat speler 'plek' mag zien (alles in vaste plekken 0-3; de app draait het zelf zo dat jij onderaan zit).
export function zicht(staat, plek) {
  const { partij, draaien, potje } = staat;
  const huidigeKleur = draaien.kaart?.kleur ?? null;
  return {
    fase: staat.fase,
    zetten: staat.zetten,
    opnieuwGedeeld: staat.opnieuwGedeeld,
    partij: { totaal: partij.totaal, aantalPotjes: partij.potjes.length, deler: partij.deler, instellingen: partij.instellingen },
    draaien: {
      kaart: draaien.kaart ?? null,
      beurt: draaien.beurt,
      verplicht: Boolean(draaien.verplicht),
      uitkomst: draaien.uitkomst,
      keuzes: staat.keuzes.filter((k) => k.kleur === huidigeKleur && k.keuze === 'passen').map((k) => k.speler),
    },
    laatsteDraai: staat.laatsteDraai,
    hand: (potje ? potje.handen[plek] : staat.handen[plek]).slice(),
    aantallen: (potje ? potje.handen : staat.handen).map((h) => h.length),
    potje: potje && {
      troef: potje.troef, spelendTeam: potje.spelendTeam, systeem: potje.systeem, verzaakbescherming: potje.verzaakbescherming,
      slag: potje.slag, slagen: potje.slagen, beurt: potje.beurt, uitkomer: potje.uitkomer, kiezer: potje.kiezer,
      klaar: potje.klaar, verzaking: potje.verzaking,
    },
    uitslag: staat.uitslag,
    // Na het potje mogen alle handen zoals ze gedeeld waren gezien worden.
    handen: staat.fase === 'potjeKlaar' || staat.fase === 'partijKlaar' ? staat.handen : null,
  };
}

// Wat een computerspeler op 'plek' weet (zelfde vorm als waarneming() van de AI).
export function computerVraag(staat, plek) {
  const z = aanZet(staat);
  if (!z || z.plek !== plek) return null;
  if (z.soort === 'kaart') {
    const p = staat.potje;
    return {
      plek, soort: 'kaart',
      waarneming: {
        speler: plek, hand: p.handen[plek].slice(), troef: p.troef, spelendTeam: p.spelendTeam, systeem: p.systeem,
        slagen: p.slagen, slag: p.slag.slice(), aantallen: p.handen.map((h) => h.length), uitkomer: p.uitkomer ?? null, kiezer: p.kiezer ?? null,
      },
    };
  }
  const opties = { speler: plek, deler: staat.partij.deler, systeem: staat.partij.instellingen.systeem };
  return z.soort === 'draai'
    ? { plek, soort: 'draai', hand: staat.handen[plek].slice(), kleur: staat.draaien.kaart.kleur, opties }
    : { plek, soort: 'troef', hand: staat.handen[plek].slice(), opties };
}
