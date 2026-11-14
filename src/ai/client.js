// Praat met de AI-worker. Valt terug op rekenen in de hoofdthread als workers niet werken.
import { kiesKaart, kiesDraai, waarneming, NIVEAUS } from './simulatie.js';

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

// Geeft de kaart die de computerspeler speelt. Alleen de waarneming gaat naar de worker,
// dus de AI kan niet bij de kaarten van anderen.
export function vraagKaart(potje, speler, niveau = 'normaal') {
  const data = { waarneming: waarneming(potje, speler), niveau: NIVEAUS[niveau] ?? NIVEAUS.normaal };
  return vraag('kaart', data, () => kiesKaart(data.waarneming, data.niveau)).then((r) => r.kaart);
}

export function vraagDraai(hand, kleur, opties, niveau = 'normaal') {
  opties = { ...opties, strategie: (NIVEAUS[niveau] ?? NIVEAUS.normaal).strategie };
  return vraag('draai', { hand, kleur, opties }, () => kiesDraai(hand, kleur, opties)).then((r) => r.keuze);
}

// Vergelijk met de computer: wat had de computer op deze plek gespeeld (niveau sterk)?
// Ook hier gaat alleen de waarneming van de speler naar de worker.
export function analyseerKaart(potje, speler) {
  const data = { waarneming: waarneming(potje, speler), niveau: NIVEAUS.sterk };
  return vraagAchtergrond('kaart', data, () => kiesKaart(data.waarneming, data.niveau));
}

export function analyseerDraai(hand, kleur, opties) {
  opties = { ...opties, strategie: NIVEAUS.sterk.strategie };
  return vraagAchtergrond('draai', { hand, kleur, opties }, () => kiesDraai(hand, kleur, opties)).then((r) => r.keuze);
}
