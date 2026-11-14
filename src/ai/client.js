// Praat met de AI-worker. Valt terug op rekenen in de hoofdthread als workers niet werken.
import { kiesKaart, kiesDraai, waarneming, NIVEAUS } from './simulatie.js';

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

// Geeft de kaart die de computerspeler speelt. Alleen de waarneming gaat naar de worker,
// dus de AI kan niet bij de kaarten van anderen.
export function vraagKaart(potje, speler, niveau = 'normaal') {
  const data = { waarneming: waarneming(potje, speler), simulaties: NIVEAUS[niveau] ?? NIVEAUS.normaal };
  return vraag('kaart', data, () => kiesKaart(data.waarneming, { simulaties: data.simulaties })).then((r) => r.kaart);
}

export function vraagDraai(hand, kleur, opties) {
  return vraag('draai', { hand, kleur, opties }, () => kiesDraai(hand, kleur, opties)).then((r) => r.keuze);
}
