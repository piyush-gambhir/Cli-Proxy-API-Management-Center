import type { BuiltInOAuthProvider } from '@/services/api';
import { getPluginTitle, resolvePluginAssetURL } from '@/features/plugins/pluginResources';
import {
  KIMI_CHINESE_AFFILIATE_URL,
  KIMI_INTERNATIONAL_AFFILIATE_URL,
} from '@/features/providers/kimi';
import type { PluginListEntry } from '@/types';
import iconMeta from '@/assets/icons/meta.svg';
import iconCodex from '@/assets/icons/codex.svg';
import iconClaude from '@/assets/icons/claude.svg';
import iconAntigravity from '@/assets/icons/antigravity.svg';

import iconKimiTileBlack from '@/assets/icons/kimi-tile-black.svg';
import iconKimiTileWhite from '@/assets/icons/kimi-tile-white.svg';
import iconGrok from '@/assets/icons/grok.svg';
import iconGrokDark from '@/assets/icons/grok-dark.svg';
import iconDevin from '@/assets/icons/devin.svg';
import iconDevinDark from '@/assets/icons/devin-dark.svg';

export type ThemedIcon = string | { light: string; dark: string };


export type OAuthFlowKind = 'device' | 'browser';

export interface BuiltInOAuthProviderCard {
  kind: 'builtin';
  id: BuiltInOAuthProvider;

  label: string | { key: string };

  titleKey: string;
  icon: ThemedIcon;
  flow: OAuthFlowKind;

  domain?: string;




  sponsor?: SponsorSite;
}

export interface SponsorSite {
  signUpUrl: string;
  siteKey: string;
}

export interface PluginOAuthProviderCard {
  kind: 'plugin';
  id: string;
  title: string;
  icon: string;
}

export type OAuthProviderCard = BuiltInOAuthProviderCard | PluginOAuthProviderCard;


export const OAUTH_PROVIDERS: BuiltInOAuthProviderCard[] = [
  {
    kind: 'builtin',
    id: 'kimi',
    label: { key: 'auth_login.kimi_oauth_name' },
    titleKey: 'auth_login.kimi_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.com',
    sponsor: { signUpUrl: KIMI_CHINESE_AFFILIATE_URL, siteKey: 'auth_login.sponsor_site_china' },
  },
  {
    kind: 'builtin',
    id: 'kimi-ai',
    label: { key: 'auth_login.kimi_ai_oauth_name' },
    titleKey: 'auth_login.kimi_ai_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.ai',
    sponsor: {
      signUpUrl: KIMI_INTERNATIONAL_AFFILIATE_URL,
      siteKey: 'auth_login.sponsor_site_international',
    },
  },
  {
    kind: 'builtin',
    id: 'meta',
    label: 'Muse (Meta)',
    titleKey: 'auth_login.meta_oauth_title',
    icon: iconMeta,
    flow: 'device',
  },
  {
    kind: 'builtin',
    id: 'codex',
    label: 'Codex',
    titleKey: 'auth_login.codex_oauth_title',
    icon: iconCodex,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'anthropic',
    label: 'Claude',
    titleKey: 'auth_login.anthropic_oauth_title',
    icon: iconClaude,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'antigravity',
    label: 'Antigravity',
    titleKey: 'auth_login.antigravity_oauth_title',
    icon: iconAntigravity,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'xai',
    label: 'xAI',
    titleKey: 'auth_login.xai_oauth_title',
    icon: { light: iconGrok, dark: iconGrokDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'devin',
    label: 'Devin',
    titleKey: 'auth_login.devin_oauth_title',
    icon: { light: iconDevin, dark: iconDevinDark },
    flow: 'browser',
  },
];

const BUILTIN_PROVIDER_IDS = new Set<string>(OAUTH_PROVIDERS.map((provider) => provider.id));


export const CALLBACK_SUPPORTED = new Set<string>([
  'codex',
  'anthropic',
  'antigravity',
  'xai',
  'devin',
]);

export const supportsManualCallback = (provider: OAuthProviderCard): boolean =>
  provider.kind === 'plugin' || CALLBACK_SUPPORTED.has(provider.id);

export const isSponsor = (
  provider: OAuthProviderCard
): provider is BuiltInOAuthProviderCard & { sponsor: SponsorSite } =>
  provider.kind === 'builtin' && Boolean(provider.sponsor);

export const resolveThemedIcon = (icon: ThemedIcon, theme: 'light' | 'dark'): string =>
  typeof icon === 'string' ? icon : icon[theme];





export const buildPluginOAuthProviderCards = (
  plugins: PluginListEntry[],
  apiBase: string
): PluginOAuthProviderCard[] => {
  const seenProviders = new Set(BUILTIN_PROVIDER_IDS);
  return plugins.flatMap((plugin) => {
    if (!plugin.supportsOAuth || !plugin.effectiveEnabled) return [];
    const declared = plugin.oauthProviders?.length
      ? plugin.oauthProviders
      : plugin.oauthProvider
        ? [plugin.oauthProvider]
        : [];
    const pluginTitle = getPluginTitle(plugin);
    const pluginLogo = plugin.logo || plugin.metadata?.logo || '';
    return declared.flatMap((provider) => {
      if (seenProviders.has(provider)) return [];
      seenProviders.add(provider);
      const entry = plugin.oauthProviderEntries?.find((item) => item.identifier === provider);
      return [
        {
          kind: 'plugin' as const,
          id: provider,
          title: entry?.name?.trim() || pluginTitle,
          icon: resolvePluginAssetURL(entry?.logo?.trim() || pluginLogo, apiBase),
        },
      ];
    });
  });
};
