/**
 * ResourceTimelineView
 * --------------------
 * Renders the resource timeline planning view.
 *
 * Layout model:
 * - Resources are displayed vertically as rows.
 * - Time is displayed horizontally as real slot cells.
 * - The whole view uses one scroll container so header, resource rows and time
 *   rows stay visually synchronized.
 * - In day view, body rows use detailed time slots while the header uses one
 *   full-hour cell with the hour label centered.
 * - Events remain absolutely positioned in a row overlay because their
 *   start/end can be fractional and can overlap slot boundaries.
 */
class ResourceTimelineView extends AbstractView {
  /**
   * Timeline views have a horizontal time axis, so they can display a vertical
   * current-time marker when today/current time is inside the visible range.
   *
   * @returns {boolean}
   */
  supportsNowIndicator() {
    return true;
  }

  /**
   * Return the visible range for the current timeline sub-view.
   *
   * @returns {{start: Date, end: Date}}
   */
  getVisibleRange() {
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'week') {
      const start = startOfWeek(this.state.currentDate, this.options.firstDay);

      return {
        start,
        end: addDays(start, 7)
      };
    }

    if (timelineRange === 'month') {
      return {
        start: startOfMonth(this.state.currentDate),
        end: addDays(endOfMonth(this.state.currentDate), 1)
      };
    }

    const dayStart = startOfDay(this.state.currentDate);

