// Web Worker: rekent de zetten van de computerspelers uit, zodat het scherm niet hapert.
import { kiesKaart, kiesDraai, kiesVerplicht, rekenTotalen } from './simulatie.js';

self.onmessage = (e) => {
  const { id, soort, data } = e.data;
  try {
    let resultaat;
    if (soort === 'kaart') resultaat = kiesKaart(data.waarneming, data.niveau);
    else if (soort === 'totalen') resultaat = rekenTotalen(data.w, data.o, data.kaarten, data.aantal, data.exact);
    else if (soort === 'draai') resultaat = kiesDraai(data.hand, data.kleur, data.opties);
    else if (soort === 'verplicht') resultaat = kiesVerplicht(data.hand, data.opties);
    else throw new Error(`Onbekende vraag: ${soort}`);
    self.postMessage({ id, resultaat });
  } catch (fout) {
    self.postMessage({ id, fout: String(fout?.message ?? fout) });
  }
};
