# Fase 4: simulatie-AI — wat er gebouwd en gemeten is

## Hoe de computerspeler een kaart kiest
1. **Waarneming:** alleen eigen kaarten, gespeelde kaarten en het aantal kaarten per speler.
   De andere handen gaan nooit naar de AI-worker.
2. **Uitsluitingen:** uit eerdere zetten volgt wat iemand zeker niet heeft. Een kaart valt af
   als de gespeelde kaart niet had gemogen wanneer die speler hem wel had gehad. Zo volgt
   vanzelf: niet bekend → kleur weg; niet overtroefd terwijl het moest → hogere troeven weg;
   Amsterdams afgooien bij de maat → zegt niets over troef. Dit gebruikt dezelfde spelregels als het spel.
3. **Verdelingen trekken:** de onbekende kaarten worden willekeurig verdeeld, passend bij de uitsluitingen.
4. **Uitspelen:** per geldige kaart wordt het potje uitgespeeld met een snelle eenvoudige strategie
   (azen uitkomen, spelende partij trekt troef met de boer, punten bijgooien als de maat de slag
   zeker heeft, goedkoopst winnen als laatste, anders laag bijlopen).
5. **Kiezen:** de kaart met het hoogste gemiddelde verschil (wij − zij, punten + roem, nat en pit meegeteld).

Spelen of passen: de hand wordt vaak uitgespeeld met de voorgestelde troef (andere handen willekeurig).
Spelen als het verwachte verschil boven de drempel ligt.

## Metingen (computerteams tegen elkaar, elke deling twee keer met de teams omgewisseld)
| Vergelijking | Gemiddeld verschil per potje |
|---|---|
| 60 simulaties tegen willekeurige speler | +116 |
| 2 tegen 60 simulaties | −34 |
| 5 tegen 60 | −19 |
| 15 tegen 60 | −6 |
| 200 tegen 60 | +3 (binnen het toeval) |
| 600 tegen 200 | −5 (binnen het toeval) |

Boven ongeveer 60 simulaties wordt de AI nauwelijks sterker. De beperking zit in de eenvoudige
speelstrategie tijdens het uitspelen, niet in het aantal simulaties.

Drempel voor spelen (tegen drempel 10): −20 → −1,5; 0 → −3,8; 25 → −3,3; 40 → −9,3.
Gekozen: **10**. Daarmee speelt de AI ongeveer de helft van de potjes en gaat hij in ±12% daarvan nat.

## Snelheid (op de bouwserver; de tablet is naar schatting 3 tot 5 keer trager)
| Niveau | Simulaties | Gemiddeld per zet | Langste zet |
|---|---|---|---|
| Makkelijk | 5 | 0,7 ms | 9 ms |
| Normaal | 100 | 3,5 ms | 32 ms |
| Sterk | 400 | 12 ms | 88 ms |

Spelen of passen: ±5 ms. Ruim onder het doel van 1 seconde. De computerspelers "denken"
zichtbaar 0,5 tot 1 seconde.

## Voorstel niveaus (nog af te stemmen met Rutger)
Makkelijk 5, normaal 100, sterk 400 simulaties per zet. Makkelijk is merkbaar zwakker;
sterk is met de huidige speelstrategie nauwelijks sterker dan normaal.

## Tests
`tests/ai.test.js` (12 tests): waarneming zonder andermans kaarten, uitsluitingen (niet bekennen,
niet overtroeven, Amsterdams/Rotterdams verschil), verdelingen altijd passend, altijd een geldige
kaart (computerspelers verzaken nooit), de AI kiest de kaart met de beste score, goedkoopst
troeven als laatste, en spelen/passen bij een sterke en een zwakke hand.

`ontwikkeling/duel.mjs` laat computerteams tegen elkaar spelen om instellingen te vergelijken.


---

# Aanvulling: slimmere AI (op verzoek van Rutger)

## Wat er bij kwam
1. **Slimme speelstrategie in de simulaties.** Binnen een simulatie liggen alle kaarten open, dus de
   strategie kan zien welke kaart de baas is, of een slag zeker binnen is, of de tegenpartij kan
   introeven en of een kaart roem maakt. Regels o.a.: spelende partij trekt troef met een baastroef;
   baaskaarten uitkomen als niemand kan introeven; laag naar de kleur waarin de maat de baas heeft;
   punten en roem bijgooien als de maat de slag zeker heeft (zonder goede troef te verspillen);
   zeker winnen met punten uit een bijkleur of met de laagste troef; geen roem weggeven.
2. **Eindspel exact:** de laatste 3 slagen worden per verdeling volledig doorgerekend (alfa-bèta).

