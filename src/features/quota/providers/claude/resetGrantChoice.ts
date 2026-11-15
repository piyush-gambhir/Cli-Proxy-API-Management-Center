import {
  anthropicResetGrantBlocker,
  type AnthropicResetGrant,
  type AnthropicResetGrantStatus,
} from '@/services/api/claudeResetGrants';

export function resetGrantKind(grant?: AnthropicResetGrant) {
  if (grant?.givesBackWeekly) return 'fable';
  return grant?.resetType ?? 'unknown';
}


export function canChooseResetGrant(
  status: AnthropicResetGrantStatus | null,
  pendingGrantId: string | undefined,
  grantId: unknown,
  now: number
): grantId is string {
  if (typeof grantId !== 'string' || !grantId) return false;

  if (pendingGrantId) return pendingGrantId === grantId;
  if (!status || anthropicResetGrantBlocker(status, grantId)) return false;
  const grant = status.grants.find((candidate) => candidate.id === grantId)!;
  return (
    (!grant.startsAt || Date.parse(grant.startsAt) <= now) &&
    (!grant.endsAt || Date.parse(grant.endsAt) > now) &&
    (!status.cooldownUntil || Date.parse(status.cooldownUntil) <= now)
  );
}
