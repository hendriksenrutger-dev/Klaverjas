// Opslag in localStorage. Alle Rutgers apps delen hetzelfde origin, dus alleen sleutels met 'klaverjas_'.
// Elke lees- en schrijfactie staat in try/catch: opslag kan geblokkeerd of vol zijn.

const SLEUTEL_INSTELLINGEN = 'klaverjas_instellingen';
const SLEUTEL_PARTIJ = 'klaverjas_partij';
const SLEUTEL_STATISTIEK = 'klaverjas_statistiek';
const VERSIE = 1;

export const STANDAARD = Object.freeze({
  systeem: 'amsterdams',
  rondesVoorOpnieuwDelen: 2,
  verzaakbescherming: true,
  niveau: 'normaal',
  geluid: true,
  vergelijk: false, // vergelijk met de computer
  gespeeld: false, // knop met overzicht van gespeelde kaarten
  troefkeuze: 'traditioneel', // of 'verplicht'
  namen: ['Zuid', 'West', 'Noord', 'Oost'],
});

function lees(sleutel) {
  try {
    const tekst = localStorage.getItem(sleutel);
    if (!tekst) return null;
    const data = JSON.parse(tekst);
    return data && data.versie === VERSIE ? data : null;
  } catch {
    return null;
  }
}

function schrijf(sleutel, data) {
  try {
    localStorage.setItem(sleutel, JSON.stringify({ versie: VERSIE, ...data }));
  } catch {
    // Opslaan mislukt (bijv. privévenster): het spel werkt gewoon door.
  }
}

export function laadInstellingen() {
  const d = lees(SLEUTEL_INSTELLINGEN);
  const i = { ...STANDAARD, ...(d?.instellingen ?? {}) };
  // Controleer waarden, zodat een oude of kapotte opslag het spel niet breekt.
  if (!['amsterdams', 'rotterdams'].includes(i.systeem)) i.systeem = STANDAARD.systeem;
  if (![2, 3].includes(i.rondesVoorOpnieuwDelen)) i.rondesVoorOpnieuwDelen = STANDAARD.rondesVoorOpnieuwDelen;
  if (typeof i.verzaakbescherming !== 'boolean') i.verzaakbescherming = STANDAARD.verzaakbescherming;
  if (!['makkelijk', 'normaal', 'sterk'].includes(i.niveau)) i.niveau = STANDAARD.niveau;
  if (typeof i.geluid !== 'boolean') i.geluid = STANDAARD.geluid;
  if (typeof i.vergelijk !== 'boolean') i.vergelijk = STANDAARD.vergelijk;
  if (typeof i.gespeeld !== 'boolean') i.gespeeld = STANDAARD.gespeeld;
  if (!['traditioneel', 'verplicht'].includes(i.troefkeuze)) i.troefkeuze = STANDAARD.troefkeuze;
  if (!Array.isArray(i.namen) || i.namen.length !== 4) i.namen = [...STANDAARD.namen];
  i.namen = i.namen.map((n, k) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 16) : STANDAARD.namen[k]));
  return i;
}

export function bewaarInstellingen(instellingen) {
  schrijf(SLEUTEL_INSTELLINGEN, { instellingen });
}

// soort: 'gewoon' (de echte partij) of 'leer' (oefenpartij uit Leren klaverjassen, apart bewaard).
const partijSleutel = (soort) => (soort === 'leer' ? 'klaverjas_leerpartij' : SLEUTEL_PARTIJ);

export function laadPartij(soort = 'gewoon') {
  return lees(partijSleutel(soort))?.spel ?? null;
}

export function bewaarPartij(spel, soort = 'gewoon') {
  schrijf(partijSleutel(soort), { spel });
}

export function laadVoortgang() {
  return lees('klaverjas_leren')?.voortgang ?? null;
}

export function bewaarVoortgang(voortgang) {
  schrijf('klaverjas_leren', { voortgang });
}

export function wisPartij() {
  try {
    localStorage.removeItem(SLEUTEL_PARTIJ);
  } catch {
    // niets
  }
}

export function laadStatistiek() {
  return lees(SLEUTEL_STATISTIEK)?.statistiek ?? null;
}

export function bewaarStatistiek(statistiek) {
  schrijf(SLEUTEL_STATISTIEK, { statistiek });
}

// Logboek van de eigen partijen (om later van te leren). Kan groot worden: apart bewaard.
export function laadLogboek() {
  return lees('klaverjas_logboek')?.logboek ?? null;
}

export function bewaarLogboek(logboek) {
  schrijf('klaverjas_logboek', { logboek });
}

// Online spelen: je naam en de tafel waar je aan zit (code en geheime sleutel).
export function laadOnline() {
  return lees('klaverjas_online')?.online ?? {};
}

export function bewaarOnline(online) {
  schrijf('klaverjas_online', { online });
}
