# Postavitev – od nič do delujoče aplikacije

Velja za vsako novo postavitev (Robi, Lucija ali nova stranka). Vsaka postavitev ima
svoj projekt Apps Script, ki teče pod računom lastnika (pošta gre z njegovega naslova),
in svojo tabelo. Stran (Cloudflare Pages) je lahko skupna več postavitvam.

Oznaka **[lastnik]** = korak mora narediti lastnik računa sam (prijava, odobritev).
Nobenega gesla ali žetona se ne pošilja v pogovor in ne vpisuje v kodo.

## A. Enkrat za vse (stran in prijava)

1. **Google Cloud – OAuth Client ID** [lastnik strani]
   1. https://console.cloud.google.com/ → nov projekt (npr. »Servisi«).
   2. *APIs & Services → OAuth consent screen*: tip *External*, ime aplikacije, e-pošta za podporo.
      Obseg (scopes) ne dodajaj nobenega – prijava rabi samo osnovne (openid, email, profile).
      Ko je izpolnjeno: *Publish app* (sicer se lahko prijavijo samo »test users«).
   3. *APIs & Services → Credentials → Create credentials → OAuth client ID*, tip *Web application*.
      *Authorized JavaScript origins*: `https://servisi.dolb.si` (in naslov predogleda Cloudflare,
      če se bo preizkušal tam). Redirect URI ni potreben.
   4. Dobljeni **Client ID** (`…apps.googleusercontent.com`) ni skrivnost. Vpiše se v Cloudflare
      kot `GOOGLE_CLIENT_ID`.
2. **Cloudflare Pages** [lastnik domene]
   1. *Workers & Pages → Create → Pages → Connect to Git* → repozitorij `Servisi`.
      (NE »Upload assets« – tak projekt se pozneje ne da povezati z Gitom; past iz KT4.)
   2. Build command: `npm run build`, Build output directory: `dist/frontend`, Production branch: `main`.
   3. *Settings → Environment variables* (Production in Preview):
      - `GOOGLE_CLIENT_ID` = Client ID iz A.1
      - `BACKENDS` = naslovi `…/exec` vseh postavitev, ločeni z vejico (dopolni se v koraku B.5)
   4. *Custom domains* → `servisi.dolb.si`.

## B. Za vsako postavitev

1. **Apps Script API** [lastnik]: https://script.google.com/home/usersettings → *Google Apps Script API: On*.
2. **clasp prijava** [lastnik, na računalniku, enkrat]:
   ```
   npx @google/clasp@3.4.1 login
   ```
   Odpre se brskalnik, prijava z računom postavitve, *Allow*. Nastane datoteka
   `%USERPROFILE%\.clasprc.json` (Windows) oziroma `~/.clasprc.json`.
   Njeno **celotno vsebino** prilepi v GitHub: repozitorij → *Settings → Secrets and variables →
   Actions → New repository secret*, ime kot v `deploy/targets.json` (npr. `CLASPRC_ROBI`).
   Nato datoteko na računalniku lahko pustiš ali izbrišeš; v GitHubu je šifrirana.
3. **Objava zaledja**: GitHub → *Actions → deploy-backend → Run workflow*, `target` = ime iz
   `deploy/targets.json`. Pri produkciji v `confirm` še enkrat vpiši ime.
   Prvi zagon ustvari projekt in deployment; njuna ID-ja se vpišeta v `deploy/targets.json`
   (to naredi Claude in potisne).
4. **Odobritev** [lastnik, enkrat]: odpri `https://script.google.com/macros/s/<deploymentId>/exec`
   z računom postavitve. Google prosi za dovoljenja (tabele, Drive, pošta, sprožilci) → *Allow*.
   Po odobritvi stran pokaže `{"ok":true,…}`.
5. URL `…/exec` dodaj v Cloudflare `BACKENDS` in ponovno objavi stran (*Deployments → Retry*).
6. **Nastavitev** [lastnik]: odpri `https://servisi.dolb.si`, prijava z Googlom. Ker postavitev še ni
   nastavljena in si njen lastnik, se odpre *Set up Servisi*:
   - *Organisation name*
   - *Spreadsheet*: prazno = nova tabela v tvojem Drive; ali povezava do tabele, ki je deljena s tabo (urejevalec)
   - *Attachment storage of another deployment*: prazno = priloge hrani ta postavitev (v Drive lastnika);
     ali URL `…/exec` postavitve, ki hrani priloge
   Setup ustvari liste, organizacijo, tebe kot administratorja, predlagani šifrant in dnevni sprožilec.
7. *Settings → Users*: dodaj ostale uporabnike. *Settings → Status*: preveri, da je sprožilec »Installed«,
   in *Send test e-mail to me*.

## C. Druga organizacija z lastnim zaledjem (npr. Lucija)

Odločitev, kje so podatki, še ni sprejeta (6. 10. 2026). Pripravljeni sta obe različici; koda je za
obe enaka, razlika je samo v korakih postavitve.

Skupni koraki (obe različici):
1. Robi v Google Cloud → *Google Auth Platform → Audience → Test users* doda njen Google račun
   (dokler je OAuth v načinu *Testing*, se drugače ne more prijaviti).
2. Lucija opravi B.1–B.5 s svojim računom (secret `CLASPRC_LUCIJA`, target `lucija-prod`).
   Pošta gre z njenega naslova, ker zaledje teče pod njenim računom.
3. V aplikaciji vidi vsak samo svojo organizacijo.

### C1. Podatki na njenem Drive (enostavnejše)
4. V B.6 pusti *Spreadsheet* in *Attachment storage* **prazno** → tabela in priloge nastanejo v
   njenem Drive. Robijeva postavitev ni potrebna.

### C2. Podatki na Robijevem Drive
Pogoj: Robijeva produkcijska postavitev (`robi-prod`), ki hrani priloge.
4. Robi v svojem Drive ustvari prazno Google tabelo (npr. »Servisi – <organizacija>«) in jo deli
   z Lucijo kot **urejevalko**.
5. Robi v svoji aplikaciji: *Settings → Storage* → doda Lucijin e-naslov in ime mape.
6. Lucija v B.6 prilepi povezavo do tabele iz C2.4 in kot *Attachment storage* URL Robijeve
   produkcijske postavitve. Tabela in priloge so v Robijevem Drive (lastnik Robi).

PREVERITI ob prvi izvedbi C2: da Apps Script pod Lucijinim računom res odpre in piše deljeno tabelo
(pri Google Workspace računu agencije lahko skrbnik prepove deljenje z zunanjimi).

Kasnejši prehod C1 → C2 ali obratno: razdelek D (izvoz/uvoz).

## D. Selitev na drugo postavitev

*Settings → Export / import*: izvoz (ZIP) → v novi postavitvi po B.6 *Import data.json*.
Priloge ostanejo v Drive; za selitev prilog kopiraj mapo organizacije (glej `docs/SELITEV.md`, MANJKA – napisano bo ob prvi selitvi).
