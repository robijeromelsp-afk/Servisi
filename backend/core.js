/**
 * Core helpers: configuration, errors, time, authentication.
 *
 * Deployment configuration lives in Script Properties (never in code):
 *   SPREADSHEET_ID      the spreadsheet of this deployment
 *   OAUTH_CLIENT_ID     Google OAuth client ID the ID tokens must be issued for
 *   ATTACHMENTS_ROOT_ID Drive folder for attachments (only on the storage deployment)
 */

var APP_VERSION = '__APP_VERSION__';
var TOKEN_CACHE_SECONDS = 1500;

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function appError_(code, message) {
  var e = new Error(message);
  e.appCode = code;
  return e;
}

function now_() {
  return new Date();
}

function nowIso_() {
  return now_().toISOString();
}

/** Today as YYYY-MM-DD in the given time zone. */
function today_(tz) {
  return Utilities.formatDate(now_(), tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function ownerEmail_() {
  return String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
}

/**
 * Verifies a Google ID token and returns the verified e-mail (lower case).
 * Uses Google's tokeninfo endpoint, which checks the signature and expiry.
 * If the deployment has no OAUTH_CLIENT_ID yet (before setup), allowUnboundAudience
 * lets setup accept the audience of the owner's token and store it.
 */
function verifyIdToken_(idToken, allowUnboundAudience) {
  if (!idToken) throw appError_('AUTH', 'Sign in required.');
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw appError_('AUTH', 'Your sign-in has expired. Sign in again.');
  var info = JSON.parse(res.getContentText());
  var issuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (issuers.indexOf(info.iss) < 0) throw appError_('AUTH', 'Sign-in was not issued by Google.');
  if (String(info.email_verified) !== 'true') throw appError_('AUTH', 'Your Google e-mail address is not verified.');
  var exp = parseInt(info.exp, 10);
  var secondsLeft = exp - Math.floor(now_().getTime() / 1000);
  if (!(secondsLeft > 0)) throw appError_('AUTH', 'Your sign-in has expired. Sign in again.');
  var clientId = prop_('OAUTH_CLIENT_ID');
  if (clientId ? info.aud !== clientId : !allowUnboundAudience) {
    throw appError_('AUTH', 'Sign-in was issued for a different application.');
  }
  var out = { email: String(info.email).toLowerCase(), aud: info.aud };
  if (clientId) cache.put(key, JSON.stringify(out), Math.min(TOKEN_CACHE_SECONDS, secondsLeft));
  return out;
}

/** Finds the active user record for an e-mail. Returns null when not on the access list. */
function findUser_(email) {
  var users = db_().table('Users').list(null).filter(function (u) {
    return u.email.toLowerCase() === email && u.active === 'true';
  });
  return users.length ? users[0] : null;
}

function orgOf_(orgId) {
  return db_().table('Organizations').require(orgId, orgId, 'Organisation');
}

function orgTimezone_(orgId) {
  return orgOf_(orgId).timezone || Session.getScriptTimeZone();
}
