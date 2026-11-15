





export interface LoginCredentials {
  apiBase: string;
  managementKey: string;
  rememberPassword?: boolean;
}


export interface AuthState {
  isAuthenticated: boolean;
  apiBase: string;
  managementKey: string;
  rememberPassword: boolean;
  serverVersion: string | null;
  serverBuildDate: string | null;
  supportsPlugin: boolean;
}


export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
