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
