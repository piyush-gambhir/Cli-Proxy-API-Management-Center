/**
 * The proxy's own quota view (GET /quota-scheduler/status). Its poller already reads Claude and
 * Codex usage on a rate-limited schedule and learns from live traffic headers, so the accounts
 * screen paints from this instead of calling Anthropic or OpenAI itself. One local request, zero
 * provider calls.
 */

import type { TFunction } from 'i18next';
import { apiClient } from '@/services/api/client';
import type { LedgerLimit } from './limits';

export interface SchedulerWindow {
  used_percent: number;
  reset_at?: string;
  known: boolean;
  hard_limited?: boolean;
}

export interface SchedulerAccount {
  provider: string;
  plan?: string;
  fetched_at?: string;
  five_hour?: SchedulerWindow;
  seven_day?: SchedulerWindow;
  weekly?: SchedulerWindow;
  fable?: SchedulerWindow;
}

export interface SchedulerStatus {
  /** Keyed by credential file name. */
  accounts: Record<string, SchedulerAccount>;
  strategy?: string;
  ranking?: { auth: string; provider: string; usable: boolean; reason: string }[];
}

export async function fetchSchedulerStatus(): Promise<SchedulerStatus | null> {
  try {
    const data = (await apiClient.get('/quota-scheduler/status')) as SchedulerStatus | undefined;
    return data && typeof data.accounts === 'object' && data.accounts ? data : null;
  } catch {
    // Older proxies without the routing patch: the screen falls back to direct quota reads.
    return null;
  }
}

const isoMs = (value?: string) => {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : null;
};

const DAY_MS = 86_400_000;

/** Milliseconds of the latest observation for this account, or null when never read. */
export const schedulerObservedAt = (account: SchedulerAccount | undefined) =>
  isoMs(account?.fetched_at);

/**
 * The account's windows as row cells. Unknown windows are left out rather than shown as 0%, except
 * a hard-limited one: the provider refused requests there, so it shows as 0% left whatever the
 * last percentage said. Codex reports a monthly plan window in its "weekly" slot; a reset more than
 * 8 days out proves monthly, and `monthlyHint` (remembered from an earlier proof) keeps the label
 * from flipping back to weekly in the window's last days.
 */
export function schedulerLimits(
  account: SchedulerAccount,
  t: TFunction,
  monthlyHint = false
): LedgerLimit[] {
  const observed = schedulerObservedAt(account);
  const cell = (id: string, label: string, window?: SchedulerWindow): LedgerLimit[] =>
    window && (window.known || window.hard_limited)
      ? [
          {
            id,
            label,
            remaining: window.hard_limited
              ? 0
              : Math.min(100, Math.max(0, 100 - window.used_percent)),
            resetAtMs: isoMs(window.reset_at),
            hardLimited: Boolean(window.hard_limited),
          },
        ]
      : [];
  const longLabel = (window?: SchedulerWindow) =>
    String(
      t(
        monthlyHint || isMonthlyWindow(window, observed)
          ? 'codex_quota.team_secondary_window'
          : 'codex_quota.secondary_window'
      )
    );
  return [
    ...cell('five_hour', String(t('codex_quota.primary_window')), account.five_hour),
    ...cell('seven_day', longLabel(account.seven_day), account.seven_day),
    ...cell('weekly', longLabel(account.weekly), account.weekly),
    ...cell('fable', String(t('ledger.limit_fable')), account.fable),
  ];
}

/** True only when the reset is too far out for a weekly window. */
export function isMonthlyWindow(window: SchedulerWindow | undefined, observed: number | null) {
  const reset = isoMs(window?.reset_at);
  return reset !== null && observed !== null && reset - observed > 8 * DAY_MS;
}

const PERIOD_HOURS = { five_hour: 5, seven_day: 168, weekly: 168, fable: 168 } as const;
const TIMELINE_IDS = {
  five_hour: 'five-hour',
  seven_day: 'seven-day',
  weekly: 'weekly',
  fable: 'fable',
} as const;

/**
 * The snapshot in the shape upstream's quota timeline reads from a live Claude or Codex read
 * (`windows` with percent used), so the chart draws without calling the provider. A Codex
 * "weekly" slot proven monthly gets a 30-day period; hard-limited windows count as fully used.
 */
export function schedulerQuotaState(account: SchedulerAccount, t: TFunction, monthlyHint = false) {
  const observed = schedulerObservedAt(account);
  const windows = (Object.keys(PERIOD_HOURS) as Array<keyof typeof PERIOD_HOURS>).flatMap((key) => {
    const window = account[key];
    const resetAtMs = isoMs(window?.reset_at);
    if (!window || !(window.known || window.hard_limited) || resetAtMs === null) return [];
    const monthly =
      (key === 'weekly' || key === 'seven_day') &&
      (monthlyHint || isMonthlyWindow(window, observed));
    return [
      {
        id: TIMELINE_IDS[key],
        label: schedulerLimits({ provider: account.provider, [key]: window }, t, monthly)[0]?.label,
        usedPercent: window.hard_limited ? 100 : window.used_percent,
        resetAtMs,
        periodHours: monthly ? 720 : PERIOD_HOURS[key],
      },
    ];
  });
  return { status: 'success' as const, windows };
}
