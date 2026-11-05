/**
 * TinyMiniCalendar
 * ----------------
 * Small vanilla JS month calendar used by the TinyScheduler sidebar.
 *
 * Responsibilities:
 * - Render a compact month grid.
 * - Display wrong-month background ranges with rounded start/end.
 * - Display event markers without loading data itself.
 * - Emit simple lifecycle and selection events.
 *
 * Data rule:
 * TinyMiniCalendar never fetches events. It only renders events passed by
 * TinyScheduler / TinySchedulerFrame through setEvents().
 */
/**
 * Local class name registry used only by TinyMiniCalendar.
 */
const TMC_CLASS_NAMES = Object.freeze({
    root: 'tiny-mini-calendar',
    header: 'tmc-header',
    month: 'tmc-month',
    year: 'tmc-year',
    grid: 'tmc-grid',
    day: 'tmc-day',
    today: 'tmc-day--today',
    selected: 'tmc-day--selected',
    wrongMonth: 'tmc-day--wrong-month',
    hasEvent: 'tmc-day--has-event',
    eventDots: 'tmc-event-dots',
    eventDot: 'tmc-event-dot',
    allDayBars: 'tmc-all-day-bars',
    allDayBar: 'tmc-all-day-bar',

    slideLeft: 'tmc--slide-left',
    slideRight: 'tmc--slide-right',

    weekday: 'tmc-weekday',
    dayCell: 'tmc-day-cell',
    dayCellWrongMonth: 'tmc-day-cell--wrong-month',
    dayCellWrongMonthStartRadius: 'tmc-day-cell--wrong-month-start-radius',
    dayCellWrongMonthEndRadius: 'tmc-day-cell--wrong-month-end-radius',
    dayEvents: 'tmc-day-events'
});

/**
 * Static SVG icons used by TinyMiniCalendar navigation.
 */
