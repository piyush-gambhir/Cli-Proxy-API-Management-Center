import { useEffect, type RefObject } from 'react';


export const AUTO_SCROLL_EDGE = 80;

export const AUTO_SCROLL_MAX_SPEED = 1100;






export function edgeScrollVelocity(
  y: number,
  top: number,
  bottom: number,
  edge = AUTO_SCROLL_EDGE,
  maxSpeed = AUTO_SCROLL_MAX_SPEED
): number {

  const zone = Math.min(edge, Math.max(0, (bottom - top) / 3));
  if (zone <= 0) return 0;
  const strength = (distance: number) => {
    const t = Math.min(1, Math.max(0, (zone - distance) / zone));
    return t * t * maxSpeed;
  };
  if (y < top + zone) return -strength(y - top);
  if (y > bottom - zone) return strength(bottom - y);
  return 0;
}

function scrollParentOf(node: HTMLElement | null): HTMLElement {
  for (let el = node?.parentElement ?? null; el; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}






export function useDragAutoScroll(active: boolean, anchorRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    const scroller = scrollParentOf(anchorRef.current);
    const isRoot = scroller === document.scrollingElement || scroller === document.documentElement;
    let pointerY: number | null = null;
    let frame = 0;
    let last = 0;

    let carry = 0;

    const tick = (now: number) => {
      const elapsed = last ? Math.min(now - last, 50) : 16;
      last = now;
      if (pointerY !== null) {
        const rect = isRoot ? null : scroller.getBoundingClientRect();
        const top = Math.max(rect?.top ?? 0, 0);
        const bottom = Math.min(rect?.bottom ?? window.innerHeight, window.innerHeight);
        const velocity = edgeScrollVelocity(pointerY, top, bottom);
        carry = velocity === 0 ? 0 : carry + (velocity * elapsed) / 1000;
        const step = Math.trunc(carry);
        if (step !== 0) {
          scroller.scrollTop += step;
          carry -= step;
        }
      }
      frame = requestAnimationFrame(tick);
    };


    const track = (event: DragEvent) => {
      pointerY = event.clientY;
    };


    const leave = (event: DragEvent) => {
      const { clientX: x, clientY: y } = event;
      const outside =
        (x <= 0 && y <= 0) || x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight;
      if (outside) pointerY = null;
    };
    const stop = () => {
      pointerY = null;
    };

    document.addEventListener('dragover', track, true);
    document.addEventListener('dragenter', track, true);
    document.addEventListener('dragleave', leave, true);
    document.addEventListener('drop', stop, true);
    document.addEventListener('dragend', stop, true);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('dragover', track, true);
      document.removeEventListener('dragenter', track, true);
      document.removeEventListener('dragleave', leave, true);
      document.removeEventListener('drop', stop, true);
      document.removeEventListener('dragend', stop, true);
    };
  }, [active, anchorRef]);
}
