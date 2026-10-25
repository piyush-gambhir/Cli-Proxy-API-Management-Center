import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import type { QuotaCardState } from '@/features/quota/providers';
import { AccountRow, type AccountRowProps } from '@/ledger/accounts/AccountRow';

const translations = i18n.cloneInstance({ lng: 'en' });
const noop = () => {};

const render = (disabled: boolean) => {
  const file = { name: 'codex-paused.json', type: 'codex', authIndex: 'idx', disabled };
  const props: AccountRowProps = {
    file,
    entry: { file, type: 'codex' },
    quota: {
      status: 'success',
      windows: [{ id: 'weekly', label: 'Weekly limit', usedPercent: 8, resetLabel: '' }],
    } as unknown as QuotaCardState,
    resolvedTheme: 'light',
    showEmails: true,
    disableControls: false,
    statusUpdating: false,
    deleting: false,
    resetting: false,
    onToggleStatus: noop,
    onRefreshQuota: noop,
    onResetQuota: noop,
    onShowModels: noop,
    onOpenSettings: noop,
    onDownload: noop,
    onDelete: noop,
  };
  return renderToStaticMarkup(
    createElement(I18nextProvider, { i18n: translations }, createElement(AccountRow, props))
  );
};

describe('AccountRow', () => {
  test('a paused account keeps showing its quota and can still refresh it', () => {
    const html = render(true);
    expect(html).toContain('Paused');
    expect(html).toContain('Weekly limit');
    expect(html).toContain('92%');
    expect(html).toMatch(/aria-label="Refresh quota"(?![^>]*disabled)/);
    expect(html).toContain('aria-checked="false"');
  });

  test('an enabled account renders the same limits without the paused label', () => {
    const html = render(false);
    expect(html).not.toContain('Paused');
    expect(html).toContain('92%');
  });
});
