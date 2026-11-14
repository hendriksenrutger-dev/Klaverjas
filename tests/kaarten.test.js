import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maakDeck, schud, deel, kaartId, team, kaart } from '../src/regels/kaarten.js';
import { maakRng } from '../src/regels/rng.js';

test('deck heeft 32 unieke kaarten, 7 t/m aas in 4 kleuren', () => {
  const deck = maakDeck();
  assert.equal(deck.length, 32);
  assert.equal(new Set(deck.map(kaartId)).size, 32);
  assert.equal(deck.filter((k) => k.kleur === 'harten').length, 8);
});

test('kaart() weigert onbekende kleur of rang', () => {
  assert.throws(() => kaart('harten', '6'));
  assert.throws(() => kaart('sterren', 'A'));
});

test('schudden houdt dezelfde kaarten en is herhaalbaar met zaadje', () => {
  const a = schud(maakDeck(), maakRng(42));
  const b = schud(maakDeck(), maakRng(42));
  assert.deepEqual(a, b);
  assert.deepEqual(new Set(a.map(kaartId)), new Set(maakDeck().map(kaartId)));
  assert.notDeepEqual(a, maakDeck());
});

test('delen geeft 4 handen van 8, links van de deler eerst (3-2-3)', () => {
  const deck = maakDeck();
  const handen = deel(deck, 3);
  assert.deepEqual(handen.map((h) => h.length), [8, 8, 8, 8]);
  // Deler 3: speler 0 krijgt eerst de bovenste 3 kaarten.
  assert.deepEqual(handen[0].slice(0, 3), deck.slice(0, 3));
  assert.deepEqual(handen[1].slice(0, 3), deck.slice(3, 6));
  const alles = handen.flat().map(kaartId);
  assert.equal(new Set(alles).size, 32);
});

test('teams: 0 en 2 tegen 1 en 3', () => {
  assert.deepEqual([0, 1, 2, 3].map(team), [0, 1, 0, 1]);
});
