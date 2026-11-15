import { useLayoutEffect, type RefObject } from 'react';





export function useActionBarHeightVar(
  ref: RefObject<HTMLElement | null>,
  cssVar: string,
  active: boolean
) {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const actionsEl = active ? ref.current : null;
    if (!actionsEl) {
      document.documentElement.style.removeProperty(cssVar);
      return;
    }

    const updateHeight = () => {
      const height = actionsEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty(cssVar, `${height}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateHeight);
    ro?.observe(actionsEl);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateHeight);
      document.documentElement.style.removeProperty(cssVar);
    };
  }, [ref, cssVar, active]);
}
