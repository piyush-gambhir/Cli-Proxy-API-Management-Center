/**
 * Capacity tiles above the accounts ledger: one per provider with loaded quota.
 *
 * The headline is the limit with the smallest share left (the one that binds first), shown as
 * a sum across accounts ("195% of 200% left") with one bar segment per account, then the next
 * reset. Nothing renders until some quota has loaded.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import { useNow } from '@/hooks/useNow';
import { formatRelativeInstant } from '@/utils/quota';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { nextRecoveryMs } from '@/features/quota/resetSchedule';
import { accountLimits } from '@/ledger/limits';
import { summarizeCapacity, type CapacityInput } from '@/ledger/summary';
import type { QuotaFileEntry } from '@/features/quota/logic';
import type { QuotaCardState } from '@/features/quota/providers';
import {
  QUOTA_PROGRESS_HIGH_THRESHOLD,
  QUOTA_PROGRESS_MEDIUM_THRESHOLD,
} from '@/features/quota/components/QuotaMeter';
import styles from './CapacityTiles.module.scss';

export type CapacityTilesProps = {
  entries: QuotaFileEntry[];
  quotaFor: (entry: QuotaFileEntry) => QuotaCardState | undefined;
  resolvedTheme: ResolvedTheme;
};

const toneClass = (remaining: number) =>
  remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD
    ? styles.high
    : remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
      ? styles.medium
      : styles.low;

export function CapacityTiles({ entries, quotaFor, resolvedTheme }: CapacityTilesProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();

  const capacity = useMemo(
    () =>
      summarizeCapacity(
        entries.map((entry): CapacityInput => {
          const quota = quotaFor(entry);
          // The same limits the account rows show, aggregated by their stable ids.
          const limits = accountLimits(entry.type, quota, t, i18n.language).flatMap((limit) =>
            limit.remaining === null
              ? []
              : [{ id: limit.id, label: limit.label, remaining: limit.remaining }]
          );
          return {
            provider: entry.type,
            limits,
            // Every window counts, not just the one the chart anchors on.
            nextResetMs:
              quota?.status === 'success' ? nextRecoveryMs(entry.type, quota, now) : null,
          };
        })
      ),
    [entries, quotaFor, now, t, i18n.language]
  );

  if (capacity.length === 0) return null;

  return (
    <section className={styles.tiles} aria-label={t('ledger.capacity_label')}>
      {capacity.map(({ provider, headline, soonestResetMs }) => {
        const iconSrc = getAuthFileIcon(provider, resolvedTheme);

        return (
          <article key={provider} className={styles.tile}>
            <header className={styles.head}>
              <span
                className={styles.iconWrap}
                style={
                  isThemeSurfaceIconProvider(provider)
                    ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                    : undefined
                }
              >
                {iconSrc && <img src={iconSrc} alt="" className={styles.icon} />}
              </span>
              <span className={styles.provider}>{getTypeLabel(t, provider)}</span>
              <span className={styles.limit}>{headline.label}</span>
            </header>
            <p className={styles.figure}>
              <span className={styles.big}>{Math.round(headline.left)}%</span>
              <span className={styles.ofTotal}>
                {t('ledger.capacity_of_total', { total: Math.round(headline.total) })}
              </span>
            </p>
            <div className={styles.segments} aria-hidden="true">
              {headline.segments.map((remaining, index) => (
                <span key={index} className={styles.segment}>
                  <span
                    className={`${styles.fill} ${toneClass(remaining)}`}
                    style={{ width: `${Math.max(0, Math.min(100, remaining))}%` }}
                  />
                </span>
              ))}
            </div>
            {soonestResetMs !== null && (
              <p className={styles.meta}>
                {t('ledger.capacity_soonest', {
                  when: formatRelativeInstant(soonestResetMs, now, i18n.resolvedLanguage),
                })}
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
