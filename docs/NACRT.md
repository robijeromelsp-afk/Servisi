# Servisi – obveznosti na objektih: NAČRT

Stanje: 5. 10. 2026, **osnutek za potrditev**. Koda se ne piše, dokler načrt ni potrjen.

Oznake v dokumentu:
- **MANJKA** – podatka nimam; brez njega korak ne gre naprej.
- **OCENA** – vrednost ni izmerjena.
- **PREVERITI** – predpostavka, ki jo potrdi šele poskus (korak 1).

---

## 0. Sprejete odločitve (odgovori na vprašanja, 5. 10. 2026)

Robi: »da, uredi tako«. Zato veljajo priporočila iz vprašanj:

| # | Odločitev |
|---|---|
| A | **Vse je na Robijevem Drive** (odločitev 5. 10. 2026): obe tabeli, vse priloge, izvozi. Lastnik vsega je Robi. Lucija ima dostop do svoje tabele in svoje mape, ne do Robijevih. Podatki se v aplikaciji **nikoli ne mešajo**: ločena tabela, ločena mapa, ločena organizacija. Pošta gre z računa uporabnikove postavitve (glej §2.3). |
| B | Koledarsko štetje ob zamudi: **b1**. Naslednji rok je prvi koledarski rok po kasnejšem od dveh datumov (rok, datum izvedbe). Vmesni zamujeni roki se zapišejo kot »izpuščeno«. |
| C | Model periodike pozna vseh 8 tipov. V vmesniku so »dan«, »teden« in »N_dni« pod 30 dni skriti za »Advanced«. Ob vnosu se lahko vpiše »nazadnje opravljeno«. |
| D | Šifrant vrst je **brez privzete periodike**. Vsaka predlagana vrsta ima oznako »Suggested – not verified«. Šifrant je ločen za vsako organizacijo. |
| E | Objekt ima »odgovorni uporabnik« (za pošto) in »kontakt na objektu« (besedilo). Izvajalci so šifrant. Dodatni prejemniki pri obveznosti so lahko uporabniki ali poljuben e-naslov; zunanji naslov prejme samo svoje vrstice. |
| F | Dnevni sprožilec ob 6:00 (Europe/Ljubljana). Mesečna pošta gre 1. v mesecu (nastavljivo), z razdelki **Zamujeno / Ta mesec / Naslednji mesec**. Odlog pošlje svojo kratko pošto na izbrani dan. |
| G | Ena stran `servisi.dolb.si`. Po prijavi z Googlom stran sama najde postavitev, v kateri je uporabnik. Vlogi sta »Admin« in »User«. |
| H | Apps Script se objavlja s clasp iz GitHub Actions. Prijave so v GitHub Secrets, ne v kodi. Cloudflare Pages je **povezan z GitHubom** (ne »Upload assets«). |
| I | Priloge so v strukturi `Priloge/<organizacija>/<objekt>/<leto>/`. Ime datoteke: `YYYY-MM-DD_<vrsta>_<uuid>.<ext>`. |
| J | Zdaj velja ena kopija za vsako organizacijo. Model je že pripravljen na več organizacij. Izvoz je ZIP (JSON + CSV + seznam prilog s povezavami); prilog samih ni v ZIP. |

Še odprto (ni blokada za načrt, je pa blokada za izvedbo):

1. Lucijin tip računa (gmail.com / Workspace) ni več odločilen za shranjevanje, ker je vse na Robijevem Drive. PREVERITI v koraku 1, ali njen račun lahko odpre deljeno tabelo (pri Workspace lahko skrbnik agencije prepove deljenje od zunaj).
2. ~~Račun Robijevega zaledja~~ – odločeno 5. 10. 2026: **robi.jeromel@gmail.com**. Pošta gre s tega naslova; tabela A in priloge so na istem Drive.
3. ~~dolb.si~~ – odločeno 5. 10. 2026: domena je v Robijevem Cloudflare računu.
4. **MANJKA** – največja pričakovana velikost PDF.
5. **MANJKA** – `Vzdrzevalna_baza_toplarna.xlsx` (rabim jo pri koraku 2).

---

## 1. Glavni cilj: nobena obveznost se ne sme izgubiti

Varovala, vgrajena v zasnovo:

