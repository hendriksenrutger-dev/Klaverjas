// Vergelijk met de computer: hoe verhoudt Rutgers kaart zich tot wat de computer had gespeeld?
// Puur en zonder DOM. De computer rekent met precies wat de speler op dat moment wist.
import { kaartId } from '../regels/kaarten.js';
// Verschillen kleiner dan dit (in punten voor ons team) tellen als gelijkwaardig. Kleinere
// verschillen zijn niet betrouwbaar: de simulatie onderschat bijvoorbeeld het openhouden van
// opties (duiken, wachten op een kale tien). Na Rutgers voorbeeld verhoogd van 4 naar 10.
export const GELIJKWAARDIG = 10;

// scores: [{kaart, gemiddeld}] uit kiesKaart (gemiddeld = wij − zij); computer: de kaart
// die de computer koos; gespeeld: de kaart die de speler speelde.
// verschil > 0: de kaart van de speler was naar schatting zoveel punten beter.
export function beoordeelKaart(scores, computer, gespeeld) {
  if (kaartId(computer) === kaartId(gespeeld)) return { oordeel: 'zelfde', verschil: 0 };
  const gem = (k) => scores.find((s) => kaartId(s.kaart) === kaartId(k))?.gemiddeld ?? 0;
  const verschil = Math.round((gem(gespeeld) - gem(computer)) / 2);
  if (Math.abs(verschil) < GELIJKWAARDIG) return { oordeel: 'gelijkwaardig', verschil };
  return { oordeel: verschil > 0 ? 'beter' : 'minder', verschil };
}

export function legeVergelijking() {
  return { kaarten: 0, zelfde: 0, gelijkwaardig: 0, beter: 0, minder: 0, punten: 0, draaien: 0, draaiAnders: 0 };
}

// Telt één beoordeling op bij het totaal (geeft een nieuw object).
export function telOp(totaal, b) {
  const t = { ...legeVergelijking(), ...totaal };
  if (b.soort === 'draai') {
    t.draaien++;
    if (b.jij !== b.computer) t.draaiAnders++;
    return t;
  }
  t.kaarten++;
  t[b.oordeel]++;
  t.punten += b.verschil;
  return t;
}
