/**
 * Attachment storage.
 *
 * Runs only on the deployment whose organisation has the setting storage_enabled = true
 * (the owner of the Drive). Files are written by this deployment, so their owner is the
 * account this deployment runs under, whoever uploads them.
 *
 * Who may upload:
 *   - an active user of this deployment (files go to the folder of their organisation);
 *   - an address in StorageClients (users of another deployment; folder = its org_label).
 *
 * Folders: <root>/<organisation>/<object>/<year>/<YYYY-MM-DD>_<kind>_<uuid>.<ext>
 * The organisation folder is shared (view) with everyone who uploads into it.
 */

var MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
var UPLOAD_MIME_RE = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif|gif))$/;
var EXT_BY_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' };

function storageEnabled_() {
  if (!prop_('SPREADSHEET_ID')) return false;
  return db_().table('Organizations').list(null).some(function (org) {
    return kvGet_('Settings', org.id, 'storage_enabled') === 'true';
  });
}

/** Returns { key, label } of the folder the e-mail may upload into, or throws. */
function uploadTarget_(email) {
  var user = findUser_(email);
  if (user) return { key: 'org_' + user.org_id, label: orgOf_(user.org_id).name };
  var clients = db_().table('StorageClients').list(null).filter(function (c) { return c.email === email; });
  if (clients.length) return { key: 'client_' + clients[0].id, label: clients[0].org_label };
  throw appError_('FORBIDDEN', 'Your account may not upload attachments here.');
}

function safeName_(s) {
  return String(s || '').replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'unnamed';
}

function childFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function rootFolder_() {
  var id = prop_('ATTACHMENTS_ROOT_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreated below */ }
  }
  var f = DriveApp.createFolder('Servisi - attachments');
  setProp_('ATTACHMENTS_ROOT_ID', f.getId());
  return f;
}

function orgFolder_(target) {
  var propKey = 'FOLDER_' + target.key;
  var id = prop_(propKey);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* recreated below */ }
  }
  var f = rootFolder_().createFolder(safeName_(target.label));
  setProp_(propKey, f.getId());
  return f;
}

function ensureViewer_(folder, email) {
  if (email === ownerEmail_()) return;
  var has = folder.getViewers().concat(folder.getEditors()).some(function (u) {
    return String(u.getEmail()).toLowerCase() === email;
  });
  if (!has) folder.addViewer(email);
}

function apiUpload_(idToken, d) {
  var auth = verifyIdToken_(idToken, false);
  if (!storageEnabled_()) throw appError_('FORBIDDEN', 'This deployment does not store attachments.');
  var target = uploadTarget_(auth.email);
  var mime = String(d.mime || '');
  if (!UPLOAD_MIME_RE.test(mime)) throw appError_('INVALID', 'Only PDF and images can be attached.');
  var date = String(d.date || '');
  if (!Schedule.isDate(date)) throw appError_('INVALID', 'Attachment date is missing.');
  var bytes;
  try { bytes = Utilities.base64Decode(String(d.base64 || '')); } catch (e) { throw appError_('INVALID', 'The file could not be read.'); }
  if (!bytes.length) throw appError_('INVALID', 'The file is empty.');
  if (bytes.length > MAX_UPLOAD_BYTES) throw appError_('INVALID', 'The file is larger than 25 MB.');
  var kind = ATTACHMENT_KINDS.indexOf(d.kind) >= 0 ? d.kind : 'Other';
  var name = date + '_' + kind + '_' + Utilities.getUuid() + '.' + (EXT_BY_MIME[mime] || 'bin');

  return withLock_(function () {
    var org = orgFolder_(target);
    ensureViewer_(org, auth.email);
    var folder = childFolder_(childFolder_(org, safeName_(d.objectFolder)), date.slice(0, 4));
    var file = folder.createFile(Utilities.newBlob(bytes, mime, name));
    file.setDescription('Original name: ' + safeName_(d.fileName) + '; uploaded by ' + auth.email);
    return {
      drive_file_id: file.getId(),
      url: file.getUrl(),
      file_name: name,
      original_name: String(d.fileName || ''),
      mime: mime,
      size_bytes: String(bytes.length),
      original_size_bytes: String(d.originalSize || '')
    };
  });
}
