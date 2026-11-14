import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roemInSlag } from '../src/regels/roem.js';
import { Ks } from './hulp.js';

const T = 'harten';
const roem = (c, troef = T) => roemInSlag(Ks(c), troef).totaal;
const soorten = (c, troef = T) => roemInSlag(Ks(c), troef).items.map((i) => i.soort).sort();

test('geen roem in een gewone slag', () => {
  assert.equal(roem('k7 rA s10 kH'), 0);
});

test('driekaart is 20: 7-8-9, 9-10-B, 10-B-V, V-H-A', () => {
  assert.equal(roem('k7 k8 k9 rA'), 20);
  assert.equal(roem('s9 s10 sB r7'), 20);
  assert.equal(roem('k10 kB kV r7'), 20);
  assert.equal(roem('rV rH rA s7'), 20);
});

test('reeks volgt de natuurlijke volgorde, ook in troef (B-V-H, niet 9-B)', () => {
  assert.equal(roem('h9 hB hA k7'), 0);
  assert.equal(roem('hB hV h10 k7'), 20); // 10-B-V
});

test('volgorde van spelen maakt niet uit', () => {
  assert.equal(roem('k9 r7 k7 k8'), 20);
});

test('reeks moet in één kleur zijn', () => {
  assert.equal(roem('h7 k8 h9 r10'), 0);
});

test('gat in de reeks telt niet', () => {
  assert.equal(roem('k7 k8 k10 kB'), 0);
});

test('vierkaart is 50', () => {
  assert.equal(roem('k10 kB kV kH'), 50);
  assert.equal(roem('r7 r8 r9 r10'), 50);
  assert.deepEqual(soorten('r9 r10 rB rV'), ['vierkaart']);
});

test('stuk (heer + vrouw van troef) is 20', () => {
  assert.equal(roem('hH hV k7 rA'), 20);
});

test('heer + vrouw van een niet-troefkleur is geen stuk', () => {
  assert.equal(roem('kH kV h7 rA'), 0);
});

test('driekaart met stuk is 40', () => {
  assert.equal(roem('hV hH hA k7'), 40);
  assert.equal(roem('hB hV hH k7'), 40);
  assert.deepEqual(soorten('hB hV hH k7'), ['driekaart', 'stuk']);
});

test('vierkaart in troef met heer en vrouw is 50 + 20 = 70', () => {
  assert.equal(roem('h10 hB hV hH'), 70);
  assert.equal(roem('hV hH hA hB'), 70);
  assert.deepEqual(soorten('h10 hB hV hH'), ['stuk', 'vierkaart']);
});

test('dezelfde vierkaart in niet-troef is 50', () => {
  assert.equal(roem('h10 hB hV hH', 'klaveren'), 50);
});

test('vier boeren is 200', () => {
  assert.equal(roem('kB rB hB sB'), 200);
});

test('vier azen, tienen, heren of vrouwen is 100', () => {
  assert.equal(roem('kA rA hA sA'), 100);
  assert.equal(roem('k10 r10 h10 s10'), 100);
  assert.equal(roem('kH rH hH sH'), 100);
  assert.equal(roem('kV rV hV sV'), 100);
});

test('vier zevens, achten of negens leveren geen roem op', () => {
  assert.equal(roem('k7 r7 h7 s7'), 0);
  assert.equal(roem('k8 r8 h8 s8'), 0);
  assert.equal(roem('k9 r9 h9 s9'), 0);
});
