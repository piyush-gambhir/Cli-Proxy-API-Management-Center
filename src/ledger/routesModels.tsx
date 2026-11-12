/**
 * The Providers section: upstream's providers workbench plus its provider-wide OAuth model alias
 * and excluded models editors (classic reaches those from Auth Files), behind plain tabs.
 * The editors live at /ledger/models/aliases and /ledger/models/excluded.
 * Routing lives under Accounts (/ledger/routing): it orders those same accounts.
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ProvidersWorkbenchPage } from '@/features/providers/ProvidersWorkbenchPage';
import { RoutingPage } from '@/features/routing/RoutingPage';
import { AuthFilesOAuthExcludedEditPage } from '@/pages/AuthFilesOAuthExcludedEditPage';
import { AuthFilesOAuthModelAliasEditPage } from '@/pages/AuthFilesOAuthModelAliasEditPage';
import { useLedgerUi } from './uiState';
import { useMaskedSubtree } from './useMaskedSubtree';
import styles from './LedgerLayout.module.scss';

function ProviderTabs() {
  const { t } = useTranslation();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `${styles.tab} ${isActive ? styles.tabActive : ''}`;
  return (
    <nav className={styles.tabs} aria-label={t('ledger.nav_providers')}>
      <NavLink to="/ledger/providers" className={tab}>
        {t('ledger.nav_providers')}
      </NavLink>
      <NavLink to="/ledger/models/aliases" className={tab}>
        {t('ledger.models_aliases')}
      </NavLink>
      <NavLink to="/ledger/models/excluded" className={tab}>
        {t('ledger.models_excluded')}
      </NavLink>
    </nav>
  );
}

export function ProvidersRoute() {
  return (
    <>
      <ProviderTabs />
      <ProvidersWorkbenchPage />
    </>
  );
}

export function ModelsRoutes() {
  return (
    <>
      <ProviderTabs />
      <Routes>
        <Route path="aliases" element={<AuthFilesOAuthModelAliasEditPage />} />
        <Route path="excluded" element={<AuthFilesOAuthExcludedEditPage />} />
        <Route path="*" element={<Navigate to="/ledger/models/aliases" replace />} />
      </Routes>
    </>
  );
}

/** Accounts and the routing board that orders them: two title-sized tabs of one section. */
export function AccountTabs() {
  const { t } = useTranslation();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `${styles.titleTab} ${isActive ? styles.titleTabActive : ''}`;
  return (
    <nav className={styles.titleTabs} aria-label={t('ledger.nav_accounts')}>
      <NavLink to="/ledger" end className={tab}>
        {t('ledger.nav_accounts')}
      </NavLink>
      <NavLink to="/ledger/routing" className={tab}>
        {t('ledger.nav_routing')}
      </NavLink>
    </nav>
  );
}

export function RoutingRoute() {
  const hostRef = useRef<HTMLDivElement>(null);
  // The routing board is upstream's and shows raw emails; follow the Accounts tab's eye toggle.
  const showEmails = useLedgerUi((state) => state.showEmails);
  useMaskedSubtree(hostRef, !showEmails);
  return (
    <div className={styles.routingHost} ref={hostRef}>
      <AccountTabs />
      <RoutingPage />
    </div>
  );
}
