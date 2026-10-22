/**
 * Shell for the ledger screens, mounted at /ledger. The original dashboard (MainLayout and every
 * upstream route) stays untouched; this shell has its own navigation and look.
 *
 * Screens without a ledger version yet render the upstream page inside this shell, so they pick
 * up the ledger look. Replace a route's element when its ledger screen lands.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ConfigPage } from '@/features/config/ConfigPage';
import { LogsPage } from '@/features/logs/LogsPage';
import { PluginsPage } from '@/features/plugins/PluginsPage';
import { ProvidersWorkbenchPage } from '@/features/providers/ProvidersWorkbenchPage';
import { SystemPage } from '@/pages/SystemPage';
import { useAuthStore, useConfigStore, useThemeStore } from '@/stores';
import type { Theme } from '@/types';
import { AccountsScreen } from './accounts/AccountsScreen';
import { setLanding } from './landingState';
import { useMaskedNotifications } from './useMaskedNotifications';
import styles from './LedgerLayout.module.scss';
import './theme.scss';

const NEXT_THEME: Record<Theme, Theme> = {
  auto: 'light',
  light: 'dark',
  white: 'dark',
  dark: 'auto',
};

export function LedgerLayout() {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const logout = useAuthStore((state) => state.logout);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  useMaskedNotifications();

  useEffect(() => {
    // Reaching the ledger shell ends a landing, so the Classic link opens the original.
    setLanding(false);
    const root = document.documentElement;
    root.dataset.ui = 'ledger';
    return () => {
      delete root.dataset.ui;
    };
  }, []);

  // Same startup fetch as MainLayout: provider and config screens read the cached config.
  useEffect(() => {
    fetchConfig().catch(() => {});
  }, [fetchConfig]);

  const nav = [
    { to: '/ledger', label: t('ledger.nav_accounts'), end: true },
    { to: '/ledger/providers', label: t('ledger.nav_providers') },
    { to: '/ledger/logs', label: t('ledger.nav_logs') },
    { to: '/ledger/config', label: t('ledger.nav_config') },
    ...(supportsPlugin ? [{ to: '/ledger/plugins', label: t('ledger.nav_plugins') }] : []),
    { to: '/ledger/system', label: t('ledger.nav_system') },
  ];

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <span className={styles.brand}>CLI Proxy</span>
        <nav className={styles.nav} aria-label={t('ledger.nav_label')}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.foot}>
          <button type="button" className={styles.link} onClick={() => setTheme(NEXT_THEME[theme])}>
            {t(`ledger.theme_${theme === 'white' ? 'light' : theme}`)}
          </button>
          <NavLink to="/" className={styles.link}>
            {t('ledger.classic')}
          </NavLink>
          <button type="button" className={styles.link} onClick={logout}>
            {t('ledger.sign_out')}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Routes>
          <Route index element={<AccountsScreen />} />
          <Route path="providers" element={<ProvidersWorkbenchPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="config" element={<ConfigPage />} />
          {supportsPlugin && <Route path="plugins" element={<PluginsPage />} />}
          <Route path="system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/ledger" replace />} />
        </Routes>
      </main>
    </div>
  );
}
