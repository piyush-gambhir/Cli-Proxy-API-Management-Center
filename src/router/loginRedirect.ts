import type { Location } from 'react-router-dom';


export type LoginRedirectState = { from?: Pick<Location, 'pathname' | 'search'> };


export function resolveLoginRedirect(state: unknown): string {
  const from = (state as LoginRedirectState | null)?.from;
  const pathname = from?.pathname;
  if (!pathname || pathname === '/login') return '/';
  return `${pathname}${from?.search ?? ''}`;
}
