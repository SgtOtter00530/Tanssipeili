# Vaihe 1: tehdyt päätökset ja avoimet asiat

Tämä on täydellinen luettelo päätöksistä, jotka tehtiin toteutuksen aikana ilman, että niistä kysyttiin erikseen, sekä tarkastuksen löydöksistä, jotka jätettiin korjaamatta. Jokaisen päätöksen kohdalla on kerrottu, mitä siitä seuraa, jos päätös oli väärä.

Päiväys: 15.11.2026

## 1. Poikkeamat hyväksytystä suunnitelmasta, joilla on merkitystä käyttäjälle

1. **Ajoitus-rivin merkitys muuttui.** Suunnitelmassa rivi kertoi, oliko tanssija mallia edellä vai jäljessä. Riippumaton tarkastus osoitti, että luku oli käytännössä sama kuin käsin tehdyn rajauksen ero. Nyt rivi kertoo vain, muuttuiko tahti pätkän aikana ("tahti pysyi tasaisena", "jäit loppua kohti hieman jälkeen", "nopeutit loppua kohti selvästi"). Jos väärin: tasainen, koko pätkän mittainen myöhästyminen ei näy missään.
2. **Ajallinen kohdistus rakennettiin uudelleen.** Videoiden alkukohdat sovitetaan yhteen yhdellä siirtymällä (enintään 2 s tai 15 % pätkästä). Sen jälkeen aikaa joustetaan enintään 0,5 s (tai 8 % pätkästä), ja joustosta "maksetaan". Alkuperäinen toteutus venytti aikaa niin vapaasti, että se piilotti asentoeroja. Jos väärin: huolimattomasti rajatun lyhyen pätkän reunoilla näkyy enemmän harmaata tai punaista.
3. **Kehonosan arvion ratkaisee heikoin raaja, ja aikajana näyttää kunkin hetken suurimman eron.** Aiemmin yksi koko ajan väärässä asennossa oleva käsi sai arvion "lähellä mallia", koska muut raajat laimensivat sen. Jos väärin: oikealla tanssilla arvio voi tuntua ankaralta ja aikajana punaiselta. Tämä on ensimmäinen asia, joka kannattaa arvioida puhelintestissä.
4. **Tarkkuuden voi vaihtaa myös tulosnäkymässä**, ja tulos säilyy, vaikka näkymästä poistuisi. Mallin vaihto käyttää jo käsiteltyä omaa videota.
5. **Mallin sininen tikku-ukko piirretään leveänä nauhana.** Saman levyisenä se jäi kokonaan oman tikku-ukon alle, kun asennot osuivat kohdakkain. Jos väärin: nauha voi näyttää raskaalta pienessä videossa. Leveys on yksi vakio.
6. **Sivulle lisättiin sisältökäytäntö (CSP)**, joka estää selaimessa kaikki yhteydet muualle kuin sovelluksen omaan osoitteeseen. Suunnitelmassa asia varmistettiin vain testeillä.
7. **Mallin tietoihin lisättiin rajauksen alku ja loppu.** Tallennettu video on koko alkuperäinen tiedosto, ja vaihe 2 tarvitsee tiedon, mikä osa vastaa liikerataa. Jos väärin: käyttämätön kenttä.
8. **Videon tallennus on oletuksena pois päältä, jos tiedosto on yli 150 Mt**, ja tiedoston koko näytetään valinnan yhteydessä.
9. **Sanallista hetkikohtaista palautetta ("vasen käsi oli mallia alempana") ei rakennettu.** Palaute on värit, aikajana ja neljä yhteenvetoriviä. Jos väärin: käyttäjä kaipaa raajakohtaista sanamuotoa. Sopii vaiheeseen 2.

10. **Valitusta videosta tehdään työkopio sovelluksen omaan tallennustilaan** (lisätty ensimmäisen puhelintestin jälkeen). Xiaomin Android-puhelimessa Chrome lakkasi lukemasta valittua tiedostoa kesken käytön (`MEDIA_ELEMENT_ERROR: Format error`). Alkuperäinen päätös oli, ettei omaa videota tallenneta sovellukseen lainkaan. Nyt viimeisin työkopio on laitteessa siihen asti, kun valitaan uusi video tai sovellus avataan uudelleen. Jos väärin: korjaus ei auta, jos puhelin ei anna lukea tiedostoa edes ensimmäisellä kerralla; silloin sovellus sanoo sen suoraan.

