/** Per-browser preferences for the ledger shell. Storage can be unavailable; fail quietly. */

import { create } from 'zustand';

type Persisted = { showEmails?: boolean };

const KEY = 'ledger.ui';

const read = (): Persisted => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Persisted;
    return { showEmails: typeof parsed.showEmails === 'boolean' ? parsed.showEmails : undefined };
  } catch {
    return {};
  }
};

const write = (patch: Persisted) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
  } catch {
    // ignore
  }
};

type LedgerUiState = {
  /** Emails are masked across the shell unless this is true (the screen gets shared). */
  showEmails: boolean;
  toggleEmails: () => void;
};

export const useLedgerUi = create<LedgerUiState>((set, get) => ({
  showEmails: read().showEmails ?? false,
  toggleEmails: () => {
    const showEmails = !get().showEmails;
    write({ showEmails });
    set({ showEmails });
  },
}));
