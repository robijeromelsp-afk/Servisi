// Interface language. Texts are written in English in the code (they are the keys);
// the Slovenian dictionary below translates them. Missing keys fall back to English.
// The language comes from the organisation setting "language"; before sign-in the last
// used language (or Slovenian) is used.

const KEY = 'servisi.lang';

const SL = {
  // navigation and common
  'Overview': 'Pregled',
  'Objects': 'Objekti',
  'Settings': 'Nastavitve',
  'Loading…': 'Nalagam…',
  'Signing in…': 'Prijavljam…',
  'Working…': 'Delam…',
  'Save': 'Shrani',
  'Cancel': 'Prekliči',
  'Confirm': 'Potrdi',
  'Edit': 'Uredi',
  'Archive': 'Arhiviraj',
  'Restore': 'Obnovi',
  'Archived': 'Arhivirano',
  'Remove': 'Odstrani',
  'Add': 'Dodaj',
  'Reason': 'Razlog',
  'Saved.': 'Shranjeno.',
  'Show archived': 'Prikaži arhivirane',
  'Reload': 'Osveži',
  'Something went wrong': 'Prišlo je do napake',
  'Today {d}': 'Danes {d}',
  'Version {v}': 'Različica {v}',
  'Sign out ({e})': 'Odjava ({e})',
  'Intervals are entered by users. This application does not provide legal advice and does not verify statutory deadlines.':
    'Intervale vnašajo uporabniki. Aplikacija ne daje pravnih nasvetov in ne preverja zakonskih rokov.',
  'Nothing here.': 'Tu ni ničesar.',
  'Sort order': 'Vrstni red',
  'Name': 'Ime',
  'Note': 'Opomba',
  'Description': 'Opis',
  'E-mail': 'E-naslov',
  'Phone': 'Telefon',

  // sign-in and setup
  'Recurring obligations on your buildings and boiler rooms.': 'Ponavljajoče se obveznosti na vaših stavbah in kotlovnicah.',
  'Not configured': 'Ni nastavljeno',
  'This site has no backend configured (BACKENDS). See docs/POSTAVITEV.md.': 'Stran nima nastavljenega zaledja (BACKENDS). Glej docs/POSTAVITEV.md.',
  'Sign-in failed. Try again.': 'Prijava ni uspela. Poskusite znova.',
  'The account {e} is not on the access list. Ask your administrator to add it.': 'Račun {e} ni na seznamu dostopa. Prosite skrbnika, da ga doda.',
  'Choose organisation': 'Izberite organizacijo',
  'Set up Servisi': 'Nastavitev aplikacije Servisi',
  'You are the owner of this deployment ({e}). This is done once.': 'Ste lastnik te postavitve ({e}). To se naredi enkrat.',
  'Organisation name': 'Ime organizacije',
  'Your name': 'Vaše ime',
  'Spreadsheet (optional)': 'Tabela (neobvezno)',
  'Leave empty to create a new spreadsheet in your Drive. To use a spreadsheet shared with you, paste its link (you need edit access).':
    'Pustite prazno, da se v vašem Drive ustvari nova tabela. Za tabelo, ki je deljena z vami, prilepite povezavo (potrebujete pravico urejanja).',
  'Attachment storage of another deployment (optional)': 'Shramba prilog druge postavitve (neobvezno)',
  'Leave empty to store attachments in your own Drive.': 'Pustite prazno, da se priloge hranijo v vašem Drive.',
  'Language': 'Jezik',
  'Set up': 'Nastavi',
  'Set up.': 'Nastavljeno.',

  // banner
  'Daily check has not run since {d}. E-mails may not be sent. ': 'Dnevno preverjanje ni teklo od {d}. Pošta morda ne odhaja. ',
  'Daily check has not run yet. E-mails are not being sent. ': 'Dnevno preverjanje še ni teklo. Pošta ne odhaja. ',
  'The last daily check reported errors. ': 'Zadnje dnevno preverjanje je javilo napake. ',
  'Open status': 'Odpri stanje',
  'Tell your administrator.': 'Obvestite skrbnika.',

  // classes and overview
  'Overdue': 'Zamujeno',
  'This month': 'Ta mesec',
  'Next month': 'Naslednji mesec',
  'Later': 'Kasneje',
  'Incomplete': 'Nepopolno',
  'Snoozed': 'Opomniki',
  'Needs attention': 'Potrebno pozornosti',
  'reminder {d}': 'opomnik {d}',
  'Incomplete repeat settings (no due date)': 'Nepopolna nastavitev ponavljanja (brez roka)',
  'Objects without obligations': 'Objekti brez obveznosti',
  'Objects without a responsible user (e-mails go to administrators)': 'Objekti brez odgovorne osebe (pošta gre skrbnikom)',
  'Nothing needs attention.': 'Nič ne potrebuje pozornosti.',

  // objects
  'Add object': 'Dodaj objekt',
  'Search code, name, address': 'Iskanje po oznaki, imenu, naslovu',
  'All kinds': 'Vse vrste',
  'No objects.': 'Ni objektov.',
  '{n} overdue': 'zamujeno: {n}',
  '{n} obligations': 'obveznosti: {n}',
  'Object not found.': 'Objekt ne obstaja.',
  '← Objects': '← Objekti',
  'Archive {c}?': 'Arhiviram {c}?',
  'Reason (its {n} obligations are archived with it)': 'Razlog (z njim se arhivira tudi {n} obveznosti)',
  'Archived {d}: {r}': 'Arhivirano {d}: {r}',
  'Address': 'Naslov',
  'Kind': 'Vrsta',
  'Responsible': 'Odgovorna oseba',
  'nobody – e-mails go to administrators': 'nihče – pošta gre skrbnikom',
  'Site contact': 'Kontakt na objektu',
  'Add obligation': 'Dodaj obveznost',
  'Obligations ({n})': 'Obveznosti ({n})',
  'No obligations yet.': 'Še ni obveznosti.',
  'Archived obligations ({n})': 'Arhivirane obveznosti ({n})',
  'Code': 'Oznaka',
  'Code (optional)': 'Oznaka (neobvezno)',
  'Short label, e.g. K12. Leave empty if it is the same as the name.': 'Kratka oznaka, npr. K12. Pustite prazno, če je enaka imenu.',
  'Choose from the list or type your own; a new kind is added to the list.': 'Izberite s seznama ali vpišite svojo; nova vrsta se doda na seznam.',
  'Short label, e.g. K12. Must be unique.': 'Kratka oznaka, npr. K12. Mora biti enolična.',
  'Responsible user': 'Odgovorna oseba',
  '— (e-mails go to administrators)': '— (pošta gre skrbnikom)',
  'Receives the monthly e-mail for this object.': 'Prejema mesečno pošto za ta objekt.',
  'Caretaker, owners\' representative, phone…': 'Hišnik, predstavnik etažnih lastnikov, telefon…',
  'Edit {c}': 'Uredi {c}',

  // obligation
  'Obligation not found.': 'Obveznost ne obstaja.',
  'Object': 'Objekt',
  'Archive this obligation?': 'Arhiviram to obveznost?',
  'Next due': 'Naslednji rok',
  'Repeat settings are incomplete, so no due date can be computed: ': 'Nastavitev ponavljanja ni popolna, zato roka ni mogoče izračunati: ',
  'Reminder on {d}': 'Opomnik {d}',
  'Cancel reminder': 'Prekliči opomnik',
  'Repeat': 'Ponavljanje',
  'Then': 'Nato',
  'Contractor': 'Izvajalec',
  'Choose from the list or type a new one; it is added to the obligation types.': 'Izberite s seznama ali vpišite novo; doda se med vrste obveznosti.',
  'Choose from the list or type a new one; it is added to the contractors.': 'Izberite s seznama ali vpišite novega; doda se med izvajalce.',
  'Contractor e-mail': 'E-naslov izvajalca',
  'Contractor phone': 'Telefon izvajalca',
  'Warning': 'Opozorilo',
  '{n} days before due': '{n} dni pred rokom',
  'Also notify': 'Obvesti tudi',
  'Mark done': 'Označi opravljeno',
  'Remind me': 'Opomni me',
  'History': 'Zgodovina',
  'Loading history…': 'Nalagam zgodovino…',
  'History could not be loaded: {m}': 'Zgodovine ni bilo mogoče naložiti: {m}',
  'Try again': 'Poskusi znova',
  'Could not refresh the data: {m}': 'Podatkov ni bilo mogoče osvežiti: {m}',
  'Not done yet in this application.': 'V tej aplikaciji še ni bilo opravljeno.',
  'Skipped due date {d}': 'Izpuščen rok {d}',
  'Passed over because the previous due date was done late (calendar counting).': 'Preskočen, ker je bil prejšnji rok opravljen z zamudo (štetje po koledarju).',
  'Skipped': 'Izpuščeno',
  'Void': 'Razveljavi',
  'Void this completion?': 'Razveljavim to izvedbo?',
  'Reason (the record stays in the history)': 'Razlog (zapis ostane v zgodovini)',
  'Voided. Due date recalculated.': 'Razveljavljeno. Rok je ponovno izračunan.',
  'Done {d}': 'Opravljeno {d}',
  ' · closed due {d}': ' · zaprt rok {d}',
  'by {u} · recorded {d}': '{u} · vpisano {d}',
  'Voided {d} by {u}: {r}': 'Razveljavil {u} {d}: {r}',
  'Voided': 'Razveljavljeno',
  'Late': 'Z zamudo',
  'On time': 'Pravočasno',
  'Sends you an extra e-mail on that day. The regular due date does not change.': 'Tisti dan vam pošlje dodatno sporočilo. Redni rok se ne spremeni.',
  'In how many days': 'Čez koliko dni',
  'e.g. 7': 'npr. 7',
  '…or on date': '…ali na datum',
  'Set reminder': 'Nastavi opomnik',
  'Reminder set for {d}.': 'Opomnik nastavljen za {d}.',

  // attachment kinds
  'Report': 'Poročilo',
  'Invoice': 'Račun',
  'Photo': 'Slika',
  'Measurement': 'Meritev',
  'Other': 'Drugo',

  // obligation form
  '— choose —': '— izberite —',
  'Monthly': 'Mesečno',
  'Quarterly': 'Četrtletno',
  'Half-yearly': 'Polletno',
  'Yearly': 'Letno',
  'Every N years': 'Na N let',
  'Advanced (short intervals)': 'Napredno (kratki intervali)',
  'Every N days': 'Na N dni',
  'Weekly': 'Tedensko',
  'Daily': 'Dnevno',
  'Day of month': 'Dan v mesecu',
  '1 to 28, so that every month has it.': 'Od 1 do 28, da ga ima vsak mesec.',
  'Months': 'Meseci',
  'Month': 'Mesec',
  'Weekday': 'Dan v tednu',
  'Interval': 'Interval',
  'Obligation type': 'Vrsta obveznosti',
  'Types marked "suggested" come from a starting list and are not verified.': 'Vrste z oznako »predlog« so iz začetnega seznama in niso preverjene.',
  ' (suggested)': ' (predlog)',
  'Count the next due date': 'Štetje naslednjega roka',
  'By calendar (fixed dates)': 'Po koledarju (fiksni datumi)',
  'From the last completion': 'Od zadnje izvedbe',
  'By calendar: a late completion does not move later due dates. From the last completion: a delay moves all later due dates.':
    'Po koledarju: zamuda ne premakne naslednjih rokov. Od zadnje izvedbe: zamuda premakne vse naslednje roke.',
  'Repeats': 'Ponavlja se',
  'Start date': 'Začetni datum',
  'The first due date is on or after this date.': 'Prvi rok je na ta dan ali kasneje.',
  'Last done before this app (optional)': 'Nazadnje opravljeno pred to aplikacijo (neobvezno)',
  'If you know when it was last done, the first due date is counted from it.': 'Če veste, kdaj je bilo nazadnje opravljeno, se prvi rok šteje od tega datuma.',
  'Notifications': 'Obvestila',
  'Warn days before due (optional)': 'Opozori dni pred rokom (neobvezno)',
  'Sends an extra e-mail this many days before the due date.': 'Pošlje dodatno sporočilo toliko dni pred rokom.',
  'Also notify users': 'Obvesti tudi uporabnike',
  'The responsible user of the object ({u}) always gets it.': 'Odgovorna oseba objekta ({u}) ga prejme vedno.',
  'administrators': 'skrbniki',
  'Also notify e-mail addresses (optional)': 'Obvesti tudi e-naslove (neobvezno)',
  'One per line, e.g. the contractor. They receive only their own lines, without links.': 'En na vrstico, npr. izvajalec. Prejme samo svoje vrstice, brez povezav.',
  'Every how many years': 'Na koliko let',
  'Every how many days': 'Na koliko dni',
  'Description: ': 'Opis: ',
  '. The due date is recalculated from the history when you save.': '. Rok se ob shranjevanju ponovno izračuna iz zgodovine.',
  'Not complete yet: ': 'Še ni popolno: ',
  'Due dates: ': 'Roki: ',
  'Saved, but the repeat settings are incomplete.': 'Shranjeno, a nastavitev ponavljanja ni popolna.',
  'Saved. Next due {d}.': 'Shranjeno. Naslednji rok {d}.',
  'Edit obligation': 'Uredi obveznost',

  // mark done
  'Date done': 'Datum izvedbe',
  'Enter the date.': 'Vnesite datum.',
  'This closes the due date {d}{late}. ': 'S tem se zapre rok {d}{late}. ',
  ' (late)': ' (z zamudo)',
  'Next due: {d}.': 'Naslednji rok: {d}.',
  ' Skipped as missed: {d}.': ' Izpuščeno kot zamujeno: {d}.',
  'Attachments': 'Priloge',
  'Camera': 'Kamera',
  'File': 'Datoteka',
  'Report, invoice, photo or measurement (PDF or image). Photos are reduced to 1600 px before upload.':
    'Poročilo, račun, slika ali meritev (PDF ali slika). Slike se pred nalaganjem pomanjšajo na 1600 px.',
  'Save as done': 'Shrani kot opravljeno',
  'Preparing…': 'Pripravljam…',
  'Uploading {s}{was}…': 'Nalagam {s}{was}…',
  ' (was {s})': ' (prej {s})',
  'Uploaded {s}': 'Naloženo {s}',
  '{f} is larger than 25 MB.': '{f} je večja od 25 MB.',
  'Done. Next due {d}.': 'Opravljeno. Naslednji rok {d}.',
  'Not uploaded – press Save again to retry': 'Ni naloženo – pritisnite Shrani za ponoven poskus',
  '← Back': '← Nazaj',

  // settings
  'Users': 'Uporabniki',
  'Obligation types': 'Vrste obveznosti',
  'Contractors': 'Izvajalci',
  'Object kinds': 'Vrste objektov',
  'Storage': 'Shramba',
  'Status': 'Stanje',
  'Export / import': 'Izvoz / uvoz',
  'Only administrators can change this.': 'To lahko spreminjajo samo skrbniki.',
  'Day of the monthly e-mail': 'Dan mesečne pošte',
  'If the daily check misses that day, the e-mail is sent at the next run.': 'Če dnevno preverjanje ta dan izpade, gre pošta ob naslednjem teku.',
  'Hour of the daily check': 'Ura dnevnega preverjanja',
  'Time zone {z}. Google runs it within that hour.': 'Časovni pas {z}. Google ga zažene v tej uri.',
  'Weekly reminder on Mondays when something is overdue': 'Tedenski opomnik ob ponedeljkih, če je kaj zamujenega',
  'Sender name': 'Ime pošiljatelja',
  'Application link (used in e-mails)': 'Povezava do aplikacije (za pošto)',
  'Attachment storage of another deployment': 'Shramba prilog druge postavitve',
  'Empty = attachments are stored by this deployment.': 'Prazno = priloge hrani ta postavitev.',
  'Language of the application and the e-mails': 'Jezik aplikacije in pošte',
  'Send test e-mail to me': 'Pošlji mi testno sporočilo',
  'Sent to {e}.': 'Poslano na {e}.',
  'Suggestions – not verified, not legal advice. The starting list only names typical obligations. ':
    'Predlogi – niso preverjeni in niso pravni nasvet. Začetni seznam samo poimenuje tipične obveznosti. ',
  'It contains no intervals: you enter them for each obligation. Untick "Suggested" once you have checked a type.':
    'Ne vsebuje intervalov: te vpišete pri vsaki obveznosti. Ko vrsto preverite, odstranite kljukico »Predlog«.',
  'Group': 'Skupina',
  'Groups': 'Skupine',
  'Suggested – not verified': 'Predlog – ni preverjeno',
  'Archived in settings': 'Arhivirano v nastavitvah',
  'Contact person': 'Kontaktna oseba',
  'Edit user': 'Uredi uporabnika',
  'Add user': 'Dodaj uporabnika',
  'Google e-mail': 'Google e-naslov',
  'E-mail for notifications (optional)': 'E-naslov za obvestila (neobvezno)',
  'E.g. a work address. Monthly e-mails, warnings and reminders go here; sign-in stays with the Google account.':
    'Npr. službeni naslov. Sem gredo mesečna pošta, opozorila in opomniki; prijava ostane z Google računom.',
  'The user signs in with this Google account.': 'Uporabnik se prijavi s tem Google računom.',
  'Role': 'Vloga',
  'User': 'Uporabnik',
  'Administrator': 'Skrbnik',
  'Admin': 'Skrbnik',
  'Active (may sign in)': 'Aktiven (se lahko prijavi)',
  'Inactive': 'Neaktiven',
  'Only these Google accounts can sign in to this organisation. Users are deactivated, never deleted.':
    'V to organizacijo se lahko prijavijo samo ti Google računi. Uporabniki se deaktivirajo, nikoli ne izbrišejo.',
  'Attachments of this organisation are stored by another deployment:': 'Priloge te organizacije hrani druga postavitev:',
  '— not set —': '— ni nastavljeno —',
  'Folder: {f}': 'Mapa: {f}',
  'Removed in settings': 'Odstranjeno v nastavitvah',
  'None.': 'Ni.',
  'Folder name (their organisation)': 'Ime mape (njihova organizacija)',
  'Allow': 'Dovoli',
  'Attachments of this organisation are stored in the Drive of the account this deployment runs under. ':
    'Priloge te organizacije se hranijo v Drive računa, pod katerim teče ta postavitev. ',
  'Users of other deployments listed here may store their attachments here too, each in their own folder.':
    'Uporabniki drugih postavitev s tega seznama lahko sem shranjujejo svoje priloge, vsak v svojo mapo.',
  'Other deployments allowed to store attachments': 'Druge postavitve, ki smejo shranjevati priloge',
  'Run daily check now': 'Zaženi dnevno preverjanje',
  'Done. E-mails: monthly {m}, warnings {w}, reminders {r}, weekly {k}.': 'Opravljeno. Pošta: mesečna {m}, opozorila {w}, opomniki {r}, tedenska {k}.',
  ' Errors: {e}': ' Napake: {e}',
  'Install daily trigger': 'Namesti dnevni sprožilec',
  'Installed.': 'Nameščeno.',
  'Daily trigger': 'Dnevni sprožilec',
  'Installed': 'Nameščen',
  'Missing': 'Manjka',
  'Last daily check': 'Zadnje dnevno preverjanje',
  'never': 'še nikoli',
  'Result': 'Rezultat',
  'E-mail quota left today': 'Preostala dnevna kvota pošte',
  'Recent e-mails': 'Zadnja sporočila',
  'mail:Monthly': 'Mesečna pošta',
  'mail:Warning': 'Opozorilo pred rokom',
  'mail:Snooze': 'Opomnik',
  'mail:WeeklyOverdue': 'Tedenski opomnik',
  'mail:Test': 'Testno sporočilo',
  'mail:Quote': 'Povpraševanje',
  'Sent': 'Poslano',
  'Kind ': 'Vrsta',
  'To': 'Prejemnik',
  'Items': 'Postavk',
  'No e-mails sent yet.': 'Poslano še ni bilo nobeno sporočilo.',
  'Export all data': 'Izvozi vse podatke',
  'Export downloaded.': 'Izvoz je prenesen.',
  'Import data.json': 'Uvozi data.json',
  'Choose data.json from an export first.': 'Najprej izberite data.json iz izvoza.',
  'Imported: {x}': 'Uvoženo: {x}',
  'Export': 'Izvoz',
  'Import': 'Uvoz',
  'Downloads one ZIP file with every record of this organisation (archived records and logs included) as JSON and CSV, ':
    'Prenese eno datoteko ZIP z vsemi zapisi te organizacije (tudi arhiviranimi in dnevniki) v obliki JSON in CSV ',
  'and a list of attachments with their Drive links. Keep it as a backup or to move to another deployment.':
    'ter seznam prilog s povezavami na Drive. Hranite jo kot varnostno kopijo ali za selitev na drugo postavitev.',
  'Imports data.json from an export into this organisation. Only possible while it has no objects and no obligations.':
    'Uvozi data.json iz izvoza v to organizacijo. Mogoče samo, dokler nima objektov in obveznosti.',

  // quote requests
  'Request quote': 'Povpraši za ponudbo',
  'Request for quote: {type} – {object}': 'Povpraševanje za ponudbo: {type} – {object}',
  'Dear Sir or Madam,\n\nwe kindly ask for a quote for: {type}\nObject: {object}\nAddress: {address}\nDue date: {due}\nSite contact: {site_contact}\nNote: {note}\n\nPlease include the price and the earliest possible date of execution.\n\nKind regards,\n{sender}':
    'Spoštovani,\n\nprosimo za ponudbo za: {type}\nObjekt: {object}\nNaslov: {address}\nRok: {due}\nKontakt na objektu: {site_contact}\nOpomba: {note}\n\nProsimo, da v ponudbi navedete ceno in najzgodnejši možni termin izvedbe.\n\nLep pozdrav,\n{sender}',
  'No contractor is set for this obligation. Enter the e-mail address.': 'Pri tej obveznosti ni izvajalca. Vpišite e-naslov.',
  'Several addresses separated by commas.': 'Več naslovov ločite z vejico.',
  'Subject': 'Zadeva',
  'Text': 'Besedilo',
  'Send: the application sends it; replies and a copy go to your e-mail for notifications. Open as draft: your own e-mail program opens and you send it yourself.':
    'Pošlji: sporočilo pošlje aplikacija; odgovori in kopija gredo na vaš e-naslov za obvestila. Odpri kot osnutek: odpre se vaš poštni program in sporočilo pošljete sami.',
  'Send': 'Pošlji',
  'Send to me for forwarding': 'Pošlji meni za posredovanje',
  'Send to contractor': 'Pošlji izvajalcu',
  'Open as draft: your own e-mail program opens with the request; you send it from your own address.':
    'Odpri kot osnutek: odpre se vaš poštni program s pripravljenim povpraševanjem; pošljete ga s svojega naslova.',
  'Send to me for forwarding: the request arrives at {e}; forward it to contractors from there.':
    'Pošlji meni za posredovanje: povpraševanje pride na {e}; od tam ga posredujete izvajalcem.',
  'Send to contractor: the application sends it; replies and a copy go to {e}.':
    'Pošlji izvajalcu: pošlje ga aplikacija; odgovori in kopija gredo na {e}.',
  'Sent to {e} for forwarding.': 'Poslano na {e} za posredovanje.',
  'Quote request sent to me for forwarding {d}': 'Povpraševanje poslano meni za posredovanje {d}',
  'Open as draft': 'Odpri kot osnutek',
  'Quote request sent.': 'Povpraševanje je poslano.',
  'Draft opened and recorded in the history.': 'Osnutek je odprt in zapisan v zgodovino.',
  'Quote requested {d}': 'Povpraševanje poslano {d}',
  'Quote request drafted {d}': 'Povpraševanje pripravljeno kot osnutek {d}',
  'to {r} · by {u}': 'prejemnik {r} · {u}',
  'Quote': 'Ponudba',
  'Quote request – subject': 'Povpraševanje – zadeva',
  'Quote request – text': 'Povpraševanje – besedilo',
  'Empty = default text. Placeholders: {type} {object} {address} {due} {site_contact} {note} {contractor} {sender}. A line whose placeholders are empty is left out.':
    'Prazno = privzeto besedilo. Oznake: {type} {object} {address} {due} {site_contact} {note} {contractor} {sender}. Vrstica s praznimi oznakami se izpusti.',

  // api errors raised in the browser
  'The server did not answer in time. Check the connection and try again.': 'Strežnik ni odgovoril pravočasno. Preverite povezavo in poskusite znova.',
  'No connection to the server. Check the connection and try again.': 'Ni povezave s strežnikom. Preverite povezavo in poskusite znova.',
  'The server returned an unexpected answer (HTTP {s}).': 'Strežnik je vrnil nepričakovan odgovor (HTTP {s}).',
  'No organisation selected.': 'Organizacija ni izbrana.'
};

const EN = {
  'mail:Monthly': 'Monthly', 'mail:Warning': 'Warning before due', 'mail:Snooze': 'Reminder',
  'mail:WeeklyOverdue': 'Weekly reminder', 'mail:Test': 'Test e-mail', 'mail:Quote': 'Quote request'
};

const DICTS = { sl: SL, en: EN };

function load() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

let lang = DICTS[load()] ? load() : 'sl';

export function getLang() {
  return lang;
}

export function setLang(l) {
  if (!DICTS[l]) return;
  lang = l;
  document.documentElement.lang = l;
  try { localStorage.setItem(KEY, l); } catch (e) { /* not essential */ }
}

/** Translates an English text; {x} placeholders are filled from args. */
export function t(text, args) {
  let s = (DICTS[lang] && DICTS[lang][text]) || text;
  for (const [k, v] of Object.entries(args || {})) s = s.split('{' + k + '}').join(String(v));
  return s;
}

/** Translates static elements marked with data-i18n (navigation in index.html). */
export function translateStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
}

export const LANGUAGES = [{ value: 'sl', label: 'Slovenščina' }, { value: 'en', label: 'English' }];

document.documentElement.lang = lang;
