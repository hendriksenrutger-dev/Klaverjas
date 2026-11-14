import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nieuwPotje, speelKaart, geldigVoor, uitslag, stand, VERZAAK_STRAFPUNTEN } from '../src/regels/potje.js';
import { maakDeck, schud, deel, team } from '../src/regels/kaarten.js';
import { maakRng } from '../src/regels/rng.js';
import { geldigeKaarten } from '../src/regels/geldig.js';
import { Ks, K } from './hulp.js';

// Speelt een potje uit met een strategie (standaard: eerste geldige kaart).
function speelUit(potje, kies = (geldig) => geldig[0]) {
  let p = potje;
  while (!p.klaar) p = speelKaart(p, p.beurt, kies(geldigVoor(p, p.beurt), p));
  return p;
}

// Nep-potje voor de telling: slagen als [winnaar, punten, roem].
function nepPotje(spelendTeam, slagen, verzaking = null) {
  return {
    klaar: true,
    spelendTeam,
    verzaking,
    slagen: slagen.map(([winnaar, punten, roem = 0]) => ({ winnaar, punten, roem: { totaal: roem, items: [] } })),
  };
}

// Pit-hand: speler 0 heeft alle harten (troef).
function pitHanden() {
  return [
    Ks('h7 h8 h9 h10 hB hV hH hA'),
    Ks('k7 k8 k9 k10 kB kV kH kA'),
    Ks('r7 r8 r9 r10 rB rV rH rA'),
    Ks('s7 s8 s9 s10 sB sV sH sA'),
  ];
}

