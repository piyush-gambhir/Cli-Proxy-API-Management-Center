/**
 * The header's "more" button: rare, account-wide actions kept out of the main toolbar.
 * Arrow keys move between items; closes on outside click, Escape or a choice, returning focus
 * to the button.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { IconEllipsis } from '@/components/ui/icons';
import styles from './MoreMenu.module.scss';

export type MoreMenuItem = {
  label: string;
  hint: string;
  busy?: boolean;
  onSelect: () => void;
};

export function MoreMenu({
  label,
  items,
  disabled,
}: {
  label: string;
  items: MoreMenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      // Arrow keys, Home and End move between the enabled items, wrapping at the ends.
      const items = Array.from(
        rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
          []
      );
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'ArrowDown'
          ? (index + 1) % items.length
          : event.key === 'ArrowUp'
            ? (index - 1 + items.length) % items.length
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? items.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      items[next].focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <IconEllipsis size={16} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" id={menuId} aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={item.busy}
              onClick={() => {
                setOpen(false);
                // Focus returns to the trigger first, so a dialog the action opens restores it there.
                buttonRef.current?.focus();
                item.onSelect();
              }}
            >
              <span className={styles.itemLabel}>{item.label}</span>
              <span className={styles.itemHint}>{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
