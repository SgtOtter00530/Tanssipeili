# Tanssipeili

Selaimessa toimiva sovellus, jolla tanssija vertaa omaa videotaan mallivideoon. Sovellus piirtää videon päälle tikku-ukon sekä tanssijasta että mallista ja näyttää väreillä, missä kohdissa ne eroavat.

> Tanssipeili vertaa liikettäsi valitsemaasi mallivideoon. Se ei arvioi, onko tanssi oikein tai hyvää – vain kuinka lähellä mallia olet.

## Yksityisyys

Videot ja liikeradat pysyvät tässä puhelimessa. Sovellus ei lähetä mitään verkkoon.

Asennontunnistuksen malli ja kaikki muu koodi tarjoillaan tästä reposta. Sivu ei tee ajon aikana pyyntöjä muihin osoitteisiin, eikä siinä ole analytiikkaa. Tämä varmistetaan automaattisissa testeissä.

## Mitä vaihe 1 sisältää

- **Kirjasto.** Mallivideot tallennetaan tanssilajin alle (Street, Commercial, Hip-hop, Muu ja omat lajit).
- **Mallin lisäys.** Video rajataan, sovellus poimii siitä liikeradan, ja mallin voi merkitä peilikuvaksi.
- **Jälkianalyysi.** Oma video rajataan ja verrataan malliin. Tuloksena video tikku-ukkoineen, aikajana eroista ja yhteenveto käsistä, jaloista, vartalosta ja ajoituksesta.
- **Tarkkuusasetus.** Salliva, normaali tai tarkka.

Reaaliaikainen kameratila, lisääminen kotinäytölle ja kirjaston varmuuskopiointi kuuluvat seuraaviin vaiheisiin. Tanssilajin automaattinen tunnistus ei ole mukana.

## Rajat, jotka on hyvä tietää

- Oma video pitää kuvata suunnilleen samasta kulmasta kuin malli. Yksi kamera ei näe syvyyttä.
- Koko kehon pitää näkyä. Epävarmasti tunnistetut kohdat näytetään harmaina.
- Kuvassa saa olla vain yksi tanssija.
- Hyvin nopeat liikkeet ja löysät vaatteet heikentävät tunnistusta.
- Värien raja-arvot ovat lähtöarvoja, joita ei ole vielä säädetty oikeilla tanssivideoilla.
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
| `docs/` | Suunnitelma, toteutussuunnitelma ja puhelintestin tarkistuslista. |

## Lisenssit

- `vendor/mediapipe-pose/`: MediaPipe Pose (`@mediapipe/pose` 0.5.1675469404), Apache License 2.0, Google.
- `tests/fixtures/pose.jpg` ja `pose_squats.mp4`: `tensorflow/tfjs-models`-reposta, Apache License 2.0. Katso `tests/fixtures/LICENSE-NOTICE.md`.
