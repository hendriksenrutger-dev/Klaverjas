// Geldige kaarten volgens het Amsterdamse of Rotterdamse systeem.
//
// Samenvatting van de regels (zie RAPPORT-FASE-1.md voor bronnen):
// - Wie uitkomt, mag elke kaart spelen.
// - Bekennen is altijd verplicht.
// - Wordt er troef gevraagd: verplicht overtroeven als dat kan (ook als je maat
//   de slag heeft, in beide systemen). Kan dat niet, dan een lagere troef.
// - Kun je een niet-troefkleur niet bekennen:
//   - Amsterdams, en je maat heeft de slag: je hoeft niet te troeven en mag elke
//     kaart spelen, maar niet ondertroeven (een troef lager dan de hoogste troef
//     in de slag), tenzij je alleen nog zulke troeven hebt.
//   - Anders (Rotterdams altijd): verplicht troeven; ligt er al troef, dan
//     verplicht overtroeven. Kun je niet overtroeven, dan mag je niet
//     ondertroeven en speel je een andere kleur. Alleen als je niets anders dan
//     lagere troeven hebt, speel je een lagere troef.

import { huidigeWinnaar, sterkte } from './rangorde.js';
import { team } from './kaarten.js';

export const AMSTERDAMS = 'amsterdams';
export const ROTTERDAMS = 'rotterdams';

function hoogsteTroefSterkte(slag, troef) {
  let hoogste = -1;
  for (const { kaart } of slag) {
    if (kaart.kleur === troef) hoogste = Math.max(hoogste, sterkte(kaart, troef));
  }
  return hoogste;
}

// hand: kaarten van de speler die aan de beurt is.
// slag: [{ speler, kaart }] die al op tafel liggen.
// Geeft de lijst van kaarten uit hand die gespeeld mogen worden.
export function geldigeKaarten(hand, slag, troef, systeem = AMSTERDAMS) {
  if (systeem !== AMSTERDAMS && systeem !== ROTTERDAMS) {
    throw new Error(`Onbekend systeem: ${systeem}`);
  }
  if (slag.length === 0) return hand.slice();

  const gevraagd = slag[0].kaart.kleur;
  const speler = (slag[0].speler + slag.length) % 4;
  const hoogste = hoogsteTroefSterkte(slag, troef);
  const bekennen = hand.filter((k) => k.kleur === gevraagd);

  if (gevraagd === troef) {
    if (bekennen.length === 0) return hand.slice();
    const hoger = bekennen.filter((k) => sterkte(k, troef) > hoogste);
    return hoger.length > 0 ? hoger : bekennen;
  }

  if (bekennen.length > 0) return bekennen;

  // Kan niet bekennen.
  const nietOndertroeven = hand.filter(
    (k) => k.kleur !== troef || sterkte(k, troef) > hoogste,
  );

  const winnaar = huidigeWinnaar(slag, troef);
  const maatHeeftSlag = team(winnaar.speler) === team(speler);
  if (systeem === AMSTERDAMS && maatHeeftSlag) {
    return nietOndertroeven.length > 0 ? nietOndertroeven : hand.slice();
  }

  const troeven = hand.filter((k) => k.kleur === troef);
  if (troeven.length === 0) return hand.slice();
  const hoger = troeven.filter((k) => sterkte(k, troef) > hoogste);
  if (hoger.length > 0) return hoger; // (over)troeven verplicht
  // Kan niet overtroeven: niet ondertroeven, tenzij er niets anders is.
  const anders = hand.filter((k) => k.kleur !== troef);
  return anders.length > 0 ? anders : hand.slice();
}

export function isGeldig(k, hand, slag, troef, systeem) {
  return geldigeKaarten(hand, slag, troef, systeem).some(
    (g) => g.kleur === k.kleur && g.rang === k.rang,
  );
}
