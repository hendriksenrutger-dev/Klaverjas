// Statistieken over alle partijen. Puur (geen DOM, geen opslag): elke functie geeft een nieuw object.
// Wij = team 0 (Rutger en Noord).

export function legeStatistiek(sinds = new Date().toISOString().slice(0, 10)) {
  return {
    sinds,
    partijen: { gespeeld: 0, gewonnen: 0, verloren: 0, gelijk: 0, hoogste: null, laagste: null, grootsteWinst: null, reeks: 0, recordReeks: 0 },
    potjes: {
      gespeeld: 0,
      wijSpeelden: 0, wijGehaald: 0, wijNat: 0, wijPit: 0,
      zijSpeelden: 0, zijNat: 0, zijPit: 0,
      verzaakt: 0,
      puntenWij: 0, puntenZij: 0, roemWij: 0, roemZij: 0,
    },
    vergelijk: { kaarten: 0, zelfde: 0, gelijkwaardig: 0 },
  };
}

// Vult ontbrekende velden aan (bijv. uit een oudere versie van de opslag).
export function compleet(s) {
  const leeg = legeStatistiek();
  if (!s) return leeg;
  return {
    sinds: s.sinds ?? leeg.sinds,
    partijen: { ...leeg.partijen, ...s.partijen },
    potjes: { ...leeg.potjes, ...s.potjes },
    vergelijk: { ...leeg.vergelijk, ...s.vergelijk },
  };
}

// Telt een afgelopen potje. u = uitslag(potje), spelendTeam uit het potje.
export function telPotje(stat, u, spelendTeam) {
  const s = compleet(stat);
  const p = { ...s.potjes };
  p.gespeeld++;
  p.puntenWij += u.totaal[0];
  p.puntenZij += u.totaal[1];
  p.roemWij += u.roem[0];
  p.roemZij += u.roem[1];
  if (u.verzaakt) p.verzaakt++;
  if (spelendTeam === 0) {
    p.wijSpeelden++;
    if (u.nat || (u.verzaakt && u.verzaakt.team === 0)) p.wijNat++;
    else p.wijGehaald++;
    if (u.pit === 0) p.wijPit++;
  } else {
    p.zijSpeelden++;
    if (u.nat || (u.verzaakt && u.verzaakt.team === 1)) p.zijNat++;
    if (u.pit === 1) p.zijPit++;
  }
  return { ...s, potjes: p };
}

// Telt een afgelopen partij. totaal = eindstand [wij, zij].
export function telPartij(stat, totaal) {
  const s = compleet(stat);
  const q = { ...s.partijen };
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
  return { ...s, partijen: q };
}

// Telt een vergeleken kaart (alleen als "Vergelijk met de computer" aan staat).
export function telVergelijk(stat, oordeel) {
  const s = compleet(stat);
  const v = { ...s.vergelijk };
  v.kaarten++;
  if (oordeel === 'zelfde') v.zelfde++;
  if (oordeel === 'gelijkwaardig') v.gelijkwaardig++;
  return { ...s, vergelijk: v };
}

export const procent = (deel, geheel) => (geheel ? Math.round((100 * deel) / geheel) : 0);
