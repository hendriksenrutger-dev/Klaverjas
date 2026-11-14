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

### Uitkomen

- Het uitkomen gaat per potje de tafel rond, **los van wie er speelt**.

### Verzaken

- Instelling **verzaakbescherming**, **standaard aan**: alleen geldige kaarten zijn speelbaar, ongeldige zijn grijs.
- **Uit:** elke kaart is speelbaar. Bij een ongeldige kaart:
  - De app ziet dat **direct** en toont een duidelijke melding.
  - **Het potje stopt meteen.**
  - De tegenpartij krijgt alle punten en alle roem. Controleer de precieze straf in het reglement.
- **Computerspelers verzaken nooit.**

### Seinen (Rutgers afspraken, niet uit het reglement)

- Seinen gebeurt alleen door **bij te spelen op een slag die je maat al heeft**, en **nooit met of bij troef**.
  - Afgestemd met Rutger: het geldt **ook bij bekennen** (bijv. maat speelt ♣H en heeft de slag, jij legt ♣7 bij = "ik heb ♣A").
  - "Bij troef" betekent: als **troef gevraagd** is. Heeft je maat een andere kleur **ingetroefd** en daarmee de slag, dan mag je wel seinen.
- **Kleintje (7, 8 of 9) bijspelen:** "ik heb de aas van deze kleur".
- **Aas bijspelen:** "ik heb ook de tien van deze kleur".
- **Tien, boer, vrouw of heer bijspelen:** geen sein. Een tien is gewoon punten geven aan je maat.
- Een kleintje kan ook gespeeld zijn omdat iemand niets anders had. **Een sein is een sterke aanwijzing, geen zekerheid.**
- Kleintje boer en andere seinsystemen: niet gebruiken.

## Computerspelers (AI)

- **Methode:** Monte Carlo-simulatie met bepaalde kaartverdelingen (determinization / PIMC). Per zet:
  1. Trek veel keren een willekeurige verdeling van de onbekende kaarten die past bij alles wat bekend is: gespeelde kaarten, en wie een kleur niet kon bekennen of niet kon troeven.
  2. Speel per geldige kaart het potje uit, met een snelle eenvoudige speelstrategie of een kleine zoekdiepte.
  3. Kies de kaart met het beste gemiddelde resultaat: punten plus roem, met nat en pit meegerekend.
- **Seinen in de simulatie:** verdelingen waarin een sein klopt krijgen een hoger gewicht, maar niet 100%. Dit is een eigen ontwerpkeuze, niet beproefd. Maak de factor instelbaar in de code, zodat hij na testen bij te stellen is.
- **Zelf seinen:** de computerspelers seinen volgens de afspraken hierboven, zodat Rutger als maat de seinen kan lezen.
- **Spelen of passen bij het draaien:** ook via simulatie. Speel de hand met deze troef vaak uit en speel als de verwachte uitkomst boven een drempel ligt.
- **Moeilijkheidsniveau** (instelling): makkelijk (5 simulaties, eenvoudige strategie), normaal (100, slimme strategie, laatste 3 slagen exact) en sterk (300). Akkoord van Rutger.
- Draai de AI in een **Web Worker** zodat het scherm niet hapert. Doel: minder dan ongeveer 1 seconde per zet op de tablet.
- Laat de computerspelers kort "nadenken" zodat je kunt volgen wat er gebeurt. Na Rutgers test op de tablet ingekort tot ongeveer 0,35 tot 0,65 seconde (het voelde traag).

## Instellingen

- Amsterdams (standaard) of Rotterdams
- Opnieuw delen na 2 (standaard) of 3 rondes passen
- Verzaakbescherming aan (standaard) of uit
- Moeilijkheid van de computerspelers: makkelijk, normaal (standaard), sterk (afgestemd met Rutger, zie RAPPORT-FASE-4.md)
- Geluid aan (standaard) of uit
- Namen van de spelers (standaard Zuid, West, Noord, Oost)

## Uiterlijk

Rutger heeft een ontwerp goedgekeurd: groen laken, tablet liggend. Hij wil het **mooi**.

