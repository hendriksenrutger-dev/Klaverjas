// Praat met de AI-worker. Valt terug op rekenen in de hoofdthread als workers niet werken.
import { kiesKaart, kiesDraai, kiesVerplicht, waarneming, NIVEAUS, rekenTotalen, exactNodig, kortelijst, verfijn, beslis } from './simulatie.js';
import { geldigeKaarten } from '../regels/geldig.js';

// Elk kanaal heeft een eigen worker: de vergelijking met de computer rekent op de
// achtergrond en mag de zetten van de computerspelers niet ophouden.
function maakKanaal() {
let worker = null;
let volgnummer = 0;
const wachtend = new Map();

function startWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, resultaat, fout } = e.data;
      const w = wachtend.get(id);
      if (!w) return;
      wachtend.delete(id);
      if (fout) w.reject(new Error(fout));
      else w.resolve(resultaat);
    };
    worker.onerror = () => {
      // Worker kapot: alles wat wacht opnieuw doen in de hoofdthread.
      worker = false;
      for (const [, w] of wachtend) w.reserve();
      wachtend.clear();
    };
  } catch {
    worker = false;
  }
  return worker;
}

function vraag(soort, data, reserve) {
  const w = startWorker();
  if (!w) return Promise.resolve().then(reserve);
  return new Promise((resolve, reject) => {
    const id = ++volgnummer;
    wachtend.set(id, { resolve, reject, reserve: () => { try { resolve(reserve()); } catch (f) { reject(f); } } });
    w.postMessage({ id, soort, data });
  });
}
return vraag;
}

const vraag = maakKanaal();
const vraagAchtergrond = maakKanaal();

// Meerdere workers tegelijk voor de zetten van de computerspelers (optie A): de verdelingen
// worden over de rekenkernen verdeeld. Eén kern blijft vrij voor het scherm.
const KERNEN = Math.max(1, Math.min(4, ((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 2) - 1));
const team = [vraag, ...Array.from({ length: KERNEN - 1 }, () => maakKanaal())];

// Verdeelt 'aantal' verdelingen over de workers en telt de uitkomsten op.
async function samen(w, o, kaarten, aantal, exact) {
  const n = Math.min(team.length, aantal);
  const delen = Array.from({ length: n }, (_, i) => Math.floor(aantal / n) + (i < aantal % n ? 1 : 0));
  const uitkomsten = await Promise.all(delen.map((d, i) =>
    team[i]('totalen', { w, o, kaarten, aantal: d, exact }, () => rekenTotalen(w, o, kaarten, d, exact))));
  const totalen = kaarten.map((_, j) => uitkomsten.reduce((s, u) => s + u.totalen[j], 0));
  const gewichtSom = uitkomsten.reduce((s, u) => s + u.gewichtSom, 0);
  return totalen.map((t) => t / gewichtSom);
}

async function kiesKaartSamen(w, o) {
  const geldig = geldigeKaarten(w.hand, w.slag, w.troef, w.systeem);
  if (geldig.length === 1) return { kaart: geldig[0], scores: null };
  const exact = 8 - w.slagen.length <= o.eindspel;
  let gemiddeld = await samen(w, o, geldig, o.simulaties, exact);
  if (exactNodig(w, o)) {
    const kort = kortelijst(w, o, geldig, gemiddeld);
    gemiddeld = verfijn(gemiddeld, kort, await samen(w, o, kort.map((i) => geldig[i]), o.exactSims, true));
  }
  return beslis(w, o, geldig, gemiddeld);
}

// Geeft de kaart die de computerspeler speelt. Alleen de waarneming gaat naar de worker,
// dus de AI kan niet bij de kaarten van anderen.
export function vraagKaart(potje, speler, niveau = 'normaal') {
  const data = { waarneming: waarneming(potje, speler), niveau: NIVEAUS[niveau] ?? NIVEAUS.normaal };
  return kiesKaartSamen(data.waarneming, data.niveau).then((r) => r.kaart);
}

// Online: de computer op een lege plek kiest een kaart vanuit wat hij weet (van de server).
export function vraagKaartUitWaarneming(w, niveau = 'normaal') {
  return kiesKaartSamen(w, NIVEAUS[niveau] ?? NIVEAUS.normaal).then((r) => r.kaart);
}

export function vraagDraai(hand, kleur, opties, niveau = 'normaal') {
  const nv = NIVEAUS[niveau] ?? NIVEAUS.normaal;
  opties = { ...opties, strategie: nv.strategie, ...(nv.draaiSims ? { simulaties: nv.draaiSims } : {}) };
  return vraag('draai', { hand, kleur, opties }, () => kiesDraai(hand, kleur, opties)).then((r) => r.keuze);
}

// Vergelijk met de computer: wat had de computer op deze plek gespeeld (niveau sterk)?
// Ook hier gaat alleen de waarneming van de speler naar de worker.
export function analyseerKaart(potje, speler) {
  const data = { waarneming: waarneming(potje, speler), niveau: NIVEAUS.sterk };
  return vraagAchtergrond('kaart', data, () => kiesKaart(data.waarneming, data.niveau));
}

export function analyseerDraai(hand, kleur, opties) {
  opties = { ...opties, strategie: NIVEAUS.sterk.strategie, simulaties: NIVEAUS.sterk.draaiSims };
  return vraagAchtergrond('draai', { hand, kleur, opties }, () => kiesDraai(hand, kleur, opties)).then((r) => r.keuze);
}

// Verplicht spelen: welke troefkleur kiest de computer (of had hij gekozen)?
export function vraagVerplicht(hand, opties, niveau = 'normaal') {
  opties = { ...opties, strategie: (NIVEAUS[niveau] ?? NIVEAUS.normaal).strategie };
  return vraag('verplicht', { hand, opties }, () => kiesVerplicht(hand, opties)).then((r) => r.kleur);
}

export function analyseerVerplicht(hand, opties) {
  opties = { ...opties, strategie: NIVEAUS.sterk.strategie };
  return vraagAchtergrond('verplicht', { hand, opties }, () => kiesVerplicht(hand, opties)).then((r) => r.kleur);
}
