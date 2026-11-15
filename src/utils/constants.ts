




import type { Language } from '@/types';

const defineLanguageOrder = <T extends readonly Language[]>(
  languages: T & ([Language] extends [T[number]] ? unknown : never)
) => languages;


export const CACHE_EXPIRY_MS = 30 * 1000;


export const DEFAULT_API_PORT = 8317;
export const MANAGEMENT_API_PREFIX = '/v8/management';
export const REQUEST_TIMEOUT_MS = 30 * 1000;
export const CPA_VERSION_HEADER_KEYS = ['x-cpa-version'];
export const CPA_BUILD_DATE_HEADER_KEYS = ['x-cpa-build-date'];
export const CPA_SUPPORT_PLUGIN_HEADER_KEYS = ['x-cpa-support-plugin'];
export const VERSION_HEADER_KEYS = [...CPA_VERSION_HEADER_KEYS, 'x-server-version'];
export const BUILD_DATE_HEADER_KEYS = [...CPA_BUILD_DATE_HEADER_KEYS, 'x-server-build-date'];


export const LOGS_TIMEOUT_MS = 60 * 1000;


export const MAX_AUTH_FILE_SIZE = 10 * 1024 * 1024;


export const STORAGE_KEY_AUTH = 'cli-proxy-auth';
export const STORAGE_KEY_THEME = 'cli-proxy-theme';
export const STORAGE_KEY_LANGUAGE = 'cli-proxy-language';


export const LANGUAGE_ORDER = defineLanguageOrder([
  'zh-CN',
  'zh-TW',
  'en',
  'ru',
  'vi',
  'ko',
  'tr',
] as const);
export const LANGUAGE_LABEL_KEYS: Record<Language, string> = {
  'zh-CN': 'language.chinese',
  'zh-TW': 'language.chinese_tw',
  en: 'language.english',
  ru: 'language.russian',
  vi: 'language.vietnamese',
  ko: 'language.korean',
  tr: 'language.turkish',
};
export const SUPPORTED_LANGUAGES = LANGUAGE_ORDER;


export const NOTIFICATION_DURATION_MS = 3000;
