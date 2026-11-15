import type { AuthFileItem } from '@/types';


export const getAuthFileRefreshKey = (file: AuthFileItem): string =>
  JSON.stringify([file.name, String(file.authIndex ?? '').trim()]);
