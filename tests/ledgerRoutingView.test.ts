import { describe, expect, test } from 'bun:test';
import type { RoutingMember } from '@/types/routing';
import {
  crossProviderReorders,
  demotePriority,
  groupByProvider,
  nextMemberKey,
  normalizeStrategy,
  preferPriority,
} from '@/ledger/routing/routingView';

const member = (name: string, family: string, priority: number, extra = {}): RoutingMember => ({
  key: `credential:${name}`,
  kind: 'credential',
  family,
  name,
  detail: '',
  priority,
  weights: [],
  keyCount: 1,
  disabled: false,
  locked: false,
  prefix: '',
  excludedModels: [],
  modelSource: { type: 'credential', name },
  unavailable: false,
  cooldowns: null,
  location: { kind: 'credential', name },
  ...extra,
});

const members = [
  member('claude-a.json', 'claude', 0),
  member('claude-b.json', 'claude', 0),
  member('codex-a.json', 'codex', 10),
  member('codex-b.json', 'codex', 0),
];

describe('ledger routing view', () => {
  test('reads the proxy strategy names, including reset-soonest and its alias', () => {
    expect(normalizeStrategy('reset-soonest')).toBe('reset-soonest');
    expect(normalizeStrategy('expiring_first')).toBe('reset-soonest');
    expect(normalizeStrategy('FF')).toBe('fill-first');
    expect(normalizeStrategy('')).toBe('round-robin');
  });

  test('groups by provider and orders by priority, then the live ranking', () => {
    const groups = groupByProvider(members, {}, [
      { auth: 'claude-b.json', provider: 'claude', usable: true, reason: 'ranked' },
      { auth: 'claude-a.json', provider: 'claude', usable: true, reason: 'ranked' },
    ]);
    expect(groups.map((group) => group.provider)).toEqual(['claude', 'codex']);
    expect(groups[0].members.map((entry) => entry.member.name)).toEqual([
      'claude-b.json',
      'claude-a.json',
    ]);
    expect(groups[1].members.map((entry) => [entry.member.name, entry.level])).toEqual([
      ['codex-a.json', 0],
      ['codex-b.json', 1],
    ]);
  });

  test('prefer and demote move within the provider only', () => {
    const [claude, codex] = groupByProvider(members, {}, []);
    // Top-level peers: preferring makes a level of its own above them.
    expect(preferPriority(claude, 'credential:claude-a.json')).toBe(10);
    expect(demotePriority(claude, 'credential:claude-a.json')).toBe(-10);
    // Codex has two levels: the lower one joins the higher, the top one can't go further.
    expect(preferPriority(codex, 'credential:codex-b.json')).toBe(10);
    expect(preferPriority(codex, 'credential:codex-a.json')).toBeNull();
    expect(demotePriority(codex, 'credential:codex-a.json')).toBe(0);
  });

  test('locked members never move', () => {
    const [group] = groupByProvider(
      [member('x.json', 'claude', 0, { locked: true }), member('y.json', 'claude', 0)],
      {},
      []
    );
    expect(preferPriority(group, 'credential:x.json')).toBeNull();
  });

  test('the next request skips paused, cooling and unusable accounts', () => {
    const [group] = groupByProvider(
      [
        member('a.json', 'claude', 10, { disabled: true }),
        member('b.json', 'claude', 10),
        member('c.json', 'claude', 10),
        member('d.json', 'claude', 0),
      ],
      {},
      [
        { auth: 'b.json', provider: 'claude', usable: false, reason: 'five_hour_exhausted' },
        { auth: 'c.json', provider: 'claude', usable: true, reason: 'ranked' },
      ]
    );
    expect(nextMemberKey(group, () => false)).toBe('credential:c.json');
    // Only the highest available priority competes: with c cooling, b still wins over the
    // lower tier even though it is ranked unusable, as the proxy falls back inside the tier.
    expect(nextMemberKey(group, (m) => m.name === 'c.json')).toBe('credential:b.json');
  });

  test('matches the ranking without regard to case', () => {
    const [group] = groupByProvider([member('Claude-A.json', 'claude', 0)], {}, [
      { auth: 'claude-a.json', provider: 'claude', usable: false, reason: 'no_data' },
    ]);
    expect(group.members[0].ranking?.reason).toBe('no_data');
  });

  test('flags moves that reorder an account against another provider', () => {
    const list = [
      member('claude-a.json', 'claude', 0),
      member('claude-b.json', 'claude', 0),
      member('compat', 'openai-compatibility', 0, { kind: 'compat' }),
      member('codex.json', 'codex', 0),
    ];
    // Codex never serves Claude's models, so only the compatible provider counts.
    expect(crossProviderReorders(list, { 'credential:claude-a.json': 10 })).toBe(1);
    expect(crossProviderReorders(list, {})).toBe(0);
  });
});
