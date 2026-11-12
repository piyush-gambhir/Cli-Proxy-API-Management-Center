/**
 * Account settings: every field upstream's AuthFileDetailsSheet edits, driven by the same
 * useAuthFilesPrefixProxyEditor state and handlers (validation, dirty diff, save path), with our
 * presentation: the account as the title, grouped compact rows, and the raw file tucked into a
 * closed disclosure whose secrets stay masked until revealed.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet/Sheet';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconChevronDown, IconEye, IconEyeOff } from '@/components/ui/icons';
import { useNotificationStore, useQuotaStore, useThemeStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import { getQuotaCacheKey, getQuotaDisplayName } from '@/utils/quota/identity';
import { MAX_CREDENTIAL_WEIGHT } from '@/utils/credentialWeight';
import type {
  PrefixProxyEditorField,
  PrefixProxyEditorFieldValue,
  PrefixProxyEditorState,
} from '@/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
  supportsAuthFileSiwc,
  supportsAuthFileUsingApi,
  supportsAuthFileWebsockets,
} from '@/features/authFiles/constants';
import {
  credentialPolicyError,
  readCredentialPolicy,
  type CredentialPolicyDraft,
  type PolicyMode,
} from '@/features/authFiles/credentialPolicy';
import { AuthFileExcludedModelsField } from '@/features/authFiles/components/AuthFileExcludedModelsField';
import { ErrorRulesEditor } from '@/features/providers/sheets/forms/ErrorRulesEditor';
import { ModelEntriesEditor } from '@/features/providers/sheets/forms/ModelEntriesEditor';
import { resolveQuotaProviderType } from '@/features/quota/logic';
import type { QuotaCardState } from '@/features/quota/providers';
import { accountFacts } from '@/ledger/limits';
import { maskEmails } from '@/ledger/maskEmail';
import { useLedgerUi } from '@/ledger/uiState';
import { formatRawText } from './accountSheetSecrets';
import styles from './AccountSheet.module.scss';

/** Fields the API layer adds to each listed file; the raw view shows only what the backend sent. */
const DERIVED_INFO_KEYS = [
  'successCount',
  'failureCount',
  'recentRequests',
  'runtimeOnly',
  'authIndex',
  'statusMessage',
  'modified',
  'projectId',
];

export type AccountSheetProps = {
  disableControls: boolean;
  editor: PrefixProxyEditorState | null;
  updatedText: string;
  dirty: boolean;
  onClose: () => void;
  onCopyText: (text: string) => void | Promise<void>;
  onSave: () => void;
  onChange: (field: PrefixProxyEditorField, value: PrefixProxyEditorFieldValue) => void;
};

const parseFile = (text: string): AuthFileItem | null => {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AuthFileItem)
      : null;
  } catch {
    return null;
  }
};

