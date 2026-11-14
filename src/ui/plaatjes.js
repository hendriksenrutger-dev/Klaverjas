// Plaatjes van heer, vrouw en boer en het grote symbool van de azen worden op een <canvas>
// getekend. Een canvas staat meteen compleet op het scherm; een <img> wordt op de tablet pas
// uitgepakt als hij zichtbaar wordt, waardoor een kaart eerst even wit was.
import { VORMEN_PAD } from './kaart.js';

const KLEUREN = ['klaveren', 'ruiten', 'harten', 'schoppen'];
const KLEUR = { harten: '#b3262d', ruiten: '#b3262d', klaveren: '#1b1b1b', schoppen: '#1b1b1b' };
export const PLAATJE_B = 248;
export const PLAATJE_H = 400;
export const AAS_MAAT = 160;

const beelden = new Map(); // 'harten-H' -> gedecodeerde Image
const getekend = new WeakMap(); // canvas -> wat erop staat
let wachtend = [];

// Laadt en decodeert de 12 plaatjes; tekent daarna wat er nog wachtte.
export function laadPlaatjes(basis) {
  const klaar = [];
  for (const kleur of KLEUREN) {
    for (const rang of ['H', 'V', 'B']) {
      const img = new Image();
      img.src = new URL(`${kleur}-${rang}.webp`, basis).href;
      klaar.push((img.decode ? img.decode() : new Promise((ok) => { img.onload = ok; }))
        .then(() => {
          beelden.set(`${kleur}-${rang}`, img);
          const nu = wachtend;
          wachtend = [];
          for (const c of nu) teken(c);
        })
        .catch(() => {}));
    }
  }
  return Promise.all(klaar);
}

function teken(c) {
  const wat = c.dataset.teken;
  if (!wat || getekend.get(c) === wat) return;
  const [kleur, rang] = wat.split('-');
  const ctx = c.getContext('2d');
  if (rang === 'A') {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.scale(c.width / 100, c.height / 100);
    ctx.fillStyle = KLEUR[kleur];
    ctx.fill(new Path2D(VORMEN_PAD[kleur]));
    ctx.restore();
  } else {
    const img = beelden.get(wat);
    if (!img) {
      wachtend.push(c);
      return;
    }
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
  }
  getekend.set(c, wat);
}

// Tekent alle (nieuwe) canvassen binnen el. Aanroepen direct na het bijwerken van het scherm,
// in dezelfde taak: dan staat de kaart in het eerstvolgende beeld meteen compleet.
export function vulPlaatjes(el) {
  for (const c of el.querySelectorAll('canvas[data-teken]')) teken(c);
}
