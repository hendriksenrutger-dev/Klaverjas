// De lessen van Leren klaverjassen (tekst goedgekeurd door Rutger, zie LESSEN.md).
// Puur: de inhoud en het beoordelen van antwoorden. Geen DOM.
import { geldigMetReden, redenTekst } from '../regels/geldig.js';
import { kaartId } from '../regels/kaarten.js';

const K = { k: 'klaveren', r: 'ruiten', h: 'harten', s: 'schoppen' };
// 'kA k10' -> kaarten
export const kaarten = (s) => s.split(' ').filter(Boolean).map((x) => ({ kleur: K[x[0]], rang: x.slice(1) }));
// Een slag als { speler, kaart }, beginnend bij speler 'van' (standaard West).
const slag = (s, van = 1) => kaarten(s).map((kaart, i) => ({ speler: (van + i) % 4, kaart }));

// Uitlegschermen: lijst van blokken. Een blok is een alinea (string), een lijst (array)
// of een kaartenrij { rij: 'kA k10 …', onder: ['11', …] }.
export const LESSEN = [
  {
    nr: 1,
    titel: 'De kaarten en hun waarde',
    uitleg: [
      [
        [
          'Klaverjassen speel je met 32 kaarten: 7, 8, 9, 10, boer, vrouw, heer en aas in vier kleuren.',
          'Je speelt met z\'n vieren, in twee teams. Je maat zit tegenover je.',
          'Iedereen krijgt 8 kaarten. Er zijn dus 8 slagen per potje.',
          'Eén kleur is <b>troef</b>. Troef wint van elke andere kleur.',
        ],
      ],
      [
        'Volgorde en punten in een <b>gewone kleur</b>, van hoog naar laag:',
        { rij: 'kA k10 kH kV kB k9 k8 k7', onder: ['11', '10', '4', '3', '2', '0', '0', '0'] },
        'Volgorde en punten in <b>troef</b>, van hoog naar laag:',
        { rij: 'hB h9 hA h10 hH hV h8 h7', onder: ['20', '14', '11', '10', '4', '3', '0', '0'] },
        'Let op: in troef is de <b>boer</b> de hoogste kaart en de <b>9</b> (de nel) de tweede. Alle punten samen: 152. Wie de laatste slag haalt, krijgt er 10 bij: 162 per potje.',
      ],
    ],
    opdrachten: [
      { soort: 'keuze', troef: 'harten', slag: slag('k10 kH kA'), vraag: 'Wie wint deze slag?', opties: ['West', 'Noord', 'Oost'], goed: 2,
        uitleg: 'De aas is de hoogste kaart in een gewone kleur.' },
      { soort: 'keuze', troef: 'schoppen', slag: slag('sA s9 s10'), vraag: 'Wie wint deze slag?', opties: ['West', 'Noord', 'Oost'], goed: 1,
        uitleg: 'De nel (de 9) is na de boer de hoogste troef.' },
      { soort: 'keuze', troef: 'harten', slag: slag('hB sA s10 s7', 0), vraag: 'Hoeveel punten is deze slag waard?', opties: ['23', '41', '43'], goed: 1,
        uitleg: 'Boer van troef 20 + aas 11 + tien 10 + zeven 0 = 41.' },
    ],
  },
  {
    nr: 2,
    titel: 'Bekennen',
    uitleg: [[[
      'De eerste kaart van een slag bepaalt de <b>gevraagde kleur</b>.',
      'Heb je die kleur, dan <b>moet</b> je hem bijspelen. Dat heet bekennen.',
      'Welke kaart van die kleur je speelt, mag je zelf kiezen.',
    ]]],
    opdrachten: [
      { soort: 'kaart', troef: 'ruiten', slag: slag('kV'), hand: kaarten('k7 kA h10 h8 r9 sH sV s8'),
        vraag: 'Speel een kaart die mag en waarmee je de slag wint.', goed: ['klaveren-A'],
        fout: { 'klaveren-7': 'Die mag, maar daarmee win je de slag niet.' }, goedTekst: 'De aas wint de slag.' },
      { soort: 'kaart', troef: 'ruiten', slag: slag('kA k8 kB'), hand: kaarten('k7 kV h10 h8 r9 sH sV s8'),
        vraag: 'West wint deze slag toch. Speel de kaart die de tegenpartij de minste punten geeft.', goed: ['klaveren-7'],
        fout: { 'klaveren-V': 'Die mag, maar geeft 3 punten weg. De 7 geeft niets weg.' }, goedTekst: 'De 7 geeft geen punten weg.' },
    ],
  },
  {
    nr: 3,
    titel: 'Troeven',
    uitleg: [[[
      'Kun je niet bekennen, dan <b>moet</b> je troeven.',
      'Ligt er al troef in de slag, dan moet je <b>overtroeven</b> (een hogere troef spelen) als dat kan.',
      'Uitzondering in Amsterdams: heeft je <b>maat de slag al</b>, dan hoef je niet te troeven. Troef je toch, dan mag je niet ondertroeven.',
      '<b>Ondertroeven</b> (een lagere troef dan er al ligt) mag alleen als je niets anders hebt.',
      'Wordt er <b>troef gevraagd</b>, dan moet je bekennen met een hogere troef als je die hebt.',
    ]]],
    opdrachten: [
      { soort: 'kaart', troef: 'harten', slag: slag('sA s7 s10'), hand: kaarten('h9 h7 kA k8 r10 rV r7 kH'),
        vraag: 'West heeft de slag. Wat moet je doen?', goed: ['harten-7', 'harten-9'],
        goedTekstPer: { 'harten-7': 'Je moet troeven, en met de 7 win je met de laagste troef.', 'harten-9': 'Je moet troeven. De 7 had ook gekund; dan had je je nel bewaard.' } },
      { soort: 'kaart', troef: 'harten', slag: slag('s9 sA s8'), hand: kaarten('h9 h7 kA k8 r10 rV r7 kH'),
        vraag: 'Noord, je maat, heeft de slag. Moet je troeven?', goed: 'alles',
        goedTekst: 'Je maat heeft de slag, dus je hoeft niet te troeven. Punten die je nu bijspeelt, gaan naar jullie.',
        goedTekstTroef: 'Dat mag, maar het hoefde niet: je maat heeft de slag. Zo ben je een troef kwijt.' },
      { soort: 'kaart', troef: 'klaveren', slag: slag('kV k7 kA'), hand: kaarten('k9 k8 hA h10 rH r8 sV s7'),
        vraag: 'Troef is gevraagd en Oost ligt hoog met de aas. Wat moet je spelen?', goed: ['klaveren-9'],
        goedTekst: 'Je moet overtroeven als het kan: de nel is hoger dan de aas.' },
    ],
  },
  {
    nr: 4,
    titel: 'Roem',
    uitleg: [[
      'Liggen er bepaalde combinaties in één slag, dan krijgt het team dat de slag wint extra punten: <b>roem</b>.',
      [
        '<b>Driekaart:</b> drie opeenvolgende kaarten van één kleur, 20. Volgorde hiervoor: 7, 8, 9, 10, boer, vrouw, heer, aas (dus niet de troefvolgorde).',
        '<b>Vierkaart:</b> vier opeenvolgende kaarten van één kleur, 50.',
        '<b>Stuk:</b> heer en vrouw van troef samen, 20. Dat telt ook naast een reeks: vierkaart met heer en vrouw van troef = 50 + 20 = 70.',
        '<b>Vier gelijke:</b> vier azen, tienen, heren of vrouwen 100, vier boeren 200. Vier zevens, achten of negens tellen niet.',
        'De roem gaat naar wie de slag wint, ook als jij hem niet zelf gelegd hebt.',
      ],
    ]],
    opdrachten: [
      { soort: 'keuze', troef: 'klaveren', slag: slag('h8 h9 h10 sA', 0), vraag: 'Hoeveel roem?', opties: ['0', '20', '50'], goed: 1,
        uitleg: 'Driekaart: 8, 9 en 10 van harten.' },
      { soort: 'keuze', troef: 'schoppen', slag: slag('sB sV sH r7', 0), vraag: 'Hoeveel roem?', opties: ['20', '40', '70'], goed: 1,
        uitleg: 'Driekaart boer-vrouw-heer 20, plus stuk (heer en vrouw van troef) 20.' },
      { soort: 'keuze', troef: 'ruiten', slag: slag('kH hH sH rH', 0), vraag: 'Hoeveel roem?', opties: ['20', '100', '120'], goed: 1,
        uitleg: 'Vier heren: 100. Voor het stuk is ook de vrouw van troef nodig.' },
    ],
  },
  {
    nr: 5,
    titel: 'Spelen of passen, nat en pit',
    uitleg: [[[
      '<b>Troef bepalen:</b> er wordt een kaart gedraaid. Om de beurt zeg je <b>spelen</b> (deze kleur wordt troef en jouw team is de spelende partij) of <b>passen</b>. Past iedereen, dan wordt een volgende kleur gedraaid.',
      'De <b>spelende partij</b> moet meer dan de helft halen: meer punten plus roem dan de tegenpartij.',
      'Lukt dat niet, dan is de spelende partij <b>nat</b>: de tegenpartij krijgt alle 162 punten en alle roem.',
      'Haalt de spelende partij <b>alle 8 slagen</b>, dan is dat <b>pit</b>: 100 roem extra.',
      'Speel alleen als je denkt de meerderheid te halen. Een paar hoge troeven (boer, nel) helpen veel.',
    ]]],
    opdrachten: [
      { soort: 'keuze', vraag: 'Jullie speelden. Wij: 80 punten + 20 roem. Zij: 82 punten. Gehaald of nat?', opties: ['Gehaald', 'Nat'], goed: 0,
        uitleg: '100 tegen 82: jullie hebben meer dan de tegenpartij.' },
      { soort: 'keuze', vraag: 'Jullie speelden. Wij: 81 punten. Zij: 81 punten. Gehaald of nat?', opties: ['Gehaald', 'Nat'], goed: 1,
        uitleg: 'Je moet méér hebben dan de tegenpartij; gelijk is nat.' },
      { soort: 'keuze', troef: 'harten', hand: kaarten('hB h9 hA kA k10 sA r7 r8'), vraag: 'Troef gedraaid: harten. Spelen of passen?', opties: ['Spelen', 'Passen'], goed: 0,
        uitleg: 'Boer, nel en aas van troef, plus twee azen: een sterke hand.' },
    ],
  },
  {
    nr: 6,
    titel: 'Seinen',
    uitleg: [[
      'Met seinen vertel je je maat iets over je kaarten, zonder te praten.',
      [
        'Je seint alleen door <b>bij te spelen op een slag die je maat al heeft</b>, nooit met troef. Is er troef gevraagd, dan alleen als je maat zelf troef trekt en de slag heeft.',
        '<b>Een kleintje (7, 8 of 9) bijspelen</b> betekent: "ik heb de aas van deze kleur".',
        '<b>De aas bijspelen</b> betekent: "ik heb ook de tien van deze kleur".',
        'Een tien, boer, vrouw of heer bijspelen is geen sein.',
        'Een sein is een sterke aanwijzing, geen zekerheid: soms had iemand gewoon niets anders.',
      ],
    ]],
    opdrachten: [
      { soort: 'kaart', troef: 'klaveren', slag: slag('s9 sA s8'), hand: kaarten('hA h8 hV r10 rB k7 kH r8'),
        vraag: 'Noord heeft de slag. Laat Noord weten dat je de aas van harten hebt.', goed: ['harten-8'],
        fout: { 'harten-A': 'Daarmee zeg je: ik heb ook de tien van harten.' },
        foutAnders: 'Dat mag, maar zo zeg je niets over je hartenaas. Speel een kleintje harten.',
        goedTekst: 'Een kleintje harten bijspelen op de slag van je maat: "ik heb de aas van harten".' },
      { soort: 'keuze', troef: 'klaveren', slag: slag('sA s8 r7', 0), vraag: 'Jij hebt de slag met ♠A. Noord heeft geen schoppen en speelt ♦7 bij. Wat zegt Noord daarmee?',
        opties: ['Ik heb ♦A', 'Ik heb ♦10', 'Ik heb geen ruiten'], goed: 0, uitleg: 'Een kleintje bijspelen op jouw slag betekent: "ik heb de aas van deze kleur".' },
    ],
  },
  {
    nr: 7,
    titel: 'Rotterdams',
    uitleg: [[[
      'Rotterdams is gelijk aan Amsterdams, op één punt na:',
      'Kun je niet bekennen, dan moet je <b>altijd</b> troeven, ook als je maat de slag al heeft.',
      'Ondertroeven mag ook hier alleen als je niets anders hebt.',
    ]]],
    opdrachten: [
      { soort: 'kaart', troef: 'harten', systeem: 'rotterdams', slag: slag('s9 sA s8'), hand: kaarten('h9 h7 kA k8 r10 rV r7 kH'),
        vraag: 'Rotterdams. Noord heeft de slag. Wat moet je hier doen?', goed: ['harten-7', 'harten-9'],
        foutOngeldig: 'Rotterdams: je kunt niet bekennen, dus je moet troeven, ook als je maat de slag heeft.',
        goedTekst: 'In Rotterdams moet je troeven, ook als je maat de slag heeft.' },
    ],
  },
];

