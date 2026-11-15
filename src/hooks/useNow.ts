



import { useSyncExternalStore } from 'react';
import { MINUTE_CLOCK } from '@/utils/time/sharedClock';

const noopSubscribe = () => () => {};









const FROZEN_NOW = Date.now();
const frozenSnapshot = () => FROZEN_NOW;

/**
 * @param enabled pass false to opt out of minute re-renders — the hook still
 * runs (rules of hooks) but subscribes to nothing and returns a frozen value.
 * Callers that only need `now` in one branch should gate here rather than
 * calling the hook conditionally.
 */
export function useNow(enabled = true): number {
  return useSyncExternalStore(
    enabled ? MINUTE_CLOCK.subscribe : noopSubscribe,
    enabled ? MINUTE_CLOCK.getSnapshot : frozenSnapshot,
    frozenSnapshot
  );
}
