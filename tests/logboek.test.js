import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { potjeRecord, legLogboek, voegToe, exportTekst, code, MAX_POTJES } from '../src/ui/logboek.js';
import { nieuwPotje, speelKaart, geldigVoor, uitslag } from '../src/regels/potje.js';
import { maakDeck, schud, deel } from '../src/regels/kaarten.js';
import { maakRng } from '../src/regels/rng.js';

function gespeeldPotje(zaad) {
  const rng = maakRng(zaad);
  const handen = deel(schud(maakDeck(), rng), 0);
  let p = nieuwPotje({ handen, troef: 'harten', spelendTeam: 0, uitkomer: 1, kiezer: 2 });
  while (!p.klaar) p = speelKaart(p, p.beurt, geldigVoor(p, p.beurt)[0]);
  return { handen, p };
}

describe('logboek', () => {
  test('een potje wordt compleet en compact vastgelegd', () => {
    const { handen, p } = gespeeldPotje(5);
    const r = potjeRecord({ partijId: 'x', nr: 3, stand: [120, 300], deler: 0, handen, draaiLog: [{ speler: 1, kleur: 'harten', keuze: 'passen' }, { speler: 2, kleur: 'harten', keuze: 'spelen' }], potje: p, uitslag: uitslag(p), niveau: 'sterk', troefkeuze: 'traditioneel', tijd: 't' });
    assert.equal(r.handen.length, 4);
    assert.equal(r.handen[0].length, 8);
    assert.equal(r.slagen.length, 8);
    assert.equal(r.slagen.flat().length, 32);
    assert.deepEqual(r.draaien, [[1, 'h', 'passen'], [2, 'h', 'spelen']]);
    assert.equal(r.troef, 'harten');
    assert.deepEqual(r.stand, [120, 300]);
    assert.equal(code({ kleur: 'ruiten', rang: '10' }), 'r10');
    // Uit het record is elke kaart van Zuid terug te vinden.
    const zuid = r.slagen.flat().filter(([s]) => s === 0).map(([, c]) => c).sort();
    assert.deepEqual(zuid, r.handen[0].slice().sort());
  });

  test('het logboek houdt de nieuwste potjes en is te exporteren', () => {
    let l = legLogboek();
    for (let i = 0; i < MAX_POTJES + 5; i++) l = voegToe(l, { nr: i });
    assert.equal(l.potjes.length, MAX_POTJES);
    assert.equal(l.potjes[0].nr, 5);
    const tekst = exportTekst(voegToe(legLogboek(), { nr: 1 }));
    assert.equal(JSON.parse(tekst).potjes.length, 1);
  });
});
