















import type { XaiBillingSummary } from '@/types';
import { resolvePlanTier } from '@/utils/quota';
import type { QuotaClassMap } from './types';

export type QuotaCardTier = 'standard' | 'premium' | 'flagship';


export const XAI_SUPERGROK_LIMIT_CENTS = 15_000;
export const XAI_SUPERGROK_HEAVY_LIMIT_CENTS = 150_000;

export function resolveCodexCardTier(planType: string | null | undefined): QuotaCardTier {
  const tier = resolvePlanTier(planType);
  if (tier === 'elite') return 'flagship';
  if (tier === 'premium') return 'premium';
  return 'standard';
}


export function resolveKimiCardTier(planName: string | null | undefined): QuotaCardTier {
  const normalized = planName?.trim().toLowerCase();
  if (normalized === 'allegro') return 'flagship';
  if (normalized === 'allegretto') return 'premium';
  return 'standard';
}

export function resolveAntigravityCardTier(plan: string | null | undefined): QuotaCardTier {
  const normalized = plan?.trim().toLowerCase() ?? '';
  if (normalized === 'ultra') return 'flagship';
  if (normalized === 'ultra-lite') return 'premium';
  return 'standard';
}

export function resolveClaudeCardTier(planType: string | null | undefined): QuotaCardTier {
  if (planType === 'plan_max20') return 'flagship';

  if (planType === 'plan_max5' || planType === 'plan_max') return 'premium';
  return 'standard';
}

export function resolveXaiCardTier(billing: XaiBillingSummary): QuotaCardTier {
  if (billing.planLabel) {
    if (billing.planTier === 'elite') return 'flagship';
    if (billing.planTier === 'premium') return 'premium';
    return 'standard';
  }

  if (billing.mode === 'paid-health') return 'premium';

  if (billing.monthlyLimitCents === XAI_SUPERGROK_HEAVY_LIMIT_CENTS) return 'flagship';
  if (billing.monthlyLimitCents === XAI_SUPERGROK_LIMIT_CENTS) return 'premium';
  return 'standard';
}


export function planValueClassForTier(tier: QuotaCardTier, classes: QuotaClassMap): string {
  if (tier === 'flagship') return classes.elitePlanValue;
  if (tier === 'premium') return classes.premiumPlanValue;
  return classes.codexPlanValue;
}
