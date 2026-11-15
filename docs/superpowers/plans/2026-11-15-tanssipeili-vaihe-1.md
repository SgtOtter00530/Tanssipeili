# Tanssipeili, vaihe 1 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selaimessa toimiva sovellus, jossa nuori tuo mallivideon kirjastoon lajin alle ja vertaa omaa videotaan siihen tikku-ukkojen, värien, aikajanan ja kehonosayhteenvedon avulla. Julkaistaan GitHub Pagesiin.

**Architecture:** Staattinen sivusto ilman palvelinta ja käännösvaihetta. Laskenta (`js/core/`) on puhtaita funktioita ilman selainriippuvuuksia ja testataan Nodella. Selainosat (tunnistus, tallennus, piirto, näkymät) testataan päättömällä Chromella oikealla testivideolla.

**Tech Stack:** HTML, CSS, JavaScript-moduulit (ES2022). MediaPipe Pose `@mediapipe/pose` 0.5.1675469404 repoon kopioituna. IndexedDB. Testit: `node --test` ja Playwright + Chrome.

**Spec:** `docs/superpowers/specs/2026-11-15-tanssipeili-design.md`

**Rajaus:** Tämä suunnitelma kattaa speksin vaiheen 1. Reaaliaikatila (vaihe 2) sekä kotinäytölle lisääminen ja varmuuskopiointi (vaihe 3) saavat omat suunnitelmansa vaiheen 1 arvioinnin jälkeen.

## Global Constraints

- Ajon aikana ei yhtään pyyntöä muualle kuin sovelluksen omaan osoitteeseen. Ei CDN-linkkejä, ei verkkofontteja, ei analytiikkaa.
- Videokuva ja liikeradat eivät poistu laitteesta.
- Käyttöliittymän kieli on suomi. Koodin tunnisteet englanniksi.
- Palaute on kuvailevaa. Ei arvosanoja, prosentteja eikä numeerista pisteytystä näkyvissä.
- Epävarma tunnistus (`v < 0.5`) näytetään harmaana, ei koskaan punaisena.
- Väri ei ole ainoa vihje: viivan paksuus ja kuvio tukevat sitä.
- Ei sovelluskehystä, ei paketointityökalua. Kaikki polut suhteellisia, koska sivusto on osoitteessa `https://sgtotter00530.github.io/Tanssipeili/`.
- Analyysin kuvataajuus on 10 kuvaa sekunnissa (`ANALYSIS_FPS = 10`) sekä mallille että omalle suoritukselle.
- Rajatun pätkän enimmäispituus 120 s (`MAX_CLIP_SECONDS = 120`).
- Mallivideon tallennus puhelimeen liikeradan lisäksi on valinnainen ja oletuksena päällä (käyttäjä hyväksyi suosituksen suunnitelman mukana).
- Työ tehdään haarassa `vaihe-1`. Jokaisen commitin viesti päättyy riveihin `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` ja `Claude-Session: https://claude.ai/code/session_01UwTC3j1PcJzwz6RPBePSTQ`.

**Varmistettu ennen suunnitelmaa (kokeilu, ei tuotantokoodia):** `@mediapipe/pose` käynnistyy paikallisesti tarjoiltuna päättömässä Chromessa, löytää testikuvasta 33 pistettä näkyvyysarvoineen eikä tee yhtään ulkoista pyyntöä. Testiaineistoksi kelpaa `tensorflow/tfjs-models`-repon `pose-detection/test_data/pose.jpg` ja `pose_squats.mp4` (720×1280, 13 s, Apache-2.0).

## Review Focus

1. **Video, josta ei löydy tanssijaa tai keho on osin kuvan ulkopuolella.** Odotus: selkeä viesti tai harmaat nivelet, ei kaatumista eikä punaista. → Task 4, Task 3.
2. **Oma video alkaa ja loppuu eri kohdassa kuin malli** (käveleminen paikalle ennen tanssia). Odotus: käyttäjä voi rajata myös oman videonsa, ja pieni ajoitusero ei värjää kaikkea punaiseksi. → Task 3, Task 9.
3. **Video, jota selain ei osaa avata** (esim. iPhonen HEVC Androidissa, tai tiedosto ei ole video). Odotus: suomenkielinen virheviesti, paluu valintaan. → Task 4.
4. **Liian pitkä tai raskas video.** Odotus: rajaus pakotetaan 120 sekuntiin, käsittelyn eteneminen näkyy ja sen voi perua. → Task 4, Task 8.
5. **Tallennus ei onnistu** (yksityinen selaus, tila täynnä). Odotus: sovellus toimii ilman pysyvää kirjastoa ja kertoo sen; täysi tila ei hävitä aiempia malleja. → Task 5.

## File Structure

```
index.html                 kuori, näkymien juurielementti, moduulin lataus
css/app.css                kaikki tyylit
js/app.js                  käynnistys, hash-reititys, jaettu konteksti
js/core/skeleton.js        pisteindeksit, segmentit, ryhmät, peilaus
js/core/compare.js         kulmat, erot, tasot, kynnysarvot
js/core/normalize.js       mallin tikku-ukon sovitus tanssijan kehoon
js/core/dtw.js             ajallinen kohdistus
js/core/analysis.js        kokonaisanalyysi: aikajana, ryhmät, ajoitus
js/core/track.js           liikeradan rajaus ja peilaus
js/pose/engine.js          MediaPipe-kääre
js/pose/extract.js         videotiedosto → liikerata
js/store/db.js             IndexedDB + muistivaraversio
js/render/overlay.js       tikku-ukon piirto canvasiin
js/ui/library.js           kirjasto ja lajien hallinta
js/ui/trim.js              jaettu rajauskomponentti
js/ui/add-reference.js     mallin lisäys
js/ui/analyze.js           jälkianalyysi
js/ui/settings.js          tarkkuus ja tietoa-teksti
js/ui/copy.js              kaikki käyttöliittymätekstit yhdessä paikassa
vendor/mediapipe-pose/     MediaPipen tiedostot (ilman 27 Mt:n heavy-mallia)
tools/serve.mjs            staattinen testipalvelin
tests/unit/*.test.js       node --test
tests/e2e/*.e2e.mjs        Playwright
tests/fixtures/            pose.jpg, pose_squats.mp4, LICENSE-NOTICE.md
package.json               vain kehitysskriptit
.nojekyll                  GitHub Pages tarjoilee tiedostot sellaisenaan
```

