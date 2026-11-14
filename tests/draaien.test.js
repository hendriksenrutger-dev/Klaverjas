import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nieuwDraaien, beslis, gedraaideKaarten } from '../src/regels/draaien.js';
import { Ks } from './hulp.js';

// Een stapel om te draaien; alleen de eerste kaarten doen ertoe.
const stapel = Ks('k7 kA r8 k9 h10 sB r7 sA');

function pasRonde(d) {
  for (let i = 0; i < 4; i++) d = beslis(d, d.beurt, 'passen');
  return d;
}

test('de bovenste kaart is de voorgestelde troef, links van de deler begint', () => {
  const d = nieuwDraaien({ stapel, deler: 3 });
  assert.equal(d.kaart.kleur, 'klaveren');
  assert.equal(d.beurt, 0);
});

test('wie speelt maakt die kleur troef, zijn team speelt', () => {
  let d = nieuwDraaien({ stapel, deler: 0 });
  d = beslis(d, 1, 'passen');
  d = beslis(d, 2, 'passen');
  d = beslis(d, 3, 'spelen');
  assert.deepEqual(d.uitkomst, { soort: 'spelen', troef: 'klaveren', speler: 3, team: 1 });
});

test('de eerste speler kan direct spelen', () => {
  const d = beslis(nieuwDraaien({ stapel, deler: 1 }), 2, 'spelen');
  assert.equal(d.uitkomst.team, 0);
});

test('beurt gaat de tafel rond', () => {
  let d = nieuwDraaien({ stapel, deler: 2 });
  const volgorde = [];
  for (let i = 0; i < 3; i++) {
    volgorde.push(d.beurt);
    d = beslis(d, d.beurt, 'passen');
  }
  volgorde.push(d.beurt);
  assert.deepEqual(volgorde, [3, 0, 1, 2]);
});

test('alleen wie aan de beurt is mag kiezen', () => {
  const d = nieuwDraaien({ stapel, deler: 0 });
  assert.throws(() => beslis(d, 2, 'spelen'), /niet aan de beurt/);
  assert.throws(() => beslis(d, 1, 'misschien'));
});

test('iedereen past: volgende kaart, een kleur waarop gepast is wordt overgeslagen', () => {
  let d = pasRonde(nieuwDraaien({ stapel, deler: 0 }));
  // kA wordt overgeslagen (klaveren al gepast), r8 komt boven.
  assert.equal(d.kaart.kleur, 'ruiten');
  assert.equal(d.kaart.rang, '8');
  assert.equal(d.rondes, 1);
  assert.equal(d.beurt, 1, 'weer links van de deler beginnen');
  assert.deepEqual(gedraaideKaarten(d).length, 3);
  d = beslis(d, 1, 'spelen');
  assert.equal(d.uitkomst.troef, 'ruiten');
});

test('na 2 rondes passen: opnieuw delen (standaard)', () => {
  let d = nieuwDraaien({ stapel, deler: 0 });
  d = pasRonde(pasRonde(d));
  assert.deepEqual(d.uitkomst, { soort: 'opnieuwDelen' });
  assert.throws(() => beslis(d, d.beurt, 'spelen'), /al afgelopen/);
});

test('instelling 3 rondes: derde kleur wordt nog gedraaid', () => {
  let d = nieuwDraaien({ stapel, deler: 0, maxRondes: 3 });
  d = pasRonde(pasRonde(d));
  assert.equal(d.uitkomst, null);
  // klaveren en ruiten gepast: k9 overgeslagen, h10 komt boven.
  assert.equal(d.kaart.kleur, 'harten');
  d = pasRonde(d);
  assert.deepEqual(d.uitkomst, { soort: 'opnieuwDelen' });
});

test('maxRondes moet 2 of 3 zijn', () => {
  assert.throws(() => nieuwDraaien({ stapel, deler: 0, maxRondes: 4 }));
});

describe('troefkeuze verplicht', async () => {
  const { nieuwVerplicht, kiesTroef } = await import('../src/regels/draaien.js');
  const { nieuwePartij, deelRonde, startPotje } = await import('../src/regels/partij.js');

  test('de voorhand (links van de deler) kiest zelf troef en speelt', () => {
    const d = nieuwVerplicht({ deler: 2 });
    assert.equal(d.beurt, 3);
    const k = kiesTroef(d, 3, 'harten');
    assert.deepEqual(k.uitkomst, { soort: 'spelen', troef: 'harten', speler: 3, team: 1 });
  });

  test('alleen de voorhand mag kiezen, en maar één keer', () => {
    const d = nieuwVerplicht({ deler: 0 });
    assert.throws(() => kiesTroef(d, 2, 'harten'));
    assert.throws(() => kiesTroef(kiesTroef(d, 1, 'ruiten'), 1, 'harten'));
    assert.throws(() => kiesTroef(d, 1, 'sterren'));
  });

  test('een partij met verplicht spelen deelt zonder draaistapel en start het potje', () => {
    const partij = nieuwePartij({ instellingen: { troefkeuze: 'verplicht' }, eersteDeler: 1 });
    const { handen, draaien } = deelRonde(partij, () => 0.3);
    assert.equal(draaien.verplicht, true);
    assert.equal(draaien.beurt, 2);
    const potje = startPotje(partij, handen, kiesTroef(draaien, 2, 'klaveren').uitkomst);
    assert.equal(potje.troef, 'klaveren');
    assert.equal(potje.spelendTeam, 0);
    assert.equal(potje.beurt, 2); // de voorhand komt ook uit
  });

  test('standaard blijft traditioneel draaien', () => {
    const { draaien } = deelRonde(nieuwePartij(), () => 0.3);
    assert.ok(!draaien.verplicht);
    assert.ok(draaien.kaart);
  });
});
