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
