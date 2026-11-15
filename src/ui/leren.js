// Leren klaverjassen: de stappen van het leerpad, de voortgang en de uitlegteksten.
// Puur (geen DOM, geen opslag). Uitleg komt uit vaste regels; waar geen regel past, de standaardtekst.
import { team } from '../regels/kaarten.js';
import { huidigeWinnaar, punten } from '../regels/rangorde.js';
import { seinVan } from '../ai/simulatie.js';

export const POTJES_PER_STAP = 4;
export const STANDAARD_UITLEG = 'Deze kaart levert gemiddeld de meeste punten op.';

// Stap 1 (lessen) wordt later gebouwd.
export const STAPPEN = {
  2: { naam: 'Oefenen met open kaarten', uitleg: 'Je ziet alle kaarten. Hulp en hint staan aan.', open: true, hulp: true, hint: true, niveau: 'makkelijk' },
  3: { naam: 'Oefenen met dichte kaarten', uitleg: 'Zoals aan tafel. Hulp en hint staan aan.', open: false, hulp: true, hint: true, niveau: 'makkelijk' },
  4: { naam: 'Zelfstandig', uitleg: 'Zonder hulp, tegen normale tegenstanders. De hint blijft beschikbaar.', open: false, hulp: false, hint: true, niveau: 'normaal' },
  5: { naam: 'Echt', uitleg: 'Tegen sterke tegenstanders, zonder hulp.', open: false, hulp: false, hint: false, niveau: 'sterk' },
};
export const EERSTE_STAP = 2;
export const LAATSTE_STAP = 5;

// Regels in de oefenstand.
export const LEER_REGELS = Object.freeze({ systeem: 'amsterdams', rondesVoorOpnieuwDelen: 2, verzaakbescherming: true, troefkeuze: 'traditioneel' });

export function legeVoortgang() {
  return { open: EERSTE_STAP, potjes: {} };
}

export function compleetVoortgang(v) {
  const leeg = legeVoortgang();
  if (!v) return leeg;
  const open = Number.isInteger(v.open) ? Math.min(LAATSTE_STAP, Math.max(EERSTE_STAP, v.open)) : leeg.open;
  return { open, potjes: { ...(v.potjes ?? {}) } };
}

// Telt een gespeeld potje in een stap. Geeft { voortgang, nieuweStap } (nieuweStap = net vrijgespeeld of null).
export function telLeerPotje(v, stap) {
  const voortgang = compleetVoortgang(v);
  const potjes = { ...voortgang.potjes, [stap]: (voortgang.potjes[stap] ?? 0) + 1 };
  let open = voortgang.open;
  let nieuweStap = null;
  if (stap === open && potjes[stap] >= POTJES_PER_STAP && open < LAATSTE_STAP) {
    open += 1;
    nieuweStap = open;
  }
  return { voortgang: { open, potjes }, nieuweStap };
}

const NAAM_KLEUR = { klaveren: 'klaveren', ruiten: 'ruiten', harten: 'harten', schoppen: 'schoppen' };
const SYMBOOL = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const kaartTekst = (k) => `${SYMBOOL[k.kleur]}${k.rang}`;

// Uitleg bij roem in een slag (roem = { totaal, items }).
const ROEM_UITLEG = {
  driekaart: 'driekaart: drie opeenvolgende kaarten van één kleur',
  vierkaart: 'vierkaart: vier opeenvolgende kaarten van één kleur',
  stuk: 'stuk: heer en vrouw van troef',
  vierBoeren: 'vier boeren',
  vierGelijk: 'vier gelijke kaarten',
};
export function roemUitleg(roem) {
  if (!roem?.items?.length) return '';
  return `Roem: ${roem.items.map((r) => `${ROEM_UITLEG[r.soort] ?? r.soort} (${r.punten})`).join(' + ')}.`;
}

// Melding bij een sein van je maat. slagVoor = de slag voordat de maat bijspeelde.
export function seinUitleg(slagVoor, maat, kaart, troef, naam) {
  const sein = seinVan(slagVoor, maat, kaart, troef);
  if (!sein) return '';
  const wat = sein.kaart.rang === 'A' ? `de aas van ${NAAM_KLEUR[kaart.kleur]}` : `ook de tien van ${NAAM_KLEUR[kaart.kleur]}`;
  const hoe = sein.kaart.rang === 'A' ? 'een kleintje' : 'de aas';
  return `${naam} seint: ${hoe} (${kaartTekst(kaart)}) bijgespeeld op een slag van jullie. ${naam} heeft waarschijnlijk ${wat}.`;
}

// Uitleg bij de kaart die de hint voorstelt. Alleen vaste regels; anders de standaardtekst.
// w: { hand, slag, troef, spelendTeam, speler }, geldig: geldige kaarten, kaart: voorgestelde kaart.
export function hintUitleg(w, geldig, kaart) {
  if (geldig.length === 1) return 'Dit is de enige kaart die je mag spelen.';
  const { slag, troef, speler } = w;
  if (slag.length === 0) {
    if (kaart.kleur === troef && team(speler) === w.spelendTeam) return 'Troef trekken: zo haal je de troeven bij de tegenpartij weg.';
    return STANDAARD_UITLEG;
  }
  const sein = seinVan(slag, speler, kaart, troef);
  if (sein && w.hand.some((c) => c.kleur === sein.kaart.kleur && c.rang === sein.kaart.rang)) {
    return sein.kaart.rang === 'A'
      ? `Sein: een kleintje bijspelen op de slag van je maat betekent "ik heb de aas van ${NAAM_KLEUR[kaart.kleur]}".`
      : `Sein: de aas bijspelen op de slag van je maat betekent "ik heb ook de tien van ${NAAM_KLEUR[kaart.kleur]}".`;
  }
  const voor = huidigeWinnaar(slag, troef);
  const na = huidigeWinnaar([...slag, { speler, kaart }], troef);
  const maatWint = team(voor.speler) === team(speler) && voor.speler !== speler;
  if (maatWint && punten(kaart, troef) >= 10 && na.speler === voor.speler) return 'Je maat heeft de slag: geef hem punten.';
  if (na.speler === speler) return 'Hiermee neem je de slag.';
  if (punten(kaart, troef) === 0 && !maatWint) return 'Je kunt deze slag niet winnen: gooi een kaart zonder punten weg.';
  return STANDAARD_UITLEG;
}
