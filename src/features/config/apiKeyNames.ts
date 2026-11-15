import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { obfuscatedStorage } from '@/services/storage/secureStorage';

const STORAGE_PREFIX = 'api-key-names:v1:';


export function apiKeyNameFingerprint(apiBase: string, apiKey: string): string {
  const input = JSON.stringify(['api-key-name', apiBase, apiKey]);

  return bytesToHex(sha256(new TextEncoder().encode(input)));
}

export function readApiKeyNames(apiBase: string): Record<string, string> {
  try {
    const stored = obfuscatedStorage.getItem<unknown>(STORAGE_PREFIX + apiBase);
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored).filter(
        (entry): entry is [string, string] =>
          /^[a-f0-9]{64}$/.test(entry[0]) && typeof entry[1] === 'string' && !!entry[1].trim()
      )
    );
  } catch {
    return {};
  }
}


export function saveApiKeyName(apiBase: string, apiKey: string, name: string): boolean {
  try {
    const names = new Map(Object.entries(readApiKeyNames(apiBase)));
    const fingerprint = apiKeyNameFingerprint(apiBase, apiKey);
    if (name.trim()) names.set(fingerprint, name.trim());
    else names.delete(fingerprint);
    if (names.size) {
      obfuscatedStorage.setItem(STORAGE_PREFIX + apiBase, Object.fromEntries(names));
    } else {
      obfuscatedStorage.removeItem(STORAGE_PREFIX + apiBase);
    }
    return true;
  } catch {
    return false;
  }
}
