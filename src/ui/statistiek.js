// Statistieken over alle partijen, apart voor Amsterdams en Rotterdams (Rutgers wens).
// Puur (geen DOM, geen opslag): elke functie geeft een nieuw object. Wij = team 0.

export const SYSTEMEN = ['amsterdams', 'rotterdams'];

function leegDeel() {
  return {
    partijen: { gespeeld: 0, gewonnen: 0, verloren: 0, gelijk: 0, hoogste: null, laagste: null, grootsteWinst: null, reeks: 0, recordReeks: 0 },
    potjes: {
      gespeeld: 0,
      wijSpeelden: 0, wijGehaald: 0, wijNat: 0, wijPit: 0,
      zijSpeelden: 0, zijGehaald: 0, zijNat: 0, zijPit: 0,
      verzaakt: 0,
      puntenWij: 0, puntenZij: 0, roemWij: 0, roemZij: 0,
    },
    vergelijk: { kaarten: 0, zelfde: 0, gelijkwaardig: 0 },
  };
}

function compleetDeel(d) {
  const leeg = leegDeel();
  if (!d) return leeg;
  const potjes = { ...leeg.potjes, ...d.potjes };
  // Oudere opslag had geen zijGehaald: afleiden.
  if (d.potjes && d.potjes.zijGehaald === undefined) potjes.zijGehaald = potjes.zijSpeelden - potjes.zijNat;
  return { partijen: { ...leeg.partijen, ...d.partijen }, potjes, vergelijk: { ...leeg.vergelijk, ...d.vergelijk } };
}

export function legeStatistiek(sinds = new Date().toISOString().slice(0, 10)) {
  return { sinds, systemen: { amsterdams: leegDeel(), rotterdams: leegDeel() } };
}

// Vult ontbrekende velden aan. De eerste versie had geen splitsing; Rutger speelde die partij
// Rotterdams, dus die cijfers gaan naar Rotterdams.
export function compleet(s) {
  if (!s) return legeStatistiek();
  const sinds = s.sinds ?? legeStatistiek().sinds;
  if (!s.systemen) return { sinds, systemen: { amsterdams: leegDeel(), rotterdams: compleetDeel(s) } };
  return { sinds, systemen: { amsterdams: compleetDeel(s.systemen.amsterdams), rotterdams: compleetDeel(s.systemen.rotterdams) } };
}

function pasAan(stat, systeem, fn) {
  const s = compleet(stat);
  const sys = SYSTEMEN.includes(systeem) ? systeem : 'amsterdams';
  return { ...s, systemen: { ...s.systemen, [sys]: fn(s.systemen[sys]) } };
}

// Telt een afgelopen potje. u = uitslag(potje).
export function telPotje(stat, u, spelendTeam, systeem) {
  return pasAan(stat, systeem, (d) => {
    const p = { ...d.potjes };
    p.gespeeld++;
    p.puntenWij += u.totaal[0];
    p.puntenZij += u.totaal[1];
    p.roemWij += u.roem[0];
    p.roemZij += u.roem[1];
    if (u.verzaakt) p.verzaakt++;
    const nat = u.nat || (u.verzaakt && u.verzaakt.team === spelendTeam);
    const w = spelendTeam === 0 ? 'wij' : 'zij';
    p[`${w}Speelden`]++;
    if (nat) p[`${w}Nat`]++;
    else p[`${w}Gehaald`]++;
    if (u.pit === spelendTeam) p[`${w}Pit`]++;
    return { ...d, potjes: p };
  });
}

// Telt een afgelopen partij. totaal = eindstand [wij, zij].
export function telPartij(stat, totaal, systeem) {
  return pasAan(stat, systeem, (d) => {
    const q = { ...d.partijen };
    const [wij, zij] = totaal;
    q.gespeeld++;
    if (wij > zij) {
      q.gewonnen++;
      q.reeks++;
      q.recordReeks = Math.max(q.recordReeks, q.reeks);
      q.grootsteWinst = Math.max(q.grootsteWinst ?? 0, wij - zij);
    } else {
      if (wij < zij) q.verloren++;
      else q.gelijk++;
      q.reeks = 0;
    }
    q.hoogste = Math.max(q.hoogste ?? wij, wij);
    q.laagste = Math.min(q.laagste ?? wij, wij);
    return { ...d, partijen: q };
  });
}

// Telt een vergeleken kaart (alleen als "Vergelijk met de computer" aan staat).
export function telVergelijk(stat, oordeel, systeem) {
  return pasAan(stat, systeem, (d) => {
    const v = { ...d.vergelijk };
    v.kaarten++;
    if (oordeel === 'zelfde') v.zelfde++;
    if (oordeel === 'gelijkwaardig') v.gelijkwaardig++;
    return { ...d, vergelijk: v };
  });
}

export const procent = (deel, geheel) => (geheel ? Math.round((100 * deel) / geheel) : 0);
