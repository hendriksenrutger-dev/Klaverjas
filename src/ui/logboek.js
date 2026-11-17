// Logboek van Rutgers partijen, om later van te leren (op Rutgers verzoek).
// Per afgelopen potje: de gedeelde handen, het draaien en alle slagen. Daaruit is elke zet terug te halen.
// Alles blijft op het apparaat tot Rutger het zelf exporteert. Puur: geen DOM, geen opslag.

export const LOGBOEK_VERSIE = 1;
export const MAX_POTJES = 2000; // ongeveer 125 partijen en 2 MB; daarna vallen de oudste eraf (de opslag is gedeeld met Rutgers andere apps)

const LETTER = { klaveren: 'k', ruiten: 'r', harten: 'h', schoppen: 's' };
// Korte kaartcode, bijvoorbeeld 'h10' of 'kA'.
export const code = (k) => `${LETTER[k.kleur]}${k.rang}`;

// draaiLog: [{ speler, kleur, keuze }] (keuze 'spelen' | 'passen' | 'verplicht').
export function potjeRecord({ partijId, nr, stand, deler, handen, draaiLog, potje, uitslag, niveau, troefkeuze, tijd = new Date().toISOString() }) {
  return {
    partij: partijId,
    nr,
    stand, // [wij, zij] vóór dit potje
    tijd,
    niveau,
    systeem: potje.systeem,
    troefkeuze,
    deler,
    uitkomer: potje.uitkomer,
    troef: potje.troef,
    spelendTeam: potje.spelendTeam,
    kiezer: potje.kiezer,
    handen: handen.map((h) => h.map(code)),
    draaien: (draaiLog ?? []).map((d) => [d.speler, LETTER[d.kleur] ?? '', d.keuze]),
    slagen: potje.slagen.map((s) => s.kaarten.map((x) => [x.speler, code(x.kaart)])),
    // Een verzaking stopt het potje halverwege: de lopende slag ook bewaren.
    open: potje.slag.length ? potje.slag.map((x) => [x.speler, code(x.kaart)]) : undefined,
    uitslag: { punten: uitslag.punten, roem: uitslag.roem, nat: uitslag.nat, pit: uitslag.pit, verzaakt: Boolean(uitslag.verzaakt) },
  };
}

export function legLogboek() {
  return { versie: LOGBOEK_VERSIE, potjes: [] };
}

export function voegToe(logboek, record) {
  const potjes = [...(logboek?.potjes ?? []), record];
  return { versie: LOGBOEK_VERSIE, potjes: potjes.slice(-MAX_POTJES) };
}

// Bestand om te exporteren.
export function exportTekst(logboek, app = 'Klaverjassen') {
  return JSON.stringify({ app, versie: LOGBOEK_VERSIE, gemaakt: new Date().toISOString(), ...logboek });
}
