



















import { parseIsoToMs } from '@/utils/quota';
import { HOUR_MS } from '@/utils/time/durations';
import type { QuotaProviderType } from './providers/types';

export interface QuotaRowInstant {

  rowId: string;
  atMs: number;
  kind: 'window' | 'credit';
}









export function resetCreditRowId(
  credit: { id?: string; expiresAt?: string },
  index: number
): string {
  return credit.id || `${credit.expiresAt}-${index}`;
}





interface WindowLike {
  id?: string;
  resetAtMs?: number | null;
}

interface DollarWindowLike {
  key: string;
  resetsAt?: string | null;
}

interface ResetCreditLike {
  id?: string;
  status?: string;
  expiresAt?: string;
}


export const XAI_WEEKLY_ROW_ID = 'xai:weekly';

const isUsableMs = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const collectRows = (rows: readonly WindowLike[], fallbackPrefix: string): QuotaRowInstant[] =>
  rows
    .map((row, index): QuotaRowInstant | null =>
      isUsableMs(row.resetAtMs)
        ? { rowId: row.id || `${fallbackPrefix}-${index}`, atMs: row.resetAtMs, kind: 'window' }
        : null
    )
    .filter((instant): instant is QuotaRowInstant => instant !== null);










export function collectQuotaRowInstants(
  provider: QuotaProviderType,
  quota: unknown
): QuotaRowInstant[] {
  const state = quota as { status?: string } | undefined;
  if (!state || state.status !== 'success') return [];

  if (provider === 'claude' || provider === 'codex' || provider === 'devin') {
    const windows = collectRows((quota as { windows?: WindowLike[] }).windows ?? [], 'window');
    if (provider === 'claude') {


      const balances = ((quota as { dollarWindows?: DollarWindowLike[] }).dollarWindows ?? [])
        .map((balance): QuotaRowInstant | null => {
          const atMs = parseIsoToMs(balance.resetsAt);
          return atMs === null ? null : { rowId: balance.key, atMs, kind: 'window' };
        })
        .filter((instant): instant is QuotaRowInstant => instant !== null);
      return [...windows, ...balances];
    }
    if (provider !== 'codex') return windows;

    const credits = (
      (quota as { rateLimitResetCredits?: ResetCreditLike[] }).rateLimitResetCredits ?? []
    )
      .map((credit, index): QuotaRowInstant | null => {
        if (credit.status !== 'available') return null;
        const atMs = parseIsoToMs(credit.expiresAt);
        return atMs === null
          ? null
          : { rowId: resetCreditRowId(credit, index), atMs, kind: 'credit' };
      })
      .filter((instant): instant is QuotaRowInstant => instant !== null);

    return [...windows, ...credits];
  }

  if (provider === 'xai') {
    const billing = (
      quota as { billing?: { periodType?: string; resetAtMs?: number | null } | null }
    ).billing;
    if (!billing || billing.periodType !== 'weekly' || !isUsableMs(billing.resetAtMs)) return [];
    return [{ rowId: XAI_WEEKLY_ROW_ID, atMs: billing.resetAtMs, kind: 'window' }];
  }

  if (provider === 'antigravity' || provider === 'plugin') {

    const buckets = ((quota as { groups?: { buckets?: WindowLike[] }[] }).groups ?? []).flatMap(
      (group) => group.buckets ?? []
    );
    return collectRows(buckets, 'bucket');
  }

  if (provider === 'kimi') {
    return collectRows((quota as { rows?: WindowLike[] }).rows ?? [], 'row');
  }

  if (provider === 'meta') {
    const windows =
      (
        quota as {
          data?: {
            windows?: {
              id: 'window' | 'weekly';
              usedPercent: number | null;
              resetAt?: number;
            }[];
          };
        }
      ).data?.windows ?? [];





    return windows
      .filter(
        (window) =>
          typeof window.usedPercent === 'number' &&
          Number.isFinite(window.usedPercent) &&
          window.usedPercent > 0 &&
          isUsableMs(window.resetAt)
      )
      .map((window) => ({
        rowId: window.id,
        atMs: (window.resetAt as number) * 1000,
        kind: 'window' as const,
      }));
  }

  return [];
}








export function pickSoonestRowId(
  instants: readonly QuotaRowInstant[],
  nowMs: number
): string | null {
  let best: QuotaRowInstant | null = null;
  for (const instant of instants) {
    if (instant.atMs <= nowMs) continue;
    if (
      best === null ||
      instant.atMs < best.atMs ||
      (instant.atMs === best.atMs && instant.rowId < best.rowId)
    ) {
      best = instant;
    }
  }
  return best?.rowId ?? null;
}








export function pickUrgentRowId(
  instants: readonly QuotaRowInstant[],
  nowMs: number
): string | null {
  return pickSoonestRowId(
    instants.filter((instant) => instant.atMs - nowMs > 0 && instant.atMs - nowMs < HOUR_MS),
    nowMs
  );
}





export function nextRecoveryMs(
  provider: QuotaProviderType,
  quota: unknown,
  nowMs: number
): number | null {
  let best: number | null = null;
  for (const instant of collectQuotaRowInstants(provider, quota)) {
    if (instant.atMs <= nowMs) continue;
    if (best === null || instant.atMs < best) best = instant.atMs;
  }
  return best;
}
