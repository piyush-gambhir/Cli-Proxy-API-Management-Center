/**
 * Capacity tiles above the quota ledger: one per provider with loaded quota.
 *
 * The headline is the limit with the smallest share left (the one that binds first), shown as
 * a sum across accounts ("195% of 200% left") with one bar segment per account. Other limits
 * and the next reset follow as a quiet line. Nothing renders until some quota has loaded.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResolvedTheme } from '@/types';
import { useNow } from '@/hooks/useNow';
import { formatRelativeInstant } from '@/utils/quota';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
} from '@/features/authFiles/constants';
import { buildTimelineLane, TIMELINE_SPAN_DAYS } from '../quotaTimelineModel';
import { nextRecoveryMs } from '../resetSchedule';
import { summarizeCapacity, type CapacityInput } from '../summary';
import type { QuotaFileEntry } from '../logic';
import type { QuotaCardState } from '../providers';
import { QUOTA_PROGRESS_HIGH_THRESHOLD, QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './QuotaMeter';
import styles from './QuotaSummary.module.scss';

export type QuotaSummaryProps = {
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

export function QuotaSummary({ entries, quotaFor, resolvedTheme }: QuotaSummaryProps) {
  const { t, i18n } = useTranslation();
  const now = useNow();

  const capacity = useMemo(
    () =>
      summarizeCapacity(
        entries.map((entry): CapacityInput => {
          const quota = quotaFor(entry);
          const lane = buildTimelineLane({
            name: getQuotaCacheKey(entry.file),
            displayName: entry.file.name,
            provider: entry.type,
            quota,
            maxPeriodHours: TIMELINE_SPAN_DAYS.weekly * 24,
          });
          // Lane limits carry display text, not ids: Meta labels are i18n keys and Kimi rows
          // can arrive unlabeled, so an empty label gets its own identity instead of merging.
          const limits = lane.limits.map((limit, index) => ({
            id: limit.label || `#${index}`,
            label:
              entry.type === 'meta'
                ? t(limit.label)
                : limit.label || t('quota_management.summary_limit_fallback', { n: index + 1 }),
            remaining: limit.remaining,
          }));
          // xAI reports one shared weekly percentage on the lane rather than as limits.
          if (entry.type === 'xai' && limits.length === 0 && lane.remaining !== null) {
            limits.push({
              id: 'weekly',
              label: t('quota_management.windows_mode_weekly'),
              remaining: lane.remaining,
            });
          }
          return {
            provider: entry.type,
            limits,
            // Every window counts, not just the one the chart anchors on.
            nextResetMs: quota?.status === 'success' ? nextRecoveryMs(entry.type, quota, now) : null,
          };
        })
      ),
    [entries, quotaFor, now, t]
  );

  if (capacity.length === 0) return null;

  return (
    <section className={styles.tiles} aria-label={t('quota_management.summary_label')}>
      {capacity.map(({ provider, accounts, headline, others, soonestResetMs }) => {
        const iconSrc = getAuthFileIcon(provider, resolvedTheme);
        const meta = [
          t('quota_management.summary_accounts', { count: accounts }),
          soonestResetMs === null
            ? null
            : t('quota_management.summary_soonest', {
                when: formatRelativeInstant(soonestResetMs, now, i18n.resolvedLanguage),
              }),
          ...others.map(
            (limit) => `${limit.label} ${Math.round(limit.left)}/${Math.round(limit.total)}%`
          ),
        ].filter(Boolean);

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
                {t('quota_management.summary_of_total', { total: Math.round(headline.total) })}
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
            <p className={styles.meta}>{meta.join(' · ')}</p>
          </article>
        );
      })}
    </section>
  );
}
