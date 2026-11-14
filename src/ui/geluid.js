// Geluid: kaart spelen, schudden en delen. Echte opnames uit Kenney's "Casino Audio" (CC0),
// bewerkt (zie assets/geluid/LICENSE.md). Testpagina om varianten te beluisteren: ontwerp/geluiden.html.
// Browsers staan geluid pas toe na een eerste tik; ontgrendel() wordt dan aangeroepen.

let ctx = null;
let aan = true;

// Welke opnames de app gebruikt voor het spelen van een kaart (afgewisseld).
// Varianten A t/m F staan in assets/geluid; Rutger kiest via de testpagina.
export const KAART_KEUZE = ['A', 'B', 'D'];

export function zetGeluid(waarde) {
  aan = waarde;
}

function context() {
  if (!aan) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx.state === 'running' ? ctx : null;
}

const url = (naam) => new URL(`../../assets/geluid/${naam}.ogg`, import.meta.url).href;
const BESTANDEN = {
  kaart: KAART_KEUZE.map((k) => `kaart-${k}`),
  schudden: ['schudden'],
  deel: ['deel'],
};
const buffers = {};
let laden = null;

function laad(c) {
  if (laden) return laden;
  const alles = [];
  for (const [soort, namen] of Object.entries(BESTANDEN)) {
    buffers[soort] = [];
    for (const naam of namen) {
      alles.push(
        fetch(url(naam))
          .then((r) => r.arrayBuffer())
          .then((data) => c.decodeAudioData(data))
          .then((b) => buffers[soort].push(b))
          .catch(() => {}),
      );
    }
  }
  laden = Promise.all(alles);
  return laden;
}

export function ontgrendel() {
  const c = context();
  if (c) laad(c);
}

// Wacht tot de geluiden geladen zijn (hoogstens 'max' ms), zodat beeld en geluid gelijk lopen.
export function gereed(max = 800) {
  const c = context();
  if (!c) return Promise.resolve();
  return Promise.race([laad(c), new Promise((ok) => setTimeout(ok, max))]);
}

// Speelt een opname van deze soort; geeft de duur in seconden (0 als er niets speelde).
function speel(soort, { sterkte = 1, toonhoogte = 1 } = {}) {
  const c = context();
  if (!c) return 0;
  laad(c);
  const lijst = buffers[soort];
  if (!lijst?.length) return 0;
  const b = lijst[Math.floor(Math.random() * lijst.length)];
  const bron = c.createBufferSource();
  bron.buffer = b;
  bron.playbackRate.value = toonhoogte;
  const g = c.createGain();
  g.gain.value = sterkte;
  bron.connect(g).connect(c.destination);
  bron.start();
  return b.duration / toonhoogte;
}

export function kaartNeer() {
  speel('kaart', { toonhoogte: 0.95 + Math.random() * 0.1 });
}

export function schudden() {
  return speel('schudden');
}

export function deelTik() {
  speel('deel', { toonhoogte: 0.9 + Math.random() * 0.2, sterkte: 0.8 + Math.random() * 0.2 });
}
