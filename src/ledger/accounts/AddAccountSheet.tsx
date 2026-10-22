/**
 * Add account: one plain list of every way in (OAuth providers, Vertex import, SIWC binding,
 * credential file upload). Runs upstream's flow hooks and dialogs, so sign-in behaviour arrives
 * through the upstream sync; only the picker is ours.
 *
 * Mounted for the screen's lifetime, not just while open: closing the sheet must not abort a
 * sign-in that is still polling.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconUpload } from '@/components/ui/icons';
import { Sheet } from '@/components/ui/Sheet/Sheet';
import { useAuthStore, useThemeStore } from '@/stores';
import iconCodex from '@/assets/icons/codex.svg';
import iconVertex from '@/assets/icons/vertex.svg';
import { OAuthFlowDialog } from '@/features/oauth/components/OAuthFlowDialog';
import { SiwcBindDialog } from '@/features/oauth/components/SiwcBindDialog';
import { VertexImportDialog } from '@/features/oauth/components/VertexImportDialog';
import { useOAuthFlows, usePluginOAuthProviders } from '@/features/oauth/hooks/useOAuthFlows';
import { useVertexImport } from '@/features/oauth/hooks/useVertexImport';
import {
  OAUTH_PROVIDERS,
  resolveThemedIcon,
  supportsManualCallback,
  type OAuthProviderCard,
} from '@/features/oauth/providers';
import styles from './AddAccountSheet.module.scss';

const VERTEX_ID = '__vertex__';

type Dialog = { kind: 'oauth'; id: string } | { kind: 'vertex' } | null;

export type AddAccountSheetProps = {
  open: boolean;
  uploading: boolean;
  disableControls: boolean;
  onClose: () => void;
  onUpload: () => void;
  /** A sign-in or import created a credential. */
  onAdded: () => void;
};

type SheetItemProps = {
  icon: ReactNode;
  label: string;
  caption: string;
  /** The caption is a live flow status rather than the sign-in method. */
  emphasis?: boolean;
  disabled: boolean;
  onOpen: () => void;
};

function SheetItem({ icon, label, caption, emphasis, disabled, onOpen }: SheetItemProps) {
  return (
    <li>
      <button type="button" className={styles.item} onClick={onOpen} disabled={disabled}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.label}>{label}</span>
        <span className={emphasis ? styles.status : styles.caption}>{caption}</span>
      </button>
    </li>
  );
}