**Yhteiset tyypit** (JSDoc-tyyppeinä tiedostossa `js/core/skeleton.js`):

```js
/** @typedef {{x:number, y:number, v:number}} Landmark   x,y 0..1 kuvan koordinaateissa, v näkyvyys 0..1 */
/** @typedef {{t:number, lm:(Landmark[]|null)}} Frame    lm null = ei löytynyt henkilöä */
/** @typedef {{fps:number, width:number, height:number, frames:Frame[]}} Track */
/** @typedef {'salliva'|'normaali'|'tarkka'} Strictness */
/** @typedef {'green'|'yellow'|'red'|'unknown'} Level */
/** @typedef {{id:string, name:string, order:number}} Style */
/** @typedef {{id:string, name:string, styleId:string, mirrored:boolean, track:Track, video:(Blob|null), createdAt:string}} Reference */
```

`Reference.track` tallennetaan jo rajattuna ja peilattuna.

---

### Task 1: Runko, MediaPipe repoon ja tunnistuskääre

**Files:**
- Create: `package.json`, `.nojekyll`, `tools/serve.mjs`, `index.html`, `js/pose/engine.js`, `vendor/mediapipe-pose/*`, `tests/fixtures/pose.jpg`, `tests/fixtures/pose_squats.mp4`, `tests/fixtures/LICENSE-NOTICE.md`
- Test: `tests/e2e/engine.e2e.mjs`

**Interfaces:**
- Produces: `startServer(rootDir: string, port?: number): Promise<{url: string, close(): Promise<void>}>` (`tools/serve.mjs`); `createEngine(opts?: {modelComplexity?: 0|1}): Promise<{detect(source: HTMLVideoElement|HTMLImageElement|HTMLCanvasElement): Promise<Landmark[]|null>, close(): void}>` (`js/pose/engine.js`).

- [ ] **Step 1:** Luo `package.json` skripteillä `test:unit` = `node --test tests/unit/`, `test:e2e` = `node tests/e2e/run-all.mjs`, `serve` = `node tools/serve.mjs`. `devDependencies`: `playwright ^1.63.0`. Kopioi `vendor/mediapipe-pose/`-kansioon npm-paketin `@mediapipe/pose@0.5.1675469404` tiedostot paitsi `pose_landmark_heavy.tflite`, `README.md`, `index.d.ts`, `package.json`. Hae testiaineisto ja kirjaa lähde ja lisenssi tiedostoon `LICENSE-NOTICE.md`.
- [ ] **Step 2:** Kirjoita `tools/serve.mjs`: Noden `http`-moduulilla, oikeat MIME-tyypit päätteille `.js .mjs .css .html .wasm .mp4 .jpg .data .tflite .binarypb`, tuki `Range`-pyynnöille (videon kelaus vaatii sen).
- [ ] **Step 3: Kirjoita kaatuva testi** `tests/e2e/engine.e2e.mjs`: avaa sivun, lataa `pose.jpg`:n `<img>`-elementtiin, kutsuu `createEngine()` ja `detect(img)`.

```js
assert.equal(result.length, 33);
assert.ok(result[0].v > 0.9);                       // nenä näkyy
assert.deepEqual(Object.keys(result[0]).sort(), ['v', 'x', 'y']);
assert.equal(externalRequests.length, 0);           // ei pyyntöjä palvelimen ulkopuolelle
```

Chromen polku ympäristömuuttujasta `CHROME_PATH`, muuten Playwrightin oletus. `run-all.mjs` ajaa kaikki `*.e2e.mjs`-tiedostot peräkkäin ja palauttaa virhekoodin, jos yksikin kaatuu.

- [ ] **Step 4:** Aja `CHROME_PATH=/usr/bin/google-chrome npm run test:e2e`. Odotus: FAIL, `createEngine` puuttuu.
- [ ] **Step 5:** Toteuta `createEngine`. Lataa `vendor/mediapipe-pose/pose.js` kerran `<script>`-elementillä (klassinen skripti, globaali `Pose`), `locateFile` osoittaa `vendor/mediapipe-pose/`-kansioon `import.meta.url`:n suhteen. Asetukset: `smoothLandmarks: false`, `minDetectionConfidence: 0.5`, `minTrackingConfidence: 0.5`. `detect` palauttaa `null`, jos `poseLandmarks` puuttuu, muuten 33 alkiota muodossa `{x, y, v: visibility}`.
- [ ] **Step 6:** Aja testi. Odotus: PASS.
- [ ] **Step 7:** Commit `feat: project scaffold and pose engine wrapper`.

### Task 2: Luuranko, kulmat ja tasot

**Files:**
- Create: `js/core/skeleton.js`, `js/core/compare.js`, `tests/unit/helpers.js`
- Test: `tests/unit/skeleton.test.js`, `tests/unit/compare.test.js`

