// Kaarten, het deck, schudden en delen.

export const KLEUREN = ['klaveren', 'ruiten', 'harten', 'schoppen'];
// Natuurlijke volgorde, ook gebruikt voor reeksen bij roem.
export const RANGEN = ['7', '8', '9', '10', 'B', 'V', 'H', 'A'];

export function kaart(kleur, rang) {
  if (!KLEUREN.includes(kleur)) throw new Error(`Onbekende kleur: ${kleur}`);
  if (!RANGEN.includes(rang)) throw new Error(`Onbekende rang: ${rang}`);
  return { kleur, rang };
}

export function kaartId(k) {
  return `${k.kleur}-${k.rang}`;
}

export function zelfdeKaart(a, b) {
  return a.kleur === b.kleur && a.rang === b.rang;
}

export function maakDeck() {
  const deck = [];
  for (const kleur of KLEUREN) for (const rang of RANGEN) deck.push({ kleur, rang });
  return deck;
}

// Fisher-Yates. Geeft een nieuwe array terug.
export function schud(kaarten, rng = Math.random) {
  const a = kaarten.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deelt 4 handen van 8. Delen begint bij de speler links van de deler.
// Spelers zijn 0..3; de volgende speler (links) is (i + 1) % 4.
export function deel(deck, deler) {
  if (deck.length !== 32) throw new Error('Een deck heeft 32 kaarten');
  const handen = [[], [], [], []];
  // Zoals aan tafel: per speler 3, dan 2, dan 3 kaarten.
  let pos = 0;
  for (const aantal of [3, 2, 3]) {
    for (let n = 1; n <= 4; n++) {
      const speler = (deler + n) % 4;
      for (let i = 0; i < aantal; i++) handen[speler].push(deck[pos++]);
    }
  }
  return handen;
}

export function team(speler) {
  return speler % 2; // team 0: spelers 0 en 2, team 1: spelers 1 en 3
}
