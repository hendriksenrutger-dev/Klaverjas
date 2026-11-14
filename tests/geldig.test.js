import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { geldigeKaarten, isGeldig, AMSTERDAMS, ROTTERDAMS } from '../src/regels/geldig.js';
import { K, Ks, codes, slag } from './hulp.js';

// Troef is in alle tests harten.
const T = 'harten';
const beide = [AMSTERDAMS, ROTTERDAMS];

function geldig(hand, opTafel, systeem) {
  return codes(geldigeKaarten(Ks(hand), opTafel, T, systeem));
}
function verwacht(lijst) {
  return lijst.split(' ').sort();
}

describe('voor beide systemen', () => {
  for (const sys of beide) {
    test(`${sys}: wie uitkomt mag alles`, () => {
      assert.deepEqual(geldig('k7 hB r8 sA', [], sys), verwacht('k7 hB r8 sA'));
    });

    test(`${sys}: bekennen is verplicht`, () => {
      assert.deepEqual(geldig('k7 kA h9 r8', slag(3, 'k10'), sys), verwacht('k7 kA'));
    });

    test(`${sys}: bekennen ook als de slag al is ingetroefd (geen troefplicht)`, () => {
      assert.deepEqual(geldig('k7 hB r8', slag(2, 'kA h7'), sys), verwacht('k7'));
    });

    test(`${sys}: troef gevraagd, overtroeven verplicht`, () => {
      // h9 is hoger dan hA, hV en hH zijn lager.
      assert.deepEqual(geldig('h9 hV hH k7', slag(2, 'h10 hA'), sys), verwacht('h9'));
    });

    test(`${sys}: troef gevraagd, kan niet over: lagere troef bekennen`, () => {
      assert.deepEqual(geldig('h7 h8 kA', slag(3, 'h9'), sys), verwacht('h7 h8'));
    });

    test(`${sys}: troef gevraagd, geen troef: alles mag`, () => {
      assert.deepEqual(geldig('k7 r8 sA', slag(3, 'h9'), sys), verwacht('k7 r8 sA'));
    });

    test(`${sys}: troef gevraagd en maat heeft de slag: toch overtroeven`, () => {
      // Speler 2 (maat van 0) kwam uit met hA, speler 3 bekende laag, speler 0 is aan de beurt.
      assert.deepEqual(geldig('h9 hV kA', slag(2, 'hA h7'), sys), verwacht('h9'));
    });

    test(`${sys}: niet bekennen, tegenstander heeft de slag zonder troef: troeven verplicht`, () => {
      // Speler 1 kwam uit, speler 2 is aan de beurt.
      assert.deepEqual(geldig('h7 hB r8', slag(1, 'kA'), sys), verwacht('h7 hB'));
    });

    test(`${sys}: niet bekennen en geen troef: alles mag`, () => {
      assert.deepEqual(geldig('r8 s9 sA', slag(1, 'kA'), sys), verwacht('r8 s9 sA'));
    });

    test(`${sys}: tegenstander heeft ingetroefd, overtroeven verplicht`, () => {
      // Speler 1 kA, speler 2 hV (wint), speler 3 is aan de beurt.
      assert.deepEqual(geldig('h7 hH r8', slag(1, 'kA hV'), sys), verwacht('hH'));
    });

    test(`${sys}: tegenstander heeft ingetroefd, kan niet over: niet ondertroeven`, () => {
      assert.deepEqual(geldig('h7 r8 s9', slag(1, 'kA hB'), sys), verwacht('r8 s9'));
    });

    test(`${sys}: tegenstander heeft ingetroefd, alleen lagere troeven: ondertroeven moet`, () => {
      assert.deepEqual(geldig('h7 h8', slag(1, 'kA hB'), sys), verwacht('h7 h8'));
    });

    test(`${sys}: maat werd overgetroefd: dan overtroeven verplicht`, () => {
      // Speler 1 (maat van 3) kA, speler 2 troeft met h7. Speler 3 aan de beurt.
      assert.deepEqual(geldig('h8 hV r9', slag(1, 'kA h7'), sys), verwacht('h8 hV'));
    });

    test(`${sys}: maat heeft ingetroefd, alleen lagere troeven: ondertroeven moet`, () => {
      assert.deepEqual(geldig('h7 h8', slag(0, 'kA hV k7'), sys), verwacht('h7 h8'));
    });

    test(`${sys}: maat heeft ingetroefd, lagere troef en andere kaart: niet ondertroeven`, () => {
      assert.deepEqual(geldig('h7 r8', slag(0, 'kA hV k7'), sys), verwacht('r8'));
    });
  }
});

