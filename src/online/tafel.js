// Zet het zicht van de server (vaste plekken 0-3) om naar de vorm die de gewone speeltafel
// tekent: jij zit altijd op plek 0 (onderaan), je maat op 2. Puur, zonder scherm.

const PLEKNAAM = ['Zuid', 'West', 'Noord', 'Oost'];

export function draaiVoor(ik) {
  const r = (p) => (p === null || p === undefined ? p : (p - ik + 4) % 4);
  const wissel = ik % 2 === 1; // jouw team wordt team 0 ("wij")
  const t = (a) => (a && wissel ? [a[1], a[0]] : a);
  const tm = (x) => (x === null || x === undefined ? x : wissel ? 1 - x : x);
  const slag = (s) => s.map((x) => ({ speler: r(x.speler), kaart: x.kaart }));
  return { r, t, tm, slag, terug: (i) => (i + ik) % 4 };
}

// antw: antwoord van de server ({ zicht, namen, ik, maker }); lokaal: wat de app zelf bijhoudt
// (gekozen kaart, slag die nog even blijft liggen, meldingen).
export function tafelVoor(antw, lokaal = {}) {
  const { zicht: z, namen, ik } = antw;
  const { r, t, tm, slag, terug } = draaiVoor(ik);
  const aantallen = [0, 1, 2, 3].map((i) => z.aantallen[terug(i)]);
  const verborgen = (n) => Array.from({ length: n }, () => ({ kleur: 'schoppen', rang: '7', verborgen: true }));
  const handen = aantallen.map((n, i) => (i === 0 ? z.hand : verborgen(n)));
  const slagen = (z.potje?.slagen ?? []).map((s) => ({ ...s, kaarten: slag(s.kaarten), winnaar: r(s.winnaar) }));
  const potje = z.potje && {
    ...z.potje,
    spelendTeam: tm(z.potje.spelendTeam),
    handen,
    slag: slag(z.potje.slag),
    slagen,
    beurt: r(z.potje.beurt),
    uitkomer: r(z.potje.uitkomer),
    kiezer: r(z.potje.kiezer),
    verzaking: z.potje.verzaking && { ...z.potje.verzaking, speler: r(z.potje.verzaking.speler), team: tm(z.potje.verzaking.team) },
  };
  const d = z.draaien;
  const draaien = {
    ...d,
    beurt: r(d.beurt),
    uitkomst: d.uitkomst && { ...d.uitkomst, speler: r(d.uitkomst.speler), team: tm(d.uitkomst.team) },
  };
  const draaiKeuzes = Object.fromEntries(d.keuzes.map((p) => [r(p), 'passen']));
  const u = z.uitslag;
  const uitslag = u && {
    ...u,
    punten: t(u.punten), roem: t(u.roem), totaal: t(u.totaal), pit: tm(u.pit),
    verzaakt: u.verzaakt && { ...u.verzaakt, speler: r(u.verzaakt.speler), team: tm(u.verzaakt.team) },
  };
  const echteNamen = [0, 1, 2, 3].map((i) => namen[terug(i)]);
  const naamLijst = echteNamen.map((n, i) => n ?? `${PLEKNAAM[terug(i)]}`);
  const rollen = echteNamen.map((n, i) => (i === 0 ? '' : `${i === 2 ? 'Jouw maat' : 'Tegenstander'}${n ? '' : ' · computer'}`));

  // Tijdelijke meldingen van de app: "Noord speelt · troef harten" en "Iedereen past".
  let fase = z.fase;
  let draaiMelding = null;
  if (lokaal.draaiMelding) {
    fase = 'draaien';
    draaiMelding = { ...lokaal.draaiMelding, speler: r(lokaal.draaiMelding.speler) };
  } else if (lokaal.opnieuwDelen) fase = 'opnieuwDelen';
  const toonPotje = draaiMelding || fase === 'opnieuwDelen' ? null : potje;

  return {
    scherm: 'tafel',
    online: true,
    fase,
    partij: { totaal: t(z.partij.totaal), potjes: Array(z.partij.aantalPotjes).fill(null), deler: r(z.partij.deler), instellingen: z.partij.instellingen },
    draaien: draaiMelding ? { ...draaien, uitkomst: { soort: 'spelen', speler: draaiMelding.speler, troef: draaiMelding.kleur } } : draaien,
    draaiKeuzes: draaiMelding ? {} : draaiKeuzes,
    draaiMelding,
    potje: toonPotje,
    handen: z.handen ? [0, 1, 2, 3].map((i) => z.handen[terug(i)]) : [z.hand, ...[1, 2, 3].map((i) => verborgen(aantallen[i]))],
    uitslag,
    getoondeSlag: lokaal.getoondeSlag ? slag(lokaal.getoondeSlag) : null,
    laatsteSlag: slagen.at(-1) ?? null,
    gekozen: lokaal.gekozen ?? null,
    nieuweKaart: lokaal.nieuweKaart ?? null,
    roemMelding: lokaal.roemMelding ?? null,
    venster: lokaal.venster ?? null,
    instellingen: { ...(lokaal.instellingen ?? {}), vergelijk: false },
    namen: naamLijst,
    rollen,
    analyses: [],
    vergelijking: null,
    leren: null,
    hulpMelding: null,
    tweedeKans: null,
  };
}
