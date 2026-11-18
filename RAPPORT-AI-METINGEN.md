# Computer beter laten spelen: metingen (stap 1 en 2)

## Nieuwe meetmethode

De oude duels (`ontwikkeling/duel.mjs`, functie `duel`) hadden veel toeval: elk team besliste
zelf over spelen of passen, en de twee helften van een duplicaatdeling kregen een andere
toevalsreeks. Een verschil van 4 tot 13 punten per potje kon daardoor gewoon toeval zijn.

Nieuw: `duelKaart` (gebruikt door `ontwikkeling/bovengrens.mjs`).
- Het contract (troef en spelende partij) wordt per deling één keer neutraal bepaald.
- Daarna wordt de deling twee keer gespeeld met de teams omgewisseld, met dezelfde toevalsreeks.
- Controle: twee gelijke instellingen geven precies 0 verschil.
- Bij elke meting staat een foutmarge (ongeveer 95%).

## Uitkomsten (punten per potje, tegen normaal: 100 simulaties, laatste 3 slagen exact)

| Vergelijking | Delingen | Verschil | Foutmarge |
|---|---|---|---|
| Computer die alle kaarten ziet | 200 | +16,9 | ± 8,3 |
| Sterk (300 simulaties) | 200 | +1,7 | ± 7,5 |
| Laatste 4 slagen exact | 600 | +0,4 | ± 2,1 |
| Speelstrategie: gedekte kaart bewaren | 600 | +0,3 | ± 3,0 |
| Speelstrategie: maat neemt hem (duiken) | 600 | −0,6 | ± 3,2 |
| Vuistregel gedekte kaart (heer naast aas) | 2 × 500 | 0,0 | ± 1,4 |
| Zonder vuistregels | 500 | −1,1 | ± 2,1 |
| Zonder de drie nieuwe regels (uitkomen, bijgooien, troef gevraagd) | 4 × 400 | +0,7 | ± 2 (gecombineerd) |
| Zonder de twaalf regels uit VUISTREGELS.md | 4 × 400 | −0,7 | ± 1,3 (gecombineerd) |
| Zonder de regel "troef trekken met een troef die zeker wint" | 4 × 400 | −0,3 | ± 0,5 (gecombineerd) |
| Zonder de spekregel (marge 20) | 4 × 400 | +0,8 | ± 0,5 (gecombineerd) |
| Zonder tien-uitkomst lezen | 4 × 400 | +0,3 | ± 0,6 (gecombineerd) |
| Snelle speelstijl zonder "vrije kaart bewaren" | 4 × 400 | −1,2 | ± 2,3 (gecombineerd) |
| Zonder "geen roem klaarleggen" | 4 × 400 | −0,3 | ± 0,8 (gecombineerd) |
| Zonder "niet uitkomen met een tien zonder de aas" (marge 20) | 4 × 400 | +0,4 | ± 0,7 (gecombineerd) |
| Zonder "doortrekken met de hoogste troef" (marge 40) | 4 × 400 | +0,5 | ± 1,0 (gecombineerd) |
| Zonder "tegenpartij komt niet met troef uit" (marge 40) | 4 × 400 | +0,8 | ± 0,8 (gecombineerd) |
| Zonder doortrekken, nu ook met verliezende troef (marge 40) | 4 × 400 | +0,8 | ± 1,0 (gecombineerd) |

## Conclusies

- De ruimte is beperkt: zelfs een computer die alle kaarten ziet, haalt maar ongeveer 17 punten
  per potje meer. De huidige computer haalt dus al veel uit wat hij kan weten.
- Geen van de geprobeerde verbeteringen levert meetbaar iets op. Ze kosten ook niets.
- Eerdere conclusies met de oude methode waren te stellig: "+12,8 met 4 slagen exact" en
  "−4 met de heer-naast-aas-regel" vielen binnen het toeval.
- De heer-naast-aas-regel staat nu aan: hij kost niets en de computer speelt menselijker.
- De twee verbeteringen in de speelstrategie staan uit (`SLIM_OPTIES`), want ze leveren niets op.
