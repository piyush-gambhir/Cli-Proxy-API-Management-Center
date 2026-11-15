





export interface ApiClientConfig {
  apiBase: string;
  managementKey: string;
  timeout?: number;
}


export type ApiError = Error & {
  status?: number;

  code?: string;

  apiCode?: string;
  details?: unknown;
  data?: unknown;
};
