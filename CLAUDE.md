# Klaverjas — projectafspraken

Dit bestand bevat alle afspraken voor deze app, gemaakt met Rutger voordat er gebouwd werd. Lees het helemaal voordat je iets bouwt. Staat iets er niet in of is het onduidelijk: **vraag het Rutger, vul niets zelf in.**

## Werkwijze met Rutger

- Communiceer in het Nederlands. Direct en helder, geen wollige taal.
- Rutger is geen ontwikkelaar, maar wel technisch betrokken. Leg keuzes kort uit in gewone taal.
- Bouw alleen wat in dit bestand staat. Ideeën voor extra's: voorstellen, niet bouwen.
- Zeg eerlijk wanneer iets een eigen keuze of aanname is, en wanneer iets nog niet getest is.
- Werk in de bouwvolgorde hieronder. Laat na elke fase zien wat er werkt, en wacht op akkoord voordat je de volgende fase begint.
- Commit regelmatig met korte Nederlandse commitberichten.

## Wat het is

Een reclamevrije klaverjas-app (PWA) waarin Rutger solo speelt tegen drie computerspelers: één maat en twee tegenstanders. Alles draait offline op het apparaat. Geen server, geen account, geen Supabase.

- **Apparaat:** OnePlus Pad 2 (Android-tablet), **liggend**. Staand hoeft niet goed te werken. Toon dan een melding "Draai je tablet".
- **Taal van de app:** Nederlands.
- **Hosting:** GitHub Pages (openbare repository).

## Techniek

- Gewone HTML, CSS en JavaScript (ES-modules). Geen framework, geen bouwstap, zodat GitHub Pages het direct kan serveren.
- Rutger gebruikt bij andere apps één `index.html`. Dit project is groter: werk met losse modules. Dat is een bewuste afwijking.
- Voorgestelde mappen (mag je verbeteren, meld het dan):
  - `index.html`, `manifest.json`, `klaverjas-sw.js` (service worker, naam met klaverjas)
  - `src/regels/`: spelregels, puur en zonder DOM, volledig getest
  - `src/ai/`: computerspelers, draait in een Web Worker
  - `src/ui/`: speeltafel en schermen
  - `assets/kaarten/`: plaatjes van heer, vrouw en boer
  - `tests/`
- **Tests:** de spelregels krijgen uitgebreide tests (`node --test`). Is Node niet geïnstalleerd? Vraag Rutger eerst of hij Node LTS wil installeren. Installeer niets zonder toestemming.
- **PWA:** manifest en service worker met een network-first-strategie (Rutgers vaste patroon), offline speelbaar, installeerbaar op het startscherm.
- **Opslag:** alle Rutgers GitHub Pages-apps delen hetzelfde origin. Gebruik daarom alleen localStorage-sleutels met het voorvoegsel `klaverjas_` en geef de service worker en cache unieke namen met `klaverjas`. Een lopende partij en de instellingen blijven bewaard als de app sluit.

## Spelregels

**Basis: het officiële Amsterdamse reglement van de Klaverjasbond (wedstrijdreglement, Amsterdams systeem).** Zoek dat reglement op en volg het voor alles wat hieronder niet expliciet anders staat. Leg twijfelgevallen voor aan Rutger.

- 32 kaarten (7 tot en met aas), 4 spelers, 2 teams (jij en je maat tegenover elkaar).
- Een partij is **16 potjes**.
- 162 punten per potje (152 + 10 voor de laatste slag), plus roem.
- Rangorde en puntwaarden van troef en niet-troef volgens het reglement.
- **Roem:** driekaart 20, vierkaart 50, stuk (heer + vrouw van troef) 20, en vier gelijke kaarten volgens het reglement. Stuk en reeksen tellen apart. Een vierkaart in troef met heer en vrouw is dus 50 + 20 = 70. Rutger kent die 70 als regel, dus dit moet zo werken.
- **Nat en pit:** precieze telling volgens het reglement. Zoek op, implementeer en meld wat je gevonden hebt.

### Amsterdams en Rotterdams

