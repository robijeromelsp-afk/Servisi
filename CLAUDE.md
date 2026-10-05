# CLAUDE.md – pravila za delo na tem repozitoriju

Ta datoteka je namenjena Claude in vsakomur, ki nadaljuje razvoj. Pogovor z lastnikom je v
slovenščini; vmesnik aplikacije (gumbi, meniji) je v angleščini.

## Najprej preberi
1. `docs/PRIROCNIK.md` – stanje, odločitve, pasti. Posodobi ga ob vsaki pomembni spremembi.
2. `docs/NACRT.md` – potrjen načrt (podatkovni model, pravila rokov, zasloni, pošta).
3. `docs/POSTAVITEV.md` – kako se postavi nova postavitev.

## Pravila dela (obvezna)
- Česar ne veš ali nimaš, napiši **MANJKA**. Ne izmišljuj si podatkov, rokov ali vsebine datotek.
- Ne trdi, da je bil test, uvoz, namestitev sprožilca ali objava opravljena, če ni bila
  in ni preverjena. Kar je ocena in ne meritev, označi kot OCENA.
- **Objava na produkcijo samo z izrecno potrditvijo lastnika postavitve.**
- Podatkov se nikoli ne briše – samo arhivira. Preden karkoli izbrišeš (datoteko, vejo,
  zapis), napiši točno, kaj brišeš, in počakaj na potrditev.
- Gesel, žetonov in ključev ne vpisuj v kodo in jih ne pošiljaj v pogovor.
  Nastavitve postavitve so v Script Properties, listu `Settings` in Cloudflare spremenljivkah.
- V kodi ni imen oseb, e-naslovov, imen objektov ali podjetij.
- Zakonskih rokov aplikacija ne predlaga. Šifrant vrst je predlog, označen
  »Suggested – not verified«. Nič ne sme izpasti kot pravni nasvet.
- Brez `eval()` in brez nalaganja kode z Drive.
- Rešitev ne sme biti vezana na eno napravo (lastnik dela z več računalnikov in telefona).

## Zgradba
```
shared/schedule.js   izračun rokov (čista funkcija; teče v Apps Script, brskalniku in Node)
backend/             Apps Script (zaledje, JSON API, dnevno opravilo, pošta)
frontend/            statična stran (Cloudflare Pages), brez ogrodja
tests/               Node testi (node --test), brez zunanjih knjižnic
tools/build.js       sestavi dist/backend in dist/frontend
seed/                predlagani šifranti (z oznako is_suggestion)
docs/                dokumentacija
```

## Ukazi
```
npm test             vsi testi (morajo biti zeleni pred vsakim potiskom)
npm run build        dist/backend (za clasp) in dist/frontend (za Cloudflare)
```

## Pasti
Glej `docs/PRIROCNIK.md`, razdelek »Pasti«. Ko naletiš na novo, jo zapiši tja.
