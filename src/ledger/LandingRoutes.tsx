/**
 * Route wrappers that make the ledger shell the default landing without touching upstream's
 * LoginPage (which always navigates to `/` after login) or MainLayout.
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { isLanding, setLanding } from './landingState';

/** Upstream's login page; whatever it opens next counts as a landing. */
export function LoginEntry() {
  useEffect(() => {
    setLanding(true);
  }, []);
  return <LoginPage />;
}

/** Upstream's shell, except that a landing on its root goes to the ledger shell instead. */
export function ClassicEntry() {
  const { pathname } = useLocation();
  // Decided once per mount; cleared in an effect so StrictMode's double render agrees.
  const [toLedger] = useState(() => isLanding() && pathname === '/');
  useEffect(() => {
    setLanding(false);
  }, []);
  return toLedger ? <Navigate to="/ledger" replace /> : <MainLayout />;
}
