/**
 * Absolute times for the ledger, always in India Standard Time with the zone named
 * ("13 Nov, 3:30 am IST"). English uses the en-IN pattern: day-first dates and an "IST" label
 * instead of "GMT+5:30".
 */

const TIME_ZONE = 'Asia/Kolkata';

const intlLocale = (language: string) => (language.startsWith('en') ? 'en-IN' : language);

export const formatDateTime = (ms: number, language: string) =>
  new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
    timeZoneName: 'short',
  }).format(ms);

/** Time of day only ("3:30 pm IST"), for moments later today. */
export const formatTime = (ms: number, language: string) =>
  new Intl.DateTimeFormat(intlLocale(language), {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
    timeZoneName: 'short',
  }).format(ms);

export const formatDate = (ms: number, language: string) =>
  new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  }).format(ms);

const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(ms);

/** A reset moment: time only when it falls today in IST, otherwise date and time. */
export const formatResetAt = (ms: number, now: number, language: string) =>
  dayKey(ms) === dayKey(now) ? formatTime(ms, language) : formatDateTime(ms, language);