**Interfaces:**
- Produces (`skeleton.js`): `LM` (indeksit: `NOSE 0, L_SHOULDER 11, R_SHOULDER 12, L_ELBOW 13, R_ELBOW 14, L_WRIST 15, R_WRIST 16, L_HIP 23, R_HIP 24, L_KNEE 25, R_KNEE 26, L_ANKLE 27, R_ANKLE 28`); `SEGMENTS: {id, from, to, group}[]` kymmenellä segmentillä `lUpperArm, lForearm, rUpperArm, rForearm` (group `arms`), `lThigh, lShin, rThigh, rShin` (`legs`), `torso` (`hipCenter`→`shoulderCenter`), `head` (`shoulderCenter`→`NOSE`) (`core`); `DRAW_EXTRA` = hartialinja ja lantiolinja; `point(lm, ref): Landmark` (virtuaalipisteen `v` on parin pienempi); `mirrorLandmarks(lm): Landmark[]`.
- Produces (`compare.js`): `MIN_VIS = 0.5`; `THRESHOLDS = {salliva: {green: 25, yellow: 45}, normaali: {green: 15, yellow: 30}, tarkka: {green: 10, yellow: 20}}` (asteita); `segmentAngle(lm, seg, aspect): number|null`; `angleDiff(a, b): number`; `compareFrames(userLm, refLm, userAspect, refAspect): Record<string, number|null>`; `levelOf(diff: number|null, strictness): Level`; `frameCost(diffs): number`.
- Produces (`tests/unit/helpers.js`): `poseFromAngles(angles: Record<segId, number>, opts?: {v?: number, hidden?: number[]}): Landmark[]` rakentaa 33 pisteen asennon annetuista segmenttikulmista (oletus: seisova asento, kädet alhaalla).

- [ ] **Step 1: Kirjoita kaatuvat testit.**

```js
// skeleton
const m = mirrorLandmarks(pose);
assert.equal(m[LM.L_WRIST].x, 1 - pose[LM.R_WRIST].x);
assert.equal(m[LM.L_WRIST].y, pose[LM.R_WRIST].y);
assert.deepEqual(mirrorLandmarks(m), pose);                    // kahdesti peilattu = alkuperäinen
assert.equal(SEGMENTS.length, 10);

// compare
assert.equal(angleDiff(350, 10), 20);
assert.equal(angleDiff(0, 180), 180);
const a = poseFromAngles({});
const b = poseFromAngles({ lUpperArm: 60 });                   // 60° eri kuin oletus
const d = compareFrames(a, b, 9 / 16, 9 / 16);
assert.ok(Math.abs(d.lUpperArm - 60) < 1);
assert.ok(d.rThigh < 1);
// kuvasuhde: sama asento eri kuvasuhteessa antaa silti nollaeron
assert.ok(compareFrames(a, a, 9 / 16, 9 / 16).torso < 1);
// piilossa oleva ranne: kyynärvarsi on tuntematon, ei punainen
const hidden = poseFromAngles({}, { hidden: [LM.L_WRIST] });
assert.equal(compareFrames(hidden, b, 1, 1).lForearm, null);
assert.equal(levelOf(null, 'normaali'), 'unknown');
assert.equal(levelOf(15, 'normaali'), 'green');
assert.equal(levelOf(15.1, 'normaali'), 'yellow');
assert.equal(levelOf(30.1, 'normaali'), 'red');
assert.equal(levelOf(24, 'salliva'), 'green');
assert.equal(levelOf(11, 'tarkka'), 'yellow');
assert.equal(frameCost({ a: 10, b: 30, c: null }), 20);
assert.equal(frameCost({ a: null }), 90);
```

- [ ] **Step 2:** Aja `npm run test:unit`. Odotus: FAIL.
- [ ] **Step 3:** Toteuta. Kulma: `atan2(dy, dx * aspect)` asteina, missä `aspect = width / height` (normalisoidut koordinaatit ovat akselikohtaisia, joten x pitää skaalata). `mirrorLandmarks` vaihtaa kaikki vasen–oikea-parit (1↔4, 2↔5, 3↔6, 7↔8, 9↔10 ja parittomat↔parilliset välillä 11–32) ja asettaa `x = 1 - x`.
- [ ] **Step 4:** Aja testit. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: skeleton definitions and angle comparison`.

### Task 3: Kohdistus, sovitus ja kokonaisanalyysi

**Files:**
- Create: `js/core/dtw.js`, `js/core/normalize.js`, `js/core/track.js`, `js/core/analysis.js`
- Test: `tests/unit/dtw.test.js`, `tests/unit/normalize.test.js`, `tests/unit/analysis.test.js`

**Interfaces:**
- Consumes: Task 2:n `compareFrames`, `frameCost`, `levelOf`, `SEGMENTS`, `mirrorLandmarks`, `point`.
- Produces: `alignTracks(userFrames: Frame[], refFrames: Frame[], cost: (u: Frame, r: Frame) => number, opts?: {band?: number}): Int32Array` (alkio `i` = käyttäjän kuvaa `i` vastaava mallin kuvan indeksi; `band` oletus 0.25); `projectReference(refLm, refAspect, userLm, userAspect): Landmark[]|null`; `sliceTrack(track, startSec, endSec): Track` (ajat alkamaan nollasta); `mirrorTrack(track): Track`; `analyze(userTrack: Track, refTrack: Track, strictness: Strictness): Analysis`.

```js
/** @typedef {{dots: 0|1|2|3|4, label: string}} GroupRating */
/** @typedef {{
 *   map: Int32Array,
 *   perFrame: {diffs: Record<string, number|null>, levels: Record<string, Level>, mean: number|null}[],
 *   timeline: (number|null)[],
 *   groups: {arms: GroupRating, legs: GroupRating, core: GroupRating},
 *   timing: {medianLagSec: number, label: string},
 *   detectedShare: number
 * }} Analysis */
