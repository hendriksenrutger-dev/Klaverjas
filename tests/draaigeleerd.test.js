import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { geleerdVerschil, kenmerkenDraai, DRAAI_GEWICHTEN } from '../src/ai/draaigeleerd.js';
import { kiesDraai } from '../src/ai/simulatie.js';
import { nieuwDraaien, beslis, eerderePassen } from '../src/regels/draaien.js';
import { maakDeck, kaartId } from '../src/regels/kaarten.js';
import { maakRng } from '../src/regels/rng.js';

const hand = (s) => s.split(' ').map((x) => { const [kleur, rang] = x.split('-'); return { kleur, rang }; });

describe('geleerd spelen of passen', () => {
  test('evenveel kenmerken als gewichten', () => {
    const x = kenmerkenDraai({ hand: ['klaveren-B'], troef: 'klaveren', plek: 1, ronde: 0, gepast: [], g: 0 });
    assert.equal(x.length, DRAAI_GEWICHTEN.length);
  });

  test('4 troef met de boer: spelen, ook als de simulatie twijfelt', () => {
    const h = hand('klaveren-B klaveren-9 klaveren-7 klaveren-8 harten-7 harten-8 ruiten-7 schoppen-8');
    assert.ok(geleerdVerschil(h, 'klaveren', 0, 1, 0) > 0);
  });

  test('2 troef zonder boer: passen, ook als de simulatie +30 schat', () => {
    const h = hand('klaveren-H klaveren-8 harten-A harten-10 ruiten-7 ruiten-8 schoppen-7 schoppen-9');
    assert.ok(geleerdVerschil(h, 'klaveren', 30, 1, 0) < 0);
  });

  test('ronde en gepaste kleuren komen goed uit eerderePassen', () => {
    // Iedereen past op de eerste kleur; daarna een nieuwe kleur, twee spelers passen.
    let d = nieuwDraaien({ stapel: maakDeck(), deler: 0, maxRondes: 2 });
    const eerste = d.kaart.kleur;
    for (let i = 0; i < 4; i++) d = beslis(d, d.beurt, 'passen');
    d = beslis(d, d.beurt, 'passen');
    d = beslis(d, d.beurt, 'passen');
    const h = hand('klaveren-B klaveren-9 harten-7 harten-8 ruiten-7 ruiten-A schoppen-8 schoppen-10');
    const speler = d.beurt;
    const viaApp = geleerdVerschil(h, d.kaart.kleur, 12, speler, 0, eerderePassen(d));
    const x = kenmerkenDraai({ hand: h.map(kaartId), troef: d.kaart.kleur, plek: speler, ronde: d.rondes, gepast: d.gepast, g: 12 });
    const direct = DRAAI_GEWICHTEN.reduce((s, w, i) => s + w * x[i], 0);
    assert.equal(d.gepast[0], eerste);
    assert.ok(Math.abs(viaApp - direct) < 1e-9);
  });

  test('kiesDraai gebruikt het geleerde besluit bij slim, de drempel bij simpel', () => {
    const h = hand('klaveren-B klaveren-9 klaveren-A harten-7 harten-8 ruiten-7 ruiten-A schoppen-8');
    const slim = kiesDraai(h, 'klaveren', { speler: 1, deler: 0, rng: maakRng(3), simulaties: 30 });
    assert.equal(typeof slim.verwacht, 'number');
    assert.equal(slim.keuze, slim.verwacht > 0 ? 'spelen' : 'passen');
    const simpel = kiesDraai(h, 'klaveren', { speler: 1, deler: 0, rng: maakRng(3), simulaties: 30, strategie: 'simpel' });
    assert.equal(simpel.verwacht, undefined);
    assert.equal(simpel.keuze, simpel.gemiddeld > 10 ? 'spelen' : 'passen');
  });
});
