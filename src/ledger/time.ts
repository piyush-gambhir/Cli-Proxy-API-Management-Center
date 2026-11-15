





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


export const formatResetAt = (ms: number, now: number, language: string) =>
  dayKey(ms) === dayKey(now) ? formatTime(ms, language) : formatDateTime(ms, language);