export function AddAccountSheet(props: AddAccountSheetProps) {
  const { open, uploading, disableControls, onClose, onUpload, onAdded } = props;
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);

  const pluginProviders = usePluginOAuthProviders(apiBase);
  const cards = useMemo<OAuthProviderCard[]>(
    () => [...OAUTH_PROVIDERS, ...pluginProviders],
    [pluginProviders]
  );

  const focusedRef = useRef<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [siwcKey, setSiwcKey] = useState(0);
  const [siwcOpen, setSiwcOpen] = useState(false);

  const flows = useOAuthFlows({
    providerCards: cards,
    isFocused: (provider) => focusedRef.current === provider,
  });
  const vertexImport = useVertexImport({
    isFocused: () => focusedRef.current === VERTEX_ID,
    onCredentialAdded: flows.recordCredentialAdded,
  });

  const addedCount = flows.addedCount;
  useEffect(() => {
    if (addedCount > 0) onAdded();
  }, [addedCount, onAdded]);

  const labelOf = (card: OAuthProviderCard) =>
    card.kind === 'plugin'
      ? card.title
      : typeof card.label === 'string'
        ? card.label
        : t(card.label.key);
  const methodOf = (card: OAuthProviderCard) =>
    card.kind === 'plugin'
      ? t('auth_login.method_plugin')
      : t(card.flow === 'device' ? 'auth_login.method_device' : 'auth_login.method_browser');
  const iconOf = (card: OAuthProviderCard) =>
    card.kind === 'plugin' ? card.icon : resolveThemedIcon(card.icon, resolvedTheme);
  const statusOf = (id: string) => {
    const status = flows.states[id]?.status;
    return status === 'waiting' || status === 'success' || status === 'error'
      ? t(`auth_login.tile_${status}`)
      : null;
  };

  const openProvider = (card: OAuthProviderCard) => {
    focusedRef.current = card.id;
    setDialog({ kind: 'oauth', id: card.id });
    setDialogOpen(true);
    // An attempt in progress, failed or just finished is reopened as is; otherwise start one.
    if (!flows.states[card.id]?.status) void flows.startAuth(card.id);
  };
  const openVertex = () => {
    focusedRef.current = VERTEX_ID;
    setDialog({ kind: 'vertex' });
    setDialogOpen(true);
  };
  const closeDialog = () => {
    if (dialog?.kind === 'oauth') flows.dismissSuccess(dialog.id);
    if (dialog?.kind === 'vertex' && vertexImport.vertex.result) vertexImport.resetForAnother();
    focusedRef.current = null;
    setDialogOpen(false);
  };
  const openSiwc = () => {
    setSiwcKey((key) => key + 1);
    setSiwcOpen(true);
  };
  const finish = () => {
    closeDialog();
    setSiwcOpen(false);
    onClose();
  };

  const dialogCard =
    dialog?.kind === 'oauth' ? cards.find((card) => card.id === dialog.id) : undefined;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        size="md"
        title={t('ledger.add_account')}
        ariaLabel={t('ledger.add_account')}
        // Escape also reaches the sheet while a flow dialog sits on top; let the dialog close alone.
        confirmClose={() => !document.querySelector('.modal-overlay')}
      >
        <ul className={styles.list}>
          {cards.map((card) => (
            <SheetItem
              key={card.id}
              icon={<img src={iconOf(card)} alt="" />}
              label={labelOf(card)}
              caption={statusOf(card.id) ?? methodOf(card)}
              emphasis={statusOf(card.id) !== null}
              disabled={disableControls}
              onOpen={() => openProvider(card)}
            />
          ))}
        </ul>
        <ul className={styles.list}>
          <SheetItem
            icon={<img src={iconVertex} alt="" />}
            label="Vertex AI"
            caption={t('vertex_import.file_label')}
            disabled={disableControls}
            onOpen={openVertex}
          />
          <SheetItem
            icon={<img src={iconCodex} alt="" />}
            label={t('siwc.bind')}
            caption={t('siwc.tile_caption')}
            disabled={disableControls}
            onOpen={openSiwc}
          />
          <SheetItem
            icon={<IconUpload size={16} />}
            label={t('ledger.upload_file')}
            caption={t('ledger.upload_caption')}
            disabled={disableControls || uploading}
            onOpen={onUpload}
          />
        </ul>
      </Sheet>

      {dialogCard && (
        <OAuthFlowDialog
          open={dialogOpen && dialog?.kind === 'oauth'}
          providerId={dialogCard.id}
          heading={{
            title:
              dialogCard.kind === 'plugin'
                ? t('auth_login.plugin_oauth_title', { name: dialogCard.title })
                : t(dialogCard.titleKey),
            caption: methodOf(dialogCard),
            icon: iconOf(dialogCard),
          }}
          state={flows.states[dialogCard.id] ?? {}}
          text={(suffix) => flows.providerText(dialogCard.id, suffix)}
          supportsCallback={supportsManualCallback(dialogCard)}
          onStart={() => void flows.startAuth(dialogCard.id)}
          onCancel={() => void flows.cancelAuth(dialogCard.id)}
          onCallbackChange={(value) => flows.setCallbackInput(dialogCard.id, value)}
          onCallbackSubmit={() => void flows.submitCallback(dialogCard.id)}
          onViewAuthFiles={finish}
          onClose={closeDialog}
        />
      )}

      <VertexImportDialog
        open={dialogOpen && dialog?.kind === 'vertex'}
        heading={{
          title: t('vertex_import.title'),
          caption: t('vertex_import.file_label'),
          icon: iconVertex,
        }}
        vertex={vertexImport.vertex}
        onPickFile={vertexImport.pickFile}
        onLocationChange={vertexImport.setLocation}
        onImport={() => void vertexImport.importCredential()}
        onImportAnother={vertexImport.resetForAnother}
        onViewAuthFiles={finish}
        onClose={closeDialog}
      />

      {siwcKey > 0 && (
        <SiwcBindDialog
          key={siwcKey}
          open={siwcOpen}
          onClose={() => setSiwcOpen(false)}
          onViewAuthFiles={finish}
        />
      )}
    </>
  );
}
