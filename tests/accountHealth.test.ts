import { beforeAll, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import type { AuthFileItem } from '@/types';
import { accountHealth, accountRetryAt } from '@/ledger/accounts/accountHealth';
import { AccountRow, type AccountRowProps } from '@/ledger/accounts/AccountRow';

const claude: AuthFileItem = {
  name: 'claude-person@example.com.json',
  email: 'person@example.com',
  type: 'claude',
  account_type: 'oauth',
  status: 'error',
  statusMessage: 'unauthorized: token refresh failed: invalid_grant: Refresh token is invalid',
};

describe('account authentication and quota health', () => {
  test('retains the credential authentication failure alongside a quota 429', () => {
    expect(accountHealth(claude, { status: 'error', errorStatus: 429 })).toEqual({
      authentication: 'required',
    });
  });

  test('a quota rate limit or access denial alone is not an expired login', () => {
    for (const errorStatus of [429, 403, 500]) {
      expect(
        accountHealth(
          { ...claude, statusMessage: '' },
          {
            status: 'error',
            errorStatus,
          }
        ).authentication
      ).toBeNull();
    }
  });

  test('distinguishes revoked and expired sessions without rendering provider error payloads', () => {
    expect(
      accountHealth({ ...claude, statusMessage: 'OAuth access token has been revoked.' })
        .authentication
    ).toBe('revoked');
    expect(
      accountHealth({ ...claude, statusMessage: 'access_token_expired: token expired' })
        .authentication
    ).toBe('expired');
    expect(
      accountHealth(
        { ...claude, statusMessage: '' },
        {
          status: 'error',
          errorStatus: 401,
        }
      ).authentication
    ).toBe('required');
  });

  test('historical failure counts do not imply a current authentication failure', () => {
    expect(
      accountHealth(
        { ...claude, statusMessage: '', failureCount: 20 },
        {
          status: 'success',
        }
      ).authentication
    ).toBeNull();
  });
});

describe('account retry time', () => {
  const now = 1_000_000;
  test('uses server remaining time anchored to receipt, independent of server clock skew', () => {
    const file = {
      ...claude,
      cooldownSnapshot: {
        receivedAtMs: now - 10_000,
        records: [
          {
            scope: 'credential' as const,
            reason: 'quota',
            httpStatus: 429,
            retryAt: '2000-01-01T00:00:00Z',
            remainingSeconds: 60,
          },
        ],
      },
    };
    expect(accountRetryAt(file, now)).toBe(now + 50_000);
    expect(accountRetryAt(file, now + 60_000)).toBeNull();
  });

  test('does not invent a retry time or reuse a model-specific or authentication cooldown', () => {
    expect(accountRetryAt(claude, now)).toBeNull();
    expect(
      accountRetryAt(
        {
          ...claude,
          cooldownSnapshot: {
            receivedAtMs: now,
            records: [
              {
                scope: 'model',
                modelKey: 'claude-opus',
                reason: 'quota',
                httpStatus: 429,
                retryAt: '2030-01-01T00:00:00Z',
                remainingSeconds: 60,
              },
              {
                scope: 'credential',
                reason: 'unauthorized',
                httpStatus: 401,
                retryAt: '2030-01-01T00:00:00Z',
                remainingSeconds: 60,
              },
            ],
          },
        },
        now
      )
    ).toBeNull();
  });
});

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

test('row renders auth failure and quota rate limit separately with a visible reauthenticate action', () => {
  const noop = () => {};
  const props: AccountRowProps = {
    file: { ...claude, failureCount: 1 },
    entry: { file: claude, type: 'claude' },
    quota: { status: 'error', errorStatus: 429, error: '429 Rate limited' },
    resolvedTheme: 'dark',
    showEmails: false,
    disableControls: false,
    statusUpdating: false,
    deleting: false,
    resetting: false,
    onToggleStatus: noop,
    onRefreshQuota: noop,
    onResetQuota: noop,
    onShowModels: noop,
    onOpenSettings: noop,
    onDownload: noop,
    onDelete: noop,
    onReauthenticate: noop,
  };
  const markup = renderToStaticMarkup(createElement(AccountRow, props));
  expect(markup).toContain('Authentication failed.');
  expect(markup).toContain('Quota check rate limited (429).');
  expect(markup).toContain('>Reauthenticate</button>');
  expect(markup).toContain('1 failed request total');
  expect(markup).not.toContain('person@example.com');
  expect(markup).not.toContain('Refresh token is invalid');
});
