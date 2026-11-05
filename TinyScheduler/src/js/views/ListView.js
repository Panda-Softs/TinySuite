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