```

Säännöt (rakentajan valintoja, säädetään vaiheen 1 kokemusten perusteella):
- Ryhmän arvio: vihreiden osuus ryhmän tunnetuista segmenttihavainnoista. ≥ 0,85 → 4 pistettä, ≥ 0,65 → 3, ≥ 0,40 → 2, muuten 1. Tekstit: 4 ja 3 `lähellä mallia`, 2 `eroja`, 1 `paljon eroja`. Jos tunnettuja on alle 30 % ryhmän havainnoista: 0 pistettä, `ei pystytty arvioimaan`.
- Ajoitus: `lag = t_user(i) - t_ref(map[i])`, mediaani yli kuvien. |mediaani| < 0,15 s → `tahdissa`; 0,15–0,4 s → `hieman jäljessä` tai `hieman edellä`; yli 0,4 s → `selvästi jäljessä` tai `selvästi edellä`. Positiivinen = jäljessä.
- `detectedShare` = niiden käyttäjän kuvien osuus, joissa `lm !== null`.
- Kustannus kuvalle, jossa jommankumman `lm` on `null`: 90.

- [ ] **Step 1: Kirjoita kaatuvat testit.**

```js
// dtw: malli on sama liike, mutta käyttäjä pitää alussa 5 kuvan tauon
const ref = sweepTrack(40);                         // käsi nousee tasaisesti 40 kuvassa
const user = { ...ref, frames: [...repeat(ref.frames[0], 5), ...ref.frames].map(retime) };
const map = alignTracks(user.frames, ref.frames, cost);
assert.equal(map.length, user.frames.length);
assert.equal(map[0], 0);
assert.equal(map[map.length - 1], ref.frames.length - 1);
for (let i = 1; i < map.length; i++) assert.ok(map[i] >= map[i - 1]);   // ei kulje taaksepäin
assert.ok(Math.abs(map[25] - 20) <= 1);             // tauon jälkeen kohdistus osuu oikeaan kuvaan

// normalize: malli kaksi kertaa kauempana ja sivussa → sovitettu ukko osuu käyttäjän päälle
const p = projectReference(shrinkAndShift(pose, 0.5, 0.2), 9 / 16, pose, 9 / 16);
assert.ok(Math.abs(p[LM.L_WRIST].x - pose[LM.L_WRIST].x) < 0.01);
assert.ok(Math.abs(p[LM.L_ANKLE].y - pose[LM.L_ANKLE].y) < 0.01);
assert.equal(projectReference(pose, 1, poseFromAngles({}, { hidden: [LM.L_HIP] }), 1), null);

// analysis: sama rata itseään vastaan
const same = analyze(ref, ref, 'normaali');
assert.equal(same.groups.arms.dots, 4);
assert.equal(same.groups.arms.label, 'lähellä mallia');
assert.equal(same.timing.label, 'tahdissa');
// 0,5 s myöhässä → ajoitus kertoo sen, kädet pysyvät vihreinä
const late = analyze(user, ref, 'normaali');
assert.equal(late.groups.arms.dots, 4);
assert.match(late.timing.label, /jäljessä/);
// käsi 60° väärin koko ajan → kädet eivät ole lähellä, jalat ovat
const off = analyze(offsetTrack(ref, { lUpperArm: 60, lForearm: 60, rUpperArm: 60, rForearm: 60 }), ref, 'normaali');
assert.ok(off.groups.arms.dots <= 1);
assert.equal(off.groups.legs.dots, 4);
// puolet kuvista ilman henkilöä → ei kaadu, osuus raportoidaan
const gaps = analyze(withNullFrames(ref, 0.5), ref, 'normaali');
assert.ok(Math.abs(gaps.detectedShare - 0.5) < 0.05);
// jalat piilossa koko ajan → arvio on "ei pystytty arvioimaan", ei "paljon eroja"
const noLegs = analyze(hideLegs(ref), ref, 'normaali');
assert.equal(noLegs.groups.legs.dots, 0);
assert.equal(noLegs.groups.legs.label, 'ei pystytty arvioimaan');
// rajaus
assert.equal(sliceTrack(ref, 1, 3).frames[0].t, 0);
assert.equal(sliceTrack(ref, 1, 3).frames.length, 20);
```

Testin apufunktiot (`sweepTrack`, `offsetTrack`, `withNullFrames`, `hideLegs`, `shrinkAndShift`) lisätään tiedostoon `tests/unit/helpers.js` `poseFromAngles`in päälle.

- [ ] **Step 2:** Aja `npm run test:unit`. Odotus: FAIL.
- [ ] **Step 3:** Toteuta. `alignTracks`: tavallinen dynaaminen aikakohdistus, alku kohdistuu alkuun ja loppu loppuun, Sakoe–Chiba-kaista `band × max(n, m)` diagonaalin ympärillä; kun yhtä käyttäjän kuvaa vastaa usea mallin kuva, valitaan polun viimeinen. `projectReference`: siirrä lantion keskipisteet kohdakkain ja skaalaa vartalon pituudet (lantion keskipiste → hartioiden keskipiste) yhtä suuriksi, kuvasuhteet huomioiden.
- [ ] **Step 4:** Aja testit. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: time alignment, reference projection and analysis summary`.

### Task 4: Videosta liikeradaksi

**Files:**
- Create: `js/pose/extract.js`
- Test: `tests/e2e/extract.e2e.mjs`, `tests/fixtures/not-a-video.mp4` (tekstitiedosto väärällä päätteellä), `tests/fixtures/no-person.mp4` (ffmpegillä tehty 2 s yksivärinen video)

