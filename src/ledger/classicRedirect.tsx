/**
 * Keeps links inside the ledger shell. Upstream pages embedded in the shell link to classic paths
 * (the Plugins page's Store button opens `/plugin-store`, the dashboard's "Manage providers" opens
 * `/ai-providers`). App.tsx wraps the classic routes in ClassicRedirect, which sends such a link
 * to its `/ledger/...` equivalent while the ledger shell is the screen being left.
 *
 * The rules:
 * - LedgerLayout marks the shell as open while it is mounted (setInLedger in classicRedirectState.ts).
 * - Only link navigations (push or replace) are redirected. Back and forward (POP) and reloads
 *   still reach the classic page, so browser history keeps working.
 * - `/` has no mapping, so the sidebar's "Classic dashboard" link always opens the original.
 * - A classic path without a ledger screen (OAuth login, Quick Start) opens the original too.
 */

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
