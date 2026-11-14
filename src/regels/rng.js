// Toevalsgenerator met zaadje (mulberry32), zodat tests en simulaties herhaalbaar zijn.
export function maakRng(zaad = Date.now()) {
  let a = zaad >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
