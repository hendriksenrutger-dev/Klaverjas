// Web Worker: rekent de zetten van de computerspelers uit, zodat het scherm niet hapert.
import { kiesKaart, kiesDraai } from './simulatie.js';

self.onmessage = (e) => {
  const { id, soort, data } = e.data;
  try {
    let resultaat;
    if (soort === 'kaart') resultaat = kiesKaart(data.waarneming, { simulaties: data.simulaties });
    else if (soort === 'draai') resultaat = kiesDraai(data.hand, data.kleur, data.opties);
    else throw new Error(`Onbekende vraag: ${soort}`);
    self.postMessage({ id, resultaat });
  } catch (fout) {
    self.postMessage({ id, fout: String(fout?.message ?? fout) });
  }
};