1. **Vsaka aktivna obveznost ima vedno izračunan naslednji rok.** Obveznost brez periodike ali brez začetnega datuma ima stanje »Incomplete«. Na pregledu je rdeča, v mesečni pošti je posebej v razdelku »Nepopolno«.
2. **Rok se izračuna iz zgodovine, ne vpiše ročno.** Shranjeni »naslednji rok« je samo predpomnilnik. Dnevno opravilo ga vsak dan na novo izračuna iz pravila in zgodovine izvedb. Če se razlikuje, ga popravi in zapiše v dnevnik.
3. **Pošta se ne more tiho izgubiti.** Vsako pošiljanje se zapiše v dnevnik pošte. Mesečna pošta je vezana na »mesec še ni poslan«, ne na »danes je 1.«. Če sprožilec 1. ne steče, gre pošta ob prvem naslednjem teku.
4. **Opazen izpad sprožilca.** Dnevno opravilo zapiše »zadnji uspešen tek«. Če je starejši od 48 ur, aplikacija na vrhu vsakega zaslona pokaže rdeč pas: »Daily check has not run since …«.
5. **Več stopenj opozarjanja:**
   - mesečni seznam (zamujeno / ta mesec / naslednji mesec);
   - neobvezno opozorilo X dni pred rokom pri posamezni obveznosti;
   - odlog (»Remind me«) na izbran datum;
   - **tedenski opomnik ob ponedeljkih**, če obstaja kaj zamujenega (nastavljivo).
6. **Ničesar se ne briše.** Napačno označeno izvedbo se prekliče (»Void«), ostane pa v zgodovini z razlogom. Rok se nato na novo izračuna.
7. **Revizijska sled.** Vsaka sprememba se zapiše v dnevnik sprememb: kdo, kdaj, kaj je bilo prej in kaj potem.
8. **Arhiviran objekt** arhivira vse svoje obveznosti, a jih zapiše. Ob vrnitvi iz arhiva se vrnejo tiste, ki so bile arhivirane skupaj z njim.
9. **Kontrola prekrivanja na pregledu:** objekti brez obveznosti, obveznosti brez izvajalca in objekti brez odgovornega uporabnika. To niso napake, so pa opozorila.

---

## 2. Arhitektura

**Ločevanje Robi / Lucija (odločitev 5. 10. 2026):**

| Kaj | Robi | Lucija |
|---|---|---|
| Tabela | `Servisi – <org A>` na Robijevem Drive | `Servisi – <org B>` na Robijevem Drive, deljena z Lucijo |
| Priloge | `Priloge/<org A>/` | `Priloge/<org B>/`, deljena z Lucijo (bralka) |
| Zaledje (Apps Script) | teče pod Robijem | teče pod Lucijo, **samo zaradi pošte z njenega naslova**; bere in piše tabelo B na Robijevem Drive |
| Kaj vidi v aplikaciji | samo org A | samo org B |
| Lastnik datotek, kvota | Robi | Robi |

Lucija v aplikaciji ne more priti do podatkov org A: njeno zaledje pozna samo ID tabele B in njen e-naslov je samo v »Users« tabele B.
Robi kot lastnik Drive datotek tehnično lahko odpre tabelo B v Drive. Če Robi želi videti tudi Lucijine obveznosti v aplikaciji, se ga doda v »Users« tabele B (ločena izbira organizacije, podatki se ne združijo).
PREVERITI v koraku 1: Apps Script, ki teče pod Lucijo, odpre in piše tabelo, ki je deljena z njo kot urejevalko (po mojem znanju gre, ker tabela ne porabi kvote za priloge – ni preverjeno).

```
 telefon / računalnik
        │  (Google prijava, ID žeton)
        ▼
 servisi.dolb.si  ── Cloudflare Pages (statično, iz GitHuba)
        │
        ├─► Zaledje A (Apps Script, teče pod Robijevim računom)
        │      tabela A, pošta z Robijevega naslova
        │      + STORITEV ZA PRILOGE (piše v Robijev Drive)
        │
        └─► Zaledje B (Apps Script, teče pod Lucijinim računom)
               tabela B = NA ROBIJEVEM DRIVE, deljena z Lucijo (urejevalka)
               pošta z Lucijinega naslova
               priloge pošlje stran neposredno storitvi za priloge v A
```

