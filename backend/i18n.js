/**
 * Translation of error messages returned to the page. Messages are written in English in
 * the code; the page sends its language (lang) with every request and the message is
 * translated here before it is returned. Unknown messages are returned unchanged.
 */

var ERROR_LABELS_SL = {
  'Code': 'Oznaka', 'Name': 'Ime', 'Reason': 'Razlog', 'Obligation type': 'Vrsta obveznosti',
  'Date done': 'Datum izvedbe', 'Attachment file id': 'ID datoteke priloge', 'E-mail': 'E-naslov',
  'Organisation label': 'Ime mape', 'Object': 'Objekt', 'Obligation': 'Obveznost', 'Organisation': 'Organizacija',
  'Object kind': 'Vrsta objekta', 'Responsible user': 'Odgovorni uporabnik', 'Contractor': 'Izvajalec',
  'Completion': 'Izvedba', 'Reminder': 'Opomnik', 'Group': 'Skupina', 'Recipient': 'Prejemnik', 'Record': 'Zapis',
  'Weekday': 'Dan v tednu', 'Interval': 'Interval', 'Day of month': 'Dan v mesecu', 'Month': 'Mesec',
  'Warning days': 'Število dni opozorila', 'Days': 'Število dni', 'Sort': 'Vrstni red',
  'Day of the monthly e-mail': 'Dan mesečne pošte', 'Hour': 'Ura', 'Start date': 'Začetni datum',
  'Last done date': 'Datum zadnje izvedbe', 'Reminder date': 'Datum opomnika',
  'Subject': 'Zadeva', 'Text': 'Besedilo'
};

var ERRORS_SL = {
  'Sign in required.': 'Potrebna je prijava.',
  'Your sign-in has expired. Sign in again.': 'Prijava je potekla. Prijavite se znova.',
  'Sign-in was not issued by Google.': 'Prijave ni izdal Google.',
  'Your Google e-mail address is not verified.': 'Vaš Google e-naslov ni potrjen.',
  'Sign-in was issued for a different application.': 'Prijava je bila izdana za drugo aplikacijo.',
  'The application has not been set up yet.': 'Aplikacija še ni nastavljena.',
  'This record was changed by someone else in the meantime. Reload and try again.':
    'Zapis je medtem spremenil nekdo drug. Osvežite in poskusite znova.',
  'Your account is not on the access list.': 'Vaš račun ni na seznamu dostopa.',
  'Only an administrator can do this.': 'To lahko naredi samo skrbnik.',
  'The server is busy. Try again in a moment.': 'Strežnik je zaseden. Poskusite čez trenutek.',
  'The application is already set up.': 'Aplikacija je že nastavljena.',
  'Only the owner of this deployment can set it up.': 'Nastavi jo lahko samo lastnik te postavitve.',
  'Enter the organisation name.': 'Vnesite ime organizacije.',
  'The spreadsheet cannot be opened with this account. Check the link and sharing (editor).':
    'Tabele s tem računom ni mogoče odpreti. Preverite povezavo in deljenje (urejevalec).',
  'This spreadsheet already contains users. It cannot be set up again.':
    'Ta tabela že vsebuje uporabnike. Ponovna nastavitev ni mogoča.',
  'The object is archived.': 'Objekt je arhiviran.',
  'Unknown repeat type.': 'Neznana vrsta ponavljanja.',
  'Unknown counting mode.': 'Neznan način štetja.',
  'Last done date cannot be in the future.': 'Datum zadnje izvedbe ne more biti v prihodnosti.',
  'The obligation is archived.': 'Obveznost je arhivirana.',
  'Restore the object first.': 'Najprej obnovite objekt.',
  'Date done cannot be in the future.': 'Datum izvedbe ne more biti v prihodnosti.',
  'Complete the repeat settings of this obligation first.': 'Najprej dopolnite nastavitev ponavljanja te obveznosti.',
  'Attachment link is not a Google Drive link.': 'Povezava priloge ni povezava Google Drive.',
  'Already voided.': 'Že razveljavljeno.',
  'Enter the number of days or a date.': 'Vnesite število dni ali datum.',
  'The reminder date must be after today.': 'Datum opomnika mora biti po današnjem dnevu.',
  'Unknown list.': 'Neznan šifrant.',
  'E-mail is not valid.': 'E-naslov ni veljaven.',
  'Contractor e-mail is not valid.': 'E-naslov izvajalca ni veljaven.',
  'E-mail for notifications is not valid.': 'E-naslov za obvestila ni veljaven.',
  'This e-mail is already on the access list.': 'Ta e-naslov je že na seznamu dostopa.',
  'At least one active administrator is required.': 'Potreben je vsaj en aktiven skrbnik.',
  'Links must start with https://': 'Povezave se morajo začeti s https://',
  'Unknown language.': 'Neznan jezik.',
  'This deployment does not store attachments.': 'Ta postavitev ne hrani prilog.',
  'Your account may not upload attachments here.': 'Vaš račun sem ne sme nalagati prilog.',
  'Only PDF and images can be attached.': 'Priložiti je mogoče samo PDF in slike.',
  'Attachment date is missing.': 'Manjka datum priloge.',
  'The file could not be read.': 'Datoteke ni bilo mogoče prebrati.',
  'The file is empty.': 'Datoteka je prazna.',
  'The file is larger than 25 MB.': 'Datoteka je večja od 25 MB.',
  'Another run is in progress.': 'Preverjanje že teče.',
  'This is not a Servisi export (data.json) of a supported version.':
    'To ni izvoz Servisi (data.json) podprte različice.',
  'Import is only possible into an organisation without objects and obligations.':
    'Uvoz je mogoč samo v organizacijo brez objektov in obveznosti.'
};

