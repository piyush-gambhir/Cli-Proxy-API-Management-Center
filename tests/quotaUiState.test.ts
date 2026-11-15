







import { afterAll, beforeEach, describe, expect, test } from 'bun:test';
import { readQuotaUiState, writeQuotaUiState } from '@/features/quota/uiState';

const KEY = 'quotaPage.uiState';


const originalWindow = (globalThis as { window?: unknown }).window;


function installSessionStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  (globalThis as unknown as { window: unknown }).window = { sessionStorage: storage };
  return storage;
}

let storage: ReturnType<typeof installSessionStorage>;

beforeEach(() => {
  storage = installSessionStorage();
});

afterAll(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

describe('quota ui state', () => {
  test('round-trips both preferences', () => {
    writeQuotaUiState({ tab: 'codex', sortMode: 'soonest' });
    expect(readQuotaUiState()).toEqual({ tab: 'codex', sortMode: 'soonest' });
  });

  test('retains the Devin tab across visits', () => {
    writeQuotaUiState({ tab: 'devin', sortMode: 'soonest' });
    expect(readQuotaUiState()).toEqual({ tab: 'devin', sortMode: 'soonest' });
  });

  test('writing one preference preserves the other', () => {
    writeQuotaUiState({ sortMode: 'soonest' });
    writeQuotaUiState({ tab: 'kimi' });

    expect(readQuotaUiState()).toEqual({ tab: 'kimi', sortMode: 'soonest' });
  });

  test('rejects values that are not part of the current contract', () => {
    storage.setItem(KEY, JSON.stringify({ tab: 'not-a-tab', sortMode: 'by-vibes' }));
    expect(readQuotaUiState()).toEqual({ tab: undefined, sortMode: undefined });
  });

  test('survives absent, malformed, and non-object payloads', () => {
    expect(readQuotaUiState()).toBeNull();

    storage.setItem(KEY, '{not json');
    expect(readQuotaUiState()).toBeNull();

    storage.setItem(KEY, '"a string"');
    expect(readQuotaUiState()).toBeNull();
  });
});
