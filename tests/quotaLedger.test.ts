import { describe, expect, test } from 'bun:test';
import { summarizeCapacity, type CapacityInput } from '@/features/quota/summary';
import { maskEmails } from '@/utils/maskEmail';

const input = (
  provider: CapacityInput['provider'],
  limits: { id: string; remaining: number }[],
  nextResetMs: number | null = null
): CapacityInput => ({
  provider,
  limits: limits.map((limit) => ({ ...limit, label: limit.id })),
  nextResetMs,
});

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

describe('summarizeCapacity', () => {
  test('adds remaining percent per limit id and headlines the tightest limit', () => {
    const [claude] = summarizeCapacity([
      input('claude', [
        { id: '5-hour', remaining: 98 },
        { id: 'Weekly', remaining: 95 },
      ]),
      input('claude', [{ id: 'Weekly', remaining: 100 }]),
    ]);

    expect(claude.accounts).toBe(2);
    expect(claude.headline).toEqual({
      id: 'Weekly',
      label: 'Weekly',
      left: 195,
      total: 200,
      segments: [95, 100],
    });
    expect(claude.others.map((limit) => [limit.id, limit.left, limit.total])).toEqual([
      ['5-hour', 98, 100],
    ]);
  });

  test('keeps distinct limit ids apart even when labels would collide', () => {
    const [kimi] = summarizeCapacity([
      input('kimi', [
        { id: '#0', remaining: 80 },
        { id: '#1', remaining: 50 },
      ]),
    ]);

    expect(kimi.headline).toMatchObject({ id: '#1', left: 50, total: 100 });
    expect(kimi.others).toHaveLength(1);
  });

  test('takes the soonest reset across accounts and skips accounts without limits', () => {
    const result = summarizeCapacity([
      input('codex', [{ id: 'Weekly', remaining: 93 }], 9_000),
      input('codex', [{ id: 'Monthly', remaining: 100 }], 4_000),
      input('xai', [], 1_000),
    ]);

    expect(result.map((entry) => entry.provider)).toEqual(['codex']);
    expect(result[0].soonestResetMs).toBe(4_000);
  });
});