**Interfaces:**
- Consumes: Task 1:n `createEngine`.
- Produces: `probeVideo(file: Blob): Promise<{duration: number, width: number, height: number}>`; `extractTrack(file: Blob, engine, opts: {start?: number, end?: number, fps?: number, onProgress?: (done: number, total: number) => void, signal?: AbortSignal}): Promise<Track>`; `class ExtractError extends Error { code: 'unsupported'|'too-long'|'aborted' }`; `MAX_CLIP_SECONDS = 120`; `ANALYSIS_FPS = 10`.

- [ ] **Step 1: Kirjoita kaatuva testi.** Sivulla tiedosto haetaan `fetch`illä Blobiksi ja annetaan funktioille.

```js
// pose_squats.mp4, väli 2–6 s
assert.equal(track.fps, 10);
assert.equal(track.frames.length, 40);
assert.equal(track.width, 720); assert.equal(track.height, 1280);
assert.ok(track.frames.filter(f => f.lm).length >= 36);        // henkilö löytyy vähintään 90 %:ssa
assert.ok(Math.abs(track.frames[10].t - 1.0) < 0.001);
assert.ok(progressCalls.length >= 40 && progressCalls.at(-1)[0] === 40);
// ei-video
assert.equal(await codeOf(() => probeVideo(notAVideo)), 'unsupported');
// liian pitkä väli
assert.equal(await codeOf(() => extractTrack(squats, engine, { start: 0, end: 121 })), 'too-long');
// peruutus kesken
assert.equal(await codeOf(() => extractTrack(squats, engine, { signal: abortedAfter(3) })), 'aborted');
// video ilman ihmistä: ei virhettä, kaikki kuvat null
assert.ok(noPerson.frames.every(f => f.lm === null));
```

- [ ] **Step 2:** Aja `npm run test:e2e`. Odotus: FAIL.
- [ ] **Step 3:** Toteuta. Piilotettu `<video muted playsinline>` object-URL:lla; jokaiselle ajanhetkelle `start + i / fps` aseta `currentTime`, odota `seeked`, kutsu `engine.detect(video)`. `end` rajataan videon kestoon. `error`-tapahtuma tai 10 s ilman `loadedmetadata`-tapahtumaa → `unsupported`. Object-URL vapautetaan aina lopuksi.
- [ ] **Step 4:** Aja testi. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: extract pose track from video file`.

### Task 5: Tallennus

**Files:**
- Create: `js/store/db.js`
- Test: `tests/e2e/store.e2e.mjs`

**Interfaces:**
- Produces: `openStore(opts?: {forceMemory?: boolean}): Promise<Store>`, jossa `Store = {persistent: boolean, listStyles(): Promise<Style[]>, saveStyle(s: Style): Promise<void>, deleteStyle(id: string): Promise<void>, listReferences(styleId?: string): Promise<Omit<Reference,'video'>[]>, getReference(id: string): Promise<Reference|null>, saveReference(r: Reference): Promise<void>, deleteReference(id: string): Promise<void>, getSettings(): Promise<{strictness: Strictness}>, saveSettings(s): Promise<void>}`; `class StoreFullError extends Error`.

Säännöt: ensimmäisellä avauksella luodaan lajit `street` "Street", `commercial` "Commercial", `hiphop` "Hip-hop", `muu` "Muu" järjestyksessä 0–3. Lajia `muu` ei voi poistaa (`deleteStyle('muu')` hylkää). Poistetun lajin mallit siirtyvät lajiin `muu`. Oletusasetus `strictness: 'normaali'`. Jos IndexedDB ei aukea, palautetaan muistissa toimiva versio, jossa `persistent === false`. `QuotaExceededError` muunnetaan `StoreFullError`iksi, eikä epäonnistunut tallennus muuta olemassa olevia tietoja.

- [ ] **Step 1: Kirjoita kaatuva testi.**

```js
assert.deepEqual((await s.listStyles()).map(x => x.id), ['street', 'commercial', 'hiphop', 'muu']);
await s.saveReference(refA);                                   // styleId 'street', video: Blob
assert.equal((await s.listReferences('street')).length, 1);
assert.equal('video' in (await s.listReferences())[0], false); // listaus ei lataa videoita
assert.equal((await s.getReference(refA.id)).video.size, refA.video.size);
await s.saveStyle({ id: 'oma', name: 'Oma laji', order: 4 });
await s.saveReference({ ...refB, styleId: 'oma' });
await s.deleteStyle('oma');
assert.equal((await s.getReference(refB.id)).styleId, 'muu');
await assert.rejects(() => s.deleteStyle('muu'));
// säilyy sivun uudelleenlatauksen yli
await page.reload(); assert.equal((await reopened.listReferences()).length, 2);
// muistiversio
const mem = await openStore({ forceMemory: true });
assert.equal(mem.persistent, false);
assert.equal((await mem.listStyles()).length, 4);
assert.equal((await mem.getSettings()).strictness, 'normaali');
```

- [ ] **Step 2:** Aja testi. Odotus: FAIL.
- [ ] **Step 3:** Toteuta. Tietokanta `tanssipeili`, versio 1, säilöt `styles`, `references` (indeksi `styleId`), `videos` (avain = mallin id, jotta listaus ei lataa blobeja), `settings`.
- [ ] **Step 4:** Aja testi. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: on-device library storage`.

### Task 6: Tikku-ukon piirto

**Files:**
- Create: `js/render/overlay.js`
- Test: `tests/e2e/overlay.e2e.mjs`

