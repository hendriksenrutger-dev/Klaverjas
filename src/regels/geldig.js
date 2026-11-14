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

// Uitlegteksten per reden. Eén bron voor de hele app (hint, verzaakmelding, later de leerstand).
// {kleur} wordt vervangen door de gevraagde kleur.
export const REDENEN = {
  uitkomen: 'Je komt uit: elke kaart mag',
  bekennen: 'Je moet {kleur} bekennen',
  troefOvertroeven: 'Troef gevraagd: je moet overtroeven',
  troefBekennen: 'Troef gevraagd: je kunt niet overtroeven, dus een lagere troef',
  vrij: 'Je kunt niet bekennen en hebt geen troef: elke kaart mag',
  maatHeeftSlag: 'Je maat heeft de slag: je hoeft niet te troeven',
  maatHeeftSlagNietOnder: 'Je maat heeft de slag: je hoeft niet te troeven, maar ondertroeven mag niet',
  troeven: 'Je kunt niet bekennen: je moet troeven',
  overtroeven: 'Je kunt niet bekennen: je moet overtroeven',
  nietOndertroeven: 'Je kunt niet overtroeven en ondertroeven mag niet: speel een andere kleur',
  alleenOndertroeven: 'Je hebt alleen lagere troeven: dan moet je ondertroeven',
};

export function redenTekst(reden, gevraagd) {
  return REDENEN[reden].replace('{kleur}', gevraagd ?? '');
}

// Geeft { kaarten, reden, gevraagd }: de geldige kaarten en waarom.
export function geldigMetReden(hand, slag, troef, systeem = AMSTERDAMS) {
  if (systeem !== AMSTERDAMS && systeem !== ROTTERDAMS) {
    throw new Error(`Onbekend systeem: ${systeem}`);
  }
  const r = (kaarten, reden) => ({ kaarten, reden, gevraagd });
  const gevraagd = slag.length ? slag[0].kaart.kleur : null;
  if (slag.length === 0) return r(hand.slice(), 'uitkomen');

  const speler = (slag[0].speler + slag.length) % 4;
  const hoogste = hoogsteTroefSterkte(slag, troef);
  const bekennen = hand.filter((k) => k.kleur === gevraagd);

  if (gevraagd === troef) {
    if (bekennen.length === 0) return r(hand.slice(), 'vrij');
    const hoger = bekennen.filter((k) => sterkte(k, troef) > hoogste);
    return hoger.length > 0 ? r(hoger, 'troefOvertroeven') : r(bekennen, 'troefBekennen');
  }

  if (bekennen.length > 0) return r(bekennen, 'bekennen');

  // Kan niet bekennen.
  const troeven = hand.filter((k) => k.kleur === troef);
  const winnaar = huidigeWinnaar(slag, troef);
  const maatHeeftSlag = team(winnaar.speler) === team(speler);
  if (systeem === AMSTERDAMS && maatHeeftSlag) {
    if (hoogste < 0) return r(hand.slice(), troeven.length ? 'maatHeeftSlag' : 'vrij');
    const nietOnder = hand.filter((k) => k.kleur !== troef || sterkte(k, troef) > hoogste);
    if (nietOnder.length === 0) return r(hand.slice(), 'alleenOndertroeven');
    return r(nietOnder, nietOnder.length < hand.length ? 'maatHeeftSlagNietOnder' : 'maatHeeftSlag');
  }

  if (troeven.length === 0) return r(hand.slice(), 'vrij');
  const hoger = troeven.filter((k) => sterkte(k, troef) > hoogste);
  if (hoger.length > 0) return r(hoger, hoogste < 0 ? 'troeven' : 'overtroeven');
  // Kan niet overtroeven: niet ondertroeven, tenzij er niets anders is.
  const anders = hand.filter((k) => k.kleur !== troef);
  return anders.length > 0 ? r(anders, 'nietOndertroeven') : r(hand.slice(), 'alleenOndertroeven');
}

// hand: kaarten van de speler die aan de beurt is.
// slag: [{ speler, kaart }] die al op tafel liggen.
// Geeft de lijst van kaarten uit hand die gespeeld mogen worden.
export function geldigeKaarten(hand, slag, troef, systeem = AMSTERDAMS) {
  return geldigMetReden(hand, slag, troef, systeem).kaarten;
}

export function isGeldig(k, hand, slag, troef, systeem) {
  return geldigeKaarten(hand, slag, troef, systeem).some(
    (g) => g.kleur === k.kleur && g.rang === k.rang,
  );
}
