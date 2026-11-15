








/**
 * `GMT`, `GMT+8`, `GMT-5`, `GMT+5:30`.
 *
 * @param offsetMinutes minutes EAST of UTC — i.e. the negation of
 * `Date.prototype.getTimezoneOffset`, which counts westward.
 */
export function formatUtcOffsetLabel(offsetMinutes: number): string {
  if (!Number.isFinite(offsetMinutes) || offsetMinutes === 0) return 'GMT';

  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(Math.trunc(offsetMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
}














export function resolveTimeZoneLabel(date: Date = new Date()): string {
  return formatUtcOffsetLabel(-date.getTimezoneOffset());
}