### 2.1 Ena koda, več postavitev
- V repozitoriju je ena koda zaledja (`backend/`). Vsaka postavitev je svoj projekt Apps Script z isto kodo.
- Razlike med postavitvami so samo v **Script Properties** in v listu »Settings« njene tabele: ID tabele, ID organizacije, naslov storitve za priloge. V kodi ni imen, naslovov ali e-pošte.
- **Brez eval() in brez nalaganja kode z Drive.** Koda pride v projekt Apps Script s `clasp push` iz GitHub Actions.

### 2.2 Prijava
- Google Identity Services na strani vrne ID žeton (JWT).
- Zaledje žeton preveri prek Googlove končne točke `tokeninfo`: podpis, `aud` = naš Client ID, `exp`, `email_verified`.
  Sejo hrani v `CacheService` do 50 minut, zato ne preverja ob vsaki zahtevi.
- E-naslov mora biti v listu »Users« te postavitve in aktiven. Sicer zaledje vrne »Access denied«.
- **Iskanje postavitve:** seznam URL-jev zaledij je v Cloudflare spremenljivki `BACKENDS`. Ob gradnji strani se zapiše v `config.js`, v repozitoriju ga ni.
  Po prijavi stran vpraša vsa zaledja »whoami«. Odgovori tisto, ki uporabnika pozna. Izbira se zapomni v brskalniku.
  Če uporabnika pozna več zaledij, stran ponudi izbiro organizacije.
- PREVERITI: `tokeninfo` iz Apps Script ter CORS za `fetch` s Cloudflare na Apps Script (POST z `text/plain`, brez predpoizvedbe). KT4 to že uporablja.

### 2.3 Pošiljanje z lastnega naslova
- `MailApp` vedno pošilja z računa, pod katerim teče projekt Apps Script. Zato vsaka postavitev teče pod računom tistega, ki ji pripada (»Execute as: Me«), in ima svoj časovni sprožilec.
- Za Lucijino postavitev se ona enkrat prijavi v clasp oziroma odobri dostop v svojem računu. Prijava se shrani kot GitHub Secret `CLASPRC_<postavitev>`.
- OCENA: dnevna omejitev MailApp za osebni račun je okoli 100 prejemnikov na dan. Za dva uporabnika in nekaj zunanjih naslovov je dovolj. Ob vsakem teku zaledje prebere `MailApp.getRemainingDailyQuota()` in to zapiše v dnevnik.

### 2.4 Priloge (rešitev za kvoto)
- Storitev za priloge je del iste kode. Vklopljena je samo v postavitvi A (nastavitev `STORAGE_ENABLED`).
- Dovoljeni nalagalci so v listu »StorageClients« tabele A: organizacija in e-naslovi.
- Potek:
  1. Stran pomanjša sliko.
  2. Stran pošlje datoteko storitvi A, skupaj z ID žetonom.
  3. Storitev zapiše datoteko v `Priloge/<org>/<objekt>/<leto>/`. Lastnik je Robi.
  4. Storitev vrne `fileId` in povezavo.
  5. Stran pošlje izvedbo z referencami prilog svojemu zaledju (A ali B).
- Mapa organizacije je deljena z uporabniki te organizacije (bralci). Tako povezave na priloge delujejo tudi njim.
- PREVERITI v koraku 1:
  - ali deljenje deluje za Lucijin tip računa;
  - kako velik PDF še gre skozi (base64 v telesu POST; OCENA, omejitev okoli 50 MB);
  - kaj se zgodi, če se datoteka naloži, izvedba pa ne shrani. Taka datoteka ostane brez izvedbe; dnevno opravilo jo najde in prijavi, ne briše je.

### 2.5 Pomanjševanje slik
- V brskalniku, pred nalaganjem: daljša stranica 1600 px, JPEG, kakovost 0,82, upoštevana EXIF orientacija.
- Na telefonu `<input type="file" accept="image/*" capture="environment">` odpre kamero neposredno.
- OCENA prihranka (5 GB → 1 GB na leto) se ne prevzame. V koraku 1 izmerim velikost pred in po na 10–20 pravih slikah s telefona in zapišem izmerjene številke.

