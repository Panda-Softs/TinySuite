/**
 * TinyScheduler
 * ----------------
 * Main calendar component.
 *
 * Responsibilities:
 * - Resolve and render the active calendar view.
 * - Load events/resources through SourceManager.
 * - Manage toolbar, planning toolbar and navigation state.
 * - Dispatch public callbacks and MicroEvent events.
 * - Delegate clicks, keyboard actions, pointer interactions and event action toolbar behavior.
 *
 * Notes:
 * - TSH_TOOLBAR_ICONS is expected to be defined in defaults.js.
 * - Events are rendered by view classes, but their lifecycle hooks are managed here.
 * - View aliases allow toolbar buttons like resourceTimelineDay to map to a base view
 *   plus a planning type/range state.
 */

/**
 * Toolbar/view aliases used by setView() and toolbar buttons.
 * They map user-friendly button names to the real view and planning state.
 */
const VIEW_ALIASES = Object.freeze({
  resourceTimeGridDay: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID,
    planningRange: SCHEDULER_VIEW_NAMES.DAY
  },
  resourceTimeGridWeek: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID,
    planningRange: SCHEDULER_VIEW_NAMES.WEEK
  },
  resourceTimelineDay: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.DAY
  },
  resourceTimelineWeek: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.WEEK
  },
  resourceTimelineMonth: {
    view: SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE,
    planningType: SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE,
    planningRange: SCHEDULER_VIEW_NAMES.MONTH
  }
});

/**
 * Resolve a view name or alias to its internal view descriptor.
 *
 * @param {string} viewName - View name requested by the API or toolbar.
 * @returns {{ view: string, planningType?: string, planningRange?: string }}
 */
function resolveViewName(viewName) {
  return VIEW_ALIASES[viewName] || { view: viewName };
}

/**
 * Check whether a view is one of the two planning views.
 *
 * @param {string} viewName - Internal view name.
 * @returns {boolean}
 */
function isPlanningViewName(viewName) {
  return viewName === SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID || viewName === SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE;
}

/**
 * Return the internal planning view name for the selected planning type.
 *
 * @param {string} type - Planning type: timeGrid or timeline.
 * @returns {string}
 */
function getPlanningViewName(type) {
  return type === SCHEDULER_PLANNING_TYPE_NAMES.TIMELINE ? SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE : SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID;
}

/**
 * Normalize planning range.
 *
 * Resource time grid has no useful month layout, so month is downgraded to week.
 *
 * @param {string} type - Planning type.
 * @param {string} range - Requested planning range.
 * @returns {string}
 */
function normalizePlanningRange(type, range) {
  if (type === SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID && range === SCHEDULER_VIEW_NAMES.MONTH) return SCHEDULER_VIEW_NAMES.WEEK;
  return SCHEDULER_PLANNING_RANGES.includes(range) ? range : SCHEDULER_VIEW_NAMES.DAY;
}

/**
 * Internal view registry.
 * Aliases are also listed so toolbar active-state checks remain simple.
 */
const VIEW_CLASSES = Object.freeze({
  month: MonthView,
  week: TimeGridView,
  day: TimeGridView,
  list: ListView,

  resourceTimeline: ResourceTimelineView,
  resourceTimelineDay: ResourceTimelineView,
  resourceTimelineWeek: ResourceTimelineView,
  resourceTimelineMonth: ResourceTimelineView,

  resourceTimeGrid: ResourceTimeGridView,
  resourceTimeGridDay: ResourceTimeGridView,
  resourceTimeGridWeek: ResourceTimeGridView
});

class TinyScheduler extends MicroEvent {
  /**
   * @param {string|HTMLElement} target - CSS selector or root element.
   * @param {Object} options - Calendar options.
   */
  constructor(target, options = {}) {
    super();

    this.target = target;
    this.rootElement = this.resolveTargetElement(target);

    const resolvedLanguage = options?.locale || GLOBAL_CONFIG.locale;
    const resolvedI18n = getI18nConfig(resolvedLanguage);
    this.options = mergeDeep(DEFAULT_OPTIONS, resolvedI18n, options || {});

    // Configure storage once for this calendar instance.
    // CalendarStateStorage uses localStorage internally.
    CalendarStateStorage.configure(this.options.stateStorage);

    const storedViewState = CalendarStateStorage.getViewState();

    const resolvedInitialView = resolveViewName(storedViewState?.view ?? this.options.initialView);

    const initialPlanningType = storedViewState?.planningType || resolvedInitialView.planningType || this.options.planningType || SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID;
    const initialPlanningRange = normalizePlanningRange(initialPlanningType, storedViewState?.planningRange || resolvedInitialView.planningRange || this.options.planningRange || SCHEDULER_VIEW_NAMES.DAY);

    this.state = new CalendarState(
        this.options,
        resolvedInitialView,
        initialPlanningType,
        initialPlanningRange
    );

    this.sourceManager = new SourceManager(this);
    this.interactionManager = new InteractionManager(this);
    this.eventStore = new EventStore(this.options);
    this.resourceStore = new ResourceStore();

    // Event DOM lifecycle bookkeeping. A single event can appear multiple times,
    // for example in month cells and popovers.
    this.eventElementsById = new Map();
    this.pendingEventMounts = [];

    // Only events that actively introduced an accepted resource overlap are
    // marked. Existing events underneath remain visually unchanged.

    this.loadingRequests = 0;
    this.activeView = null;
    this.morePopover = null;
    this.eventActionToolbar = null;
    this.eventResizeState = null;
    this.nowIndicatorTimer = null;
    this.ignoreNextClick = false;

    this.selectedEventId = null;
    this.selectedEventElement = null;
    this.selectedSlotElements = [];
    this.slotSelection = null;
    this.lastSelectionInfo = null;

    // Bind handlers once to allow safe removeEventListener() in destroy().
    this.boundRootClick = event => this.handleRootClick(event);
    this.boundRootKeyDown = event => this.handleRootKeyDown(event);
    this.boundRootPointerDown = event => this.handleRootPointerDown(event);
    this.boundSlotPointerMove = event => this.handleSlotPointerMove(event);
    this.boundSlotPointerUp = event => this.handleSlotPointerUp(event);
    this.boundEventResizePointerMove = event => this.handleEventResizePointerMove(event);
    this.boundEventResizePointerUp = event => this.handleEventResizePointerUp(event);
    this.boundEventActionToolbarUpdate = () => this.updateEventActionToolbarPosition();

    this.normalizeInitialSources();
    this._notify('init');
  }

  /**
   * Resolve the calendar target element.
   *
   * @param {string|HTMLElement} target - CSS selector or element.
   * @returns {HTMLElement}
   */
  resolveTargetElement(target) {
    const element = isStr(target) ? document.querySelector(target) : target;

    if (!element) {
      throw new Error('TinyScheduler target element was not found.');
    }

    return element;
  }

  /**
   * Normalize initial event/resource sources so SourceManager can load them uniformly.
   */
  normalizeInitialSources() {
    const eventSources = [];

    if (!isNil(this.options.events) && (!Array.isArray(this.options.events) || this.options.events.length)) {
      eventSources.push(this.options.events);
    }

    eventSources.push(...this.normalizeSourceList(this.options.eventSources));
    this.sourceManager.setEventSources(eventSources);

    const resourceSources = [];

    if (!isNil(this.options.resources) && (!Array.isArray(this.options.resources) || this.options.resources.length)) {
      resourceSources.push(this.options.resources);
    }

    resourceSources.push(...this.normalizeSourceList(this.options.resourceSources));
    this.sourceManager.setResourceSources(resourceSources);
  }

  /**
   * Convert one source, many sources, or null into a clean source array.
   *
   * @param {*} sources - Source or source array.
   * @returns {Array}
   */
  normalizeSourceList(sources) {
    return Array.isArray(sources) ? sources : [sources].filter(Boolean);
  }

  /**
   * Create a DOM element with common project options.
   *
   * This delegates to the shared createDomElement() helper, so the main
   * component and view classes use the same DOM creation path.
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

  _getLabel(key, fallback = '') {
    return this.options.labels?.[key] || GLOBAL_CONFIG.labels?.[key] || fallback || key;
  }

  _getTooltip(key, fallback = '') {
    return this.options.tooltips?.[key] || GLOBAL_CONFIG.tooltips?.[key] || this._getLabel(key, fallback);
  }

  _getAria(key, fallback = '') {
    return this.options.aria?.[key] || GLOBAL_CONFIG.aria?.[key] || fallback || key;
  }

  /**
   * Return trusted icon HTML for toolbar and event action buttons.
   *
   * User-defined `options.toolbarIcons` entries have priority over the default
   * `TSH_TOOLBAR_ICONS`. This allows applications to replace SVG icons with
   * framework icons, for example Font Awesome `<i>` tags, without redefining
   * the whole toolbar button behavior.
   *
   * @param {string} name - Icon/button name.
   * @param {string} fallbackIconHtml - Optional fallback icon HTML.
   * @returns {string}
   */
  getToolbarIconHtml(name, fallbackIconHtml = '') {
    const customIcons = this.options.toolbarIcons || {};
    const hasCustomIcon = Object.prototype.hasOwnProperty.call(customIcons, name);
    const iconHtml = hasCustomIcon
        ? customIcons[name]
        : fallbackIconHtml || TSH_TOOLBAR_ICONS[name] || '';

    return this.normalizeToolbarIconHtml(iconHtml);
  }

  /**
   * Normalize trusted icon HTML.
   *
   * TinyScheduler accepts SVG strings and regular icon markup. When existing
   * FullCalendar-style icon markup is passed as `<span class="fc-icon ...">`,
   * it is converted to `<i>` so font icons behave like icons rather than text.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {string}
   */
  normalizeToolbarIconHtml(iconHtml) {
    if (!isStr(iconHtml)) {
      return '';
    }

    const trimmedIconHtml = iconHtml.trim();

    if (!trimmedIconHtml) {
      return '';
    }

    if (/^<span\b/i.test(trimmedIconHtml) && /\bfc-icon\b/i.test(trimmedIconHtml)) {
      return trimmedIconHtml
          .replace(/^<span\b/i, '<i')
          .replace(/<\/span>$/i, '</i>');
    }

    return trimmedIconHtml;
  }

  /**
   * Return a simple icon type used for styling hooks.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {'svg'|'html'}
   */
  getToolbarIconType(iconHtml) {
    return /^<svg\b/i.test(this.normalizeToolbarIconHtml(iconHtml)) ? 'svg' : 'html';
  }

