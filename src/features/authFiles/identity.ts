
















import type { AuthFileItem } from '@/types';

export type AuthFileIdentityKind = 'email' | 'projectId' | 'fileName';

export type AuthFileIdentity = {

  primary: string;

  kind: AuthFileIdentityKind;

  secondary: string | null;

  fullName: string;
};


const readIdentityText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';


export const stripJsonExtension = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length <= 5) return trimmed;
  return trimmed.toLowerCase().endsWith('.json') ? trimmed.slice(0, -5) : trimmed;
};






export const deriveAuthFileIdentity = (file: AuthFileItem): AuthFileIdentity => {
  const fullName = readIdentityText(file.name);
  const base = stripJsonExtension(fullName);
  const email = readIdentityText(file.email);
  const projectId = readIdentityText(file.projectId);

  const kind: AuthFileIdentityKind = email ? 'email' : projectId ? 'projectId' : 'fileName';
  const primary = email || projectId || base;

  const secondary =
    kind === 'fileName' || !base || base.toLowerCase() === primary.toLowerCase() ? null : base;

  return { primary, kind, secondary, fullName };
};
