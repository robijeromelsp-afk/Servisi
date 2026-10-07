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
  if (idToken.indexOf(SESSION_PREFIX) === 0) return (REQ_AUTH_ = verifySession_(idToken));
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  var cached = cache.get(key);
  if (cached) return (REQ_AUTH_ = JSON.parse(cached));

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
  var out = { email: String(info.email).toLowerCase(), aud: info.aud, google: true };
  if (clientId) cache.put(key, JSON.stringify(out), Math.min(TOKEN_CACHE_SECONDS, secondsLeft));
  return (REQ_AUTH_ = out);
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

// ------------------------------------------------------------------ sessions

/**
 * After a Google sign-in the deployment issues its own session token, so that the user does not
 * have to sign in with Google every hour (Google ID tokens live one hour).
 * Format: s1.<base64url JSON {e: email, x: expiry (s), a: client id}>.<base64url HMAC-SHA256>
 * The key is the Script Property SESSION_SECRET (created on first use). Changing it signs everyone out.
 * Every request still checks the access list, so removing a user takes effect at once.
 */
var SESSION_PREFIX = 's1.';
var REQ_AUTH_ = null; // result of the sign-in check of the current request
var SESSION_DAYS = 30;
var SESSION_RENEW_DAYS = 15;

function sessionSecret_() {
  var s = prop_('SESSION_SECRET');
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    setProp_('SESSION_SECRET', s);
  }
  return s;
}

function sessionSign_(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, sessionSecret_())).replace(/=+$/, '');
}

function issueSession_(email, aud) {
  var exp = Math.floor(now_().getTime() / 1000) + SESSION_DAYS * 86400;
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ e: email, x: exp, a: aud })).replace(/=+$/, '');
  return SESSION_PREFIX + payload + '.' + sessionSign_(payload);
}

function verifySession_(token) {
  var parts = token.slice(SESSION_PREFIX.length).split('.');
  var padded = (parts[0] || '') + '==='.slice(((parts[0] || '').length + 3) % 4);
  if (parts.length !== 2 || sessionSign_(parts[0]) !== parts[1]) throw appError_('AUTH', 'Your sign-in has expired. Sign in again.');
  var data;
  try {
    data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString());
  } catch (e) {
    throw appError_('AUTH', 'Your sign-in has expired. Sign in again.');
  }
  var secondsLeft = data.x - Math.floor(now_().getTime() / 1000);
  if (!(secondsLeft > 0)) throw appError_('AUTH', 'Your sign-in has expired. Sign in again.');
  var clientId = prop_('OAUTH_CLIENT_ID');
  if (!clientId || data.a !== clientId) throw appError_('AUTH', 'Sign-in was issued for a different application.');
  return { email: String(data.e), aud: data.a, google: false, renew: secondsLeft < SESSION_RENEW_DAYS * 86400 };
}