**Interfaces:**
- Consumes: `SEGMENTS`, `DRAW_EXTRA`, `point`, `MIN_VIS`.
- Produces: `drawSkeleton(ctx: CanvasRenderingContext2D, lm: Landmark[], opts: {width: number, height: number, levels?: Record<string, Level>|null, variant: 'user'|'ghost'}): void`; `COLORS = {green: '#2ecc71', yellow: '#f1c40f', red: '#e74c3c', unknown: '#9aa0a6', ghost: 'rgba(80,160,255,0.75)'}`.

Säännöt: viivan perusleveys `max(3, width / 120)`. Vihreä yhtenäinen 1×, keltainen yhtenäinen 1,3×, punainen yhtenäinen 1,6× ja rengas nivelpallon ympärillä, tuntematon katkoviiva 1×. Nivelpallo saa siihen liittyvistä tunnetuista segmenteistä huonoimman tason; jos kaikki tuntemattomia, harmaa. Segmenttiä ei piirretä lainkaan, jos sen päätepisteen `v < MIN_VIS` ja `variant === 'ghost'`. Ilman `levels`-arvoa `user` piirretään valkoisena tummalla reunuksella.

- [ ] **Step 1: Kirjoita kaatuva testi.** Piirrä 360×640-canvasiin tunnettu asento, jossa `lUpperArm` on `red` ja `rThigh` `green`, ja lue pikselit segmenttien keskikohdista.

```js
assert.ok(isClose(pixelAtMid('lUpperArm'), [231, 76, 60]));
assert.ok(isClose(pixelAtMid('rThigh'), [46, 204, 113]));
assert.ok(strokeWidthAt('lUpperArm') > strokeWidthAt('rThigh'));   // punainen on paksumpi
assert.equal(nonTransparentPixels(drawGhostWithHiddenLegs()), nonTransparentPixels(drawGhostUpperBodyOnly()));
```

- [ ] **Step 2:** Aja testi. Odotus: FAIL.
- [ ] **Step 3:** Toteuta.
- [ ] **Step 4:** Aja testi. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: skeleton overlay renderer`.

### Task 7: Kuori, kirjasto, lajit ja asetukset

**Files:**
- Create: `css/app.css`, `js/app.js`, `js/ui/copy.js`, `js/ui/library.js`, `js/ui/settings.js`
- Modify: `index.html`
- Test: `tests/e2e/library.e2e.mjs`

**Interfaces:**
- Consumes: `openStore`, `createEngine`.
- Produces: näkymäsopimus `render(root: HTMLElement, ctx: AppContext): (() => void) | void` (palautusarvo on siivousfunktio); `AppContext = {store: Store, navigate(hash: string, params?: object): void, getEngine(): Promise<Engine>, params: object}`; reitit `#kirjasto` (oletus), `#lisaa-malli`, `#analysoi`, `#asetukset`; `COPY`-olio tiedostossa `js/ui/copy.js`.

Kiinnitetyt tekstit (`COPY`):

| Avain | Teksti |
|---|---|
| `honesty` | Tanssipeili vertaa liikettäsi valitsemaasi mallivideoon. Se ei arvioi, onko tanssi oikein tai hyvää – vain kuinka lähellä mallia olet. |
| `filmingGuide` | Kuvaa samasta kulmasta kuin malli. Koko keho näkyviin, puhelin tukevasti paikallaan, hyvä valo. |
| `noPerson` | Videosta ei löytynyt tanssijaa. Tarkista, että koko keho näkyy ja valoa on riittävästi. |
| `unsupported` | Tätä videota ei voitu avata. Kokeile toista tiedostoa tai kuvaa video uudelleen puhelimen kameralla. |
| `tooLong` | Rajaa pätkä enintään 2 minuutin mittaiseksi. |
| `notPersistent` | Kirjastoa ei voitu tallentaa tähän selaimeen. Mallit säilyvät vain tämän käyttökerran ajan. |
| `storeFull` | Tallennustila ei riittänyt. Kokeile tallentaa malli ilman videota. |
| `privacy` | Videot ja liikeradat pysyvät tässä puhelimessa. Sovellus ei lähetä mitään verkkoon. |
| `emptyStyle` | Tässä lajissa ei ole vielä malleja. |

Ulkoasu: tumma tausta, yksi korostusväri, järjestelmäfontti, kosketuskohteet vähintään 44 px, alareunassa navigaatio (Kirjasto, Analysoi, Asetukset). `prefers-reduced-motion` huomioidaan. Kirjastossa lajit vaakasuuntaisena valikkona, valitun lajin mallit listana (nimi, kesto, peilattu-merkintä, poisto vahvistuksella sivun omassa dialogissa), painike "Lisää malli" ja lajien muokkaus (lisää, nimeä uudelleen, poista). `getEngine()` luo moottorin vasta ensimmäisellä kutsulla ja palauttaa saman jatkossa.

- [ ] **Step 1: Kirjoita kaatuva testi.**

```js
await page.goto(url);
await expectText('nav', ['Kirjasto', 'Analysoi', 'Asetukset']);
await expectStyles(['Street', 'Commercial', 'Hip-hop', 'Muu']);
await expectVisible(COPY.emptyStyle);
await addStyle('Dancehall'); await expectStyles(['Street', 'Commercial', 'Hip-hop', 'Muu', 'Dancehall']);
await page.reload(); await expectStyles([... 'Dancehall']);            // säilyy
await deleteStyle('Dancehall');
assert.equal(await canDelete('Muu'), false);
await page.goto(url + '#asetukset');
await expectVisible(COPY.honesty); await expectVisible(COPY.privacy);
await selectStrictness('tarkka'); await page.reload();
assert.equal(await selectedStrictness(), 'tarkka');
assert.equal(externalRequests.length, 0);
assert.ok(await minTouchTargetPx('button, a, select') >= 44);
// 360 px leveä näkymä ei vieritä sivusuunnassa
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 360), true);
```

