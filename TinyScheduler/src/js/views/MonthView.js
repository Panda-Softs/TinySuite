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