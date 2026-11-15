import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { legeVoortgang, compleetVoortgang, telLeerPotje, POTJES_PER_STAP, hintUitleg, roemUitleg, seinUitleg, STANDAARD_UITLEG } from '../src/ui/leren.js';
import { K, Ks } from './hulp.js';

describe('leerpad: voortgang', () => {
  test('na 4 potjes in de open stap gaat de volgende open', () => {
    let v = { ...legeVoortgang(), open: 2 };
    let nieuw = null;
    for (let i = 0; i < POTJES_PER_STAP; i++) ({ voortgang: v, nieuweStap: nieuw } = telLeerPotje(v, 2));
    assert.equal(v.open, 3);
    assert.equal(nieuw, 3);
  });

  test('oefenen in een eerdere stap opent niets nieuws; na stap 5 stopt het', () => {
    let v = { open: 4, potjes: {} };
    for (let i = 0; i < 6; i++) v = telLeerPotje(v, 2).voortgang;
    assert.equal(v.open, 4);
    v = { open: 5, potjes: { 5: 9 } };
    assert.equal(telLeerPotje(v, 5).nieuweStap, null);
    assert.equal(compleetVoortgang({ open: 9 }).open, 5);
  });
});

describe('leerpad: uitleg', () => {
  const basis = (o) => ({ troef: 'harten', spelendTeam: 0, speler: 0, ...o });

  test('enige kaart en troef trekken', () => {
    assert.equal(hintUitleg(basis({ hand: Ks('k7'), slag: [] }), [K('k7')], K('k7')), 'Dit is de enige kaart die je mag spelen.');
    assert.match(hintUitleg(basis({ hand: Ks('hB k7'), slag: [] }), Ks('hB k7'), K('hB')), /Troef trekken/);
  });

  test('punten geven aan je maat die de slag heeft', () => {
    const slag = [{ speler: 1, kaart: K('k9') }, { speler: 2, kaart: K('kA') }, { speler: 3, kaart: K('k7') }];
    assert.equal(hintUitleg(basis({ hand: Ks('k10 k8'), slag }), Ks('k10 k8'), K('k10')), 'Je maat heeft de slag: geef hem punten.');
  });

  test('sein: kleintje bijspelen terwijl je de aas hebt', () => {
    // Noord heeft de slag met ♠A; Zuid heeft geen schoppen en gooit ♣7 bij, met ♣A in de hand.
    const slag2 = [{ speler: 1, kaart: K('s9') }, { speler: 2, kaart: K('sA') }, { speler: 3, kaart: K('s8') }];
    assert.match(hintUitleg(basis({ hand: Ks('k7 kA r8'), slag: slag2 }), Ks('k7 kA r8'), K('k7')), /Sein: een kleintje/);
  });

  test('slag nemen, niets weggeven, en anders de standaardtekst', () => {
    const slag = [{ speler: 1, kaart: K('k9') }];
    assert.equal(hintUitleg(basis({ hand: Ks('kA k7'), slag }), Ks('kA k7'), K('kA')), 'Hiermee neem je de slag.');
    const slag2 = [{ speler: 1, kaart: K('kA') }];
    assert.match(hintUitleg(basis({ hand: Ks('k7 k8'), slag: slag2 }), Ks('k7 k8'), K('k7')), /niet winnen/);
    assert.equal(hintUitleg(basis({ hand: Ks('k7 sA'), slag: [] }), Ks('k7 sA'), K('k7')), STANDAARD_UITLEG);
  });

  test('roem en seinen van je maat', () => {
    assert.equal(roemUitleg({ totaal: 70, items: [{ soort: 'vierkaart', punten: 50 }, { soort: 'stuk', punten: 20 }] }),
      'Roem: vierkaart: vier opeenvolgende kaarten van één kleur (50) + stuk: heer en vrouw van troef (20).');
    const voor = [{ speler: 3, kaart: K('k9') }, { speler: 0, kaart: K('kA') }, { speler: 1, kaart: K('k8') }];
    assert.match(seinUitleg(voor, 2, K('k7'), 'harten', 'Noord'), /Noord heeft waarschijnlijk de aas van klaveren/);
    assert.equal(seinUitleg(voor, 2, K('kH'), 'harten', 'Noord'), '');
  });
});
