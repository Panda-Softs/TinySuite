/**
 * TinyCollapsible
 * Dependency-free collapsible / accordion component.
 *
 * Supports Materialize-like markup:
 * <ul class="collapsible">
 *   <li>
 *     <a class="collapsible-header">Header</a>
 *     <div class="collapsible-body">...</div>
 *   </li>
 * </ul>
 *
 * Plus TinyCollapsibleMenu for controlling many collapsibles inside a menu.
 */
(function () {
  'use strict';

  const DEFAULTS = {
    accordion: true,
    inDuration: 300,
    outDuration: 300,
    easing: 'cubic-bezier(.4, 0, .2, 1)',
    headerSelector: '.collapsible-header',
    bodySelector: '.collapsible-body',
    itemSelector: ':scope > li',
    activeClass: 'active',
    disabledClass: 'disabled',
    onOpenStart: null,
    onOpenEnd: null,
    onCloseStart: null,
    onCloseEnd: null
  };

  const MENU_DEFAULTS = {
    collapsibleSelector: '.collapsible',
    itemLinkSelector: 'a[href], button, [role="button"]',
    activeLinkSelector: 'a.active, button.active, [aria-current="page"]',
    expandActivePathOnInit: true,
    scrollIntoView: false
  };

  const FILTER_DEFAULTS = {
    itemSelector: 'li',
    textSelector: 'a, .collapsible-header',
    hiddenClass: 'is-filter-hidden',
    matchClass: 'is-filter-match',
    ancestorClass: 'is-filter-ancestor',
    descendantClass: 'is-filter-descendant',
    highlightClass: 'tiny-collapsible-mark',
    highlight: true,
    autoExpand: true,
    includeDescendants: true,
    closeBeforeExpand: true,
    minLength: 1,
    caseSensitive: false
  };

  const isHTMLElement = (value) => value instanceof HTMLElement;

  const toArray = (input, root = document) => {
    if (!input) return [];
    if (typeof input === 'string') return Array.from(root.querySelectorAll(input));
    if (isHTMLElement(input)) return [input];
    if (input instanceof NodeList || input instanceof HTMLCollection) return Array.from(input).filter(isHTMLElement);
    if (Array.isArray(input)) return input.filter(isHTMLElement);
    if (input.jquery) return input.toArray().filter(isHTMLElement);
    return [];
  };

  const toElement = (input, root = document) => {
    if (!input) return null;
    if (isHTMLElement(input)) return input;
    if (typeof input === 'string') return root.querySelector(input);
    if (input.jquery) return input[0] || null;
    if (input instanceof NodeList || input instanceof HTMLCollection || Array.isArray(input)) {
      return isHTMLElement(input[0]) ? input[0] : null;
    }
    return null;
  };

  const nextFrame = (callback) => requestAnimationFrame(() => requestAnimationFrame(callback));

  class TinyCollapsible {
    static defaults = DEFAULTS;

    static init(targets = '.collapsible', options = {}) {
      return toArray(targets).map((element) => TinyCollapsible.getInstance(element) || new TinyCollapsible(element, options));
    }

    static getInstance(target) {
      const element = toElement(target);
      return element ? element.tinyCollapsible || null : null;
    }

    constructor(target, options = {}) {
      const element = toElement(target);

      if (!element) {
        throw new Error('TinyCollapsible requires a valid element or selector.');
      }

      const existing = TinyCollapsible.getInstance(element);
      if (existing) return existing;

      this.el = element;
      this.options = { ...TinyCollapsible.defaults, ...options };
      this.items = [];
      this.isDestroyed = false;

      this.bound = {
        click: this.handleClick.bind(this),
        keydown: this.handleKeydown.bind(this),
        transitionEnd: this.handleTransitionEnd.bind(this)
      };

      this.el.tinyCollapsible = this;
      this.setup();
    }

    setup() {
      this.el.classList.add('tiny-collapsible');
      this.el.style.setProperty('--tiny-collapsible-in-duration', `${this.options.inDuration}ms`);
      this.el.style.setProperty('--tiny-collapsible-out-duration', `${this.options.outDuration}ms`);
      this.el.style.setProperty('--tiny-collapsible-easing', this.options.easing);

      this.refresh();

      this.el.addEventListener('click', this.bound.click);
      this.el.addEventListener('keydown', this.bound.keydown);
      this.el.addEventListener('transitionend', this.bound.transitionEnd);
    }

    destroy() {
      if (this.isDestroyed) return;

      this.el.removeEventListener('click', this.bound.click);
      this.el.removeEventListener('keydown', this.bound.keydown);
      this.el.removeEventListener('transitionend', this.bound.transitionEnd);

      this.items.forEach((item) => {
        const { header, body } = item;
        header.removeAttribute('tabindex');
        header.removeAttribute('role');
        header.removeAttribute('aria-expanded');
        header.removeAttribute('aria-controls');
        body.removeAttribute('id');
        body.removeAttribute('role');
        body.removeAttribute('aria-hidden');
        body.style.maxHeight = '';
        body.style.display = '';
      });

      this.el.classList.remove('tiny-collapsible');
      this.el.tinyCollapsible = null;
      this.isDestroyed = true;
    }

    refresh() {
      this.items = this.getDirectItems()
        .map((li, index) => this.createItemRecord(li, index))
        .filter(Boolean);

      const activeItems = this.items.filter((item) => item.li.classList.contains(this.options.activeClass));

      if (this.options.accordion && activeItems.length > 1) {
        activeItems.slice(1).forEach((item) => item.li.classList.remove(this.options.activeClass));
      }

      this.items.forEach((item) => this.syncItemState(item, { immediate: true }));

      return this;
    }

    getDirectItems() {
      return Array.from(this.el.children).filter((child) => child.matches('li'));
    }

    createItemRecord(li, index) {
      const header = li.querySelector(`:scope > ${this.options.headerSelector}`);
      const body = li.querySelector(`:scope > ${this.options.bodySelector}`);

      if (!header || !body) return null;

      const bodyId = body.id || `${this.el.id || 'tiny-collapsible'}-panel-${index + 1}`;
      body.id = bodyId;

      header.setAttribute('tabindex', header.getAttribute('tabindex') || '0');
      header.setAttribute('role', header.getAttribute('role') || 'button');
      header.setAttribute('aria-controls', bodyId);

      body.setAttribute('role', body.getAttribute('role') || 'region');

      return { li, header, body, index };
    }

    handleClick(event) {
      const header = event.target.closest(this.options.headerSelector);
      if (!header || !this.el.contains(header)) return;

      const item = this.getItemByHeader(header);
      if (!item || !this.canToggle(item)) return;

      event.preventDefault();
      this.toggle(item.index);
    }

    handleKeydown(event) {
      const header = event.target.closest(this.options.headerSelector);
      if (!header || !this.el.contains(header)) return;

      const item = this.getItemByHeader(header);
      if (!item || !this.canToggle(item)) return;

      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.toggle(item.index);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.focusByOffset(item.index, 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.focusByOffset(item.index, -1);
          break;
        case 'Home':
          event.preventDefault();
          this.focus(0);
          break;
        case 'End':
          event.preventDefault();
          this.focus(this.items.length - 1);
          break;
      }
    }

    handleTransitionEnd(event) {
      const item = this.items.find((entry) => entry.body === event.target);
      if (!item || event.propertyName !== 'max-height') return;

      const isActive = item.li.classList.contains(this.options.activeClass);

      item.body.classList.remove('is-opening', 'is-closing');

      if (isActive) {
        item.body.style.maxHeight = 'none';
        item.body.style.overflow = '';
        if (typeof this.options.onOpenEnd === 'function') {
          this.options.onOpenEnd.call(this, item.li, item.index, this);
        }
      } else {
        item.body.style.display = 'none';
        item.body.style.overflow = '';
        if (typeof this.options.onCloseEnd === 'function') {
          this.options.onCloseEnd.call(this, item.li, item.index, this);
        }
      }
    }

    toggle(indexOrItem) {
      const item = this.getItem(indexOrItem);
      if (!item) return this;

      if (this.isOpen(item.index)) {
        return this.close(item.index);
      }

      return this.open(item.index);
    }

    open(indexOrItem, meta = {}) {
      const item = this.getItem(indexOrItem);
      if (!item || this.isOpen(item.index) || !this.canToggle(item)) return this;

      if (typeof this.options.onOpenStart === 'function') {
        const result = this.options.onOpenStart.call(this, item.li, item.index, this);
        if (result === false) return this;
      }

      if (this.options.accordion && !meta.keepOthersOpen) {
        this.items.forEach((entry) => {
          if (entry.index !== item.index && this.isOpen(entry.index)) {
            this.close(entry.index, { fromAccordion: true });
          }
        });
      }

      item.li.classList.add(this.options.activeClass);
      item.header.setAttribute('aria-expanded', 'true');
      item.body.setAttribute('aria-hidden', 'false');
      item.body.style.display = 'block';
      item.body.style.overflow = 'hidden';
      item.body.classList.remove('is-closing');
      item.body.classList.add('is-opening');

      const height = item.body.scrollHeight;
      item.body.style.maxHeight = '0px';

      nextFrame(() => {
        item.body.style.maxHeight = `${height}px`;
      });

      return this;
    }

    close(indexOrItem, meta = {}) {
      const item = this.getItem(indexOrItem);
      if (!item || !this.isOpen(item.index)) return this;

      if (typeof this.options.onCloseStart === 'function') {
        const result = this.options.onCloseStart.call(this, item.li, item.index, this, meta);
        if (result === false) return this;
      }

      const height = item.body.scrollHeight;
      item.body.style.display = 'block';
      item.body.style.overflow = 'hidden';
      item.body.style.maxHeight = `${height}px`;
      item.body.classList.remove('is-opening');
      item.body.classList.add('is-closing');
      item.li.classList.remove(this.options.activeClass);
      item.header.setAttribute('aria-expanded', 'false');
      item.body.setAttribute('aria-hidden', 'true');

      nextFrame(() => {
        item.body.style.maxHeight = '0px';
      });

      return this;
    }

    openAll() {
      this.items.forEach((item) => this.open(item.index, { keepOthersOpen: true }));
      return this;
    }

    closeAll() {
      this.items.forEach((item) => this.close(item.index));
      return this;
    }

    expandAll() {
      return this.openAll();
    }

    collapseAll() {
      return this.closeAll();
    }

    openFirst() {
      return this.open(0);
    }

    openLast() {
      return this.open(this.items.length - 1);
    }

    openByHeaderText(text, options = {}) {
      const normalized = String(text).trim().toLowerCase();
      const item = this.items.find((entry) => entry.header.textContent.trim().toLowerCase().includes(normalized));
      if (item) this.open(item.index, options);
      return this;
    }

    closeOthers(indexOrItem) {
      const item = this.getItem(indexOrItem);
      if (!item) return this;

      this.items.forEach((entry) => {
        if (entry.index !== item.index) this.close(entry.index);
      });

      return this;
    }

    isOpen(indexOrItem) {
      const item = this.getItem(indexOrItem);
      return !!item && item.li.classList.contains(this.options.activeClass);
    }

    getOpenItems() {
      return this.items.filter((item) => this.isOpen(item.index)).map((item) => item.li);
    }

    getItem(indexOrItem) {
      if (typeof indexOrItem === 'number') return this.items[indexOrItem] || null;
      if (indexOrItem?.li) return indexOrItem;
      if (indexOrItem instanceof HTMLElement) {
        return this.items.find((item) => item.li === indexOrItem || item.header === indexOrItem || item.body === indexOrItem) || null;
      }
      return null;
    }

    getItemByHeader(header) {
      return this.items.find((item) => item.header === header) || null;
    }

    canToggle(item) {
      return !item.li.classList.contains(this.options.disabledClass) && !item.header.hasAttribute('disabled');
    }

    focus(index) {
      const item = this.items[index];
      if (item) item.header.focus();
      return this;
    }

    focusByOffset(currentIndex, offset) {
      if (!this.items.length) return this;
      const nextIndex = (currentIndex + offset + this.items.length) % this.items.length;
      return this.focus(nextIndex);
    }

    syncItemState(item, { immediate = false } = {}) {
      const isActive = item.li.classList.contains(this.options.activeClass);
      item.header.setAttribute('aria-expanded', String(isActive));
      item.body.setAttribute('aria-hidden', String(!isActive));

      if (immediate) {
        item.body.style.display = isActive ? 'block' : 'none';
        item.body.style.maxHeight = isActive ? 'none' : '0px';
        item.body.style.overflow = '';
      }
    }
  }

  class TinyCollapsibleMenu {
    static defaults = MENU_DEFAULTS;

    static init(target = document, collapsibleOptions = {}, menuOptions = {}) {
      return new TinyCollapsibleMenu(target, collapsibleOptions, menuOptions);
    }

    static getInstance(target) {
      const root = target === document ? document : toElement(target);
      return root ? root.tinyCollapsibleMenu || null : null;
    }

    constructor(target = document, collapsibleOptions = {}, menuOptions = {}) {
      const root = target === document ? document : toElement(target);
      if (!root) throw new Error('TinyCollapsibleMenu requires a valid root element or selector.');

      const existing = TinyCollapsibleMenu.getInstance(root);
      if (existing) return existing;

      this.root = root;
      this.options = { ...TinyCollapsibleMenu.defaults, ...menuOptions };
      this.collapsibleOptions = collapsibleOptions;
      this.instances = [];
      this.lastFilterOptions = null;

      this.root.tinyCollapsibleMenu = this;
      this.root.classList.add('tiny-collapsible-menu')

      this.refresh();

      if (this.options.expandActivePathOnInit) {
        const active = this.root.querySelector(this.options.activeLinkSelector);
        if (active) this.expandUntil(active, { scrollIntoView: this.options.scrollIntoView });
      }
    }

    refresh() {
      this.instances = toArray(this.options.collapsibleSelector, this.root).map((collapsible) => {
        return TinyCollapsible.getInstance(collapsible) || new TinyCollapsible(collapsible, this.collapsibleOptions);
      });

      return this;
    }

    destroy() {
      this.clearFilter(this.lastFilterOptions || undefined);
      this.instances.forEach((instance) => instance.destroy());
      this.instances = [];
      this.root.tinyCollapsibleMenu = null;
    }

    expandAll() {
      this.instances.forEach((instance) => instance.openAll());
      return this;
    }

    openAll() {
      return this.expandAll();
    }

    closeAll() {
      this.instances.forEach((instance) => instance.closeAll());
      return this;
    }

    collapseAll() {
      return this.closeAll();
    }

    toggleAll(forceOpen = null) {
      const shouldOpen = forceOpen == null ? !this.hasOpenItems() : Boolean(forceOpen);
      return shouldOpen ? this.expandAll() : this.closeAll();
    }

    hasOpenItems() {
      return this.instances.some((instance) => instance.getOpenItems().length > 0);
    }

    getOpenItems() {
      return this.instances.flatMap((instance) => instance.getOpenItems());
    }

    expandUntil(node, options = {}) {
      const element = toElement(node, this.root);
      if (!element) return this;

      const collapsibleItems = [];
      let current = element;

      while (current && current !== this.root && current !== document.body) {
        if (current.matches?.('.collapsible > li')) {
          collapsibleItems.push(current);
        }
        current = current.parentElement;
      }

      collapsibleItems.reverse().forEach((li) => {
        const collapsible = li.closest('.collapsible');
        const instance = TinyCollapsible.getInstance(collapsible);
        if (!instance) return;
        const item = instance.getItem(li);
        if (item) instance.open(item.index);
      });

      if (options.scrollIntoView) {
        element.scrollIntoView({ block: 'nearest', behavior: options.scrollBehavior || 'smooth' });
      }

      return this;
    }

    expandActivePath(selector = this.options.activeLinkSelector, options = {}) {
      const active = this.root.querySelector(selector);
      if (active) this.expandUntil(active, options);
      return this;
    }

    openByHeaderText(text) {
      this.instances.forEach((instance) => instance.openByHeaderText(text));
      return this;
    }

    findLinkByHref(href) {
      return this.root.querySelector(`a[href="${CSS.escape(href)}"]`);
    }

    expandToHref(href, options = {}) {
      const link = this.findLinkByHref(href);
      if (link) this.expandUntil(link, options);
      return this;
    }

    filterTree(query, options = {}) {
      const settings = { ...FILTER_DEFAULTS, ...options };
      const rawTerm = String(query || '').trim();
      const term = settings.caseSensitive ? rawTerm : rawTerm.toLowerCase();

      this.lastFilterOptions = settings;
      this.clearFilter(settings);

      if (term.length < settings.minLength) {
        return {
          hasQuery: false,
          matches: []
        };
      }

      const items = toArray(settings.itemSelector, this.root);
      const matchedItems = new Set();
      const visibleItems = new Set();
      const ancestorItems = new Set();
      const descendantItems = new Set();

      items.forEach((item) => {
        const rawText = this.getFilterText(item, settings);
        const text = settings.caseSensitive ? rawText : rawText.toLowerCase();

        if (!text.includes(term)) {
          return;
        }

        matchedItems.add(item);
        visibleItems.add(item);

        this.getAncestorFilterItems(item, settings).forEach((ancestor) => {
          ancestorItems.add(ancestor);
          visibleItems.add(ancestor);
        });

        if (settings.includeDescendants) {
          this.getDescendantFilterItems(item, settings).forEach((descendant) => {
            descendantItems.add(descendant);
            visibleItems.add(descendant);
          });
        }
      });

      items.forEach((item) => {
        const isVisible = visibleItems.has(item);

        item.hidden = !isVisible;
        item.classList.toggle(settings.hiddenClass, !isVisible);
        item.classList.toggle(settings.matchClass, matchedItems.has(item));
        item.classList.toggle(settings.ancestorClass, ancestorItems.has(item));
        item.classList.toggle(settings.descendantClass, descendantItems.has(item));
      });

      if (settings.highlight) {
        matchedItems.forEach((item) => this.highlightFilterItem(item, rawTerm, settings));
      }

      if (settings.autoExpand) {
        if (settings.closeBeforeExpand) {
          this.closeAll();
        }

        matchedItems.forEach((item) => {
          this.expandUntil(item, { silent: true });
        });
      }

      return {
        hasQuery: true,
        matches: Array.from(matchedItems)
      };
    }

    clearFilter(options = {}) {
      const settings = { ...FILTER_DEFAULTS, ...options };
      const items = toArray(settings.itemSelector, this.root);

      items.forEach((item) => {
        item.hidden = false;
        item.classList.remove(
          settings.hiddenClass,
          settings.matchClass,
          settings.ancestorClass,
          settings.descendantClass
        );
      });

      this.clearFilterHighlights(settings);

      return this;
    }

    getFilterText(item, settings) {
      const textSource = item.querySelector(settings.textSelector) || item;
      return textSource.textContent || '';
    }

    getAncestorFilterItems(item, settings) {
      const ancestors = [];
      let current = item.parentElement;

      while (current && current !== this.root && current !== document.body) {
        if (current.matches?.(settings.itemSelector)) {
          ancestors.push(current);
        }

        current = current.parentElement;
      }

      return ancestors;
    }

    getDescendantFilterItems(item, settings) {
      return toArray(settings.itemSelector, item).filter((candidate) => candidate !== item);
    }

    highlightFilterItem(item, term, settings) {
      const source = item.querySelector(settings.textSelector) || item;
      const normalizedTerm = String(term || '').trim();

      if (!source || !normalizedTerm) {
        return;
      }

      if (!source.dataset.tinyCollapsibleOriginalText) {
        source.dataset.tinyCollapsibleOriginalText = source.textContent || '';
      }

      const original = source.dataset.tinyCollapsibleOriginalText;
      const haystack = settings.caseSensitive ? original : original.toLowerCase();
      const needle = settings.caseSensitive ? normalizedTerm : normalizedTerm.toLowerCase();
      const index = haystack.indexOf(needle);

      if (index === -1) {
        return;
      }

      const before = original.slice(0, index);
      const match = original.slice(index, index + normalizedTerm.length);
      const after = original.slice(index + normalizedTerm.length);
      const mark = document.createElement('mark');

      mark.className = settings.highlightClass;
      mark.textContent = match;

      source.textContent = '';
      source.append(
        document.createTextNode(before),
        mark,
        document.createTextNode(after)
      );
    }

    clearFilterHighlights() {
      this.root.querySelectorAll('[data-tiny-collapsible-original-text]').forEach((element) => {
        element.textContent = element.dataset.tinyCollapsibleOriginalText;
        delete element.dataset.tinyCollapsibleOriginalText;
      });

      return this;
    }

    setActiveLink(linkOrSelector, options = {}) {
      const link = toElement(linkOrSelector, this.root);
      if (!link) return this;

      this.root.querySelectorAll(this.options.activeLinkSelector).forEach((active) => {
        active.classList.remove('active');
        active.removeAttribute('aria-current');
      });

      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      this.expandUntil(link, options);
      return this;
    }
  }

  window.TinyCollapsible = TinyCollapsible;
  window.TinyCollapsibleMenu = TinyCollapsibleMenu;
})();