### 2.6 Okolji
- **Test:** test zaledje + test tabela pod Robijem; predogledni naslov Cloudflare za vejo.
- **Produkcija:** veja `main`, `servisi.dolb.si`, zaledji A in B.
- Objava zaledja na produkcijo je ročno sprožen GitHub Actions z vpisom potrditve. **Brez Robijeve izrecne potrditve ne objavim.**
- `clasp deploy` vedno z `-i <DEPLOYMENT_ID>`, da URL ostane isti (past iz KT4).

---

## 3. Podatkovni model

Vsak list v tabeli ima te **skupne stolpce**:

| Stolpec | Pomen |
|---|---|
| `id` | UUID v4 (`Utilities.getUuid()`) |
| `org_id` | UUID organizacije |
| `created_at`, `created_by` | čas ISO 8601 UTC, e-naslov |
| `updated_at`, `updated_by` | |
| `archived_at`, `archived_by`, `archive_reason` | prazno = aktivno |
| `rev` | števec sprememb; ob shranjevanju se preveri, da nihče vmes ni spremenil zapisa |

Stolpci se iščejo po **imenu glave**, ne po položaju (past iz KT4). Datumi brez ure se hranijo kot besedilo `YYYY-MM-DD`, da jih tabela ne pretvori (past iz KT4).

### Listi

**Organizations** – `name`, `timezone` (privzeto Europe/Ljubljana), `locale`.

**Settings** – `key`, `value` za vsako organizacijo:
- `monthly_day` (1)
- `run_hour` (6)
- `weekly_overdue_reminder` (true)
- `app_url`
- `storage_url`
- `attachments_root_folder_id`
- `mail_sender_name`

**Users** – `email`, `display_name`, `role` (Admin/User), `active`.

**ObjectKinds** – šifrant vrst objekta: kotlovnica, stavba …

**ObligationGroups** – `name`, `sort`. Predlog: kurilne naprave, požarna varnost, elektro, dvigala, administrativno.

**ObligationTypes** – `group_id`, `name`, `description`, `is_suggestion` (true = »Suggested – not verified«), `sort`. **Brez rokov.**

**Contractors** – `name`, `contact_person`, `phone`, `email`, `note`.

**Objects** – `code` (oznaka), `name`, `address`, `kind_id`, `responsible_user_id`, `site_contact`, `note`.

**Obligations**:

| Polje | Pomen |
|---|---|
| `object_id`, `type_id`, `contractor_id`, `note` | |
| `rule_type` | dan, teden, n_dni, mesec, cetrtletje, polletje, leto, vec_let |
| `rule_weekday` | 1–7 |
| `rule_interval` | dni pri n_dni, let pri vec_let |
| `rule_day` | 1–28 |
| `rule_months` | npr. `3,6,9,12` |
| `rule_month` | 1–12 |
| `start_date` | prvi rok je na ta dan ali po njem |
| `count_from` | `completion` (a) ali `calendar` (b) |
| `last_done_before_app` | neobvezno |
| `warn_days_before` | neobvezno |
| `extra_recipients` | JSON: ID-ji uporabnikov in e-naslovi |
| `next_due` | predpomnilnik, glej §1 točka 2 |
| `status` | Active / Incomplete |

**Completions** (izvedbe, celotna zgodovina):

| Polje | Pomen |
|---|---|
| `obligation_id` | |
| `due_date` | rok, ki ga izvedba zapira |
| `done_date` | |
| `done_by` | |
| `note` | |
| ~~`result`~~ | ni shranjeno: zamuda in izpuščeni roki (b1) se vedno izračunajo iz zgodovine, da po preklicu ne morejo biti neskladni (odločitev med gradnjo, 5. 10. 2026) |
| `void_at`, `void_by`, `void_reason` | preklic, nikoli brisanje |

**Attachments** – `completion_id`, `drive_file_id`, `url`, `file_name`, `mime`, `size_bytes`, `kind` (Report / Invoice / Photo / Measurement / Other), `original_size_bytes` (za meritev prihranka).

**Snoozes** (odlogi) – `obligation_id`, `remind_on`, `note`, `sent_at`, `cancelled_at`. Rednega roka ne spreminja.

**MailLog** – `kind` (Monthly / Snooze / Warning / WeeklyOverdue / Test), `period` (npr. `2026-11`), `recipient`, `items`, `sent_at`, `ok`, `error`.

**AuditLog** – `entity`, `entity_id`, `action`, `by`, `at`, `before_json`, `after_json`.

**Status** – `last_daily_run_at`, `last_daily_run_ok`, `last_error`, `mail_quota_left`.

