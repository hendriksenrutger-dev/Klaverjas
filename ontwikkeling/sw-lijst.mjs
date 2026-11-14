// Werkt de offline-lijst in klaverjas-sw.js bij en verhoogt het cachenummer.
// Gebruik: node ontwikkeling/sw-lijst.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const swPad = path.join(root, 'klaverjas-sw.js');
const EXT = /\.(js|css|webp|woff2|png|ogg)$/;

function alle(map) {
  const res = [];
  for (const e of fs.readdirSync(path.join(root, map), { withFileTypes: true })) {
    const rel = `${map}/${e.name}`;
    if (e.isDirectory()) res.push(...alle(rel));
    else if (EXT.test(e.name)) res.push(rel);
  }
  return res;
}

const bestanden = ['./', 'index.html', 'manifest.json', ...alle('src'), ...alle('assets')];
const lijst = ['./', ...bestanden.filter((b) => b !== './').sort()].map((b) => `  '${b}',`).join('\n');
let sw = fs.readFileSync(swPad, 'utf8');
sw = sw.replace(/const BESTANDEN = \[\n[\s\S]*?\n\];/, `const BESTANDEN = [\n${lijst}\n];`);
sw = sw.replace(/const CACHE = 'klaverjas-v(\d+)';/, (_, n) => `const CACHE = 'klaverjas-v${Number(n) + 1}';`);
fs.writeFileSync(swPad, sw);
console.log(sw.match(/const CACHE = '[^']+'/)[0], `· ${bestanden.length} bestanden`);
