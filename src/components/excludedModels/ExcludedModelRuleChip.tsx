import type { ReactNode } from 'react';
import { IconX } from '@/components/ui/icons';
import styles from './ExcludedModelRuleChip.module.scss';











export type ExcludedModelChipVariant = 'exact' | 'wildcard' | 'unknown';

export interface ExcludedModelRuleChipProps {
  label: string;
  variant?: ExcludedModelChipVariant;

  detail?: string;

  onRemove?: () => void;
  removeAriaLabel?: string;
  disabled?: boolean;
  title?: string;
}


export function ExcludedModelChipRow({ children }: { children: ReactNode }) {
  return <div className={styles.chipRow}>{children}</div>;
}

export function ExcludedModelRuleChip({
  label,
  variant = 'exact',
  detail,
  onRemove,
  removeAriaLabel,
  disabled = false,
  title,
}: ExcludedModelRuleChipProps) {
  return (
    <span
      className={`${styles.chip} ${styles[variant]}`}
      title={title ?? (detail ? `${label} — ${detail}` : label)}
    >
      <span className={styles.label}>{label}</span>
      {detail ? <span className={styles.detail}>{detail}</span> : null}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={onRemove}
          disabled={disabled}
          aria-label={removeAriaLabel ?? label}
        >
          <IconX size={12} />
        </button>
      ) : null}
    </span>
  );
}
