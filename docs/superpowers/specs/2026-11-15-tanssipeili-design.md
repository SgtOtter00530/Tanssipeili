# Tanssipeili – suunnitelma

Päiväys: 15.11.2026
Tila: odottaa hyväksyntää

## 1. Tarkoitus

Tanssia harrastava nuori harjoittelee yksin ja haluaa nähdä, kuinka lähellä oma suoritus on mallia. Sovellus piirtää videokuvan päälle tikku-ukon (viivat ja pallot nivelissä) sekä tanssijasta että mallisuorituksesta ja näyttää väreillä, missä kohdissa ne eroavat.

Käyttäjä on yksi nuori omalla puhelimellaan. Mallivideot hän lataa sovellukseen itse.

**Tärkeä rajaus sanalle "oikeellisuus":** sovellus mittaa samankaltaisuutta mallivideoon, ei tanssin objektiivista oikeellisuutta tai laatua. Jos mallivideo on huono, palaute ohjaa kohti huonoa mallia. Tämä sanotaan sovelluksessa suoraan.

## 2. Tavoitteet

1. **Mallikirjasto.** Käyttäjä tuo videon, sovellus poimii siitä liikeradan (nivelpisteet ajan funktiona) ja tallentaa sen nimellä valitun tanssilajin alle.
2. **Lajivalikko.** Lajit toimivat kirjaston kansioina. Valmiina Street, Commercial, Hip-hop ja Muu. Käyttäjä voi lisätä, nimetä uudelleen ja poistaa lajeja. Laji ei vaikuta vertailun laskentaan.
3. **Jälkianalyysi.** Käyttäjä kuvaa tai valitsee videon omasta suorituksestaan ja valitsee mallin. Sovellus näyttää videon, jonka päällä ovat oma ja mallin tikku-ukko, värikoodatut nivelet, aikajanan jossa suurimmat erot erottuvat, ja yhteenvedon kehonosittain.
4. **Reaaliaikatila.** Kamerakuvan päällä näkyy oma tikku-ukko ja mallin tikku-ukko, joka etenee mallin tahdissa. Nivelet värittyvät eron mukaan tanssin aikana.
5. **Kaikki tapahtuu puhelimessa.** Videokuvaa tai liikeratoja ei lähetetä mihinkään.
6. **Suomenkielinen käyttöliittymä**, joka toimii kännykän selaimessa ja jonka voi lisätä kotinäytölle.

## 3. Ei tavoitteita (ensimmäisessä versiossa)

- Tanssilajin automaattinen tunnistus. Luotettavaa valmista mallia ei ole tiedossa; palataan asiaan myöhemmin.
- Sovelluksen mukana tuleva valmis liikekirjasto.
- Käyttäjätilit, pilvitallennus, mallien jakaminen laitteiden välillä.
- Sovelluskauppaversio.
- Usean tanssijan seuranta samassa kuvassa.
- Kolmiulotteinen liikeanalyysi.

## 4. Mitä ei saa tapahtua

- Nuoren videokuva ei poistu laitteesta missään tilanteessa. Sovellus ei tee ajon aikana yhtään pyyntöä kolmansille osapuolille: tunnistusmalli, fontit ja kirjastot tarjoillaan samasta osoitteesta kuin sovellus. Ei analytiikkaa.
- Palaute ei saa lukea tuomiona tanssijasta. Ei kouluarvosanoja eikä häpäisevää pisteytystä. Sanamuoto on kuvaileva: "vasen käsi oli tässä kohdassa mallia alempana".
- Sovellus ei saa väittää tietävänsä enempää kuin se tietää. Jos tunnistus on epävarma (keho osin kuvan ulkopuolella, heikko valo), kyseinen nivel näytetään harmaana eikä punaisena.

## 5. Rajoitteet

- **Kamera vaatii HTTPS:n.** GitHub Pages täyttää tämän.
- **Yksi kamera näkee kaksiulotteisesti.** Vertailu toimii kunnolla vain, jos oma video on kuvattu suunnilleen samasta kulmasta kuin malli ja koko keho näkyy. Sovellus ohjeistaa tämän ennen kuvausta.
- **Peilaus.** Tanssin opetusvideot on usein kuvattu peilikuvana. Mallille tarvitaan peilausvalinta.
- **Suorituskyky.** Reaaliaikaisen tunnistuksen sujuvuus vanhemmilla puhelimilla on epävarma. Jälkianalyysi ei ole aikakriittinen ja toimii hitaammallakin laitteella.
- **Nopeat liikkeet ja löysät vaatteet** heikentävät tunnistusta. Tätä ei voi korjata ohjelmallisesti kokonaan.
- **Selaimen tallennustila voi tyhjentyä.** Erityisesti iOS:n Safari saattaa poistaa sivuston tiedot, jos sivustoa ei käytetä hetkeen (tarkka käytös pitää varmistaa toteutusvaiheessa). Siksi kirjastolle tarvitaan varmuuskopion vienti ja tuonti tiedostona.
- **Testaus.** Kameratilaa ei voi testata rakennusympäristössä oikealla puhelimella. Se jää käyttäjän testattavaksi tarkistuslistan avulla.

