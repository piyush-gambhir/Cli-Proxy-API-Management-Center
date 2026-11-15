type ScrollStrip = Pick<HTMLElement, 'scrollWidth' | 'clientWidth' | 'scrollLeft'>;
type StripWheelEvent = Pick<
  WheelEvent,
  'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'defaultPrevented' | 'preventDefault'
>;


export function scrollProviderTabs(strip: ScrollStrip, event: StripWheelEvent): void {
  const maxScroll = strip.scrollWidth - strip.clientWidth;
  if (
    event.ctrlKey ||
    event.defaultPrevented ||
    maxScroll <= 0 ||
    event.deltaY === 0 ||
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
  ) {
    return;
  }


  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
  strip.scrollLeft = Math.max(0, Math.min(maxScroll, strip.scrollLeft + event.deltaY * unit));
}
