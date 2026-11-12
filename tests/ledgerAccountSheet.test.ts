import { describe, expect, test } from 'bun:test';
import {
  SECRET_MASK,
  formatRawText,
  maskSecrets,
  maskSecretValue,
} from '@/ledger/accounts/accountSheetSecrets';

const ACCESS = 'eyJhbGciOiJSUzI1NiJ9.payload.signatureABCD';

describe('maskSecrets', () => {
  test('masks token, secret and key values at any depth', () => {
    const masked = maskSecrets({
      email: 'a@b.com',
      access_token: ACCESS,
      refresh_token: 'short',
      metadata: { client_secret: 'xyz', api_key: 'sk-1234567890abcdef' },
      list: [{ id_token: 'tok' }],
    }) as Record<string, unknown>;

    expect(masked.email).toBe('a@b.com');
    expect(masked.access_token).toBe(`${SECRET_MASK}ABCD`);
    expect(masked.refresh_token).toBe(SECRET_MASK);
    expect(masked.metadata).toEqual({ client_secret: SECRET_MASK, api_key: `${SECRET_MASK}cdef` });
    expect(masked.list).toEqual([{ id_token: SECRET_MASK }]);
  });

  test('masks everything inside a secret-named object and keeps booleans and null', () => {
    const masked = maskSecrets({
      tokens: { access: 'abc', nested: { value: 42 } },
      use_api_key: true,
      session_id: null,
    });
    expect(masked).toEqual({
      tokens: { access: SECRET_MASK, nested: { value: SECRET_MASK } },
      use_api_key: true,
      session_id: null,
    });
  });

  test('masks the password in a proxy URL but keeps the rest', () => {
    expect(maskSecrets({ proxy_url: 'socks5://user:hunter2@10.0.0.1:1080/' })).toEqual({
      proxy_url: `socks5://user:${SECRET_MASK}@10.0.0.1:1080/`,
    });
    expect(maskSecrets({ proxy_url: 'http://10.0.0.1:8080' })).toEqual({
      proxy_url: 'http://10.0.0.1:8080',
    });
  });

  test('does not mutate the input', () => {
    const input = { access_token: ACCESS };
    maskSecrets(input);
    expect(input.access_token).toBe(ACCESS);
  });
});

describe('formatRawText', () => {
  const text = JSON.stringify({ type: 'codex', access_token: ACCESS });

  test('pretty-prints and masks by default', () => {
    const out = formatRawText(text, false);
    expect(out).toContain('\n  "type": "codex"');
    expect(out).not.toContain(ACCESS);
  });

  test('reveal shows the original values', () => {
    expect(formatRawText(text, true)).toContain(ACCESS);
  });

  test('masks secret pairs in text that is not valid JSON', () => {
    const truncated = `{"type":"codex","access_token":"${ACCESS}","refresh`;
    const out = formatRawText(truncated, false);
    expect(out).toContain(`"access_token":"${maskSecretValue(ACCESS)}"`);
    expect(out).not.toContain(ACCESS);
    expect(formatRawText(truncated, true)).toBe(truncated);
  });

  test('empty text stays empty', () => {
    expect(formatRawText('', false)).toBe('');
  });
});

describe('formatRawText truncation', () => {
  test('masks a secret cut off before its closing quote', () => {
    const out = formatRawText('{"access_token":"synthetic-secret-value', false);
    expect(out).not.toContain('synthetic-secret-value');
  });
});
