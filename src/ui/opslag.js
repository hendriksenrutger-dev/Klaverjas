// Opslag in localStorage. Alle Rutgers apps delen hetzelfde origin, dus alleen sleutels met 'klaverjas_'.
// Elke lees- en schrijfactie staat in try/catch: opslag kan geblokkeerd of vol zijn.

const SLEUTEL_INSTELLINGEN = 'klaverjas_instellingen';
const SLEUTEL_PARTIJ = 'klaverjas_partij';
const VERSIE = 1;

export const STANDAARD = Object.freeze({
  systeem: 'amsterdams',
  rondesVoorOpnieuwDelen: 2,
  verzaakbescherming: true,
  niveau: 'normaal',
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
  if (!Array.isArray(i.namen) || i.namen.length !== 4) i.namen = [...STANDAARD.namen];
  i.namen = i.namen.map((n, k) => (typeof n === 'string' && n.trim() ? n.trim().slice(0, 16) : STANDAARD.namen[k]));
  return i;
}

export function bewaarInstellingen(instellingen) {
  schrijf(SLEUTEL_INSTELLINGEN, { instellingen });
}

export function laadPartij() {
  return lees(SLEUTEL_PARTIJ)?.spel ?? null;
}

export function bewaarPartij(spel) {
  schrijf(SLEUTEL_PARTIJ, { spel });
}

export function wisPartij() {
  try {
    localStorage.removeItem(SLEUTEL_PARTIJ);
  } catch {
    // niets
  }
}
