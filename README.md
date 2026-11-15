# Tanssipeili

Selaimessa toimiva sovellus, jolla tanssija vertaa omaa videotaan mallivideoon. Sovellus piirtää videon päälle tikku-ukon sekä tanssijasta että mallista ja näyttää väreillä, missä kohdissa ne eroavat.

> Tanssipeili vertaa liikettäsi valitsemaasi mallivideoon. Se ei arvioi, onko tanssi oikein tai hyvää – vain kuinka lähellä mallia olet.

## Yksityisyys

Videot ja liikeradat pysyvät tässä puhelimessa. Sovellus ei lähetä mitään verkkoon.

Asennontunnistuksen malli ja kaikki muu koodi tarjoillaan tästä reposta. Sivu ei tee ajon aikana pyyntöjä muihin osoitteisiin, eikä siinä ole analytiikkaa. Sivun sisältökäytäntö (CSP) estää selaimessa yhteydet muualle, ja tämä varmistetaan automaattisissa testeissä.

Valitusta videosta tehdään työkopio sovelluksen omaan tallennustilaan samassa laitteessa, koska osa puhelimista ei anna selaimen lukea samaa tiedostoa toistamiseen. Työkopio poistetaan, kun valitaan uusi video tai sovellus avataan uudelleen. Oman suorituksen video ei siis jää pysyvästi sovellukseen, mutta viimeisin työkopio on tallessa seuraavaan avaukseen asti.

Asetuksissa on vianmäärityksen loki. Sekin pysyy laitteessa: käyttäjä kopioi sen itse, jos haluaa lähettää sen eteenpäin.

## Mitä vaihe 1 sisältää

- **Kirjasto.** Mallivideot tallennetaan tanssilajin alle (Street, Commercial, Hip-hop, Muu ja omat lajit).
- **Mallin lisäys.** Video rajataan, sovellus poimii siitä liikeradan, ja mallin voi merkitä peilikuvaksi.
- **Jälkianalyysi.** Oma video rajataan ja verrataan malliin. Tuloksena video tikku-ukkoineen, aikajana eroista ja yhteenveto käsistä, jaloista, vartalosta ja ajoituksesta.
  - Videoiden alkukohdat sovitetaan yhteen automaattisesti (enintään 2 s), joten rajauksen ero ei näy virheenä.
  - Sen jälkeen aikaa joustetaan vain vähän (enintään 0,5 s). Suurempi ero näkyy asentoerona.
  - Kehonosan arvion ratkaisee sen heikoin raaja, ja aikajana näyttää kunkin hetken suurimman eron.
  - Ajoitus kertoo vain, muuttuiko tahti pätkän aikana.
- **Tarkkuusasetus.** Salliva, normaali tai tarkka.

Reaaliaikainen kameratila, lisääminen kotinäytölle ja kirjaston varmuuskopiointi kuuluvat seuraaviin vaiheisiin. Tanssilajin automaattinen tunnistus ei ole mukana.

## Rajat, jotka on hyvä tietää

- Oma video pitää kuvata suunnilleen samasta kulmasta kuin malli. Yksi kamera ei näe syvyyttä.
- Koko kehon pitää näkyä. Epävarmasti tunnistetut kohdat näytetään harmaina.
- Kuvassa saa olla vain yksi tanssija.
- Hyvin nopeat liikkeet ja löysät vaatteet heikentävät tunnistusta.
- Värien raja-arvot ja ajallisen jouston määrä ovat lähtöarvoja, joita ei ole vielä säädetty oikeilla tanssivideoilla.
- Jos vain yksi raaja liikkuu tasaisesti ja muu keho on paikallaan, sovellus ei voi erottaa asentoeroa ajoituserosta.
- Sovellusta ei ole vielä kokeiltu oikealla puhelimella. Katso `docs/puhelintesti.md`.
- Selain voi tyhjentää tallennetun kirjaston, jos sivustoa ei käytetä pitkään aikaan.

## Kehitys

Sivusto on staattinen: ei palvelinta, ei käännösvaihetta.

```bash
npm run serve        # http://127.0.0.1:8080/
npm run test:unit    # laskennan testit (Node)
npm run test:e2e     # selaintestit (Playwright + Chrome), kestää useita minuutteja
```

Selaintestit tarvitsevat Playwrightin (`npm install`) ja Chromen. Chromen polun voi antaa ympäristömuuttujassa `CHROME_PATH`.

Rakenne:

| Kansio | Sisältö |
|---|---|
| `js/core/` | Vertailun laskenta: kulmat, ajallinen kohdistus, yhteenveto. Ei selainriippuvuuksia. |
| `js/pose/` | Asennontunnistus ja liikeradan poiminta videosta. |
| `js/store/` | Kirjaston tallennus selaimeen. |
| `js/render/` | Tikku-ukon piirto. |
| `js/ui/` | Näkymät. |
| `vendor/mediapipe-pose/` | MediaPipe Pose -kirjaston tiedostot. |
| `docs/` | Suunnitelma, toteutussuunnitelma, puhelintestin tarkistuslista ja tehdyt päätökset. |

## Lisenssit

- `vendor/mediapipe-pose/`: MediaPipe Pose (`@mediapipe/pose` 0.5.1675469404), Apache License 2.0, Google.
- `tests/fixtures/pose.jpg` ja `pose_squats.mp4`: `tensorflow/tfjs-models`-reposta, Apache License 2.0. Katso `tests/fixtures/LICENSE-NOTICE.md`.
