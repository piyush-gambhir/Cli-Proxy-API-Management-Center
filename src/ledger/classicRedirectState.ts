/** Flag and path map behind ClassicRedirect (classicRedirect.tsx explains the rules). */

let inLedger = false;

export const isInLedger = () => inLedger;

export const setInLedger = (value: boolean) => {
  inLedger = value;
};

/** Classic path prefix to ledger path. The first matching prefix wins; longer prefixes go first. */
const CLASSIC_TO_LEDGER: Array<[string, string]> = [
  ['/auth-files/oauth-model-alias', '/ledger/models/aliases'],
  ['/auth-files/oauth-excluded', '/ledger/models/excluded'],
  ['/auth-files', '/ledger'],
  ['/dashboard', '/ledger'],
  ['/ai-providers', '/ledger/providers'],
  ['/quota', '/ledger'],
  ['/routing', '/ledger'],
  ['/plugin-store', '/ledger/plugin-store'],
  ['/plugin-pages', '/ledger/plugin-pages'],
  ['/plugins', '/ledger/plugins'],
  ['/config', '/ledger/config'],
  ['/settings', '/ledger/config'],
  ['/api-keys', '/ledger/config'],
  ['/logs', '/ledger/logs'],
  ['/system', '/ledger/system'],
];

/** The ledger path for a classic path, or null when the ledger has no equivalent. */
export function ledgerPathFor(pathname: string): string | null {
  for (const [classic, ledger] of CLASSIC_TO_LEDGER) {
    if (pathname === classic) return ledger;
    if (pathname.startsWith(`${classic}/`)) {
      // Plugin resource pages keep their parameters; other sub-paths open the section itself.
      return classic === '/plugin-pages' ? `${ledger}${pathname.slice(classic.length)}` : ledger;
    }
  }
  return null;
}
