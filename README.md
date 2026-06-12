# Wij gaan juichen - publieke inhoud

Deze publieke repository bevat uitsluitend actuele wedstrijdinformatie en de
privacy- en supportpagina's van de app. De broncode van de app staat in een
aparte private repository.

## Automatische updates

De workflow `.github/workflows/publish.yml` haalt iedere vijftien minuten de
WK-wedstrijden van Nederland op via football-data.org, valideert het resultaat
en publiceert het via GitHub Pages.

Het repository-secret `FOOTBALL_DATA_API_KEY` is hiervoor verplicht.

## Redactioneel profiel toevoegen

Voeg in `data/editorial.json` onder `profiles` een profiel toe met de
drielettercode van het land, bijvoorbeeld `BRA`. Automatische updates van
wedstrijdfeiten overschrijven deze tekst niet.

## Noodcorrectie

Zet `enabled` in `data/manual-overrides.json` tijdelijk op `true` en vul
`matches` en/of `routes`. Handmatige waarden krijgen dan voorrang.

## Lokaal testen

Start `npm run serve` en laat de app
`http://127.0.0.1:4174/data/wk-2026.json` gebruiken via
`VITE_MATCH_CONTENT_URL`.

De API-omzetting kan zonder sleutel worden getest met
`FOOTBALL_DATA_FIXTURE=test/football-data-response.json` en een tijdelijk
`CONTENT_OUTPUT`.

Football data provided by the Football-Data.org API.
