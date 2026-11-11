/**
 * Why an account needs attention, read from what the proxy already reports: the credential's own
 * status message, the quota lookup's error, and the credential-wide cooldown.
 */

import type { AuthFileItem } from '@/types';
import type { QuotaCardState } from '@/features/quota/providers';
import { cooldownRemainingSeconds } from '@/features/authFiles/cooldowns';

type AuthenticationIssue = 'revoked' | 'expired' | 'required';

const authenticationIssue = (message: string): AuthenticationIssue | null => {
  if (
    /\b(token|session|credential|oauth)\b.*\brevoked\b|\brevoked\b.*\b(token|session|credential)\b/i.test(
      message
    )
  )
    return 'revoked';
  if (
    /\b(token|session|credential)\b.*\bexpired\b|\bexpired\b.*\b(token|session|credential)\b/i.test(
      message
    )
  )
    return 'expired';
  if (
    /\bunauthorized\b|invalid_grant|\b(?:invalid|missing)\b.*\b(?:token|credential|api.?key)\b/i.test(
      message
    )
  )
    return 'required';
  return null;
};

/** Credential health and a quota endpoint's response are independent signals. */
export function accountHealth(file: AuthFileItem, quota?: QuotaCardState) {
  const accountAuth = authenticationIssue(file.statusMessage ?? '');
  const quotaAuth =
    quota?.status === 'error'
      ? (authenticationIssue(quota.error ?? '') ?? (quota.errorStatus === 401 ? 'required' : null))
      : null;
  return { authentication: accountAuth ?? quotaAuth };
}

/** Only credential-wide request cooldowns apply to the whole account. */
export function accountRetryAt(file: AuthFileItem, now: number): number | null {
  const snapshot = file.cooldownSnapshot;
  if (!snapshot) return null;
  const remaining = (snapshot.records ?? [])
    .filter((record) => record.scope === 'credential' && record.httpStatus === 429)
    .map((record) => cooldownRemainingSeconds(record, snapshot.receivedAtMs, now))
    .filter((seconds) => seconds > 0);
  return remaining.length ? now + Math.max(...remaining) * 1000 : null;
}
