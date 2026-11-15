import { useEffect, useRef } from 'react';
import { useQuotaStore } from '@/stores/useQuotaStore';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { QuotaCardState } from '@/features/quota/providers';


const AUTO_LOAD_TTL_MS = 5 * 60_000;


const lastAutoLoadAt = new Map<string, number>();








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
      const key = JSON.stringify([
        session,
        fileGenerations[entry.file.name] ?? 0,
        entry.type,
        getQuotaCacheKey(entry.file),
      ]);
      const status = quotaFor(entry)?.status;

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
