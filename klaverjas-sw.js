// Service worker van Klaverjas: netwerk eerst, cache als terugval (Rutgers vaste patroon).
// Alle apps van Rutger delen hetzelfde origin: deze worker raakt alleen caches die met 'klaverjas-' beginnen.

const CACHE = 'klaverjas-v59';

// Alles wat nodig is om offline te spelen, al bij de eerste keer openen opgeslagen.
const BESTANDEN = [
  './',
  'assets/geluid/deel.ogg',
  'assets/geluid/kaart-F.ogg',
  'assets/geluid/schudden.ogg',
  'assets/iconen/apple-touch-icon.png',
  'assets/iconen/icoon-192.png',
  'assets/iconen/icoon-512.png',
  'assets/iconen/icoon-maskeerbaar-512.png',
  'assets/kaarten/harten-B.webp',
  'assets/kaarten/harten-H.webp',
  'assets/kaarten/harten-V.webp',
  'assets/kaarten/klaveren-B.webp',
  'assets/kaarten/klaveren-H.webp',
  'assets/kaarten/klaveren-V.webp',
  'assets/kaarten/ruiten-B.webp',
  'assets/kaarten/ruiten-H.webp',
  'assets/kaarten/ruiten-V.webp',
  'assets/kaarten/schoppen-B.webp',
  'assets/kaarten/schoppen-H.webp',
  'assets/kaarten/schoppen-V.webp',
  'assets/lettertypen/inter-latin-400-normal.woff2',
  'assets/lettertypen/inter-latin-600-normal.woff2',
  'assets/lettertypen/inter-latin-700-normal.woff2',
  'assets/lettertypen/playfair-display-latin-600-normal.woff2',
  'assets/lettertypen/playfair-display-latin-700-normal.woff2',
  'index.html',
  'manifest.json',
  'src/ai/client.js',
  'src/ai/netwerk.js',
  'src/ai/simulatie.js',
  'src/ai/vergelijk.js',
  'src/ai/willekeurig.js',
  'src/ai/worker.js',
  'src/online/motor.js',
  'src/online/scherm.js',
  'src/online/tafel.js',
  'src/online/verbinding.js',
  'src/regels/draaien.js',
  'src/regels/geldig.js',
  'src/regels/index.js',
  'src/regels/kaarten.js',
  'src/regels/partij.js',
  'src/regels/potje.js',
  'src/regels/rangorde.js',
  'src/regels/rng.js',
  'src/regels/roem.js',
  'src/ui/app.js',
  'src/ui/geluid.js',
  'src/ui/kaart.css',
  'src/ui/kaart.js',
  'src/ui/leren.js',
  'src/ui/lessen.js',
  'src/ui/logboek.js',
  'src/ui/opslag.js',
  'src/ui/patch.js',
  'src/ui/plaatjes.js',
  'src/ui/statistiek.js',
  'src/ui/stijl.css',
  'src/ui/tafel.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 'reload': de bestanden echt van de server halen, niet uit de browsercache.
      .then((c) => c.addAll(BESTANDEN.map((b) => new Request(b, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('klaverjas-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Netwerk eerst: altijd de nieuwste versie als er internet is, anders de opgeslagen versie.
// 'no-cache' laat de browser bij de server controleren of er iets nieuws is, in plaats van
// tot 10 minuten een oude kopie te gebruiken (GitHub Pages staat dat toe).
self.addEventListener('fetch', (e) => {
  const verzoek = e.request;
  if (verzoek.method !== 'GET' || new URL(verzoek.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(new Request(verzoek.url, { cache: 'no-cache', credentials: 'same-origin' }))
      .then((antwoord) => {
        if (antwoord.ok) {
          const kopie = antwoord.clone();
          caches.open(CACHE).then((c) => c.put(verzoek, kopie));
        }
        return antwoord;
      })
      .catch(() => caches.match(verzoek, { ignoreSearch: true }).then((r) => r || caches.match('./'))),
  );
});
