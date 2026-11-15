







import type { AuthFileCooldownSnapshot } from './authFile';
import type { RoutingStrategy } from './visualConfig';

export type { RoutingStrategy };

export const ROUTING_STRATEGIES: readonly RoutingStrategy[] = [
  'round-robin',
  'weighted-round-robin',
  'fill-first',
];


export const ROUTING_KEY_FAMILIES = [
  'gemini',
  'interactions',
  'codex',
  'meta',
  'xai',
  'claude',
  'vertex',
] as const;

export type RoutingKeyFamily = (typeof ROUTING_KEY_FAMILIES)[number];

export const ROUTING_COMPAT_FAMILY = 'openai-compatibility';

export type RoutingMemberKind = 'apiKey' | 'compat' | 'credential';

export type RoutingMemberLocation =
  | {
      kind: 'apiKey';
      family: RoutingKeyFamily;
      groupIndex: number;
      keyIndex: number;

      apiKey: string;
    }
  | { kind: 'compat'; groupIndex: number; name: string }
  | { kind: 'credential'; name: string };


export type RoutingModelSource =

  | { type: 'list'; models: string[] }

  | { type: 'channel'; channel: string }

  | { type: 'credential'; name: string }

  | { type: 'none' };

export interface RoutingWeightSlot {

  index: number;

  weight: number | null;

  label: string;
}

export interface RoutingMember {
  key: string;
  kind: RoutingMemberKind;

  family: string;
  name: string;
  detail: string;
  priority: number;
  weights: RoutingWeightSlot[];

  keyCount: number;
  disabled: boolean;

  locked: boolean;
  prefix: string;
  excludedModels: string[];
  modelSource: RoutingModelSource;

  unavailable: boolean;
  cooldowns: AuthFileCooldownSnapshot | null;
  location: RoutingMemberLocation;
}

export interface RoutingSettings {
  strategy: RoutingStrategy;
  sessionAffinity: boolean;
  requestRetry: number;

  maxRetryCredentials: number;
}

export interface RoutingBoard {
  members: RoutingMember[];
  settings: RoutingSettings;
  forceModelPrefix: boolean;
}

export interface RoutingTier {

  id: string;
  memberKeys: string[];
}

export interface RoutingDraft {

  tiers: RoutingTier[];

  weights: Record<string, (number | null)[]>;
  settings: RoutingSettings;
}


export type RoutingDropTarget = { kind: 'tier'; tierId: string } | { kind: 'gap'; index: number };


export interface RoutingModelCatalog {
  channels: Record<string, string[] | null>;
  credentials: Record<string, string[] | null>;
}

export type RoutingChange =
  | { kind: 'priority'; memberKey: string; from: number; to: number }
  | { kind: 'weight'; memberKey: string; index: number; from: number | null; to: number | null }
  | {
      kind: 'setting';
      field: keyof RoutingSettings;
      from: RoutingSettings[keyof RoutingSettings];
      to: RoutingSettings[keyof RoutingSettings];
    };

export interface RoutingPlan {
  changes: RoutingChange[];
  priorities: Record<string, number>;
  weights: Record<string, (number | null)[]>;
  settings: Partial<RoutingSettings>;
}

export type RouteMemberState =
  'serving' | 'excluded' | 'cooling' | 'blocked' | 'unknown' | 'ineligible' | 'disabled';

export type RouteTierState = 'active' | 'standby' | 'skipped' | 'cooling' | 'unknown';

export interface RouteMember {
  key: string;
  state: RouteMemberState;

  share: number | null;
}

export interface RouteTier {
  tierId: string;
  state: RouteTierState;
  members: RouteMember[];
}

export interface RoutePreview {
  tiers: RouteTier[];
  hasActive: boolean;
}
