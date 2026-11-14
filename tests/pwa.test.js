import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sw = fs.readFileSync(path.join(root, 'klaverjas-sw.js'), 'utf8');
const lijst = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

function alleBestanden(map) {
  const res = [];
  for (const e of fs.readdirSync(path.join(root, map), { withFileTypes: true })) {
    const rel = path.join(map, e.name);
    if (e.isDirectory()) res.push(...alleBestanden(rel));
    else if (/\.(js|css|webp|woff2|png)$/.test(e.name)) res.push(rel.split(path.sep).join('/'));
  }
  return res;
}

test('service worker heeft een eigen cachenaam met klaverjas', () => {
  assert.match(sw, /const CACHE = 'klaverjas-v\d+';/);
  assert.match(sw, /startsWith\('klaverjas-'\)/);
});

test('elk bestand in de offline-lijst bestaat', () => {
  for (const b of lijst) {
    if (b === './') continue;
    assert.ok(fs.existsSync(path.join(root, b)), `ontbreekt: ${b}`);
  }
});

test('alle bestanden van de app staan in de offline-lijst', () => {
  for (const b of [...alleBestanden('src'), ...alleBestanden('assets'), 'index.html', 'manifest.json']) {
    assert.ok(lijst.includes(b), `niet offline beschikbaar: ${b}`);
  }
});

test('manifest: liggend, Nederlands, iconen bestaan', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.lang, 'nl');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(root, i.src)), i.src);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

test('localStorage-sleutels beginnen allemaal met klaverjas_', () => {
  const code = alleBestanden('src').filter((b) => b.endsWith('.js')).map((b) => fs.readFileSync(path.join(root, b), 'utf8')).join('\n');
  const sleutels = [...code.matchAll(/'(klaverjas[^']*)'/g)].map((m) => m[1]).filter((s) => !s.endsWith('.js'));
  assert.ok(sleutels.length >= 2);
  for (const s of sleutels) assert.ok(s.startsWith('klaverjas_'), s);
  // localStorage wordt alleen in opslag.js gebruikt, met de vaste sleutels daar.
  for (const b of alleBestanden('src').filter((x) => x.endsWith('.js') && !x.endsWith('opslag.js'))) {
    assert.equal(/localStorage\./.test(fs.readFileSync(path.join(root, b), 'utf8')), false, b);
  }
});
