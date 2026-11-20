// Geleerd spelen of passen (ontwikkeling/draaileren/, 20 november 2026).
// De simulatie schat hoeveel spelen oplevert (g). Uit 14.000 echt uitgespeelde twijfelgevallen
// (elk één keer gespeeld en één keer gepast) is geleerd hoe die schatting bijgesteld moet worden:
// bij veel troef met de boer is de simulatie te voorzichtig, bij weinig troef zonder boer te
// optimistisch. Model: lineaire regressie van (spelen − passen) op g en kenmerken van de hand.
// Gemeten in het duel: +1,7 ± 0,7 punt per deling t.o.v. "spelen als g > 10".
import { kaartId } from '../regels/kaarten.js';

// Volgorde hoort bij de kenmerken hieronder; niet los aanpassen.
export const DRAAI_GEWICHTEN = [-73.78, 26.18, -7.68, 14.31, 38.04, 77.04, 53.38, 10.85, -8.82, -3.53, 1.58, -5.82, 22.29, 46.15, 0.68, 6.48, -1.01, -9.9, -4.45, -6.64, 2.88, 0.96, -9.39];

// r: { hand: [kaart-id], troef, plek (0 = deler, 1 = links van de deler …), ronde (aantal kleuren
// waarop al rondgepast is), gepast: [kleur], g }.
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

// Verwacht verschil spelen − passen. eerderGepast: [[speler, kleur]] zoals eerderePassen(d).
export function geleerdVerschil(hand, kleur, g, speler, deler, eerderGepast = [], w = DRAAI_GEWICHTEN) {
  const gepast = [...new Set(eerderGepast.map(([, k]) => k).filter((k) => k !== kleur))];
  const x = kenmerkenDraai({ hand: hand.map(kaartId), troef: kleur, plek: (speler - deler + 4) % 4, ronde: gepast.length, gepast, g });
  return w.reduce((s, wi, i) => s + wi * x[i], 0);
}
