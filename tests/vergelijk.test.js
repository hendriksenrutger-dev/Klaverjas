import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { beoordeelKaart, legeVergelijking, telOp, GELIJKWAARDIG } from '../src/ai/vergelijk.js';
import { K } from './hulp.js';

const scores = [
  { kaart: K('hA'), gemiddeld: 40 },
  { kaart: K('kV'), gemiddeld: 38 },
  { kaart: K('k10'), gemiddeld: 10 },
];

describe('vergelijk met de computer', () => {
  test('dezelfde kaart als de computer', () => {
    assert.deepEqual(beoordeelKaart(scores, K('hA'), K('hA')), { oordeel: 'zelfde', verschil: 0 });
  });

  test('klein verschil telt als gelijkwaardig', () => {
    const b = beoordeelKaart(scores, K('hA'), K('kV'));
    assert.equal(b.oordeel, 'gelijkwaardig');
    assert.equal(b.verschil, -1); // (38 - 40) / 2: verschil wij − zij omgerekend naar punten
    assert.ok(Math.abs(b.verschil) < GELIJKWAARDIG);
  });

  test('duidelijk slechtere kaart', () => {
    assert.deepEqual(beoordeelKaart(scores, K('hA'), K('k10')), { oordeel: 'minder', verschil: -15 });
  });

  test('beter dan de kaart van de computer kan ook', () => {
    assert.deepEqual(beoordeelKaart(scores, K('k10'), K('hA')), { oordeel: 'beter', verschil: 15 });
  });

  test('totalen over de partij', () => {
    let t = legeVergelijking();
    t = telOp(t, { soort: 'kaart', oordeel: 'zelfde', verschil: 0 });
    t = telOp(t, { soort: 'kaart', oordeel: 'minder', verschil: -15 });
    t = telOp(t, { soort: 'kaart', oordeel: 'gelijkwaardig', verschil: 1 });
    t = telOp(t, { soort: 'draai', jij: 'spelen', computer: 'passen' });
    t = telOp(t, { soort: 'draai', jij: 'passen', computer: 'passen' });
    assert.deepEqual(t, { kaarten: 3, zelfde: 1, gelijkwaardig: 1, beter: 0, minder: 1, punten: -14, draaien: 2, draaiAnders: 1 });
  });
});

test('5 punten verschil (voorbeeld Rutger) telt als even goed', () => {
  const s = [{ kaart: K('sH'), gemiddeld: 20 }, { kaart: K('k8'), gemiddeld: 10 }];
  assert.equal(beoordeelKaart(s, K('sH'), K('k8')).oordeel, 'gelijkwaardig');
});
