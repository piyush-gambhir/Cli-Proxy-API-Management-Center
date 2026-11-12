import { describe, expect, test } from 'bun:test';
import { maskEmails } from '@/ledger/maskEmail';

describe('maskEmails', () => {
  test('keeps first letters and the top-level label', () => {
    expect(maskEmails('piyush.gambhir@spyne.ai')).toBe('p•••@s•••.ai');
    expect(maskEmails('developer.piyushgambhir@gmail.com')).toBe('d•••@g•••.com');
  });

  test('hides subdomains and the registered domain', () => {
    expect(maskEmails('alice@dept.example.com')).toBe('a•••@d•••.com');
  });

  test('masks non-Latin addresses', () => {
    expect(maskEmails('张三@例子.中国')).toBe('张•••@例•••.中国');
  });

  test('masks an address inside a filename and leaves other text alone', () => {
    expect(maskEmails('codex-bhaskar.bhardwaj@spyne.ai-pro.json')).toBe('c•••@s•••.json');
    expect(maskEmails('Quota refreshed for kiro-company.json')).toBe(
      'Quota refreshed for kiro-company.json'
    );
  });
});