- [ ] **Step 2:** Aja testi. Odotus: FAIL.
- [ ] **Step 3:** Toteuta. Reititys `hashchange`-tapahtumalla; tuntematon hash näyttää kirjaston. Jos `store.persistent === false`, kuoren yläreunassa näkyy `COPY.notPersistent`.
- [ ] **Step 4:** Aja testi. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: app shell, library, styles and settings`.

### Task 8: Mallin lisäys

**Files:**
- Create: `js/ui/trim.js`, `js/ui/add-reference.js`
- Test: `tests/e2e/add-reference.e2e.mjs`

**Interfaces:**
- Consumes: `probeVideo`, `extractTrack`, `ExtractError`, `mirrorTrack`, `drawSkeleton`, `Store`, `COPY`.
- Produces: `mountTrim(container: HTMLElement, file: Blob, opts: {maxSeconds: number}): Promise<{getRange(): {start: number, end: number}, destroy(): void}>` (video, kaksi liukusäädintä alku ja loppu, valitun pätkän toisto; jos video on pidempi kuin `maxSeconds`, alkuvalinta on ensimmäiset `maxSeconds` sekuntia ja pidempää väliä ei voi valita).

Kulku: 1) tiedoston valinta (`<input type="file" accept="video/*">`), 2) rajaus, 3) käsittely etenemispalkilla ja Peruuta-painikkeella, 4) esikatselu: video ja tikku-ukko päällä, valinta "Malli on peilikuva" (peilaa liikeradan ja esikatselun), 5) nimi (pakollinen, oletuksena tiedoston nimi ilman päätettä), laji (oletuksena kirjastossa valittuna ollut), valinta "Tallenna myös video puhelimeen" (oletus päällä, selite: `Tarvitaan, jotta mallin musiikki kuuluu harjoitellessa. Video pysyy puhelimessa.`), Tallenna. Tallennuksen jälkeen paluu kirjastoon kyseiseen lajiin.

Virheet: `unsupported` → `COPY.unsupported` ja paluu vaiheeseen 1. Jos henkilö löytyi alle 30 %:ssa kuvista → `COPY.noPerson`, tallennus estetty. `StoreFullError` → `COPY.storeFull`, lomake säilyy täytettynä.

- [ ] **Step 1: Kirjoita kaatuva testi.**

```js
await openAddReference(); await chooseFile('tests/fixtures/pose_squats.mp4');
await setTrim(2, 8); await clickText('Jatka');
await waitForText('Esikatselu', { timeout: 180000 });
assert.ok(await canvasHasDrawing('#preview-overlay'));
await fill('Nimi', 'Kyykkysarja'); await selectStyle('Hip-hop'); await clickText('Tallenna');
await expectVisible('Kyykkysarja');                              // kirjastossa lajin Hip-hop alla
const ref = await storedReference('Kyykkysarja');
assert.equal(ref.track.frames.length, 60); assert.equal(ref.mirrored, false);
assert.ok(ref.video.size > 0);
// peilaus ja ilman videota
... 'Malli on peilikuva' päälle, 'Tallenna myös video' pois ...
assert.equal(ref2.mirrored, true); assert.equal(ref2.video, null);
assert.ok(Math.abs(ref2.track.frames[5].lm[15].x - (1 - ref.track.frames[5].lm[16].x)) < 0.01);
// virhepolut
await chooseFile('tests/fixtures/not-a-video.mp4'); await expectVisible(COPY.unsupported);
await chooseFile('tests/fixtures/no-person.mp4'); ... await expectVisible(COPY.noPerson);
assert.equal(await isDisabled('Tallenna'), true);
// peruutus kesken käsittelyn palauttaa rajaukseen
```

- [ ] **Step 2:** Aja testi. Odotus: FAIL.
- [ ] **Step 3:** Toteuta.
- [ ] **Step 4:** Aja testi. Odotus: PASS.
- [ ] **Step 5:** Commit `feat: add reference flow with trim, mirror and optional video`.

### Task 9: Jälkianalyysi

**Files:**
- Create: `js/ui/analyze.js`
- Test: `tests/e2e/analyze.e2e.mjs`

**Interfaces:**
- Consumes: `mountTrim`, `extractTrack`, `analyze`, `projectReference`, `drawSkeleton`, `levelOf`, `Store`, `COPY`.

Kulku: 1) mallin valinta (laji, sitten malli; jos kirjasto on tyhjä, ohjaus mallin lisäykseen), 2) `COPY.filmingGuide` ja kaksi painiketta: "Kuvaa nyt" (`<input type="file" accept="video/*" capture="environment">`) ja "Valitse galleriasta", 3) oman videon rajaus, 4) käsittely etenemispalkilla ja peruutuksella, 5) tulos.

Tulosnäkymä: video ja sen päällä canvas. Jokaisella ruudunpäivityksellä valitaan `currentTime`a lähin käyttäjän kuva `i`, piirretään mallin ukko (`projectReference(ref.frames[map[i]].lm, …)`, `variant: 'ghost'`) ja sen päälle oma ukko tasoineen. Valinta "Näytä malli" (oletus päällä). Toiston alla aikajana: yksi palkki kuvaa kohden, korkeus ja väri `timeline[i]`:n mukaan (tuntematon harmaa), napautus kelaa kohtaan. Yhteenveto: Kädet, Jalat, Vartalo pisteinä ●/○ ja tekstinä, sekä Ajoitus tekstinä. Alla `COPY.honesty`. Jos `detectedShare < 0.3`, tuloksen sijasta `COPY.noPerson`. Jos 0,3–0,7, tuloksen yläpuolella huomautus `Tanssija näkyi vain osassa videota, joten palaute on suuntaa-antava.` Painike "Analysoi toinen video" palaa vaiheeseen 2 samalla mallilla. Tarkkuus luetaan asetuksista. Omaa videota ei tallenneta.

- [ ] **Step 1: Kirjoita kaatuva testi.** Esiehtona kirjastossa on Task 8:n tapaan tallennettu malli välistä 2–8 s.

```js
// sama pätkä mallia vastaan
await openAnalyze(); await pickReference('Hip-hop', 'Kyykkysarja');
await expectVisible(COPY.filmingGuide);
await chooseFile('#pick-gallery', 'tests/fixtures/pose_squats.mp4'); await setTrim(2, 8); await clickText('Analysoi');
await waitForText('Kädet', { timeout: 180000 });
assert.equal(await rowText('Kädet'), '●●●● lähellä mallia');
assert.equal(await rowText('Jalat'), '●●●● lähellä mallia');
assert.equal(await rowText('Ajoitus'), 'tahdissa');
assert.equal(await count('.timeline-bar'), 60);
await expectVisible(COPY.honesty);
assert.ok(await canvasHasColor('#result-overlay', [46, 204, 113]));     // vihreää näkyy
assert.ok(await canvasHasColor('#result-overlay', [80, 160, 255]));     // mallin ukko näkyy
await toggle('Näytä malli');
assert.equal(await canvasHasColor('#result-overlay', [80, 160, 255]), false);
// aikajanan napautus kelaa
await tapTimelineBar(30); assert.ok(Math.abs(await videoTime() - 3.0) < 0.15);
// myöhässä aloitettu oma video (väli 1,5–8 s): liike arvioidaan silti läheiseksi
... setTrim(1.5, 8) ...
assert.match(await rowText('Jalat'), /lähellä mallia/);
// ei henkilöä
await chooseFile('#pick-gallery', 'tests/fixtures/no-person.mp4'); ... await expectVisible(COPY.noPerson);
// yksityisyys: analyysin jälkeen tietokannassa ei ole uutta videota
assert.equal(await storedVideoCount(), videoCountBefore);
assert.equal(externalRequests.length, 0);
```

- [ ] **Step 2:** Aja testi. Odotus: FAIL.
- [ ] **Step 3:** Toteuta.
- [ ] **Step 4:** Aja `npm run test:unit && npm run test:e2e`. Odotus: kaikki PASS.
- [ ] **Step 5:** Ota kuvakaappaukset 390×844-näkymästä (kirjasto, mallin esikatselu, analyysin tulos) ja tarkista ne silmämääräisesti: tekstit mahtuvat, ukot osuvat videon henkilön päälle, mikään ei mene päällekkäin.
- [ ] **Step 6:** Commit `feat: post-recording analysis with overlay, timeline and summary`.

### Task 10: Julkaisu ja puhelintestin tarkistuslista

**Files:**
- Modify: `README.md`
- Create: `docs/puhelintesti.md`

- [ ] **Step 1:** Kirjoita `README.md`: mitä sovellus tekee, `COPY.honesty` ja `COPY.privacy`, paikallinen ajo (`npm run serve`), testit, lisenssihuomautus MediaPipesta (Apache-2.0) ja testiaineistosta.
- [ ] **Step 2:** Kirjoita `docs/puhelintesti.md`, tarkistuslista käyttäjälle: sivu aukeaa; mallin lisäys omalla videolla; "Kuvaa nyt" avaa kameran; analyysi valmistuu ja kauanko se kesti; ukot osuvat kehon päälle; värit vastaavat silmämääräistä eroa; kirjasto säilyy selaimen sulkemisen yli; puhelimen malli ja selain. Jokaisen kohdan perään tila kirjata, mitä tapahtui.
- [ ] **Step 3:** Aja koko testisarja vielä kerran puhtaasta kloonista. Odotus: kaikki PASS.
- [ ] **Step 4:** Yhdistä `vaihe-1` haaraan `main` ja vie GitHubiin: `git -C /home/claude/tanssipeili -c push.negotiate=true push -u origin main`. Odotus: `main -> main`.
- [ ] **Step 5:** GitHub Pagesin käyttöönotto on käyttäjän tehtävä (repon Settings → Pages → Deploy from a branch → `main`, kansio `/ (root)`), ellei hän pyydä tekemään sitä puolestaan. Anna ohje ja odotettu osoite `https://sgtotter00530.github.io/Tanssipeili/`.
- [ ] **Step 6:** Kun sivu on ylhäällä, tarkista päättömällä Chromella, että julkaistu osoite latautuu ja tunnistusmoottori käynnistyy, jos osoite on tavoitettavissa rakennusympäristöstä. Muuten tämä jää tarkistuslistan ensimmäiseksi kohdaksi.

---

## Tiedossa olevat rajat, joita tämä suunnitelma ei ratkaise

- Tunnistuksen nopeutta oikeassa puhelimessa ei voi mitata rakennusympäristössä. Päättömässä Chromessa ilman näytönohjainta yksi kuva vei noin 0,8 s, mikä ei kerro puhelimen nopeudesta. 60 sekunnin pätkä on 600 kuvaa; todellinen käsittelyaika selviää puhelintestissä.
- Testivideo on hidasta kyykkäämistä 5 kuvan sekuntinopeudella. Se todistaa, että putki toimii, mutta ei sitä, että vertailu on hyödyllistä nopeassa tanssissa. Se arvioidaan oikeilla videoilla vaiheen 1 jälkeen, kuten speksi määrää.
- iOS:n Safarin videon kelaustarkkuus ja tallennustilan käytös varmistuvat vasta puhelintestissä.
