













import { describe, expect, test } from 'bun:test';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';

const HOSTS = {
  'QuotaBody.module.scss': 'src/features/quota/components/QuotaBody.module.scss',
  'AuthFileQuota.module.scss': 'src/features/authFiles/components/AuthFileQuota.module.scss',
} as const;

const readHost = (path: string) => Bun.file(new URL(`../${path}`, import.meta.url)).text();

describe('quota class contract', () => {
  for (const [host, path] of Object.entries(HOSTS)) {
    test(`${host} gives standalone amounts the same size as quota metadata`, async () => {
      const css = await readHost(path);
      const amount = css.match(/\.quotaAmount\s*\{([^}]+)\}/)?.[1] ?? '';
      const meta = css.match(/\.quotaMeta\s*\{([^}]+)\}/)?.[1] ?? '';
      const size = amount.match(/font-size:\s*([^;]+);/)?.[1];
      expect(size).toBeDefined();
      expect(size).toBe(meta.match(/font-size:\s*([^;]+);/)?.[1]);
      expect(amount).toContain('font-family: $font-mono;');
      expect(amount).toContain('font-weight: 500;');
      expect(amount).toContain('font-variant-numeric: tabular-nums;');
    });

    test(`${host} defines every QuotaClassMap key`, async () => {
      const css = await readHost(path);
      const missing = QUOTA_CLASS_KEYS.filter(
        (key) => !new RegExp(`^\\s*\\.${key}\\b`, 'm').test(css)
      );
      expect(missing).toEqual([]);
    });
  }

  test('bindQuotaClasses reports every missing key rather than the first', () => {
    const partial = Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, `_${key}`]));
    delete partial.quotaReset;
    delete partial.quotaResetRelative;

    expect(() => bindQuotaClasses(partial, 'test-host')).toThrow(/quotaReset.*quotaResetRelative/);
  });

  test('bindQuotaClasses returns exactly the contract keys', () => {
    const full = Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, `_${key}`]));
    const bound = bindQuotaClasses({ ...full, strayKey: '_stray' }, 'test-host');

    expect(Object.keys(bound).sort()).toEqual([...QUOTA_CLASS_KEYS].sort());
  });
});
