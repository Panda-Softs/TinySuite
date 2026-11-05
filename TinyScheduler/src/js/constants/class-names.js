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
