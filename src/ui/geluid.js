// Geluid: kaart spelen, schudden en delen. Echte opnames uit Kenney's "Casino Audio" (CC0),
// bewerkt: lage tonen weggefilterd, stilte bijgesneden, volume gelijkgetrokken (zie assets/geluid/LICENSE.md).
// Browsers staan geluid pas toe na een eerste tik; ontgrendel() wordt dan aangeroepen.

let ctx = null;
let aan = true;
const VOLUME = 1.0; // algemene sterkte

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
  kaart: ['kaart-1', 'kaart-2', 'kaart-3', 'kaart-4'],
  schudden: ['schudden'],
  delen: ['delen'],
};
const buffers = {}; // soort -> [AudioBuffer]
let geladen = false;

function laad(c) {
  if (geladen) return;
  geladen = true;
  for (const [soort, namen] of Object.entries(BESTANDEN)) {
    buffers[soort] = [];
    for (const naam of namen) {
      fetch(url(naam))
        .then((r) => r.arrayBuffer())
        .then((data) => c.decodeAudioData(data))
        .then((b) => buffers[soort].push(b))
        .catch(() => {});
    }
  }
}

export function ontgrendel() {
  const c = context();
  if (c) laad(c);
}

// Speelt een willekeurige opname van deze soort; geeft de duur in seconden (0 als er niets speelde).
function speel(soort, wanneer = 0, sterkte = 1) {
  const c = context();
  if (!c) return 0;
  laad(c);
  const lijst = buffers[soort];
  if (!lijst?.length) return 0;
  const b = lijst[Math.floor(Math.random() * lijst.length)];
  const bron = c.createBufferSource();
  bron.buffer = b;
  const g = c.createGain();
  g.gain.value = VOLUME * sterkte;
  bron.connect(g).connect(c.destination);
  bron.start(c.currentTime + wanneer);
  return b.duration;
}

export function kaartNeer() {
  speel('kaart');
}

// Schudden en daarna delen.
export function schudden() {
  const duur = speel('schudden');
  if (duur) speel('delen', Math.max(0, duur - 0.25));
}
