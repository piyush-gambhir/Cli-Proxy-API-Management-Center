







import type { ResetDisplay } from '@/utils/quota';
import type { QuotaClassMap } from '../types';

export interface QuotaResetLabelProps {
  display: ResetDisplay;
  classes: QuotaClassMap;

  soon?: boolean;
}

export function QuotaResetLabel({ display, classes, soon = false }: QuotaResetLabelProps) {
  return (
    <>
      <span className={classes.quotaReset}>{display.absolute}</span>
      {display.relative && (
        <span
          className={
            soon
              ? `${classes.quotaResetRelative} ${classes.quotaResetRelativeSoon}`
              : classes.quotaResetRelative
          }
        >
          {display.relative}
        </span>
      )}
    </>
  );
}
