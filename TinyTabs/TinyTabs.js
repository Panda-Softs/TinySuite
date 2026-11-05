(function () {
  'use strict';

  const DEFAULTS = {
    element: null,
    selector: '[data-tiny-tabs]',
    duration: 300,
    onShow: null,
    swipeable: false,
    responsiveThreshold: Infinity,
    activeClass: 'active',
    disabledClass: 'disabled',
    indicatorClass: 'indicator',
    tabsContentClass: 'tabs-content',
    carouselClass: 'carousel',
    carouselSliderClass: 'carousel-slider',
    carouselItemClass: 'carousel-item'
  };

  class TinyTabs {
    constructor(elementOrOptions = {}, maybeOptions = {}) {
      const config = TinyTabs.resolveConstructorArguments(elementOrOptions, maybeOptions);

      this.options = Object.assign({}, DEFAULTS, config.options);
      this.el = config.element || TinyTabs.resolveElement(this.options.element, this.options.selector);

      if (!(this.el instanceof HTMLElement)) {
        throw new TypeError('TinyTabs: a valid HTMLElement or selector is required.');
      }

      this.links = [];
      this.panels = [];
      this.activeLink = null;
      this.activePanel = null;
      this.index = 0;
      this.indicator = null;
      this.wrapper = null;
      this.isSwipeableEnabled = false;

      this.touch = {
        startX: 0,
        currentX: 0,
        isDragging: false
      };

      this.boundHandleClick = this.handleClick.bind(this);
      this.boundHandleResize = this.handleResize.bind(this);
      this.boundHandleKeydown = this.handleKeydown.bind(this);
      this.boundHandleTouchStart = this.handleTouchStart.bind(this);
      this.boundHandleTouchMove = this.handleTouchMove.bind(this);
      this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);

      this.el.TinyTabs = this;
      this.el.classList.add('tiny-tabs');
      this.init();
    }

    static resolveConstructorArguments(elementOrOptions, maybeOptions) {
      if (elementOrOptions instanceof HTMLElement || typeof elementOrOptions === 'string') {
        return {
          element: TinyTabs.resolveElement(elementOrOptions),
          options: maybeOptions || {}
        };
      }

      if (elementOrOptions && typeof elementOrOptions === 'object') {
        return {
          element: TinyTabs.resolveElement(elementOrOptions.element, elementOrOptions.selector),
          options: elementOrOptions
        };
      }

      return {
        element: null,
        options: {}
      };
    }

    static resolveElement(element, fallbackSelector) {
      if (element instanceof HTMLElement) {
        return element;
      }

      if (typeof element === 'string') {
        return document.querySelector(element);
      }

      if (typeof fallbackSelector === 'string') {
        return document.querySelector(fallbackSelector);
      }

      return null;
    }

    static init(elements, options = {}) {
      return TinyTabs.toElements(elements).map((element) => new TinyTabs(element, options));
    }

    static getInstance(element) {
      return element instanceof HTMLElement ? element.TinyTabs : null;
    }

    static toElements(elements) {
      if (elements instanceof HTMLElement) {
        return [elements];
      }

      if (typeof elements === 'string') {
        return Array.from(document.querySelectorAll(elements));
      }

      if (elements instanceof NodeList || Array.isArray(elements)) {
        return Array.from(elements).filter((element) => element instanceof HTMLElement);
      }

      return [];
    }

    init() {
      this.collectLinksAndPanels();
      this.setupInitialActiveTab();
      this.setupPanels();
      this.createIndicator();
      this.bindEvents();
      this.updateTabIndicator();
      this.updateAria();
    }

    collectLinksAndPanels() {
      this.links = Array.from(this.el.querySelectorAll(':scope > li.tab > a'));
      this.panels = this.links.map((link) => this.getPanelFromLink(link)).filter(Boolean);
    }

    setupInitialActiveTab() {
      const hashLink = this.findLinkByHash(window.location.hash);
      const activeLink = this.links.find((link) => link.classList.contains(this.options.activeClass));
      const firstLink = this.links[0];

      this.activeLink = hashLink || activeLink || firstLink || null;

      if (!this.activeLink) {
        return;
      }

      this.index = Math.max(this.links.indexOf(this.activeLink), 0);
      this.activePanel = this.getPanelFromLink(this.activeLink);

      this.links.forEach((link) => {
        link.classList.toggle(this.options.activeClass, link === this.activeLink);
      });

      if (this.activePanel) {
        this.activePanel.classList.add(this.options.activeClass);
      }
    }

    setupPanels() {
      this.isSwipeableEnabled = this.shouldUseSwipeable();

      if (this.isSwipeableEnabled) {
        this.setupSwipeablePanels();
      } else {
        this.setupNormalPanels();
      }
    }

    /**
     * Sets up regular non-swipeable tab panels.
     *
     * Missing panels are allowed. In that case, TinyTabs still controls the
     * active tab link and indicator, but skips content visibility changes.
     *
     * @returns {void}
     */
    setupNormalPanels() {
      this.panels.forEach((panel) => {
        const isActive = panel === this.activePanel;

        panel.style.display = isActive ? 'block' : 'none';
        panel.classList.toggle(this.options.activeClass, isActive);
      });
    }

    setupSwipeablePanels() {
      if (!this.panels.length) {
        return;
      }

      const wrapper = document.createElement('div');

      wrapper.classList.add(
        this.options.tabsContentClass,
        this.options.carouselClass,
        this.options.carouselSliderClass
      );

      this.panels[0].parentNode.insertBefore(wrapper, this.panels[0]);

      this.panels.forEach((panel) => {
        panel.classList.add(this.options.carouselItemClass);
        panel.style.display = '';
        wrapper.appendChild(panel);
      });

      this.wrapper = wrapper;
      this.updateSwipePosition(false);
      this.bindSwipeEvents();
    }

    createIndicator() {
      const existingIndicator = this.el.querySelector(`:scope > .${this.options.indicatorClass}`);

      if (existingIndicator) {
        existingIndicator.remove();
      }

      this.indicator = document.createElement('li');
      this.indicator.className = this.options.indicatorClass;
      this.indicator.setAttribute('aria-hidden', 'true');
      this.el.appendChild(this.indicator);
    }

    bindEvents() {
      this.el.addEventListener('click', this.boundHandleClick);
      this.el.addEventListener('keydown', this.boundHandleKeydown);
      window.addEventListener('resize', this.boundHandleResize);
    }

    unbindEvents() {
      this.el.removeEventListener('click', this.boundHandleClick);
      this.el.removeEventListener('keydown', this.boundHandleKeydown);
      window.removeEventListener('resize', this.boundHandleResize);
      this.unbindSwipeEvents();
    }

    bindSwipeEvents() {
      if (!this.wrapper) {
        return;
      }

      this.wrapper.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
      this.wrapper.addEventListener('touchmove', this.boundHandleTouchMove, { passive: true });
      this.wrapper.addEventListener('touchend', this.boundHandleTouchEnd);
    }

    unbindSwipeEvents() {
      if (!this.wrapper) {
        return;
      }

      this.wrapper.removeEventListener('touchstart', this.boundHandleTouchStart);
      this.wrapper.removeEventListener('touchmove', this.boundHandleTouchMove);
      this.wrapper.removeEventListener('touchend', this.boundHandleTouchEnd);
    }

    handleClick(event) {
      const link = event.target.closest('a');

      if (!link || !this.el.contains(link) || !this.links.includes(link)) {
        return;
      }

      const tab = link.closest('li.tab');

      if (!tab || tab.classList.contains(this.options.disabledClass)) {
        event.preventDefault();
        return;
      }

      if (link.target) {
        return;
      }

      event.preventDefault();
      this.activateLink(link);
    }

    handleKeydown(event) {
      const currentIndex = this.links.indexOf(document.activeElement);

      if (currentIndex === -1) {
        return;
      }

      const enabledLinks = this.links.filter((link) => {
        const tab = link.closest('li.tab');
        return tab && !tab.classList.contains(this.options.disabledClass);
      });

      const enabledIndex = enabledLinks.indexOf(document.activeElement);

      if (enabledIndex === -1) {
        return;
      }

      let nextLink = null;

      if (event.key === 'ArrowRight') {
        nextLink = enabledLinks[(enabledIndex + 1) % enabledLinks.length];
      } else if (event.key === 'ArrowLeft') {
        nextLink = enabledLinks[(enabledIndex - 1 + enabledLinks.length) % enabledLinks.length];
      } else if (event.key === 'Home') {
        nextLink = enabledLinks[0];
      } else if (event.key === 'End') {
        nextLink = enabledLinks[enabledLinks.length - 1];
      }

      if (!nextLink) {
        return;
      }

      event.preventDefault();
      nextLink.focus();
      this.activateLink(nextLink);
    }

    handleResize() {
      const shouldUseSwipeable = this.shouldUseSwipeable();

      if (shouldUseSwipeable !== this.isSwipeableEnabled) {
        this.rebuildPanelMode();
      }

      this.updateTabIndicator();
    }

    handleTouchStart(event) {
      if (!event.touches.length) {
        return;
      }

      this.touch.startX = event.touches[0].clientX;
      this.touch.currentX = this.touch.startX;
      this.touch.isDragging = true;
    }

    handleTouchMove(event) {
      if (!this.touch.isDragging || !event.touches.length) {
        return;
      }

      this.touch.currentX = event.touches[0].clientX;
    }

    handleTouchEnd() {
      if (!this.touch.isDragging) {
        return;
      }

      const deltaX = this.touch.currentX - this.touch.startX;
      const threshold = 50;

      this.touch.isDragging = false;

      if (Math.abs(deltaX) < threshold) {
        return;
      }

      this.activateByIndex(deltaX < 0 ? this.index + 1 : this.index - 1);
    }

    activateByIndex(nextIndex) {
      const clampedIndex = Math.max(0, Math.min(nextIndex, this.links.length - 1));
      const link = this.links[clampedIndex];

      if (link) {
        this.activateLink(link);
      }
    }

    /**
     * Activates a tab link.
     *
     * A linked panel is optional. This intentionally matches the original
     * Materialize Tabs behavior: tabs may be used as a navigation-only UI
     * where the indicator and active state still update even if no panel
     * exists for the selected link.
     *
     * @param {HTMLAnchorElement} link
     * @returns {void}
     */
    activateLink(link) {
      if (!this.links.includes(link)) {
        return;
      }

      const tab = link.closest('li.tab');

      if (tab && tab.classList.contains(this.options.disabledClass)) {
        return;
      }

      const previousIndex = this.index;
      const previousPanel = this.activePanel;
      const nextPanel = this.getPanelFromLink(link);

      this.activeLink = link;
      this.activePanel = nextPanel || null;
      this.index = this.links.indexOf(link);

      this.links.forEach((item) => {
        item.classList.toggle(this.options.activeClass, item === link);
      });

      if (this.isSwipeableEnabled && nextPanel) {
        this.updateSwipePosition(true);
      } else if (nextPanel) {
        this.showNormalPanel(nextPanel, previousPanel);
      } else if (previousPanel) {
        previousPanel.classList.remove(this.options.activeClass);
        previousPanel.style.display = 'none';
      }

      this.updateAria();
      this.animateIndicator(previousIndex);

      if (nextPanel) {
        this.callOnShow(nextPanel);
      }
    }

    showNormalPanel(nextPanel, previousPanel) {
      if (previousPanel && previousPanel !== nextPanel) {
        previousPanel.style.display = 'none';
        previousPanel.classList.remove(this.options.activeClass);
      }

      nextPanel.style.display = 'block';
      nextPanel.classList.add(this.options.activeClass);
    }

    updateSwipePosition(shouldAnimate) {
      if (!this.wrapper) {
        return;
      }

      this.wrapper.style.transitionDuration = shouldAnimate ? `${this.options.duration}ms` : '0ms';
      this.wrapper.style.transform = `translateX(${-this.index * 100}%)`;

      this.panels.forEach((panel, panelIndex) => {
        panel.classList.toggle(this.options.activeClass, panelIndex === this.index);
      });
    }

    updateTabIndicator() {
      if (!this.indicator || !this.activeLink) {
        return;
      }

      const tabsRect = this.el.getBoundingClientRect();
      const linkRect = this.activeLink.getBoundingClientRect();
      const left = linkRect.left - tabsRect.left + this.el.scrollLeft;
      const width = linkRect.width;

      this.indicator.style.transitionDuration = `${this.options.duration}ms`;
      this.indicator.style.left = `${Math.floor(left)}px`;
      this.indicator.style.width = `${Math.ceil(width)}px`;
    }

    animateIndicator() {
      this.updateTabIndicator();
    }

    select(tabId) {
      const normalizedId = String(tabId).replace(/^#/, '');
      const link = this.links.find((item) => item.getAttribute('href') === `#${normalizedId}`);

      if (link) {
        this.activateLink(link);
      }
    }

    rebuildPanelMode() {
      this.teardownPanelsOnly();
      this.collectLinksAndPanels();
      this.setupPanels();
      this.updateAria();
    }

    teardownPanelsOnly() {
      this.unbindSwipeEvents();

      if (this.wrapper) {
        this.panels.forEach((panel) => {
          panel.classList.remove(this.options.carouselItemClass);
          panel.style.display = '';
          this.wrapper.parentNode.insertBefore(panel, this.wrapper);
        });

        this.wrapper.remove();
        this.wrapper = null;
      }

      this.panels.forEach((panel) => {
        panel.style.display = '';
        panel.classList.remove(this.options.activeClass);
      });
    }

    destroy() {
      this.unbindEvents();

      if (this.indicator) {
        this.indicator.remove();
      }

      this.teardownPanelsOnly();

      this.links.forEach((link) => {
        link.removeAttribute('role');
        link.removeAttribute('aria-selected');
        link.removeAttribute('aria-controls');
        link.removeAttribute('tabindex');
        link.removeAttribute('aria-disabled');
      });

      this.panels.forEach((panel) => {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-hidden');
      });

      this.el.removeAttribute('role');
      this.el.TinyTabs = null;
    }

    shouldUseSwipeable() {
      return Boolean(this.options.swipeable && window.innerWidth <= this.options.responsiveThreshold);
    }

    getPanelFromLink(link) {
      const href = link.getAttribute('href');

      if (!href || !href.startsWith('#') || href.length <= 1) {
        return null;
      }

      return document.getElementById(href.slice(1));
    }

    findLinkByHash(hash) {
      if (!hash) {
        return null;
      }

      return this.links.find((link) => link.getAttribute('href') === hash) || null;
    }

    /**
     * Updates accessibility attributes for tab links and panels.
     *
     * Links without matching panels are still treated as selectable tabs,
     * but they do not receive aria-controls.
     *
     * @returns {void}
     */
    updateAria() {
      this.el.setAttribute('role', 'tablist');

      this.links.forEach((link) => {
        const panel = this.getPanelFromLink(link);
        const isActive = link === this.activeLink;
        const tab = link.closest('li.tab');
        const isDisabled = tab && tab.classList.contains(this.options.disabledClass);

        link.setAttribute('role', 'tab');
        link.setAttribute('aria-selected', String(isActive));
        link.setAttribute('tabindex', isActive ? '0' : '-1');

        if (panel) {
          link.setAttribute('aria-controls', panel.id);
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-hidden', String(!isActive));
        } else {
          link.removeAttribute('aria-controls');
        }

        if (isDisabled) {
          link.setAttribute('aria-disabled', 'true');
        } else {
          link.removeAttribute('aria-disabled');
        }
      });
    }

    callOnShow(panel) {
      if (typeof this.options.onShow === 'function') {
        this.options.onShow.call(this, panel, this);
      }
    }
  }

  window.TinyTabs = TinyTabs;
})();
