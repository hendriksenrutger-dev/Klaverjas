import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LESSEN, beoordeel, kaarten, lesKlaar, alleLessenKlaar } from '../src/ui/lessen.js';
import { geldigeKaarten } from '../src/regels/geldig.js';
import { kaartId } from '../src/regels/kaarten.js';

describe('lessen', () => {
  test('zeven lessen, elk met uitleg en opdrachten', () => {
    assert.equal(LESSEN.length, 7);
    for (const les of LESSEN) {
      assert.ok(les.uitleg.length && les.opdrachten.length, `les ${les.nr}`);
    }
  });

  test('elk goed antwoord klopt met de spelregels', () => {
    for (const les of LESSEN) {
      for (const o of les.opdrachten) {
        if (o.soort === 'keuze') {
          assert.ok(o.goed >= 0 && o.goed < o.opties.length, `les ${les.nr}`);
          assert.equal(beoordeel(o, o.goed).goed, true);
          continue;
        }
        const geldig = geldigeKaarten(o.hand, o.slag, o.troef, o.systeem ?? 'amsterdams').map(kaartId);
        const goed = o.goed === 'alles' ? geldig : o.goed;
        for (const id of goed) assert.ok(geldig.includes(id), `les ${les.nr}: ${id} mag niet`);
        for (const k of o.hand) {
          const r = beoordeel(o, k);
          assert.equal(r.goed, goed.includes(kaartId(k)), `les ${les.nr}: ${kaartId(k)}`);
          assert.ok(r.tekst.length > 5);
        }
      }
    }
  });

  test('foute antwoorden krijgen de juiste uitleg', () => {
    const [l2a] = LESSEN[1].opdrachten;
    assert.equal(beoordeel(l2a, kaarten('h10')[0]).tekst, 'Je moet klaveren bekennen.');
    assert.equal(beoordeel(l2a, kaarten('k7')[0]).tekst, 'Die mag, maar daarmee win je de slag niet.');
    const l7 = LESSEN[6].opdrachten[0];
    assert.match(beoordeel(l7, kaarten('kA')[0]).tekst, /^Rotterdams: je kunt niet bekennen/);
    const l3b = LESSEN[2].opdrachten[1];
    assert.match(beoordeel(l3b, kaarten('h7')[0]).tekst, /hoefde niet/);
  });

  test('voortgang van de lessen', () => {
    let v = { open: 1, potjes: {}, lessen: [] };
    for (const les of LESSEN) v = lesKlaar(v, les.nr);
    v = lesKlaar(v, 3);
    assert.equal(v.lessen.length, 7);
    assert.ok(alleLessenKlaar(v));
  });
});