11. **Androidissa videon valinta ohittaa järjestelmän kuvavalitsimen** (lisätty toisen puhelintestin lokin perusteella). Loki osoitti, että Chrome sai valitun tiedoston luettua vain hetken valinnan jälkeen, joskus alle 0,1 sekuntia (`NotReadableError`). Tiedostojen nimet olivat pelkkiä numeroita, mikä viittaa Androidin kuvavalitsimen välitystiedostoon; sama vika on kuvattu Chromiumin virheraportissa 40123366 ja useissa muissa projekteissa. Tiedostokentän hyväksyttyihin tyyppeihin lisättiin yksi keksitty tyyppi, jolloin Chrome avaa tavallisen tiedostovalinnan. Lisäksi epäonnistunut luku yritetään kolme kertaa uudelleen, ja lukuvirheen jälkeen tarjotaan valinta tiedostoselaimesta. Jos väärin: valinta näyttää Androidissa erilaiselta kuin ennen eikä vika silti poistu; silloin loki kertoo, mitä valitsinta käytettiin ja missä kohdassa luku katkesi.

## 2. Varmentamatta jääneet korjaukset

Nämä tehtiin tarkastuksen perusteella, mutta niitä ei voitu todentaa tietokoneen selaimella.

1. **iOS:n videonkäsittely.** Tarkastaja arvioi, että iPhonen Safari voi antaa tunnistukselle tyhjän kuvan kelauksen jälkeen. Lisäsin äänettömän toiston käynnistyksen ja odotuksen ennen jokaista tunnistusta. Jos korjaus ei riitä: hyvästä videosta tulee viesti "Videosta ei löytynyt tanssijaa". Puhelintestin lista kysyy tätä.
2. **Näkymien piirto yksi kerrallaan.** Tarkastajan kuvaamaa päällekkäisten näkymien tilannetta ei saatu toistettua testissä kolmella yrityksellä. Muutos jäi varotoimeksi.

## 3. Tunnetut rajat, joita ei voi korjata ohjelmallisesti

1. Jos vain yksi raaja liikkuu tasaisesti ja muu keho on paikallaan, asentoeroa ei voi erottaa ajoituserosta. Sovellus tulkitsee sen ajoitukseksi (enintään 2 s). Oikeassa koreografiassa liikkuu useampi raaja, jolloin tätä ei synny.
2. Värien raja-arvot ja ajallisen jouston määrä ovat lähtöarvauksia. Niitä ei ole säädetty yhdelläkään tanssivideolla.
3. Automaattiset testit ajettiin hitaalla kyykkyvideolla tietokoneen selaimessa. Ne eivät todista, että palaute on hyödyllistä nopeassa tanssissa tai että käsittely on puhelimessa riittävän nopeaa.

## 4. Tekniset päätökset toteutuksen aikana

Näillä ei ole näkyvää vaikutusta käyttöön. Luettelo on mukana täydellisyyden vuoksi.

