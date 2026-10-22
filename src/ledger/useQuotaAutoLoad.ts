import { useEffect, useRef } from 'react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { isDisabledAuthFile } from '@/utils/quota/validators';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { QuotaCardState } from '@/features/quota/providers';

/** A credential loaded this recently is not fetched again just because the page reopened. */
const AUTO_LOAD_TTL_MS = 5 * 60_000;

// Module scope so the throttle survives leaving and reopening the page within a session.
const lastAutoLoadAt = new Map<string, number>();

/**
 * Load quota for every visible, enabled credential when the accounts screen opens, so rows show numbers
 * instead of a load button. Each credential loads at most once per visit, and not again within
 * AUTO_LOAD_TTL_MS of a successful load. No polling: "Refresh all" and the row refresh stay
 * manual. Covers Devin too, so a screen using this must not also run Devin's dedicated
 * auto-load (two auto-loaders in one render collide on the batch loader's single-flight guard).
 */
export function useQuotaAutoLoad(
  entries: QuotaFileEntry[],
  disabled: boolean,
  loadQuota: (targets: QuotaFileEntry[]) => Promise<void>,
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined
) {
  const attempted = useRef(new Set<string>());
  const session = useQuotaStore((state) => state.cacheGeneration);
  const fileGenerations = useQuotaStore((state) => state.fileGenerations);

  useEffect(() => {
    if (disabled) return;
    const now = Date.now();
    const targets = entries.filter((entry) => {
      if (isDisabledAuthFile(entry.file)) return false;
      const key = JSON.stringify([
        session,
        fileGenerations[entry.file.name] ?? 0,
        entry.type,
        getQuotaCacheKey(entry.file),
      ]);
      const status = quotaFor(entry)?.status;
      // Tried already this visit, unless its cache entry was since pruned (credential replaced).
      if (attempted.current.has(key) && status !== undefined) return false;
      if (status === 'loading') return false;
      if (status === 'success' && now - (lastAutoLoadAt.get(key) ?? 0) < AUTO_LOAD_TTL_MS) {
        return false;
      }
      attempted.current.add(key);
      lastAutoLoadAt.set(key, now);
      return true;
    });
    if (targets.length > 0) void loadQuota(targets);
  }, [disabled, entries, fileGenerations, loadQuota, quotaFor, session]);
}
