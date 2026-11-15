import type { PluginStoreEntry, PluginStoreLocale } from '@/types';



const STORE_LOCALE_CHAINS: Record<string, readonly string[]> = {
  'zh-CN': ['zh-CN', 'zh-Hans', 'zh'],
  'zh-TW': ['zh-TW', 'zh-HK', 'zh-Hant'],
  en: ['en'],
  ru: ['ru'],
  vi: ['vi'],
  ko: ['ko'],
  tr: ['tr'],
};

export type PluginStoreLocalizedFields = Pick<
  PluginStoreEntry,
  'name' | 'description' | 'author' | 'homepage' | 'license' | 'tags'
>;

const firstLocale = (entry: PluginStoreEntry, chain: readonly string[]) => {
  const locales = entry.locales;
  if (!locales) return undefined;


  const byKey = new Map(
    Object.entries(locales).map(
      ([key, locale]) => [key.trim().toLowerCase().replace(/_/g, '-'), locale] as const
    )
  );
  return chain.map((key) => byKey.get(key.toLowerCase())).find((locale) => locale !== undefined);
};




export const getStoreEntryDisplay = (
  entry: PluginStoreEntry,
  language: string
): PluginStoreLocalizedFields => {
  const locale: PluginStoreLocale | undefined = firstLocale(
    entry,
    STORE_LOCALE_CHAINS[language] ?? []
  );
  const tags = locale?.tags?.map((tag) => tag.trim()).filter(Boolean);
  return {
    name: locale?.name?.trim() || entry.name,
    description: locale?.description?.trim() || entry.description,
    author: locale?.author?.trim() || entry.author,
    homepage: locale?.homepage?.trim() || entry.homepage,
    license: locale?.license?.trim() || entry.license,
    tags: tags?.length ? tags : entry.tags,
  };
};
