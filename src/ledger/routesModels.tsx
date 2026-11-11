/**
 * The Providers section: upstream's providers workbench plus its provider-wide OAuth model alias
 * and excluded models editors (classic reaches those from Auth Files), behind plain tabs.
 * The editors live at /ledger/models/aliases and /ledger/models/excluded.
 */

import { useTranslation } from 'react-i18next';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ProvidersWorkbenchPage } from '@/features/providers/ProvidersWorkbenchPage';
import { AuthFilesOAuthExcludedEditPage } from '@/pages/AuthFilesOAuthExcludedEditPage';
import { AuthFilesOAuthModelAliasEditPage } from '@/pages/AuthFilesOAuthModelAliasEditPage';
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
