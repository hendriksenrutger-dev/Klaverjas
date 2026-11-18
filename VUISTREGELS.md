# Vuistregels — goedgekeurd door Rutger en ingebouwd

Bronnen: een paar Nederlandse tipspagina's (zie onderaan) en mijn eigen kennis van het spel.
Controleer vooral wat ik zelf heb aangevuld: jij bent de klaverjasser.

Legenda:
- ✅ zit al in de computer (via de berekening of als vuistregel)
- 🆕 nieuw voorstel (alle 🆕-regels zijn op Rutgers verzoek ingebouwd; schakelaars in `VUISTREGELS` in `src/ai/simulatie.js`)
- ❓ twijfel, graag jouw oordeel

Vuistregels beslissen alleen als kaarten in de berekening bijna even goed scoren
(zie CLAUDE.md). Elke nieuwe regel meet ik met de eerlijke duels voordat hij blijft.

## A. Spelen of passen

1. ✅ Speel met een sterke troefhand: boer en nel, of boer met twee andere troeven, of nel met aas en nog een troef. Bijkleur-azen tellen mee. (De computer rekent dit door; geen vaste regel.)
2. ❓ Speel niet met alleen lage troeven en geen boer of nel, ook niet met veel azen.

## B. Uitkomen als spelende partij

