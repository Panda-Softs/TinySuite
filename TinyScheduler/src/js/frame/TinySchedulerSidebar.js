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
