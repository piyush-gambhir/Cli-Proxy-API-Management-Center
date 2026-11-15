











import { DAY_MS, HOUR_MS } from '@/utils/time/durations';
import type { QuotaProviderType } from './providers/types';

export { DAY_MS, HOUR_MS };


export type TimelineMode = 'weekly' | 'session';

export const TIMELINE_SPAN_DAYS: Record<TimelineMode, number> = {
  weekly: 14,
  session: 3,
};


const SESSION_PERIOD_HOURS = 5;


export interface TimelineLimit {
  label: string;

  remaining: number;
}


export interface TimelineResetCredit {
  id: string;
  grantedAtMs: number | null;
  expiresAtMs: number;
}


export interface TimelineResetCreditMark extends TimelineResetCredit {
  leftPercent: number;
}


export interface TimelineLane {
  name: string;
  displayName: string;
  provider: QuotaProviderType;

  anchorMs: number | null;

  periodHours: number | null;

  remaining: number | null;
  limits: TimelineLimit[];
  resetCredits: TimelineResetCredit[];
}


export interface TimelineWindow {
  startMs: number;
  endMs: number;

  leftPercent: number;
  widthPercent: number;
  state: 'past' | 'live' | 'next';

  remaining: number | null;






  usedFillPercent: number | null;
}










export function windowsIn(
  anchorMs: number,
  periodMs: number,
  fromMs: number,
  toMs: number
): { startMs: number; endMs: number }[] {
  if (!Number.isFinite(anchorMs) || !(periodMs > 0)) return [];
  if (!(toMs > fromMs)) return [];



  const maxWindows = Math.ceil((toMs - fromMs) / periodMs) + 2;
  if (maxWindows > 1000) return [];

  let end = anchorMs + Math.ceil((fromMs - anchorMs) / periodMs) * periodMs;
  const out: { startMs: number; endMs: number }[] = [];
  while (end - periodMs < toMs) {
    out.push({ startMs: end - periodMs, endMs: end });
    end += periodMs;
  }
  return out;
}


export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}


export function startOfWeek(ms: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}









export function timelineSpan(
  mode: TimelineMode,
  offset: number,
  now: number
): { startMs: number; endMs: number; days: number } {
  const days = TIMELINE_SPAN_DAYS[mode];
  const base = new Date(mode === 'weekly' ? startOfWeek(now) : startOfDay(now));
  base.setDate(base.getDate() + offset * (mode === 'weekly' ? 7 : 1));
  base.setHours(0, 0, 0, 0);
  const startMs = base.getTime();

  const end = new Date(startMs);
  end.setDate(end.getDate() + days);
  end.setHours(0, 0, 0, 0);

  return { startMs, endMs: end.getTime(), days };
}


export function timelineCells(
  mode: TimelineMode,
  span: { startMs: number; days: number }
): { at: number; durationMs: number }[] {
  const perDay = mode === 'session' ? 4 : 1;
  const boundary = (index: number) => {
    const date = new Date(span.startMs);
    date.setDate(date.getDate() + Math.floor(index / perDay));
    date.setHours((index % perDay) * (24 / perDay), 0, 0, 0);
    return date.getTime();
  };

  return Array.from({ length: span.days * perDay }, (_, index) => {
    const at = boundary(index);
    return { at, durationMs: boundary(index + 1) - at };
  });
}









function usedFillWithinBar(
  windowStartMs: number,
  windowEndMs: number,
  spanStartMs: number,
  spanEndMs: number,
  remainingPercent: number | null
): number | null {
  if (remainingPercent === null) return null;
  const duration = windowEndMs - windowStartMs;
  const visibleStart = Math.max(windowStartMs, spanStartMs);
  const visibleEnd = Math.min(windowEndMs, spanEndMs);
  if (duration <= 0 || visibleEnd <= visibleStart) return null;

  const usedEnd = windowStartMs + ((100 - remainingPercent) / 100) * duration;
  if (usedEnd <= visibleStart) return 0;
  const width =
    ((Math.min(usedEnd, visibleEnd) - visibleStart) / (visibleEnd - visibleStart)) * 100;
  return Math.min(100, Math.max(0, width));
}







