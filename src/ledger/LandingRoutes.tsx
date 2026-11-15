




import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { LoginPage } from '@/pages/LoginPage';
import { isLanding, setLanding } from './landingState';
import styles from './LandingRoutes.module.scss';


export function LoginEntry() {
  useEffect(() => {
    setLanding(true);
  }, []);
  return <LoginPage />;
}





export function ClassicEntry() {
  const { pathname } = useLocation();

  const [toLedger] = useState(() => isLanding() && pathname === '/');
  useEffect(() => {
    setLanding(false);
  }, []);
  const { t } = useTranslation();
  if (toLedger) return <Navigate to="/ledger" replace />;

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