3. ✅ Trek troef als je sterk in troef bent: haal de troeven bij de tegenpartij weg.
3b. ✅ Doortrekken (Rutger: standaardstrategie, na Noords ♠7 terwijl hij met ♦A de laatste troef ♦7 eruit kon halen): als spelende partij met een troef die boven alle troeven buiten je hand zit, trek je door zolang er nog troef bij een ander kan zitten. Streng: alleen als een andere kaart minstens 40 punten beter scoort, wijkt de computer af. Gaat voor regel 24 (laatste troef bewaren). Ook met een troef die de slag verliest (Rutger): als je minstens zoveel troef hebt als er nog buiten je hand is en je nog 3 of meer mooie kaarten (azen, tienen, vrije kaarten) in een andere kleur hebt, trek je door met je laagste troef.
4. 🆕 Trek niet door als de tegenpartij geen troef meer kan hebben (tel de troeven). (Sinds Rutgers voorbeeld met Noords ♠V streng: alleen als elke andere kaart minstens 40 punten slechter is. Bewaar zo'n vrije troef voor later, met een beetje geluk de laatste slag.)
4b. ✅ (Rutgers voorbeeld: West trok met ♠7 terwijl alleen ♠8 nog buiten zat) Trek je troef en heb je een troef die boven alle troeven buiten je hand zit, trek dan daarmee.
5. 🆕 Na het troeftrekken eerst je vrije azen en tienen binnenhalen.
6. 🆕 Speel de kleur na waarin je maat geseind heeft.
7. ❓ "Thuisblijven": met een lage troef jagen op de troefboer, alleen als je zelf veel troef hebt.

## C. Uitkomen als tegenpartij

8. ✅ Niet met troef uitkomen. (Sinds Rutgers opmerking streng: alleen als elke andere kaart minstens 40 punten slechter is.)
9. 🆕 Uitkomen met een aas in een bijkleur is goed (geen plicht: Rutger vond ♠A of ♦8 allebei goed); voor de spelende partij: na het troeftrekken vrije azen en tienen innen (regel 5).
10. 🆕 Speel de kleur van je maat (sein of eerder gespeeld) na.
11. 🆕 Kom niet uit met een kale tien (een tien zonder de aas, terwijl de aas nog in het spel is).
11b. ✅ (Rutger, na Noords ♣10 met ♣H en ♣7 erbij) Kom ook niet uit met een gedekte tien als de aas nog bij een ander zit: houd hem achter, dan wordt hij misschien nog een slag of spek je hem bij je maat. Even streng als spekken (alleen als elke andere kaart minstens 20 punten slechter is). Regel 11 blijft daarnaast gelden.

## D. Uitkomen, altijd

12. ✅ (nieuw sinds vandaag) Let op roem: kies geen kaart waarmee de tegenpartij roem kan maken.
13. ✅ (nieuw sinds vandaag) Zonder de hoogste kaart van een kleur: uitkomen met de laagste kaart.

## E. Bijspelen

14. ✅ (nieuw sinds vandaag) Punten bijgooien alleen als je maat de slag al heeft.
14b. ✅ Niet spekken (Rutger, na Noords ♠A op ♣10 van West): een aas of tien bijgooien op een slag die je maat niet heeft en die je er zelf niet mee wint, alleen als elke andere kaart minstens 20 punten slechter scoort.
15. ✅ Heeft je maat de slag: geef punten (een tien of heer erbij); dat doet de berekening.
15b. ✅ (Rutger, na Oosts ♠10 op de ♥A van West terwijl hij ♠A had) Heb je aas en tien van dezelfde kleur en gaat de slag naar jullie: speel de aas. De tien wordt dan de hoogste kaart, het levert een punt meer op en het is een eerlijk sein. Vaste regel, geen marge.
16. 🆕 Troef niet over je maat heen als die de slag al heeft (Amsterdams; je hoeft niet).
17. 🆕 Tweede hand laag: kom je als tweede, speel dan laag, tenzij je de slag zeker kunt nemen.
18. 🆕 Derde hand hoog: help je maat door hoog bij te spelen als de vierde speler nog kan overnemen.
19. ✅ Laatste in de slag: win met de laagste kaart die genoeg is. (Sinds Rutgers potje met ♦9 ook als vaste vuistregel, omdat de berekening soms geen verschil zag.)
20. ✅ Gooi geen kaart weg die nog een slag kan worden (vrije kaart, of heer naast je eigen aas).
21. 🆕 Geef bij het bijspelen geen roem weg: maak geen reeks of stuk af op een slag van de tegenpartij.
21b. ✅ (Rutgers voorbeeld: Noord ♦7 bij de ♦9 van West, Oost maakte er met ♦8 een driekaart van) Leg geen roem klaar: speelt er na jou nog een tegenstander, leg dan geen kaart waarmee één kaart van hem roem maakt.
22. 🆕 Bescherm een tien: speel een tien niet bij zolang de aas van die kleur nog bij de tegenpartij kan zitten, tenzij je moet.

## F. Troef

23. ✅ (nieuw sinds vandaag) Troef gevraagd en je kunt niet overtroeven: de goedkoopste troef, en geen troef die nog een slag kan worden.
24. 🆕 Bewaar een lage troef voor de laatste slagen (de laatste slag is 10 punten waard).
25. ✅ Ondertroeven alleen als je niets anders hebt (spelregel).

## G. Seinen

26. ✅ Volgens onze afspraken (kleintje = aas, aas = tien), alleen op een slag van je maat en nooit bij troef gevraagd.

## Meting

Alle twaalf 🆕-regels samen, eerlijke duels, 4 × 400 delingen: zonder deze regels scoren de computers 0,7 punt per potje lager (foutmarge ± 1,3). Ze kosten dus niets. De ❓-regels (2 en 7) zijn niet ingebouwd.

## Bronnen

- [Klaverjassen Tips — Strategie voor Beginners (klaverjassenregels.nl)](https://klaverjassenregels.nl/strategie-tips/)
- [Kaartclub De Hoop — Tips & Trucs Klaverjassen](http://www.kaartclub-dehoop.nl/Onze-Kaartclub/Tips-Trucs-Klaverjassen/)
- [Stoomcursus (vipklaverjas.nl)](https://vipklaverjas.nl/blog/stoomcursus-vip-klaverjas/)
- [Alles over klaverjassen (josweb.nl)](http://josweb.nl/josweb/klaverjassen.htm)

Ik kon alleen de zoekresultaten van deze pagina's lezen, niet de volledige pagina's.
