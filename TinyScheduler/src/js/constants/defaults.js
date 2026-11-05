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
