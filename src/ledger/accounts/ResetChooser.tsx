/**
 * Pick which Claude reset grant to spend. Same hook and redeem path as upstream's
 * ClaudeResetGrantDialog (eligibility, retry of an unresolved claim); only the presentation is
 * ours: one compact row per grant, soonest expiry first, nothing spent until Confirm.
 */

import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useNow } from '@/hooks/useNow';
import { resetGrantHasNoUsage, type AnthropicResetGrant } from '@/services/api/claudeResetGrants';
import { resetGrantKind } from '@/features/quota/providers/claude/resetGrantChoice';
import { formatRelativeInstant, parseIsoToMs } from '@/utils/quota';
import { formatDateTime } from '@/ledger/time';
import styles from './ResetChooser.module.scss';

type Props = {
  open: boolean;
  name: string;
  grants: readonly AnthropicResetGrant[];
  selected: string | null;
  loading: boolean;
  busy: boolean;
  pendingGrantId?: string;
  message: string;
  canRedeemGrant: (id: string) => boolean;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ResetChooser(props: Props) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const group = useId();
  const kindOf = (grant: AnthropicResetGrant) => t(`claude_reset.kind_${resetGrantKind(grant)}`);
  const grants = [...props.grants]
    .filter((grant) => grant.resetsLeft > 0 || grant.id === props.pendingGrantId)
    .sort((a, b) => (parseIsoToMs(a.endsAt) ?? Infinity) - (parseIsoToMs(b.endsAt) ?? Infinity));
  const selected = grants.find((grant) => grant.id === props.selected);

  return (
    <Modal
      open={props.open}
      title={t('ledger.reset_choose_title')}
      onClose={props.onClose}
      closeDisabled={props.busy}
      width={520}
      className={styles.modal}
      footer={
        <div className={styles.footer}>
          <p className={styles.summary} aria-live="polite">
            {selected
              ? t('ledger.reset_spend_summary', { kind: kindOf(selected) })
              : t('ledger.reset_pick_one')}
          </p>
          <Button variant="secondary" onClick={props.onClose} disabled={props.busy}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={props.onConfirm}
            loading={props.busy}
            disabled={!props.selected || !props.canRedeemGrant(props.selected)}
          >
            {t(props.pendingGrantId ? 'claude_reset.retry' : 'ledger.use_reset')}
          </Button>
        </div>
      }
    >
      <p className={styles.intro}>
        {props.pendingGrantId
          ? t('claude_reset.retry_confirm', { name: props.name })
          : t('ledger.reset_choose_intro', { name: props.name })}
      </p>

      {props.loading ? (
        <p className={styles.note} role="status" aria-busy="true">
          {t('common.loading')}
        </p>
      ) : grants.length === 0 ? (
        <p className={styles.note}>{t('claude_reset.no_grants')}</p>
      ) : (
        <div className={styles.list} role="radiogroup" aria-label={t('claude_reset.choose_grant')}>
          {grants.map((grant) => {
            const expiry = parseIsoToMs(grant.endsAt);
            const available = props.canRedeemGrant(grant.id);
            const noUsage = resetGrantHasNoUsage(grant);
            const checked = props.selected === grant.id;
            return (
              <label
                key={grant.id}
                className={styles.option}
                data-checked={checked}
                data-disabled={!available}
              >
                <input
                  type="radio"
                  name={group}
                  value={grant.id}
                  checked={checked}
                  disabled={!available}
                  onChange={() => props.onSelect(grant.id)}
                />
                <span className={styles.dot} aria-hidden="true" />
                <span className={styles.body}>
                  <span className={styles.top}>
                    <span className={styles.kind}>
                      {kindOf(grant)}
                      {grant.resetsTotal > 1 && (
                        <span className={styles.left}>
                          {t('ledger.reset_left_of', {
                            left: grant.resetsLeft,
                            total: grant.resetsTotal,
                          })}
                        </span>
                      )}
                    </span>
                    <span className={styles.expiry}>
                      {expiry === null
                        ? t('claude_reset.expiry_unknown')
                        : t('ledger.reset_expires', {
                            date: formatRelativeInstant(expiry, now, i18n.language),
                          })}
                    </span>
                  </span>
                  <span className={styles.meta}>
                    <span className={styles.label}>{grant.label}</span>
                    {expiry !== null && (
                      <span className={styles.date}>{formatDateTime(expiry, i18n.language)}</span>
                    )}
                  </span>
                  {grant.givesBackWeekly && (
                    <span className={styles.hint}>{t('claude_reset.fable_hint')}</span>
                  )}
                  {!available && (
                    <span className={styles.hint}>
                      {t(noUsage ? 'claude_reset.no_usage' : 'claude_reset.grant_unavailable')}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {props.message && (
        <p className={styles.message} role="status">
          {t(`claude_reset.${props.message}`)}
        </p>
      )}
    </Modal>
  );
}
