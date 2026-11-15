const MINUTE_MS = 60_000;







export function getNextAntigravityCountdownUpdateDelay(
  resetTimestamps: readonly number[],
  nowMs: number
): number | null {
  let nextDelay: number | null = null;

  resetTimestamps.forEach((resetMs) => {
    if (!Number.isFinite(resetMs)) return;
    const deltaMs = resetMs - nowMs;
    if (deltaMs <= 0) return;

    const remainder = deltaMs % MINUTE_MS;
    const delay = Math.max(1, Math.ceil(remainder === 0 ? MINUTE_MS : remainder));
    nextDelay = nextDelay === null ? delay : Math.min(nextDelay, delay);
  });

  return nextDelay;
}
