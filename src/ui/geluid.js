// Geluid: schudden en kaarten neerleggen. Zelf opgewekt met de Web Audio API,
// dus geen geluidsbestanden nodig en volledig offline.
// Browsers staan geluid pas toe na een eerste tik; ontgrendel() wordt dan aangeroepen.

let ctx = null;
const VOLUME = 2.2; // algemene sterkte
let aan = true;

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

export function ontgrendel() {
  const c = context();
  if (c) laadKaartGeluiden(c);
}

let ruisBuffer = null;
function ruis(c) {
  if (!ruisBuffer) {
    ruisBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = ruisBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const bron = c.createBufferSource();
  bron.buffer = ruisBuffer;
  return bron;
}

// Eén kort tikje papier: gefilterde ruis met een snelle uitsterving.
function tik(c, t, { freq = 2500, q = 0.9, duur = 0.06, volume = 0.5 } = {}) {
  const bron = ruis(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume * VOLUME, t + Math.min(0.012, duur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  bron.connect(filter).connect(g).connect(c.destination);
  bron.start(t, Math.random() * 0.5, duur + 0.02);
}

// Kaart neerleggen: een echte opname ("cardSlide" uit Kenney's Casino Audio, CC0).
// Vier varianten, willekeurig gekozen, zodat het niet steeds hetzelfde klinkt.
const KAART_BESTANDEN = [1, 2, 3, 4].map((n) => new URL(`../../assets/geluid/kaart-${n}.ogg`, import.meta.url).href);
let kaartBuffers = null;

function laadKaartGeluiden(c) {
  if (kaartBuffers) return;
  kaartBuffers = [];
  for (const url of KAART_BESTANDEN) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => kaartBuffers.push(buffer))
      .catch(() => {});
  }
}

export function kaartNeer() {
  const c = context();
  if (!c) return;
  laadKaartGeluiden(c);
  if (!kaartBuffers.length) return;
  const bron = c.createBufferSource();
  bron.buffer = kaartBuffers[Math.floor(Math.random() * kaartBuffers.length)];
  const g = c.createGain();
  g.gain.value = 0.9;
  bron.connect(g).connect(c.destination);
  bron.start();
}

// Schudden: "prrrrt". Eén snelle, gelijkmatige roffel van kaarten die over elkaar ritsen,
// met een zacht begin (p) en een tikje aan het eind (t).
export function schudden() {
  const c = context();
  if (!c) return;
  let t = c.currentTime + 0.02;

  // p
  tik(c, t, { freq: 1200, q: 0.7, duur: 0.06, volume: 0.18 });
  t += 0.05;

  // rrrr: ~38 tikjes per seconde, licht onregelmatig
  const aantal = 34;
  const begin = t;
  for (let i = 0; i < aantal; i++) {
    const v = i / aantal;
    tik(c, t, {
      freq: 2600 + Math.random() * 1600,
      q: 1.3,
      duur: 0.022,
      volume: 0.13 + 0.1 * Math.sin(Math.PI * Math.min(1, v * 1.2)),
    });
    t += 0.026 + (Math.random() - 0.5) * 0.006;
  }
  // zachte ruis onder de roffel
  const bron = ruis(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3000;
  f.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, begin);
  g.gain.linearRampToValueAtTime(0.05 * VOLUME, begin + 0.1);
  g.gain.linearRampToValueAtTime(0.0001, t);
  bron.connect(f).connect(g).connect(c.destination);
  bron.start(begin, 0, t - begin + 0.05);

  // t
  tik(c, t + 0.02, { freq: 3200, q: 1.2, duur: 0.035, volume: 0.35 });
}
