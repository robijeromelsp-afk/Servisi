# Navodila za Robija – kar lahko narediš samo ti

Vse ostalo naredi Claude. Vrstni red je pomemben. Ob vsakem koraku piše, kaj mi sporočiš.
Gesel in žetonov mi ne pošiljaj – kjer je kaj skrivnega, gre neposredno v GitHub ali Cloudflare.

## 1. Apps Script API (telefon ali računalnik, 1 minuta)
https://script.google.com/home/usersettings → z računom robi.jeromel@gmail.com → *Google Apps Script API* → **On**.
Sporoči: »API vklopljen«.

## 2. clasp prijava (RAČUNALNIK, 5 minut, enkrat)
1. Če na računalniku nimaš Node.js: https://nodejs.org → LTS → namesti.
2. Ukazni poziv (Windows: tipka Win → »cmd«) in vpiši:
   ```
   npx @google/clasp@3.4.1 login
   ```
3. Odpre se brskalnik → izberi **robi.jeromel@gmail.com** → *Allow*.
4. Odpri datoteko `C:\Users\<ti>\.clasprc.json` (Beležnica), označi vse, kopiraj.
5. GitHub: https://github.com/robijeromelsp-afk/Servisi/settings/secrets/actions → *New repository secret*
   - Name: `CLASPRC_ROBI`
   - Secret: prilepi vsebino
   - *Add secret*
Sporoči: »secret dodan«. (Vsebine mi ne pošiljaj.)

## 3. Google prijava za stran – OAuth Client ID (računalnik priporočen, 10 minut)
Natančni koraki: `docs/POSTAVITEV.md`, točka A.1. Na kratko:
https://console.cloud.google.com → nov projekt »Servisi« → *OAuth consent screen* (External, *Publish app*) →
*Credentials → OAuth client ID → Web application* → *Authorized JavaScript origins*: `https://servisi.dolb.si`.
Ko boš imel korak 4, tja dodaš še naslov predogleda (glej spodaj).
Sporoči: Client ID (konča se z `.apps.googleusercontent.com`; ni skrivnost).

## 4. Cloudflare Pages (računalnik, 10 minut)
`docs/POSTAVITEV.md`, točka A.2: projekt povezan z GitHubom (repozitorij Servisi), build `npm run build`,
izhod `dist/frontend`, spremenljivka `GOOGLE_CLIENT_ID`. `BACKENDS` pustiva za zdaj prazno – vpišem ti ga
po koraku 5. Domena `servisi.dolb.si`.
**Test in produkcija sta ločena:** `servisi.dolb.si` kaže vejo `main` (produkcija, zaenkrat prazna).
Delo je na veji `claude/obveznosti-tracking-app-25o0ol`; Cloudflare jo objavi kot *Preview* na svojem
naslovu (v Cloudflare: *Deployments* → vrstica z vejo → povezava, oblika `https://<ime-veje>.<projekt>.pages.dev`).
Ta naslov dodaj med *Authorized JavaScript origins* iz koraka 3. Spremenljivke za *Preview* bodo kazale na
testno zaledje, za *Production* na produkcijsko.
Sporoči: »Cloudflare narejen« in naslov predogleda.

## 5. Potem jaz
Zaženem objavo testnega zaledja (`robi-test`), vpišem ID-je, ti pošljem povezavo `…/exec`.

## 6. Odobritev (telefon, 1 minuta)
Odpreš povezavo iz koraka 5 z robi.jeromel@gmail.com → *Allow*. Vpišeš URL v Cloudflare `BACKENDS`
za okolje **Preview** in sprožiš ponovno objavo (*Deployments → … → Retry deployment*).

## 7. Prva prijava
Odpreš **naslov predogleda** iz koraka 4 → prijava → *Set up Servisi* → ime organizacije → *Set up*.
Nato *Settings → Status → Send test e-mail to me*. Sporoči, ali je pošta prišla.

Šele po tem preizkusu na testni postavitvi predlagam produkcijo – **z tvojo izrecno potrditvijo**.
