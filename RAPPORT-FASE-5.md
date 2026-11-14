# Fase 5: seinen

## Afspraken (CLAUDE.md, aangevuld met Rutgers antwoorden)
Een sein is een kaart die wordt bijgespeeld op een slag die de maat op dat moment heeft, als er geen
troef gevraagd is en de kaart zelf geen troef is. Bekennen of afgooien maakt niet uit. Heeft de maat
ingetroefd, dan mag er ook geseind worden.
- 7, 8 of 9 → "ik heb de aas van deze kleur"
- aas → "ik heb ook de tien van deze kleur"
- 10, B, V, H → geen sein

## Zelf seinen
Bij het kiezen van een kaart krijgt een kaart die een **waar sein** geeft +3 punten voorkeur en een kaart
die een **vals sein** zou geven −40 punten afkeer (`SEIN_BONUS`, `SEIN_STRAF` in `src/ai/simulatie.js`).
De computer seint dus eerlijk, tenzij eerlijk spelen meer dan ±40 punten zou kosten of hij geen keus heeft.

Gemeten hoe vaak een herkend sein van de computer klopt (`ontwikkeling/seinstatistiek.mjs`):
- Met keus afgooien (kleintje of aas): 71–100%
- Met keus bekennen met een aas of kleintje: 50–100% (de uitzonderingen kostten eerlijk 40–70 punten)
- Gedwongen (alleen kleintjes van die kleur): 33–38%; zo'n kaart is dus geen echt sein

## Seinen lezen
Elk sein van een andere speler (maat, tegenstanders, ook Rutger) wordt gebruikt bij het trekken van
kaartverdelingen. Per verdeling wordt gekeken of het sein klopt:
- klopt het: gewicht 1;
- klopt het niet, maar had de seiner in die verdeling geen andere keus (bijv. alleen kleintjes): gewicht 1,
  want dan zegt de kaart niets;
- klopt het niet en had hij wel keus: gewicht 1/`SEIN_FACTOR`.

`SEIN_FACTOR` is instelbaar; gemeten tegen elkaar: 2 is slechter dan 4, 10 iets beter dan 4. Gekozen: **10**.

## Metingen (duplicaat-duels)
| Vergelijking | Potjes | Gemiddeld verschil per potje |
|---|---|---|
| Seinen lezen (factor 10) tegen niet lezen | ±2570 | +0,9 (geen meetbaar verschil) |
| Seinen geven tegen niet geven (beide teams lezen) | ±1900 | −3,3 (kleine prijs voor eerlijk seinen) |

Eerlijk: in duels tussen computers levert seinen weinig op. De AI haalt zijn kennis vooral uit wat wel
en niet bekend wordt; een sein voegt daar weinig aan toe. Voor Rutger als maat is het belangrijkste dat
de computer eerlijk seint, zodat hij de seinen kan lezen.

## Tests
`tests/ai.test.js`: herkennen van seinen (bekennen, afgooien, aas, geen sein bij 10/B/V/H, niet bij
troef gevraagd, wel bij ingetroefde maat, niet als uitkomer), eigen seinen tellen niet mee, gewicht bij
gedwongen en vrijwillige seinen, en de computer kiest een waar sein boven een vals sein.

---

## Aanvulling: afgooien en bekennen apart (na Rutgers voorbeeld)

Noord speelde ♠H op Rutgers ♠V in plaats van ♠8: ♠8 zou een vals sein ("ik heb ♠A") zijn geweest en
de straf daarvoor (40) woog zwaarder dan het verlies (de heer en 20 roem voor V-H-A).

Nu: straf voor een vals sein bij **afgooien 40**, bij **bekennen 15** (`SEIN_STRAF`, `SEIN_STRAF_BEKENNEN`).
Lezen: een kleintje/aas bij bekennen is hooguit een zwakke aanwijzing (gewicht 1/2 als het niet klopt).

Gemeten:
- Speelsterkte gelijk (alles 15 tegen alles 40: +0,1; gesplitst tegen alles 40: +0,1 punt per potje).
- Betrouwbaarheid: kleintje afgooien met keus 91% (grootste meting); bekennen met keus ±⅓ (een kleintje
  bij bekennen is vaak gewoon de juiste kaart).
- Lezen (factor 10) tegen niet lezen: −1,1 punt per potje, binnen het toeval.