    return {
      start: dayStart,
      end: addDays(dayStart, 1)
    };
  }

  /**
   * Return the title displayed in the main toolbar.
   *
   * @returns {string}
   */
  getTitle() {
    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'week') {
      return formatRangeTitle(range.start, range.end, this.options.locale);
    }

    if (timelineRange === 'month') {
      return formatMonthTitle(this.state.currentDate, this.options.locale);
    }

    return formatDayTitle(this.state.currentDate, this.options.locale);
  }

  /**
   * Return the active timeline range.
   *
   * @returns {'day'|'week'|'month'}
   */
  getTimelineRange() {
    return this.state.planningRange || 'day';
  }

  /**
   * Return the duration of one body slot in minutes.
   *
   * @returns {number}
   */
  getDaySlotDuration() {
    return this.options.timelineSlotDuration || this.options.slotDuration || 30;
  }

  /**
   * Return how many body slots compose one hour.
   *
   * @returns {number}
   */
  getTimelineSlotsPerHour() {
    const slotDuration = this.getDaySlotDuration();

    return Math.max(1, Math.round(60 / slotDuration));
  }

  /**
   * Return the resources visible in the timeline left column.
   *
   * This method is intentionally generic. It must not filter demo-only ids such
   * as `auditorium-*`, because real integrations can use numeric ids, boat ids,
   * staff ids, room ids, etc.
   *
   * @returns {Array<{resource: Object, depth: number, hasChildren: boolean}>}
   */
  getVisibleResources() {
    const resources = this.calendar.resourceStore.getResources();
    const childrenByParentId = new Map();
    const topLevelResources = [];

    resources.forEach(resource => {
      const parentId = this.getResourceParentId(resource);

      if (!parentId) {
        topLevelResources.push(resource);
        return;
      }

      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }

      childrenByParentId.get(parentId).push(resource);
    });

    const visibleRows = [];

    topLevelResources.forEach(resource => {
      const resourceId = this.getResourceId(resource);
      const children = childrenByParentId.get(resourceId) || [];

      visibleRows.push({
        resource,
        depth: 0,
        hasChildren: children.length > 0
      });

      if (this.state.collapsedResources.has(resourceId)) return;

      children.forEach(childResource => {
        visibleRows.push({
          resource: childResource,
          depth: 1,
          hasChildren: false
        });
      });
    });

    return visibleRows;
  }

  /**
   * Return a stable string id for a resource.
   *
   * @param {Object} resource - Resource object.
   * @returns {string}
   */
  getResourceId(resource) {
    return String(resource?.id ?? '');
  }

  /**
   * Return the normalized parent resource id.
   *
   * @param {Object} resource - Resource object.
   * @returns {string|null}
   */
  getResourceParentId(resource) {
    return resource?.parentId === null || resource?.parentId === undefined || resource?.parentId === ''
        ? null
        : String(resource.parentId);
  }

  /**
   * Return the visible resource title.
   *
   * @param {Object} resource - Resource object.
   * @returns {string}
   */
  getResourceTitle(resource) {
    return resource?.title || resource?.name || this.getResourceId(resource);
  }

  /**
   * Return the left column header label.
   *
   * @returns {string}
   */
  getResourceAreaTitle() {
    return this.options.resourceAreaTitle || this.calendar._getLabel('resources', 'Resources');
  }

  /**
   * Build visual slots for the timeline axis.
   *
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {Array<Object>}
   */
  buildSlots(range) {
    const timelineRange = this.getTimelineRange();

    if (timelineRange === 'day') {
      return this.buildDayTimeSlots(range);
    }

    return this.buildDateSlots(range, timelineRange);
  }

  /**
   * Build day timeline slots.
   *
   * @param {{start: Date}} range - Visible date range.
   * @returns {Array<Object>}
   */
  buildDayTimeSlots(range) {
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getDaySlotDuration();
    const slotCount = Math.max(1, Math.ceil((maxMinutes - minMinutes) / slotDuration));
    const dayStart = startOfDay(range.start);

    return Array.from({ length: slotCount }, (_, slotIndex) => {
      const minute = minMinutes + slotIndex * slotDuration;
      const slotStart = addMinutes(dayStart, minute);
      const slotEnd = addMinutes(slotStart, slotDuration);
      const isHourSlot = minute % 60 === 0;

      return {
        index: slotIndex,
        minute,
        start: slotStart,
        end: slotEnd,
        label: isHourSlot ? formatSlotLabel(minute, this.options) : '',
        isHourSlot,
        isDaySlot: false,
        unit: 'minute',
        unitSize: slotDuration
      };
    });
  }

  /**
   * Build week/month timeline slots.
   *
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @param {'week'|'month'} timelineRange - Timeline sub-view.
   * @returns {Array<Object>}
   */
  buildDateSlots(range, timelineRange) {
    const slots = [];

    for (
        let cursor = startOfDay(range.start), index = 0;
        cursor < range.end;
        cursor = addDays(cursor, 1), index += 1
    ) {
      const slotEnd = addDays(cursor, 1);

      slots.push({
        index,
        start: new Date(cursor),
        end: slotEnd,
        label: formatTimelineSlotLabel(cursor, timelineRange, this.options),
        isHourSlot: false,
        isDaySlot: true,
        unit: 'day',
        unitSize: 1
      });
    }

    return slots;
  }

  /**
   * Calculate the event position in slot units.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getEventPosition(event, range) {
    return this.getTimelineRange() === 'day'
        ? this.getDayEventPosition(event, range)
        : this.getDateEventPosition(event, range);
  }

  /**
   * Calculate event position for day timeline.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getDayEventPosition(event, range) {
    const minMinutes = parseTimeToMinutes(this.options.minTime);
    const maxMinutes = parseTimeToMinutes(this.options.maxTime);
    const slotDuration = this.getDaySlotDuration();
    const dayStart = startOfDay(range.start);
    const visibleStart = addMinutes(dayStart, minMinutes);
    const visibleEnd = addMinutes(dayStart, maxMinutes);
    const eventStart = isAllDayEvent(event) ? visibleStart : parseDateInput(event.start);
    const eventEnd = isAllDayEvent(event) ? visibleEnd : parseDateInput(event.end || addMinutes(eventStart, 60));
    const clampedStart = new Date(Math.max(eventStart.getTime(), visibleStart.getTime()));
    const clampedEnd = new Date(Math.min(eventEnd.getTime(), visibleEnd.getTime()));

    if (clampedEnd <= clampedStart) return null;

    const startMinute = Math.round((clampedStart - dayStart) / 60000);
    const endMinute = Math.round((clampedEnd - dayStart) / 60000);

    return {
      leftUnits: (startMinute - minMinutes) / slotDuration,
      widthUnits: Math.max(0.5, (endMinute - startMinute) / slotDuration)
    };
  }

  /**
   * Calculate event position for week/month timeline.
   *
   * @param {Object} event - Normalized event.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {{leftUnits: number, widthUnits: number}|null}
   */
  getDateEventPosition(event, range) {
    const eventStartDate = parseDateInput(event.start);
    const eventEndDate = event.end
        ? parseDateInput(event.end)
        : addDays(eventStartDate, 1);

    const eventStartDay = startOfDay(eventStartDate);
    let eventEndDay = startOfDay(eventEndDate);

    /*
      Week/month timeline slots are date cells, not minute cells.
      A timed event inside one day should therefore fill that day cell instead
      of using its small clock-duration fraction as width.
    */
    if (eventEndDate.getTime() > eventEndDay.getTime()) {
      eventEndDay = addDays(eventEndDay, 1);
    }

    if (eventEndDay <= eventStartDay) {
      eventEndDay = addDays(eventStartDay, 1);
    }

    const eventStart = Math.max(eventStartDay.getTime(), range.start.getTime());
    const eventEnd = Math.min(eventEndDay.getTime(), range.end.getTime());

    if (eventEnd <= eventStart) return null;

    const dayMs = 86400000;

    return {
      leftUnits: (eventStart - range.start.getTime()) / dayMs,
      widthUnits: Math.max(1, (eventEnd - eventStart) / dayMs)
    };
  }

  /**
   * Render the complete resource timeline view.
   *
   * @returns {HTMLElement}
   */
  render() {
    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();
    const rows = this.getVisibleResources();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);
    const slots = this.buildSlots(range);
    const rootElement = this.createRootElement(timelineRange, slots);

    this.rootElement = rootElement;

    const scroller = this.createElement('div', classNames('tsh-rtl-scroller', CLASS_NAMES.calendar.scrollContainer));
    const grid = this.createElement('div', 'tsh-rtl-grid');
    const resourceHeader = this.createElement('div', 'tsh-rtl-resource-header', this.getResourceAreaTitle());
    const timeHeader = this.createTimeHeader(slots);
    const resourceRows = this.createElement('div', 'tsh-rtl-resource-rows');
    const timeRows = this.createElement('div', 'tsh-rtl-time-rows');

    this.state.visibleRange = range;

    if (rows.length) {
      rows.forEach(row => {
        resourceRows.append(this.createResourceRow(row));
        timeRows.append(this.createTimeRow(row.resource, slots, visibleEvents, range));
      });
    } else {
      resourceRows.append(this.createEmptyResourceRow());
      timeRows.append(this.createEmptyTimeRow(slots));
    }

    this.appendTimelineNowIndicator(timeRows, {
      range,
      slots,
      timelineRange
    });

    grid.append(resourceHeader, timeHeader, resourceRows, timeRows);
    scroller.append(grid);
    rootElement.append(scroller);

    return rootElement;
  }

  /**
   * Refresh only timeline event layers while keeping rows, headers and scroll.
   *
   * @returns {boolean}
   */
  refreshEvents() {
    if (!this.rootElement?.isConnected) return false;

    const range = this.getVisibleRange();
    const slots = this.buildSlots(range);
    const rows = this.getVisibleResources();
    const visibleEvents = this.calendar.eventStore.getEventsInRange(range.start, range.end);

    rows.forEach(row => {
      const resource = row.resource;
      const resourceId = this.getResourceId(resource);
      const timeRowElement = this.getTimeRowElement(resourceId);
      const eventsLayer = timeRowElement?.querySelector('.tsh-rtl-events-layer');

      this.refreshEventContainer(eventsLayer, container => {
        visibleEvents
            .filter(event => this.isEventAssignedToResource(event, resourceId) && this.isEventInRange(event, range))
            .forEach(event => {
              const eventElement = this.createTimelineEventElement(event, resource, range, slots);

              if (eventElement) {
                container.append(eventElement);
              }
            });
      });
    });

    return true;
  }

  /**
   * Return the mounted time row for one resource.
   *
   * @param {string} resourceId - Resource id.
   * @returns {HTMLElement|null}
   */
  getTimeRowElement(resourceId) {
    const rootElement = this.rootElement || this.calendar.rootElement;

    return Array.from(rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.resourceTimelineTimeRow}`))
        .find(element => String(element.dataset.resourceId) === String(resourceId)) || null;
  }

  /**
   * Refresh the current-time marker in-place without redrawing rows/events.
   *
   * @returns {ResourceTimelineView}
   */
  refreshNowIndicator() {
    const timeRows = this.rootElement?.querySelector('.tsh-rtl-time-rows')
        || this.calendar.rootElement.querySelector('.tsh-rtl-time-rows');

    if (!timeRows) return this;

    const range = this.getVisibleRange();
    const timelineRange = this.getTimelineRange();
    const slots = this.buildSlots(range);

    this.removeNowIndicators(timeRows);
    this.appendTimelineNowIndicator(timeRows, {
      range,
      slots,
      timelineRange
    });

    return this;
  }

  /**
   * Append the current-time marker to the timeline rows area.
   * Day timelines use minute precision. Week/month timelines use the current
   * date/time as a fractional position inside the visible day slots.
   *
   * @param {HTMLElement} timeRows - Timeline rows container.
   * @param {Object} config - Indicator config.
   * @param {{start: Date, end: Date}} config.range - Visible range.
   * @param {Array<Object>} config.slots - Timeline slots.
   * @param {'day'|'week'|'month'} config.timelineRange - Active timeline range.
   * @returns {ResourceTimelineView}
   */
  appendTimelineNowIndicator(timeRows, { range, slots, timelineRange }) {
    const nowIndicator = this.createTimelineNowIndicator({
      range,
      slots,
      timelineRange,
      minMinutes: parseTimeToMinutes(this.options.minTime),
      maxMinutes: parseTimeToMinutes(this.options.maxTime),
      slotDuration: this.getDaySlotDuration()
    });

    if (nowIndicator) {
      timeRows.append(nowIndicator);
    }

    return this;
  }

  /**
   * Create the root view element and expose sizing settings to CSS.
   *
   * @param {'day'|'week'|'month'} timelineRange - Timeline sub-view.
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createRootElement(timelineRange, slots) {
    return this.createElement(
        'div',
        `${CLASS_NAMES.calendar.view} ${CLASS_NAMES.calendar.resourceTimeline}`,
        '',
        {
          dataset: {
            timelineRange
          },
          style: {
            '--tsh-rtl-row-height': this.getRowHeight(),
            '--tsh-rtl-slot-count': slots.length,
            '--tsh-rtl-slot-width': this.getTimelineSlotWidth(timelineRange),
            '--tsh-rtl-slots-per-hour': this.getTimelineSlotsPerHour(),
            '--tsh-rtl-resource-column-width': this.getResourceColumnWidth()
          }
        }
    );
  }

  /**
   * Return the CSS width used by each timeline slot.
   *
   * @param {'day'|'week'|'month'} timelineRange - Timeline sub-view.
   * @returns {string}
   */
  getTimelineSlotWidth(timelineRange) {
    if (timelineRange === 'day') {
      return this.options.resourceTimelineHalfHourWidth || 'var(--tsh-rtl-half-hour-width, 1.5em)';
    }

    return this.options.resourceTimelineDayWidth || 'var(--tsh-rtl-day-width, 96px)';
  }

  /**
   * Return the fixed width of the left resource column.
   *
   * @returns {string}
   */
  getResourceColumnWidth() {
    const width = this.options.resourceTimelineResourceColumnWidth || this.options.resourceColumnWidth || '220px';

    return typeof width === 'number' ? `${width}px` : width;
  }

  /**
   * Return the row height exposed to CSS.
   *
   * @returns {string}
   */
  getRowHeight() {
    const rowHeight = this.options.rowHeight || 46;

    return typeof rowHeight === 'number' ? `${rowHeight}px` : rowHeight;
  }

  /**
   * Create the sticky time header.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createTimeHeader(slots) {
    const timeHeader = this.createElement('div', 'tsh-rtl-time-header');
    const headerSlots = this.getTimelineHeaderSlots(slots);
    const slotGrid = this.createSlotGrid(headerSlots, {
      className: 'tsh-rtl-time-slots',
      showLabels: true,
      slotWidth: this.getTimelineHeaderSlotWidth()
    });

    timeHeader.append(slotGrid);

    return timeHeader;
  }

  /**
   * Return slots used by the sticky header.
   *
   * @param {Array<Object>} slots - Body timeline slots.
   * @returns {Array<Object>}
   */
  getTimelineHeaderSlots(slots) {
    if (this.getTimelineRange() !== 'day') {
      return slots;
    }

    return slots.filter(slot => slot.isHourSlot).map(slot => ({
      ...slot,
      isHeaderSlot: true
    }));
  }

  /**
   * Return the CSS width for each header slot.
   *
   * @returns {string}
   */
  getTimelineHeaderSlotWidth() {
    if (this.getTimelineRange() === 'day') {
      return `calc(var(--tsh-rtl-slot-width) * ${this.getTimelineSlotsPerHour()})`;
    }

    return 'var(--tsh-rtl-slot-width)';
  }

  /**
   * Create the resource title row.
   *
   * @param {{resource: Object, depth: number, hasChildren: boolean}} row - Resource row info.
   * @returns {HTMLElement}
   */
  createResourceRow(row) {
    const resource = row.resource;
    const resourceRow = this.createElement(
        'div',
        classNames('tsh-rtl-resource-row', row.depth && 'tsh-rtl-resource-row--child'),
        '',
        {
          style: {
            '--depth': row.depth
          }
        }
    );

    if (row.hasChildren) {
      resourceRow.append(this.createResourceToggle(this.getResourceId(resource)));
    }

    resourceRow.append(this.createElement('span', 'tsh-rtl-resource-title', this.getResourceTitle(resource)));

    return resourceRow;
  }

  /**
   * Create the empty resource row shown when no resources are available.
   *
   * @returns {HTMLElement}
   */
  createEmptyResourceRow() {
    return this.createElement(
        'div',
        'tsh-rtl-resource-row tsh-rtl-resource-row--empty',
        this.calendar._getLabel('noResources', 'No resources')
    );
  }

  /**
   * Create the matching empty time row so the grid keeps its layout.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @returns {HTMLElement}
   */
  createEmptyTimeRow(slots) {
    const timeRow = this.createElement('div', classNames(CLASS_NAMES.calendar.resourceTimelineTimeRow, CLASS_NAMES.calendar.slotGroup, 'tsh-rtl-time-row--empty'), '', {
      dataset: {
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
      }
    });

    timeRow.append(this.createSlotGrid(slots, {
      className: 'tsh-rtl-row-slots',
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIMELINE
    }));

    return timeRow;
  }

  /**
   * Create a collapse/expand button for a parent resource.
   *
   * @param {string} resourceId - Resource id.
   * @returns {HTMLButtonElement}
   */
  createResourceToggle(resourceId) {
    return this.createElement(
        'button',
        'tsh-rtl-toggle',
        this.state.collapsedResources.has(resourceId) ? '+' : '−',
        {
          props: {
            type: 'button'
          },
          dataset: {
            resourceToggle: resourceId
          },
          attrs: {
            'aria-label': this.calendar._getAria('toggleResource', 'Toggle resource')
          }
        }
    );
  }

  /**
   * Create one timeline row for a resource.
   *
   * @param {Object} resource - Resource object.
   * @param {Array<Object>} slots - Timeline slots.
   * @param {Array<Object>} visibleEvents - Events in the visible range.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @returns {HTMLElement}
   */
  createTimeRow(resource, slots, visibleEvents, range) {
    const resourceId = this.getResourceId(resource);
    const timeRow = this.createElement('div', classNames(CLASS_NAMES.calendar.resourceTimelineTimeRow, CLASS_NAMES.calendar.slotGroup), '', {
      dataset: {
        resourceId,
        slotGroupAxis: SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL
      }
    });

    const slotGrid = this.createSlotGrid(slots, {
      className: 'tsh-rtl-row-slots',
      resourceId,
      slotKind: SCHEDULER_SLOT_KINDS.RESOURCE_TIMELINE
    });

    const eventsLayer = this.createElement('div', 'tsh-rtl-events-layer');
    const resourceEvents = visibleEvents.filter(event => this.isEventAssignedToResource(event, resourceId) && this.isEventInRange(event, range));

    resourceEvents.forEach(event => {
      const eventElement = this.createTimelineEventElement(event, resource, range, slots);

      if (eventElement) {
        eventsLayer.append(eventElement);
      }
    });

    timeRow.append(slotGrid, eventsLayer);

    return timeRow;
  }

  /**
   * Check if an event belongs to a resource id.
   *
   * @param {Object} event - Event object.
   * @param {string} resourceId - Resource id.
   * @returns {boolean}
   */
  isEventAssignedToResource(event, resourceId) {
    return this.getEventResourceIds(event).includes(String(resourceId));
  }

  /**
   * Return normalized resource ids attached to an event.
   *
   * @param {Object} event - Event object.
   * @returns {string[]}
   */
  getEventResourceIds(event) {
    if (Array.isArray(event.resourceIds)) {
      return event.resourceIds.map(id => String(id));
    }

    if (event.resourceId !== null && event.resourceId !== undefined && event.resourceId !== '') {
      return [String(event.resourceId)];
    }

    return [];
  }

  /**
   * Check if an event intersects the visible range.
   *
   * @param {Object} event - Event object.
   * @param {{start: Date, end: Date}} range - Visible range.
   * @returns {boolean}
   */
  isEventInRange(event, range) {
    const eventStart = parseDateInput(event.start);
    const eventEnd = parseDateInput(event.end || eventStart);

    return eventStart < range.end && eventEnd >= range.start;
  }

  /**
   * Create timeline slots.
   *
   * @param {Array<Object>} slots - Timeline slots.
   * @param {Object} options - Rendering options.
   * @param {string} options.className - Slot grid class name.
   * @param {boolean} options.showLabels - Whether labels should be rendered.
   * @param {string|null} options.slotWidth - Optional local width for each slot.
   * @param {string|null} options.resourceId - Resource id for selectable slots.
   * @param {string|null} options.slotKind - Slot kind for selection/drop.
   * @returns {HTMLElement}
   */
  createSlotGrid(slots, { className, showLabels = false, slotWidth = null, resourceId = null, slotKind = null }) {
    const style = {
      '--tsh-rtl-slot-count': slots.length
    };

    if (slotWidth) {
      style['--tsh-rtl-local-slot-width'] = slotWidth;
    }

    const slotGrid = this.createElement('div', className, '', { style });

    slots.forEach(slot => {
      const slotElement = this.createElement(
          'div',
          classNames(
              CLASS_NAMES.calendar.resourceTimelineSlot,
              slotKind && CLASS_NAMES.calendar.slot,
              ...this.getDateSlotStateClasses(slot.start),
              slot.isHourSlot && 'tsh-rtl-slot--hour',
              slot.isDaySlot && 'tsh-rtl-slot--day'
          ),
          '',
          {
            dataset: {
              slotIndex: slot.index,
              slotStart: formatIsoLocal(slot.start),
              slotEnd: formatIsoLocal(slot.end),
              slotKind,
              slotAllDay: slot.isDaySlot ? 'true' : 'false',
              resourceId
            }
          }
      );

      if (showLabels && slot.label) {
        slotElement.append(
            slot.isDaySlot
                ? this.createDateLabel(slot.label, slot.start, 'tsh-rtl-time-label')
                : this.createElement('span', 'tsh-rtl-time-label', slot.label)
        );
      }

      slotGrid.append(slotElement);
    });

    return slotGrid;
  }

  /**
   * Create one positioned timeline event.
   *
   * @param {Object} event - Normalized event.
   * @param {Object} resource - Resource object.
   * @param {{start: Date, end: Date}} range - Visible date range.
   * @param {Array<Object>} slots - Timeline body slots.
   * @returns {HTMLElement|null}
   */
  createTimelineEventElement(event, resource, range, slots) {
    const position = this.getEventPosition(event, range);

    if (!position) return null;

    const eventElement = this.createEventElement(event, 'timeline', resource);

    const totalUnits = Math.max(1, slots.length);
    const leftPercent = (position.leftUnits / totalUnits) * 100;
    const widthPercent = (position.widthUnits / totalUnits) * 100;

    eventElement.style.left = `${leftPercent}%`;
    eventElement.style.width = `${widthPercent}%`;
    eventElement.style.minWidth = '26px';

    this.scheduleEventDensityUpdate(eventElement);

    return eventElement;
  }
}
