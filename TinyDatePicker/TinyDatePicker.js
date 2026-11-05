/*!
 * TinyDatePicker v1.1.0
 * Lightweight vanilla JavaScript date picker with inline, modal, and permanent modes.
 *
 * Features:
 * - Single-date and range selection
 * - Locale-aware labels and date formats
 * - Optional event dots and marked dates
 * - Inline, modal, and always-visible rendering modes
 * - Optional input trigger button integration
 *
 * UMD usage:
 *   AMD:
 *     define(['TinyDatePicker'], function (TinyDatePicker) {
 *       const picker = new TinyDatePicker('#birthdate', { mode: 'modal' });
 *     });
 *
 *   CommonJS:
 *     const TinyDatePicker = require('./TinyDatePicker');
 *     const picker = new TinyDatePicker('#birthdate', { mode: 'inline' });
 *
 *   Browser global:
 *     const picker = new TinyDatePicker('#birthdate', {
 *       mode: 'modal',
 *       inputTriggerMode: 'button'
 *     });
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TinyDatePicker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TINY_DATE_PICKER_VERSION = '1.1.0';

  const TDP_CLASSES = Object.freeze({
    calendar: 'tdp-calendar',
    opened: 'tdp-calendar--opened',
    opening: 'tdp-calendar--opening',
    closing: 'tdp-calendar--closing',
    inline: 'tdp-calendar--inline',
    modal: 'tdp-calendar--modal',
    permanent: 'tdp-calendar--permanent',
    dark: 'tdp-calendar--dark',

    container: 'tdp-container',

    display: 'tdp-display',
    displayHeader: 'tdp-display__header',
    displayBody: 'tdp-display__body',
    displayDay: 'tdp-display__day',
    displayData: 'tdp-display__data',
    displayDataPrimary: 'tdp-display__data--primary',
    displayDataSecondary: 'tdp-display__data--secondary',
    displayDate: 'tdp-display__date',
    displayMonth: 'tdp-display__month',
    displayYear: 'tdp-display__year',

    picker: 'tdp-picker',
    pickerHeader: 'tdp-picker__header',
    pickerBody: 'tdp-picker__body',
    pickerFooter: 'tdp-picker__footer',

    periodSelector: 'tdp-period-selector',
    periodToolbar: 'tdp-period-selector__toolbar',
    periodDone: 'tdp-period-selector__done',
    periodWheels: 'tdp-period-selector__wheels',
    periodWheel: 'tdp-period-wheel',
    periodWheelMonth: 'tdp-period-wheel--month',
    periodWheelYear: 'tdp-period-wheel--year',
    periodWheelLabel: 'tdp-period-wheel__label',
    periodWheelViewport: 'tdp-period-wheel__viewport',
    periodWheelList: 'tdp-period-wheel__list',
    periodWheelOption: 'tdp-period-wheel__option',
    periodWheelOptionSelected: 'tdp-period-wheel__option--selected',
    periodWheelOptionDisabled: 'tdp-period-wheel__option--disabled',

    select: 'tdp-select',
    selectMonth: 'tdp-select__month',
    selectYear: 'tdp-select__year',
    selectNav: 'tdp-select__nav',
    selectNavPrev: 'tdp-select__nav--prev',
    selectNavNext: 'tdp-select__nav--next',
    selectNavInactive: 'tdp-select__nav--inactive',
    selectData: 'tdp-select__data',
    selectDataMonth: 'tdp-select__data--month',
    selectDataYear: 'tdp-select__data--year',

    table: 'tdp-table',
    tableHeader: 'tdp-table__header',
    tableBody: 'tdp-table__body',
    tableWeek: 'tdp-table__week',
    tableWeekday: 'tdp-table__weekday',

    date: 'tdp-date',
    dateActive: 'tdp-date--active',
    dateInactive: 'tdp-date--inactive',
    dateSelectable: 'tdp-date--selectable',
    dateToday: 'tdp-date--today',
    datePicked: 'tdp-date--picked',
    dateMarked: 'tdp-date--marked',
    dateRangeStart: 'tdp-date--range-start',
    dateRangeEnd: 'tdp-date--range-end',
    dateRangeSingle: 'tdp-date--range-single',
    dateInRange: 'tdp-date--in-range',
    dateRangePreview: 'tdp-date--range-preview',
    dateHasEvents: 'tdp-date--has-events',
    dateInner: 'tdp-date__inner',
    dateNumber: 'tdp-date__number',
    dateEvents: 'tdp-date__events',
    dateEventDot: 'tdp-date__event-dot',

    footerSection: 'tdp-footer__section',
    footerPrimary: 'tdp-footer__section--primary',
    footerSecondary: 'tdp-footer__section--secondary',

    btn: 'tdp-btn',
    btnSuccess: 'tdp-btn--success',
    btnDanger: 'tdp-btn--danger',

    input: 'tdp-input',
    inputRange: 'tdp-input--range',
    inputAssisted: 'tdp-input--assisted',
    inputInvalid: 'is-invalid',
    inputHasValue: 'tdp-input--has-value',
    inputWrap: 'tdp-input-wrap',
    inputTrigger: 'tdp-input-trigger',
    inputTriggerParent: 'tdp-input-trigger-parent'
  });

  const DOM_EVENT_NAMES = new Set([
    'click', 'change', 'input', 'focus', 'blur', 'keydown', 'keyup',
    'mousedown', 'mouseup', 'pointerdown', 'mouseover', 'submit'
  ]);

  /**
   * Returns the browser locale when available.
   * Fallback stays intentionally simple because locale resolution is normalized later.
   */
  function getBrowserLocale() {
    if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
    return 'en';
  }

  /**
   * Normalizes a locale string to the language code used internally by the picker.
   * @param {string} locale - Raw locale string like "fr-CH", "en_US", or "de".
   * @returns {string} Lower-cased language code such as "fr" or "en".
   */
  function normalizeLocale(locale) {
    const raw = String(locale || '').trim().replace(/_/g, '-'); // Raw locale cleaned before extraction.
    if (!raw) return 'en';
    return raw.split('-')[0].toLowerCase();
  }

  /**
   * Infers the default date format for a locale by reading Intl parts order.
   * @param {string} locale - Optional locale used to derive the pattern.
   * @returns {string} Pattern like DD/MM/YYYY or MM/DD/YYYY.
   */
  function getLocaleDateFormat(locale) {
    const resolvedLocale = locale || getBrowserLocale(); // Effective locale used for Intl resolution.
    try {
      const parts = new Intl.DateTimeFormat(resolvedLocale).formatToParts(new Date(2000, 11, 31));
      return parts.map((part) => {
        switch (part.type) {
          case 'day': return 'DD';
          case 'month': return 'MM';
          case 'year': return 'YYYY';
          default: return part.value;
        }
      }).join('');
    } catch (error) {
      return 'MM/DD/YYYY';
    }
  }

  /**
   * Builds locale-aware weekday and month labels from Intl.
   * @param {string} locale - Optional locale used for label generation.
   * @returns {{weekdaysMin: string[], days: string[], months: string[]}|undefined}
   */
  function getLocaleLabels(locale) {
    const resolvedLocale = locale || getBrowserLocale(); // Effective locale used for localized labels.

    try {
      const weekdayMinFormatter = new Intl.DateTimeFormat(resolvedLocale, { weekday: 'narrow' }); // One-letter weekday labels.
      const dayFormatter = new Intl.DateTimeFormat(resolvedLocale, { weekday: 'long' }); // Full weekday labels for aria/display.
      const monthFormatter = new Intl.DateTimeFormat(resolvedLocale, { month: 'long' }); // Full month labels for header/display.

      return {
        weekdaysMin: Array.from({ length: 7 }, (_, index) => weekdayMinFormatter.format(new Date(2023, 0, 1 + index))),
        days: Array.from({ length: 7 }, (_, index) => dayFormatter.format(new Date(2023, 0, 1 + index))),
        months: Array.from({ length: 12 }, (_, index) => monthFormatter.format(new Date(2023, index, 1)))
      };
    } catch (error) {
    }
  }

  function isValidLabelArray(value, expectedLength) {
    return Array.isArray(value) && value.length === expectedLength && value.every((entry) => typeof entry === 'string' && entry.trim() !== '');
  }

  function isI18nLeaf(value) {
    return !!(value && typeof value === 'object' && (
      isValidLabelArray(value.weekdaysMin, 7) ||
      isValidLabelArray(value.months, 12) ||
      isValidLabelArray(value.days, 7)
    ));
  }

  function normalizeI18nMapEntry(entry, locale) {
    if (!entry || typeof entry !== 'object') return null;
    const normalizedLocale = normalizeLocale(locale);

    if (isI18nLeaf(entry)) return entry;

    const keys = Object.keys(entry);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (normalizeLocale(key) === normalizedLocale && isI18nLeaf(entry[key])) {
        return entry[key];
      }
    }

    return null;
  }

  function resolveI18nDefinition(i18n, locale) {
    if (!i18n) return null;
    if (Array.isArray(i18n)) {
      for (let index = 0; index < i18n.length; index += 1) {
        const matched = normalizeI18nMapEntry(i18n[index], locale);
        if (matched) return matched;
      }
      return null;
    }

    if (isI18nLeaf(i18n)) return i18n;

    return normalizeI18nMapEntry(i18n, locale);
  }

  /**
   * Resolves the final options object by merging defaults, instance options,
   * global overrides, and locale-derived fallbacks.
   * @param {Object} provided - User supplied options passed to the constructor.
   * @returns {Object} Fully normalized options used by the instance.
   */
  function resolveOptions(provided) {
    const base = defaultOptions(); // Immutable-ish baseline returned by the internal factory.
    const next = Object.assign({}, base, provided || {}); // Final mutable options object for this instance.
    next.classes = Object.assign({}, base.classes, (provided && provided.classes) || {}); // Class map merged shallowly to allow partial overrides.

    const locale = normalizeLocale((provided && provided.locale) || TinyDatePicker.locale || getBrowserLocale()); // Effective locale for this instance.
    const localeLabels = getLocaleLabels(locale); // Intl-derived labels used as the last fallback.
    const globalI18n = resolveI18nDefinition(TinyDatePicker.i18n, locale); // Matching global language pack.
    const optionI18n = resolveI18nDefinition(provided && provided.i18n, locale); // Matching per-instance language pack.

    next.locale = locale;
    next.dateFormat = provided?.dateFormat || TinyDatePicker.dateFormat || getLocaleDateFormat(locale); // Effective display/output format.

    const resolveLabelArray = (key, expectedLength) => {
      const candidate =
          isValidLabelArray(provided && provided[key], expectedLength) ? provided[key]
              : isValidLabelArray(optionI18n && optionI18n[key], expectedLength) ? optionI18n[key]
                  : isValidLabelArray(globalI18n && globalI18n[key], expectedLength) ? globalI18n[key]
                      : localeLabels[key];

      return candidate.slice();
    };

    next.weekdaysMin = resolveLabelArray('weekdaysMin', 7);
    next.months = resolveLabelArray('months', 12);
    next.days = resolveLabelArray('days', 7);

    next.clearText = provided?.clearText || optionI18n?.clearText || globalI18n?.clearText || 'Clear';
    next.cancelText = provided?.cancelText || optionI18n?.cancelText || globalI18n?.cancelText || 'Cancel';
    next.confirmText = provided?.confirmText || optionI18n?.confirmText || globalI18n?.confirmText || 'OK';
    next.periodMonthText = provided?.periodMonthText || optionI18n?.periodMonthText || globalI18n?.periodMonthText || 'Month';
    next.periodYearText = provided?.periodYearText || optionI18n?.periodYearText || globalI18n?.periodYearText || 'Year';
    next.periodDoneText = provided?.periodDoneText || optionI18n?.periodDoneText || globalI18n?.periodDoneText || 'Choose day';

    return next;
  }

  function isFn(value) {
    return typeof value === 'function';
  }

  /**
   * Minimal event bus used by the picker for both delegated DOM events and
   * custom component events (tdp:*).
   */
  class MicroEvent {
    constructor(eventRoot = null) {
      this._eventRoot = eventRoot; // Root used for delegated DOM listeners.
      this._domListeners = []; // Registered native listeners so destroy/off can clean them up.
      this._customListeners = []; // Registered custom event listeners created through .on().
    }

    setEventRoot(root) {
      this._eventRoot = root;
      return this;
    }

    on(events, selector, handler, options) {
      if (isFn(selector)) {
        options = handler;
        handler = selector;
        selector = null;
      }

      if (!isFn(handler)) {
        throw new TypeError('MicroEvent.on(): handler must be a function');
      }

      parseEventNames(events).forEach((entry) => {
        if (DOM_EVENT_NAMES.has(entry.type) && this._eventRoot) {
          const wrapped = (nativeEvent) => {
            if (!selector) {
              handler.call(this, nativeEvent);
              return;
            }

            const match = nativeEvent.target.closest(selector);
            if (!match || !this._eventRoot.contains(match)) return;
            nativeEvent.delegateTarget = match;
            handler.call(this, nativeEvent);
          };

          this._eventRoot.addEventListener(entry.type, wrapped, options || false);
          this._domListeners.push({ entry, selector, handler, wrapped, options: options || false, target: this._eventRoot });
        } else {
          this._customListeners.push({ entry, selector, handler });
        }
      });

      return this;
    }

    listen(target, events, handler, options) {
      if (!target || !target.addEventListener) {
        throw new TypeError('MicroEvent.listen(): target must be a DOM element or EventTarget');
      }
      if (!isFn(handler)) {
        throw new TypeError('MicroEvent.listen(): handler must be a function');
      }

      String(events || '').trim().split(/\s+/).filter(Boolean).forEach((type) => {
        const wrapped = (event) => handler.call(this, event);
        target.addEventListener(type, wrapped, options || false);
        this._domListeners.push({ entry: { type, namespace: '' }, selector: null, handler, wrapped, options: options || false, target });
      });

      return this;
    }

    off(events, selector, handler) {
      if (isFn(selector)) {
        handler = selector;
        selector = null;
      }

      const entries = events ? parseEventNames(events) : [null];

      this._domListeners = this._domListeners.filter((listener) => {
        const remove = entries.some((entry) => matchListener(listener, entry, selector, handler));
        if (remove) {
          listener.target.removeEventListener(listener.entry.type, listener.wrapped, listener.options);
          return false;
        }
        return true;
      });

      this._customListeners = this._customListeners.filter((listener) => {
        return !entries.some((entry) => matchListener(listener, entry, selector, handler));
      });

      return this;
    }

    trigger(eventNames, detail) {
      if (Array.isArray(eventNames)) {
        return eventNames.map((eventName) => this._triggerOne(eventName, detail));
      }
      return this._triggerOne(eventNames, detail);
    }

    _triggerOne(eventName, detail) {
      const entry = parseEventNames(eventName)[0];
      if (!entry || !entry.type) {
        throw new TypeError('MicroEvent.trigger(): eventName must be a non-empty string');
      }
      const event = new CustomEvent(entry.type, {
        bubbles: false,
        cancelable: true,
        detail: detail || {}
      });
      this._customListeners.forEach((listener) => {
        if (listener.entry.type !== entry.type) return;
        if (entry.namespace && listener.entry.namespace !== entry.namespace) return;
        listener.handler.call(this, event);
      });
      return event;
    }

    destroyEvents() {
      this.off();
    }
  }

  /**
   * Main date picker class.
   * @param {Element|string} target - Target element or selector used to attach the picker.
   * @param {Object} options - Instance configuration merged with global/default options.
   */
  class TinyDatePicker extends MicroEvent {
    constructor(target, options) {
      super(null);

      this.options = resolveOptions(options || {}); // Final normalized options for this instance.
      this._normalizeConstraintOptions();
      this.classes = this.options.classes; // Resolved CSS class map used everywhere in rendering.
      this.mode = this.options.mode; // Rendering mode: inline, modal, or permanent.
      this.allowRangeSelection = !!this.options.allowRangeSelection; // Enables start/end range workflow.

      this.target = resolveElement(target); // DOM node controlled by the picker.

      if (!this.target) throw new Error('TinyDatePicker: target not found');

      this.isInput = this.target instanceof HTMLInputElement; // Whether the target is an <input>.
      this.inputTriggerMode = this._resolveInputTriggerMode(); // Effective modal trigger behavior for inputs.
      this.options.assistDateInput = this._resolveAssistDateInput(); // Effective manual-input assistance policy.
      this._inputFormatter = null; // Cleave instance, when assisted input is enabled and available.

      if (this.isInput) {
        this.target.setAttribute('autocomplete', 'off');
        this._setupInputFormatting();
        this._applyInputPlaceholder();
        this._applyInputBaseClass();
      }

      this._uid = `tdp-${Math.random().toString(36).slice(2, 10)}`; // DOM id used to identify this calendar instance.
      this._isDestroyed = false; // Guards methods after destroy().
      this._isOpen = false; // Current open/closed state.
      this._isMounted = false; // Whether the root is currently attached to the DOM.
      this._today = startOfDay(new Date()); // Cached "today" date, truncated to date-only precision.
      this._selectedDate = null; // Current single-date selection.
      this._lastCommittedDate = null; // Last confirmed single-date selection, used by cancel.
      this._rangeStartDate = null; // Current range start date.
      this._rangeEndDate = null; // Current range end date.
      this._rangeHoverDate = null; // Hovered date used for temporary range preview.
      this._awaitingRangeEnd = false; // True after the first range click and before the second one.
      this._lastCommittedRange = null; // Last confirmed range, used by cancel.
      this._isClickOutsideBound = null; // Flag to avoid duplicate outside-click listeners.
      this._isPeriodSelectorOpen = false; // True while the month/year wheel view replaces the day grid.
      this._activePeriodWheel = 'month'; // Wheel that should receive focus when the selector opens.
      this._periodWheelStates = Object.create(null); // Runtime state for month/year scroll positions.
      this._periodWheelTimers = Object.create(null); // Debounce timers used after native wheel scrolling.
      this._periodAvailabilityCache = new Map(); // Avoids repeatedly scanning every day in the same month.

      this._initializeSelectionState(); // Bootstraps selection from options and/or current input value.
      this._eventsMap = new Map(); // YYYY-MM-DD => normalized events for visible cells.
      this._eventsRequestId = 0; // Monotonic id used to ignore stale async event responses.
      this._loadedEventRangeKey = ''; // Cache key for the month range already loaded for events.
      this._isClosing = false; // Prevents double-close while closing animation is running.
      this._handleCloseAnimationEnd = null; // Reference to the current close animation callback.
      this._inputWrap = null; // Optional wrapper created around the input in button-trigger mode.
      this._triggerButton = null; // Existing or injected calendar trigger button.
      this._isExternalTriggerButton = false; // True when an existing DOM trigger button is reused.
      this._build(); // Creates the DOM structure once.
      this._buildInputTriggerButton();
      this.setEventRoot(this.root);
      this._bindInternalEvents();
      this._setSynchronousVisibleMonthEvents();
      this._render();
      this._syncTargetValue();
      this._storeInstance();

      if (!this.isModal) {
        this._mount();
      }
      if (this.isPermanent) {
        this.open();
      }
    }

    get isInline() { return this.mode === 'inline'; }
    get isModal() { return this.mode === 'modal'; }
    get isPermanent() { return this.mode === 'permanent'; }

    /**
     * Opens the picker, mounts it if needed, then starts the opening lifecycle.
     * Returns the instance for chaining.
     */
    open() {
      if (this._isDestroyed || this._isOpen) {
        return this;
      }

      // If a close animation was still pending, the opening flow takes control again.
      this._isClosing = false;

      if (this._handleCloseAnimationEnd) {
        this.root.removeEventListener('animationend', this._handleCloseAnimationEnd);
        this._handleCloseAnimationEnd = null;
      }

      this._mount();

      this.root.classList.remove(this.classes.closing);
      this.root.classList.add(this.classes.opened, this.classes.opening);
      this.root.setAttribute('aria-hidden', 'false');
      this._isOpen = true;

      const clearOpeningState = () => {
        this.root.classList.remove(this.classes.opening);
        this.root.removeEventListener('animationend', clearOpeningState);
      };

      this.root.addEventListener('animationend', clearOpeningState);

      if (this.isInline) {
        this._positionInline();
      }

      this._refreshVisibleMonthEvents();

      if (isFn(this.options.onOpen)) {
        this.options.onOpen.call(this, this.getDate());
      }

      this.trigger('tdp:open', this._eventPayload());

      window.setTimeout(() => {
        if (this._isOpen) {
          this._bindClickOutside();
        }
      }, 0);

      return this;
    }

    _setupInputFormatting() {
      if (!this.isInput || !this.options.assistDateInput) return;

      const CleaveCtor = typeof window !== 'undefined' ? window.Cleave : null;
      if (typeof CleaveCtor !== 'function') return;

      const config = this._getAssistedDateInputConfig(this.options.dateFormat);
      if (!config) return;

      this._inputFormatter = new CleaveCtor(this.target, config);
    }

    _destroyInputFormatting() {
      if (!this._inputFormatter || typeof this._inputFormatter.destroy !== 'function') {
        this._inputFormatter = null;
        return;
      }

      this._inputFormatter.destroy();
      this._inputFormatter = null;
    }

    _getAssistedDateInputConfig(dateFormat) {
      const format = String(dateFormat || '').trim();
      if (!format) return null;

      // Support only pure numeric token formats
      const match = format.match(/^(DD|MM|YYYY)([./-])(DD|MM|YYYY)\2(DD|MM|YYYY)$/);
      if (!match) return null;

      const tokenToPattern = {
        DD: 'd',
        MM: 'm',
        YYYY: 'Y'
      };

      const tokenToBlockSize = {
        DD: 2,
        MM: 2,
        YYYY: 4
      };

      const tokens = [match[1], match[3], match[4]];
      const dateDelimiter = match[2];

      // Single date mode
      if (!this.allowRangeSelection) {
        return {
          date: true,
          delimiter: dateDelimiter,
          datePattern: tokens.map((token) => tokenToPattern[token])
        };
      }

      // Range mode
      const rangeSeparator = String(this.options.rangeSeparator || ' – ');

      return {
        blocks: [
          ...tokens.map((token) => tokenToBlockSize[token]),
          ...tokens.map((token) => tokenToBlockSize[token])
        ],
        delimiters: [
          dateDelimiter,
          dateDelimiter,
          rangeSeparator,
          dateDelimiter,
          dateDelimiter
        ],
        numericOnly: true
      };
    }

    _hasRunningRootAnimation() {
      const styles = getComputedStyle(this.root);
      return styles.animationName !== 'none' && styles.animationDuration !== '0s';
    }

    /**
     * Closes the picker.
     * In animated contexts, unmount/final cleanup is delayed until animationend.
     */
    close(reason = 'close') {
      if (this._isDestroyed || !this._isOpen || this.isPermanent || this._isClosing) {
        return this;
      }

      this._unbindClickOutside(); // Stop listening before the next outside click fires again.
      this._isClosing = true; // Lock the instance while the closing animation is running.

      this.root.classList.remove(this.classes.opening);
      this.root.classList.add(this.classes.closing);

      const finalize = (event) => {
        if (event && event.target !== this.root) return;

        this.root.removeEventListener('animationend', finalize);

        if (!this._isClosing) return;

        this._finalizeClose(reason);
      };

      if (this._hasRunningRootAnimation()) {
        this._handleCloseAnimationEnd = finalize;
        this.root.addEventListener('animationend', finalize);
      } else {
        finalize(); // immediate close
      }

      return this;
    }

    _finalizeClose(reason = 'close') {
      this._closePeriodSelector({ focus: false, silent: true });
      this.root.classList.remove(
          this.classes.opened,
          this.classes.opening,
          this.classes.closing
      );

      this.root.setAttribute('aria-hidden', 'true');
      this._isOpen = false;
      this._isClosing = false;

      const payload = this._eventPayload({dismiss: reason});

      if (isFn(this.options.onClose)) {
        this.options.onClose.call(this, payload);
      }

      this.trigger('tdp:close', payload);

      if (this.isModal) {
        this._unmount();
      }

      this._handleCloseAnimationEnd = null;
    }

    toggle() {
      return this._isOpen ? this.close() : this.open();
    }

    val(value) {
      if (arguments.length === 0) {
        return this._getFormattedValue();
      }
      if (value === null || value === '') {
        this.clear();
        return this;
      }

      if (this.allowRangeSelection && typeof value === 'string') {
        const parsedRange = normalizeOptionRange(value, this.options);
        if (parsedRange) {
          return this.setRange(parsedRange.startDate, parsedRange.endDate);
        }
      }

      return this.setDate(value);
    }

    getDate() {
      if (this.allowRangeSelection) {
        return this._rangeStartDate ? cloneDate(this._rangeStartDate) : null;
      }
      return this._selectedDate ? cloneDate(this._selectedDate) : null;
    }

    getRange() {
      return {
        startDate: this._rangeStartDate ? cloneDate(this._rangeStartDate) : null,
        endDate: this._rangeEndDate ? cloneDate(this._rangeEndDate) : null,
        isComplete: !!(this._rangeStartDate && this._rangeEndDate)
      };
    }

    setDate(value, meta) {
      const date = normalizeOptionDate(value, this.options);
      const details = meta || {};
      if (!date || !this._isSelectable(date)) return this;

      if (this.allowRangeSelection) {
        return this.setRange(date, date, details);
      }

      this._selectedDate = cloneDate(date);
      this._lastCommittedDate = cloneDate(date);
      this._viewDate = cloneDate(date);
      this._syncTargetValue(false); // silent = false
      this._render();

      if (isFn(this.options.onSelect)) {
        this.options.onSelect.call(this, this.getDate());
      }
      this.trigger(['tdp:select', 'tdp:change'], this._eventPayload(details));

      if (this.options.autoClose && !this.isPermanent) {
        this.close();
      }
      return this;
    }

    setViewDate(value) {
      const date = normalizeOptionDate(value, this.options);
      if (!date) return this;

      this._viewDate = cloneDate(date);
      this._setSynchronousVisibleMonthEvents();
      this._render();
      this._refreshVisibleMonthEvents();

      return this;
    }

    setRange(startValue, endValue, meta) {
      const details = meta || {};
      const normalized = normalizeOptionRange({ startDate: startValue, endDate: endValue }, this.options);
      if (!normalized) return this;
      if (!this._isRangeSelectable(normalized.startDate, normalized.endDate)) return this;

      this._rangeStartDate = cloneDate(normalized.startDate);
      this._rangeEndDate = cloneDate(normalized.endDate);
      this._rangeHoverDate = null;
      this._awaitingRangeEnd = false;
      this._lastCommittedRange = cloneRange(normalized);
      this._viewDate = cloneDate(normalized.endDate || normalized.startDate);
      this._syncTargetValue();
      this._render();

      if (isFn(this.options.onSelect)) {
        this.options.onSelect.call(this, this.getRange());
      }
      this.trigger(['tdp:select', 'tdp:change'], this._eventPayload(details));

      if (this.options.autoClose && !this.isPermanent) {
        this.close();
      }
      return this;
    }

    clear(meta) {
      this._selectedDate = null;
      this._lastCommittedDate = null;
      this._rangeStartDate = null;
      this._rangeEndDate = null;
      this._rangeHoverDate = null;
      this._awaitingRangeEnd = false;
      this._lastCommittedRange = null;
      // Clearing is a real value change, just like setDate(). Dispatch the
      // native change event so form validation and other listeners stay in sync.
      this._syncTargetValue(false);
      this._render();
      this.trigger(['tdp:clear', 'tdp:change'], this._eventPayload(meta));
      return this;
    }

    prevMonth() {
      return this._changeView(addMonths(this._viewDate, -1), 'prev');
    }

    nextMonth() {
      return this._changeView(addMonths(this._viewDate, 1), 'next');
    }

    prevYear() {
      return this._changeView(addYears(this._viewDate, -1), 'prev');
    }

    nextYear() {
      return this._changeView(addYears(this._viewDate, 1), 'next');
    }

    destroy() {
      if (this._isDestroyed) return;
      this.close();
      this._clearPeriodWheelTimers();
      this.destroyEvents();
      document.removeEventListener('keydown', this._handleDocumentKeydown, true);
      window.removeEventListener('resize', this._handleWindowResize);
      window.removeEventListener('scroll', this._handleWindowResize, true);
      this._destroyInputFormatting();
      this._destroyInputTriggerButton();
      this._unmount();
      if (this.target && this.target._tinyDatePicker === this) {
        delete this.target._tinyDatePicker;
      }
      this._isDestroyed = true;
    }

    _storeInstance() {
      this.target._tinyDatePicker = this;
      this.target.dataset.tdpId = this._uid;
    }

    _mount() {
      if (this._isMounted) return;
      this.options.appendTo.appendChild(this.root);
      this._isMounted = true;
    }

    _unmount() {
      if (!this._isMounted) return;
      if (this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
      }
      this._isMounted = false;
    }


    /**
     * Restores the initial selection from explicit options first, then from the current input value.
     * Range mode and single-date mode are bootstrapped differently.
     */
    _initializeSelectionState() {
      if (this.allowRangeSelection) {
        let initialRange = normalizeOptionRange(this.options.selectedRange, this.options); // Highest-priority initial range source.

        if (!initialRange && this.options.selectedDate !== null && this.options.selectedDate !== undefined && this.options.selectedDate !== '') {
          initialRange = normalizeOptionRange(this.options.selectedDate, this.options);
        }

        if (!initialRange && this.options.value !== null && this.options.value !== undefined && this.options.value !== '') {
          initialRange = normalizeOptionRange(this.options.value, this.options);
        }

        if (!initialRange && this.isInput && this.target.value) {
          initialRange = normalizeOptionRange(this.target.value, this.options);
        }

        if (initialRange && this._isRangeSelectable(initialRange.startDate, initialRange.endDate)) {
          this._rangeStartDate = cloneDate(initialRange.startDate);
          this._rangeEndDate = cloneDate(initialRange.endDate);
          this._lastCommittedRange = cloneRange(initialRange);
        }

        this._viewDate = cloneDate(this._rangeEndDate || this._rangeStartDate || this._today);
        return;
      }

      this._selectedDate = normalizeOptionDate(this.options.selectedDate || this.options.value, this.options);
      if (!this._selectedDate && this.isInput && this.target.value) {
        this._selectedDate = normalizeOptionDate(this.target.value, this.options);
      }
      this._viewDate = this._selectedDate ? cloneDate(this._selectedDate) : cloneDate(this._today);
      this._lastCommittedDate = this._selectedDate ? cloneDate(this._selectedDate) : null;
    }

    /**
     * Handles grid clicks in range mode.
     * First click starts a pending range, second click commits it if all days are selectable.
     * @param {Date|string} value - Clicked date value.
     * @param {Object} meta - Optional metadata merged into emitted event payloads.
     */
    _handleRangeDateSelection(value, meta) {
      const date = normalizeOptionDate(value, this.options); // Normalized clicked day.
      const details = meta || {}; // Extra event payload metadata.
      if (!date || !this._isSelectable(date)) return this;

      if (!this._awaitingRangeEnd || !this._rangeStartDate || this._rangeEndDate) {
        this._rangeStartDate = cloneDate(date);
        this._rangeEndDate = null;
        this._rangeHoverDate = null;
        this._awaitingRangeEnd = true;
        this._viewDate = cloneDate(date);
        this._syncTargetValue();
        this._render();
        this.trigger('tdp:rangestart', this._eventPayload(details));
        return this;
      }

      if (!this._isRangeSelectable(this._rangeStartDate, date)) return this;

      return this.setRange(this._rangeStartDate, date, details);
    }

    _getFormattedValue() {
      if (this.allowRangeSelection) {
        if (!this._rangeStartDate) return '';

        const startText = this.options.formatDate(this._rangeStartDate, this.options);
        if (!this._rangeEndDate) {
          return `${startText}${this.options.rangeSeparator}`;
        }
        if (isSameDay(this._rangeStartDate, this._rangeEndDate)) {
          return startText;
        }
        return `${startText}${this.options.rangeSeparator}${this.options.formatDate(this._rangeEndDate, this.options)}`;
      }

      return this._selectedDate ? this.options.formatDate(this._selectedDate, this.options) : '';
    }

    _getPreviewRange() {
      if (!this.allowRangeSelection || !this._awaitingRangeEnd || !this._rangeStartDate || !this._rangeHoverDate) return null;
      if (!this._isRangeSelectable(this._rangeStartDate, this._rangeHoverDate)) return null;
      return orderDateRange(this._rangeStartDate, this._rangeHoverDate);
    }

    _isRangeSelectable(startDate, endDate) {
      const ordered = orderDateRange(startDate, endDate);
      if (!ordered) return false;

      let cursor = cloneDate(ordered.startDate);
      const lastKey = toISODate(ordered.endDate);
      while (true) {
        if (!this._isSelectable(cursor)) return false;
        if (toISODate(cursor) === lastKey) break;
        cursor = addDays(cursor, 1);
      }
      return true;
    }

    /**
     * Changes the visible month/year, redraws synchronously, then refreshes async events if needed.
     * @param {Date} nextDate - New month anchor date.
     * @param {string} direction - Navigation hint used for animated labels.
     */
    _changeView(nextDate, direction) {
      const previous = cloneDate(this._viewDate); // Previous header reference used for animation.
      this._viewDate = cloneDate(nextDate); // New visible month anchor.
      this._setSynchronousVisibleMonthEvents(); // Immediately refresh static array-based events.
      this._render({ animateDirection: direction, previousViewDate: previous }); // Repaint UI with animated header labels.
      this._refreshVisibleMonthEvents(); // Resolve function/ajax events after the first paint.
      this.trigger('tdp:draw', this._eventPayload({ source: 'viewchange' }));
      return this;
    }

    /**
     * Opens or focuses the shared month/year wheel selector.
     * Clicking the already-focused header value closes the selector again.
     * @param {'month'|'year'} unit - Header value that initiated the interaction.
     */
    _togglePeriodSelector(unit) {
      if (!this.options.showPeriodSelector) return this;

      const nextUnit = unit === 'year' ? 'year' : 'month';
      if (!this._isPeriodSelectorOpen) return this._openPeriodSelector(nextUnit);

      if (this._activePeriodWheel === nextUnit) return this._closePeriodSelector();
      return this._focusPeriodWheel(nextUnit);
    }

    /** Shows the wheel selector while keeping the selected day untouched. */
    _openPeriodSelector(unit) {
      if (this._isPeriodSelectorOpen) return this._focusPeriodWheel(unit);

      this._isPeriodSelectorOpen = true;
      this._activePeriodWheel = unit === 'year' ? 'year' : 'month';
      this.root.dataset.view = 'period';
      this.root.dataset.periodFocus = this._activePeriodWheel;
      this.table.hidden = true;
      this.periodSelector.hidden = false;
      this.periodSelector.setAttribute('aria-hidden', 'false');
      this.monthCurrent.setAttribute('aria-expanded', 'true');
      this.yearCurrent.setAttribute('aria-expanded', 'true');

      this._periodAvailabilityCache.clear();
      this._renderPeriodSelector();
      this._ensurePeriodViewAvailable();

      // The viewport must be visible before its CSS row height and scroll range are usable.
      window.requestAnimationFrame(() => {
        this._syncPeriodWheelsToView();
        this._focusPeriodWheel(this._activePeriodWheel);
      });

      this.trigger('tdp:periodopen', this._eventPayload({ unit: this._activePeriodWheel }));
      return this;
    }

    /** Restores the normal day grid without committing a date selection. */
    _closePeriodSelector(options) {
      if (!this._isPeriodSelectorOpen) return this;

      const settings = options || {};
      this._isPeriodSelectorOpen = false;
      this.root.dataset.view = 'calendar';
      delete this.root.dataset.periodFocus;
      this.table.hidden = false;
      this.periodSelector.hidden = true;
      this.periodSelector.setAttribute('aria-hidden', 'true');
      this.monthCurrent.setAttribute('aria-expanded', 'false');
      this.yearCurrent.setAttribute('aria-expanded', 'false');
      this._clearPeriodWheelTimers();

      if (settings.focus !== false) this.monthCurrent.focus({ preventScroll: true });
      if (!settings.silent) this.trigger('tdp:periodclose', this._eventPayload());
      return this;
    }

    /** Moves keyboard focus to one wheel and updates the visual header emphasis. */
    _focusPeriodWheel(unit) {
      if (!this._isPeriodSelectorOpen) return this;

      this._activePeriodWheel = unit === 'year' ? 'year' : 'month';
      this.root.dataset.periodFocus = this._activePeriodWheel;
      const viewport = this._activePeriodWheel === 'year' ? this.periodYearViewport : this.periodMonthViewport;
      viewport.focus({ preventScroll: true });
      return this;
    }

    /** Builds absolute month entries and normal year entries for the current configured range. */
    _renderPeriodSelector() {
      const c = this.classes;
      const yearBounds = this._resolvePeriodYearBounds();
      const monthOptions = [];
      const yearOptions = [];

      this.periodMonthList.replaceChildren();
      this.periodYearList.replaceChildren();

      let monthIndex = 0;
      for (let year = yearBounds.minYear; year <= yearBounds.maxYear; year += 1) {
        for (let month = 0; month < 12; month += 1) {
          const absoluteMonth = (year * 12) + month;
          const isEnabled = this._monthHasSelectableDay(year, month);
          const option = createElement('div', {
            id: `${this._uid}-period-month-${absoluteMonth}`,
            className: [c.periodWheelOption, isEnabled ? '' : c.periodWheelOptionDisabled].filter(Boolean).join(' '),
            role: 'option',
            tabIndex: -1,
            'data-unit': 'month',
            'data-index': monthIndex,
            'data-value': absoluteMonth,
            'aria-label': `${this.options.months[month]} ${year}`,
            'aria-disabled': String(!isEnabled),
            'aria-selected': 'false'
          }, this.options.months[month]);

          this.periodMonthList.appendChild(option);
          monthOptions.push({ element: option, value: absoluteMonth, year, month, isEnabled });
          monthIndex += 1;
        }
      }

      let yearIndex = 0;
      for (let year = yearBounds.minYear; year <= yearBounds.maxYear; year += 1) {
        const isEnabled = this._yearHasSelectableMonth(year);
        const option = createElement('div', {
          id: `${this._uid}-period-year-${year}`,
          className: [c.periodWheelOption, isEnabled ? '' : c.periodWheelOptionDisabled].filter(Boolean).join(' '),
          role: 'option',
          tabIndex: -1,
          'data-unit': 'year',
          'data-index': yearIndex,
          'data-value': year,
          'aria-disabled': String(!isEnabled),
          'aria-selected': 'false'
        }, String(year));

        this.periodYearList.appendChild(option);
        yearOptions.push({ element: option, value: year, year, isEnabled });
        yearIndex += 1;
      }

      this._periodWheelStates.month = {
        viewport: this.periodMonthViewport,
        options: monthOptions,
        selectedIndex: -1,
        committedIndex: -1,
        suppressScroll: false
      };
      this._periodWheelStates.year = {
        viewport: this.periodYearViewport,
        options: yearOptions,
        selectedIndex: -1,
        committedIndex: -1,
        suppressScroll: false
      };
    }

    /** Keeps the visible calendar inside the configured wheel range and on an enabled month. */
    _ensurePeriodViewAvailable() {
      const state = this._periodWheelStates.month;
      if (!state || state.options.length === 0) return;

      const currentValue = (this._viewDate.getFullYear() * 12) + this._viewDate.getMonth();
      const exactOption = state.options.find((option) => option.value === currentValue);
      if (exactOption && exactOption.isEnabled) return;

      let closestOption = null;
      let closestDistance = Infinity;
      state.options.forEach((option) => {
        if (!option.isEnabled) return;
        const distance = Math.abs(option.value - currentValue);
        if (distance < closestDistance) {
          closestOption = option;
          closestDistance = distance;
        }
      });

      if (closestOption) this._setPeriodView(closestOption.year, closestOption.month);
    }

    /**
     * Resolves the selectable year window. A numeric yearRange means ±N years;
     * [min, max] provides an explicit inclusive range.
     */
    _resolvePeriodYearBounds() {
      const currentYear = this._viewDate.getFullYear();
      const configuredRange = this.options.yearRange;
      let minYear = currentYear - 10;
      let maxYear = currentYear + 10;

      if (Array.isArray(configuredRange) && configuredRange.length >= 2) {
        const firstYear = Number(configuredRange[0]);
        const lastYear = Number(configuredRange[1]);
        if (Number.isInteger(firstYear) && Number.isInteger(lastYear)) {
          minYear = Math.min(firstYear, lastYear);
          maxYear = Math.max(firstYear, lastYear);
        }
      } else if (Number.isInteger(configuredRange) && configuredRange >= 0) {
        minYear = currentYear - configuredRange;
        maxYear = currentYear + configuredRange;
      }

      const bounds = this._resolveBounds();
      if (bounds.min) minYear = Math.max(minYear, bounds.min.getFullYear());
      if (bounds.max) maxYear = Math.min(maxYear, bounds.max.getFullYear());

      // Keep the selector usable even when conflicting constraints produce an empty window.
      if (minYear > maxYear) minYear = maxYear = currentYear;
      return { minYear, maxYear };
    }

    /** Returns true when at least one selectable day exists in the requested month. */
    _monthHasSelectableDay(year, month) {
      const cacheKey = `${year}-${month}`;
      if (this._periodAvailabilityCache.has(cacheKey)) {
        return this._periodAvailabilityCache.get(cacheKey);
      }

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let isSelectable = false;
      for (let day = 1; day <= daysInMonth; day += 1) {
        if (this._isSelectable(new Date(year, month, day))) {
          isSelectable = true;
          break;
        }
      }

      this._periodAvailabilityCache.set(cacheKey, isSelectable);
      return isSelectable;
    }

    /** Returns true when a year contains at least one selectable month. */
    _yearHasSelectableMonth(year) {
      for (let month = 0; month < 12; month += 1) {
        if (this._monthHasSelectableDay(year, month)) return true;
      }
      return false;
    }

    /** Registers native scroll and keyboard behavior for one wheel viewport. */
    _bindPeriodWheel(viewport, unit) {
      this.listen(viewport, 'scroll', () => {
        const state = this._periodWheelStates[unit];
        if (!this._isPeriodSelectorOpen || !state || state.suppressScroll) return;

        this._updatePeriodWheelSelection(unit);
        window.clearTimeout(this._periodWheelTimers[unit]);
        this._periodWheelTimers[unit] = window.setTimeout(() => this._commitPeriodWheel(unit), 100);
      }, { passive: true });

      this.listen(viewport, 'keydown', (event) => {
        let step = 0;
        if (event.key === 'ArrowUp') step = -1;
        if (event.key === 'ArrowDown') step = 1;
        if (event.key === 'PageUp') step = -5;
        if (event.key === 'PageDown') step = 5;

        if (step !== 0) {
          event.preventDefault();
          this._movePeriodWheel(unit, step);
          return;
        }

        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          const state = this._periodWheelStates[unit];
          if (!state) return;
          const startIndex = event.key === 'Home' ? 0 : state.options.length - 1;
          const direction = event.key === 'Home' ? 1 : -1;
          const index = this._findEnabledPeriodOptionIndex(state.options, startIndex, direction);
          if (index >= 0) this._selectPeriodWheelOption(unit, index, true);
        }
      });
    }

    /** Moves by a logical number of wheel rows while skipping disabled periods. */
    _movePeriodWheel(unit, step) {
      const state = this._periodWheelStates[unit];
      if (!state || state.options.length === 0) return;

      const baseIndex = state.selectedIndex >= 0 ? state.selectedIndex : state.committedIndex;
      const desiredIndex = Math.max(0, Math.min(state.options.length - 1, baseIndex + step));
      const direction = step >= 0 ? 1 : -1;
      const index = this._findEnabledPeriodOptionIndex(state.options, desiredIndex, direction);
      if (index >= 0) this._selectPeriodWheelOption(unit, index, true);
    }

    /** Selects an option from click/keyboard and synchronizes the other wheel. */
    _selectPeriodWheelOption(unit, index, smooth) {
      const state = this._periodWheelStates[unit];
      const option = state && state.options[index];
      if (!option || !option.isEnabled) return;

      this._scrollPeriodWheelToIndex(unit, index, smooth ? 'smooth' : 'auto');
      state.committedIndex = index;

      if (unit === 'month') {
        this._setPeriodView(option.year, option.month, 'month');
        return;
      }

      const month = this._findClosestSelectableMonth(option.year, this._viewDate.getMonth());
      if (month !== null) this._setPeriodView(option.year, month, 'year');
    }

    /** Commits the nearest snapped row after touchpad/touch scrolling settles. */
    _commitPeriodWheel(unit) {
      const state = this._periodWheelStates[unit];
      if (!this._isPeriodSelectorOpen || !state || state.options.length === 0) return;

      const nearestIndex = this._getNearestPeriodWheelIndex(state);
      const direction = Math.sign(nearestIndex - state.committedIndex) || 1;
      const enabledIndex = this._findEnabledPeriodOptionIndex(state.options, nearestIndex, direction);
      if (enabledIndex < 0) return;

      this._selectPeriodWheelOption(unit, enabledIndex, enabledIndex !== nearestIndex);
    }

    /** Applies a visible month/year change without selecting or modifying the day value. */
    _setPeriodView(year, month, sourceUnit) {
      if (!this._monthHasSelectableDay(year, month)) return;

      const previousAbsoluteMonth = (this._viewDate.getFullYear() * 12) + this._viewDate.getMonth();
      const nextAbsoluteMonth = (year * 12) + month;
      if (previousAbsoluteMonth !== nextAbsoluteMonth) {
        this._changeView(new Date(year, month, 1), nextAbsoluteMonth > previousAbsoluteMonth ? 'next' : 'prev');
      }

      this._syncPeriodWheelsToView(sourceUnit);
    }

    /** Keeps month and year wheels aligned with the current visible calendar period. */
    _syncPeriodWheelsToView(sourceUnit) {
      if (!this._isPeriodSelectorOpen) return;

      const absoluteMonth = (this._viewDate.getFullYear() * 12) + this._viewDate.getMonth();
      const monthState = this._periodWheelStates.month;
      const yearState = this._periodWheelStates.year;
      const monthIndex = monthState.options.findIndex((option) => option.value === absoluteMonth);
      const yearIndex = yearState.options.findIndex((option) => option.value === this._viewDate.getFullYear());

      if (monthIndex >= 0) {
        monthState.committedIndex = monthIndex;
        if (sourceUnit !== 'month') this._scrollPeriodWheelToIndex('month', monthIndex, 'auto');
        else this._setPeriodWheelSelectedIndex('month', monthIndex);
      }

      if (yearIndex >= 0) {
        yearState.committedIndex = yearIndex;
        if (sourceUnit !== 'year') this._scrollPeriodWheelToIndex('year', yearIndex, 'auto');
        else this._setPeriodWheelSelectedIndex('year', yearIndex);
      }
    }

    /** Scrolls one option into the fixed center selection band. */
    _scrollPeriodWheelToIndex(unit, index, behavior) {
      const state = this._periodWheelStates[unit];
      if (!state || !state.options[index]) return;

      state.suppressScroll = true;
      const top = index * this._getPeriodWheelRowHeight(state.viewport);
      const shouldAnimate = behavior === 'smooth' && isFn(state.viewport.scrollTo);

      if (shouldAnimate) {
        state.viewport.scrollTo({ top, behavior: 'smooth' });
      } else {
        // CSS scroll-behavior must not turn internal synchronization into an animation.
        const previousScrollBehavior = state.viewport.style.scrollBehavior;
        state.viewport.style.scrollBehavior = 'auto';
        state.viewport.scrollTop = top;
        window.requestAnimationFrame(() => {
          if (this._periodWheelStates[unit] === state) {
            state.viewport.style.scrollBehavior = previousScrollBehavior;
          }
        });
      }
      this._setPeriodWheelSelectedIndex(unit, index);

      window.setTimeout(() => {
        if (this._periodWheelStates[unit] !== state) return;

        // End smooth movement on the exact row before re-enabling user scroll commits.
        if (shouldAnimate) {
          const previousScrollBehavior = state.viewport.style.scrollBehavior;
          state.viewport.style.scrollBehavior = 'auto';
          state.viewport.scrollTop = top;
          state.viewport.style.scrollBehavior = previousScrollBehavior;
        }
        state.suppressScroll = false;
      }, shouldAnimate ? 360 : 40);
    }

    /** Updates the highlighted row from the viewport's current native scroll position. */
    _updatePeriodWheelSelection(unit) {
      const state = this._periodWheelStates[unit];
      if (!state) return;
      this._setPeriodWheelSelectedIndex(unit, this._getNearestPeriodWheelIndex(state));
    }

    _getNearestPeriodWheelIndex(state) {
      const rowHeight = this._getPeriodWheelRowHeight(state.viewport);
      return Math.max(0, Math.min(state.options.length - 1, Math.round(state.viewport.scrollTop / rowHeight)));
    }

    _getPeriodWheelRowHeight(viewport) {
      const cssValue = Number.parseFloat(getComputedStyle(viewport).getPropertyValue('--tdp-period-row-height'));
      return Number.isFinite(cssValue) && cssValue > 0 ? cssValue : 44;
    }

    /** Applies selected styles and ARIA state without rebuilding the wheel. */
    _setPeriodWheelSelectedIndex(unit, index) {
      const state = this._periodWheelStates[unit];
      if (!state || !state.options[index] || state.selectedIndex === index) return;

      const previous = state.options[state.selectedIndex];
      if (previous) {
        previous.element.classList.remove(this.classes.periodWheelOptionSelected);
        previous.element.setAttribute('aria-selected', 'false');
      }

      const current = state.options[index];
      current.element.classList.add(this.classes.periodWheelOptionSelected);
      current.element.setAttribute('aria-selected', 'true');
      state.viewport.setAttribute('aria-activedescendant', current.element.id);
      state.selectedIndex = index;
    }

    /** Finds an enabled row in the requested direction, then falls back to the opposite direction. */
    _findEnabledPeriodOptionIndex(options, startIndex, direction) {
      if (!options.length) return -1;
      const safeIndex = Math.max(0, Math.min(options.length - 1, startIndex));
      if (options[safeIndex].isEnabled) return safeIndex;

      const firstDirection = direction < 0 ? -1 : 1;
      for (let index = safeIndex + firstDirection; index >= 0 && index < options.length; index += firstDirection) {
        if (options[index].isEnabled) return index;
      }
      for (let index = safeIndex - firstDirection; index >= 0 && index < options.length; index -= firstDirection) {
        if (options[index].isEnabled) return index;
      }
      return -1;
    }

    /** Preserves the month where possible when the year wheel changes. */
    _findClosestSelectableMonth(year, preferredMonth) {
      if (this._monthHasSelectableDay(year, preferredMonth)) return preferredMonth;

      for (let distance = 1; distance < 12; distance += 1) {
        const previousMonth = preferredMonth - distance;
        const nextMonth = preferredMonth + distance;
        if (previousMonth >= 0 && this._monthHasSelectableDay(year, previousMonth)) return previousMonth;
        if (nextMonth <= 11 && this._monthHasSelectableDay(year, nextMonth)) return nextMonth;
      }
      return null;
    }

    _clearPeriodWheelTimers() {
      Object.keys(this._periodWheelTimers).forEach((unit) => {
        window.clearTimeout(this._periodWheelTimers[unit]);
        delete this._periodWheelTimers[unit];
      });
    }

    _bindClickOutside() {
      if (this.isPermanent || !this.options.closeOnOutsideClick || this._isClickOutsideBound) return;
      console.debug(`[TDP] bindClickOutside for ${this.target.id}`)
      document.addEventListener('click', this._handleClickOutside, true);
      this._isClickOutsideBound = true;
    }

    _unbindClickOutside() {
      if (!this._isClickOutsideBound) return;

      console.debug(`[TDP] _unbindClickOutside for ${this.target.id}`)
      document.removeEventListener('click', this._handleClickOutside, true);
      this._isClickOutsideBound = false;
    }

    _handleClickOutside = (event) => {
      console.debug(`[TDP] received click on #${event.target.id}`);

      if (this.root.contains(event.target)) {
        console.debug('[TDP] ignore: inside root');
        return;
      }

      if (this.target.contains && this.target.contains(event.target)) {
        console.debug('[TDP] ignore: inside target');
        return;
      }

      if (this._inputWrap && this._inputWrap.contains(event.target)) {
        console.debug('[TDP] ignore: inside inputWrap');
        return;
      }

      if (event.target === this.target) {
        console.debug('[TDP] ignore: exact target');
        return;
      }

      console.debug('[TDP] close: real outside click');
      this.close();
    };

    /**
     * Registers all internal UI interactions:
     * - header navigation
     * - date picking
     * - hover preview in range mode
     * - footer actions
     * - input syncing/opening logic
     * - global escape / resize / scroll reactions
     */
    _bindInternalEvents() {
      const c = this.classes; // Shortcut to the class map for delegated selectors.

      this.on('click', `.${c.selectNavPrev}[data-unit="month"]`, () => this.prevMonth());
      this.on('click', `.${c.selectNavNext}[data-unit="month"]`, () => this.nextMonth());
      this.on('click', `.${c.selectNavPrev}[data-unit="year"]`, () => this.prevYear());
      this.on('click', `.${c.selectNavNext}[data-unit="year"]`, () => this.nextYear());

      this.on('click', `.${c.selectDataMonth}`, () => this._togglePeriodSelector('month'));
      this.on('click', `.${c.selectDataYear}`, () => this._togglePeriodSelector('year'));
      this.on('keydown', `.${c.selectData}`, (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this._togglePeriodSelector(event.delegateTarget.classList.contains(c.selectDataYear) ? 'year' : 'month');
      });

      this.on('click', '[data-action="period-done"]', () => this._closePeriodSelector());
      this.on('click', `.${c.periodWheelOption}:not([aria-disabled="true"])`, (event) => {
        const option = event.delegateTarget;
        this._selectPeriodWheelOption(option.getAttribute('data-unit'), Number(option.getAttribute('data-index')), true);
      });

      this._bindPeriodWheel(this.periodMonthViewport, 'month');
      this._bindPeriodWheel(this.periodYearViewport, 'year');

      this.on('click', `.${c.date}.${c.dateSelectable}`, (event) => {
        const cell = event.delegateTarget;
        const value = cell.getAttribute('data-tdp-date');
        if (!value) return;

        if (this.allowRangeSelection) {
          this._handleRangeDateSelection(value, { source: 'grid' });
          return;
        }

        this.setDate(value, { source: 'grid' });
      });

      this.on('mouseover', `.${c.date}.${c.dateSelectable}`, (event) => {
        if (!this.allowRangeSelection || !this._awaitingRangeEnd || !this._rangeStartDate) return;

        const value = event.delegateTarget.getAttribute('data-tdp-date');
        const hoveredDate = normalizeOptionDate(value, this.options);
        if (!hoveredDate || !this._isRangeSelectable(this._rangeStartDate, hoveredDate)) {
          if (this._rangeHoverDate) {
            this._rangeHoverDate = null;
            this._render({ silentTrigger: true });
          }
          return;
        }

        if (isSameDay(this._rangeHoverDate, hoveredDate)) return;
        this._rangeHoverDate = cloneDate(hoveredDate);
        this._render({ silentTrigger: true });
      });

      this.listen(this.weeks, 'mouseleave', () => {
        if (!this.allowRangeSelection || !this._awaitingRangeEnd || !this._rangeHoverDate) return;
        this._rangeHoverDate = null;
        this._render({ silentTrigger: true });
      });

      this.on('click', '[data-action="clear"]', () => {
        this.clear({ source: 'clear' });
        this.close('clear');
      });

      this.on('click', '[data-action="cancel"]', () => {
        if (this.allowRangeSelection) {
          if (this._lastCommittedRange) {
            this._rangeStartDate = cloneDate(this._lastCommittedRange.startDate);
            this._rangeEndDate = cloneDate(this._lastCommittedRange.endDate);
            this._viewDate = cloneDate(this._rangeEndDate || this._rangeStartDate);
          } else {
            this._rangeStartDate = null;
            this._rangeEndDate = null;
          }
          this._rangeHoverDate = null;
          this._awaitingRangeEnd = false;
        } else if (this._lastCommittedDate) {
          this._selectedDate = cloneDate(this._lastCommittedDate);
          this._viewDate = cloneDate(this._lastCommittedDate);
        } else {
          this._selectedDate = null;
        }
        this._syncTargetValue();
        this._render();
        this.close('cancel');
      });
      this.on('click', '[data-action="ok"]', () => this.close('close'));

      this._bindInputOpenEvents();

      if (this.isInput) {
        this.listen(this.target, 'change', () => {
          const rawValue = this.target.value.trim();
          if (!rawValue) {
            this.clear({ source: 'input' });
            return;
          }

          if (this.allowRangeSelection) {

            const parsedRange = normalizeOptionRange(rawValue, this.options);

            if (parsedRange && this._isRangeSelectable(parsedRange.startDate, parsedRange.endDate)) {
              this.target.classList.remove(this.classes.inputInvalid);
              this._rangeStartDate = cloneDate(parsedRange.startDate);
              this._rangeEndDate = cloneDate(parsedRange.endDate);
              this._lastCommittedRange = cloneRange(parsedRange);
              this._rangeHoverDate = null;
              this._awaitingRangeEnd = false;
              this._viewDate = cloneDate(parsedRange.endDate || parsedRange.startDate);
              this._syncTargetValue();
              this._render();
            } else {
              this.target.classList.add(this.classes.inputInvalid);
              this._syncTargetValue();
            }
            return;
          }

          const parsed = normalizeOptionDate(rawValue, this.options);
          if (parsed && this._isSelectable(parsed)) {
            this._selectedDate = cloneDate(parsed);
            this._lastCommittedDate = cloneDate(parsed);
            this._viewDate = cloneDate(parsed);
            this._syncTargetValue();
            this._render();
          }
        });
      } else if (!this.isPermanent) {
        this.listen(this.target, 'click', (event) => {
          if (event.target !== this.target) return;
          this.toggle();
        });
      }

      this._handleDocumentKeydown = (event) => {
        if (event.key !== 'Escape' || !this._isOpen || !this.options.closeOnEscape) return;

        if (this._isPeriodSelectorOpen) {
          this._closePeriodSelector();
          return;
        }

        this.close();
      };

      this._handleWindowResize = () => {
        if (this._isOpen && this.isInline) this._positionInline();
      };

      document.addEventListener('keydown', this._handleDocumentKeydown, true);
      window.addEventListener('resize', this._handleWindowResize);
      window.addEventListener('scroll', this._handleWindowResize, true);
    }

    /**
     * Binds opening/closing behavior specific to input targets.
     * Focus mode opens from focus/click, button mode opens exclusively from the trigger button.
     */
    _bindInputOpenEvents() {
      if (!this.isInput || this.isPermanent) return;

      // Button mode:
      // l'ouverture ne doit se faire que via le bouton trigger,
      // pas via le focus/click direct sur l'input.
      if (this.inputTriggerMode === 'button') {
        if (this._triggerButton) {
          this.listen(this._triggerButton, 'click', () => {
            this.open();
          });
        }
        return;
      }

      // Permet de distinguer :
      // - un focus clavier (Tab) => ouverture souhaitée
      // - un focus causé par un geste pointeur => ne pas ouvrir trop tôt
      this._hadPointerDownOnTarget = false;

      this.listen(this.target, 'pointerdown mousedown', () => {
        this._hadPointerDownOnTarget = true;
      });

      this.listen(this.target, 'focus', () => {
        // Focus clavier uniquement.
        // Si un pointerdown a précédé, on attend le click final pour ouvrir.
        if (this._hadPointerDownOnTarget) return;
        this.open();
      });

      this.listen(this.target, 'click', () => {
        // Ouverture souris / touch / stylet.
        this.open();
        this._hadPointerDownOnTarget = false;
      });

      this.listen(this.target, 'blur', (e) => {
        this._hadPointerDownOnTarget = false;

        if (!this._isOpen) return;

        window.setTimeout(() => {
          const nextFocused = e.relatedTarget || document.activeElement;

          if (!nextFocused) {
            this.close();
            return;
          }

          if (this.root.contains(nextFocused)) return;
          if (nextFocused === this.target) return;
          if (this.target.contains && this.target.contains(nextFocused)) return;
          if (this._inputWrap && this._inputWrap.contains(nextFocused)) return;
          if (this._triggerButton && nextFocused === this._triggerButton) return;

          this.close();
        }, 0);
      });
    }

    /**
     * Creates the full static DOM tree for the picker.
     * Rendering methods only update content/state on top of this structure.
     */
    _build() {
      const c = this.classes; // Shortcut to avoid repeating the class map constantly.
      this.root = createElement('div', {
        id: this._uid,
        className: [c.calendar, c[this.mode] || c.inline].join(' '),
        role: this.isModal ? 'dialog' : 'group',
        tabIndex: -1,
        'aria-hidden': 'true'
      });

      this.display = createElement('div', { className: c.display });
      const displayHeader = createElement('div', { className: c.displayHeader });
      this.displayDay = createElement('h3', { className: c.displayDay });
      displayHeader.appendChild(this.displayDay);
      const displayBody = createElement('div', { className: c.displayBody });
      const primary = createElement('div', { className: `${c.displayData} ${c.displayDataPrimary}` });
      this.displayDate = createElement('h1', { className: c.displayDate });
      primary.appendChild(this.displayDate);
      const secondary = createElement('div', { className: `${c.displayData} ${c.displayDataSecondary}` });
      this.displayMonth = createElement('h3', { className: c.displayMonth });
      this.displayYear = createElement('h2', { className: c.displayYear });
      secondary.append(this.displayMonth, this.displayYear);
      displayBody.append(primary, secondary);
      this.display.append(displayHeader, displayBody);

      this.picker = createElement('div', { className: c.picker });
      this.pickerHeader = createElement('div', { className: `${c.pickerHeader} ${c.container} ${c.select}` });

      this.monthWrap = createElement('div', { className: c.selectMonth });
      this.monthPrev = navButton('month', 'prev', c);
      this.monthCurrent = createElement('div', {
        className: `${c.selectData} ${c.selectDataMonth}`,
        role: 'button',
        tabIndex: this.options.showPeriodSelector ? 0 : -1,
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        'aria-disabled': String(!this.options.showPeriodSelector)
      });
      this.monthCurrent.appendChild(createElement('span'));
      this.monthNext = navButton('month', 'next', c);
      this.monthWrap.append(this.monthPrev, this.monthCurrent, this.monthNext);

      this.yearWrap = createElement('div', { className: c.selectYear });
      this.yearCurrent = createElement('div', {
        className: `${c.selectData} ${c.selectDataYear}`,
        role: 'button',
        tabIndex: this.options.showPeriodSelector ? 0 : -1,
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        'aria-disabled': String(!this.options.showPeriodSelector)
      });
      this.yearCurrent.appendChild(createElement('span'));

      if (this.isInline || this.isPermanent) {
        this.yearWrap.append(this.yearCurrent);
      } else {
        this.yearPrev = navButton('year', 'prev', c);
        this.yearNext = navButton('year', 'next', c);
        this.yearWrap.append(this.yearPrev, this.yearCurrent, this.yearNext);
      }

      this.pickerHeader.append(this.monthWrap, this.yearWrap);

      this.pickerBody = createElement('div', { className: c.pickerBody });
      this.table = createElement('div', { className: `${c.table} ${c.container}` });
      this.weekdays = createElement('div', { className: c.tableHeader });
      this.weekdaysRow = createElement('div', { className: c.tableWeek, role: 'row' });
      this.weekdays.appendChild(this.weekdaysRow);
      this.weeks = createElement('div', { className: c.tableBody });
      this.table.append(this.weekdays, this.weeks);
      this.pickerBody.appendChild(this.table);

      this.periodSelector = createElement('div', {
        className: c.periodSelector,
        'aria-hidden': 'true'
      });
      this.periodSelector.hidden = true;

      const periodToolbar = createElement('div', { className: c.periodToolbar });
      this.periodDoneBtn = createElement('button', {
        type: 'button',
        className: c.periodDone,
        'data-action': 'period-done'
      }, this.options.periodDoneText);
      periodToolbar.appendChild(this.periodDoneBtn);

      const periodWheels = createElement('div', { className: c.periodWheels });

      const monthWheel = createElement('div', { className: `${c.periodWheel} ${c.periodWheelMonth}` });
      const monthWheelLabelId = `${this._uid}-period-month-label`;
      monthWheel.appendChild(createElement('div', { id: monthWheelLabelId, className: c.periodWheelLabel }, this.options.periodMonthText));
      this.periodMonthViewport = createElement('div', {
        className: c.periodWheelViewport,
        role: 'listbox',
        tabIndex: 0,
        'aria-labelledby': monthWheelLabelId
      });
      this.periodMonthList = createElement('div', { className: c.periodWheelList });
      this.periodMonthViewport.appendChild(this.periodMonthList);
      monthWheel.appendChild(this.periodMonthViewport);

      const yearWheel = createElement('div', { className: `${c.periodWheel} ${c.periodWheelYear}` });
      const yearWheelLabelId = `${this._uid}-period-year-label`;
      yearWheel.appendChild(createElement('div', { id: yearWheelLabelId, className: c.periodWheelLabel }, this.options.periodYearText));
      this.periodYearViewport = createElement('div', {
        className: c.periodWheelViewport,
        role: 'listbox',
        tabIndex: 0,
        'aria-labelledby': yearWheelLabelId
      });
      this.periodYearList = createElement('div', { className: c.periodWheelList });
      this.periodYearViewport.appendChild(this.periodYearList);
      yearWheel.appendChild(this.periodYearViewport);

      periodWheels.append(monthWheel, yearWheel);
      this.periodSelector.append(periodToolbar, periodWheels);
      this.pickerBody.appendChild(this.periodSelector);

      this.pickerFooter = createElement('div', { className: `${c.pickerFooter} ${c.container}` });
      const footerPrimary = createElement('div', { className: `${c.footerSection} ${c.footerPrimary}` });
      const footerSecondary = createElement('div', { className: `${c.footerSection} ${c.footerSecondary}` });
      this.clearBtn = createElement('button', { type: 'button', className: `${c.btn} ${c.btnDanger}`, 'data-action': 'clear' }, this.options.clearText);
      this.cancelBtn = createElement('button', { type: 'button', className: `${c.btn} ${c.btnSuccess}`, 'data-action': 'cancel' }, this.options.cancelText);
      this.okBtn = createElement('button', { type: 'button', className: `${c.btn} ${c.btnSuccess}`, 'data-action': 'ok' }, this.options.confirmText);
      footerPrimary.appendChild(this.clearBtn);
      footerSecondary.append(this.cancelBtn, this.okBtn);
      this.pickerFooter.append(footerPrimary, footerSecondary);

      this.picker.append(this.pickerHeader, this.pickerBody, this.pickerFooter);
      this.root.append(this.display, this.picker);
    }

    _resolveInputTriggerMode() {
      if (!this.isInput || this.mode !== 'modal') return 'focus';

      const dataMode = this.target.getAttribute('data-tdp-trigger');
      const rawValue = (dataMode || this.options.inputTriggerMode || 'focus')
        .toString()
        .trim()
        .toLowerCase();

      return rawValue === 'button' ? 'button' : 'focus';
    }

    _resolveAssistDateInput() {
      if (!this.isInput) return false;
      if (typeof this.options.assistDateInput === 'boolean') {
        return this.options.assistDateInput;
      }

      return this.mode === 'modal' && this.inputTriggerMode === 'button';
    }

    svgCalendar() {
      return `<svg class="tdp-icon tdp-icon--calendar"
         viewBox="0 0 24 24"
         width="18"
         height="18"
         aria-hidden="true"
         focusable="false">
      <path fill="currentColor" d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1h-1v1a1 1 0 1 1-2 0V6H8v1a1 1 0 1 1-2 0V6H5Z"></path>
    </svg>`;
    }

    _applyInputPlaceholder() {
      if (this.isInput && this.options.placeholderFromFormat) {

        const _getResolvedPlaceholderFromFormat = () => {
          const singleFormat = String(this.options.dateFormat || '').trim();
          if (!singleFormat) return '';
          return this.allowRangeSelection
              ? `${singleFormat}${this.options.rangeSeparator}${singleFormat}`
              : singleFormat;
        }

        const currentPlaceholder = this.target.getAttribute('placeholder') || '';
        // Overwrite mode
        if (!currentPlaceholder || this.options.placeholderFromFormat === 'overwrite') {
          this.target.setAttribute('placeholder', _getResolvedPlaceholderFromFormat());
        }
      }
    }

    _applyInputBaseClass() {
      if (!this.isInput) return;
      this.target.classList.add(this.classes.input);
      if (this.allowRangeSelection) this.target.classList.add(this.classes.inputRange);
      if (this.options.assistDateInput) this.target.classList.add(this.classes.inputAssisted);
    }

    /**
     * Creates or reuses the optional trigger button shown next to modal inputs in button mode.
     * It can either wrap the input or sit next to it depending on wrapInputTriggerButton.
     */
    _buildInputTriggerButton() {
      if (!this.isInput || this.mode !== 'modal' || this.inputTriggerMode !== 'button' || this._triggerButton) {
        return;
      }

      const c = this.classes; // Shortcut to resolved class names.
      const parent = this.target.parentNode; // Immediate parent used as insertion point.
      if (!parent) return;

      const existingTrigger = parent.querySelector(`.${c.inputTrigger}`); // Existing trigger reused when already present in the DOM.

      if (existingTrigger) {
        parent.classList.add(this.classes.inputTriggerParent);
        this._triggerButton = existingTrigger;
        if (!this._triggerButton.hasAttribute('aria-label')) {
          this._triggerButton.setAttribute('aria-label', 'Open calendar');
        }
        this._isExternalTriggerButton = true;
        return;
      }

      const button = createElement('button', {
        type: 'button',
        className: c.inputTrigger,
        'aria-label': 'Open calendar'
      });
      button.tabIndex = -1;
      button.innerHTML = this.svgCalendar();

      if (this.options.wrapInputTriggerButton) {
        const wrap = createElement('span', { className: c.inputWrap });

        parent.insertBefore(wrap, this.target);
        wrap.appendChild(this.target);
        wrap.appendChild(button);

        this._inputWrap = wrap;
      } else {
        parent.classList.add(this.classes.inputTriggerParent);
        if (this.target.nextSibling) {
          parent.insertBefore(button, this.target.nextSibling);
        } else {
          parent.appendChild(button);
        }

        this._inputWrap = null;
      }

      this._triggerButton = button;
    }

    _destroyInputTriggerButton() {
      if (!this._triggerButton) return;

      if (this._isExternalTriggerButton) {
        const parent = this.target.parentNode;
        if (parent) {
          parent.classList.remove(this.classes.inputTriggerParent);
        }
      } else if (this._inputWrap) {
        const wrap = this._inputWrap;
        const parent = wrap.parentNode;
        if (parent) {
          parent.insertBefore(this.target, this._inputWrap);
          parent.removeChild(this._inputWrap);
        }
        this._inputWrap = null;
      } else {
        const parent = this._triggerButton.parentNode;
        if (parent) {
          parent.classList.remove(this.classes.inputTriggerParent);
          parent.removeChild(this._triggerButton);
        }
      }
      this._triggerButton = null;
    }

    /**
     * Main paint method.
     * Updates high-level UI state, then delegates to header, weekdays, and grid renderers.
     * @param {Object} renderOptions - Rendering flags like silentTrigger or animation metadata.
     */
    _render(renderOptions) {
      const opts = renderOptions || {}; // Rendering flags for this paint cycle.
      this.root.dataset.target = this.allowRangeSelection ? 'range' : 'date';
      this.display.style.display = this.options.showCalendarDisplay ? '' : 'none';
      this.clearBtn.style.display = this.options.showClearBtn ? '' : 'none';
      this.cancelBtn.style.display = this.isPermanent ? 'none' : '';
      this.okBtn.style.display = this.isPermanent ? 'none' : '';
      if (this.options.theme === 'dark') {
        this.root.classList.add(this.classes.dark);
      } else {
        this.root.classList.remove(this.classes.dark);
      }

      this._renderHeader(opts);
      this._renderWeekdays();
      this._renderGrid();

      if (isFn(this.options.onDraw)) {
        this.options.onDraw.call(this, this.root);
      }
      if (!opts.silentTrigger) {
        this.trigger('tdp:draw', this._eventPayload());
      }
    }

    /**
     * Refreshes the left display panel and the month/year header labels.
     * @param {Object} renderOptions - Header animation metadata.
     */
    _renderHeader(renderOptions) {
      const opts = renderOptions || {}; // Rendering metadata for animated header labels.
      const focus = this.allowRangeSelection ? (this._rangeEndDate || this._rangeStartDate || this._viewDate || this._today) : (this._selectedDate || this._viewDate || this._today); // Date currently emphasized in the display panel.
      this.displayDay.textContent = this.options.days[focus.getDay()];
      this.displayDate.textContent = String(focus.getDate());
      this.displayMonth.textContent = this.options.months[focus.getMonth()];
      this.displayYear.textContent = String(focus.getFullYear());

      const monthText = this.options.months[this._viewDate.getMonth()];
      const yearText = String(this._viewDate.getFullYear());
      const prevView = opts.previousViewDate || this._viewDate;
      const prevMonthText = this.options.months[prevView.getMonth()];
      const prevYearText = String(prevView.getFullYear());

      if (opts.animateDirection && prevMonthText !== monthText) {
        animateLabel(this.monthCurrent, monthText, opts.animateDirection);
      } else {
        setLabelText(this.monthCurrent, monthText);
      }
      if (opts.animateDirection && prevYearText !== yearText) {
        animateLabel(this.yearCurrent, yearText, opts.animateDirection);
      } else {
        setLabelText(this.yearCurrent, yearText);
      }
    }

    _renderWeekdays() {
      this.weekdaysRow.innerHTML = '';
      rotateArray(this.options.weekdaysMin, this.options.firstDay).forEach((label) => {
        this.weekdaysRow.appendChild(createElement('div', { className: this.classes.tableWeekday }, label));
      });
    }

    /**
     * Rebuilds the 6x7 calendar grid for the currently visible month.
     * Each cell computes its visual state from selection, range preview, marks, and events.
     */
    _renderGrid() {
      this.weeks.innerHTML = '';
      const year = this._viewDate.getFullYear(); // Visible grid year.
      const month = this._viewDate.getMonth(); // Visible grid month index.
      const firstOfMonth = new Date(year, month, 1); // First day of the visible month.
      const gridStart = startOfWeek(firstOfMonth, this.options.firstDay); // First cell rendered in the 6-week grid.
      const selectedKey = this._selectedDate ? toISODate(this._selectedDate) : null; // Selected single-date key for quick comparisons.
      const todayKey = toISODate(this._today); // Cached today key for styling.
      const committedRange = this.allowRangeSelection && this._rangeStartDate && this._rangeEndDate
        ? orderDateRange(this._rangeStartDate, this._rangeEndDate)
        : null; // Confirmed range currently committed by the user.
      const previewRange = this._getPreviewRange(); // Hover-preview range shown before the second range click.

      for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
        const row = createElement('div', { className: this.classes.tableWeek, role: 'row' });
        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
          const date = addDays(gridStart, (weekIndex * 7) + dayIndex);
          const key = toISODate(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = key === todayKey;
          const isPicked = !this.allowRangeSelection && selectedKey === key;
          const isMarked = hasMarkedDateOnDate(this.options.markDates, key);
          const dayEvents = this._getDayEvents(key);
          const hasEvents = dayEvents?.length > 0;
          const selectable = this._isSelectable(date);

          const rangeState = this.allowRangeSelection
            ? getRangeCellState({
              key,
              date,
              pendingStartDate: this._awaitingRangeEnd && this._rangeStartDate && !previewRange ? this._rangeStartDate : null,
              committedRange,
              previewRange
            })
            : null;

          const classes = [this.classes.date];
          classes.push(isCurrentMonth ? this.classes.dateActive : this.classes.dateInactive);
          if (selectable) classes.push(this.classes.dateSelectable);
          if (isToday) classes.push(this.classes.dateToday);
          if (isPicked) classes.push(this.classes.datePicked);
          if (isMarked) classes.push(this.classes.dateMarked);
          if (hasEvents) classes.push(this.classes.dateHasEvents);
          if (rangeState?.isInRange) classes.push(this.classes.dateInRange);
          if (rangeState?.isPreview) classes.push(this.classes.dateRangePreview);
          if (rangeState?.isStart) classes.push(this.classes.dateRangeStart);
          if (rangeState?.isEnd) classes.push(this.classes.dateRangeEnd);
          if (rangeState?.isSingle) classes.push(this.classes.dateRangeSingle);

          const cellValue = String(date.getDate());
          const cell = createElement('div', {
            className: classes.join(' '),
            'data-tdp-date': key,
            'data-current-month': String(isCurrentMonth),
            title: key,
            'aria-label': this.options.formatAriaLabel(date, this.options),
            'aria-disabled': selectable ? 'false' : 'true'
          }, hasEvents ? '' : cellValue);

          if (hasEvents) {
            const inner = createElement('div', { className: this.classes.dateInner });
            inner.appendChild(createElement('div', { className: this.classes.dateNumber }, cellValue));
            const eventsEl = createElement('div', { className: this.classes.dateEvents, 'aria-hidden': 'true' });
            dayEvents.slice(0, 4).forEach((eventItem) => {
              const dot = createElement('span', { className: this.classes.dateEventDot });
              if (eventItem.color) dot.style.backgroundColor = eventItem.color;
              eventsEl.appendChild(dot);
            });

            inner.appendChild(eventsEl);
            cell.appendChild(inner);
          }

          row.appendChild(cell);
        }
        this.weeks.appendChild(row);
      }
    }


    _getVisibleMonthRange() {
      const startDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth(), 1);
      const endDate = new Date(this._viewDate.getFullYear(), this._viewDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return { startDate, endDate, key: `${toISODate(startOfDay(startDate))}_${toISODate(startOfDay(endDate))}` };
    }

    _getDayEvents(key) {
      return this._eventsMap.get(key) || [];
    }

    /**
     * Applies event data immediately when the source is already synchronous (plain arrays).
     * Function/ajax sources are handled later by _refreshVisibleMonthEvents().
     */
    _setSynchronousVisibleMonthEvents() {
      const source = this.options.events; // Raw event source configured by the consumer.
      if (Array.isArray(source)) {
        this._eventsMap = buildEventsMap(source, this.options.themeEventColor); // Normalize all visible event dots immediately.
        const range = this._getVisibleMonthRange(); // Visible month range used as cache key.
        this._loadedEventRangeKey = range.key;
        return;
      }
      this._eventsMap = new Map(); // Clear stale events before async refresh repopulates them.
      this._loadedEventRangeKey = '';
    }

    /**
     * Resolves function/ajax event sources for the currently visible month.
     * Uses request ids to ignore stale async responses after fast navigation.
     */
    _refreshVisibleMonthEvents() {
      const source = this.options.events; // Raw event source configured by the consumer.
      if (!source || Array.isArray(source)) return Promise.resolve(this._eventsMap);

      const range = this._getVisibleMonthRange(); // Current visible month boundaries.
      if (this._loadedEventRangeKey === range.key) {
        return Promise.resolve(this._eventsMap);
      }

      const requestId = ++this._eventsRequestId; // Unique token for this async load cycle.
      return resolveEventsSource(source, range, this.options)
        .then((items) => {
          if (requestId !== this._eventsRequestId) return this._eventsMap;
          this._eventsMap = buildEventsMap(items, this.options.themeEventColor);
          this._loadedEventRangeKey = range.key;
          this._render({ silentTrigger: true });
          return this._eventsMap;
        })
        .catch((error) => {
          if (requestId !== this._eventsRequestId) return this._eventsMap;
          this.trigger('tdp:eventserror', this._eventPayload({ error, source: 'events' }));
          return this._eventsMap;
        });
    }

    /**
     * Keeps the target element synchronized with the internal selection state.
     * @param {boolean} silent - When false, dispatches native input/change events after syncing.
     */
    _syncTargetValue(silent = true) {
      const value = this._getFormattedValue(); // Text representation of the current selection/range.
      if (this.isInput) {
        const previousValue = this.target.value; // Used to avoid unnecessary DOM writes/events.

        if (previousValue === value) return;

        this.target.value = value;
        this.target.classList.toggle(this.classes.inputHasValue, !!value);

        if (silent == false) {
          //this.target.dispatchEvent(new Event('input', { bubbles: true }));
          this.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        this.target.setAttribute('data-tdp-value', value);
      }
    }

    _positionInline() {
      if (!this.isInline || !this.target.getBoundingClientRect) return;

      const rect = this.target.getBoundingClientRect();
      const calendarRect = this.root.getBoundingClientRect();

      const top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;

      const maxLeft = window.scrollX + window.innerWidth - calendarRect.width - 8;
      if (left > maxLeft) {
        left = Math.max(window.scrollX + 8, maxLeft);
      }

      this.root.style.top = `${top}px`;
      this.root.style.left = `${left}px`;
    }

    _normalizeConstraintOptions() {
      const options = this.options;

      this._disabledWeekDaysSet = new Set(
          (Array.isArray(options.disableWeekDays) ? options.disableWeekDays : [])
              .filter(Number.isInteger)
              .filter((day) => day >= 0 && day <= 6)
      );

      this._disabledMonthsSet = new Set(
          (Array.isArray(options.disableMonths) ? options.disableMonths : [])
              .filter(Number.isInteger)
              .filter((month) => month >= 0 && month <= 11)
      );

      this._disabledYearsSet = new Set(
          (Array.isArray(options.disableYears) ? options.disableYears : [])
              .filter(Number.isInteger)
      );

      this._allowedMonthsSet = new Set(
          (Array.isArray(options.allowedMonths) ? options.allowedMonths : [])
              .filter(Number.isInteger)
              .filter((month) => month >= 0 && month <= 11)
      );

      this._allowedYearsSet = new Set(
          (Array.isArray(options.allowedYears) ? options.allowedYears : [])
              .filter(Number.isInteger)
      );

      this._disabledDateKeys = new Set(
          (Array.isArray(options.disableDates) ? options.disableDates : [])
              .map((value) => normalizeOptionDate(value, options))
              .filter(Boolean)
              .map((date) => toISODate(date))
      );
    }

    _isWithinBounds(date) {
      const bounds = this._resolveBounds();
      if (bounds.min && date < bounds.min) return false;
      if (bounds.max && date > bounds.max) return false;
      return true;
    }

    _isAllowedByLists(date) {
      const month = date.getMonth();
      const year = date.getFullYear();

      if (this._allowedMonthsSet.size > 0 && !this._allowedMonthsSet.has(month)) {
        return false;
      }

      if (this._allowedYearsSet.size > 0 && !this._allowedYearsSet.has(year)) {
        return false;
      }

      return true;
    }

    _isBlockedByRules(date) {
      const day = date.getDay();
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = toISODate(date);

      if (this.options.disableWeekends && isWeekend(date)) return true;
      if (this._disabledWeekDaysSet.has(day)) return true;
      if (this._disabledMonthsSet.has(month)) return true;
      if (this._disabledYearsSet.has(year)) return true;
      if (this._disabledDateKeys.has(key)) return true;

      return false;
    }

    _isSelectable(date) {
      const day = startOfDay(date);

      if (!day || !this._isWithinBounds(day) || !this._isAllowedByLists(day) || this._isBlockedByRules(day)) return false;

      if (isFn(this.options.disableDayFn) && this.options.disableDayFn(cloneDate(day))) {
        return false;
      }

      return true;
    }

    _resolveBounds() {
      let min = normalizeOptionDate(this.options.minDate, this.options);
      let max = normalizeOptionDate(this.options.maxDate, this.options);
      const today = startOfDay(new Date());
      switch (this.options.dateRule) {
        case 'gtNow': min = addDays(today, 1); break;
        case 'gteNow': min = today; break;
        case 'ltNow': max = addDays(today, -1); break;
        case 'lteNow': max = today; break;
      }
      return { min, max };
    }

    _eventPayload(extra) {
      return Object.assign({ date: this.getDate(), value: this.val(), range: this.allowRangeSelection ? this.getRange() : null, instance: this }, extra || {});
    }
  }


  TinyDatePicker.version = TINY_DATE_PICKER_VERSION;
  TinyDatePicker.locale = null;
  TinyDatePicker.dateFormat = null;
  TinyDatePicker.i18n = {
    en: {
      weekdaysMin: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      days: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
      clearText: 'Clear',
      cancelText: 'Cancel',
      confirmText: 'OK',
      periodMonthText: 'Month',
      periodYearText: 'Year',
      periodDoneText: 'Choose day'
    },

    fr: {
      weekdaysMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
      months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
      days: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],
      clearText: 'Effacer',
      cancelText: 'Annuler',
      confirmText: 'OK',
      periodMonthText: 'Mois',
      periodYearText: 'Année',
      periodDoneText: 'Choisir le jour'
    }
  };
  TinyDatePicker.getLocaleDateFormat = getLocaleDateFormat;
  TinyDatePicker.getLocaleLabels = getLocaleLabels;

  Object.defineProperty(TinyDatePicker.prototype, 'value', {
    configurable: true,
    enumerable: false,
    get: function () {
      const v = this.val();
      return v == null ? '' : v;
    },
    set: function (nextValue) {
      this.val(nextValue);
    }
  });

  /**
   * Returns a fresh default options object.
   * Important: nested objects/functions are recreated here so instances do not share mutable state.
   */
  function defaultOptions() {
    return {
      mode: 'inline',
      appendTo: document.body,
      autoClose: false,
      allowRangeSelection: false,
      rangeSeparator: ' – ',
      selectedRange: null,
      inputTriggerMode: 'focus',
      wrapInputTriggerButton: true,
      assistDateInput: null, // null = auto: enabled for modal inputs using the button trigger
      placeholderFromFormat: false, //false | true | 'overwrite'
      closeOnEscape: true,
      closeOnOutsideClick: true,
      showPeriodSelector: true,

      disableWeekends: false,
      disableWeekDays: [],
      disableDates: [],
      disableMonths: [],
      disableYears: [],
      allowedMonths: [],
      allowedYears: [],
      disableDayFn: null,

      firstDay: 1, // Monday
      minDate: null,
      maxDate: null,
      dateRule: null,
      yearRange: 10,
      showClearBtn: false,
      showCalendarDisplay: true,
      locale: null,
      i18n: null,
      clearText: null,
      cancelText: null,
      confirmText: null,
      periodMonthText: null,
      periodYearText: null,
      periodDoneText: null,
      dateFormat: null,
      value: null,
      selectedDate: null,
      markDates: [],
      events: [],
      themeEventColor: '',
      onSelect: null,
      onOpen: null,
      onClose: null,
      onDraw: null,
      theme: 'light',
      weekdaysMin: null,
      months: null,
      days: null,
      classes: TDP_CLASSES,
      parseDate(value, options) { return parseFlexibleDate(value, options); },
      formatDate(date, options) { return formatDateByPattern(date, options.dateFormat, options.months); },
      formatAriaLabel(date, options) {
        return `${options.days[date.getDay()]} ${date.getDate()} ${options.months[date.getMonth()]} ${date.getFullYear()}`;
      }
    };
  }

  /**
   * Resolves a target passed as a DOM element or CSS selector.
   * @param {Element|string} target - Constructor target.
   * @returns {Element|null} Matching DOM node or null.
   */
  function resolveElement(target) {
    if (target instanceof Element) return target;
    if (typeof target === 'string') return document.querySelector(target);
    return null;
  }

  /**
   * Small helper to create DOM nodes with attributes and optional text.
   * textContent is used by default to keep DOM insertion safe.
   * @param {string} tag - HTML tag name to create.
   * @param {Object} attrs - Attribute map.
   * @param {string} text - Optional textContent.
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, text) {
    const node = document.createElement(tag); // Fresh DOM element.
    Object.keys(attrs || {}).forEach((key) => {
      const value = attrs[key];
      if (value === null || value === undefined) return;
      if (key === 'className') node.className = value;
      else if (key === 'textContent') node.textContent = value;
      else node.setAttribute(key, value);
    });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function navButton(unit, dir, classes) {
    const btn = createElement('button', {
      type: 'button',
      className: `${classes.selectNav} ${dir === 'prev' ? classes.selectNavPrev : classes.selectNavNext}`,
      'data-unit': unit,
      'aria-label': `${dir} ${unit}`
    });
    btn.tabIndex = -1;
    btn.innerHTML = dir === 'prev' ? svgLeft() : svgRight();
    return btn;
  }

  function setLabelText(container, text) {
    container.replaceChildren(createElement('span', null, text));
  }

  function animateLabel(container, text, direction) {
    const currentSpan = normalizeAnimatedLabelContainer(container);

    if (currentSpan && currentSpan.textContent === text) {
      currentSpan.className = '';
      return;
    }

    const incoming = direction === 'next' ? 'slide-left--in' : 'slide-right--in';
    const outgoing = direction === 'next' ? 'slide-left--out' : 'slide-right--out';
    const newSpan = createElement('span', { className: incoming }, text);

    if (currentSpan) {
      currentSpan.className = outgoing;
      container.appendChild(newSpan);
    } else {
      container.replaceChildren(newSpan);
    }

    const finalize = () => {
      newSpan.className = '';
      container.replaceChildren(newSpan);
    };

    newSpan.addEventListener('animationend', finalize, { once: true });
  }

  function normalizeAnimatedLabelContainer(container) {
    const spans = Array.from(container.querySelectorAll('span'));
    if (spans.length === 0) return null;

    const current = spans[spans.length - 1];
    current.className = '';
    container.replaceChildren(current);
    return current;
  }

  function svgLeft() {
    return '<svg class="icon-angle icon-angle--left" viewBox="0 0 256 512" width="10" height="100%" aria-hidden="true"><path fill="currentColor" d="M31.7 239l136-136c9.4-9.4 24.6-9.4 33.9 0l22.6 22.6c9.4 9.4 9.4 24.6 0 33.9L127.9 256l96.4 96.4c9.4 9.4 9.4 24.6 0 33.9L201.7 409c-9.4 9.4-24.6 9.4-33.9 0l-136-136c-9.5-9.4-9.5-24.6-.1-34z"></path></svg>';
  }

  function svgRight() {
    return '<svg class="icon-angle icon-angle--right" viewBox="0 0 256 512" width="10" height="100%" aria-hidden="true"><path fill="currentColor" d="M224.3 273l-136 136c-9.4 9.4-24.6 9.4-33.9 0l-22.6-22.6c-9.4-9.4-9.4-24.6 0-33.9l96.4-96.4-96.4-96.4c-9.4-9.4-9.4-24.6 0-33.9L54.3 103c9.4-9.4 24.6-9.4 33.9 0l136 136c9.5 9.4 9.5 24.6.1 34z"></path></svg>';
  }

  function parseEventNames(events) {
    return String(events || '').trim().split(/\s+/).filter(Boolean).map((chunk) => {
      const pieces = chunk.split('.');
      return { type: pieces[0], namespace: pieces[1] || '' };
    });
  }

  function matchListener(listener, entry, selector, handler) {
    const entryMatch = !entry || ((!entry.type || listener.entry.type === entry.type) && (!entry.namespace || listener.entry.namespace === entry.namespace));
    const selectorMatch = selector === undefined || selector === null || selector === listener.selector;
    const handlerMatch = !handler || handler === listener.handler;
    return entryMatch && selectorMatch && handlerMatch;
  }

  /**
   * Converts any supported date input into a date-only Date object.
   * @param {Date|string|null} value - Raw incoming date value.
   * @param {Object} options - Picker options, mainly for parseDate().
   * @returns {Date|null}
   */
  function normalizeOptionDate(value, options) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = value instanceof Date ? value : options.parseDate(value, options); // Parsed raw date using custom or built-in parser.
    return startOfDay(parsed);
  }

  /**
   * Normalizes all supported range inputs into an ordered { startDate, endDate } object.
   * Accepts arrays, objects, Date instances, single strings, and formatted range strings.
   * @param {*} value - Raw range value.
   * @param {Object} options - Picker options, mainly for parsing and separator resolution.
   * @returns {{startDate: Date, endDate: Date}|null}
   */
  function normalizeOptionRange(value, options) {
    if (value === null || value === undefined || value === '') return null;

    if (Array.isArray(value)) {
      return orderDateRange(normalizeOptionDate(value[0], options), normalizeOptionDate(value[1] ?? value[0], options));
    }

    if (value instanceof Date) {
      return orderDateRange(value, value);
    }

    if (typeof value === 'object' && !(value instanceof Date)) {
      if (value.startDate || value.endDate || value.start || value.end) {
        return orderDateRange(
          normalizeOptionDate(value.startDate || value.start || value.endDate || value.end, options),
          normalizeOptionDate(value.endDate || value.end || value.startDate || value.start, options)
        );
      }
    }

    if (typeof value === 'string') {
      const separator = String(options.rangeSeparator || ' – ');
      if (value.includes(separator)) {
        const [rawStart, rawEnd] = value.split(separator);
        const startDate = normalizeOptionDate(rawStart && rawStart.trim(), options);
        const endDate = normalizeOptionDate(rawEnd && rawEnd.trim(), options);
        if (!startDate || !endDate) return null;
        return orderDateRange(startDate, endDate);
      }

      const singleDate = normalizeOptionDate(value, options);
      return singleDate ? orderDateRange(singleDate, singleDate) : null;
    }

    return null;
  }

  /**
   * Built-in parser used when no custom parseDate() option is provided.
   * Parsing order:
   * 1. configured pattern
   * 2. ISO-like YYYY-MM-DD
   * 3. slash-based DD/MM/YYYY
   * 4. native Date parsing as a last fallback
   *
   * @param {Date|string} value - Raw input value.
   * @param {Object} options - Picker options containing dateFormat/months.
   * @returns {Date|null}
   */
  function parseFlexibleDate(value, options) {
    if (value instanceof Date) return cloneDate(value);
    if (typeof value !== 'string') return null;
    const trimmed = value.trim(); // Raw input without leading/trailing spaces.
    if (!trimmed) return null;

    const patternDate = parseDateByPattern(trimmed, options && options.dateFormat, options && options.months);
    if (patternDate) return patternDate;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) return new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1]));
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Parses a date string using the configured token pattern.
   * Supported tokens: DD, MM, MMM, YYYY.
   * @param {string} value - Date string to parse.
   * @param {string} pattern - Pattern like DD/MM/YYYY or DD MMM YYYY.
   * @param {string[]} months - Month labels used when MMM is present.
   * @returns {Date|null}
   */
  function parseDateByPattern(value, pattern, months) {
    if (!pattern || typeof value !== 'string') return null;

    value = value.trim();
    if (!value) return null;
    const lowered = value.toLowerCase();
    const relativeMap = {today: 0, yesterday: -1, tomorrow: 1};
    if (Object.prototype.hasOwnProperty.call(relativeMap, lowered)) {
      return addDays(startOfDay(new Date()), relativeMap[lowered]);
    }
    const tokenPatterns = {
      DD: '(\\d{2})',
      MM: '(\\d{2})',
      MMM: (months && months.length ? `(${months.map(escapeRegex).join('|')})` : '(?:)') ,
      YYYY: '(\\d{4})'
    };

    const tokenOrder = [];
    const source = `^${String(pattern).replace(/YYYY|MMM|MM|DD/g, (token) => {
      tokenOrder.push(token);
      return tokenPatterns[token];
    })}$`;

    const match = value.match(new RegExp(source, 'i'));
    if (!match) return null;

    const parts = { day: null, month: null, year: null };
    tokenOrder.forEach((token, index) => {
      const piece = match[index + 1];
      if (token === 'DD') parts.day = Number(piece);
      if (token === 'MM') parts.month = Number(piece) - 1;
      if (token === 'MMM') {
        const monthIndex = (months || []).findIndex((label) => label.toLowerCase().slice(0, 3) === piece.toLowerCase());
        parts.month = monthIndex;
      }
      if (token === 'YYYY') parts.year = Number(piece);
    });

    if (![parts.day, parts.month, parts.year].every((part) => Number.isInteger(part))) return null;
    const date = new Date(parts.year, parts.month, parts.day);
    return isSameCalendarDate(date, parts.year, parts.month, parts.day) ? date : null;
  }

  /**
   * Formats a Date using the configured output pattern.
   * @param {Date} date - Date to format.
   * @param {string} pattern - Output pattern.
   * @param {string[]} months - Month labels used for MMM.
   * @returns {string}
   */
  function formatDateByPattern(date, pattern, months) {
    const map = { YYYY: String(date.getFullYear()), MM: pad(date.getMonth() + 1), MMM: months[date.getMonth()].slice(0, 3), DD: pad(date.getDate()) }; // Token => formatted piece map.
    return pattern.replace(/YYYY|MMM|MM|DD/g, (token) => map[token]);
  }

  function startOfDay(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfWeek(date, firstDay) {
    const day = startOfDay(date);
    const diff = (day.getDay() - firstDay + 7) % 7;
    day.setDate(day.getDate() - diff);
    return day;
  }

  /** Adds days to a date clone. */
  function addDays(date, amount) { const next = cloneDate(date); next.setDate(next.getDate() + amount); return next; }
  /** Adds months to a date clone while normalizing to day 1. */
  function addMonths(date, amount) { const next = cloneDate(date); next.setDate(1); next.setMonth(next.getMonth() + amount); return next; }
  /** Adds years to a date clone. */
  function addYears(date, amount) { const next = cloneDate(date); next.setFullYear(next.getFullYear() + amount); return next; }
  /** Returns a clone of the given date with date-only precision. */
  function cloneDate(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  /** Returns a cloned range object. */
  function cloneRange(range) { return range ? { startDate: cloneDate(range.startDate), endDate: cloneDate(range.endDate) } : null; }
  /** Returns true when the date is Saturday or Sunday. */
  function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }
  /** Returns true when two dates match exactly on year/month/day. */
  function isSameDay(a, b) {
    return !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
  }
  /** Returns true when a date matches explicit year/month/day parts. */
  function isSameCalendarDate(date, year, month, day) {
    return date instanceof Date && !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  }
  /** Returns an ordered date range with start <= end. */
  function orderDateRange(startDate, endDate) {
    const start = startOfDay(startDate);
    const end = startOfDay(endDate || startDate);
    if (!start || !end) return null;
    return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start };
  }
  /** Returns true when a date lies inside the given inclusive range. */
  function isDateBetweenInclusive(date, startDate, endDate) {
    const current = startOfDay(date);
    const ordered = orderDateRange(startDate, endDate);
    return !!(current && ordered && current >= ordered.startDate && current <= ordered.endDate);
  }
  /** Computes the visual range-state flags for a calendar cell. */
  function getRangeCellState({ key, date, pendingStartDate, committedRange, previewRange }) {
    const state = { isStart: false, isEnd: false, isSingle: false, isInRange: false, isPreview: false };

    if (committedRange && isDateBetweenInclusive(date, committedRange.startDate, committedRange.endDate)) {
      state.isStart = key === toISODate(committedRange.startDate);
      state.isEnd = key === toISODate(committedRange.endDate);
      state.isSingle = state.isStart && state.isEnd;
      state.isInRange = !state.isStart && !state.isEnd;
      return state;
    }

    if (previewRange && isDateBetweenInclusive(date, previewRange.startDate, previewRange.endDate)) {
      state.isStart = key === toISODate(previewRange.startDate);
      state.isEnd = key === toISODate(previewRange.endDate);
      state.isSingle = state.isStart && state.isEnd;
      state.isPreview = !state.isStart && !state.isEnd;
      return state;
    }

    if (pendingStartDate && key === toISODate(pendingStartDate)) {
      state.isStart = true;
      state.isSingle = true;
    }

    return state;
  }
  /** Rotates an array by the given offset. */
  function rotateArray(items, offset) { return items.map((_, index) => items[(index + offset) % items.length]); }
  /** Formats a date as YYYY-MM-DD. */
  function toISODate(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
  /** Left-pads a number/string with zeros to length 2. */
  function pad(value) { return String(value).padStart(2, '0'); }
  /** Escapes a string for use in a RegExp source. */
  function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** Returns true when the given ISO date exists in markDates. */
  function hasMarkedDateOnDate(markDates, key) {
    return (markDates || []).some((entry) => normalizeEventLikeDate(entry) === key);
  }

  /** Resolves event data from arrays, functions, or ajax config objects. */
  /**
   * Resolves events from the three supported source types:
   * - array
   * - function(startDate, endDate)
   * - ajax config object
   * @param {*} source - Raw events option.
   * @param {{startDate: Date, endDate: Date}} range - Visible month range.
   * @param {Object} options - Picker options forwarded to transforms when needed.
   * @returns {Promise<Array>}
   */
  function resolveEventsSource(source, range, options) {
    if (isFn(source)) {
      return Promise.resolve(source.call(null, range.startDate, range.endDate));
    }

    if (source && typeof source === 'object' && !Array.isArray(source) && !(source instanceof Date)) {
      const url = source.url || source.ajax || source.endpoint;
      if (url) {
        return fetchEventsFromAjax(source, range, options);
      }
    }

    return Promise.resolve([]);
  }

  /** Fetches event entries from a remote endpoint. */
  /**
   * Fetches events from a remote endpoint for the visible month.
   * @param {Object} config - Ajax config from options.events.
   * @param {{startDate: Date, endDate: Date}} range - Requested month range.
   * @param {Object} options - Picker options passed to transformResponse.
   * @returns {Promise<Array>}
   */
  function fetchEventsFromAjax(config, range, options) {
    if (!isFn(fetch)) {
      return Promise.reject(new Error('Fetch API is not available in this environment'));
    }

    const method = String(config.method || 'GET').toUpperCase(); // HTTP method used for the request.
    const startParam = config.startParam || 'startDate'; // Query/body key for the range start.
    const endParam = config.endParam || 'endDate'; // Query/body key for the range end.
    const format = config.paramFormat || 'iso'; // Whether sent values use ISO strings or YYYY-MM-DD.
    const formatValue = (date) => format === 'date' ? toISODate(startOfDay(date)) : date.toISOString(); // Outgoing parameter formatter.
    const params = Object.assign({}, config.params || {}); // Base request params enriched below with date range.
    params[startParam] = formatValue(range.startDate);
    params[endParam] = formatValue(range.endDate);

    let requestUrl = config.url || config.ajax || config.endpoint;
    const fetchOptions = { method, headers: Object.assign({}, config.headers || {}) };

    if (method === 'GET') {
      const search = new URLSearchParams(params);
      requestUrl += (requestUrl.indexOf('?') === -1 ? '?' : '&') + search.toString();
    } else {
      fetchOptions.headers['Content-Type'] = fetchOptions.headers['Content-Type'] || 'application/json';
      fetchOptions.body = JSON.stringify(params);
    }

    return fetch(requestUrl, fetchOptions)
      .then((response) => {
        if (!response.ok) throw new Error(`Events request failed with status ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (isFn(config.transformResponse)) {
          return config.transformResponse(payload, range, options) || [];
        }
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.events)) return payload.events;
        if (Array.isArray(payload.data)) return payload.data;
        return [];
      });
  }

  /**
   * Builds the internal event map consumed by day cell rendering.
   * @param {Array} sourceItems - Raw event entries.
   * @param {string} defaultColor - Fallback dot color.
   * @returns {Map<string, Array<{key: string, color: string}>>}
   */
  function buildEventsMap(sourceItems, defaultColor) {
    const map = new Map(); // YYYY-MM-DD => normalized event entries.
    (sourceItems || []).forEach((entry) => {
      const normalized = normalizeEventEntry(entry, defaultColor);
      if (!normalized) return;
      const current = map.get(normalized.key) || [];
      current.push(normalized);
      map.set(normalized.key, current);
    });
    return map;
  }

  function normalizeEventEntry(entry, defaultColor) {
    const dateKey = normalizeEventLikeDate(entry);
    if (!dateKey) return null;

    const normalized = { key: dateKey, color: defaultColor || '' };
    if (entry && typeof entry === 'object' && !(entry instanceof Date)) {
      if (entry.color) normalized.color = entry.color;
    }
    return normalized;
  }

  function normalizeEventLikeDate(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      const date = parseFlexibleDate(entry);
      return date ? toISODate(startOfDay(date)) : null;
    }
    if (entry instanceof Date) {
      const date = startOfDay(entry);
      return date ? toISODate(date) : null;
    }
    if (typeof entry === 'object' && entry.date) {
      const date = entry.date instanceof Date ? startOfDay(entry.date) : parseFlexibleDate(entry.date);
      return date ? toISODate(startOfDay(date)) : null;
    }
    return null;
  }

  return TinyDatePicker;
});
