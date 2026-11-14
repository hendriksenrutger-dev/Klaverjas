// Geluid: schudden en kaarten neerleggen. Zelf opgewekt met de Web Audio API,
// dus geen geluidsbestanden nodig en volledig offline.
// Browsers staan geluid pas toe na een eerste tik; ontgrendel() wordt dan aangeroepen.

let ctx = null;
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
  g.gain.exponentialRampToValueAtTime(volume, t + Math.min(0.012, duur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  bron.connect(filter).connect(g).connect(c.destination);
  bron.start(t, Math.random() * 0.5, duur + 0.02);
}

// Zachte plof van een kaart op het laken.
function plof(c, t, volume = 0.25) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.06);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.18);
}

// Een kaart die over het laken schuift en tot stilstand komt:
// zachte, gefilterde ruis die langzaam aanzwelt en wegsterft, met een dalende toon.
export function kaartNeer() {
  const c = context();
  if (!c) return;
  const t = c.currentTime + 0.01;
  const duur = 0.32 + Math.random() * 0.06;

  const bron = ruis(c);
  const laag = c.createBiquadFilter();
  laag.type = 'lowpass';
  laag.frequency.setValueAtTime(3800, t);
  laag.frequency.exponentialRampToValueAtTime(900, t + duur);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 0.6;
  band.frequency.setValueAtTime(2200 + Math.random() * 400, t);
  band.frequency.exponentialRampToValueAtTime(700, t + duur);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.05); // aanzetten
  g.gain.setValueAtTime(0.32, t + 0.09);
  g.gain.exponentialRampToValueAtTime(0.12, t + duur * 0.7); // schuiven
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur); // stilstaan

  bron.connect(laag).connect(band).connect(g).connect(c.destination);
  bron.start(t, Math.random() * 0.5, duur + 0.05);
}

// Schudden: twee keer ritsen (veel snelle tikjes die vertragen) en daarna de stapel recht tikken.
export function schudden() {
  const c = context();
  if (!c) return;
  let t = c.currentTime + 0.02;
  for (let ronde = 0; ronde < 2; ronde++) {
    const aantal = 22;
    for (let i = 0; i < aantal; i++) {
      const voortgang = i / aantal;
      tik(c, t, {
        freq: 3200 + Math.random() * 1800,
        q: 1.4,
        duur: 0.03 + Math.random() * 0.015,
        volume: 0.12 + 0.18 * Math.sin(Math.PI * voortgang),
      });
      t += 0.03 + voortgang * 0.035; // eerst sneller, dan langzamer
    }
    t += 0.25;
    // stapel samenschuiven
    tik(c, t, { freq: 900, q: 0.6, duur: 0.25, volume: 0.25 });
    t += 0.35;
  }
  // recht tikken op tafel
  plof(c, t, 0.3);
  tik(c, t, { freq: 1500, q: 0.8, duur: 0.05, volume: 0.3 });
}
