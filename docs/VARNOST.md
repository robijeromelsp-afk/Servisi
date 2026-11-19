# Varnost – pregled in naloge

Stanje: 19. 11. 2026. Posodobi ob vsaki spremembi prijave, pravic ali objave.

## Kaj aplikacija je (in česa ni)
- Stran `servisi.dolb.si` (Cloudflare Pages) je statična: nima strežnika, gesel ali podatkov.
- Podatki so v Google tabeli, priloge v Google Drive; zaledje je Apps Script, ki teče pod Google računom
  postavitve (zdaj `robi.jeromel@gmail.com`).
- Aplikacija **nima nobene povezave z omrežjem ali sistemi podjetja**. Službeni naslov samo prejema pošto.
  Vdor v aplikacijo zato ne odpre poti v omrežje podjetja; največje tveganje je zloraba Google računa
  postavitve (Drive, pošiljanje pošte z njega).

## Zaščite v kodi
| Področje | Zaščita |
|---|---|
| Prijava | Google prijava (OAuth v načinu *Testing*: samo vpisani testni uporabniki) + seznam uporabnikov v aplikaciji ob vsakem klicu |
| Žeton | Google žeton preverjen pri Googlu (izdajatelj, preverjen e-naslov, rok, `aud` = naš Client ID); nato 30-dnevni žeton seje, podpisan s HMAC-SHA256 (`SESSION_SECRET`) |
| Odjava vseh | *Nastavitve → Status → Odjavi vse naprave* zamenja `SESSION_SECRET` |
| Neveljavni žetoni | Kar ni oblike JWT ali je daljše od 4 KB, se zavrne brez klica Googla (zaščita dnevne kvote) |
| Ločitev organizacij | Vsak zapis ima `org_id`; vsak dostop gre prek `require(id, ctx.orgId)` |
| Pravice | Vloge User/Admin preverjene v zaledju (`actions_()`), ne samo na strani |
| XSS | Vsa besedila prek `textContent`; brez `innerHTML`, `eval`, `new Function`; v pošti `esc_()` |
| CSP | Stran sme nalagati samo svoje skripte in Google prijavo, klicati samo Apps Script in Google prijavo (`index.html`) |
| Glave | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy` (`tools/build.js` → `_headers`) |
| Napake | Uporabnik ne vidi notranjih podrobnosti; zapišejo se v `RequestLog` |
| Izvoz | Celice, ki se začnejo z `= + - @`, dobijo `'` (CSV formula injection) |
| Priloge | Samo PDF in slike, do 25 MB; imena datotek očiščena |
| Objava | GitHub Actions; akcije pripete na SHA; `clasp` pripet na različico; produkcija zahteva ponovno vpisano ime |
| Brisanje | Podatki se ne brišejo, samo arhivirajo; vse spremembe v `AuditLog` |

## Naloge lastnika (koda jih ne more narediti)
Stanje vsake točke: **MANJKA** (ni preverjeno), dokler je lastnik ne potrdi.
1. **Google račun postavitve** (`robi.jeromel@gmail.com`): dvostopenjsko preverjanje (najbolje ključ za dostop /
   passkey ali aplikacija Google Authenticator, ne SMS), pregled *Varnostni pregled* na myaccount.google.com.
2. **GitHub račun** (`robijeromelsp-afk`): dvostopenjsko preverjanje; repozitorij `Servisi` **zaseben**;
   pisalne pravice samo lastnik. Kdor lahko piše v repozitorij, lahko objavi kodo zaledja (secret `CLASPRC_ROBI`).
3. **Cloudflare račun**: dvostopenjsko preverjanje; kdo ima dostop do `dolb.si`.
4. **Telefon in računalniki**: zaklep zaslona; ob izgubi *Odjavi vse naprave*.
5. **Seznam uporabnikov**: kdor ne dela več, *Nastavitve → Uporabniki → neaktiven* (velja takoj).

## Priporočilo za večjo izolacijo (odločitev lastnika)
Zaledje teče pod osebnim Gmailom in ima dovoljenje za celoten Drive in pošiljanje pošte s tega računa.
Najmočnejša dodatna zaščita je **ločen Google račun samo za aplikacijo** (npr. »servisi…@gmail.com«):
ob morebitni zlorabi bi bil izpostavljen samo ta račun, ne osebni Drive in pošta. Dodatno bi pošta
prihajala z naslova, ki že v imenu pove »Servisi«. Selitev: izvoz → nova postavitev → uvoz (POSTAVITEV.md, D).

## Znane omejitve
- Uporabnik aplikacije lahko pošlje povpraševanje na poljuben naslov z računa postavitve (namenoma).
  Ob zlorabi uporabniškega računa bi se dalo poslati pošto v imenu postavitve – omejeno s seznamom
  uporabnikov in Googlovo dnevno kvoto; vse zapisano v `MailLog`.
- Podatki zadnjega nalaganja so na napravi (localStorage) zaradi hitrosti; odjava jih pobriše.
- Ožji Google obsegi (npr. `drive.file` namesto `drive`) – PREVERITI, ali Apps Script z njimi deluje.
