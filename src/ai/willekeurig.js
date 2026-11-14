// Eenvoudige computerspeler voor fase 2: kiest willekeurig uit wat mag.
// Wordt in fase 4 vervangen door de simulatie-AI.

export const KANS_SPELEN = 0.3; // eigen keuze, alleen om te kunnen testen

export function kiesDraai(rng = Math.random) {
  return rng() < KANS_SPELEN ? 'spelen' : 'passen';
}

export function kiesKaart(geldig, rng = Math.random) {
  return geldig[Math.floor(rng() * geldig.length)];
}
