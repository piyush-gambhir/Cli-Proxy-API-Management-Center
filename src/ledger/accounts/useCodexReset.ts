/**
 * Spends one Codex reset credit for an account. Same steps as upstream's useQuotaActions.resetQuota
 * (adapter.resetQuota, then commit the fresh quota only if the cache generation still matches),
 * minus its built-in confirmation: the ledger shows its own confirm dialog first.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  captureQuotaCacheGeneration,
  commitIfQuotaCacheCurrent,
  useNotificationStore,
} from '@/stores';
import { getQuotaSetter, type QuotaAdapter } from '@/features/quota/providers';
import type { AuthFileItem } from '@/types';
import { getQuotaCacheKey } from '@/utils/quota/identity';

export function useCodexReset(name: string) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(
    async (file: AuthFileItem, adapter: QuotaAdapter): Promise<boolean> => {
      const resetQuota = adapter.resetQuota;
      if (!resetQuota || busy) return false;
      const cacheKey = getQuotaCacheKey(file);
      const cacheGeneration = captureQuotaCacheGeneration(file.name);
      const setQuota = getQuotaSetter(adapter);
      setBusy(true);
      try {
        const data = await resetQuota(file, t);
        commitIfQuotaCacheCurrent(cacheGeneration, () => {
          setQuota((prev) => ({ ...prev, [cacheKey]: adapter.buildSuccessState(data) }));
          showNotification(t('codex_quota.reset_success', { name }), 'success');
        });
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('common.unknown_error');
        commitIfQuotaCacheCurrent(cacheGeneration, () => {
          showNotification(t('codex_quota.reset_failed', { name, message }), 'error');
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, name, showNotification, t]
  );

  return { busy, reset };
}
