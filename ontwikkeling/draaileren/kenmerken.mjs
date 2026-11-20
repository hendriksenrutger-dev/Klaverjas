export function kenmerkenDraai(r) {
  const h = r.hand.map((id) => { const [kleur, rang] = id.split('-'); return { kleur, rang }; });
  const tr = h.filter((k) => k.kleur === r.troef);
  const heeft = (rang) => tr.some((k) => k.rang === rang);
  const n = tr.length;
  const anderen = h.filter((k) => k.kleur !== r.troef);
  const azen = anderen.filter((k) => k.rang === 'A').length;
  const tienMetAas = anderen.filter((k) => k.rang === '10' && anderen.some((a) => a.kleur === k.kleur && a.rang === 'A')).length;
  const kaleTien = anderen.filter((k) => k.rang === '10' && !anderen.some((a) => a.kleur === k.kleur && a.rang === 'A')).length;
  const kleurenZonder = ['harten', 'ruiten', 'klaveren', 'schoppen'].filter((k) => k !== r.troef && !h.some((x) => x.kleur === k)).length;
  return [
    1, r.g / 50,
    n === 1 ? 1 : 0, n === 2 ? 1 : 0, n === 3 ? 1 : 0, n >= 4 ? 1 : 0,
    heeft('B') ? 1 : 0, heeft('9') ? 1 : 0, heeft('A') ? 1 : 0, heeft('10') ? 1 : 0,
    heeft('H') && heeft('V') ? 1 : 0,
    n === 2 && heeft('B') ? 1 : 0, n === 2 && heeft('B') && heeft('9') ? 1 : 0,
    azen / 3, tienMetAas / 2, kaleTien / 2, kleurenZonder,
    r.plek === 1 ? 1 : 0, r.plek === 2 ? 1 : 0, r.plek === 3 ? 1 : 0,
    r.ronde, r.gepast.length / 3,
    (n <= 2 ? 1 : 0) * azen / 3,
  ];
}