describe('verloop van een potje', () => {
  test('alleen wie aan de beurt is mag spelen', () => {
    const p = nieuwPotje({ handen: pitHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    assert.throws(() => speelKaart(p, 1, K('k7')), /niet aan de beurt/);
  });

  test('een kaart die je niet hebt kun je niet spelen', () => {
    const p = nieuwPotje({ handen: pitHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    assert.throws(() => speelKaart(p, 0, K('kA')), /niet in de hand/);
  });

  test('beurt gaat naar links, winnaar komt de volgende slag uit', () => {
    let p = nieuwPotje({ handen: pitHanden(), troef: 'klaveren', spelendTeam: 1, uitkomer: 2 });
    p = speelKaart(p, 2, K('r7'));
    assert.equal(p.beurt, 3);
    p = speelKaart(p, 3, K('s7'));
    p = speelKaart(p, 0, K('h7'));
    p = speelKaart(p, 1, K('k7')); // troef wint
    assert.equal(p.slagen.length, 1);
    assert.equal(p.slagen[0].winnaar, 1);
    assert.equal(p.beurt, 1);
    assert.equal(p.slag.length, 0);
  });

  test('de originele toestand verandert niet', () => {
    const p = nieuwPotje({ handen: pitHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    speelKaart(p, 0, K('hB'));
    assert.equal(p.handen[0].length, 8);
    assert.equal(p.slag.length, 0);
  });

  test('pit: alle slagen voor de spelende partij geeft 162 + 100 roem', () => {
    const p = speelUit(nieuwPotje({ handen: pitHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 }));
    const u = uitslag(p);
    assert.equal(u.pit, 0);
    assert.equal(u.nat, false);
    assert.equal(u.punten[0], 162);
    assert.equal(u.punten[1], 0);
    assert.equal(u.roem[0] - stand(p).roem[0], 100);
  });

  test('roem gaat naar de winnaar van de slag', () => {
    // Speler 0 komt uit met k7, 1 en 2 en 3 spelen k8 k9 kA: driekaart 7-8-9 in de slag van speler 3.
    const handen = [
      Ks('k7 h7 h8 h9 h10 hB hV hH'),
      Ks('k8 r7 r8 r9 r10 rB rV rH'),
      Ks('k9 s7 s8 s9 s10 sB sV sH'),
      Ks('kA hA rA sA k10 kB kV kH'),
    ];
    let p = nieuwPotje({ handen, troef: 'schoppen', spelendTeam: 0, uitkomer: 0 });
    for (const [s, c] of [[0, 'k7'], [1, 'k8'], [2, 'k9'], [3, 'kA']]) p = speelKaart(p, s, K(c));
    assert.equal(p.slagen[0].winnaar, 3);
    assert.equal(p.slagen[0].roem.totaal, 20);
    assert.deepEqual(stand(p).roem, [0, 20]);
  });

  test('uitslag vóór het einde geeft een fout', () => {
    const p = nieuwPotje({ handen: pitHanden(), troef: 'harten', spelendTeam: 0, uitkomer: 0 });
    assert.throws(() => uitslag(p));
  });

  test('willekeurige potjes: altijd 162 punten, laatste slag telt 10 mee', () => {
    const rng = maakRng(7);
    for (let n = 0; n < 300; n++) {
      const handen = deel(schud(maakDeck(), rng), n % 4);
      const troef = ['klaveren', 'ruiten', 'harten', 'schoppen'][n % 4];
      const systeem = n % 2 ? 'rotterdams' : 'amsterdams';
      const start = nieuwPotje({ handen, troef, spelendTeam: n % 2, uitkomer: (n + 1) % 4, systeem });
      const p = speelUit(start, (g) => g[Math.floor(rng() * g.length)]);
      const { punten, roem } = stand(p);
      assert.equal(punten[0] + punten[1], 162);
      assert.equal(p.slagen.length, 8);
      const kaartPunten = p.slagen.reduce((s, sl) => s + sl.punten, 0) - 10;
      assert.equal(kaartPunten, 152);
      const u = uitslag(p);
      const s = p.spelendTeam;
      if (u.nat) {
        assert.equal(u.punten[s], 0);
        assert.equal(u.roem[s], 0);
        assert.equal(u.punten[1 - s], 162);
        assert.equal(u.roem[1 - s], roem[0] + roem[1]);
      } else {
        assert.ok(u.totaal[s] > u.totaal[1 - s]);
      }
      // Elke gespeelde kaart was geldig: alle handen leeg.
      assert.ok(p.handen.every((h) => h.length === 0));
    }
  });
});

describe('nat en pit (telling)', () => {
  // 8 slagen; laatste slag bevat al de 10 punten.
  test('spelende partij heeft meer: gewoon tellen', () => {
    const u = uitslag(nepPotje(0, [[0, 40], [0, 42], [1, 40], [1, 40], [0, 0], [0, 0], [0, 0], [1, 0]]));
    assert.deepEqual(u.punten, [82, 80]);
    assert.equal(u.nat, false);
    assert.deepEqual(u.totaal, [82, 80]);
  });

  test('gelijkspel (81-81) is nat', () => {
    const u = uitslag(nepPotje(0, [[0, 81], [1, 81], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
    assert.equal(u.nat, true);
    assert.deepEqual(u.punten, [0, 162]);
    assert.deepEqual(u.totaal, [0, 162]);
  });

  test('nat: tegenpartij krijgt 162 plus alle roem, ook die van de spelers', () => {
    // Spelend 70 + 20 roem = 90 tegen 92: nat.
    const u = uitslag(nepPotje(1, [[1, 70, 20], [0, 92], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
    assert.equal(u.nat, true);
    assert.deepEqual(u.punten, [162, 0]);
    assert.deepEqual(u.roem, [20, 0]);
    assert.deepEqual(u.totaal, [182, 0]);
  });

  test('roem van de spelende partij kan een potje redden', () => {
    // 75 + 20 = 95 tegen 87.
    const u = uitslag(nepPotje(0, [[0, 75, 20], [1, 87], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
    assert.equal(u.nat, false);
    assert.deepEqual(u.totaal, [95, 87]);
  });

  test('roem van de tegenpartij telt mee: 90 tegen 72 + 20 roem is nat', () => {
    const u = uitslag(nepPotje(0, [[0, 90], [1, 72, 20], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
    assert.equal(u.nat, true);
    assert.deepEqual(u.totaal, [0, 182]);
  });

  test('pit voor de spelende partij: 100 roem extra', () => {
    const u = uitslag(nepPotje(1, [[1, 20], [3, 20], [1, 20], [3, 20], [1, 20], [3, 20], [1, 20], [3, 22]]));
    assert.equal(u.pit, 1);
    assert.equal(u.roem[1], 100);
    assert.equal(u.nat, false);
  });

  test('pit met roem: roem uit de slagen plus 100', () => {
    const u = uitslag(nepPotje(0, [[0, 152, 50], [2, 0], [0, 0, 20], [2, 0], [0, 0], [2, 0], [0, 0], [2, 10]]));
    assert.equal(u.pit, 0);
    assert.deepEqual(u.punten, [162, 0]);
    assert.deepEqual(u.roem, [170, 0]);
    assert.deepEqual(u.totaal, [332, 0]);
  });

  test('alle slagen voor de tegenpartij: nat, geen pitbonus voor de tegenpartij', () => {
    const u = uitslag(nepPotje(0, [[1, 152, 20], [3, 0], [1, 0], [3, 0], [1, 0], [3, 0], [1, 0], [3, 10]]));
    assert.equal(u.nat, true);
    assert.equal(u.pit, 1);
    assert.deepEqual(u.totaal, [0, 182]);
  });
});

describe('verzaken', () => {
  test('met verzaakbescherming kan een ongeldige kaart niet gespeeld worden', () => {
    const handen = [
      Ks('h7 k8 k9 k10 kB kV kH kA'),
      Ks('h8 r7 r8 r9 r10 rB rV rH'),
      Ks('h9 rA s7 s8 s9 s10 sB sV'),
      Ks('h10 hB hV hH hA sH sA k7'),
    ];
    let p = nieuwPotje({ handen, troef: 'klaveren', spelendTeam: 0, uitkomer: 0 });
    p = speelKaart(p, 0, K('h7'));
    assert.throws(() => speelKaart(p, 1, K('r7')), /mag niet/);
  });

  test('zonder verzaakbescherming: potje stopt meteen en wordt bestraft', () => {
    const handen = [
      Ks('h7 k8 k9 k10 kB kV kH kA'),
      Ks('h8 r7 r8 r9 r10 rB rV rH'),
      Ks('h9 rA s7 s8 s9 s10 sB sV'),
      Ks('h10 hB hV hH hA sH sA k7'),
    ];
    let p = nieuwPotje({ handen, troef: 'klaveren', spelendTeam: 1, uitkomer: 3, verzaakbescherming: false });
    // Slag 1: speler 3 komt uit met hV, 0 h7, 1 h8, 2 h9 -> speler 3 wint (V > 9 in niet-troef).
    for (const [s, c] of [[3, 'hV'], [0, 'h7'], [1, 'h8'], [2, 'h9']]) p = speelKaart(p, s, K(c));
    assert.equal(p.slagen[0].winnaar, 3);
    // Slag 2: speler 3 komt uit met hH (stuk niet, klaveren is troef), 0 heeft geen harten meer.
    p = speelKaart(p, 3, K('hH'));
    // Speler 0 moet troeven (klaveren) maar speelt... hij heeft alleen klaveren: geldig.
    p = speelKaart(p, 0, K('k8'));
    // Speler 1 heeft geen harten en geen klaveren: alles mag.
    p = speelKaart(p, 1, K('r7'));
    // Speler 2 heeft geen harten, geen klaveren: alles mag. Speler 3 nu weer uit na winnaar...
    p = speelKaart(p, 2, K('rA'));
    assert.equal(p.slagen[1].winnaar, 0);
    // Slag 3: speler 0 komt uit met k9 (troef). Speler 1 heeft geen klaveren, 2 ook niet.
    p = speelKaart(p, 0, K('k9'));
    p = speelKaart(p, 1, K('r8'));
    p = speelKaart(p, 2, K('s7'));
    // Speler 3 heeft k7 (troef) maar speelt sA: verzaakt.
    assert.equal(geldigeKaarten(p.handen[3], p.slag, 'klaveren').length, 1);
    p = speelKaart(p, 3, K('sA'));
    assert.equal(p.klaar, true);
    assert.equal(p.verzaking.speler, 3);
    assert.equal(p.verzaking.team, 1);
    assert.equal(p.verzaking.slagNummer, 3);
    const u = uitslag(p);
    assert.deepEqual(u.punten, [162 + VERZAAK_STRAFPUNTEN, 0]);
    assert.equal(u.verzaakt.speler, 3);
    // Slag 1 had harten 7-8-9 (driekaart, 20 roem voor de verzakers); die gaat ook naar team 0.
    assert.deepEqual(u.roem, [20, 0]);
    assert.deepEqual(u.totaal, [282, 0]);
  });

  test('verzaken: tegenpartij krijgt ook alle roem die al gemaakt is', () => {
    const p = nepPotje(0, [[0, 30, 20], [1, 20, 50]], { speler: 2, team: 0 });
    const u = uitslag(p);
    assert.deepEqual(u.punten, [0, 262]);
    assert.deepEqual(u.roem, [0, 70]);
    assert.deepEqual(u.totaal, [0, 332]);
  });

  test('ook de spelende partij kan de straf krijgen of winnen', () => {
    const u = uitslag(nepPotje(0, [[0, 30]], { speler: 1, team: 1 }));
    assert.deepEqual(u.totaal, [262, 0]);
    assert.equal(u.nat, false);
  });

});
