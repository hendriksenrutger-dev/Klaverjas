import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { legeStatistiek, compleet, telPotje, telPartij, telVergelijk, procent } from '../src/ui/statistiek.js';

const u = (o) => ({ punten: [0, 0], roem: [0, 0], totaal: [0, 0], nat: false, pit: null, verzaakt: null, ...o });

describe('statistieken', () => {
  test('wij spelen en halen het, met roem', () => {
    const s = telPotje(legeStatistiek('2026-11-14'), u({ punten: [100, 62], roem: [20, 0], totaal: [120, 62] }), 0);
    assert.equal(s.potjes.gespeeld, 1);
    assert.equal(s.potjes.wijSpeelden, 1);
    assert.equal(s.potjes.wijGehaald, 1);
    assert.equal(s.potjes.puntenWij, 120);
    assert.equal(s.potjes.roemWij, 20);
  });

  test('wij nat, wij pit, zij nat en zij pit', () => {
    let s = legeStatistiek();
    s = telPotje(s, u({ nat: true, totaal: [0, 162] }), 0);
    s = telPotje(s, u({ pit: 0, roem: [100, 0], totaal: [262, 0] }), 0);
    s = telPotje(s, u({ nat: true, totaal: [162, 0] }), 1);
    s = telPotje(s, u({ pit: 1, totaal: [0, 262] }), 1);
    assert.deepEqual([s.potjes.wijNat, s.potjes.wijGehaald, s.potjes.wijPit], [1, 1, 1]);
    assert.deepEqual([s.potjes.zijSpeelden, s.potjes.zijNat, s.potjes.zijPit], [2, 1, 1]);
  });

  test('verzaken door de spelende partij telt als nat', () => {
    const s = telPotje(legeStatistiek(), u({ verzaakt: { team: 0 }, totaal: [0, 262] }), 0);
    assert.equal(s.potjes.wijNat, 1);
    assert.equal(s.potjes.verzaakt, 1);
  });

  test('partijen: winst, reeks, record, hoogste en laagste', () => {
    let s = legeStatistiek();
    s = telPartij(s, [1500, 1200]);
    s = telPartij(s, [1700, 1100]);
    s = telPartij(s, [1000, 1400]);
    s = telPartij(s, [1300, 1250]);
    const p = s.partijen;
    assert.deepEqual([p.gespeeld, p.gewonnen, p.verloren, p.gelijk], [4, 3, 1, 0]);
    assert.equal(p.reeks, 1);
    assert.equal(p.recordReeks, 2);
    assert.equal(p.hoogste, 1700);
    assert.equal(p.laagste, 1000);
    assert.equal(p.grootsteWinst, 600);
    assert.equal(procent(p.gewonnen, p.gespeeld), 75);
  });

  test('vergelijk en aanvullen van oude opslag', () => {
    let s = compleet({ partijen: { gespeeld: 2 } });
    assert.equal(s.partijen.gespeeld, 2);
    assert.equal(s.potjes.gespeeld, 0);
    s = telVergelijk(s, 'zelfde');
    s = telVergelijk(s, 'minder');
    assert.deepEqual(s.vergelijk, { kaarten: 2, zelfde: 1, gelijkwaardig: 0 });
  });
});
