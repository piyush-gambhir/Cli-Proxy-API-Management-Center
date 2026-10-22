import { useEffect } from 'react';
import { useNotificationStore } from '@/stores';
import { maskEmails } from './maskEmail';
import { useLedgerUi } from './uiState';

const masking = () => !useLedgerUi.getState().showEmails;
const mask = (text: string) => (masking() ? maskEmails(text) : text);

/**
 * While the ledger shell is mounted, toasts and confirmations raised anywhere in the app have
 * their emails masked unless "Show emails" is on.
 *
 * Upstream hooks (delete, enable, quota refresh, OAuth) build their messages from filenames that
 * contain the account email. The store's two entry points are wrapped once for the shell's
 * lifetime and read the preference at call time, so handlers captured before a toggle still
 * mask; hiding emails also masks toasts already on screen. The originals return on unmount.
 */
export function useMaskedNotifications() {
  const showEmails = useLedgerUi((state) => state.showEmails);

  useEffect(() => {
    const { showNotification, showConfirmation } = useNotificationStore.getState();
    useNotificationStore.setState({
      showNotification: (message, type, duration) =>
        showNotification(mask(message), type, duration),
      showConfirmation: (options) =>
        showConfirmation({
          ...options,
          title: options.title === undefined ? undefined : mask(options.title),
          message: typeof options.message === 'string' ? mask(options.message) : options.message,
        }),
    });
    return () => useNotificationStore.setState({ showNotification, showConfirmation });
  }, []);

  useEffect(() => {
    if (showEmails) return;
    useNotificationStore.setState((state) => ({
      notifications: state.notifications.map((item) => ({
        ...item,
        message: maskEmails(item.message),
      })),
    }));
  }, [showEmails]);
}
