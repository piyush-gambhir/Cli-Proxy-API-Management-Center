/**
 * Accounts: the ledger shell's home. Every credential with what is left on it, its controls, and
 * adding new ones. Reuses upstream's data hooks and quota store; the presentation is ours.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefreshCw,
  IconSearch,
  IconX,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useInterval } from '@/hooks/useInterval';
import { useAuthStore, useNotificationStore, useQuotaStore, useThemeStore } from '@/stores';
import type { AuthFileItem, ResolvedTheme } from '@/types';
import { copyToClipboard } from '@/utils/clipboard';
import { getQuotaCacheKey } from '@/utils/quota/identity';
import { isDisabledAuthFile } from '@/utils/quota/validators';
import { invalidateAuthFileDerivedCaches } from '@/features/authFiles/cacheInvalidation';
import { AuthFileDetailsSheet } from '@/features/authFiles/components/AuthFileDetailsSheet';
import { AuthFileModelsModal } from '@/features/authFiles/components/AuthFileModelsModal';
import {
  getTypeLabel,
  isRuntimeOnlyAuthFile,
  normalizeProviderKey,
} from '@/features/authFiles/constants';
import { useAuthFilesData } from '@/features/authFiles/hooks/useAuthFilesData';
import { useAuthFilesModels } from '@/features/authFiles/hooks/useAuthFilesModels';
import { useAuthFilesOauth } from '@/features/authFiles/hooks/useAuthFilesOauth';
import { useAuthFilesPrefixProxyEditor } from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { buildWildcardSearch, matchesAuthFileSearch } from '@/features/authFiles/logic';
import { getAuthFileRefreshKey } from '@/features/authFiles/manualRefresh';
import { QUOTA_TAB_ORDER } from '@/features/quota/constants';
import { resolveQuotaProviderType, type QuotaFileEntry } from '@/features/quota/logic';
import { QUOTA_ADAPTERS, getQuotaSetter, type QuotaCardState } from '@/features/quota/providers';
import type { QuotaProviderType } from '@/features/quota/providers/types';
import { useQuotaActions } from '@/features/quota/hooks/useQuotaActions';
import { useQuotaBatchLoader } from '@/features/quota/hooks/useQuotaBatchLoader';
import { maskEmails } from '@/ledger/maskEmail';
import { useLedgerUi } from '@/ledger/uiState';
import { useQuotaAutoLoad } from '@/ledger/useQuotaAutoLoad';
import { AccountRow } from './AccountRow';
import { AddAccountSheet } from './AddAccountSheet';
import { CapacityTiles } from './CapacityTiles';
import styles from './AccountsScreen.module.scss';

/** Search earns its space only once the list is long. */
const SEARCH_MIN_ACCOUNTS = 9;

const providerKeyOf = (file: AuthFileItem) =>
  normalizeProviderKey(String(file.type ?? file.provider ?? ''));

/** Providers with quota first, in upstream's tab order, then everything else alphabetically. */
const providerRank = (key: string) => {
  const index = QUOTA_TAB_ORDER.indexOf(key as QuotaProviderType);
  return index === -1 ? QUOTA_TAB_ORDER.length : index;
};