## Metingen (duplicaat-duels, telkens 300–650 potjes)
| Vergelijking | Gemiddeld verschil per potje |
|---|---|
| Nieuw kaartspel tegen oud | **+8** (twee runs: +10,1 en +5,8) |
| Nieuwe beoordeling spelen/passen tegen oud | +3 (binnen het toeval, niet slechter) |
| 300 tegen 100 simulaties (nieuw) | −1 (geen verschil) |
| 4 tegen 3 slagen exact | +2 (geen meetbaar verschil, wel trager) |
| AI die alle kaarten ziet tegen normaal | +17 (bovengrens van wat met deze aanpak te halen is) |
| Makkelijk tegen normaal | **−28** |

## Niveaus (voorstel)
| Niveau | Instelling | Gemiddeld / langste zet (server) |
|---|---|---|
| Makkelijk | 5 simulaties, eenvoudige strategie | 0,5 / 11 ms |
| Normaal | 100 simulaties, slimme strategie, laatste 3 slagen exact | 9 / 70 ms |
| Sterk | 300 simulaties, slimme strategie, laatste 3 slagen exact | 24 / 147 ms |

Sterk is in de metingen niet beter dan normaal. Verder sterker maken vraagt een andere aanpak
(bijvoorbeeld zoeken over wat spelers wel en niet weten) en de seinen uit fase 5 helpen ook.

`ontwikkeling/verloop.mjs` toont een potje zet voor zet met de scores per kaart, om de keuzes te beoordelen.

---

# Aanvulling: troef trekken (na Rutgers test)

Rutger zag dat de maat troef liet zitten terwijl Oost nog hoge troef had.

**Oorzaak:** in de simulaties kennen alle spelers elkaars kaarten. Troef trekken lijkt daar "altijd
later nog te kunnen" en wordt daardoor te weinig gekozen (bekende zwakte van deze methode).
Gemeten: als de spelende partij uitkomt met ≥3 troeven en de tegenpartij nog troef heeft, trok de AI
in 75–80% van de gevallen troef, maar soms niet terwijl hij de hoogste troef had.

**Geprobeerd:**
1. Ruimere trek-vuistregel in de simulaties (ook zonder baastroef trekken bij meer troef): geen meetbaar
   verschil (−0,4 en −0,75 punt per potje over ±1900 potjes) en vaker nat door te optimistisch spelen →
   niet gebruikt.
2. Voorkeur voor troef uitkomen in de uiteindelijke keuze (`TREK_BONUS`): volle voorkeur voor de hoogste
   troef die nog in het spel is, halve voorkeur voor een lage troef als de speler minstens zoveel troeven
   heeft als er nog elders zijn. Gemeten tegen geen voorkeur (±1250 potjes per waarde):
   voorkeur 10 → −1,0; voorkeur 20 → +0,5 punt per potje. Geen meetbaar verschil in sterkte.

**Gekozen:** voorkeur 10. Niet sterker of zwakker in duels, maar speelt natuurlijker: met de hoogste
troef trekt de spelende partij nu troef zolang de tegenpartij nog troef kan hebben. Zonder hoogste troef
(bijv. ♣A ♣10 tegen ♣B bij de tegenpartij) blijft het een rekenkundige afweging.

`ontwikkeling/troefstatistiek.mjs` toont hoe vaak er getrokken wordt, met voorbeelden.

---

# Aanvulling: wat het draaien verraadt (na Rutgers voorbeeld)

Oost kwam als tegenpartij uit met troef (♥8), terwijl Noord harten had gekozen. De AI vond ♥8 en ♠A
even goed (beide ±+13), want hij nam niet mee dat **wie troef kiest meestal sterke troef heeft**.
Bij echt uitspelen was ♠A ±27 punten beter.

Nu: het potje onthoudt wie troef koos (`kiezer`). Bij het trekken van kaartverdelingen weegt de AI
mee hoe waarschijnlijk die verdeling is gezien het draaien: de kiezer had waarschijnlijk sterke troef,
wie vóór hem op die kleur paste waarschijnlijk niet. De kansen (`SPEELKANS`) zijn gemeten met
`ontwikkeling/draaitabel.mjs` over 6000 handen, bijvoorbeeld: 3 troeven met boer → 56% spelen,
met boer en negen → 92%, zonder boer of negen → 3%.

Resultaat in het voorbeeld: Oosts schatting ±−60 (echt uitgespeeld −85 tot −112), troef uitkomen niet
meer de voorkeur. In duels (±1900 potjes): +0,4 punt per potje, geen meetbaar verschil in sterkte.
Snelheid gelijk (normaal gemiddeld 9 ms per zet op de bouwserver).
