





import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconDownload,
  IconKey,
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
import { claudeResets, codexResets } from '@/ledger/resets';
import { formatDate, formatResetAt } from '@/ledger/time';
import {
  isMonthlyWindow,
  schedulerLimits,
  schedulerObservedAt,
  type SchedulerAccount,
} from '@/ledger/scheduler';
import { ResetChooser } from './ResetChooser';
import { CodexResetConfirm } from './CodexResetConfirm';
import { useCodexReset } from './useCodexReset';
import { accountCooldown, accountHealth } from './accountHealth';
import { cooldownReasonKey } from '@/features/authFiles/cooldowns';
import styles from './AccountRow.module.scss';

export type AccountRowProps = {
  file: AuthFileItem;

  entry: QuotaFileEntry | null;
  quota?: QuotaCardState;

  scheduled?: SchedulerAccount;
  resolvedTheme: ResolvedTheme;
  showEmails: boolean;
  disableControls: boolean;
  statusUpdating: boolean;
  deleting: boolean;
  resetting: boolean;
  onToggleStatus: (enabled: boolean) => void;
  onRefreshQuota: () => void;

  onResetQuota?: () => void;
  onShowModels: () => void;
  onOpenSettings: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onReauthenticate?: () => void;

  onClearCooldown?: () => void;
  clearingCooldown?: boolean;
};

const toneOf = (remaining: number | null) =>
  remaining === null
    ? ''
    : remaining >= QUOTA_PROGRESS_HIGH_THRESHOLD
      ? styles.high
      : remaining >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
        ? styles.medium
        : styles.low;


const hashName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
};
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {

  }
};


const sessionPlans = new Map<string, string>();


try {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('ledger.plan.'))
    .forEach((key) => localStorage.removeItem(key));
} catch {

}

