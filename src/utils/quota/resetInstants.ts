













const HOUR_MS = 3_600_000;







export function parseIsoToMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/(\.\d{6})\d+/, '$1');
  const ms = new Date(normalized).getTime();
  return Number.isFinite(ms) ? ms : null;
}








export function parseUnixToMs(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric < 1e11 ? numeric * 1000 : numeric;
}


export function parseOffsetSecondsToMs(value: unknown, now: number): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return now + numeric * 1000;
}







export function resolveResetMs(candidates: readonly unknown[]): number | null {
  for (const candidate of candidates) {
    const iso = parseIsoToMs(candidate);
    if (iso !== null) return iso;
    const unix = parseUnixToMs(candidate);
    if (unix !== null) return unix;
  }
  return null;
}


export function periodHoursFromSeconds(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return (numeric * 1000) / HOUR_MS;
}








export function claudePeriodHours(windowKey: string): number {
  return windowKey === 'five_hour' ? 5 : 24 * 7;
}
