/**
 * Routing, per provider: each provider's accounts in the order the proxy picks them, with why an
 * account is skipped, and Prefer / Demote to change that order. Edits stay a local draft until
 * saved together through upstream's routing writer (credential priorities, then one config patch).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useNow } from '@/hooks/useNow';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { RoutingConflictError, buildRoutingBoard, routingApi } from '@/services/api/routing';
import { apiClient } from '@/services/api/client';
import { useAuthStore, useConfigStore, useNotificationStore, useThemeStore } from '@/stores';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import type {
  RoutingBoard,
  RoutingChange,
  RoutingMember,
  RoutingPlan,
  RoutingSettings,
} from '@/types/routing';
import { getErrorMessage } from '@/utils/helpers';
import { formatRelativeInstant } from '@/utils/quota';
import { getAuthFileIcon, getTypeLabel } from '@/features/authFiles/constants';
import { activeCooldownSeconds } from '@/features/routing/logic';
import { maskEmails } from '@/ledger/maskEmail';
import { schedulerLimits } from '@/ledger/scheduler';
import { formatResetAt } from '@/ledger/time';
import { useLedgerUi } from '@/ledger/uiState';
import { useSchedulerStatus } from '@/ledger/useSchedulerStatus';
import {
  crossProviderReorders,
  demotePriority,
  groupByProvider,
  nextMemberKey,
  normalizeStrategy,
  preferPriority,
  type LedgerStrategy,
  type ProviderGroup,
} from './routingView';
import styles from './RoutingScreen.module.scss';

type LedgerSettings = Omit<RoutingSettings, 'strategy'> & { strategy: LedgerStrategy };

const STRATEGIES: LedgerStrategy[] = ['reset-soonest', 'round-robin', 'fill-first'];
const STRATEGY_KEY: Record<LedgerStrategy, string> = {
  'reset-soonest': 'reset_soonest',
  'round-robin': 'round_robin',
  'weighted-round-robin': 'weighted',
  'fill-first': 'fill_first',
};
const KNOWN_REASONS = new Set([
  'five_hour_guard',
  'no_data',
  'five_hour_exhausted',
  'five_hour_hard_limited',
  'model_window_exhausted',
  'model_window_hard_limited',
  'long_window_hard_limited',
]);

const readStrategy = (raw: unknown) => {
  const routing = (raw as { routing?: { strategy?: unknown } } | null)?.routing;
  return normalizeStrategy(routing?.strategy);
};

export function RoutingScreen() {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const connected = useAuthStore((state) => state.connectionStatus) === 'connected';
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showEmails = useLedgerUi((state) => state.showEmails);
  const scheduler = useSchedulerStatus(connected);

  const [board, setBoard] = useState<RoutingBoard | null>(null);
  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [savedStrategy, setSavedStrategy] = useState<LedgerStrategy>('round-robin');
  const [loadError, setLoadError] = useState('');
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<LedgerSettings | null>(null);
  const [saving, setSaving] = useState(false);

  // Only the latest load may apply, and never over a newer connection's state.
  const loadId = useRef(0);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const load = useCallback(async () => {
    if (!connected) return;
    const id = ++loadId.current;
    const revision = apiClient.getConnectionRevision();
    const current = () => id === loadId.current && revision === apiClient.getConnectionRevision();
    try {
      const [config, list] = await Promise.all([fetchConfig(true), routingApi.listCredentials()]);
      if (!current()) return;
      const next = buildRoutingBoard(config.raw ?? {}, list);
      const strategy = readStrategy(config.raw);
      setBoard(next);
      setFiles(list);
      setSavedStrategy(strategy);
      setPriorities({});
      setSettings({ ...next.settings, strategy });
      setLoadError('');
    } catch (error) {
      if (!current()) return;
      setLoadError(getErrorMessage(error, tRef.current('common.unknown_error')));
    }
  }, [connected, fetchConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  const emailOf = useMemo(() => {
    const map = new Map(files.map((file) => [file.name, file.email?.trim() || file.name]));
    return (member: RoutingMember) => {
      const raw =
        member.location.kind === 'credential'
          ? (map.get(member.location.name) ?? member.name)
          : member.name;
      return showEmails ? raw : maskEmails(raw);
    };
  }, [files, showEmails]);

  const groups = useMemo(
    () =>
      board ? groupByProvider(board.members, priorities, scheduler.status?.ranking ?? []) : [],
    [board, priorities, scheduler.status]
  );
  const isCooling = useCallback(
    (member: RoutingMember) => activeCooldownSeconds(member, null, now) > 0,
    [now]
  );

  /* ---------- draft and save ---------- */

  const changes = useMemo(() => {
    if (!board || !settings) return [] as RoutingChange[];
    const list: RoutingChange[] = [];
    board.members.forEach((member) => {
      const to = priorities[member.key];
      if (to !== undefined && to !== member.priority) {
        list.push({ kind: 'priority', memberKey: member.key, from: member.priority, to });
      }
    });
    const saved: LedgerSettings = { ...board.settings, strategy: savedStrategy };
    (Object.keys(saved) as Array<keyof LedgerSettings>).forEach((field) => {
      if (settings[field] !== saved[field]) {
        list.push({
          kind: 'setting',
          field,
          from: saved[field] as RoutingSettings[keyof RoutingSettings],
          to: settings[field] as RoutingSettings[keyof RoutingSettings],
        });
      }
    });
    return list;
  }, [board, settings, priorities, savedStrategy]);

  const dirty = changes.length > 0;
  // A refresh would replace the draft, so it asks first; leaving the page does the same.
  const refresh = useCallback(async () => {
    if (!dirty) return load();
    showConfirmation({
      title: t('routing.unsaved_title'),
      message: t('routing.unsaved_message'),
      confirmText: t('routing.unsaved_confirm'),
      variant: 'danger',
      onConfirm: () => load(),
    });
  }, [dirty, load, showConfirmation, t]);
  useHeaderRefresh(refresh);
  useUnsavedChangesGuard({
    shouldBlock: dirty && !saving,
    dialog: {
      title: t('routing.unsaved_title'),
      message: t('routing.unsaved_message'),
      confirmText: t('routing.unsaved_confirm'),
      cancelText: t('routing.unsaved_cancel'),
      variant: 'danger',
    },
  });
  const crossReorders = useMemo(
    () => (board ? crossProviderReorders(board.members, priorities) : 0),
    [board, priorities]
  );

  const move = (group: ProviderGroup, key: string, direction: 'up' | 'down') => {
    const next = direction === 'up' ? preferPriority(group, key) : demotePriority(group, key);
    if (next === null) return;
    setPriorities((prev) => ({ ...prev, [key]: next }));
  };

  const discard = () => {
    if (!board) return;
    setPriorities({});
    setSettings({ ...board.settings, strategy: savedStrategy });
  };

  const save = async () => {
    if (!board || changes.length === 0) return;
    const plan: RoutingPlan = { changes, priorities: {}, weights: {}, settings: {} };
    changes.forEach((change) => {
      if (change.kind === 'priority') plan.priorities[change.memberKey] = change.to;
      // reset-soonest is a proxy strategy upstream's type doesn't list; the writer passes it on.
      if (change.kind === 'setting') Object.assign(plan.settings, { [change.field]: change.to });
    });
    setSaving(true);
    try {
      const result = await routingApi.applyPlan(board, plan);
      if (!result.failed) {
        showNotification(t('routing.save_success', { count: changes.length }), 'success');
      } else if (result.failed.error instanceof RoutingConflictError) {
        showNotification(t('routing.save_conflict'), 'error');
      } else {
        showNotification(
          t('routing.save_partial', {
            name: result.failed.key,
            message: getErrorMessage(result.failed.error, t('common.unknown_error')),
          }),
          'error'
        );
      }
    } catch (error) {
      showNotification(getErrorMessage(error, t('common.unknown_error')), 'error');
    } finally {
      // Always reload: the board must show what actually landed, including after a failure.
      // Controls stay locked until then, so nothing edited mid-save is silently dropped.
      await load();
      setSaving(false);
      void scheduler.reload();
    }
  };

  const changeLabel = (change: RoutingChange) => {
    if (change.kind === 'priority') {
      const member = board?.members.find((item) => item.key === change.memberKey);
      return t(change.to > change.from ? 'ledger.routing_moved_up' : 'ledger.routing_moved_down', {
        name: member ? emailOf(member) : change.memberKey,
      });
    }
    if (change.kind === 'setting') return t(`ledger.routing_setting_${change.field}`);
    return '';
  };

  /* ---------- render ---------- */

  if (loadError && !board) {
    return (
      <p className={styles.error}>{t('ledger.routing_load_failed', { message: loadError })}</p>
    );
  }
  if (!board || !settings) return null;

  const strategy = settings.strategy;
  const strategies =
    strategy === 'weighted-round-robin' || savedStrategy === 'weighted-round-robin'
      ? [...STRATEGIES, 'weighted-round-robin' as const]
      : STRATEGIES;

  // Radio keys: arrows move the selection and focus together, wrapping at the ends.
  const onStrategyKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0 || saving) return;
    event.preventDefault();
    const index = strategies.indexOf(strategy);
    const next = strategies[(index + step + strategies.length) % strategies.length];
    setSettings({ ...settings, strategy: next });
    const radios = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios[strategies.indexOf(next)]?.focus();
  };

  return (
    <div className={styles.screen}>
      <section className={styles.strategy} aria-label={t('ledger.routing_strategy')}>
        <div
          className={styles.segmented}
          role="radiogroup"
          aria-label={t('ledger.routing_strategy')}
          onKeyDown={onStrategyKey}
        >
          {strategies.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={strategy === option}
              tabIndex={strategy === option ? 0 : -1}
              disabled={saving}
              className={`${styles.segment} ${strategy === option ? styles.segmentActive : ''}`}
              onClick={() => setSettings({ ...settings, strategy: option })}
            >
              {t(`ledger.strategy_${STRATEGY_KEY[option]}`)}
            </button>
          ))}
        </div>
        <p className={styles.hint}>{t(`ledger.strategy_hint_${STRATEGY_KEY[strategy]}`)}</p>
      </section>

      {groups.length === 0 && <p className={styles.hint}>{t('ledger.routing_empty')}</p>}

      {groups.map((group) => {
        const nextKey = strategy === 'reset-soonest' ? nextMemberKey(group, isCooling) : null;
        const icon = getAuthFileIcon(group.provider, resolvedTheme);
        return (
          <section key={group.provider} className={styles.provider}>
            <h2 className={styles.providerTitle}>
              {icon && <img src={icon} alt="" className={styles.providerIcon} />}
              {getTypeLabel(t, group.provider)}
              <span className={styles.count}>{group.members.length}</span>
            </h2>
            <ol className={styles.list}>
              {group.members.map((entry, index) => {
                const { member } = entry;
                const startsFallback = index > 0 && entry.level !== group.members[index - 1].level;
                const scheduled =
                  member.location.kind === 'credential'
                    ? scheduler.status?.accounts[member.location.name]
                    : undefined;
                const limits = scheduled ? schedulerLimits(scheduled, t) : [];
                const withReset = limits.filter((limit) => limit.resetAtMs !== null);
                const longest = withReset[withReset.length - 1];
                const cooling = isCooling(member);
                const reason = entry.ranking && !entry.ranking.usable ? entry.ranking.reason : null;
                const status = member.disabled
                  ? t('ledger.paused')
                  : cooling
                    ? t('ledger.routing_cooling')
                    : reason
                      ? t(
                          KNOWN_REASONS.has(reason)
                            ? `ledger.routing_reason_${reason}`
                            : 'ledger.routing_reason_other'
                        )
                      : null;
                const canUp = preferPriority(group, member.key) !== null;
                const canDown = demotePriority(group, member.key) !== null;
                const moved =
                  priorities[member.key] !== undefined &&
                  priorities[member.key] !== member.priority;
                return (
                  <li key={member.key} className={styles.item}>
                    {startsFallback && (
                      <p className={styles.fallback}>
                        {t('ledger.routing_fallback', { count: entry.level })}
                      </p>
                    )}
                    <div
                      className={`${styles.row} ${member.disabled ? styles.muted : ''} ${
                        moved ? styles.moved : ''
                      }`}
                    >
                      <span className={styles.position}>{index + 1}</span>
                      <span className={styles.identity}>
                        <span className={styles.name}>{emailOf(member)}</span>
                        <span className={styles.detail}>
                          {member.kind === 'credential'
                            ? limits
                                .map(
                                  (limit) =>
                                    `${limit.label} ${
                                      limit.hardLimited
                                        ? t('ledger.hard_limited')
                                        : `${Math.round(limit.remaining ?? 0)}%`
                                    }`
                                )
                                .join(' · ') || t('ledger.routing_no_reading')
                            : [t('ledger.routing_api_key'), member.detail]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                      </span>
                      <span className={styles.when}>
                        {longest?.resetAtMs && longest.resetAtMs > now && (
                          <>
                            <span>
                              {formatRelativeInstant(longest.resetAtMs, now, i18n.language)}
                            </span>
                            <span className={styles.whenAt}>
                              {formatResetAt(longest.resetAtMs, now, i18n.language)}
                            </span>
                          </>
                        )}
                      </span>
                      <span className={styles.state}>
                        {nextKey === member.key ? (
                          <span className={styles.next}>{t('ledger.routing_next')}</span>
                        ) : (
                          status && <span className={styles.skipped}>{status}</span>
                        )}
                      </span>
                      <span className={styles.moves}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => move(group, member.key, 'up')}
                          disabled={!canUp || saving}
                          data-tip={t('ledger.routing_prefer_hint')}
                          aria-label={t('ledger.routing_prefer', { name: emailOf(member) })}
                        >
                          <IconChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => move(group, member.key, 'down')}
                          disabled={!canDown || saving}
                          data-tip={t('ledger.routing_demote_hint')}
                          aria-label={t('ledger.routing_demote', { name: emailOf(member) })}
                        >
                          <IconChevronDown size={15} />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className={styles.settings} aria-label={t('ledger.routing_failover')}>
        <label className={styles.setting}>
          <span className={styles.settingText}>
            <span className={styles.settingLabel}>
              {t('ledger.routing_setting_sessionAffinity')}
            </span>
            <span className={styles.hint}>{t('ledger.routing_affinity_hint')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.sessionAffinity}
            className={styles.switch}
            disabled={saving}
            onClick={() => setSettings({ ...settings, sessionAffinity: !settings.sessionAffinity })}
          >
            <span className={styles.knob} />
          </button>
        </label>
        {(['requestRetry', 'maxRetryCredentials'] as const).map((field) => (
          <label key={field} className={styles.setting}>
            <span className={styles.settingText}>
              <span className={styles.settingLabel}>{t(`ledger.routing_setting_${field}`)}</span>
              <span className={styles.hint}>{t(`ledger.routing_${field}_hint`)}</span>
            </span>
            <input
              type="number"
              min={0}
              disabled={saving}
              className={styles.number}
              value={settings[field]}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  [field]: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                })
              }
            />
          </label>
        ))}
      </section>

      {changes.length > 0 && (
        <div className={styles.saveBar} role="region" aria-label={t('ledger.routing_review')}>
          <div className={styles.saveText}>
            <strong>{t('ledger.routing_changes', { count: changes.length })}</strong>
            <span className={styles.hint}>{changes.map(changeLabel).join(' · ')}</span>
            {crossReorders > 0 && (
              <span className={styles.warn}>
                {t('ledger.routing_cross_provider', { count: crossReorders })}
              </span>
            )}
          </div>
          <button type="button" className={styles.ghost} onClick={discard} disabled={saving}>
            {t('ledger.routing_discard')}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => void save()}
            disabled={saving}
          >
            {t('ledger.routing_save')}
          </button>
        </div>
      )}
    </div>
  );
}