export function AccountSheet(props: AccountSheetProps) {
  const { disableControls, editor, updatedText, dirty, onClose, onCopyText, onSave, onChange } =
    props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const showEmails = useLedgerUi((state) => state.showEmails);
  const saving = editor?.saving === true;

  // Sheet restarts its close animation timer whenever onClose changes identity, and the screen
  // passes a fresh function on every render, so a re-render mid-close (after "Discard changes")
  // would cancel the close. A stable wrapper keeps Escape, the overlay and × reliable.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const closeSheet = useCallback(() => onCloseRef.current(), []);

  // The file as the list knew it: identity, provider and quota plan for the header.
  const file = useMemo(() => parseFile(editor?.fileInfoText ?? ''), [editor?.fileInfoText]);
  const quotaType = file ? resolveQuotaProviderType({ ...file, disabled: false }) : null;
  const quota = useQuotaStore((state) =>
    file && quotaType
      ? (state as unknown as Record<string, Record<string, QuotaCardState> | undefined>)[
          `${quotaType}Quota`
        ]?.[getQuotaCacheKey(file)]
      : undefined
  );
  const plan =
    quotaType && quota?.status === 'success' ? accountFacts(quotaType, quota, t).plan : null;

  const rawIdentity = file ? file.email?.trim() || getQuotaDisplayName(file) : '';
  const identity = rawIdentity || editor?.fileName || '';
  const title = showEmails ? identity : maskEmails(identity);
  const iconType = String(file?.provider ?? file?.type ?? editor?.providerKey ?? '');
  const iconSrc = iconType ? getAuthFileIcon(iconType, resolvedTheme) : null;
  const typeLabel = iconType ? getTypeLabel(t, iconType) : '';
  const subtitle = [typeLabel, plan].filter(Boolean).join(' · ');

  const policyError = credentialPolicyError(editor?.policy);
  const blocked = Boolean(
    (editor?.headersTouched && editor.headersError) || editor?.weightError || policyError
  );

  // Upstream's dirty flag drops to false while a field is invalid (no patch can be built), which
  // would let Escape discard those edits silently; an invalid form counts as unsaved here.
  const unsaved = dirty || blocked;

  // Same guard as upstream: unsaved edits ask before Escape, the overlay, × or Close drop them.
  const confirmClose = useCallback((): boolean | Promise<boolean> => {
    if (!unsaved || saving) return true;
    return new Promise<boolean>((resolve) => {
      showConfirmation({
        title: t('providersPage.unsavedChanges.title'),
        message: t('providersPage.unsavedChanges.message'),
        variant: 'danger',
        confirmText: t('providersPage.unsavedChanges.discard'),
        cancelText: t('providersPage.unsavedChanges.keepEditing'),
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, [unsaved, saving, showConfirmation, t]);

  const handleCloseClick = useCallback(() => {
    void Promise.resolve(confirmClose()).then((ok) => {
      if (ok) onClose();
    });
  }, [confirmClose, onClose]);

  const handleSettingsLink = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (saving) return;
      void Promise.resolve(confirmClose()).then((ok) => {
        if (ok) void navigate('/ledger/config?field=routingStrategy');
      });
    },
    [confirmClose, navigate, saving]
  );

  const status = blocked ? t('ledger.sheet_fix_errors') : dirty ? t('ledger.sheet_unsaved') : '';

  return (
    <Sheet
      open={Boolean(editor)}
      onClose={closeSheet}
      confirmClose={confirmClose}
      size="md"
      closeDisabled={saving}
      className={styles.sheet}
      title={
        <span className={styles.title} title={title}>
          {title}
        </span>
      }
      description={
        typeLabel ? (
          <span className={styles.subtitle}>
            <span
              className={styles.icon}
              aria-hidden="true"
              style={
                isThemeSurfaceIconProvider(iconType)
                  ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                  : undefined
              }
            >
              {iconSrc ? <img src={iconSrc} alt="" /> : typeLabel.slice(0, 1).toUpperCase()}
            </span>
            {subtitle}
          </span>
        ) : undefined
      }
      footer={
        <div className={styles.footer}>
          <p className={blocked ? styles.statusError : styles.status} aria-live="polite">
            {status}
          </p>
          <Button
            variant="secondary"
            className={styles.button}
            onClick={handleCloseClick}
            disabled={saving}
          >
            {unsaved ? t('common.cancel') : t('common.close')}
          </Button>
          <Button
            variant="secondary"
            className={styles.button}
            onClick={() => {
              if (updatedText) void onCopyText(updatedText);
            }}
            disabled={saving || !updatedText}
          >
            {t('ledger.sheet_copy_json')}
          </Button>
          <Button
            className={styles.button}
            onClick={onSave}
            loading={saving}
            disabled={disableControls || saving || !dirty || !editor?.json || blocked}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      {editor && (
        // Keyed so the raw view closes and secrets re-mask whenever another account opens.
        <AccountSheetBody
          key={editor.fileName}
          editor={editor}
          updatedText={updatedText}
          showEmails={showEmails}
          disabled={disableControls || saving || !editor.json}
          policyDisabled={disableControls || saving}
          onChange={onChange}
          weightHint={
            <Trans
              i18nKey="auth_files.weight_hint"
              components={{
                settingsLink: (
                  <Link
                    className={styles.link}
                    to="/ledger/config?field=routingStrategy"
                    onClick={handleSettingsLink}
                  />
                ),
              }}
            />
          }
        />
      )}
    </Sheet>
  );
}

type BodyProps = {
  editor: PrefixProxyEditorState;
  updatedText: string;
  /** Follows the screen's email toggle, so the raw view and file name mask like the rows do. */
  showEmails: boolean;
  disabled: boolean;
  policyDisabled: boolean;
  weightHint: ReactNode;
  onChange: (field: PrefixProxyEditorField, value: PrefixProxyEditorFieldValue) => void;
};

function AccountSheetBody({
  editor,
  updatedText,
  showEmails,
  disabled,
  policyDisabled,
  weightHint,
  onChange,
}: BodyProps) {
  const { t } = useTranslation();
  const id = useId();
  const [rawOpen, setRawOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const shown = (text: string) => (showEmails ? text : maskEmails(text));

  const infoText = useMemo(() => {
    const file = parseFile(editor.fileInfoText);
    if (!file) return editor.fileInfoText;
    const record: Record<string, unknown> = { ...file };
    DERIVED_INFO_KEYS.forEach((key) => delete record[key]);
    return JSON.stringify(record);
  }, [editor.fileInfoText]);

  if (editor.loading) {
    return (
      <div className={styles.loading} role="status">
        <LoadingSpinner size={14} />
        <span>{t('auth_files.prefix_proxy_loading')}</span>
      </div>
    );
  }

  const policy = editor.policy ?? (editor.json ? readCredentialPolicy(editor.json) : null);
  const policyError = credentialPolicyError(editor.policy);
  const fieldId = (name: string) => `${id}-${name}`;
  const provider = editor.providerKey;

  return (
    <div className={styles.body}>
      {editor.error && (
        <p className={styles.alert} role="alert">
          {editor.error}
        </p>
      )}

      {editor.json && policy && (
        <>
          <Section title={t('ledger.sheet_routing')}>
            <Row label={t('ledger.field_prefix')} yamlKey="prefix" htmlFor={fieldId('prefix')}>
              <input
                id={fieldId('prefix')}
                className={styles.input}
                value={editor.prefix}
                disabled={disabled}
                onChange={(e) => onChange('prefix', e.target.value)}
              />
            </Row>
            <Row
              label={t('ledger.field_priority')}
              yamlKey="priority"
              htmlFor={fieldId('priority')}
              hint={t('auth_files.priority_hint')}
            >
              <input
                id={fieldId('priority')}
                className={`${styles.input} ${styles.short}`}
                inputMode="numeric"
                value={editor.priority}
                placeholder={t('auth_files.priority_placeholder')}
                disabled={disabled}
                onChange={(e) => onChange('priority', e.target.value)}
              />
            </Row>
            <Row
              label={t('ledger.field_weight')}
              yamlKey="weight"
              htmlFor={fieldId('weight')}
              hint={weightHint}
              error={editor.weightError ?? undefined}
            >
              <input
                id={fieldId('weight')}
                className={`${styles.input} ${styles.short}`}
                type="number"
                step={1}
                max={MAX_CREDENTIAL_WEIGHT}
                placeholder="1"
                value={editor.weight}
                aria-invalid={Boolean(editor.weightError)}
                disabled={disabled}
                onChange={(e) => onChange('weight', e.target.value)}
              />
            </Row>
            <SwitchRow
              id={fieldId('cooling')}
              label={t('ledger.field_disable_cooling')}
              yamlKey="disable_cooling"
              hint={t('auth_files.disable_cooling_hint')}
              checked={editor.disableCooling}
              disabled={disabled}
              onChange={(value) => onChange('disableCooling', value)}
            />
          </Section>

          <Section title={t('ledger.sheet_connection')}>
            <Row label={t('ledger.field_proxy_url')} yamlKey="proxy_url" htmlFor={fieldId('proxy')}>
              <input
                id={fieldId('proxy')}
                className={`${styles.input} ${styles.mono}`}
                value={editor.proxyUrl}
                placeholder={t('auth_files.proxy_url_placeholder')}
                spellCheck={false}
                autoComplete="off"
                disabled={disabled}
                onChange={(e) => onChange('proxyUrl', e.target.value)}
              />
            </Row>
            {supportsAuthFileWebsockets(provider) && (
              <SwitchRow
                id={fieldId('websockets')}
                label={t('ledger.field_websockets')}
                yamlKey="websockets"
                hint={t('auth_files.websockets_hint')}
                checked={editor.websockets}
                disabled={disabled}
                onChange={(value) => onChange('websockets', value)}
              />
            )}
            {supportsAuthFileSiwc(provider) && (
              <SwitchRow
                id={fieldId('siwc')}
                label={t('ledger.field_use_siwc')}
                yamlKey="use_siwc"
                hint={t('auth_files.use_siwc_hint')}
                checked={editor.useSiwc}
                disabled={disabled}
                onChange={(value) => onChange('useSiwc', value)}
              />
            )}
            {supportsAuthFileUsingApi(provider) && (
              <SwitchRow
                id={fieldId('api')}
                label={t('ledger.field_using_api')}
                yamlKey="using_api"
                hint={t('auth_files.using_api_hint')}
                checked={editor.usingApi}
                disabled={disabled}
                onChange={(value) => onChange('usingApi', value)}
              />
            )}
          </Section>

          <Section title={t('ledger.sheet_models')}>
            <Row label={t('ledger.field_excluded_models')} yamlKey="excluded_models" stacked>
              {/* Upstream's field owns the model catalog fetch; its own label is kept for
                  screen readers only, since this row already shows one. */}
              <div className={styles.upstreamField}>
                <AuthFileExcludedModelsField
                  fileName={editor.fileName}
                  value={editor.excludedModelsText}
                  disabled={disabled}
                  onChange={(value) => onChange('excludedModelsText', value)}
                />
              </div>
            </Row>
            <ListPolicyRow
              field="modelAliases"
              label={t('ledger.field_model_aliases')}
              yamlKey="model_aliases"
              hint={t('auth_files.policy_aliases_hint')}
              policy={policy}
              disabled={policyDisabled}
              error={
                policyError === 'auth_files.policy_aliases_invalid' ? t(policyError) : undefined
              }
              onChange={onChange}
            />
          </Section>

          <Section title={t('ledger.sheet_requests')}>
            <Row
              label={t('ledger.field_retries')}
              yamlKey="request_retry"
              hint={t('auth_files.policy_retry_hint')}
              error={policyError === 'auth_files.policy_retry_invalid' ? t(policyError) : undefined}
            >
              <div className={styles.inline}>
                <ModeSwitch
                  label={t('ledger.field_retries')}
                  value={policy.requestRetry.mode}
                  disabled={policyDisabled}
                  onChange={(mode) => onChange('requestRetry', { ...policy.requestRetry, mode })}
                />
                {policy.requestRetry.mode === 'custom' && (
                  <input
                    className={`${styles.input} ${styles.count}`}
                    type="number"
                    min={0}
                    step={1}
                    aria-label={t('auth_files.policy_retry_count')}
                    value={policy.requestRetry.value}
                    aria-invalid={policyError === 'auth_files.policy_retry_invalid'}
                    disabled={policyDisabled}
                    onChange={(e) =>
                      onChange('requestRetry', { ...policy.requestRetry, value: e.target.value })
                    }
                  />
                )}
              </div>
            </Row>
            <ListPolicyRow
              field="errorRules"
              label={t('ledger.field_error_rules')}
              yamlKey="request_scoped_errors"
              hint={t('auth_files.policy_rules_hint')}
              policy={policy}
              disabled={policyDisabled}
              error={policyError === 'auth_files.policy_rules_invalid' ? t(policyError) : undefined}
              onChange={onChange}
            />
            <Row
              label={t('ledger.field_headers')}
              yamlKey="headers"
              htmlFor={fieldId('headers')}
              hint={t('auth_files.headers_hint')}
              error={editor.headersError ?? undefined}
              stacked
            >
              <textarea
                id={fieldId('headers')}
                className={`${styles.input} ${styles.textarea} ${styles.mono}`}
                value={editor.headersText}
                placeholder={t('auth_files.headers_placeholder')}
                rows={3}
                spellCheck={false}
                aria-invalid={Boolean(editor.headersError)}
                disabled={disabled}
                onChange={(e) => onChange('headersText', e.target.value)}
              />
            </Row>
          </Section>

          <Section title={t('auth_files.note_label')} labelFor={fieldId('note')}>
            <div className={styles.noteField}>
              <input
                id={fieldId('note')}
                className={styles.input}
                value={editor.note}
                placeholder={t('auth_files.note_placeholder')}
                aria-describedby={fieldId('note-hint')}
                disabled={disabled}
                onChange={(e) => onChange('note', e.target.value)}
              />
              <p id={fieldId('note-hint')} className={styles.hint}>
                {t('auth_files.note_hint')}
              </p>
            </div>
          </Section>
        </>
      )}

      <details
        className={styles.raw}
        open={rawOpen}
        onToggle={(e) => setRawOpen(e.currentTarget.open)}
      >
        <summary className={styles.rawSummary}>
          <IconChevronDown size={14} className={styles.chevron} aria-hidden="true" />
          <span className={styles.rawTitle}>{t('ledger.sheet_raw_file')}</span>
          <span className={styles.fileName} title={shown(editor.fileName)}>
            {shown(editor.fileName)}
          </span>
        </summary>
        {rawOpen && (
          <div className={styles.rawBody}>
            <button
              type="button"
              className={styles.reveal}
              aria-pressed={reveal}
              onClick={() => setReveal((value) => !value)}
            >
              {reveal ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              {reveal ? t('ledger.sheet_hide_secrets') : t('ledger.sheet_reveal_secrets')}
            </button>
            <RawBlock
              label={t('ledger.sheet_raw_info')}
              text={shown(formatRawText(infoText, reveal))}
            />
            <RawBlock
              label={
                editor.json
                  ? t('ledger.sheet_raw_contents')
                  : t('auth_files.prefix_proxy_invalid_content_label')
              }
              text={shown(
                formatRawText(
                  editor.json ? updatedText || editor.rawText : editor.invalidContentPreview,
                  reveal
                )
              )}
            />
          </div>
        )}
      </details>
    </div>
  );
}

function Section({
  title,
  labelFor,
  children,
}: {
  title: string;
  /** For a one-field section, the heading doubles as that field's label. */
  labelFor?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {labelFor ? <label htmlFor={labelFor}>{title}</label> : title}
      </h3>
      <div className={styles.rows}>{children}</div>
    </section>
  );
}

type RowProps = {
  label: string;
  /** The auth-file key, shown as a tooltip so the YAML name stays discoverable. */
  yamlKey: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  /** Wide editors sit under their label instead of beside it. */
  stacked?: boolean;
  children: ReactNode;
};

function Row({ label, yamlKey, htmlFor, hint, error, stacked, children }: RowProps) {
  return (
    <div className={`${styles.row} ${stacked ? styles.stacked : ''}`}>
      {htmlFor ? (
        <label className={styles.label} htmlFor={htmlFor} title={yamlKey}>
          {label}
        </label>
      ) : (
        // Visual only: the control inside names itself (aria-label or its own label).
        <span className={styles.label} title={yamlKey} aria-hidden="true">
          {label}
        </span>
      )}
      <div className={styles.control}>
        {children}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {hint && <p className={styles.hint}>{hint}</p>}
      </div>
    </div>
  );
}

type SwitchRowProps = {
  id: string;
  label: string;
  yamlKey: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
};

function SwitchRow({ id, label, yamlKey, hint, checked, disabled, onChange }: SwitchRowProps) {
  return (
    <div className={styles.switchRow}>
      <div className={styles.switchText}>
        <label className={styles.label} htmlFor={id} title={yamlKey}>
          {label}
        </label>
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      </div>
      <ToggleSwitch
        id={id}
        checked={checked}
        disabled={disabled}
        ariaDescribedBy={`${id}-hint`}
        onChange={onChange}
      />
    </div>
  );
}

/** Inherit or Custom, as a two-segment radio group (arrow keys move between them natively). */
function ModeSwitch({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: PolicyMode;
  disabled: boolean;
  onChange: (mode: PolicyMode) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <div className={styles.segments} role="radiogroup" aria-label={label}>
      {(['inherit', 'custom'] as const).map((mode) => (
        <label key={mode} className={styles.segment} data-checked={value === mode}>
          <input
            type="radio"
            name={name}
            value={mode}
            checked={value === mode}
            disabled={disabled}
            onChange={() => onChange(mode)}
          />
          {t(`auth_files.policy_${mode}`)}
        </label>
      ))}
    </div>
  );
}

type ListPolicyRowProps = {
  field: 'modelAliases' | 'errorRules';
  label: string;
  yamlKey: string;
  hint: string;
  policy: CredentialPolicyDraft;
  disabled: boolean;
  error?: string;
  onChange: (field: PrefixProxyEditorField, value: PrefixProxyEditorFieldValue) => void;
};

/** Model aliases and error rules: inherit, or a custom list edited with upstream's editors. */
function ListPolicyRow(props: ListPolicyRowProps) {
  const { field, label, yamlKey, hint, policy, disabled, error, onChange } = props;
  const { t } = useTranslation();
  const value = policy[field];
  const aliases = policy.modelAliases.rows ?? [];

  return (
    <div className={`${styles.row} ${styles.stacked}`} role="group" aria-label={label}>
      <div className={styles.rowHead}>
        <span className={styles.label} title={yamlKey} aria-hidden="true">
          {label}
        </span>
        <ModeSwitch
          label={label}
          value={value.mode}
          disabled={disabled}
          onChange={(mode) => onChange(field, { ...value, mode })}
        />
      </div>
      <div className={styles.control}>
        {value.mode === 'custom' &&
          (value.rows === null ? (
            <div className={styles.unsupported}>
              <p className={styles.hint}>{t('auth_files.policy_unsupported')}</p>
              <Button
                variant="secondary"
                className={styles.button}
                disabled={disabled}
                onClick={() => onChange(field, { mode: 'custom', rows: [] })}
              >
                {t('auth_files.policy_replace')}
              </Button>
            </div>
          ) : field === 'modelAliases' ? (
            <div className={styles.editor}>
              <ModelEntriesEditor
                oauthAliasOnly
                models={aliases}
                supportsImage={false}
                supportsThinking={false}
                mutating={disabled}
                removeDisabled={false}
                onUpdate={(index, patch) =>
                  onChange('modelAliases', {
                    mode: 'custom',
                    rows: aliases.map((row, i) => (i === index ? { ...row, ...patch } : row)),
                  })
                }
                onAdd={() =>
                  onChange('modelAliases', {
                    mode: 'custom',
                    rows: [...aliases, { name: '', alias: '' }],
                  })
                }
                onRemove={(index) =>
                  onChange('modelAliases', {
                    mode: 'custom',
                    rows: aliases.filter((_, i) => i !== index),
                  })
                }
              />
            </div>
          ) : (
            <div className={styles.editor}>
              <ErrorRulesEditor
                rules={policy.errorRules.rows ?? []}
                disabled={disabled}
                onChange={(rows) => onChange('errorRules', { mode: 'custom', rows })}
              />
            </div>
          ))}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.hint}>{hint}</p>
      </div>
    </div>
  );
}

function RawBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className={styles.rawBlock}>
      <span className={styles.rawLabel}>{label}</span>
      <pre className={styles.pre} tabIndex={0}>
        {text}
      </pre>
    </div>
  );
}
