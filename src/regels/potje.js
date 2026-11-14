// Het spelen van één potje: slagen, verzaken en de eindtelling.

import { team, zelfdeKaart } from './kaarten.js';
import { huidigeWinnaar, slagPunten, PUNTEN_LAATSTE_SLAG, PUNTEN_PER_POTJE } from './rangorde.js';
import { geldigeKaarten, AMSTERDAMS } from './geldig.js';
import { roemInSlag, ROEM } from './roem.js';

// Straf bij verzaken (Gouden Boekje, Amsterdams systeem): de verzakende partij
// krijgt nul, de tegenpartij 162 punten plus 100 strafpunten plus alle roem
// (eigen roem en die van de verzakers).
export const VERZAAK_STRAFPUNTEN = 100;

export function nieuwPotje({
  handen,
  troef,
  spelendTeam,
  uitkomer,
  systeem = AMSTERDAMS,
  verzaakbescherming = true,
  kiezer = null, // wie koos voor deze troef (null = onbekend)
}) {
  if (handen.length !== 4 || handen.some((h) => h.length !== 8)) {
    throw new Error('Een potje begint met 4 handen van 8 kaarten');
  }
  return {
    troef,
    spelendTeam,
    systeem,
    verzaakbescherming,
    handen: handen.map((h) => h.slice()),
    slag: [],
    slagen: [],
    beurt: uitkomer,
    uitkomer,
    kiezer,
    klaar: false,
    verzaking: null,
  };
}

export function geldigVoor(potje, speler) {
  return geldigeKaarten(potje.handen[speler], potje.slag, potje.troef, potje.systeem);
}

// Speelt een kaart en geeft een nieuwe potjestoestand terug.
export function speelKaart(potje, speler, kaart) {
  if (potje.klaar) throw new Error('Het potje is al afgelopen');
  if (speler !== potje.beurt) throw new Error(`Speler ${speler} is niet aan de beurt`);
  const hand = potje.handen[speler];
  const index = hand.findIndex((k) => zelfdeKaart(k, kaart));
  if (index === -1) throw new Error('Die kaart zit niet in de hand');

  const geldig = geldigVoor(potje, speler).some((k) => zelfdeKaart(k, kaart));
  if (!geldig && potje.verzaakbescherming) {
    throw new Error('Deze kaart mag niet gespeeld worden');
  }

  const handen = potje.handen.slice();
  handen[speler] = hand.filter((_, i) => i !== index);
  const slag = [...potje.slag, { speler, kaart: hand[index] }];

  if (!geldig) {
    // Verzaakt: het potje stopt meteen.
    return {
      ...potje,
      handen,
      slag,
      klaar: true,
      verzaking: { speler, team: team(speler), kaart: hand[index], slagNummer: potje.slagen.length + 1 },
    };
  }

  if (slag.length < 4) {
    return { ...potje, handen, slag, beurt: (speler + 1) % 4 };
  }

  const winnaar = huidigeWinnaar(slag, potje.troef).speler;
  const kaarten = slag.map((s) => s.kaart);
  const laatste = potje.slagen.length === 7;
  const afgerondeSlag = {
    kaarten: slag,
    winnaar,
    punten: slagPunten(kaarten, potje.troef) + (laatste ? PUNTEN_LAATSTE_SLAG : 0),
    roem: roemInSlag(kaarten, potje.troef),
  };
  return {
    ...potje,
    handen,
    slag: [],
    slagen: [...potje.slagen, afgerondeSlag],
    beurt: winnaar,
    klaar: laatste,
  };
}

// Tussenstand of eindstand: punten en roem per team zoals ze nu op tafel liggen.
export function stand(potje) {
  const punten = [0, 0];
  const roem = [0, 0];
  for (const s of potje.slagen) {
    punten[team(s.winnaar)] += s.punten;
    roem[team(s.winnaar)] += s.roem.totaal;
  }
  return { punten, roem };
}

// Eindtelling van een afgelopen potje.
// Geeft { punten, roem, totaal, nat, pit, verzaakt }, arrays per team [0, 1].
export function uitslag(potje) {
  if (!potje.klaar) throw new Error('Het potje is nog niet afgelopen');
  const { punten, roem } = stand(potje);
  const s = potje.spelendTeam;
  const t = 1 - s;
  const alleRoem = roem[0] + roem[1];

  if (potje.verzaking) {
    const d = potje.verzaking.team;
    const o = 1 - d;
    const p = [0, 0];
    const r = [0, 0];
    p[o] = PUNTEN_PER_POTJE + VERZAAK_STRAFPUNTEN;
    r[o] = alleRoem;
    return maak(p, r, { nat: false, pit: null, verzaakt: potje.verzaking });
  }

  const slagenVan = [0, 0];
  for (const sl of potje.slagen) slagenVan[team(sl.winnaar)]++;
  const pit = slagenVan[0] === 8 ? 0 : slagenVan[1] === 8 ? 1 : null;
  if (pit === s) roem[s] += ROEM.pit;

  if (punten[s] + roem[s] > punten[t] + roem[t]) {
    return maak(punten, roem, { nat: false, pit, verzaakt: null });
  }

  // Nat: de tegenpartij krijgt alle punten en alle roem.
  const p = [0, 0];
  const r = [0, 0];
  p[t] = PUNTEN_PER_POTJE;
  r[t] = roem[0] + roem[1];
  return maak(p, r, { nat: true, pit, verzaakt: null });
}

function maak(punten, roem, extra) {
  return { punten, roem, totaal: [punten[0] + roem[0], punten[1] + roem[1]], ...extra };
}
