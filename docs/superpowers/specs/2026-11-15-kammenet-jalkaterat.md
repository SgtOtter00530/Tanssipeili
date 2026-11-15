# Kämmenet ja jalkaterät tikku-ukkoon

Päiväys: 15.11.2026. Tila: hyväksytty keskustelussa 15.11.2026.

## Tarkoitus

Tanssija haluaa nähdä ojennukset: jatkaako käsi käsivarren linjaa ja onko nilkka ojennettu vai koukussa. Nykyinen tikku-ukko päättyy ranteeseen ja nilkkaan.

## Mitä tehdään

- Tulosnäkymään valinta "Näytä kämmenet ja jalkaterät", oletuksena pois päältä. Valinta muistetaan.
- Päällä ollessaan piirretään ja väritetään neljä uutta segmenttiä: ranne → etusormen rystynen (vasen ja oikea) ja nilkka → varpaiden kärki (vasen ja oikea). Lisäksi piirretään kantapään ja varpaiden välinen viiva ilman väriarviota.
- Yhteenvetoon tulee kaksi omaa riviä, Kämmenet ja Jalkaterät. Ne eivät vaikuta riveihin Kädet, Jalat ja Vartalo.
- Aikajana ottaa uudet segmentit huomioon vain, kun valinta on päällä.
- Ajallinen kohdistus lasketaan aina vain kymmenestä pääsegmentistä, jotta pienten kehonosien kohina ei vaikuta siihen.
- Tallennetut mallit toimivat sellaisenaan: liikeradoissa on jo kaikki 33 pistettä.

## Mitä ei tehdä

- Yksittäisiä sormia. Ne vaatisivat toisen tunnistusmallin, ja koko kehon kuvausetäisyydeltä tulos ei olisi luotettava.
- Muutoksia mallin lisäykseen tai tallennusmuotoon.

## Lähestymistavat

1. **Nykyisen mallin pisteet (valittu).** MediaPipe Pose antaa jo ranteen, rystyset, kantapään ja varpaiden kärjen. Ei lisää käsittelyaikaa.
2. Erillinen käsimalli sormia varten. Hylätty: hidastaa käsittelyä ja on epäluotettava tältä etäisyydeltä.
3. Uudet segmentit osaksi Kädet- ja Jalat-rivejä. Hylätty: heikoin raaja ratkaisee arvion, joten epävarmemmat pisteet heikentäisivät koko riviä.

## Tunnetut rajat

- Kämmenet ja jalkaterät tunnistuvat heikommin kuin isot nivelet, joten harmaata on enemmän.
- Suoraan kameraa kohti osoittavaa kättä tai jalkaterää ei voi arvioida.
- Analyysi katsoo kymmenen kuvaa sekunnissa, joten hyvin nopea ranteen tai nilkan liike voi jäädä väliin.

## Tehtävät

1. `skeleton.js`: `DETAIL_SEGMENTS` ja uudet pisteindeksit. Testi: neljä segmenttiä, ryhmät `hands` ja `feet`.
2. `compare.js`: nollapituinen segmentti on tuntematon; `compareFrames` hyväksyy segmenttilistan.
3. `analysis.js`: `analyze(…, { detail })`. Testit: ilman valintaa tulos ennallaan; valinnalla väärä jalkaterä näkyy rivillä Jalkaterät eikä rivillä Jalat.
4. `overlay.js`: `detail`-valinta piirtoon. Testi: jalkaterän väri näkyy vain valinnalla.
5. `analyze.js`: valinta, kaksi riviä, asetuksen muistaminen. Testi koko polussa.