describe('Amsterdams: maat heeft de slag', () => {
  const sys = AMSTERDAMS;

  test('maat heeft de slag zonder troef: niet hoeven troeven, alles mag', () => {
    // Speler 2 kA, speler 3 s7, speler 0 aan de beurt, maat 2 heeft de slag.
    assert.deepEqual(geldig('h7 r8', slag(2, 'kA s7'), sys), verwacht('h7 r8'));
  });

  test('maat heeft de slag zonder troef, alleen troef: troef spelen', () => {
    assert.deepEqual(geldig('h7 hB', slag(2, 'kA s7'), sys), verwacht('h7 hB'));
  });

  test('maat heeft ingetroefd: overtroeven mag, ondertroeven niet', () => {
    // Speler 0 kA, speler 1 hV (maat van 3), speler 2 k7, speler 3 aan de beurt.
    assert.deepEqual(geldig('h7 hH r8', slag(0, 'kA hV k7'), sys), verwacht('hH r8'));
  });

  test('maat heeft ingetroefd, hogere troef en andere kaart: andere kaart mag', () => {
    assert.deepEqual(geldig('hB r8 s9', slag(0, 'kA hV k7'), sys), verwacht('hB r8 s9'));
  });

  test('maat heeft de slag als tweede speler na uitkomst maat', () => {
    // Speler 3 kwam uit, speler 0 troefde in (wint), speler 1 bekende, speler 2 aan de beurt.
    assert.deepEqual(geldig('h7 r8', slag(3, 'kA h8 k7'), sys), verwacht('r8'));
  });
});

describe('Rotterdams: altijd troeven en overtroeven', () => {
  const sys = ROTTERDAMS;

  test('maat heeft de slag zonder troef: toch troeven', () => {
    assert.deepEqual(geldig('h7 r8', slag(2, 'kA s7'), sys), verwacht('h7'));
  });

  test('maat heeft ingetroefd: overtroeven verplicht', () => {
    assert.deepEqual(geldig('h7 hH r8', slag(0, 'kA hV k7'), sys), verwacht('hH'));
  });

  test('maat heeft ingetroefd, kan niet over: niet ondertroeven, andere kleur', () => {
    assert.deepEqual(geldig('h7 r8 s9', slag(0, 'kA hV k7'), sys), verwacht('r8 s9'));
  });

  test('maat heeft de slag, geen troef in hand: alles mag', () => {
    assert.deepEqual(geldig('r8 s9', slag(2, 'kA s7'), sys), verwacht('r8 s9'));
  });
});

test('isGeldig controleert één kaart', () => {
  assert.equal(isGeldig(K('h7'), Ks('h7 r8'), slag(2, 'kA s7'), T, ROTTERDAMS), true);
  assert.equal(isGeldig(K('r8'), Ks('h7 r8'), slag(2, 'kA s7'), T, ROTTERDAMS), false);
  assert.equal(isGeldig(K('r8'), Ks('h7 r8'), slag(2, 'kA s7'), T, AMSTERDAMS), true);
});

test('onbekend systeem geeft een fout', () => {
  assert.throws(() => geldigeKaarten(Ks('h7'), [], T, 'utrechts'));
});
