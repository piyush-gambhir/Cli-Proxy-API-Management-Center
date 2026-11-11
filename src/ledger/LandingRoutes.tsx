/**
 * Route wrappers that make the ledger shell the default landing without touching upstream's
 * LoginPage (which always navigates to `/` after login) or MainLayout.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { isLanding, setLanding } from './landingState';
import styles from './LandingRoutes.module.scss';

/** Upstream's login page; whatever it opens next counts as a landing. */
export function LoginEntry() {
  useEffect(() => {
    setLanding(true);
  }, []);
  return <LoginPage />;
}

/**
 * Upstream's shell, except that a landing on its root goes to the ledger shell instead, plus a
 * floating link back to the ledger shell.
 */
export function ClassicEntry() {
  const { pathname } = useLocation();
  // Decided once per mount; cleared in an effect so StrictMode's double render agrees.
  const [toLedger] = useState(() => isLanding() && pathname === '/');
  useEffect(() => {
    setLanding(false);
  }, []);
  const { t } = useTranslation();
  if (toLedger) return <Navigate to="/ledger" replace />;
  // The way back to the ledger shell; floats over upstream's layout so MainLayout stays untouched.
  return (
    <>
      <MainLayout />
      <Link to="/ledger" className={styles.toLedger}>
        {t('ledger.open_new')}
        <span aria-hidden="true">→</span>
      </Link>
    </>
  );
}
