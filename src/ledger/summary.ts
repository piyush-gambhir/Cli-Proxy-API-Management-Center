/**
 * Per-provider capacity for the accounts screen's summary tiles.
 *
 * Callers pass each account's limits with a stable id and a display label (see CapacityTiles,
 * which derives them from timeline lanes) plus the account's next reset. Remaining percents add
 * up across accounts per limit id: two weekly windows at 95% and 100% read "195% of 200%".
 */
import type { QuotaProviderType } from '@/features/quota/providers/types';

export interface CapacityLimitInput {
  /** Stable identity used to add the same limit across accounts. */
  id: string;
  label: string;
  /** Remaining percent, 0..100. */
  remaining: number;
}

export interface CapacityInput {
  provider: QuotaProviderType;
  limits: CapacityLimitInput[];
  /** The account's next reset across all of its windows, if one is known and upcoming. */
  nextResetMs: number | null;
}

export interface LimitCapacity {
  id: string;
  label: string;
  /** Sum of remaining percent across the accounts reporting this limit. */
  left: number;
  /** 100 per reporting account. */
  total: number;
  /** One remaining percent per reporting account, in input order. */
  segments: number[];
}

export interface ProviderCapacity {
  provider: QuotaProviderType;
  /** Accounts with at least one reported limit. */
  accounts: number;
  /** The limit with the smallest share left; it is the one that binds first. */
  headline: LimitCapacity;
  others: LimitCapacity[];
  /** Earliest upcoming reset across the provider's accounts. */
  soonestResetMs: number | null;
}

export function summarizeCapacity(inputs: CapacityInput[]): ProviderCapacity[] {
  const byProvider = new Map<QuotaProviderType, CapacityInput[]>();
  inputs.forEach((input) => {
    if (input.limits.length === 0) return;
    const group = byProvider.get(input.provider) ?? [];
    group.push(input);
    byProvider.set(input.provider, group);
  });

  return Array.from(byProvider, ([provider, group]) => {
    const totals = new Map<string, LimitCapacity>();
    group.forEach((input) => {
      input.limits.forEach((limit) => {
        const entry = totals.get(limit.id) ?? {
          id: limit.id,
          label: limit.label,
          left: 0,
          total: 0,
          segments: [],
        };
        entry.left += limit.remaining;
        entry.total += 100;
        entry.segments.push(limit.remaining);
        totals.set(limit.id, entry);
      });
    });

    const limits = Array.from(totals.values());
    const headline = limits.reduce((tightest, limit) =>
      limit.left / limit.total < tightest.left / tightest.total ? limit : tightest
    );
    const resets = group
      .map((input) => input.nextResetMs)
      .filter((ms): ms is number => ms !== null);

    return {
      provider,
      accounts: group.length,
      headline,
      others: limits.filter((limit) => limit !== headline),
      soonestResetMs: resets.length > 0 ? Math.min(...resets) : null,
    };
  });
}