- **Standaard Amsterdams.** Rotterdams is een instelling.
- Het verschil zit in de verplichting om te troeven en over te troeven als je niet kunt bekennen: bij Amsterdams hoeft dat niet als je maat de slag al heeft. Implementeer beide precies volgens het reglement, inclusief ondertroeven, met tests voor elk geval.

### Troef bepalen (draaien)

1. Er is een **aparte stapel** (een tweede, geschud kaartspel). De bovenste kaart wordt gedraaid. Die kleur is de voorgestelde troef.
2. Om de beurt, te beginnen bij de speler links van de deler, kiest iedereen **spelen** of **passen**. Wie speelt, maakt die kleur troef. Zijn team is de spelende partij.
3. **Past iedereen,** dan wordt de volgende kaart gedraaid. **Een kleur waarop al gepast is, telt niet en wordt overgeslagen.** Er wordt doorgedraaid tot er een nieuwe kleur verschijnt. Twee keer klaveren is dus één ronde.
4. Na **2 rondes** waarin iedereen past, wordt opnieuw gedeeld. Dit is een instelling: **2 (standaard) of 3**.
5. Na rondpassen deelt **dezelfde deler** opnieuw. Het potje telt niet mee.
6. **Instelling troefkeuze: traditioneel (standaard, zoals hierboven) of verplicht** (op Rutgers verzoek). Verplicht: er wordt niet gedraaid; de voorhand (links van de deler, die ook uitkomt) kiest zelf een troefkleur en moet spelen. De computer kiest de kleur met de beste verwachte uitkomst.

### Uitkomen

- Het uitkomen gaat per potje de tafel rond, **los van wie er speelt**.

### Verzaken

- Instelling **verzaakbescherming**, **standaard aan**: alleen geldige kaarten zijn speelbaar. Ongeldige kaarten worden **niet** grijs (Rutger kent de regels); tikt hij er een aan, dan schudt de kaart kort.
- **Uit:** elke kaart is speelbaar. Bij een ongeldige kaart:
  - De app ziet dat **direct** en toont een duidelijke melding.
  - **Het potje stopt meteen.**
  - De tegenpartij krijgt alle punten en alle roem. Controleer de precieze straf in het reglement.
- **Computerspelers verzaken nooit.**

### Seinen (Rutgers afspraken, niet uit het reglement)

- Seinen gebeurt alleen door **bij te spelen op een slag die je maat al heeft**, en **nooit met of bij troef**.
  - Afgestemd met Rutger: het geldt **ook bij bekennen** (bijv. maat speelt ♣H en heeft de slag, jij legt ♣7 bij = "ik heb ♣A").
  - "Bij troef" betekent: als **troef gevraagd** is. Heeft je maat een andere kleur **ingetroefd** en daarmee de slag, dan mag je wel seinen.
  - **Uitzondering (Rutgers besluit, na het potje met ♠B van Noord):** trekt je maat **zelf troef** (hij komt uit met troef) en heeft hij de slag, dan is afgooien wél een sein. Troef gevraagd door de tegenpartij blijft zonder sein, ook als je maat overtroeft.
- **Kleintje (7, 8 of 9) bijspelen:** "ik heb de aas van deze kleur".
- **Aas bijspelen:** "ik heb ook de tien van deze kleur".
- **Tien, boer, vrouw of heer bijspelen:** geen sein. Een tien is gewoon punten geven aan je maat.
- Een kleintje kan ook gespeeld zijn omdat iemand niets anders had. **Een sein is een sterke aanwijzing, geen zekerheid.**
- Kleintje boer en andere seinsystemen: niet gebruiken.
- **Uitwerking in de AI (na Rutgers voorbeeld ♠H i.p.v. ♠8):** bij **afgooien** vermijden de computers een vals sein sterk (betrouwbaar sein). Bij **bekennen** maar licht: daar is een kleintje vaak gewoon de verstandige kaart, dus een kleintje bij bekennen is hooguit een zwakke aanwijzing. Zo lezen de computers het ook.

## Computerspelers (AI)

- **Methode:** Monte Carlo-simulatie met bepaalde kaartverdelingen (determinization / PIMC). Per zet:
  1. Trek veel keren een willekeurige verdeling van de onbekende kaarten die past bij alles wat bekend is: gespeelde kaarten, en wie een kleur niet kon bekennen of niet kon troeven.
  2. Speel per geldige kaart het potje uit, met een snelle eenvoudige speelstrategie of een kleine zoekdiepte.
  3. Kies de kaart met het beste gemiddelde resultaat: punten plus roem, met nat en pit meegerekend.