## 6. Lähestymistavat

| Vaihtoehto | Edut | Haitat |
|---|---|---|
| A. Claude-sivu (artifact) | Valmis heti, ei hostausta | Ei kameran käyttöä, joten ei reaaliaikatilaa. Tunnistusmoottorin toimivuus sivun rajoituksissa varmistamatta. |
| **B. Oma staattinen web-sovellus GitHub Pagesissa** | Molemmat tilat toimivat. Koodi kirjoitetaan ja jälkianalyysi testataan ennen luovutusta. Kotinäytölle lisättävä. | Kertaluonteinen julkaisu. Ilmaistilillä repo on todennäköisesti oltava julkinen. |
| C. Lovable-projekti | Julkaisu hoituu suoraan | Koodin tuottaa Lovablen tekoäly, heikompi laadunhallinta. Kustannus tuntematon. |

**Valittu: B.** Käyttäjä valitsi sen, koska reaaliaikatila oli toivottu ja koodin laatu pysyy hallinnassa. Repo: `SgtOtter00530/Tanssipeili`.

## 7. Miten se toimii

### 7.1 Asennontunnistus

MediaPipen asennontunnistus, joka antaa 33 kehon pistettä kuvaa kohden. Mallitiedostot sijoitetaan repoon sovelluksen rinnalle. Tikku-ukkoon piirretään päänivelet: olkapäät, kyynärpäät, ranteet, lonkat, polvet, nilkat sekä pään ja vartalon linja.

### 7.2 Vertailu

- **Normalisointi.** Molemmat tikku-ukot skaalataan vartalon pituuden mukaan ja keskitetään lantion keskipisteeseen. Näin etäisyys kamerasta ja tanssijan koko eivät vaikuta tulokseen.
- **Mitattava suure.** Verrataan raajojen suuntia (esim. olkavarren kulma), ei pisteiden absoluuttisia paikkoja. Tämä kestää paremmin sen, että tanssijalla ja mallilla on eri mittasuhteet.
- **Värit.** Jokainen nivel saa värin eron suuruuden mukaan: vihreä, keltainen, punainen. Harmaa, jos tunnistus on epävarma. Väriä tukee viivan paksuus tai kuvio, jotta palaute ei ole pelkän värin varassa.
- **Tarkkuusasetus.** Kolme tasoa (salliva, normaali, tarkka), jotka siirtävät värirajoja.

### 7.3 Tahdistus

- **Jälkianalyysi:** suoritukset kohdistetaan automaattisesti ajallisesti (dynaaminen aikakohdistus), joten pieni etu- tai jälkijättöisyys ei värjää kaikkea punaiseksi. Ajoitusero raportoidaan erikseen: "olit tässä osassa hieman mallia jäljessä".
- **Reaaliaikatila:** lähtölaskenta, jonka jälkeen malli etenee omassa tahdissaan ja tanssija seuraa. Mallin nopeuden voi valita (50 %, 75 %, 100 %).

### 7.4 Näkymät

1. **Kirjasto.** Lajit välilehtinä tai valikkona, niiden alla tallennetut mallit. Painike "Lisää malli".
2. **Mallin lisäys.** Videon valinta, käsittelyn eteneminen, esikatselu tikku-ukolla, peilausvalinta, alku- ja loppukohdan rajaus, nimi ja laji.
3. **Harjoittele (reaaliaika).** Kuvausohje, lähtölaskenta, kamerakuva ja kaksi tikku-ukkoa.
4. **Analysoi (jälkikäteen).** Videon kuvaus tai valinta, käsittely, toisto tikku-ukoilla, aikajana, yhteenveto kehonosittain.
5. **Asetukset.** Tarkkuus, kirjaston varmuuskopio ja palautus, tietoa sovelluksesta ja sen rajoista.

Luonnos analyysinäkymästä:

```
┌──────────────────────────┐
│  ← Analyysi   Malli: xx  │
│ ┌──────────────────────┐ │
│ │                      │ │
│ │   video + oma ukko   │ │
│ │   + mallin ukko      │ │
│ │                      │ │
│ └──────────────────────┘ │
│  ▶  ━━━━━●━━━━━━━━  0:12 │
│  ▁▁▂▅█▅▂▁▁▁▃▆▃▁▁  erot   │
│                          │
│  Kädet      ●●●○  lähellä│
│  Jalat      ●●○○  eroja  │
│  Vartalo    ●●●●  lähellä│
│  Ajoitus    hieman jäljessä│
└──────────────────────────┘
```

