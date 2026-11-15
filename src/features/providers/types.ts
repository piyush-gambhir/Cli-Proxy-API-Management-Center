



import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types';
import type { ThinkingLevel } from './thinkingLevels';
import type { RuntimePolicyDraft } from './runtimePolicy';
import type { ModelOptionsInput } from './modelOptions';
import type { ProviderBehaviorOptions } from '@/types/provider';

export type ProviderBrand =
  | 'gemini'
  | 'interactions'
  | 'codex'
  | 'meta'
  | 'xai'
  | 'claude'
  | 'vertex'
  | 'openaiCompatibility'
  | 'apikeyFun'
  | 'fennoAI'
  | 'qiniuCloud'
  | 'aiCodeMirror'
  | 'kimi';

export type SponsorProviderBrand = 'apikeyFun' | 'fennoAI' | 'qiniuCloud' | 'aiCodeMirror' | 'kimi';

export const PROVIDER_SORT_BY_VALUES = ['name', 'priority', 'recent-success'] as const;
export type ProviderSortBy = (typeof PROVIDER_SORT_BY_VALUES)[number];

export const SORT_DIR_VALUES = ['asc', 'desc'] as const;
export type SortDir = (typeof SORT_DIR_VALUES)[number];

export type ProviderResourceSelector =
  | { brand: 'gemini'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'interactions'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'codex'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'meta'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'xai'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'claude'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'vertex'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'openaiCompatibility'; name: string; index: number }
  | {
      brand: 'apikeyFun';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    }
  | {
      brand: 'fennoAI';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    }
  | {
      brand: 'qiniuCloud';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    }
  | {
      brand: 'aiCodeMirror';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    }
  | {
      brand: 'kimi';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    };

export interface ProviderResourceFlags {
  cloakEnabled?: boolean;
  claudeCodeCliProfile?: boolean;
  websockets?: boolean;
  protocols?: string[];
}

export interface ProviderResource {

  id: string;
  brand: ProviderBrand;

  originalIndex: number;

  name: string | null;

  identifier: string;

  apiKeyPreview: string | null;

  apiKey: string | null;
  authIndex: string | null;
  baseUrl: string | null;
  proxyUrl: string | null;
  prefix: string | null;
  modelCount: number;

  models: string[];

  priority: number;
  headerCount: number;
  excludedModelCount: number;

  apiKeyEntryCount: number;

  disabled: boolean;

  flags: ProviderResourceFlags;

  selector: ProviderResourceSelector;

  raw: unknown;
}

export interface ProviderGroup {
  id: ProviderBrand;
  resources: ProviderResource[];
}

export interface ProviderSnapshot {
  fetchedAt: string;
  groups: ProviderGroup[];
}

export interface SponsorProviderRaw {
  openai: Array<{ config: OpenAIProviderConfig; index: number }>;
  claude: Array<{ config: ProviderKeyConfig; index: number }>;
  codex: Array<{ config: ProviderKeyConfig; index: number }>;
  gemini: Array<{ config: GeminiKeyConfig; index: number }>;
}





export interface ModelEntryInput extends ModelOptionsInput {

  fork?: boolean;
  sourceIndex?: number | null;
  name: string;
  alias?: string;
  priority?: number;
  image?: boolean;

  thinkingJson?: string;
  thinkingLevels?: ThinkingLevel[];
  thinkingLevelsTouched?: boolean;
}

export type SponsorProtocol = 'openai' | 'codex' | 'claude' | 'gemini';

export interface SponsorKeyEntryInput extends ProviderBehaviorOptions {
  protocol: SponsorProtocol;
  apiKey: string;
  existingApiKey?: string;
  baseUrl: string;
  proxyUrl: string;
  prefix: string;
  disabled: boolean;
  disableCooling?: boolean;
  runtimePolicy?: RuntimePolicyDraft;
  priority?: number;
  weight?: number;
  models: ModelEntryInput[];
}

export interface ApiKeyEntryInput {
  sourceIndex?: number;
  apiKey: string;
  existingApiKey?: string;
  proxyUrl: string;
  weight?: number;
  authIndex?: string;
}

export interface CloakInput {
  mode: string;
  strictMode: boolean;
  sensitiveWordsText: string;
  cacheUserId: boolean;
}

export interface ProviderEntryFormInput extends ProviderBehaviorOptions {

  apiKey: string;

  name: string;
  baseUrl: string;
  proxyUrl: string;
  prefix: string;
  disabled: boolean;
  disableCooling?: boolean;
  runtimePolicy?: RuntimePolicyDraft;
  priority?: number;
  weight?: number;


  models: ModelEntryInput[];
  headers: Array<{ key: string; value: string }>;
  excludedModelsText: string;


  websockets?: boolean;

  cloak?: CloakInput;
  fingerprintProfile?: string;

  testModel?: string;
  apiKeyEntries?: ApiKeyEntryInput[];

  sponsorKeyEntries?: SponsorKeyEntryInput[];
}
