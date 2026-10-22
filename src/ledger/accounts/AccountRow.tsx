/**
 * One account: who it is, how much of each limit is left and when it resets, and its actions.
 * Every provider renders the same way (see ../limits.ts); upstream's per-provider bodies are
 * not used here.
 */

import { useTranslation } from 'react-i18next';
import {
  IconDownload,
  IconModelCluster,
  IconRefreshCw,
  IconSettings,
  IconTrash2,
} from '@/components/ui/icons';
import { useNow } from '@/hooks/useNow';
import type { AuthFileItem, ClaudeQuotaState, ResolvedTheme } from '@/types';
import { formatRelativeInstant, resolveQuotaErrorMessage } from '@/utils/quota';
import { getQuotaDisplayName } from '@/utils/quota/identity';
import { isDisabledAuthFile } from '@/utils/quota/validators';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  isThemeSurfaceIconProvider,
  normalizeProviderKey,
} from '@/features/authFiles/constants';
import {
  QUOTA_PROGRESS_HIGH_THRESHOLD,
  QUOTA_PROGRESS_MEDIUM_THRESHOLD,
} from '@/features/quota/components/QuotaMeter';
import { QUOTA_ADAPTERS, type QuotaCardState } from '@/features/quota/providers';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '@/features/quota/logic';
import { useClaudeResetGrants } from '@/features/quota/providers/claude/ClaudeResetGrants';
import { hasClaudeUsageData } from '@/features/quota/providers/claude/data';
import { accountFacts, accountLimits } from '@/ledger/limits';
import { maskEmails } from '@/ledger/maskEmail';
import styles from './AccountRow.module.scss';

export type AccountRowProps = {
  file: AuthFileItem;
  /** Null when the provider exposes no quota data. */
  entry: QuotaFileEntry | null;
  quota?: QuotaCardState;
  resolvedTheme: ResolvedTheme;
  showEmails: boolean;
  disableControls: boolean;
  statusUpdating: boolean;
  deleting: boolean;
  resetting: boolean;
  onToggleStatus: (enabled: boolean) => void;
  onRefreshQuota: () => void;
  onResetQuota: () => void;
  onShowModels: () => void;
  onOpenSettings: () => void;
  onDownload: () => void;
  onDelete: () => void;
};

const toneOf = (remaining: number | null) =>
  remaining === null
    ? ''
    : remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD
      ? styles.high
      : remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
        ? styles.medium
        : styles.low;