**Ločevanje organizacij:** vsak zapis ima `org_id`. Vsaka poizvedba v zaledju filtrira po organizaciji prijavljenega uporabnika. Danes je v tabeli ena organizacija, model pa ne predpostavlja, da je ena.

---

## 4. Pravila izračuna roka (jedro)

Izračun je **ena čista funkcija v JavaScriptu** (`shared/schedule.js`):

- vhod: pravilo + zgodovina neveljavljenih izvedb + »danes«;
- izhod: naslednji rok + seznam izpuščenih rokov;
- ista datoteka teče v Apps Script in v testih v Node;
- vsi izračuni so na **koledarskih datumih** brez ure v časovnem pasu organizacije, zato poletni čas ne premakne nobenega roka.

### Koledarska mreža (način `calendar`)

| Tip | Roki |
|---|---|
| dan | vsak dan |
| teden | vsak `rule_weekday` |
| n_dni | `anchor_date + k·N` |
| mesec | `rule_day` v vsakem mesecu |
| cetrtletje / polletje | `rule_day` v mesecih `rule_months` |
| leto | `rule_day` · `rule_month` |
| vec_let | `rule_day` · `rule_month` vsakih `rule_interval` let od leta `anchor_date` |

### Način (a) `completion` – od zadnje izvedbe
- Naslednji rok = datum izvedbe + interval pravila. Intervali: dan 1 d, teden 7 d, n_dni N d, mesec 1 mesec, četrtletje 3 mesece, polletje 6 mesecev, leto 12 mesecev, vec_let N let.
- Pri prištevanju mesecev se dan, ki ga v ciljnem mesecu ni, omeji na zadnji dan meseca (31. 1. + 1 mesec = 28./29. 2.).
- Brez izvedbe: `anchor_date` ali `last_done_before_app` + interval.

### Način (b) `calendar` – po koledarju, izbira b1
- Izvedba zapre najstarejši odprti rok R. Datum izvedbe je D.
- Naslednji rok = **prvi rok v mreži, ki je strogo kasnejši od max(R, D)**.
- Roki v mreži med R in D se zapišejo kot `Skipped`. V pošti niso več zamujeni, v zgodovini pa so vidni.
- Primer: rok 15. 5. 2027, opravljeno 10. 8. 2027 → naslednji rok 15. 5. 2028.
- Primer: rok 15. 5. 2027, opravljeno 1. 6. 2028 → 15. 5. 2028 = Skipped, naslednji rok 15. 5. 2029.
- Predčasna izvedba (D < R) zapre rok R. Naslednji rok je prvi po R.

### Stanje obveznosti glede na danes (T)
- **Overdue:** rok < T.
- **Due this month:** rok v tekočem mesecu.
- **Next month:** rok v naslednjem mesecu.
- **Snoozed:** ima aktiven odlog. Prikaz se ne spremeni, rok ostane, doda se samo opomnik.

Testi: najmanj en test za vsak tip × način × (pravočasno, z zamudo, predčasno, več izpuščenih, konec meseca, prestopno leto). Testi tečejo v GitHub Actions ob vsakem potisku. **Brez zelenih testov ni objave.**

Model iz `Vzdrzevalna_baza_toplarna.xlsx` primerjam s tem opisom, ko dobim datoteko. Do takrat je ta razdelek moj zapis tvojega opisa, ne vsebina datoteke.

---

## 5. Zasloni

Gumbi in meniji so v angleščini, oblikovanje najprej za telefon.

| Zaslon | Vsebina |
|---|---|
| **Sign in** | gumb Google. Pri zavrnitvi: »Your account is not on the access list.« |
| **Overview** (domači) | štirje zavihki **Overdue / This month / Next month / Snoozed**, grupirani po objektu. Rdeči pas, če dnevni tek zamuja. Pas »Needs attention«: nepopolne obveznosti, objekti brez obveznosti. |
| **Objects** | iskanje po oznaki, imenu in naslovu; filter po vrsti; »Show archived«. |
| **Object** | podatki, seznam obveznosti z rokom in stanjem; Add obligation / Edit / Archive. |
| **Obligation** | pravilo v človeškem jeziku (npr. »Every year on 15 May, counted by calendar«), naslednjih 5 rokov kot predogled, zgodovina izvedb s prilogami; gumbi **Mark done**, **Remind me**, Edit, Archive. |
| **Mark done** | datum (privzeto danes), opomba, priloge (Camera / File, več hkrati, napredek nalaganja), vrsta priloge. Pred shranjevanjem pokaže, kateri rok se zapira in kateri bo naslednji. |
| **Remind me** | »in X days« ali datum, opomba. |
| **Settings** (Admin) | Obligation types (s pasom »Suggestions – not verified, not legal advice«), Contractors, Object kinds, Users, Notifications (dan in ura, tedenski opomnik, »Send test email now«), **Export**, Status (zadnji tek, dnevnik pošte, kvota). |