export function projectLane(
  lane: TimelineLane,
  spanStartMs: number,
  spanEndMs: number,
  now: number,
  mode: TimelineMode
): TimelineWindow[] {
  const periodHours = lane.periodHours;
  if (lane.anchorMs === null || !periodHours) return [];
  if (mode === 'session' && periodHours !== SESSION_PERIOD_HOURS) return [];

  const span = spanEndMs - spanStartMs;
  if (span <= 0) return [];

  const toPercent = (ms: number) => ((ms - spanStartMs) / span) * 100;

  return windowsIn(lane.anchorMs, periodHours * HOUR_MS, spanStartMs, spanEndMs)
    .map((window): TimelineWindow | null => {
      const left = Math.max(0, toPercent(window.startMs));
      const right = Math.min(100, toPercent(window.endMs));
      if (right <= 0 || left >= 100 || right <= left) return null;

      const state: TimelineWindow['state'] =
        window.endMs <= now ? 'past' : window.startMs <= now ? 'live' : 'next';


      const remaining = state === 'live' && window.endMs === lane.anchorMs ? lane.remaining : null;

      return {
        startMs: window.startMs,
        endMs: window.endMs,
        leftPercent: left,
        widthPercent: right - left,
        state,
        remaining,
        usedFillPercent: usedFillWithinBar(
          window.startMs,
          window.endMs,
          spanStartMs,
          spanEndMs,
          remaining
        ),
      };
    })
    .filter((window): window is TimelineWindow => window !== null);
}


export function projectResetCredits(
  lane: TimelineLane,
  spanStartMs: number,
  spanEndMs: number,
  now: number
): TimelineResetCreditMark[] {
  const span = spanEndMs - spanStartMs;
  if (span <= 0) return [];

  return lane.resetCredits
    .filter(
      (credit) =>
        credit.expiresAtMs > now &&
        credit.expiresAtMs >= spanStartMs &&
        credit.expiresAtMs < spanEndMs
    )
    .map((credit) => ({
      ...credit,
      leftPercent: ((credit.expiresAtMs - spanStartMs) / span) * 100,
    }));
}















export function pickLaneWindow<
  T extends { resetAtMs?: number | null; periodHours?: number | null },
>(windows: readonly T[], maxPeriodHours?: number): T | null {
  const usable = windows.filter(
    (window) => typeof window.resetAtMs === 'number' && Number.isFinite(window.resetAtMs)
  );
  if (usable.length === 0) return null;

  const periodOf = (window: T) =>
    typeof window.periodHours === 'number' && window.periodHours > 0 ? window.periodHours : 0;

  const fitting =
    maxPeriodHours === undefined
      ? usable
      : usable.filter((window) => periodOf(window) <= maxPeriodHours);


  const pool = fitting.length > 0 ? fitting : usable;
  return pool.reduce((best, window) => {
    const byPeriod = periodOf(window) - periodOf(best);
    if (byPeriod !== 0) return byPeriod > 0 ? window : best;
    return (window.resetAtMs as number) < (best.resetAtMs as number) ? window : best;
  });
}












export function laneHasWindow(lane: TimelineLane): boolean {
  return lane.anchorMs !== null;
}




interface WindowLike {
  id?: string;
  label?: string;
  usedPercent?: number | null;
  resetAtMs?: number | null;
  periodHours?: number | null;
}

interface ResetCreditLike {
  id?: string;
  status?: string;
  grantedAt?: string;
  expiresAt?: string;
}

interface KimiRowLike {
  label?: string;
  labelKey?: string;
  used: number;
  limit: number;
  resetAtMs?: number | null;
  periodHours?: number | null;
}

