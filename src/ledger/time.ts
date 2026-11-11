/**
 * Absolute times for the ledger, in the browser's own time zone with its name shown
 * ("13 Nov, 3:30 am IST"). English uses the en-IN pattern: day-first dates and an "IST" label
 * instead of "GMT+5:30".
 */

const intlLocale = (language: string) => (language.startsWith('en') ? 'en-IN' : language);

export const formatDateTime = (ms: number, language: string) =>
  new Intl.DateTimeFormat(intlLocale(language), {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(ms);

export const formatDate = (ms: number, language: string) =>
  new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short' }).format(ms);
