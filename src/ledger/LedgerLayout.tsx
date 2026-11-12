/**
 * Shell for the ledger screens, mounted at /ledger. The original dashboard (MainLayout and every
 * upstream route) stays untouched; this shell has its own navigation and look.
 *
 * Screens without a ledger version yet render the upstream page inside this shell, so they pick
 * up the ledger look. Replace a route's element when its ledger screen lands.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { PluginResourcePage } from '@/features/plugins/PluginResourcePage';
import { useAuthStore, useConfigStore, useLanguageStore, useThemeStore } from '@/stores';
import type { Theme } from '@/types';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import { AccountsScreen } from './accounts/AccountsScreen';
import { setInLedger } from './classicRedirectState';
import { setLanding } from './landingState';
import { usePluginPageEntries } from './navPluginPages';
import {
  ConfigRoute,
  LogsRoute,
  ModelsRoutes,
  PluginStoreRoute,
  PluginsRoute,
  ProvidersRoute,
  RoutingRoute,
  SystemRoute,
} from './sections';
import { useMaskedNotifications } from './useMaskedNotifications';
import styles from './LedgerLayout.module.scss';
import './theme.scss';

const NEXT_THEME: Record<Theme, Theme> = {
  auto: 'light',
  light: 'white',
  white: 'dark',
  dark: 'auto',
};

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /** Extra path prefixes that also mark this item active. */
  also?: string[];
  sub?: boolean;
  title?: string;
}

export function LedgerLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const logout = useAuthStore((state) => state.logout);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const pluginPages = usePluginPageEntries();
  useMaskedNotifications();

  useEffect(() => {
    // Reaching the ledger shell ends a landing, so the Classic link opens the original.
    setLanding(false);
    // While the shell is open, links from embedded upstream pages to classic paths stay here.
    setInLedger(true);
    const root = document.documentElement;
    root.dataset.ui = 'ledger';
    return () => {
      setInLedger(false);
      delete root.dataset.ui;
    };
  }, []);

  // Same startup fetch as MainLayout: provider and config screens read the cached config.
  useEffect(() => {
    fetchConfig().catch(() => {});
  }, [fetchConfig]);

  const nav: NavItem[] = [
    { to: '/ledger', label: t('ledger.nav_accounts'), end: true, also: ['/ledger/routing'] },
    { to: '/ledger/providers', label: t('ledger.nav_providers'), also: ['/ledger/models'] },
    { to: '/ledger/logs', label: t('ledger.nav_logs') },
    { to: '/ledger/config', label: t('ledger.nav_config') },
    ...(supportsPlugin
      ? [
          {
            to: '/ledger/plugins',
            label: t('ledger.nav_plugins'),
            also: ['/ledger/plugin-store'],
          },
          ...pluginPages.map((page) => ({
            to: `/ledger${page.route}`,
            label: page.label,
            title: page.pluginTitle,
            sub: true,
          })),
        ]
      : []),
    { to: '/ledger/system', label: t('ledger.nav_system') },
  ];

  const isAlsoActive = (item: NavItem) =>
    item.also?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ?? false;

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
              title={item.title}
              className={({ isActive }) =>
                `${styles.link} ${item.sub ? styles.sub : ''} ${
                  isActive || isAlsoActive(item) ? styles.active : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.foot}>
          <button type="button" className={styles.link} onClick={() => setTheme(NEXT_THEME[theme])}>
            {t(`ledger.theme_${theme}`)}
          </button>
          <select
            className={`${styles.link} ${styles.select}`}
            value={language}
            aria-label={t('language.switch')}
            onChange={(event) => {
              if (isSupportedLanguage(event.target.value)) setLanguage(event.target.value);
            }}
          >
            {LANGUAGE_ORDER.map((lang) => (
              <option key={lang} value={lang}>
                {t(LANGUAGE_LABEL_KEYS[lang])}
              </option>
            ))}
          </select>
          {/* `/` has no ledger mapping in classicRedirect, so this always opens the original. */}
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
          <Route path="routing" element={<RoutingRoute />} />
          <Route path="providers" element={<ProvidersRoute />} />
          <Route path="models/*" element={<ModelsRoutes />} />
          <Route path="logs" element={<LogsRoute />} />
          <Route path="config" element={<ConfigRoute />} />
          {supportsPlugin && <Route path="plugins" element={<PluginsRoute />} />}
          {supportsPlugin && <Route path="plugin-store" element={<PluginStoreRoute />} />}
          {supportsPlugin && (
            <Route path="plugin-pages/:pluginId/:menuIndex" element={<PluginResourcePage />} />
          )}
          <Route path="system" element={<SystemRoute />} />
          <Route path="*" element={<Navigate to="/ledger" replace />} />
        </Routes>
      </main>
    </div>
  );
}
