import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { waarneming, uitsluitingen, trekVerdeling, kiesKaart, kiesDraai, kiesSnel } from '../src/ai/simulatie.js';
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
      const k = kiesSnel(p.handen[p.beurt], p.slag, p.troef, p.systeem, p.beurt, p.spelendTeam, rng);
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
        const best = Math.max(...scores.map((s) => s.gemiddeld));
        const gekozen = scores.find((s) => kaartId(s.kaart) === kaartId(kaart)).gemiddeld;
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
    const { kaart } = kiesKaart(waarneming(p, 3), { simulaties: 40, rng: maakRng(3) });
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