- **Tafel:** groen laken met een zachte radiale verlichting in het midden (#2E8A5C naar #227049 naar #164F33) en een dunne lichte ovale lijn op de tafel.
- **Bovenbalk** (half doorzichtig donker): menuknop met een huisje links. In het midden de score van Wij (in goud #E8C873) en Zij (wit), en het potje "9 / 16". Rechts een crèmekleurig troeflabel met een rond symbool van de troefkleur en de tekst "Troef · Schoppen · wij spelen", en een knop voor instellingen.
- **Linksboven, onder de balk:** een paneel "Dit potje" met de punten en roem van Wij en Zij in het lopende potje.
- **Spelers:** de maat boven (Noord), de tegenstanders links (West) en rechts (Oost). Zuid ben jij en wordt **niet** op de tafel getoond. Elke computerspeler heeft een rond avatar met een initiaal (geen foto's) en een naam, met als rol "Jouw maat · computer" of "Tegenstander". Een gouden label "Speelt" bij de spelende speler.
- **Namen:** standaard de windrichtingen Zuid, West, Noord en Oost. Echte namen kunnen geven is een instelling.
- **Geluid:** schudden (zelf opgewekt) en kaarten die neergelegd worden (echte opname: Kenney Casino Audio, CC0, zie `assets/geluid/LICENSE.md`).
- **Slag op tafel:** de kaarten liggen licht gedraaid op hun plek, in een kruis, **zonder over elkaar te liggen**. Op jouw plek staat een gestippeld vak met "Jouw kaart".
- **Roemmelding:** een goudkleurig label met een ster, bijvoorbeeld "Driekaart · 20 roem".
- **Hint onder de tafel:** kort, zonder uitleg van de regels (Rutger kent ze): "Jouw beurt", "Tik nog een keer om te spelen", "Deze slag is voor West".
- **Beginscherm:** bij het openen eerst een beginscherm met "Verder spelen" (met potje en stand), "Nieuwe partij" en "Instellingen". Het huisje in de bovenbalk gaat terug naar het beginscherm; het spel wacht dan.
- **Indeling:** alle maten volgen de echte schermhoogte (ook in Chrome met adresbalk). Kaarten liggen nooit onder tekst door; niets overlapt.
- **Hand:** acht kaarten in een lichte waaier onderaan. Kaarten die niet mogen worden grijs (opacity ongeveer 0,45). **Spelen gaat met twee tikken:** de eerste tik tilt de kaart op, de tweede speelt hem.
- **Rechtsonder:** knoppen "Laatste slag" (de vorige slag terugkijken, belangrijk voor seinen) en "Gespeeld" (overzicht van gespeelde kaarten).
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

## Later (na de solo-app, nu NIET bouwen)

### Online spelen met familie en vrienden
- Speltafel met code of link. Lege plekken worden opgevuld door computerspelers.
- Supabase Realtime voor live zetten. Delen en controle van zetten op de server (Edge Function), zodat niemand andermans kaarten kan zien.
- Opvangen als iemand wegvalt: wachten of tijdelijk een computerspeler laten invallen.
- Solo spelen blijft volledig offline.
- Houd hier nu al rekening mee: spelregels los van het scherm, spelstand serialiseerbaar, elke zet een losse actie.

### Leerstand voor volwassenen die willen leren klaverjassen
Drie onderdelen:
1. Lessen: korte stappen met vooraf bedachte handen, uitleg en een opdracht per les.
   Volgorde: kaartwaarden en troefvolgorde → bekennen → troeven (Amsterdams/Rotterdams) → roem → nat en pit → seinen (volgens onze afspraken).
2. Hulp tijdens het spelen (aan/uit te zetten):
   - uitleg waarom een kaart niet mag;
   - melding bij roem en bij een sein van je maat, met uitleg wat het sein betekent;
   - hint-knop: de simulatie-AI kiest de kaart, en uitleg in mensentaal komt uit vaste regels. Waar geen regel past, toon dan alleen "deze kaart levert gemiddeld de meeste punten op". Verzin geen uitleg.
3. Oefenen met open kaarten tegen makkelijke tegenstanders.
- Toon: volwassen, kort en helder, niet kinderachtig.
- Hergebruik de uitlegteksten uit de spelregels (waarom een zet niet mag) in de hele app.
