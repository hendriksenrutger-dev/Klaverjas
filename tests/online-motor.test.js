import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/online/motor.js';
import { maakRng } from '../src/regels/rng.js';
import { geldigVoor } from '../src/regels/potje.js';

describe('online spelverloop', () => {
  test('een hele partij van 16 potjes speelt uit; zicht toont alleen de eigen hand', () => {
    const rng = maakRng(7);
    let s = M.start({ systeem: 'amsterdams' }, rng);
    let potjes = 0;
    for (let i = 0; i < 5000 && s.fase !== 'partijKlaar'; i++) {
      const z = M.aanZet(s);
      if (!z) { s = M.doe(s, 0, { soort: 'volgende' }, rng); potjes++; continue; }
      if (z.soort === 'draai') s = M.doe(s, z.plek, { soort: 'draai', keuze: rng() < 0.4 ? 'spelen' : 'passen' }, rng);
      else s = M.doe(s, z.plek, { soort: 'kaart', kaart: geldigVoor(s.potje, z.plek)[0] }, rng);
      if (s.fase === 'spelen') {
        const v = M.zicht(s, 1);
        assert.equal(v.hand.length, v.aantallen[1]);
        assert.equal(JSON.stringify(v).includes('"handen"'), true); // veld bestaat ...
        assert.equal(v.handen, null); // ... maar is leeg tijdens het spelen
      }
    }
    assert.equal(s.fase, 'partijKlaar');
    assert.equal(s.partij.potjes.length, 16);
  });

  test('zetten buiten de beurt of ongeldige kaarten worden geweigerd', () => {
    const rng = maakRng(3);
    let s = M.start({ troefkeuze: 'verplicht' }, rng);
    const z = M.aanZet(s);
    assert.equal(z.soort, 'troef');
    assert.throws(() => M.doe(s, (z.plek + 1) % 4, { soort: 'troef', kleur: 'harten' }));
    s = M.doe(s, z.plek, { soort: 'troef', kleur: 'harten' });
    assert.equal(s.fase, 'spelen');
    const b = s.potje.beurt;
    assert.throws(() => M.doe(s, (b + 1) % 4, { soort: 'kaart', kaart: s.potje.handen[(b + 1) % 4][0] }));
    const vraag = M.computerVraag(s, b);
    assert.equal(vraag.soort, 'kaart');
    assert.equal(vraag.waarneming.hand.length, 8);
    assert.equal(M.computerVraag(s, (b + 1) % 4), null);
  });
});

describe('online tafel: jij zit altijd onderaan', async () => {
  const { tafelVoor } = await import('../src/online/tafel.js');
  test('omdraaien vanuit Oost: beurt, slag, teams en scores kloppen', () => {
    const rng = maakRng(11);
    let s = M.start({ troefkeuze: 'verplicht' }, rng);
    s = M.doe(s, M.aanZet(s).plek, { soort: 'troef', kleur: 'harten' });
    const b = s.potje.beurt;
    s = M.doe(s, b, { soort: 'kaart', kaart: geldigVoor(s.potje, b)[0] });
    const ik = 3; // Oost
    const tafel = tafelVoor({ zicht: M.zicht(s, ik), namen: ['A', null, 'C', 'D'], ik, maker: false });
    assert.equal(tafel.potje.handen[0].length, s.potje.handen[3].length);
    assert.deepEqual(tafel.potje.handen[0], s.potje.handen[3]);
    assert.equal(tafel.potje.beurt, (s.potje.beurt - ik + 4) % 4);
    assert.equal(tafel.potje.slag[0].speler, (b - ik + 4) % 4);
    // Oost speelt in team 1: dat wordt voor hem "wij" (team 0).
    assert.equal(tafel.potje.spelendTeam, 1 - s.potje.spelendTeam);
    assert.equal(tafel.namen[0], 'D');
    assert.equal(tafel.namen[1], 'A'); // links van Oost zit Zuid
    assert.equal(tafel.rollen[2], 'Jouw maat · computer'); // West (de maat van Oost) is een computer
    assert.equal(tafel.namen[3], 'C'); // rechts van Oost zit Noord
    assert.ok(tafel.potje.handen[1].every((k) => k.verborgen));
  });
});