// Beoordeelt een antwoord. antwoord: een kaart (soort 'kaart') of de index van een optie (soort 'keuze').
// Geeft { goed, tekst }.
export function beoordeel(o, antwoord) {
  if (o.soort === 'keuze') {
    const goed = antwoord === o.goed;
    return { goed, tekst: goed ? `Goed. ${o.uitleg}` : `Nog niet. ${o.uitleg}` };
  }
  const id = kaartId(antwoord);
  const g = geldigMetReden(o.hand, o.slag, o.troef, o.systeem ?? 'amsterdams');
  if (!g.kaarten.some((k) => kaartId(k) === id)) {
    return { goed: false, tekst: o.foutOngeldig ?? `${redenTekst(g.reden, g.gevraagd)}.` };
  }
  const goed = o.goed === 'alles' || o.goed.includes(id);
  if (!goed) return { goed: false, tekst: o.fout?.[id] ?? o.foutAnders ?? 'Die mag, maar er is een betere kaart. Probeer het nog eens.' };
  if (o.goedTekstTroef && antwoord.kleur === o.troef) return { goed: true, tekst: o.goedTekstTroef };
  return { goed: true, tekst: `Goed. ${o.goedTekstPer?.[id] ?? o.goedTekst ?? ''}`.trim() };
}

// Voortgang: welke lessen zijn klaar.
export const AANTAL_LESSEN = LESSEN.length;
export function lesKlaar(voortgang, nr) {
  const lessen = [...new Set([...(voortgang.lessen ?? []), nr])].sort((a, b) => a - b);
  return { ...voortgang, lessen };
}
export const alleLessenKlaar = (voortgang) => (voortgang.lessen ?? []).length >= AANTAL_LESSEN;
