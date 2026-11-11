/**
 * Masking for the account sheet's raw file view. Auth files carry live credentials
 * (access/refresh/id tokens, API keys, proxy passwords); they stay hidden until the user asks.
 */

export const SECRET_MASK = '••••••••';

/** Keys whose values are credentials: anything naming a token, secret, key, password or cookie. */
const SECRET_KEY = /token|secret|key|passw|cookie|session|authorization|credential/i;

/** user:password@ in a URL, such as a proxy URL. */
const URL_PASSWORD = /^([a-z][a-z0-9+.-]*:\/\/[^:/@\s]*:)([^@\s]+)(@)/i;

/** Keeps the last four characters of long values so two credentials can still be told apart. */
export const maskSecretValue = (value: string): string =>
  value.length >= 16 ? `${SECRET_MASK}${value.slice(-4)}` : SECRET_MASK;

export const isSecretKey = (key: string): boolean => SECRET_KEY.test(key);

const maskString = (value: string): string => value.replace(URL_PASSWORD, `$1${SECRET_MASK}$3`);

/** Returns a copy with every secret-keyed scalar masked, at any depth. */
export function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSecrets);
  if (typeof value === 'string') return maskString(value);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key) && item !== null && typeof item !== 'object') {
      result[key] = typeof item === 'boolean' ? item : maskSecretValue(String(item));
    } else if (isSecretKey(key) && item !== null && typeof item === 'object') {
      // A secret-named object (say "tokens": {...}) is all secret, whatever its inner keys are.
      result[key] = maskAll(item);
    } else {
      result[key] = maskSecrets(item);
    }
  }
  return result;
}

function maskAll(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskAll);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, maskAll(item)])
    );
  }
  if (value === null || typeof value === 'boolean') return value;
  return maskSecretValue(String(value));
}

/**
 * "key": "value" pairs in text that is not valid JSON (a truncated or HTML download). The closing
 * quote is optional so a preview cut off inside a secret still masks it.
 */
const TEXT_SECRET_PAIR =
  /("[^"\n]*(?:token|secret|key|passw|cookie|session|authorization|credential)[^"\n]*"\s*:\s*")((?:[^"\\\n]|\\.)*\\?)("|$)/gi;

/**
 * Pretty-prints JSON text, masking secrets unless `reveal` is set. Text that is not JSON is
 * returned as is, with secret-looking "key": "value" pairs still masked.
 */
export function formatRawText(text: string, reveal: boolean): string {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as unknown;
    return JSON.stringify(reveal ? parsed : maskSecrets(parsed), null, 2);
  } catch {
    if (reveal) return text;
    return text.replace(
      TEXT_SECRET_PAIR,
      (_match, head: string, secret: string, tail: string) =>
        `${head}${maskSecretValue(secret)}${tail}`
    );
  }
}
