import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { schedulerLimits } from '@/ledger/scheduler';

const t = ((key: string) => key) as unknown as TFunction;

describe('schedulerLimits', () => {
  test('maps known windows to remaining percent and skips unknown ones', () => {
    const limits = schedulerLimits(
      {
        provider: 'claude',
        fetched_at: '2026-11-11T23:25:05Z',
        five_hour: { used_percent: 0, known: false },
        seven_day: { used_percent: 98, reset_at: '2026-11-16T18:00:00Z', known: true },
        fable: { used_percent: 99, reset_at: '2026-11-16T18:00:00Z', known: true },
      },
      t
    );
    expect(limits.map((l) => [l.id, l.label, l.remaining])).toEqual([
      ['seven_day', 'codex_quota.secondary_window', 2],
      ['fable', 'ledger.limit_fable', 1],
    ]);
  });

  test('labels a Codex weekly slot that resets a month out as monthly', () => {
    const [limit] = schedulerLimits(
      {
        provider: 'codex',
        fetched_at: '2026-11-11T23:09:45Z',
        weekly: { used_percent: 0, reset_at: '2026-12-11T23:09:45Z', known: true },
      },
      t
    );
    expect(limit.label).toBe('codex_quota.team_secondary_window');
    expect(limit.remaining).toBe(100);
  });
});

describe('schedulerLimits hard limits and monthly hint', () => {
  test('a hard-limited window shows as 0% left even with a stale percentage', () => {
    const [limit] = schedulerLimits(
      {
        provider: 'claude',
        seven_day: { used_percent: 40, known: false, hard_limited: true },
      },
      t
    );
    expect(limit).toMatchObject({ id: 'seven_day', remaining: 0, hardLimited: true });
  });

  test('a remembered monthly window keeps its label in its last days', () => {
    const [limit] = schedulerLimits(
      {
        provider: 'codex',
        fetched_at: '2026-12-08T00:00:00Z',
        weekly: { used_percent: 10, reset_at: '2026-12-11T23:09:45Z', known: true },
      },
      t,
      true
    );
    expect(limit.label).toBe('codex_quota.team_secondary_window');
  });
});
