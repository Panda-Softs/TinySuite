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
