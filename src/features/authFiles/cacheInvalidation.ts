import { useQuotaStore } from '@/stores/useQuotaStore';

type ModelsInvalidator = (names?: string[]) => void;


export const invalidateAuthFileDerivedCaches = (
  invalidateModels: ModelsInvalidator,
  names?: string[]
): void => {
  invalidateModels(names);
  useQuotaStore.getState().clearQuotaCache(names);
};
