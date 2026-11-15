







import type { RoutingMember } from '@/types/routing';
import { TIER_STEP } from '@/features/routing/logic';

export type LedgerStrategy =
  'reset-soonest' | 'round-robin' | 'weighted-round-robin' | 'fill-first';


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

  level: number;

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


        if (moved.kind !== 'compat' && other.kind !== 'compat') return;
        const before = Math.sign(moved.priority - other.priority);
        const after = Math.sign(next(moved) - next(other));
        if (before !== after) affected.add(other.key);
      });
    });
  return affected.size;
}
