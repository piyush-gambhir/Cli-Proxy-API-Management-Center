/**
 * Every provider's quota as one flat list: label, share left, when it resets.
 *
 * Upstream renders each provider with its own body (tables, plan chips, credit blocks). The ledger
 * shows every account the same way, so it reads the provider states structurally here, the same
 * way upstream's timeline model does, and keeps only what answers "how much is left, and when
 * does it come back".
 */

import type { TFunction } from 'i18next';
import type { QuotaProviderType } from '@/features/quota/providers/types';
import { normalizePlanType } from '@/utils/quota/parsers';
import { PREMIUM_CODEX_PLAN_TYPES } from '@/utils/quota/planTier';

export interface LedgerLimit {
  id: string;
  label: string;
  /** Share left, 0..100; null when the provider did not say. */
  remaining: number | null;
  /** Replaces the percent for amount-based limits (Claude dollar credit). */
  amount?: string;
  resetAtMs: number | null;
}

export interface LedgerFacts {
  plan: string | null;
  /** Codex manual quota resets the account can still spend. */
  manualResets: number | null;
}

type Labeled = { label?: string; labelKey?: string; labelParams?: Record<string, string | number> };

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
/** Whole amounts without decimals ($250), anything else to the cent ($0.49, $12.50). */
const formatMoney = (value: number, currency: string, locale?: string) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
const leftOfUsed = (used: unknown) =>
  typeof used === 'number' && Number.isFinite(used) ? clamp(100 - used) : null;
const finiteMs = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const isoMs = (value: string | null | undefined) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : null;
};
const labelOf = (item: Labeled, t: TFunction, fallback: string) =>
  item.labelKey ? String(t(item.labelKey, item.labelParams)) : item.label || fallback;

export function accountLimits(
  provider: QuotaProviderType,
  quota: unknown,
  t: TFunction,
  locale?: string
): LedgerLimit[] {
  const state = quota as { status?: string } | undefined;
  if (!state || state.status !== 'success') return [];
  const q = quota as Record<string, unknown>;

  if (provider === 'claude' || provider === 'codex') {
    type Window = Labeled & { id: string; usedPercent: number | null; resetAtMs?: number | null };
    const windows = ((q.windows as Window[] | undefined) ?? []).map((window) => ({
      id: window.id,
      label: labelOf(window, t, window.id),
      remaining: leftOfUsed(window.usedPercent),
      resetAtMs: finiteMs(window.resetAtMs),
    }));
    if (provider === 'codex') return windows;

    type Dollar = {
      key: string;
      limitDollars: number | null;
      remainingDollars: number | null;
      utilization: number | null;
      resetsAt: string | null;
    };
    const dollars = ((q.dollarWindows as Dollar[] | undefined) ?? []).map((window): LedgerLimit => {
      const share =
        window.utilization !== null
          ? leftOfUsed(window.utilization)
          : window.limitDollars && window.remainingDollars !== null
            ? clamp((window.remainingDollars / window.limitDollars) * 100)
            : null;
      return {
        id: `dollar:${window.key}`,
        label: String(t(`ledger.dollar_window_${window.key}`, { defaultValue: window.key })),
        remaining: share,
        amount:
          window.remainingDollars !== null
            ? formatMoney(window.remainingDollars, 'USD', locale)
            : undefined,
        resetAtMs: isoMs(window.resetsAt),
      };
    });

    // Extra usage is a monthly budget in minor currency units, separate from the dollar windows.
    const extra = q.extraUsage as
      | {
          isEnabled: boolean | null;
          monthlyLimit: number | null;
          usedCredits: number | null;
          currency: string | null;
        }
      | null
      | undefined;
    const extras: LedgerLimit[] = [];
    if (extra?.isEnabled && extra.monthlyLimit) {
      const left = Math.max(0, extra.monthlyLimit - (extra.usedCredits ?? 0));
      extras.push({
        id: 'extra-usage',
        label: String(t('ledger.limit_extra_usage')),
        remaining: clamp((left / extra.monthlyLimit) * 100),
        amount: formatMoney(left / 100, extra.currency || 'USD', locale),
        resetAtMs: null,
      });
    }
    return [...windows, ...dollars, ...extras];
  }

  if (provider === 'devin') {
    type Window = {
      id: string;
      label?: string;
      remainingPercent: number | null;
      resetAtMs: number | null;
    };
    return ((q.windows as Window[] | undefined) ?? []).map((window) => ({
      id: window.id,
      label: window.label || window.id,
      remaining: window.remainingPercent === null ? null : clamp(window.remainingPercent),
      resetAtMs: finiteMs(window.resetAtMs),
    }));
  }

  if (provider === 'xai') {
    // Same split as upstream's xAI body: `usagePercent` is the weekly window (only when the active
    // period is weekly), `usedPercent` the monthly spend, `onDemandUsedPercent` the on-demand cap.
    const billing = q.billing as
      | {
          mode?: string;
          periodType?: string;
          usagePercent?: number | null;
          resetAtMs?: number | null;
          usedPercent?: number | null;
          monthlyLimitCents?: number | null;
          billingPeriodEnd?: string;
          onDemandCapCents?: number | null;
          onDemandUsedPercent?: number | null;
        }
      | null
      | undefined;
    if (!billing || billing.mode === 'paid-health') return [];
    const limits: LedgerLimit[] = [];
    if (billing.periodType === 'weekly' && typeof billing.usagePercent === 'number') {
      limits.push({
        id: 'xai:weekly',
        label: String(t('ledger.limit_weekly')),
        remaining: leftOfUsed(billing.usagePercent),
        resetAtMs: finiteMs(billing.resetAtMs),
      });
    }
    if ((billing.monthlyLimitCents ?? 0) > 0 && typeof billing.usedPercent === 'number') {
      limits.push({
        id: 'xai:monthly',
        label: String(t('ledger.limit_monthly')),
        remaining: leftOfUsed(billing.usedPercent),
        resetAtMs: isoMs(billing.billingPeriodEnd),
      });
    }
    if ((billing.onDemandCapCents ?? 0) > 0 && typeof billing.onDemandUsedPercent === 'number') {
      limits.push({
        id: 'xai:on-demand',
        label: String(t('ledger.limit_on_demand')),
        remaining: leftOfUsed(billing.onDemandUsedPercent),
        resetAtMs: isoMs(billing.billingPeriodEnd),
      });
    }
    return limits;
  }

  if (provider === 'antigravity' || provider === 'plugin') {
    type Bucket = {
      id: string;
      label?: string;
      remainingFraction?: number | null;
      resetAtMs?: number | null;
    };
    // Groups (e.g. Gemini vs Claude/GPT) can reuse bucket names, so ids and labels keep the group.
    type Group = { id?: string; label?: string; buckets?: Bucket[] };
    const groups = (q.groups as Group[] | undefined) ?? [];
    return groups.flatMap((group, groupIndex) =>
      (group.buckets ?? []).map((bucket) => ({
        id: `${group.id ?? groupIndex}:${bucket.id}`,
        label:
          groups.length > 1 && group.label
            ? `${group.label} · ${bucket.label || bucket.id}`
            : bucket.label || bucket.id,
        remaining:
          typeof bucket.remainingFraction === 'number'
            ? clamp(Math.round(bucket.remainingFraction * 100))
            : null,
        resetAtMs: finiteMs(bucket.resetAtMs),
      }))
    );
  }

  if (provider === 'kimi') {
    type Row = Labeled & { id: string; used: number; limit: number; resetAtMs?: number | null };
    return ((q.rows as Row[] | undefined) ?? []).map((row, index) => ({
      id: row.id,
      label: labelOf(row, t, String(t('ledger.limit_fallback', { n: index + 1 }))),
      remaining:
        row.limit > 0 ? clamp(Math.round(((row.limit - row.used) / row.limit) * 100)) : null,
      resetAtMs: finiteMs(row.resetAtMs),
    }));
  }

  if (provider === 'meta') {
    type Window = { id: string; usedPercent: number | null; resetAt?: number };
    const data = q.data as { windows?: Window[] } | undefined;
    return (data?.windows ?? []).map((window) => ({
      id: window.id,
      label: String(t(`meta_quota.${window.id}`)),
      remaining: leftOfUsed(window.usedPercent),
      resetAtMs: typeof window.resetAt === 'number' ? window.resetAt * 1000 : null,
    }));
  }

  return [];
}

