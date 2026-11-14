import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { legeStatistiek, compleet, telPotje, telPartij, telVergelijk, procent } from '../src/ui/statistiek.js';

const u = (o) => ({ punten: [0, 0], roem: [0, 0], totaal: [0, 0], nat: false, pit: null, verzaakt: null, ...o });
const A = 'amsterdams';
const R = 'rotterdams';

describe('statistieken', () => {
  test('wij spelen en halen het, met roem', () => {
    const s = telPotje(legeStatistiek('2026-11-14'), u({ punten: [100, 62], roem: [20, 0], totaal: [120, 62] }), 0, A);
    const p = s.systemen.amsterdams.potjes;
    assert.deepEqual([p.gespeeld, p.wijSpeelden, p.wijGehaald, p.puntenWij, p.roemWij], [1, 1, 1, 120, 20]);
    assert.equal(s.systemen.rotterdams.potjes.gespeeld, 0);
  });

  test('gehaald, nat en pit voor wij en voor zij', () => {
    let s = legeStatistiek();
    s = telPotje(s, u({ nat: true, totaal: [0, 162] }), 0, A);
    s = telPotje(s, u({ pit: 0, roem: [100, 0], totaal: [262, 0] }), 0, A);
    s = telPotje(s, u({ nat: true, totaal: [162, 0] }), 1, A);
    s = telPotje(s, u({ pit: 1, roem: [0, 100], totaal: [0, 262] }), 1, A);
    s = telPotje(s, u({ totaal: [60, 102] }), 1, A);
    const p = s.systemen.amsterdams.potjes;
    assert.deepEqual([p.wijSpeelden, p.wijGehaald, p.wijNat, p.wijPit], [2, 1, 1, 1]);
    assert.deepEqual([p.zijSpeelden, p.zijGehaald, p.zijNat, p.zijPit], [3, 2, 1, 1]);
  });

  test('verzaken door de spelende partij telt als nat', () => {
    const s = telPotje(legeStatistiek(), u({ verzaakt: { team: 0 }, totaal: [0, 262] }), 0, R);
    assert.equal(s.systemen.rotterdams.potjes.wijNat, 1);
    assert.equal(s.systemen.rotterdams.potjes.verzaakt, 1);
  });

  test('partijen: winst, reeks, record, hoogste en laagste, apart per systeem', () => {
    let s = legeStatistiek();
    s = telPartij(s, [1500, 1200], A);
    s = telPartij(s, [1700, 1100], A);
    s = telPartij(s, [1000, 1400], A);
    s = telPartij(s, [1300, 1250], A);
    s = telPartij(s, [900, 2000], R);
    const p = s.systemen.amsterdams.partijen;
    assert.deepEqual([p.gespeeld, p.gewonnen, p.verloren, p.gelijk], [4, 3, 1, 0]);
    assert.deepEqual([p.reeks, p.recordReeks, p.hoogste, p.laagste, p.grootsteWinst], [1, 2, 1700, 1000, 600]);
    assert.equal(procent(p.gewonnen, p.gespeeld), 75);
    assert.deepEqual([s.systemen.rotterdams.partijen.gespeeld, s.systemen.rotterdams.partijen.verloren], [1, 1]);
  });

  test('oude opslag zonder splitsing gaat naar Rotterdams, zij gehaald wordt afgeleid', () => {
    const s = compleet({ sinds: '2026-11-14', partijen: { gespeeld: 1 }, potjes: { gespeeld: 16, zijSpeelden: 8, zijNat: 2 } });
    assert.equal(s.sinds, '2026-11-14');
    assert.equal(s.systemen.rotterdams.partijen.gespeeld, 1);
    assert.equal(s.systemen.rotterdams.potjes.zijGehaald, 6);
    assert.equal(s.systemen.amsterdams.potjes.gespeeld, 0);
  });

  test('vergelijk per systeem', () => {
    let s = telVergelijk(legeStatistiek(), 'zelfde', A);
    s = telVergelijk(s, 'minder', A);
    assert.deepEqual(s.systemen.amsterdams.vergelijk, { kaarten: 2, zelfde: 1, gelijkwaardig: 0 });
  });
});