export function AccountRow(props: AccountRowProps) {
  const {
    file,
    entry: quotaEntry,
    quota,
    scheduled,
    resolvedTheme,
    showEmails,
    disableControls,
    statusUpdating,
    deleting,
    resetting,
    onToggleStatus,
    onRefreshQuota,
    onShowModels,
    onOpenSettings,
    onDownload,
    onDelete,
    onReauthenticate,
    onClearCooldown,
    clearingCooldown = false,
  } = props;
  const { t, i18n } = useTranslation();
  const now = useNow();



  const runtimeOnly = isRuntimeOnlyAuthFile(file);
  const providerKey = normalizeProviderKey(String(file.type ?? file.provider ?? ''));
  const entry = runtimeOnly ? null : quotaEntry;
  const adapter = entry ? QUOTA_ADAPTERS[entry.type] : null;

  const enabled = !isDisabledAuthFile(file);
  const canRefresh = Boolean(entry) && !disableControls;

  const rawIdentity = file.email?.trim() || getQuotaDisplayName(file);
  const identity = showEmails ? rawIdentity : maskEmails(rawIdentity);
  const [codexConfirmOpen, setCodexConfirmOpen] = useState(false);

  const [codexChecking, setCodexChecking] = useState(false);
  const sawCodexLoading = useRef(false);
  const codexReset = useCodexReset(identity);

  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  useEffect(() => {
    if (!codexChecking) return;
    if (loading) sawCodexLoading.current = true;
    else if (sawCodexLoading.current) setCodexChecking(false);
  }, [codexChecking, loading]);
  const isClaude = entry?.type === 'claude';

  const retained = isClaude && hasClaudeUsageData(quota as ClaudeQuotaState | undefined);
  const readable = status === 'success' || retained ? { ...quota, status: 'success' } : undefined;
  const liveLimits = entry ? accountLimits(entry.type, readable, t, i18n.language) : [];


  const monthlyKey = `ledger.monthly.${hashName(file.name)}`;
  const provenMonthly = scheduled
    ? isMonthlyWindow(scheduled.weekly ?? scheduled.seven_day, schedulerObservedAt(scheduled))
    : false;
  useEffect(() => {
    if (provenMonthly) writeStored(monthlyKey, '1');
  }, [monthlyKey, provenMonthly]);
  const snapshotLimits =
    scheduled && (entry?.type === 'claude' || entry?.type === 'codex')
      ? schedulerLimits(scheduled, t, provenMonthly || readStored(monthlyKey) === '1')
      : [];
  const fromScheduler = liveLimits.length === 0 && snapshotLimits.length > 0;
  const limits = fromScheduler ? snapshotLimits : liveLimits;

  const observedRaw = fromScheduler ? schedulerObservedAt(scheduled) : null;
  const observedAt = observedRaw === null ? null : Math.min(observedRaw, now);
  const liveFacts = entry
    ? accountFacts(entry.type, readable, t)
    : { plan: null, manualResets: null };



  if (liveFacts.plan) sessionPlans.set(file.name, liveFacts.plan);
  const snapshotPlan =
    entry && scheduled?.plan
      ? accountFacts(
          entry.type,
          { status: 'success', planType: scheduled.plan } as QuotaCardState,
          t
        ).plan
      : null;
  const facts = {
    ...liveFacts,
    plan: liveFacts.plan ?? sessionPlans.get(file.name) ?? snapshotPlan,
  };
  const health = accountHealth(file, quota);
  const cooldown = accountCooldown(file, now);
  const cooldownHint = cooldown
    ? [
        ...cooldown.active.map(
          (timer) =>
            `${timer.modelKey ?? t('ledger.cooldown_whole_account')} · ${t(
              cooldownReasonKey(timer.reason)
            )} · ${formatResetAt(timer.until, now, i18n.language)}`
        ),
        t('ledger.clear_cooldown_hint'),
      ].join('\n')
    : undefined;





  const [grantReadToken, setGrantReadToken] = useState(0);
  const [grantsWanted, setGrantsWanted] = useState(false);
  const [openWhenReady, setOpenWhenReady] = useState(false);
  const claudeReset = useClaudeResetGrants(
    file,
    isClaude && grantsWanted,
    !canRefresh || resetting,
    grantReadToken,
    onRefreshQuota
  );
  const resetsLeft = isClaude ? claudeReset.count : facts.manualResets;

  const codexCredits =
    entry?.type === 'codex' && readable
      ? (readable as { rateLimitResetCredits?: unknown }).rateLimitResetCredits
      : undefined;
  const resets = isClaude
    ? claudeReset.grants.length > 0
      ? claudeResets(claudeReset.grants, now)
      : null
    : Array.isArray(codexCredits) && codexCredits.length > 0
      ? codexResets(codexCredits, now)
      : null;
  const resetsTotal = resets?.reduce((sum, reset) => sum + reset.count, 0) ?? 0;


  const codexKnown = entry?.type === 'codex' && status === 'success' && quota !== undefined;
  const showCodexReset =
    entry?.type === 'codex' &&
    Boolean(adapter?.resetQuota) &&
    (!codexKnown || Boolean(quota && adapter?.canResetQuota?.(quota)));
  const showClaudeReset = isClaude && (resetsLeft === null || resetsLeft > 0);


  const resetCount = resets ? resetsTotal : (resetsLeft ?? 0);
  const countKnown = isClaude ? resetsLeft !== null : codexKnown;



  const showResetButton =
    Boolean(isClaude ? showClaudeReset : showCodexReset) &&
    limits.length > 0 &&
    !health.authentication;


  useEffect(() => {
    if (openWhenReady && grantsWanted && !claudeReset.blocked) {
      claudeReset.openDialog();
      setOpenWhenReady(false);
    }
  }, [openWhenReady, grantsWanted, claudeReset]);
  const useReset = () => {
    if (isClaude) {
      setGrantsWanted(true);
      setOpenWhenReady(true);
      return;
    }
    setCodexConfirmOpen(true);

    setCodexChecking(true);
    sawCodexLoading.current = false;
    onRefreshQuota();
  };
  const resetHint = [
    ...(countKnown ? [] : [t('ledger.reset_hint_unknown')]),
    ...(resets ?? []).map(
      (reset) =>
        `${reset.count > 1 ? `${reset.count} × ` : ''}${t(reset.kindKey)} · ${
          reset.expiresAtMs === null
            ? t('ledger.reset_no_expiry')
            : t('ledger.reset_expires', { date: formatDate(reset.expiresAtMs, i18n.language) })
        }`
    ),
    t(isClaude ? 'ledger.reset_hint_choose' : 'ledger.reset_hint_codex'),
  ].join('\n');



  const error =
    status === 'error' && adapter
      ? quota?.errorStatus === 429
        ? t('ledger.quota_rate_limited')
        : health.authentication && quota?.errorStatus === 401
          ? null
          : t(`${adapter.i18nPrefix}.load_failed`, {
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
    enabled ? null : t('ledger.paused'),
    facts.plan,

    resetsLeft && !resets && !showResetButton
      ? t('ledger.resets_left', { count: resetsLeft })
      : null,
    observedAt !== null
      ? t('ledger.updated_ago', { when: formatRelativeInstant(observedAt, now, i18n.language) })
      : null,
  ].filter(Boolean);
  const failedLabel = failed > 0 ? t('ledger.failed_requests', { count: failed }) : null;

  const subTitle = [...factsLine, failedLabel].filter(Boolean).join(' · ') || undefined;

  return (
    <article
      className={`${styles.row} ${enabled ? '' : styles.paused} ${
        health.authentication ? styles.needsAuth : ''
      }`}
    >
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
          <span className={styles.sub} title={subTitle}>
            {factsLine.join(' · ')}
            {failedLabel && (
              <span className={styles.failed}>
                {factsLine.length > 0 ? ' · ' : ''}
                {failedLabel}
              </span>
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
              <span className={`${styles.limitValue} ${limit.hardLimited ? styles.limited : ''}`}>
                {limit.hardLimited
                  ? t('ledger.hard_limited')
                  : (limit.amount ??
                    (limit.remaining === null ? '' : `${Math.round(limit.remaining)}%`))}
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
                <span>{formatRelativeInstant(limit.resetAtMs, now, i18n.language)}</span>
                <span className={styles.resetAt}>
                  {formatResetAt(limit.resetAtMs, now, i18n.language)}
                </span>
              </span>
            )}
          </div>
        ))}
        {showResetButton && (
          <button
            type="button"
            className={styles.textButton}
            data-tip={resetHint}
            aria-haspopup={isClaude ? 'dialog' : undefined}
            onClick={useReset}
            disabled={isClaude ? claudeReset.busy : !canRefresh || resetting || codexReset.busy}
          >
            {t(
              isClaude && claudeReset.buttonLabel === 'retry'
                ? 'claude_reset.retry'
                : 'ledger.use_reset'
            )}
            {countKnown && <span className={styles.count}>{resetCount}</span>}
          </button>
        )}
        {health.authentication && (

          <p className={styles.authAlert} role="alert">
            <IconAlertTriangle size={14} aria-hidden="true" />
            {t(`ledger.auth_${health.authentication}`)}
          </p>
        )}
        {error && (

          <p className={fromScheduler ? styles.stale : styles.error} role="alert">
            {error}
          </p>
        )}
        {cooldown && (

          <p className={cooldown.accountUntil !== null ? styles.error : styles.stale}>
            {cooldown.accountUntil !== null
              ? t('ledger.cooldown_account', {
                  when: formatRelativeInstant(cooldown.accountUntil, now, i18n.language),
                })
              : t('ledger.cooldown_models', {
                  count: cooldown.modelCount,
                  when: formatRelativeInstant(cooldown.modelsUntil ?? now, now, i18n.language),
                })}
            {onClearCooldown && (
              <button
                type="button"
                className={styles.inlineButton}
                onClick={onClearCooldown}
                disabled={disableControls || clearingCooldown}
                data-tip={cooldownHint}
              >
                {t('ledger.clear_cooldown')}
              </button>
            )}
          </p>
        )}
        {(entry?.type === 'claude' || entry?.type === 'codex') &&
          limits.length === 0 &&
          !error &&
          !loading &&
          !health.authentication && <p className={styles.stale}>{t('ledger.snapshot_pending')}</p>}
        {retained && status !== 'success' && (
          <p className={styles.stale}>{t('ledger.quota_stale')}</p>
        )}
      </div>

      <span className={styles.more}>
        {(!runtimeOnly || providerKey === 'aistudio') && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onShowModels}
            disabled={disableControls}
            data-tip={t('ledger.models_hint')}
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
              data-tip={t('ledger.settings_hint')}
              aria-label={t('ledger.settings')}
            >
              <IconSettings size={15} />
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={onDownload}
              disabled={disableControls}
              data-tip={t('ledger.download_hint')}
              aria-label={t('ledger.download')}
            >
              <IconDownload size={15} />
            </button>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.danger}`}
              onClick={onDelete}
              disabled={disableControls || deleting}
              data-tip={t('ledger.delete_hint')}
              aria-label={t('ledger.delete')}
            >
              <IconTrash2 size={15} />
            </button>
          </>
        )}
      </span>
      <div className={styles.actions}>
        {                                                                        }
        {onReauthenticate &&
          (health.authentication ? (
            <button
              type="button"
              className={`${styles.textButton} ${styles.reauthUrgent}`}
              onClick={onReauthenticate}
              disabled={disableControls || deleting || statusUpdating}
              aria-label={t('ledger.reauthenticate_account', { name: identity })}
            >
              {t('ledger.reauthenticate')}
            </button>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onReauthenticate}
              disabled={disableControls || deleting || statusUpdating}
              data-tip={t('ledger.reauthenticate_hint')}
              aria-label={t('ledger.reauthenticate_account', { name: identity })}
            >
              <IconKey size={15} />
            </button>
          ))}
        {entry && (
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              onRefreshQuota();
              if (isClaude && grantsWanted) setGrantReadToken((value) => value + 1);
            }}
            disabled={isQuotaRefreshDisabled(canRefresh, loading, resetting || claudeReset.busy)}
            data-tip={t('ledger.refresh_hint')}
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
      {adapter?.resetQuota && !isClaude && (
        <CodexResetConfirm
          open={codexConfirmOpen}
          name={identity}
          resets={resets}
          count={resetCount}
          checking={codexChecking}
          failed={!codexChecking && status !== 'success'}
          busy={codexReset.busy}
          onClose={() => setCodexConfirmOpen(false)}
          onConfirm={() => {
            void codexReset.reset(file, adapter).then(() => setCodexConfirmOpen(false));
          }}
        />
      )}
      {isClaude && (
        <ResetChooser
          open={claudeReset.open}
          grants={claudeReset.grants}
          selected={claudeReset.selected}
          canRedeemGrant={claudeReset.canRedeemGrant}
          onSelect={claudeReset.selectGrant}
          busy={claudeReset.busy}
          loading={claudeReset.loading}
          pendingGrantId={claudeReset.pendingGrantId}
          message={claudeReset.message}
          name={identity}
          onConfirm={() => void claudeReset.confirm()}
          onClose={claudeReset.closeDialog}
        />
      )}
    </article>
  );
}
