

let inLedger = false;

export const isInLedger = () => inLedger;

export const setInLedger = (value: boolean) => {
  inLedger = value;
};


const CLASSIC_TO_LEDGER: Array<[string, string]> = [
  ['/auth-files/oauth-model-alias', '/ledger/models/aliases'],
  ['/auth-files/oauth-excluded', '/ledger/models/excluded'],
  ['/auth-files', '/ledger'],
  ['/dashboard', '/ledger'],
  ['/ai-providers', '/ledger/providers'],
  ['/quota', '/ledger'],
  ['/routing', '/ledger/routing'],
  ['/plugin-store', '/ledger/plugin-store'],
  ['/plugin-pages', '/ledger/plugin-pages'],
  ['/plugins', '/ledger/plugins'],
  ['/config', '/ledger/config'],
  ['/settings', '/ledger/config'],
  ['/api-keys', '/ledger/config'],
  ['/logs', '/ledger/logs'],
  ['/system', '/ledger/system'],
];


export function ledgerPathFor(pathname: string): string | null {
  for (const [classic, ledger] of CLASSIC_TO_LEDGER) {
    if (pathname === classic) return ledger;
    if (pathname.startsWith(`${classic}/`)) {

      return classic === '/plugin-pages' ? `${ledger}${pathname.slice(classic.length)}` : ledger;
    }
  }
  return null;
}
