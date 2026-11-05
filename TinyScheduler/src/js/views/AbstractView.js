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