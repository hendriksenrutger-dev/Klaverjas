import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punten, huidigeWinnaar, slagPunten } from '../src/regels/rangorde.js';
import { maakDeck } from '../src/regels/kaarten.js';
import { K, Ks, slag } from './hulp.js';

test('puntwaarden troef: B20 9:14 A11 10:10 H4 V3 8:0 7:0', () => {
  const w = Ks('hB h9 hA h10 hH hV h8 h7').map((k) => punten(k, 'harten'));
  assert.deepEqual(w, [20, 14, 11, 10, 4, 3, 0, 0]);
});

test('puntwaarden niet-troef: A11 10:10 H4 V3 B2 9:0 8:0 7:0', () => {
  const w = Ks('kA k10 kH kV kB k9 k8 k7').map((k) => punten(k, 'harten'));
  assert.deepEqual(w, [11, 10, 4, 3, 2, 0, 0, 0]);
});

test('alle kaarten samen zijn 152 punten', () => {
  for (const troef of ['klaveren', 'ruiten', 'harten', 'schoppen']) {
    assert.equal(slagPunten(maakDeck(), troef), 152);
  }
});

test('rangorde troef: B > 9 > A > 10 > H > V > 8 > 7', () => {
  const orde = Ks('h7 h8 hV hH h10 hA h9 hB');
  for (let i = 0; i < orde.length - 1; i++) {
    const s = [{ speler: 0, kaart: orde[i] }, { speler: 1, kaart: orde[i + 1] }];
    assert.equal(huidigeWinnaar(s, 'harten').speler, 1);
  }
});

test('rangorde niet-troef: A > 10 > H > V > B > 9 > 8 > 7', () => {
  const orde = Ks('k7 k8 k9 kB kV kH k10 kA');
  for (let i = 0; i < orde.length - 1; i++) {
    const s = [{ speler: 0, kaart: orde[i] }, { speler: 1, kaart: orde[i + 1] }];
    assert.equal(huidigeWinnaar(s, 'harten').speler, 1);
  }
});

test('hoogste kaart van de gevraagde kleur wint als er geen troef ligt', () => {
  assert.equal(huidigeWinnaar(slag(0, 'k10 kA rA k9'), 'harten').speler, 1);
});

test('andere kleur wint nooit, ook een aas niet', () => {
  assert.equal(huidigeWinnaar(slag(2, 'k7 rA sA hA'), 'harten').speler, 1); // harten troef: speler 1 (hA)
  assert.equal(huidigeWinnaar(slag(2, 'kB rA sA k7'), 'harten').speler, 2);
});

test('laagste troef slaat hoogste niet-troef', () => {
  assert.equal(huidigeWinnaar(slag(0, 'kA k10 h7 kH'), 'harten').speler, 2);
});

test('hoogste troef wint bij meerdere troeven', () => {
  assert.equal(huidigeWinnaar(slag(1, 'kA h7 h9 hA'), 'harten').speler, 3);
  assert.equal(huidigeWinnaar(slag(1, 'kA hB h9 hA'), 'harten').speler, 2);
});

test('troef gevraagd: troefboer wint', () => {
  assert.equal(huidigeWinnaar(slag(3, 'h9 hB hA h10'), 'harten').speler, 0);
});

test('punten van een slag', () => {
  assert.equal(slagPunten(Ks('hB h9 kA k10'), 'harten'), 55);
  assert.equal(punten(K('sB'), 'schoppen'), 20);
});
