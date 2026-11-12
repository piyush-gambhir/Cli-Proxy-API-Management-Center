/**
 * Routing as each provider sees it. A request only ever goes to accounts that serve its model, so
 * priority tiers only compete within one provider: the view groups members by provider and orders
 * them the way the proxy picks, highest priority first and, under reset-soonest, by the proxy's
 * live ranking inside a priority. Prefer and Demote move one member between that provider's
 * priority levels and never touch another provider's numbers.
 */

import type { RoutingMember } from '@/types/routing';
import { TIER_STEP } from '@/features/routing/logic';

export type LedgerStrategy =
  'reset-soonest' | 'round-robin' | 'weighted-round-robin' | 'fill-first';

/** Same aliases as the proxy (config_basic.go); anything else runs as round-robin there. */
export function normalizeStrategy(value: unknown): LedgerStrategy {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  if (['reset-soonest', 'resetsoonest', 'expiring-first', 'expiringfirst'].includes(text)) {
    return 'reset-soonest';
  }
  if (['weighted-round-robin', 'weightedroundrobin', 'wrr'].includes(text)) {
    return 'weighted-round-robin';
  }
  if (['fill-first', 'fillfirst', 'ff'].includes(text)) return 'fill-first';
  return 'round-robin';
}

export interface RankingEntry {
  auth: string;
  provider: string;
  usable: boolean;
  reason: string;
}

export interface ViewMember {
  member: RoutingMember;
  priority: number;
  /** 0 for the provider's highest priority, 1 for the next one down, and so on. */
  level: number;
  /** The proxy's live ranking for this credential, when it has one. */
  ranking: RankingEntry | null;
}

export interface ProviderGroup {
  provider: string;
  members: ViewMember[];
}

export const providerOf = (member: RoutingMember) => {
  const family = member.family.trim().toLowerCase();
  return family === 'anthropic' ? 'claude' : family;
};

const credentialName = (member: RoutingMember) =>
  member.location.kind === 'credential' ? member.location.name : null;

export function groupByProvider(
  members: readonly RoutingMember[],
  priorities: Readonly<Record<string, number>>,
  ranking: readonly RankingEntry[]
): ProviderGroup[] {
  // The proxy reports auth IDs, which some platforms lowercase; file names keep their case.
  const rankIndex = new Map(ranking.map((entry, index) => [entry.auth.toLowerCase(), index]));
  const rankEntry = new Map(ranking.map((entry) => [entry.auth.toLowerCase(), entry]));
  const groups = new Map<string, RoutingMember[]>();
  members.forEach((member) => {
    const provider = providerOf(member);
    groups.set(provider, [...(groups.get(provider) ?? []), member]);
  });
  const priorityOf = (member: RoutingMember) => priorities[member.key] ?? member.priority;
  const rankOf = (member: RoutingMember) => {
    const name = credentialName(member);
    return name === null
      ? Number.MAX_SAFE_INTEGER
      : (rankIndex.get(name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER);
  };
  return [...groups.entries()]
    .map(([provider, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          priorityOf(b) - priorityOf(a) ||
          Number(a.disabled) - Number(b.disabled) ||
          rankOf(a) - rankOf(b) ||
          a.name.localeCompare(b.name)
      );
      const levels = [...new Set(sorted.map(priorityOf))];
      return {
        provider,
        members: sorted.map((member) => {
          const name = credentialName(member);
          return {
            member,
            priority: priorityOf(member),
            level: levels.indexOf(priorityOf(member)),
            ranking: name === null ? null : (rankEntry.get(name.toLowerCase()) ?? null),
          };
        }),
      };
    })
    .sort((a, b) => a.provider.localeCompare(b.provider));
}

/**
 * The priority that moves `key` one level up within its provider: it joins the next level up, or,
 * already at the top beside peers, gets a level of its own above them. Null when it can't move.
 */
export function preferPriority(group: ProviderGroup, key: string): number | null {
  const self = group.members.find((entry) => entry.member.key === key);
  if (!self || self.member.locked) return null;
  const higher = group.members
    .map((entry) => entry.priority)
    .filter((priority) => priority > self.priority);
  if (higher.length) return Math.min(...higher);
  const peers = group.members.filter((entry) => entry.priority === self.priority).length;
  return peers > 1 ? self.priority + TIER_STEP : null;
}

/** Mirror of preferPriority: join the next level down, or drop below peers at the bottom. */
export function demotePriority(group: ProviderGroup, key: string): number | null {
  const self = group.members.find((entry) => entry.member.key === key);
  if (!self || self.member.locked) return null;
  const lower = group.members
    .map((entry) => entry.priority)
    .filter((priority) => priority < self.priority);
  if (lower.length) return Math.max(...lower);
  const peers = group.members.filter((entry) => entry.priority === self.priority).length;
  return peers > 1 ? self.priority - TIER_STEP : null;
}

/**
 * The member a request goes to next under reset-soonest, as the proxy decides it: only the highest
 * priority that has an enabled account not cooling down competes; inside it the best-ranked usable
 * account wins, and if none is usable the proxy still uses the first of them. A guide, not a
 * guarantee: model support, prefixes and session affinity can still change the pick.
 */
export function nextMemberKey(
  group: ProviderGroup,
  isCooling: (member: RoutingMember) => boolean
): string | null {
  const available = group.members.filter(
    (entry) => !entry.member.disabled && !isCooling(entry.member)
  );
  if (available.length === 0) return null;
  const top = Math.max(...available.map((entry) => entry.priority));
  const tier = available.filter((entry) => entry.priority === top);
  return (tier.find((entry) => entry.ranking?.usable !== false) ?? tier[0]).member.key;
}

/**
 * How many accounts of other providers change order relative to a moved member. Tiers are global:
 * when an OpenAI-compatible provider serves the same model name as another provider, a move here
 * also decides between them, so the review says so.
 */
export function crossProviderReorders(
  members: readonly RoutingMember[],
  priorities: Readonly<Record<string, number>>
): number {
  const next = (member: RoutingMember) => priorities[member.key] ?? member.priority;
  const affected = new Set<string>();
  members
    .filter((member) => next(member) !== member.priority)
    .forEach((moved) => {
      members.forEach((other) => {
        if (providerOf(other) === providerOf(moved)) return;
        // Built-in providers serve disjoint model ids; only an OpenAI-compatible provider can
        // expose another provider's models under the same name.
        if (moved.kind !== 'compat' && other.kind !== 'compat') return;
        const before = Math.sign(moved.priority - other.priority);
        const after = Math.sign(next(moved) - next(other));
        if (before !== after) affected.add(other.key);
      });
    });
  return affected.size;
}
