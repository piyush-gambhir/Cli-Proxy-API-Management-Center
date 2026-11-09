import type { AuthFileItem } from '@/types';
import type { OAuthProviderCard } from '@/features/oauth/providers';
import { isRuntimeOnlyAuthFile, normalizeProviderKey } from '@/features/authFiles/constants';

export function reauthenticationProvider(
  file: AuthFileItem,
  providers: OAuthProviderCard[]
): OAuthProviderCard | undefined {
  if (isRuntimeOnlyAuthFile(file) || file.account_type !== 'oauth') return undefined;
  const key = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
  return providers.find((card) => card.id === (key === 'claude' ? 'anthropic' : key));
}
