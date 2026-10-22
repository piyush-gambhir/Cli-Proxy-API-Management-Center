import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { accountLimits } from '@/ledger/limits';

const t = ((key: string, options?: { defaultValue?: string }) =>
  options?.defaultValue ?? key) as unknown as TFunction;

describe('accountLimits', () => {
  test('xAI keeps weekly usage, monthly spend and on-demand apart', () => {
    const limits = accountLimits(
      'xai',
      {
        status: 'success',
        billing: {
          mode: 'billing',
          periodType: 'weekly',
          usagePercent: null,
          resetAtMs: 1_000,
          usedPercent: 20,
          monthlyLimitCents: 5_000,
          billingPeriodEnd: '2026-11-01T00:00:00Z',
          onDemandCapCents: 0,
          onDemandUsedPercent: 50,
        },
      },
      t,
      'en'
    );
    // Unknown weekly usage must not borrow the monthly figure.
    expect(limits.map((limit) => [limit.id, limit.remaining])).toEqual([['xai:monthly', 80]]);
  });

  test('Antigravity buckets with the same name stay separate per group', () => {
    const bucket = (remainingFraction: number) => ({
      id: 'weekly',
      label: 'Weekly Limit Remaining',
      remainingFraction,
    });
    const limits = accountLimits(
      'antigravity',
      {
        status: 'success',
        groups: [
          { id: 'gemini', label: 'Gemini', buckets: [bucket(1)] },
          { id: 'claude-gpt', label: 'Claude/GPT', buckets: [bucket(0)] },
        ],
      },
      t
    );
    expect(limits.map((limit) => [limit.id, limit.label, limit.remaining])).toEqual([
      ['gemini:weekly', 'Gemini · Weekly Limit Remaining', 100],
      ['claude-gpt:weekly', 'Claude/GPT · Weekly Limit Remaining', 0],
    ]);
  });

  test('Claude dollar credit keeps cents and extra usage converts minor units', () => {
    const limits = accountLimits(
      'claude',
      {
        status: 'success',
        windows: [],
        dollarWindows: [
          {
            key: 'iguana_necktie',
            limitDollars: 250,
            usedDollars: 249.51,
            remainingDollars: 0.49,
            utilization: null,
            resetsAt: null,
          },
        ],
        extraUsage: {
          isEnabled: true,
          monthlyLimit: 5_000,
          usedCredits: 1_250,
          utilization: 25,
          currency: 'USD',
        },
      },
      t,
      'en-US'
    );
    expect(
      limits.map((limit) => [limit.id, limit.amount, Math.round(limit.remaining ?? -1)])
    ).toEqual([
      ['dollar:iguana_necktie', '$0.49', 0],
      ['extra-usage', '$37.50', 75],
    ]);
  });

  test('nothing is read from a state that has not loaded', () => {
    expect(accountLimits('codex', { status: 'loading', windows: [] }, t)).toEqual([]);
    expect(accountLimits('codex', undefined, t)).toEqual([]);
  });
});
