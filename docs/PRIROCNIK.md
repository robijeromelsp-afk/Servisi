# Servisi – priročnik projekta (beri najprej)

Stanje: 5. 10. 2026. Vir resnice je ta repozitorij. Priročnik na Drive (mapa
»Claude - projekti/Servisi - obveznosti«) kaže sem.

## Kaj je to
Spletna aplikacija za ponavljajoče se obveznosti na objektih (servisi, pregledi,
administrativne obveznosti). Cilj: nobena obveznost se ne izgubi, opozorilo pride pravočasno.
Načrt: `docs/NACRT.md` (potrjen 5. 10. 2026). Postavitev: `docs/POSTAVITEV.md`.

## Stanje
| Del | Stanje |
|---|---|
| Izračun rokov (`shared/schedule.js`) | narejeno, 26 testov |
| Zaledje (`backend/`) | narejeno, 23 testov na nadomestku Apps Script (`tests/gas-mock.js`) |
| Stran (`frontend/`) | narejeno, preverjeno v Chromium na velikosti telefona (`tests/e2e.js`) |
| Objava zaledja (`.github/workflows/deploy-backend.yml`) | napisano, **še ni bilo zagnano** |
| Prava postavitev (Apps Script, tabela, Cloudflare) | **še ne obstaja** – čaka na korake lastnika (`docs/NAVODILA-ZA-ROBIJA.md`) |

Česa testi NE dokazujejo: da koda deluje v pravem Apps Script (tokeninfo, CORS, DriveApp,
MailApp, sprožilci). To se preveri na testni postavitvi `robi-test`.

## Odločitve
- 6. 10. 2026: **brez plačljivih storitev** (Claude API ključ ni v načrtu). Ideja za kasneje: predloge
  zapisnikov, ki se izpolnjujejo na telefonu ob servisu – MANJKA primer pravega zapisnika.
- 6. 10. 2026: za Lucijo se zaenkrat **nič ne postavlja**; ni odločeno, ali bo podatke imela na svojem
  ali Robijevem Drive (ali aplikacije sploh ne bo uporabljala). Obe različici opisani v `POSTAVITEV.md`, C1/C2.
- 6. 10. 2026: oznaka objekta je neobvezna (prikaz samo imena, če je oznaka prazna ali enaka imenu);
  vrsto objekta se lahko vpiše prosto – nova se doda v šifrant. Povpraševanje: glavni gumb »Odpri kot osnutek«,
  nato »Pošlji meni za posredovanje« (na službeni naslov), nato »Pošlji izvajalcu«. Office 365 (pot c) – Robi se
  posvetuje z informatikom.
- Ideja za kasneje (ni potrjena): samodejno povpraševanje N dni pred rokom na službeni naslov.
- 6. 10. 2026: **povpraševanje za ponudbo** pri obveznosti – »Pošlji« (aplikacija pošlje, odgovor in kopija na
  uporabnikov e-naslov za obvestila) ali »Odpri kot osnutek« (mailto, uporabnik pošlje sam). Oboje v zgodovini
  (list QuoteRequests). Predloga v nastavitvah (quote_subject, quote_body; prazno = privzeto v jeziku organizacije).
- 6. 10. 2026: pošiljatelj ostane Google račun postavitve (pot B; ime pošiljatelja »Servisi«). Pot A
  (servisi@dolb.si prek storitve za pošiljanje, npr. Brevo) je odložena – za kasneje.
- 6. 10. 2026 – **POSTOPEK OBJAVE:** ko Robi napiše »objavi«, Claude sam združi PR v `main` (Cloudflare objavi
  stran), objavi zaledje in preveri delovanje. Brez besede »objavi« ni objave na `servisi.dolb.si` ali produkcijo.
  Delo na testni postavitvi (`robi-test`) brez spraševanja.
- 6. 10. 2026: aplikacija in pošta v **slovenščini**, angleščina pripravljena (nastavitev »language«
  v Settings > Notifications). Prej je veljalo: gumbi angleško – Robi spremenil.
- 6. 10. 2026: uporabnik ima lahko **e-naslov za obvestila** (npr. službeni); prijava ostane z Google računom.
- 6. 10. 2026: testna postavitev `robi-test` deluje (prijava, tabela, sprožilec, testna in mesečna pošta preverjeni
  pri Robiju). Stran `servisi.dolb.si` je za zdaj priključena na TESTNO zaledje.
- Client ID (ni skrivnost): `253205263906-emde6v6iael2s3ls3jpt1o6ksq3rqe8a.apps.googleusercontent.com`;
  OAuth zaslon je v načinu *Testing* – prijava samo za vpisane testne uporabnike (Google Cloud > Audience > Test users).
- 5. 10. 2026: vsa priporočila iz vprašanj sprejeta; koledarsko štetje ob zamudi = b1.
- 5. 10. 2026: vse na Robijevem Drive (obe tabeli, priloge); podatki organizacij ločeni.
- 5. 10. 2026: Robijevo zaledje teče pod robi.jeromel@gmail.com; dolb.si je v Robijevem Cloudflare.
- 5. 10. 2026: projekt mora biti prenosljiv v drug Claude (Lucija) – zato CLAUDE.md, POSTAVITEV, Import.
- Izpuščeni roki (b1) se ne shranjujejo kot zapisi, ampak se vedno izračunajo iz zgodovine
  (`Schedule.compute` → `history`), da ne morejo postati neskladni po preklicu izvedbe.
