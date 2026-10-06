/**
 * Suggested starting catalog. Every entry is marked is_suggestion = true and is shown as
 * "Suggested - not verified". It contains NO intervals and NO deadlines: those are entered
 * by the users for each obligation. Nothing here is legal advice.
 */

// Names as given by the first users (data, not interface text; editable in Settings).
var SEED_OBJECT_KINDS = ['Kotlovnica', 'Toplarna', 'Toplotna podpostaja', 'Stanovanjska stavba',
  'Poslovna stavba', 'Javni objekt', 'Industrijski objekt', 'Drugo'];

var SEED_GROUPS = [
  ['Kurilne naprave', ['Dimnikarski pregled', 'Čiščenje', 'Meritve emisij', 'Servis kotla', 'Plinska napeljava']],
  ['Požarna varnost', ['Gasilni aparati', 'Hidrantno omrežje', 'Javljalniki', 'Varnostna razsvetljava', 'Požarni red']],
  ['Elektro', ['Meritve strelovoda', 'Meritve električnih inštalacij']],
  ['Dvigala', ['Redni pregled', 'Letni pregled']],
  ['Administrativno', ['Letni obračun', 'Letno poročilo', 'Zbor lastnikov', 'Načrt vzdrževanja', 'Zavarovanje']]
];

function seedCatalog_(orgId, actor) {
  SEED_OBJECT_KINDS.forEach(function (name, i) {
    t_('ObjectKinds').insert(orgId, { name: name, sort: String((i + 1) * 10) }, actor);
  });
  SEED_GROUPS.forEach(function (g, gi) {
    var group = t_('ObligationGroups').insert(orgId, { name: g[0], sort: String((gi + 1) * 10) }, actor);
    g[1].forEach(function (name, ti) {
      t_('ObligationTypes').insert(orgId, {
        group_id: group.id, name: name, description: '', is_suggestion: 'true', sort: String((ti + 1) * 10)
      }, actor);
    });
  });
}
