













import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { isInLedger, ledgerPathFor } from './classicRedirectState';

export function ClassicRedirect({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  const target = isInLedger() && navigationType !== 'POP' ? ledgerPathFor(pathname) : null;
  if (target) return <Navigate to={`${target}${search}`} replace />;
  return children;
}
