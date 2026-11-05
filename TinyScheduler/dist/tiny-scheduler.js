(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const exports = factory();

    root.TinyScheduler = exports.TinyScheduler;
    root.TinySchedulerFrame = exports.TinySchedulerFrame;
    root.TinySchedulerSidebar = exports.TinySchedulerSidebar;
    root.TinyMiniCalendar = exports.TinyMiniCalendar;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const root =
    typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : {};
function isFn(value) {
  return typeof value === 'function';
}

function isStr(value) {
  return typeof value === 'string';
}

function isObj(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isNil(value) {
  return value === null || value === undefined;
}

function noop() {}

function classNames(...names) {
  return names.filter(Boolean).join(' ');
}

function mergeDeep(target, ...sources) {
  const safeTarget = target || {};
  const output = isObj(safeTarget) ? { ...safeTarget } : {};

  sources.forEach(source => {
    if (!isObj(source)) return;

    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = output[key];

      if (isObj(sourceValue) && isObj(targetValue)) {
        output[key] = mergeDeep(targetValue, sourceValue);
        return;
      }

      // Important:
      // Arrays, Date, functions, null, strings, numbers, booleans
      // must replace the previous value, not be deep-merged.
      output[key] = sourceValue;
    });
  });

  return output;
}

/**
 * Defaults and i18n
 * -----------------
 * Central place for:
 * - browser locale detection,
 * - built-in English/French text,
 * - default time formatting,
 * - default functional calendar options,
 * - toolbar SVG icons.
 */

function getBrowserLocale(fallbackLocale = 'en') {
  const browserNavigator = typeof navigator !== 'undefined' ? navigator : root.navigator;
  if (!browserNavigator) return fallbackLocale;
  return browserNavigator.languages?.[0] || browserNavigator.language || fallbackLocale;
}

function getLocaleLanguage(locale) {
  return String(locale || getBrowserLocale()).toLowerCase().split('-')[0];
}

const TSH_I18N = Object.freeze({
  en: {
    locale: 'en',
    firstDay: 0,
    timeFormat: {
      hour12: true,
      separator: ':',
      rangeSeparator: ' - ',
      omitZeroMinutes: false
    },
    labels: {
      today: 'today',
      day: 'day',
      week: 'week',
      month: 'month',
      list: 'list',
      planning: 'planning',
      prev: 'Previous',
      next: 'Next',
      prevYear: 'Previous year',
      nextYear: 'Next year',
      searchPlaceholder: 'Search...',
      noEvents: 'No events',
      loading: 'Loading...',
      allDay: 'all-day',
      rooms: 'Rooms',
      planningView: 'Type',
      period: 'Period',
      resourceTimeGrid: 'Grid',
      resourceTimeline: 'Timeline',
      event: 'Event',
      addEvent: 'add',
      deleteEvent: 'delete'
    },
    tooltips: {
      today: 'Go to today',
      prev: 'Previous period',
      next: 'Next period',
      previous: 'Previous',
      previousYear: 'Previous year',
      nextYear: 'Next year',
      sidebarToggle: 'Open or close sidebar',
      addEvent: 'Add event',
      refreshData: 'Refresh events',
      editEvent: 'Edit event',
      deleteEvent: 'Delete event',
      planning: 'Open planning',
      resourceTimeGrid: 'Resource time grid',
      resourceTimeline: 'Resource timeline',
      openDay: 'Open day',
      moreEvents: 'Show more events',
      day: 'Day',
      week: 'Week',
      month: 'Month',
      list: 'List'
    },
    aria: {
      close: 'Close',
      event: 'Event',
      calendar: 'Calendar',
      previousPeriod: 'Previous period',
      nextPeriod: 'Next period',
      previousYear: 'Previous year',
      nextYear: 'Next year',
      today: 'Go to today',
      openSidebar: 'Open sidebar',
      closeSidebar: 'Close sidebar'
    }
  },

  fr: {
    locale: 'fr',
    firstDay: 1,
    timeFormat: {
      hour12: false,
      separator: 'h',
      rangeSeparator: '-'
    },
    labels: {
      today: 'aujourd’hui',
      day: 'jour',
      week: 'semaine',
      month: 'mois',
      list: 'liste',
      planning: 'planning',
      prev: 'Précédent',
      next: 'Suivant',
      prevYear: 'Année précédente',
      nextYear: 'Année suivante',
      searchPlaceholder: 'Rechercher...',
      noEvents: 'Aucun événement',
      loading: 'Chargement...',
      allDay: 'journ',
      rooms: 'Salles',
      planningView: 'Type',
      period: 'Période',
      resourceTimeGrid: 'Grille',
      resourceTimeline: 'Timeline',
      event: 'Événement',
      addEvent: 'ajouter',
      deleteEvent: 'supprimer'
    },
    tooltips: {
      today: 'Aller à aujourd’hui',
      prev: 'Période précédente',
      next: 'Période suivante',
      previous: 'Précédent',
      previousYear: 'Année précédente',
      nextYear: 'Année suivante',
      sidebarToggle: 'Ouvrir ou fermer la barre latérale',
      addEvent: 'Ajouter un événement',
      refreshData: 'Rafraîchir les événements',
      editEvent: 'Modifier l’événement',
      deleteEvent: 'Supprimer l’événement',
      planning: 'Ouvrir le planning',
      resourceTimeGrid: 'Grille ressources',
      resourceTimeline: 'Timeline ressources',
      openDay: 'Ouvrir le jour',
      moreEvents: 'Afficher plus d’événements',
      day: 'Jour',
      week: 'Semaine',
      month: 'Mois',
      list: 'Liste'
    },
    aria: {
      close: 'Fermer',
      event: 'Événement',
      calendar: 'Calendrier',
      previousPeriod: 'Période précédente',
      nextPeriod: 'Période suivante',
      previousYear: 'Année précédente',
      nextYear: 'Année suivante',
      today: 'Aller à aujourd’hui',
      openSidebar: 'Ouvrir la barre latérale',
      closeSidebar: 'Fermer la barre latérale'
    }
  }
});

function getI18nConfig(locale = getBrowserLocale()) {
  const language = getLocaleLanguage(locale);
  return TSH_I18N[language] || TSH_I18N.en;
}

const GLOBAL_CONFIG = root.TinySchedulerGlobal || {};

const DEFAULT_OPTIONS = {
  initialDate: new Date(),
  initialView: 'month',
  timezone: 'local',

  // Legacy options remain supported by date-utils.js.
  hourFormat: 'auto',
  timeFormatter: null,
  timeRangeFormatter: null,
  slotLabelFormatter: null,
  timelineSlotLabelFormatter: null,
  timelineDayLabelFormat: null,
  timelineWeekLabelFormat: null,
  timelineMonthLabelFormat: null,

  height: 'auto',
  minTime: '06:00',
  maxTime: '22:00',
  slotDuration: 30,
  slotMinWidth: 82,
  rowHeight: 46,

  events: [],
  eventSources: [],
  resources: [],
  resourceSources: [],

  selectable: true,
  editable: false,
  eventDragMinDistance: 4,
  eventDragHitTolerance: 3,

  showToolbar: true,
  showWeekends: true,
  showNowIndicator: true,
  showResourceGroups: true,
  maxEventsPerDay: 3,

  toolbar: {
    left: ['prev', 'next', 'today'],
    center: ['title'],
    right: ['month', 'week', 'day', 'list', 'planning']
  },

  customButtons: {},
  planningType: 'timeGrid',
  planningRange: 'day',

  defaultEventColor: '#3b8edb',
  defaultEventTextColor: null,
  autoEventTextColor: true,

  eventActionToolbar: true,
  eventActionToolbarButtons: ['editEvent', 'deleteEvent'],
  eventActionToolbarOffset: 6,
  eventActionToolbarVerticalAlign: 'top',

  eventResizable: true,
  eventResizeMinDuration: null,

  eventTransform: null,

  autoScroll: true,
  autoScrollTarget: 'firstEvent',
  autoScrollBehavior: 'smooth',
  autoScrollBlock: 'center',
  autoScrollInline: 'nearest',

  labels: {},
  tooltips: {},
  aria: {},

  stateStorage: {
    enabled: true,
    key: 'TinyScheduler'
  },

  onEventClick: null,
  onEventEdit: null,
  onEventDelete: null,
  onEventAdd: null,

  // Cancellable schedule changes. Prefer onEventChange for move + resize.
  // onEventMove/onEventResize are kept as backward-compatible aliases.
  onEventChange: null,
  onEventChanged: null,
  onEventChangeCancelled: null,
  onEventChangeError: null,
  onEventMove: null,
  onEventMoved: null,
  onEventMoveCancelled: null,
  onEventResize: null,
  onEventResized: null,
  onEventResizeStart: null,
  onEventResizeStop: null,
  onEventResizeCancelled: null,

  // Conflict handling.
  // - false or Promise<false> returned by a callback cancels add/move/resize.
  // - undefined/true allows the operation.
  eventConflictScope: 'resource',
  onEventConflict: null,
  onResourceConflict: null,

  onDataSourceError: null,
  onEventsLoadError: null,
  onResourcesLoadError: null,
  onDateClick: null,
  eventDidMount: null,
  eventWillUnmount: null,
  viewDidMount: null,
  viewWillUnmount: null,
  loading: null,
  select: null,
  onSelect: null,
  searchEvents: null
};

const TSH_TOOLBAR_ICONS = Object.freeze({
  sidebarToggle: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 6h16M4 12h16M4 18h16"></path>
    </svg>
  `,

  prev: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m16 4-8 8 8 8"></path>
    </svg>
  `,

  next: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m8 4 8 8-8 8"></path>
    </svg>
  `,

  prevYear: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m11 4-8 8 8 8"></path>
      <path d="m21 4-8 8 8 8"></path>
    </svg>
  `,

  nextYear: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m3 4 8 8-8 8"></path>
      <path d="m13 4 8 8-8 8"></path>
    </svg>
  `,

  today: `
    <svg class="tsh-button-svg tsh-button-svg--home" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 10.5 12 3l9 7.5"></path>
      <path d="M5.5 9.8V21h5v-6h3v6h5V9.8"></path>
    </svg>
  `,

  addEvent: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14"></path>
    </svg>
  `,

  editEvent: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4z"></path>
      <path d="m13.5 6.5 4 4"></path>
    </svg>
  `,

  deleteEvent: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16"></path>
      <path d="M10 11v6M14 11v6"></path>
      <path d="M6 7l1 14h10l1-14"></path>
      <path d="M9 7V4h6v3"></path>
    </svg>
  `
});

/**
 * Class names and shared scheduler constants
 * ------------------------------------------
 * Keep public CSS class names and static scheduler values in one place so views,
 * interactions and styles can stay consistent.
 */
const SCHEDULER_VIEW_NAMES = Object.freeze({
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  LIST: 'list',
  RESOURCE_TIME_GRID: 'resourceTimeGrid',
  RESOURCE_TIMELINE: 'resourceTimeline'
});

const SCHEDULER_PLANNING_TYPE_NAMES = Object.freeze({
  TIME_GRID: 'timeGrid',
  TIMELINE: 'timeline'
});

const SCHEDULER_PLANNING_TYPES = Object.freeze(Object.values(SCHEDULER_PLANNING_TYPE_NAMES));

const SCHEDULER_PLANNING_RANGE_NAMES = Object.freeze({
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month'
});

const SCHEDULER_PLANNING_RANGES = Object.freeze(Object.values(SCHEDULER_PLANNING_RANGE_NAMES));

const SCHEDULER_SLOT_KINDS = Object.freeze({
  MONTH: 'month',
  TIME_GRID: 'timeGrid',
  RESOURCE_TIME_GRID: 'resourceTimeGrid',
  RESOURCE_TIMELINE: 'resourceTimeline'
});

const SCHEDULER_SLOT_GROUP_AXES = Object.freeze({
  VERTICAL: 'vertical',
  HORIZONTAL: 'horizontal',
  GRID: 'grid'
});

const CLASS_NAMES = Object.freeze({
  calendar: {
    root: 'tiny-scheduler',
    toolbar: 'tsh-toolbar',
    toolbarChunk: 'tsh-toolbar-chunck',
    title: 'tsh-title',
    body: 'tsh-body',
    viewHost: 'tsh-view-host',
    view: 'tsh-view',
    button: 'tsh-button',
    buttonGroup: 'tsh-button-group',
    buttonIcon: 'tsh-button-icon',
    buttonText: 'tsh-button-text',
    viewButtons: 'tsh-view-buttons',
    viewButton: 'tsh-view-button',
    viewButtonActive: 'active',

    event: 'tsh-event',
    eventBlock: 'tsh-event--block',
    eventDot: 'tsh-event--dot',
    eventAllDay: 'tsh-event--all-day',

    eventDragging: 'tsh-event--dragging',
    eventDragMirror: 'tsh-event-drag-mirror',
    eventDragSourceHidden: 'tsh-event--drag-source-hidden',
    dropTargetHover: 'tsh-drop-target-hover',

    eventSelected: 'tsh-event--selected',
    eventNarrow: 'tsh-event--narrow',
    eventTiny: 'tsh-event--tiny',
    eventCollision: 'tsh-event--collision',
    eventCollisionPreview: 'tsh-event--collision-preview',
    eventTimelineAllDay: 'tsh-event--timeline-all-day',
    eventTimelineAllDayIcon: 'tsh-event-timeline-all-day-icon',
    eventResizing: 'tsh-event--resizing',
    eventResizeHandle: 'tsh-event-resize-handle',
    eventTitle: 'tsh-event-title',
    eventText: 'tsh-event-text',
    eventTime: 'tsh-event-time',
    eventActionToolbar: 'tsh-event-action-toolbar',
    eventActionButton: 'tsh-event-action-button',
    eventActionButtonDanger: 'tsh-event-action-button--danger',

    slot: 'tsh-slot',
    slotGroup: 'tsh-slot-group',
    slotSelected: 'tsh-slot--selected',
    slotWeekend: 'tsh-slot--weekend',
    slotPast: 'tsh-slot--past',
    dayNumber: 'tsh-day-number',
    dayNumberWeekend: 'tsh-day-number--weekend',
    slotConnectedTop: 'tsh-slot--connected-top',
    slotConnectedRight: 'tsh-slot--connected-right',
    slotConnectedBottom: 'tsh-slot--connected-bottom',
    slotConnectedLeft: 'tsh-slot--connected-left',
    scrollContainer: 'tsh-scroll-container',

    nowIndicator: 'tsh-now-indicator',
    nowIndicatorLabel: 'tsh-now-indicator-label',
    nowIndicatorLine: 'tsh-now-indicator-line',
    nowIndicatorActiveLine: 'tsh-now-indicator-active-line',
    nowIndicatorDot: 'tsh-now-indicator-dot',

    month: 'tsh-month',
    monthGrid: 'tsh-month-grid',
    monthDay: 'tsh-month-day',
    monthDayNumber: 'tsh-month-day-number',

    timeGrid: 'tsh-time-grid',
    timeGridColumn: 'tsh-time-grid-column',
    timeGridSlot: 'tsh-time-grid-slot',

    list: 'tsh-list',
    listView: 'tsh-list-view',

    resourceTimeGrid: 'tsh-resource-time-grid',
    resourceTimeGridColumn: 'tsh-rtg-column',
    resourceTimeGridSlot: 'tsh-rtg-slot',

    resourceTimeline: 'tsh-resource-timeline',
    resourceTimelineTimeRow: 'tsh-rtl-time-row',
    resourceTimelineSlot: 'tsh-rtl-slot'
  },

  frame: {
    root: 'tiny-scheduler-frame',
    sidebar: 'tsh-frame-sidebar',
    overlay: 'tsh-frame-overlay',
    main: 'tsh-frame-main',
    calendarHost: 'tsh-frame-calendar-host',
    search: 'tsh-frame-search',
    miniCalendar: 'tsh-frame-mini-calendar',
    eventList: 'tsh-frame-event-list',
    sidebarCollapsed: 'tsh-sidebar-collapsed',
    sidebarOpen: 'tsh--sidebar-open'
  }
});

const SCHEDULER_SELECTORS = Object.freeze({
  slot: `.${CLASS_NAMES.calendar.slot}`,
  slotGroup: `.${CLASS_NAMES.calendar.slotGroup}`,
  selectedSlot: `.${CLASS_NAMES.calendar.slotSelected}`,
  selectedEvent: `.${CLASS_NAMES.calendar.eventSelected}`,
  event: '[data-event-id]',
  eventAction: '[data-event-action]',
  eventResizeHandle: '[data-event-resize-handle]',
  dateNav: '[data-date-nav="day"]',
  moreButton: '[data-more-date]',
  moreClose: '[data-more-close]',
  toolbarButton: '[data-tsh-button]',
  planningTypeButton: '[data-planning-type]',
  planningRangeButton: '[data-planning-range]',
  resourceToggle: '[data-resource-toggle]',
  interactive: 'button, a, input, textarea, select, [contenteditable="true"]'
});

const SCHEDULER_EVENT_ACTIONS = Object.freeze({
  EDIT: 'edit',
  DELETE: 'delete'
});

const SCHEDULER_EVENT_RESIZE_EDGES = Object.freeze({
  END: 'end'
});

const SCHEDULER_TOOLBAR_BUTTONS = Object.freeze({
  ADD_EVENT: 'addEvent',
  DELETE_EVENT: 'deleteEvent'
});

/**
 * MicroEvent
 * ----------
 * Tiny event emitter used by calendar components.
 */
class MicroEvent {
  constructor() {
    this._events = {};
  }

  /**
   * Register an event listener.
   *
   * @param {string} event - Event name.
   * @param {Function} fn - Listener callback.
   * @returns {MicroEvent}
   */
  on(event, fn) {
    if (!this._events[event]) {
      this._events[event] = [];
    }

    this._events[event].push(fn);

    return this;
  }

  /**
   * Remove an event listener.
   *
   * @param {string} event - Event name.
   * @param {Function} fn - Listener callback.
   * @returns {MicroEvent}
   */
  off(event, fn) {
    const listeners = this._events?.[event];

    if (!listeners) return this;

    const index = listeners.indexOf(fn);

    if (index !== -1) {
      listeners.splice(index, 1);
    }

    return this;
  }

  /**
   * Emit an event to all listeners.
   *
   * @param {string} event - Event name.
   * @param {...*} args - Listener arguments.
   * @returns {MicroEvent}
   */
  _emit(event, ...args) {
    const listeners = this._events?.[event];

    if (!listeners) return this;

    listeners.slice().forEach(fn => fn.apply(this, args));

    return this;
  }
}

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

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function matchesEventSearch(event, query, resource = null, options = {}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const searchableParts = [];
  if (options.includeTitle !== false) searchableParts.push(event.title);
  if (options.includeText !== false) searchableParts.push(event.text);
  if (options.includeResourceTitle !== false && resource?.title) searchableParts.push(resource.title);
  if (options.includeMeta) searchableParts.push(JSON.stringify(event.meta || {}));
  return searchableParts.filter(Boolean).some(value => normalizeSearchText(value).includes(normalizedQuery));
}

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

function parseHexColorToRgb(color) {
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
  }
  if (hex.length === 6) {
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
  }
  return null;
}
function parseRgbColorToRgb(color) {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1].split(',').map(part => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}
function parseColorToRgb(color) {
  if (!color || !isStr(color)) return null;
  const normalizedColor = color.trim();
  if (normalizedColor.startsWith('#')) return parseHexColorToRgb(normalizedColor);
  if (normalizedColor.startsWith('rgb')) return parseRgbColorToRgb(normalizedColor);
  return null;
}
function relativeLuminanceW3C(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return 1;
  const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}
function isDarkColor(color) { return relativeLuminanceW3C(color) < 0.5; }
function getReadableTextColor(backgroundColor) { return isDarkColor(backgroundColor) ? '#ffffff' : '#111827'; }
function getEventDisplayColor(event, options = DEFAULT_OPTIONS) {
  return event?.backgroundColor || event?.color || event?.borderColor || event?.raw?.backgroundColor || event?.raw?.color || options.defaultEventColor || '#3b8edb';
}

/**
 * DOM helpers
 * -----------
 * Small dependency-free helpers shared by calendar classes and views.
 *
 * The main helper, createDomElement(), keeps element creation consistent and
 * avoids repeating dataset/style/attribute handling across the project.
 */

/**
 * Remove all children from an element.
 *
 * @param {HTMLElement|null} element - Element to empty.
 * @returns {HTMLElement|null}
 */
function emptyElement(element) {
  if (element) element.innerHTML = '';
  return element;
}

/**
 * Safely append text, one node or an array of mixed children.
 *
 * @param {HTMLElement} element - Target element.
 * @param {*} content - Node, text, number, array, null or undefined.
 * @returns {HTMLElement}
 */
function appendDomContent(element, content) {
  if (content == null || content === '') return element;

  if (Array.isArray(content)) {
    content.forEach(child => appendDomContent(element, child));
    return element;
  }

  if (content instanceof Node) {
    element.append(content);
    return element;
  }

  element.append(document.createTextNode(String(content)));
  return element;
}

/**
 * Apply dataset values, skipping null/undefined values.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Dataset key/value pairs.
 * @returns {HTMLElement}
 */
function setDataset(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (!isNil(value)) element.dataset[key] = String(value);
  });

  return element;
}

/**
 * Apply style values, supporting CSS custom properties.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Style key/value pairs.
 * @returns {HTMLElement}
 */
function setStyles(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (isNil(value)) return;

    if (key.startsWith('--')) {
      element.style.setProperty(key, String(value));
      return;
    }

    element.style[key] = String(value);
  });

  return element;
}

/**
 * Apply HTML attributes, skipping null/undefined/false values.
 * Boolean true creates a boolean attribute.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} values - Attribute key/value pairs.
 * @returns {HTMLElement}
 */
function setAttributes(element, values = {}) {
  Object.entries(values || {}).forEach(([key, value]) => {
    if (isNil(value) || value === false) return;
    element.setAttribute(key, value === true ? '' : String(value));
  });

  return element;
}

/**
 * Apply common element options.
 *
 * @param {HTMLElement} element - Target element.
 * @param {Object} options - DOM options.
 * @param {Object} options.props - DOM properties.
 * @param {Object} options.attrs - HTML attributes.
 * @param {Object} options.dataset - Dataset values.
 * @param {Object} options.style - Inline styles or CSS variables.
 * @param {string} options.html - Explicit trusted HTML.
 * @param {Array<Node|string|number>} options.children - Extra children.
 * @returns {HTMLElement}
 */
function applyDomOptions(element, options = {}) {
  const { props, attrs, dataset, style, html, children } = options || {};

  // Inner HTML is intentionally explicit. Use it only for trusted markup such
  // as static SVG icons owned by the component.
  if (html != null) element.innerHTML = html;
  if (props) Object.assign(element, props);
  if (attrs) setAttributes(element, attrs);
  if (dataset) setDataset(element, dataset);
  if (style) setStyles(element, style);
  if (Array.isArray(children)) appendDomContent(element, children);

  return element;
}

/**
 * Create a DOM element with consistent content/options handling.
 *
 * @param {string} tagName - HTML tag name.
 * @param {string} className - Optional class string.
 * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
 * @param {Object} options - DOM options.
 * @returns {HTMLElement}
 */
function createDomElement(tagName, className = '', content = '', options = {}) {
  const element = document.createElement(tagName);
  if (className) element.className = className
  appendDomContent(element, content);
  applyDomOptions(element, options);
  return element;
}

/**
 * Event layout utilities
 * ----------------------
 * Computes FullCalendar-like horizontal placement for timed events.
 *
 * The important difference from a simple lane/grid algorithm is that events
 * are represented as a dependency web:
 * - events are stacked into collision levels;
 * - each event knows which later-level events overlap it;
 * - widths are stretched from this web so events can use available space;
 * - with slotEventOverlap enabled, visible width is doubled and capped at 100%,
 *   matching FullCalendar's timeGrid behavior.
 */

const DEFAULT_TIMED_EVENT_LAYOUT_OPTIONS = Object.freeze({
  minMinutes: 0,
  maxMinutes: 24 * 60,
  slotEventOverlap: true,
  eventMaxStack: null
});

/**
 * Build horizontal layout data for one day/resource timed event column.
 *
 * @param {Array<Object>} events - Normalized timed events.
 * @param {Object} options - Layout options.
 * @param {number} options.minMinutes - Visible start time in minutes.
 * @param {number} options.maxMinutes - Visible end time in minutes.
 * @param {boolean} options.slotEventOverlap - Whether events visually overlap.
 * @param {number|null} options.eventMaxStack - Optional max stack depth.
 * @returns {Map<string, Object>} Layout by event id.
 */
function buildTimedEventLayout(events, options = {}) {
  const layoutOptions = {
    ...DEFAULT_TIMED_EVENT_LAYOUT_OPTIONS,
    ...options
  };

  const segments = events
      .map(event => createTimedEventSegment(event, layoutOptions))
      .filter(Boolean)
      .sort(sortTimedEventSegments);

  if (!segments.length) {
    return new Map();
  }

  const hierarchy = new TimedEventHierarchy(
      segments,
      layoutOptions.eventMaxStack
  );

  const web = stretchTimedEventWeb(
      buildTimedEventWeb(hierarchy),
      1
  );

  return timedEventWebToLayoutMap(
      web,
      layoutOptions.slotEventOverlap
  );
}

/**
 * Convert a raw event into a visible timed segment.
 *
 * @param {Object} event - Normalized event.
 * @param {Object} options - Layout options.
 * @returns {Object|null}
 */
function createTimedEventSegment(event, options) {
  const eventStart = parseDateInput(event.start);
  const eventEnd = event.end
      ? parseDateInput(event.end)
      : addMinutes(eventStart, 60);

  const rawStartMinute = eventStart.getHours() * 60 + eventStart.getMinutes();
  const rawEndMinute = eventEnd.getHours() * 60 + eventEnd.getMinutes();

  const start = Math.max(options.minMinutes, rawStartMinute);
  const end = Math.min(options.maxMinutes, rawEndMinute);

  if (end <= start) {
    return null;
  }

  return {
    event,
    eventId: String(event.id),
    start,
    end,
    thickness: 1,
    depth: 0
  };
}

/**
 * Stable ordering for timed foreground events.
 *
 * Longer events first for the same start produces a stable, familiar stacking.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {number}
 */
function sortTimedEventSegments(firstSegment, secondSegment) {
  return firstSegment.start - secondSegment.start
      || secondSegment.end - firstSegment.end
      || String(firstSegment.eventId).localeCompare(String(secondSegment.eventId));
}

/**
 * Minimal hierarchy used by the web placement algorithm.
 *
 * A level contains non-overlapping segments. A later level contains segments
 * that collide with earlier levels. This mirrors the useful part of
 * FullCalendar's SegHierarchy for timeGrid foreground events.
 */
class TimedEventHierarchy {
  constructor(segments, maxDepth = null) {
    this.maxDepth = maxDepth;
    this.placementsByLevel = [];
    this.levelCoords = [];
    this.hiddenSegments = [];

    segments.forEach(segment => this.insertSegment(segment));
  }

  /**
   * Insert one segment into the first valid non-colliding level.
   *
   * @param {Object} segment - Timed segment.
   * @returns {TimedEventHierarchy}
   */
  insertSegment(segment) {
    const levelIndex = this.findAvailableLevelIndex(segment);

    if (this.maxDepth != null && levelIndex >= this.maxDepth) {
      this.hiddenSegments.push(segment);
      return this;
    }

    if (!this.placementsByLevel[levelIndex]) {
      this.placementsByLevel[levelIndex] = [];
      this.levelCoords[levelIndex] = levelIndex;
    }

    const placement = {
      ...segment,
      depth: levelIndex
    };

    const level = this.placementsByLevel[levelIndex];
    const insertionIndex = findSortedInsertionIndex(level, placement, compareSegmentsByEndThenStart);

    level.splice(insertionIndex, 0, placement);

    return this;
  }

  /**
   * Find the first level where this segment can be placed without collision.
   *
   * @param {Object} segment - Timed segment.
   * @returns {number}
   */
  findAvailableLevelIndex(segment) {
    for (let levelIndex = 0; levelIndex < this.placementsByLevel.length; levelIndex += 1) {
      const level = this.placementsByLevel[levelIndex];
      const hasCollision = level.some(placement => timedSegmentsOverlap(placement, segment));

      if (!hasCollision) {
        return levelIndex;
      }
    }

    return this.placementsByLevel.length;
  }
}

/**
 * Build a pressure web from the hierarchy.
 *
 * Each node points to overlapping nodes in the next available level. The web is
 * later stretched so each top-level chain fills the full 0..1 horizontal range.
 *
 * @param {TimedEventHierarchy} hierarchy - Timed event hierarchy.
 * @returns {Array<Object>}
 */
function buildTimedEventWeb(hierarchy) {
  const { placementsByLevel } = hierarchy;
  const buildNode = cacheByKey(
      (level, lateral) => `${level}:${lateral}`,
      (level, lateral) => {
        const siblingRange = findNextLevelSegments(hierarchy, level, lateral);
        const [nextLevelNodes, maxPressure] = buildTimedEventNodes(siblingRange, buildNode);
        const placement = placementsByLevel[level][lateral];

        return [
          {
            ...placement,
            nextLevelNodes
          },
          placement.thickness + maxPressure
        ];
      }
  );

  const [topLevelNodes] = buildTimedEventNodes(
      placementsByLevel.length
          ? {
            level: 0,
            lateralStart: 0,
            lateralEnd: placementsByLevel[0].length
          }
          : null,
      buildNode
  );

  return topLevelNodes;
}

/**
 * Build web nodes for a sibling range.
 *
 * @param {{level:number,lateralStart:number,lateralEnd:number}|null} siblingRange - Sibling range.
 * @param {Function} buildNode - Node builder.
 * @returns {[Array<Object>, number]}
 */
function buildTimedEventNodes(siblingRange, buildNode) {
  if (!siblingRange) {
    return [[], 0];
  }

  const pairs = [];

  for (let lateral = siblingRange.lateralStart; lateral < siblingRange.lateralEnd; lateral += 1) {
    pairs.push(buildNode(siblingRange.level, lateral));
  }

  pairs.sort((firstPair, secondPair) => secondPair[1] - firstPair[1]);

  return [
    pairs.map(pair => pair[0]),
    pairs[0]?.[1] || 0
  ];
}

/**
 * Find overlapping segments in the next lower level.
 *
 * @param {TimedEventHierarchy} hierarchy - Timed event hierarchy.
 * @param {number} subjectLevel - Current level index.
 * @param {number} subjectLateral - Current lateral index.
 * @returns {{level:number,lateralStart:number,lateralEnd:number}|null}
 */
function findNextLevelSegments(hierarchy, subjectLevel, subjectLateral) {
  const { placementsByLevel } = hierarchy;
  const subjectPlacement = placementsByLevel[subjectLevel][subjectLateral];

  for (let level = subjectLevel + 1; level < placementsByLevel.length; level += 1) {
    const placements = placementsByLevel[level];
    let lateralStart = -1;
    let lateralEnd = -1;

    for (let lateral = 0; lateral < placements.length; lateral += 1) {
      const placement = placements[lateral];

      if (placement.end <= subjectPlacement.start) {
        continue;
      }

      if (placement.start >= subjectPlacement.end) {
        break;
      }

      if (lateralStart === -1) {
        lateralStart = lateral;
      }

      lateralEnd = lateral + 1;
    }

    if (lateralStart !== -1) {
      return {
        level,
        lateralStart,
        lateralEnd
      };
    }
  }

  return null;
}

/**
 * Stretch a web of nodes so coordinates/thickness fill the 0..1 range.
 *
 * @param {Array<Object>} topLevelNodes - Top-level nodes.
 * @param {number} totalThickness - Total available thickness.
 * @returns {Array<Object>}
 */
function stretchTimedEventWeb(topLevelNodes, totalThickness) {
  const stretchNode = cacheByKey(
      node => node.eventId,
      (node, startCoord, previousThickness) => {
        const allThickness = node.thickness + previousThickness;
        const thicknessFraction = node.thickness / allThickness;
        let endCoord;
        const nextLevelNodes = [];

        if (!node.nextLevelNodes.length) {
          endCoord = totalThickness;
        } else {
          node.nextLevelNodes.forEach(childNode => {
            const [childEndCoord, stretchedChildNode] = stretchNode(
                childNode,
                endCoord === undefined ? startCoord : endCoord,
                endCoord === undefined ? allThickness : 0
            );

            if (endCoord === undefined) {
              endCoord = childEndCoord;
            }

            nextLevelNodes.push(stretchedChildNode);
          });
        }

        const thickness = (endCoord - startCoord) * thicknessFraction;

        return [
          endCoord - thickness,
          {
            ...node,
            thickness,
            nextLevelNodes
          }
        ];
      }
  );

  return topLevelNodes.map(node => stretchNode(node, 0, 0)[1]);
}

/**
 * Convert a stretched web into a layout map usable by views.
 *
 * @param {Array<Object>} topLevelNodes - Stretched top-level nodes.
 * @param {boolean} slotEventOverlap - Whether events should visually overlap.
 * @returns {Map<string, Object>}
 */
function timedEventWebToLayoutMap(topLevelNodes, slotEventOverlap) {
  const layoutMap = new Map();
  const processNode = cacheByKey(
      node => node.eventId,
      (node, levelCoord, stackDepth) => {
        let stackForward = 0;

        node.nextLevelNodes.forEach(childNode => {
          stackForward = Math.max(
              processNode(childNode, levelCoord + node.thickness, stackDepth + 1) + 1,
              stackForward
          );
        });

        const nearCoord = clamp01(levelCoord);
        const baseFarCoord = clamp01(levelCoord + node.thickness);
        const farCoord = slotEventOverlap
            ? Math.min(1, nearCoord + (baseFarCoord - nearCoord) * 2)
            : baseFarCoord;

        layoutMap.set(node.eventId, {
          leftPercent: nearCoord * 100,
          rightPercent: (1 - farCoord) * 100,
          widthPercent: (farCoord - nearCoord) * 100,
          baseWidthPercent: (baseFarCoord - nearCoord) * 100,
          levelCoord: nearCoord,
          farCoord,
          thickness: node.thickness,
          stackDepth,
          stackForward,
          zIndex: stackDepth + 1,
          isOverlapping: stackDepth > 0 || stackForward > 0
        });

        return stackForward;
      }
  );

  topLevelNodes.forEach(node => processNode(node, 0, 0));

  return layoutMap;
}


/**
 * Return full-width default layout for events without computed layout.
 *
 * @returns {Object}
 */
function getDefaultTimedEventLayout() {
  return {
    leftPercent: 0,
    rightPercent: 0,
    widthPercent: 100,
    baseWidthPercent: 100,
    levelCoord: 0,
    farCoord: 1,
    thickness: 1,
    stackDepth: 0,
    stackForward: 0,
    zIndex: 1,
    isOverlapping: false
  };
}

/**
 * Compare segments by end, then start.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {number}
 */
function compareSegmentsByEndThenStart(firstSegment, secondSegment) {
  return firstSegment.end - secondSegment.end
      || firstSegment.start - secondSegment.start
      || String(firstSegment.eventId).localeCompare(String(secondSegment.eventId));
}

/**
 * Find an insertion index in a sorted array.
 *
 * @param {Array<Object>} array - Sorted array.
 * @param {Object} item - Item to insert.
 * @param {Function} compare - Compare function.
 * @returns {number}
 */
function findSortedInsertionIndex(array, item, compare) {
  let low = 0;
  let high = array.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (compare(array[middle], item) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

/**
 * Check if two timed segments overlap.
 *
 * End touching start is not an overlap.
 *
 * @param {Object} firstSegment - First segment.
 * @param {Object} secondSegment - Second segment.
 * @returns {boolean}
 */
function timedSegmentsOverlap(firstSegment, secondSegment) {
  return firstSegment.start < secondSegment.end
      && secondSegment.start < firstSegment.end;
}

/**
 * Clamp a number to 0..1.
 *
 * @param {number} value - Raw value.
 * @returns {number}
 */
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Tiny memoization helper for recursive layout functions.
 *
 * @param {Function} keyFunction - Cache key builder.
 * @param {Function} workFunction - Expensive function.
 * @returns {Function}
 */
function cacheByKey(keyFunction, workFunction) {
  const cache = Object.create(null);

  return (...args) => {
    const key = keyFunction(...args);

    if (Object.prototype.hasOwnProperty.call(cache, key)) {
      return cache[key];
    }

    cache[key] = workFunction(...args);

    return cache[key];
  };
}

class CalendarState {
  constructor(options = {}, resolvedView = { view: 'month' }, planningType = 'timeGrid', planningRange = 'day') {
    this.currentDate = parseDateInput(options.initialDate);
    this.currentView = resolvedView.view || options.initialView || 'month';
    this.planningType = planningType;
    this.planningRange = planningRange;
    this.visibleRange = null;
    this.collapsedResources = new Set();
    this.searchQuery = '';
  }

  /**
   * Return only the calendar view state that can be safely persisted.
   *
   * Runtime-only values like currentDate, visibleRange, loading state,
   * selected events, drag state, etc. should not be persisted here.
   *
   * @returns {{view: string, planningType: string, planningRange: string}}
   */
  getViewState() {
    return {
      view: this.currentView,
      planningType: this.planningType,
      planningRange: this.planningRange
    };
  }
}

class CalendarStateStorage {
    static configure(options = {}) {
        this.options = {
            ...CalendarStateStorage.DEFAULT_OPTIONS,
            ...(this.options || {}),
            ...(options || {})
        };

        return this;
    }

    static getOptions() {
        return {
            ...CalendarStateStorage.DEFAULT_OPTIONS,
            ...(this.options || {})
        };
    }

    static isEnabled() {
        const options = this.getOptions();

        return options.enabled !== false
            && typeof window !== 'undefined'
            && Boolean(window.localStorage)
            && Boolean(options.key);
    }

    static getState() {
        if (!this.isEnabled()) return {};

        const options = this.getOptions();

        try {
            return this.normalizeValue(
                window.localStorage.getItem(options.key)
            );
        } catch (error) {
            return {};
        }
    }

    static setState(state = {}) {
        if (!this.isEnabled()) return {};

        const options = this.getOptions();
        const normalizedState = this.normalizeValue(state);

        try {
            window.localStorage.setItem(
                options.key,
                JSON.stringify(normalizedState)
            );
        } catch (error) {
            // Storage must never break the calendar.
        }

        return normalizedState;
    }

    static mergeState(patch = {}) {
        return this.setState({
            ...this.getState(),
            ...this.normalizeValue(patch)
        });
    }

    static getViewState() {
        const state = this.getState();

        return {
            view: state.view,
            planningType: state.planningType,
            planningRange: state.planningRange
        };
    }

    static setViewState(calendarState) {
        const viewState = isFn(calendarState?.getViewState)
            ? calendarState.getViewState()
            : calendarState || {};

        return this.mergeState({
            view: viewState.view,
            planningType: viewState.planningType,
            planningRange: viewState.planningRange
        });
    }

    static getSidebarState() {
        const state = this.getState();

        return {
            sidebarCollapsed: state.sidebarCollapsed
        };
    }

    static setSidebarState(sidebarCollapsed) {
        return this.mergeState({
            sidebarCollapsed: Boolean(sidebarCollapsed)
        });
    }

    static clearState() {
        if (!this.isEnabled()) return this;

        const options = this.getOptions();

        try {
            window.localStorage.removeItem(options.key);
        } catch (error) {
            // Ignore storage errors.
        }

        return this;
    }

    static normalizeValue(value) {
        if (!value) return {};

        if (typeof value === 'string') {
            try {
                return JSON.parse(value) || {};
            } catch (error) {
                return {};
            }
        }

        return typeof value === 'object' ? value : {};
    }
}
CalendarStateStorage.DEFAULT_OPTIONS = Object.freeze({
    enabled: true,
    key: 'TinyScheduler'
});

CalendarStateStorage.options = { ...CalendarStateStorage.DEFAULT_OPTIONS };

function normalizeEvent(rawEvent, source = null, options = DEFAULT_OPTIONS) {
  if (!rawEvent || isNil(rawEvent.id) || isNil(rawEvent.start)) return null;
  const backgroundColor = rawEvent.backgroundColor || rawEvent.color || source?.backgroundColor || source?.color || options.defaultEventColor;
  const textColor = rawEvent.textColor || source?.textColor || (options.autoEventTextColor === false ? (options.defaultEventTextColor || '#ffffff') : getReadableTextColor(backgroundColor));
  const resourceIds = Array.isArray(rawEvent.resourceIds) ? rawEvent.resourceIds.map(String) : (rawEvent.resourceId ? [String(rawEvent.resourceId)] : []);
  const eventStart = parseDateInput(rawEvent.start);
  const eventEnd = rawEvent.end ? parseDateInput(rawEvent.end) : null;
  return {
    id: String(rawEvent.id), title: rawEvent.title || '(No title)', text: rawEvent.text || rawEvent.description || '',
    start: eventStart, end: eventEnd, allDay: Boolean(rawEvent.allDay), resourceId: rawEvent.resourceId ? String(rawEvent.resourceId) : null,
    resourceIds, color: backgroundColor, backgroundColor, textColor, className: rawEvent.className || source?.className || '',
    editable: rawEvent.editable ?? options.editable, sourceId: source?.id || rawEvent.sourceId || null, meta: rawEvent.meta || {}, raw: rawEvent
  };
}


class EventStore extends MicroEvent {
  constructor(options = {}) { super(); this.options = options; this.events = []; this.eventsById = new Map(); }
  setEvents(events) { this.events = []; this.eventsById.clear(); events.forEach(event => this.addEvent(event, false)); this._emit('changed', this.events); return this; }
  addEvent(event, emit = true) { if (!event) return null; this.eventsById.set(event.id, event); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); if (emit) this._emit('changed', this.events); return event; }
  updateEvent(eventId, updates) { const oldEvent = this.eventsById.get(String(eventId)); if (!oldEvent) return null; const updatedRaw = { ...oldEvent.raw, ...oldEvent, ...updates, id: oldEvent.id }; const updatedEvent = normalizeEvent(updatedRaw, { id: oldEvent.sourceId }, this.options); this.eventsById.set(updatedEvent.id, updatedEvent); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); this._emit('changed', this.events); return updatedEvent; }
  deleteEvent(eventId) { const removed = this.eventsById.get(String(eventId)); if (!removed) return null; this.eventsById.delete(String(eventId)); this.events = Array.from(this.eventsById.values()).sort((a, b) => a.start - b.start); this._emit('changed', this.events); return removed; }
  getEvents() { return this.events.slice(); }
  getEventById(eventId) { return this.eventsById.get(String(eventId)) || null; }
  getEventsInRange(start, end) { const rangeStart = parseDateInput(start); const rangeEnd = parseDateInput(end); return this.events.filter(event => { const eventEnd = event.end ? new Date(parseDateInput(event.end).getTime() - 1) : event.start; return eventEnd >= rangeStart && event.start < rangeEnd; }); }
  getEventsForDate(date) { return this.events.filter(event => isEventOnDate(event, date)); }
  getEventsByDate(events = this.events) { const map = new Map(); events.forEach(event => { const cursor = startOfDay(event.start); const last = event.end ? startOfDay(event.end) : startOfDay(event.start); while (cursor <= last) { if (isEventOnDate(event, cursor)) { const key = formatDateKey(cursor); if (!map.has(key)) map.set(key, []); map.get(key).push(event); } cursor.setDate(cursor.getDate() + 1); } }); return map; }
  getEventsByResource(events = this.events) { const map = new Map(); events.forEach(event => { const ids = event.resourceIds?.length ? event.resourceIds : [event.resourceId].filter(Boolean); ids.forEach(id => { if (!map.has(id)) map.set(id, []); map.get(id).push(event); }); }); return map; }
  getEventsByResourceAndDate(events = this.events) { const map = new Map(); events.forEach(event => { const ids = event.resourceIds?.length ? event.resourceIds : [event.resourceId].filter(Boolean); ids.forEach(id => { if (!map.has(id)) map.set(id, new Map()); const byDate = map.get(id); const cursor = startOfDay(event.start); const last = event.end ? startOfDay(event.end) : startOfDay(event.start); while (cursor <= last) { const key = formatDateKey(cursor); if (isEventOnDate(event, cursor)) { if (!byDate.has(key)) byDate.set(key, []); byDate.get(key).push(event); } cursor.setDate(cursor.getDate() + 1); } }); }); return map; }
}

function normalizeResource(rawResource) {
  if (!rawResource || isNil(rawResource.id)) return null;
  return {
    id: String(rawResource.id), title: rawResource.title || String(rawResource.id), group: rawResource.group || null,
    parentId: rawResource.parentId || null, order: Number(rawResource.order || 0), color: rawResource.color || null, meta: rawResource.meta || {}
  };
}


class ResourceStore extends MicroEvent {
  constructor() { super(); this.resources = []; this.resourcesById = new Map(); }
  setResources(resources) { this.resources = []; this.resourcesById.clear(); resources.forEach(resource => this.addResource(resource, false)); this._emit('changed', this.resources); return this; }
  addResource(resource, emit = true) { const normalized = normalizeResource(resource); if (!normalized) return null; this.resourcesById.set(normalized.id, normalized); this.resources = Array.from(this.resourcesById.values()).sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title)); if (emit) this._emit('changed', this.resources); return normalized; }
  updateResource(resourceId, updates) { const oldResource = this.resourcesById.get(String(resourceId)); if (!oldResource) return null; const resource = normalizeResource({ ...oldResource, ...updates, id: oldResource.id }); this.resourcesById.set(resource.id, resource); this.resources = Array.from(this.resourcesById.values()).sort((a, b) => (a.order - b.order) || a.title.localeCompare(b.title)); this._emit('changed', this.resources); return resource; }
  deleteResource(resourceId) { const removed = this.resourcesById.get(String(resourceId)); if (!removed) return null; this.resourcesById.delete(String(resourceId)); this.resources = Array.from(this.resourcesById.values()); this._emit('changed', this.resources); return removed; }
  getResources() { return this.resources.slice(); }
  getResourceById(resourceId) { return this.resourcesById.get(String(resourceId)) || null; }
}

class SourceManager {
  constructor(calendar) {
    this.calendar = calendar;
    this.eventSources = [];
    this.resourceSources = [];
    this.cache = new Map();
  }

  setEventSources(sources) {
    this.eventSources = this.normalizeSources(sources, 'events');
    return this;
  }

  setResourceSources(sources) {
    this.resourceSources = this.normalizeSources(sources, 'resources');
    return this;
  }

  getEventSources() {
    return this.eventSources.slice();
  }

  getResourceSources() {
    return this.resourceSources.slice();
  }

  addEventSource(source) {
    this.eventSources.push(this.normalizeSource(source, this.eventSources.length, 'events'));
    return this;
  }

  removeEventSource(sourceId) {
    this.eventSources = this.eventSources.filter(source => source.id !== sourceId);
    return this;
  }

  addResourceSource(source) {
    this.resourceSources.push(this.normalizeSource(source, this.resourceSources.length, 'resources'));
    return this;
  }

  removeResourceSource(sourceId) {
    this.resourceSources = this.resourceSources.filter(source => source.id !== sourceId);
    return this;
  }

  normalizeSources(sources, field) {
    const list = Array.isArray(sources) ? sources : (isNil(sources) ? [] : [sources]);
    return list.map((source, index) => this.normalizeSource(source, index, field)).filter(Boolean);
  }

  normalizeSource(source, index, field) {
    const fallbackId = `${field}-source-${index + 1}`;

    if (Array.isArray(source)) {
      return { id: fallbackId, type: 'array', [field]: source, cache: true };
    }

    if (isStr(source)) {
      return { id: fallbackId, type: 'url', url: source, method: 'GET', headers: {}, credentials: 'same-origin', extraParams: {}, cache: true };
    }

    if (isFn(source)) {
      return { id: fallbackId, type: 'function', [field]: source, cache: false };
    }

    if (isObj(source)) {
      if (Array.isArray(source[field])) return { ...source, id: source.id || fallbackId, type: 'array', cache: source.cache !== false };
      if (isFn(source[field])) return { ...source, id: source.id || fallbackId, type: 'function', cache: source.cache === true };
      if (source.url) return { method: 'GET', headers: {}, credentials: 'same-origin', extraParams: {}, cache: true, ...source, id: source.id || fallbackId, type: 'url' };
    }

    return null;
  }

  async fetchEvents(range) {
    const results = await this.fetchSources(this.eventSources, range, 'events');

    return results
      .flat()
      .map((event, index) => this.transformEvent(event, index, range))
      .map((event, index) => {
        if (!event) return null;
        return normalizeEvent({ id: event.id ?? `event-${index}`, ...event }, event.__source || null, this.calendar.options);
      })
      .filter(Boolean);
  }

  /**
   * Fetch and normalize resources from all configured resource sources.
   *
   * Resource payloads can be transformed globally with options.resourceTransform
   * or per source with source.resourceTransform. This keeps API-specific mapping
   * out of views and prevents page scripts from duplicating source logic.
   *
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @returns {Promise<Array<Object>>}
   */
  async fetchResources(range) {
    const results = await this.fetchSources(this.resourceSources, range, 'resources');

    return results
      .flat()
      .map((resource, index) => this.transformResource(resource, index, range))
      .map(resource => resource ? normalizeResource(resource) : null)
      .filter(Boolean);
  }

  async fetchSources(sources, range, field) {
    const settled = await Promise.allSettled(sources.map(source => this.fetchSource(source, range, field)));
    const records = [];

    settled.forEach((result, index) => {
      const source = sources[index];

      if (result.status === 'fulfilled') {
        records.push(...result.value);
        return;
      }

      this.handleSourceError({ error: result.reason, source, range, field });
    });

    return records;
  }

  /**
   * Fetch one source with optional static-source support.
   *
   * Static sources are useful for resources such as rooms, boats or staff lists
   * that do not depend on the current visible date range. They are loaded once,
   * cached with a stable key and requested without start/end/timeZone params.
   *
   * @param {Object} source - Normalized source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @param {'events'|'resources'} field - Source field.
   * @returns {Promise<Array<Object>>}
   */
  async fetchSource(source, range, field) {
    const cacheKey = this.getSourceCacheKey(source, range, field);

    if (source.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let data = [];

    if (source.type === 'array') {
      data = source[field] || [];
    }

    if (source.type === 'function') {
      data = await source[field](this.createSourceRequestContext(source, range));
    }

    if (source.type === 'url') {
      data = await this.fetchJsonSource(source, range);
    }

    if (isFn(source.transformResponse)) {
      data = source.transformResponse(data);
    }

    const items = (Array.isArray(data) ? data : (data?.[field] || []))
      .map(item => ({ ...item, __source: source }));

    if (source.cache !== false) this.cache.set(cacheKey, items);
    if (isFn(source.success)) source.success(items);

    return items;
  }

  /**
   * Return true when this source must not receive range parameters.
   *
   * Supported source flags:
   * - static: true
   * - range: false
   * - rangeParams: false
   * - includeRangeParams: false
   *
   * @param {Object} source - Source definition.
   * @returns {boolean}
   */
  isStaticSource(source) {
    return source.static === true
      || source.range === false
      || source.rangeParams === false
      || source.includeRangeParams === false;
  }

  /**
   * Build a stable cache key. Static sources are cached independently of date.
   *
   * @param {Object} source - Source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @param {'events'|'resources'} field - Source field.
   * @returns {string}
   */
  getSourceCacheKey(source, range, field) {
    if (this.isStaticSource(source)) {
      return `${source.id}:${field}:static`;
    }

    return `${source.id}:${field}:${formatDateKey(range.start)}:${formatDateKey(range.end)}`;
  }

  /**
   * Build the context passed to function sources.
   *
   * Static sources receive null start/end values to make the no-range contract
   * explicit for custom loaders.
   *
   * @param {Object} source - Source definition.
   * @param {{start: Date, end: Date}} range - Current calendar range.
   * @returns {Object}
   */
  createSourceRequestContext(source, range) {
    if (this.isStaticSource(source)) {
      return {
        start: null,
        end: null,
        view: this.calendar.getView(),
        timezone: this.calendar.options.timezone,
        source,
        calendar: this.calendar
      };
    }

    return {
      start: formatIsoLocal(range.start),
      end: formatIsoLocal(range.end),
      view: this.calendar.getView(),
      timezone: this.calendar.options.timezone,
      source,
      calendar: this.calendar
    };
  }

  transformEvent(rawEvent, index, range) {
    let event = rawEvent;
    const source = rawEvent?.__source || null;
    const context = {
      index,
      range,
      source,
      sourceId: source?.id || null,
      calendar: this.calendar
    };

    if (isFn(source?.eventTransform)) {
      event = source.eventTransform(event, context);
    }

    if (!event) return null;

    if (isFn(this.calendar.options.eventTransform)) {
      event = this.calendar.options.eventTransform(event, context);
    }

    if (!event) return null;

    return { ...event, __source: source };
  }

  /**
   * Transform one raw resource before normalization.
   *
   * @param {Object} rawResource - Raw source resource.
   * @param {number} index - Resource index in the flattened result.
   * @param {{start: Date, end: Date}} range - Fetch range.
   * @returns {Object|null}
   */
  transformResource(rawResource, index, range) {
    let resource = rawResource;
    const source = rawResource?.__source || null;
    const context = {
      index,
      range,
      source,
      sourceId: source?.id || null,
      calendar: this.calendar
    };

    if (isFn(source?.resourceTransform)) {
      resource = source.resourceTransform(resource, context);
    }

    if (!resource) return null;

    if (isFn(this.calendar.options.resourceTransform)) {
      resource = this.calendar.options.resourceTransform(resource, context);
    }

    if (!resource) return null;

    return { ...resource, __source: source };
  }

  handleSourceError({ error, source, range, field }) {
    const errorInfo = this.createSourceErrorInfo({ error, source, range, field });
    let failureCallbackWasCalled = false;

    const failureCallback = nextError => {
      failureCallbackWasCalled = true;
      const nextErrorInfo = this.createSourceErrorInfo({ error: nextError || error, source, range, field });
      this.emitSourceError(nextErrorInfo);
      return nextErrorInfo;
    };

    const sourceFailure = source?.failure || source?.onError;

    if (isFn(sourceFailure)) {
      const result = sourceFailure(errorInfo, failureCallback);

      if (result === false) return errorInfo;
      if (failureCallbackWasCalled) return errorInfo;
      if (result instanceof Error) return failureCallback(result);
    }

    return failureCallback(error);
  }

  emitSourceError(errorInfo) {
    this.calendar._notify('dataSourceError', errorInfo);
    this.calendar._notify(errorInfo.field === 'events' ? 'eventsLoadError' : 'resourcesLoadError', errorInfo);
    return errorInfo;
  }

  createSourceErrorInfo({ error, source, range, field }) {
    return {
      type: 'dataSourceError',
      field,
      source,
      sourceId: source?.id || null,
      sourceType: source?.type || null,
      range,
      error,
      message: error?.message || 'Unable to load datasource',
      status: error?.status || null,
      statusText: error?.statusText || null,
      responseText: error?.responseText || null,
      response: error?.response || null,
      calendar: this.calendar
    };
  }

  buildSourceRequestUrl(source, range) {
    const method = (source.method || 'GET').toUpperCase();
    const url = new URL(source.url, root.location?.href || 'http://localhost/');
    const extraParams = isFn(source.extraParams) ? source.extraParams() : (source.extraParams || {});

    if (method === 'GET') {
      const rangeParams = this.isStaticSource(source)
        ? {}
        : {
          [source.startParam || 'start']: formatIsoLocal(range.start),
          [source.endParam || 'end']: formatIsoLocal(range.end),
          [source.timeZoneParam || 'timeZone']: this.calendar.options.timezone
        };

      Object.entries({ ...rangeParams, ...extraParams }).forEach(([key, value]) => {
        if (!isNil(value)) url.searchParams.set(key, value);
      });
    }

    return url.toString();
  }

  buildSourceRequestOptions(source, range) {
    const method = (source.method || 'GET').toUpperCase();
    const requestOptions = {
      method,
      headers: Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, source.headers || {}),
      credentials: source.credentials || 'same-origin'
    };

    if (method !== 'GET') {
      const extraParams = isFn(source.extraParams) ? source.extraParams() : (source.extraParams || {});
      const rangeBody = this.isStaticSource(source)
        ? {}
        : {
          [source.startParam || 'start']: formatIsoLocal(range.start),
          [source.endParam || 'end']: formatIsoLocal(range.end),
          [source.timeZoneParam || 'timeZone']: this.calendar.options.timezone
        };
      const body = { ...rangeBody, ...extraParams, ...(source.body || {}) };

      if (!requestOptions.headers['Content-Type']) requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(body);
    }

    return requestOptions;
  }

  async fetchJsonSource(source, range) {
    const response = await fetch(this.buildSourceRequestUrl(source, range), this.buildSourceRequestOptions(source, range));
    const responseText = await response.text();

    if (!response.ok) {
      const error = new Error(`Unable to load datasource "${source.id || source.url}": ${response.status} ${response.statusText}`);
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseText = responseText;
      error.response = response;
      throw error;
    }

    if (!responseText) return [];

    try {
      return JSON.parse(responseText);
    } catch (error) {
      error.status = response.status;
      error.statusText = response.statusText;
      error.responseText = responseText;
      error.response = response;
      throw error;
    }
  }
}

/**
 * InteractionManager
 * ------------------
 * Handles event drag/drop.
 *
 * Important:
 * - The original event is not moved during pointermove.
 * - A fixed mirror is used for visual feedback.
 * - Drop targets are detected from cached slot rectangles.
 * - The event store is updated only on pointerup.
 *
 * This prevents flickering when dragging horizontally between week columns.
 */
class InteractionManager {
  constructor(calendar) {
    this.calendar = calendar;

    this.dragState = null;
    this.recentlyDraggingUntil = 0;
    this.pendingPointerEvent = null;
    this.rafId = null;

    this.boundPointerMove = event => this.handlePointerMove(event);
    this.boundPointerUp = event => this.handlePointerUp(event);
  }

  /**
   * Start preparing an event drag.
   *
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {InteractionManager}
   */
  handlePointerDown(originalEvent) {
    if (originalEvent.button !== 0) return this;
    if (this.calendar.options.editable === false) return this;

    if (originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction)) {
      return this;
    }

    if (
        SCHEDULER_SELECTORS.eventResizeHandle
        && originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle)
    ) {
      return this;
    }

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);

    if (!eventElement || !this.calendar.rootElement.contains(eventElement)) {
      return this;
    }

    const schedulerEvent = this.calendar.eventStore.getEventById(eventElement.dataset.eventId);

    if (!schedulerEvent) {
      return this;
    }

    this.dragState = this.createInitialDragState({
      eventElement,
      schedulerEvent,
      originalEvent
    });

    eventElement.setPointerCapture?.(originalEvent.pointerId);

    document.addEventListener('pointermove', this.boundPointerMove);
    document.addEventListener('pointerup', this.boundPointerUp, { once: true });

    return this;
  }

  /**
   * Create the initial drag state before the drag is visually started.
   *
   * @param {Object} config - Drag config.
   * @param {HTMLElement} config.eventElement - Original event element.
   * @param {Object} config.schedulerEvent - Scheduler event.
   * @param {PointerEvent} config.originalEvent - Native pointerdown event.
   * @returns {Object}
   */
  createInitialDragState({ eventElement, schedulerEvent, originalEvent }) {
    const originalRect = eventElement.getBoundingClientRect();
    const slotGroupElement = eventElement.closest(SCHEDULER_SELECTORS.slotGroup);
    const slotGroupRect = slotGroupElement?.getBoundingClientRect();

    const eventStart = parseDateInput(schedulerEvent.start);
    const eventEnd = schedulerEvent.end
        ? parseDateInput(schedulerEvent.end)
        : addMinutes(eventStart, this.calendar.options.slotDuration || 30);

    return {
      pointerId: originalEvent.pointerId,

      event: schedulerEvent,
      eventElement,
      slotGroupElement,

      startClientX: originalEvent.clientX,
      startClientY: originalEvent.clientY,

      originalRect,
      originalStart: eventStart,
      originalEnd: eventEnd,
      durationMs: Math.max(0, eventEnd.getTime() - eventStart.getTime()),

      // Preserve the lane offset when an overlapping event is dragged.
      sourceInsetX: slotGroupRect
          ? Math.max(0, originalRect.left - slotGroupRect.left)
          : 2,

      isAllDay: isAllDayEvent(schedulerEvent),
      hasStarted: false,

      slots: [],
      currentHit: null,
      lastValidHit: null,
      mirrorElement: null,
      proposedEvent: null,
      hasResourceCollision: false
    };
  }

  /**
   * Handle pointer move.
   *
   * Drag is started only after a small distance threshold.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {InteractionManager}
   */
  handlePointerMove(originalEvent) {
    const state = this.dragState;

    if (!state) {
      return this;
    }

    const distanceX = originalEvent.clientX - state.startClientX;
    const distanceY = originalEvent.clientY - state.startClientY;
    const distance = Math.hypot(distanceX, distanceY);
    const minDistance = this.calendar.options.eventDragMinDistance ?? 4;

    if (!state.hasStarted && distance < minDistance) {
      return this;
    }

    if (!state.hasStarted) {
      this.startEventDrag(state, originalEvent);
    }

    originalEvent.preventDefault();

    this.pendingPointerEvent = originalEvent;
    this.requestDragFrame();

    return this;
  }

  /**
   * Start visual dragging.
   *
   * @param {Object} state - Drag state.
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {InteractionManager}
   */
  startEventDrag(state, originalEvent) {
    state.hasStarted = true;
    state.slots = this.collectDragSlots(state);
    state.mirrorElement = this.createDragMirror(state);

    state.eventElement.classList.add(
        CLASS_NAMES.calendar.eventDragging,
        CLASS_NAMES.calendar.eventDragSourceHidden
    );

    this.calendar.hideEventActionToolbar?.();
    this.calendar.clearSlotSelectionClasses?.();

    this.calendar._notify('eventDragStart', {
      type: 'event',
      action: 'dragStart',
      event: state.event,
      eventElement: state.eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Cache all valid drop slots once per drag.
   *
   * Using cached rects avoids unstable elementFromPoint() results when the
   * dragged event or mirror is under the pointer.
   *
   * @param {Object} state - Drag state.
   * @returns {Array<Object>}
   */
  collectDragSlots(state) {
    const expectedAllDay = state.isAllDay ? 'true' : 'false';

    return Array.from(this.calendar.rootElement.querySelectorAll(SCHEDULER_SELECTORS.slot))
        .filter(slotElement => {
          return slotElement.dataset.slotStart
              && slotElement.dataset.slotEnd
              && slotElement.dataset.slotAllDay === expectedAllDay;
        })
        .map(slotElement => {
          return {
            element: slotElement,
            rect: slotElement.getBoundingClientRect(),
            start: parseDateInput(slotElement.dataset.slotStart),
            end: parseDateInput(slotElement.dataset.slotEnd)
          };
        });
  }

  /**
   * Create the fixed drag mirror.
   *
   * @param {Object} state - Drag state.
   * @returns {HTMLElement}
   */
  createDragMirror(state) {
    const mirrorElement = state.eventElement.cloneNode(true);

    mirrorElement.classList.remove(
        CLASS_NAMES.calendar.eventSelected,
        CLASS_NAMES.calendar.eventCollision,
        CLASS_NAMES.calendar.eventCollisionPreview
    );
    mirrorElement.classList.add(CLASS_NAMES.calendar.eventDragMirror);

    mirrorElement.removeAttribute('id');
    mirrorElement.removeAttribute('tabindex');
    mirrorElement.setAttribute('aria-hidden', 'true');

    Object.assign(mirrorElement.style, {
      position: 'fixed',
      left: `${Math.round(state.originalRect.left)}px`,
      top: `${Math.round(state.originalRect.top)}px`,
      width: `${Math.round(state.originalRect.width)}px`,
      height: `${Math.round(state.originalRect.height)}px`,
      pointerEvents: 'none',
      margin: '0'
    });

    document.body.append(mirrorElement);

    return mirrorElement;
  }

  /**
   * Request one visual update per animation frame.
   *
   * @returns {InteractionManager}
   */
  requestDragFrame() {
    if (this.rafId) {
      return this;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateDragPreview();
    });

    return this;
  }

  /**
   * Update the mirror position and drop target hover.
   *
   * @returns {InteractionManager}
   */
  updateDragPreview() {
    const state = this.dragState;
    const originalEvent = this.pendingPointerEvent;

    if (!state || !state.hasStarted || !originalEvent) {
      return this;
    }

    const hit = this.getStableDragHit(state, originalEvent.clientX, originalEvent.clientY);

    // Keep the last valid position instead of jumping back to origin.
    if (!hit) {
      return this;
    }

    if (hit !== state.currentHit) {
      this.setDropTargetHover(state.currentHit?.element, false);
      this.setDropTargetHover(hit.element, true);

      state.currentHit = hit;
      state.lastValidHit = hit;
    }

    this.positionMirrorOnHit(state, hit);
    this.updateDragCollisionPreview(state, hit);

    this.calendar._notify('eventDrag', {
      type: 'event',
      action: 'drag',
      event: state.event,
      eventElement: state.eventElement,
      slotElement: hit.element,
      start: hit.start,
      end: this.getMovedEventEnd(state, hit.start),
      originalEvent
    });

    return this;
  }

  /**
   * Build the event state represented by the current drag hit.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Current slot hit.
   * @returns {Object}
   */
  getProposedEventForHit(state, hit) {
    const resourceId = hit.element.dataset.resourceId
        || state.event.resourceId
        || state.event.resourceIds?.[0]
        || null;

    return {
      ...state.event,
      start: hit.start,
      end: this.getMovedEventEnd(state, hit.start),
      allDay: state.isAllDay,
      resourceId: resourceId ? String(resourceId) : null,
      resourceIds: resourceId ? [String(resourceId)] : []
    };
  }

  /**
   * Show immediate warning feedback when the dragged event overlaps another
   * event on the same resource.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Current slot hit.
   * @returns {InteractionManager}
   */
  updateDragCollisionPreview(state, hit) {
    state.proposedEvent = this.getProposedEventForHit(state, hit);
    state.hasResourceCollision = this.calendar.updateEventCollisionPreview(
        state.mirrorElement,
        state.proposedEvent,
        state.event
    );

    return this;
  }

  /**
   * Return the current slot hit with small hysteresis.
   *
   * Hysteresis avoids flickering when the pointer is near a column or row border.
   *
   * @param {Object} state - Drag state.
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @returns {Object|null}
   */
  getStableDragHit(state, clientX, clientY) {
    const tolerance = this.calendar.options.eventDragHitTolerance ?? 3;

    if (
        state.currentHit
        && this.isPointInsideRect(clientX, clientY, state.currentHit.rect, tolerance)
    ) {
      return state.currentHit;
    }

    return this.findDragHitAtPoint(state, clientX, clientY);
  }

  /**
   * Find the slot under the pointer.
   *
   * @param {Object} state - Drag state.
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @returns {Object|null}
   */
  findDragHitAtPoint(state, clientX, clientY) {
    for (const slot of state.slots) {
      if (this.isPointInsideRect(clientX, clientY, slot.rect, 0)) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Check if a point is inside a rect.
   *
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @param {DOMRect} rect - Target rect.
   * @param {number} tolerance - Extra tolerance in px.
   * @returns {boolean}
   */
  isPointInsideRect(clientX, clientY, rect, tolerance = 0) {
    return clientX >= rect.left - tolerance
        && clientX <= rect.right + tolerance
        && clientY >= rect.top - tolerance
        && clientY <= rect.bottom + tolerance;
  }

  /**
   * Position the mirror on the selected slot.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Slot hit.
   * @returns {InteractionManager}
   */
  positionMirrorOnHit(state, hit) {
    const mirrorElement = state.mirrorElement;

    if (!mirrorElement) {
      return this;
    }

    const slotRect = hit.element.getBoundingClientRect();
    const width = Math.min(
        state.originalRect.width,
        Math.max(24, slotRect.width - 4)
    );

    const left = slotRect.left + Math.min(
        state.sourceInsetX,
        Math.max(2, slotRect.width - width - 2)
    );

    mirrorElement.style.left = `${Math.round(left)}px`;
    mirrorElement.style.top = `${Math.round(slotRect.top)}px`;
    mirrorElement.style.width = `${Math.round(width)}px`;
    mirrorElement.style.height = `${Math.round(state.originalRect.height)}px`;

    return this;
  }

  /**
   * Finish drag.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {InteractionManager}
   */
  async handlePointerUp(originalEvent) {
    const state = this.dragState;

    document.removeEventListener('pointermove', this.boundPointerMove);

    if (!state) {
      return this;
    }

    state.eventElement.releasePointerCapture?.(state.pointerId);

    if (!state.hasStarted) {
      this.dragState = null;
      return this;
    }

    originalEvent.preventDefault();

    const finalHit = state.lastValidHit || state.currentHit;

    this.cleanupEventDrag(state);

    if (finalHit) {
      await this.applyEventDrop(state, finalHit, originalEvent);
    }

    this.recentlyDraggingUntil = Date.now() + 250;

    this.calendar._notify('eventDragEnd', {
      type: 'event',
      action: 'dragEnd',
      event: state.event,
      eventElement: state.eventElement,
      slotElement: finalHit?.element || null,
      originalEvent
    });

    this.dragState = null;

    return this;
  }

  /**
   * Apply the final move once on pointerup.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Final slot hit.
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {InteractionManager}
   */
  async applyEventDrop(state, hit, originalEvent) {
    const newStart = hit.start;
    const newEnd = this.getMovedEventEnd(state, newStart);
    const oldStartTime = state.originalStart.getTime();
    const oldEndTime = state.originalEnd.getTime();

    const didDateChange =
        newStart.getTime() !== oldStartTime
        || newEnd.getTime() !== oldEndTime;

    const updates = {
      start: newStart,
      end: newEnd,
      allDay: state.isAllDay
    };

    const resourceId = hit.element.dataset.resourceId;

    if (resourceId) {
      updates.resourceId = resourceId;
      updates.resourceIds = [resourceId];
    }

    if (!didDateChange && !resourceId) {
      return this;
    }

    await Promise.resolve(this.calendar.moveEvent(state.event.id, updates, originalEvent));

    return this;
  }

  /**
   * Keep the original event duration.
   *
   * @param {Object} state - Drag state.
   * @param {Date} newStart - New start date.
   * @returns {Date}
   */
  getMovedEventEnd(state, newStart) {
    return new Date(newStart.getTime() + state.durationMs);
  }

  /**
   * Cleanup mirror, source state and hover target.
   *
   * @param {Object} state - Drag state.
   * @returns {InteractionManager}
   */
  cleanupEventDrag(state) {
    this.setDropTargetHover(state.currentHit?.element, false);

    state.eventElement.classList.remove(
        CLASS_NAMES.calendar.eventDragging,
        CLASS_NAMES.calendar.eventDragSourceHidden
    );

    state.mirrorElement?.classList.remove(CLASS_NAMES.calendar.eventCollisionPreview);
    state.mirrorElement?.remove();

    this.pendingPointerEvent = null;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    return this;
  }

  /**
   * Toggle hover state on the current drop target.
   *
   * @param {HTMLElement|null} slotElement - Slot element.
   * @param {boolean} isActive - Active state.
   * @returns {InteractionManager}
   */
  setDropTargetHover(slotElement, isActive) {
    if (!slotElement) {
      return this;
    }

    slotElement.classList.toggle(CLASS_NAMES.calendar.dropTargetHover, isActive);

    return this;
  }

  /**
   * Used by TinyScheduler to ignore the click generated after a drag.
   *
   * @returns {boolean}
   */
  wasRecentlyDragging() {
    return Date.now() < this.recentlyDraggingUntil;
  }

  /**
   * Cleanup listeners and mirrors.
   */
  destroy() {
    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);

    if (this.dragState) {
      this.cleanupEventDrag(this.dragState);
      this.dragState = null;
    }
  }
}
/**
 * AbstractView
 * ------------
 * Base class for all calendar views.
 *
 * Responsibilities:
 * - Share common view helpers.
 * - Provide a safe DOM creation helper.
 * - Provide a common event element renderer.
 * - Force child views to implement required methods.
 */
class AbstractView {
  constructor(calendar) {
    if (new.target === AbstractView) {
      throw new Error('AbstractView cannot be instantiated directly.');
    }

    this.calendar = calendar;
    this.options = calendar.options;
    this.state = calendar.state;
  }

  /**
   * Render the view.
   * Must be implemented by every child view.
   */
  render() {
    throw new Error(`${this.constructor.name}.render() must be implemented.`);
  }

  /**
   * Cleanup delegated/mounted view events.
   */
  destroy() {
    this.calendar._unmountViewEvents();
  }

  /**
   * Return the view title.
   * Child views can override it.
   */
  getTitle() {
    return '';
  }

  /**
   * Return the visible date range of the view.
   * Must be implemented by every child view.
   */
  getVisibleRange() {
    throw new Error(`${this.constructor.name}.getVisibleRange() must be implemented.`);
  }

  /**
   * Build the shared context passed to callbacks/events.
   */
  getContext(extra = {}) {
    return this.calendar.getContext({
      view: this.state.currentView,
      date: this.state.currentDate,
      range: this.state.visibleRange,
      ...extra
    });
  }

  /**
   * Create a DOM element with common project options.
   *
   * This delegates to the shared createDomElement() helper, so all views use
   * the same attribute, dataset, style and content handling.
   *
   * @param {string} tag - HTML tag name.
   * @param {string} className - Optional class string.
   * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
   * @param {Object} options - DOM options.
   * @returns {HTMLElement}
   */
  createElement(tag, className = '', content = '', options = {}) {
    return createDomElement(tag, className, content, options);
  }

  /**
   * Return true when a date is Saturday or Sunday.
   *
   * @param {Date|string|number} dateInput - Date to inspect.
   * @returns {boolean}
   */
  isWeekendDate(dateInput) {
    const day = parseDateInput(dateInput).getDay();

    return day === 0 || day === 6;
  }

  /**
   * Return true when a calendar date is before today.
   * Time of day is intentionally ignored: today never becomes visually "past".
   *
   * @param {Date|string|number} dateInput - Date to inspect.
   * @returns {boolean}
   */
  isPastDate(dateInput) {
    return startOfDay(parseDateInput(dateInput)) < startOfDay(new Date());
  }

  /**
   * Return shared state classes for any slot representing one calendar date.
   *
   * @param {Date|string|number|null} dateInput - Slot date.
   * @returns {string[]}
   */
  getDateSlotStateClasses(dateInput) {
    if (!dateInput) return [];

    return [
      this.isWeekendDate(dateInput) && CLASS_NAMES.calendar.slotWeekend,
      this.isPastDate(dateInput) && CLASS_NAMES.calendar.slotPast
    ];
  }

  /**
   * Return the shared class string for a visible day number.
   * Weekend styling is applied only to the number, never to the whole label.
   *
   * @param {Date|string|number} dateInput - Date represented by the number.
   * @param {string} baseClass - Optional view-specific class.
   * @returns {string}
   */
  getDayNumberClassName(dateInput, baseClass = '') {
    return classNames(
        baseClass,
        CLASS_NAMES.calendar.dayNumber,
        this.isWeekendDate(dateInput) && CLASS_NAMES.calendar.dayNumberWeekend
    );
  }

  /**
   * Wrap the first visible day number in a label without changing its wording.
   * This keeps custom/localized labels intact while allowing weekend coloring.
   *
   * @param {string} label - Already formatted label.
   * @param {Date|string|number} dateInput - Date represented by the label.
   * @param {string} wrapperClass - Optional class for the complete label.
   * @returns {HTMLElement}
   */
  createDateLabel(label, dateInput, wrapperClass = '') {
    const date = parseDateInput(dateInput);
    const day = String(date.getDate());
    const paddedDay = day.padStart(2, '0');
    const labelText = String(label || '');
    const dayIndex = labelText.indexOf(paddedDay) >= 0
        ? labelText.indexOf(paddedDay)
        : labelText.indexOf(day);
    const matchedDay = dayIndex >= 0 && labelText.slice(dayIndex, dayIndex + paddedDay.length) === paddedDay
        ? paddedDay
        : day;
    const wrapper = this.createElement('span', wrapperClass);

    if (dayIndex < 0) {
      wrapper.textContent = labelText;
      return wrapper;
    }

    wrapper.append(
        labelText.slice(0, dayIndex),
        this.createElement('span', this.getDayNumberClassName(date), matchedDay),
        labelText.slice(dayIndex + matchedDay.length)
    );

    return wrapper;
  }

  /**
   * Create a calendar event element.
   *
   * Events are rendered as divs to avoid invalid nested buttons inside day cells.
   * Accessibility is preserved with role="button" and tabindex="0".
   */
  createEventElement(event, displayMode = 'block', resource = null) {
    const backgroundColor = resource?.color || event.backgroundColor || event.color || this.options.eventBackgroundColor;
    const textColor = event.textColor || this.options.eventTextColor;
    const hasCollision = this.calendar.isEventMarkedCollision?.(event.id) === true;
    const isTimelineAllDay = displayMode === 'timeline' && isAllDayEvent(event);

    const element = this.createElement(
        'div',
        classNames(
            CLASS_NAMES.calendar.event,
            `${CLASS_NAMES.calendar.event}--${displayMode}`,
            hasCollision && CLASS_NAMES.calendar.eventCollision,
            isTimelineAllDay && CLASS_NAMES.calendar.eventTimelineAllDay,
            event.className
        ),
        '',
        {
          dataset: {
            eventId: event.id
          },
          attrs: {
            role: 'button',
            tabindex: '0',
            'aria-label': event.title || this.calendar._getLabel('event', 'Event'),
            ...(hasCollision ? { 'aria-invalid': 'true' } : {})
          },
          style: {
            '--tsh-event-bg': backgroundColor,
            '--tsh-event-text': textColor
          }
        }
    );

    const titleElement = this.createElement(
        'strong',
        CLASS_NAMES.calendar.eventTitle,
        event.title || '(No title)'
    );

    if (isTimelineAllDay) {
      element.append(
          this.createElement(
              'span',
              CLASS_NAMES.calendar.eventTimelineAllDayIcon,
              '', //∞
              {
                attrs: {
                  'aria-hidden': 'true',
                  title: this.calendar._getLabel('allDay', 'all-day')
                }
              }
          )
      );
    }

    element.append(titleElement);

    // Dot events should stay compact, so they do not render the description text.
    if (event.text && displayMode !== 'dot') {
      const textElement = this.createElement(
          'span',
          CLASS_NAMES.calendar.eventText,
          event.text
      );

      element.append(textElement);
    }

    this.calendar._queueEventMount(element, event, resource);

    return element;
  }



  /**
   * Check whether a timed event can receive a bottom resize handle.
   *
   * The handle is intentionally opt-in from time-grid views only. This avoids
   * adding resize UI to list, month or timeline event renderers by accident.
   *
   * @param {Object} event - Calendar event.
   * @param {string} displayMode - Event display mode.
   * @returns {boolean}
   */
  shouldRenderEventResizeHandle(event, displayMode = 'block') {
    return this.options.eventResizable !== false
        && displayMode === 'block'
        && !isAllDayEvent(event);
  }

  /**
   * Create the bottom resize handle for timed grid events.
   *
   * @returns {HTMLElement}
   */
  createEventResizeHandle() {
    return this.createElement(
        'span',
        CLASS_NAMES.calendar.eventResizeHandle,
        '',
        {
          attrs: {
            'aria-hidden': 'true'
          },
          dataset: {
            eventResizeHandle: SCHEDULER_EVENT_RESIZE_EDGES.END
          }
        }
    );
  }

  /**
   * Append a resize handle when the current view supports timed event resizing.
   *
   * @param {HTMLElement} eventElement - Rendered event element.
   * @param {Object} event - Calendar event.
   * @param {string} displayMode - Event display mode.
   * @returns {HTMLElement}
   */
  appendEventResizeHandle(eventElement, event, displayMode = 'block') {
    if (this.shouldRenderEventResizeHandle(event, displayMode)) {
      eventElement.append(this.createEventResizeHandle());
    }

    return eventElement;
  }





  /**
   * Apply compact display classes after the browser has calculated size.
   *
   * CSS cannot reliably decide from both rendered width and height whether an
   * absolutely positioned event is cramped. Measuring once after layout keeps
   * event text readable without affecting slot calculations or causing redraws.
   *
   * @param {HTMLElement} eventElement - Rendered event element.
   * @returns {AbstractView}
   */
  scheduleEventDensityUpdate(eventElement) {
    requestAnimationFrame(() => {
      const width = eventElement.offsetWidth;
      const height = eventElement.offsetHeight;

      const isTimeline = eventElement.classList.contains('tsh-event--timeline');

      const isNarrow = width > 0 && width <= 96;

      const isShort = !isTimeline && height > 0 && height < 34;

      const isTiny = isTimeline
          ? width > 0 && width < 58
          : (width > 0 && width < 58) || (height > 0 && height < 26);


      eventElement.classList.toggle(CLASS_NAMES.calendar.eventNarrow, isNarrow || isShort);
      eventElement.classList.toggle(CLASS_NAMES.calendar.eventTiny, isTiny);
    });

    return this;
  }

  /**
   * Remove current-time indicators from a view/root element.
   *
   * @param {HTMLElement} rootElement - Root element to clean.
   * @returns {AbstractView}
   */
  removeNowIndicators(rootElement = this.calendar.rootElement) {
    rootElement
        ?.querySelectorAll?.(`.${CLASS_NAMES.calendar.nowIndicator}`)
        .forEach(element => element.remove());

    return this;
  }

  /**
   * Refresh current-time indicators without redrawing the whole view.
   * Child views with a time axis override this method.
   *
   * @returns {AbstractView}
   */
  refreshNowIndicator() {
    return this;
  }


  /**
   * Refresh only event DOM inside the already mounted view.
   * Child views override this when their static grid can be kept intact.
   *
   * @param {Object} mutation - Event mutation metadata from TinyScheduler.
   * @returns {boolean} True when the view handled the refresh locally.
   */
  refreshEvents(mutation = {}) {
    return false;
  }

  /**
   * Replace the content of an event container while preserving lifecycle hooks.
   *
   * @param {HTMLElement|null} container - Container whose event children are replaced.
   * @param {Function} render - Function that appends the new event elements.
   * @returns {boolean}
   */
  refreshEventContainer(container, render) {
    if (!container || !isFn(render)) return false;

    this.calendar._unmountEventElementsIn(container);
    container.replaceChildren();
    render(container);

    return true;
  }

  /**
   * Return all date keys touched by an event inside the current visible range.
   * Useful for partial day-cell refreshes.
   *
   * @param {Object|null} event - Event to inspect.
   * @param {{start: Date, end: Date}} range - Visible range.
   * @returns {string[]}
   */
  getEventDateKeysInRange(event, range = this.getVisibleRange()) {
    if (!event || !range) return [];

    const keys = [];
    const start = startOfDay(new Date(Math.max(parseDateInput(event.start).getTime(), range.start.getTime())));
    const rawEnd = event.end ? parseDateInput(event.end) : addDays(parseDateInput(event.start), 1);
    const end = startOfDay(new Date(Math.min(rawEnd.getTime(), range.end.getTime())));
    const lastDay = rawEnd.getTime() > end.getTime() ? end : addDays(end, 1);

    for (let day = start; day < lastDay && day < range.end; day = addDays(day, 1)) {
      keys.push(formatDateKey(day));
    }

    return Array.from(new Set(keys));
  }

  /**
   * Return true when the view can draw a live current-time indicator.
   * Static views such as month/list keep the default false value.
   *
   * @returns {boolean}
   */
  supportsNowIndicator() {
    return false;
  }

  /**
   * Return true when the current-time indicator is enabled globally.
   *
   * @returns {boolean}
   */
  isNowIndicatorEnabled() {
    return this.options.showNowIndicator !== false;
  }

  /**
   * Return the current date object used by the now indicator.
   * Wrapped in a method so tests/custom views can override it easily.
   *
   * @returns {Date}
   */
  getNowIndicatorDate() {
    return new Date();
  }

  /**
   * Check whether a date is inside an inclusive/exclusive range.
   *
   * @param {Date} date - Date to test.
   * @param {{start: Date, end: Date}} range - Visible range.
   * @returns {boolean}
   */
  isDateInsideRange(date, range) {
    return Boolean(range)
        && date >= range.start
        && date < range.end;
  }

  /**
   * Return the minute-of-day, including seconds as a fraction.
   * Keeping the fraction makes the marker move smoothly when redrawn.
   *
   * @param {Date} date - Date to convert.
   * @returns {number}
   */
  getMinuteOfDay(date) {
    return date.getHours() * 60
        + date.getMinutes()
        + date.getSeconds() / 60;
  }

  /**
   * Return the label displayed next to the current-time marker.
   *
   * @param {Date} now - Current date.
   * @returns {string}
   */
  formatNowIndicatorLabel(now) {
    return formatShortTime(now, this.options);
  }

  /**
   * Build vertical time-axis data for day/week/resource time grids.
   *
   * @param {Object} config - Indicator configuration.
   * @param {{start: Date, end: Date}} config.range - Visible range.
   * @param {number} config.minMinutes - First visible minute.
   * @param {number} config.maxMinutes - Last visible minute.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @returns {{now: Date, minute: number, slotOffset: number, label: string}|null}
   */
  getVerticalNowIndicatorInfo({ range, minMinutes, maxMinutes, slotDuration }) {
    if (!this.isNowIndicatorEnabled()) return null;

    const now = this.getNowIndicatorDate();

    if (!this.isDateInsideRange(now, range)) return null;

    const minute = this.getMinuteOfDay(now);

    if (minute < minMinutes || minute > maxMinutes) return null;

    return {
      now,
      minute,
      slotOffset: (minute - minMinutes) / slotDuration,
      label: this.formatNowIndicatorLabel(now)
    };
  }

  /**
   * Create the shared DOM used by current-time indicators.
   * Individual views control position through CSS variables and class names.
   *
   * @param {Object} config - Element config.
   * @param {string} config.modifierClass - Orientation/view modifier class.
   * @param {string} config.label - Visible time label.
   * @param {Object} config.style - CSS variables for positioning.
   * @returns {HTMLElement}
   */
  createNowIndicatorElement({ modifierClass, label, style = {} }) {
    return this.createElement(
        'div',
        classNames(CLASS_NAMES.calendar.nowIndicator, modifierClass),
        [
          this.createElement('span', CLASS_NAMES.calendar.nowIndicatorLabel, label),
          this.createElement('span', CLASS_NAMES.calendar.nowIndicatorLine),
          this.createElement('span', CLASS_NAMES.calendar.nowIndicatorActiveLine),
          this.createElement('span', 'tsh-now-indicator-marker')
        ],
        {
          style,
          attrs: {
            'aria-hidden': 'true'
          }
        }
    );
  }

  /**
   * Create a horizontal now line for vertical time-grid layouts.
   *
   * @param {Object} config - Indicator config.
   * @param {{start: Date, end: Date}} config.range - Visible range.
   * @param {number} config.minMinutes - First visible minute.
   * @param {number} config.maxMinutes - Last visible minute.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.columnIndex - Active/today column index.
   * @param {number} config.columnCount - Number of columns after the time gutter.
   * @param {string} config.modifierClass - View modifier class.
   * @returns {HTMLElement|null}
   */
  createVerticalNowIndicator({
                               range,
                               minMinutes,
                               maxMinutes,
                               slotDuration,
                               columnIndex = 0,
                               columnCount = 1,
                               modifierClass = 'tsh-now-indicator--time-grid'
                             }) {
    const info = this.getVerticalNowIndicatorInfo({
      range,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    if (!info) return null;

    const safeColumnCount = Math.max(1, columnCount);
    const safeColumnIndex = Math.min(Math.max(0, columnIndex), safeColumnCount - 1);

    return this.createNowIndicatorElement({
      modifierClass,
      label: info.label,
      style: {
        '--tsh-now-offset': info.slotOffset,
        '--tsh-now-grid-columns': `repeat(${safeColumnCount}, minmax(0, 1fr))`,
        '--tsh-now-active-grid-column': `${safeColumnIndex + 1} / span 1`
      }
    });
  }

  /**
   * Calculate the left position for timeline now indicators.
   *
   * @param {Object} config - Indicator config.
   * @param {{start: Date, end: Date}} config.range - Visible range.
   * @param {Array<Object>} config.slots - Timeline slots.
   * @param {string} config.timelineRange - day/week/month.
   * @param {number} config.minMinutes - First visible minute for day timeline.
   * @param {number} config.maxMinutes - Last visible minute for day timeline.
   * @param {number} config.slotDuration - Slot duration for day timeline.
   * @returns {{leftPercent: number, label: string}|null}
   */
  getTimelineNowIndicatorInfo({
                                range,
                                slots,
                                timelineRange,
                                minMinutes,
                                maxMinutes,
                                slotDuration
                              }) {
    if (!this.isNowIndicatorEnabled()) return null;

    const now = this.getNowIndicatorDate();

    if (!this.isDateInsideRange(now, range)) return null;

    const totalUnits = Math.max(1, slots.length);
    let leftUnits;

    if (timelineRange === SCHEDULER_VIEW_NAMES.DAY) {
      const minute = this.getMinuteOfDay(now);

      if (minute < minMinutes || minute > maxMinutes) return null;

      leftUnits = (minute - minMinutes) / slotDuration;
    } else {
      leftUnits = (now.getTime() - range.start.getTime()) / 86400000;
    }

    return {
      leftPercent: (leftUnits / totalUnits) * 100,
      label: this.formatNowIndicatorLabel(now)
    };
  }

  /**
   * Create a vertical now line for horizontal timeline layouts.
   *
   * @param {Object} config - Indicator config.
   * @returns {HTMLElement|null}
   */
  createTimelineNowIndicator(config) {
    const info = this.getTimelineNowIndicatorInfo(config);

    if (!info) return null;

    return this.createNowIndicatorElement({
      modifierClass: 'tsh-now-indicator--timeline',
      label: info.label,
      style: {
        '--tsh-now-left': `${info.leftPercent}%`
      }
    });
  }

  /**
   * Create a reusable empty state block.
   */
  createEmptyState(message) {
    return this.createElement(
        'div',
        'tsh-empty',
        message || this.calendar._getLabel('noEvents', 'No events')
    );
  }
}
/**
 * MonthView
 * ---------
 * Renders the classic month grid.
 *
 * Important:
 * - The visible range always starts on the configured firstDay.
 * - The visible range always ends after the last visible week.
 * - Multi-day events are mapped per visible date, so an event from June 1 to
 *   June 12 appears on every matching day.
 */
class MonthView extends AbstractView {
  /**
   * Return the full visible month range.
   *
   * The end date is exclusive, so the render loop can safely use:
   * date < range.end
   *
   * @returns {{start: Date, end: Date}}
   */
  getVisibleRange() {
    const monthStart = startOfMonth(this.state.currentDate);
    const monthEnd = endOfMonth(this.state.currentDate);

    const rangeStart = startOfWeek(monthStart, this.options.firstDay);
    const rangeEnd = addDays(endOfWeek(monthEnd, this.options.firstDay), 1);

    return {
      start: startOfDay(rangeStart),
      end: startOfDay(rangeEnd)
    };
  }

  /**
   * Return the month title displayed in the toolbar.
   *
   * @returns {string}
   */
  getTitle() {
    return formatMonthTitle(this.state.currentDate, this.options.locale);
  }

  /**
   * Render the complete month view.
   *
   * @returns {HTMLElement}
   */
  render() {
    const range = this.getVisibleRange();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const eventsByDate = this.buildEventsByDate(range, visibleEvents);
    const currentMonth = this.state.currentDate.getMonth();

    this.state.visibleRange = range;

    const rootElement = this.createElement(
        'div',
        `${CLASS_NAMES.calendar.view} ${CLASS_NAMES.calendar.month}`
    );

    this.rootElement = rootElement;

    rootElement.append(
        this.createHeader(),
        this.createGrid(range, eventsByDate, currentMonth)
    );

    return rootElement;
  }

  /**
   * Refresh only month event wrappers.
   * Day cells, weekday header and selection/drop metadata stay mounted.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const range = this.getVisibleRange();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const eventsByDate = this.buildEventsByDate(range, visibleEvents);

    this.rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.monthDay}`).forEach(cell => {
      const dateKey = cell.dataset.date;
      const currentWrap = cell.querySelector('.tsh-month-events');
      const nextWrap = this.createEventsWrap(dateKey, eventsByDate.get(dateKey) || []);

      if (currentWrap) {
        this.calendar._unmountEventElementsIn(currentWrap);
        currentWrap.replaceWith(nextWrap);
      }
    });

    return true;
  }

  /**
   * Create weekday header.
   *
   * @returns {HTMLElement}
   */
  createHeader() {
    const header = this.createElement('div', 'tsh-month-header');
    const weekStart = startOfWeek(new Date(), this.options.firstDay);

    for (let index = 0; index < 7; index += 1) {
      const date = addDays(weekStart, index);

      header.append(
          this.createElement(
              'div',
              'tsh-month-header-cell',
              new Intl.DateTimeFormat(this.options.locale, {
                weekday: 'short'
              }).format(date)
          )
      );
    }

    return header;
  }

  /**
   * Create the month day grid.
   *
   * @param {{start: Date, end: Date}} range - Visible month range.
   * @param {Map<string, Array<Object>>} eventsByDate - Events indexed by date key.
   * @param {number} currentMonth - Current month index.
   * @returns {HTMLElement}
   */
  createGrid(range, eventsByDate, currentMonth) {
    const grid = this.createElement('div', classNames(CLASS_NAMES.calendar.monthGrid, CLASS_NAMES.calendar.slotGroup), '', {
      dataset: {
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.GRID,
        slotGroupColumns: 7
      }
    });

    for (
        let date = new Date(range.start);
        date < range.end;
        date = addDays(date, 1)
    ) {
      grid.append(
          this.createDayCell({
            date,
            currentMonth,
            events: eventsByDate.get(formatDateKey(date)) || []
          })
      );
    }

    return grid;
  }

  /**
   * Create one day cell.
   *
   * @param {Object} config - Cell configuration.
   * @param {Date} config.date - Cell date.
   * @param {number} config.currentMonth - Current month index.
   * @param {Array<Object>} config.events - Events visible on this date.
   * @returns {HTMLElement}
   */
  createDayCell({ date, currentMonth, events }) {
    const dateKey = formatDateKey(date);
    const isToday = isSameDay(date, new Date());

    const cell = this.createElement(
        'div',
        classNames(
            CLASS_NAMES.calendar.monthDay,
            CLASS_NAMES.calendar.slot,
            ...this.getDateSlotStateClasses(date),
            isToday && 'tsh-month-day--today',
            date.getMonth() !== currentMonth && 'tsh-month-day--muted'
        ),
        '',
        {
          attrs: {
            role: 'button',
            tabindex: '0'
          },
          dataset: {
            date: dateKey,
            slotKind: SCHEDULER_SLOT_KINDS.MONTH,
            slotStart: formatIsoLocal(date),
            slotEnd: formatIsoLocal(addDays(date, 1)),
            slotAllDay: 'true'
          }
        }
    );

    if (isToday) {
      cell.setAttribute('aria-current', 'date');
    }

    const number = this.createElement(
        'a',
        this.getDayNumberClassName(date, CLASS_NAMES.calendar.monthDayNumber),
        String(date.getDate()),
        {
          attrs: {
            href: '#'
          },
          dataset: {
            date: dateKey,
            dateNav: SCHEDULER_VIEW_NAMES.DAY
          }
        }
    );

    const eventsWrap = this.createEventsWrap(dateKey, events);

    cell.append(number, eventsWrap);

    return cell;
  }

  /**
   * Create event wrapper for one day cell.
   *
   * @param {string} dateKey - Date key in YYYY-MM-DD format.
   * @param {Array<Object>} events - Events visible on this date.
   * @returns {HTMLElement}
   */
  createEventsWrap(dateKey, events) {
    const eventsWrap = this.createElement('div', 'tsh-month-events');
    const sortedEvents = this.sortDayEvents(events);
    const maxEvents = this.options.maxEventsPerDay;

    sortedEvents.slice(0, maxEvents).forEach(event => {
      eventsWrap.append(this.createMonthEventElement(event, dateKey));
    });

    if (sortedEvents.length > maxEvents) {
      eventsWrap.append(
          this.createMoreButton(dateKey, sortedEvents.length - maxEvents)
      );
    }

    return eventsWrap;
  }

  /**
   * Create one event element for month view.
   *
   * @param {Object} event - Calendar event.
   * @param {string} dateKey - Date key in YYYY-MM-DD format.
   * @returns {HTMLElement}
   */
  createMonthEventElement(event, dateKey) {
    if (isAllDayEvent(event)) {
      const eventElement = this.createEventElement(event, 'all-day');

      eventElement.dataset.date = dateKey;

      return eventElement;
    }

    const compact = this.createElement('span', 'tsh-month-dot-event');
    const dot = this.createElement('span', 'tsh-month-dot');
    const label = this.createElement(
        'span',
        '',
        `${formatShortTime(event.start, this.options)} ${event.title}`
    );

    compact.dataset.eventId = event.id;
    compact.style.setProperty('--tsh-event-bg', event.backgroundColor || event.color);
    compact.append(dot, label);

    this.calendar._queueEventMount(compact, event, null);

    return compact;
  }

  /**
   * Create the "+ more" button.
   *
   * @param {string} dateKey - Date key in YYYY-MM-DD format.
   * @param {number} hiddenCount - Number of hidden events.
   * @returns {HTMLButtonElement}
   */
  createMoreButton(dateKey, hiddenCount) {
    const moreButton = this.createElement(
        'button',
        'tsh-month-more',
        `+${hiddenCount} more`
    );

    moreButton.type = 'button';
    moreButton.dataset.moreDate = dateKey;
    moreButton.dataset.tooltip = this.calendar._getTooltip(
        'moreEvents',
        'Show more events'
    );

    return moreButton;
  }

  /**
   * Build a reliable date index for all visible events.
   *
   * This fixes multi-day events that were not displayed across their full range
   * when relying only on EventStore.getEventsByDate().
   *
   * @param {{start: Date, end: Date}} range - Visible month range.
   * @param {Array<Object>} events - Visible events.
   * @returns {Map<string, Array<Object>>}
   */
  buildEventsByDate(range, events) {
    const eventsByDate = new Map();

    for (
        let date = new Date(range.start);
        date < range.end;
        date = addDays(date, 1)
    ) {
      const dateKey = formatDateKey(date);
      const dayEvents = events.filter(event => isEventOnDate(event, date));

      eventsByDate.set(dateKey, dayEvents);
    }

    return eventsByDate;
  }

  /**
   * Sort all-day events first, then by start date.
   *
   * @param {Array<Object>} events - Events visible on one date.
   * @returns {Array<Object>}
   */
  sortDayEvents(events) {
    return events.slice().sort((firstEvent, secondEvent) => {
      return Number(!isAllDayEvent(firstEvent)) - Number(!isAllDayEvent(secondEvent))
          || firstEvent.start - secondEvent.start;
    });
  }
}
/**
 * TimeGridView
 * ------------
 * Renders the classic day/week time grid.
 *
 * Structure:
 * - Header row: day labels.
 * - All-day row: all-day events.
 * - Scroll body:
 *   - left time column with visual slots + time labels.
 *   - day columns with visual slots + absolute event layer.
 *
 * Important:
 * Grid slots are normal divs, but events remain absolute-positioned.
 * This keeps the grid clean while preserving precise event placement.
 */
class TimeGridView extends AbstractView {
  /**
   * Time-grid views have a real vertical time axis, so they can display
   * the current-time line when today is visible.
   *
   * @returns {boolean}
   */
  supportsNowIndicator() {
    return true;
  }

  isWeek() {
    return this.state.currentView === 'week';
  }

  getDays() {
    const start = this.isWeek()
        ? startOfWeek(this.state.currentDate, this.options.firstDay)
        : startOfDay(this.state.currentDate);

    return Array.from(
        { length: this.isWeek() ? 7 : 1 },
        (_, index) => addDays(start, index)
    );
  }

  getVisibleRange() {
    const days = this.getDays();

    return {
      start: startOfDay(days[0]),
      end: addDays(startOfDay(days[days.length - 1]), 1)
    };
  }

  getTitle() {
    const range = this.getVisibleRange();

    return this.isWeek()
        ? formatRangeTitle(range.start, range.end, this.options.locale)
        : formatDayTitle(this.state.currentDate, this.options.locale);
  }

  render() {
    const days = this.getDays();
    const range = this.getVisibleRange();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);

    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.options.slotDuration || 30;
    const slotHeight = this.options.slotHeight || '3rem';
    const slotCount = Math.ceil((maxMinutes - minMinutes) / slotDuration);

    this.state.visibleRange = range;

    const rootElement = this.createElement(
        'div',
        `${CLASS_NAMES.calendar.view} ${CLASS_NAMES.calendar.timeGrid}`
    );

    // Keep a reference to this view root so live UI layers such as the
    // current-time indicator can be refreshed without scanning the whole page.
    this.rootElement = rootElement;

    const headerElement = this.createHeader(days);
    const allDayRowElement = this.createAllDayRow(days, visibleEvents);
    const scrollElement = this.createTimeGridScroll({
      days,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration,
      slotHeight,
      slotCount
    });

    rootElement.append(headerElement, allDayRowElement, scrollElement);

    return rootElement;
  }

  /**
   * Create the top day header.
   */
  createHeader(days) {
    const headerElement = this.createElement('div', 'tsh-time-grid-header', '', {
      style: {
        gridTemplateColumns: this.getDayGridTemplateColumns(days.length)
      }
    });

    headerElement.append(this.createElement('div', 'tsh-time-grid-corner'));

    days.forEach(day => {
      headerElement.append(this.createDayLabel(day));
    });

    return headerElement;
  }

  /**
   * Create a clickable day label.
   * Clicking it can navigate to the day view.
   */
  createDayLabel(day) {
    const labelText = this.formatDayLabel(day);
    const labelContent = this.isWeek()
        ? this.createDateLabel(labelText, day, 'tsh-time-grid-day-label-text')
        : labelText;

    return this.createElement(
        'button',
        classNames(
            'tsh-time-grid-day-label',
            this.isWeekendDate(day) && 'tsh-time-grid-day-label--weekend',
            this.isPastDate(day) && 'tsh-time-grid-day-label--past',
            isSameDay(day, new Date()) && 'tsh-time-grid-day-label--today'
        ),
        labelContent,
        {
          props: {
            type: 'button'
          },
          dataset: {
            date: formatDateKey(day),
            dateNav: 'day',
            tooltip: this.calendar._getTooltip(
                'openDay',
                this.calendar._getLabel('day', 'Day')
            )
          }
        }
    );
  }

  formatDayLabel(day) {
    const formatOptions = this.isWeek()
        ? { weekday: 'short', month: 'numeric', day: 'numeric' }
        : { weekday: 'long' };

    return new Intl.DateTimeFormat(this.options.locale, formatOptions).format(day);
  }

  /**
   * Create the all-day row below the header.
   */
  createAllDayRow(days, visibleEvents) {
    const allDayRowElement = this.createElement('div', classNames('tsh-time-grid-all-day-row', CLASS_NAMES.calendar.slotGroup), '', {
      dataset: {
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
      },
      style: {
        gridTemplateColumns: this.getDayGridTemplateColumns(days.length)
      }
    });

    allDayRowElement.append(
        this.createElement(
            'div',
            'tsh-time-grid-all-day-label',
            this.calendar._getLabel('allDay', 'all-day')
        )
    );

    days.forEach(day => {
      const allDayCellElement = this.createElement(
          'div',
          classNames(
              'tsh-time-grid-all-day-cell',
              CLASS_NAMES.calendar.slot,
              ...this.getDateSlotStateClasses(day),
              isSameDay(day, new Date()) && 'tsh-time-grid-day--today'
          ),
          '',
          {
            dataset: {
              slotKind: SCHEDULER_SLOT_KINDS.TIME_GRID,
              slotStart: formatIsoLocal(startOfDay(day)),
              slotEnd: formatIsoLocal(addDays(startOfDay(day), 1)),
              slotAllDay: 'true'
            }
          }
      );

      visibleEvents
          .filter(event => isAllDayEvent(event) && isEventOnDate(event, day))
          .forEach(event => {
            allDayCellElement.append(this.createEventElement(event, 'all-day'));
          });

      allDayRowElement.append(allDayCellElement);
    });

    return allDayRowElement;
  }

  /**
   * Create the scrollable time grid body.
   */
  createTimeGridScroll({
                         days,
                         visibleEvents,
                         minMinutes,
                         maxMinutes,
                         slotDuration,
                         slotHeight,
                         slotCount
                       }) {
    const scrollElement = this.createElement('div', classNames('tsh-time-grid-scroll', CLASS_NAMES.calendar.scrollContainer));

    const bodyElement = this.createElement('div', 'tsh-time-grid-body', '', {
      style: {
        '--tsh-slot-height': slotHeight,
        '--tsh-slot-count': slotCount
      }
    });

    const timeColumnElement = this.createTimeColumn({
      minMinutes,
      maxMinutes,
      slotDuration,
      slotCount
    });

    const columnsElement = this.createDayColumns({
      days,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration,
      slotCount
    });

    bodyElement.append(timeColumnElement, columnsElement);
    scrollElement.append(bodyElement);

    /*
      The view is still detached from the DOM while render() is running.
      The now indicator depends on real column widths, so we measure and
      render it on the next frame, after TinyScheduler has mounted the view.
    */
    this.scheduleNowIndicatorRefresh();

    return scrollElement;
  }

  /**
   * Schedule a current-time indicator refresh after the view is mounted.
   *
   * @returns {TimeGridView}
   */
  scheduleNowIndicatorRefresh() {
    if (!this.isNowIndicatorEnabled()) return this;

    requestAnimationFrame(() => {
      this.refreshNowIndicator();
    });

    return this;
  }

  /**
   * Refresh the current-time indicator in-place without redrawing events.
   * This is used by TinyScheduler's minute clock.
   *
   * @returns {TimeGridView}
   */
  refreshNowIndicator() {
    const bodyElement = this.getTimeGridBodyElement();

    if (!bodyElement) return this;

    const days = this.getDays();
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.options.slotDuration || 30;
    const nowIndicator = this.createTimeGridNowIndicator({
      days,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    this.removeNowIndicators(bodyElement);

    if (nowIndicator) {
      bodyElement.append(nowIndicator);
    }

    return this;
  }

  /**
   * Refresh only all-day and timed event layers.
   * The grid/header/scroll containers stay mounted, so scroll position is stable.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const days = this.getDays();
    const range = this.getVisibleRange();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.options.slotDuration || 30;

    this.refreshAllDayEvents(days, visibleEvents);
    this.refreshTimedEventLayers({
      days,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    return true;
  }

  /**
   * Refresh all all-day cells without rebuilding the row.
   *
   * @param {Date[]} days - Visible days.
   * @param {Array<Object>} visibleEvents - Events in the visible range.
   * @returns {TimeGridView}
   */
  refreshAllDayEvents(days, visibleEvents) {
    days.forEach(day => {
      const cellElement = this.getAllDayCellElement(day);

      this.refreshEventContainer(cellElement, container => {
        visibleEvents
            .filter(event => isAllDayEvent(event) && isEventOnDate(event, day))
            .forEach(event => container.append(this.createEventElement(event, 'all-day')));
      });
    });

    return this;
  }

  /**
   * Refresh all timed day event layers and recalculate overlaps.
   *
   * @param {Object} config - Timed refresh config.
   * @returns {TimeGridView}
   */
  refreshTimedEventLayers({ days, visibleEvents, minMinutes, maxMinutes, slotDuration }) {
    days.forEach(day => {
      const columnElement = this.getDayColumnElement(day);
      const eventsLayerElement = columnElement?.querySelector('.tsh-time-grid-events');

      this.refreshEventContainer(eventsLayerElement, container => {
        this.renderTimedEvents({
          eventsLayerElement: container,
          day,
          visibleEvents,
          minMinutes,
          maxMinutes,
          slotDuration
        });
      });
    });

    return this;
  }

  /**
   * Return the mounted all-day cell for a given day.
   *
   * @param {Date} day - Day to find.
   * @returns {HTMLElement|null}
   */
  getAllDayCellElement(day) {
    const slotStart = formatIsoLocal(startOfDay(day));
    const rootElement = this.rootElement || this.calendar.rootElement;

    return Array.from(rootElement.querySelectorAll('.tsh-time-grid-all-day-cell'))
        .find(element => element.dataset.slotStart === slotStart) || null;
  }

  /**
   * Return the mounted time-grid body.
   *
   * @returns {HTMLElement|null}
   */
  getTimeGridBodyElement() {
    return this.rootElement?.querySelector('.tsh-time-grid-body')
        || this.calendar.rootElement.querySelector('.tsh-time-grid-body');
  }

  /**
   * Return the mounted day columns wrapper.
   *
   * @returns {HTMLElement|null}
   */
  getTimeGridColumnsElement() {
    return this.rootElement?.querySelector('.tsh-time-grid-columns')
        || this.calendar.rootElement.querySelector('.tsh-time-grid-columns');
  }

  /**
   * Return the mounted column for the given day.
   *
   * @param {Date} day - Day to find.
   * @returns {HTMLElement|null}
   */
  getDayColumnElement(day) {
    const dateKey = formatDateKey(day);

    return this.rootElement?.querySelector(`.tsh-time-grid-column[data-date="${dateKey}"]`)
        || this.calendar.rootElement.querySelector(`.tsh-time-grid-column[data-date="${dateKey}"]`);
  }

  /**
   * Create the current-time indicator for day/week grids.
   *
   * The indicator uses real DOM measurements instead of percentage columns.
   * This keeps the marker and the solid today segment aligned when the grid has
   * a time gutter, borders, responsive widths or horizontal scrolling.
   *
   * @param {Object} config - Indicator config.
   * @param {Date[]} config.days - Rendered days.
   * @param {number} config.minMinutes - First visible minute.
   * @param {number} config.maxMinutes - Last visible minute.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @returns {HTMLElement|null}
   */
  createTimeGridNowIndicator({ days, minMinutes, maxMinutes, slotDuration }) {
    const now = this.getNowIndicatorDate();
    const todayIndex = days.findIndex(day => isSameDay(day, now));

    if (todayIndex === -1) return null;

    const info = this.getVerticalNowIndicatorInfo({
      range: this.getVisibleRange(),
      minMinutes,
      maxMinutes,
      slotDuration
    });

    if (!info) return null;

    const bodyElement = this.getTimeGridBodyElement();
    const columnsElement = this.getTimeGridColumnsElement();
    const todayColumnElement = this.getDayColumnElement(now);

    if (!bodyElement || !columnsElement || !todayColumnElement) {
      return null;
    }

    const firstSlotElement = todayColumnElement.querySelector(`.${CLASS_NAMES.calendar.timeGridSlot}`);
    const slotHeight = firstSlotElement?.getBoundingClientRect().height
        || columnsElement.scrollHeight / Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));

    if (!slotHeight) return null;

    const bodyRect = bodyElement.getBoundingClientRect();
    const columnsRect = columnsElement.getBoundingClientRect();
    const todayColumnRect = todayColumnElement.getBoundingClientRect();
    const timeColumnElement = bodyElement.querySelector('.tsh-time-grid-times');
    const timeColumnWidth = timeColumnElement?.getBoundingClientRect().width || 0;

    const columnsLeft = columnsRect.left - bodyRect.left;
    const columnsWidth = columnsElement.offsetWidth || columnsRect.width;
    const todayLeft = todayColumnRect.left - bodyRect.left;
    const todayWidth = todayColumnRect.width;
    const top = info.slotOffset * slotHeight;

    return this.createElement(
        'div',
        classNames(CLASS_NAMES.calendar.nowIndicator, 'tsh-now-indicator--time-grid'),
        [
          this.createElement('span', CLASS_NAMES.calendar.nowIndicatorLabel, info.label),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--before`),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--today`),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--after`),
          this.createElement('span', 'tsh-now-indicator-marker')
        ],
        {
          style: {
            '--tsh-now-top': `${top}px`,
            '--tsh-now-label-width': `${timeColumnWidth}px`,
            '--tsh-now-columns-left': `${columnsLeft}px`,
            '--tsh-now-columns-width': `${columnsWidth}px`,
            '--tsh-now-today-left': `${todayLeft}px`,
            '--tsh-now-today-width': `${todayWidth}px`
          },
          attrs: {
            'aria-hidden': 'true'
          }
        }
    );
  }

  /**
   * Create the left time column.
   *
   * It contains the same slot grid as day columns so horizontal lines match.
   * Labels are absolute-positioned on top of the slot grid.
   */
  createTimeColumn({ minMinutes, maxMinutes, slotDuration, slotCount }) {
    const timeColumnElement = this.createElement('div', 'tsh-time-grid-times');

    timeColumnElement.append(
        this.createSlotGrid({
          className: 'tsh-time-grid-slots tsh-time-grid-time-slots',
          minMinutes,
          maxMinutes,
          slotDuration,
          slotCount,
          showTimeLabels: true
        })
    );

    return timeColumnElement;
  }

  /**
   * Create all day columns.
   */
  createDayColumns({
                     days,
                     visibleEvents,
                     minMinutes,
                     maxMinutes,
                     slotDuration,
                     slotCount
                   }) {
    const columnsElement = this.createElement('div', 'tsh-time-grid-columns', '', {
      style: {
        gridTemplateColumns: `repeat(${days.length}, minmax(150px, 1fr))`
      }
    });

    days.forEach(day => {
      columnsElement.append(
          this.createDayColumn({
            day,
            visibleEvents,
            minMinutes,
            maxMinutes,
            slotDuration,
            slotCount
          })
      );
    });

    return columnsElement;
  }

  /**
   * Create one day column.
   *
   * Slots are normal divs.
   * Events are rendered inside an absolute overlay layer.
   */
  createDayColumn({
                    day,
                    visibleEvents,
                    minMinutes,
                    maxMinutes,
                    slotDuration,
                    slotCount
                  }) {
    const columnElement = this.createElement(
        'div',
        classNames(
            CLASS_NAMES.calendar.timeGridColumn,
            CLASS_NAMES.calendar.slotGroup,
            ...this.getDateSlotStateClasses(day),
            isSameDay(day, new Date()) && 'tsh-time-grid-day--today'
        ),
        '',
        {
          dataset: {
            date: formatDateKey(day),
            dropKind: 'timeGrid',
            dropDate: formatDateKey(day),
            slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.VERTICAL
          }
        }
    );

    const slotsElement = this.createSlotGrid({
      className: 'tsh-time-grid-slots',
      day,
      slotKind: SCHEDULER_SLOT_KINDS.TIME_GRID,
      minMinutes,
      slotDuration,
      slotCount
    });

    const eventsLayerElement = this.createElement('div', 'tsh-time-grid-events');

    this.renderTimedEvents({
      eventsLayerElement,
      day,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    columnElement.append(slotsElement, eventsLayerElement);

    return columnElement;
  }

  /**
   * Create the visual slot grid.
   *
   * Example:
   * <div class="tsh-time-grid-slots">
   *   <div class="tsh-time-grid-slot tsh-time-grid-slot--hour"></div>
   *   <div class="tsh-time-grid-slot"></div>
   * </div>
   */
  createSlotGrid({
                   className,
                   day = null,
                   slotKind = null,
                   minMinutes,
                   maxMinutes,
                   slotDuration,
                   slotCount,
                   showTimeLabels = false
                 }) {
    const slotsElement = this.createElement('div', className, '', {
      style: {
        '--tsh-slot-count': slotCount
      }
    });

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const minute = minMinutes + slotIndex * slotDuration;
      const isHourSlot = minute % 60 === 0;

      const slotStart = day ? addMinutes(startOfDay(day), minute) : null;
      const slotEnd = slotStart ? addMinutes(slotStart, slotDuration) : null;
      const slotElement = this.createElement(
          'div',
          classNames(
              CLASS_NAMES.calendar.timeGridSlot,
              slotKind && CLASS_NAMES.calendar.slot,
              ...(day ? this.getDateSlotStateClasses(day) : []),
              isHourSlot && 'tsh-time-grid-slot--hour'
          ),
          '',
          {
            dataset: {
              minute,
              slotKind,
              slotStart: slotStart ? formatIsoLocal(slotStart) : null,
              slotEnd: slotEnd ? formatIsoLocal(slotEnd) : null,
              slotAllDay: slotKind ? 'false' : null
            }
          }
      );

      // Time labels belong to the hour slot itself, not to an absolute overlay.
      if (showTimeLabels && isHourSlot) {
        slotElement.append(
            this.createElement(
                'span',
                'tsh-time-grid-time',
                formatSlotLabel(minute, this.options)
            )
        );
      }

      slotsElement.append(slotElement);
    }

    return slotsElement;
  }

  /**
   * Render non-all-day events into the absolute event layer.
   */
  renderTimedEvents({
                      eventsLayerElement,
                      day,
                      visibleEvents,
                      minMinutes,
                      maxMinutes,
                      slotDuration
                    }) {
    const dayEvents = visibleEvents.filter(event => {
      return !isAllDayEvent(event) && isEventOnDate(event, day);
    });

    const layoutMap = buildTimedEventLayout(dayEvents, {
      minMinutes,
      maxMinutes,
      slotEventOverlap: this.options.slotEventOverlap !== false,
      eventMaxStack: this.options.eventMaxStack || null
    });

    dayEvents.forEach(event => {
      const position = this.getTimedEventPosition({
        event,
        day,
        minMinutes,
        maxMinutes,
        slotDuration
      });

      if (!position) return;

      const layout = layoutMap.get(String(event.id)) || getDefaultTimedEventLayout();
      const eventElement = this.createEventElement(event, 'block');
      const timeElement = this.createElement(
          'span',
          CLASS_NAMES.calendar.eventTime || 'tsh-event-time',
          formatTimeRange(event.start, event.end, this.options)
      );

      Object.assign(eventElement.dataset, {
        resizeKind: SCHEDULER_SLOT_KINDS.TIME_GRID,
        resizeDate: formatDateKey(day),
        resizeMinMinutes: String(minMinutes),
        resizeMaxMinutes: String(maxMinutes),
        resizeSlotDuration: String(slotDuration)
      });

      this.appendEventResizeHandle(eventElement, event, 'block');

      eventElement.style.top = `calc(${position.startOffset} * var(--tsh-slot-height))`;
      eventElement.style.height = `calc(${position.slotSpan} * var(--tsh-slot-height))`;
      eventElement.style.left = `calc(${layout.leftPercent}% + 2px)`;
      eventElement.style.right = `calc(${layout.rightPercent}% + 2px)`;
      eventElement.style.width = 'auto';
      eventElement.style.zIndex = layout.zIndex;

      eventElement.prepend(timeElement);
      eventsLayerElement.append(eventElement);
      this.scheduleEventDensityUpdate(eventElement);
    });
  }

  /**
   * Apply compact display classes after the browser has calculated event size.
   *
   * @param {HTMLElement} eventElement - Rendered event element.
   * @returns {AbstractView}
   */
  scheduleEventDensityUpdate(eventElement) {
    return super.scheduleEventDensityUpdate(eventElement);
  }

  /**
   * Calculate event top/height in slot units.
   *
   * This supports events that start before the visible range
   * or end after the visible range.
   */
  getTimedEventPosition({ event, day, minMinutes, maxMinutes, slotDuration }) {
    const dayStart = startOfDay(day);
    const eventStart = parseDateInput(event.start);
    const eventEnd = event.end
        ? parseDateInput(event.end)
        : addMinutes(eventStart, 60);

    const visibleStart = addMinutes(dayStart, minMinutes);
    const visibleEnd = addMinutes(dayStart, maxMinutes);

    const clampedStart = new Date(Math.max(eventStart.getTime(), visibleStart.getTime()));
    const clampedEnd = new Date(Math.min(eventEnd.getTime(), visibleEnd.getTime()));

    if (clampedEnd <= clampedStart) {
      return null;
    }

    const startMinute = Math.round((clampedStart - dayStart) / 60000);
    const endMinute = Math.round((clampedEnd - dayStart) / 60000);

    return {
      startOffset: this.getSlotOffset(startMinute, minMinutes, slotDuration),
      slotSpan: Math.max(
          0.5,
          (endMinute - startMinute) / slotDuration
      )
    };
  }

  getSlotOffset(minute, minMinutes, slotDuration) {
    return (minute - minMinutes) / slotDuration;
  }

  getDayGridTemplateColumns(dayCount) {
    return `var(--tsh-time-column-width) repeat(${dayCount}, minmax(150px, 1fr))`;
  }
}

class ListView extends AbstractView {
  getVisibleRange() {
    const start = startOfWeek(this.state.currentDate, this.options.firstDay);

    return {
      start,
      end: addDays(start, 7)
    };
  }

  getTitle() {
    const range = this.getVisibleRange();

    return formatRangeTitle(range.start, range.end, this.options.locale);
  }

  render() {
    const range = this.getVisibleRange();
    const rootElement = this.createElement(
        'div',
        classNames(CLASS_NAMES.calendar.view, CLASS_NAMES.calendar.list, CLASS_NAMES.calendar.scrollContainer)
    );

    this.state.visibleRange = range;
    this.rootElement = rootElement;
    this.renderListContent(rootElement, range);

    return rootElement;
  }

  /**
   * Refresh only list rows while preserving the mounted scroll container.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const range = this.getVisibleRange();

    this.calendar._unmountEventElementsIn(this.rootElement);
    this.rootElement.replaceChildren();
    this.renderListContent(this.rootElement, range);

    return true;
  }

  /**
   * Render list sections into the provided container.
   *
   * @param {HTMLElement} rootElement - List root.
   * @param {{start: Date, end: Date}} range - Visible range.
   * @returns {ListView}
   */
  renderListContent(rootElement, range) {
    const events = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const eventsByDate = this.calendar.eventStore.getEventsByDate(events);
    let hasEvents = false;

    for (let day = new Date(range.start); day < range.end; day = addDays(day, 1)) {
      const dayEvents = eventsByDate.get(formatDateKey(day)) || [];

      if (!dayEvents.length) continue;

      hasEvents = true;
      rootElement.append(this.createDaySection(day, dayEvents));
    }

    if (!hasEvents) {
      rootElement.append(this.createEmptyState());
    }

    return this;
  }

  /**
   * Create one list day section.
   *
   * @param {Date} day - Section day.
   * @param {Array<Object>} events - Events on the day.
   * @returns {HTMLElement}
   */
  createDaySection(day, events) {
    const section = this.createElement('section', 'tsh-list-day');
    const header = this.createElement('div', 'tsh-list-day-header');

    header.append(
        this.createElement('strong', '', new Intl.DateTimeFormat(this.options.locale, { weekday: 'long' }).format(day)),
        this.createElement('span', '', formatDayTitle(day, this.options.locale))
    );

    section.append(header);
    events.forEach(event => section.append(this.createListEventRow(event)));

    return section;
  }

  /**
   * Create one list event row without injecting untrusted HTML.
   *
   * @param {Object} event - Calendar event.
   * @returns {HTMLButtonElement}
   */
  createListEventRow(event) {
    const row = this.createElement('button', 'tsh-list-row', '', {
      props: {
        type: 'button'
      },
      dataset: {
        eventId: event.id
      }
    });

    const time = isAllDayEvent(event)
        ? this.calendar._getLabel('allDay', 'all-day')
        : formatTimeRange(event.start, event.end, this.options);

    const dot = this.createElement('span', 'tsh-list-dot', '', {
      style: {
        background: event.backgroundColor || event.color
      }
    });

    const main = this.createElement('span', 'tsh-list-main');
    main.append(this.createElement('strong', '', event.title));

    if (event.text) {
      main.append(this.createElement('span', '', event.text));
    }

    row.append(
        this.createElement('span', 'tsh-list-time', time),
        dot,
        main
    );

    this.calendar._queueEventMount(row, event, null);

    return row;
  }
}

/**
 * ResourceTimeGridView
 * --------------------
 * Renders the resource time-grid planning view.
 *
 * Layout:
 * - one shared scroll container owns header, all-day row and timed body;
 * - day range: resources are displayed as columns;
 * - week range: each visible column is a day/resource pair;
 * - the time column keeps a fixed width and can stay visible during horizontal scroll;
 * - visual grid separators are real slot elements, not absolutely-positioned lines;
 * - hour labels are rendered inside their own hour slot cells;
 * - timed events stay absolutely positioned in an overlay layer for precise
 *   start/end placement, dragging, resizing and overlap handling.
 */
class ResourceTimeGridView extends AbstractView {
  /**
   * Resource time-grid views have a vertical time axis, so they can display
   * the current-time line when today is inside the visible range.
   *
   * @returns {boolean}
   */
  supportsNowIndicator() {
    return true;
  }

  /**
   * Return true when the resource grid is rendered for a full week.
   *
   * @returns {boolean}
   */
  isWeekRange() {
    return (this.state.planningRange || 'day') === 'week';
  }

  /**
   * Return the visible range for the current planning range.
   *
   * @returns {{start: Date, end: Date}}
   */
  getVisibleRange() {
    if (this.isWeekRange()) {
      const start = startOfWeek(this.state.currentDate, this.options.firstDay);

      return {
        start,
        end: addDays(start, 7)
      };
    }

    const start = startOfDay(this.state.currentDate);

    return {
      start,
      end: addDays(start, 1)
    };
  }

  /**
   * Return the days represented by the current resource time-grid.
   *
   * @returns {Date[]}
   */
  getDays() {
    const range = this.getVisibleRange();
    const dayCount = this.isWeekRange() ? 7 : 1;

    return Array.from({ length: dayCount }, (_, index) => addDays(range.start, index));
  }

  /**
   * Return the toolbar title for the resource time-grid view.
   *
   * @returns {string}
   */
  getTitle() {
    const range = this.getVisibleRange();

    return this.isWeekRange()
        ? formatRangeTitle(range.start, range.end, this.options.locale)
        : formatDayTitle(this.state.currentDate, this.options.locale);
  }

  /**
   * Return top-level resources displayed as columns.
   *
   * @returns {Array<Object>}
   */
  getVisibleResources() {
    return this.calendar.resourceStore
        .getResources()
        .filter(resource => !resource.parentId);
  }

  /**
   * Build the render columns.
   *
   * In day mode, one column represents one resource on the selected day.
   * In week mode, one column represents one day/resource pair. This gives the
   * grid the missing date dimension and keeps event placement unambiguous.
   *
   * @param {Date[]} days - Visible days.
   * @param {Array<Object>} resources - Visible resources.
   * @returns {Array<Object>}
   */
  getColumns(days, resources) {
    if (!resources.length) return [];

    return days.flatMap(day => {
      const dateKey = formatDateKey(day);

      return resources.map(resource => ({
        id: `${dateKey}:${resource.id}`,
        day,
        dateKey,
        resource,
        resourceId: String(resource.id)
      }));
    });
  }

  /**
   * Return true when an event belongs to a resource.
   *
   * @param {Object} event - Calendar event.
   * @param {Object} resource - Calendar resource.
   * @returns {boolean}
   */
  eventBelongsToResource(event, resource) {
    const resourceIds = Array.isArray(event.resourceIds)
        ? event.resourceIds
        : [event.resourceId].filter(Boolean);

    return resourceIds.some(resourceId => String(resourceId) === String(resource.id));
  }

  /**
   * Return the duration of one visual slot in minutes.
   *
   * @returns {number}
   */
  getSlotDuration() {
    return this.options.resourceTimeGridSlotDuration || this.options.slotDuration || 30;
  }

  /**
   * Return the CSS height used by one visual slot.
   *
   * The returned value is normalized to pixels when it uses em/rem. This is
   * important because event boxes often use a smaller font-size than grid
   * slots. If an inherited CSS variable contains `1.5em`, the browser resolves
   * it against the event font-size when calculating `top`, which makes events
   * appear too high. A px value keeps the visual slot grid and event layer in
   * the same vertical coordinate system.
   *
   * @returns {string}
   */
  getSlotHeight() {
    const slotHeight = this.options.resourceTimeGridSlotHeight || '1.5em';

    return this.normalizeSlotHeight(slotHeight);
  }

  /**
   * Normalize em/rem slot heights to px so event positioning is independent
   * from the font-size of the rendered event element.
   *
   * @param {string|number} value - Configured slot height.
   * @returns {string}
   */
  normalizeSlotHeight(value) {
    if (typeof value === 'number') {
      return `${value}px`;
    }

    const slotHeight = String(value || '').trim();

    if (!slotHeight) {
      return '24px';
    }

    if (slotHeight.endsWith('px')) {
      return slotHeight;
    }

    if (slotHeight.endsWith('rem')) {
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return `${parseFloat(slotHeight) * rootFontSize}px`;
    }

    if (slotHeight.endsWith('em')) {
      const contextElement = this.calendar?.rootElement || document.body;
      const contextFontSize = parseFloat(getComputedStyle(contextElement).fontSize) || 16;
      return `${parseFloat(slotHeight) * contextFontSize}px`;
    }

    return slotHeight;
  }

  /**
   * Return the minimum resource column width.
   *
   * Resource columns stretch to fill the available viewport and shrink until
   * this value. After that, the shared scroll container handles horizontal scroll.
   *
   * @returns {string}
   */
  getResourceMinWidth() {
    const minWidth = this.isWeekRange()
        ? this.options.resourceTimeGridWeekColumnMinWidth || '136px'
        : this.options.resourceTimeGridResourceMinWidth || '180px';

    return typeof minWidth === 'number'
        ? `${minWidth}px`
        : String(minWidth);
  }

  /**
   * Return the header height used by the current layout.
   *
   * @returns {string}
   */
  getHeaderHeight() {
    return this.isWeekRange() ? '62px' : '32px';
  }

  /**
   * Render the complete resource time-grid.
   *
   * @returns {HTMLElement}
   */
  render() {
    const range = this.getVisibleRange();
    const days = this.getDays();
    const resources = this.getVisibleResources();
    const columns = this.getColumns(days, resources);
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getSlotDuration();
    const slotHeight = this.getSlotHeight();
    const slotCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));

    this.state.visibleRange = range;

    const rootElement = this.createElement(
        'div',
        classNames(
            CLASS_NAMES.calendar.view,
            CLASS_NAMES.calendar.resourceTimeGrid,
            this.isWeekRange() && 'tsh-resource-time-grid--week'
        ),
        '',
        {
          style: {
            '--tsh-rtg-slot-count': slotCount,
            '--tsh-rtg-slot-height': slotHeight,
            '--tsh-rtg-header-height': this.getHeaderHeight(),
            '--tsh-rtg-resource-count': this.getLayoutColumnCount(columns.length),
            '--tsh-rtg-resource-min-width': this.getResourceMinWidth(),
            '--tsh-rtg-grid-columns': this.getResourceGridTemplateColumns(columns.length)
          }
        }
    );

    // Keep a reference to this view root so the current-time indicator can be
    // refreshed after mount without scanning unrelated scheduler instances.
    this.rootElement = rootElement;

    rootElement.append(
        this.createScrollBody({
          range,
          days,
          resources,
          columns,
          visibleEvents,
          minMinutes,
          maxMinutes,
          slotDuration,
          slotCount
        })
    );

    return rootElement;
  }

  /**
   * Create the shared scroll container.
   *
   * Header, all-day row and timed body live inside this same container.
   * This keeps horizontal scrolling synchronized across the whole view.
   *
   * @param {Object} config - Body configuration.
   * @param {{start: Date, end: Date}} config.range - Visible date range.
   * @param {Date[]} config.days - Visible days.
   * @param {Array<Object>} config.resources - Visible resources.
   * @param {Array<Object>} config.columns - Visible day/resource columns.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createScrollBody({
                     range,
                     days,
                     resources,
                     columns,
                     visibleEvents,
                     minMinutes,
                     maxMinutes,
                     slotDuration,
                     slotCount
                   }) {
    const scrollElement = this.createElement(
        'div',
        classNames('tsh-rtg-scroll', CLASS_NAMES.calendar.scrollContainer)
    );

    const gridElement = this.createElement('div', 'tsh-rtg-grid');

    gridElement.append(
        this.createHeader({ days, resources, columns }),
        this.createAllDayRow({ columns, visibleEvents }),
        this.createTimedBody({
          range,
          columns,
          visibleEvents,
          minMinutes,
          maxMinutes,
          slotDuration,
          slotCount
        })
    );

    scrollElement.append(gridElement);

    return scrollElement;
  }

  /**
   * Create the sticky resource header.
   *
   * @param {Object} config - Header configuration.
   * @param {Date[]} config.days - Visible days.
   * @param {Array<Object>} config.resources - Visible resources.
   * @param {Array<Object>} config.columns - Visible day/resource columns.
   * @returns {HTMLElement}
   */
  createHeader({ days, resources, columns }) {
    const headerElement = this.createElement(
        'div',
        classNames('tsh-rtg-header', this.isWeekRange() && 'tsh-rtg-header--week')
    );

    headerElement.append(this.createElement('div', 'tsh-rtg-corner'));

    if (!resources.length) {
      headerElement.append(
          this.createElement(
              'div',
              'tsh-rtg-resource-title tsh-rtg-resource-title--empty',
              this.calendar._getLabel('noResources', 'No resources')
          )
      );

      return headerElement;
    }

    if (!this.isWeekRange()) {
      resources.forEach(resource => {
        headerElement.append(this.createResourceHeader(resource));
      });

      return headerElement;
    }

    days.forEach(day => {
      headerElement.append(this.createDayHeader(day, resources.length));
    });

    columns.forEach(column => {
      headerElement.append(this.createResourceHeader(column.resource, column.day));
    });

    return headerElement;
  }

  /**
   * Create one week day group header.
   *
   * @param {Date} day - Day represented by the header.
   * @param {number} resourceCount - Number of resource columns inside the day.
   * @returns {HTMLElement}
   */
  createDayHeader(day, resourceCount) {
    const locale = this.options.locale || GLOBAL_CONFIG.locale || 'en';
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(day);
    const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(day);

    return this.createElement(
        'div',
        classNames(
            'tsh-rtg-day-title',
            this.isWeekendDate(day) && 'tsh-rtg-day-title--weekend',
            this.isPastDate(day) && 'tsh-rtg-day-title--past',
            isSameDay(day, new Date()) && 'tsh-rtg-day-title--today'
        ),
        [
          this.createElement('strong', '', weekday),
          this.createDateLabel(date, day, 'tsh-rtg-day-date')
        ],
        {
          style: {
            gridColumn: `span ${resourceCount}`
          },
          dataset: {
            date: formatDateKey(day)
          }
        }
    );
  }

  /**
   * Create one resource title cell.
   *
   * @param {Object} resource - Resource represented by the title.
   * @param {Date|null} day - Optional day represented by the title in week mode.
   * @returns {HTMLElement}
   */
  createResourceHeader(resource, day = null) {
    return this.createElement(
        'div',
        classNames(
            'tsh-rtg-resource-title',
            day && 'tsh-rtg-resource-title--compact',
            day && isSameDay(day, new Date()) && 'tsh-rtg-resource-title--today'
        ),
        resource.title,
        {
          dataset: {
            resourceId: resource.id,
            date: day ? formatDateKey(day) : null
          }
        }
    );
  }

  /**
   * Create the all-day row.
   *
   * @param {Object} config - All-day row configuration.
   * @param {Array<Object>} config.columns - Visible day/resource columns.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @returns {HTMLElement}
   */
  createAllDayRow({ columns, visibleEvents }) {
    const allDayElement = this.createElement(
        'div',
        classNames(
            'tsh-rtg-all-day',
            this.isWeekRange() && 'tsh-rtg-all-day--week',
            CLASS_NAMES.calendar.slotGroup
        ),
        '',
        {
          dataset: {
            slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
          }
        }
    );

    allDayElement.append(
        this.createElement(
            'div',
            'tsh-rtg-all-day-label',
            this.calendar._getLabel('allDay', 'all-day')
        )
    );

    if (!columns.length) {
      allDayElement.append(
          this.createElement('div', 'tsh-rtg-all-day-cell tsh-rtg-all-day-cell--empty')
      );

      return allDayElement;
    }

    columns.forEach(column => {
      allDayElement.append(this.createAllDayCell(column, visibleEvents));
    });

    return allDayElement;
  }

  /**
   * Create one all-day cell for a day/resource column.
   *
   * @param {Object} column - Render column.
   * @param {Array<Object>} visibleEvents - Events already loaded for the range.
   * @returns {HTMLElement}
   */
  createAllDayCell(column, visibleEvents) {
    const dayStart = startOfDay(column.day);
    const dayEnd = addDays(dayStart, 1);
    const cellElement = this.createElement(
        'div',
        classNames(
            'tsh-rtg-all-day-cell',
            CLASS_NAMES.calendar.slot,
            ...this.getDateSlotStateClasses(column.day),
            isSameDay(column.day, new Date()) && 'tsh-rtg-all-day-cell--today'
        ),
        '',
        {
          dataset: {
            slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIME_GRID,
            slotStart: formatIsoLocal(dayStart),
            slotEnd: formatIsoLocal(dayEnd),
            slotAllDay: 'true',
            resourceId: column.resource.id
          }
        }
    );

    visibleEvents
        .filter(event => {
          return isAllDayEvent(event)
              && isEventOnDate(event, column.day)
              && this.eventBelongsToResource(event, column.resource);
        })
        .forEach(event => {
          cellElement.append(this.createEventElement(event, 'all-day', column.resource));
        });

    return cellElement;
  }

  /**
   * Create the timed body row.
   *
   * @param {Object} config - Body configuration.
   * @param {{start: Date, end: Date}} config.range - Visible date range.
   * @param {Array<Object>} config.columns - Visible day/resource columns.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createTimedBody({
                    range,
                    columns,
                    visibleEvents,
                    minMinutes,
                    maxMinutes,
                    slotDuration,
                    slotCount
                  }) {
    const bodyElement = this.createElement(
        'div',
        classNames('tsh-rtg-body', this.isWeekRange() && 'tsh-rtg-body--week')
    );

    bodyElement.append(
        this.createTimeColumn({
          minMinutes,
          slotDuration,
          slotCount
        })
    );

    if (!columns.length) {
      bodyElement.append(
          this.createEmptyResourceColumn({
            minMinutes,
            slotDuration,
            slotCount
          })
      );

      this.scheduleNowIndicatorRefresh();

      return bodyElement;
    }

    columns.forEach(column => {
      bodyElement.append(
          this.createResourceColumn({
            column,
            visibleEvents,
            minMinutes,
            maxMinutes,
            slotDuration,
            slotCount
          })
      );
    });

    this.scheduleNowIndicatorRefresh();

    return bodyElement;
  }

  /**
   * Schedule a current-time indicator refresh after the view has been mounted.
   * The resource grid indicator uses real DOM measurements, so it cannot be
   * positioned correctly while render() still builds a detached tree.
   *
   * @returns {ResourceTimeGridView}
   */
  scheduleNowIndicatorRefresh() {
    if (!this.isNowIndicatorEnabled()) return this;

    requestAnimationFrame(() => {
      this.refreshNowIndicator();
    });

    return this;
  }

  /**
   * Refresh only all-day and timed event layers.
   * The shared scroll container and grid skeleton stay mounted.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const range = this.getVisibleRange();
    const days = this.getDays();
    const resources = this.getVisibleResources();
    const columns = this.getColumns(days, resources);
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getSlotDuration();

    this.refreshAllDayEvents(columns, visibleEvents);
    this.refreshTimedEventLayers({
      columns,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    return true;
  }

  /**
   * Refresh all resource all-day cells without rebuilding the row.
   *
   * @param {Array<Object>} columns - Render columns.
   * @param {Array<Object>} visibleEvents - Visible events.
   * @returns {ResourceTimeGridView}
   */
  refreshAllDayEvents(columns, visibleEvents) {
    columns.forEach(column => {
      const cellElement = this.getAllDayCellElement(column);

      this.refreshEventContainer(cellElement, container => {
        visibleEvents
            .filter(event => {
              return isAllDayEvent(event)
                  && isEventOnDate(event, column.day)
                  && this.eventBelongsToResource(event, column.resource);
            })
            .forEach(event => container.append(this.createEventElement(event, 'all-day', column.resource)));
      });
    });

    return this;
  }

  /**
   * Refresh all timed resource columns and recalculate overlap layout.
   *
   * @param {Object} config - Timed refresh config.
   * @returns {ResourceTimeGridView}
   */
  refreshTimedEventLayers({ columns, visibleEvents, minMinutes, maxMinutes, slotDuration }) {
    columns.forEach(column => {
      const columnElement = this.getResourceColumnElement(column);
      const eventsLayerElement = columnElement?.querySelector('.tsh-rtg-events');

      this.refreshEventContainer(eventsLayerElement, container => {
        this.renderTimedEvents({
          eventsLayerElement: container,
          column,
          visibleEvents,
          minMinutes,
          maxMinutes,
          slotDuration
        });
      });
    });

    return this;
  }

  /**
   * Return the mounted all-day cell for a day/resource column.
   *
   * @param {Object} column - Render column.
   * @returns {HTMLElement|null}
   */
  getAllDayCellElement(column) {
    const slotStart = formatIsoLocal(startOfDay(column.day));
    const resourceId = String(column.resource.id);
    const rootElement = this.rootElement || this.calendar.rootElement;

    return Array.from(rootElement.querySelectorAll('.tsh-rtg-all-day-cell'))
        .find(element => (
          element.dataset.slotStart === slotStart
          && String(element.dataset.resourceId) === resourceId
        )) || null;
  }

  /**
   * Return the mounted timed column for a day/resource column.
   *
   * @param {Object} column - Render column.
   * @returns {HTMLElement|null}
   */
  getResourceColumnElement(column) {
    const resourceId = String(column.resource.id);
    const rootElement = this.rootElement || this.calendar.rootElement;

    return Array.from(rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.resourceTimeGridColumn}`))
        .find(element => (
          element.dataset.dropDate === column.dateKey
          && String(element.dataset.resourceId) === resourceId
        )) || null;
  }

  /**
   * Refresh the current-time indicator in-place without redrawing events.
   * This is used both after mount and by TinyScheduler's minute clock.
   *
   * @returns {ResourceTimeGridView}
   */
  refreshNowIndicator() {
    const bodyElement = this.getResourceTimeGridBodyElement();

    if (!bodyElement) return this;

    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getSlotDuration();
    const nowIndicator = this.createResourceTimeGridNowIndicator({
      bodyElement,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    this.removeNowIndicators(bodyElement);

    if (nowIndicator) {
      bodyElement.append(nowIndicator);
    }

    return this;
  }

  /**
   * Return the mounted resource time-grid body.
   *
   * @returns {HTMLElement|null}
   */
  getResourceTimeGridBodyElement() {
    return this.rootElement?.querySelector('.tsh-rtg-body')
        || this.calendar.rootElement.querySelector('.tsh-rtg-body');
  }

  /**
   * Create the current-time indicator for resource day/week grids.
   * The dashed line spans the full resource area, while the solid segment is
   * aligned to the current day group.
   *
   * @param {Object} config - Indicator config.
   * @param {HTMLElement} config.bodyElement - Mounted timed body element.
   * @param {number} config.minMinutes - First visible minute.
   * @param {number} config.maxMinutes - Last visible minute.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @returns {HTMLElement|null}
   */
  createResourceTimeGridNowIndicator({ bodyElement, minMinutes, maxMinutes, slotDuration }) {
    const now = this.getNowIndicatorDate();
    const days = this.getDays();
    const todayKey = formatDateKey(now);

    if (!days.some(day => isSameDay(day, now))) return null;

    const info = this.getVerticalNowIndicatorInfo({
      range: this.getVisibleRange(),
      minMinutes,
      maxMinutes,
      slotDuration
    });

    if (!info) return null;

    const columnElements = Array.from(bodyElement.querySelectorAll('.tsh-rtg-column, .tsh-rtg-empty-column'));

    if (!columnElements.length) return null;

    let todayColumnElements = columnElements.filter(columnElement => columnElement.dataset.dropDate === todayKey);

    if (!todayColumnElements.length && !this.isWeekRange()) {
      todayColumnElements = columnElements;
    }

    if (!todayColumnElements.length) return null;

    const firstSlotElement = todayColumnElements[0].querySelector(`.${CLASS_NAMES.calendar.resourceTimeGridSlot}`);
    const slotHeight = firstSlotElement?.getBoundingClientRect().height
        || bodyElement.scrollHeight / Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));

    if (!slotHeight) return null;

    const bodyRect = bodyElement.getBoundingClientRect();
    const firstColumnRect = columnElements[0].getBoundingClientRect();
    const lastColumnRect = columnElements[columnElements.length - 1].getBoundingClientRect();
    const firstTodayRect = todayColumnElements[0].getBoundingClientRect();
    const lastTodayRect = todayColumnElements[todayColumnElements.length - 1].getBoundingClientRect();
    const timeColumnElement = bodyElement.querySelector('.tsh-rtg-times');
    const timeColumnWidth = timeColumnElement?.getBoundingClientRect().width || 0;

    const columnsLeft = firstColumnRect.left - bodyRect.left;
    const columnsRight = lastColumnRect.right - bodyRect.left;
    const todayLeft = firstTodayRect.left - bodyRect.left;
    const todayRight = lastTodayRect.right - bodyRect.left;
    const top = info.slotOffset * slotHeight;

    return this.createElement(
        'div',
        classNames(CLASS_NAMES.calendar.nowIndicator, 'tsh-now-indicator--resource-time-grid'),
        [
          this.createElement('span', CLASS_NAMES.calendar.nowIndicatorLabel, info.label),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--before`),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--today`),
          this.createElement('span', `${CLASS_NAMES.calendar.nowIndicatorLine} tsh-now-indicator-line--after`),
          this.createElement('span', 'tsh-now-indicator-marker')
        ],
        {
          style: {
            '--tsh-now-top': `${top}px`,
            '--tsh-now-label-width': `${timeColumnWidth}px`,
            '--tsh-now-columns-left': `${columnsLeft}px`,
            '--tsh-now-columns-width': `${Math.max(0, columnsRight - columnsLeft)}px`,
            '--tsh-now-today-left': `${todayLeft}px`,
            '--tsh-now-today-width': `${Math.max(0, todayRight - todayLeft)}px`
          },
          attrs: {
            'aria-hidden': 'true'
          }
        }
    );
  }

  /**
   * Create the left time column.
   *
   * Time labels are rendered inside the hour slot cells.
   *
   * @param {Object} config - Time column configuration.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createTimeColumn({ minMinutes, slotDuration, slotCount }) {
    const timeColumnElement = this.createElement('div', 'tsh-rtg-times');

    timeColumnElement.append(
        this.createSlotGrid({
          className: 'tsh-rtg-slots tsh-rtg-time-slots',
          minMinutes,
          slotDuration,
          slotCount,
          showTimeLabels: true
        })
    );

    return timeColumnElement;
  }

  /**
   * Create one day/resource column.
   *
   * The visual grid is rendered as real slot elements.
   * The events are rendered inside a separate absolute overlay layer.
   *
   * @param {Object} config - Column configuration.
   * @param {Object} config.column - Day/resource render column.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createResourceColumn({
                         column,
                         visibleEvents,
                         minMinutes,
                         maxMinutes,
                         slotDuration,
                         slotCount
                       }) {
    const columnElement = this.createElement(
        'div',
        classNames(
            CLASS_NAMES.calendar.resourceTimeGridColumn,
            CLASS_NAMES.calendar.slotGroup,
            ...this.getDateSlotStateClasses(column.day),
            this.isWeekRange() && 'tsh-rtg-column--week',
            isSameDay(column.day, new Date()) && 'tsh-rtg-column--today'
        ),
        '',
        {
          dataset: {
            dropKind: 'resourceTimeGrid',
            dropDate: column.dateKey,
            resourceId: column.resource.id,
            slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.VERTICAL
          }
        }
    );

    const slotsElement = this.createSlotGrid({
      className: 'tsh-rtg-slots',
      date: column.day,
      resourceId: column.resource.id,
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIME_GRID,
      minMinutes,
      slotDuration,
      slotCount
    });

    const eventsLayerElement = this.createElement('div', 'tsh-rtg-events');

    this.renderTimedEvents({
      eventsLayerElement,
      column,
      visibleEvents,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    columnElement.append(slotsElement, eventsLayerElement);

    return columnElement;
  }

  /**
   * Create a non-selectable placeholder column when no resources are loaded.
   *
   * The time column remains fixed-width and the placeholder column fills the
   * remaining visible area, which avoids the hour column stretching to full width.
   *
   * @param {Object} config - Column configuration.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createEmptyResourceColumn({ minMinutes, slotDuration, slotCount }) {
    const columnElement = this.createElement('div', 'tsh-rtg-empty-column');

    columnElement.append(
        this.createSlotGrid({
          className: 'tsh-rtg-slots',
          minMinutes,
          slotDuration,
          slotCount
        }),
        this.createElement(
            'div',
            'tsh-rtg-empty-message',
            this.calendar._getLabel('noResources', 'No resources')
        )
    );

    return columnElement;
  }

  /**
   * Create real visual slots.
   *
   * Example:
   * <div class="tsh-rtg-slots">
   *   <div class="tsh-rtg-slot tsh-rtg-slot--hour">
   *     <span class="tsh-rtg-time">6h</span>
   *   </div>
   *   <div class="tsh-rtg-slot"></div>
   * </div>
   *
   * @param {Object} config - Slot grid configuration.
   * @param {string} config.className - Slot grid class string.
   * @param {Date|null} config.date - Day represented by the slots.
   * @param {string|null} config.resourceId - Resource represented by the slots.
   * @param {string|null} config.slotKind - Scheduler slot kind.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of slots to render.
   * @param {boolean} config.showTimeLabels - Whether hour labels should be rendered.
   * @returns {HTMLElement}
   */
  createSlotGrid({
                   className,
                   date = null,
                   resourceId = null,
                   slotKind = null,
                   minMinutes,
                   slotDuration,
                   slotCount,
                   showTimeLabels = false
                 }) {
    const slotsElement = this.createElement('div', className, '', {
      style: {
        '--tsh-rtg-slot-count': slotCount
      }
    });

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const minute = minMinutes + slotIndex * slotDuration;
      const isHourSlot = minute % 60 === 0;
      const slotStart = date ? addMinutes(startOfDay(date), minute) : null;
      const slotEnd = slotStart ? addMinutes(slotStart, slotDuration) : null;
      const slotElement = this.createElement(
          'div',
          classNames(
              CLASS_NAMES.calendar.resourceTimeGridSlot,
              slotKind && CLASS_NAMES.calendar.slot,
              ...(date ? this.getDateSlotStateClasses(date) : []),
              isHourSlot && 'tsh-rtg-slot--hour'
          ),
          '',
          {
            dataset: {
              minute,
              slotKind,
              slotStart: slotStart ? formatIsoLocal(slotStart) : null,
              slotEnd: slotEnd ? formatIsoLocal(slotEnd) : null,
              slotAllDay: slotKind ? 'false' : null,
              resourceId
            }
          }
      );

      // Labels belong to the hour slot itself, not to an absolute overlay.
      if (showTimeLabels && isHourSlot) {
        slotElement.append(
            this.createElement(
                'span',
                'tsh-rtg-time',
                formatSlotLabel(minute, this.options)
            )
        );
      }

      slotsElement.append(slotElement);
    }

    return slotsElement;
  }

  /**
   * Render timed events into the absolute overlay layer.
   *
   * Events remain absolute-positioned because they can start/end between slots.
   *
   * @param {Object} config - Timed event rendering configuration.
   * @param {HTMLElement} config.eventsLayerElement - Event overlay layer.
   * @param {Object} config.column - Day/resource render column.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   */
  renderTimedEvents({
                      eventsLayerElement,
                      column,
                      visibleEvents,
                      minMinutes,
                      maxMinutes,
                      slotDuration
                    }) {
    const columnEvents = visibleEvents.filter(event => {
      return !isAllDayEvent(event)
          && isEventOnDate(event, column.day)
          && this.eventBelongsToResource(event, column.resource);
    });

    const layoutMap = buildTimedEventLayout(columnEvents, {
      minMinutes,
      maxMinutes,
      slotEventOverlap: this.options.slotEventOverlap !== false,
      eventMaxStack: this.options.eventMaxStack || null
    });

    columnEvents.forEach(event => {
      const position = this.getTimedEventPosition({
        event,
        day: column.day,
        minMinutes,
        maxMinutes,
        slotDuration
      });

      if (!position) return;

      const layout = layoutMap.get(String(event.id)) || getDefaultTimedEventLayout();
      const eventElement = this.createEventElement(event, 'block', column.resource);
      const timeElement = this.createElement(
          'span',
          CLASS_NAMES.calendar.eventTime || 'tsh-event-time',
          formatTimeRange(event.start, event.end, this.options)
      );

      Object.assign(eventElement.dataset, {
        resizeKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIME_GRID,
        resizeDate: formatDateKey(column.day),
        resizeResourceId: column.resource.id,
        resizeMinMinutes: String(minMinutes),
        resizeMaxMinutes: String(maxMinutes),
        resizeSlotDuration: String(slotDuration)
      });

      this.appendEventResizeHandle(eventElement, event, 'block');

      /*
        Keep event placement in the exact same unit as the visual slots.
        --tsh-rtg-slot-height is normalized to px by getSlotHeight(), so this
        remains correct even if event content uses a smaller font-size.
      */
      eventElement.style.top = `calc(${position.startOffset} * var(--tsh-rtg-slot-height))`;
      eventElement.style.height = `max(22px, calc(${position.slotSpan} * var(--tsh-rtg-slot-height)))`;

      // Timed-event overlap layout belongs to the view, not to InteractionManager.
      // InteractionManager only handles pointer hit detection and final drop data.
      eventElement.style.left = `calc(${layout.leftPercent}% + 3px)`;
      eventElement.style.right = `calc(${layout.rightPercent}% + 3px)`;
      eventElement.style.width = 'auto';
      eventElement.style.zIndex = layout.zIndex;

      eventElement.prepend(timeElement);
      eventsLayerElement.append(eventElement);
      this.scheduleEventDensityUpdate(eventElement);
    });
  }

  /**
   * Apply compact display classes after the browser has calculated event size.
   *
   * @param {HTMLElement} eventElement - Rendered event element.
   * @returns {AbstractView}
   */
  scheduleEventDensityUpdate(eventElement) {
    return super.scheduleEventDensityUpdate(eventElement);
  }

  /**
   * Calculate the vertical position and height for one event.
   *
   * Events are clamped to the rendered day. This is important in week mode,
   * because each event can only be positioned inside its own day/resource column.
   *
   * @param {Object} config - Position configuration.
   * @param {Object} config.event - Normalized calendar event.
   * @param {Date} config.day - Rendered day.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @returns {{startOffset: number, slotSpan: number}|null}
   */
  getTimedEventPosition({ event, day, minMinutes, maxMinutes, slotDuration }) {
    const dayStart = startOfDay(day);
    const eventStart = parseDateInput(event.start);
    const eventEnd = event.end
        ? parseDateInput(event.end)
        : addMinutes(eventStart, 60);

    const visibleStart = addMinutes(dayStart, minMinutes);
    const visibleEnd = addMinutes(dayStart, maxMinutes);
    const clampedStart = new Date(Math.max(eventStart.getTime(), visibleStart.getTime()));
    const clampedEnd = new Date(Math.min(eventEnd.getTime(), visibleEnd.getTime()));

    if (clampedEnd <= clampedStart) {
      return null;
    }

    const startMinute = Math.round((clampedStart - dayStart) / 60000);
    const endMinute = Math.round((clampedEnd - dayStart) / 60000);

    const durationMinutes = endMinute - startMinute;

    return {
      startOffset: (startMinute - minMinutes) / slotDuration,
      slotSpan: Math.max(0.5, durationMinutes / slotDuration)
    };
  }

  /**
   * Return the minimum number of content columns used by the layout.
   *
   * When there are no resources, one placeholder column is still rendered so
   * the fixed time column never expands across the whole view.
   *
   * @param {number} columnCount - Number of visible content columns.
   * @returns {number}
   */
  getLayoutColumnCount(columnCount) {
    return Math.max(1, columnCount);
  }

  /**
   * Backward-compatible alias for older internal calls.
   *
   * @param {number} resourceCount - Number of visible content columns.
   * @returns {number}
   */
  getLayoutResourceCount(resourceCount) {
    return this.getLayoutColumnCount(resourceCount);
  }

  /**
   * Return the shared grid-template-columns value.
   *
   * @param {number} columnCount - Number of visible content columns.
   * @returns {string}
   */
  getResourceGridTemplateColumns(columnCount) {
    const layoutColumnCount = this.getLayoutColumnCount(columnCount);

    return `var(--tsh-time-column-width) repeat(${layoutColumnCount}, minmax(var(--tsh-rtg-resource-min-width), 1fr))`;
  }
}

/**
 * ResourceTimelineView
 * --------------------
 * Renders the resource timeline planning view.
 *
 * Layout model:
 * - Resources are displayed vertically as rows.
 * - Time is displayed horizontally as real slot cells.
 * - The whole view uses one scroll container so header, resource rows and time
 *   rows stay visually synchronized.
 * - In day view, body rows use detailed time slots while the header uses one
 *   full-hour cell with the hour label centered.
 * - Events remain absolutely positioned in a row overlay because their
 *   start/end can be fractional and can overlap slot boundaries.
 */
class ResourceTimelineView extends AbstractView {
  /**
   * Timeline views have a horizontal time axis, so they can display a vertical
   * current-time marker when today/current time is inside the visible range.
   *
   * @returns {boolean}
   */
  supportsNowIndicator() {
    return true;
  }

  /**
   * Return the visible range for the current timeline sub-view.
   *
   * @returns {{start: Date, end: Date}}
   */
  getVisibleRange() {
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'week') {
      const start = startOfWeek(this.state.currentDate, this.options.firstDay);

      return {
        start,
        end: addDays(start, 7)
      };
    }

    if (timelineRange === 'month') {
      return {
        start: startOfMonth(this.state.currentDate),
        end: addDays(endOfMonth(this.state.currentDate), 1)
      };
    }

    const dayStart = startOfDay(this.state.currentDate);

    return {
      start: dayStart,
      end: addDays(dayStart, 1)
    };
  }

  /**
   * Return the title displayed in the main toolbar.
   *
   * @returns {string}
   */
  getTitle() {
    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'week') {
      return formatRangeTitle(range.start, range.end, this.options.locale);
    }

    if (timelineRange === 'month') {
      return formatMonthTitle(this.state.currentDate, this.options.locale);
    }

    return formatDayTitle(this.state.currentDate, this.options.locale);
  }

  /**
   * Return the active timeline range.
   *
   * @returns {'day'|'week'|'month'}
   */
  getTimelineRange() {
    return this.state.planningRange || 'day';
  }

  /**
   * Return the duration of one body slot in minutes.
   *
   * @returns {number}
   */
  getDaySlotDuration() {
    return this.options.timelineSlotDuration || this.options.slotDuration || 30;
  }

  /**
   * Return how many body slots compose one hour.
   *
   * @returns {number}
   */
  getTimelineSlotsPerHour() {
    const slotDuration = this.getDaySlotDuration();

    return Math.max(1, Math.round(60 / slotDuration));
  }

  /**
   * Return the resources visible in the timeline left column.
   *
   * This method is intentionally generic. It must not filter demo-only ids such
   * as `auditorium-*`, because real integrations can use numeric ids, boat ids,
   * staff ids, room ids, etc.
   *
   * @returns {Array<{resource: Object, depth: number, hasChildren: boolean}>}
   */
  getVisibleResources() {
    const resources = this.calendar.resourceStore.getResources();
    const childrenByParentId = new Map();
    const topLevelResources = [];

    resources.forEach(resource => {
      const parentId = this.getResourceParentId(resource);

      if (!parentId) {
        topLevelResources.push(resource);
        return;
      }

      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }

      childrenByParentId.get(parentId).push(resource);
    });

    const visibleRows = [];

    topLevelResources.forEach(resource => {
      const resourceId = this.getResourceId(resource);
      const children = childrenByParentId.get(resourceId) || [];

      visibleRows.push({
        resource,
        depth: 0,
        hasChildren: children.length > 0
      });

      if (this.state.collapsedResources.has(resourceId)) return;

      children.forEach(childResource => {
        visibleRows.push({
          resource: childResource,
          depth: 1,
          hasChildren: false
        });
      });
    });

    return visibleRows;
  }

  /**
   * Return a stable string id for a resource.
   *
   * @param {Object} resource - Resource object.
   * @returns {string}
   */
  getResourceId(resource) {
    return String(resource?.id ?? '');
  }

  /**
   * Return the normalized parent resource id.
   *
   * @param {Object} resource - Resource object.
   * @returns {string|null}
   */
  getResourceParentId(resource) {
    return resource?.parentId === null || resource?.parentId === undefined || resource?.parentId === ''
        ? null
        : String(resource.parentId);
  }

  /**
   * Return the visible resource title.
   *
   * @param {Object} resource - Resource object.
   * @returns {string}
   */
  getResourceTitle(resource) {
    return resource?.title || resource?.name || this.getResourceId(resource);
  }

  /**
   * Return the left column header label.
   *
   * @returns {string}
   */
  getResourceAreaTitle() {
    return this.options.resourceAreaTitle || this.calendar._getLabel('resources', 'Resources');
  }

  /**
   * Build visual slots for the timeline axis.
   *
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {Array<Object>}
   */
  buildSlots(range) {
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'day') {
      return this.buildDayTimeSlots(range);
    }

    return this.buildDateSlots(range, timelineRange);
  }

  /**
   * Build day timeline slots.
   *
   * @param {{start: Date}} range - Visible date range.
   * @returns {Array<Object>}
   */
  buildDayTimeSlots(range) {
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getDaySlotDuration();
    const slotCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));
    const dayStart = startOfDay(range.start);

    return Array.from({ length: slotCount }, (_, slotIndex) => {
      const minute = minMinutes + slotIndex * slotDuration;
      const slotStart = addMinutes(dayStart, minute);
      const slotEnd = addMinutes(slotStart, slotDuration);
      const isHourSlot = minute % 60 === 0;

      return {
        index: slotIndex,
        minute,
        start: slotStart,
        end: slotEnd,
        label: isHourSlot ? formatSlotLabel(minute, this.options) : '',
        isHourSlot,
        isDaySlot: false,
        unit: 'minute',
        unitSize: slotDuration
      };
    });
  }

  /**
   * Build week/month timeline slots.
   *
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @param {'week'|'month'} timelineRange - Timeline sub-view.
   * @returns {Array<Object>}
   */
  buildDateSlots(range, timelineRange) {
    const slots = [];

    for (
        let cursor = startOfDay(range.start), index = 0;
        cursor < range.end;
        cursor = addDays(cursor, 1), index += 1
    ) {
      const slotEnd = addDays(cursor, 1);

      slots.push({
        index,
        start: new Date(cursor),
        end: slotEnd,
        label: formatTimelineSlotLabel(cursor, timelineRange, this.options),
        isHourSlot: false,
        isDaySlot: true,
        unit: 'day',
        unitSize: 1
      });
    }

    return slots;
  }

  /**
   * Calculate the event position in slot units.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getEventPosition(event, range) {
    return this.getTimelineRange() === 'day'
        ? this.getDayEventPosition(event, range)
        : this.getDateEventPosition(event, range);
  }

  /**
   * Calculate event position for day timeline.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getDayEventPosition(event, range) {
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getDaySlotDuration();
    const dayStart = startOfDay(range.start);
    const visibleStart = addMinutes(dayStart, minMinutes);
    const visibleEnd = addMinutes(dayStart, maxMinutes);
    const eventStart = isAllDayEvent(event) ? visibleStart : parseDateInput(event.start);
    const eventEnd = isAllDayEvent(event) ? visibleEnd : parseDateInput(event.end || addMinutes(eventStart, 60));
    const clampedStart = new Date(Math.max(eventStart.getTime(), visibleStart.getTime()));
    const clampedEnd = new Date(Math.min(eventEnd.getTime(), visibleEnd.getTime()));

    if (clampedEnd <= clampedStart) return null;

    const startMinute = Math.round((clampedStart - dayStart) / 60000);
    const endMinute = Math.round((clampedEnd - dayStart) / 60000);

    return {
      leftUnits: (startMinute - minMinutes) / slotDuration,
      widthUnits: Math.max(0.5, (endMinute - startMinute) / slotDuration)
    };
  }

  /**
   * Calculate event position for week/month timeline.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getDateEventPosition(event, range) {
    const eventStartDate = parseDateInput(event.start);
    const eventEndDate = event.end
        ? parseDateInput(event.end)
        : addDays(eventStartDate, 1);

    const eventStartDay = startOfDay(eventStartDate);
    let eventEndDay = startOfDay(eventEndDate);

    /*
      Week/month timeline slots are date cells, not minute cells.
      A timed event inside one day should therefore fill that day cell instead
      of using its small clock-duration fraction as width.
    */
    if (eventEndDate.getTime() > eventEndDay.getTime()) {
      eventEndDay = addDays(eventEndDay, 1);
    }

    if (eventEndDay <= eventStartDay) {
      eventEndDay = addDays(eventStartDay, 1);
    }

    const eventStart = Math.max(eventStartDay.getTime(), range.start.getTime());
    const eventEnd = Math.min(eventEndDay.getTime(), range.end.getTime());

    if (eventEnd <= eventStart) return null;

    const dayMs = 86400000;

    return {
      leftUnits: (eventStart - range.start.getTime()) / dayMs,
      widthUnits: Math.max(1, (eventEnd - eventStart) / dayMs)
    };
  }

  /**
   * Render the complete resource timeline view.
   *
   * @returns {HTMLElement}
   */
  render() {
    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();
    const rows = this.getVisibleResources();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const slots = this.buildSlots(range);
    const rootElement = this.createRootElement(timelineRange, slots);

    this.rootElement = rootElement;

    const scroller = this.createElement('div', classNames('tsh-rtl-scroller', CLASS_NAMES.calendar.scrollContainer));
    const grid = this.createElement('div', 'tsh-rtl-grid');
    const resourceHeader = this.createElement('div', 'tsh-rtl-resource-header', this.getResourceAreaTitle());
    const timeHeader = this.createTimeHeader(slots);
    const resourceRows = this.createElement('div', 'tsh-rtl-resource-rows');
    const timeRows = this.createElement('div', 'tsh-rtl-time-rows');

    this.state.visibleRange = range;

    if (rows.length) {
      rows.forEach(row => {
        resourceRows.append(this.createResourceRow(row));
        timeRows.append(this.createTimeRow(row.resource, slots, visibleEvents, range));
      });
    } else {
      resourceRows.append(this.createEmptyResourceRow());
      timeRows.append(this.createEmptyTimeRow(slots));
    }

    this.appendTimelineNowIndicator(timeRows, {
      range,
      slots,
      timelineRange
    });

    grid.append(resourceHeader, timeHeader, resourceRows, timeRows);
    scroller.append(grid);
    rootElement.append(scroller);

    return rootElement;
  }

  /**
   * Refresh only timeline event layers while keeping rows, headers and scroll.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const range = this.getVisibleRange();
    const slots = this.buildSlots(range);
    const rows = this.getVisibleResources();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);

    rows.forEach(row => {
      const resource = row.resource;
      const resourceId = this.getResourceId(resource);
      const timeRowElement = this.getTimeRowElement(resourceId);
      const eventsLayer = timeRowElement?.querySelector('.tsh-rtl-events-layer');

      this.refreshEventContainer(eventsLayer, container => {
        visibleEvents
            .filter(event => this.isEventAssignedToResource(event, resourceId) && this.isEventInRange(event, range))
            .forEach(event => {
              const eventElement = this.createTimelineEventElement(event, resource, range, slots);

              if (eventElement) {
                container.append(eventElement);
              }
            });
      });
    });

    return true;
  }

  /**
   * Return the mounted time row for one resource.
   *
   * @param {string} resourceId - Resource id.
   * @returns {HTMLElement|null}
   */
  getTimeRowElement(resourceId) {
    const rootElement = this.rootElement || this.calendar.rootElement;

    return Array.from(rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.resourceTimelineTimeRow}`))
        .find(element => String(element.dataset.resourceId) === String(resourceId)) || null;
  }

  /**
   * Refresh the current-time marker in-place without redrawing rows/events.
   *
   * @returns {ResourceTimelineView}
   */
  refreshNowIndicator() {
    const timeRows = this.rootElement?.querySelector('.tsh-rtl-time-rows')
        || this.calendar.rootElement.querySelector('.tsh-rtl-time-rows');

    if (!timeRows) return this;

    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();
    const slots = this.buildSlots(range);

    this.removeNowIndicators(timeRows);
    this.appendTimelineNowIndicator(timeRows, {
      range,
      slots,
      timelineRange
    });

    return this;
  }

  /**
   * Append the current-time marker to the timeline rows area.
   * Day timelines use minute precision. Week/month timelines use the current
   * date/time as a fractional position inside the visible day slots.
   *
   * @param {HTMLElement} timeRows - Timeline rows container.
   * @param {Object} config - Indicator config.
   * @param {{start: Date, end: Date}} config.range - Visible range.
   * @param {Array<Object>} config.slots - Timeline slots.
   * @param {'day'|'week'|'month'} config.timelineRange - Active timeline range.
   * @returns {ResourceTimelineView}
   */
  appendTimelineNowIndicator(timeRows, { range, slots, timelineRange }) {
    const nowIndicator = this.createTimelineNowIndicator({
      range,
      slots,
      timelineRange,
      minMinutes: parseTimeToMinutes(this.options.minTime),
      maxMinutes: parseTimeToMinutes(this.options.maxTime),
      slotDuration: this.getDaySlotDuration()
    });

    if (nowIndicator) {
      timeRows.append(nowIndicator);
    }

    return this;
  }

  /**
   * Create the root view element and expose sizing settings to CSS.
   *
   * @param {'day'|'week'|'month'} timelineRange - Timeline sub-view.
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createRootElement(timelineRange, slots) {
    return this.createElement(
        'div',
        `${CLASS_NAMES.calendar.view} ${CLASS_NAMES.calendar.resourceTimeline}`,
        '',
        {
          dataset: {
            timelineRange
          },
          style: {
            '--tsh-rtl-row-height': this.getRowHeight(),
            '--tsh-rtl-slot-count': slots.length,
            '--tsh-rtl-slot-width': this.getTimelineSlotWidth(timelineRange),
            '--tsh-rtl-slots-per-hour': this.getTimelineSlotsPerHour(),
            '--tsh-rtl-resource-column-width': this.getResourceColumnWidth()
          }
        }
    );
  }

  /**
   * Return the CSS width used by each timeline slot.
   *
   * @param {'day'|'week'|'month'} timelineRange - Timeline sub-view.
   * @returns {string}
   */
  getTimelineSlotWidth(timelineRange) {
    if (timelineRange === 'day') {
      return this.options.resourceTimelineHalfHourWidth || 'var(--tsh-rtl-half-hour-width, 1.5em)';
    }

    return this.options.resourceTimelineDayWidth || 'var(--tsh-rtl-day-width, 96px)';
  }

  /**
   * Return the fixed width of the left resource column.
   *
   * @returns {string}
   */
  getResourceColumnWidth() {
    const width = this.options.resourceTimelineResourceColumnWidth || this.options.resourceColumnWidth || '220px';

    return typeof width === 'number' ? `${width}px` : width;
  }

  /**
   * Return the row height exposed to CSS.
   *
   * @returns {string}
   */
  getRowHeight() {
    const rowHeight = this.options.rowHeight || 46;

    return typeof rowHeight === 'number' ? `${rowHeight}px` : rowHeight;
  }

  /**
   * Create the sticky time header.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createTimeHeader(slots) {
    const timeHeader = this.createElement('div', 'tsh-rtl-time-header');
    const headerSlots = this.getTimelineHeaderSlots(slots);
    const slotGrid = this.createSlotGrid(headerSlots, {
      className: 'tsh-rtl-time-slots',
      showLabels: true,
      slotWidth: this.getTimelineHeaderSlotWidth()
    });

    timeHeader.append(slotGrid);

    return timeHeader;
  }

  /**
   * Return slots used by the sticky header.
   *
   * @param {Array<Object>} slots - Body timeline slots.
   * @returns {Array<Object>}
   */
  getTimelineHeaderSlots(slots) {
    if (this.getTimelineRange() !== 'day') {
      return slots;
    }

    return slots.filter(slot => slot.isHourSlot).map(slot => ({
      ...slot,
      isHeaderSlot: true
    }));
  }

  /**
   * Return the CSS width for each header slot.
   *
   * @returns {string}
   */
  getTimelineHeaderSlotWidth() {
    if (this.getTimelineRange() === 'day') {
      return `calc(var(--tsh-rtl-slot-width) * ${this.getTimelineSlotsPerHour()})`;
    }

    return 'var(--tsh-rtl-slot-width)';
  }

  /**
   * Create the resource title row.
   *
   * @param {{resource: Object, depth: number, hasChildren: boolean}} row - Resource row info.
   * @returns {HTMLElement}
   */
  createResourceRow(row) {
    const resource = row.resource;
    const resourceRow = this.createElement(
        'div',
        classNames('tsh-rtl-resource-row', row.depth && 'tsh-rtl-resource-row--child'),
        '',
        {
          style: {
            '--depth': row.depth
          }
        }
    );

    if (row.hasChildren) {
      resourceRow.append(this.createResourceToggle(this.getResourceId(resource)));
    }

    resourceRow.append(this.createElement('span', 'tsh-rtl-resource-title', this.getResourceTitle(resource)));

    return resourceRow;
  }

  /**
   * Create the empty resource row shown when no resources are available.
   *
   * @returns {HTMLElement}
   */
  createEmptyResourceRow() {
    return this.createElement(
        'div',
        'tsh-rtl-resource-row tsh-rtl-resource-row--empty',
        this.calendar._getLabel('noResources', 'No resources')
    );
  }

  /**
   * Create the matching empty time row so the grid keeps its layout.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createEmptyTimeRow(slots) {
    const timeRow = this.createElement('div', classNames(CLASS_NAMES.calendar.resourceTimelineTimeRow, CLASS_NAMES.calendar.slotGroup, 'tsh-rtl-time-row--empty'), '', {
      dataset: {
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
      }
    });

    timeRow.append(this.createSlotGrid(slots, {
      className: 'tsh-rtl-row-slots',
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIMELINE
    }));

    return timeRow;
  }

  /**
   * Create a collapse/expand button for a parent resource.
   *
   * @param {string} resourceId - Resource id.
   * @returns {HTMLButtonElement}
   */
  createResourceToggle(resourceId) {
    return this.createElement(
        'button',
        'tsh-rtl-toggle',
        this.state.collapsedResources.has(resourceId) ? '+' : '−',
        {
          props: {
            type: 'button'
          },
          dataset: {
            resourceToggle: resourceId
          },
          attrs: {
            'aria-label': this.calendar._getAria('toggleResource', 'Toggle resource')
          }
        }
    );
  }

  /**
   * Create one timeline row for a resource.
   *
   * @param {Object} resource - Resource object.
   * @param {Array<Object>} slots - Timeline slots.
   * @param {Array<Object>} visibleEvents - Events in the visible range.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {HTMLElement}
   */
  createTimeRow(resource, slots, visibleEvents, range) {
    const resourceId = this.getResourceId(resource);
    const timeRow = this.createElement('div', classNames(CLASS_NAMES.calendar.resourceTimelineTimeRow, CLASS_NAMES.calendar.slotGroup), '', {
      dataset: {
        resourceId,
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
      }
    });

    const slotGrid = this.createSlotGrid(slots, {
      className: 'tsh-rtl-row-slots',
      resourceId,
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIMELINE
    });

    const eventsLayer = this.createElement('div', 'tsh-rtl-events-layer');
    const resourceEvents = visibleEvents.filter(event => this.isEventAssignedToResource(event, resourceId) && this.isEventInRange(event, range));

    resourceEvents.forEach(event => {
      const eventElement = this.createTimelineEventElement(event, resource, range, slots);

      if (eventElement) {
        eventsLayer.append(eventElement);
      }
    });

    timeRow.append(slotGrid, eventsLayer);

    return timeRow;
  }

  /**
   * Check if an event belongs to a resource id.
   *
   * @param {Object} event - Event object.
   * @param {string} resourceId - Resource id.
   * @returns {boolean}
   */
  isEventAssignedToResource(event, resourceId) {
    return this.getEventResourceIds(event).includes(String(resourceId));
  }

  /**
   * Return normalized resource ids attached to an event.
   *
   * @param {Object} event - Event object.
   * @returns {string[]}
   */
  getEventResourceIds(event) {
    if (Array.isArray(event.resourceIds)) {
      return event.resourceIds.map(id => String(id));
    }

    if (event.resourceId !== null && event.resourceId !== undefined && event.resourceId !== '') {
      return [String(event.resourceId)];
    }

    return [];
  }

  /**
   * Check if an event intersects the visible range.
   *
   * @param {Object} event - Event object.
   * @param {{start: Date, end: Date}} range - Visible range.
   * @returns {boolean}
   */
  isEventInRange(event, range) {
    const eventStart = parseDateInput(event.start);
    const eventEnd = parseDateInput(event.end || eventStart);

    return eventStart < range.end && eventEnd >= range.start;
  }

  /**
   * Create timeline slots.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @param {Object} options - Rendering options.
   * @param {string} options.className - Slot grid class name.
   * @param {boolean} options.showLabels - Whether labels should be rendered.
   * @param {string|null} options.slotWidth - Optional local width for each slot.
   * @param {string|null} options.resourceId - Resource id for selectable slots.
   * @param {string|null} options.slotKind - Slot kind for selection/drop.
   * @returns {HTMLElement}
   */
  createSlotGrid(slots, { className, showLabels = false, slotWidth = null, resourceId = null, slotKind = null }) {
    const style = {
      '--tsh-rtl-slot-count': slots.length
    };

    if (slotWidth) {
      style['--tsh-rtl-local-slot-width'] = slotWidth;
    }

    const slotGrid = this.createElement('div', className, '', { style });

    slots.forEach(slot => {
      const slotElement = this.createElement(
          'div',
          classNames(
              CLASS_NAMES.calendar.resourceTimelineSlot,
              slotKind && CLASS_NAMES.calendar.slot,
              ...this.getDateSlotStateClasses(slot.start),
              slot.isHourSlot && 'tsh-rtl-slot--hour',
              slot.isDaySlot && 'tsh-rtl-slot--day'
          ),
          '',
          {
            dataset: {
              slotIndex: slot.index,
              slotStart: formatIsoLocal(slot.start),
              slotEnd: formatIsoLocal(slot.end),
              slotKind,
              slotAllDay: slot.isDaySlot ? 'true' : 'false',
              resourceId
            }
          }
      );

      if (showLabels && slot.label) {
        slotElement.append(
            slot.isDaySlot
                ? this.createDateLabel(slot.label, slot.start, 'tsh-rtl-time-label')
                : this.createElement('span', 'tsh-rtl-time-label', slot.label)
        );
      }

      slotGrid.append(slotElement);
    });

    return slotGrid;
  }

  /**
   * Create one positioned timeline event.
   *
   * @param {Object} event - Normalized event.
   * @param {Object} resource - Resource object.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @param {Array<Object>} slots - Timeline body slots.
   * @returns {HTMLElement|null}
   */
  createTimelineEventElement(event, resource, range, slots) {
    const position = this.getEventPosition(event, range);

    if (!position) return null;

    const eventElement = this.createEventElement(event, 'timeline', resource);

    const totalUnits = Math.max(1, slots.length);
    const leftPercent = (position.leftUnits / totalUnits) * 100;
    const widthPercent = (position.widthUnits / totalUnits) * 100;

    eventElement.style.left = `${leftPercent}%`;
    eventElement.style.width = `${widthPercent}%`;
    eventElement.style.minWidth = '26px';

    this.scheduleEventDensityUpdate(eventElement);

    return eventElement;
  }
}

/**
 * TinyScheduler
 * ----------------
 * Main calendar component.
 *
 * Responsibilities:
 * - Resolve and render the active calendar view.
 * - Load events/resources through SourceManager.
 * - Manage toolbar, planning toolbar and navigation state.
 * - Dispatch public callbacks and MicroEvent events.
 * - Delegate clicks, keyboard actions, pointer interactions and event action toolbar behavior.
 *
 * Notes:
 * - TSH_TOOLBAR_ICONS is expected to be defined in defaults.js.
 * - Events are rendered by view classes, but their lifecycle hooks are managed here.
 * - View aliases allow toolbar buttons like resourceTimelineDay to map to a base view
 *   plus a planning type/range state.
 */

/**
 * Toolbar/view aliases used by setView() and toolbar buttons.
 * They map user-friendly button names to the real view and planning state.
 */
const VIEW_ALIASES = Object.freeze({
  resourceTimeGridDay: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID,
    planningRange: SCHEDULER_VIEW_NAMES.DAY
  },
  resourceTimeGridWeek: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID,
    planningRange: SCHEDULER_VIEW_NAMES.WEEK
  },
  resourceTimelineDay: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.DAY
  },
  resourceTimelineWeek: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.WEEK
  },
  resourceTimelineMonth: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.MONTH
  }
});

/**
 * Resolve a view name or alias to its internal view descriptor.
 *
 * @param {string} viewName - View name requested by the API or toolbar.
 * @returns {{ view: string, planningType?: string, planningRange?: string }}
 */
function resolveViewName(viewName) {
  return VIEW_ALIASES[viewName] || { view: viewName };
}

/**
 * Check whether a view is one of the two planning views.
 *
 * @param {string} viewName - Internal view name.
 * @returns {boolean}
 */
function isPlanningViewName(viewName) {
  return viewName === SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID || viewName === SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE;
}

/**
 * Return the internal planning view name for the selected planning type.
 *
 * @param {string} type - Planning type: timeGrid or timeline.
 * @returns {string}
 */
function getPlanningViewName(type) {
  return type === SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE ? SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE : SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID;
}

/**
 * Normalize planning range.
 *
 * Resource time grid has no useful month layout, so month is downgraded to week.
 *
 * @param {string} type - Planning type.
 * @param {string} range - Requested planning range.
 * @returns {string}
 */
function normalizePlanningRange(type, range) {
  if (type === SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID && range === SCHEDULER_VIEW_NAMES.MONTH) return SCHEDULER_VIEW_NAMES.WEEK;
  return SCHEDULER_PLANNING_RANGES.includes(range) ? range : SCHEDULER_VIEW_NAMES.DAY;
}

/**
 * Internal view registry.
 * Aliases are also listed so toolbar active-state checks remain simple.
 */
const VIEW_CLASSES = Object.freeze({
  month: MonthView,
  week: TimeGridView,
  day: TimeGridView,
  list: ListView,

  resourceTimeline: ResourceTimelineView,
  resourceTimelineDay: ResourceTimelineView,
  resourceTimelineWeek: ResourceTimelineView,
  resourceTimelineMonth: ResourceTimelineView,

  resourceTimeGrid: ResourceTimeGridView,
  resourceTimeGridDay: ResourceTimeGridView,
  resourceTimeGridWeek: ResourceTimeGridView
});

class TinyScheduler extends MicroEvent {
  /**
   * @param {string|HTMLElement} target - CSS selector or root element.
   * @param {Object} options - Calendar options.
   */
  constructor(target, options = {}) {
    super();

    this.target = target;
    this.rootElement = this.resolveTargetElement(target);

    const resolvedLanguage = options?.locale || GLOBAL_CONFIG.locale;
    const resolvedI18n = getI18nConfig(resolvedLanguage);
    this.options = mergeDeep(DEFAULT_OPTIONS, resolvedI18n, options || {});

    // Configure storage once for this calendar instance.
    // CalendarStateStorage uses localStorage internally.
    CalendarStateStorage.configure(this.options.stateStorage);

    const storedViewState = CalendarStateStorage.getViewState();

    const resolvedInitialView = resolveViewName(storedViewState?.view ?? this.options.initialView);

    const initialPlanningType = storedViewState?.planningType || resolvedInitialView.planningType || this.options.planningType || SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID;
    const initialPlanningRange = normalizePlanningRange(initialPlanningType, storedViewState?.planningRange || resolvedInitialView.planningRange || this.options.planningRange || SCHEDULER_VIEW_NAMES.DAY);

    this.state = new CalendarState(
        this.options,
        resolvedInitialView,
        initialPlanningType,
        initialPlanningRange
    );

    this.sourceManager = new SourceManager(this);
    this.interactionManager = new InteractionManager(this);
    this.eventStore = new EventStore(this.options);
    this.resourceStore = new ResourceStore();

    // Event DOM lifecycle bookkeeping. A single event can appear multiple times,
    // for example in month cells and popovers.
    this.eventElementsById = new Map();
    this.pendingEventMounts = [];

    // Only events that actively introduced an accepted resource overlap are
    // marked. Existing events underneath remain visually unchanged.

    this.loadingRequests = 0;
    this.activeView = null;
    this.morePopover = null;
    this.eventActionToolbar = null;
    this.eventResizeState = null;
    this.nowIndicatorTimer = null;
    this.ignoreNextClick = false;

    this.selectedEventId = null;
    this.selectedEventElement = null;
    this.selectedSlotElements = [];
    this.slotSelection = null;
    this.lastSelectionInfo = null;

    // Bind handlers once to allow safe removeEventListener() in destroy().
    this.boundRootClick = event => this.handleRootClick(event);
    this.boundRootKeyDown = event => this.handleRootKeyDown(event);
    this.boundRootPointerDown = event => this.handleRootPointerDown(event);
    this.boundSlotPointerMove = event => this.handleSlotPointerMove(event);
    this.boundSlotPointerUp = event => this.handleSlotPointerUp(event);
    this.boundEventResizePointerMove = event => this.handleEventResizePointerMove(event);
    this.boundEventResizePointerUp = event => this.handleEventResizePointerUp(event);
    this.boundEventActionToolbarUpdate = () => this.updateEventActionToolbarPosition();

    this.normalizeInitialSources();
    this._notify('init');
  }

  /**
   * Resolve the calendar target element.
   *
   * @param {string|HTMLElement} target - CSS selector or element.
   * @returns {HTMLElement}
   */
  resolveTargetElement(target) {
    const element = isStr(target) ? document.querySelector(target) : target;

    if (!element) {
      throw new Error('TinyScheduler target element was not found.');
    }

    return element;
  }

  /**
   * Normalize initial event/resource sources so SourceManager can load them uniformly.
   */
  normalizeInitialSources() {
    const eventSources = [];

    if (!isNil(this.options.events) && (!Array.isArray(this.options.events) || this.options.events.length)) {
      eventSources.push(this.options.events);
    }

    eventSources.push(...this.normalizeSourceList(this.options.eventSources));
    this.sourceManager.setEventSources(eventSources);

    const resourceSources = [];

    if (!isNil(this.options.resources) && (!Array.isArray(this.options.resources) || this.options.resources.length)) {
      resourceSources.push(this.options.resources);
    }

    resourceSources.push(...this.normalizeSourceList(this.options.resourceSources));
    this.sourceManager.setResourceSources(resourceSources);
  }

  /**
   * Convert one source, many sources, or null into a clean source array.
   *
   * @param {*} sources - Source or source array.
   * @returns {Array}
   */
  normalizeSourceList(sources) {
    return Array.isArray(sources) ? sources : [sources].filter(Boolean);
  }

  /**
   * Create a DOM element with common project options.
   *
   * This delegates to the shared createDomElement() helper, so the main
   * component and view classes use the same DOM creation path.
   *
   * @param {string} tagName - HTML tag name.
   * @param {string} className - Optional class string.
   * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
   * @param {Object} options - DOM options.
   * @returns {HTMLElement}
   */
  createElement(tagName, className = '', content = '', options = {}) {
    return createDomElement(tagName, className, content, options);
  }

  _getLabel(key, fallback = '') {
    return this.options.labels?.[key] || GLOBAL_CONFIG.labels?.[key] || fallback || key;
  }

  _getTooltip(key, fallback = '') {
    return this.options.tooltips?.[key] || GLOBAL_CONFIG.tooltips?.[key] || this._getLabel(key, fallback);
  }

  _getAria(key, fallback = '') {
    return this.options.aria?.[key] || GLOBAL_CONFIG.aria?.[key] || fallback || key;
  }

  /**
   * Return trusted icon HTML for toolbar and event action buttons.
   *
   * User-defined `options.toolbarIcons` entries have priority over the default
   * `TSH_TOOLBAR_ICONS`. This allows applications to replace SVG icons with
   * framework icons, for example Font Awesome `<i>` tags, without redefining
   * the whole toolbar button behavior.
   *
   * @param {string} name - Icon/button name.
   * @param {string} fallbackIconHtml - Optional fallback icon HTML.
   * @returns {string}
   */
  getToolbarIconHtml(name, fallbackIconHtml = '') {
    const customIcons = this.options.toolbarIcons || {};
    const hasCustomIcon = Object.prototype.hasOwnProperty.call(customIcons, name);
    const iconHtml = hasCustomIcon
        ? customIcons[name]
        : fallbackIconHtml || TSH_TOOLBAR_ICONS[name] || '';

    return this.normalizeToolbarIconHtml(iconHtml);
  }

  /**
   * Normalize trusted icon HTML.
   *
   * TinyScheduler accepts SVG strings and regular icon markup. When existing
   * FullCalendar-style icon markup is passed as `<span class="fc-icon ...">`,
   * it is converted to `<i>` so font icons behave like icons rather than text.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {string}
   */
  normalizeToolbarIconHtml(iconHtml) {
    if (!isStr(iconHtml)) {
      return '';
    }

    const trimmedIconHtml = iconHtml.trim();

    if (!trimmedIconHtml) {
      return '';
    }

    if (/^<span\b/i.test(trimmedIconHtml) && /\bfc-icon\b/i.test(trimmedIconHtml)) {
      return trimmedIconHtml
          .replace(/^<span\b/i, '<i')
          .replace(/<\/span>$/i, '</i>');
    }

    return trimmedIconHtml;
  }

  /**
   * Return a simple icon type used for styling hooks.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {'svg'|'html'}
   */
  getToolbarIconType(iconHtml) {
    return /^<svg\b/i.test(this.normalizeToolbarIconHtml(iconHtml)) ? 'svg' : 'html';
  }

  /**
   * Convert event name to option callback name.
   * Example: eventsChanged -> onEventsChanged.
   *
   * @param {string} eventName - Internal/public event name.
   * @returns {string}
   */
  getCallbackName(eventName) {
    return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
  }

  /**
   * Build a normalized callback/event context.
   *
   * @param {Object} extra - Extra context values.
   * @returns {Object}
   */
  getContext(extra = {}) {
    return {
      calendar: this,
      view: this.state.currentView,
      date: this.state.currentDate,
      range: this.state.visibleRange,
      ...extra
    };
  }

  /**
   * Trigger option callback and MicroEvent event.
   *
   * @param {string} eventName - Event name.
   * @param {Object} payload - Additional context payload.
   * @returns {Object} Generated context.
   */
  _notify(eventName, payload = {}) {
    const context = this.getContext({ reason: eventName, ...payload });
    const callback = this.options[this.getCallbackName(eventName)];

    if (isFn(callback)) {
      callback.call(this, context);
    }

    this._emit(eventName, context);

    return context;
  }

  /**
   * Track async loading state with a small request counter.
   *
   * @param {boolean} isLoading - True when a load starts, false when one ends.
   * @param {string} reason - Loading reason.
   */
  _setLoading(isLoading, reason = 'refresh') {
    this.loadingRequests += isLoading ? 1 : -1;

    if (this.loadingRequests < 0) {
      this.loadingRequests = 0;
    }

    const context = this.getContext({
      isLoading: this.loadingRequests > 0,
      pendingRequests: this.loadingRequests,
      reason
    });

    if (isFn(this.options.loading)) {
      this.options.loading.call(this, context.isLoading, context);
    }

    this._emit(isLoading ? 'loadingStart' : 'loadingEnd', context);
    this._emit('loadingChanged', context);
  }

  /**
   * Mount the calendar, bind root events, fetch data and draw the first view.
   *
   * @returns {Promise<TinyScheduler>}
   */
  async render() {
    this._notify('beforeRender');

    this.drawBase();
    this.bindRootEvents();

    await this.refresh();

    this._notify('afterRender');

    return this;
  }

  /**
   * Attach root delegated event listeners.
   */
  bindRootEvents() {
    this.rootElement.addEventListener('click', this.boundRootClick);
    this.rootElement.addEventListener('keydown', this.boundRootKeyDown);
    this.rootElement.addEventListener('pointerdown', this.boundRootPointerDown);
    this.rootElement.addEventListener('scroll', this.boundEventActionToolbarUpdate, true);
    window.addEventListener('resize', this.boundEventActionToolbarUpdate);
  }

  /**
   * Remove root delegated event listeners.
   */
  unbindRootEvents() {
    this.rootElement.removeEventListener('click', this.boundRootClick);
    this.rootElement.removeEventListener('keydown', this.boundRootKeyDown);
    this.rootElement.removeEventListener('pointerdown', this.boundRootPointerDown);
    this.rootElement.removeEventListener('scroll', this.boundEventActionToolbarUpdate, true);
    window.removeEventListener('resize', this.boundEventActionToolbarUpdate);
    document.removeEventListener('pointermove', this.boundSlotPointerMove);
    document.removeEventListener('pointerup', this.boundSlotPointerUp);
    document.removeEventListener('pointermove', this.boundEventResizePointerMove);
    document.removeEventListener('pointerup', this.boundEventResizePointerUp);
  }

  /**
   * Draw the persistent calendar shell.
   * The active view is mounted inside .tsh-view-host.
   */
  drawBase() {
    this.rootElement.className = CLASS_NAMES.calendar.root;
    this.rootElement.innerHTML = '';
    this.eventActionToolbar = null;

    if (this.options.showToolbar) {
      this.rootElement.append(this.renderToolbar());
    }

    const body = this.createElement(CLASS_NAMES.calendar.bodyTag || 'div', CLASS_NAMES.calendar.body);
    const viewHost = this.createElement('div', CLASS_NAMES.calendar.viewHost || 'tsh-view-host');

    body.append(viewHost);
    this.viewHost = viewHost;
    this.rootElement.append(body);
    this.ensureEventActionToolbar();
  }

  /**
   * Render the main toolbar with left/center/right chunks.
   *
   * @returns {HTMLElement}
   */
  renderToolbar() {
    const toolbar = this.createElement('div', CLASS_NAMES.calendar.toolbar);

    ['left', 'center', 'right'].forEach(position => {
      toolbar.append(this.renderToolbarChunk(position));
    });

    return toolbar;
  }

  /**
   * Render one toolbar chunk and group configured buttons when needed.
   *
   * @param {string} position - left, center, or right.
   * @returns {HTMLElement}
   */
  renderToolbarChunk(position) {
    const chunk = this.createElement('div', CLASS_NAMES.calendar.toolbarChunk, '', {
      dataset: {
        toolbarPosition: position
      }
    });

    let currentButtonGroup = null;

    const appendCurrentGroup = () => {
      if (currentButtonGroup?.childElementCount) {
        chunk.append(currentButtonGroup);
      }

      currentButtonGroup = null;
    };

    (this.options.toolbar[position] || []).forEach(name => {
      const item = this.renderToolbarItem(name);

      if (name === 'title') {
        appendCurrentGroup();
        chunk.append(item);
        return;
      }

      if (this.shouldGroupToolbarButton(name, position)) {
        if (!currentButtonGroup) {
          currentButtonGroup = this.createElement('div', CLASS_NAMES.calendar.buttonGroup);
        }

        currentButtonGroup.append(item);
        return;
      }

      appendCurrentGroup();
      chunk.append(item);
    });

    appendCurrentGroup();

    return chunk;
  }

  /**
   * Decide whether a toolbar button should be visually grouped.
   *
   * @param {string} name - Toolbar item name.
   * @param {string} position - Toolbar chunk position.
   * @returns {boolean}
   */
  shouldGroupToolbarButton(name, position) {
    const buttonConfig = this.getToolbarButtonConfig(name);

    if (buttonConfig.group === true) return true;
    if (buttonConfig.group === false) return false;

    // Only navigation arrows are merged in the left toolbar.
    // sidebarToggle and today stay standalone.
    if (position === 'left') {
      return ['prev', 'next', 'prevYear', 'nextYear'].includes(name);
    }

    // View buttons are grouped on the right, including the planning umbrella button.
    if (position === 'right') {
      return name === 'planning' || buttonConfig.type === 'view';
    }

    return false;
  }

  /**
   * Render planning toolbar for Resource Time Grid / Resource Timeline.
   *
   * @returns {HTMLElement|null}
   */
  renderPlanningToolbar() {
    if (!this.isPlanningView()) return null;

    const toolbar = this.createElement('div', 'tsh-planning-toolbar');
    const typeGroup = this.createPlanningToolbarGroup({
      label: this._getLabel('planningView', 'Type'),
      buttons: [
        this.createPlanningSegmentButton({
          label: this._getLabel('resourceTimeGrid', 'Grid'),
          tooltip: this._getTooltip('resourceTimeGrid', 'Resource time grid'),
          active: this.isPlanningType('timeGrid'),
          datasetName: 'planningType',
          datasetValue: 'timeGrid'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('resourceTimeline', 'Timeline'),
          tooltip: this._getTooltip('resourceTimeline', 'Resource timeline'),
          active: this.isPlanningType('timeline'),
          datasetName: 'planningType',
          datasetValue: 'timeline'
        })
      ]
    });

    const rangeGroup = this.createPlanningToolbarGroup({
      label: this._getLabel('period', 'Period'),
      buttons: [
        this.createPlanningSegmentButton({
          label: this._getLabel('day', 'Day'),
          tooltip: this._getTooltip('day', 'Day'),
          active: this.isPlanningRange('day'),
          datasetName: 'planningRange',
          datasetValue: 'day'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('week', 'Week'),
          tooltip: this._getTooltip('week', 'Week'),
          active: this.isPlanningRange('week'),
          datasetName: 'planningRange',
          datasetValue: 'week'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('month', 'Month'),
          tooltip: this._getTooltip('month', 'Month'),
          active: this.isPlanningRange('month'),
          disabled: this.isPlanningType('timeGrid'),
          datasetName: 'planningRange',
          datasetValue: 'month'
        })
      ]
    });

    toolbar.append(typeGroup, rangeGroup);

    return toolbar;
  }

  /**
   * Create one planning toolbar group: label + segmented button group.
   *
   * @param {Object} config - Group config.
   * @param {string} config.label - Group label.
   * @param {HTMLElement[]} config.buttons - Buttons to append.
   * @returns {HTMLElement}
   */
  createPlanningToolbarGroup({ label, buttons }) {
    const group = this.createElement('div', 'tsh-planning-toolbar-group');
    const labelElement = this.createElement('span', 'tsh-planning-toolbar-label', label);
    const buttonGroup = this.createElement('div', CLASS_NAMES.calendar.buttonGroup, buttons);

    group.append(labelElement, buttonGroup);

    return group;
  }

  /**
   * Create one planning segmented button.
   *
   * @param {Object} config - Button config.
   * @param {string} config.label - Visible label.
   * @param {string} config.tooltip - Tooltip text.
   * @param {boolean} config.active - Active state.
   * @param {boolean} config.disabled - Disabled state.
   * @param {string} config.datasetName - Dataset key without "data-".
   * @param {string} config.datasetValue - Dataset value.
   * @returns {HTMLButtonElement}
   */
  createPlanningSegmentButton(config) {
    const button = this.createElement(
        'button',
        classNames(
            CLASS_NAMES.calendar.button,
            'tsh-button--segment',
            // Keep the legacy classes for consumers that still target them.
            'tsh-segmented-button',
            config.active && CLASS_NAMES.calendar.viewButtonActive,
            config.active && 'tsh-segmented-button-active'
        ),
        config.label,
        {
          props: {
            type: 'button',
            disabled: Boolean(config.disabled)
          },
          dataset: {
            [config.datasetName]: config.datasetValue,
            tooltip: config.tooltip || config.label
          },
          attrs: {
            'aria-pressed': String(Boolean(config.active)),
            ...(config.disabled ? { 'aria-disabled': 'true' } : {})
          }
        }
    );

    return button;
  }

  /**
   * Rebuild the planning toolbar after a view/type/range change.
   *
   * @returns {TinyScheduler}
   */
  refreshPlanningToolbar() {
    this.rootElement.querySelector('.tsh-planning-toolbar')?.remove();

    const planningToolbar = this.renderPlanningToolbar();

    if (planningToolbar && this.options.showToolbar) {
      const toolbar = this.rootElement.querySelector(`.${CLASS_NAMES.calendar.toolbar}`);
      toolbar?.after(planningToolbar);
    }

    return this;
  }

  /**
   * Render one toolbar item.
   * Supports text, legacy text icons and trusted SVG icons.
   *
   * @param {string} name - Toolbar item name.
   * @returns {HTMLElement}
   */
  renderToolbarItem(name) {
    if (name === 'title') {
      return this.renderToolbarTitle();
    }

    const buttonConfig = this.getToolbarButtonConfig(name);
    const isActiveViewButton = this.isToolbarViewButtonActive(name);

    const button = this.createElement('button', this.getToolbarButtonClassName(buttonConfig, isActiveViewButton), '', {
      props: {
        type: 'button',
        disabled: Boolean(buttonConfig.disabled),
        hidden: Boolean(buttonConfig.hidden)
      },
      dataset: {
        tshButton: name
      }
    });

    this.applyToolbarButtonMetadata(button, name, buttonConfig, isActiveViewButton);
    this.appendToolbarButtonContent(button, buttonConfig);

    return button;
  }

  /**
   * Render the current calendar title.
   *
   * @returns {HTMLHeadingElement}
   */
  renderToolbarTitle() {
    return this.createElement('h2', CLASS_NAMES.calendar.title, this.getTitle());
  }

  /**
   * Build toolbar button classes.
   *
   * @param {Object} buttonConfig - Normalized button config.
   * @param {boolean} isActiveViewButton - Whether the view button is active.
   * @returns {string}
   */
  getToolbarButtonClassName(buttonConfig, isActiveViewButton) {
    const isIconOnly = Boolean(
        buttonConfig.icon || buttonConfig.iconHtml || buttonConfig.svg
    ) && !buttonConfig.text;

    return classNames(
        CLASS_NAMES.calendar.button,
        isIconOnly && 'tsh-button--icon',
        buttonConfig.type === 'view' && CLASS_NAMES.calendar.viewButton,
        isActiveViewButton && CLASS_NAMES.calendar.viewButtonActive,
        buttonConfig.className
    );
  }

  /**
   * Determine whether a toolbar view button is active.
   *
   * @param {string} name - Toolbar item name.
   * @returns {boolean}
   */
  isToolbarViewButtonActive(name) {
    if (name === 'planning') {
      return this.isPlanningView();
    }

    if (this.isView(name)) {
      return true;
    }

    return Boolean(VIEW_ALIASES[name] && this.isView(VIEW_ALIASES[name].view));
  }

  /**
   * Apply tooltip, aria, pressed, disabled and hidden states to a toolbar button.
   *
   * @param {HTMLButtonElement} button - Button element.
   * @param {string} name - Toolbar item name.
   * @param {Object} buttonConfig - Normalized button config.
   * @param {boolean} isActiveViewButton - Active state for view buttons.
   */
  applyToolbarButtonMetadata(button, name, buttonConfig, isActiveViewButton) {
    const tooltip = buttonConfig.tooltip || this._getTooltip(name, buttonConfig.text || name);
    const ariaLabel = buttonConfig.ariaLabel || tooltip || buttonConfig.text || name;

    if (tooltip) {
      button.dataset.tooltip = tooltip;
    }

    // Icon-only buttons need an explicit accessible label.
    if (!buttonConfig.text || buttonConfig.icon || buttonConfig.iconHtml || buttonConfig.svg) {
      button.setAttribute('aria-label', ariaLabel);
    }

    if (buttonConfig.type === 'view') {
      button.setAttribute('aria-pressed', String(isActiveViewButton));
    }
  }

  /**
   * Append icon/text content to a toolbar button.
   *
   * Priority:
   * 1. iconHtml - trusted inline HTML icon, usually SVG or `<i>`.
   * 2. svg - backward-compatible trusted SVG string.
   * 3. icon - legacy text icon.
   * 4. text - visible label.
   *
   * @param {HTMLButtonElement} button - Button element.
   * @param {Object} buttonConfig - Normalized button config.
   */
  appendToolbarButtonContent(button, buttonConfig) {
    const iconHtml = buttonConfig.iconHtml || buttonConfig.svg;

    if (iconHtml) {
      button.append(this.createToolbarIconHtml(iconHtml));
    } else if (buttonConfig.icon) {
      button.append(this.createToolbarTextIcon(buttonConfig.icon));
    }

    if (buttonConfig.text) {
      button.append(this.createToolbarButtonText(buttonConfig.text));
    }
  }

  /**
   * Create an icon wrapper containing trusted icon HTML.
   *
   * The wrapper gets a type modifier so CSS can size SVG and font icons
   * independently when needed.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {HTMLSpanElement}
   */
  createToolbarIconHtml(iconHtml) {
    const normalizedIconHtml = this.normalizeToolbarIconHtml(iconHtml);

    return this.createElement(
        'span',
        classNames(
            CLASS_NAMES.calendar.buttonIcon,
            `tsh-button-icon--${this.getToolbarIconType(normalizedIconHtml)}`
        ),
        '',
        {
          html: normalizedIconHtml
        }
    );
  }

  /**
   * Backward-compatible alias for old internal calls.
   *
   * @param {string} svg - Trusted SVG string.
   * @returns {HTMLSpanElement}
   */
  createToolbarSvgIcon(svg) {
    return this.createToolbarIconHtml(svg);
  }

  /**
   * Create a text icon wrapper.
   *
   * @param {string} iconText - Text icon.
   * @returns {HTMLSpanElement}
   */
  createToolbarTextIcon(iconText) {
    return this.createElement('span', CLASS_NAMES.calendar.buttonIcon, iconText);
  }

  /**
   * Create visible toolbar button text.
   *
   * @param {string} textValue - Button label.
   * @returns {HTMLSpanElement}
   */
  createToolbarButtonText(textValue) {
    return this.createElement('span', CLASS_NAMES.calendar.buttonText, textValue);
  }

  /**
   * Normalize one custom button definition.
   *
   * Custom button definitions are shared by the main toolbar and the floating
   * event action toolbar so consumers do not need two parallel button APIs.
   *
   * @param {string} name - Custom button name.
   * @returns {Object|null}
   */
  getCustomButtonConfig(name) {
    const customButton = this.options.customButtons?.[name];

    if (!customButton) {
      return null;
    }

    const iconHtml = this.getToolbarIconHtml(name, customButton.iconHtml || customButton.svg || '');

    return {
      name,
      type: 'custom',
      ...customButton,
      iconHtml
    };
  }

  /**
   * Return a normalized toolbar button config.
   *
   * Priority:
   * 1. custom button from options.customButtons.
   * 2. built-in navigation button.
   * 3. planning button.
   * 4. regular view button.
   * 5. fallback custom-like button.
   *
   * @param {string} name - Toolbar button name.
   * @returns {Object}
   */
  getToolbarButtonConfig(name) {
    const customButton = this.getCustomButtonConfig(name);

    if (customButton) {
      return customButton;
    }

    const navigationButtons = {
      prev: {
        iconHtml: this.getToolbarIconHtml('prev'),
        text: '',
        tooltip: this._getTooltip('previous', 'Previous'),
        ariaLabel: this._getTooltip('previous', 'Previous')
      },
      next: {
        iconHtml: this.getToolbarIconHtml('next'),
        text: '',
        tooltip: this._getTooltip('next', 'Next'),
        ariaLabel: this._getTooltip('next', 'Next')
      },
      prevYear: {
        iconHtml: this.getToolbarIconHtml('prevYear'),
        text: '',
        tooltip: this._getTooltip('previousYear', 'Previous year'),
        ariaLabel: this._getTooltip('previousYear', 'Previous year')
      },
      nextYear: {
        iconHtml: this.getToolbarIconHtml('nextYear'),
        text: '',
        tooltip: this._getTooltip('nextYear', 'Next year'),
        ariaLabel: this._getTooltip('nextYear', 'Next year')
      },
      today: {
        iconHtml: this.getToolbarIconHtml('today'),
        text: '',
        tooltip: this._getTooltip('today', 'Today'),
        ariaLabel: this._getTooltip('today', 'Today')
      },
      addEvent: {
        iconHtml: this.getToolbarIconHtml('addEvent'),
        text: '',
        tooltip: this._getTooltip('addEvent', 'Add event'),
        ariaLabel: this._getTooltip('addEvent', 'Add event')
      },
      deleteEvent: {
        iconHtml: this.getToolbarIconHtml('deleteEvent'),
        text: '',
        tooltip: this._getTooltip('deleteEvent', 'Delete selected event'),
        ariaLabel: this._getTooltip('deleteEvent', 'Delete selected event'),
        disabled: !this.selectedEventId
      }
    };

    if (navigationButtons[name]) {
      return {
        name,
        type: 'navigation',
        ...navigationButtons[name]
      };
    }

    if (name === 'planning') {
      return {
        name,
        type: 'view',
        text: this._getLabel('planning', 'Planning'),
        tooltip: this._getTooltip('planning', 'Planning')
      };
    }

    if (VIEW_CLASSES[name] || VIEW_ALIASES[name]) {
      return {
        name,
        type: 'view',
        text: this._getLabel(this.getViewLabelKey(name), name)
      };
    }

    return {
      name,
      type: 'custom',
      text: name
    };
  }

  getViewLabelKey(viewName) {
    if (viewName.includes('resourceTimeline')) return 'resourceTimeline';
    if (viewName.includes('resourceTimeGrid')) return 'resourceTimeGrid';
    return viewName;
  }

  /**
   * Rebuild the toolbar while preserving the current calendar state.
   *
   * @returns {TinyScheduler}
   */
  refreshToolbar() {
    const oldToolbar = this.rootElement.querySelector(`.${CLASS_NAMES.calendar.toolbar}`);

    if (oldToolbar) {
      oldToolbar.replaceWith(this.renderToolbar());
    }

    return this;
  }

  /**
   * Fetch events/resources for the current visible range and redraw the calendar.
   *
   * @returns {Promise<TinyScheduler>}
   */
  async refresh() {
    this._notify('beforeRefresh');
    this._setLoading(true, 'refresh');

    try {
      const range = this.getVisibleRangeForCurrentView();

      this._notify('eventsLoadStart');

      const [events, resources] = await Promise.all([
        this.sourceManager.fetchEvents(range),
        this.sourceManager.fetchResources(range)
      ]);

      this.eventStore.setEvents(events);
      this.resourceStore.setResources(resources);

      this._notify('eventsLoadEnd', { events });
      this._notify('resourcesLoadEnd', { resources });
      this._notify('eventsChanged', { events });
      this._notify('resourcesChanged', { resources });

      this.redraw();
      this.scheduleAutoScrollToDate(this.state.currentDate);
      this._notify('refreshEnd');
    } catch (error) {
      this._notify('error', { error });
    } finally {
      this._setLoading(false, 'refresh');
      this._notify('afterRefresh');
    }

    return this;
  }

  redraw() {
    this._notify('beforeRedraw');
    this._notify('beforeDraw');

    this.closeMorePopover();

    // Important: the selected event element belongs to the old view DOM.
    // Hide the toolbar before the view is destroyed to avoid stale positioning.
    this.hideEventActionToolbar();

    if (this.selectedEventElement?.isConnected) {
      this.selectedEventElement.classList.remove(CLASS_NAMES.calendar.eventSelected);
    }

    this.selectedEventElement = null;

    this._unmountViewEvents();

    const ViewClass = VIEW_CLASSES[this.state.currentView];

    if (!ViewClass) {
      throw new Error(`Unsupported view: ${this.state.currentView}`);
    }

    if (this.activeView) {
      this.activeView.destroy();
    }

    this.activeView = new ViewClass(this);

    const viewElement = this.activeView.render();

    if (this.viewHost) {
      this.viewHost.innerHTML = '';
      this.viewHost.append(viewElement);
    }

    this.state.visibleRange = this.activeView.getVisibleRange();

    this.refreshToolbar();
    this.refreshPlanningToolbar();
    this.notifyViewDidMount(viewElement);
    this._flushEventMounts();

    // Restore only if the event really exists in the new rendered view.
    this.restoreSelectedEventElement();

    this.refreshActionToolbarState();

    this._notify('draw');
    this._notify('afterDraw');
    this._notify('redrawEnd');

    this.scheduleNowIndicatorRefresh();

    return this;
  }

  /**
   * Clear the pending current-time indicator timer.
   *
   * @returns {TinyScheduler}
   */
  clearNowIndicatorTimer() {
    if (this.nowIndicatorTimer) {
      root.clearTimeout(this.nowIndicatorTimer);
      this.nowIndicatorTimer = null;
    }

    return this;
  }

  /**
   * Return true when the active view currently needs live now updates.
   * We only keep the clock alive when today is inside the visible range and
   * the active view supports a now indicator. This avoids unnecessary redraws
   * in month/list or in historical/future ranges.
   *
   * @returns {boolean}
   */
  shouldScheduleNowIndicatorRefresh() {
    if (this.options.showNowIndicator === false) return false;
    if (!this.activeView?.supportsNowIndicator?.()) return false;

    const range = this.state.visibleRange;
    const now = new Date();

    return Boolean(range)
        && now >= range.start
        && now < range.end;
  }

  /**
   * Schedule a lightweight redraw at the next minute boundary.
   * The now indicator is purely visual, so this does not refetch events or
   * resources. It only redraws the current in-memory view.
   *
   * @returns {TinyScheduler}
   */
  scheduleNowIndicatorRefresh() {
    this.clearNowIndicatorTimer();

    if (!this.shouldScheduleNowIndicatorRefresh()) {
      return this;
    }

    const now = new Date();
    const delay = Math.max(
        1000,
        60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 80
    );

    this.nowIndicatorTimer = root.setTimeout(() => {
      this.nowIndicatorTimer = null;

      if (this.rootElement?.isConnected) {
        this.activeView?.refreshNowIndicator?.();
        this.scheduleNowIndicatorRefresh();
      }
    }, delay);

    return this;
  }

  /**
   * Notify the viewDidMount option callback.
   *
   * @param {HTMLElement} viewElement - Mounted view root element.
   */
  notifyViewDidMount(viewElement) {
    if (!isFn(this.options.viewDidMount)) return;

    this.options.viewDidMount.call(this, {
      calendar: this,
      el: viewElement,
      view: {
        name: this.state.currentView,
        type: this.getViewType(this.state.currentView)
      },
      date: this.state.currentDate,
      range: this.state.visibleRange
    });
  }

  /**
   * Return a stable key for one scroll container.
   *
   * @param {HTMLElement} scrollElement - Scroll container.
   * @param {number} index - Fallback index.
   * @returns {string}
   */
  getScrollStateKey(scrollElement, index) {
    const stableClass = [
      'tsh-time-grid-scroll',
      'tsh-rtg-scroll',
      'tsh-rtl-scroller',
      CLASS_NAMES.calendar.list
    ].find(className => scrollElement.classList.contains(className));

    return scrollElement.dataset.scrollKey || stableClass || `scroll-${index}`;
  }

  /**
   * Capture scrollTop/scrollLeft for mounted scheduler scroll containers.
   *
   * @returns {Array<Object>}
   */
  captureScrollState() {
    return Array.from(
        this.rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.scrollContainer}`)
    ).map((scrollElement, index) => ({
      key: this.getScrollStateKey(scrollElement, index),
      index,
      scrollTop: scrollElement.scrollTop,
      scrollLeft: scrollElement.scrollLeft
    }));
  }

  /**
   * Restore captured scroll state after local or fallback refresh.
   *
   * @param {Array<Object>} scrollState - Captured scroll values.
   * @returns {TinyScheduler}
   */
  restoreScrollState(scrollState = []) {
    if (!scrollState.length) return this;

    requestAnimationFrame(() => {
      const scrollElements = Array.from(
          this.rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.scrollContainer}`)
      );

      scrollState.forEach(item => {
        const scrollElement = scrollElements.find((element, index) => (
          this.getScrollStateKey(element, index) === item.key
        )) || scrollElements[item.index];

        if (!scrollElement) return;

        scrollElement.scrollTop = item.scrollTop;
        scrollElement.scrollLeft = item.scrollLeft;
      });

      this.updateEventActionToolbarPosition();
    });

    return this;
  }

  /**
   * Redraw the full active view but keep the current scroll position.
   * Used only as fallback when a view cannot refresh event DOM locally.
   *
   * @returns {TinyScheduler}
   */
  redrawPreservingScroll() {
    const scrollState = this.captureScrollState();

    this.redraw();
    this.restoreScrollState(scrollState);

    return this;
  }

  /**
   * Refresh event rendering after add/update/move/delete.
   * The active view gets the first chance to update only its event layers.
   * If it cannot, TinyScheduler falls back to a full redraw with scroll restore.
   *
   * @param {Object} mutation - Event mutation metadata.
   * @returns {TinyScheduler}
   */
  refreshEventDisplay(mutation = {}) {
    const scrollState = this.captureScrollState();

    this.closeMorePopover();

    try {
      if (this.activeView?.refreshEvents?.(mutation) === true) {
        this._flushEventMounts();
        this.restoreSelectedEventElement();
        this.refreshToolbar();
        this.refreshActionToolbarState();
        this.restoreScrollState(scrollState);

        return this;
      }
    } catch (error) {
      this._notify('error', { error, mutation, reason: 'eventRefresh' });
    }

    this.redraw();
    this.restoreScrollState(scrollState);

    return this;
  }

  /**
   * Redraw one event through the lightweight event refresh pipeline.
   *
   * @param {string} eventId - Event id.
   * @returns {TinyScheduler}
   */
  redrawEvent(eventId) {
    const event = this.eventStore.getEventById(eventId);

    return this.refreshEventDisplay({
      type: 'refresh',
      eventId: String(eventId),
      event,
      oldEvent: event,
      reason: 'redrawEvent'
    });
  }

  /**
   * Queue one event element for eventDidMount.
   *
   * @param {HTMLElement} element - Event DOM element.
   * @param {Object} event - Normalized event.
   * @param {Object|null} resource - Resource context.
   */
  _queueEventMount(element, event, resource = null) {
    if (element) {
      element._tshEvent = event;
      element._tshResource = resource;
    }

    this.pendingEventMounts.push({ element, event, resource });
  }

  /**
   * Flush pending eventDidMount callbacks after the view is mounted.
   */
  _flushEventMounts() {
    this.pendingEventMounts.forEach(({ element, event, resource }) => {
      if (!this.eventElementsById.has(event.id)) {
        this.eventElementsById.set(event.id, new Set());
      }

      this.eventElementsById.get(event.id).add(element);

      if (isFn(this.options.eventDidMount)) {
        this.options.eventDidMount.call(this, {
          calendar: this,
          el: element,
          event,
          view: this.state.currentView,
          resource
        });
      }
    });

    this.pendingEventMounts = [];
  }

  /**
   * Notify eventWillUnmount for a single mounted event element and unregister it.
   *
   * @param {HTMLElement} element - Mounted event element.
   * @param {Object|null} eventOverride - Event data to use after deletion.
   * @returns {TinyScheduler}
   */
  _unmountEventElement(element, eventOverride = null) {
    const eventId = element?.dataset?.eventId;

    if (!eventId) return this;

    const event = eventOverride || element._tshEvent || this.eventStore.getEventById(eventId);

    if (isFn(this.options.eventWillUnmount)) {
      this.options.eventWillUnmount.call(this, {
        calendar: this,
        el: element,
        event,
        view: this.state.currentView
      });
    }

    const elements = this.eventElementsById.get(String(eventId));

    if (elements) {
      elements.delete(element);

      if (!elements.size) {
        this.eventElementsById.delete(String(eventId));
      }
    }

    if (this.selectedEventElement === element) {
      this.selectedEventElement = null;
    }

    return this;
  }

  /**
   * Unmount all event elements contained in a DOM subtree.
   *
   * @param {HTMLElement} rootElement - Container to inspect.
   * @param {Object|null} eventOverride - Optional deleted event data.
   * @returns {TinyScheduler}
   */
  _unmountEventElementsIn(rootElement, eventOverride = null) {
    if (!rootElement) return this;

    rootElement
        .querySelectorAll?.(SCHEDULER_SELECTORS.event)
        .forEach(element => this._unmountEventElement(element, eventOverride));

    return this;
  }

  /**
   * Notify eventWillUnmount before clearing event element references.
   */
  _unmountViewEvents() {
    if (isFn(this.options.eventWillUnmount)) {
      this.eventElementsById.forEach((elements, eventId) => {
        elements.forEach(element => {
          this.options.eventWillUnmount.call(this, {
            calendar: this,
            el: element,
            event: element._tshEvent || this.eventStore.getEventById(eventId),
            view: this.state.currentView
          });
        });
      });
    }

    this.eventElementsById.clear();
  }

  getVisibleRangeForCurrentView() {
    const ViewClass = VIEW_CLASSES[this.state.currentView] || MonthView;
    const tempView = new ViewClass(this);

    return tempView.getVisibleRange();
  }

  getTitle() {
    if (this.activeView) return this.activeView.getTitle();

    const ViewClass = VIEW_CLASSES[this.state.currentView];
    return ViewClass ? new ViewClass(this).getTitle() : '';
  }

  getViewType(viewName) {
    if (viewName === 'month') return 'month';
    if (viewName === 'list') return 'list';
    if (viewName === 'week' || viewName === 'day') return 'timeGrid';
    if (viewName.includes('resourceTimeline')) return 'resourceTimeline';
    if (viewName.includes('resourceTimeGrid')) return 'resourceTimeGrid';
    return viewName;
  }

  closeMorePopover() {
    this.morePopover?.remove();
    this.morePopover = null;

    return this;
  }

  /**
   * Show a month-view "+more" popover for the given date.
   *
   * @param {string} dateKey - YYYY-MM-DD date key.
   * @param {HTMLElement} anchorElement - Button that opened the popover.
   * @returns {TinyScheduler}
   */
  showMorePopover(dateKey, anchorElement) {
    this.closeMorePopover();

    const date = parseDateInput(dateKey);
    const events = this.eventStore.getEventsForDate(date).sort((firstEvent, secondEvent) => {
      return Number(!isAllDayEvent(firstEvent)) - Number(!isAllDayEvent(secondEvent)) || firstEvent.start - secondEvent.start;
    });

    const popover = this.createElement('div', 'tsh-more-popover', '', {
      attrs: {
        role: 'dialog',
        'aria-modal': 'false'
      }
    });

    const header = this.createMorePopoverHeader(date);
    const body = this.createMorePopoverBody(events);

    popover.append(header, body);
    this.rootElement.append(popover);
    this.positionMorePopover(popover, anchorElement);

    this.morePopover = popover;

    const closeButton = popover.querySelector('[data-more-close]');
    closeButton?.focus({ preventScroll: true });

    return this;
  }

  /**
   * Create the header for the month "+more" popover.
   *
   * @param {Date} date - Popover date.
   * @returns {HTMLElement}
   */
  createMorePopoverHeader(date) {
    const title = this.createElement('strong', 'tsh-more-popover-title', formatDayTitle(date, this.options.locale));
    const closeButton = this.createElement('button', 'tsh-more-popover-close', '×', {
      props: {
        type: 'button'
      },
      dataset: {
        moreClose: 'true'
      },
      attrs: {
        'aria-label': this._getAria('close', 'Close')
      }
    });

    return this.createElement('div', 'tsh-more-popover-header', [title, closeButton]);
  }

  /**
   * Create the body for the month "+more" popover.
   *
   * @param {Object[]} events - Events on the selected date.
   * @returns {HTMLElement}
   */
  createMorePopoverBody(events) {
    const body = this.createElement('div', 'tsh-more-popover-body');

    events.forEach(event => {
      body.append(this.createMorePopoverEventRow(event));
    });

    return body;
  }

  /**
   * Create one event row inside the "+more" popover.
   *
   * @param {Object} event - Normalized event.
   * @returns {HTMLElement}
   */
  createMorePopoverEventRow(event) {
    const eventColor = event.backgroundColor || event.color;
    const eventRow = this.createElement(
        'div',
        classNames('tsh-more-popover-event', isAllDayEvent(event) && 'tsh-more-popover-event--all-day'),
        '',
        {
          dataset: {
            eventId: event.id
          },
          style: {
            '--tsh-event-bg': eventColor,
            '--tsh-event-text': event.textColor
          }
        }
    );

    if (isAllDayEvent(event)) {
      eventRow.textContent = event.title;
      return eventRow;
    }

    const dot = this.createElement('span', 'tsh-more-popover-dot', '', {
      style: {
        backgroundColor: eventColor
      }
    });

    const time = this.createElement('span', 'tsh-more-popover-time', formatShortTime(event.start, this.options));
    const eventTitle = this.createElement('strong', '', event.title);

    eventRow.append(dot, time, eventTitle);

    return eventRow;
  }

  /**
   * Position the "+more" popover relative to the clicked anchor.
   *
   * @param {HTMLElement} popover - Popover element.
   * @param {HTMLElement} anchorElement - Anchor button.
   */
  positionMorePopover(popover, anchorElement) {
    const rootRect = this.rootElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const slotElement = anchorElement.closest('.tsh-slot');
    const slotRect = slotElement?.getBoundingClientRect();

    const referenceWidth = slotRect?.width || anchorRect.width || 280;
    const popoverWidth = Math.min(380, Math.max(220, referenceWidth * 1.5), Math.max(220, rootRect.width - 16));

    const anchorLeft = anchorRect.left - rootRect.left;
    const preferredLeft = anchorLeft + 12;
    const maxLeft = Math.max(8, rootRect.width - popoverWidth - 8);

    const left = Math.min(Math.max(8, preferredLeft), maxLeft);

    const top = Math.max(8, anchorRect.top - rootRect.top - 12);

    popover.style.width = `${Math.round(popoverWidth)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  /**
   * Handle all root click interactions through event delegation.
   * Slot selection is handled by pointer events so click does not fire select twice.
   *
   * @param {MouseEvent} originalEvent - Click event.
   */
  handleRootClick(originalEvent) {
    if (this.ignoreNextClick) {
      originalEvent.preventDefault();
      originalEvent.stopPropagation();
      return this;
    }

    const button = originalEvent.target.closest(SCHEDULER_SELECTORS.toolbarButton);
    if (button) {
      this.handleToolbarButton(button.dataset.tshButton, originalEvent);
      return;
    }

    const planningTypeButton = originalEvent.target.closest(SCHEDULER_SELECTORS.planningTypeButton);
    if (planningTypeButton) {
      this.setPlanningType(planningTypeButton.dataset.planningType);
      return;
    }

    const planningRangeButton = originalEvent.target.closest(SCHEDULER_SELECTORS.planningRangeButton);
    if (planningRangeButton) {
      this.setPlanningRange(planningRangeButton.dataset.planningRange);
      return;
    }

    const toggle = originalEvent.target.closest(SCHEDULER_SELECTORS.resourceToggle);
    if (toggle) {
      this.toggleResource(toggle.dataset.resourceToggle);
      return;
    }

    const moreClose = originalEvent.target.closest(SCHEDULER_SELECTORS.moreClose);
    if (moreClose) {
      this.closeMorePopover();
      return;
    }

    const moreButton = originalEvent.target.closest(SCHEDULER_SELECTORS.moreButton);
    if (moreButton) {
      this.showMorePopover(moreButton.dataset.moreDate, moreButton);
      return;
    }

    const eventActionElement = originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction);
    if (eventActionElement) {
      originalEvent.preventDefault();
      this.handleEventActionClick(eventActionElement, originalEvent);
      return;
    }

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);
    if (eventElement) {
      if (this.interactionManager.wasRecentlyDragging()) return;
      this.handleEventClick(eventElement, originalEvent);
      return;
    }

    const dateNavElement = originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav);
    if (dateNavElement) {
      originalEvent.preventDefault();
      this.handleDateNavigation(dateNavElement.dataset.date, originalEvent);
    }
  }

  /**
   * Navigate to the day view from a dedicated date navigation control.
   * Regular slots do not use this path; they are selected instead.
   *
   * @param {string} dateValue - Date value from data-date.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original user event.
   * @returns {TinyScheduler}
   */
  handleDateNavigation(dateValue, originalEvent) {
    const date = parseDateInput(dateValue);

    this._notify('dateClick', { date, originalEvent });
    this.gotoDate(date, { refresh: false });

    if (this.state.currentView !== SCHEDULER_VIEW_NAMES.DAY) {
      this.setView(SCHEDULER_VIEW_NAMES.DAY);
    } else {
      this.refresh();
    }

    return this;
  }

  /**
   * Make delegated event/date elements keyboard-accessible.
   * Enter on a selected event emits eventEdit. Space/Enter on an unselected
   * event selects it. Date navigation links keep their click behavior.
   *
   * @param {KeyboardEvent} originalEvent - Keydown event.
   */
  handleRootKeyDown(originalEvent) {
    if (originalEvent.key !== 'Enter' && originalEvent.key !== ' ') return;

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);
    if (eventElement) {
      const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
      if (!schedulerEvent) return;

      originalEvent.preventDefault();

      if (originalEvent.key === 'Enter' && this.selectedEventId === schedulerEvent.id) {
        this.emitEventEdit(schedulerEvent, eventElement, originalEvent, 'keyboard');
        return;
      }

      this.selectEventElement(schedulerEvent, eventElement, originalEvent);
      return;
    }

    const dateNavElement = originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav);
    if (dateNavElement) {
      originalEvent.preventDefault();
      dateNavElement.click();
    }
  }

  /**
   * Start editable event dragging or slot range selection.
   *
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {TinyScheduler}
   */
  handleRootPointerDown(originalEvent) {
    if (originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction)) return this;

    const resizeHandle = originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle);
    if (resizeHandle) {
      return this.startEventResize(resizeHandle, originalEvent);
    }

    this.interactionManager.handlePointerDown(originalEvent);

    if (originalEvent.button !== 0 || !this.options.selectable) return this;
    if (this.shouldIgnoreSlotPointer(originalEvent)) return this;

    const slotElement = originalEvent.target.closest(SCHEDULER_SELECTORS.slot);
    if (!slotElement || !this.rootElement.contains(slotElement)) return this;

    const slotGroupElement = this.getSlotGroupElement(slotElement);
    if (!slotGroupElement) return this;

    const selectableSlots = this.getSelectableSlotsInGroup(slotGroupElement);
    const slotIndex = selectableSlots.indexOf(slotElement);
    if (slotIndex === -1) return this;

    originalEvent.preventDefault();
    this.clearSelection();

    this.slotSelection = {
      isSelecting: true,
      pointerId: originalEvent.pointerId,
      groupElement: slotGroupElement,
      slots: selectableSlots,
      startIndex: slotIndex,
      endIndex: slotIndex,
      originalEvent
    };

    this.updateSlotRangeSelection(slotIndex);
    document.addEventListener('pointermove', this.boundSlotPointerMove);
    document.addEventListener('pointerup', this.boundSlotPointerUp, { once: true });

    return this;
  }

  /**
   * Extend the active slot selection while the pointer is moving.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {TinyScheduler}
   */
  handleSlotPointerMove(originalEvent) {
    if (!this.slotSelection?.isSelecting) return this;

    const targetElement = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY);
    const slotElement = targetElement?.closest?.(SCHEDULER_SELECTORS.slot);

    if (!slotElement || !this.slotSelection.groupElement.contains(slotElement)) {
      return this;
    }

    const slotIndex = this.slotSelection.slots.indexOf(slotElement);
    if (slotIndex === -1) return this;

    this.updateSlotRangeSelection(slotIndex);
    return this;
  }

  /**
   * Finish the active slot selection and emit select/onSelect.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {TinyScheduler}
   */
  handleSlotPointerUp(originalEvent) {
    if (!this.slotSelection?.isSelecting) return this;

    document.removeEventListener('pointermove', this.boundSlotPointerMove);
    this.slotSelection.isSelecting = false;

    const eventInfo = this.getSelectedSlotRangeInfo(originalEvent);
    this.lastSelectionInfo = eventInfo;

    this._notify('select', eventInfo);

    if (isFn(this.options.select)) {
      this.options.select.call(this, eventInfo);
    }

    return this;
  }



  /**
   * Start resizing a timed event from its bottom edge.
   *
   * @param {HTMLElement} resizeHandle - Bottom resize handle.
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {TinyScheduler}
   */
  startEventResize(resizeHandle, originalEvent) {
    if (this.options.eventResizable === false || originalEvent.button !== 0) return this;

    const eventElement = resizeHandle.closest(SCHEDULER_SELECTORS.event);
    if (!eventElement || !this.rootElement.contains(eventElement)) return this;

    const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
    if (!schedulerEvent || isAllDayEvent(schedulerEvent)) return this;

    const slotGroupElement = eventElement.closest(SCHEDULER_SELECTORS.slotGroup);
    const firstSlotElement = slotGroupElement?.querySelector(SCHEDULER_SELECTORS.slot);
    const eventsLayerElement = eventElement.parentElement;

    if (!slotGroupElement || !firstSlotElement || !eventsLayerElement) return this;

    const slotHeight = firstSlotElement.getBoundingClientRect().height;
    if (!slotHeight) return this;

    const start = parseDateInput(schedulerEvent.start);
    const end = schedulerEvent.end ? parseDateInput(schedulerEvent.end) : addMinutes(start, 60);
    const slotDuration = Number(eventElement.dataset.resizeSlotDuration || this.options.slotDuration || 30);
    const minMinutes = Number(eventElement.dataset.resizeMinMinutes || parseTimeToMinutes(this.options.minTime));
    const maxMinutes = Number(eventElement.dataset.resizeMaxMinutes || parseTimeToMinutes(this.options.maxTime));
    const minDuration = Number(this.options.eventResizeMinDuration || slotDuration);
    const resizeDate = eventElement.dataset.resizeDate
        ? parseDateInput(eventElement.dataset.resizeDate)
        : startOfDay(start);

    originalEvent.preventDefault();
    originalEvent.stopPropagation();

    this.clearSelection();
    this.hideEventActionToolbar();

    this.selectedEventId = schedulerEvent.id;
    this.selectedEventElement = eventElement;

    this.eventResizeState = {
      isResizing: true,
      pointerId: originalEvent.pointerId,
      event: schedulerEvent,
      oldEvent: { ...schedulerEvent },
      eventElement,
      eventsLayerElement,
      start,
      originalEnd: end,
      proposedEnd: end,
      date: resizeDate,
      slotHeight,
      slotDuration,
      minMinutes,
      maxMinutes,
      minDuration
    };

    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected, CLASS_NAMES.calendar.eventResizing);
    document.addEventListener('pointermove', this.boundEventResizePointerMove);
    document.addEventListener('pointerup', this.boundEventResizePointerUp);

    this._notify('eventResizeStart', {
      type: 'event',
      action: 'resizeStart',
      event: schedulerEvent,
      eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Update the resize preview while the pointer is moving.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {TinyScheduler}
   */
  handleEventResizePointerMove(originalEvent) {
    const state = this.eventResizeState;

    if (!state?.isResizing) return this;
    if (state.pointerId !== originalEvent.pointerId) return this;

    originalEvent.preventDefault();

    const proposedEnd = this.getResizeEndFromPointer(state, originalEvent);
    const clampedEnd = this.clampEventResizeEnd(state, proposedEnd);

    if (clampedEnd.getTime() === state.proposedEnd.getTime()) {
      return this;
    }

    state.proposedEnd = clampedEnd;
    this.updateEventResizePreview(state);

    return this;
  }

  /**
   * Finish the resize interaction and apply/revert according to callbacks.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {Promise<TinyScheduler>}
   */
  async handleEventResizePointerUp(originalEvent) {
    const state = this.eventResizeState;

    if (!state?.isResizing) return this;
    if (state.pointerId !== originalEvent.pointerId) return this;

    state.isResizing = false;
    document.removeEventListener('pointermove', this.boundEventResizePointerMove);
    document.removeEventListener('pointerup', this.boundEventResizePointerUp);

    this.ignoreNextClick = true;
    window.setTimeout(() => {
      this.ignoreNextClick = false;
    }, 0);

    state.eventElement.classList.remove(
        CLASS_NAMES.calendar.eventResizing,
        CLASS_NAMES.calendar.eventCollisionPreview
    );

    const didChange = state.proposedEnd.getTime() !== state.originalEnd.getTime();

    if (!didChange) {
      this.eventResizeState = null;
      this.showEventActionToolbar(state.eventElement);
      return this;
    }

    const nextEvent = await this.requestEventChange(
        state.event.id,
        { end: state.proposedEnd },
        'resize',
        originalEvent
    );

    this._notify('eventResizeStop', {
      type: 'event',
      action: 'resizeStop',
      event: nextEvent || this.eventStore.getEventById(state.event.id) || state.event,
      oldEvent: state.oldEvent,
      eventElement: state.eventElement,
      originalEvent
    });

    this.eventResizeState = null;

    return this;
  }

  /**
   * Convert pointer Y position into a snapped event end date.
   *
   * @param {Object} state - Active resize state.
   * @param {PointerEvent} originalEvent - Native pointer event.
   * @returns {Date}
   */
  getResizeEndFromPointer(state, originalEvent) {
    const layerRect = state.eventsLayerElement.getBoundingClientRect();
    const relativeY = originalEvent.clientY - layerRect.top;
    const slotIndex = Math.round(relativeY / state.slotHeight);
    const endMinute = state.minMinutes + slotIndex * state.slotDuration;

    return addMinutes(startOfDay(state.date), endMinute);
  }

  /**
   * Clamp resized end to visible limits and minimum event duration.
   *
   * @param {Object} state - Active resize state.
   * @param {Date} proposedEnd - Proposed snapped end date.
   * @returns {Date}
   */
  clampEventResizeEnd(state, proposedEnd) {
    const minEnd = addMinutes(state.start, state.minDuration);
    const maxEnd = addMinutes(startOfDay(state.date), state.maxMinutes);

    return new Date(Math.min(
        Math.max(proposedEnd.getTime(), minEnd.getTime()),
        maxEnd.getTime()
    ));
  }

  /**
   * Update the event height while resizing without mutating event data yet.
   *
   * @param {Object} state - Active resize state.
   * @returns {TinyScheduler}
   */
  updateEventResizePreview(state) {
    const visibleStart = addMinutes(startOfDay(state.date), state.minMinutes);
    const clampedStart = new Date(Math.max(state.start.getTime(), visibleStart.getTime()));
    const durationMinutes = Math.max(
        state.minDuration,
        Math.round((state.proposedEnd - clampedStart) / 60000)
    );
    const slotSpan = durationMinutes / state.slotDuration;
    const height = Math.max(22, slotSpan * state.slotHeight);

    state.eventElement.style.height = `${Math.round(height)}px`;

    this.updateEventCollisionPreview(
        state.eventElement,
        { ...state.event, end: state.proposedEnd },
        state.event
    );

    return this;
  }

  /**
   * Resize changes are handled by requestEventChange(), exactly like drag/drop moves.
   * This keeps cancellation and backend confirmation behavior identical for both actions.
   */

  /**
   * Prevent slot selection from starting on interactive UI or events.
   *
   * @param {PointerEvent} originalEvent - Native pointer event.
   * @returns {boolean}
   */
  shouldIgnoreSlotPointer(originalEvent) {
    return Boolean(
      originalEvent.target.closest(SCHEDULER_SELECTORS.event)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.moreButton)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.toolbarButton)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.interactive)
    );
  }

  /**
   * Return the nearest slot group. A range selection stays inside one group.
   *
   * @param {HTMLElement} slotElement - Slot element.
   * @returns {HTMLElement|null}
   */
  getSlotGroupElement(slotElement) {
    return slotElement.closest(SCHEDULER_SELECTORS.slotGroup);
  }

  /**
   * Return selectable slots inside one group.
   *
   * @param {HTMLElement} groupElement - Slot group element.
   * @returns {HTMLElement[]}
   */
  getSelectableSlotsInGroup(groupElement) {
    return Array.from(groupElement.querySelectorAll(SCHEDULER_SELECTORS.slot));
  }

  /**
   * Update the visible slot range selection.
   *
   * @param {number} endIndex - Current range end index.
   * @returns {TinyScheduler}
   */
  updateSlotRangeSelection(endIndex) {
    if (!this.slotSelection) return this;

    const { slots, startIndex, groupElement } = this.slotSelection;
    const fromIndex = Math.min(startIndex, endIndex);
    const toIndex = Math.max(startIndex, endIndex);

    this.clearSlotSelectionClasses();
    this.selectedSlotElements = slots.slice(fromIndex, toIndex + 1);

    this.selectedSlotElements.forEach((slotElement, selectedIndex) => {
      slotElement.classList.add(CLASS_NAMES.calendar.slotSelected);

      this.applySlotConnectionClasses({
        slotElement,
        selectedIndex,
        selectedSlots: this.selectedSlotElements,
        groupElement
      });
    });

    this.slotSelection.endIndex = endIndex;

    return this;
  }

  /**
   * Remove all slot selection and connection classes from the active selection.
   *
   * @returns {TinyScheduler}
   */
  clearSlotSelectionClasses() {
    const classesToRemove = [
      CLASS_NAMES.calendar.slotSelected,
      CLASS_NAMES.calendar.slotConnectedTop,
      CLASS_NAMES.calendar.slotConnectedRight,
      CLASS_NAMES.calendar.slotConnectedBottom,
      CLASS_NAMES.calendar.slotConnectedLeft
    ];

    this.selectedSlotElements.forEach(slotElement => {
      slotElement.classList.remove(...classesToRemove);
    });

    return this;
  }

  /**
   * Apply border-connection classes according to the current slot group axis.
   *
   * @param {Object} config - Connection configuration.
   * @param {HTMLElement} config.slotElement - Selected slot.
   * @param {number} config.selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} config.selectedSlots - Selected slots in visual order.
   * @param {HTMLElement} config.groupElement - Slot group element.
   * @returns {TinyScheduler}
   */
  applySlotConnectionClasses({ slotElement, selectedIndex, selectedSlots, groupElement }) {
    const axis = groupElement.dataset.slotGroupAxis || SCHEDULER_SLOT_GROUP_AXES.VERTICAL;

    if (axis === SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL) {
      return this.applyHorizontalSlotConnections(slotElement, selectedIndex, selectedSlots);
    }

    if (axis === SCHEDULER_SLOT_GROUP_AXES.GRID) {
      return this.applyGridSlotConnections(slotElement, selectedIndex, selectedSlots, groupElement);
    }

    return this.applyVerticalSlotConnections(slotElement, selectedIndex, selectedSlots);
  }

  /**
   * Connect vertically stacked slots by removing the internal top/bottom edges.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @returns {TinyScheduler}
   */
  applyVerticalSlotConnections(slotElement, selectedIndex, selectedSlots) {
    if (selectedIndex > 0) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedTop);
    }

    if (selectedIndex < selectedSlots.length - 1) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedBottom);
    }

    return this;
  }

  /**
   * Connect horizontally aligned slots by removing the internal left/right edges.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @returns {TinyScheduler}
   */
  applyHorizontalSlotConnections(slotElement, selectedIndex, selectedSlots) {
    if (selectedIndex > 0) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedLeft);
    }

    if (selectedIndex < selectedSlots.length - 1) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedRight);
    }

    return this;
  }

  /**
   * Connect month-grid slots only when adjacent cells are on the same row.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @param {HTMLElement} groupElement - Slot group element.
   * @returns {TinyScheduler}
   */
  applyGridSlotConnections(slotElement, selectedIndex, selectedSlots, groupElement) {
    const columns = Number(groupElement.dataset.slotGroupColumns || 7);
    const allSlots = this.getSelectableSlotsInGroup(groupElement);
    const currentGlobalIndex = allSlots.indexOf(slotElement);
    const previousSlot = selectedSlots[selectedIndex - 1];
    const nextSlot = selectedSlots[selectedIndex + 1];

    if (previousSlot && this.areGridSlotsOnSameRow(allSlots.indexOf(previousSlot), currentGlobalIndex, columns)) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedLeft);
    }

    if (nextSlot && this.areGridSlotsOnSameRow(allSlots.indexOf(nextSlot), currentGlobalIndex, columns)) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedRight);
    }

    return this;
  }

  /**
   * Check whether two slot indexes belong to the same grid row.
   *
   * @param {number} firstIndex - First slot index.
   * @param {number} secondIndex - Second slot index.
   * @param {number} columns - Number of grid columns.
   * @returns {boolean}
   */
  areGridSlotsOnSameRow(firstIndex, secondIndex, columns) {
    if (firstIndex < 0 || secondIndex < 0) return false;

    return Math.floor(firstIndex / columns) === Math.floor(secondIndex / columns);
  }

  /**
   * Build the select event info from the selected slot range.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {Object}
   */
  getSelectedSlotRangeInfo(originalEvent) {
    const selectedSlots = this.selectedSlotElements;
    const firstSlot = selectedSlots[0];
    const lastSlot = selectedSlots[selectedSlots.length - 1];

    return this.getContext({
      type: 'slot',
      action: 'select',
      start: parseDateInput(firstSlot.dataset.slotStart),
      end: parseDateInput(lastSlot.dataset.slotEnd || lastSlot.dataset.slotStart),
      allDay: firstSlot.dataset.slotAllDay === 'true',
      resourceId: firstSlot.dataset.resourceId || null,
      slotKind: firstSlot.dataset.slotKind,
      slotElement: firstSlot,
      slotElements: selectedSlots,
      originalEvent
    });
  }

  /**
   * Handle event click.
   * First click selects the event and emits eventClick.
   * Second click on the already selected event emits eventEdit only.
   *
   * @param {HTMLElement} eventElement - Clicked event element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @returns {TinyScheduler}
   */
  handleEventClick(eventElement, originalEvent) {
    const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
    if (!schedulerEvent) return this;

    if (this.selectedEventId === schedulerEvent.id) {
      this.emitEventEdit(schedulerEvent, eventElement, originalEvent, 'secondClick');
      return this;
    }

    this.selectEventElement(schedulerEvent, eventElement, originalEvent);
    return this;
  }

  /**
   * Select an event and emit eventClick.
   *
   * @param {Object} schedulerEvent - Scheduler event.
   * @param {HTMLElement} eventElement - Event DOM element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @returns {TinyScheduler}
   */
  selectEventElement(schedulerEvent, eventElement, originalEvent) {
    this.clearSelection();

    this.selectedEventId = schedulerEvent.id;
    this.selectedEventElement = eventElement;

    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected);
    eventElement.focus?.();
    this.showEventActionToolbar(eventElement);
    this.refreshActionToolbarState();

    this._notify('eventClick', {
      type: 'event',
      action: 'select',
      event: schedulerEvent,
      eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Emit eventEdit when the user wants to edit a selected event.
   * This intentionally does not emit eventClick again.
   *
   * @param {Object} schedulerEvent - Scheduler event.
   * @param {HTMLElement} eventElement - Event DOM element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @param {'secondClick'|'keyboard'} reason - Edit trigger reason.
   * @returns {TinyScheduler}
   */
  async emitEventEdit(schedulerEvent, eventElement, originalEvent, reason) {
    const context = this.getContext({
      type: 'event',
      action: 'edit',
      reason,
      event: schedulerEvent,
      eventElement,
      originalEvent,
      updateEvent: updates => this.updateEvent(schedulerEvent.id, updates),
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });

    this._emit('eventEdit', context);

    const result = await this.runActionCallback('onEventEdit', context);

    if (result && isObj(result)) {
      this.updateEvent(schedulerEvent.id, result);
    } else if (result === true) {
      this.redrawEvent(schedulerEvent.id);
    }

    return this;
  }

  /**
   * Clear selected event/slot visual state.
   *
   * @returns {TinyScheduler}
   */
  clearSelection() {
    this.clearSlotSelectionClasses();

    this.selectedEventElement?.classList.remove(CLASS_NAMES.calendar.eventSelected);

    this.selectedSlotElements = [];
    this.selectedEventElement = null;
    this.selectedEventId = null;
    this.slotSelection = null;
    this.hideEventActionToolbar();
    this.refreshActionToolbarState();

    return this;
  }

  /**
   * Restore selected event styling after a redraw.
   *
   * @returns {TinyScheduler}
   */
  /**
   * Restore selected event styling after a redraw.
   *
   * If the selected event is not rendered in the new view/range, the selection
   * is cleared. This prevents the floating toolbar from staying visible after
   * view changes.
   *
   * @returns {TinyScheduler}
   */
  restoreSelectedEventElement() {
    if (!this.selectedEventId) {
      this.hideEventActionToolbar();
      return this;
    }

    const selectedEvent = this.eventStore.getEventById(this.selectedEventId);

    if (!selectedEvent) {
      return this.clearSelectedEventState();
    }

    const elements = this.eventElementsById.get(this.selectedEventId);
    const eventElement = elements ? Array.from(elements).find(element => element.isConnected && this.rootElement.contains(element)) : null;

    if (!eventElement) {
      return this.clearSelectedEventState();
    }

    this.selectedEventElement = eventElement;
    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected);

    this.showEventActionToolbar(eventElement);

    return this;
  }

  /**
   * Execute an optional callback and support promise-based action results.
   *
   * @param {string} callbackName - Option callback name.
   * @param {Object} context - Callback context.
   * @returns {Promise<*>}
   */
  async runActionCallback(callbackName, context) {
    const callback = this.options[callbackName];

    if (!isFn(callback)) {
      return undefined;
    }

    return await callback.call(this, context);
  }

  /**
   * Handle clicks on the floating event action toolbar.
   *
   * Native edit/delete actions keep their historical behavior. Custom actions
   * reuse options.customButtons and receive the selected-event context.
   *
   * @param {HTMLElement} actionElement - Clicked toolbar button.
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {TinyScheduler}
   */
  handleEventActionClick(actionElement, originalEvent) {
    const schedulerEvent = this.selectedEventId
        ? this.eventStore.getEventById(this.selectedEventId)
        : null;

    if (!schedulerEvent || !this.selectedEventElement || actionElement.disabled || actionElement.hidden) {
      return this;
    }

    const action = actionElement.dataset.eventAction;

    if (action === SCHEDULER_EVENT_ACTIONS.EDIT) {
      this.emitEventEdit(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
      return this;
    }

    if (action === SCHEDULER_EVENT_ACTIONS.DELETE) {
      this.emitEventDelete(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
      return this;
    }

    const buttonName = actionElement.dataset.eventActionButton || action;
    const config = this.getEventActionButtonConfig(buttonName);

    if (!config || !isFn(config.action)) {
      return this;
    }

    config.action.call(this, this.getEventActionContext(
        config,
        schedulerEvent,
        this.selectedEventElement,
        actionElement,
        originalEvent
    ));

    return this;
  }

  /**
   * Emit eventDelete and delete the event unless the callback returns false.
   *
   * @param {Object} schedulerEvent - Event to delete.
   * @param {HTMLElement|null} eventElement - Event element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Native event.
   * @param {string} reason - Delete trigger reason.
   * @returns {Promise<TinyScheduler>}
   */
  async emitEventDelete(schedulerEvent, eventElement, originalEvent, reason = 'toolbar') {
    const context = this.getContext({
      type: 'event',
      action: 'delete',
      reason,
      event: schedulerEvent,
      eventElement,
      originalEvent,
      deleteEvent: () => this.deleteEvent(schedulerEvent.id),
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });

    this._emit('eventDelete', context);

    const result = await this.runActionCallback('onEventDelete', context);

    if (result === false) {
      return this;
    }

    this.deleteEvent(schedulerEvent.id);
    return this;
  }

  /**
   * Emit eventAdd from the last selected slot/range.
   * The callback may return a raw event object, or false/null to cancel.
   *
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {Promise<TinyScheduler>}
   */
  async emitEventAdd(originalEvent) {
    const selection = this.lastSelectionInfo || this.getDefaultAddSelection(originalEvent);
    const context = this.getContext({
      type: 'event',
      action: 'add',
      reason: 'toolbar',
      start: selection.start,
      end: selection.end,
      allDay: Boolean(selection.allDay),
      resourceId: selection.resourceId || null,
      slotKind: selection.slotKind || null,
      slotElement: selection.slotElement || null,
      slotElements: selection.slotElements || [],
      originalEvent,
      addEvent: rawEvent => this.addEvent(rawEvent, { originalEvent }),
      refresh: () => this.redraw()
    });

    this._emit('eventAdd', context);

    const result = await this.runActionCallback('onEventAdd', context);

    if (!result || result === false) {
      return this;
    }

    if (isObj(result)) {
      await Promise.resolve(this.addEvent({
        start: context.start,
        end: context.end,
        allDay: context.allDay,
        resourceId: context.resourceId,
        ...result
      }, { originalEvent }));
    } else if (result === true) {
      this.refreshEventDisplay({
        type: 'refresh',
        reason: 'eventAddCallback'
      });
    }

    return this;
  }

  /**
   * Return fallback selection values when the user clicks Add without a slot selection.
   *
   * @param {MouseEvent} originalEvent - Native event.
   * @returns {Object}
   */
  getDefaultAddSelection(originalEvent) {
    const slotDuration = this.options.slotDuration || 30;
    const defaultDuration = this.options.defaultAddEventDuration || slotDuration;
    const selectedDayStart = startOfDay(this.state.currentDate);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    /*
      Use the calendar's selected day, but apply the current clock time.
      The time is rounded up to the next slot.
    */
    const roundedMinutes = Math.ceil(nowMinutes / slotDuration) * slotDuration;

    /*
      Keep the default event inside the selected day.
      Example: at 23h50 with 30 min slots, start remains 23h30 instead of tomorrow 00h00.
    */
    const safeStartMinutes = Math.min(roundedMinutes, 1440 - defaultDuration);

    const start = addMinutes(selectedDayStart, safeStartMinutes);
    const end = addMinutes(start, defaultDuration);

    return this.getContext({
      type: 'slot',
      action: 'select',
      start,
      end,
      allDay: false,
      resourceId: null,
      slotKind: null,
      slotElement: null,
      slotElements: [],
      originalEvent
    });
  }

  /**
   * Delete the currently selected event from the toolbar delete button.
   *
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {TinyScheduler}
   */
  deleteSelectedEvent(originalEvent) {
    const schedulerEvent = this.selectedEventId ? this.eventStore.getEventById(this.selectedEventId) : null;

    if (!schedulerEvent) return this;

    this.emitEventDelete(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
    return this;
  }

  /**
   * Return the configured event-action button names in display order.
   *
   * The floating toolbar deliberately reuses options.customButtons for custom
   * definitions instead of maintaining a second custom-button registry.
   *
   * @returns {string[]}
   */
  getEventActionButtonNames() {
    return Array.isArray(this.options.eventActionToolbarButtons)
        ? this.options.eventActionToolbarButtons
        : ['editEvent', 'deleteEvent'];
  }

  /**
   * Resolve one floating event-action button definition.
   *
   * editEvent/deleteEvent are built in. Every other name is resolved through
   * options.customButtons so one custom definition can be reused by toolbars.
   *
   * @param {string} name - Configured button name.
   * @returns {Object|null}
   */
  getEventActionButtonConfig(name) {
    if (name === 'editEvent') {
      return {
        name,
        eventAction: SCHEDULER_EVENT_ACTIONS.EDIT,
        iconHtml: this.getToolbarIconHtml('editEvent'),
        tooltip: this._getTooltip('editEvent', 'Edit event'),
        ariaLabel: this._getTooltip('editEvent', 'Edit event')
      };
    }

    if (name === 'deleteEvent') {
      return {
        name,
        eventAction: SCHEDULER_EVENT_ACTIONS.DELETE,
        iconHtml: this.getToolbarIconHtml('deleteEvent'),
        tooltip: this._getTooltip('deleteEvent', 'Delete event'),
        ariaLabel: this._getTooltip('deleteEvent', 'Delete event'),
        danger: true
      };
    }

    const customButton = this.getCustomButtonConfig(name);

    if (!customButton) {
      return null;
    }

    return {
      ...customButton,
      eventAction: name,
      tooltip: customButton.tooltip || customButton.ariaLabel || customButton.text || name,
      ariaLabel: customButton.ariaLabel || customButton.tooltip || customButton.text || name
    };
  }

  /**
   * Build the context shared by custom event-action state callbacks and clicks.
   *
   * @param {Object} config - Normalized event-action button config.
   * @param {Object} schedulerEvent - Selected scheduler event.
   * @param {HTMLElement|null} eventElement - Selected event element.
   * @param {HTMLElement|null} actionElement - Floating toolbar button.
   * @param {Event|null} originalEvent - Native event when available.
   * @returns {Object}
   */
  getEventActionContext(config, schedulerEvent, eventElement, actionElement = null, originalEvent = null) {
    return this.getContext({
      type: 'event',
      action: config.eventAction,
      reason: 'toolbar',
      buttonName: config.name,
      button: config,
      event: schedulerEvent,
      eventElement,
      actionElement,
      originalEvent,
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });
  }

  /**
   * Create the floating event action toolbar once per scheduler instance.
   *
   * @returns {HTMLElement}
   */
  ensureEventActionToolbar() {
    if (this.eventActionToolbar) return this.eventActionToolbar;

    const toolbar = this.createElement('div', CLASS_NAMES.calendar.eventActionToolbar, '', {
      attrs: {
        hidden: ''
      }
    });

    this.getEventActionButtonNames().forEach(name => {
      const config = this.getEventActionButtonConfig(name);

      if (config) {
        toolbar.append(this.createEventActionButton(config));
      }
    });

    this.rootElement.append(toolbar);
    this.eventActionToolbar = toolbar;

    return toolbar;
  }

  /**
   * Create one icon-first event action button.
   *
   * @param {Object} config - Normalized event-action button config.
   * @returns {HTMLButtonElement}
   */
  createEventActionButton(config) {
    const normalizedIconHtml = this.normalizeToolbarIconHtml(config.iconHtml || config.svg || '');
    const label = config.ariaLabel || config.tooltip || config.text || config.name;
    const iconType = normalizedIconHtml ? this.getToolbarIconType(normalizedIconHtml) : 'text';
    const button = this.createElement(
        'button',
        classNames(
            CLASS_NAMES.calendar.eventActionButton,
            `tsh-event-action-button--${iconType}`,
            config.danger && CLASS_NAMES.calendar.eventActionButtonDanger,
            config.className
        ),
        normalizedIconHtml ? '' : (config.icon || config.text || ''),
        {
          html: normalizedIconHtml || undefined,
          props: {
            type: 'button'
          },
          dataset: {
            eventAction: config.eventAction,
            eventActionButton: config.name,
            tooltip: config.tooltip || label
          },
          attrs: {
            'aria-label': label
          }
        }
    );

    return button;
  }

  /**
   * Re-evaluate visible/hidden/disabled custom state for the selected event.
   *
   * State callbacks receive the same event context as the action callback.
   *
   * @returns {TinyScheduler}
   */
  refreshEventActionToolbarState() {
    if (!this.eventActionToolbar) {
      return this;
    }

    const schedulerEvent = this.selectedEventId
        ? this.eventStore.getEventById(this.selectedEventId)
        : null;

    this.eventActionToolbar.querySelectorAll(SCHEDULER_SELECTORS.eventAction).forEach(button => {
      const buttonName = button.dataset.eventActionButton || button.dataset.eventAction;
      const config = this.getEventActionButtonConfig(buttonName);

      if (!schedulerEvent || !this.selectedEventElement || !config) {
        button.hidden = true;
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        return;
      }

      const context = this.getEventActionContext(
          config,
          schedulerEvent,
          this.selectedEventElement,
          button
      );

      const isVisible = isFn(config.visible)
          ? config.visible.call(this, context) !== false
          : config.visible !== false;
      const isHidden = isFn(config.hidden)
          ? Boolean(config.hidden.call(this, context))
          : Boolean(config.hidden);
      const isDisabled = isFn(config.disabled)
          ? Boolean(config.disabled.call(this, context))
          : Boolean(config.disabled);

      button.hidden = !isVisible || isHidden;
      button.disabled = isDisabled;
      button.setAttribute('aria-disabled', String(isDisabled));
    });

    return this;
  }

  /**
   * Rebuild the floating event action toolbar after custom-button changes.
   *
   * @returns {TinyScheduler}
   */
  refreshEventActionToolbar() {
    if (!this.eventActionToolbar) {
      return this;
    }

    this.eventActionToolbar.remove();
    this.eventActionToolbar = null;

    if (this.selectedEventElement?.isConnected && this.options.eventActionToolbar !== false) {
      this.showEventActionToolbar(this.selectedEventElement);
    }

    return this;
  }

  getEventActionToolbarContainer(eventElement) {
    return eventElement.closest(`.${CLASS_NAMES.calendar.scrollContainer}`)
        || this.rootElement;
  }

  /**
   * Show and position the floating event action toolbar.
   *
   * @param {HTMLElement} eventElement - Selected event element.
   * @returns {TinyScheduler}
   */
  showEventActionToolbar(eventElement) {
    if (this.options.eventActionToolbar === false) {
      return this;
    }

    const toolbar = this.ensureEventActionToolbar();

    this.refreshEventActionToolbarState();

    const hasVisibleAction = Array.from(toolbar.children).some(button => !button.hidden);

    if (!hasVisibleAction) {
      toolbar.hidden = true;
      return this;
    }

    const toolbarContainer = this.getEventActionToolbarContainer(eventElement);

    // Store the active scroll container directly on the toolbar.
    // This avoids resolving closest() again during scroll/resize positioning.
    toolbar._tshContainer = toolbarContainer;

    if (toolbar.parentElement !== toolbarContainer) {
      toolbarContainer.append(toolbar);
    }

    toolbar.hidden = false;
    this.positionEventActionToolbar(eventElement);

    return this;
  }

  /**
   * Clear only the selected event state.
   *
   * Slot selection has its own lifecycle. Event selection is tied to rendered DOM,
   * so it must be reset when the view changes or when the selected event disappears.
   *
   * @returns {TinyScheduler}
   */
  clearSelectedEventState() {
    if (this.selectedEventElement?.isConnected) {
      this.selectedEventElement.classList.remove(CLASS_NAMES.calendar.eventSelected);
    }

    this.selectedEventElement = null;
    this.selectedEventId = null;

    this.hideEventActionToolbar();
    this.refreshActionToolbarState();

    return this;
  }

  /**
   * Hide the floating event action toolbar and reset its active container.
   *
   * The toolbar can be moved into a scroll container while an event is selected.
   * When the view changes, that container may be destroyed, so we move the toolbar
   * back to the scheduler root to avoid stale positioning.
   *
   * @returns {TinyScheduler}
   */
  hideEventActionToolbar() {
    if (!this.eventActionToolbar) {
      return this;
    }

    this.eventActionToolbar.hidden = true;
    this.eventActionToolbar._tshContainer = null;

    this.eventActionToolbar.style.left = '';
    this.eventActionToolbar.style.top = '';
    this.eventActionToolbar.style.transform = '';

    if (
        this.rootElement
        && this.rootElement.isConnected
        && this.eventActionToolbar.parentElement !== this.rootElement
    ) {
      this.rootElement.append(this.eventActionToolbar);
    }

    return this;
  }

  /**
   * Position the floating toolbar relative to the scheduler root.
   *
   * @param {HTMLElement} eventElement - Selected event element.
   * @returns {TinyScheduler}
   */
  positionEventActionToolbar(eventElement) {
    if (!this.eventActionToolbar || !eventElement) return this;

    const toolbar = this.eventActionToolbar;
    const container = toolbar._tshContainer || this.rootElement;

    const containerRect = container.getBoundingClientRect();
    const eventRect = eventElement.getBoundingClientRect();

    const toolbarWidth = toolbar.offsetWidth || 58;
    const toolbarHeight = toolbar.offsetHeight || 32;

    const offset = this.options.eventActionToolbarOffset ?? 6;
    const verticalAlign = this.options.eventActionToolbarVerticalAlign || 'top';

    const isEventVisible =
        eventRect.bottom > containerRect.top
        && eventRect.top < containerRect.bottom
        && eventRect.right > containerRect.left
        && eventRect.left < containerRect.right;

    if (!isEventVisible) {
      toolbar.hidden = true;
      return this;
    }

    toolbar.hidden = false;

    const scrollLeft = container === this.rootElement ? 0 : container.scrollLeft;
    const scrollTop = container === this.rootElement ? 0 : container.scrollTop;

    const eventLeft = eventRect.left - containerRect.left + scrollLeft;
    const eventTop = eventRect.top - containerRect.top + scrollTop;

    const visibleLeft = scrollLeft;
    const visibleRight = scrollLeft + container.clientWidth;
    const visibleTop = scrollTop;
    const visibleBottom = scrollTop + container.clientHeight;

    const leftOutside = eventLeft + eventRect.width + offset;
    const leftInside = eventLeft + Math.max(4, eventRect.width - toolbarWidth - 4);

    let left = leftOutside + toolbarWidth <= visibleRight
        ? leftOutside
        : leftInside;

    let top = verticalAlign === 'top'
        ? eventTop + 4
        : eventTop + eventRect.height / 2 - toolbarHeight / 2;

    left = Math.min(
        Math.max(left, visibleLeft + 4),
        visibleRight - toolbarWidth - 4
    );

    top = Math.min(
        Math.max(top, visibleTop + 4),
        visibleBottom - toolbarHeight - 4
    );

    toolbar.style.left = `${Math.round(left)}px`;
    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.transform = 'none';

    return this;
  }

  /**
   * Reposition the floating event toolbar after scroll/resize/redraw.
   *
   * @returns {TinyScheduler}
   */
  /**
   * Reposition the floating event toolbar after scroll/resize/redraw.
   *
   * @returns {TinyScheduler}
   */
  updateEventActionToolbarPosition() {
    if (
        !this.eventActionToolbar
        || this.eventActionToolbar.hidden
        || !this.selectedEventElement
        || !this.selectedEventElement.isConnected
        || !this.rootElement.contains(this.selectedEventElement)
    ) {
      this.hideEventActionToolbar();
      return this;
    }

    requestAnimationFrame(() => {
      if (
          this.selectedEventElement
          && this.selectedEventElement.isConnected
          && this.rootElement.contains(this.selectedEventElement)
      ) {
        this.positionEventActionToolbar(this.selectedEventElement);
      } else {
        this.hideEventActionToolbar();
      }
    });

    return this;
  }

  /**
   * Keep action toolbar buttons in sync with event selection state.
   *
   * @returns {TinyScheduler}
   */
  refreshActionToolbarState() {
    const deleteButton = this.rootElement.querySelector(`[data-tsh-button="${SCHEDULER_TOOLBAR_BUTTONS.DELETE_EVENT}"]`);

    if (deleteButton) {
      deleteButton.disabled = !this.selectedEventId;
      deleteButton.setAttribute('aria-disabled', String(!this.selectedEventId));
    }

    this.refreshEventActionToolbarState();
    this.updateEventActionToolbarPosition();

    return this;
  }

  /**
   * Execute toolbar button behavior.
   *
   * @param {string} name - Button name.
   * @param {MouseEvent} originalEvent - Click event.
   */
  handleToolbarButton(name, originalEvent) {
    const config = this.getToolbarButtonConfig(name);

    this._notify('toolbarButtonClick', {
      buttonName: name,
      button: config,
      originalEvent
    });

    if (name === 'planning') {
      this.setPlanningView(this.state.planningType || SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID, this.state.planningRange || SCHEDULER_VIEW_NAMES.DAY);
    } else if (config.type === 'view') {
      this.setView(name);
    } else if (name === 'prev') {
      this.prev();
    } else if (name === 'next') {
      this.next();
    } else if (name === 'today') {
      this.today();
    } else if (name === 'prevYear') {
      this.prevYear();
    } else if (name === 'nextYear') {
      this.nextYear();
    } else if (name === SCHEDULER_TOOLBAR_BUTTONS.ADD_EVENT) {
      this.emitEventAdd(originalEvent);
    } else if (name === SCHEDULER_TOOLBAR_BUTTONS.DELETE_EVENT) {
      this.deleteSelectedEvent(originalEvent);
    } else if (isFn(config.action)) {
      config.action.call(this, this.getContext({ buttonName: name, button: config, originalEvent }));
    }
  }

  toggleResource(resourceId) {
    if (this.state.collapsedResources.has(resourceId)) {
      this.state.collapsedResources.delete(resourceId);
    } else {
      this.state.collapsedResources.add(resourceId);
    }

    this.redrawPreservingScroll();
  }

  /**
   * Navigate relatively according to the current view.
   *
   * @param {number} amount - Positive or negative navigation amount.
   * @returns {TinyScheduler}
   */
  navigate(amount) {
    const type = this.getViewType(this.state.currentView);

    if (type === 'month') {
      this.state.currentDate = addMonths(this.state.currentDate, amount);
    } else if (this.isPlanningView()) {
      this.navigatePlanningView(amount);
    } else if (this.state.currentView.includes('Week') || this.state.currentView === 'week') {
      this.state.currentDate = addDays(this.state.currentDate, amount * 7);
    } else {
      this.state.currentDate = addDays(this.state.currentDate, amount);
    }

    this._notify('dateChanged');
    this.refresh();

    return this;
  }

  /**
   * Navigate planning view according to its current range.
   *
   * @param {number} amount - Positive or negative navigation amount.
   */
  navigatePlanningView(amount) {
    if (this.state.planningRange === 'month') {
      this.state.currentDate = addMonths(this.state.currentDate, amount);
    } else if (this.state.planningRange === 'week') {
      this.state.currentDate = addDays(this.state.currentDate, amount * 7);
    } else {
      this.state.currentDate = addDays(this.state.currentDate, amount);
    }
  }

  next() {
    return this.navigate(1);
  }

  prev() {
    return this.navigate(-1);
  }

  prevYear() {
    this.state.currentDate = addYears(this.state.currentDate, -1);
    this.refresh();
    return this;
  }

  nextYear() {
    this.state.currentDate = addYears(this.state.currentDate, 1);
    this.refresh();
    return this;
  }

  today() {
    this.gotoDate(new Date());
    return this;
  }

  gotoDate(date, options = {}) {
    this.state.currentDate = parseDateInput(date);
    this._notify('dateChanged');

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  /**
   * Persist the current calendar view state.
   *
   * Only view/planning state is saved.
   */
  persistViewState() {
    CalendarStateStorage.setViewState(this.state);

    return this;
  }

  setView(viewName) {
    const resolvedView = resolveViewName(viewName);

    if (!VIEW_CLASSES[resolvedView.view]) {
      throw new Error(`Unsupported view: ${viewName}`);
    }

    const previousView = this.state.currentView;
    const previousPlanningType = this.state.planningType;
    const previousPlanningRange = this.state.planningRange;

    if (resolvedView.planningType) {
      this.state.planningType = resolvedView.planningType;
    }

    if (resolvedView.planningRange) {
      this.state.planningRange = normalizePlanningRange(this.state.planningType, resolvedView.planningRange);
    }

    const viewDidNotChange = this.state.currentView === resolvedView.view
        && previousPlanningType === this.state.planningType
        && previousPlanningRange === this.state.planningRange;

    if (viewDidNotChange) {
      return this;
    }

    this.state.currentView = resolvedView.view;

    this.persistViewState();

    this._notify('viewChanged', {
      previousView,
      view: this.state.currentView,
      previousPlanningType,
      planningType: this.state.planningType,
      previousPlanningRange,
      planningRange: this.state.planningRange
    });

    this.refresh();

    return this;
  }

  setPlanningView(type = SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID, range = SCHEDULER_VIEW_NAMES.DAY) {
    this.setPlanningType(type, { refresh: false });
    this.setPlanningRange(range, { refresh: false });

    this.state.currentView = getPlanningViewName(this.state.planningType);

    this._notify('viewChanged', {
      view: this.state.currentView,
      planningType: this.state.planningType,
      planningRange: this.state.planningRange
    });

    this.refresh();

    return this;
  }

  setPlanningType(type, options = {}) {
    if (!SCHEDULER_PLANNING_TYPES.includes(type)) {
      throw new Error(`Invalid planning type: ${type}`);
    }

    const previousPlanningType = this.state.planningType;

    this.state.planningType = type;
    this.state.planningRange = normalizePlanningRange(type, this.state.planningRange);
    this.state.currentView = getPlanningViewName(type);

    this.persistViewState();

    this._notify('planningTypeChanged', {
      previousPlanningType,
      planningType: type,
      planningRange: this.state.planningRange
    });

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  setPlanningRange(range, options = {}) {
    if (!SCHEDULER_PLANNING_RANGES.includes(range)) {
      throw new Error(`Invalid planning range: ${range}`);
    }

    if (this.state.planningType === SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID && range === SCHEDULER_VIEW_NAMES.MONTH) {
      return this;
    }

    const previousPlanningRange = this.state.planningRange;
    this.state.planningRange = range;

    this.persistViewState();

    this._notify('planningRangeChanged', {
      previousPlanningRange,
      planningRange: range,
      planningType: this.state.planningType
    });

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  getPlanningType() {
    return this.state.planningType;
  }

  getPlanningRange() {
    return this.state.planningRange;
  }

  isPlanningView() {
    return isPlanningViewName(this.state.currentView);
  }

  isPlanningType(type) {
    return this.state.planningType === type;
  }

  isPlanningRange(range) {
    return this.state.planningRange === range;
  }

  getView() {
    return this.state.currentView;
  }

  isView(viewName) {
    const resolvedView = resolveViewName(viewName);
    return this.state.currentView === resolvedView.view;
  }

  isViewType(viewType) {
    return this.getViewType(this.state.currentView) === viewType;
  }

  getDate() {
    return new Date(this.state.currentDate);
  }

  setEvents(events) {
    this.sourceManager.setEventSources([events]);
    this.refresh();
    return this;
  }

  /**
   * Return the normalized resource ids carried by an event.
   *
   * @param {Object} event - Normalized or raw event.
   * @returns {string[]}
   */
  getEventResourceIds(event) {
    if (!event) return [];

    if (Array.isArray(event.resourceIds) && event.resourceIds.length) {
      return event.resourceIds
          .filter(resourceId => !isNil(resourceId) && resourceId !== '')
          .map(resourceId => String(resourceId));
    }

    return !isNil(event.resourceId) && event.resourceId !== ''
        ? [String(event.resourceId)]
        : [];
  }

  /**
   * Return the effective end date used for conflict checks.
   * Missing timed event ends are treated like the rendered default duration.
   *
   * @param {Object} event - Normalized or raw event.
   * @returns {Date}
   */
  getEventConflictStart(event) {
    const start = parseDateInput(event.start);

    return event?.allDay ? startOfDay(start) : start;
  }

  getEventConflictEnd(event) {
    const start = this.getEventConflictStart(event);

    if (event?.allDay) {
      if (event.end) {
        const end = startOfDay(parseDateInput(event.end));
        return end > start ? end : addDays(start, 1);
      }

      return addDays(start, 1);
    }

    if (event.end) {
      const end = parseDateInput(event.end);
      return end > start ? end : start;
    }

    return addMinutes(start, Number(this.options.slotDuration || 60));
  }

  /**
   * Return true when the current view is resource-based.
   *
   * @returns {boolean}
   */
  isResourceView() {
    return this.state.currentView === SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID
        || this.state.currentView === SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE;
  }

  /**
   * Return true when an event overlaps another event on the same resource.
   *
   * @param {Object} proposedEvent - Proposed/current event.
   * @param {Object|null} oldEvent - Same event before mutation, used to ignore itself.
   * @returns {boolean}
   */
  hasResourceConflict(proposedEvent, oldEvent = null) {
    if (!proposedEvent) return false;

    const proposedResourceIds = this.getEventResourceIds(proposedEvent);

    if (!proposedResourceIds.length) {
      return false;
    }

    return this.getEvents().some(candidateEvent => {
      if (!candidateEvent) return false;

      if (oldEvent && String(candidateEvent.id) === String(oldEvent.id)) {
        return false;
      }

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const hasSharedResource = proposedResourceIds.some(resourceId => (
        candidateResourceIds.includes(resourceId)
      ));

      return hasSharedResource && Boolean(this.getEventOverlap(proposedEvent, candidateEvent));
    });
  }

  /**
   * Return whether an event is the later participant of a resource collision.
   * The earliest event stays unchanged; every overlapping event that starts
   * afterwards receives the persistent collision style. Equal starts use the
   * stable EventStore order as a deterministic tie-breaker.
   *
   * @param {string|number} eventId - Event id.
   * @returns {boolean}
   */
  isEventMarkedCollision(eventId) {
    if (!this.isResourceView()) return false;

    const events = this.getEvents();
    const eventIndex = events.findIndex(event => String(event?.id) === String(eventId));

    if (eventIndex === -1) return false;

    const event = events[eventIndex];
    const eventResourceIds = this.getEventResourceIds(event);

    if (!eventResourceIds.length) return false;

    const eventStart = this.getEventConflictStart(event).getTime();

    return events.some((candidateEvent, candidateIndex) => {
      if (!candidateEvent || candidateIndex === eventIndex) return false;

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const hasSharedResource = eventResourceIds.some(resourceId => (
        candidateResourceIds.includes(resourceId)
      ));

      if (!hasSharedResource || !this.getEventOverlap(event, candidateEvent)) {
        return false;
      }

      const candidateStart = this.getEventConflictStart(candidateEvent).getTime();

      return candidateStart < eventStart
          || (candidateStart === eventStart && candidateIndex < eventIndex);
    });
  }

  /**
   * Toggle live collision feedback on a drag/resize preview element.
   *
   * @param {HTMLElement|null} element - Event or drag mirror element.
   * @param {Object} proposedEvent - Proposed event state.
   * @param {Object|null} oldEvent - Original event state.
   * @returns {boolean}
   */
  updateEventCollisionPreview(element, proposedEvent, oldEvent = null) {
    const hasCollision = Boolean(
      element
      && this.isResourceView()
      && this.hasResourceConflict(proposedEvent, oldEvent)
    );

    element?.classList.toggle(
        CLASS_NAMES.calendar.eventCollisionPreview,
        hasCollision
    );

    return hasCollision;
  }

  /**
   * Return overlap details between two events, or null when they do not overlap.
   * End dates are exclusive, matching the scheduler rendering model.
   *
   * @param {Object} firstEvent - Proposed event.
   * @param {Object} secondEvent - Existing event.
   * @returns {Object|null}
   */
  getEventOverlap(firstEvent, secondEvent) {
    const firstStart = this.getEventConflictStart(firstEvent);
    const firstEnd = this.getEventConflictEnd(firstEvent);
    const secondStart = this.getEventConflictStart(secondEvent);
    const secondEnd = this.getEventConflictEnd(secondEvent);

    const overlapStartTime = Math.max(firstStart.getTime(), secondStart.getTime());
    const overlapEndTime = Math.min(firstEnd.getTime(), secondEnd.getTime());
    const overlapDurationMs = overlapEndTime - overlapStartTime;

    if (overlapDurationMs <= 0) {
      return null;
    }

    return {
      overlapStart: new Date(overlapStartTime),
      overlapEnd: new Date(overlapEndTime),
      overlapDurationMs,
      overlapMinutes: Math.round(overlapDurationMs / 60000)
    };
  }

  /**
   * Find conflicts for a proposed event.
   * Default scope is resource-only; scope 'all' also reports non-resource overlaps.
   *
   * @param {Object} proposedEvent - Event to add/move.
   * @param {Object|null} oldEvent - Previous event when moving.
   * @returns {Object[]}
   */
  findEventConflicts(proposedEvent, oldEvent = null) {
    const scope = this.options.eventConflictScope || 'resource';

    if (scope === false || scope === 'none') {
      return [];
    }

    const proposedResourceIds = this.getEventResourceIds(proposedEvent);

    return this.getEvents().reduce((conflicts, candidateEvent) => {
      if (!candidateEvent) return conflicts;

      if (oldEvent && String(candidateEvent.id) === String(oldEvent.id)) {
        return conflicts;
      }

      const overlap = this.getEventOverlap(proposedEvent, candidateEvent);

      if (!overlap) {
        return conflicts;
      }

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const resourceIds = proposedResourceIds.filter(resourceId => candidateResourceIds.includes(resourceId));
      const isResourceConflict = resourceIds.length > 0;

      if (!isResourceConflict && scope !== 'all') {
        return conflicts;
      }

      const resourceId = resourceIds[0] || proposedResourceIds[0] || candidateResourceIds[0] || null;

      conflicts.push({
        proposedEvent,
        event: proposedEvent,
        conflictEvent: candidateEvent,
        isResourceConflict,
        resourceId,
        resourceIds,
        resource: resourceId ? this.resourceStore.getResourceById(resourceId) : null,
        ...overlap
      });

      return conflicts;
    }, []);
  }

  /**
   * Run the conflict callback when needed.
   * Returning false or Promise<false> cancels the operation.
   * Any other value allows it.
   *
   * @param {Object} config - Conflict resolution config.
   * @returns {boolean|Promise<boolean>}
   */
  resolveEventConflict(config) {
    const conflicts = this.findEventConflicts(config.proposedEvent, config.oldEvent || null);

    if (!conflicts.length) {
      return true;
    }

    const firstConflict = conflicts[0];
    const callback = isFn(this.options.onEventConflict)
        ? this.options.onEventConflict
        : (firstConflict.isResourceConflict && isFn(this.options.onResourceConflict) ? this.options.onResourceConflict : null);

    if (!callback) {
      return true;
    }

    const context = this.getContext({
      type: 'event',
      action: 'conflict',
      operation: config.operation,
      event: config.proposedEvent,
      proposedEvent: config.proposedEvent,
      oldEvent: config.oldEvent || null,
      updates: config.updates || null,
      conflictEvent: firstConflict.conflictEvent,
      conflicts,
      isResourceConflict: firstConflict.isResourceConflict,
      resourceId: firstConflict.resourceId,
      resourceIds: firstConflict.resourceIds,
      resource: firstConflict.resource,
      overlapStart: firstConflict.overlapStart,
      overlapEnd: firstConflict.overlapEnd,
      overlapDurationMs: firstConflict.overlapDurationMs,
      overlapMinutes: firstConflict.overlapMinutes,
      originalEvent: config.originalEvent || null
    });

    this._emit('eventConflict', context);

    try {
      const result = callback.call(this, context);

      if (result && isFn(result.then)) {
        return result.then(value => value !== false).catch(error => {
          this._notify('eventConflictError', {
            error,
            event: config.proposedEvent,
            proposedEvent: config.proposedEvent,
            oldEvent: config.oldEvent || null,
            conflictEvent: firstConflict.conflictEvent,
            conflicts,
            operation: config.operation,
            originalEvent: config.originalEvent || null
          });

          return false;
        });
      }

      return result !== false;
    } catch (error) {
      this._notify('eventConflictError', {
        error,
        event: config.proposedEvent,
        proposedEvent: config.proposedEvent,
        oldEvent: config.oldEvent || null,
        conflictEvent: firstConflict.conflictEvent,
        conflicts,
        operation: config.operation,
        originalEvent: config.originalEvent || null
      });

      return false;
    }
  }

  /**
   * Apply an add after conflict resolution.
   *
   * @param {Object} event - Normalized event to add.
   * @param {Object} options - Add options.
   * @returns {Object}
   */
  applyEventAdd(event, options = {}) {
    this.eventStore.addEvent(event);
    this._notify('eventAdded', { event, originalEvent: options.originalEvent || null });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'add',
      eventId: event.id,
      event,
      oldEvent: null,
      originalEvent: options.originalEvent || null
    });

    return event;
  }

  addEvent(rawEvent, options = {}) {
    const transformedEvent = isFn(this.options.eventTransform)
        ? this.options.eventTransform(rawEvent, {
          index: this.eventStore.getEvents().length,
          range: this.state.visibleRange,
          source: null,
          sourceId: null,
          calendar: this
        })
        : rawEvent;

    if (!transformedEvent) return null;

    const event = normalizeEvent({
      id: transformedEvent.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...transformedEvent
    }, null, this.options);

    if (!event) return null;

    const canApply = this.resolveEventConflict({
      operation: 'add',
      proposedEvent: event,
      oldEvent: null,
      updates: null,
      originalEvent: options.originalEvent || null
    });

    if (canApply && isFn(canApply.then)) {
      return canApply.then(allowed => {
        if (!allowed) {
          this._notify('eventAddCancelled', {
            event,
            proposedEvent: event,
            reason: 'conflict',
            originalEvent: options.originalEvent || null
          });

          return null;
        }

        return this.applyEventAdd(event, options);
      });
    }

    if (!canApply) {
      this._notify('eventAddCancelled', {
        event,
        proposedEvent: event,
        reason: 'conflict',
        originalEvent: options.originalEvent || null
      });

      return null;
    }

    return this.applyEventAdd(event, options);
  }

  updateEvent(eventId, updates) {
    const oldEvent = this.eventStore.getEventById(eventId);

    if (!oldEvent) return null;

    const event = this.eventStore.updateEvent(eventId, updates);

    if (!event) return null;

    this._notify('eventUpdated', { event, oldEvent });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'update',
      eventId: event.id,
      event,
      oldEvent,
      updates
    });

    return event;
  }

  /**
   * Create the small public payload used by onEventChange/onEventMove/onEventResize.
   *
   * event is the current/original event. nextEvent is the proposed event that
   * TinyScheduler will apply only when the callback does not return false.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} event - Current event before mutation.
   * @param {Object} nextEvent - Proposed event after mutation.
   * @returns {{ action: string, event: Object, nextEvent: Object, view: string }}
   */
  createEventChangeInfo(action, event, nextEvent) {
    return {
      action,
      event: { ...event },
      nextEvent: { ...nextEvent },
      view: this.state.currentView
    };
  }

  /**
   * Return the user callback for one schedule change.
   * onEventChange is the preferred general hook. onEventMove/onEventResize are
   * kept as simple backward-compatible aliases and receive the same payload.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @returns {Function|null}
   */
  getEventChangeCallback(action) {
    if (isFn(this.options.onEventChange)) {
      return this.options.onEventChange;
    }

    if (action === 'move' && isFn(this.options.onEventMove)) {
      return this.options.onEventMove;
    }

    if (action === 'resize' && isFn(this.options.onEventResize)) {
      return this.options.onEventResize;
    }

    return null;
  }

  /**
   * Run the optional cancellable schedule-change callback.
   * false or Promise<false> cancels the change. Any other value accepts it.
   *
   * @param {Object} changeInfo - Small public schedule-change payload.
   * @returns {*|Promise<*>}
   */
  runEventChangeCallback(changeInfo) {
    this._emit('eventChange', changeInfo);
    this._emit(changeInfo.action === 'resize' ? 'eventResize' : 'eventMove', changeInfo);

    const callback = this.getEventChangeCallback(changeInfo.action);

    if (!callback) {
      return undefined;
    }

    try {
      return callback.call(this, changeInfo);
    } catch (error) {
      this._notify('eventChangeError', {
        action: changeInfo.action,
        reason: 'callback',
        error,
        event: changeInfo.event,
        nextEvent: changeInfo.nextEvent
      });

      return false;
    }
  }

  /**
   * Support legacy callback results that return a partial update object.
   * The preferred callback return is boolean/undefined.
   *
   * @param {*} result - Callback result.
   * @param {Object} updates - Original proposed updates.
   * @returns {Object}
   */
  getEventChangeUpdatesFromCallbackResult(result, updates) {
    return result && isObj(result) ? { ...updates, ...result } : updates;
  }

  /**
   * Cancel a pending move/resize and redraw the original event position.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} event - Current/original event.
   * @param {Object} nextEvent - Rejected proposed event.
   * @param {string} reason - Cancel reason.
   * @param {Event|null} originalEvent - Native event.
   * @returns {null}
   */
  cancelEventChange(action, event, nextEvent, reason = 'callback', originalEvent = null) {
    const payload = {
      action,
      reason,
      event,
      nextEvent,
      originalEvent
    };

    this._notify('eventChangeCancelled', payload);
    this._notify(action === 'resize' ? 'eventResizeCancelled' : 'eventMoveCancelled', payload);
    this.redrawEvent(event.id);

    return null;
  }

  /**
   * Apply a validated move/resize to the event store and refresh the display.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} oldEvent - Event before mutation.
   * @param {Object} updates - Final updates to apply.
   * @param {Event|null} originalEvent - Native event.
   * @returns {Object|null}
   */
  applyEventChange(action, oldEvent, updates, originalEvent = null) {
    const event = this.eventStore.updateEvent(oldEvent.id, updates);

    if (!event) return null;

    this._notify('eventChanged', { action, event, oldEvent, originalEvent });

    if (action === 'move') {
      this._notify('eventMoved', { event, oldEvent, originalEvent });
    } else if (action === 'resize') {
      this._notify('eventResized', { event, oldEvent, originalEvent });
    }

    this._notify('eventUpdated', { event, oldEvent });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: action,
      eventId: event.id,
      event,
      oldEvent,
      updates,
      originalEvent
    });

    return event;
  }

  /**
   * Request one schedule change.
   * Conflicts and the user callback are resolved before the store is mutated.
   *
   * @param {string|number} eventId - Event id.
   * @param {Object} updates - Proposed updates.
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Event|null} originalEvent - Native event.
   * @returns {Object|null|Promise<Object|null>}
   */
  requestEventChange(eventId, updates, action = 'move', originalEvent = null) {
    const oldEvent = this.eventStore.getEventById(eventId);

    if (!oldEvent) return null;

    const proposedEvent = normalizeEvent({
      ...oldEvent.raw,
      ...oldEvent,
      ...updates,
      id: oldEvent.id
    }, { id: oldEvent.sourceId }, this.options);

    if (!proposedEvent) return null;

    const applyAfterCallback = callbackResult => {
      if (callbackResult === false) {
        return this.cancelEventChange(action, oldEvent, proposedEvent, 'callback', originalEvent);
      }

      return this.applyEventChange(
          action,
          oldEvent,
          this.getEventChangeUpdatesFromCallbackResult(callbackResult, updates),
          originalEvent
      );
    };

    const runCallback = () => {
      const changeInfo = this.createEventChangeInfo(action, oldEvent, proposedEvent);
      const callbackResult = this.runEventChangeCallback(changeInfo);

      if (callbackResult && isFn(callbackResult.then)) {
        return callbackResult
            .then(applyAfterCallback)
            .catch(error => {
              this._notify('eventChangeError', {
                action,
                reason: 'callback',
                error,
                event: oldEvent,
                nextEvent: proposedEvent,
                originalEvent
              });

              return this.cancelEventChange(action, oldEvent, proposedEvent, 'error', originalEvent);
            });
      }

      return applyAfterCallback(callbackResult);
    };

    const canApply = this.resolveEventConflict({
      operation: action,
      proposedEvent,
      oldEvent,
      updates,
      originalEvent
    });

    if (canApply && isFn(canApply.then)) {
      return canApply.then(allowed => {
        if (!allowed) {
          return this.cancelEventChange(action, oldEvent, proposedEvent, 'conflict', originalEvent);
        }

        return runCallback();
      });
    }

    if (!canApply) {
      return this.cancelEventChange(action, oldEvent, proposedEvent, 'conflict', originalEvent);
    }

    return runCallback();
  }

  moveEvent(eventId, updates, originalEvent = null) {
    return this.requestEventChange(eventId, updates, 'move', originalEvent);
  }

  deleteEvent(eventId) {
    const event = this.eventStore.deleteEvent(eventId);

    if (!event) return null;


    if (this.selectedEventId === String(eventId)) {
      this.clearSelection();
    }

    this._notify('eventDeleted', { event });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'delete',
      eventId: String(eventId),
      event: null,
      oldEvent: event
    });

    return event;
  }

  removeEvent(eventId) {
    return this.deleteEvent(eventId);
  }

  getEvents() {
    return this.eventStore.getEvents();
  }

  getEventsForDate(date) {
    return this.eventStore.getEventsForDate(date);
  }

  getEventsInRange(start, end) {
    return this.eventStore.getEventsInRange(start, end);
  }

  getEventsByDate() {
    return this.eventStore.getEventsByDate();
  }

  setEventSources(sources) {
    this.sourceManager.setEventSources(sources);
    this.refresh();
    return this;
  }

  addEventSource(source) {
    this.sourceManager.addEventSource(source);
    this.refresh();
    return this;
  }

  removeEventSource(sourceId) {
    this.sourceManager.removeEventSource(sourceId);
    this.refresh();
    return this;
  }

  getEventSources() {
    return this.sourceManager.getEventSources();
  }

  refetchEvents() {
    return this.refresh();
  }

  refetchEventSource(sourceId) {
    return this.refresh();
  }

  ensureEventsLoaded(start, end) {
    return this.refresh();
  }

  setResources(resources) {
    this.sourceManager.setResourceSources([resources]);
    this.refresh();
    return this;
  }

  addResource(resource) {
    const normalized = this.resourceStore.addResource(resource);

    this._notify('resourceAdded', { resource: normalized });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return normalized;
  }

  updateResource(resourceId, updates) {
    const resource = this.resourceStore.updateResource(resourceId, updates);

    this._notify('resourceUpdated', { resource });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return resource;
  }

  deleteResource(resourceId) {
    const resource = this.resourceStore.deleteResource(resourceId);

    this._notify('resourceDeleted', { resource });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return resource;
  }

  removeResource(resourceId) {
    return this.deleteResource(resourceId);
  }

  getResources() {
    return this.resourceStore.getResources();
  }

  setResourceSources(sources) {
    this.sourceManager.setResourceSources(sources);
    this.refresh();
    return this;
  }

  addResourceSource(source) {
    this.sourceManager.addResourceSource(source);
    this.refresh();
    return this;
  }

  removeResourceSource(sourceId) {
    this.sourceManager.removeResourceSource(sourceId);
    this.refresh();
    return this;
  }

  getResourceSources() {
    return this.sourceManager.getResourceSources();
  }

  refetchResources() {
    return this.refresh();
  }

  async searchEvents(query, options = {}) {
    this.state.searchQuery = query || '';
    this._notify('searchStart', { query });

    let events;

    if (this.options.searchEvents && options.useServerSearch !== false) {
      events = await this.options.searchEvents({ query });
    } else {
      events = this.getEvents().filter(event => {
        return matchesEventSearch(
            event,
            query,
            this.resourceStore.getResourceById(event.resourceId),
            options
        );
      });
    }

    this._notify('searchEnd', { query, events });

    return events;
  }

  clearSearch() {
    this.state.searchQuery = '';
    this._notify('searchCleared');
    return this;
  }

  getSearchQuery() {
    return this.state.searchQuery;
  }

  setToolbar(toolbarConfig) {
    this.options.toolbar = toolbarConfig;
    this.refreshToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  getToolbar() {
    return this.options.toolbar;
  }

  setCustomButtons(customButtons) {
    this.options.customButtons = customButtons || {};
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  addCustomButton(name, buttonConfig) {
    this.options.customButtons[name] = buttonConfig;
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  removeCustomButton(name) {
    delete this.options.customButtons[name];
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  getCustomButtons() {
    return { ...this.options.customButtons };
  }


  /**
   * Return the first rendered event element for a given event id.
   *
   * A single event can have multiple DOM nodes, for example in month popovers.
   * This helper returns the first connected element inside this scheduler root.
   *
   * @param {string|number} eventId - Event id.
   * @returns {HTMLElement|null}
   */
  getRenderedEventElementById(eventId) {
    const normalizedEventId = String(eventId);
    const elements = this.eventElementsById.get(normalizedEventId) || this.eventElementsById.get(eventId);

    if (elements) {
      const element = Array.from(elements).find(candidate => {
        return candidate.isConnected && this.rootElement.contains(candidate);
      });

      if (element) return element;
    }

    return this.rootElement.querySelector(`[data-event-id="${this.escapeCssValue(normalizedEventId)}"]`);
  }

  /**
   * Select a rendered event by id and optionally scroll it into view.
   *
   * This is useful for external UI such as a frame sidebar event list. It does
   * not fetch data. It only works when the event is already rendered in the
   * current view/range.
   *
   * @param {string|number} eventId - Event id.
   * @param {Object} options - Selection options.
   * @param {boolean} options.scroll - Scroll selected event into view. Default true.
   * @param {Event|null} options.originalEvent - Original UI event, if any.
   * @returns {boolean} True when an event was found and selected.
   */
  selectEventById(eventId, options = {}) {
    const schedulerEvent = this.eventStore.getEventById(eventId) || this.eventStore.getEventById(String(eventId));
    const eventElement = this.getRenderedEventElementById(eventId);

    if (!schedulerEvent || !eventElement) {
      return false;
    }

    this.selectEventElement(schedulerEvent, eventElement, options.originalEvent || null);

    if (options.scroll !== false) {
      this.scrollElementIntoViewContainer(eventElement);
    }

    return true;
  }

  /**
   * Schedule auto-scroll after the current redraw cycle.
   *
   * @param {Date|string} date - Target date.
   * @returns {TinyScheduler}
   */
  scheduleAutoScrollToDate(date) {
    if (!this.options.autoScroll) return this;

    requestAnimationFrame(() => {
      this.scrollToDate(date);
    });

    return this;
  }

  /**
   * Scroll the current view to the best event/slot for a date.
   *
   * @param {Date|string} date - Target date.
   * @returns {TinyScheduler}
   */
  scrollToDate(date) {
    const targetDate = parseDateInput(date);

    if (this.options.autoScrollTarget === 'firstEvent') {
      const eventElement = this.getFirstEventElementOnDate(targetDate);

      if (eventElement) {
        return this.scrollElementIntoViewContainer(eventElement);
      }
    }

    const slotElement = this.getBestSlotElementForDate(targetDate);

    if (slotElement) {
      this.scrollElementIntoViewContainer(slotElement);
    }

    return this;
  }

  /**
   * Return the first rendered non-all-day event for a date.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getFirstEventElementOnDate(date) {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);
    const events = this.eventStore
        .getEventsInRange(dayStart, dayEnd)
        .filter(event => isEventOnDate(event, date))
        .sort((firstEvent, secondEvent) => {
          return Number(isAllDayEvent(firstEvent)) - Number(isAllDayEvent(secondEvent))
              || firstEvent.start - secondEvent.start;
        });

    for (const event of events) {
      const eventElement = this.rootElement.querySelector(`[data-event-id="${this.escapeCssValue(event.id)}"]`);
      if (eventElement) return eventElement;
    }

    return null;
  }

  /**
   * Return the best fallback slot for a target date.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getBestSlotElementForDate(date) {
    const dateKey = formatDateKey(date);

    if (this.options.autoScrollTarget === 'currentTime' && isSameDay(date, new Date())) {
      const currentSlot = this.getCurrentTimeSlotElement(date);
      if (currentSlot) return currentSlot;
    }

    return this.rootElement.querySelector(`${SCHEDULER_SELECTORS.slot}[data-slot-start^="${dateKey}"]`);
  }

  /**
   * Return the slot containing the current time.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getCurrentTimeSlotElement(date) {
    const now = new Date();
    if (!isSameDay(date, now)) return null;

    const slots = Array.from(this.rootElement.querySelectorAll(`${SCHEDULER_SELECTORS.slot}[data-slot-start^="${formatDateKey(date)}"]`));
    if (!slots.length) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return slots.find(slot => {
      const slotStart = parseDateInput(slot.dataset.slotStart);
      const slotEnd = parseDateInput(slot.dataset.slotEnd || slot.dataset.slotStart);
      const startMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
      const endMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes();

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }) || slots[0];
  }

  /**
   * Scroll an element inside the nearest scheduler scroll container.
   *
   * @param {HTMLElement} element - Element to reveal.
   * @returns {TinyScheduler}
   */
  scrollElementIntoViewContainer(element) {
    const scrollContainer = element.closest(`.${CLASS_NAMES.calendar.scrollContainer}`);

    if (!scrollContainer) {
      element.scrollIntoView({
        behavior: this.options.autoScrollBehavior,
        block: this.options.autoScrollBlock,
        inline: this.options.autoScrollInline
      });

      return this;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const topOffset = elementRect.top - containerRect.top;
    const leftOffset = elementRect.left - containerRect.left;

    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + topOffset - containerRect.height / 3,
      left: scrollContainer.scrollLeft + leftOffset - containerRect.width / 3,
      behavior: this.options.autoScrollBehavior
    });

    return this;
  }

  /**
   * Escape values used in querySelector attribute selectors.
   *
   * @param {string|number} value - Raw value.
   * @returns {string}
   */
  escapeCssValue(value) {
    if (typeof CSS !== 'undefined' && isFn(CSS.escape)) {
      return CSS.escape(String(value));
    }

    return String(value).replace(/"/g, '\"');
  }

  /**
   * Destroy the component and release DOM/listener references.
   *
   * @returns {TinyScheduler}
   */
  destroy() {
    this._notify('beforeDestroy');

    this.clearNowIndicatorTimer();
    this.closeMorePopover();
    this._unmountViewEvents();
    this.activeView?.destroy();
    this.interactionManager?.destroy();
    this.unbindRootEvents();

    this.eventActionToolbar?.remove();
    this.eventActionToolbar = null;
    this.eventResizeState = null;
    this.nowIndicatorTimer = null;
    this.ignoreNextClick = false;
    this.rootElement.innerHTML = '';
    this.activeView = null;
    this.viewHost = null;

    this._notify('destroy');

    return this;
  }
}

/**
 * TinyMiniCalendar
 * ----------------
 * Small vanilla JS month calendar used by the TinyScheduler sidebar.
 *
 * Responsibilities:
 * - Render a compact month grid.
 * - Display wrong-month background ranges with rounded start/end.
 * - Display event markers without loading data itself.
 * - Emit simple lifecycle and selection events.
 *
 * Data rule:
 * TinyMiniCalendar never fetches events. It only renders events passed by
 * TinyScheduler / TinySchedulerFrame through setEvents().
 */
/**
 * Local class name registry used only by TinyMiniCalendar.
 */
const TMC_CLASS_NAMES = Object.freeze({
    root: 'tiny-mini-calendar',
    header: 'tmc-header',
    month: 'tmc-month',
    year: 'tmc-year',
    grid: 'tmc-grid',
    day: 'tmc-day',
    today: 'tmc-day--today',
    selected: 'tmc-day--selected',
    wrongMonth: 'tmc-day--wrong-month',
    hasEvent: 'tmc-day--has-event',
    eventDots: 'tmc-event-dots',
    eventDot: 'tmc-event-dot',
    allDayBars: 'tmc-all-day-bars',
    allDayBar: 'tmc-all-day-bar',

    slideLeft: 'tmc--slide-left',
    slideRight: 'tmc--slide-right',

    weekday: 'tmc-weekday',
    dayCell: 'tmc-day-cell',
    dayCellWrongMonth: 'tmc-day-cell--wrong-month',
    dayCellWrongMonthStartRadius: 'tmc-day-cell--wrong-month-start-radius',
    dayCellWrongMonthEndRadius: 'tmc-day-cell--wrong-month-end-radius',
    dayEvents: 'tmc-day-events'
});

/**
 * Static SVG icons used by TinyMiniCalendar navigation.
 */
const TMC_ICONS = Object.freeze({
    next: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m8 4 8 8-8 8"></path>
    </svg>
`,

    previous: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m16 4-8 8 8 8"></path>
    </svg>
`
});

class TinyMiniCalendar extends MicroEvent {
    constructor(target, options = {}) {
        super();

        this.classes = TMC_CLASS_NAMES;
        this.rootElement = isStr(target) ? document.querySelector(target) : target;

        if (!this.rootElement) {
            throw new Error('TinyMiniCalendar target element was not found.');
        }

        this.options = mergeDeep({
            initialDate: new Date(),
            displayYear: true,
            firstDay: 1,
            fixedStartDay: true,
            useShortDays: true,
            showTodayButton: true,
            showWrongMonthDays: true,
            displayEvents: true,
            showEventDots: true,
            showAllDayBars: true,
            maxDotsPerDay: 10,
            maxBarsPerDay: 4,
            locale: GLOBAL_CONFIG.locale || 'en'
        }, options);

        this.currentDate = parseDateInput(this.options.initialDate);
        this.events = [];

        // Bind once so listeners can be removed safely in destroy().
        this.boundClick = event => this.handleClick(event);
        this.boundKeyDown = event => this.handleKeyDown(event);
    }

    /**
     * Create an element using the shared DOM helper.
     *
     * @param {string} tagName - HTML tag name.
     * @param {string} className - Optional class string.
     * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
     * @param {Object} options - DOM options.
     * @returns {HTMLElement}
     */
    createElement(tagName, className = '', content = '', options = {}) {
        return createDomElement(tagName, className, content, options);
    }

    /**
     * Mount the mini calendar and render the initial month.
     */
    render() {
        this.rootElement.className = this.classes.root;
        this.rootElement.addEventListener('click', this.boundClick);
        this.rootElement.addEventListener('keydown', this.boundKeyDown);

        this.redraw();
        this._emit('init', {calendar: this});

        return this;
    }

    /**
     * Fully remove listeners and DOM content.
     */
    destroy() {
        this.rootElement.removeEventListener('click', this.boundClick);
        this.rootElement.removeEventListener('keydown', this.boundKeyDown);
        this.rootElement.innerHTML = '';

        this._emit('destroy', {calendar: this});

        return this;
    }

    setDate(date) {
        this.currentDate = parseDateInput(date);
        this.redraw();

        return this;
    }

    getDate() {
        return new Date(this.currentDate);
    }

    /**
     * Change visible month.
     * The optional direction controls the slide animation.
     */
    setMonth(date, direction = null) {
        const newDate = parseDateInput(date);
        const previousDate = new Date(this.currentDate);

        this.currentDate.setFullYear(newDate.getFullYear(), newDate.getMonth(), 1);

        // Keep the original jQuery mini-calendar feeling: month changes slide horizontally.
        const resolvedDirection = direction || (this.currentDate > previousDate ? 'left' : 'right');

        this.redraw(resolvedDirection);
        this._emit('monthChanged', {
            month: this.currentDate.getMonth(),
            year: this.currentDate.getFullYear(),
            date: this.getDate(),
            direction: resolvedDirection
        });

        return this;
    }

    previousMonth() {
        this.setMonth(addMonths(this.currentDate, -1), 'right');

        return this;
    }

    nextMonth() {
        this.setMonth(addMonths(this.currentDate, 1), 'left');

        return this;
    }

    today() {
        this.setDate(new Date());

        return this;
    }

    /**
     * Replace already-loaded events.
     * This component does not fetch events by itself.
     */
    setEvents(events) {
        this.events = Array.isArray(events) ? events : [];
        this.redraw();

        return this;
    }

    getEvents() {
        return this.events.slice();
    }

    refresh() {
        return this.redraw();
    }

    /**
     * Re-render the complete mini calendar.
     *
     * This is small enough to redraw fully. It keeps the implementation simple and
     * avoids diffing overhead for a tiny 6-row month grid.
     */
    redraw(direction = null) {
        this._emit('redrawStart', {calendar: this});

        this.rootElement.innerHTML = '';
        this.rootElement.classList.remove(this.classes.slideLeft, this.classes.slideRight);

        if (direction) {
            // Restart the CSS animation. This single layout read is acceptable because
            // month changes are infrequent and the mini calendar is tiny.
            void this.rootElement.offsetWidth;
            this.rootElement.classList.add(direction === 'right' ? this.classes.slideRight : this.classes.slideLeft);
        }

        const headerElement = this.createHeader();
        const gridElement = this.createGrid();

        this.rootElement.append(headerElement, gridElement);
        this._emit('redrawEnd', {calendar: this});

        return this;
    }

    /**
     * Create the month header with previous/next actions.
     */
    createHeader() {
        const headerElement = this.createElement('div');
        headerElement.className = this.classes.header;

        const previousButton = this.createNavigationButton({
            action: 'prev',
            icon: TMC_ICONS.previous,
            ariaLabel: 'Previous month'
        });

        const nextButton = this.createNavigationButton({
            action: 'next',
            icon: TMC_ICONS.next,
            ariaLabel: 'Next month'
        });

        const titleElement = this.createTitleElement();

        headerElement.append(previousButton, titleElement, nextButton);

        return headerElement;
    }

    createNavigationButton({action, icon, ariaLabel}) {
        const button = this.createElement('button');

        button.type = 'button';
        button.dataset.miniAction = action;
        button.setAttribute('aria-label', ariaLabel);

        // Safe because the SVG is static and owned by the component.
        button.innerHTML = icon;

        return button;
    }

    createTitleElement() {
        const titleElement = this.createElement('div');
        const monthLabel = new Intl.DateTimeFormat(this.options.locale, {
            month: 'long'
        }).format(this.currentDate);

        titleElement.innerHTML = `
            <strong class="${this.classes.month}">${monthLabel}</strong>
            ${this.options.displayYear ? `<span class="${this.classes.year}">${this.currentDate.getFullYear()}</span>` : ''}
        `;

        return titleElement;
    }

    /**
     * Create the grid including weekday headers and day cells.
     */
    createGrid() {
        const gridElement = this.createElement('div');

        gridElement.className = this.classes.grid;

        this.appendWeekdayLabels(gridElement);
        this.appendDayCells(gridElement);

        return gridElement;
    }

    /**
     * Render weekday labels according to firstDay and locale.
     */
    appendWeekdayLabels(gridElement) {
        const weekStart = startOfWeek(new Date(), this.options.firstDay);

        for (let index = 0; index < 7; index += 1) {
            const day = addDays(weekStart, index);
            const labelElement = this.createElement('div');

            labelElement.className = this.classes.weekday;
            labelElement.textContent = new Intl.DateTimeFormat(this.options.locale, {
                weekday: this.options.useShortDays ? 'narrow' : 'short'
            }).format(day);

            gridElement.append(labelElement);
        }
    }

    /**
     * Render visible day cells.
     *
     * DOM structure:
     * .tmc-day-cell = continuous wrong-month background.
     * .tmc-day      = circular clickable day value.
     * .tmc-day-events = bars/dots rendered below the day value.
     */
    appendDayCells(gridElement) {
        const visibleRange = this.getVisibleRange();
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        const isCurrentMonthDate = date => date.getMonth() === currentMonth && date.getFullYear() === currentYear;

        let dayIndex = 0;

        for (
            let day = new Date(visibleRange.start);
            day < visibleRange.end;
            day = addDays(day, 1), dayIndex += 1
        ) {
            const dateKey = formatDateKey(day);
            const columnIndex = dayIndex % 7;
            const dayEvents = this.getEventsForDay(day);
            const isWrongMonth = !isCurrentMonthDate(day);

            // Only add rounding classes when the wrong-month group does not touch
            // the row border. This creates a continuous background between cells.
            const shouldRoundStart = isWrongMonth && columnIndex !== 0 && isCurrentMonthDate(addDays(day, -1));
            const shouldRoundEnd = isWrongMonth && columnIndex !== 6 && isCurrentMonthDate(addDays(day, 1));

            const dayCell = this.createDayCell({
                dateKey,
                isWrongMonth,
                shouldRoundStart,
                shouldRoundEnd
            });

            const dayElement = this.createDayElement({
                day,
                dateKey,
                isWrongMonth,
                dayEvents
            });

            const dayEventsElement = this.createDayEventsElement(dayEvents);

            dayCell.append(dayElement, dayEventsElement);
            this.mountDayCell(gridElement, dayCell, dayElement, day, dayEvents);
        }
    }

    getVisibleRange() {
        const monthStart = startOfMonth(this.currentDate);
        const monthEnd = endOfMonth(this.currentDate);

        return {
            start: startOfWeek(monthStart, this.options.firstDay),
            end: endOfWeek(monthEnd, this.options.firstDay)
        };
    }

    getEventsForDay(day) {
        return this.events.filter(event => isEventOnDate(event, day));
    }

    /**
     * Create the outer cell responsible for continuous wrong-month background.
     */
    createDayCell({dateKey, isWrongMonth, shouldRoundStart, shouldRoundEnd}) {
        const dayCell = this.createElement('div');

        dayCell.dataset.date = dateKey;
        dayCell.className = classNames(
            this.classes.dayCell,
            isWrongMonth && this.classes.dayCellWrongMonth,
            shouldRoundStart && this.classes.dayCellWrongMonthStartRadius,
            shouldRoundEnd && this.classes.dayCellWrongMonthEndRadius
        );

        return dayCell;
    }

    /**
     * Create the clickable day value.
     *
     * It is a div, not a button, because the project uses div-based event/day
     * elements and handles keyboard activation manually.
     */
    createDayElement({day, dateKey, isWrongMonth, dayEvents}) {
        const dayElement = this.createElement('div');

        dayElement.dataset.date = dateKey;
        dayElement.setAttribute('role', 'button');
        dayElement.tabIndex = 0;
        dayElement.textContent = day.getDate();
        dayElement.className = classNames(
            this.classes.day,
            isSameDay(day, new Date()) && this.classes.today,
            isSameDay(day, this.currentDate) && this.classes.selected,
            isWrongMonth && this.classes.wrongMonth,
            dayEvents.length && this.classes.hasEvent
        );

        return dayElement;
    }

    /**
     * Create the event marker wrapper for one day.
     */
    createDayEventsElement(dayEvents) {
        const eventsElement = this.createElement('div');

        eventsElement.className = this.classes.dayEvents;

        if (!this.options.displayEvents || !dayEvents.length) {
            return eventsElement;
        }

        const allDayEvents = dayEvents.filter(isAllDayEvent);
        const timedEvents = dayEvents.filter(event => !isAllDayEvent(event));

        if (this.options.showAllDayBars && allDayEvents.length) {
            eventsElement.append(this.createEventMarkers({
                events: allDayEvents,
                wrapperClassName: this.classes.allDayBars,
                markerClassName: this.classes.allDayBar,
                limit: this.options.maxBarsPerDay
            }));
        }

        if (this.options.showEventDots && timedEvents.length) {
            const visibleAllDayEvents = Math.min(timedEvents.length,this.options.maxDotsPerDay);
            if (visibleAllDayEvents>5) eventsElement.classList.add('markers-sm');
            if (visibleAllDayEvents>10) eventsElement.classList.add('markers-xs');
            eventsElement.append(this.createEventMarkers({
                events: timedEvents,
                wrapperClassName: this.classes.eventDots,
                markerClassName: this.classes.eventDot,
                limit: this.options.maxDotsPerDay
            }));
        }

        return eventsElement;
    }

    /**
     * Create dot/bar markers.
     *
     * Only backgroundColor is set inline. The CSS variable was removed because the
     * marker color does not need two different inline color sources.
     */
    createEventMarkers({events, wrapperClassName, markerClassName, limit}) {
        const wrapper = this.createElement('div');

        wrapper.className = wrapperClassName;

        events.slice(0, limit).forEach(event => {
            const marker = this.createElement('span');

            marker.className = markerClassName;
            marker.style.backgroundColor = getEventDisplayColor(event, this.options);

            wrapper.append(marker);
        });

        return wrapper;
    }

    /**
     * Append a day cell and run optional extension hooks.
     */
    mountDayCell(gridElement, dayCell, dayElement, day, dayEvents) {
        const context = {
            el: dayElement,
            cell: dayCell,
            date: new Date(day),
            events: dayEvents
        };

        if (isFn(this.options.onDayDidMount)) {
            this.options.onDayDidMount(context);
        }

        this._emit('dayDidMount', context);
        gridElement.append(dayCell);
    }

    /**
     * Select a date and emit the external callback + MicroEvent event.
     */
    selectDate(date) {
        const selectedDate = parseDateInput(date);
        const events = this.getEventsForDay(selectedDate);
        const context = {
            date: selectedDate,
            events,
            calendar: this
        };

        this.currentDate = selectedDate;
        this.redraw();

        if (isFn(this.options.onDateSelected)) {
            this.options.onDateSelected(context);
        }

        this._emit('dateSelected', context);
    }

    handleClick(event) {
        const action = event.target.closest('[data-mini-action]')?.dataset.miniAction;

        if (action === 'prev') return this.previousMonth();
        if (action === 'next') return this.nextMonth();

        const dateElement = event.target.closest(`.${this.classes.day}[data-date]`);
        if (dateElement) this.selectDate(dateElement.dataset.date);
    }

    handleKeyDown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        const dateElement = event.target.closest(`.${this.classes.day}[data-date]`);
        if (!dateElement) return;

        event.preventDefault();
        this.selectDate(dateElement.dataset.date);
    }
}

/**
 * TinySchedulerSidebar
 * -------------------
 * Sidebar companion for TinySchedulerFrame.
 *
 * Responsibilities:
 * - Own the sidebar UI state: open / collapsed.
 * - Render the mini calendar.
 * - Render a global event search input.
 * - Render a selected-day or search-result event list.
 * - Emit sidebar events without directly mutating the main calendar.
 */
class TinySchedulerSidebar extends MicroEvent {
  /**
   * @param {string|HTMLElement} target - Sidebar root element or selector.
   * @param {Object} options - Sidebar options.
   */
  constructor(target, options = {}) {
    super();

    this.rootElement = isStr(target) ? document.querySelector(target) : target;

    if (!this.rootElement) {
      throw new Error('TinySchedulerSidebar target element was not found.');
    }

    this.options = options;
    this.events = [];
    this.resources = [];
    this.selectedDate = parseDateInput(options.initialDate);
    this.searchQuery = '';

    /*
      The sidebar owns its own visual state.
      State classes are applied to the real <aside>, not to the frame root.
    */
    this.stateElement =
      options.stateElement ||
      this.rootElement.closest(`.${CLASS_NAMES.frame.sidebar}`) ||
      this.rootElement;

    this.overlayElement = options.overlayElement || null;

    this.state = {
      isOpen: false,
      isCollapsed: options.initiallyCollapsed === true
    };

    this.boundSearchInput = () => this.handleSearchInput();
    this.boundListClick = event => this.handleListClick(event);
    this.boundOverlayClick = () => this.close();
  }

  /**
   * Create an element with the shared project DOM helper.
   *
   * @param {string} tagName - HTML tag name.
   * @param {string} className - Optional class string.
   * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
   * @param {Object} options - DOM options.
   * @returns {HTMLElement}
   */
  createElement(tagName, className = '', content = '', options = {}) {
    return createDomElement(tagName, className, content, options);
  }

  /**
   * Return a localized sidebar label.
   *
   * @param {string} key - Label key.
   * @param {string} fallback - Fallback value.
   * @returns {string}
   */
  getLabel(key, fallback = '') {
    return this.options.labels?.[key]
        || GLOBAL_CONFIG.labels?.[key]
        || fallback
        || key;
  }

  /**
   * Return a localized tooltip.
   *
   * @param {string} key - Tooltip key.
   * @param {string} fallback - Fallback value.
   * @returns {string}
   */
  getTooltip(key, fallback = '') {
    return this.options.tooltips?.[key]
        || GLOBAL_CONFIG.tooltips?.[key]
        || this.getLabel(key, fallback);
  }

  /**
   * Return a localized aria label.
   *
   * @param {string} key - Aria key.
   * @param {string} fallback - Fallback value.
   * @returns {string}
   */
  getAria(key, fallback = '') {
    return this.options.aria?.[key]
        || GLOBAL_CONFIG.aria?.[key]
        || fallback
        || key;
  }

  /**
   * Return true when the sidebar is currently opened as an overlay/state.
   *
   * @returns {boolean}
   */
  isOpen() {
    return this.state.isOpen;
  }

  /**
   * Return true when the sidebar is collapsed.
   *
   * @returns {boolean}
   */
  isCollapsed() {
    return this.state.isCollapsed;
  }

  /**
   * Detect the mobile overlay layout.
   *
   * On desktop, a non-collapsed sidebar is visible by default.
   * On mobile, the sidebar is visually hidden unless it has the open state.
   *
   * @returns {boolean}
   */
  isMobileLayout() {
    return root.matchMedia?.('(max-width: 760px)').matches === true;
  }

  /**
   * Open the sidebar and apply state classes to the sidebar element.
   *
   * @returns {TinySchedulerSidebar}
   */
  open() {
    this.state.isOpen = true;
    this.state.isCollapsed = false;
    this.syncStateClasses();

    this._emit('opened', {
      sidebar: this,
      isOpen: this.isOpen(),
      isCollapsed: this.isCollapsed()
    });

    return this;
  }

  /**
   * Close/collapse the sidebar.
   *
   * @returns {TinySchedulerSidebar}
   */
  close() {
    this.state.isOpen = false;
    this.state.isCollapsed = true;
    this.syncStateClasses();

    this._emit('closed', {
      sidebar: this,
      isOpen: this.isOpen(),
      isCollapsed: this.isCollapsed()
    });

    return this;
  }

  /**
   * Toggle the sidebar.
   *
   * Desktop:
   * - visible default sidebar closes on first toggle.
   *
   * Mobile:
   * - hidden overlay sidebar opens on first toggle.
   *
   * @returns Boolean
   */
  toggle() {
    if (this.isOpen()) {
      this.close();
    } else if (this.isMobileLayout() || this.isCollapsed()) {
      this.open();
    } else {
      this.close();
    }

    this._emit('toggled', {
      sidebar: this,
      isOpen: this.isOpen(),
      isCollapsed: this.isCollapsed()
    });

    return this.isCollapsed();
  }

  /**
   * Sync open/collapsed classes on the sidebar element.
   *
   * @returns {TinySchedulerSidebar}
   */
  syncStateClasses() {
    if (!this.stateElement) return this;

    this.stateElement.classList.toggle(
      CLASS_NAMES.frame.sidebarOpen,
      this.state.isOpen
    );

    this.stateElement.classList.toggle(
      CLASS_NAMES.frame.sidebarCollapsed,
      this.state.isCollapsed
    );

    return this;
  }

  /**
   * Render the sidebar shell and child components.
   *
   * @returns {TinySchedulerSidebar}
   */
  render() {
    this.rootElement.classList.add(CLASS_NAMES.frame.sidebar);
    this.rootElement.innerHTML = '';

    const miniCalendarHost = this.createElement('div', CLASS_NAMES.frame.miniCalendar);
    const searchWrapper = this.createSearchWrapper();
    const eventList = this.createElement('div', CLASS_NAMES.frame.eventList);

    this.rootElement.append(miniCalendarHost, searchWrapper, eventList);

    this.searchInput = searchWrapper.querySelector('input');
    this.listElement = eventList;

    this.searchInput.addEventListener('input', this.boundSearchInput);
    this.listElement.addEventListener('click', this.boundListClick);

    if (this.overlayElement) {
      this.overlayElement.removeEventListener('click', this.boundOverlayClick);
      this.overlayElement.addEventListener('click', this.boundOverlayClick);
    }

    this.renderMiniCalendar(miniCalendarHost);
    this.renderList();
    this.syncStateClasses();

    return this;
  }

  /**
   * Create the search input wrapper.
   *
   * @returns {HTMLElement}
   */
  createSearchWrapper() {
    const input = this.createElement('input', '', '', {
      props: {
        type: 'search',
        value: this.searchQuery
      },
      attrs: {
        placeholder: this.options.searchPlaceholder || this.getLabel('searchPlaceholder', 'Search...')
      }
    });

    return this.createElement('div', CLASS_NAMES.frame.search, [input]);
  }

  /**
   * Mount the mini calendar and wire its date selection event.
   *
   * @param {HTMLElement} target - Mini calendar mount point.
   */
  renderMiniCalendar(target) {
    this.miniCalendar = new TinyMiniCalendar(target, {
      initialDate: this.selectedDate,
      locale: this.options.locale || GLOBAL_CONFIG.locale || 'en',
      firstDay: this.options.firstDay ?? GLOBAL_CONFIG.firstDay ?? 0
    });

    this.miniCalendar.on('dateSelected', context => {
      const hadSearch = this.searchQuery !== '';
      this.selectedDate = context.date;
      this.searchQuery = '';

      if (this.searchInput) {
        this.searchInput.value = '';
      }

      this.renderList();
      // Programmatic search clears must notify the same listeners as user input.
      if (hadSearch) this._emit('searchChanged', { query: this.searchQuery });

      /*
        On mobile, the sidebar behaves as an overlay.
        Close it after selecting a date, unless explicitly disabled.
      */
      if (this.options.closeOnDateSelected !== false && this.isOpen()) {
        this.close();
      }

      this._emit('dateSelected', context);
    });

    this.miniCalendar.on('monthChanged', context => {
      this._emit('miniCalendarRangeChanged', {
        ...context,
        range: this.getMiniCalendarVisibleRange()
      });
    });

    this.miniCalendar.render();
  }

  /**
   * Return the mini-calendar visible range with an exclusive end date.
   *
   * TinyMiniCalendar returns the last visible day as an end-of-day value. Data
   * sources expect the usual calendar convention: start inclusive, end exclusive.
   *
   * @returns {{start: Date, end: Date}|null}
   */
  getMiniCalendarVisibleRange() {
    const visibleRange = this.miniCalendar?.getVisibleRange?.();

    if (!visibleRange) {
      return null;
    }

    return {
      start: startOfDay(visibleRange.start),
      end: addDays(startOfDay(visibleRange.end), 1)
    };
  }

  /**
   * Replace sidebar events and refresh dependent UI.
   *
   * @param {Array<Object>} events - Normalized calendar events.
   * @returns {TinySchedulerSidebar}
   */
  setEvents(events) {
    this.events = Array.isArray(events) ? events : [];
    this.miniCalendar?.setEvents(this.events);
    this.renderList();

    return this;
  }

  /**
   * Replace sidebar resources and refresh the event list.
   *
   * @param {Array<Object>} resources - Normalized resources.
   * @returns {TinySchedulerSidebar}
   */
  setResources(resources) {
    this.resources = Array.isArray(resources) ? resources : [];
    this.renderList();

    return this;
  }

  /**
   * Update the selected date from the parent calendar.
   *
   * @param {Date|string|number} date - New selected date.
   * @returns {TinySchedulerSidebar}
   */
  setSelectedDate(date) {
    this.selectedDate = parseDateInput(date);
    this.miniCalendar?.setDate(date);
    this.renderList();

    return this;
  }

  /**
   * Render selected-day events, or global search results when query is not empty.
   *
   * @returns {TinySchedulerSidebar}
   */
  renderList() {
    if (!this.listElement) return this;

    this.listElement.innerHTML = '';

    const events = this.getVisibleEvents();

    if (!events.length) {
      this.listElement.append(
        this.createElement('div', 'tsh-frame-empty', this.getLabel('noEvents', 'No events'))
      );
      return this;
    }

    this.groupEventsByDate(events).forEach((items, dateKey) => {
      this.listElement.append(this.createEventGroup(dateKey, items));
    });

    return this;
  }

  /**
   * Return events matching the current selected date or search query.
   *
   * @returns {Array<Object>}
   */
  getVisibleEvents() {
    const query = this.searchQuery.trim();

    const events = query
      ? this.events.filter(event => {
        return matchesEventSearch(event, query, this.getEventResource(event));
      })
      : this.events.filter(event => isEventOnDate(event, this.selectedDate));

    return events.slice().sort((a, b) => a.start - b.start);
  }

  /**
   * Group events by start date for display.
   *
   * @param {Array<Object>} events - Events to group.
   * @returns {Map<string, Array<Object>>}
   */
  groupEventsByDate(events) {
    const groups = new Map();

    events.forEach(event => {
      const dateKey = formatDateKey(event.start);

      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(event);
    });

    return groups;
  }

  /**
   * Create a dated event group.
   *
   * @param {string} dateKey - YYYY-MM-DD date key.
   * @param {Array<Object>} events - Events for this date.
   * @returns {HTMLElement}
   */
  createEventGroup(dateKey, events) {
    const date = parseDateInput(dateKey);
    const header = this.createEventGroupHeader(date);
    const group = this.createElement('section', 'tsh-frame-event-group', [header]);

    events.forEach(event => group.append(this.createEventItem(event)));

    return group;
  }

  /**
   * Create the event group date header.
   *
   * @param {Date} date - Group date.
   * @returns {HTMLElement}
   */
  createEventGroupHeader(date) {
    const locale = this.options.locale || GLOBAL_CONFIG.locale || 'en';
    const title = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date).toUpperCase();

    return this.createElement('header', 'tsh-frame-event-date-header', [
      this.createElement('strong', '', title),
      this.createElement('span', 'tsh-frame-event-date-relative', timeAgo(date, { locale }))
    ]);
  }

  /**
   * Create one event item card.
   *
   * The event color is exposed through --tsh-event-bg so CSS can render a
   * polished accent without using a border that fights with border-radius.
   *
   * @param {Object} event - Normalized calendar event.
   * @returns {HTMLButtonElement}
   */
  createEventItem(event) {
    const eventColor = this.getEventColor(event);
    const title = event.title || this.getLabel('untitledEvent', '(No title)');
    const text = event.text || '';
    const time = this.getEventTimeLabel(event);
    const resource = this.getEventResource(event);
    const resourceLabel = this.getResourceLabel(resource);

    const mainElement = this.createElement('span', 'tsh-frame-event-main');
    mainElement.append(this.createElement('strong', 'tsh-frame-event-title', title));

    if (text) {
      mainElement.append(this.createElement('span', 'tsh-frame-event-text', text));
    }

    if (resourceLabel) {
      const metaElement = this.createElement('span', 'tsh-frame-event-meta');
      metaElement.append(this.createElement('span', 'tsh-frame-event-chip', resourceLabel));
      mainElement.append(metaElement);
    }

    return this.createElement('button', 'tsh-frame-event-item', [
      mainElement,
      this.createElement('span', 'tsh-frame-event-time', time)
    ], {
      props: {
        type: 'button'
      },
      dataset: {
        eventId: event.id
      },
      style: {
        '--tsh-event-bg': eventColor
      },
      attrs: {
        'aria-label': [time, title, text].filter(Boolean).join(' — ')
      }
    });
  }

  /**
   * Return the visual color used for an event card.
   *
   * @param {Object} event - Calendar event.
   * @returns {string}
   */
  getEventColor(event) {
    return event.backgroundColor || event.color || this.options.defaultEventColor || 'var(--tsh-primary, #7367f0)';
  }

  /**
   * Return the display time for an event item.
   *
   * @param {Object} event - Calendar event.
   * @returns {string}
   */
  getEventTimeLabel(event) {
    return isAllDayEvent(event)
        ? this.getLabel('allDay', 'all-day')
        : formatShortTime(event.start, this.options);
  }

  /**
   * Return the resource attached to an event, if available.
   *
   * @param {Object} event - Calendar event.
   * @returns {Object|null}
   */
  getEventResource(event) {
    const resourceIds = Array.isArray(event.resourceIds)
        ? event.resourceIds
        : [event.resourceId].filter(Boolean);

    return this.resources.find(resource => {
      return resourceIds.some(resourceId => String(resource.id) === String(resourceId));
    }) || null;
  }

  /**
   * Return a concise resource label for the event chip.
   *
   * @param {Object|null} resource - Resource object.
   * @returns {string}
   */
  getResourceLabel(resource) {
    return resource?.title || resource?.name || '';
  }

  /**
   * Handle search input changes.
   */
  handleSearchInput() {
    this.searchQuery = this.searchInput.value;
    this.renderList();
    this._emit('searchChanged', { query: this.searchQuery });
  }

  /**
   * Delegate event-item clicks from the list container.
   *
   * @param {Event} event - DOM click event.
   */
  handleListClick(event) {
    const item = event.target.closest('[data-event-id]');
    if (!item) return;

    const clickedEvent = this.events.find(calendarEvent => String(calendarEvent.id) === item.dataset.eventId);

    if (clickedEvent) {
      this._emit('eventClicked', {
        event: clickedEvent,
        originalEvent: event
      });
    }
  }

  /**
   * Destroy child widgets and listeners.
   *
   * @returns {TinySchedulerSidebar}
   */
  destroy() {
    this.searchInput?.removeEventListener('input', this.boundSearchInput);
    this.listElement?.removeEventListener('click', this.boundListClick);
    this.overlayElement?.removeEventListener('click', this.boundOverlayClick);
    this.miniCalendar?.destroy();

    this.stateElement?.classList.remove(
      CLASS_NAMES.frame.sidebarOpen,
      CLASS_NAMES.frame.sidebarCollapsed
    );

    this.rootElement.innerHTML = '';
    this._emit('destroy', { sidebar: this });

    return this;
  }
}

/**
 * TinySchedulerFrame
 * ---------------------
 * Optional layout wrapper that combines the calendar with a collapsible sidebar.
 *
 * The frame owns the layout, but the sidebar owns its open/collapsed UI state.
 */
class TinySchedulerFrame extends MicroEvent {
  /**
   * @param {string|HTMLElement} target - Frame root selector or element.
   * @param {Object} options - Frame options.
   */
  constructor(target, options = {}) {
    super();

    this.rootElement = isStr(target) ? document.querySelector(target) : target;

    if (!this.rootElement) {
      throw new Error('TinySchedulerFrame target element was not found.');
    }

    this.options = mergeDeep({
      calendar: {},
      sidebar: {
        enabled: true,
        collapsible: true,
        initiallyCollapsed: false,
        searchable: true,
        miniCalendar: true,
        eventList: true,
        closeOnDateSelected: true,

        // The mini calendar usually displays 5-6 weeks even when the main
        // scheduler is in day view. Load that sidebar range independently so
        // mini-calendar markers and the event list are not limited to one day.
        loadEventsForVisibleRange: true
      }
    }, options);

    this.sidebarEventsRequestId = 0;
    this.sidebarEventsRange = null;
    this.sidebarEventsPendingKey = null;
    this.isSidebarDateNavigation = false;

    // When an event is clicked from the sidebar list, the main calendar may
    // need to navigate/reload. During that short operation the sidebar must
    // not replace its own mini-calendar/list data with the main day range.
    this.sidebarEventNavigation = null;
  }

  getStateStorageOptions() {
    return {
      ...(this.options.calendar?.stateStorage || {}),
      ...(this.options.stateStorage || {})
    };
  }

  /**
   * Create an element with the shared project DOM helper.
   *
   * @param {string} tagName - HTML tag name.
   * @param {string} className - Optional class string.
   * @param {string|number|Node|Array<Node|string|number>} content - Text or children.
   * @param {Object} options - DOM options.
   * @returns {HTMLElement}
   */
  createElement(tagName, className = '', content = '', options = {}) {
    return createDomElement(tagName, className, content, options);
  }

  /**
   * Render the frame DOM, then create calendar and sidebar instances.
   *
   * @returns {Promise<TinySchedulerFrame>}
   */
  async render() {
    this.rootElement.className = CLASS_NAMES.frame.root;

    // Configure persistence once for the frame and its child calendar.
    CalendarStateStorage.configure(this.getStateStorageOptions());

    this.rootElement.innerHTML = `
      <aside class="${CLASS_NAMES.frame.sidebar}"></aside>
      <div class="${CLASS_NAMES.frame.overlay}" data-frame-overlay></div>
      <main class="${CLASS_NAMES.frame.main}">
        <div class="${CLASS_NAMES.frame.calendarHost}"></div>
      </main>
    `;

    const calendarHost = this.rootElement.querySelector(`.${CLASS_NAMES.frame.calendarHost}`);
    const sidebarElement = this.rootElement.querySelector(`.${CLASS_NAMES.frame.sidebar}`);
    const overlayElement = this.rootElement.querySelector('[data-frame-overlay]');

    /*
      Create the calendar first.
      TinyScheduler resolves DEFAULT_OPTIONS, TSH_I18N and user options in
      its constructor, so the sidebar can receive the final labels/locale.
    */
    this.calendar = this.createCalendar(calendarHost);
    this.sidebar = this.createSidebar(sidebarElement, overlayElement);

    this.sidebar.render();
    this.bindChildEvents();

    await this.calendar.render();

    this._emit('frameReady', {
      frame: this,
      calendar: this.calendar,
      sidebar: this.sidebar
    });

    return this;
  }

  /**
   * Create the sidebar with the calendar-resolved i18n/options.
   *
   * @param {HTMLElement} sidebarElement - Real sidebar <aside>.
   * @param {HTMLElement} overlayElement - Frame overlay element.
   * @returns {TinySchedulerSidebar}
   */
  createSidebar(sidebarElement, overlayElement) {

    const sidebarState = CalendarStateStorage.getSidebarState();
    const isSidebarCollapsed = typeof sidebarState.sidebarCollapsed === 'boolean' ? sidebarState.sidebarCollapsed : Boolean(this.options.sidebar.initiallyCollapsed);

    return new TinySchedulerSidebar(sidebarElement, {
      ...this.options.sidebar,

      initiallyCollapsed: isSidebarCollapsed,

      stateElement: sidebarElement,
      overlayElement,

      initialDate: this.calendar.options.initialDate,
      locale: this.calendar.options.locale,
      firstDay: this.calendar.options.firstDay,
      timeFormat: this.calendar.options.timeFormat,

      labels: this.calendar.options.labels,
      tooltips: this.calendar.options.tooltips,
      aria: this.calendar.options.aria
    });
  }

  /**
   * Create the main calendar instance with a frame sidebar-toggle button.
   *
   * @param {HTMLElement} calendarHost - Calendar mount point.
   * @returns {TinyScheduler}
   */
  createCalendar(calendarHost) {
    const toolbar = mergeDeep({
      left: ['sidebarToggle', 'prev', 'next', 'today'],
      center: ['title'],
      right: ['month', 'week', 'day', 'list', 'planning']
    }, this.options.calendar.toolbar || {});

    const frame = this;
    const sidebarToggleTooltip =
      GLOBAL_CONFIG.tooltips?.sidebarToggle ||
      GLOBAL_CONFIG.labels?.sidebarToggle ||
      'Open / close sidebar';

    const customButtons = {
      sidebarToggle: {
        svg: TSH_TOOLBAR_ICONS.sidebarToggle,
        tooltip: sidebarToggleTooltip,
        ariaLabel: sidebarToggleTooltip,
        action() {
          frame.toggleSidebar();
        }
      },
      ...(this.options.calendar.customButtons || {})
    };

    const stateStorage = this.getStateStorageOptions();

    return new TinyScheduler(calendarHost, {
      ...this.options.calendar,
      stateStorage: {
        ...(this.options.calendar.stateStorage || {}),
        ...stateStorage
      },
      toolbar,
      customButtons
    });
  }

  /**
   * Bridge child component events without coupling sidebar/calendar internals.
   */
  bindChildEvents() {
    this.calendar.on('eventsChanged', context => {
      /*
        The sidebar can either mirror the main calendar range, or own a wider
        mini-calendar range. In the default wider-range mode, never replace the
        sidebar month cache with a single day/week coming from the main view.
      */
      if (this.options.sidebar.loadEventsForVisibleRange === false && !this.isSidebarEventNavigationActive()) {
        this.sidebar.setEvents(context.events);
      } else if (!this.sidebarEventsRange) {
        this.syncSidebarEvents();
      }

      this._emit('eventsChanged', context);
    });

    this.calendar.on('resourcesChanged', context => {
      this.sidebar.setResources(context.resources);
    });

    this.calendar.on('dateChanged', context => {
      if (this.isSidebarEventNavigationActive() || this.isSidebarDateNavigation) {
        return;
      }

      this.sidebar.setSelectedDate(context.date);
      this.syncSidebarEvents();
    });

    this.sidebar.on('dateSelected', context => {
      /*
        The sidebar already updated its selected day and rendered the list.
        Navigating the main calendar must not reload/replace the sidebar cache.
      */
      this.isSidebarDateNavigation = true;

      try {
        this.calendar.gotoDate(context.date);
      } finally {
        this.isSidebarDateNavigation = false;
      }

      this._emit('sidebarDateSelected', context);
    });

    this.sidebar.on('miniCalendarRangeChanged', context => {
      this.syncSidebarEvents(context.range);
      this._emit('sidebarRangeChanged', context);
    });

    this.sidebar.on('searchChanged', context => {
      this._emit('sidebarSearchChanged', context);
    });

    this.sidebar.on('eventClicked', context => {
      this.handleSidebarEventClick(context);
    });

    this.calendar.on('redrawEnd', () => {
      this.restoreSidebarClickedEventSelection();
    });

    this.sidebar.on('opened', context => {
      this._emit('sidebarOpened', {
        frame: this,
        ...context
      });
    });

    this.sidebar.on('closed', context => {
      this._emit('sidebarClosed', {
        frame: this,
        ...context
      });
    });

    this.sidebar.on('toggled', context => {
      this._emit('sidebarToggled', {
        frame: this,
        ...context
      });
    });
  }


  /**
   * Return true while the main calendar is navigating because of a sidebar
   * event-list click.
   *
   * During this state, main calendar refreshes must not overwrite the sidebar
   * event list or mini-calendar markers.
   *
   * @returns {boolean}
   */
  isSidebarEventNavigationActive() {
    return Boolean(this.sidebarEventNavigation);
  }

  /**
   * Handle click on one sidebar event-list item.
   *
   * Behavior:
   * - If the event is already rendered in the current calendar view, select it
   *   and scroll to it without reloading anything.
   * - If the calendar must navigate to another day/view, refresh only the main
   *   calendar range needed to render that event.
   * - Never refresh/replace the sidebar mini-calendar or sidebar event list as
   *   a side effect of this click.
   *
   * @param {Object} context - Sidebar eventClicked context.
   * @param {Object} context.event - Clicked calendar event.
   * @param {Event} [context.originalEvent] - Original DOM event.
   * @returns {TinySchedulerFrame}
   */
  handleSidebarEventClick(context) {
    const clickedEvent = context.event;

    if (!clickedEvent) {
      return this;
    }

    const targetDate = parseDateInput(clickedEvent.start);
    const targetView = this.options.sidebar.eventClickBehavior?.switchView || SCHEDULER_VIEW_NAMES.DAY;
    const isSameDate = isSameDay(this.calendar.getDate(), targetDate);
    const isTargetView = this.calendar.isView(targetView);

    // Fast path: event is already rendered. No navigation, no refresh, no
    // sidebar update. This is the expected behavior when already on the right day.
    if (isSameDate && isTargetView && this.calendar.selectEventById(clickedEvent.id, {
      scroll: true,
      originalEvent: context.originalEvent || null
    })) {
      this._emit('sidebarEventClicked', context);
      return this;
    }

    this.sidebarEventNavigation = {
      eventId: String(clickedEvent.id),
      originalEvent: context.originalEvent || null
    };

    if (!isSameDate) {
      this.calendar.gotoDate(targetDate, { refresh: false });
    }

    if (!isTargetView) {
      this.calendar.setView(targetView);
    } else {
      this.calendar.refresh();
    }

    this._emit('sidebarEventClicked', context);

    return this;
  }

  /**
   * Restore selection after the main calendar has redrawn for a sidebar event
   * click, then release the sidebar-sync suppression.
   *
   * @returns {TinySchedulerFrame}
   */
  restoreSidebarClickedEventSelection() {
    if (!this.sidebarEventNavigation) {
      return this;
    }

    const { eventId, originalEvent } = this.sidebarEventNavigation;

    this.calendar.selectEventById(eventId, {
      scroll: true,
      originalEvent
    });

    this.sidebarEventNavigation = null;

    return this;
  }

  /**
   * Return a stable cache key for a sidebar event range.
   *
   * @param {{start: Date, end: Date}} range - Sidebar visible range.
   * @returns {string}
   */
  getSidebarRangeKey(range) {
    return `${range.start.getTime()}:${range.end.getTime()}`;
  }

  /**
   * Check whether the requested sidebar range is already loaded.
   *
   * @param {{start: Date, end: Date}|null} range - Requested sidebar range.
   * @returns {boolean}
   */
  isSidebarRangeLoaded(range) {
    if (!this.sidebarEventsRange || !range) {
      return false;
    }

    return range.start >= this.sidebarEventsRange.start
        && range.end <= this.sidebarEventsRange.end;
  }

  /**
   * Return the date range needed by sidebar widgets.
   *
   * In day/week views the main calendar only loads the active visible range.
   * The mini calendar displays a full month grid, including wrong-month days,
   * so it needs a wider independent range for markers and the sidebar list.
   *
   * @returns {{start: Date, end: Date}|null}
   */
  getSidebarEventsRange() {
    const miniRange = this.sidebar?.getMiniCalendarVisibleRange?.();

    if (miniRange) {
      return miniRange;
    }

    return this.calendar?.state?.visibleRange || null;
  }

  /**
   * Load events for the sidebar/mini-calendar visible range without replacing
   * the main calendar event store.
   *
   * @param {{start: Date, end: Date}|null} range - Optional explicit sidebar range.
   * @returns {Promise<TinySchedulerFrame>}
   */
  async syncSidebarEvents(range = null) {
    if (this.options.sidebar.loadEventsForVisibleRange === false) {
      return this;
    }

    const resolvedRange = range || this.getSidebarEventsRange();

    if (!this.calendar?.sourceManager || !resolvedRange || this.isSidebarRangeLoaded(resolvedRange)) {
      return this;
    }

    const rangeKey = this.getSidebarRangeKey(resolvedRange);

    if (this.sidebarEventsPendingKey === rangeKey) {
      return this;
    }

    this.sidebarEventsPendingKey = rangeKey;

    const requestId = ++this.sidebarEventsRequestId;

    try {
      const events = await this.calendar.sourceManager.fetchEvents(resolvedRange);

      // Ignore stale responses when users navigate quickly.
      if (requestId === this.sidebarEventsRequestId) {
        this.sidebarEventsRange = {
          start: new Date(resolvedRange.start),
          end: new Date(resolvedRange.end)
        };

        this.sidebar?.setEvents(events);
      }
    } finally {
      if (this.sidebarEventsPendingKey === rangeKey) {
        this.sidebarEventsPendingKey = null;
      }
    }

    return this;
  }

  getCalendar() { return this.calendar; }
  getSidebar() { return this.sidebar; }
  getMiniCalendar() { return this.sidebar?.miniCalendar; }

  openSidebar() {
    this.sidebar?.open();
    CalendarStateStorage.setSidebarState(false);
    return this;
  }

  closeSidebar() {
    this.sidebar?.close();
    CalendarStateStorage.setSidebarState(true);
    return this;
  }

  toggleSidebar() {
    const isCollapsed = this.sidebar?.toggle();
    CalendarStateStorage.setSidebarState(isCollapsed);
    return this;
  }

  isSidebarOpen() {
    return this.sidebar?.isOpen();
  }

  isSidebarCollapsed() {
    return this.sidebar?.isCollapsed();
  }

  async searchEvents(query) { return this.calendar.searchEvents(query); }
  clearSearch() { this.calendar.clearSearch(); return this; }
  refresh() { return this.calendar.refresh(); }
  redraw() { this.sidebar.renderList(); this.calendar.redraw(); return this; }

  /**
   * Destroy sidebar/calendar instances and clean the frame DOM.
   *
   * @returns {TinySchedulerFrame}
   */
  destroy() {
    this._emit('beforeDestroy', { frame: this });
    this.sidebar?.destroy();
    this.calendar?.destroy();
    this.rootElement.innerHTML = '';
    this._emit('destroy', { frame: this });

    return this;
  }
}

  return {
    TinyScheduler,
    TinySchedulerFrame,
    TinySchedulerSidebar,
    TinyMiniCalendar
  };
});