- Predlagani šifrant je v `backend/seed.js` (imena v slovenščini, ker so podatki, ne vmesnik).
- Ponedeljkov opomnik se preskoči, če je isti dan že šla mesečna pošta.
- Objekt brez odgovornega uporabnika: pošta gre vsem administratorjem (nič ne ostane brez prejemnika).

## Odprto / MANJKA
1. Koraki lastnika za prvo postavitev (OAuth Client ID, Cloudflare, clasp secret) – `docs/NAVODILA-ZA-ROBIJA.md`.
2. `Vzdrzevalna_baza_toplarna.xlsx` – primerjava modela periodike z izvedbo (§4 načrta je zapis opisa, ne datoteke).
3. Meritev pomanjšanja na **pravih** slikah s telefona (e2e je meril samo umetno sliko: 10,4 MB PNG → 0,9 MB JPEG).
4. Največja velikost PDF (zdaj omejeno na 25 MB; dejanska meja Apps Script ni preverjena).
5. Kontrola prilog brez izvedbe (naloženo, izvedba ni shranjena) – v dnevnem opravilu še ni.
6. `docs/SELITEV.md` – postopek selitve prilog.

## Pasti
- 7. 10. 2026: Apps Script je pri branju zgodovine po shranjeni izvedbi vrnil **HTTP 404** (HTML namesto JSON),
  zaledje je bilo ob preverjanju takoj nato v redu. Vzrok ni ugotovljen (MANJKA: dnevnik izvajanj Apps Script
  za tisti čas). Zdaj: bralni klici (`bootstrap`, `history`, `status`, `whoami`) se ob takem odgovoru ponovijo
  do 2-krat; neuspelo nalaganje zgodovine ne podre več zaslona obveznosti. Pisalni klici se ne ponavljajo sami
  (`markDone` ima zaščito `expected_due`, ponovitev ne more dvakrat zapisati iste izvedbe).
- Pri prevajanju: besedila, ki so hkrati vrednosti (npr. 'Overdue', 'Report', 'User'), so bila izpuščena iz
  samodejnega ovijanja s t() – zavihki na Pregledu so ostali angleški. Zdaj e2e v slovenščini obišče vse zaslone
  in javi vsako angleško besedilo iz slovarja (`tests/e2e.js`, korak »no English text left«).
- Ime spremenljivke `t` v funkciji zasenči prevajalnik `t()` (zgodilo se v obrazcu obveznosti) – ne uporabljaj `t` kot ime.
- Nov stolpec v SCHEMA: povečaj `SCHEMA_VERSION` v `backend/db.js`, sicer obstoječa tabela ne dobi stolpca do dnevnega teka.
- Iz oblačnega okolja Claude `*.pages.dev` in `servisi.dolb.si` nista dosegljiva (proxy 403); `script.google.com` je.
  Stran zato preveri Robi z enim pogledom, zaledje Claude sam.
- `Publish app` na OAuth zaslonu zahteva izpolnjen Branding (domača stran, zasebnost) – zato ostaja *Testing*.
- **Apps Script nalaga datoteke po vrsti.** Sklic na funkcijo iz druge datoteke na vrhnji ravni
  (npr. tabela dejanj) je ob nalaganju `undefined`. Zato `actions_()` sestavi tabelo ob klicu.
  Nadomestek v testih nalaga datoteke enako in to ujame.
- Stolpce iskati po imenu glave, ne po položaju. Vse celice pisati kot besedilo (`@`), sicer
  tabela `YYYY-MM-DD` spremeni v datum (KT4). `cellToString_` popravi ročno vpisane datume.
- Cloudflare Pages ustvariti POVEZANO z GitHubom (ne »Upload assets«).
- `clasp deploy` vedno z `-i <deploymentId>`, sicer nastane nov URL. `clasp push` zamenja celoten
  projekt – samo iz `dist/backend`. `create-script` v prazni mapi, da ne prepiše `appsscript.json`.
- Neobstoječe poti na Pages vrnejo `index.html` s statusom 200 – pri preverjanju gledati vsebino.
- Brez `eval()` in nalaganja kode z Drive.
- Drive konektor ne more posodobiti vsebine datoteke: staro preimenuj v `*_staro`, ustvari novo.
- V oblačnem okolju Claude `accounts.google.com` ni dosegljiv (certifikat) – e2e test zato Googlov
  skript nadomesti s praznim; prava prijava se preveri na pravi postavitvi.
- `pkill -f <vzorec>` v ukazni vrstici ubije tudi lastno lupino (vzorec je v njenem ukazu) – ustavljati po PID/vratih.
- GitHub pokaže gumb *Run workflow* (workflow_dispatch) samo za delovne tokove, ki so na privzeti veji (`main`).
  Dokler je `deploy-backend.yml` samo na delovni veji, objave ni mogoče sprožiti – rabi združitev v `main`.
- Prvi potisk v nov repozitorij je vrnil 403, dokler Claude GitHub App ni dobil dostopa.

## Ukazi
```
npm test                    vsi testi
npm run build               dist/backend + dist/frontend
npm run dev                 lokalni strežnik http://localhost:8787 (prijava z e-naslovom, podatki v pomnilniku)
node tests/e2e.js [mapa]    preizkus v brskalniku (ob tekočem dev strežniku), neobvezno posnetki zaslona
```
