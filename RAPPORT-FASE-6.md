# Fase 6: instellingen, opslaan, PWA en offline

## Instellingen (tandwiel rechtsboven)
- Spelregels: Amsterdams (standaard) of Rotterdams — vanaf het volgende potje
- Opnieuw delen na 2 (standaard) of 3 rondes passen — vanaf het volgende potje
- Verzaakbescherming: aan (standaard) of uit — meteen
- Computerspelers: makkelijk, normaal (standaard), sterk — meteen
- Namen van links, maat en rechts (standaard West, Noord, Oost) — meteen

Zolang de instellingen of het menu openstaan, wacht het spel.

## Opslaan
- `localStorage`, alleen sleutels `klaverjas_instellingen` en `klaverjas_partij` (gecontroleerd door een test).
- De partij wordt na elke zet bewaard en bij het openen hervat, precies waar hij was.
  Getest: na herladen dezelfde hand, hetzelfde potje en dezelfde stand.
- Lukt opslaan niet (bijv. privévenster), dan speelt het spel gewoon door.

## PWA en offline
- `manifest.json`: naam Klaverjas, liggend, volledig scherm, eigen icoon (ook "maskable" voor Android).
- `klaverjas-sw.js`: service worker met netwerk eerst en de cache als terugval (Rutgers patroon).
  Cache `klaverjas-v1`; bij een nieuwe versie worden alleen oude `klaverjas-`-caches opgeruimd,
  nooit die van andere apps op hetzelfde origin. De naam van de service worker bevat ook "klaverjas".
- Alle 44 bestanden worden bij de eerste keer openen opgeslagen. Een test controleert dat elk bestand
  van de app in die lijst staat.
- Getest in de browser: na het uitzetten van het netwerk laadt de app volledig, met plaatjes,
  lettertypen en de computerspelers.

Let op: verander je later bestanden, verhoog dan `CACHE` in `klaverjas-sw.js` (bijv. naar `klaverjas-v2`).
Door "netwerk eerst" krijgt Rutger nieuwe versies ook zonder die verhoging, zolang hij online is.
