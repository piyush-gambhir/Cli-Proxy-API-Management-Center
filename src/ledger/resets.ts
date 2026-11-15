




import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { resetGrantKind } from '@/features/quota/providers/claude/resetGrantChoice';

export interface LedgerReset {

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

      if (item.expiresAtMs !== null && (existing.expiresAtMs ?? Infinity) > item.expiresAtMs)
        existing.expiresAtMs = item.expiresAtMs;
    } else groups.set(key, { ...item });
  }

  return [...groups.values()].sort(
    (a, b) => (a.expiresAtMs ?? Infinity) - (b.expiresAtMs ?? Infinity)
  );
}


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
