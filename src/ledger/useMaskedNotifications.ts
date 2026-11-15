import { useEffect } from 'react';
import { useNotificationStore } from '@/stores';
import { maskEmails } from './maskEmail';
import { useLedgerUi } from './uiState';

const masking = () => !useLedgerUi.getState().showEmails;
const mask = (text: string) => (masking() ? maskEmails(text) : text);










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