const TMC_ICONS = Object.freeze({
    next: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m8 4 8 8-8 8"></path>
    </svg>
`,

    previous: `
    <svg class="tsh-button-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m16 4-8 8 8 8"></path>
    </svg>
`
});

class TinyMiniCalendar extends MicroEvent {
    constructor(target, options = {}) {
        super();

        this.classes = TMC_CLASS_NAMES;
        this.rootElement = isStr(target) ? document.querySelector(target) : target;

        if (!this.rootElement) {
            throw new Error('TinyMiniCalendar target element was not found.');
        }

        this.options = mergeDeep({
            initialDate: new Date(),
            displayYear: true,
            firstDay: 1,
            fixedStartDay: true,
            useShortDays: true,
            showTodayButton: true,
            showWrongMonthDays: true,
            displayEvents: true,
            showEventDots: true,
            showAllDayBars: true,
            maxDotsPerDay: 10,
            maxBarsPerDay: 4,
            locale: GLOBAL_CONFIG.locale || 'en'
        }, options);

        this.currentDate = parseDateInput(this.options.initialDate);
        this.events = [];

        // Bind once so listeners can be removed safely in destroy().
        this.boundClick = event => this.handleClick(event);
        this.boundKeyDown = event => this.handleKeyDown(event);
    }

    /**
     * Create an element using the shared DOM helper.
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
     * Mount the mini calendar and render the initial month.
     */
    render() {
        this.rootElement.className = this.classes.root;
        this.rootElement.addEventListener('click', this.boundClick);
        this.rootElement.addEventListener('keydown', this.boundKeyDown);

        this.redraw();
        this._emit('init', {calendar: this});

        return this;
    }

    /**
     * Fully remove listeners and DOM content.
     */
    destroy() {
        this.rootElement.removeEventListener('click', this.boundClick);
        this.rootElement.removeEventListener('keydown', this.boundKeyDown);
        this.rootElement.innerHTML = '';

        this._emit('destroy', {calendar: this});

        return this;
    }

    setDate(date) {
        this.currentDate = parseDateInput(date);
        this.redraw();

        return this;
    }

    getDate() {
        return new Date(this.currentDate);
    }

    /**
     * Change visible month.
     * The optional direction controls the slide animation.
     */
    setMonth(date, direction = null) {
        const newDate = parseDateInput(date);
        const previousDate = new Date(this.currentDate);

        this.currentDate.setFullYear(newDate.getFullYear(), newDate.getMonth(), 1);

        // Keep the original jQuery mini-calendar feeling: month changes slide horizontally.
        const resolvedDirection = direction || (this.currentDate > previousDate ? 'left' : 'right');

        this.redraw(resolvedDirection);
        this._emit('monthChanged', {
            month: this.currentDate.getMonth(),
            year: this.currentDate.getFullYear(),
            date: this.getDate(),
            direction: resolvedDirection
        });

        return this;
    }

    previousMonth() {
        this.setMonth(addMonths(this.currentDate, -1), 'right');

        return this;
    }

    nextMonth() {
        this.setMonth(addMonths(this.currentDate, 1), 'left');

        return this;
    }

    today() {
        this.setDate(new Date());

        return this;
    }

    /**
     * Replace already-loaded events.
     * This component does not fetch events by itself.
     */
    setEvents(events) {
        this.events = Array.isArray(events) ? events : [];
        this.redraw();

        return this;
    }

    getEvents() {
        return this.events.slice();
    }

    refresh() {
        return this.redraw();
    }

    /**
     * Re-render the complete mini calendar.
     *
     * This is small enough to redraw fully. It keeps the implementation simple and
     * avoids diffing overhead for a tiny 6-row month grid.
     */
    redraw(direction = null) {
        this._emit('redrawStart', {calendar: this});

        this.rootElement.innerHTML = '';
        this.rootElement.classList.remove(this.classes.slideLeft, this.classes.slideRight);

        if (direction) {
            // Restart the CSS animation. This single layout read is acceptable because
            // month changes are infrequent and the mini calendar is tiny.
            void this.rootElement.offsetWidth;
            this.rootElement.classList.add(direction === 'right' ? this.classes.slideRight : this.classes.slideLeft);
        }

        const headerElement = this.createHeader();
        const gridElement = this.createGrid();

        this.rootElement.append(headerElement, gridElement);
        this._emit('redrawEnd', {calendar: this});

        return this;
    }

    /**
     * Create the month header with previous/next actions.
     */
    createHeader() {
        const headerElement = this.createElement('div');
        headerElement.className = this.classes.header;

        const previousButton = this.createNavigationButton({
            action: 'prev',
            icon: TMC_ICONS.previous,
            ariaLabel: 'Previous month'
        });

        const nextButton = this.createNavigationButton({
            action: 'next',
            icon: TMC_ICONS.next,
            ariaLabel: 'Next month'
        });

        const titleElement = this.createTitleElement();

        headerElement.append(previousButton, titleElement, nextButton);

        return headerElement;
    }

    createNavigationButton({action, icon, ariaLabel}) {
        const button = this.createElement('button');

        button.type = 'button';
        button.dataset.miniAction = action;
        button.setAttribute('aria-label', ariaLabel);

        // Safe because the SVG is static and owned by the component.
        button.innerHTML = icon;

        return button;
    }

    createTitleElement() {
        const titleElement = this.createElement('div');
        const monthLabel = new Intl.DateTimeFormat(this.options.locale, {
            month: 'long'
        }).format(this.currentDate);

        titleElement.innerHTML = `
            <strong class="${this.classes.month}">${monthLabel}</strong>
            ${this.options.displayYear ? `<span class="${this.classes.year}">${this.currentDate.getFullYear()}</span>` : ''}
        `;

        return titleElement;
    }

    /**
     * Create the grid including weekday headers and day cells.
     */
    createGrid() {
        const gridElement = this.createElement('div');

        gridElement.className = this.classes.grid;

        this.appendWeekdayLabels(gridElement);
        this.appendDayCells(gridElement);

        return gridElement;
    }

    /**
     * Render weekday labels according to firstDay and locale.
     */
    appendWeekdayLabels(gridElement) {
        const weekStart = startOfWeek(new Date(), this.options.firstDay);

        for (let index = 0; index < 7; index += 1) {
            const day = addDays(weekStart, index);
            const labelElement = this.createElement('div');

            labelElement.className = this.classes.weekday;
            labelElement.textContent = new Intl.DateTimeFormat(this.options.locale, {
                weekday: this.options.useShortDays ? 'narrow' : 'short'
            }).format(day);

            gridElement.append(labelElement);
        }
    }

    /**
     * Render visible day cells.
     *
     * DOM structure:
     * .tmc-day-cell = continuous wrong-month background.
     * .tmc-day      = circular clickable day value.
     * .tmc-day-events = bars/dots rendered below the day value.
     */
    appendDayCells(gridElement) {
        const visibleRange = this.getVisibleRange();
        const currentMonth = this.currentDate.getMonth();
        const currentYear = this.currentDate.getFullYear();
        const isCurrentMonthDate = date => date.getMonth() === currentMonth && date.getFullYear() === currentYear;

        let dayIndex = 0;

        for (
            let day = new Date(visibleRange.start);
            day < visibleRange.end;
            day = addDays(day, 1), dayIndex += 1
        ) {
            const dateKey = formatDateKey(day);
            const columnIndex = dayIndex % 7;
            const dayEvents = this.getEventsForDay(day);
            const isWrongMonth = !isCurrentMonthDate(day);

            // Only add rounding classes when the wrong-month group does not touch
            // the row border. This creates a continuous background between cells.
            const shouldRoundStart = isWrongMonth && columnIndex !== 0 && isCurrentMonthDate(addDays(day, -1));
            const shouldRoundEnd = isWrongMonth && columnIndex !== 6 && isCurrentMonthDate(addDays(day, 1));

            const dayCell = this.createDayCell({
                dateKey,
                isWrongMonth,
                shouldRoundStart,
                shouldRoundEnd
            });

            const dayElement = this.createDayElement({
                day,
                dateKey,
                isWrongMonth,
                dayEvents
            });

            const dayEventsElement = this.createDayEventsElement(dayEvents);

            dayCell.append(dayElement, dayEventsElement);
            this.mountDayCell(gridElement, dayCell, dayElement, day, dayEvents);
        }
    }

    getVisibleRange() {
        const monthStart = startOfMonth(this.currentDate);
        const monthEnd = endOfMonth(this.currentDate);

        return {
            start: startOfWeek(monthStart, this.options.firstDay),
            end: endOfWeek(monthEnd, this.options.firstDay)
        };
    }

    getEventsForDay(day) {
        return this.events.filter(event => isEventOnDate(event, day));
    }

    /**
     * Create the outer cell responsible for continuous wrong-month background.
     */
    createDayCell({dateKey, isWrongMonth, shouldRoundStart, shouldRoundEnd}) {
        const dayCell = this.createElement('div');

        dayCell.dataset.date = dateKey;
        dayCell.className = classNames(
            this.classes.dayCell,
            isWrongMonth && this.classes.dayCellWrongMonth,
            shouldRoundStart && this.classes.dayCellWrongMonthStartRadius,
            shouldRoundEnd && this.classes.dayCellWrongMonthEndRadius
        );

        return dayCell;
    }

    /**
     * Create the clickable day value.
     *
     * It is a div, not a button, because the project uses div-based event/day
     * elements and handles keyboard activation manually.
     */
    createDayElement({day, dateKey, isWrongMonth, dayEvents}) {
        const dayElement = this.createElement('div');

        dayElement.dataset.date = dateKey;
        dayElement.setAttribute('role', 'button');
        dayElement.tabIndex = 0;
        dayElement.textContent = day.getDate();
        dayElement.className = classNames(
            this.classes.day,
            isSameDay(day, new Date()) && this.classes.today,
            isSameDay(day, this.currentDate) && this.classes.selected,
            isWrongMonth && this.classes.wrongMonth,
            dayEvents.length && this.classes.hasEvent
        );

        return dayElement;
    }

    /**
     * Create the event marker wrapper for one day.
     */
    createDayEventsElement(dayEvents) {
        const eventsElement = this.createElement('div');

        eventsElement.className = this.classes.dayEvents;

        if (!this.options.displayEvents || !dayEvents.length) {
            return eventsElement;
        }

        const allDayEvents = dayEvents.filter(isAllDayEvent);
        const timedEvents = dayEvents.filter(event => !isAllDayEvent(event));

        if (this.options.showAllDayBars && allDayEvents.length) {
            eventsElement.append(this.createEventMarkers({
                events: allDayEvents,
                wrapperClassName: this.classes.allDayBars,
                markerClassName: this.classes.allDayBar,
                limit: this.options.maxBarsPerDay
            }));
        }

        if (this.options.showEventDots && timedEvents.length) {
            const visibleAllDayEvents = Math.min(timedEvents.length,this.options.maxDotsPerDay);
            if (visibleAllDayEvents>5) eventsElement.classList.add('markers-sm');
            if (visibleAllDayEvents>10) eventsElement.classList.add('markers-xs');
            eventsElement.append(this.createEventMarkers({
                events: timedEvents,
                wrapperClassName: this.classes.eventDots,
                markerClassName: this.classes.eventDot,
                limit: this.options.maxDotsPerDay
            }));
        }

        return eventsElement;
    }

    /**
     * Create dot/bar markers.
     *
     * Only backgroundColor is set inline. The CSS variable was removed because the
     * marker color does not need two different inline color sources.
     */
    createEventMarkers({events, wrapperClassName, markerClassName, limit}) {
        const wrapper = this.createElement('div');

        wrapper.className = wrapperClassName;

        events.slice(0, limit).forEach(event => {
            const marker = this.createElement('span');

            marker.className = markerClassName;
            marker.style.backgroundColor = getEventDisplayColor(event, this.options);

            wrapper.append(marker);
        });

        return wrapper;
    }

    /**
     * Append a day cell and run optional extension hooks.
     */
    mountDayCell(gridElement, dayCell, dayElement, day, dayEvents) {
        const context = {
            el: dayElement,
            cell: dayCell,
            date: new Date(day),
            events: dayEvents
        };

        if (isFn(this.options.onDayDidMount)) {
            this.options.onDayDidMount(context);
        }

        this._emit('dayDidMount', context);
        gridElement.append(dayCell);
    }

    /**
     * Select a date and emit the external callback + MicroEvent event.
     */
    selectDate(date) {
        const selectedDate = parseDateInput(date);
        const events = this.getEventsForDay(selectedDate);
        const context = {
            date: selectedDate,
            events,
            calendar: this
        };

        this.currentDate = selectedDate;
        this.redraw();

        if (isFn(this.options.onDateSelected)) {
            this.options.onDateSelected(context);
        }

        this._emit('dateSelected', context);
    }

    handleClick(event) {
        const action = event.target.closest('[data-mini-action]')?.dataset.miniAction;

        if (action === 'prev') return this.previousMonth();
        if (action === 'next') return this.nextMonth();

        const dateElement = event.target.closest(`.${this.classes.day}[data-date]`);
        if (dateElement) this.selectDate(dateElement.dataset.date);
    }

    handleKeyDown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        const dateElement = event.target.closest(`.${this.classes.day}[data-date]`);
        if (!dateElement) return;

        event.preventDefault();
        this.selectDate(dateElement.dataset.date);
    }
}