var ERROR_PATTERNS_SL = [
  [/^(.+) is required\.$/, function (m) { return labelSl_(m[1]) + ' je obvezen podatek.'; }],
  [/^(.+) not found\.$/, function (m) { return labelSl_(m[1]) + ' ne obstaja.'; }],
  [/^(.+) must be (\d+) to (\d+)\.$/, function (m) { return labelSl_(m[1]) + ' mora biti od ' + m[2] + ' do ' + m[3] + '.'; }],
  [/^(.+) is not a valid date \(YYYY-MM-DD\)\.$/, function (m) { return labelSl_(m[1]) + ' ni veljaven datum.'; }],
  [/^Another active object already has code (.+)\.$/, function (m) { return 'Drug aktiven objekt že ima oznako ' + m[1] + '.'; }],
  [/^Recipient e-mail is not valid: (.+)$/, function (m) { return 'E-naslov prejemnika ni veljaven: ' + m[1]; }],
  [/^The due date changed in the meantime \(now (.*)\)\. Reload and try again\.$/,
    function (m) { return 'Rok se je medtem spremenil (zdaj ' + m[1] + '). Osvežite in poskusite znova.'; }],
  [/^The e-mail could not be sent: (.*)$/, function (m) { return 'Sporočila ni bilo mogoče poslati: ' + m[1]; }],
  [/^Unknown action: (.*)$/, function (m) { return 'Neznano dejanje: ' + m[1]; }],
  [/^Unexpected server error: (.*)$/, function (m) { return 'Nepričakovana napaka strežnika: ' + m[1]; }]
];

function labelSl_(label) {
  return ERROR_LABELS_SL[label] || label;
}

function translateError_(message, lang) {
  if (lang !== 'sl') return message;
  if (ERRORS_SL[message]) return ERRORS_SL[message];
  for (var i = 0; i < ERROR_PATTERNS_SL.length; i++) {
    var m = ERROR_PATTERNS_SL[i][0].exec(message);
    if (m) return ERROR_PATTERNS_SL[i][1](m);
  }
  return message;
}
