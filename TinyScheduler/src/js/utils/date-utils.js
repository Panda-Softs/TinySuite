/**
 * Date and time utilities
 * -----------------------
 * Shared helpers used by all calendar views.
 *
 * Important:
 * - Date helpers always return new Date instances to avoid mutating user input.
 * - All displayed time strings pass through the same formatting path.
 * - Legacy options are kept for backward compatibility:
 *   hourFormat: '24', timeFormat: '24h', use24Hour: true.
 * - New i18n timeFormat objects are supported:
 *   { hour12: true, separator: ':', rangeSeparator: ' - ' }
 *   { hour12: false, separator: 'h', rangeSeparator: '-' }
 */

function parseDateInput(input, fallbackDate = new Date()) {
  if (!input) return new Date(fallbackDate);
  if (input instanceof Date) return new Date(input.getTime());

  if (isFn(input?.toDate)) {
    const convertedDate = input.toDate();

    return convertedDate instanceof Date && !Number.isNaN(convertedDate.getTime())
        ? convertedDate
        : new Date(fallbackDate);
  }

  const parsedDate = new Date(input);

  return Number.isNaN(parsedDate.getTime())
      ? new Date(fallbackDate)
      : parsedDate;
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function formatDateKey(date) {
  const parsedDate = parseDateInput(date);

  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
}

function startOfDay(date) {
  const d = parseDateInput(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = parseDateInput(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, amount) {
  const d = parseDateInput(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function addMonths(date, amount) {
  const d = parseDateInput(date);
  d.setMonth(d.getMonth() + amount);
  return d;
}

function addYears(date, amount) {
  const d = parseDateInput(date);
  d.setFullYear(d.getFullYear() + amount);
  return d;
}

function addMinutes(date, amount) {
  const d = parseDateInput(date);
  d.setMinutes(d.getMinutes() + amount);
  return d;
}

function isSameDay(a, b) {
  return formatDateKey(parseDateInput(a)) === formatDateKey(parseDateInput(b));
}

function startOfWeek(date, firstDay = 0) {
  const d = startOfDay(date);

  while (d.getDay() !== firstDay) {
    d.setDate(d.getDate() - 1);
  }

  return d;
}

function endOfWeek(date, firstDay = 0) {
  return endOfDay(addDays(startOfWeek(date, firstDay), 6));
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function endOfMonth(date) {
  const d = startOfDay(date);
  d.setMonth(d.getMonth() + 1, 0);
  return endOfDay(d);
}

function parseTimeToMinutes(time) {
  const [hours, minutes = '0'] = String(time).split(':');

  return Number(hours) * 60 + Number(minutes);
}

function minutesBetween(start, end) {
  return Math.max(0, Math.round((parseDateInput(end) - parseDateInput(start)) / 60000));
}

function formatIsoLocal(date) {
  const d = parseDateInput(date);

  return `${formatDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/**
 * Return the language part of a locale string.
 *
 * @param {string} locale - Locale like "fr-CH" or "en-US".
 * @returns {string}
 */
function getTimeLocaleLanguage(locale) {
  return String(locale || 'en').toLowerCase().split('-')[0];
}

/**
 * Detect explicit legacy 24-hour options.
 *
 * @param {Object} options - Calendar options.
 * @returns {boolean}
 */
function hasExplicit24HourOption(options = {}) {
  return options.hourFormat === '24'
      || options.timeFormat === '24h'
      || options.use24Hour === true;
}

/**
 * Detect explicit legacy 12-hour options.
 *
 * @param {Object} options - Calendar options.
 * @returns {boolean}
 */
function hasExplicit12HourOption(options = {}) {
  return options.hourFormat === '12'
      || options.timeFormat === '12h'
      || options.use24Hour === false;
}

/**
 * Resolve the active time format from new i18n config, old legacy options,
 * or locale fallback.
 *
 * @param {Object} options - Calendar options.
 * @returns {{hour12: boolean, separator: string, rangeSeparator: string}}
 */
function getResolvedTimeFormat(options = {}) {
  if (isObj(options.timeFormat)) {
    return {
      hour12: options.timeFormat.hour12 === true,
      separator: options.timeFormat.separator || ':',
      rangeSeparator: options.timeFormat.rangeSeparator || '-',
      omitZeroMinutes: options.timeFormat.omitZeroMinutes === true
    };
  }

  const language = getTimeLocaleLanguage(options.locale);

  if (hasExplicit12HourOption(options) || language === 'en') {
    return {
      hour12: true,
      separator: ':',
      rangeSeparator: ' - '
    };
  }

  if (hasExplicit24HourOption(options) || language === 'fr') {
    return {
      hour12: false,
      separator: 'h',
      rangeSeparator: '-'
    };
  }

  return {
    hour12: false,
    separator: ':',
    rangeSeparator: ' - '
  };
}

/**
 * Format minutes since midnight according to the resolved time config.
 *
 * @param {number} minute - Minutes since midnight.
 * @param {Object} options - Calendar options.
 * @param {Object} config - Formatting config.
 * @param {boolean} config.hideZeroMinutes - Hide minutes when they are 00.
 * @returns {string}
 */
function formatMinutesAsTime(minute, options = {}, config = {}) {
  const timeFormat = getResolvedTimeFormat(options);
  const hours24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const paddedMinutes = pad(minutes);

  /*
    config.hideZeroMinutes keeps priority for specific calls.
    timeFormat.omitZeroMinutes is the global default behavior.
  */
  const hideZeroMinutes = timeFormat.omitZeroMinutes === true || config.hideZeroMinutes === true;

  if (timeFormat.hour12) {
    const hours12 = hours24 % 12 || 12;
    const meridiem = hours24 < 12 ? 'AM' : 'PM';

    return minutes || !hideZeroMinutes
        ? `${hours12}:${paddedMinutes} ${meridiem}`
        : `${hours12} ${meridiem}`;
  }

  if (timeFormat.separator === 'h') {
    return minutes || !hideZeroMinutes
        ? `${hours24}h${paddedMinutes}`
        : `${hours24}h`;
  }

  return `${pad(hours24)}:${paddedMinutes}`;
}

/**
 * Format a single date/time.
 *
 * Kept as the public/internal compatibility helper. The real formatting work
 * is delegated to formatShortTime() so all time displays stay consistent.
 *
 * @param {Date|string|number} dateInput - Date input.
 * @param {Object} options - Calendar options.
 * @returns {string}
 */
function formatTime(dateInput, options = {}) {
  return formatShortTime(dateInput, options);
}

/**
 * Format a compact time, usually for event labels.
 *
 * @param {Date|string|number} dateInput - Date input.
 * @param {Object} options - Calendar options.
 * @returns {string}
 */
function formatShortTime(dateInput, options = {}) {
  const parsedDate = parseDateInput(dateInput);

  if (isFn(options.timeFormatter)) {
    return options.timeFormatter(parsedDate, { options });
  }

  const minutes = parsedDate.getHours() * 60 + parsedDate.getMinutes();

  return formatMinutesAsTime(minutes, options, {
    hideZeroMinutes: false
  });
}

/**
 * Format a start/end time range.
 *
 * @param {Date|string|number} startInput - Start date input.
 * @param {Date|string|number|null} endInput - End date input.
 * @param {Object} options - Calendar options.
 * @returns {string}
 */
function formatTimeRange(startInput, endInput, options = {}) {
  const parsedStart = parseDateInput(startInput);
  const parsedEnd = endInput ? parseDateInput(endInput) : null;

  if (isFn(options.timeRangeFormatter)) {
    return options.timeRangeFormatter(parsedStart, parsedEnd, { options });
  }

  const start = formatShortTime(parsedStart, options);

  if (!parsedEnd) {
    return start;
  }

  const end = formatShortTime(parsedEnd, options);
  const rangeSeparator = getResolvedTimeFormat(options).rangeSeparator;

  return `${start}${rangeSeparator}${end}`;
}

/**
 * Format the label displayed on a time slot.
 *
 * @param {number} minute - Minutes since midnight.
 * @param {Object} options - Calendar options.
 * @returns {string}
 */
function formatSlotLabel(minute, options = {}) {
  if (isFn(options.slotLabelFormatter)) {
    return options.slotLabelFormatter(minute, { options });
  }

  return formatMinutesAsTime(minute, options, {
    hideZeroMinutes: true
  });
}

function getTimelineSlotDefaultFormat(range) {
  if (range === 'month') {
    return { weekday: 'short', day: 'numeric' };
  }

  if (range === 'week') {
    return { weekday: 'short', day: 'numeric', month: 'numeric' };
  }

  return null;
}

function formatTimelineSlotLabel(date, range, options = {}) {
  const parsedDate = parseDateInput(date);

  if (isFn(options.timelineSlotLabelFormatter)) {
    return options.timelineSlotLabelFormatter(parsedDate, { range, options });
  }

  const formatByRange = {
    day: options.timelineDayLabelFormat,
    week: options.timelineWeekLabelFormat,
    month: options.timelineMonthLabelFormat
  };

  const configuredFormat = formatByRange[range];

  if (isStr(configuredFormat)) {
    if (configuredFormat === 'dayNumber') return String(parsedDate.getDate());
    if (configuredFormat === 'shortWeekday') return new Intl.DateTimeFormat(options.locale || 'en', { weekday: 'short' }).format(parsedDate);
    if (configuredFormat === 'narrowWeekday') return new Intl.DateTimeFormat(options.locale || 'en', { weekday: 'narrow' }).format(parsedDate);
  }

  const formatOptions = isObj(configuredFormat)
      ? configuredFormat
      : getTimelineSlotDefaultFormat(range);

  if (!formatOptions) {
    return formatSlotLabel(parsedDate.getHours() * 60 + parsedDate.getMinutes(), options);
  }

  return new Intl.DateTimeFormat(options.locale || 'en', formatOptions).format(parsedDate);
}

function formatMonthTitle(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

function formatDayTitle(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function formatRangeTitle(start, end, locale) {
  const endInclusive = addDays(end, -1);

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (typeof formatter.formatRange === 'function') {
    return formatter.formatRange(start, endInclusive);
  }

  // Fallback for browsers without Intl.DateTimeFormat#formatRange.
  if (
      start.getFullYear() === endInclusive.getFullYear() &&
      start.getMonth() === endInclusive.getMonth()
  ) {
    const startDay = new Intl.DateTimeFormat(locale, {
      day: 'numeric'
    }).format(start);

    const endDate = formatter.format(endInclusive);

    return `${startDay}–${endDate}`;
  }

  if (start.getFullYear() === endInclusive.getFullYear()) {
    const startDate = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short'
    }).format(start);

    return `${startDate} – ${formatter.format(endInclusive)}`;
  }

  return `${formatter.format(start)} – ${formatter.format(endInclusive)}`;
}

function isAllDayEvent(event) {
  return event.allDay === true || event.allDay === 1 || event.allDay === 'true';
}

function isEventOnDate(event, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const eventStart = parseDateInput(event.start);
  let eventEnd = event.end ? parseDateInput(event.end) : eventStart;

  // Calendar end dates are treated as exclusive, matching FullCalendar behavior.
  if (event.end) {
    eventEnd = new Date(eventEnd.getTime() - 1);
  }

  return eventStart <= dayEnd && eventEnd >= dayStart;
}
