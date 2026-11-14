# Fase 1: spelregels — wat ik gevonden en gebouwd heb

## Bronnen

De officiële pdf's waren vanuit de bouwomgeving niet te openen (netwerk geblokkeerd).
Ik heb gewerkt met wat zoekresultaten uit deze bronnen citeren:

- *Gouden Boekje* 1976, Nederlandse Klaverjas Federatie, Amsterdams systeem (hquist.home.xs4all.nl/Reglementen/GoudenBoekjeAmsterdams.pdf)
- Spelregels klaverjassen, Garsthuizen (garsthuizen.info)
- Pagat.com, Klaverjassen (Amsterdamse en Rotterdamse regels)
- Wikipedia (Klaverjas), Rotterdams Klaverjassen (soosgiessenburg.nl)

Een actueel wedstrijdreglement van de bond heb ik niet online gevonden.

## Geïmplementeerd

| Onderwerp | Regel |
|---|---|
| Troef | B 20, 9 14, A 11, 10 10, H 4, V 3, 8 0, 7 0 (rangorde B 9 A 10 H V 8 7) |
| Niet-troef | A 11, 10 10, H 4, V 3, B 2, 9/8/7 0 (rangorde A 10 H V B 9 8 7) |
| Laatste slag | +10, totaal 162 |
| Roem | driekaart 20, vierkaart 50, stuk 20 (los van reeks, dus 70 kan), vier boeren 200, vier A/10/H/V 100, vier 7/8/9 niets. Reeks in volgorde 7-8-9-10-B-V-H-A, één kleur. Roem gaat naar de winnaar van de slag. |
| Nat | Spelende partij moet méér hebben (punten + roem) dan de tegenpartij. Gelijk = nat. Tegenpartij krijgt 162 + alle roem van beide partijen. |
| Pit | Spelende partij haalt alle slagen: 100 roem extra. |
| Verzaken | Potje stopt meteen. Verzakers 0; tegenpartij 162 + 100 strafpunten + alle roem die al gemaakt is (Gouden Boekje). Totaal dus 262 + roem. |
| Bekennen | Altijd verplicht. |
| Troef gevraagd | Overtroeven als het kan (ook als je maat de slag heeft). Anders lagere troef. |
| Niet kunnen bekennen, Amsterdams | Heeft je maat de slag: niet hoeven troeven, maar ook niet ondertroeven tenzij je alleen lagere troeven hebt. Anders: troeven, en overtroeven als er al troef ligt. |
| Niet kunnen bekennen, Rotterdams | Altijd troeven en overtroeven, ook als je maat de slag heeft. |
| Ondertroeven | In beide systemen alleen als je niets anders hebt. |
| Draaien | Aparte geschudde stapel; links van de deler beginnen; gepaste kleuren overslaan; na 2 (of 3) rondes opnieuw delen. |
| Uitkomen | Speler links van de deler, los van wie speelt. Deler schuift per gespeeld potje door. |
| Partij | 16 potjes; rondgepaste potjes tellen niet mee. |

## Besluiten van Rutger

1. Verzaken: reglement volgen (262 + roem). Akkoord.
2. Vier boeren: 200.
3. Vier zevens/achten/negens: geen roem.
4. Pit door de tegenpartij: geen bonus; officieel is de spelende partij dan gewoon nat.
5. Ondertroefverbod in beide systemen: klopt.
6. Opnieuw delen door dezelfde deler.

## Tests

107 tests, `npm test` (of `node --test`). Bestanden in `tests/`:

- `kaarten.test.js` — deck, schudden, delen 3-2-3, teams
- `rangorde.test.js` — puntwaarden, rangorde troef/niet-troef, slagwinnaar
- `geldig.test.js` — 15 gevallen voor beide systemen, plus Amsterdams-specifiek (maat heeft slag, ondertroeven) en Rotterdams-specifiek
- `roem.test.js` — drie-/vierkaart, stuk, 70, vier gelijke, randgevallen
- `potje.test.js` — beurtvolgorde, pit, roem naar winnaar, nat (gelijkspel, roem telt mee), verzaken met en zonder bescherming, 300 willekeurige potjes (altijd 162)
- `draaien.test.js` — spelen/passen, overslaan van gepaste kleur, 2 en 3 rondes
- `partij.test.js` — instellingen, uitkomen los van wie speelt, hele partij van 16 potjes met rondpassen