- **Seinen in de simulatie:** verdelingen waarin een sein klopt krijgen een hoger gewicht, maar niet 100%. Dit is een eigen ontwerpkeuze, niet beproefd. Maak de factor instelbaar in de code, zodat hij na testen bij te stellen is.
- **Tien-uitkomst lezen** (Rutgers regel: niemand komt uit met een tien zonder de aas): komt een ander uit met een tien (geen troef) en is de aas nog onbekend, dan tellen verdelingen waarin hij die aas niet heeft 4 keer minder mee (`TIEN_FACTOR`, eigen ontwerpkeuze).
- **Zelf seinen:** de computerspelers seinen volgens de afspraken hierboven, zodat Rutger als maat de seinen kan lezen.
- **Vuistregels bij bijna gelijke kaarten** (na Rutgers voorbeelden): scoren kaarten in de simulatie bijna gelijk, dan beslist een menselijke vuistregel: als tegenpartij niet met troef uitkomen, en bij afgooien geen kaart weggooien die nog een slag kan worden (een vrije kaart, of een gedekte kaart zoals een heer naast je eigen aas), op een slag die je er niet mee wint. Gemeten met de eerlijke duelmethode (`ontwikkeling/bovengrens.mjs`): kost niets (0 ± 1,4 punt per potje). Later toegevoegd, ook uit Rutgers voorbeelden: **uitkomen** (let op roem; zonder de hoogste kaart van een kleur de laagste kaart die geen roem kan geven), **punten bijgooien alleen als je maat de slag al heeft**, en **troef gevraagd zonder overtroeven**: de goedkoopste troef en geen troef die nog een slag kan worden. Gemeten: −0,7 ± 2 punt per potje, niet te onderscheiden van toeval. Daarna de volledige lijst uit `VUISTREGELS.md` (goedgekeurd door Rutger; o.a. tweede hand laag, derde hand hoog, niet over je maat heen troeven, geen roem weggeven, tien beschermen, laatste troef bewaren, kleur van je maat naspelen). Gemeten: +0,7 ± 1,3 punt per potje. Daarna (Rutgers voorbeeld West ♠7): **troef trekken met een troef die zeker wint** als je die hebt. En **niet spekken** (Rutgers eis, strenger dan de andere regels): een aas of tien bijgooien op een slag die je maat niet heeft en die je er zelf niet mee wint, alleen als elke andere kaart minstens 20 punten slechter scoort (`SPEK_MARGE`); een kaart die zelf roem weggeeft telt daarbij niet als alternatief (Rutgers voorbeeld Noord ♦B bij ♦V ♦H). En **niet uitkomen met een tien zonder de aas** (Rutgers regel, ook als de tien gedekt is; even streng als spekken, `TIEN_UIT_MARGE` 20; de kale-tienregel blijft daarnaast gelden). En **doortrekken** (Rutgers standaardstrategie): als spelende partij met de hoogste troef doortrekken zolang er nog troef bij een ander kan zitten, en ook met je laagste troef als je minstens zoveel troef hebt als er nog buiten is en 3 of meer mooie kaarten (azen, tienen, vrije kaarten) in een andere kleur; alleen afwijken als een andere kaart minstens 40 punten beter scoort (`TREK_MARGE`). En **als tegenpartij niet met troef uitkomen** (Rutger: streng, `TROEF_UIT_MARGE` 40). En **geen troef uitkomen als niemand anders nog troef heeft** (Rutgers voorbeeld Noord ♠V: bewaar die vrije troef; streng, `TROEF_BEWAAR_MARGE` 40). En **aas voor tien** (Rutger): heb je aas en tien van dezelfde kleur en gaat de slag naar jullie, dan speel je de aas (vaste regel). En **geen roem klaarleggen** (Rutgers voorbeeld Noord ♦7 bij ♦9): speelt er na je nog een tegenstander, dan geen kaart waarmee één kaart van hem roem maakt. Alleen als een andere kaart duidelijk beter is, wijkt de computer daarvan af. Eigen ontwerpkeuze; de marge staat instelbaar in de code.
- **Eerst grof, dan exact (optie A, op Rutgers verzoek):** zijn er nog 5 slagen of minder te spelen, dan rekent de computer zijn beste kandidaten (tot 4, plus de kaart om door te trekken) exact door in 40 verdelingen (normaal: 3 kaarten, 24 verdelingen). De zetten van de computerspelers worden verdeeld over maximaal 4 workers tegelijk (één rekenkern blijft vrij). Optie B (een getraind netwerk) is bewaard voor later.
- **Snelle speelstijl in de berekening** (na Rutgers potje met ♦9): de maat gooit daarin geen vrije kaart (zoals een aas die zeker wint) weg op een slag die zijn maat al heeft (`SLIM_OPTIES.baasHouden`).
- **Spelen of passen bij het draaien:** ook via simulatie. Speel de hand met deze troef vaak uit en speel als de verwachte uitkomst boven een drempel ligt.
- **Moeilijkheidsniveau** (instelling): makkelijk (5 simulaties, eenvoudige strategie), normaal (100, slimme strategie, laatste 3 slagen exact) en sterk (300). Akkoord van Rutger.
- Draai de AI in een **Web Worker** zodat het scherm niet hapert. Doel: minder dan ongeveer 1 seconde per zet op de tablet.
- Laat de computerspelers kort "nadenken" zodat je kunt volgen wat er gebeurt. Na Rutgers test op de tablet ingekort tot ongeveer 0,35 tot 0,65 seconde (het voelde traag).

