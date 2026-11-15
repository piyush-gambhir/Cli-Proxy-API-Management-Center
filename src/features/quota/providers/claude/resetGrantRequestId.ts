type ResetGrantRandomSource = Partial<Pick<Crypto, 'randomUUID' | 'getRandomValues'>>;

const REQUEST_ID_RANDOM_BYTES = 16;


export function generateResetGrantRequestId(
  source: ResetGrantRandomSource | undefined = globalThis.crypto
): string {
  if (typeof source?.randomUUID === 'function') return source.randomUUID();
  if (typeof source?.getRandomValues !== 'function') {
    throw new Error('Secure random source is unavailable');
  }

  const bytes = source.getRandomValues(new Uint8Array(REQUEST_ID_RANDOM_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