export function AccountRow(props: AccountRowProps) {
  const {
    file,
    entry: quotaEntry,
    quota,
    resolvedTheme,
    showEmails,
    disableControls,
    statusUpdating,
    deleting,
    resetting,
    onToggleStatus,
    onRefreshQuota,
    onResetQuota,
    onShowModels,
    onOpenSettings,
    onDownload,
    onDelete,
  } = props;
  const { t, i18n } = useTranslation();
  const now = useNow();

  // Same gating as upstream's AuthFileCard: runtime-only credentials have no file to toggle,
  // download, edit or delete, and no quota; only AI Studio still lists models.
  const runtimeOnly = isRuntimeOnlyAuthFile(file);
  const providerKey = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
  const entry = runtimeOnly ? null : quotaEntry;
  const adapter = entry ? QUOTA_ADAPTERS[entry.type] : null;
  const enabled = !isDisabledAuthFile(file);
  const canRefresh = Boolean(entry) && enabled && !disableControls;

  const rawIdentity = file.email?.trim() || getQuotaDisplayName(file);
  const identity = showEmails ? rawIdentity : maskEmails(rawIdentity);

  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  const isClaude = entry?.type === 'claude';
  // Claude keeps its last good snapshot through a failed or running refresh.
  const retained = isClaude && hasClaudeUsageData(quota as ClaudeQuotaState | undefined);
  const readable = status === 'success' || retained ? { ...quota, status: 'success' } : undefined;
  const limits = entry && enabled ? accountLimits(entry.type, readable, t, i18n.language) : [];
  const facts = entry ? accountFacts(entry.type, readable, t) : { plan: null, manualResets: null };

  const claudeReset = useClaudeResetGrants(
    file,
    isClaude && status !== 'idle',
    !canRefresh || loading || resetting,
    quota,
    onRefreshQuota
  );
  const resetsLeft = isClaude ? claudeReset.count : facts.manualResets;
  const showCodexReset =
    status === 'success' &&
    quota !== undefined &&
    Boolean(adapter?.resetQuota) &&
    Boolean(adapter?.canResetQuota?.(quota));
  const showClaudeReset = isClaude && enabled && (resetsLeft ?? 0) > 0 && !claudeReset.blocked;

  const error =
    status === 'error' && adapter
      ? t(`${adapter.i18nPrefix}.load_failed`, {
          message: resolveQuotaErrorMessage(
            t,
            quota?.errorStatus,
            quota?.error || t('common.unknown_error')
          ),
        })
      : isClaude && claudeReset.message
        ? t(`claude_reset.${claudeReset.message}`)
        : null;

  const iconType =
    entry?.type === 'plugin'
      ? String(
          file.quotaProvider ?? file['quota_provider'] ?? file.provider ?? file.type ?? 'plugin'
        )
      : String(entry?.type ?? file.provider ?? file.type ?? '');
  const iconSrc = getAuthFileIcon(iconType, resolvedTheme);
  const typeLabel = getTypeLabel(t, iconType);
  const failed = file.failureCount ?? 0;

  const factsLine = [
    facts.plan,
    resetsLeft ? t('ledger.resets_left', { count: resetsLeft }) : null,
  ].filter(Boolean);

  return (
    <article className={`${styles.row} ${enabled ? '' : styles.paused}`}>
      <div className={styles.who}>
        <span
          className={styles.icon}
          title={typeLabel}
          style={
            isThemeSurfaceIconProvider(iconType)
              ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
              : undefined
          }
        >
          {iconSrc ? <img src={iconSrc} alt="" /> : typeLabel.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.identity}>
          <span className={styles.name}>{identity}</span>
          <span className={styles.sub}>
            {!enabled ? (
              t('ledger.paused')
            ) : (
              <>
                {factsLine.join(' · ')}
                {failed > 0 && (
                  <span className={styles.failed}>
                    {factsLine.length > 0 ? ' · ' : ''}
                    {t('ledger.failed_requests', { count: failed })}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
      </div>

      <div className={styles.limits}>
        {limits.map((limit) => (
          <div key={limit.id} className={styles.limit}>
            <span className={styles.limitTop}>
              <span className={styles.limitLabel} title={limit.label}>
                {limit.label}
              </span>
              <span className={styles.limitValue}>
                {limit.amount ??
                  (limit.remaining === null ? '' : `${Math.round(limit.remaining)}%`)}
              </span>
            </span>
            <span className={styles.track} aria-hidden="true">
              <span
                className={`${styles.fill} ${toneOf(limit.remaining)}`}
                style={{ width: `${limit.remaining ?? 0}%` }}
              />
            </span>
            {limit.resetAtMs !== null && limit.resetAtMs > now && (
              <span className={styles.reset}>
                {formatRelativeInstant(limit.resetAtMs, now, i18n.language)}
              </span>
            )}
          </div>
        ))}
        {showClaudeReset && (
          <button
            type="button"
            className={styles.textButton}
            disabled={claudeReset.busy}
            onClick={claudeReset.confirm}
          >
            {t(`claude_reset.${claudeReset.buttonLabel}`)}
          </button>
        )}
        {showCodexReset && (
          <button
            type="button"
            className={styles.textButton}
            onClick={onResetQuota}
            disabled={!canRefresh || loading || resetting}
          >
            {t('codex_quota.reset_button')}
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <span className={styles.more}>
        {(!runtimeOnly || providerKey === 'aistudio') && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onShowModels}
            disabled={disableControls}
            title={t('ledger.models')}
            aria-label={t('ledger.models')}
          >
            <IconModelCluster size={15} />
          </button>
        )}
        {!runtimeOnly && (
          <>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onOpenSettings}
              disabled={disableControls}
              title={t('ledger.settings')}
              aria-label={t('ledger.settings')}
            >
              <IconSettings size={15} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onDownload}
              disabled={disableControls}
              title={t('ledger.download')}
              aria-label={t('ledger.download')}
            >
              <IconDownload size={15} />
            </button>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.danger}`}
              onClick={onDelete}
              disabled={disableControls || deleting}
              title={t('ledger.delete')}
              aria-label={t('ledger.delete')}
            >
              <IconTrash2 size={15} />
            </button>
          </>
        )}
      </span>
      <div className={styles.actions}>
        {entry && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onRefreshQuota}
            disabled={isQuotaRefreshDisabled(canRefresh, loading, resetting || claudeReset.busy)}
            title={t('ledger.refresh')}
            aria-label={t('ledger.refresh')}
          >
            <IconRefreshCw size={15} className={loading ? styles.spinning : undefined} />
          </button>
        )}
        {!runtimeOnly && (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t('ledger.toggle_enabled', { name: identity })}
            className={styles.switch}
            onClick={() => onToggleStatus(!enabled)}
            disabled={disableControls || statusUpdating}
          >
            <span className={styles.knob} />
          </button>
        )}
      </div>
    </article>
  );
}