export function AccountsScreen() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const resolvedTheme: ResolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showEmails = useLedgerUi((state) => state.showEmails);
  const toggleEmails = useLedgerUi((state) => state.toggleEmails);

  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const disableControls = connectionStatus !== 'connected';

  /* ---------- account data and actions (upstream hooks) ---------- */

  const {
    modelsModalOpen,
    modelsLoading,
    modelsList,
    modelsFileName,
    modelsFileType,
    modelsError,
    showModels,
    closeModelsModal,
    invalidateModels,
  } = useAuthFilesModels();

  const invalidateDerivedCaches = useCallback(
    (names?: string[]) => invalidateAuthFileDerivedCaches(invalidateModels, names),
    [invalidateModels]
  );

  const {
    files,
    loading,
    error,
    uploading,
    deleting,
    statusUpdating,
    fileInputRef,
    loadFiles,
    handleUploadClick,
    handleFileChange,
    handleDelete,
    handleDownload,
    handleStatusToggle,
  } = useAuthFilesData({ onFilesMutated: invalidateDerivedCaches });

  // Only the excluded-model list is used here: the models dialog marks excluded models.
  const { excluded, loadExcluded } = useAuthFilesOauth({ viewMode: 'list', files });

  const {
    prefixProxyEditor,
    prefixProxyUpdatedText,
    prefixProxyDirty,
    openPrefixProxyEditor,
    closePrefixProxyEditor,
    handlePrefixProxyChange,
    handlePrefixProxySave,
  } = useAuthFilesPrefixProxyEditor({
    disableControls,
    loadFiles,
    onFilesMutated: invalidateDerivedCaches,
  });

  /* ---------- quota (upstream store, loader and actions) ---------- */

  const antigravityQuota = useQuotaStore((state) => state.antigravityQuota);
  const claudeQuota = useQuotaStore((state) => state.claudeQuota);
  const codexQuota = useQuotaStore((state) => state.codexQuota);
  const devinQuota = useQuotaStore((state) => state.devinQuota);
  const kimiQuota = useQuotaStore((state) => state.kimiQuota);
  const metaQuota = useQuotaStore((state) => state.metaQuota);
  const pluginQuota = useQuotaStore((state) => state.pluginQuota);
  const xaiQuota = useQuotaStore((state) => state.xaiQuota);
  const quotaByType = useMemo(
    () =>
      ({
        antigravity: antigravityQuota,
        claude: claudeQuota,
        codex: codexQuota,
        devin: devinQuota,
        kimi: kimiQuota,
        meta: metaQuota,
        plugin: pluginQuota,
        xai: xaiQuota,
      }) as unknown as Record<QuotaProviderType, Record<string, QuotaCardState>>,
    [
      antigravityQuota,
      claudeQuota,
      codexQuota,
      devinQuota,
      kimiQuota,
      metaQuota,
      pluginQuota,
      xaiQuota,
    ]
  );
  const getQuota = useCallback(
    (entry: QuotaFileEntry): QuotaCardState | undefined =>
      quotaByType[entry.type][getQuotaCacheKey(entry.file)],
    [quotaByType]
  );

  const { batchLoading, loadQuota } = useQuotaBatchLoader();
  const { resettingQuotaName, refreshQuota, resetQuota } = useQuotaActions(disableControls);

  /* ---------- loading ---------- */

  const reloadAll = useCallback(async () => {
    await Promise.all([loadFiles({ background: true }), loadExcluded()]);
  }, [loadFiles, loadExcluded]);

  useHeaderRefresh(reloadAll);

  useEffect(() => {
    void loadFiles();
    loadExcluded();
  }, [loadFiles, loadExcluded]);

  useInterval(() => {
    void loadFiles({ background: true }).catch(() => {});
  }, 240_000);

  /* ---------- rows ---------- */

  const rows = useMemo(
    () =>
      files.map((file) => {
        // Upstream's quota filters skip disabled files; resolve as enabled so a disabled row keeps
        // its quota type and reads "paused" instead of "no quota".
        const quotaType = resolveQuotaProviderType({ ...file, disabled: false });
        return {
          file,
          provider: providerKeyOf(file),
          // Runtime-only credentials have no file to read quota for, same as upstream's cards.
          entry:
            quotaType && !isRuntimeOnlyAuthFile(file)
              ? ({ file, type: quotaType } as QuotaFileEntry)
              : null,
        };
      }),
    [files]
  );

  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((row) => {
      counts[row.provider] = (counts[row.provider] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const wildcard = useMemo(() => buildWildcardSearch(search.trim()), [search]);
  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => matchesAuthFileSearch(row.file, search.trim(), wildcard))
        .sort(
          (a, b) =>
            providerRank(a.provider) - providerRank(b.provider) ||
            a.provider.localeCompare(b.provider) ||
            Number(isDisabledAuthFile(a.file)) - Number(isDisabledAuthFile(b.file)) ||
            (a.file.email ?? a.file.name).localeCompare(b.file.email ?? b.file.name)
        ),
    [rows, search, wildcard]
  );

  const enabledEntries = useCallback(
    (list: typeof rows) =>
      list
        .map((row) => row.entry)
        .filter(
          (entry): entry is QuotaFileEntry => entry !== null && !isDisabledAuthFile(entry.file)
        ),
    []
  );
  const visibleEntries = useMemo(() => enabledEntries(visibleRows), [enabledEntries, visibleRows]);
  const allEntries = useMemo(() => enabledEntries(rows), [enabledEntries, rows]);

  useQuotaAutoLoad(
    visibleEntries,
    disableControls || loading || batchLoading || Boolean(error),
    loadQuota,
    getQuota
  );

  // After each successful listing, drop cached quota for credentials that are gone, as upstream's
  // quota page does, so a replacement under the same filename never shows the old numbers.
  // `files` only changes identity when a listing succeeds.
  const initialFiles = useRef(files);
  useEffect(() => {
    if (files === initialFiles.current) return;
    const survivors = new Map<QuotaProviderType, Set<string>>(
      QUOTA_TAB_ORDER.map((type) => [type, new Set<string>()])
    );
    allEntries.forEach((entry) => survivors.get(entry.type)?.add(getQuotaCacheKey(entry.file)));
    QUOTA_TAB_ORDER.forEach((type) => {
      const keep = survivors.get(type) ?? new Set<string>();
      getQuotaSetter(QUOTA_ADAPTERS[type])((prev) => {
        const stale = Object.keys(prev).filter((key) => !keep.has(key));
        if (stale.length === 0) return prev;
        const next = { ...prev };
        stale.forEach((key) => delete next[key]);
        return next;
      });
    });
  }, [files, allEntries]);

  const { enabledCount, attentionCount } = useMemo(
    () => ({
      enabledCount: rows.filter((row) => !isDisabledAuthFile(row.file)).length,
      attentionCount: allEntries.filter((entry) => getQuota(entry)?.status === 'error').length,
    }),
    [allEntries, getQuota, rows]
  );

  /* ---------- handlers ---------- */

  const refreshQuotaAll = useCallback(() => {
    void loadQuota(visibleEntries);
  }, [loadQuota, visibleEntries]);

  const reloadFiles = useCallback(() => {
    void loadFiles({ background: true });
  }, [loadFiles]);

  const closeAddAccount = useCallback(() => {
    setAddOpen(false);
    reloadFiles();
  }, [reloadFiles]);

  const copyTextWithNotification = useCallback(
    async (text: string) => {
      const copied = await copyToClipboard(text);
      showNotification(
        copied
          ? t('notification.link_copied', { defaultValue: 'Copied to clipboard' })
          : t('notification.copy_failed', { defaultValue: 'Copy failed' }),
        copied ? 'success' : 'error'
      );
    },
    [showNotification, t]
  );

  /* ---------- render ---------- */

  return (
    <div className={styles.page}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className={styles.fileInput}
        onChange={handleFileChange}
      />

      <header className={styles.header}>
        <div className={styles.copy}>
          <h1 className={styles.title}>{t('ledger.accounts_title')}</h1>
          <p className={styles.meta}>
            {t('ledger.meta_accounts', { count: rows.length })}
            {enabledCount < rows.length &&
              ` · ${t('ledger.meta_enabled', { count: enabledCount })}`}
            {attentionCount > 0 && (
              <span className={styles.attention}>
                {' · '}
                {t('ledger.meta_attention', { count: attentionCount })}
              </span>
            )}
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconAction}
            onClick={toggleEmails}
            aria-pressed={showEmails}
            title={t(showEmails ? 'ledger.hide_emails' : 'ledger.show_emails')}
            aria-label={t(showEmails ? 'ledger.hide_emails' : 'ledger.show_emails')}
          >
            {showEmails ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </button>
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={refreshQuotaAll}
            disabled={disableControls || batchLoading}
          >
            <IconRefreshCw size={14} className={batchLoading ? styles.spinning : undefined} />
            {t('ledger.refresh_quota')}
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => setAddOpen(true)}
            disabled={disableControls}
          >
            <IconPlus size={14} />
            {t('ledger.add_account')}
          </button>
        </div>
      </header>

      {rows.length >= SEARCH_MIN_ACCOUNTS && (
        <div className={styles.search}>
          <IconSearch size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('ledger.search_placeholder')}
            aria-label={t('ledger.search_placeholder')}
          />
          {search && (
            <button
              type="button"
              className={styles.clearSearch}
              aria-label={t('ledger.clear_search')}
              onClick={() => setSearch('')}
            >
              <IconX size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <CapacityTiles entries={visibleEntries} quotaFor={getQuota} resolvedTheme={resolvedTheme} />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {visibleRows.length === 0 && !loading ? (
        <p className={styles.empty}>
          {search.trim() ? t('ledger.search_empty') : t('ledger.empty_title')}
        </p>
      ) : (
        <div className={styles.list}>
          {visibleRows.map((row, index) => {
            const startsGroup = index === 0 || visibleRows[index - 1].provider !== row.provider;
            const cacheKey = getQuotaCacheKey(row.file);
            return (
              <Fragment key={cacheKey}>
                {startsGroup && (
                  <h2 className={styles.groupTitle}>
                    {getTypeLabel(t, row.provider)}
                    <span className={styles.groupCount}>{providerCounts[row.provider] ?? 0}</span>
                  </h2>
                )}
                <AccountRow
                  file={row.file}
                  entry={row.entry}
                  quota={row.entry ? getQuota(row.entry) : undefined}
                  resolvedTheme={resolvedTheme}
                  showEmails={showEmails}
                  disableControls={disableControls}
                  statusUpdating={statusUpdating[getAuthFileRefreshKey(row.file)] === true}
                  deleting={deleting === row.file.name}
                  resetting={resettingQuotaName === cacheKey}
                  onToggleStatus={(enabled) => void handleStatusToggle(row.file, enabled)}
                  onRefreshQuota={() => {
                    if (row.entry) void refreshQuota(row.file, QUOTA_ADAPTERS[row.entry.type]);
                  }}
                  onResetQuota={() => {
                    if (row.entry) resetQuota(row.file, QUOTA_ADAPTERS[row.entry.type]);
                  }}
                  onShowModels={() => showModels(row.file)}
                  onOpenSettings={() => openPrefixProxyEditor(row.file)}
                  onDownload={() => handleDownload(row.file.name)}
                  onDelete={() => handleDelete(row.file.name)}
                />
              </Fragment>
            );
          })}
        </div>
      )}

      <AuthFileModelsModal
        open={modelsModalOpen}
        fileName={showEmails ? modelsFileName : maskEmails(modelsFileName)}
        fileType={modelsFileType}
        loading={modelsLoading}
        error={modelsError}
        models={modelsList}
        excluded={excluded}
        onClose={closeModelsModal}
        onCopyText={copyTextWithNotification}
      />

      <AuthFileDetailsSheet
        disableControls={disableControls}
        editor={prefixProxyEditor}
        updatedText={prefixProxyUpdatedText}
        dirty={prefixProxyDirty}
        onClose={closePrefixProxyEditor}
        onCopyText={copyTextWithNotification}
        onSave={handlePrefixProxySave}
        onChange={handlePrefixProxyChange}
      />

      <AddAccountSheet
        open={addOpen}
        uploading={uploading}
        disableControls={disableControls}
        onClose={closeAddAccount}
        onUpload={handleUploadClick}
        onAdded={reloadFiles}
      />
    </div>
  );
}
