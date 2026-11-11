/**
 * Confirm before spending a Codex reset credit. Codex's redeem call carries no credit id, so
 * OpenAI decides which credit is used; the list is informational, not a choice.
 */

import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/hooks/useNow';
import { formatRelativeInstant } from '@/utils/quota';
import type { LedgerReset } from '@/ledger/resets';
import { formatDateTime } from '@/ledger/time';
import styles from './ResetChooser.module.scss';

type Props = {
  open: boolean;
  name: string;
  /** Null when the provider gave no per-credit details. */
  resets: LedgerReset[] | null;
  count: number;
  /** True while the fresh credit read that opening the dialog started is still running. */
  checking: boolean;
  /** The fresh read failed, so the current credit count can't be trusted. */
  failed: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function CodexResetConfirm(props: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  return (
    <Modal
      open={props.open}
      title={t('ledger.codex_reset_title')}
      onClose={props.onClose}
      closeDisabled={props.busy}
      width={480}
      className={styles.modal}
      footer={
        <div className={styles.footer}>
          <p className={styles.summary}>{t('ledger.codex_reset_summary')}</p>
          <Button variant="secondary" onClick={props.onClose} disabled={props.busy}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={props.onConfirm}
            loading={props.busy}
            disabled={props.checking || props.failed || props.count === 0}
          >
            {t('ledger.use_reset')}
          </Button>
        </div>
      }
    >
      <p className={styles.intro}>
        {props.checking
          ? t('ledger.codex_reset_checking')
          : props.failed
            ? t('ledger.codex_reset_check_failed')
            : props.count === 0
              ? t('ledger.codex_reset_none', { name: props.name })
              : t('ledger.codex_reset_intro', { name: props.name, count: props.count })}
      </p>
      {props.resets && props.resets.length > 0 && (
        <div className={styles.list}>
          {props.resets.map((reset) => (
            <div
              key={`${reset.kindKey}-${reset.expiresAtMs}`}
              className={styles.option}
              data-static="true"
            >
              <span className={styles.body}>
                <span className={styles.top}>
                  <span className={styles.kind}>
                    {t(reset.kindKey)}
                    {reset.count > 1 && <span className={styles.left}>× {reset.count}</span>}
                  </span>
                  <span className={styles.expiry}>
                    {reset.expiresAtMs === null
                      ? t('ledger.reset_no_expiry')
                      : t('ledger.reset_expires', {
                          date: formatRelativeInstant(reset.expiresAtMs, now, i18n.language),
                        })}
                  </span>
                </span>
                {reset.expiresAtMs !== null && (
                  <span className={styles.meta}>
                    <span />
                    <span className={styles.date}>
                      {formatDateTime(reset.expiresAtMs, i18n.language)}
                    </span>
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className={styles.note}>{t('ledger.codex_reset_which')}</p>
    </Modal>
  );
}