  /**
   * Convert event name to option callback name.
   * Example: eventsChanged -> onEventsChanged.
   *
   * @param {string} eventName - Internal/public event name.
   * @returns {string}
   */
  getCallbackName(eventName) {
    return `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
  }

  /**
   * Build a normalized callback/event context.
   *
   * @param {Object} extra - Extra context values.
   * @returns {Object}
   */
  getContext(extra = {}) {
    return {
      calendar: this,
      view: this.state.currentView,
      date: this.state.currentDate,
      range: this.state.visibleRange,
      ...extra
    };
  }

  /**
   * Trigger option callback and MicroEvent event.
   *
   * @param {string} eventName - Event name.
   * @param {Object} payload - Additional context payload.
   * @returns {Object} Generated context.
   */
  _notify(eventName, payload = {}) {
    const context = this.getContext({ reason: eventName, ...payload });
    const callback = this.options[this.getCallbackName(eventName)];

    if (isFn(callback)) {
      callback.call(this, context);
    }

    this._emit(eventName, context);

    return context;
  }

  /**
   * Track async loading state with a small request counter.
   *
   * @param {boolean} isLoading - True when a load starts, false when one ends.
   * @param {string} reason - Loading reason.
   */
  _setLoading(isLoading, reason = 'refresh') {
    this.loadingRequests += isLoading ? 1 : -1;

    if (this.loadingRequests < 0) {
      this.loadingRequests = 0;
    }

    const context = this.getContext({
      isLoading: this.loadingRequests > 0,
      pendingRequests: this.loadingRequests,
      reason
    });

    if (isFn(this.options.loading)) {
      this.options.loading.call(this, context.isLoading, context);
    }

    this._emit(isLoading ? 'loadingStart' : 'loadingEnd', context);
    this._emit('loadingChanged', context);
  }

  /**
   * Mount the calendar, bind root events, fetch data and draw the first view.
   *
   * @returns {Promise<TinyScheduler>}
   */
  async render() {
    this._notify('beforeRender');

    this.drawBase();
    this.bindRootEvents();

    await this.refresh();

    this._notify('afterRender');

    return this;
  }

  /**
   * Attach root delegated event listeners.
   */
  bindRootEvents() {
    this.rootElement.addEventListener('click', this.boundRootClick);
    this.rootElement.addEventListener('keydown', this.boundRootKeyDown);
    this.rootElement.addEventListener('pointerdown', this.boundRootPointerDown);
    this.rootElement.addEventListener('scroll', this.boundEventActionToolbarUpdate, true);
    window.addEventListener('resize', this.boundEventActionToolbarUpdate);
  }

  /**
   * Remove root delegated event listeners.
   */
  unbindRootEvents() {
    this.rootElement.removeEventListener('click', this.boundRootClick);
    this.rootElement.removeEventListener('keydown', this.boundRootKeyDown);
    this.rootElement.removeEventListener('pointerdown', this.boundRootPointerDown);
    this.rootElement.removeEventListener('scroll', this.boundEventActionToolbarUpdate, true);
    window.removeEventListener('resize', this.boundEventActionToolbarUpdate);
    document.removeEventListener('pointermove', this.boundSlotPointerMove);
    document.removeEventListener('pointerup', this.boundSlotPointerUp);
    document.removeEventListener('pointermove', this.boundEventResizePointerMove);
    document.removeEventListener('pointerup', this.boundEventResizePointerUp);
  }

  /**
   * Draw the persistent calendar shell.
   * The active view is mounted inside .tsh-view-host.
   */
  drawBase() {
    this.rootElement.className = CLASS_NAMES.calendar.root;
    this.rootElement.innerHTML = '';
    this.eventActionToolbar = null;

    if (this.options.showToolbar) {
      this.rootElement.append(this.renderToolbar());
    }

    const body = this.createElement(CLASS_NAMES.calendar.bodyTag || 'div', CLASS_NAMES.calendar.body);
    const viewHost = this.createElement('div', CLASS_NAMES.calendar.viewHost || 'tsh-view-host');

    body.append(viewHost);
    this.viewHost = viewHost;
    this.rootElement.append(body);
    this.ensureEventActionToolbar();
  }

  /**
   * Render the main toolbar with left/center/right chunks.
   *
   * @returns {HTMLElement}
   */
  renderToolbar() {
    const toolbar = this.createElement('div', CLASS_NAMES.calendar.toolbar);

    ['left', 'center', 'right'].forEach(position => {
      toolbar.append(this.renderToolbarChunk(position));
    });

    return toolbar;
  }

  /**
   * Render one toolbar chunk and group configured buttons when needed.
   *
   * @param {string} position - left, center, or right.
   * @returns {HTMLElement}
   */
  renderToolbarChunk(position) {
    const chunk = this.createElement('div', CLASS_NAMES.calendar.toolbarChunk, '', {
      dataset: {
        toolbarPosition: position
      }
    });

    let currentButtonGroup = null;

    const appendCurrentGroup = () => {
      if (currentButtonGroup?.childElementCount) {
        chunk.append(currentButtonGroup);
      }

      currentButtonGroup = null;
    };

    (this.options.toolbar[position] || []).forEach(name => {
      const item = this.renderToolbarItem(name);

      if (name === 'title') {
        appendCurrentGroup();
        chunk.append(item);
        return;
      }

      if (this.shouldGroupToolbarButton(name, position)) {
        if (!currentButtonGroup) {
          currentButtonGroup = this.createElement('div', CLASS_NAMES.calendar.buttonGroup);
        }

        currentButtonGroup.append(item);
        return;
      }

      appendCurrentGroup();
      chunk.append(item);
    });

    appendCurrentGroup();

    return chunk;
  }

  /**
   * Decide whether a toolbar button should be visually grouped.
   *
   * @param {string} name - Toolbar item name.
   * @param {string} position - Toolbar chunk position.
   * @returns {boolean}
   */
  shouldGroupToolbarButton(name, position) {
    const buttonConfig = this.getToolbarButtonConfig(name);

    if (buttonConfig.group === true) return true;
    if (buttonConfig.group === false) return false;

    // Only navigation arrows are merged in the left toolbar.
    // sidebarToggle and today stay standalone.
    if (position === 'left') {
      return ['prev', 'next', 'prevYear', 'nextYear'].includes(name);
    }

    // View buttons are grouped on the right, including the planning umbrella button.
    if (position === 'right') {
      return name === 'planning' || buttonConfig.type === 'view';
    }

    return false;
  }

  /**
   * Render planning toolbar for Resource Time Grid / Resource Timeline.
   *
   * @returns {HTMLElement|null}
   */
  renderPlanningToolbar() {
    if (!this.isPlanningView()) return null;

    const toolbar = this.createElement('div', 'tsh-planning-toolbar');
    const typeGroup = this.createPlanningToolbarGroup({
      label: this._getLabel('planningView', 'Type'),
      buttons: [
        this.createPlanningSegmentButton({
          label: this._getLabel('resourceTimeGrid', 'Grid'),
          tooltip: this._getTooltip('resourceTimeGrid', 'Resource time grid'),
          active: this.isPlanningType('timeGrid'),
          datasetName: 'planningType',
          datasetValue: 'timeGrid'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('resourceTimeline', 'Timeline'),
          tooltip: this._getTooltip('resourceTimeline', 'Resource timeline'),
          active: this.isPlanningType('timeline'),
          datasetName: 'planningType',
          datasetValue: 'timeline'
        })
      ]
    });

    const rangeGroup = this.createPlanningToolbarGroup({
      label: this._getLabel('period', 'Period'),
      buttons: [
        this.createPlanningSegmentButton({
          label: this._getLabel('day', 'Day'),
          tooltip: this._getTooltip('day', 'Day'),
          active: this.isPlanningRange('day'),
          datasetName: 'planningRange',
          datasetValue: 'day'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('week', 'Week'),
          tooltip: this._getTooltip('week', 'Week'),
          active: this.isPlanningRange('week'),
          datasetName: 'planningRange',
          datasetValue: 'week'
        }),
        this.createPlanningSegmentButton({
          label: this._getLabel('month', 'Month'),
          tooltip: this._getTooltip('month', 'Month'),
          active: this.isPlanningRange('month'),
          disabled: this.isPlanningType('timeGrid'),
          datasetName: 'planningRange',
          datasetValue: 'month'
        })
      ]
    });

    toolbar.append(typeGroup, rangeGroup);

    return toolbar;
  }

  /**
   * Create one planning toolbar group: label + segmented button group.
   *
   * @param {Object} config - Group config.
   * @param {string} config.label - Group label.
   * @param {HTMLElement[]} config.buttons - Buttons to append.
   * @returns {HTMLElement}
   */
  createPlanningToolbarGroup({ label, buttons }) {
    const group = this.createElement('div', 'tsh-planning-toolbar-group');
    const labelElement = this.createElement('span', 'tsh-planning-toolbar-label', label);
    const buttonGroup = this.createElement('div', CLASS_NAMES.calendar.buttonGroup, buttons);

    group.append(labelElement, buttonGroup);

    return group;
  }

  /**
   * Create one planning segmented button.
   *
   * @param {Object} config - Button config.
   * @param {string} config.label - Visible label.
   * @param {string} config.tooltip - Tooltip text.
   * @param {boolean} config.active - Active state.
   * @param {boolean} config.disabled - Disabled state.
   * @param {string} config.datasetName - Dataset key without "data-".
   * @param {string} config.datasetValue - Dataset value.
   * @returns {HTMLButtonElement}
   */
  createPlanningSegmentButton(config) {
    const button = this.createElement(
        'button',
        classNames(
            CLASS_NAMES.calendar.button,
            'tsh-button--segment',
            // Keep the legacy classes for consumers that still target them.
            'tsh-segmented-button',
            config.active && CLASS_NAMES.calendar.viewButtonActive,
            config.active && 'tsh-segmented-button-active'
        ),
        config.label,
        {
          props: {
            type: 'button',
            disabled: Boolean(config.disabled)
          },
          dataset: {
            [config.datasetName]: config.datasetValue,
            tooltip: config.tooltip || config.label
          },
          attrs: {
            'aria-pressed': String(Boolean(config.active)),
            ...(config.disabled ? { 'aria-disabled': 'true' } : {})
          }
        }
    );

    return button;
  }

  /**
   * Rebuild the planning toolbar after a view/type/range change.
   *
   * @returns {TinyScheduler}
   */
  refreshPlanningToolbar() {
    this.rootElement.querySelector('.tsh-planning-toolbar')?.remove();

    const planningToolbar = this.renderPlanningToolbar();

    if (planningToolbar && this.options.showToolbar) {
      const toolbar = this.rootElement.querySelector(`.${CLASS_NAMES.calendar.toolbar}`);
      toolbar?.after(planningToolbar);
    }

    return this;
  }

  /**
   * Render one toolbar item.
   * Supports text, legacy text icons and trusted SVG icons.
   *
   * @param {string} name - Toolbar item name.
   * @returns {HTMLElement}
   */
  renderToolbarItem(name) {
    if (name === 'title') {
      return this.renderToolbarTitle();
    }

    const buttonConfig = this.getToolbarButtonConfig(name);
    const isActiveViewButton = this.isToolbarViewButtonActive(name);

    const button = this.createElement('button', this.getToolbarButtonClassName(buttonConfig, isActiveViewButton), '', {
      props: {
        type: 'button',
        disabled: Boolean(buttonConfig.disabled),
        hidden: Boolean(buttonConfig.hidden)
      },
      dataset: {
        tshButton: name
      }
    });

    this.applyToolbarButtonMetadata(button, name, buttonConfig, isActiveViewButton);
    this.appendToolbarButtonContent(button, buttonConfig);

    return button;
  }

  /**
   * Render the current calendar title.
   *
   * @returns {HTMLHeadingElement}
   */
  renderToolbarTitle() {
    return this.createElement('h2', CLASS_NAMES.calendar.title, this.getTitle());
  }

  /**
   * Build toolbar button classes.
   *
   * @param {Object} buttonConfig - Normalized button config.
   * @param {boolean} isActiveViewButton - Whether the view button is active.
   * @returns {string}
   */
  getToolbarButtonClassName(buttonConfig, isActiveViewButton) {
    const isIconOnly = Boolean(
        buttonConfig.icon || buttonConfig.iconHtml || buttonConfig.svg
    ) && !buttonConfig.text;

    return classNames(
        CLASS_NAMES.calendar.button,
        isIconOnly && 'tsh-button--icon',
        buttonConfig.type === 'view' && CLASS_NAMES.calendar.viewButton,
        isActiveViewButton && CLASS_NAMES.calendar.viewButtonActive,
        buttonConfig.className
    );
  }

  /**
   * Determine whether a toolbar view button is active.
   *
   * @param {string} name - Toolbar item name.
   * @returns {boolean}
   */
  isToolbarViewButtonActive(name) {
    if (name === 'planning') {
      return this.isPlanningView();
    }

    if (this.isView(name)) {
      return true;
    }

    return Boolean(VIEW_ALIASES[name] && this.isView(VIEW_ALIASES[name].view));
  }

  /**
   * Apply tooltip, aria, pressed, disabled and hidden states to a toolbar button.
   *
   * @param {HTMLButtonElement} button - Button element.
   * @param {string} name - Toolbar item name.
   * @param {Object} buttonConfig - Normalized button config.
   * @param {boolean} isActiveViewButton - Active state for view buttons.
   */
  applyToolbarButtonMetadata(button, name, buttonConfig, isActiveViewButton) {
    const tooltip = buttonConfig.tooltip || this._getTooltip(name, buttonConfig.text || name);
    const ariaLabel = buttonConfig.ariaLabel || tooltip || buttonConfig.text || name;

    if (tooltip) {
      button.dataset.tooltip = tooltip;
    }

    // Icon-only buttons need an explicit accessible label.
    if (!buttonConfig.text || buttonConfig.icon || buttonConfig.iconHtml || buttonConfig.svg) {
      button.setAttribute('aria-label', ariaLabel);
    }

    if (buttonConfig.type === 'view') {
      button.setAttribute('aria-pressed', String(isActiveViewButton));
    }
  }

  /**
   * Append icon/text content to a toolbar button.
   *
   * Priority:
   * 1. iconHtml - trusted inline HTML icon, usually SVG or `<i>`.
   * 2. svg - backward-compatible trusted SVG string.
   * 3. icon - legacy text icon.
   * 4. text - visible label.
   *
   * @param {HTMLButtonElement} button - Button element.
   * @param {Object} buttonConfig - Normalized button config.
   */
  appendToolbarButtonContent(button, buttonConfig) {
    const iconHtml = buttonConfig.iconHtml || buttonConfig.svg;

    if (iconHtml) {
      button.append(this.createToolbarIconHtml(iconHtml));
    } else if (buttonConfig.icon) {
      button.append(this.createToolbarTextIcon(buttonConfig.icon));
    }

    if (buttonConfig.text) {
      button.append(this.createToolbarButtonText(buttonConfig.text));
    }
  }

  /**
   * Create an icon wrapper containing trusted icon HTML.
   *
   * The wrapper gets a type modifier so CSS can size SVG and font icons
   * independently when needed.
   *
   * @param {string} iconHtml - Trusted icon HTML.
   * @returns {HTMLSpanElement}
   */
  createToolbarIconHtml(iconHtml) {
    const normalizedIconHtml = this.normalizeToolbarIconHtml(iconHtml);

    return this.createElement(
        'span',
        classNames(
            CLASS_NAMES.calendar.buttonIcon,
            `tsh-button-icon--${this.getToolbarIconType(normalizedIconHtml)}`
        ),
        '',
        {
          html: normalizedIconHtml
        }
    );
  }

  /**
   * Backward-compatible alias for old internal calls.
   *
   * @param {string} svg - Trusted SVG string.
   * @returns {HTMLSpanElement}
   */
  createToolbarSvgIcon(svg) {
    return this.createToolbarIconHtml(svg);
  }

  /**
   * Create a text icon wrapper.
   *
   * @param {string} iconText - Text icon.
   * @returns {HTMLSpanElement}
   */
  createToolbarTextIcon(iconText) {
    return this.createElement('span', CLASS_NAMES.calendar.buttonIcon, iconText);
  }

  /**
   * Create visible toolbar button text.
   *
   * @param {string} textValue - Button label.
   * @returns {HTMLSpanElement}
   */
  createToolbarButtonText(textValue) {
    return this.createElement('span', CLASS_NAMES.calendar.buttonText, textValue);
  }

  /**
   * Normalize one custom button definition.
   *
   * Custom button definitions are shared by the main toolbar and the floating
   * event action toolbar so consumers do not need two parallel button APIs.
   *
   * @param {string} name - Custom button name.
   * @returns {Object|null}
   */
  getCustomButtonConfig(name) {
    const customButton = this.options.customButtons?.[name];

    if (!customButton) {
      return null;
    }

    const iconHtml = this.getToolbarIconHtml(name, customButton.iconHtml || customButton.svg || '');

    return {
      name,
      type: 'custom',
      ...customButton,
      iconHtml
    };
  }

  /**
   * Return a normalized toolbar button config.
   *
   * Priority:
   * 1. custom button from options.customButtons.
   * 2. built-in navigation button.
   * 3. planning button.
   * 4. regular view button.
   * 5. fallback custom-like button.
   *
   * @param {string} name - Toolbar button name.
   * @returns {Object}
   */
  getToolbarButtonConfig(name) {
    const customButton = this.getCustomButtonConfig(name);

    if (customButton) {
      return customButton;
    }

    const navigationButtons = {
      prev: {
        iconHtml: this.getToolbarIconHtml('prev'),
        text: '',
        tooltip: this._getTooltip('previous', 'Previous'),
        ariaLabel: this._getTooltip('previous', 'Previous')
      },
      next: {
        iconHtml: this.getToolbarIconHtml('next'),
        text: '',
        tooltip: this._getTooltip('next', 'Next'),
        ariaLabel: this._getTooltip('next', 'Next')
      },
      prevYear: {
        iconHtml: this.getToolbarIconHtml('prevYear'),
        text: '',
        tooltip: this._getTooltip('previousYear', 'Previous year'),
        ariaLabel: this._getTooltip('previousYear', 'Previous year')
      },
      nextYear: {
        iconHtml: this.getToolbarIconHtml('nextYear'),
        text: '',
        tooltip: this._getTooltip('nextYear', 'Next year'),
        ariaLabel: this._getTooltip('nextYear', 'Next year')
      },
      today: {
        iconHtml: this.getToolbarIconHtml('today'),
        text: '',
        tooltip: this._getTooltip('today', 'Today'),
        ariaLabel: this._getTooltip('today', 'Today')
      },
      addEvent: {
        iconHtml: this.getToolbarIconHtml('addEvent'),
        text: '',
        tooltip: this._getTooltip('addEvent', 'Add event'),
        ariaLabel: this._getTooltip('addEvent', 'Add event')
      },
      deleteEvent: {
        iconHtml: this.getToolbarIconHtml('deleteEvent'),
        text: '',
        tooltip: this._getTooltip('deleteEvent', 'Delete selected event'),
        ariaLabel: this._getTooltip('deleteEvent', 'Delete selected event'),
        disabled: !this.selectedEventId
      }
    };

    if (navigationButtons[name]) {
      return {
        name,
        type: 'navigation',
        ...navigationButtons[name]
      };
    }

    if (name === 'planning') {
      return {
        name,
        type: 'view',
        text: this._getLabel('planning', 'Planning'),
        tooltip: this._getTooltip('planning', 'Planning')
      };
    }

    if (VIEW_CLASSES[name] || VIEW_ALIASES[name]) {
      return {
        name,
        type: 'view',
        text: this._getLabel(this.getViewLabelKey(name), name)
      };
    }

    return {
      name,
      type: 'custom',
      text: name
    };
  }

  getViewLabelKey(viewName) {
    if (viewName.includes('resourceTimeline')) return 'resourceTimeline';
    if (viewName.includes('resourceTimeGrid')) return 'resourceTimeGrid';
    return viewName;
  }

  /**
   * Rebuild the toolbar while preserving the current calendar state.
   *
   * @returns {TinyScheduler}
   */
  refreshToolbar() {
    const oldToolbar = this.rootElement.querySelector(`.${CLASS_NAMES.calendar.toolbar}`);

    if (oldToolbar) {
      oldToolbar.replaceWith(this.renderToolbar());
    }

    return this;
  }

  /**
   * Fetch events/resources for the current visible range and redraw the calendar.
   *
   * @returns {Promise<TinyScheduler>}
   */
  async refresh() {
    this._notify('beforeRefresh');
    this._setLoading(true, 'refresh');

    try {
      const range = this.getVisibleRangeForCurrentView();

      this._notify('eventsLoadStart');

      const [events, resources] = await Promise.all([
        this.sourceManager.fetchEvents(range),
        this.sourceManager.fetchResources(range)
      ]);

      this.eventStore.setEvents(events);
      this.resourceStore.setResources(resources);

      this._notify('eventsLoadEnd', { events });
      this._notify('resourcesLoadEnd', { resources });
      this._notify('eventsChanged', { events });
      this._notify('resourcesChanged', { resources });

      this.redraw();
      this.scheduleAutoScrollToDate(this.state.currentDate);
      this._notify('refreshEnd');
    } catch (error) {
      this._notify('error', { error });
    } finally {
      this._setLoading(false, 'refresh');
      this._notify('afterRefresh');
    }

    return this;
  }

  redraw() {
    this._notify('beforeRedraw');
    this._notify('beforeDraw');

    this.closeMorePopover();

    // Important: the selected event element belongs to the old view DOM.
    // Hide the toolbar before the view is destroyed to avoid stale positioning.
    this.hideEventActionToolbar();

    if (this.selectedEventElement?.isConnected) {
      this.selectedEventElement.classList.remove(CLASS_NAMES.calendar.eventSelected);
    }

    this.selectedEventElement = null;

    this._unmountViewEvents();

    const ViewClass = VIEW_CLASSES[this.state.currentView];

    if (!ViewClass) {
      throw new Error(`Unsupported view: ${this.state.currentView}`);
    }

    if (this.activeView) {
      this.activeView.destroy();
    }

    this.activeView = new ViewClass(this);

    const viewElement = this.activeView.render();

    if (this.viewHost) {
      this.viewHost.innerHTML = '';
      this.viewHost.append(viewElement);
    }

    this.state.visibleRange = this.activeView.getVisibleRange();

    this.refreshToolbar();
    this.refreshPlanningToolbar();
    this.notifyViewDidMount(viewElement);
    this._flushEventMounts();

    // Restore only if the event really exists in the new rendered view.
    this.restoreSelectedEventElement();

    this.refreshActionToolbarState();

    this._notify('draw');
    this._notify('afterDraw');
    this._notify('redrawEnd');

    this.scheduleNowIndicatorRefresh();

    return this;
  }

  /**
   * Clear the pending current-time indicator timer.
   *
   * @returns {TinyScheduler}
   */
  clearNowIndicatorTimer() {
    if (this.nowIndicatorTimer) {
      root.clearTimeout(this.nowIndicatorTimer);
      this.nowIndicatorTimer = null;
    }

    return this;
  }

  /**
   * Return true when the active view currently needs live now updates.
   * We only keep the clock alive when today is inside the visible range and
   * the active view supports a now indicator. This avoids unnecessary redraws
   * in month/list or in historical/future ranges.
   *
   * @returns {boolean}
   */
  shouldScheduleNowIndicatorRefresh() {
    if (this.options.showNowIndicator === false) return false;
    if (!this.activeView?.supportsNowIndicator?.()) return false;

    const range = this.state.visibleRange;
    const now = new Date();

    return Boolean(range)
        && now >= range.start
        && now < range.end;
  }

  /**
   * Schedule a lightweight redraw at the next minute boundary.
   * The now indicator is purely visual, so this does not refetch events or
   * resources. It only redraws the current in-memory view.
   *
   * @returns {TinyScheduler}
   */
  scheduleNowIndicatorRefresh() {
    this.clearNowIndicatorTimer();

    if (!this.shouldScheduleNowIndicatorRefresh()) {
      return this;
    }

    const now = new Date();
    const delay = Math.max(
        1000,
        60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 80
    );

    this.nowIndicatorTimer = root.setTimeout(() => {
      this.nowIndicatorTimer = null;

      if (this.rootElement?.isConnected) {
        this.activeView?.refreshNowIndicator?.();
        this.scheduleNowIndicatorRefresh();
      }
    }, delay);

    return this;
  }

  /**
   * Notify the viewDidMount option callback.
   *
   * @param {HTMLElement} viewElement - Mounted view root element.
   */
  notifyViewDidMount(viewElement) {
    if (!isFn(this.options.viewDidMount)) return;

    this.options.viewDidMount.call(this, {
      calendar: this,
      el: viewElement,
      view: {
        name: this.state.currentView,
        type: this.getViewType(this.state.currentView)
      },
      date: this.state.currentDate,
      range: this.state.visibleRange
    });
  }

  /**
   * Return a stable key for one scroll container.
   *
   * @param {HTMLElement} scrollElement - Scroll container.
   * @param {number} index - Fallback index.
   * @returns {string}
   */
  getScrollStateKey(scrollElement, index) {
    const stableClass = [
      'tsh-time-grid-scroll',
      'tsh-rtg-scroll',
      'tsh-rtl-scroller',
      CLASS_NAMES.calendar.list
    ].find(className => scrollElement.classList.contains(className));

    return scrollElement.dataset.scrollKey || stableClass || `scroll-${index}`;
  }

  /**
   * Capture scrollTop/scrollLeft for mounted scheduler scroll containers.
   *
   * @returns {Array<Object>}
   */
  captureScrollState() {
    return Array.from(
        this.rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.scrollContainer}`)
    ).map((scrollElement, index) => ({
      key: this.getScrollStateKey(scrollElement, index),
      index,
      scrollTop: scrollElement.scrollTop,
      scrollLeft: scrollElement.scrollLeft
    }));
  }

  /**
   * Restore captured scroll state after local or fallback refresh.
   *
   * @param {Array<Object>} scrollState - Captured scroll values.
   * @returns {TinyScheduler}
   */
  restoreScrollState(scrollState = []) {
    if (!scrollState.length) return this;

    requestAnimationFrame(() => {
      const scrollElements = Array.from(
          this.rootElement.querySelectorAll(`.${CLASS_NAMES.calendar.scrollContainer}`)
      );

      scrollState.forEach(item => {
        const scrollElement = scrollElements.find((element, index) => (
          this.getScrollStateKey(element, index) === item.key
        )) || scrollElements[item.index];

        if (!scrollElement) return;

        scrollElement.scrollTop = item.scrollTop;
        scrollElement.scrollLeft = item.scrollLeft;
      });

      this.updateEventActionToolbarPosition();
    });

    return this;
  }

  /**
   * Redraw the full active view but keep the current scroll position.
   * Used only as fallback when a view cannot refresh event DOM locally.
   *
   * @returns {TinyScheduler}
   */
  redrawPreservingScroll() {
    const scrollState = this.captureScrollState();

    this.redraw();
    this.restoreScrollState(scrollState);

    return this;
  }

  /**
   * Refresh event rendering after add/update/move/delete.
   * The active view gets the first chance to update only its event layers.
   * If it cannot, TinyScheduler falls back to a full redraw with scroll restore.
   *
   * @param {Object} mutation - Event mutation metadata.
   * @returns {TinyScheduler}
   */
  refreshEventDisplay(mutation = {}) {
    const scrollState = this.captureScrollState();

    this.closeMorePopover();

    try {
      if (this.activeView?.refreshEvents?.(mutation) === true) {
        this._flushEventMounts();
        this.restoreSelectedEventElement();
        this.refreshToolbar();
        this.refreshActionToolbarState();
        this.restoreScrollState(scrollState);

        return this;
      }
    } catch (error) {
      this._notify('error', { error, mutation, reason: 'eventRefresh' });
    }

    this.redraw();
    this.restoreScrollState(scrollState);

    return this;
  }

  /**
   * Redraw one event through the lightweight event refresh pipeline.
   *
   * @param {string} eventId - Event id.
   * @returns {TinyScheduler}
   */
  redrawEvent(eventId) {
    const event = this.eventStore.getEventById(eventId);

    return this.refreshEventDisplay({
      type: 'refresh',
      eventId: String(eventId),
      event,
      oldEvent: event,
      reason: 'redrawEvent'
    });
  }

  /**
   * Queue one event element for eventDidMount.
   *
   * @param {HTMLElement} element - Event DOM element.
   * @param {Object} event - Normalized event.
   * @param {Object|null} resource - Resource context.
   */
  _queueEventMount(element, event, resource = null) {
    if (element) {
      element._tshEvent = event;
      element._tshResource = resource;
    }

    this.pendingEventMounts.push({ element, event, resource });
  }

  /**
   * Flush pending eventDidMount callbacks after the view is mounted.
   */
  _flushEventMounts() {
    this.pendingEventMounts.forEach(({ element, event, resource }) => {
      if (!this.eventElementsById.has(event.id)) {
        this.eventElementsById.set(event.id, new Set());
      }

      this.eventElementsById.get(event.id).add(element);

      if (isFn(this.options.eventDidMount)) {
        this.options.eventDidMount.call(this, {
          calendar: this,
          el: element,
          event,
          view: this.state.currentView,
          resource
        });
      }
    });

    this.pendingEventMounts = [];
  }

  /**
   * Notify eventWillUnmount for a single mounted event element and unregister it.
   *
   * @param {HTMLElement} element - Mounted event element.
   * @param {Object|null} eventOverride - Event data to use after deletion.
   * @returns {TinyScheduler}
   */
  _unmountEventElement(element, eventOverride = null) {
    const eventId = element?.dataset?.eventId;

    if (!eventId) return this;

    const event = eventOverride || element._tshEvent || this.eventStore.getEventById(eventId);

    if (isFn(this.options.eventWillUnmount)) {
      this.options.eventWillUnmount.call(this, {
        calendar: this,
        el: element,
        event,
        view: this.state.currentView
      });
    }

    const elements = this.eventElementsById.get(String(eventId));

    if (elements) {
      elements.delete(element);

      if (!elements.size) {
        this.eventElementsById.delete(String(eventId));
      }
    }

    if (this.selectedEventElement === element) {
      this.selectedEventElement = null;
    }

    return this;
  }

  /**
   * Unmount all event elements contained in a DOM subtree.
   *
   * @param {HTMLElement} rootElement - Container to inspect.
   * @param {Object|null} eventOverride - Optional deleted event data.
   * @returns {TinyScheduler}
   */
  _unmountEventElementsIn(rootElement, eventOverride = null) {
    if (!rootElement) return this;

    rootElement
        .querySelectorAll?.(SCHEDULER_SELECTORS.event)
        .forEach(element => this._unmountEventElement(element, eventOverride));

    return this;
  }

  /**
   * Notify eventWillUnmount before clearing event element references.
   */
  _unmountViewEvents() {
    if (isFn(this.options.eventWillUnmount)) {
      this.eventElementsById.forEach((elements, eventId) => {
        elements.forEach(element => {
          this.options.eventWillUnmount.call(this, {
            calendar: this,
            el: element,
            event: element._tshEvent || this.eventStore.getEventById(eventId),
            view: this.state.currentView
          });
        });
      });
    }

    this.eventElementsById.clear();
  }

  getVisibleRangeForCurrentView() {
    const ViewClass = VIEW_CLASSES[this.state.currentView] || MonthView;
    const tempView = new ViewClass(this);

    return tempView.getVisibleRange();
  }

  getTitle() {
    if (this.activeView) return this.activeView.getTitle();

    const ViewClass = VIEW_CLASSES[this.state.currentView];
    return ViewClass ? new ViewClass(this).getTitle() : '';
  }

  getViewType(viewName) {
    if (viewName === 'month') return 'month';
    if (viewName === 'list') return 'list';
    if (viewName === 'week' || viewName === 'day') return 'timeGrid';
    if (viewName.includes('resourceTimeline')) return 'resourceTimeline';
    if (viewName.includes('resourceTimeGrid')) return 'resourceTimeGrid';
    return viewName;
  }

  closeMorePopover() {
    this.morePopover?.remove();
    this.morePopover = null;

    return this;
  }

  /**
   * Show a month-view "+more" popover for the given date.
   *
   * @param {string} dateKey - YYYY-MM-DD date key.
   * @param {HTMLElement} anchorElement - Button that opened the popover.
   * @returns {TinyScheduler}
   */
  showMorePopover(dateKey, anchorElement) {
    this.closeMorePopover();

    const date = parseDateInput(dateKey);
    const events = this.eventStore.getEventsForDate(date).sort((firstEvent, secondEvent) => {
      return Number(!isAllDayEvent(firstEvent)) - Number(!isAllDayEvent(secondEvent)) || firstEvent.start - secondEvent.start;
    });

    const popover = this.createElement('div', 'tsh-more-popover', '', {
      attrs: {
        role: 'dialog',
        'aria-modal': 'false'
      }
    });

    const header = this.createMorePopoverHeader(date);
    const body = this.createMorePopoverBody(events);

    popover.append(header, body);
    this.rootElement.append(popover);
    this.positionMorePopover(popover, anchorElement);

    this.morePopover = popover;

    const closeButton = popover.querySelector('[data-more-close]');
    closeButton?.focus({ preventScroll: true });

    return this;
  }

  /**
   * Create the header for the month "+more" popover.
   *
   * @param {Date} date - Popover date.
   * @returns {HTMLElement}
   */
  createMorePopoverHeader(date) {
    const title = this.createElement('strong', 'tsh-more-popover-title', formatDayTitle(date, this.options.locale));
    const closeButton = this.createElement('button', 'tsh-more-popover-close', '×', {
      props: {
        type: 'button'
      },
      dataset: {
        moreClose: 'true'
      },
      attrs: {
        'aria-label': this._getAria('close', 'Close')
      }
    });

    return this.createElement('div', 'tsh-more-popover-header', [title, closeButton]);
  }

  /**
   * Create the body for the month "+more" popover.
   *
   * @param {Object[]} events - Events on the selected date.
   * @returns {HTMLElement}
   */
  createMorePopoverBody(events) {
    const body = this.createElement('div', 'tsh-more-popover-body');

    events.forEach(event => {
      body.append(this.createMorePopoverEventRow(event));
    });

    return body;
  }

  /**
   * Create one event row inside the "+more" popover.
   *
   * @param {Object} event - Normalized event.
   * @returns {HTMLElement}
   */
  createMorePopoverEventRow(event) {
    const eventColor = event.backgroundColor || event.color;
    const eventRow = this.createElement(
        'div',
        classNames('tsh-more-popover-event', isAllDayEvent(event) && 'tsh-more-popover-event--all-day'),
        '',
        {
          dataset: {
            eventId: event.id
          },
          style: {
            '--tsh-event-bg': eventColor,
            '--tsh-event-text': event.textColor
          }
        }
    );

    if (isAllDayEvent(event)) {
      eventRow.textContent = event.title;
      return eventRow;
    }

    const dot = this.createElement('span', 'tsh-more-popover-dot', '', {
      style: {
        backgroundColor: eventColor
      }
    });

    const time = this.createElement('span', 'tsh-more-popover-time', formatShortTime(event.start, this.options));
    const eventTitle = this.createElement('strong', '', event.title);

    eventRow.append(dot, time, eventTitle);

    return eventRow;
  }

  /**
   * Position the "+more" popover relative to the clicked anchor.
   *
   * @param {HTMLElement} popover - Popover element.
   * @param {HTMLElement} anchorElement - Anchor button.
   */
  positionMorePopover(popover, anchorElement) {
    const rootRect = this.rootElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const slotElement = anchorElement.closest('.tsh-slot');
    const slotRect = slotElement?.getBoundingClientRect();

    const referenceWidth = slotRect?.width || anchorRect.width || 280;
    const popoverWidth = Math.min(380, Math.max(220, referenceWidth * 1.5), Math.max(220, rootRect.width - 16));

    const anchorLeft = anchorRect.left - rootRect.left;
    const preferredLeft = anchorLeft + 12;
    const maxLeft = Math.max(8, rootRect.width - popoverWidth - 8);

    const left = Math.min(Math.max(8, preferredLeft), maxLeft);

    const top = Math.max(8, anchorRect.top - rootRect.top - 12);

    popover.style.width = `${Math.round(popoverWidth)}px`;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  /**
   * Handle all root click interactions through event delegation.
   * Slot selection is handled by pointer events so click does not fire select twice.
   *
   * @param {MouseEvent} originalEvent - Click event.
   */
  handleRootClick(originalEvent) {
    if (this.ignoreNextClick) {
      originalEvent.preventDefault();
      originalEvent.stopPropagation();
      return this;
    }

    const button = originalEvent.target.closest(SCHEDULER_SELECTORS.toolbarButton);
    if (button) {
      this.handleToolbarButton(button.dataset.tshButton, originalEvent);
      return;
    }

    const planningTypeButton = originalEvent.target.closest(SCHEDULER_SELECTORS.planningTypeButton);
    if (planningTypeButton) {
      this.setPlanningType(planningTypeButton.dataset.planningType);
      return;
    }

    const planningRangeButton = originalEvent.target.closest(SCHEDULER_SELECTORS.planningRangeButton);
    if (planningRangeButton) {
      this.setPlanningRange(planningRangeButton.dataset.planningRange);
      return;
    }

    const toggle = originalEvent.target.closest(SCHEDULER_SELECTORS.resourceToggle);
    if (toggle) {
      this.toggleResource(toggle.dataset.resourceToggle);
      return;
    }

    const moreClose = originalEvent.target.closest(SCHEDULER_SELECTORS.moreClose);
    if (moreClose) {
      this.closeMorePopover();
      return;
    }

    const moreButton = originalEvent.target.closest(SCHEDULER_SELECTORS.moreButton);
    if (moreButton) {
      this.showMorePopover(moreButton.dataset.moreDate, moreButton);
      return;
    }

    const eventActionElement = originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction);
    if (eventActionElement) {
      originalEvent.preventDefault();
      this.handleEventActionClick(eventActionElement, originalEvent);
      return;
    }

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);
    if (eventElement) {
      if (this.interactionManager.wasRecentlyDragging()) return;
      this.handleEventClick(eventElement, originalEvent);
      return;
    }

    const dateNavElement = originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav);
    if (dateNavElement) {
      originalEvent.preventDefault();
      this.handleDateNavigation(dateNavElement.dataset.date, originalEvent);
    }
  }

  /**
   * Navigate to the day view from a dedicated date navigation control.
   * Regular slots do not use this path; they are selected instead.
   *
   * @param {string} dateValue - Date value from data-date.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original user event.
   * @returns {TinyScheduler}
   */
  handleDateNavigation(dateValue, originalEvent) {
    const date = parseDateInput(dateValue);

    this._notify('dateClick', { date, originalEvent });
    this.gotoDate(date, { refresh: false });

    if (this.state.currentView !== SCHEDULER_VIEW_NAMES.DAY) {
      this.setView(SCHEDULER_VIEW_NAMES.DAY);
    } else {
      this.refresh();
    }

    return this;
  }

  /**
   * Make delegated event/date elements keyboard-accessible.
   * Enter on a selected event emits eventEdit. Space/Enter on an unselected
   * event selects it. Date navigation links keep their click behavior.
   *
   * @param {KeyboardEvent} originalEvent - Keydown event.
   */
  handleRootKeyDown(originalEvent) {
    if (originalEvent.key !== 'Enter' && originalEvent.key !== ' ') return;

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);
    if (eventElement) {
      const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
      if (!schedulerEvent) return;

      originalEvent.preventDefault();

      if (originalEvent.key === 'Enter' && this.selectedEventId === schedulerEvent.id) {
        this.emitEventEdit(schedulerEvent, eventElement, originalEvent, 'keyboard');
        return;
      }

      this.selectEventElement(schedulerEvent, eventElement, originalEvent);
      return;
    }

    const dateNavElement = originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav);
    if (dateNavElement) {
      originalEvent.preventDefault();
      dateNavElement.click();
    }
  }

  /**
   * Start editable event dragging or slot range selection.
   *
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {TinyScheduler}
   */
  handleRootPointerDown(originalEvent) {
    if (originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction)) return this;

    const resizeHandle = originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle);
    if (resizeHandle) {
      return this.startEventResize(resizeHandle, originalEvent);
    }

    this.interactionManager.handlePointerDown(originalEvent);

    if (originalEvent.button !== 0 || !this.options.selectable) return this;
    if (this.shouldIgnoreSlotPointer(originalEvent)) return this;

    const slotElement = originalEvent.target.closest(SCHEDULER_SELECTORS.slot);
    if (!slotElement || !this.rootElement.contains(slotElement)) return this;

    const slotGroupElement = this.getSlotGroupElement(slotElement);
    if (!slotGroupElement) return this;

    const selectableSlots = this.getSelectableSlotsInGroup(slotGroupElement);
    const slotIndex = selectableSlots.indexOf(slotElement);
    if (slotIndex === -1) return this;

    originalEvent.preventDefault();
    this.clearSelection();

    this.slotSelection = {
      isSelecting: true,
      pointerId: originalEvent.pointerId,
      groupElement: slotGroupElement,
      slots: selectableSlots,
      startIndex: slotIndex,
      endIndex: slotIndex,
      originalEvent
    };

    this.updateSlotRangeSelection(slotIndex);
    document.addEventListener('pointermove', this.boundSlotPointerMove);
    document.addEventListener('pointerup', this.boundSlotPointerUp, { once: true });

    return this;
  }

  /**
   * Extend the active slot selection while the pointer is moving.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {TinyScheduler}
   */
  handleSlotPointerMove(originalEvent) {
    if (!this.slotSelection?.isSelecting) return this;

    const targetElement = document.elementFromPoint(originalEvent.clientX, originalEvent.clientY);
    const slotElement = targetElement?.closest?.(SCHEDULER_SELECTORS.slot);

    if (!slotElement || !this.slotSelection.groupElement.contains(slotElement)) {
      return this;
    }

    const slotIndex = this.slotSelection.slots.indexOf(slotElement);
    if (slotIndex === -1) return this;

    this.updateSlotRangeSelection(slotIndex);
    return this;
  }

  /**
   * Finish the active slot selection and emit select/onSelect.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {TinyScheduler}
   */
  handleSlotPointerUp(originalEvent) {
    if (!this.slotSelection?.isSelecting) return this;

    document.removeEventListener('pointermove', this.boundSlotPointerMove);
    this.slotSelection.isSelecting = false;

    const eventInfo = this.getSelectedSlotRangeInfo(originalEvent);
    this.lastSelectionInfo = eventInfo;

    this._notify('select', eventInfo);

    if (isFn(this.options.select)) {
      this.options.select.call(this, eventInfo);
    }

    return this;
  }



  /**
   * Start resizing a timed event from its bottom edge.
   *
   * @param {HTMLElement} resizeHandle - Bottom resize handle.
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {TinyScheduler}
   */
  startEventResize(resizeHandle, originalEvent) {
    if (this.options.eventResizable === false || originalEvent.button !== 0) return this;

    const eventElement = resizeHandle.closest(SCHEDULER_SELECTORS.event);
    if (!eventElement || !this.rootElement.contains(eventElement)) return this;

    const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
    if (!schedulerEvent || isAllDayEvent(schedulerEvent)) return this;

    const slotGroupElement = eventElement.closest(SCHEDULER_SELECTORS.slotGroup);
    const firstSlotElement = slotGroupElement?.querySelector(SCHEDULER_SELECTORS.slot);
    const eventsLayerElement = eventElement.parentElement;

    if (!slotGroupElement || !firstSlotElement || !eventsLayerElement) return this;

    const slotHeight = firstSlotElement.getBoundingClientRect().height;
    if (!slotHeight) return this;

    const start = parseDateInput(schedulerEvent.start);
    const end = schedulerEvent.end ? parseDateInput(schedulerEvent.end) : addMinutes(start, 60);
    const slotDuration = Number(eventElement.dataset.resizeSlotDuration || this.options.slotDuration || 30);
    const minMinutes = Number(eventElement.dataset.resizeMinMinutes || parseTimeToMinutes(this.options.minTime));
    const maxMinutes = Number(eventElement.dataset.resizeMaxMinutes || parseTimeToMinutes(this.options.maxTime));
    const minDuration = Number(this.options.eventResizeMinDuration || slotDuration);
    const resizeDate = eventElement.dataset.resizeDate
        ? parseDateInput(eventElement.dataset.resizeDate)
        : startOfDay(start);

    originalEvent.preventDefault();
    originalEvent.stopPropagation();

    this.clearSelection();
    this.hideEventActionToolbar();

    this.selectedEventId = schedulerEvent.id;
    this.selectedEventElement = eventElement;

    this.eventResizeState = {
      isResizing: true,
      pointerId: originalEvent.pointerId,
      event: schedulerEvent,
      oldEvent: { ...schedulerEvent },
      eventElement,
      eventsLayerElement,
      start,
      originalEnd: end,
      proposedEnd: end,
      date: resizeDate,
      slotHeight,
      slotDuration,
      minMinutes,
      maxMinutes,
      minDuration
    };

    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected, CLASS_NAMES.calendar.eventResizing);
    document.addEventListener('pointermove', this.boundEventResizePointerMove);
    document.addEventListener('pointerup', this.boundEventResizePointerUp);

    this._notify('eventResizeStart', {
      type: 'event',
      action: 'resizeStart',
      event: schedulerEvent,
      eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Update the resize preview while the pointer is moving.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {TinyScheduler}
   */
  handleEventResizePointerMove(originalEvent) {
    const state = this.eventResizeState;

    if (!state?.isResizing) return this;
    if (state.pointerId !== originalEvent.pointerId) return this;

    originalEvent.preventDefault();

    const proposedEnd = this.getResizeEndFromPointer(state, originalEvent);
    const clampedEnd = this.clampEventResizeEnd(state, proposedEnd);

    if (clampedEnd.getTime() === state.proposedEnd.getTime()) {
      return this;
    }

    state.proposedEnd = clampedEnd;
    this.updateEventResizePreview(state);

    return this;
  }

  /**
   * Finish the resize interaction and apply/revert according to callbacks.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {Promise<TinyScheduler>}
   */
  async handleEventResizePointerUp(originalEvent) {
    const state = this.eventResizeState;

    if (!state?.isResizing) return this;
    if (state.pointerId !== originalEvent.pointerId) return this;

    state.isResizing = false;
    document.removeEventListener('pointermove', this.boundEventResizePointerMove);
    document.removeEventListener('pointerup', this.boundEventResizePointerUp);

    this.ignoreNextClick = true;
    window.setTimeout(() => {
      this.ignoreNextClick = false;
    }, 0);

    state.eventElement.classList.remove(
        CLASS_NAMES.calendar.eventResizing,
        CLASS_NAMES.calendar.eventCollisionPreview
    );

    const didChange = state.proposedEnd.getTime() !== state.originalEnd.getTime();

    if (!didChange) {
      this.eventResizeState = null;
      this.showEventActionToolbar(state.eventElement);
      return this;
    }

    const nextEvent = await this.requestEventChange(
        state.event.id,
        { end: state.proposedEnd },
        'resize',
        originalEvent
    );

    this._notify('eventResizeStop', {
      type: 'event',
      action: 'resizeStop',
      event: nextEvent || this.eventStore.getEventById(state.event.id) || state.event,
      oldEvent: state.oldEvent,
      eventElement: state.eventElement,
      originalEvent
    });

    this.eventResizeState = null;

    return this;
  }

  /**
   * Convert pointer Y position into a snapped event end date.
   *
   * @param {Object} state - Active resize state.
   * @param {PointerEvent} originalEvent - Native pointer event.
   * @returns {Date}
   */
  getResizeEndFromPointer(state, originalEvent) {
    const layerRect = state.eventsLayerElement.getBoundingClientRect();
    const relativeY = originalEvent.clientY - layerRect.top;
    const slotIndex = Math.round(relativeY / state.slotHeight);
    const endMinute = state.minMinutes + slotIndex * state.slotDuration;

    return addMinutes(startOfDay(state.date), endMinute);
  }

  /**
   * Clamp resized end to visible limits and minimum event duration.
   *
   * @param {Object} state - Active resize state.
   * @param {Date} proposedEnd - Proposed snapped end date.
   * @returns {Date}
   */
  clampEventResizeEnd(state, proposedEnd) {
    const minEnd = addMinutes(state.start, state.minDuration);
    const maxEnd = addMinutes(startOfDay(state.date), state.maxMinutes);

    return new Date(Math.min(
        Math.max(proposedEnd.getTime(), minEnd.getTime()),
        maxEnd.getTime()
    ));
  }

  /**
   * Update the event height while resizing without mutating event data yet.
   *
   * @param {Object} state - Active resize state.
   * @returns {TinyScheduler}
   */
  updateEventResizePreview(state) {
    const visibleStart = addMinutes(startOfDay(state.date), state.minMinutes);
    const clampedStart = new Date(Math.max(state.start.getTime(), visibleStart.getTime()));
    const durationMinutes = Math.max(
        state.minDuration,
        Math.round((state.proposedEnd - clampedStart) / 60000)
    );
    const slotSpan = durationMinutes / state.slotDuration;
    const height = Math.max(22, slotSpan * state.slotHeight);

    state.eventElement.style.height = `${Math.round(height)}px`;

    this.updateEventCollisionPreview(
        state.eventElement,
        { ...state.event, end: state.proposedEnd },
        state.event
    );

    return this;
  }

  /**
   * Resize changes are handled by requestEventChange(), exactly like drag/drop moves.
   * This keeps cancellation and backend confirmation behavior identical for both actions.
   */

  /**
   * Prevent slot selection from starting on interactive UI or events.
   *
   * @param {PointerEvent} originalEvent - Native pointer event.
   * @returns {boolean}
   */
  shouldIgnoreSlotPointer(originalEvent) {
    return Boolean(
      originalEvent.target.closest(SCHEDULER_SELECTORS.event)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.dateNav)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.moreButton)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.toolbarButton)
      || originalEvent.target.closest(SCHEDULER_SELECTORS.interactive)
    );
  }

  /**
   * Return the nearest slot group. A range selection stays inside one group.
   *
   * @param {HTMLElement} slotElement - Slot element.
   * @returns {HTMLElement|null}
   */
  getSlotGroupElement(slotElement) {
    return slotElement.closest(SCHEDULER_SELECTORS.slotGroup);
  }

  /**
   * Return selectable slots inside one group.
   *
   * @param {HTMLElement} groupElement - Slot group element.
   * @returns {HTMLElement[]}
   */
  getSelectableSlotsInGroup(groupElement) {
    return Array.from(groupElement.querySelectorAll(SCHEDULER_SELECTORS.slot));
  }

  /**
   * Update the visible slot range selection.
   *
   * @param {number} endIndex - Current range end index.
   * @returns {TinyScheduler}
   */
  updateSlotRangeSelection(endIndex) {
    if (!this.slotSelection) return this;

    const { slots, startIndex, groupElement } = this.slotSelection;
    const fromIndex = Math.min(startIndex, endIndex);
    const toIndex = Math.max(startIndex, endIndex);

    this.clearSlotSelectionClasses();
    this.selectedSlotElements = slots.slice(fromIndex, toIndex + 1);

    this.selectedSlotElements.forEach((slotElement, selectedIndex) => {
      slotElement.classList.add(CLASS_NAMES.calendar.slotSelected);

      this.applySlotConnectionClasses({
        slotElement,
        selectedIndex,
        selectedSlots: this.selectedSlotElements,
        groupElement
      });
    });

    this.slotSelection.endIndex = endIndex;

    return this;
  }

  /**
   * Remove all slot selection and connection classes from the active selection.
   *
   * @returns {TinyScheduler}
   */
  clearSlotSelectionClasses() {
    const classesToRemove = [
      CLASS_NAMES.calendar.slotSelected,
      CLASS_NAMES.calendar.slotConnectedTop,
      CLASS_NAMES.calendar.slotConnectedRight,
      CLASS_NAMES.calendar.slotConnectedBottom,
      CLASS_NAMES.calendar.slotConnectedLeft
    ];

    this.selectedSlotElements.forEach(slotElement => {
      slotElement.classList.remove(...classesToRemove);
    });

    return this;
  }

  /**
   * Apply border-connection classes according to the current slot group axis.
   *
   * @param {Object} config - Connection configuration.
   * @param {HTMLElement} config.slotElement - Selected slot.
   * @param {number} config.selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} config.selectedSlots - Selected slots in visual order.
   * @param {HTMLElement} config.groupElement - Slot group element.
   * @returns {TinyScheduler}
   */
  applySlotConnectionClasses({ slotElement, selectedIndex, selectedSlots, groupElement }) {
    const axis = groupElement.dataset.slotGroupAxis || SCHEDULER_SLOT_GROUP_AXES.VERTICAL;

    if (axis === SCHEDULER_SLOT_GROUP_AXES.HORIZONTAL) {
      return this.applyHorizontalSlotConnections(slotElement, selectedIndex, selectedSlots);
    }

    if (axis === SCHEDULER_SLOT_GROUP_AXES.GRID) {
      return this.applyGridSlotConnections(slotElement, selectedIndex, selectedSlots, groupElement);
    }

    return this.applyVerticalSlotConnections(slotElement, selectedIndex, selectedSlots);
  }

  /**
   * Connect vertically stacked slots by removing the internal top/bottom edges.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @returns {TinyScheduler}
   */
  applyVerticalSlotConnections(slotElement, selectedIndex, selectedSlots) {
    if (selectedIndex > 0) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedTop);
    }

    if (selectedIndex < selectedSlots.length - 1) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedBottom);
    }

    return this;
  }

  /**
   * Connect horizontally aligned slots by removing the internal left/right edges.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @returns {TinyScheduler}
   */
  applyHorizontalSlotConnections(slotElement, selectedIndex, selectedSlots) {
    if (selectedIndex > 0) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedLeft);
    }

    if (selectedIndex < selectedSlots.length - 1) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedRight);
    }

    return this;
  }

  /**
   * Connect month-grid slots only when adjacent cells are on the same row.
   *
   * @param {HTMLElement} slotElement - Selected slot.
   * @param {number} selectedIndex - Index inside selectedSlots.
   * @param {HTMLElement[]} selectedSlots - Selected slots in visual order.
   * @param {HTMLElement} groupElement - Slot group element.
   * @returns {TinyScheduler}
   */
  applyGridSlotConnections(slotElement, selectedIndex, selectedSlots, groupElement) {
    const columns = Number(groupElement.dataset.slotGroupColumns || 7);
    const allSlots = this.getSelectableSlotsInGroup(groupElement);
    const currentGlobalIndex = allSlots.indexOf(slotElement);
    const previousSlot = selectedSlots[selectedIndex - 1];
    const nextSlot = selectedSlots[selectedIndex + 1];

    if (previousSlot && this.areGridSlotsOnSameRow(allSlots.indexOf(previousSlot), currentGlobalIndex, columns)) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedLeft);
    }

    if (nextSlot && this.areGridSlotsOnSameRow(allSlots.indexOf(nextSlot), currentGlobalIndex, columns)) {
      slotElement.classList.add(CLASS_NAMES.calendar.slotConnectedRight);
    }

    return this;
  }

  /**
   * Check whether two slot indexes belong to the same grid row.
   *
   * @param {number} firstIndex - First slot index.
   * @param {number} secondIndex - Second slot index.
   * @param {number} columns - Number of grid columns.
   * @returns {boolean}
   */
  areGridSlotsOnSameRow(firstIndex, secondIndex, columns) {
    if (firstIndex < 0 || secondIndex < 0) return false;

    return Math.floor(firstIndex / columns) === Math.floor(secondIndex / columns);
  }

  /**
   * Build the select event info from the selected slot range.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {Object}
   */
  getSelectedSlotRangeInfo(originalEvent) {
    const selectedSlots = this.selectedSlotElements;
    const firstSlot = selectedSlots[0];
    const lastSlot = selectedSlots[selectedSlots.length - 1];

    return this.getContext({
      type: 'slot',
      action: 'select',
      start: parseDateInput(firstSlot.dataset.slotStart),
      end: parseDateInput(lastSlot.dataset.slotEnd || lastSlot.dataset.slotStart),
      allDay: firstSlot.dataset.slotAllDay === 'true',
      resourceId: firstSlot.dataset.resourceId || null,
      slotKind: firstSlot.dataset.slotKind,
      slotElement: firstSlot,
      slotElements: selectedSlots,
      originalEvent
    });
  }

  /**
   * Handle event click.
   * First click selects the event and emits eventClick.
   * Second click on the already selected event emits eventEdit only.
   *
   * @param {HTMLElement} eventElement - Clicked event element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @returns {TinyScheduler}
   */
  handleEventClick(eventElement, originalEvent) {
    const schedulerEvent = this.eventStore.getEventById(eventElement.dataset.eventId);
    if (!schedulerEvent) return this;

    if (this.selectedEventId === schedulerEvent.id) {
      this.emitEventEdit(schedulerEvent, eventElement, originalEvent, 'secondClick');
      return this;
    }

    this.selectEventElement(schedulerEvent, eventElement, originalEvent);
    return this;
  }

  /**
   * Select an event and emit eventClick.
   *
   * @param {Object} schedulerEvent - Scheduler event.
   * @param {HTMLElement} eventElement - Event DOM element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @returns {TinyScheduler}
   */
  selectEventElement(schedulerEvent, eventElement, originalEvent) {
    this.clearSelection();

    this.selectedEventId = schedulerEvent.id;
    this.selectedEventElement = eventElement;

    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected);
    eventElement.focus?.();
    this.showEventActionToolbar(eventElement);
    this.refreshActionToolbarState();

    this._notify('eventClick', {
      type: 'event',
      action: 'select',
      event: schedulerEvent,
      eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Emit eventEdit when the user wants to edit a selected event.
   * This intentionally does not emit eventClick again.
   *
   * @param {Object} schedulerEvent - Scheduler event.
   * @param {HTMLElement} eventElement - Event DOM element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Original event.
   * @param {'secondClick'|'keyboard'} reason - Edit trigger reason.
   * @returns {TinyScheduler}
   */
  async emitEventEdit(schedulerEvent, eventElement, originalEvent, reason) {
    const context = this.getContext({
      type: 'event',
      action: 'edit',
      reason,
      event: schedulerEvent,
      eventElement,
      originalEvent,
      updateEvent: updates => this.updateEvent(schedulerEvent.id, updates),
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });

    this._emit('eventEdit', context);

    const result = await this.runActionCallback('onEventEdit', context);

    if (result && isObj(result)) {
      this.updateEvent(schedulerEvent.id, result);
    } else if (result === true) {
      this.redrawEvent(schedulerEvent.id);
    }

    return this;
  }

  /**
   * Clear selected event/slot visual state.
   *
   * @returns {TinyScheduler}
   */
  clearSelection() {
    this.clearSlotSelectionClasses();

    this.selectedEventElement?.classList.remove(CLASS_NAMES.calendar.eventSelected);

    this.selectedSlotElements = [];
    this.selectedEventElement = null;
    this.selectedEventId = null;
    this.slotSelection = null;
    this.hideEventActionToolbar();
    this.refreshActionToolbarState();

    return this;
  }

  /**
   * Restore selected event styling after a redraw.
   *
   * @returns {TinyScheduler}
   */
  /**
   * Restore selected event styling after a redraw.
   *
   * If the selected event is not rendered in the new view/range, the selection
   * is cleared. This prevents the floating toolbar from staying visible after
   * view changes.
   *
   * @returns {TinyScheduler}
   */
  restoreSelectedEventElement() {
    if (!this.selectedEventId) {
      this.hideEventActionToolbar();
      return this;
    }

    const selectedEvent = this.eventStore.getEventById(this.selectedEventId);

    if (!selectedEvent) {
      return this.clearSelectedEventState();
    }

    const elements = this.eventElementsById.get(this.selectedEventId);
    const eventElement = elements ? Array.from(elements).find(element => element.isConnected && this.rootElement.contains(element)) : null;

    if (!eventElement) {
      return this.clearSelectedEventState();
    }

    this.selectedEventElement = eventElement;
    eventElement.classList.add(CLASS_NAMES.calendar.eventSelected);

    this.showEventActionToolbar(eventElement);

    return this;
  }

  /**
   * Execute an optional callback and support promise-based action results.
   *
   * @param {string} callbackName - Option callback name.
   * @param {Object} context - Callback context.
   * @returns {Promise<*>}
   */
  async runActionCallback(callbackName, context) {
    const callback = this.options[callbackName];

    if (!isFn(callback)) {
      return undefined;
    }

    return await callback.call(this, context);
  }

  /**
   * Handle clicks on the floating event action toolbar.
   *
   * Native edit/delete actions keep their historical behavior. Custom actions
   * reuse options.customButtons and receive the selected-event context.
   *
   * @param {HTMLElement} actionElement - Clicked toolbar button.
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {TinyScheduler}
   */
  handleEventActionClick(actionElement, originalEvent) {
    const schedulerEvent = this.selectedEventId
        ? this.eventStore.getEventById(this.selectedEventId)
        : null;

    if (!schedulerEvent || !this.selectedEventElement || actionElement.disabled || actionElement.hidden) {
      return this;
    }

    const action = actionElement.dataset.eventAction;

    if (action === SCHEDULER_EVENT_ACTIONS.EDIT) {
      this.emitEventEdit(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
      return this;
    }

    if (action === SCHEDULER_EVENT_ACTIONS.DELETE) {
      this.emitEventDelete(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
      return this;
    }

    const buttonName = actionElement.dataset.eventActionButton || action;
    const config = this.getEventActionButtonConfig(buttonName);

    if (!config || !isFn(config.action)) {
      return this;
    }

    config.action.call(this, this.getEventActionContext(
        config,
        schedulerEvent,
        this.selectedEventElement,
        actionElement,
        originalEvent
    ));

    return this;
  }

  /**
   * Emit eventDelete and delete the event unless the callback returns false.
   *
   * @param {Object} schedulerEvent - Event to delete.
   * @param {HTMLElement|null} eventElement - Event element.
   * @param {MouseEvent|KeyboardEvent} originalEvent - Native event.
   * @param {string} reason - Delete trigger reason.
   * @returns {Promise<TinyScheduler>}
   */
  async emitEventDelete(schedulerEvent, eventElement, originalEvent, reason = 'toolbar') {
    const context = this.getContext({
      type: 'event',
      action: 'delete',
      reason,
      event: schedulerEvent,
      eventElement,
      originalEvent,
      deleteEvent: () => this.deleteEvent(schedulerEvent.id),
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });

    this._emit('eventDelete', context);

    const result = await this.runActionCallback('onEventDelete', context);

    if (result === false) {
      return this;
    }

    this.deleteEvent(schedulerEvent.id);
    return this;
  }

  /**
   * Emit eventAdd from the last selected slot/range.
   * The callback may return a raw event object, or false/null to cancel.
   *
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {Promise<TinyScheduler>}
   */
  async emitEventAdd(originalEvent) {
    const selection = this.lastSelectionInfo || this.getDefaultAddSelection(originalEvent);
    const context = this.getContext({
      type: 'event',
      action: 'add',
      reason: 'toolbar',
      start: selection.start,
      end: selection.end,
      allDay: Boolean(selection.allDay),
      resourceId: selection.resourceId || null,
      slotKind: selection.slotKind || null,
      slotElement: selection.slotElement || null,
      slotElements: selection.slotElements || [],
      originalEvent,
      addEvent: rawEvent => this.addEvent(rawEvent, { originalEvent }),
      refresh: () => this.redraw()
    });

    this._emit('eventAdd', context);

    const result = await this.runActionCallback('onEventAdd', context);

    if (!result || result === false) {
      return this;
    }

    if (isObj(result)) {
      await Promise.resolve(this.addEvent({
        start: context.start,
        end: context.end,
        allDay: context.allDay,
        resourceId: context.resourceId,
        ...result
      }, { originalEvent }));
    } else if (result === true) {
      this.refreshEventDisplay({
        type: 'refresh',
        reason: 'eventAddCallback'
      });
    }

    return this;
  }

  /**
   * Return fallback selection values when the user clicks Add without a slot selection.
   *
   * @param {MouseEvent} originalEvent - Native event.
   * @returns {Object}
   */
  getDefaultAddSelection(originalEvent) {
    const slotDuration = this.options.slotDuration || 30;
    const defaultDuration = this.options.defaultAddEventDuration || slotDuration;
    const selectedDayStart = startOfDay(this.state.currentDate);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    /*
      Use the calendar's selected day, but apply the current clock time.
      The time is rounded up to the next slot.
    */
    const roundedMinutes = Math.ceil(nowMinutes / slotDuration) * slotDuration;

    /*
      Keep the default event inside the selected day.
      Example: at 23h50 with 30 min slots, start remains 23h30 instead of tomorrow 00h00.
    */
    const safeStartMinutes = Math.min(roundedMinutes, 1440 - defaultDuration);

    const start = addMinutes(selectedDayStart, safeStartMinutes);
    const end = addMinutes(start, defaultDuration);

    return this.getContext({
      type: 'slot',
      action: 'select',
      start,
      end,
      allDay: false,
      resourceId: null,
      slotKind: null,
      slotElement: null,
      slotElements: [],
      originalEvent
    });
  }

  /**
   * Delete the currently selected event from the toolbar delete button.
   *
   * @param {MouseEvent} originalEvent - Native click event.
   * @returns {TinyScheduler}
   */
  deleteSelectedEvent(originalEvent) {
    const schedulerEvent = this.selectedEventId ? this.eventStore.getEventById(this.selectedEventId) : null;

    if (!schedulerEvent) return this;

    this.emitEventDelete(schedulerEvent, this.selectedEventElement, originalEvent, 'toolbar');
    return this;
  }

  /**
   * Return the configured event-action button names in display order.
   *
   * The floating toolbar deliberately reuses options.customButtons for custom
   * definitions instead of maintaining a second custom-button registry.
   *
   * @returns {string[]}
   */
  getEventActionButtonNames() {
    return Array.isArray(this.options.eventActionToolbarButtons)
        ? this.options.eventActionToolbarButtons
        : ['editEvent', 'deleteEvent'];
  }

  /**
   * Resolve one floating event-action button definition.
   *
   * editEvent/deleteEvent are built in. Every other name is resolved through
   * options.customButtons so one custom definition can be reused by toolbars.
   *
   * @param {string} name - Configured button name.
   * @returns {Object|null}
   */
  getEventActionButtonConfig(name) {
    if (name === 'editEvent') {
      return {
        name,
        eventAction: SCHEDULER_EVENT_ACTIONS.EDIT,
        iconHtml: this.getToolbarIconHtml('editEvent'),
        tooltip: this._getTooltip('editEvent', 'Edit event'),
        ariaLabel: this._getTooltip('editEvent', 'Edit event')
      };
    }

    if (name === 'deleteEvent') {
      return {
        name,
        eventAction: SCHEDULER_EVENT_ACTIONS.DELETE,
        iconHtml: this.getToolbarIconHtml('deleteEvent'),
        tooltip: this._getTooltip('deleteEvent', 'Delete event'),
        ariaLabel: this._getTooltip('deleteEvent', 'Delete event'),
        danger: true
      };
    }

    const customButton = this.getCustomButtonConfig(name);

    if (!customButton) {
      return null;
    }

    return {
      ...customButton,
      eventAction: name,
      tooltip: customButton.tooltip || customButton.ariaLabel || customButton.text || name,
      ariaLabel: customButton.ariaLabel || customButton.tooltip || customButton.text || name
    };
  }

  /**
   * Build the context shared by custom event-action state callbacks and clicks.
   *
   * @param {Object} config - Normalized event-action button config.
   * @param {Object} schedulerEvent - Selected scheduler event.
   * @param {HTMLElement|null} eventElement - Selected event element.
   * @param {HTMLElement|null} actionElement - Floating toolbar button.
   * @param {Event|null} originalEvent - Native event when available.
   * @returns {Object}
   */
  getEventActionContext(config, schedulerEvent, eventElement, actionElement = null, originalEvent = null) {
    return this.getContext({
      type: 'event',
      action: config.eventAction,
      reason: 'toolbar',
      buttonName: config.name,
      button: config,
      event: schedulerEvent,
      eventElement,
      actionElement,
      originalEvent,
      refreshEvent: () => this.redrawEvent(schedulerEvent.id)
    });
  }

  /**
   * Create the floating event action toolbar once per scheduler instance.
   *
   * @returns {HTMLElement}
   */
  ensureEventActionToolbar() {
    if (this.eventActionToolbar) return this.eventActionToolbar;

    const toolbar = this.createElement('div', CLASS_NAMES.calendar.eventActionToolbar, '', {
      attrs: {
        hidden: ''
      }
    });

    this.getEventActionButtonNames().forEach(name => {
      const config = this.getEventActionButtonConfig(name);

      if (config) {
        toolbar.append(this.createEventActionButton(config));
      }
    });

    this.rootElement.append(toolbar);
    this.eventActionToolbar = toolbar;

    return toolbar;
  }

  /**
   * Create one icon-first event action button.
   *
   * @param {Object} config - Normalized event-action button config.
   * @returns {HTMLButtonElement}
   */
  createEventActionButton(config) {
    const normalizedIconHtml = this.normalizeToolbarIconHtml(config.iconHtml || config.svg || '');
    const label = config.ariaLabel || config.tooltip || config.text || config.name;
    const iconType = normalizedIconHtml ? this.getToolbarIconType(normalizedIconHtml) : 'text';
    const button = this.createElement(
        'button',
        classNames(
            CLASS_NAMES.calendar.eventActionButton,
            `tsh-event-action-button--${iconType}`,
            config.danger && CLASS_NAMES.calendar.eventActionButtonDanger,
            config.className
        ),
        normalizedIconHtml ? '' : (config.icon || config.text || ''),
        {
          html: normalizedIconHtml || undefined,
          props: {
            type: 'button'
          },
          dataset: {
            eventAction: config.eventAction,
            eventActionButton: config.name,
            tooltip: config.tooltip || label
          },
          attrs: {
            'aria-label': label
          }
        }
    );

    return button;
  }

  /**
   * Re-evaluate visible/hidden/disabled custom state for the selected event.
   *
   * State callbacks receive the same event context as the action callback.
   *
   * @returns {TinyScheduler}
   */
  refreshEventActionToolbarState() {
    if (!this.eventActionToolbar) {
      return this;
    }

    const schedulerEvent = this.selectedEventId
        ? this.eventStore.getEventById(this.selectedEventId)
        : null;

    this.eventActionToolbar.querySelectorAll(SCHEDULER_SELECTORS.eventAction).forEach(button => {
      const buttonName = button.dataset.eventActionButton || button.dataset.eventAction;
      const config = this.getEventActionButtonConfig(buttonName);

      if (!schedulerEvent || !this.selectedEventElement || !config) {
        button.hidden = true;
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        return;
      }

      const context = this.getEventActionContext(
          config,
          schedulerEvent,
          this.selectedEventElement,
          button
      );

      const isVisible = isFn(config.visible)
          ? config.visible.call(this, context) !== false
          : config.visible !== false;
      const isHidden = isFn(config.hidden)
          ? Boolean(config.hidden.call(this, context))
          : Boolean(config.hidden);
      const isDisabled = isFn(config.disabled)
          ? Boolean(config.disabled.call(this, context))
          : Boolean(config.disabled);

      button.hidden = !isVisible || isHidden;
      button.disabled = isDisabled;
      button.setAttribute('aria-disabled', String(isDisabled));
    });

    return this;
  }

  /**
   * Rebuild the floating event action toolbar after custom-button changes.
   *
   * @returns {TinyScheduler}
   */
  refreshEventActionToolbar() {
    if (!this.eventActionToolbar) {
      return this;
    }

    this.eventActionToolbar.remove();
    this.eventActionToolbar = null;

    if (this.selectedEventElement?.isConnected && this.options.eventActionToolbar !== false) {
      this.showEventActionToolbar(this.selectedEventElement);
    }

    return this;
  }

  getEventActionToolbarContainer(eventElement) {
    return eventElement.closest(`.${CLASS_NAMES.calendar.scrollContainer}`)
        || this.rootElement;
  }

  /**
   * Show and position the floating event action toolbar.
   *
   * @param {HTMLElement} eventElement - Selected event element.
   * @returns {TinyScheduler}
   */
  showEventActionToolbar(eventElement) {
    if (this.options.eventActionToolbar === false) {
      return this;
    }

    const toolbar = this.ensureEventActionToolbar();

    this.refreshEventActionToolbarState();

    const hasVisibleAction = Array.from(toolbar.children).some(button => !button.hidden);

    if (!hasVisibleAction) {
      toolbar.hidden = true;
      return this;
    }

    const toolbarContainer = this.getEventActionToolbarContainer(eventElement);

    // Store the active scroll container directly on the toolbar.
    // This avoids resolving closest() again during scroll/resize positioning.
    toolbar._tshContainer = toolbarContainer;

    if (toolbar.parentElement !== toolbarContainer) {
      toolbarContainer.append(toolbar);
    }

    toolbar.hidden = false;
    this.positionEventActionToolbar(eventElement);

    return this;
  }

  /**
   * Clear only the selected event state.
   *
   * Slot selection has its own lifecycle. Event selection is tied to rendered DOM,
   * so it must be reset when the view changes or when the selected event disappears.
   *
   * @returns {TinyScheduler}
   */
  clearSelectedEventState() {
    if (this.selectedEventElement?.isConnected) {
      this.selectedEventElement.classList.remove(CLASS_NAMES.calendar.eventSelected);
    }

    this.selectedEventElement = null;
    this.selectedEventId = null;

    this.hideEventActionToolbar();
    this.refreshActionToolbarState();

    return this;
  }

  /**
   * Hide the floating event action toolbar and reset its active container.
   *
   * The toolbar can be moved into a scroll container while an event is selected.
   * When the view changes, that container may be destroyed, so we move the toolbar
   * back to the scheduler root to avoid stale positioning.
   *
   * @returns {TinyScheduler}
   */
  hideEventActionToolbar() {
    if (!this.eventActionToolbar) {
      return this;
    }

    this.eventActionToolbar.hidden = true;
    this.eventActionToolbar._tshContainer = null;

    this.eventActionToolbar.style.left = '';
    this.eventActionToolbar.style.top = '';
    this.eventActionToolbar.style.transform = '';

    if (
        this.rootElement
        && this.rootElement.isConnected
        && this.eventActionToolbar.parentElement !== this.rootElement
    ) {
      this.rootElement.append(this.eventActionToolbar);
    }

    return this;
  }

  /**
   * Position the floating toolbar relative to the scheduler root.
   *
   * @param {HTMLElement} eventElement - Selected event element.
   * @returns {TinyScheduler}
   */
  positionEventActionToolbar(eventElement) {
    if (!this.eventActionToolbar || !eventElement) return this;

    const toolbar = this.eventActionToolbar;
    const container = toolbar._tshContainer || this.rootElement;

    const containerRect = container.getBoundingClientRect();
    const eventRect = eventElement.getBoundingClientRect();

    const toolbarWidth = toolbar.offsetWidth || 58;
    const toolbarHeight = toolbar.offsetHeight || 32;

    const offset = this.options.eventActionToolbarOffset ?? 6;
    const verticalAlign = this.options.eventActionToolbarVerticalAlign || 'top';

    const isEventVisible =
        eventRect.bottom > containerRect.top
        && eventRect.top < containerRect.bottom
        && eventRect.right > containerRect.left
        && eventRect.left < containerRect.right;

    if (!isEventVisible) {
      toolbar.hidden = true;
      return this;
    }

    toolbar.hidden = false;

    const scrollLeft = container === this.rootElement ? 0 : container.scrollLeft;
    const scrollTop = container === this.rootElement ? 0 : container.scrollTop;

    const eventLeft = eventRect.left - containerRect.left + scrollLeft;
    const eventTop = eventRect.top - containerRect.top + scrollTop;

    const visibleLeft = scrollLeft;
    const visibleRight = scrollLeft + container.clientWidth;
    const visibleTop = scrollTop;
    const visibleBottom = scrollTop + container.clientHeight;

    const leftOutside = eventLeft + eventRect.width + offset;
    const leftInside = eventLeft + Math.max(4, eventRect.width - toolbarWidth - 4);

    let left = leftOutside + toolbarWidth <= visibleRight
        ? leftOutside
        : leftInside;

    let top = verticalAlign === 'top'
        ? eventTop + 4
        : eventTop + eventRect.height / 2 - toolbarHeight / 2;

    left = Math.min(
        Math.max(left, visibleLeft + 4),
        visibleRight - toolbarWidth - 4
    );

    top = Math.min(
        Math.max(top, visibleTop + 4),
        visibleBottom - toolbarHeight - 4
    );

    toolbar.style.left = `${Math.round(left)}px`;
    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.transform = 'none';

    return this;
  }

  /**
   * Reposition the floating event toolbar after scroll/resize/redraw.
   *
   * @returns {TinyScheduler}
   */
  /**
   * Reposition the floating event toolbar after scroll/resize/redraw.
   *
   * @returns {TinyScheduler}
   */
  updateEventActionToolbarPosition() {
    if (
        !this.eventActionToolbar
        || this.eventActionToolbar.hidden
        || !this.selectedEventElement
        || !this.selectedEventElement.isConnected
        || !this.rootElement.contains(this.selectedEventElement)
    ) {
      this.hideEventActionToolbar();
      return this;
    }

    requestAnimationFrame(() => {
      if (
          this.selectedEventElement
          && this.selectedEventElement.isConnected
          && this.rootElement.contains(this.selectedEventElement)
      ) {
        this.positionEventActionToolbar(this.selectedEventElement);
      } else {
        this.hideEventActionToolbar();
      }
    });

    return this;
  }

  /**
   * Keep action toolbar buttons in sync with event selection state.
   *
   * @returns {TinyScheduler}
   */
  refreshActionToolbarState() {
    const deleteButton = this.rootElement.querySelector(`[data-tsh-button="${SCHEDULER_TOOLBAR_BUTTONS.DELETE_EVENT}"]`);

    if (deleteButton) {
      deleteButton.disabled = !this.selectedEventId;
      deleteButton.setAttribute('aria-disabled', String(!this.selectedEventId));
    }

    this.refreshEventActionToolbarState();
    this.updateEventActionToolbarPosition();

    return this;
  }

  /**
   * Execute toolbar button behavior.
   *
   * @param {string} name - Button name.
   * @param {MouseEvent} originalEvent - Click event.
   */
  handleToolbarButton(name, originalEvent) {
    const config = this.getToolbarButtonConfig(name);

    this._notify('toolbarButtonClick', {
      buttonName: name,
      button: config,
      originalEvent
    });

    if (name === 'planning') {
      this.setPlanningView(this.state.planningType || SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID, this.state.planningRange || SCHEDULER_VIEW_NAMES.DAY);
    } else if (config.type === 'view') {
      this.setView(name);
    } else if (name === 'prev') {
      this.prev();
    } else if (name === 'next') {
      this.next();
    } else if (name === 'today') {
      this.today();
    } else if (name === 'prevYear') {
      this.prevYear();
    } else if (name === 'nextYear') {
      this.nextYear();
    } else if (name === SCHEDULER_TOOLBAR_BUTTONS.ADD_EVENT) {
      this.emitEventAdd(originalEvent);
    } else if (name === SCHEDULER_TOOLBAR_BUTTONS.DELETE_EVENT) {
      this.deleteSelectedEvent(originalEvent);
    } else if (isFn(config.action)) {
      config.action.call(this, this.getContext({ buttonName: name, button: config, originalEvent }));
    }
  }

  toggleResource(resourceId) {
    if (this.state.collapsedResources.has(resourceId)) {
      this.state.collapsedResources.delete(resourceId);
    } else {
      this.state.collapsedResources.add(resourceId);
    }

    this.redrawPreservingScroll();
  }

  /**
   * Navigate relatively according to the current view.
   *
   * @param {number} amount - Positive or negative navigation amount.
   * @returns {TinyScheduler}
   */
  navigate(amount) {
    const type = this.getViewType(this.state.currentView);

    if (type === 'month') {
      this.state.currentDate = addMonths(this.state.currentDate, amount);
    } else if (this.isPlanningView()) {
      this.navigatePlanningView(amount);
    } else if (this.state.currentView.includes('Week') || this.state.currentView === 'week') {
      this.state.currentDate = addDays(this.state.currentDate, amount * 7);
    } else {
      this.state.currentDate = addDays(this.state.currentDate, amount);
    }

    this._notify('dateChanged');
    this.refresh();

    return this;
  }

  /**
   * Navigate planning view according to its current range.
   *
   * @param {number} amount - Positive or negative navigation amount.
   */
  navigatePlanningView(amount) {
    if (this.state.planningRange === 'month') {
      this.state.currentDate = addMonths(this.state.currentDate, amount);
    } else if (this.state.planningRange === 'week') {
      this.state.currentDate = addDays(this.state.currentDate, amount * 7);
    } else {
      this.state.currentDate = addDays(this.state.currentDate, amount);
    }
  }

  next() {
    return this.navigate(1);
  }

  prev() {
    return this.navigate(-1);
  }

  prevYear() {
    this.state.currentDate = addYears(this.state.currentDate, -1);
    this.refresh();
    return this;
  }

  nextYear() {
    this.state.currentDate = addYears(this.state.currentDate, 1);
    this.refresh();
    return this;
  }

  today() {
    this.gotoDate(new Date());
    return this;
  }

  gotoDate(date, options = {}) {
    this.state.currentDate = parseDateInput(date);
    this._notify('dateChanged');

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  /**
   * Persist the current calendar view state.
   *
   * Only view/planning state is saved.
   */
  persistViewState() {
    CalendarStateStorage.setViewState(this.state);

    return this;
  }

  setView(viewName) {
    const resolvedView = resolveViewName(viewName);

    if (!VIEW_CLASSES[resolvedView.view]) {
      throw new Error(`Unsupported view: ${viewName}`);
    }

    const previousView = this.state.currentView;
    const previousPlanningType = this.state.planningType;
    const previousPlanningRange = this.state.planningRange;

    if (resolvedView.planningType) {
      this.state.planningType = resolvedView.planningType;
    }

    if (resolvedView.planningRange) {
      this.state.planningRange = normalizePlanningRange(this.state.planningType, resolvedView.planningRange);
    }

    const viewDidNotChange = this.state.currentView === resolvedView.view
        && previousPlanningType === this.state.planningType
        && previousPlanningRange === this.state.planningRange;

    if (viewDidNotChange) {
      return this;
    }

    this.state.currentView = resolvedView.view;

    this.persistViewState();

    this._notify('viewChanged', {
      previousView,
      view: this.state.currentView,
      previousPlanningType,
      planningType: this.state.planningType,
      previousPlanningRange,
      planningRange: this.state.planningRange
    });

    this.refresh();

    return this;
  }

  setPlanningView(type = SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID, range = SCHEDULER_VIEW_NAMES.DAY) {
    this.setPlanningType(type, { refresh: false });
    this.setPlanningRange(range, { refresh: false });

    this.state.currentView = getPlanningViewName(this.state.planningType);

    this._notify('viewChanged', {
      view: this.state.currentView,
      planningType: this.state.planningType,
      planningRange: this.state.planningRange
    });

    this.refresh();

    return this;
  }

  setPlanningType(type, options = {}) {
    if (!SCHEDULER_PLANNING_TYPES.includes(type)) {
      throw new Error(`Invalid planning type: ${type}`);
    }

    const previousPlanningType = this.state.planningType;

    this.state.planningType = type;
    this.state.planningRange = normalizePlanningRange(type, this.state.planningRange);
    this.state.currentView = getPlanningViewName(type);

    this.persistViewState();

    this._notify('planningTypeChanged', {
      previousPlanningType,
      planningType: type,
      planningRange: this.state.planningRange
    });

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  setPlanningRange(range, options = {}) {
    if (!SCHEDULER_PLANNING_RANGES.includes(range)) {
      throw new Error(`Invalid planning range: ${range}`);
    }

    if (this.state.planningType === SCHEDULER_PLANNING_TYPE_NAMES.TIME_GRID && range === SCHEDULER_VIEW_NAMES.MONTH) {
      return this;
    }

    const previousPlanningRange = this.state.planningRange;
    this.state.planningRange = range;

    this.persistViewState();

    this._notify('planningRangeChanged', {
      previousPlanningRange,
      planningRange: range,
      planningType: this.state.planningType
    });

    if (options.refresh !== false) {
      this.refresh();
    }

    return this;
  }

  getPlanningType() {
    return this.state.planningType;
  }

  getPlanningRange() {
    return this.state.planningRange;
  }

  isPlanningView() {
    return isPlanningViewName(this.state.currentView);
  }

  isPlanningType(type) {
    return this.state.planningType === type;
  }

  isPlanningRange(range) {
    return this.state.planningRange === range;
  }

  getView() {
    return this.state.currentView;
  }

  isView(viewName) {
    const resolvedView = resolveViewName(viewName);
    return this.state.currentView === resolvedView.view;
  }

  isViewType(viewType) {
    return this.getViewType(this.state.currentView) === viewType;
  }

  getDate() {
    return new Date(this.state.currentDate);
  }

  setEvents(events) {
    this.sourceManager.setEventSources([events]);
    this.refresh();
    return this;
  }

  /**
   * Return the normalized resource ids carried by an event.
   *
   * @param {Object} event - Normalized or raw event.
   * @returns {string[]}
   */
  getEventResourceIds(event) {
    if (!event) return [];

    if (Array.isArray(event.resourceIds) && event.resourceIds.length) {
      return event.resourceIds
          .filter(resourceId => !isNil(resourceId) && resourceId !== '')
          .map(resourceId => String(resourceId));
    }

    return !isNil(event.resourceId) && event.resourceId !== ''
        ? [String(event.resourceId)]
        : [];
  }

  /**
   * Return the effective end date used for conflict checks.
   * Missing timed event ends are treated like the rendered default duration.
   *
   * @param {Object} event - Normalized or raw event.
   * @returns {Date}
   */
  getEventConflictStart(event) {
    const start = parseDateInput(event.start);

    return event?.allDay ? startOfDay(start) : start;
  }

  getEventConflictEnd(event) {
    const start = this.getEventConflictStart(event);

    if (event?.allDay) {
      if (event.end) {
        const end = startOfDay(parseDateInput(event.end));
        return end > start ? end : addDays(start, 1);
      }

      return addDays(start, 1);
    }

    if (event.end) {
      const end = parseDateInput(event.end);
      return end > start ? end : start;
    }

    return addMinutes(start, Number(this.options.slotDuration || 60));
  }

  /**
   * Return true when the current view is resource-based.
   *
   * @returns {boolean}
   */
  isResourceView() {
    return this.state.currentView === SCHEDULER_VIEW_NAMES.RESOURCE_TIME_GRID
        || this.state.currentView === SCHEDULER_VIEW_NAMES.RESOURCE_TIMELINE;
  }

  /**
   * Return true when an event overlaps another event on the same resource.
   *
   * @param {Object} proposedEvent - Proposed/current event.
   * @param {Object|null} oldEvent - Same event before mutation, used to ignore itself.
   * @returns {boolean}
   */
  hasResourceConflict(proposedEvent, oldEvent = null) {
    if (!proposedEvent) return false;

    const proposedResourceIds = this.getEventResourceIds(proposedEvent);

    if (!proposedResourceIds.length) {
      return false;
    }

    return this.getEvents().some(candidateEvent => {
      if (!candidateEvent) return false;

      if (oldEvent && String(candidateEvent.id) === String(oldEvent.id)) {
        return false;
      }

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const hasSharedResource = proposedResourceIds.some(resourceId => (
        candidateResourceIds.includes(resourceId)
      ));

      return hasSharedResource && Boolean(this.getEventOverlap(proposedEvent, candidateEvent));
    });
  }

  /**
   * Return whether an event is the later participant of a resource collision.
   * The earliest event stays unchanged; every overlapping event that starts
   * afterwards receives the persistent collision style. Equal starts use the
   * stable EventStore order as a deterministic tie-breaker.
   *
   * @param {string|number} eventId - Event id.
   * @returns {boolean}
   */
  isEventMarkedCollision(eventId) {
    if (!this.isResourceView()) return false;

    const events = this.getEvents();
    const eventIndex = events.findIndex(event => String(event?.id) === String(eventId));

    if (eventIndex === -1) return false;

    const event = events[eventIndex];
    const eventResourceIds = this.getEventResourceIds(event);

    if (!eventResourceIds.length) return false;

    const eventStart = this.getEventConflictStart(event).getTime();

    return events.some((candidateEvent, candidateIndex) => {
      if (!candidateEvent || candidateIndex === eventIndex) return false;

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const hasSharedResource = eventResourceIds.some(resourceId => (
        candidateResourceIds.includes(resourceId)
      ));

      if (!hasSharedResource || !this.getEventOverlap(event, candidateEvent)) {
        return false;
      }

      const candidateStart = this.getEventConflictStart(candidateEvent).getTime();

      return candidateStart < eventStart
          || (candidateStart === eventStart && candidateIndex < eventIndex);
    });
  }

  /**
   * Toggle live collision feedback on a drag/resize preview element.
   *
   * @param {HTMLElement|null} element - Event or drag mirror element.
   * @param {Object} proposedEvent - Proposed event state.
   * @param {Object|null} oldEvent - Original event state.
   * @returns {boolean}
   */
  updateEventCollisionPreview(element, proposedEvent, oldEvent = null) {
    const hasCollision = Boolean(
      element
      && this.isResourceView()
      && this.hasResourceConflict(proposedEvent, oldEvent)
    );

    element?.classList.toggle(
        CLASS_NAMES.calendar.eventCollisionPreview,
        hasCollision
    );

    return hasCollision;
  }

  /**
   * Return overlap details between two events, or null when they do not overlap.
   * End dates are exclusive, matching the scheduler rendering model.
   *
   * @param {Object} firstEvent - Proposed event.
   * @param {Object} secondEvent - Existing event.
   * @returns {Object|null}
   */
  getEventOverlap(firstEvent, secondEvent) {
    const firstStart = this.getEventConflictStart(firstEvent);
    const firstEnd = this.getEventConflictEnd(firstEvent);
    const secondStart = this.getEventConflictStart(secondEvent);
    const secondEnd = this.getEventConflictEnd(secondEvent);

    const overlapStartTime = Math.max(firstStart.getTime(), secondStart.getTime());
    const overlapEndTime = Math.min(firstEnd.getTime(), secondEnd.getTime());
    const overlapDurationMs = overlapEndTime - overlapStartTime;

    if (overlapDurationMs <= 0) {
      return null;
    }

    return {
      overlapStart: new Date(overlapStartTime),
      overlapEnd: new Date(overlapEndTime),
      overlapDurationMs,
      overlapMinutes: Math.round(overlapDurationMs / 60000)
    };
  }

  /**
   * Find conflicts for a proposed event.
   * Default scope is resource-only; scope 'all' also reports non-resource overlaps.
   *
   * @param {Object} proposedEvent - Event to add/move.
   * @param {Object|null} oldEvent - Previous event when moving.
   * @returns {Object[]}
   */
  findEventConflicts(proposedEvent, oldEvent = null) {
    const scope = this.options.eventConflictScope || 'resource';

    if (scope === false || scope === 'none') {
      return [];
    }

    const proposedResourceIds = this.getEventResourceIds(proposedEvent);

    return this.getEvents().reduce((conflicts, candidateEvent) => {
      if (!candidateEvent) return conflicts;

      if (oldEvent && String(candidateEvent.id) === String(oldEvent.id)) {
        return conflicts;
      }

      const overlap = this.getEventOverlap(proposedEvent, candidateEvent);

      if (!overlap) {
        return conflicts;
      }

      const candidateResourceIds = this.getEventResourceIds(candidateEvent);
      const resourceIds = proposedResourceIds.filter(resourceId => candidateResourceIds.includes(resourceId));
      const isResourceConflict = resourceIds.length > 0;

      if (!isResourceConflict && scope !== 'all') {
        return conflicts;
      }

      const resourceId = resourceIds[0] || proposedResourceIds[0] || candidateResourceIds[0] || null;

      conflicts.push({
        proposedEvent,
        event: proposedEvent,
        conflictEvent: candidateEvent,
        isResourceConflict,
        resourceId,
        resourceIds,
        resource: resourceId ? this.resourceStore.getResourceById(resourceId) : null,
        ...overlap
      });

      return conflicts;
    }, []);
  }

  /**
   * Run the conflict callback when needed.
   * Returning false or Promise<false> cancels the operation.
   * Any other value allows it.
   *
   * @param {Object} config - Conflict resolution config.
   * @returns {boolean|Promise<boolean>}
   */
  resolveEventConflict(config) {
    const conflicts = this.findEventConflicts(config.proposedEvent, config.oldEvent || null);

    if (!conflicts.length) {
      return true;
    }

    const firstConflict = conflicts[0];
    const callback = isFn(this.options.onEventConflict)
        ? this.options.onEventConflict
        : (firstConflict.isResourceConflict && isFn(this.options.onResourceConflict) ? this.options.onResourceConflict : null);

    if (!callback) {
      return true;
    }

    const context = this.getContext({
      type: 'event',
      action: 'conflict',
      operation: config.operation,
      event: config.proposedEvent,
      proposedEvent: config.proposedEvent,
      oldEvent: config.oldEvent || null,
      updates: config.updates || null,
      conflictEvent: firstConflict.conflictEvent,
      conflicts,
      isResourceConflict: firstConflict.isResourceConflict,
      resourceId: firstConflict.resourceId,
      resourceIds: firstConflict.resourceIds,
      resource: firstConflict.resource,
      overlapStart: firstConflict.overlapStart,
      overlapEnd: firstConflict.overlapEnd,
      overlapDurationMs: firstConflict.overlapDurationMs,
      overlapMinutes: firstConflict.overlapMinutes,
      originalEvent: config.originalEvent || null
    });

    this._emit('eventConflict', context);

    try {
      const result = callback.call(this, context);

      if (result && isFn(result.then)) {
        return result.then(value => value !== false).catch(error => {
          this._notify('eventConflictError', {
            error,
            event: config.proposedEvent,
            proposedEvent: config.proposedEvent,
            oldEvent: config.oldEvent || null,
            conflictEvent: firstConflict.conflictEvent,
            conflicts,
            operation: config.operation,
            originalEvent: config.originalEvent || null
          });

          return false;
        });
      }

      return result !== false;
    } catch (error) {
      this._notify('eventConflictError', {
        error,
        event: config.proposedEvent,
        proposedEvent: config.proposedEvent,
        oldEvent: config.oldEvent || null,
        conflictEvent: firstConflict.conflictEvent,
        conflicts,
        operation: config.operation,
        originalEvent: config.originalEvent || null
      });

      return false;
    }
  }

  /**
   * Apply an add after conflict resolution.
   *
   * @param {Object} event - Normalized event to add.
   * @param {Object} options - Add options.
   * @returns {Object}
   */
  applyEventAdd(event, options = {}) {
    this.eventStore.addEvent(event);
    this._notify('eventAdded', { event, originalEvent: options.originalEvent || null });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'add',
      eventId: event.id,
      event,
      oldEvent: null,
      originalEvent: options.originalEvent || null
    });

    return event;
  }

  addEvent(rawEvent, options = {}) {
    const transformedEvent = isFn(this.options.eventTransform)
        ? this.options.eventTransform(rawEvent, {
          index: this.eventStore.getEvents().length,
          range: this.state.visibleRange,
          source: null,
          sourceId: null,
          calendar: this
        })
        : rawEvent;

    if (!transformedEvent) return null;

    const event = normalizeEvent({
      id: transformedEvent.id || `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...transformedEvent
    }, null, this.options);

    if (!event) return null;

    const canApply = this.resolveEventConflict({
      operation: 'add',
      proposedEvent: event,
      oldEvent: null,
      updates: null,
      originalEvent: options.originalEvent || null
    });

    if (canApply && isFn(canApply.then)) {
      return canApply.then(allowed => {
        if (!allowed) {
          this._notify('eventAddCancelled', {
            event,
            proposedEvent: event,
            reason: 'conflict',
            originalEvent: options.originalEvent || null
          });

          return null;
        }

        return this.applyEventAdd(event, options);
      });
    }

    if (!canApply) {
      this._notify('eventAddCancelled', {
        event,
        proposedEvent: event,
        reason: 'conflict',
        originalEvent: options.originalEvent || null
      });

      return null;
    }

    return this.applyEventAdd(event, options);
  }

  updateEvent(eventId, updates) {
    const oldEvent = this.eventStore.getEventById(eventId);

    if (!oldEvent) return null;

    const event = this.eventStore.updateEvent(eventId, updates);

    if (!event) return null;

    this._notify('eventUpdated', { event, oldEvent });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'update',
      eventId: event.id,
      event,
      oldEvent,
      updates
    });

    return event;
  }

  /**
   * Create the small public payload used by onEventChange/onEventMove/onEventResize.
   *
   * event is the current/original event. nextEvent is the proposed event that
   * TinyScheduler will apply only when the callback does not return false.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} event - Current event before mutation.
   * @param {Object} nextEvent - Proposed event after mutation.
   * @returns {{ action: string, event: Object, nextEvent: Object, view: string }}
   */
  createEventChangeInfo(action, event, nextEvent) {
    return {
      action,
      event: { ...event },
      nextEvent: { ...nextEvent },
      view: this.state.currentView
    };
  }

  /**
   * Return the user callback for one schedule change.
   * onEventChange is the preferred general hook. onEventMove/onEventResize are
   * kept as simple backward-compatible aliases and receive the same payload.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @returns {Function|null}
   */
  getEventChangeCallback(action) {
    if (isFn(this.options.onEventChange)) {
      return this.options.onEventChange;
    }

    if (action === 'move' && isFn(this.options.onEventMove)) {
      return this.options.onEventMove;
    }

    if (action === 'resize' && isFn(this.options.onEventResize)) {
      return this.options.onEventResize;
    }

    return null;
  }

  /**
   * Run the optional cancellable schedule-change callback.
   * false or Promise<false> cancels the change. Any other value accepts it.
   *
   * @param {Object} changeInfo - Small public schedule-change payload.
   * @returns {*|Promise<*>}
   */
  runEventChangeCallback(changeInfo) {
    this._emit('eventChange', changeInfo);
    this._emit(changeInfo.action === 'resize' ? 'eventResize' : 'eventMove', changeInfo);

    const callback = this.getEventChangeCallback(changeInfo.action);

    if (!callback) {
      return undefined;
    }

    try {
      return callback.call(this, changeInfo);
    } catch (error) {
      this._notify('eventChangeError', {
        action: changeInfo.action,
        reason: 'callback',
        error,
        event: changeInfo.event,
        nextEvent: changeInfo.nextEvent
      });

      return false;
    }
  }

  /**
   * Support legacy callback results that return a partial update object.
   * The preferred callback return is boolean/undefined.
   *
   * @param {*} result - Callback result.
   * @param {Object} updates - Original proposed updates.
   * @returns {Object}
   */
  getEventChangeUpdatesFromCallbackResult(result, updates) {
    return result && isObj(result) ? { ...updates, ...result } : updates;
  }

  /**
   * Cancel a pending move/resize and redraw the original event position.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} event - Current/original event.
   * @param {Object} nextEvent - Rejected proposed event.
   * @param {string} reason - Cancel reason.
   * @param {Event|null} originalEvent - Native event.
   * @returns {null}
   */
  cancelEventChange(action, event, nextEvent, reason = 'callback', originalEvent = null) {
    const payload = {
      action,
      reason,
      event,
      nextEvent,
      originalEvent
    };

    this._notify('eventChangeCancelled', payload);
    this._notify(action === 'resize' ? 'eventResizeCancelled' : 'eventMoveCancelled', payload);
    this.redrawEvent(event.id);

    return null;
  }

  /**
   * Apply a validated move/resize to the event store and refresh the display.
   *
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Object} oldEvent - Event before mutation.
   * @param {Object} updates - Final updates to apply.
   * @param {Event|null} originalEvent - Native event.
   * @returns {Object|null}
   */
  applyEventChange(action, oldEvent, updates, originalEvent = null) {
    const event = this.eventStore.updateEvent(oldEvent.id, updates);

    if (!event) return null;

    this._notify('eventChanged', { action, event, oldEvent, originalEvent });

    if (action === 'move') {
      this._notify('eventMoved', { event, oldEvent, originalEvent });
    } else if (action === 'resize') {
      this._notify('eventResized', { event, oldEvent, originalEvent });
    }

    this._notify('eventUpdated', { event, oldEvent });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: action,
      eventId: event.id,
      event,
      oldEvent,
      updates,
      originalEvent
    });

    return event;
  }

  /**
   * Request one schedule change.
   * Conflicts and the user callback are resolved before the store is mutated.
   *
   * @param {string|number} eventId - Event id.
   * @param {Object} updates - Proposed updates.
   * @param {'move'|'resize'} action - Schedule-change type.
   * @param {Event|null} originalEvent - Native event.
   * @returns {Object|null|Promise<Object|null>}
   */
  requestEventChange(eventId, updates, action = 'move', originalEvent = null) {
    const oldEvent = this.eventStore.getEventById(eventId);

    if (!oldEvent) return null;

    const proposedEvent = normalizeEvent({
      ...oldEvent.raw,
      ...oldEvent,
      ...updates,
      id: oldEvent.id
    }, { id: oldEvent.sourceId }, this.options);

    if (!proposedEvent) return null;

    const applyAfterCallback = callbackResult => {
      if (callbackResult === false) {
        return this.cancelEventChange(action, oldEvent, proposedEvent, 'callback', originalEvent);
      }

      return this.applyEventChange(
          action,
          oldEvent,
          this.getEventChangeUpdatesFromCallbackResult(callbackResult, updates),
          originalEvent
      );
    };

    const runCallback = () => {
      const changeInfo = this.createEventChangeInfo(action, oldEvent, proposedEvent);
      const callbackResult = this.runEventChangeCallback(changeInfo);

      if (callbackResult && isFn(callbackResult.then)) {
        return callbackResult
            .then(applyAfterCallback)
            .catch(error => {
              this._notify('eventChangeError', {
                action,
                reason: 'callback',
                error,
                event: oldEvent,
                nextEvent: proposedEvent,
                originalEvent
              });

              return this.cancelEventChange(action, oldEvent, proposedEvent, 'error', originalEvent);
            });
      }

      return applyAfterCallback(callbackResult);
    };

    const canApply = this.resolveEventConflict({
      operation: action,
      proposedEvent,
      oldEvent,
      updates,
      originalEvent
    });

    if (canApply && isFn(canApply.then)) {
      return canApply.then(allowed => {
        if (!allowed) {
          return this.cancelEventChange(action, oldEvent, proposedEvent, 'conflict', originalEvent);
        }

        return runCallback();
      });
    }

    if (!canApply) {
      return this.cancelEventChange(action, oldEvent, proposedEvent, 'conflict', originalEvent);
    }

    return runCallback();
  }

  moveEvent(eventId, updates, originalEvent = null) {
    return this.requestEventChange(eventId, updates, 'move', originalEvent);
  }

  deleteEvent(eventId) {
    const event = this.eventStore.deleteEvent(eventId);

    if (!event) return null;


    if (this.selectedEventId === String(eventId)) {
      this.clearSelection();
    }

    this._notify('eventDeleted', { event });
    this._notify('eventsChanged', { events: this.getEvents() });
    this.refreshEventDisplay({
      type: 'delete',
      eventId: String(eventId),
      event: null,
      oldEvent: event
    });

    return event;
  }

  removeEvent(eventId) {
    return this.deleteEvent(eventId);
  }

  getEvents() {
    return this.eventStore.getEvents();
  }

  getEventsForDate(date) {
    return this.eventStore.getEventsForDate(date);
  }

  getEventsInRange(start, end) {
    return this.eventStore.getEventsInRange(start, end);
  }

  getEventsByDate() {
    return this.eventStore.getEventsByDate();
  }

  setEventSources(sources) {
    this.sourceManager.setEventSources(sources);
    this.refresh();
    return this;
  }

  addEventSource(source) {
    this.sourceManager.addEventSource(source);
    this.refresh();
    return this;
  }

  removeEventSource(sourceId) {
    this.sourceManager.removeEventSource(sourceId);
    this.refresh();
    return this;
  }

  getEventSources() {
    return this.sourceManager.getEventSources();
  }

  refetchEvents() {
    return this.refresh();
  }

  refetchEventSource(sourceId) {
    return this.refresh();
  }

  ensureEventsLoaded(start, end) {
    return this.refresh();
  }

  setResources(resources) {
    this.sourceManager.setResourceSources([resources]);
    this.refresh();
    return this;
  }

  addResource(resource) {
    const normalized = this.resourceStore.addResource(resource);

    this._notify('resourceAdded', { resource: normalized });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return normalized;
  }

  updateResource(resourceId, updates) {
    const resource = this.resourceStore.updateResource(resourceId, updates);

    this._notify('resourceUpdated', { resource });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return resource;
  }

  deleteResource(resourceId) {
    const resource = this.resourceStore.deleteResource(resourceId);

    this._notify('resourceDeleted', { resource });
    this._notify('resourcesChanged', { resources: this.getResources() });
    this.redrawPreservingScroll();

    return resource;
  }

  removeResource(resourceId) {
    return this.deleteResource(resourceId);
  }

  getResources() {
    return this.resourceStore.getResources();
  }

  setResourceSources(sources) {
    this.sourceManager.setResourceSources(sources);
    this.refresh();
    return this;
  }

  addResourceSource(source) {
    this.sourceManager.addResourceSource(source);
    this.refresh();
    return this;
  }

  removeResourceSource(sourceId) {
    this.sourceManager.removeResourceSource(sourceId);
    this.refresh();
    return this;
  }

  getResourceSources() {
    return this.sourceManager.getResourceSources();
  }

  refetchResources() {
    return this.refresh();
  }

  async searchEvents(query, options = {}) {
    this.state.searchQuery = query || '';
    this._notify('searchStart', { query });

    let events;

    if (this.options.searchEvents && options.useServerSearch !== false) {
      events = await this.options.searchEvents({ query });
    } else {
      events = this.getEvents().filter(event => {
        return matchesEventSearch(
            event,
            query,
            this.resourceStore.getResourceById(event.resourceId),
            options
        );
      });
    }

    this._notify('searchEnd', { query, events });

    return events;
  }

  clearSearch() {
    this.state.searchQuery = '';
    this._notify('searchCleared');
    return this;
  }

  getSearchQuery() {
    return this.state.searchQuery;
  }

  setToolbar(toolbarConfig) {
    this.options.toolbar = toolbarConfig;
    this.refreshToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  getToolbar() {
    return this.options.toolbar;
  }

  setCustomButtons(customButtons) {
    this.options.customButtons = customButtons || {};
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  addCustomButton(name, buttonConfig) {
    this.options.customButtons[name] = buttonConfig;
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  removeCustomButton(name) {
    delete this.options.customButtons[name];
    this.refreshToolbar();
    this.refreshEventActionToolbar();
    this._notify('toolbarChanged');
    return this;
  }

  getCustomButtons() {
    return { ...this.options.customButtons };
  }


  /**
   * Return the first rendered event element for a given event id.
   *
   * A single event can have multiple DOM nodes, for example in month popovers.
   * This helper returns the first connected element inside this scheduler root.
   *
   * @param {string|number} eventId - Event id.
   * @returns {HTMLElement|null}
   */
  getRenderedEventElementById(eventId) {
    const normalizedEventId = String(eventId);
    const elements = this.eventElementsById.get(normalizedEventId) || this.eventElementsById.get(eventId);

    if (elements) {
      const element = Array.from(elements).find(candidate => {
        return candidate.isConnected && this.rootElement.contains(candidate);
      });

      if (element) return element;
    }

    return this.rootElement.querySelector(`[data-event-id="${this.escapeCssValue(normalizedEventId)}"]`);
  }

  /**
   * Select a rendered event by id and optionally scroll it into view.
   *
   * This is useful for external UI such as a frame sidebar event list. It does
   * not fetch data. It only works when the event is already rendered in the
   * current view/range.
   *
   * @param {string|number} eventId - Event id.
   * @param {Object} options - Selection options.
   * @param {boolean} options.scroll - Scroll selected event into view. Default true.
   * @param {Event|null} options.originalEvent - Original UI event, if any.
   * @returns {boolean} True when an event was found and selected.
   */
  selectEventById(eventId, options = {}) {
    const schedulerEvent = this.eventStore.getEventById(eventId) || this.eventStore.getEventById(String(eventId));
    const eventElement = this.getRenderedEventElementById(eventId);

    if (!schedulerEvent || !eventElement) {
      return false;
    }

    this.selectEventElement(schedulerEvent, eventElement, options.originalEvent || null);

    if (options.scroll !== false) {
      this.scrollElementIntoViewContainer(eventElement);
    }

    return true;
  }

  /**
   * Schedule auto-scroll after the current redraw cycle.
   *
   * @param {Date|string} date - Target date.
   * @returns {TinyScheduler}
   */
  scheduleAutoScrollToDate(date) {
    if (!this.options.autoScroll) return this;

    requestAnimationFrame(() => {
      this.scrollToDate(date);
    });

    return this;
  }

  /**
   * Scroll the current view to the best event/slot for a date.
   *
   * @param {Date|string} date - Target date.
   * @returns {TinyScheduler}
   */
  scrollToDate(date) {
    const targetDate = parseDateInput(date);

    if (this.options.autoScrollTarget === 'firstEvent') {
      const eventElement = this.getFirstEventElementOnDate(targetDate);

      if (eventElement) {
        return this.scrollElementIntoViewContainer(eventElement);
      }
    }

    const slotElement = this.getBestSlotElementForDate(targetDate);

    if (slotElement) {
      this.scrollElementIntoViewContainer(slotElement);
    }

    return this;
  }

  /**
   * Return the first rendered non-all-day event for a date.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getFirstEventElementOnDate(date) {
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);
    const events = this.eventStore
        .getEventsInRange(dayStart, dayEnd)
        .filter(event => isEventOnDate(event, date))
        .sort((firstEvent, secondEvent) => {
          return Number(isAllDayEvent(firstEvent)) - Number(isAllDayEvent(secondEvent))
              || firstEvent.start - secondEvent.start;
        });

    for (const event of events) {
      const eventElement = this.rootElement.querySelector(`[data-event-id="${this.escapeCssValue(event.id)}"]`);
      if (eventElement) return eventElement;
    }

    return null;
  }

  /**
   * Return the best fallback slot for a target date.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getBestSlotElementForDate(date) {
    const dateKey = formatDateKey(date);

    if (this.options.autoScrollTarget === 'currentTime' && isSameDay(date, new Date())) {
      const currentSlot = this.getCurrentTimeSlotElement(date);
      if (currentSlot) return currentSlot;
    }

    return this.rootElement.querySelector(`${SCHEDULER_SELECTORS.slot}[data-slot-start^="${dateKey}"]`);
  }

  /**
   * Return the slot containing the current time.
   *
   * @param {Date} date - Target date.
   * @returns {HTMLElement|null}
   */
  getCurrentTimeSlotElement(date) {
    const now = new Date();
    if (!isSameDay(date, now)) return null;

    const slots = Array.from(this.rootElement.querySelectorAll(`${SCHEDULER_SELECTORS.slot}[data-slot-start^="${formatDateKey(date)}"]`));
    if (!slots.length) return null;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return slots.find(slot => {
      const slotStart = parseDateInput(slot.dataset.slotStart);
      const slotEnd = parseDateInput(slot.dataset.slotEnd || slot.dataset.slotStart);
      const startMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
      const endMinutes = slotEnd.getHours() * 60 + slotEnd.getMinutes();

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }) || slots[0];
  }

  /**
   * Scroll an element inside the nearest scheduler scroll container.
   *
   * @param {HTMLElement} element - Element to reveal.
   * @returns {TinyScheduler}
   */
  scrollElementIntoViewContainer(element) {
    const scrollContainer = element.closest(`.${CLASS_NAMES.calendar.scrollContainer}`);

    if (!scrollContainer) {
      element.scrollIntoView({
        behavior: this.options.autoScrollBehavior,
        block: this.options.autoScrollBlock,
        inline: this.options.autoScrollInline
      });

      return this;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const topOffset = elementRect.top - containerRect.top;
    const leftOffset = elementRect.left - containerRect.left;

    scrollContainer.scrollTo({
      top: scrollContainer.scrollTop + topOffset - containerRect.height / 3,
      left: scrollContainer.scrollLeft + leftOffset - containerRect.width / 3,
      behavior: this.options.autoScrollBehavior
    });

    return this;
  }

  /**
   * Escape values used in querySelector attribute selectors.
   *
   * @param {string|number} value - Raw value.
   * @returns {string}
   */
  escapeCssValue(value) {
    if (typeof CSS !== 'undefined' && isFn(CSS.escape)) {
      return CSS.escape(String(value));
    }

    return String(value).replace(/"/g, '\"');
  }

  /**
   * Destroy the component and release DOM/listener references.
   *
   * @returns {TinyScheduler}
   */
  destroy() {
    this._notify('beforeDestroy');

    this.clearNowIndicatorTimer();
    this.closeMorePopover();
    this._unmountViewEvents();
    this.activeView?.destroy();
    this.interactionManager?.destroy();
    this.unbindRootEvents();

    this.eventActionToolbar?.remove();
    this.eventActionToolbar = null;
    this.eventResizeState = null;
    this.nowIndicatorTimer = null;
    this.ignoreNextClick = false;
    this.rootElement.innerHTML = '';
    this.activeView = null;
    this.viewHost = null;

    this._notify('destroy');

    return this;
  }
}
