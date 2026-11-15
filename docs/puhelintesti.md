# Puhelintesti, vaihe 1

Automaattiset testit ajettiin tietokoneella hitaalla kyykkyvideolla. Ne eivät kerro, miten sovellus toimii oikeassa puhelimessa oikealla tanssilla. Tämä lista on sitä varten.

Osoite: https://sgtotter00530.github.io/Tanssipeili/

Kirjaa jokaisen kohdan perään, mitä tapahtui. Pelkkä "toimi" tai "ei toiminut" riittää, mutta tarkempi kuvaus auttaa korjaamisessa.

## Ennen testiä

Avaa Asetukset ja katso kohdasta Vianmääritys sovelluksen versio. Selain voi näyttää vanhaa versiota noin 10 minuuttia päivityksen jälkeen. Jos versio on vanha, odota hetki ja lataa sivu uudelleen.

## Videon valinta Androidissa

Painike Valitse video tai Valitse galleriasta avaa nyt Chromen oman valinnan eikä puhelimen kuvavalitsinta. Valitse siitä Tiedostot ja hae video (yleensä kansiosta DCIM/Camera tai Videot).

- [ ] Millainen valinta aukesi? (Kuvaruudukko, Tiedostot-selain, vai valikko jossa on Kamera ja Tiedostot.)
- [ ] Aukesiko video ilman virhettä kolmella peräkkäisellä yrityksellä?

## Jos jokin ei toimi

1. Kirjoita muistiin virheilmoitus ja sen alla oleva rivi "Tekninen tieto".
2. Avaa Asetukset ja vieritä kohtaan Vianmääritys.
3. Paina Kopioi loki ja liitä teksti viestiin.

Loki pysyy puhelimessa, kunnes kopioit sen itse. Siinä ei ole videokuvaa eikä tiedostojen nimiä. Siinä on puhelimen ja selaimen tyyppi, videoiden koko ja tarkkuus, käsittelyajat ja virheet.

## Perustiedot

- Puhelimen malli:
- Selain ja versio (esim. Safari, Chrome):
- Testin päivämäärä:

## 1. Sivu aukeaa

- [ ] Sivu latautuu ja näkyy otsikko Kirjasto sekä lajit Street, Commercial, Hip-hop ja Muu.
- [ ] Alareunassa näkyvät Kirjasto, Analysoi ja Asetukset.
- [ ] Yläreunassa ei näy keltaista varoitusta tallennuksesta.

Havainnot:

## 2. Mallin lisäys

Käytä lyhyttä, 10–20 sekunnin tanssivideota, jossa koko keho näkyy.

- [ ] Lisää malli avaa puhelimen tiedostovalinnan.
- [ ] Video näkyy rajausnäkymässä ja liukusäätimet siirtävät kuvaa.
- [ ] Käsittely etenee ja valmistuu. Kauanko se kesti? Pätkän pituus ja käsittelyaika:
- [ ] Näyttö pysyy päällä koko käsittelyn ajan. Älä koske puhelimeen käsittelyn aikana ja katso, sammuuko näyttö.
- [ ] Jos saat viestin "Videosta ei löytynyt tanssijaa", vaikka tanssija näkyy selvästi, kirjaa se tähän. Se voi olla selaimen videonkäsittelyyn liittyvä vika eikä kuvauksen ongelma.
- [ ] Esikatselussa valkoinen tikku-ukko osuu tanssijan päälle.
- [ ] Tikku-ukko pysyy tanssijan mukana, kun videota toistaa tai kelaa.
- [ ] Malli on peilikuva -valinta kääntää sekä videon että tikku-ukon.
- [ ] Tallennuksen jälkeen malli näkyy kirjastossa oikean lajin alla.

Havainnot:

## 3. Jälkianalyysi

- [ ] Kuvaa nyt avaa kameran videotilassa.
- [ ] Tallentuuko Kuvaa nyt -painikkeella kuvattu video puhelimen galleriaan? (Sovellus ei tallenna omaa suoritustasi.)
- [ ] Valitse galleriasta avaa videot.
- [ ] Analyysi valmistuu. Pätkän pituus ja käsittelyaika:
- [ ] Oma tikku-ukko (värillinen) osuu kehon päälle.
- [ ] Mallin sininen tikku-ukko näkyy oman takana ja on järkevän kokoinen.
- [ ] Aikajanan napautus siirtää videon oikeaan kohtaan.
- [ ] Yhteenvedon rivit Kädet, Jalat, Vartalo ja Ajoitus näkyvät.
- [ ] Tarkkuuden vaihto tulosnäkymässä muuttaa värejä heti, ilman uutta käsittelyä.
- [ ] Käy Asetukset-välilehdellä ja palaa Analysoi-välilehdelle. Tulos on yhä näkyvissä.
- [ ] Käy toisessa sovelluksessa kesken käsittelyn ja palaa. Jatkuuko käsittely vai tuleeko virheviesti?

Havainnot:

## 3b. Kämmenet ja jalkaterät

Kytke tulosnäkymässä päälle Näytä kämmenet ja jalkaterät.

- [ ] Osuvatko viivat kämmenten ja jalkaterien päälle?
- [ ] Kun ojennat nilkan tai koukistat sen tarkoituksella eri tavalla kuin mallissa, näkyykö ero rivillä Jalkaterät?
- [ ] Kuinka paljon harmaata näkyy kämmenissä ja jalkaterissä nopeassa liikkeessä?

## 4. Onko palaute hyödyllistä

Tämä on vaiheen 1 tärkein kysymys.

- [ ] Kun tanssit tarkoituksella eri tavalla kuin malli, näkyykö ero punaisena oikeassa kehonosassa?
- [ ] Kun tanssit mahdollisimman samoin, onko suurin osa vihreää?
- [ ] Näkyykö nopeissa liikkeissä paljon harmaata (ei tunnistettu)?
- [ ] Tuntuuko jokin väri väärältä: punaista, vaikka liike näytti samalta, tai vihreää, vaikka ero oli selvä?
- [ ] Kokeile tarkkuudet Salliva ja Tarkka. Mikä taso tuntuu sopivimmalta?
- [ ] Ajoitus: tanssi tarkoituksella niin, että jäät loppua kohti jälkeen. Sanooko Ajoitus-rivi niin?
- [ ] Ajoitus: rajaa oma videosi alkamaan sekunnin liian aikaisin. Ajoituksen pitäisi silti olla "tahti pysyi tasaisena".
- [ ] Yhteenveto: jos yksi käsi on koko ajan väärässä asennossa, sanooko Kädet-rivi "eroja" tai "paljon eroja"?

Havainnot:

## 5. Tallennus säilyy

- [ ] Sulje selain kokonaan ja avaa sivu uudelleen. Mallit ovat yhä kirjastossa.
- [ ] Sama vielä seuraavana päivänä.

Havainnot:

## 6. Muuta

Kaikki, mikä tuntui hankalalta, hitaalta tai hämmentävältä:
