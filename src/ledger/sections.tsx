










import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ConfigPage } from '@/features/config/ConfigPage';
import { LogsPage } from '@/features/logs/LogsPage';
import { PluginsPage } from '@/features/plugins/PluginsPage';
import { PluginStorePage } from '@/features/plugins/PluginStorePage';
import { ProvidersWorkbenchPage } from '@/features/providers/ProvidersWorkbenchPage';
import { AuthFilesOAuthExcludedEditPage } from '@/pages/AuthFilesOAuthExcludedEditPage';
import { AuthFilesOAuthModelAliasEditPage } from '@/pages/AuthFilesOAuthModelAliasEditPage';
import { SystemPage } from '@/pages/SystemPage';
import { RoutingScreen } from './routing/RoutingScreen';
import styles from './LedgerLayout.module.scss';

type TitleTab = { to: string; label: string; end?: boolean };


export function TitleTabs({ label, tabs }: { label: string; tabs: TitleTab[] }) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `${styles.titleTab} ${isActive ? styles.titleTabActive : ''}`;
  return (
    <nav className={styles.titleTabs} aria-label={label}>
      {tabs.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={tab}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Section({
  title,
  tabs,
  children,
}: {
  title: string;
  tabs?: TitleTab[];
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      {tabs ? (
        <header>
          <h1 className={styles.srOnly}>{title}</h1>
          <TitleTabs label={title} tabs={tabs} />
        </header>
      ) : (
        <h1 className={`${styles.titleTab} ${styles.titleTabActive}`}>{title}</h1>
      )}
      <div className={styles.embedded}>{children}</div>
    </div>
  );
}

const useAccountTabs = (): TitleTab[] => {
  const { t } = useTranslation();
  return [
    { to: '/ledger', label: t('ledger.nav_accounts'), end: true },
    { to: '/ledger/routing', label: t('ledger.nav_routing') },
  ];
};


export function AccountTabs() {
  const { t } = useTranslation();
  return <TitleTabs label={t('ledger.nav_accounts')} tabs={useAccountTabs()} />;
}

export function RoutingRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_routing')} tabs={useAccountTabs()}>
      <RoutingScreen />
    </Section>
  );
}

const useProviderTabs = (): TitleTab[] => {
  const { t } = useTranslation();
  return [
    { to: '/ledger/providers', label: t('ledger.nav_providers') },
    { to: '/ledger/models/aliases', label: t('ledger.models_aliases') },
    { to: '/ledger/models/excluded', label: t('ledger.models_excluded') },
  ];
};

export function ProvidersRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_providers')} tabs={useProviderTabs()}>
      <ProvidersWorkbenchPage />
    </Section>
  );
}

export function ModelsRoutes() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_providers')} tabs={useProviderTabs()}>
      <Routes>
        <Route path="aliases" element={<AuthFilesOAuthModelAliasEditPage />} />
        <Route path="excluded" element={<AuthFilesOAuthExcludedEditPage />} />
        <Route path="*" element={<Navigate to="/ledger/models/aliases" replace />} />
      </Routes>
    </Section>
  );
}

export function LogsRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_logs')}>
      <LogsPage />
    </Section>
  );
}

export function ConfigRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_config')}>
      <ConfigPage />
    </Section>
  );
}

const usePluginTabs = (): TitleTab[] => {
  const { t } = useTranslation();
  return [
    { to: '/ledger/plugins', label: t('ledger.nav_plugins') },
    { to: '/ledger/plugin-store', label: t('ledger.nav_plugin_store') },
  ];
};

export function PluginsRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_plugins')} tabs={usePluginTabs()}>
      <PluginsPage />
    </Section>
  );
}

export function PluginStoreRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_plugin_store')} tabs={usePluginTabs()}>
      <PluginStorePage />
    </Section>
  );
}

export function SystemRoute() {
  const { t } = useTranslation();
  return (
    <Section title={t('ledger.nav_system')}>
      <SystemPage />
    </Section>
  );
}