- Työ tehtiin haarassa `vaihe-1` samassa kloonissa ilman erillistä työpuuta. Repo oli tyhjä.
- Testien yhteiset apumoduulit (`tests/e2e/harness.mjs`, `flows.mjs`, `blank.html`) ja näkymien apumoduulit (`js/ui/dom.js`, `dialog.js`, `stage.js`, `process.js`, `js/core/limits.js`) lisättiin suunnitelman tiedostoluettelon ulkopuolelta.
- Yksikkötestien komento on `node --test tests/unit/*.test.js`. Suunnitelman komento ei toiminut Node 22:ssa.
- Kahdesti peilatun asennon testi käyttää toleranssia, koska liukuluvuilla 1 − (1 − x) ei ole täsmälleen x.
- Analyysi laskee raajojen kulmat kerran etukäteen ja kohdistaa niiden perusteella. Tulos on sama, muistia kuluu vähemmän.
- Tallennustilan loppuminen testataan simuloimalla selaimen virhe. Oikeaa tilan loppumista ei voi tuottaa testissä. Jos oikea selain ilmoittaa asian eri tavalla, virheviesti voi olla yleisempi.
- Viivan paksuuserot (punainen > keltainen > vihreä) todennetaan 720 pikseliä leveässä kuvassa. 360 pikselin kuvassa keltainen ja vihreä ovat saman paksuisia.
- Asetuksen tallennus vahvistetaan heti. Testi osoitti, että juuri ennen sivun sulkemista tehty muutos saattoi kadota.
- Rajauksen vähimmäispituus on 1 s, ja peruutettu käsittely palauttaa aiemman rajauksen.
- Esikatselu- ja tulosnäkymässä näkyi irrallinen teksti "null". Se löytyi kuvakaappauksista. Korjattu, ja asialle on nyt testi.
- Testiselaimelta estettiin sen omat taustayhteydet. Chrome itse yritti kerran yhteyttä Googlen palveluun; sovelluksen sivu ei tehnyt ulkoisia pyyntöjä kertaakaan.

## 5. Tarkastuksen löydökset, jotka korjattiin

Riippumaton tarkastaja kävi koko koodin läpi. Arvio: valmis korjausten jälkeen, ei kriittisiä löydöksiä, seitsemän tärkeää.

1. Ajallinen kohdistus piilotti asentoeroja ja keksi ajoitusvirheitä. Korjattu (kohdat 1.1 ja 1.2).
2. Koko ajan väärässä asennossa oleva raaja sai arvion "lähellä mallia". Korjattu (kohta 1.3).
3. Näyttö saattoi sammua kesken käsittelyn, jolloin käsittely katkesi. Näyttö pidetään nyt päällä.
4. iOS saattaa antaa tunnistukselle tyhjän kuvan. Varotoimi lisätty, ei varmennettu (kohta 2.1).
5. Koko alkuperäinen video tallennettiin huomaamatta. Koko näytetään, suuri tiedosto ei tallennu oletuksena, ja epäonnistunut tallennus neuvoo kokeilemaan ilman videota.
6. Tulosnäkymästä poistuminen hävitti tuloksen. Korjattu (kohta 1.4).
7. Tunnistuksen tai tietokannan virheestä ei toivuttu ilman sivun uudelleenlatausta. Korjattu.

Lisäksi korjattiin neljä pienempää löydöstä, koska niihin törmäisi tavallisessa käytössä: toisto karkasi rajatun pätkän ulkopuolelle videon lopussa, kuvan ulkopuolelle arvatut nivelet saivat värin harmaan sijasta, ja kohdat 1.6 sekä 2.2.

## 6. Tarkastuksen löydökset, joita ei korjattu

Nämä ovat pieniä. Ne voi ottaa mukaan vaiheeseen 2 tai jättää pois.

1. Toiston liukusäädin lakkaa seuraamasta toistoa, kun siihen on koskettu.
2. Hyvin pitkässä pätkässä aikajanan palkit ovat alle pikselin levyisiä. Ne pitäisi niputtaa noin sataan.
3. Keltainen ja vihreä viiva eroavat pienessä videossa vain väriltään.
4. Kohdistusta ei siirretä otsikkoon näkymän vaihtuessa (ruudunlukijan käyttäjät).
5. Tunnistuksen seurantatilaa ei nollata videoiden välillä. Uuden videon ensimmäiset kuvat voivat tunnistua heikommin.
6. Kirjaston listaus lataa jokaisen mallin koko liikeradan. Hidastuu, kun malleja on paljon.
7. Suoraan kameraa kohti osoittava, kuvassa hyvin lyhyeltä näyttävä raaja pitäisi merkitä tuntemattomaksi.
8. Yksityisessä selaustilassa selain voi avata väliaikaisen tietokannan, jolloin varoitus tallennuksesta ei näy.
9. Hyvin vanha selain näyttää tyhjän sivun ilman selitystä.
10. Kelausta, joka aikakatkeaa sivun oltua piilossa, ei yritetä uudelleen.