### 7.5 Tallennus

- Kirjasto (liikeradat, nimet, lajit, asetukset) tallennetaan selaimen tietokantaan puhelimessa.
- Omien suoritusten videoita ei tallenneta sovellukseen. Käyttäjän kuvaama video jää puhelimen omaan galleriaan sen mukaan, miten hän sen kuvaa.
- **Avoin kohta:** tallennetaanko myös mallivideo puhelimeen liikeradan lisäksi. Katso kohta 10.

### 7.6 Tekninen rakenne

Staattinen sivusto ilman palvelinta ja ilman käännösvaihetta: HTML, CSS ja JavaScript-moduulit. GitHub Pages tarjoilee tiedostot suoraan reposta.

Osat, joilla on selkeä raja:

- **Tunnistus:** kääre MediaPipen ympärille. Sisään kuva, ulos nivelpisteet ja luotettavuus.
- **Liikerata:** videon tai kameravirran muuttaminen aikasarjaksi.
- **Vertailu:** normalisointi, kulmaerot, aikakohdistus, kehonosakohtainen yhteenveto. Puhtaita funktioita ilman selainriippuvuuksia, jotta ne voi testata automaattisesti.
- **Piirto:** tikku-ukot ja värit videon tai kamerakuvan päälle.
- **Tallennus:** kirjaston luku, kirjoitus, vienti ja tuonti.
- **Näkymät:** kohdan 7.4 ruudut.

## 8. Vaiheistus

1. **Vaihe 1:** tunnistus, mallikirjasto lajeineen ja jälkianalyysi. Julkaistaan GitHub Pagesiin, jotta sovellusta voi kokeilla oikealla puhelimella ja oikeilla videoilla.
2. **Vaihe 2:** reaaliaikatila.
3. **Vaihe 3:** viimeistely: kotinäytölle lisääminen, varmuuskopiointi, ohjetekstit.

Vaiheen 1 jälkeen pysähdytään katsomaan, onko vertailu oikealla tanssivideolla hyödyllistä. Jos ei ole, raja-arvoja ja mitattavia suureita säädetään ennen vaihetta 2.

## 9. Testaus

- Vertailulaskennalle automaattiset testit (tunnetut asennot, tunnetut erot, ajallisesti siirretty kopio).
- Jälkianalyysi ajetaan rakennusympäristössä testivideolla, jos selainautomaatio on käytettävissä.
- Reaaliaikatila ja toiminta oikeassa puhelimessa testataan käyttäjän toimesta tarkistuslistan mukaan.

## 10. Avoimet kohdat ja tehdyt valinnat

**Käyttäjän päätettävä:**

- Tallennetaanko mallivideo puhelimeen liikeradan lisäksi? Suositus: kyllä, valinnaisena. Ilman videota reaaliaikatilassa ei kuulu mallin musiikkia, jolloin tahdissa pysyminen pelkän tikku-ukon perusteella on vaikeaa. Video ei tässäkään poistu laitteesta, mutta se vie puhelimen tallennustilaa.

**Rakentajan valinnat (ei käyttäjän päättämiä):**

- Ei sovelluskehystä eikä käännösvaihetta. Peruste: yksinkertaisin julkaista ja ylläpitää.
- Verrataan raajojen suuntia, ei pisteiden paikkoja. Peruste: kestää eri mittasuhteet.
- Lajit kansioina, eivät vaikuta laskentaan. Peruste: mallit tulevat videoista, joten lajikohtaista liikedataa ei ole.
- Oletuslajit Street, Commercial, Hip-hop, Muu. Käyttäjä voi muokata.
- Omien suoritusten videoita ei tallenneta sovellukseen.
- Epävarma tunnistus näytetään harmaana.

**Rakentajalle jää:**

- MediaPipen tarkka pakettivalinta ja mallin koko (kevyt vai täysi) mitattujen suoritusarvojen perusteella.
- Värirajojen tarkat kulma-arvot. Lähtöarvot valitaan ja säädetään vaiheen 1 kokemusten perusteella.
- Ulkoasu ja tiedostorakenne.
- Tunnistuksen ajo erillisessä säikeessä, jos pääsäie ei riitä.

## 11. Tunnetut epävarmuudet

- Reaaliaikaisen tunnistuksen kuvataajuus vanhemmissa puhelimissa.
- iOS:n Safarin käytös kameran, videon käsittelyn ja tallennustilan suhteen.
- Kuinka hyvin kaksiulotteinen vertailu toimii nopeassa street- ja hip-hop-liikkeessä. Tämä selviää vasta oikeilla videoilla vaiheessa 1.
- GitHub Pagesin ehdot ilmaistilille (julkinen repo) on tarkistettava julkaisuvaiheessa.
