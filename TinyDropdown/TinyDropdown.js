/**
 * TinyDropdown
 * Dependency-free dropdown component inspired by Materialize Dropdown.
 *
 * Supports:
 * - data-target / aria-controls target resolution
 * - adjacent/sibling .dropdown-content resolution
 * - virtual/shared dropdowns via openFrom(trigger)
 * - contextual table action menus via adjustMenuState(context)
 * - keyboard navigation and typeahead
 * - CSS-based animation
 */
(function () {
  'use strict';

  const MENU_ITEM_SELECTOR = 'li, [role="menuitem"], [data-dropdown-item], a, button';
  const KEYBOARD_IGNORE_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable]:not([contenteditable="false"])',
    '[role="combobox"]',
    '[role="listbox"]',
    '[data-dropdown-keyboard-ignore]'
  ].join(', ');

  const DEFAULTS = {
    alignment: 'left',
    autoFocus: true,
    constrainWidth: true,
    container: null,
    coverTrigger: false,
    closeOnClick: true,
    hover: false,
    inDuration: 150,
    outDuration: 250,
    onOpenStart: null,
    onOpenEnd: null,
    onCloseStart: null,
    onCloseEnd: null,
    onItemClick: null,
    onBeforeOpen: null,
    adjustMenuState: null,
    virtualTrigger: false,
    closeOnEscape: true,
    closeOnOutsideClick: true,
    repositionOnScroll: true,
    repositionOnResize: true,
    minViewportPadding: 8,
    triggerSelector: null,
    itemSelector: MENU_ITEM_SELECTOR,
    keyboardIgnoreSelector: KEYBOARD_IGNORE_SELECTOR
  };

  const KEY = {
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    TAB: 'Tab',
    ARROW_DOWN: 'ArrowDown',
    ARROW_UP: 'ArrowUp',
    HOME: 'Home',
    END: 'End'
  };

  const ACTIVE_CLASS = 'is-open';
  const OPENING_CLASS = 'is-opening';
  const CLOSING_CLASS = 'is-closing';
  const ACTIVE_ITEM_CLASS = 'is-active';

  const isHTMLElement = (value) => value instanceof HTMLElement;

  const toArray = (input) => Array.prototype.slice.call(input || []);

  const getElement = (input, root = document) => {
    if (!input) return null;
    if (isHTMLElement(input)) return input;
    if (typeof input === 'string') return root.querySelector(input);
    if (input.jquery) return input[0] || null;
    if (Array.isArray(input) || input instanceof NodeList || input instanceof HTMLCollection) {
      return isHTMLElement(input[0]) ? input[0] : null;
    }
    return null;
  };

  const getElements = (input, root = document) => {
    if (!input) return [];
    if (typeof input === 'string') return toArray(root.querySelectorAll(input));
    if (isHTMLElement(input)) return [input];
    if (input.jquery) return input.toArray().filter(isHTMLElement);
    if (Array.isArray(input) || input instanceof NodeList || input instanceof HTMLCollection) {
      return toArray(input).filter(isHTMLElement);
    }
    return [];
  };

  const normalizeTargetId = (value) => value ? value.replace(/^#/, '') : '';

  const isFocusableAction = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden) return false;
    if (element.closest('[hidden]')) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;
    if (element.matches('[disabled]')) return false;
    return true;
  };

  class TinyDropdown {
    static defaults = DEFAULTS;
    static instances = [];
    static activeInstance = null;
    static globalListenersActive = false;

    static init(selector = '.dropdown-trigger', options = {}) {
      return getElements(selector).map((element) => {
        return TinyDropdown.getInstance(element) || new TinyDropdown(element, options);
      });
    }

    static getInstance(input) {
      const element = getElement(input);
      return element ? element.tinyDropdown || null : null;
    }

    static register(instance) {
      if (!TinyDropdown.instances.includes(instance)) {
        TinyDropdown.instances.push(instance);
      }
      TinyDropdown.ensureGlobalListeners();
    }

    static unregister(instance) {
      const index = TinyDropdown.instances.indexOf(instance);
      if (index !== -1) {
        TinyDropdown.instances.splice(index, 1);
      }
      if (TinyDropdown.activeInstance === instance) {
        TinyDropdown.activeInstance = null;
      }
      TinyDropdown.removeGlobalListenersIfUnused();
    }

    static ensureGlobalListeners() {
      if (TinyDropdown.globalListenersActive) return;

      TinyDropdown.handleDocumentPointerDownBound = TinyDropdown.handleDocumentPointerDown.bind(TinyDropdown);
      TinyDropdown.handleDocumentKeydownBound = TinyDropdown.handleDocumentKeydown.bind(TinyDropdown);
      TinyDropdown.handleWindowResizeBound = TinyDropdown.handleWindowResize.bind(TinyDropdown);
      TinyDropdown.handleWindowScrollBound = TinyDropdown.handleWindowScroll.bind(TinyDropdown);

      document.addEventListener('pointerdown', TinyDropdown.handleDocumentPointerDownBound, true);
      document.addEventListener('keydown', TinyDropdown.handleDocumentKeydownBound);
      window.addEventListener('resize', TinyDropdown.handleWindowResizeBound);
      window.addEventListener('scroll', TinyDropdown.handleWindowScrollBound, true);

      TinyDropdown.globalListenersActive = true;
    }

    static removeGlobalListenersIfUnused() {
      if (TinyDropdown.instances.length || !TinyDropdown.globalListenersActive) return;

      document.removeEventListener('pointerdown', TinyDropdown.handleDocumentPointerDownBound, true);
      document.removeEventListener('keydown', TinyDropdown.handleDocumentKeydownBound);
      window.removeEventListener('resize', TinyDropdown.handleWindowResizeBound);
      window.removeEventListener('scroll', TinyDropdown.handleWindowScrollBound, true);

      TinyDropdown.globalListenersActive = false;
    }

    static handleDocumentPointerDown(event) {
      TinyDropdown.instances.forEach((instance) => {
        if (!instance.isOpen || !instance.options.closeOnOutsideClick) return;

        const target = event.target;
        const path = event.composedPath ? event.composedPath() : [];
        const clickedCurrentTrigger = Boolean(
            instance.currentTrigger &&
            (path.includes(instance.currentTrigger) ||
                (target instanceof Node && instance.currentTrigger.contains(target)))
        );
        const clickedDropdown =
            path.includes(instance.dropdownEl) ||
            (target instanceof Node && instance.dropdownEl.contains(target));

        if (clickedCurrentTrigger || clickedDropdown) return;

        instance.close({ restoreFocus: false });
      });
    }

    static handleDocumentKeydown(event) {
      TinyDropdown.activeInstance?.handleGlobalKeydown(event);
    }

    static handleWindowResize() {
      const instance = TinyDropdown.activeInstance;

      if (instance?.isOpen && instance.options.repositionOnResize) {
        instance.recalculateDimensions();
      }
    }

    static handleWindowScroll(event) {
      const instance = TinyDropdown.activeInstance;

      if (!instance?.isOpen || !instance.options.repositionOnScroll) return;

      const target = event && event.target;

      if (target instanceof Node && instance.dropdownEl?.contains(target)) {
        return;
      }

      instance.recalculateDimensions();
    }

    constructor(selectorOrElement, options = {}) {
      const element = getElement(selectorOrElement);

      if (!element) {
        throw new Error('TinyDropdown requires a valid selector or HTMLElement.');
      }

      const existing = TinyDropdown.getInstance(element);
      if (existing) {
        return existing;
      }

      this.options = { ...TinyDropdown.defaults, ...options };
      this.isOpen = false;
      this.focusedIndex = -1;
      this.filterQuery = '';
      this.filterTimer = null;
      this.closeTimer = null;
      this.openTimer = null;
      this.currentTrigger = null;
      this.currentContext = null;
      this.closeAnimationTimer = null;

      if (this.options.virtualTrigger) {
        this.el = null;
        this.dropdownEl = element;
      } else {
        this.el = element;
        this.currentTrigger = element;
        this.dropdownEl = this.resolveDropdownElement(element);
      }

      if (!this.dropdownEl) {
        throw new Error('TinyDropdown could not resolve .dropdown-content.');
      }

      // Register the instance only after the dropdown element was resolved.
      const instanceElement = this.options.virtualTrigger ? this.dropdownEl : this.el;
      instanceElement.tinyDropdown = this;

      this.originalParent = this.dropdownEl.parentElement;
      this.originalNextSibling = this.dropdownEl.nextElementSibling;
      this.actions = this.buildActionMap();

      this.bound = {
        triggerClick: this.handleTriggerClick.bind(this),
        triggerKeydown: this.handleTriggerKeydown.bind(this),
        triggerMouseEnter: this.handleTriggerMouseEnter.bind(this),
        triggerMouseLeave: this.handleTriggerMouseLeave.bind(this),
        dropdownMouseEnter: this.handleDropdownMouseEnter.bind(this),
        dropdownMouseLeave: this.handleDropdownMouseLeave.bind(this),
        dropdownClick: this.handleDropdownClick.bind(this)
      };

      this.setupDropdown();
      this.addEventListeners();
      TinyDropdown.register(this);
    }

    destroy() {
      this.close({ immediate: true, restoreFocus: false, silent: true });
      this.removeEventListeners();
      this.resetDropdownStyles();
      this.dropdownEl.classList.remove('tiny-dropdown', ACTIVE_CLASS, OPENING_CLASS, CLOSING_CLASS);
      this.dropdownEl.removeAttribute('aria-hidden');
      this.dropdownEl.removeAttribute('role');
      this.dropdownEl.tinyDropdown = null;

      window.clearTimeout(this.closeAnimationTimer);
      window.clearTimeout(this.closeTimer);
      window.clearTimeout(this.openTimer);
      window.clearTimeout(this.filterTimer);

      if (this.el) {
        this.el.removeAttribute('aria-expanded');
        this.el.tinyDropdown = null;
      }

      if (this.originalParent) {
        if (this.originalNextSibling && this.originalNextSibling.parentNode === this.originalParent) {
          this.originalParent.insertBefore(this.dropdownEl, this.originalNextSibling);
        } else {
          this.originalParent.append(this.dropdownEl);
        }
      }

      TinyDropdown.unregister(this);
    }

    resolveDropdownElement(trigger) {
      const target = trigger.getAttribute('data-target') || trigger.getAttribute('aria-controls');
      const targetId = normalizeTargetId(target);

      if (targetId) {
        return document.getElementById(targetId);
      }

      const nextElement = trigger.nextElementSibling;
      if (nextElement && nextElement.classList.contains('dropdown-content')) {
        return nextElement;
      }

      const parent = trigger.parentElement;
      if (!parent) return null;

      const directChild = parent.querySelector(':scope > .dropdown-content');
      if (directChild) return directChild;

      return toArray(parent.children).find((child) => {
        return child !== trigger && child.classList.contains('dropdown-content');
      }) || null;
    }

    setupDropdown() {
      this.dropdownEl.classList.add('tiny-dropdown');
      this.dropdownEl.style.setProperty('--tiny-dropdown-in-duration', `${Number(this.options.inDuration) || 0}ms`);
      this.dropdownEl.style.setProperty('--tiny-dropdown-out-duration', `${Number(this.options.outDuration) || 0}ms`);
      this.dropdownEl.setAttribute('role', this.dropdownEl.getAttribute('role') || 'menu');
      this.dropdownEl.setAttribute('aria-hidden', 'true');
      this.dropdownEl.style.display = 'none';

      if (!this.dropdownEl.hasAttribute('tabindex')) {
        this.dropdownEl.setAttribute('tabindex', '0');
      }

      this.getItems().forEach((item) => {
        if (!item.hasAttribute('tabindex')) {
          item.setAttribute('tabindex', '0');
        }
      });

      if (this.el) {
        this.el.setAttribute('aria-expanded', 'false');
        if (!this.el.hasAttribute('aria-haspopup')) {
          this.el.setAttribute('aria-haspopup', 'true');
        }
      }
    }

    addEventListeners() {
      if (this.el) {
        this.el.addEventListener('keydown', this.bound.triggerKeydown);

        if (this.options.hover) {
          this.el.addEventListener('mouseenter', this.bound.triggerMouseEnter);
          this.el.addEventListener('mouseleave', this.bound.triggerMouseLeave);
          this.dropdownEl.addEventListener('mouseenter', this.bound.dropdownMouseEnter);
          this.dropdownEl.addEventListener('mouseleave', this.bound.dropdownMouseLeave);
        } else {
          this.el.addEventListener('click', this.bound.triggerClick);
        }
      }

      this.dropdownEl.addEventListener('click', this.bound.dropdownClick);
    }

    removeEventListeners() {
      if (this.el) {
        this.el.removeEventListener('keydown', this.bound.triggerKeydown);

        if (this.options.hover) {
          this.el.removeEventListener('mouseenter', this.bound.triggerMouseEnter);
          this.el.removeEventListener('mouseleave', this.bound.triggerMouseLeave);
          this.dropdownEl.removeEventListener('mouseenter', this.bound.dropdownMouseEnter);
          this.dropdownEl.removeEventListener('mouseleave', this.bound.dropdownMouseLeave);
        } else {
          this.el.removeEventListener('click', this.bound.triggerClick);
        }
      }

      this.dropdownEl.removeEventListener('click', this.bound.dropdownClick);
    }

    buildActionMap() {
      const actions = {};

      this.dropdownEl.querySelectorAll('[data-action]').forEach((element) => {
        const actionName = element.dataset.action;
        if (!actionName) return;

        if (actions[actionName]) {
          if (!Array.isArray(actions[actionName])) {
            actions[actionName] = [actions[actionName]];
          }
          actions[actionName].push(element);
          return;
        }

        actions[actionName] = element;
      });

      return actions;
    }

    createContext(trigger) {
      const row = trigger?.closest?.('tr') || null;
      const data = row?._data || row?.dataset || null;
      const actions = this.actions;

      const getAction = (name) => {
        const action = actions[name];
        return Array.isArray(action) ? action[0] : action || null;
      };

      const getActionContainer = (name) => {
        const action = getAction(name);
        return action ? action.closest('li') || action : null;
      };

      const setHidden = (name, hidden) => {
        const container = getActionContainer(name);
        if (container) container.hidden = Boolean(hidden);
      };

      const setDisabled = (name, disabled) => {
        const action = getAction(name);
        if (!action) return;
        action.toggleAttribute('disabled', Boolean(disabled));
        action.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        const container = getActionContainer(name);
        if (container) container.classList.toggle('is-disabled', Boolean(disabled));
      };

      const setHref = (name, href) => {
        const action = getAction(name);
        if (action && 'href' in action) {
          action.href = href;
        }
      };

      const setTooltip = (name, tooltip) => {
        const action = getAction(name);
        if (!action) return;
        if (tooltip) {
          action.dataset.tooltip = tooltip;
        } else {
          delete action.dataset.tooltip;
        }
      };

      return {
        trigger,
        dropdown: this.dropdownEl,
        row,
        data,
        actions,
        instance: this,
        getAction,
        getActionContainer,

        show: (name, visible = true) => setHidden(name, !visible),
        hide: (name, hidden = true) => setHidden(name, hidden),
        enable: (name, enabled = true) => setDisabled(name, !enabled),
        disable: (name, disabled = true) => setDisabled(name, disabled),

        setHref,
        setTooltip
      };
    }

    handleTriggerClick(event) {
      event.preventDefault();

      // Same trigger => toggle close
      if (this.isOpen && this.currentTrigger === this.el) {
        this.close();
      } else {
        // Different trigger while already open => reposition/reopen
        this.openFrom(this.el);
      }
    }

    handleTriggerMouseEnter() {
      window.clearTimeout(this.closeTimer);
      this.openFrom(this.el);
    }

    handleTriggerMouseLeave(event) {
      const related = event.relatedTarget;
      if (related && this.dropdownEl.contains(related)) return;
      this.scheduleHoverClose();
    }

    handleDropdownMouseEnter() {
      window.clearTimeout(this.closeTimer);
    }

    handleDropdownMouseLeave(event) {
      const related = event.relatedTarget;
      if (related && this.currentTrigger?.contains(related)) return;
      this.scheduleHoverClose();
    }

    scheduleHoverClose() {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = window.setTimeout(() => this.close({ restoreFocus: false }), 120);
    }

    handleTriggerKeydown(event) {
      if (event.key === KEY.ARROW_DOWN || event.key === KEY.ENTER || event.key === KEY.SPACE) {
        event.preventDefault();
        this.openFrom(this.el, { focusFirst: true });
      }
    }


    /**
     * Returns whether a target belongs to an embedded interactive control.
     *
     * @param {EventTarget|null} target
     * @returns {boolean}
     */
    isNestedInteractiveTarget(target) {
      if (!(target instanceof Element)) return false;

      const selector = this.options.keyboardIgnoreSelector;
      if (!selector) return false;

      const owner = target.closest(selector);

      return Boolean(
          owner &&
          owner !== this.dropdownEl &&
          this.dropdownEl.contains(owner)
      );
    }

    /**
     * Returns whether a nested interactive component owns the keyboard event.
     *
     * @param {KeyboardEvent} event
     * @returns {boolean}
     */
    shouldIgnoreGlobalKeydown(event) {
      // A nested component such as TinySelectize has already handled the key.
      if (event.defaultPrevented) return true;

      const selector = this.options.keyboardIgnoreSelector;
      if (!selector) return false;

      const path = event.composedPath ? event.composedPath() : [event.target];

      for (let index = 0; index < path.length; index++) {
        const element = path[index];

        if (element === this.dropdownEl) break;
        if (element instanceof Element && element.matches(selector)) return true;
      }

      return false;
    }

    handleGlobalKeydown(event) {
      if (!this.isOpen || this.shouldIgnoreGlobalKeydown(event)) return;

      const target = event.target;
      const isFromDropdown = target instanceof Node && this.dropdownEl.contains(target);
      const isFromTrigger = target instanceof Node && this.currentTrigger?.contains(target);

      // Ignore unrelated keyboard events while the menu happens to be open.
      if (!isFromDropdown && !isFromTrigger) return;

      if (event.key === KEY.ESCAPE && this.options.closeOnEscape) {
        event.preventDefault();
        this.close();
        return;
      }

      if (event.key === KEY.TAB) {
        this.close({ restoreFocus: false });
        return;
      }

      if (event.key === KEY.ARROW_DOWN) {
        event.preventDefault();
        this.focusNextItem(1);
        return;
      }

      if (event.key === KEY.ARROW_UP) {
        event.preventDefault();
        this.focusNextItem(-1);
        return;
      }

      if (event.key === KEY.HOME) {
        event.preventDefault();
        this.focusItem(0);
        return;
      }

      if (event.key === KEY.END) {
        event.preventDefault();
        this.focusItem(this.getFocusableItems().length - 1);
        return;
      }

      if (event.key === KEY.ENTER || event.key === KEY.SPACE) {
        const item = this.getFocusableItems()[this.focusedIndex];

        if (item) {
          event.preventDefault();
          this.activateItem(item, event);
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        this.handleTypeahead(event.key);
      }
    }

    /**
     * Returns the direct dropdown item containing an event target.
     *
     * @param {EventTarget|null} target
     * @returns {HTMLElement|null}
     */
    getItemFromTarget(target) {
      if (!(target instanceof Element)) return null;

      let element = target;

      while (element && element.parentElement !== this.dropdownEl) {
        element = element.parentElement;
      }

      if (!(element instanceof HTMLElement) || element.parentElement !== this.dropdownEl) {
        return null;
      }

      return this.getItems().includes(element) ? element : null;
    }

    handleDropdownClick(event) {
      // Nested controls own their click lifecycle and must not close the parent menu.
      if (this.isNestedInteractiveTarget(event.target)) return;

      const item = this.getItemFromTarget(event.target);
      if (!item) return;

      const actionItem = event.target.closest('[data-action], a, button');
      const isDisabled =
          actionItem?.matches('[disabled], [aria-disabled="true"]') ||
          item.matches('.is-disabled, [aria-disabled="true"]');

      if (isDisabled) {
        event.preventDefault();
        return;
      }

      const href = actionItem?.getAttribute('href');
      if (href && href !== '#') {
        if (this.options.closeOnClick) this.close({ restoreFocus: false });
        return; // Let the browser follow the link.
      }

      if (typeof this.options.onItemClick === 'function') {
        this.options.onItemClick.call(this, actionItem || item, event, this.currentContext);
      }

      if (this.options.closeOnClick) {
        this.close({ restoreFocus: false });
      }
    }

    activateItem(item, event) {
      const activatable = item.matches('a, button, [data-action]')
          ? item
          : item.querySelector('a, button, [data-action]') || item;

      activatable.click();
    }

    openFrom(trigger, meta = {}) {
      if (!(trigger instanceof HTMLElement)) {
        throw new Error('TinyDropdown.openFrom requires a valid HTMLElement trigger.');
      }

      this.currentTrigger = trigger;
      if (!this.options.virtualTrigger) {
        this.el = trigger;
      }

      this.currentContext = this.createContext(trigger);

      if (typeof this.options.adjustMenuState === 'function') {
        this.options.adjustMenuState.call(this, this.currentContext);
      }

      if (typeof this.options.onBeforeOpen === 'function') {
        const result = this.options.onBeforeOpen.call(this, this.currentContext);
        if (result === false) return;
      }

      this.open(meta);
    }

    open(meta = {}) {

      window.clearTimeout(this.closeAnimationTimer);

      if (!this.currentTrigger) {
        throw new Error('TinyDropdown.open requires a trigger. Use openFrom(trigger) for virtualTrigger dropdowns.');
      }

      if (this.isOpen) {
        this.recalculateDimensions();
        return;
      }

      if (TinyDropdown.activeInstance && TinyDropdown.activeInstance !== this) {
        TinyDropdown.activeInstance.close({ restoreFocus: false });
      }

      TinyDropdown.activeInstance = this;

      this.isOpen = true;
      this.focusedIndex = -1;
      this.dropdownEl.classList.remove(CLOSING_CLASS);
      this.dropdownEl.classList.add(ACTIVE_CLASS, OPENING_CLASS);
      this.dropdownEl.setAttribute('aria-hidden', 'false');
      this.currentTrigger?.setAttribute('aria-expanded', 'true');

      if (typeof this.options.onOpenStart === 'function') {
        this.options.onOpenStart.call(this, this.currentTrigger, this.currentContext);
      }

      this.resetDropdownStyles({ keepDisplay: false });
      this.dropdownEl.style.display = 'block';
      this.placeDropdown();

      window.clearTimeout(this.openTimer);
      this.openTimer = window.setTimeout(() => {
        this.dropdownEl.classList.remove(OPENING_CLASS);

        // Do not steal focus from a nested control that was focused while opening.
        if (this.options.autoFocus && !this.dropdownEl.contains(document.activeElement)) {
          this.dropdownEl.focus({ preventScroll: true });
        }

        if (meta.focusFirst) {
          this.focusItem(0);
        }

        if (typeof this.options.onOpenEnd === 'function') {
          this.options.onOpenEnd.call(this, this.currentTrigger, this.currentContext);
        }
      }, this.options.inDuration);
    }

    close(meta = {}) {
      if (!this.isOpen && !meta.immediate) return;

      this.isOpen = false;
      this.focusedIndex = -1;
      this.filterQuery = '';
      window.clearTimeout(this.openTimer);
      window.clearTimeout(this.filterTimer);

      if (this.dropdownEl.contains(document.activeElement)) {
        if (meta.restoreFocus !== false && this.currentTrigger) {
          this.currentTrigger.focus({ preventScroll: true });
        } else {
          document.activeElement.blur();
        }
      }

      this.dropdownEl.classList.remove(OPENING_CLASS);
      this.dropdownEl.classList.add(CLOSING_CLASS);
      this.dropdownEl.setAttribute('aria-hidden', 'true');
      this.currentTrigger?.setAttribute('aria-expanded', 'false');

      if (!meta.silent && typeof this.options.onCloseStart === 'function') {
        this.options.onCloseStart.call(this, this.currentTrigger, this.currentContext);
      }

      const finishClose = () => {
        this.dropdownEl.classList.remove(ACTIVE_CLASS, CLOSING_CLASS);
        this.dropdownEl.style.display = 'none';
        this.clearActiveItem();

        if (TinyDropdown.activeInstance === this) {
          TinyDropdown.activeInstance = null;
        }

        if (meta.restoreFocus !== false && this.options.autoFocus) {
          this.currentTrigger?.focus?.({ preventScroll: true });
        }

        if (!meta.silent && typeof this.options.onCloseEnd === 'function') {
          this.options.onCloseEnd.call(this, this.currentTrigger, this.currentContext);
        }
      };

      if (meta.immediate) {
        finishClose();
        return;
      }

      window.clearTimeout(this.closeAnimationTimer);

      this.closeAnimationTimer = window.setTimeout(() => {
        this.closeAnimationTimer = null;
        finishClose();
      }, this.options.outDuration);
    }

    recalculateDimensions() {
      if (!this.isOpen) return;
      this.placeDropdown();
    }

    placeDropdown() {
      const trigger = this.currentTrigger;
      const dropdown = this.dropdownEl;
      const container = getElement(this.options.container);

      if (container) {
        this.placeDropdownInContainer(trigger, dropdown, container);
      } else {
        this.placeDropdownAfterTrigger(trigger, dropdown);
      }
      /*

      if (this.canUseAfterTriggerPlacement(trigger, dropdown)) {
        this.placeDropdownAfterTrigger(trigger, dropdown);
        return;
      }

      this.placeDropdownInViewport(trigger, dropdown);*/
    }

    /*    canUseAfterTriggerPlacement(trigger, dropdown) {
          const parent = trigger.parentElement;
          if (!parent) return false;

          const triggerRect = trigger.getBoundingClientRect();

          const dropdownHeight = dropdown.scrollHeight || dropdown.offsetHeight || 240;
          const dropdownWidth = dropdown.scrollWidth || dropdown.offsetWidth || triggerRect.width;

          const top = this.options.coverTrigger
              ? triggerRect.top
              : triggerRect.bottom;

          const left = this.options.alignment === 'right'
              ? triggerRect.right - dropdownWidth
              : triggerRect.left;

          const projectedRect = {
            top,
            bottom: top + dropdownHeight,
            left,
            right: left + dropdownWidth,
            width: dropdownWidth,
            height: dropdownHeight
          };

          return this.hasEnoughVisibleSpaceForRect(projectedRect, trigger);
        }

        hasEnoughVisibleSpaceForRect(rect, startElement) {
          const viewportRect = {
            top: 0,
            left: 0,
            right: window.innerWidth,
            bottom: window.innerHeight
          };

          if (!this.rectFitsInside(rect, viewportRect)) {
            return false;
          }

          let parent = startElement.parentElement;

          while (parent && parent !== document.body && parent !== document.documentElement) {
            if (this.isClippingElement(parent)) {
              const parentRect = parent.getBoundingClientRect();

              if (!this.rectFitsInside(rect, parentRect)) {
                return false;
              }
            }

            parent = parent.parentElement;
          }

          return true;
        }
        rectFitsInside(rect, bounds) {
          return (
              rect.top >= bounds.top &&
              rect.left >= bounds.left &&
              rect.bottom <= bounds.bottom &&
              rect.right <= bounds.right
          );
        }

        isClippingElement(element) {
          const style = window.getComputedStyle(element);

          return (
              style.overflow === 'hidden' ||
              style.overflow === 'clip' ||
              style.overflowX === 'hidden' ||
              style.overflowX === 'clip' ||
              style.overflowY === 'hidden' ||
              style.overflowY === 'clip' ||
              style.overflowY === 'auto' ||
              style.overflowY === 'scroll'
          );
        }*/
    placeDropdownAfterTrigger(trigger, dropdown) {
      if (dropdown.previousElementSibling !== trigger) {
        trigger.insertAdjacentElement('afterend', dropdown);
      }

      const parent = trigger.parentElement;
      if (!parent) return;

      if (window.getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }

      const viewportW = window.innerWidth || document.documentElement.clientWidth;
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const margin = Number(this.options.minViewportPadding) || 8;

      // Reset only placement-related inline styles before measuring.
      dropdown.style.position = 'absolute';
      dropdown.style.display = 'block';
      dropdown.style.left = '0px';
      dropdown.style.right = 'auto';
      dropdown.style.top = '0px';
      dropdown.style.bottom = 'auto';
      dropdown.style.width = '';
      dropdown.style.height = '';
      dropdown.style.maxHeight = '';
      dropdown.style.overflowY = '';
      dropdown.style.transformOrigin = '';

      const triggerRect = trigger.getBoundingClientRect();
      const parentRect = parent.getBoundingClientRect();
      const triggerWidth = trigger.offsetWidth;
      const triggerLeft = triggerRect.left - parentRect.left + parent.scrollLeft;
      const triggerTop = triggerRect.top - parentRect.top + parent.scrollTop;

      if (this.options.constrainWidth) {
        dropdown.style.minWidth = `${triggerWidth}px`;
      } else {
        dropdown.style.minWidth = '';
      }

      const dropdownWidth = Math.ceil(
          dropdown.getBoundingClientRect().width ||
          dropdown.scrollWidth ||
          triggerWidth
      );

      const dropdownHeight = Math.ceil(
          dropdown.scrollHeight ||
          dropdown.getBoundingClientRect().height ||
          0
      );

      // --------------------------------------------------
      // Horizontal placement
      // --------------------------------------------------

      const preferredRight =
          this.options.alignment === 'right' ||
          dropdown.classList.contains('dropdown-left');

      const leftAligned = triggerLeft;
      const rightAligned = triggerLeft + triggerWidth - dropdownWidth;

      const leftRect = {
        left: parentRect.left + leftAligned - parent.scrollLeft,
        right: parentRect.left + leftAligned - parent.scrollLeft + dropdownWidth
      };

      const rightRect = {
        left: parentRect.left + rightAligned - parent.scrollLeft,
        right: parentRect.left + rightAligned - parent.scrollLeft + dropdownWidth
      };

      const fitsLeft =
          leftRect.left >= margin &&
          leftRect.right <= viewportW - margin;

      const fitsRight =
          rightRect.left >= margin &&
          rightRect.right <= viewportW - margin;

      let left;

      if (preferredRight && fitsRight) {
        left = rightAligned;
      } else if (!preferredRight && fitsLeft) {
        left = leftAligned;
      } else if (fitsRight) {
        left = rightAligned;
      } else if (fitsLeft) {
        left = leftAligned;
      } else {
        // Last fallback: keep preferred alignment, but clamp relative to viewport.
        left = preferredRight ? rightAligned : leftAligned;

        const projectedLeft = parentRect.left + left - parent.scrollLeft;
        const projectedRight = projectedLeft + dropdownWidth;

        if (projectedRight > viewportW - margin) {
          left -= projectedRight - (viewportW - margin);
        }

        if (parentRect.left + left - parent.scrollLeft < margin) {
          left += margin - (parentRect.left + left - parent.scrollLeft);
        }
      }

      // --------------------------------------------------
      // Vertical placement
      // --------------------------------------------------

      const belowTop = this.options.coverTrigger
          ? triggerTop
          : triggerTop + trigger.offsetHeight;

      const aboveTop = this.options.coverTrigger
          ? triggerTop + trigger.offsetHeight - dropdownHeight
          : triggerTop - dropdownHeight;

      const viewportBelowTop = this.options.coverTrigger
          ? triggerRect.top
          : triggerRect.bottom;

      const viewportAboveBottom = this.options.coverTrigger
          ? triggerRect.bottom
          : triggerRect.top;

      const spaceBelow = Math.max(0, Math.floor(viewportH - viewportBelowTop - margin));
      const spaceAbove = Math.max(0, Math.floor(viewportAboveBottom - margin));

      const openBelow =
          spaceBelow >= dropdownHeight ||
          spaceBelow >= spaceAbove;

      const availableHeight = openBelow ? spaceBelow : spaceAbove;

      let top = openBelow ? belowTop : aboveTop;

      if (dropdownHeight > availableHeight) {
        dropdown.style.maxHeight = `${Math.max(80, availableHeight)}px`;
        dropdown.style.overflowY = 'auto';

        if (!openBelow) {
          top = this.options.coverTrigger
              ? triggerTop + trigger.offsetHeight - Math.max(80, availableHeight)
              : triggerTop - Math.max(80, availableHeight);
        }
      }

      // --------------------------------------------------
      // Apply final styles
      // --------------------------------------------------

      dropdown.style.left = `${Math.round(left)}px`;
      dropdown.style.top = `${Math.round(top)}px`;
      dropdown.style.width = `${dropdownWidth}px`;

      dropdown.style.transformOrigin = `${left < 0 ? '100%' : '0'} ${openBelow ? '0px' : '100%'}`;
    }


    placeDropdownInContainer(trigger, dropdown, container) {

      // --------------------------------------------------
      // Ensure dropdown is mounted inside target container
      // --------------------------------------------------
      if (dropdown.parentElement !== container) {
        container.append(dropdown);
      }

      // --------------------------------------------------
      // Dropdown uses absolute positioning.
      // Container must therefore be a positioning context.
      // --------------------------------------------------
      const containerStyle = window.getComputedStyle(container);
      if (containerStyle.position === 'static') container.style.position = 'relative';

      // --------------------------------------------------
      // Reset placement-related inline styles before measuring.
      // This guarantees fresh dimensions every time.
      // --------------------------------------------------
      dropdown.style.position = 'absolute';
      dropdown.style.left = '0px';
      dropdown.style.top = '0px';
      dropdown.style.width = '';
      dropdown.style.height = '';
      dropdown.style.maxHeight = '';
      dropdown.style.transformOrigin = '';

      // --------------------------------------------------
      // Geometry of trigger and container in viewport space.
      // --------------------------------------------------
      const triggerRect = trigger.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // --------------------------------------------------
      // Optionally force dropdown width to match trigger width.
      // --------------------------------------------------
      dropdown.style.minWidth = this.options.constrainWidth ? `${triggerRect.width}px` : '';

      // --------------------------------------------------
      // Measure dropdown after width constraints are applied.
      // --------------------------------------------------
      const dropdownRect = dropdown.getBoundingClientRect();
      const padding = Number(this.options.minViewportPadding) || 8;
      const desiredWidth = Math.max(dropdownRect.width, this.options.constrainWidth ? triggerRect.width : 0);

      // --------------------------------------------------
      // Trigger coordinates converted from viewport space
      // into container-local coordinates.
      // --------------------------------------------------
      const triggerLeft = triggerRect.left - containerRect.left + container.scrollLeft;
      const triggerTop = triggerRect.top - containerRect.top + container.scrollTop;
      const triggerRight = triggerLeft + triggerRect.width;
      const triggerBottom = triggerTop + triggerRect.height;

      // --------------------------------------------------
      // Visible area inside the scrollable container.
      // --------------------------------------------------
      const containerVisibleTop = container.scrollTop + padding;
      const containerVisibleBottom = container.scrollTop + container.clientHeight - padding;
      const containerVisibleLeft = container.scrollLeft + padding;
      const containerVisibleRight = container.scrollLeft + container.clientWidth - padding;

      // --------------------------------------------------
      // Visible area inside the browser viewport,
      // converted into container-local coordinates.
      // --------------------------------------------------
      // getBoundingClientRect() is already expressed in viewport coordinates.
      // Adding window.scrollX/Y here would count the document scroll twice and
      // progressively shrink/misplace portaled dropdowns as the page is scrolled.
      const viewportVisibleTop = padding - containerRect.top + container.scrollTop;
      const viewportVisibleBottom = window.innerHeight - padding - containerRect.top + container.scrollTop;
      const viewportVisibleLeft = padding - containerRect.left + container.scrollLeft;
      const viewportVisibleRight = window.innerWidth - padding - containerRect.left + container.scrollLeft;

      // --------------------------------------------------
      // Effective visible area:
      // intersection between container visibility
      // and actual viewport visibility.
      // --------------------------------------------------
      const visibleTop = Math.max(containerVisibleTop, viewportVisibleTop);
      const visibleBottom = Math.min(containerVisibleBottom, viewportVisibleBottom);
      const visibleLeft = Math.max(containerVisibleLeft, viewportVisibleLeft);
      const visibleRight = Math.min(containerVisibleRight, viewportVisibleRight);

      // --------------------------------------------------
      // Available vertical space above and below trigger.
      // --------------------------------------------------
      const belowTop = this.options.coverTrigger ? triggerTop : triggerBottom;
      const aboveBottom = this.options.coverTrigger ? triggerBottom : triggerTop;

      const spaceBelow = visibleBottom - belowTop;
      const spaceAbove = aboveBottom - visibleTop;

      // --------------------------------------------------
      // Open below if it fits, otherwise choose the side
      // offering the most available space.
      // --------------------------------------------------
      const openBelow = spaceBelow >= dropdownRect.height || spaceBelow >= spaceAbove;

      // --------------------------------------------------
      // Initial vertical position.
      // --------------------------------------------------
      let top = openBelow ? belowTop : aboveBottom - dropdownRect.height;
      let maxHeight = openBelow ? spaceBelow : spaceAbove;

      // --------------------------------------------------
      // If dropdown cannot fully fit,
      // constrain its height and enable scrolling.
      // --------------------------------------------------
      if (maxHeight < dropdownRect.height) {
        dropdown.style.overflowY = 'auto';
        dropdown.style.maxHeight = `${Math.max(80, maxHeight)}px`;

        if (!openBelow) {
          top = visibleTop;
        }
      } else {
        dropdown.style.overflowY = '';
      }

      // --------------------------------------------------
      // Horizontal alignment.
      // --------------------------------------------------
      let left;
      let horizontalAlignment = this.options.alignment;

      if (horizontalAlignment === 'right') {
        left = triggerRight - desiredWidth;
      } else {
        left = triggerLeft;
      }

      // --------------------------------------------------
      // Prevent overflow on the right.
      // --------------------------------------------------
      if (left + desiredWidth > visibleRight) {
        left = visibleRight - desiredWidth;
        horizontalAlignment = 'right';
      }

      // --------------------------------------------------
      // Prevent overflow on the left.
      // --------------------------------------------------
      if (left < visibleLeft) {
        left = visibleLeft;
        horizontalAlignment = 'left';
      }

      // --------------------------------------------------
      // Apply final computed position and sizing.
      // --------------------------------------------------
      dropdown.style.left = `${Math.round(left)}px`;
      dropdown.style.top = `${Math.round(top)}px`;

      dropdown.style.width = this.options.constrainWidth ? `${Math.max(desiredWidth, triggerRect.width)}px` : '';

      // --------------------------------------------------
      // Animation origin follows actual opening direction.
      // --------------------------------------------------
      dropdown.style.transformOrigin = `${horizontalAlignment === 'right' ? '100%' : '0'} ${openBelow ? '0' : '100%'}`;
    }

    /**
     * Returns direct menu items while excluding embedded controls.
     *
     * Semantic items are preferred. The fallback preserves compatibility with
     * legacy dropdowns that use plain direct-child elements as menu items.
     *
     * @returns {HTMLElement[]}
     */
    getItems() {
      const children = toArray(this.dropdownEl.children).filter(isHTMLElement);
      const itemSelector = this.options.itemSelector;

      if (itemSelector) {
        const semanticItems = children.filter((element) => element.matches(itemSelector));
        if (semanticItems.length) return semanticItems;
      }

      const keyboardIgnoreSelector = this.options.keyboardIgnoreSelector;

      return children.filter((element) => {
        if (!keyboardIgnoreSelector) return true;

        return !element.matches(keyboardIgnoreSelector) &&
            !element.querySelector(keyboardIgnoreSelector);
      });
    }

    getFocusableItems() {
      return this.getItems().filter(isFocusableAction);
    }

    focusNextItem(direction) {
      const items = this.getFocusableItems();
      if (!items.length) return;

      let index = this.focusedIndex;

      if (index < 0) {
        index = direction > 0 ? -1 : 0;
      }

      const nextIndex = (index + direction + items.length) % items.length;

      this.focusItem(nextIndex, direction);
    }

    focusItem(index, direction = 0) {
      const items = this.getFocusableItems();
      if (!items.length || index < 0) return;

      const normalizedIndex = Math.min(index, items.length - 1);
      const item = items[normalizedIndex];

      this.clearActiveItem();

      this.focusedIndex = normalizedIndex;
      item.classList.add(ACTIVE_ITEM_CLASS);

      // Keep focus on the menu container. Do not focus <li>.
      // Focusing <li> lets the browser perform its own scroll,
      // which fights with our manual scroll logic.
      if (document.activeElement !== this.dropdownEl) {
        this.dropdownEl.focus({ preventScroll: true });
      }

      this.scrollItemIntoDropdownView(item, direction);
    }

    scrollItemIntoDropdownView(item, direction = 0) {
      if (!item) return;

      const container = this.dropdownEl;

      const itemTop = item.offsetTop;
      const itemHeight = item.offsetHeight;
      const itemBottom = itemTop + itemHeight;

      const viewTop = container.scrollTop;
      const viewHeight = container.clientHeight;
      const viewBottom = viewTop + viewHeight;

      // When wrapping upward from first item to last item,
      // jump directly to the bottom of the menu.
      if (direction < 0 && this.focusedIndex === this.getFocusableItems().length - 1) {
        container.scrollTop = container.scrollHeight - viewHeight;
        return;
      }

      // When wrapping downward from last item to first item,
      // jump directly to the top of the menu.
      if (direction > 0 && this.focusedIndex === 0) {
        container.scrollTop = 0;
        return;
      }

      // Active item is above visible area.
      if (itemTop < viewTop) {
        container.scrollTop = itemTop;
        return;
      }

      // Active item is below visible area.
      if (itemBottom > viewBottom) {
        container.scrollTop = itemBottom - viewHeight;
      }
    }

    clearActiveItem() {
      this.getItems().forEach((item) => item.classList.remove(ACTIVE_ITEM_CLASS));
    }

    handleTypeahead(character) {
      this.filterQuery += character.toLowerCase();
      window.clearTimeout(this.filterTimer);

      const items = this.getFocusableItems();
      const matchIndex = items.findIndex((item) => {
        return item.textContent.trim().toLowerCase().startsWith(this.filterQuery);
      });

      if (matchIndex !== -1) {
        this.focusItem(matchIndex);
      }

      this.filterTimer = window.setTimeout(() => {
        this.filterQuery = '';
      }, 1000);
    }

    resetDropdownStyles({ keepDisplay = true } = {}) {
      this.dropdownEl.style.left = '';
      this.dropdownEl.style.right = '';
      this.dropdownEl.style.top = '';
      this.dropdownEl.style.bottom = '';
      this.dropdownEl.style.width = '';
      this.dropdownEl.style.minWidth = '';
      this.dropdownEl.style.height = '';
      this.dropdownEl.style.maxHeight = '';
      this.dropdownEl.style.position = '';
      this.dropdownEl.style.transformOrigin = '';
      this.dropdownEl.style.overflowY = '';
      if (!keepDisplay) {
        this.dropdownEl.style.display = '';
      }
    }
  }

  window.TinyDropdown = TinyDropdown;
})();
