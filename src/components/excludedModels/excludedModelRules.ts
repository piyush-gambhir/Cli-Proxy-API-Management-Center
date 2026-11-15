













export const DISABLE_ALL_RULE = '*';

const ruleKey = (value: string): string => value.trim().toLowerCase();

export const isWildcardRule = (rule: string): boolean => rule.includes('*');

export function normalizeExcludedRules(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const rules: string[] = [];

  for (const value of values) {
    const rule = value.trim();
    const key = ruleKey(rule);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
  }

  return rules;
}

export const parseExcludedRulesText = (text: string): string[] =>
  normalizeExcludedRules(text.split(/\r?\n/));

export const formatExcludedRulesText = (rules: readonly string[]): string => rules.join('\n');

export function matchesExcludedRule(rule: string, modelId: string): boolean {
  const normalizedRule = ruleKey(rule);
  const normalizedModel = ruleKey(modelId);
  if (!normalizedRule || !normalizedModel) return false;
  if (!isWildcardRule(normalizedRule)) return normalizedRule === normalizedModel;


  const escaped = normalizedRule
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(normalizedModel);
}


export const isMatchedByWildcardRule = (rules: Iterable<string>, modelId: string): boolean =>
  Array.from(rules).some((rule) => isWildcardRule(rule) && matchesExcludedRule(rule, modelId));


export function hasExcludedRule(rules: Iterable<string>, candidate: string): boolean {
  const candidateKey = ruleKey(candidate);
  if (!candidateKey) return false;
  return Array.from(rules).some((rule) => ruleKey(rule) === candidateKey);
}








export function toggleExcludedRule(
  rules: Iterable<string>,
  candidate: string,
  excluded: boolean
): string[] {
  const candidateRule = candidate.trim();
  const candidateKey = ruleKey(candidateRule);
  const next = normalizeExcludedRules(rules).filter((rule) => ruleKey(rule) !== candidateKey);

  if (excluded && candidateKey) next.push(candidateRule);
  return next;
}

export interface SplitExcludedRules {

  exactRules: string[];

  wildcardRules: string[];

  unknownRules: string[];

  customRules: string[];
}

export function splitExcludedRules(
  rules: Iterable<string>,
  candidateIds: readonly string[]
): SplitExcludedRules {
  const candidateByKey = new Map(candidateIds.map((id) => [ruleKey(id), id]));
  const exactRules: string[] = [];
  const wildcardRules: string[] = [];
  const unknownRules: string[] = [];
  const customRules: string[] = [];

  normalizeExcludedRules(rules).forEach((rule) => {
    if (isWildcardRule(rule)) {
      wildcardRules.push(rule);
      customRules.push(rule);
      return;
    }
    const candidate = candidateByKey.get(ruleKey(rule));
    if (candidate) {
      exactRules.push(candidate);
      return;
    }
    unknownRules.push(rule);
    customRules.push(rule);
  });

  return { exactRules, wildcardRules, unknownRules, customRules };
}


export function replaceCustomExcludedRules(
  rules: Iterable<string>,
  candidateIds: readonly string[],
  text: string
): string[] {
  const { exactRules } = splitExcludedRules(rules, candidateIds);
  return normalizeExcludedRules([...exactRules, ...parseExcludedRulesText(text)]);
}












export type ModelExclusionState =
  | { state: 'included' }
  | { state: 'excluded'; by: 'exact' }
  | { state: 'excluded'; by: 'wildcard'; rule: string }
  | { state: 'excluded'; by: 'both'; rule: string };

export function getModelExclusionState(
  rules: readonly string[],
  modelId: string
): ModelExclusionState {
  const modelKey = ruleKey(modelId);
  if (!modelKey) return { state: 'included' };

  let hasExact = false;
  let wildcard: string | undefined;

  for (const rule of rules) {
    if (isWildcardRule(rule)) {
      if (wildcard === undefined && matchesExcludedRule(rule, modelId)) wildcard = rule;
    } else if (!hasExact && ruleKey(rule) === modelKey) {
      hasExact = true;
    }
  }

  if (hasExact && wildcard !== undefined) return { state: 'excluded', by: 'both', rule: wildcard };
  if (hasExact) return { state: 'excluded', by: 'exact' };
  if (wildcard !== undefined) return { state: 'excluded', by: 'wildcard', rule: wildcard };
  return { state: 'included' };
}

export const isModelExcluded = (rules: readonly string[], modelId: string): boolean =>
  getModelExclusionState(rules, modelId).state === 'excluded';

export interface RuleMatchSummary {
  rule: string;

  matched: string[];
  matchCount: number;
}


export const matchedModelsByRule = (
  rules: readonly string[],
  candidateIds: readonly string[]
): RuleMatchSummary[] =>
  rules.map((rule) => {
    const matched = candidateIds.filter((id) => matchesExcludedRule(rule, id));
    return { rule, matched, matchCount: matched.length };
  });

export interface ExclusionStats {
  total: number;
  excluded: number;
  available: number;
}








export function summarizeExclusion(
  rules: readonly string[],
  candidateIds: readonly string[]
): ExclusionStats {
  const total = candidateIds.length;
  const excluded = candidateIds.reduce(
    (count, id) => (isModelExcluded(rules, id) ? count + 1 : count),
    0
  );
  return { total, excluded, available: total - excluded };
}
