/**
 * Why an account needs attention, read from what the proxy already reports: the credential's own
 * status message, the quota lookup's error, and the proxy's routing cooldowns.
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

/** Sign-in failures already show as the authentication alert; a cooldown can't fix them. */
const AUTH_COOLDOWN_REASONS = new Set(['invalid_grant', 'unauthorized']);

export type AccountCooldown = {
  /** When the whole account is back in rotation; null when only some models wait. */
  accountUntil: number | null;
  /** Distinct models cooling down, and when the first of them is back. */
  modelCount: number;
  modelsUntil: number | null;
  /** Each active timer with its end time, for the hover breakdown. */
  active: Array<{ modelKey?: string; reason: string; until: number }>;
};

/**
 * The proxy's routing cooldowns that are still running, timed from the server's remaining
 * seconds anchored to when the list arrived (never the server's wall clock).
 */
export function accountCooldown(file: AuthFileItem, now: number): AccountCooldown | null {
  const snapshot = file.cooldownSnapshot;
  if (!snapshot) return null;
  const active = (snapshot.records ?? [])
    .filter((record) => !AUTH_COOLDOWN_REASONS.has(record.reason))
    .map((record) => ({
      record,
      until: now + cooldownRemainingSeconds(record, snapshot.receivedAtMs, now) * 1000,
    }))
    .filter(({ until }) => until > now);
  if (active.length === 0) return null;
  const account = active.filter(({ record }) => record.scope === 'credential');
  const models = active.filter(({ record }) => record.scope === 'model');
  return {
    accountUntil: account.length ? Math.max(...account.map(({ until }) => until)) : null,
    modelCount: new Set(models.map(({ record }) => record.modelKey ?? '')).size,
    modelsUntil: models.length ? Math.min(...models.map(({ until }) => until)) : null,
    active: active.map(({ record, until }) => ({
      modelKey: record.scope === 'model' ? record.modelKey : undefined,
      reason: record.reason,
      until,
    })),
  };
}