export function accountFacts(
  provider: QuotaProviderType,
  quota: unknown,
  t: TFunction
): LedgerFacts {
  const state = quota as { status?: string } | undefined;
  const none: LedgerFacts = { plan: null, manualResets: null };
  if (!state || state.status !== 'success') return none;
  const q = quota as Record<string, unknown>;

  if (provider === 'codex') {
    const normalized = normalizePlanType(q.planType);
    const plan = !normalized
      ? null
      : normalized === 'self_serve_business_prolite'
        ? t('codex_quota.plan_business_premium')
        : normalized === 'pro'
          ? t('codex_quota.plan_pro')
          : PREMIUM_CODEX_PLAN_TYPES.has(normalized)
            ? t('codex_quota.plan_prolite')
            : ['plus', 'team', 'free'].includes(normalized)
              ? t(`codex_quota.plan_${normalized}`)
              : capitalize(String(q.planType ?? normalized));
    const resets = q.rateLimitResetCreditsAvailableCount;
    return { plan, manualResets: typeof resets === 'number' ? resets : null };
  }
  if (provider === 'claude' && typeof q.planType === 'string' && q.planType) {
    return { ...none, plan: String(t(`claude_quota.${q.planType}`, { defaultValue: q.planType })) };
  }
  if (provider === 'devin' && typeof q.plan === 'string') return { ...none, plan: q.plan };
  if (provider === 'xai') {
    const label = (q.billing as { planLabel?: string } | null)?.planLabel;
    return { ...none, plan: label ?? null };
  }
  if (provider === 'antigravity') {
    const sub = q.subscription as
      { plan?: string | null; tierName?: string | null } | null | undefined;
    return { ...none, plan: sub?.tierName ?? sub?.plan ?? null };
  }
  return none;
}