interface XaiBillingLike {
  periodType?: string;
  usagePercent?: number | null;
  resetAtMs?: number | null;
  periodHours?: number | null;
  productUsage?: { product?: string; usagePercent?: number | null }[];
}

interface AntigravityBucketLike {
  label?: string;

  remainingFraction?: number | null;
  resetAtMs?: number | null;
  periodHours?: number | null;
}

interface MetaWindowLike {
  id: 'window' | 'weekly';
  usedPercent: number | null;

  resetAt?: number;
  durationMinutes?: number;
}

export interface TimelineLaneInput {
  name: string;
  displayName: string;
  provider: QuotaProviderType;
  quota: { status?: string } | undefined;





  maxPeriodHours?: number;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));













export function buildTimelineLane(input: TimelineLaneInput): TimelineLane {
  const { name, displayName, provider, quota, maxPeriodHours } = input;
  const empty: TimelineLane = {
    name,
    displayName,
    provider,
    anchorMs: null,
    periodHours: null,
    remaining: null,
    limits: [],
    resetCredits: [],
  };

  if (!quota || quota.status !== 'success') return empty;

  if (provider === 'claude' || provider === 'codex') {
    const windows = ((quota as { windows?: WindowLike[] }).windows ?? []).filter(
      (window) => typeof window.resetAtMs === 'number'
    );
    const sessionView = maxPeriodHours !== undefined && maxPeriodHours <= SESSION_PERIOD_HOURS;
    const accountWindowId = sessionView
      ? 'five-hour'
      : provider === 'codex'
        ? 'weekly'
        : 'seven-day';





    const accountWindow = windows.find(
      (window) =>
        window.id === accountWindowId &&
        typeof window.periodHours === 'number' &&
        window.periodHours > 0 &&
        (maxPeriodHours === undefined || window.periodHours <= maxPeriodHours)
    );
    const chosen = accountWindow ?? pickLaneWindow(windows, maxPeriodHours);
    if (!chosen) return empty;

    const resetCredits =
      provider === 'codex'
        ? ((quota as { rateLimitResetCredits?: ResetCreditLike[] }).rateLimitResetCredits ?? [])
            .filter((credit) => credit.status === 'available')
            .map((credit): TimelineResetCredit | null => {
              const expiresAtMs = new Date(credit.expiresAt ?? '').getTime();
              if (!Number.isFinite(expiresAtMs)) return null;

              const grantedAtMs = new Date(credit.grantedAt ?? '').getTime();
              return {
                id: credit.id ?? '',
                grantedAtMs: Number.isFinite(grantedAtMs) ? grantedAtMs : null,
                expiresAtMs,
              };
            })
            .filter((credit): credit is TimelineResetCredit => credit !== null)
        : [];

    return {
      ...empty,
      anchorMs: chosen.resetAtMs ?? null,
      periodHours: chosen.periodHours ?? null,

      remaining:
        typeof chosen.usedPercent === 'number' ? clampPercent(100 - chosen.usedPercent) : null,
      limits: windows
        .filter((window) => typeof window.usedPercent === 'number')
        .map((window) => ({
          label: window.label ?? '',
          remaining: clampPercent(100 - (window.usedPercent as number)),
        })),
      resetCredits,
    };
  }

  if (provider === 'devin') {
    const windows =
      (
        quota as {
          windows?: {
            id: string;
            label?: string;
            remainingPercent: number | null;
            resetAtMs: number | null;
            periodHours: number;
          }[];
        }
      ).windows ?? [];
    const chosen = pickLaneWindow(windows, maxPeriodHours);
    if (!chosen) return empty;
    return {
      ...empty,
      anchorMs: chosen.resetAtMs,
      periodHours: chosen.periodHours,
      remaining: chosen.remainingPercent,
      limits: windows
        .filter((window) => window.remainingPercent !== null)
        .map((window) => ({
          label: window.label ?? window.id,
          remaining: window.remainingPercent as number,
        })),
    };
  }

  if (provider === 'xai') {
    const billing = (quota as { billing?: XaiBillingLike | null }).billing;




    if (!billing || billing.periodType !== 'weekly') return empty;
    if (typeof billing.resetAtMs !== 'number' || !Number.isFinite(billing.resetAtMs)) return empty;

    const remaining =
      typeof billing.usagePercent === 'number' ? clampPercent(100 - billing.usagePercent) : null;

    return {
      ...empty,
      anchorMs: billing.resetAtMs,


      periodHours: billing.periodHours ?? 24 * 7,
      remaining,

      limits: [],
    };
  }

  if (provider === 'antigravity' || provider === 'plugin') {


    const buckets = ((quota as { groups?: { buckets?: AntigravityBucketLike[] }[] }).groups ?? [])
      .flatMap((group) => group.buckets ?? [])
      .filter((bucket) => typeof bucket.resetAtMs === 'number');
    const chosen = pickLaneWindow(buckets, maxPeriodHours);
    if (!chosen) return empty;


    const remainingOf = (bucket: AntigravityBucketLike) =>
      typeof bucket.remainingFraction === 'number'
        ? clampPercent(Math.round(bucket.remainingFraction * 100))
        : null;

    return {
      ...empty,
      anchorMs: chosen.resetAtMs ?? null,
      periodHours: chosen.periodHours ?? null,
      remaining: remainingOf(chosen),
      limits: buckets
        .map((bucket) => ({ label: bucket.label ?? '', remaining: remainingOf(bucket) }))
        .filter((limit): limit is TimelineLimit => limit.remaining !== null),
    };
  }

  if (provider === 'kimi') {
    const rows = ((quota as { rows?: KimiRowLike[] }).rows ?? []).filter(
      (row) => typeof row.resetAtMs === 'number'
    );
    const chosen = pickLaneWindow(rows, maxPeriodHours);
    if (!chosen) return empty;


    const remainingOf = (row: KimiRowLike) =>
      row.limit > 0 ? clampPercent(Math.round(((row.limit - row.used) / row.limit) * 100)) : null;

    return {
      ...empty,
      anchorMs: chosen.resetAtMs ?? null,
      periodHours: chosen.periodHours ?? null,
      remaining: remainingOf(chosen),
      limits: rows
        .map((row) => ({ label: row.label ?? '', remaining: remainingOf(row) }))
        .filter((limit): limit is TimelineLimit => limit.remaining !== null),
    };
  }

  if (provider === 'meta') {
    const sourceWindows = (quota as { data?: { windows?: MetaWindowLike[] } }).data?.windows ?? [];
    const windows = sourceWindows

      .map((window) => ({
        ...window,
        durationMinutes: window.id === 'weekly' ? 7 * 24 * 60 : window.durationMinutes,
      }))
      .filter(
        (window) =>
          typeof window.resetAt === 'number' &&
          Number.isFinite(window.resetAt) &&
          typeof window.durationMinutes === 'number' &&
          Number.isFinite(window.durationMinutes) &&
          window.durationMinutes > 0
      )
      .map((window) => ({
        ...window,
        resetAtMs: (window.resetAt as number) * 1000,
        periodHours: (window.durationMinutes as number) / 60,
      }));
    const chosen = pickLaneWindow(windows, maxPeriodHours);
    if (!chosen) return empty;

    const remainingOf = (window: MetaWindowLike) =>
      typeof window.usedPercent === 'number' && Number.isFinite(window.usedPercent)
        ? clampPercent(100 - window.usedPercent)
        : null;

    return {
      ...empty,
      anchorMs: chosen.resetAtMs,
      periodHours: chosen.periodHours,
      remaining: remainingOf(chosen),
      limits: windows
        .map((window) => ({
          label: `meta_quota.${window.id}`,
          remaining: remainingOf(window),
        }))
        .filter((limit): limit is TimelineLimit => limit.remaining !== null),
    };
  }

  return empty;
}
