/**
 * ResourceTimeGridView
 * --------------------
 * Renders the resource time-grid planning view.
 *
 * Layout:
 * - one shared scroll container owns header, all-day row and timed body;
 * - resources are displayed as responsive columns;
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
   * Return the visible range for the current planning range.
   *
   * @returns {{start: Date, end: Date}}
   */
  getVisibleRange() {
    const range = this.state.planningRange || 'day';

    if (range === 'week') {
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
   * Return the toolbar title for the resource time-grid view.
   *
   * @returns {string}
   */
  getTitle() {
    const range = this.getVisibleRange();

    return this.state.planningRange === 'week'
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
   * @returns {string}
   */
  getSlotHeight() {
    return this.options.resourceTimeGridSlotHeight || '1.5em';
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
    const minWidth = this.options.resourceTimeGridResourceMinWidth || '180px';

    return typeof minWidth === 'number'
        ? `${minWidth}px`
        : String(minWidth);
  }

  /**
   * Render the complete resource time-grid.
   *
   * @returns {HTMLElement}
   */
  render() {
    const range = this.getVisibleRange();
    const resources = this.getVisibleResources();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getSlotDuration();
    const slotHeight = this.getSlotHeight();
    const slotCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));

    this.state.visibleRange = range;

    const rootElement = this.createElement(
        'div',
        `${CLASS_NAMES.calendar.view} ${CLASS_NAMES.calendar.resourceTimeGrid}`,
        '',
        {
          style: {
            '--tsh-rtg-slot-count': slotCount,
            '--tsh-rtg-slot-height': slotHeight,
            '--tsh-rtg-resource-count': this.getLayoutResourceCount(resources.length),
            '--tsh-rtg-resource-min-width': this.getResourceMinWidth(),
            '--tsh-rtg-grid-columns': this.getResourceGridTemplateColumns(resources.length)
          }
        }
    );

    rootElement.append(
        this.createScrollBody({
          range,
          resources,
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
   * @param {Array<Object>} config.resources - Visible resources.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createScrollBody({
                     range,
                     resources,
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
        this.createHeader(resources),
        this.createAllDayRow(resources, visibleEvents),
        this.createTimedBody({
          range,
          resources,
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
   * @param {Array<Object>} resources - Visible resources.
   * @returns {HTMLElement}
   */
  createHeader(resources) {
    const headerElement = this.createElement('div', 'tsh-rtg-header');

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

    resources.forEach(resource => {
      headerElement.append(
          this.createElement('div', 'tsh-rtg-resource-title', resource.title)
      );
    });

    return headerElement;
  }

  /**
   * Create the all-day row.
   *
   * @param {Array<Object>} resources - Visible resources.
   * @param {Array<Object>} visibleEvents - Events already loaded for the range.
   * @returns {HTMLElement}
   */
  createAllDayRow(resources, visibleEvents) {
    const rangeStart = startOfDay(this.getVisibleRange().start);
    const rangeEnd = addDays(rangeStart, 1);
    const allDayElement = this.createElement(
        'div',
        classNames('tsh-rtg-all-day', CLASS_NAMES.calendar.slotGroup),
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

    if (!resources.length) {
      allDayElement.append(
          this.createElement('div', 'tsh-rtg-all-day-cell tsh-rtg-all-day-cell--empty')
      );

      return allDayElement;
    }

    resources.forEach(resource => {
      const cellElement = this.createElement(
          'div',
          classNames('tsh-rtg-all-day-cell', CLASS_NAMES.calendar.slot),
          '',
          {
            dataset: {
              slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIME_GRID,
              slotStart: formatIsoLocal(rangeStart),
              slotEnd: formatIsoLocal(rangeEnd),
              slotAllDay: 'true',
              resourceId: resource.id
            }
          }
      );

      visibleEvents
          .filter(event => isAllDayEvent(event) && event.resourceIds.includes(resource.id))
          .forEach(event => {
            cellElement.append(this.createEventElement(event, 'all-day', resource));
          });

      allDayElement.append(cellElement);
    });

    return allDayElement;
  }

  /**
   * Create the timed body row.
   *
   * @param {Object} config - Body configuration.
   * @param {{start: Date, end: Date}} config.range - Visible date range.
   * @param {Array<Object>} config.resources - Visible resources.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createTimedBody({
                    range,
                    resources,
                    visibleEvents,
                    minMinutes,
                    maxMinutes,
                    slotDuration,
                    slotCount
                  }) {
    const bodyElement = this.createElement('div', 'tsh-rtg-body');

    bodyElement.append(
        this.createTimeColumn({
          minMinutes,
          slotDuration,
          slotCount
        })
    );

    if (!resources.length) {
      bodyElement.append(
          this.createEmptyResourceColumn({
            minMinutes,
            slotDuration,
            slotCount
          })
      );

      this.appendResourceTimeGridNowIndicator(bodyElement, {
        range,
        minMinutes,
        maxMinutes,
        slotDuration
      });

      return bodyElement;
    }

    resources.forEach(resource => {
      bodyElement.append(
          this.createResourceColumn({
            resource,
            range,
            visibleEvents,
            minMinutes,
            maxMinutes,
            slotDuration,
            slotCount
          })
      );
    });

    this.appendResourceTimeGridNowIndicator(bodyElement, {
      range,
      minMinutes,
      maxMinutes,
      slotDuration
    });

    return bodyElement;
  }

  /**
   * Refresh the current-time indicator in-place without redrawing events.
   *
   * @returns {ResourceTimeGridView}
   */
  refreshNowIndicator() {
    const bodyElement = this.calendar.rootElement.querySelector('.tsh-rtg-body');

    if (!bodyElement) return this;

    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getSlotDuration();

    this.removeNowIndicators(bodyElement);
    this.appendResourceTimeGridNowIndicator(bodyElement, {
      range: this.getVisibleRange(),
      minMinutes,
      maxMinutes,
      slotDuration
    });

    return this;
  }

  /**
   * Append the current-time indicator to the timed body when today is visible.
   * In resource time-grid, the current time applies to every resource column,
   * so the active segment spans the whole resource area.
   *
   * @param {HTMLElement} bodyElement - Timed body element.
   * @param {Object} config - Indicator config.
   * @returns {ResourceTimeGridView}
   */
  appendResourceTimeGridNowIndicator(bodyElement, config) {
    const nowIndicator = this.createVerticalNowIndicator({
      ...config,
      columnIndex: 0,
      columnCount: 1,
      modifierClass: 'tsh-now-indicator--resource-time-grid'
    });

    if (nowIndicator) {
      bodyElement.append(nowIndicator);
    }

    return this;
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
   * Create one resource column.
   *
   * The visual grid is rendered as real slot elements.
   * The events are rendered inside a separate absolute overlay layer.
   *
   * @param {Object} config - Column configuration.
   * @param {Object} config.resource - Resource represented by this column.
   * @param {{start: Date, end: Date}} config.range - Visible date range.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @param {number} config.slotCount - Number of visual slots.
   * @returns {HTMLElement}
   */
  createResourceColumn({
                         resource,
                         range,
                         visibleEvents,
                         minMinutes,
                         maxMinutes,
                         slotDuration,
                         slotCount
                       }) {
    const columnElement = this.createElement('div', classNames(CLASS_NAMES.calendar.resourceTimeGridColumn, CLASS_NAMES.calendar.slotGroup), '', {
      dataset: {
        dropKind: 'resourceTimeGrid',
        dropDate: formatDateKey(range.start),
        resourceId: resource.id,
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.VERTICAL
      }
    });

    const slotsElement = this.createSlotGrid({
      className: 'tsh-rtg-slots',
      date: range.start,
      resourceId: resource.id,
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIME_GRID,
      minMinutes,
      slotDuration,
      slotCount
    });

    const eventsLayerElement = this.createElement('div', 'tsh-rtg-events');

    this.renderTimedEvents({
      eventsLayerElement,
      resource,
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
   * @param {Object} config.resource - Resource represented by the current column.
   * @param {Array<Object>} config.visibleEvents - Events already loaded for the range.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   */
  renderTimedEvents({
                      eventsLayerElement,
                      resource,
                      visibleEvents,
                      minMinutes,
                      maxMinutes,
                      slotDuration
                    }) {
    visibleEvents
        .filter(event => !isAllDayEvent(event) && event.resourceIds.includes(resource.id))
        .forEach(event => {
          const position = this.getTimedEventPosition({
            event,
            minMinutes,
            maxMinutes,
            slotDuration
          });

          if (!position) return;

          const eventElement = this.createEventElement(event, 'block', resource);
          const timeElement = this.createElement(
              'span',
              CLASS_NAMES.calendar.eventTime || 'tsh-event-time',
              formatTimeRange(event.start, event.end, this.options)
          );

          eventElement.style.top = `calc(${position.startOffset} * var(--tsh-rtg-slot-height))`;
          eventElement.style.height = `max(22px, calc(${position.slotSpan} * var(--tsh-rtg-slot-height)))`;

          eventElement.prepend(timeElement);
          eventsLayerElement.append(eventElement);
          this.scheduleEventDensityUpdate(eventElement);
        });
  }

  /**
   * Apply compact display classes after the browser has calculated event width.
   *
   * @param {HTMLElement} eventElement - Rendered event element.
   */
  scheduleEventDensityUpdate(eventElement) {
    requestAnimationFrame(() => {
      const width = eventElement.offsetWidth;

      eventElement.classList.toggle(CLASS_NAMES.calendar.eventNarrow, width > 0 && width < 90);
      eventElement.classList.toggle(CLASS_NAMES.calendar.eventTiny, width > 0 && width < 48);
    });
  }

  /**
   * Calculate the vertical position and height for one event.
   *
   * @param {Object} config - Position configuration.
   * @param {Object} config.event - Normalized calendar event.
   * @param {number} config.minMinutes - Visible start time in minutes.
   * @param {number} config.maxMinutes - Visible end time in minutes.
   * @param {number} config.slotDuration - Slot duration in minutes.
   * @returns {{startOffset: number, slotSpan: number}|null}
   */
  getTimedEventPosition({ event, minMinutes, maxMinutes, slotDuration }) {
    const eventStart = parseDateInput(event.start);
    const eventEnd = event.end
        ? parseDateInput(event.end)
        : addMinutes(eventStart, 60);

    const startMinute = Math.max(
        minMinutes,
        eventStart.getHours() * 60 + eventStart.getMinutes()
    );

    const endMinute = Math.min(
        maxMinutes,
        eventEnd.getHours() * 60 + eventEnd.getMinutes()
    );

    if (endMinute <= startMinute) {
      return null;
    }

    return {
      startOffset: (startMinute - minMinutes) / slotDuration,
      slotSpan: (endMinute - startMinute) / slotDuration
    };
  }

  /**
   * Return the minimum number of content columns used by the layout.
   *
   * When there are no resources, one placeholder column is still rendered so
   * the fixed time column never expands across the whole view.
   *
   * @param {number} resourceCount - Number of visible resources.
   * @returns {number}
   */
  getLayoutResourceCount(resourceCount) {
    return Math.max(1, resourceCount);
  }

  /**
   * Return the shared grid-template-columns value.
   *
   * @param {number} resourceCount - Number of visible resource columns.
   * @returns {string}
   */
  getResourceGridTemplateColumns(resourceCount) {
    const layoutResourceCount = this.getLayoutResourceCount(resourceCount);

    return `var(--tsh-time-column-width) repeat(${layoutResourceCount}, minmax(var(--tsh-rtg-resource-min-width), 1fr))`;
  }
}