## Instellingen

- Amsterdams (standaard) of Rotterdams
- Troefkeuze traditioneel (standaard) of verplicht
- Opnieuw delen na 2 (standaard) of 3 rondes passen
- Verzaakbescherming aan (standaard) of uit
- Moeilijkheid van de computerspelers: makkelijk, normaal (standaard), sterk (afgestemd met Rutger, zie RAPPORT-FASE-4.md)
- Geluid aan (standaard) of uit
- Vergelijk met de computer aan of uit (standaard uit, op Rutgers verzoek): na elk potje per kaart van jou wat de computer (niveau sterk, met alleen jouw kennis) had gespeeld en het verschil in punten, plus spelen/passen en een totaal over de partij. Bij een verschil kleiner dan 10 punten: "even goed" (na Rutgers voorbeeld; kleinere verschillen zijn niet betrouwbaar). Het getal is een gemiddelde schatting vooraf, geen uitslag achteraf. Altijd met "volgens de computer".
- Overzicht gespeelde kaarten aan of uit (standaard uit, op Rutgers verzoek): uit = zelf onthouden, zoals aan tafel. De computer onthoudt wel alles, net als een goede speler.
- Namen van de spelers (standaard Zuid, West, Noord, Oost)

## Statistieken (op Rutgers verzoek)

- Vanaf het beginscherm: knop "Statistieken". Apart voor Amsterdams en Rotterdams (tabbladen; een potje telt bij het systeem waarmee het gespeeld is), niet per niveau (Rutger speelt alleen op sterk). Alleen op het apparaat bewaard (`klaverjas_statistiek`), met een knop "Alles wissen" (twee keer tikken). De cijfers van vóór de splitsing zijn bij Rotterdams gezet (Rutger speelde toen Rotterdams).
- Partijen: gespeeld, gewonnen (%), verloren, op rij gewonnen en record, hoogste en laagste eindstand, grootste overwinning.
- Potjes: gespeeld; wij speelden en zij speelden, elk met gehaald, nat en pit; gemiddeld per potje en roem (wij – zij); en met "Vergelijk met de computer" aan: hoe vaak je speelde zoals de computer of even goed.

## Logboek (op Rutgers verzoek)

- Elk afgelopen potje van een gewone partij wordt op het apparaat vastgelegd (`klaverjas_logboek`, `src/ui/logboek.js`): gedeelde handen, het draaien, alle slagen, uitslag, de stand vóór het potje en instellingen. Oefenpartijen niet. Maximaal 2000 potjes (ongeveer 2 MB); daarna vallen de oudste eraf.
- In het venster Statistieken: het aantal vastgelegde potjes en een knop "Exporteren" (een JSON-bestand, via delen of downloaden). "Alles wissen" wist het logboek niet.
- Doel: later van Rutgers partijen leren. Analyse en nadoen zijn nog niet gebouwd.

