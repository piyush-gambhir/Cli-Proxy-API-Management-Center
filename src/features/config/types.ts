import type { VisualConfigValidationErrors, VisualConfigValues } from '@/types/visualConfig';


export type ConfigSectionProps = {
  values: VisualConfigValues;
  validationErrors?: VisualConfigValidationErrors;
  disabled: boolean;

  animateIn?: boolean;
  onChange: (patch: Partial<VisualConfigValues>) => void;
};
