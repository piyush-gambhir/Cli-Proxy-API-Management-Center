import { describe, expect, spyOn, test } from 'bun:test';
import { oauthApi } from '@/services/api/oauth';
import { apiClient } from '@/services/api/client';
import { reauthenticationProvider } from '@/ledger/accounts/reauthentication';
import { OAUTH_PROVIDERS } from '@/features/oauth/providers';
import type { AuthFileItem } from '@/types';

describe('account reauthentication', () => {
  const file: AuthFileItem = { name: 'claude-custom.json', type: 'claude', account_type: 'oauth' };
  test('maps Claude to its OAuth flow and keeps paused accounts eligible', () => {
    expect(reauthenticationProvider(file, OAUTH_PROVIDERS)?.id).toBe('anthropic');
    expect(reauthenticationProvider({ ...file, disabled: true }, OAUTH_PROVIDERS)?.id).toBe(
      'anthropic'
    );
  });
  test('does not offer OAuth for API keys, runtime files or unavailable providers', () => {
    expect(
      reauthenticationProvider({ ...file, account_type: 'api_key' }, OAUTH_PROVIDERS)
    ).toBeUndefined();
    expect(
      reauthenticationProvider({ ...file, runtimeOnly: true }, OAUTH_PROVIDERS)
    ).toBeUndefined();
    expect(reauthenticationProvider({ ...file, type: 'unknown' }, OAUTH_PROVIDERS)).toBeUndefined();
  });
  test('targets the existing file while retaining cancellation and web UI behavior', async () => {
    const signal = new AbortController().signal;
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      state: 'fixture',
      url: 'https://example.invalid',
    });
    try {
      await oauthApi.startAuth('anthropic', signal, { name: file.name });
      expect(get).toHaveBeenCalledWith('/oauth/auth-url', {
        params: { provider: 'claude', is_webui: true, target_auth_id: 'claude-custom.json' },
        signal,
      });
    } finally {
      get.mockRestore();
    }
  });
});
