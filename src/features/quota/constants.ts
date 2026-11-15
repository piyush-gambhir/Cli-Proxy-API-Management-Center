import type { QuotaProviderType } from './providers/types';


export const QUOTA_TAB_ORDER: readonly QuotaProviderType[] = [
  'claude',
  'antigravity',
  'codex',
  'xai',
  'kimi',
  'devin',
  'meta',
  'plugin',
];

export type QuotaTabId = 'all' | QuotaProviderType;


export const QUOTA_PAGE_SIZE = 20;


export const QUOTA_SORT_MODES = ['default', 'soonest'] as const;

export type QuotaSortMode = (typeof QUOTA_SORT_MODES)[number];


export const CARD_ENTRANCE_BUDGET_MS = 360;
