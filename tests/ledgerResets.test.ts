import { describe, expect, test } from 'bun:test';
import { claudeResets, codexResets } from '@/ledger/resets';
import type { AnthropicResetGrant } from '@/services/api/claudeResetGrants';

const grant = (patch: Partial<AnthropicResetGrant>): AnthropicResetGrant => ({
  id: 'g',
  label: '',
  resetsTotal: 1,
  resetsLeft: 1,
  startsAt: null,
  endsAt: null,
  clears: [],
  paused: false,
  usableNow: true,
  useRequiresLimit: false,
  percentUsed: {},
  ...patch,
});

describe('codexResets', () => {
  test('counts only available credits, grouped by expiry day, soonest first', () => {
    expect(
      codexResets(
        [
          { status: 'available', expiresAt: '2026-12-02T10:00:00Z' },
          { status: 'used', expiresAt: '2026-11-15T10:00:00Z' },
          { status: 'available', expiresAt: '2026-11-18T09:00:00Z' },
          { status: 'available', expiresAt: '2026-11-18T08:00:00Z' },
        ],
        Date.parse('2026-11-01T00:00:00Z')
      )
    ).toEqual([
      {
        kindKey: 'ledger.reset_kind_quota',
        count: 2,
        expiresAtMs: Date.parse('2026-11-18T08:00:00Z'),
      },
      {
        kindKey: 'ledger.reset_kind_quota',
        count: 1,
        expiresAtMs: Date.parse('2026-12-02T10:00:00Z'),
      },
    ]);
  });

  test('ignores a missing or malformed list', () => {
    expect(codexResets(undefined, 0)).toEqual([]);
    expect(codexResets({}, 0)).toEqual([]);
  });
});

describe('claudeResets', () => {
  test('keeps kinds apart, sums resets left, and puts unknown expiry last', () => {
    const result = claudeResets(
      [
        grant({ resetType: 'weekly', resetsLeft: 2, endsAt: null }),
        grant({ resetType: 'session', resetsLeft: 1, endsAt: '2026-11-20T00:00:00Z' }),
        grant({ givesBackWeekly: true, resetsLeft: 1, endsAt: '2026-11-19T00:00:00Z' }),
        grant({ resetType: 'full', resetsLeft: 0, endsAt: '2026-11-18T00:00:00Z' }),
      ],
      Date.parse('2026-11-01T00:00:00Z')
    );
    expect(result.map((r) => [r.kindKey, r.count])).toEqual([
      ['claude_reset.kind_fable', 1],
      ['claude_reset.kind_session', 1],
      ['claude_reset.kind_weekly', 2],
    ]);
  });
});

describe('expiry', () => {
  test('drops each expired reset before grouping, so a later same-day reset survives', () => {
    const credits = [
      { status: 'available', expiresAt: '2026-11-18T08:00:00Z' },
      { status: 'available', expiresAt: '2026-11-18T15:00:00Z' },
    ];
    expect(codexResets(credits, Date.parse('2026-11-18T09:00:00Z'))).toEqual([
      {
        kindKey: 'ledger.reset_kind_quota',
        count: 1,
        expiresAtMs: Date.parse('2026-11-18T15:00:00Z'),
      },
    ]);
  });
});