Na dnu strani v Settings in v nogi pošte je stalno besedilo:

> »Intervals are entered by users. This application does not provide legal advice and does not verify statutory deadlines.«

---

## 6. Potek dnevnega opravila in mesečne pošte

Sprožilec: vsak dan ob `run_hour` (Europe/Ljubljana) se zažene `dailyJob()` v vsaki postavitvi posebej:

1. Zaklep (`LockService`), da opravilo ne teče dvakrat hkrati.
2. Ponoven izračun `next_due` za vse aktivne obveznosti. Razlike se zapišejo v AuditLog.
3. **Mesečna pošta**, če je danes ≥ `monthly_day` in v MailLog za ta mesec in tega prejemnika še ni uspešnega vpisa:
   - prejemniki so odgovorni uporabniki objektov in dodatni prejemniki obveznosti;
   - vsak prejme samo svoje;
   - razdelki: **Overdue**, **Due this month**, **Due next month**, **Incomplete setup**;
   - v vsakem razdelku vrstice po objektih (oznaka, naslov), v vsaki vrstici vrsta, rok, izvajalec in telefon;
   - vsaka vrstica ima povezavo naravnost na obveznost v aplikaciji;
   - pošta je v HTML in navadnem besedilu;
   - prazen seznam se vseeno pošlje (»Nothing due this month«), da se vidi, da sistem deluje.
4. **Opozorila pred rokom:** obveznosti z `warn_days_before`, pri katerih je `next_due − warn_days_before ≤ danes` in opozorilo za ta rok še ni bilo poslano.
5. **Odlogi:** `remind_on ≤ danes`, `sent_at` prazen → kratka pošta → zapiše se `sent_at`.
6. **Tedenski opomnik ob ponedeljkih:** samo, če je kaj zamujenega.
7. Kontrola prilog brez izvedbe (samo v postavitvi A).
8. Zapis v Status. Napaka se zapiše in pošlje Adminu postavitve pošto »Daily check failed« z opisom napake.

Ker so vsi koraki vezani na dnevnik in ne na točen dan, ima izpad sprožilca za posledico zamudo, ne izgube.

---

## 7. Izvoz

Gumb **Export** v Settings izdela ZIP v Drive mapi organizacije in vrne povezavo. Vsebina:

- `data.json`: vsi listi organizacije, vključno z arhiviranimi zapisi in dnevniki, ter `schema_version`;
- `csv/<list>.csv`: isto v berljivi obliki;
- `attachments.csv`: vse priloge s `fileId`, povezavo, potjo in velikostjo;
- `README.txt`: opis polj.

Priloge same ostanejo v Drive. Selitev prilog je kopija mape `Priloge/<org>` (Drive »Make a copy« ali Google Takeout). Postopek bo opisan v `docs/SELITEV.md`.

---

## 8. Kako se Lucijin del kasneje loči

Že ločeno je:
- tabela;
- zaledje;
- sprožilec;
- pošta;
- uporabniki.

Edina skupna točka je **storitev za priloge**. Ločitev poteka takole:

1. Lucija postavi svojo storitev za priloge, to je ista koda z `STORAGE_ENABLED` v njeni postavitvi.
2. Mapo `Priloge/<njena org>` se kopira v njen Drive. Skripta kopira datoteke in v Attachments zapiše nove `drive_file_id`. Stari ID ostane v AuditLog.
3. V njenih Settings se zamenja `storage_url`.
4. Po preverjanju Robi arhivira staro mapo. **Ne izbriše je brez tvoje izrecne potrditve.**

Če bi bila potrebna popolnoma ločena stran (svoja domena), je to druga Cloudflare postavitev iste kode z drugačnim `BACKENDS`.

