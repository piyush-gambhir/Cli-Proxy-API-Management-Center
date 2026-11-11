/**
 * Banked manual resets per account, grouped by kind and expiry day so the row can say
 * "2 × Weekly reset, Nov 18" instead of a bare count.
 */

import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { resetGrantKind } from '@/features/quota/providers/claude/resetGrantChoice';

export interface LedgerReset {
  /** i18n key of the reset kind. */
  kindKey: string;
  count: number;
  expiresAtMs: number | null;
}

type CodexCredit = { status?: string; expiresAt?: string | null };

const isoMs = (value: string | null | undefined) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};
const dayOf = (ms: number | null) => (ms === null ? 'none' : new Date(ms).toDateString());

/** Drops expired resets one by one, then groups what is left (so a later same-day reset survives). */
function group(
  items: { kindKey: string; count: number; expiresAtMs: number | null }[],
  now: number
) {
  const groups = new Map<string, LedgerReset>();
  for (const item of items) {
    if (item.count <= 0 || (item.expiresAtMs !== null && item.expiresAtMs <= now)) continue;
    const key = `${item.kindKey}|${dayOf(item.expiresAtMs)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += item.count;
      // The group expires when its first member does.
      if (item.expiresAtMs !== null && (existing.expiresAtMs ?? Infinity) > item.expiresAtMs)
        existing.expiresAtMs = item.expiresAtMs;
    } else groups.set(key, { ...item });
  }
  // Soonest expiry first; resets without a known expiry go last.
  return [...groups.values()].sort(
    (a, b) => (a.expiresAtMs ?? Infinity) - (b.expiresAtMs ?? Infinity)
  );
}

/** Codex: one available credit resets the whole plan quota. */
export function codexResets(credits: unknown, now: number): LedgerReset[] {
  if (!Array.isArray(credits)) return [];
  return group(
    (credits as CodexCredit[])
      .filter((credit) => credit?.status === 'available')
      .map((credit) => ({
        kindKey: 'ledger.reset_kind_quota',
        count: 1,
        expiresAtMs: isoMs(credit.expiresAt),
      })),
    now
  );
}

/** Claude: each grant has its own kind (weekly, 5-hour, full, Fable) and resets left. */
export function claudeResets(
  grants: readonly AnthropicResetGrant[] | null | undefined,
  now: number
) {
  return group(
    (grants ?? []).map((grant) => ({
      kindKey: `claude_reset.kind_${resetGrantKind(grant)}`,
      count: grant.resetsLeft,
      expiresAtMs: isoMs(grant.endsAt),
    })),
    now
  );
}
