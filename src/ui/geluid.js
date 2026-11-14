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
  context();
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

// Kaart neerleggen: "fffft". Hoge, zachte sis die kort aanzwelt en eindigt met een tikje.
export function kaartNeer() {
  const c = context();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const duur = 0.2 + Math.random() * 0.04;

  const bron = ruis(c);
  const hoog = c.createBiquadFilter();
  hoog.type = 'highpass';
  hoog.frequency.value = 2200;
  const kleur = c.createBiquadFilter();
  kleur.type = 'peaking';
  kleur.frequency.value = 5500;
  kleur.Q.value = 0.8;
  kleur.gain.value = 5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.1 * VOLUME, t + 0.05); // ff…
  g.gain.linearRampToValueAtTime(0.17 * VOLUME, t + duur - 0.03); // …ff…
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur); // …t
  bron.connect(hoog).connect(kleur).connect(g).connect(c.destination);
  bron.start(t, Math.random() * 0.5, duur + 0.05);

  tik(c, t + duur - 0.012, { freq: 3800, q: 1.5, duur: 0.025, volume: 0.14 });
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
