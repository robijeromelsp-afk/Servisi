# Pošiljanje pošte prek Office 365 – vprašanje za informatika

## Za kaj gre
»Servisi« je spletna aplikacija za spremljanje rokov servisov in pregledov na objektih. Zaledje teče
v Googlovem okolju (Google Apps Script). Aplikacija pošilja:
- obvestila o rokih uporabniku (nekaj sporočil na mesec),
- povpraševanja za ponudbo izvajalcem (nekaj sporočil na mesec).

Zdaj pošilja z Google računa. Želja: povpraševanja izvajalcem naj gredo s **službenega naslova v Office 365**,
da odgovori pridejo v službeni predal in je pošta v skladu s pravili podjetja.

Ocenjen obseg: manj kot 100 sporočil na mesec (OCENA).

## Predlagana rešitev: Microsoft Graph, pravica samo za en predal
1. V Microsoft Entra ID se registrira aplikacija (npr. »Servisi«).
2. Aplikacija dobi **aplikacijsko pravico `Mail.Send`** (Microsoft Graph), s soglasjem skrbnika.
3. Pravica se **omeji na en sam predal**: službeni naslov uporabnika ali skupni predal, npr. `servisi@podjetje.si`.
   Omejitev se nastavi z *Application Access Policy* (Exchange Online) ali z novejšim
   *RBAC for Applications*. Brez te omejitve bi aplikacija lahko pošiljala s katerega koli predala, zato je
   ta korak obvezen.
4. Za prijavo aplikacije se uporabi skrivnost (client secret) ali certifikat. **Skrivnost vpiše skrbnik ali
   uporabnik neposredno v nastavitve aplikacije.** Shrani se v Script Properties Google Apps Script projekta,
   ne v kodo in ne v e-pošto.
5. Aplikacija pošilja z ukazom Graph `POST /users/{predal}/sendMail`.

Od informatika bi potrebovali:
- Tenant ID,
- Client ID (Application ID),
- naslov predala, s katerega naj se pošilja,
- skrivnost ali certifikat (predaja neposredno v nastavitve, ne po pošti),
- potrditev, da je dostop omejen na ta predal.

## Česa NE predlagamo
- **SMTP z uporabniškim imenom in geslom** (smtp.office365.com): Microsoft opušča osnovno prijavo
  (Basic Auth) tudi za SMTP AUTH. Točen datum PREVERITI v Microsoftovi dokumentaciji. Poleg tega bi bilo
  treba shranjevati geslo službenega računa.
- Posredovanje gesla službenega računa komur koli.

## Kaj deluje že zdaj, brez posega v Office 365
- **»Odpri kot osnutek«**: na napravi, kjer je nastavljen Outlook, se odpre pripravljeno sporočilo
  s službenega naslova; uporabnik ga pošlje sam.
- **»Pošlji meni za posredovanje«**: povpraševanje pride v službeni predal, uporabnik ga posreduje.

## Stanje
Ta rešitev v aplikaciji še ni narejena. Naredimo jo, če informatika potrdi, da je pot z Graph
in omejitvijo na en predal sprejemljiva.
