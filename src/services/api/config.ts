



import { apiClient } from './client';
import type { Config } from '@/types';
import { normalizeConfigResponse } from './transformers';

export const configApi = {



  async getConfig(): Promise<Config> {
    const raw = await apiClient.get('/config');
    return normalizeConfigResponse(raw);
  },




  updateRequestLog: (enabled: boolean) =>
    apiClient.put('/config/observability/logs/request-log', enabled),
};
