import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nieuwePartij, deelRonde, startPotje, rondPotjeAf, naOpnieuwDelen, partijKlaar, potjeNummer,
  AANTAL_POTJES, STANDAARD_INSTELLINGEN,
} from '../src/regels/partij.js';
import { beslis } from '../src/regels/draaien.js';
import { speelKaart, geldigVoor } from '../src/regels/potje.js';
import { maakRng } from '../src/regels/rng.js';
import { kaartId } from '../src/regels/kaarten.js';

test('standaardinstellingen', () => {
  assert.equal(STANDAARD_INSTELLINGEN.systeem, 'amsterdams');
  assert.equal(STANDAARD_INSTELLINGEN.rondesVoorOpnieuwDelen, 2);
  assert.equal(STANDAARD_INSTELLINGEN.verzaakbescherming, true);
  const p = nieuwePartij({ instellingen: { systeem: 'rotterdams' } });
  assert.equal(p.instellingen.systeem, 'rotterdams');
  assert.equal(p.instellingen.rondesVoorOpnieuwDelen, 2);
});

test('een partij is 16 potjes', () => {
  assert.equal(AANTAL_POTJES, 16);
});

test('delen: 4 handen van 8 en een aparte volle stapel om te draaien', () => {
  const { handen, draaien } = deelRonde(nieuwePartij(), maakRng(1));
  assert.equal(new Set(handen.flat().map(kaartId)).size, 32);
  assert.equal(new Set(draaien.stapel.map(kaartId)).size, 32);
});

test('uitkomen: speler links van de deler, los van wie speelt', () => {
  const partij = nieuwePartij({ eersteDeler: 2 });
  const { handen } = deelRonde(partij, maakRng(2));
  for (const speler of [0, 1, 2, 3]) {
    const potje = startPotje(partij, handen, { soort: 'spelen', troef: 'harten', speler, team: speler % 2 });
    assert.equal(potje.beurt, 3);
    assert.equal(potje.spelendTeam, speler % 2);
  }
});

test('opnieuw delen: dezelfde of de volgende deler (afgesproken: dezelfde)', () => {
  assert.equal(naOpnieuwDelen(nieuwePartij({ eersteDeler: 1 })).deler, 1);
  const p = nieuwePartij({ eersteDeler: 3, instellingen: { opnieuwDelenDoor: 'volgende' } });
  assert.equal(naOpnieuwDelen(p).deler, 0);
});

test('een hele partij van 16 potjes met willekeurige spelers', () => {
  const rng = maakRng(2026);
  let partij = nieuwePartij({ eersteDeler: 0 });
  const delers = [];
  let rondgepast = 0;
  while (!partijKlaar(partij)) {
    const { handen, draaien } = deelRonde(partij, rng);
    let d = draaien;
    while (!d.uitkomst) d = beslis(d, d.beurt, rng() < 0.12 ? 'spelen' : 'passen');
    if (d.uitkomst.soort === 'opnieuwDelen') {
      rondgepast++;
      partij = naOpnieuwDelen(partij);
      continue;
    }
    delers.push(partij.deler);
    let potje = startPotje(partij, handen, d.uitkomst);
    while (!potje.klaar) {
      const g = geldigVoor(potje, potje.beurt);
      potje = speelKaart(potje, potje.beurt, g[Math.floor(rng() * g.length)]);
    }
    partij = rondPotjeAf(partij, potje);
  }
  assert.equal(partij.potjes.length, 16);
  assert.equal(potjeNummer(partij), 17);
  assert.deepEqual(delers, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
  const som = partij.potjes.reduce((s, u) => [s[0] + u.totaal[0], s[1] + u.totaal[1]], [0, 0]);
  assert.deepEqual(partij.totaal, som);
  assert.ok(rondgepast > 0, 'met deze kansen komt rondpassen voor');
  assert.throws(() => rondPotjeAf(partij, null), /al afgelopen/);
});
