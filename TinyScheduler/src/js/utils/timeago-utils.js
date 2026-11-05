function timeAgo(date, options = {}) {
  const locale = options.locale || GLOBAL_CONFIG.locale || 'en';
  const now = options.now || new Date();
  const targetDate = parseDateInput(date);
  const seconds = Math.round((targetDate.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, unitSeconds] of units) {
    if (absoluteSeconds >= unitSeconds || unit === 'second') return formatter.format(Math.round(seconds / unitSeconds), unit);
  }
}
