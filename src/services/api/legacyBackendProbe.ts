import axios from 'axios';
import { normalizeApiBase } from '@/utils/connection';


export class LegacyBackendError extends Error {
  constructor() {
    super('The backend supports v0 management but not v8 management');
    this.name = 'LegacyBackendError';
  }
}

export async function probeLegacyBackend(apiBase: string, managementKey: string): Promise<boolean> {
  const base = normalizeApiBase(apiBase);
  if (!base || !managementKey) return false;

  try {
    const response = await axios.get<unknown>(`${base}/v0/management/config`, {
      headers: { Authorization: `Bearer ${managementKey}` },
      timeout: 3000,

      maxRedirects: 0,
    });
    return (
      response.data !== null && typeof response.data === 'object' && !Array.isArray(response.data)
    );
  } catch {

    return false;
  }
}