## Leren klaverjassen (op Rutgers verzoek, uit "Later" naar voren gehaald)

Afgesproken met Rutger: in deze app, met een knop "Leren klaverjassen" op het beginscherm. De leerling leert Amsterdams met traditioneel draaien; Rotterdams komt als losse les aan het eind. Seinen (volgens onze afspraken) horen erbij. Lesteksten schrijft Claude, Rutger controleert ze. Toon: volwassen, kort en helder.

Leerpad in vijf stappen. Een stap gaat open na 4 gespeelde potjes in de vorige stap; teruggaan kan altijd.

1. **Lessen** (tekst goedgekeurd door Rutger, zie `LESSEN.md`; inhoud in `src/ui/lessen.js`): zeven korte lessen met uitleg en opdrachten aan tafel (kaart aantikken of antwoord kiezen; fout geeft uitleg, opnieuw proberen). Volgorde: kaartwaarden en troefvolgorde → bekennen → troeven → roem → spelen of passen, nat en pit → seinen → Rotterdams. Stap 2 gaat open als alle lessen klaar zijn; lessen blijven later opnieuw te doen.
2. **Oefenen met open kaarten:** alle handen zichtbaar, tegenstanders makkelijk, hulp aan, hint-knop.
3. **Oefenen met dichte kaarten:** tegenstanders makkelijk, hulp aan, hint-knop.
4. **Zelfstandig:** tegenstanders normaal, hulp uit, hint-knop.
5. **Echt:** tegenstanders sterk, geen hulp.

- **Hulp:** uitleg waarom een kaart niet mag (dezelfde teksten als de spelregels), uitleg bij roem, en een melding bij een sein van je maat met wat het betekent.
- **Tweede kans** (stap 2 en 3, op Rutgers verzoek): kies je bij spelen/passen iets anders dan de computer, of een kaart die volgens de computer duidelijk slechter is (10 punten of meer), dan verschijnt eerst een venster met uitleg en de knoppen "Opnieuw kiezen" en "Toch …". Kies je daarna opnieuw hetzelfde, dan gaat het spel gewoon door. De computer rekent al mee zodra jij aan de beurt bent.
- **Hint-knop:** de computer kiest de kaart (of spelen/passen); de uitleg komt uit vaste regels. Past geen regel, dan alleen "deze kaart levert gemiddeld de meeste punten op". Geen verzonnen uitleg.
- Oefenpartijen staan los van de gewone partij (eigen opslag `klaverjas_leerpartij`, voortgang in `klaverjas_leren`) en tellen niet mee in de statistieken. Regels in de oefenstand: Amsterdams, traditioneel, verzaakbescherming aan.

## Uiterlijk

Rutger heeft een ontwerp goedgekeurd: groen laken, tablet liggend. Hij wil het **mooi**.

