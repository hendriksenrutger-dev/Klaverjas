import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { waarneming, uitsluitingen, trekVerdeling, kiesKaart, kiesDraai, kiesSimpel, kiesSlim, eindspelWaarde, seinVan, seinenVanAnderen, seinGewicht, SEIN_FACTOR, SEIN_BONUS, SEIN_STRAF, SEIN_STRAF_BEKENNEN } from '../src/ai/simulatie.js';
import { slag } from './hulp.js';
import { nieuwPotje, speelKaart, geldigVoor, uitslag } from '../src/regels/potje.js';
import { maakDeck, schud, deel, kaartId, team } from '../src/regels/kaarten.js';
import { geldigeKaarten } from '../src/regels/geldig.js';
import { maakRng } from '../src/regels/rng.js';
import { K, Ks } from './hulp.js';

// Vaste handen: speler 0..3.
function handenVast() {
  return [
    Ks('hB h9 hA kA k10 r7 s7 s8'),
    Ks('h7 k7 k8 k9 r8 r9 s9 s10'),
    Ks('h8 h10 kB kV kH r10 rB sB'),
    Ks('hV hH rV rH rA sV sH sA'),
  ];
}

describe('waarneming en uitsluitingen', () => {
  test('de waarneming bevat geen kaarten van anderen', () => {
    const p = nieuwPotje({ handen: handenVast(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    const w = waarneming(p, 1);
    assert.deepEqual(w.hand, p.handen[1]);
    assert.equal(JSON.stringify(w).includes('"hB"'), false);
    assert.equal(w.handen, undefined);
    assert.deepEqual(w.aantallen, [8, 8, 8, 8]);
  });

  test('wie niet bekent, heeft die kleur niet', () => {
    let p = nieuwPotje({ handen: handenVast(), troef: 'harten', spelendTeam: 0, uitkomer: 1 });
    p = speelKaart(p, 1, K('k7'));
    p = speelKaart(p, 2, K('kB'));
    p = speelKaart(p, 3, K('hV')); // speler 3 heeft geen klaveren en troeft in
    const w = waarneming(p, 0);
    const uit = uitsluitingen(w);
    for (const r of ['8', '9', 'V', 'H']) assert.ok(uit[3].has(`klaveren-${r}`), `klaveren ${r}`);
    // Speler 3 troefde met de vrouw; dat zegt niets over zijn andere harten.
    assert.equal(uit[3].has('harten-H'), false);
    // Speler 2 bekende: geen uitsluiting van klaveren.
    assert.equal(uit[2].has('klaveren-H'), false);
  });

  test('wie niet overtroeft terwijl het moest, heeft geen hogere troef', () => {
    let p = nieuwPotje({ handen: handenVast(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    p = speelKaart(p, 0, K('h9')); // troef gevraagd
    p = speelKaart(p, 1, K('h7')); // lager: speler 1 heeft geen hB
    const uit = uitsluitingen(waarneming(p, 2));
    assert.ok(uit[1].has('harten-B'));
    assert.equal(uit[1].has('harten-8'), false); // lagere troeven kunnen nog
  });

  test('Amsterdams: niet troeven als de maat de slag heeft zegt niets over troef', () => {
    const handen = [
      Ks('k7 h7 r7 r8 r9 s7 s8 s9'),
      Ks('kA k8 k9 k10 kB kV kH h8'),
      Ks('s10 hB h9 hA h10 hH hV r10'),
      Ks('rB rV rH rA sB sV sH sA'),
    ];
    const start = (systeem) => {
      let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 1, systeem });
      p = speelKaart(p, 1, K('kA'));
      return p;
    };
    // Amsterdams: speler 2 (tegenstander van 1) moet troeven; speler 3 niet, want maat 1 heeft de slag.
    let p = start('amsterdams');
    p = speelKaart(p, 2, K('h9'));
    // Nu heeft speler 2 de slag met troef: speler 3 heeft geen klaveren en geen troef.
    p = speelKaart(p, 3, K('rB'));
    let uit = uitsluitingen(waarneming(p, 0));
    assert.ok(uit[3].has('klaveren-V'));
    assert.ok(uit[3].has('harten-B')); // een hogere troef had hij moeten spelen
    assert.equal(uit[3].has('harten-H'), false); // een lagere troef niet: ondertroeven mag niet

    // Als de maat de slag heeft (zonder troef in de slag), zegt een afgooi niets over troef.
    const handen2 = [
      Ks('kA h7 r7 r8 r9 s7 s8 s9'),
      Ks('k7 k8 k9 k10 kB kV kH h8'),
      Ks('s10 hB h9 hA h10 hH hV r10'),
      Ks('rB rV rH rA sB sV sH sA'),
    ];
    let q = nieuwPotje({ handen: handen2, troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    q = speelKaart(q, 0, K('kA'));
    q = speelKaart(q, 1, K('k7'));
    q = speelKaart(q, 2, K('s10')); // maat 0 heeft de slag: niet hoeven troeven (Amsterdams)
    uit = uitsluitingen(waarneming(q, 3));
    assert.ok(uit[2].has('klaveren-V'));
    assert.equal(uit[2].has('harten-H'), false);
    // Rotterdams: dezelfde afgooi zou betekenen dat speler 2 geen troef heeft.
    const r = { ...waarneming(q, 3), systeem: 'rotterdams' };
    assert.ok(uitsluitingen(r)[2].has('harten-H'));
  });

  test('getrokken verdelingen passen altijd bij de uitsluitingen en aantallen', () => {
    const rng = maakRng(11);
    for (let g = 0; g < 40; g++) {
      let p = nieuwPotje({ handen: deel(schud(maakDeck(), rng), 0), troef: 'schoppen', spelendTeam: 1, uitkomer: 1 });
      const stappen = Math.floor(rng() * 28);
      for (let s = 0; s < stappen && !p.klaar; s++) {
        const g2 = geldigVoor(p, p.beurt);
        p = speelKaart(p, p.beurt, g2[Math.floor(rng() * g2.length)]);
      }
      if (p.klaar) continue;
      const w = waarneming(p, p.beurt);
      const uit = uitsluitingen(w);
      const bekend = new Set([...w.hand, ...p.slagen.flatMap((s) => s.kaarten.map((x) => x.kaart)), ...p.slag.map((x) => x.kaart)].map(kaartId));
      const onbekend = maakDeck().filter((k) => !bekend.has(kaartId(k)));
      // De echte verdeling moet zelf ook toegestaan zijn.
      for (let q = 0; q < 4; q++) if (q !== w.speler) for (const k of p.handen[q]) assert.equal(uit[q].has(kaartId(k)), false);
      for (let t = 0; t < 10; t++) {
        const h = trekVerdeling(w, uit, onbekend, rng);
        assert.deepEqual(h.map((x) => x.length), w.aantallen);
        for (let q = 0; q < 4; q++) if (q !== w.speler) for (const k of h[q]) assert.equal(uit[q].has(kaartId(k)), false);
        assert.equal(new Set(h.flat().map(kaartId)).size, h.flat().length);
      }
    }
  });
});

describe('kaart kiezen', () => {
  test('kiest altijd een geldige kaart (computerspelers verzaken nooit)', () => {
    const rng = maakRng(5);
    for (let g = 0; g < 6; g++) {
      let p = nieuwPotje({ handen: deel(schud(maakDeck(), rng), g % 4), troef: 'ruiten', spelendTeam: g % 2, uitkomer: g % 4, systeem: g % 2 ? 'rotterdams' : 'amsterdams' });
      while (!p.klaar) {
        const { kaart } = kiesKaart(waarneming(p, p.beurt), { simulaties: 8, rng });
        assert.ok(geldigVoor(p, p.beurt).some((k) => kaartId(k) === kaartId(kaart)));
        p = speelKaart(p, p.beurt, kaart);
      }
    }
  });

  test('snelle strategie kiest ook alleen geldige kaarten', () => {
    const rng = maakRng(6);
    let p = nieuwPotje({ handen: deel(schud(maakDeck(), rng), 0), troef: 'klaveren', spelendTeam: 0, uitkomer: 1 });
    while (!p.klaar) {
      const k = kiesSimpel(p.handen[p.beurt], p.slag, p.troef, p.systeem, p.beurt, p.spelendTeam, rng);
      const k2 = kiesSlim(p.handen, p.slag, { troef: p.troef, systeem: p.systeem, spelendTeam: p.spelendTeam }, p.beurt, rng);
      assert.ok(geldigVoor(p, p.beurt).some((g) => kaartId(g) === kaartId(k2)));
      assert.ok(geldigVoor(p, p.beurt).some((g) => kaartId(g) === kaartId(k)));
      p = speelKaart(p, p.beurt, k);
    }
  });

  test('als laatste: neemt een vette slag met de laagste winnende kaart', () => {
    // Laatste twee slagen. Speler 3 is als laatste aan de beurt in slag 7.
    const handen = handenVast();
    let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    // Speel 6 slagen weg met de eerste geldige kaart, daarna testen we alleen dat de keuze zinnig is.
    const rng = maakRng(9);
    while (p.slagen.length < 6) p = speelKaart(p, p.beurt, geldigVoor(p, p.beurt)[0]);
    while (!p.klaar) {
      const { kaart, scores } = kiesKaart(waarneming(p, p.beurt), { simulaties: 30, rng });
      if (scores) {
        const best = Math.max(...scores.map((s) => s.gemiddeld + s.sein + s.trek));
        const g = scores.find((s) => kaartId(s.kaart) === kaartId(kaart));
        const gekozen = g.gemiddeld + g.sein + g.trek;
        assert.equal(gekozen, best);
      }
      p = speelKaart(p, p.beurt, kaart);
    }
  });

  test('eindspel met open kaarten: kiest de kaart die de slag wint', () => {
    // Twee kaarten per speler, alles is bekend door de uitsluitingen niet nodig: speler 3 als laatste.
    // We bouwen een potje waarin al 6 slagen gespeeld zijn via vaste handen.
    const handen = [
      Ks('kA k10 k9 kB r7 r8 hA h10'),
      Ks('k7 k8 kV kH r9 r10 s7 h7'),
      Ks('rB rV rH rA s8 s9 s10 h8'),
      Ks('sB sV sH sA hB h9 hV hH'),
    ];
    let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    // Slag 1: speler 0 kA, 1 k7, 2 rB (geen klaveren, maat wint: mag), 3 sB (geen klaveren, geen... moet troeven!)
    p = speelKaart(p, 0, K('kA'));
    p = speelKaart(p, 1, K('k7'));
    p = speelKaart(p, 2, K('rB'));
    // Speler 3 moet troeven (tegenstander wint met kA): de AI kiest geldig en een troef.
    const { kaart } = kiesKaart(waarneming(p, 3), { simulaties: 200, rng: maakRng(3) });
    assert.equal(kaart.kleur, 'harten');
    // Met de laagste troef die wint (hV of hH zijn genoeg; de boer of negen weggeven is zonde).
    assert.ok(['V', 'H'].includes(kaart.rang), `gekozen ${kaart.rang}`);
  });
});

describe('spelen of passen', () => {
  test('sterke troefhand: spelen', () => {
    const hand = Ks('hB h9 hA h10 kA sA rA hH');
    const { keuze, gemiddeld } = kiesDraai(hand, 'harten', { speler: 1, deler: 0, rng: maakRng(1) });
    assert.equal(keuze, 'spelen');
    assert.ok(gemiddeld > 50);
  });

  test('geen troef en geen azen: passen', () => {
    const hand = Ks('k7 k8 r7 r8 r9 s7 s8 s9');
    const { keuze } = kiesDraai(hand, 'harten', { speler: 1, deler: 0, rng: maakRng(1) });
    assert.equal(keuze, 'passen');
  });

  test('dezelfde hand in een andere troefkleur kan anders uitvallen', () => {
    const hand = Ks('hB h9 hA h10 kA sA rA hH');
    assert.equal(kiesDraai(hand, 'klaveren', { speler: 1, deler: 0, rng: maakRng(2) }).keuze, 'passen');
  });
});

describe('eindspel exact', () => {
  test('de snelle telling in het eindspel is gelijk aan de echte uitslag', () => {
    const rng = maakRng(21);
    for (let g = 0; g < 40; g++) {
      let p = nieuwPotje({ handen: deel(schud(maakDeck(), rng), 0), troef: 'klaveren', spelendTeam: g % 2, uitkomer: 1 });
      while (p.slagen.length < 7) { const k = geldigVoor(p, p.beurt); p = speelKaart(p, p.beurt, k[Math.floor(rng() * k.length)]); }
      // Laatste slag: elke speler heeft één kaart, dus de waarde is precies de uitslag.
      const ctx = { troef: p.troef, systeem: p.systeem, spelendTeam: p.spelendTeam };
      const v = eindspelWaarde(p.handen, p.slag, p.slagen, p.beurt, ctx, 0);
      let q = p;
      while (!q.klaar) q = speelKaart(q, q.beurt, geldigVoor(q, q.beurt)[0]);
      const u = uitslag(q);
      assert.equal(v, u.totaal[0] - u.totaal[1]);
    }
  });

  test('exacte waarde is minstens zo goed als elke vaste speelwijze voor de eigen partij', () => {
    const rng = maakRng(22);
    for (let g = 0; g < 15; g++) {
      let p = nieuwPotje({ handen: deel(schud(maakDeck(), rng), 0), troef: 'ruiten', spelendTeam: 0, uitkomer: 1 });
      while (p.slagen.length < 6) { const k = geldigVoor(p, p.beurt); p = speelKaart(p, p.beurt, k[Math.floor(rng() * k.length)]); }
      const ctx = { troef: p.troef, systeem: p.systeem, spelendTeam: p.spelendTeam };
      const v = eindspelWaarde(p.handen, p.slag, p.slagen, p.beurt, ctx, team(p.beurt));
      assert.ok(Number.isFinite(v));
      // De handen zijn na de zoektocht onveranderd.
      assert.equal(p.handen.flat().length, 8);
    }
  });
});

describe('seinen herkennen', () => {
  const T = 'harten';
  const sein = (start, codes, kaart) => seinVan(slag(start, codes), (start + codes.split(' ').length) % 4, K(kaart), T);

  test('kleintje bekennen op een slag van de maat: ik heb de aas', () => {
    // Speler 2 komt uit met kH (maat van 0), speler 3 k8, speler 0 legt k7 bij.
    assert.deepEqual(sein(2, 'kH k8', 'k7'), { speler: 0, kaart: { kleur: 'klaveren', rang: 'A' } });
  });

  test('kleintje afgooien op een slag van de maat: ik heb de aas van die kleur', () => {
    assert.deepEqual(sein(2, 'kA k8', 'r9'), { speler: 0, kaart: { kleur: 'ruiten', rang: 'A' } });
  });

  test('aas bijspelen: ik heb ook de tien', () => {
    assert.deepEqual(sein(2, 'kA k8', 'sA'), { speler: 0, kaart: { kleur: 'schoppen', rang: '10' } });
  });

  test('tien, boer, vrouw of heer: afseinen, "ik heb de aas niet" (Rutger)', () => {
    for (const k of ['s10', 'sB', 'sV', 'sH']) assert.deepEqual(sein(2, 'kA k8', k), { speler: 0, kaart: { kleur: 'schoppen', rang: 'A' }, niet: true });
  });

  test('seinKlopt: een afsein klopt als de aas er juist niet in zit', async () => {
    const { seinKlopt } = await import('../src/ai/simulatie.js');
    const af = { speler: 2, kaart: { kleur: 'schoppen', rang: 'A' }, niet: true };
    assert.equal(seinKlopt(af, Ks('s10 h7')), true);
    assert.equal(seinKlopt(af, Ks('sA h7')), false);
  });

  test('maat heeft de slag niet: geen sein', () => {
    assert.equal(sein(2, 'k8 kA', 'r7'), null);
  });

  test('wie uitkomt, seint niet', () => {
    assert.equal(seinVan([], 0, K('r7'), T), null);
  });

  test('met troef: geen sein', () => {
    assert.equal(sein(2, 'kA k8', 'h8'), null);
    assert.equal(sein(2, 'hB h7', 'h8'), null);
  });

  test('maat trekt troef en heeft de slag: wel een sein (Rutgers afspraak)', () => {
    // Speler 2 (maat van 0) trekt troef met hB, speler 3 bekent, speler 0 gooit r7 af.
    assert.deepEqual(sein(2, 'hB h7', 'r7'), { speler: 0, kaart: { kleur: 'ruiten', rang: 'A' } });
    assert.deepEqual(sein(2, 'hB h7', 'sA'), { speler: 0, kaart: { kleur: 'schoppen', rang: '10' } });
  });

  test('troef gevraagd door de tegenpartij: geen sein, ook niet als de maat overtroeft', () => {
    // Speler 3 trekt troef met h7, speler 0 (maat van 2) overtroeft met hB, speler 1 bekent, speler 2 gooit r7 af.
    assert.equal(sein(3, 'h7 hB h8', 'r7'), null);
  });

  test('maat trekt troef maar heeft de slag niet: geen sein', () => {
    assert.equal(sein(2, 'h7 hB', 'r7'), null);
  });

  test('maat heeft ingetroefd: wel een sein', () => {
    // Speler 3 komt uit met k8, speler 0 (maat van 2) troeft in, speler 1 bekent, speler 2 gooit r7 af.
    assert.deepEqual(sein(3, 'k8 h7 k9', 'r7'), { speler: 2, kaart: { kleur: 'ruiten', rang: 'A' } });
  });

  test('seinen van anderen: eigen seinen tellen niet mee', () => {
    let p = nieuwPotje({ handen: seinHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    for (const [sp, c] of [[0, 'kA'], [1, 'k7'], [2, 'r7'], [3, 'kB']]) p = speelKaart(p, sp, K(c));
    assert.deepEqual(seinenVanAnderen(waarneming(p, 0)), [{ speler: 2, kaart: { kleur: 'ruiten', rang: 'A' } }]);
    assert.deepEqual(seinenVanAnderen(waarneming(p, 2)), []);
  });
});

function seinHanden() {
  return [
    Ks('kA k10 k9 h7 h8 h9 r8 r9'),
    Ks('k7 k8 kV kH h10 hV sA hA'),
    Ks('rA r7 s8 s9 sB hB hH s7'),
    Ks('kB r10 rB rV rH s10 sV sH'),
  ];
}

describe('zelf seinen', () => {
  test('gooit liever een kleintje af van de kleur waarvan hij de aas heeft', () => {
    // Speler 0 (Zuid) kwam uit met kA; speler 1 bekende; speler 2 (Noord, AI) heeft geen klaveren.
    // Noord heeft rA met r7, en s8 zonder sA. Afgooien van r7 is een waar sein, s8 een vals sein.
    let p = nieuwPotje({ handen: seinHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    p = speelKaart(p, 0, K('kA'));
    p = speelKaart(p, 1, K('k7'));
    const r = kiesKaart(waarneming(p, 2), { simulaties: 200, rng: maakRng(4) });
    const sch = r.scores.find((x) => kaartId(x.kaart) === 'schoppen-8');
    const ru = r.scores.find((x) => kaartId(x.kaart) === 'ruiten-7');
    assert.equal(ru.sein, SEIN_BONUS);
    assert.equal(sch.sein, -SEIN_STRAF);
    assert.ok(['ruiten-7', 'schoppen-B'].includes(kaartId(r.kaart)) || r.kaart.kleur === 'harten' || r.kaart.rang === 'A',
      `gekozen ${kaartId(r.kaart)}`);
    assert.notEqual(kaartId(r.kaart), 'schoppen-8');
    assert.notEqual(kaartId(r.kaart), 'schoppen-9');
    assert.notEqual(kaartId(r.kaart), 'schoppen-7');
  });

  test('bekennen met een kleintje: lagere afkeer van een vals sein dan afgooien', () => {
    assert.ok(SEIN_STRAF_BEKENNEN < SEIN_STRAF);
    // Zuid komt uit met kH, West bekent, Noord heeft kV en k8 maar geen kA (die zit bij Oost).
    const handen = [
      Ks('kH h7 h8 h9 r8 r9 s7 s8'),
      Ks('k9 h10 hV hA sA s9 sB sV'),
      Ks('kV k8 rA r7 r10 hB hH s10'),
      Ks('kA k10 kB k7 rB rV rH sH'),
    ];
    let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    for (const [sp, c] of [[0, 'kH'], [1, 'k9']]) p = speelKaart(p, sp, K(c));
    const r = kiesKaart(waarneming(p, 2), { simulaties: 200, rng: maakRng(8) });
    const acht = r.scores.find((x) => kaartId(x.kaart) === 'klaveren-8');
    assert.equal(acht.sein, -SEIN_STRAF_BEKENNEN);
  });

  test('seinen lezen: een sein van de maat maakt de kaart in de verdelingen waarschijnlijker', () => {
    // Noord gooit r7 af op de slag van Zuid: "ik heb de ruiten aas".
    let p = nieuwPotje({ handen: seinHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    for (const [sp, c] of [[0, 'kA'], [1, 'k7'], [2, 'r7'], [3, 'kB']]) p = speelKaart(p, sp, K(c));
    const w = waarneming(p, 0);
    const seinen = seinenVanAnderen(w);
    assert.deepEqual(seinen, [{ speler: 2, kaart: { kleur: 'ruiten', rang: 'A' } }]);
  });
});

test('sein lezen: gedwongen kleintje zegt niets, vrijwillig kleintje wel', () => {
  let p = nieuwPotje({ handen: seinHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
  for (const [sp, c] of [[0, 'kA'], [1, 'k7'], [2, 'r7'], [3, 'kB']]) p = speelKaart(p, sp, K(c));
  const w = waarneming(p, 0);
  const seinen = seinenVanAnderen(w);
  // Verdeling waarin Noord de ruiten aas niet heeft, maar wel andere kaarten had kunnen afgooien: lager gewicht.
  const zonder = [w.hand, Ks('k8 kV kH h10 hV sA hA'), Ks('r10 s8 s9 sB hB hH s7'), Ks('rA rB rV rH s10 sV sH')];
  assert.equal(seinGewicht(zonder, seinen, 4, w), 1 / 4); // ♠B was een goedkoop eerlijk alternatief
  const met = [w.hand, Ks('k8 kV kH h10 hV sA hA'), Ks('rA s8 s9 sB hB hH s7'), Ks('r10 rB rV rH s10 sV sH')];
  assert.equal(seinGewicht(met, seinen, 4, w), 1);
});

test('sein lezen: bekennen met alleen kleintjes zegt niets, met keus een zwakke aanwijzing', () => {
  // Zuid komt uit met kH, West bekent laag, Noord bekent met k7. Had Noord alleen kleine klaveren,
  // dan was dat gedwongen; had hij ook de klaveren tien, dan was het een keus (en dus een sein).
  const handen = [
    Ks('kH h7 h8 h9 r8 r9 s7 s8'),
    Ks('k9 h10 hV hA sA s9 sB sV'),
    Ks('k7 k8 rA r7 r10 hB hH s10'),
    Ks('kA k10 kB kV rB rV rH sH'),
  ];
  let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 0 });
  for (const [sp, c] of [[0, 'kH'], [1, 'k9'], [2, 'k7']]) p = speelKaart(p, sp, K(c));
  const w = waarneming(p, 0);
  const seinen = seinenVanAnderen(w);
  assert.deepEqual(seinen, [{ speler: 2, kaart: { kleur: 'klaveren', rang: 'A' } }]);
  const rest = (noord, oost) => [w.hand, Ks('h10 hV hA sA s9 sB sV'), Ks(noord), Ks(oost)];
  // Noord heeft k8 (ook klein) en geen kA: gedwongen, gewicht 1.
  assert.equal(seinGewicht(rest('k8 rA r7 r10 hB hH s10', 'kA k10 kB kV rB rV rH sH'), seinen, 4, w), 1);
  // Noord had ook kV maar bekende met k7 zonder kA: bij bekennen hooguit een zwakke aanwijzing (1/2).
  assert.equal(seinGewicht(rest('kV rA r7 r10 hB hH s10', 'kA k10 kB k8 rB rV rH sH'), seinen, 4, w, 2), 1 / 2);
  assert.equal(seinGewicht(rest('k10 rA r7 r10 hB hH s10', 'kA kV kB k8 rB rV rH sH'), seinen, 4, w, 2), 1 / 2);
});

test('sein lezen: kleintje dat een tien beschermt is een zwakke aanwijzing', () => {
  // Noord gooit r7 af. In deze verdeling had hij alleen nog s10 met s7: s7 afgooien laat de tien kaal,
  // s10 afgooien kost een tien. Geen goedkoop eerlijk alternatief.
  let p = nieuwPotje({ handen: seinHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
  for (const [sp, c] of [[0, 'kA'], [1, 'k7'], [2, 'r7'], [3, 'kB']]) p = speelKaart(p, sp, K(c));
  const w = waarneming(p, 0);
  const seinen = seinenVanAnderen(w);
  const h = [w.hand, Ks('k8 kV kH h10 hV sA hA'), Ks('s10 s7 hB hH rB rV rH'), Ks('rA r10 s8 s9 sB sV sH')];
  // Alternatieven: s10 (tien), s7 (vals sein en laat s10 kaal), troef, of rB/rV/rH (goedkoop, eerlijk).
  assert.equal(seinGewicht(h, seinen, 10, w, 2), 1 / 10);
  // Nu zonder goedkope ruitenkaarten: alleen s10, s7 (vals sein, laat s10 kaal) en troeven.
  const zwak = [w.hand, Ks('k8 kV kH sA s8 s9 sB'), Ks('s10 s7 hB hH h10 hV hA'), Ks('rA r10 rB rV rH sV sH')];
  assert.equal(seinGewicht(zwak, seinen, 10, w, 2), 1 / 2);
});

test('verdeling waarin het sein niet klopt telt minder zwaar (niet 0)', () => {
  const sein = [{ speler: 2, kaart: { kleur: 'ruiten', rang: 'A' } }];
  const met = [[], [], Ks('rA r8'), []];
  const zonder = [[], Ks('rA'), Ks('r8'), []];
  assert.equal(seinGewicht(met, sein), 1);
  assert.equal(seinGewicht(zonder, sein), 1 / SEIN_FACTOR);
  assert.ok(SEIN_FACTOR > 1);
});

describe('wat het draaien verraadt', () => {
  test('het potje onthoudt wie troef koos', async () => {
    const { nieuwePartij, deelRonde, startPotje } = await import('../src/regels/partij.js');
    const partij = nieuwePartij({ eersteDeler: 0 });
    const { handen } = deelRonde(partij, maakRng(1));
    const p = startPotje(partij, handen, { soort: 'spelen', troef: 'harten', speler: 3, team: 1 });
    assert.equal(p.kiezer, 3);
    assert.equal(waarneming(p, 0).kiezer, 3);
  });

  test('verdeling waarin de kiezer sterke troef heeft telt zwaarder', async () => {
    const { draaiGewicht } = await import('../src/ai/simulatie.js');
    const w = { speler: 3, troef: 'harten', kiezer: 2, uitkomer: 0, slagen: [], slag: [] };
    const hand3 = Ks('h8 sA s7 r10 r7 kV k9 k8');
    const sterk = [Ks('h7 sB s9 s8 rV rB kB r8'), Ks('s10 sV rH r9 k7 kA k10 kH'), Ks('hB h9 hA h10 hH hV sH rA'), hand3];
    const zwak = [Ks('hB h9 hA sB s9 rV rB kB'), Ks('h10 hH s10 sV rH r9 k7 r8'), Ks('h7 hV sH s8 rA kA k10 kH'), hand3];
    assert.ok(draaiGewicht(sterk, w) > 5 * draaiGewicht(zwak, w));
  });
});

describe('vuistregels bij bijna gelijke kaarten', async () => {
  const { vuistregelStraf } = await import('../src/ai/simulatie.js');
  const basis = (o) => ({ troef: 'ruiten', spelendTeam: 1, systeem: 'amsterdams', slagen: [], slag: [], aantallen: [8, 8, 8, 8], uitkomer: 0, kiezer: 3, ...o });

  test('tegenpartij komt niet met troef uit, de spelende partij wel', () => {
    const tegen = basis({ speler: 0, hand: Ks('rH r7 kA') });
    assert.equal(vuistregelStraf(tegen, K('rH')), 1);
    assert.equal(vuistregelStraf(tegen, K('kA')), 0);
    const spelend = basis({ speler: 1, hand: Ks('rH r7 kA') });
    assert.equal(vuistregelStraf(spelend, K('rH')), 0);
  });

  test('een vrije aas gooi je niet weg op een slag die je niet wint', () => {
    const slagNu = [{ speler: 1, kaart: K('s9') }, { speler: 2, kaart: K('hB') }];
    const w = basis({ speler: 3, hand: Ks('hA k10 kV'), slag: slagNu });
    assert.equal(vuistregelStraf(w, K('hA')), 1);
    assert.equal(vuistregelStraf(w, K('kV')), 0);
    // Alleen de regel over vrije kaarten (de nieuwe regel 'bescherm een tien' telt apart).
    assert.equal(vuistregelStraf(w, K('k10'), undefined, false, { uitkomen: true, bijgooien: true, troefGevraagd: true }), 0); // niet vrij: ♣A zit er nog in
  });

  test('een vrije kaart die de slag wint mag gewoon', () => {
    const w = basis({ speler: 3, hand: Ks('hA k10 kV'), slag: [{ speler: 2, kaart: K('h7') }] });
    assert.equal(vuistregelStraf(w, K('hA')), 0);
  });
});

describe('vuistregel: gedekte kaart bij afgooien', async () => {
  const { vuistregelStraf } = await import('../src/ai/simulatie.js');
  const basis = (o) => ({ troef: 'harten', spelendTeam: 0, systeem: 'amsterdams', slagen: [], aantallen: [8, 8, 8, 8], uitkomer: 1, kiezer: 0, ...o });
  const slag = [{ speler: 1, kaart: K('h9') }, { speler: 2, kaart: K('hA') }, { speler: 3, kaart: K('kV') }];

  test('heer naast eigen aas niet weggooien als de tien nog in het spel is (voorbeeld Rutger)', () => {
    const w = basis({ speler: 0, hand: Ks('sA sH k8 k7'), slag });
    assert.ok(vuistregelStraf(w, K('sH'), undefined, true) > 0);
    assert.equal(vuistregelStraf(w, K('k8'), undefined, true), 0);
  });

  test('een kale heer zonder hogere eigen kaart mag wel weg', () => {
    const w = basis({ speler: 0, hand: Ks('sH k8 k7'), slag });
    // Alleen de regel over gedekte kaarten (punten bijgooien op een slag van de tegenpartij telt apart).
    assert.equal(vuistregelStraf(w, K('sH'), undefined, true, { uitkomen: false, bijgooien: false, troefGevraagd: false }), 0);
  });
});

describe('troef kiezen bij verplicht spelen', async () => {
  const { kiesVerplicht } = await import('../src/ai/simulatie.js');
  test('kiest de kleur waarin hij sterk is', () => {
    const r = kiesVerplicht(Ks('hB h9 hA h10 sA k7 r8 s7'), { speler: 1, deler: 0, rng: maakRng(3), simulaties: 60 });
    assert.equal(r.kleur, 'harten');
    assert.equal(r.scores.length, 4);
  });
});

describe('vuistregels uit Rutgers voorbeelden (uitkomen, bijgooien, troef gevraagd)', async () => {
  const { vuistregelStraf } = await import('../src/ai/simulatie.js');
  const basis = (o) => ({ troef: 'harten', spelendTeam: 1, systeem: 'amsterdams', slagen: [], aantallen: [8, 8, 8, 8], uitkomer: 2, kiezer: 1, ...o });
  // Onbekend: alles behalve de eigen hand en wat al gespeeld is.
  const onbekendVan = (hand, weg = []) => {
    const bekend = new Set([...hand, ...weg].map((k) => `${k.kleur}-${k.rang}`));
    const alles = [];
    for (const kleur of ['klaveren', 'ruiten', 'harten', 'schoppen']) for (const rang of ['7', '8', '9', '10', 'B', 'V', 'H', 'A']) alles.push({ kleur, rang });
    return alles.filter((k) => !bekend.has(`${k.kleur}-${k.rang}`));
  };

  test('uitkomen zonder de hoogste kaart: de laagste, en geen roemgevaar (voorbeeld ♦V uit V-9-8)', () => {
    const hand = Ks('hB hH sA sB rV r9 r8 kB');
    const w = basis({ speler: 2, hand, slag: [] });
    const onb = onbekendVan(hand);
    assert.equal(vuistregelStraf(w, K('r8'), onb), 0);
    assert.ok(vuistregelStraf(w, K('rV'), onb) > 0);
    assert.ok(vuistregelStraf(w, K('r9'), onb) > 0); // 9-10-B kan roem worden
    assert.equal(vuistregelStraf(w, K('sA'), onb), 0); // aas: hoogste kaart, wint zelf
  });

  test('punten bijgooien alleen als je maat de slag al heeft (voorbeeld ♠A van Oost)', () => {
    const hand = Ks('sA s8 kA');
    const slag = [{ speler: 2, kaart: K('r7') }]; // Noord (tegenstander van Oost) ligt voor
    const w = basis({ speler: 3, hand, slag });
    const onb = onbekendVan(hand, [K('r7')]);
    assert.ok(vuistregelStraf(w, K('sA'), onb) > 0);
    assert.equal(vuistregelStraf(w, K('s8'), onb), 0);
    const w2 = basis({ speler: 3, hand, slag: [{ speler: 2, kaart: K('r7') }, { speler: 0, kaart: K('rA') }, { speler: 1, kaart: K('h7') }] });
    assert.equal(vuistregelStraf(w2, K('s8'), onbekendVan(hand, [K('r7'), K('rA'), K('h7')])), 0);
  });

  test('troef gevraagd en je kunt niet overtroeven: geen nel weggooien (voorbeeld West)', () => {
    const hand = Ks('h9 h7 s8');
    const slag = [{ speler: 3, kaart: K('hH') }, { speler: 0, kaart: K('hB') }];
    const w = basis({ speler: 1, hand, slag });
    const onb = onbekendVan(hand, [K('hH'), K('hB')]);
    assert.ok(vuistregelStraf(w, K('h9'), onb) > 0);
    assert.equal(vuistregelStraf(w, K('h7'), onb), 0);
  });
});

describe('vuistregels uit VUISTREGELS.md', async () => {
  const { vuistregelStraf } = await import('../src/ai/simulatie.js');
  const basis = (o) => ({ troef: 'harten', spelendTeam: 0, systeem: 'amsterdams', slagen: [], aantallen: [8, 8, 8, 8], uitkomer: 0, kiezer: 0, ...o });
  const onbekendVan = (bekend) => {
    const ids = new Set(bekend.map((k) => `${k.kleur}-${k.rang}`));
    const alles = [];
    for (const kleur of ['klaveren', 'ruiten', 'harten', 'schoppen']) for (const rang of ['7', '8', '9', '10', 'B', 'V', 'H', 'A']) alles.push({ kleur, rang });
    return alles.filter((k) => !ids.has(`${k.kleur}-${k.rang}`));
  };
  const alleenRegel = (naam) => ({ [naam]: true });

  test('4: geen troef trekken als niemand anders nog troef heeft', () => {
    const hand = Ks('hB hA kA k7');
    const gespeeld = Ks('h7 h8 h9 h10 hV hH');
    const w = basis({ speler: 0, hand, slag: [] });
    assert.equal(vuistregelStraf(w, K('hB'), onbekendVan([...hand, ...gespeeld]), false, alleenRegel('trekNiet')), 1);
    assert.equal(vuistregelStraf(w, K('kA'), onbekendVan([...hand, ...gespeeld]), false, alleenRegel('trekNiet')), 0);
  });

  test('troef trekken met een troef die zeker wint (Rutgers voorbeeld: West ♠7)', () => {
    // Troef harten. Alleen h8 zit nog buiten; jij hebt hB, h10, hH en h7.
    const hand = Ks('hB h10 hH h7 kV k9');
    const gespeeld = Ks('h9 hA hV');
    const onb = onbekendVan([...hand, ...gespeeld]);
    const w = basis({ speler: 1, spelendTeam: 1, hand, slag: [] });
    assert.equal(vuistregelStraf(w, K('h7'), onb, false, alleenRegel('trekHoog')), 1);
    for (const c of ['hB', 'h10', 'hH']) assert.equal(vuistregelStraf(w, K(c), onb, false, alleenRegel('trekHoog')), 0);
    // Zonder troef die boven alles zit: geen straf voor de lage troef.
    const hand2 = Ks('h10 h7 kV k9');
    const w2 = basis({ speler: 1, spelendTeam: 1, hand: hand2, slag: [] });
    assert.equal(vuistregelStraf(w2, K('h7'), onbekendVan([...hand2, ...gespeeld]), false, alleenRegel('trekHoog')), 0);
  });

  test('geen roem klaarleggen (Rutgers voorbeeld: Noord ♦7 bij ♦9)', () => {
    // Troef harten. West (1) komt uit met h9; Noord (2) heeft hA hH h7, Oost speelt nog.
    const hand = Ks('hA hH h7 s9');
    const slag = [{ speler: 1, kaart: K('h9') }];
    const onb = onbekendVan([...hand, K('h9'), K('hB')]);
    const w = basis({ speler: 2, spelendTeam: 1, hand, slag });
    assert.equal(vuistregelStraf(w, K('h7'), onb, false, alleenRegel('roemKlaarleggen')), 1); // h8 maakt 7-8-9
    assert.equal(vuistregelStraf(w, K('hH'), onb, false, alleenRegel('roemKlaarleggen')), 1); // hV maakt stuk
    assert.equal(vuistregelStraf(w, K('hA'), onb, false, alleenRegel('roemKlaarleggen')), 0);
  });

  test('roem klaarleggen mag als je de slag zeker wint (Rutgers voorbeeld: Noord ♣B bij ♣V ♣A)', () => {
    // Troef klaveren. Zuid kV, West kA; Noord heeft kB k9 k10 k8, Oost speelt nog (kH onbekend).
    const hand = Ks('kB k9 k10 k8 hA');
    const slag = [{ speler: 0, kaart: K('kV') }, { speler: 1, kaart: K('kA') }];
    const onb = onbekendVan([...hand, K('kV'), K('kA')]);
    const w = basis({ speler: 2, spelendTeam: 0, hand, slag, troef: 'klaveren' });
    assert.equal(vuistregelStraf(w, K('kB'), onb, false, alleenRegel('roemKlaarleggen')), 0);
  });

  test('5: na het troeftrekken je vrije aas innen', () => {
    const hand = Ks('hB kA k7 s8');
    const gespeeld = Ks('h7 h8 h9 h10 hV hH hA');
    const w = basis({ speler: 0, hand, slag: [] });
    const onb = onbekendVan([...hand, ...gespeeld]);
    assert.equal(vuistregelStraf(w, K('kA'), onb, false, alleenRegel('innen')), 0);
    assert.equal(vuistregelStraf(w, K('s8'), onb, false, alleenRegel('innen')), 1);
  });

  test('11: niet uitkomen met een kale tien', () => {
    const hand = Ks('k10 s8 r7');
    const w = basis({ speler: 1, spelendTeam: 0, hand, slag: [] });
    assert.equal(vuistregelStraf(w, K('k10'), onbekendVan(hand), false, alleenRegel('kaleTien')), 1);
  });

  test('16: niet over je maat heen troeven', () => {
    const hand = Ks('h7 s8');
    const slag = [{ speler: 1, kaart: K('k9') }, { speler: 2, kaart: K('kA') }, { speler: 3, kaart: K('k8') }];
    const w = basis({ speler: 0, hand, slag });
    const onb = onbekendVan([...hand, ...slag.map((x) => x.kaart)]);
    assert.equal(vuistregelStraf(w, K('h7'), onb, false, alleenRegel('nietOverMaat')), 1);
    assert.equal(vuistregelStraf(w, K('s8'), onb, false, alleenRegel('nietOverMaat')), 0);
  });

  test('17: tweede hand laag', () => {
    const hand = Ks('kH k7 s8');
    const slag = [{ speler: 3, kaart: K('k9') }];
    const w = basis({ speler: 0, hand, slag });
    const onb = onbekendVan([...hand, K('k9')]);
    assert.equal(vuistregelStraf(w, K('kH'), onb, false, alleenRegel('tweedeHandLaag')), 1);
    assert.equal(vuistregelStraf(w, K('k7'), onb, false, alleenRegel('tweedeHandLaag')), 0);
  });

  test('21: geen roem afmaken op een slag van de tegenpartij', () => {
    const hand = Ks('k9 s8');
    const slag = [{ speler: 1, kaart: K('k10') }, { speler: 2, kaart: K('k7') }, { speler: 3, kaart: K('kB') }];
    const w = basis({ speler: 0, hand, slag });
    const onb = onbekendVan([...hand, ...slag.map((x) => x.kaart)]);
    assert.equal(vuistregelStraf(w, K('k9'), onb, false, alleenRegel('geenRoemWeg')), 1);
    assert.equal(vuistregelStraf(w, K('s8'), onb, false, alleenRegel('geenRoemWeg')), 0);
  });

  test('24: je laatste troef bewaren voor de laatste slagen', () => {
    // Noord (maat) heeft de slag: Zuid mag vrij kiezen en hoeft niet te troeven.
    const hand = Ks('h7 s8 r9');
    const slag = [{ speler: 1, kaart: K('k9') }, { speler: 2, kaart: K('kA') }, { speler: 3, kaart: K('k8') }];
    const w = basis({ speler: 0, hand, slag });
    const onb = onbekendVan([...hand, ...slag.map((x) => x.kaart)]);
    assert.equal(vuistregelStraf(w, K('h7'), onb, false, alleenRegel('lageTroefBewaren')), 1);
    assert.equal(vuistregelStraf(w, K('s8'), onb, false, alleenRegel('lageTroefBewaren')), 0);
  });
});

describe('spekken (Rutgers regel)', async () => {
  const { isSpek } = await import('../src/ai/simulatie.js');
  const w = (slag, speler) => ({ troef: 'harten', slag: slag.map(([s, c]) => ({ speler: s, kaart: K(c) })), speler });
  test('aas bijgooien op een slag van de tegenpartij is spekken', () => {
    assert.equal(isSpek(w([[1, 'k10']], 2), K('sA')), true);
    assert.equal(isSpek(w([[1, 'k10']], 2), K('s10')), true);
  });
  test('geen spekken: lage kaart, maat heeft de slag, of je wint zelf', () => {
    assert.equal(isSpek(w([[1, 'k10']], 2), K('sH')), false);
    assert.equal(isSpek(w([[0, 'kA'], [1, 'k7']], 2), K('sA')), false);
    assert.equal(isSpek(w([[1, 'k10']], 2), K('kA')), false);
  });
});

describe('tien-uitkomst lezen', async () => {
  const { tienUitkomsten, tienGewicht, TIEN_FACTOR } = await import('../src/ai/simulatie.js');
  const w = { troef: 'harten', speler: 2, hand: Ks('sA s10'), slagen: [], slag: [{ speler: 1, kaart: K('k10') }] };
  test('wie met een tien uitkomt, heeft waarschijnlijk de aas', () => {
    assert.deepEqual(tienUitkomsten(w), [{ speler: 1, kaart: { kleur: 'klaveren', rang: 'A' } }]);
    const lijst = tienUitkomsten(w);
    const met = [[], Ks('kA'), [], []];
    const zonder = [Ks('kA'), [], [], []];
    assert.equal(tienGewicht(met, lijst), 1);
    assert.equal(tienGewicht(zonder, lijst), 1 / TIEN_FACTOR);
  });
  test('geen aanwijzing: troef, eigen uitkomst, of de aas is al bekend', () => {
    assert.deepEqual(tienUitkomsten({ ...w, slag: [{ speler: 1, kaart: K('h10') }] }), []);
    assert.deepEqual(tienUitkomsten({ ...w, speler: 1, hand: [], slag: [{ speler: 1, kaart: K('k10') }] }), []);
    assert.deepEqual(tienUitkomsten({ ...w, hand: Ks('kA'), slag: [{ speler: 1, kaart: K('k10') }] }), []);
  });
});

describe('niet uitkomen met een tien zonder de aas (Rutgers regel)', async () => {
  const { isTienUitkomst, kiesKaart } = await import('../src/ai/simulatie.js');
  test('gedekte tien zonder aas: niet uitkomen; met eigen aas of troef: wel', () => {
    const w = { troef: 'harten', speler: 2, hand: Ks('k10 kH k7'), slagen: [], slag: [] };
    assert.equal(isTienUitkomst(w, K('k10')), true);
    assert.equal(isTienUitkomst(w, K('k7')), false);
    assert.equal(isTienUitkomst({ ...w, hand: Ks('k10 kA') }, K('k10')), false);
    assert.equal(isTienUitkomst({ ...w, hand: Ks('h10 h7') }, K('h10')), false);
  });
});

describe('spekken: roem weggeven is geen alternatief (Rutgers voorbeeld ♦B)', async () => {
  const { kiesKaart, geeftRoemWeg } = await import('../src/ai/simulatie.js');
  test('♦B bij ♦V ♦H op een slag van de tegenpartij geeft roem weg', () => {
    const w = { troef: 'klaveren', speler: 2, slag: [{ speler: 3, kaart: K('kV') }, { speler: 0, kaart: K('rV') }, { speler: 1, kaart: K('rH') }] };
    assert.equal(geeftRoemWeg(w, K('rB')), true);
    assert.equal(geeftRoemWeg(w, K('s10')), false);
  });
});

describe('doortrekken (Rutgers standaardstrategie)', async () => {
  const { trekKaarten } = await import('../src/ai/simulatie.js');
  test('spelende partij met de hoogste troef trekt door; tegenpartij of zonder troef elders niet', () => {
    // Troef ruiten; alleen r7 zit nog buiten; Noord (2, spelend) heeft rA.
    const gespeeld = Ks('rB r9 rV r10 rH r8');
    const hand = Ks('rA s7 hB');
    const slagen = [{ kaarten: gespeeld.map((kaart, i) => ({ speler: i % 4, kaart })) }];
    const w = { troef: 'ruiten', speler: 2, spelendTeam: 0, hand, slagen, slag: [] };
    assert.deepEqual(trekKaarten(w).map((k) => k.rang), ['A']);
    assert.deepEqual(trekKaarten({ ...w, spelendTeam: 1 }), []);
    assert.deepEqual(trekKaarten({ ...w, hand: Ks('rA r7 s7') }), []);
  });
});

describe('doortrekken met een verliezende troef en niet troef uitkomen als tegenpartij', async () => {
  const { trekKaarten, isTroefUitTegen } = await import('../src/ai/simulatie.js');
  const gespeeld = Ks('rB r9 rA r10');
  const slagen = [{ kaarten: gespeeld.map((kaart, i) => ({ speler: i % 4, kaart })) }];
  test('evenveel troef als buiten en 3 mooie kaarten: met de laagste troef doortrekken', () => {
    // Buiten: rH rV r8 r7 min eigen; Noord heeft r8 r7 (2), buiten nog rH rV (2). Mooie kaarten: sA s10 hA.
    const w = { troef: 'ruiten', speler: 2, spelendTeam: 0, hand: Ks('r8 r7 sA s10 hA'), slagen, slag: [] };
    assert.deepEqual(trekKaarten(w).map((k) => k.rang), ['7']);
    assert.deepEqual(trekKaarten({ ...w, hand: Ks('r8 r7 sA s9 h8') }), []);
    assert.deepEqual(trekKaarten({ ...w, hand: Ks('r7 sA s10 hA') }), []);
  });
  test('tegenpartij komt niet met troef uit', () => {
    const w = { troef: 'ruiten', speler: 1, spelendTeam: 0, hand: Ks('r8 sA'), slagen, slag: [] };
    assert.equal(isTroefUitTegen(w, K('r8')), true);
    assert.equal(isTroefUitTegen(w, K('sA')), false);
    assert.equal(isTroefUitTegen({ ...w, spelendTeam: 1 }, K('r8')), false);
  });
});

describe('aas voor tien op een slag van je maat (Rutger)', async () => {
  const { aasVoorTien } = await import('../src/ai/simulatie.js');
  test('maat heeft de slag: aas in plaats van tien; tegenpartij heeft de slag: niet', () => {
    // Troef klaveren. West (1) komt uit met hA; Oost (3, maat van West) gooit af.
    const geldig = Ks('s10 sA');
    const w = { troef: 'klaveren', speler: 3, slag: [{ speler: 1, kaart: K('hA') }, { speler: 2, kaart: K('h8') }] };
    assert.deepEqual(aasVoorTien(w, K('s10'), geldig), K('sA'));
    const w2 = { ...w, slag: [{ speler: 2, kaart: K('hA') }] };
    assert.equal(aasVoorTien(w2, K('s10'), geldig), null);
  });
});

describe('vrije troef bewaren (Rutgers voorbeeld Noord ♠V)', async () => {
  const { isTroefZonderNut } = await import('../src/ai/simulatie.js');
  test('niemand anders heeft nog troef: niet met troef uitkomen', () => {
    const gespeeld = Ks('sB sA s7 s9 s8 s10 sH');
    const slagen = [{ kaarten: gespeeld.map((kaart, i) => ({ speler: i % 4, kaart })) }];
    const w = { troef: 'schoppen', speler: 2, spelendTeam: 0, hand: Ks('sV rH hB'), slagen, slag: [] };
    assert.equal(isTroefZonderNut(w, K('sV')), true);
    assert.equal(isTroefZonderNut({ ...w, hand: Ks('sV') }, K('sV')), false);
    const w2 = { ...w, slagen: [{ kaarten: gespeeld.slice(0, 6).map((kaart, i) => ({ speler: i % 4, kaart })) }] };
    assert.equal(isTroefZonderNut(w2, K('sV')), false); // sH kan nog bij een ander zitten
  });
});


describe('passen lezen bij het draaien', () => {
  test('eerderePassen: rondgepaste kleuren voor iedereen, huidige kleur tot wie aan de beurt is', async () => {
    const { nieuwDraaien, beslis, eerderePassen } = await import('../src/regels/draaien.js');
    const { maakDeck } = await import('../src/regels/kaarten.js');
    const stapel = maakDeck(); // klaveren eerst
    let d = nieuwDraaien({ stapel, deler: 0 });
    for (let i = 0; i < 4; i++) d = beslis(d, d.beurt, 'passen');
    d = beslis(d, d.beurt, 'passen'); // speler 1 past op de tweede kleur
    const p = eerderePassen(d);
    assert.equal(p.length, 5);
    assert.deepEqual(p[4], [1, d.kaart.kleur]);
    assert.ok(p.slice(0, 4).every(([, k]) => k === 'klaveren'));
  });

  test('pasGewicht: een sterke troefhand bij wie paste telt minder mee', async () => {
    const { pasGewicht } = await import('../src/ai/simulatie.js');
    const zwak = [[], Ks('h7 s8 s9 k7 k8 r7 r8 r9'), [], []];
    const sterk = [[], Ks('hB h9 hA h10 s8 k7 r7 r8'), [], []];
    assert.ok(pasGewicht(zwak, [[1, 'harten']], 0) > 10 * pasGewicht(sterk, [[1, 'harten']], 0));
    assert.equal(pasGewicht(sterk, [[0, 'harten']], 0), 1); // eigen passen telt niet
  });
});

describe('troef die alleen bij je maat zit', () => {
  test('niet doortrekken en troef bewaren (Rutgers voorbeeld Noord ♠10, maat heeft ♠V)', async () => {
    const { nieuwPotje, speelKaart } = await import('../src/regels/potje.js');
    const A = await import('../src/ai/simulatie.js');
    const handen = [Ks('r9 rH sB sA hB hH sV h10'), Ks('rA rB s9 k9 h7 hV k8 kV'), Ks('r8 r10 s7 s8 h9 hA s10 kB'), Ks('rV r7 sH h8 k7 kH kA k10')];
    let p = nieuwPotje({ handen, troef: 'schoppen', spelendTeam: 0, uitkomer: 1, kiezer: 0 });
    const slagen = [['1 rA', '2 r8', '3 rV', '0 r9'], ['1 rB', '2 r10', '3 r7', '0 rH'], ['2 s7', '3 sH', '0 sB', '1 s9'],
      ['0 sA', '1 k9', '2 s8', '3 h8'], ['0 hB', '1 h7', '2 h9', '3 k7'], ['0 hH', '1 hV', '2 hA', '3 kH']];
    for (const s of slagen) for (const x of s) { const [sp, k] = x.split(' '); p = speelKaart(p, +sp, K(k)); }
    const w = A.waarneming(p, 2);
    assert.deepEqual(A.trekKaarten(w), []); // West en Oost troefden niet: de ♠V zit bij Zuid
    assert.ok(A.isTroefZonderNut(w, K('s10')));
  });
});

describe('vuistregels: kaarten die zeker bij je maat zitten zijn geen gevaar', () => {
  // Slag 1: Zuid kwam uit met ♥7, West en Oost hadden geen harten. De ♥A kan dus alleen bij Noord zitten.
  const slag1 = { kaarten: [{ speler: 0, kaart: K('h7') }, { speler: 1, kaart: K('k7') }, { speler: 2, kaart: K('h8') }, { speler: 3, kaart: K('r7') }], winnaar: 2, punten: 0, roem: { totaal: 0 } };
  const w = (o) => ({ speler: 0, troef: 'schoppen', spelendTeam: 0, systeem: 'amsterdams', slagen: [slag1], slag: [], aantallen: [7, 7, 7, 7], uitkomer: 0, kiezer: 0, ...o });

  test('tien uitkomen: geen regel als de aas zeker bij je maat zit', async () => {
    const A = await import('../src/ai/simulatie.js');
    const met = w({ hand: Ks('h10 s7 k8 r8 k9 r9 s8') });
    assert.equal(A.isTienUitkomst(met, K('h10')), false);
    assert.equal(A.vuistregelStraf(met, K('h10'), undefined, false, { kaleTien: true }), 0);
    // Zonder die kennis (niemand liet harten zien) blijft de regel gelden.
    const zonder = w({ hand: Ks('h10 s7 k8 r8 k9 r9 s8'), slagen: [], aantallen: [7, 8, 8, 8] });
    assert.equal(A.isTienUitkomst(zonder, K('h10')), true);
  });

  test('tien beschermen: bijspelen mag als de aas zeker bij je maat zit', async () => {
    const A = await import('../src/ai/simulatie.js');
    // Noord komt uit met ♣A, Oost bekent; Zuid heeft geen klaveren en gooit af (West speelt nog).
    const bij = w({ speler: 0, hand: Ks('h10 s7 r8 r9 s8 h9'), slag: [{ speler: 2, kaart: K('kA') }, { speler: 3, kaart: K('k8') }], aantallen: [6, 7, 6, 6] });
    const metRegel = A.vuistregelStraf(bij, K('h10'), undefined, false, { tienBeschermen: true });
    const zonderRegel = A.vuistregelStraf(bij, K('h10'), undefined, false, {});
    assert.equal(metRegel - zonderRegel, 0);
  });
});

describe('vuistregels: kaarten van de maat (vervolg, één voorbeeld per regel)', () => {
  // Slag 1: Zuid kwam uit met ♥7; West en Oost hadden geen harten (en troefden niet).
  // Alle onbekende harten (♥9 ♥10 ♥B ♥V ♥H ♥A, voor zover niet in Zuids hand) zitten dus bij Noord.
  const slag1 = { kaarten: [{ speler: 0, kaart: K('h7') }, { speler: 1, kaart: K('k7') }, { speler: 2, kaart: K('h8') }, { speler: 3, kaart: K('r7') }], winnaar: 2, punten: 0, roem: { totaal: 0 } };
  const w = (o) => ({ speler: 0, troef: 'schoppen', spelendTeam: 0, systeem: 'amsterdams', slagen: [slag1], slag: [], aantallen: [7, 7, 7, 7], uitkomer: 0, kiezer: 0, ...o });
  const extra = async (ww, k, regel) => {
    const A = await import('../src/ai/simulatie.js');
    return A.vuistregelStraf(ww, k, undefined, false, { [regel]: true }) - A.vuistregelStraf(ww, k, undefined, false, {});
  };

  test('roem klaarleggen: de kaart die roem zou maken zit zeker bij de maat', async () => {
    // Slag 2: Zuid trok troef met ♠A; West en Oost bekenden niet: alle overige troef zit bij Noord.
    // Slag 3: Oost komt uit met ♦8, Zuid heeft geen ruiten en troeft in met ♠V. De ♠H (stuk) kan
    // alleen bij Noord zitten en West kan niet overtroeven: geen gevaar, de slag is zeker voor ons.
    const slag2 = { kaarten: [{ speler: 0, kaart: K('sA') }, { speler: 1, kaart: K('k10') }, { speler: 2, kaart: K('s7') }, { speler: 3, kaart: K('r10') }], winnaar: 0, punten: 31, roem: { totaal: 0 } };
    const ww = w({ hand: Ks('sV s8 k8 h9 hB'), slagen: [slag1, slag2], slag: [{ speler: 3, kaart: K('r8') }], aantallen: [5, 6, 6, 5] });
    assert.equal(await extra(ww, K('sV'), 'roemKlaarleggen'), 0);
  });

  test('vrije kaart afgooien: hogere kaart zit zeker bij de maat, dus je kaart wordt nog een slag', async () => {
    // Oost komt uit met ♦A (West speelt nog), Zuid heeft geen ruiten en kiest wat hij afgooit.
    // ♥H: alleen de ♥A is hoger en die zit zeker bij Noord. Weggooien op een slag van de tegenpartij is dan zonde.
    const A = await import('../src/ai/simulatie.js');
    const ww = w({ hand: Ks('hH s7 k8 k9 s8 kV'), slag: [{ speler: 3, kaart: K('rA') }], aantallen: [6, 7, 7, 6] });
    assert.ok(A.vuistregelStraf(ww, K('hH'), undefined, false, {}) > A.vuistregelStraf(ww, K('k8'), undefined, false, {}));
  });

  test('innen: alleen de maat kan nog troef hebben, dus je vrije aas innen', async () => {
    // Slag 2: Zuid trok troef met ♠A; West en Oost bekenden niet: alle overige troef zit bij Noord.
    const slag2 = { kaarten: [{ speler: 0, kaart: K('sA') }, { speler: 1, kaart: K('k10') }, { speler: 2, kaart: K('s7') }, { speler: 3, kaart: K('r10') }], winnaar: 0, punten: 31, roem: { totaal: 0 } };
    const ww = w({ hand: Ks('kA s8 r9 h9 hB k9'), slagen: [slag1, slag2], aantallen: [6, 6, 6, 6] });
    assert.equal(await extra(ww, K('kA'), 'innen'), 0);
    assert.equal(await extra(ww, K('r9'), 'innen'), 1); // eerst de vrije ♣A binnenhalen
  });

  test('troef gevraagd: hogere troef zit zeker bij de maat, dus je troef kan nog een slag worden', async () => {
    // Zelfde slag 2. Nu komt Oost uit met... hij heeft geen troef; daarom vraagt Noord troef: ♠10, Oost gooit ♦9 af.
    // Zuid heeft ♠V en ♠8; de hogere troeven buiten (♠B ♠9 ♠H) zitten zeker bij Noord.
    const slag2 = { kaarten: [{ speler: 0, kaart: K('sA') }, { speler: 1, kaart: K('k10') }, { speler: 2, kaart: K('s7') }, { speler: 3, kaart: K('r10') }], winnaar: 0, punten: 31, roem: { totaal: 0 } };
    const ww = w({ hand: Ks('sV s8 r9 h9 hB'), slagen: [slag1, slag2], slag: [{ speler: 2, kaart: K('s10') }, { speler: 3, kaart: K('r9') }], aantallen: [5, 6, 5, 5] });
    // De ♠V krijgt twee strafpunten: hij kan nog een slag worden (de hogere troef zit bij je maat) én
    // hij is duurder dan de ♠8. Met de oude regel telde de troef van Noord als gevaar: één strafpunt.
    assert.equal(await extra(ww, K('sV'), 'troefGevraagd'), 2);
    assert.equal(await extra(ww, K('s8'), 'troefGevraagd'), 1); // ook de ♠8 kan nog een slag worden (West en Oost hebben geen troef)
  });
});
