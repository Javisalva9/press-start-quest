/**
 * Sign in with Steam: Steam speaks OpenID 2.0, an old but simple protocol.
 *
 * 1. We send the user to Steam with `buildSteamLoginUrl`.
 * 2. Steam sends them back to `returnTo` with a signed response in the query
 *    string (`openid.claimed_id` holds their SteamID64).
 * 3. `verifySteamLogin` checks that response and asks Steam to confirm the
 *    signature, so nobody can forge a sign-in by editing the URL.
 */

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = `${OPENID_NS}/identifier_select`;
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/** Fields that must be covered by Steam's signature to be trusted. */
const REQUIRED_SIGNED_FIELDS = [
  'op_endpoint',
  'claimed_id',
  'identity',
  'return_to',
  'response_nonce',
  'assoc_handle',
];

/** A Steam response is only accepted for 5 minutes after Steam issued it. */
const MAX_RESPONSE_AGE_MS = 5 * 60 * 1000;
/** Tolerance for small clock differences between Steam and our server. */
const MAX_CLOCK_SKEW_MS = 60 * 1000;

/** The response is not a valid Steam sign-in (forged, stale or cancelled). */
export class SteamLoginError extends Error {}

/** URL of the Steam page where the user signs in. */
export function buildSteamLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_URL}?${params}`;
}

/**
 * Checks the response Steam added to the callback URL and returns the user's
 * SteamID64. Throws `SteamLoginError` if the response can't be trusted, and a
 * plain `Error` if Steam itself can't be reached.
 */
export async function verifySteamLogin(
  query: string,
  expectedReturnTo: string,
): Promise<string> {
  const params = new URLSearchParams(query);
  const field = (name: string) => params.get(`openid.${name}`) ?? '';

  if (field('mode') !== 'id_res') {
    throw new SteamLoginError('Not a positive Steam response');
  }
  if (field('op_endpoint') !== STEAM_OPENID_URL) {
    throw new SteamLoginError('Response not issued by Steam');
  }
  // Stops a response meant for another site from being replayed here.
  if (field('return_to') !== expectedReturnTo) {
    throw new SteamLoginError('Response meant for another return URL');
  }
  const claimedId = CLAIMED_ID.exec(field('claimed_id'));
  if (!claimedId || field('identity') !== field('claimed_id')) {
    throw new SteamLoginError('Missing or malformed SteamID');
  }
  const signed = field('signed').split(',');
  const unsigned = REQUIRED_SIGNED_FIELDS.filter(
    (name) => !signed.includes(name),
  );
  if (unsigned.length > 0) {
    throw new SteamLoginError(`Unsigned fields: ${unsigned.join(', ')}`);
  }
  // The nonce starts with the time Steam issued it: "2026-10-12T19:55:00Z…".
  const issuedAt = Date.parse(field('response_nonce').slice(0, 20));
  const age = Date.now() - issuedAt;
  if (
    Number.isNaN(issuedAt) ||
    age > MAX_RESPONSE_AGE_MS ||
    age < -MAX_CLOCK_SKEW_MS
  ) {
    throw new SteamLoginError('Response too old');
  }

  // Ask Steam whether it really signed this response.
  const check = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith('openid.')) {
      check.set(key, value);
    }
  }
  check.set('openid.mode', 'check_authentication');
  const response = await fetch(STEAM_OPENID_URL, {
    method: 'POST',
    body: check,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Steam OpenID responded with ${response.status}`);
  }
  if (!/^is_valid\s*:\s*true\s*$/m.test(await response.text())) {
    throw new SteamLoginError('Signature rejected by Steam');
  }
  return claimedId[1];
}
