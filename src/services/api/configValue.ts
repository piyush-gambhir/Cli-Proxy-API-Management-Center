import { apiClient } from './client';


export function guardConfigConnection(): () => void {
  const revision = apiClient.getConnectionRevision();
  return () => {
    if (revision !== apiClient.getConnectionRevision()) {
      throw new DOMException('The management connection changed.', 'AbortError');
    }
  };
}


export const isMissingConfigValue = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  error.status === 404 &&
  'apiCode' in error &&
  error.apiCode === 'not_found';

export async function getConfigValue<T>(path: string, defaultValue: T): Promise<T> {
  try {
    return await apiClient.get<T>(path);
  } catch (error) {
    if (isMissingConfigValue(error)) return defaultValue;
    throw error;
  }
}