- **Tafel:** groen laken met een zachte radiale verlichting in het midden (#2E8A5C naar #227049 naar #164F33) en een dunne lichte ovale lijn op de tafel.
- **Bovenbalk** (half doorzichtig donker): menuknop met een huisje links. In het midden de score van Wij (in goud #E8C873) en Zij (wit), en het potje "9 / 16". Rechts een crèmekleurig troeflabel met een rond symbool van de troefkleur en de tekst "Troef · Schoppen · wij spelen", en een knop voor instellingen.
- **Linksboven, onder de balk:** een paneel "Dit potje" met de punten en roem van Wij en Zij in het lopende potje.
- **Spelers:** de maat boven (Noord), de tegenstanders links (West) en rechts (Oost). Zuid ben jij en wordt **niet** op de tafel getoond. Elke computerspeler heeft een rond avatar met een initiaal (geen foto's) en een naam, met als rol "Jouw maat · computer" of "Tegenstander". Een gouden label "Speelt" bij de spelende speler.
- **Namen:** standaard de windrichtingen Zuid, West, Noord en Oost. Echte namen kunnen geven is een instelling.
- **Geluid:** kaart spelen (variant F, gekozen door Rutger), schudden en delen: echte opnames uit Kenney Casino Audio (CC0), bewerkt zonder lage tonen; zie `assets/geluid/LICENSE.md`.
- **Slag op tafel:** de kaarten liggen licht gedraaid op hun plek, in een kruis, **zonder over elkaar te liggen**. Op jouw plek staat een gestippeld vak met "Jouw kaart".
- **Roemmelding:** een goudkleurig label met een ster, bijvoorbeeld "Driekaart · 20 roem".
- **Hint onder de tafel:** kort, zonder uitleg van de regels (Rutger kent ze): "Jouw beurt", "Tik nog een keer om te spelen", "Deze slag is voor West".
- **Naam van de app:** "Klaverjassen" (titel op het beginscherm, naam op het startscherm van de tablet). Geen regel met instellingen onder de titel (Rutgers keuze).
- **Beginscherm:** bij het openen eerst een beginscherm met "Verder spelen" (met potje en stand), "Nieuwe partij" en "Instellingen". Het huisje in de bovenbalk gaat terug naar het beginscherm; het spel wacht dan. Na de laatste partij staat naast "Nieuwe partij" ook een knop "Beginscherm".
- **Indeling:** alle maten volgen de echte schermhoogte (ook in Chrome met adresbalk). Kaarten liggen nooit onder tekst door; niets overlapt.
- **Telefoon liggend** (op Rutgers verzoek, voor online spelen met familie): bij een schermhoogte onder 500 beeldpunten een compacte opmaak (kleinere balk, spelers en knoppen, geen groot troefsymbool want de troef staat in de balk, "Laatste slag" naast de hand). Op de tablet verandert niets.
- **Hand:** acht kaarten plat naast elkaar onderaan, zonder grijze kaarten. **Spelen gaat met twee tikken:** de eerste tik tilt de kaart op, de tweede speelt hem.
- **Troef draaien:** in het midden een rond crème schijfje met de voorgestelde troefkleur, groot. Op de plek van elke speler verschijnt zijn keuze als tekstballon die even ploft, rustig na elkaar: "…" (denkt na), "Ik pas" (donker met gouden rand) of "Ik speel ♥" (goud). Jouw knoppen Spelen/Passen staan op jouw plek. Onder de tafel: "Noord speelt · troef harten" of "Iedereen past". Computers denken bij spelen/passen ongeveer 0,6 tot 0,9 seconde; na een keuze ±1,8 s (spelen) of ±1,1 s (iedereen past) voordat het verdergaat (na Rutgers test sneller gemaakt). De ballonnen van West en Oost staan halverwege de schijf en de speler.
- **Schudden en delen:** eerst het schudgeluid met de stapel in het midden, daarna vliegen de kaarten in pakjes van 3-2-3 naar de spelers, met bij elk pakje een tikje.
- **Uitslag:** bij alle slagen voor de spelende partij gewoon "Pit!".
- **Na een potje:** de knop "Alle slagen" (op Rutgers verzoek één venster met alle acht slagen, vier per rij, zonder scrollen: per slag de kaarten, winnaar, punten en roem, en het vergelijk-label onder jouw kaart) en de knop "Alle handen": de vier handen zoals ze gedeeld waren, rond de tafel.
- **Gespeelde kaart:** schuift volledig zichtbaar vanaf de kant van de speler op zijn plek (geen infade). Het scherm wordt niet steeds helemaal opnieuw getekend: bestaande kaarten blijven staan (`src/ui/patch.js`), zodat niets opnieuw wordt opgebouwd.
- **Rechtsonder:** knoppen "Laatste slag" (de vorige slag terugkijken, belangrijk voor seinen) en "Gespeeld" (overzicht van gespeelde kaarten, alleen als die instelling aan staat).
- **Lettertypen:** Playfair Display voor cijfers en kaartindexen, Inter voor de interface. Bundel ze lokaal, want de app moet offline werken.
- Knoppen en aanraakvlakken zijn minimaal 44 px.

### Kaarten

- **Formaat:** ongeveer 118 × 170 px op het ontwerpformaat van 1280 × 860. Schaal mee met het scherm.
- **Stijl:** crème (#FBF8F1), afgeronde hoeken van 12 px, een zachte schaduw en een dun binnenkader. Rood #B3262D, zwart #1B1B1B. Rutger heeft gekozen voor dit rood, ook al gebruikt Knoll feller rood (#DF0000).
- **Hoekindexen:** in Nederlandse letters **A, H, V, B**, 10, 9, 8 en 7, met het kleursymbool eronder. Rechtsonder hetzelfde, 180° gedraaid.
- **7 tot en met 10:** symbolen in het standaardpatroon van speelkaarten (twee kolommen plus het midden). De onderste helft staat ondersteboven. Als richtlijn, in procenten van het binnenvlak (x, y):
  - 7: (22,12) (78,12) (50,31) (22,50) (78,50) (22,88) (78,88)
  - 8: zoals 7, plus (50,69)
  - 9: (22,12) (78,12) (22,37) (78,37) (50,50) (22,63) (78,63) (22,88) (78,88)
  - 10: (22,12) (78,12) (50,25) (22,37) (78,37) (22,63) (78,63) (50,75) (22,88) (78,88)
  - Vergelijk dit met een echt kaartspel en verbeter waar nodig.
- **Azen:** de letter A in de hoeken en in het midden een groot symbool in een dun rondje. Geen landschap. Rutger heeft hiervoor gekozen.
- **Heer, vrouw en boer:** de getekende plaatjes uit **Vector Playing Cards van Byron Knoll**, vrijgegeven als publiek domein. Een kopie staat op https://github.com/notpeter/vector-playing-cards.
  - Gebruik alleen de 12 plaatjes van heer, vrouw en boer. De rest maak je zelf in CSS of SVG volgens het ontwerp hierboven.
  - **Controleer de licentie** in die repository en meld wat je vindt. Zet een bronvermelding in `assets/kaarten/LICENSE.md`.
  - De bestanden hebben **K, Q en J** als index. Vervang die door **H, V en B**: snijd het middenplaatje uit of dek de hoeken af en zet je eigen indexen erop.
  - De bestanden zijn groot. Optimaliseer ze (bijvoorbeeld kleinere SVG of WebP op dubbele resolutie) en meld de uiteindelijke grootte.
  - **Gebruik geen schoppenaas uit een set.** Er is twijfel of de versierde schoppenaas vrij is, en Rutger koos toch voor eigen azen.
  - Sluiten de plaatjes van Knoll qua stijl niet goed aan bij de eigen cijferkaarten? Pas dan de eigen kaarten aan op Knoll, niet andersom, en laat het Rutger zien.
- **Gebruik nooit** kaartontwerpen van Klaverjas HD, Carta Mundi of het Nederlandse patroon van Brepols. Die zijn beschermd.
- **Achterkant:** eigen eenvoudig ontwerp in **donkerrood en goud** (gekozen door Rutger): gouden rand, fijn ruitpatroon en een gouden klaver in een rondje.

## Bouwvolgorde

1. **Spelregels plus tests:** kaarten, delen, draaien en passen, geldige zetten (Amsterdams en Rotterdams), slagwinnaar, punten, roem, nat, pit, verzaken en de 16 potjes. Rapporteer aan Rutger wat je in het reglement hebt gevonden en welke tests er zijn.
2. **Speeltafel** met een eenvoudige computerspeler die willekeurig een geldige kaart speelt, zodat een hele partij te spelen is.
3. **Uiterlijk** volgens het ontwerp, inclusief de plaatjes van Knoll.
4. **Simulatie-AI** in een Web Worker, eerst zonder seinen.
5. **Seinen:** zelf seinen en seinen van anderen gebruiken.
6. **Instellingen,** opslaan van de partij, PWA en offline.
7. **Publiceren** op GitHub Pages en testen op de tablet.

## Besluiten na fase 1 (met Rutger afgestemd)

- **Verzaken:** volgens het reglement. Verzakers 0, tegenpartij 162 + 100 strafpunten + alle roem die al gemaakt is.
- **Vier boeren:** 200 roem. Vier azen, tienen, heren of vrouwen: 100. Vier zevens, achten of negens: geen roem.
- **Pit:** 100 roem, alleen voor de spelende partij. Haalt de tegenpartij alle slagen, dan is de spelende partij gewoon nat (geen tegenpit).
- **Ondertroeven:** in Amsterdams én Rotterdams alleen als je niets anders hebt.
- **Opnieuw delen:** dezelfde deler.

## Nog open (vragen aan Rutger op het moment dat het speelt)

- Op dit moment niets.

## Online spelen met familie (op Rutgers verzoek gestart, 18 november 2026)

Besluiten met Rutger:
- **Supabase** (gratis abonnement, account van Rutger). De server deelt de kaarten en controleert elke zet (Edge Function), zodat niemand andermans kaarten kan zien. Supabase Realtime voor live zetten.
- Knop **"Online spelen"** op het beginscherm. De maker maakt een tafel en krijgt een code of link; anderen doen mee met naam en kiezen een plek.
- **Computers op lege plekken** worden uitgerekend op het **apparaat van de maker**. De server stuurt daarvoor alleen wat zo'n computerspeler mag weten.
- **Regels: de maker kiest** (Amsterdams of Rotterdams, troefkeuze, enzovoort), zoals bij de instellingen.
- **Apparaten:** de familie gebruikt Android, net als Rutger. Liggend, zoals nu.
- Wegvallen: de tafel wacht even, daarna neemt de computer de plek tijdelijk over.
- **Solo spelen blijft volledig offline.**
- **Plek in Supabase:** het bestaande project "app maker databases" (Rutgers keuze, gratis abonnement vol). Alles van klaverjassen staat in een eigen schema `klaverjas` (niet direct bereikbaar) en in functies `public.klaverjas_*`; de andere apps worden niet aangeraakt.
- **Geen Supabase-login** (eigen ontwerpkeuze, nodig omdat een anonieme login de boodschappen- en receptentabellen van Rutgers andere apps zou openzetten): elke speler krijgt een geheime sleutel die op zijn apparaat blijft (`klaverjas_online`). De database-opzet staat in `supabase/*.sql`.
- **Live bijwerken:** Supabase Realtime (openbaar kanaal `klaverjas-CODE`, alleen een seintje), met daarnaast elke 4 seconden zelf kijken.
- **Het spel** (stap 3 en 4 samen gebouwd, omdat Rutger met twee apparaten test): serverfunctie `klaverjas` (`supabase/functions/klaverjas/index.ts`, uitrollen met `ontwikkeling/uitrollen.sh`) bewaart de staat in `klaverjas.spellen`, controleert elke zet met `src/online/motor.js` (dezelfde spelregels) en geeft elke speler alleen zijn eigen zicht. De app tekent dat op de gewone speeltafel met jou onderaan (`src/online/tafel.js`). De computers op lege plekken rekent het apparaat van de maker uit, op het niveau uit zijn instellingen; staat dat apparaat uit, dan wacht het spel.

- **Wegvallen** (stap 5): wie 30 seconden niets van zich laat horen (`AFWEZIG_NA`), is "even weg": de computer speelt die plek tot hij terug is. Dat rekent de maker uit; is de maker zelf weg, dan een andere speler aan tafel. Bij geen verbinding een melding onder de tafel; terug in de app wordt de tafel meteen bijgewerkt. Het beginscherm toont "Terug naar tafel CODE". **Stoppen** (op Rutgers verzoek): het huisje vraagt eerst "Naar beginscherm" (de tafel blijft) of "Spel stoppen" (maker: tafel opgeheven, de anderen zien "… heeft het spel gestopt") / "Tafel verlaten" (anderen: de computer speelt die plek de rest van de partij).

Bouwvolgorde (na elke stap testen en akkoord van Rutger):
1. Supabase opzetten (Rutger maakt het account, Claude legt uit).
2. Tafel maken en meedoen met code, wachtruimte met namen.
3. Samen een potje spelen met alleen mensen.
4. Computers op lege plekken.
5. Wegvallen en weer verbinden.
6. Testen met de familie.

## Later (nu NIET bouwen)

### Leerstand
- Naar voren gehaald: zie "Leren klaverjassen" hierboven.