---

## 8a. Lucija lahko projekt prevzame v svoj Claude in gradi naprej

Lucija ima svoj Claude Pro. Projekt mora biti zato **samozadosten v repozitoriju**: kdor ga odpre, iz njega razbere vse, brez dostopa do Robijevega Drive ali tega pogovora.

- `CLAUDE.md` v korenu: pravila dela (MANJKA namesto izmišljanja, brez objave na produkcijo brez potrditve lastnika, ničesar ne briši, angleški gumbi), zgradba, kako zagnati teste, kako objaviti.
- `docs/PRIROCNIK.md`: stanje, pasti, odločitve. Priročnik na Drive kaže nanj; vir resnice je repozitorij.
- `docs/POSTAVITEV.md`: od nič do delujoče postavitve za **novega lastnika**: tabela, Apps Script, sprožilec, Cloudflare, OAuth Client ID, GitHub Secrets. Po tem postopku bo postavljena tudi Lucijina postavitev, tako da je preizkušen v praksi.
- Nobena nastavitev postavitve ni v kodi (§2.1). Lucijina kopija repozitorija deluje z njenimi nastavitvami, ne da bi spreminjala kodo.
- Testi izračuna rokov tečejo v GitHub Actions. Kdor koli spreminja kodo, takoj vidi, če je kaj pokvaril.

Kako bi Lucija nadaljevala (izbere ob prevzemu, ne zdaj):
1. **Skupen razvoj:** Robi jo doda kot sodelavko na repozitoriju; njen Claude dela na svojih vejah, spremembe gredo v `main` prek pull requesta. Ena koda za oba.
2. **Lastna pot:** Lucija naredi fork (ali kopijo) v svoj GitHub, poveže svoj Cloudflare in svoj Apps Script po `docs/POSTAVITEV.md`, podatke prenese z Export → Import. Od tam naprej je koda njena.

Za možnost 2 dodam **Import** (uvoz ZIP-a iz §7 v prazno tabelo) – brez tega selitev ne bi bila neodvisna od naju.

## 9. Zgradba repozitorija

```
frontend/           statična stran (HTML, CSS, ES moduli, brez ogrodja)
backend/            Apps Script (*.js + appsscript.json)
shared/schedule.js  izračun rokov (kopira se v backend ob gradnji)
tests/              Node testi (node:test)
seed/               predlagani šifrant (JSON, z oznako is_suggestion)
CLAUDE.md           pravila za Claude (in za vsakogar, ki nadaljuje)
docs/               NACRT.md, PRIROCNIK.md, POSTAVITEV.md, POSLOVNA-PRAVILA.md, SELITEV.md
.github/workflows/  testi ob potisku; ročna objava zaledja (test / prod)
```

---

## 10. Koraki gradnje

Vsak korak se konča s preverjanjem na živi stvari. Če ga ne morem opraviti sam, to napišem.

| Korak | Vsebina | Kaj potrebujem od tebe |
|---|---|---|
| **0** | Mapa projekta na Drive in priročnik; okostje repozitorija; ta načrt. | potrditev načrta |
| **1 – poskusi** | Prijava z Googlom do Apps Script in nazaj; CORS s Cloudflare; nalaganje v storitev za priloge z drugega računa; pošta z Lucijinega računa; meritev pomanjšanja slik. | OAuth Client ID, Cloudflare projekt, clasp prijava (tvoja + Lucijina), 10–20 slik |
| **2** | Izračun rokov + testi. | xlsx toplarne |
| **3** | Zaledje: listi, UUID, revizija, arhiviranje, API, pravice. | – |
| **4** | Stran: prijava, Overview, Objects, Object, Obligation. | – |
| **5** | Mark done + priloge s kamere. | test na tvojem telefonu |
| **6** | Dnevno opravilo, pošta, odlogi, opozorila, Status. | – |
| **7** | Export + Import (uvoz v prazno tabelo, preizkus: izvoz → uvoz → enaki podatki). | – |
| **8** | Predlagani šifrant (z oznako). | pregled seznama |
| **9** | Celoten test na test okolju → **tvoja potrditev** → produkcija A → postavitev B za Lucijo. | potrditev |

Ob vsakem koraku se posodobi priročnik `Servisi - projekt (beri najprej).md` na Drive.
