/**
 * TinySideNav
 * Dependency-free sidenav component inspired by Materialize Sidenav.
 *
 * Usage:
 *   new TinySideNav('#mobile-nav', { edge: 'left' });
 *   TinySideNav.init('.sidenav', { draggable: true });
 */
(function () {
  'use strict';

  const DEFAULTS = {
    edge: 'left',
    draggable: true,
    inDuration: 250,
    outDuration: 200,
    onOpenStart: null,
    onOpenEnd: null,
    onCloseStart: null,
    onCloseEnd: null,
    preventScrolling: true,
    closeOnClick: false
  };

  const FIXED_BREAKPOINT = 992;
  const BODY_OPEN_CLASS = 'tiny-sidenav-open';
  const DRAG_START_THRESHOLD = 8;

  const easeOutQuad = (t) => t * (2 - t);

  const getElement = (selectorOrElement) => {
    if (selectorOrElement instanceof HTMLElement) {
      return selectorOrElement;
    }

    if (typeof selectorOrElement === 'string') {
      return document.querySelector(selectorOrElement);
    }

    return null;
  };

  const getElements = (selectorOrElements) => {
    if (typeof selectorOrElements === 'string') {
      return Array.from(document.querySelectorAll(selectorOrElements));
    }

    if (selectorOrElements instanceof HTMLElement) {
      return [selectorOrElements];
    }

    if (selectorOrElements instanceof NodeList || selectorOrElements instanceof HTMLCollection) {
      return Array.from(selectorOrElements).filter((el) => el instanceof HTMLElement);
    }

    if (Array.isArray(selectorOrElements)) {
      return selectorOrElements.filter((el) => el instanceof HTMLElement);
    }

    return [];
  };

  const getTriggerTargetId = (trigger) => {
    const dataTarget = trigger.getAttribute('data-target');

    if (dataTarget) {
      return dataTarget.replace(/^#/, '');
    }

    const href = trigger.getAttribute('href');

    if (href && href.startsWith('#')) {
      return href.slice(1);
    }

    return null;
  };

  class TinySideNav {
    static defaults = DEFAULTS;
    static instances = [];
    static documentTriggerHandler = null;

    static init(selector = '.sidenav', options = {}) {
      return getElements(selector).map((element) => {
        return TinySideNav.getInstance(element) || new TinySideNav(element, options);
      });
    }

    static getInstance(selectorOrElement) {
      const element = getElement(selectorOrElement);

      return element ? element.tinySideNav || null : null;
    }

    static setupDocumentTrigger() {
      if (TinySideNav.documentTriggerHandler) {
        return;
      }

      TinySideNav.documentTriggerHandler = (event) => {
        const trigger = event.target.closest('.sidenav-trigger');

        if (!trigger) {
          return;
        }

        const targetId = getTriggerTargetId(trigger);

        if (!targetId) {
          return;
        }

        const sidenavElement = document.getElementById(targetId);
        const instance = TinySideNav.getInstance(sidenavElement);

        if (!instance) {
          return;
        }

        event.preventDefault();
        instance.open(trigger);
      };

      document.body.addEventListener('click', TinySideNav.documentTriggerHandler);
    }

    static teardownDocumentTriggerIfUnused() {
      if (TinySideNav.instances.length > 0 || !TinySideNav.documentTriggerHandler) {
        return;
      }

      document.body.removeEventListener('click', TinySideNav.documentTriggerHandler);
      TinySideNav.documentTriggerHandler = null;
    }

    constructor(selectorOrElement, options = {}) {
      const element = getElement(selectorOrElement);

      if (!element) {
        throw new Error('TinySideNav requires a valid selector or HTMLElement.');
      }

      const existing = TinySideNav.getInstance(element);

      if (existing) {
        return existing;
      }

      this.el = element;
      this.options = {
        ...TinySideNav.defaults,
        ...options
      };

      this.isOpen = false;
      this.isDragged = false;
      this.hasMoved = false;
      this.percentOpen = 0;
      this.pointerId = null;
      this.animationFrames = new Map();
      this.lastWindowWidth = window.innerWidth;
      this.previousBodyOverflow = '';

      this.isFixed =
          this.el.classList.contains('sidenav-fixed') ||
          this.el.classList.contains('tiny-sidenav--fixed');

      this.bound = {
        overlayClick: this.handleOverlayClick.bind(this),
        dragTargetPointerDown: this.handleDragTargetPointerDown.bind(this),
        dragTargetPointerMove: this.handleDragTargetPointerMove.bind(this),
        dragTargetPointerUp: this.handleDragTargetPointerUp.bind(this),
        dragTargetClick: this.handleDragTargetClick.bind(this),
        closePointerDown: this.handleClosePointerDown.bind(this),
        closePointerMove: this.handleClosePointerMove.bind(this),
        closePointerUp: this.handleClosePointerUp.bind(this),
        closeTriggerClick: this.handleCloseTriggerClick.bind(this),
        keydown: this.handleKeydown.bind(this),
        resize: this.handleResize.bind(this)
      };

      this.el.tinySideNav = this;

      this.createOverlay();
      this.createDragTarget();
      this.setupClasses();
      this.setupInitialState();
      this.addEventListeners();

      TinySideNav.instances.push(this);
      TinySideNav.setupDocumentTrigger();
    }

    destroy() {
      this.cancelAnimation();
      this.close(null, { immediate: true, silent: true });
      this.removeEventListeners();
      this.enableBodyScrolling();

      this.overlay.remove();
      this.dragTarget.remove();

      this.el.style.transform = '';
      this.el.classList.remove('tiny-sidenav', 'tiny-sidenav--right', 'right-aligned', 'open');
      this.el.removeAttribute('aria-hidden');
      this.el.tinySideNav = null;

      const index = TinySideNav.instances.indexOf(this);

      if (index !== -1) {
        TinySideNav.instances.splice(index, 1);
      }

      TinySideNav.teardownDocumentTriggerIfUnused();
    }

    createOverlay() {
      this.overlay = document.createElement('div');
      this.overlay.className = 'sidenav-overlay tiny-sidenav__overlay';
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.style.display = 'none';
      this.overlay.style.opacity = '0';
      this.overlay.style.pointerEvents = 'none';

      document.body.append(this.overlay);
    }

    createDragTarget() {
      this.dragTarget = document.createElement('div');
      this.dragTarget.className = 'drag-target tiny-sidenav__drag-target';
      this.dragTarget.setAttribute('aria-hidden', 'true');

      if (this.options.edge === 'right') {
        this.dragTarget.classList.add('right-aligned', 'tiny-sidenav__drag-target--right');
      }

      document.body.append(this.dragTarget);
    }

    setupClasses() {
      this.el.classList.add('tiny-sidenav');
      this.el.setAttribute('aria-hidden', 'true');

      if (this.options.edge === 'right') {
        this.el.classList.add('right-aligned', 'tiny-sidenav--right');
      }
    }

    setupInitialState() {
      if (this.isCurrentlyFixed()) {
        this.open(null, { immediate: true });
        return;
      }

      this.applyClosedTransform();
      this.updateDragTargetState();
    }

    addEventListeners() {
      this.overlay.addEventListener('click', this.bound.overlayClick);

      this.dragTarget.addEventListener('pointerdown', this.bound.dragTargetPointerDown);
      this.dragTarget.addEventListener('pointermove', this.bound.dragTargetPointerMove);
      this.dragTarget.addEventListener('pointerup', this.bound.dragTargetPointerUp);
      this.dragTarget.addEventListener('pointercancel', this.bound.dragTargetPointerUp);
      this.dragTarget.addEventListener('click', this.bound.dragTargetClick);

      this.overlay.addEventListener('pointerdown', this.bound.closePointerDown);
      this.overlay.addEventListener('pointermove', this.bound.closePointerMove);
      this.overlay.addEventListener('pointerup', this.bound.closePointerUp);
      this.overlay.addEventListener('pointercancel', this.bound.closePointerUp);

      this.el.addEventListener('pointerdown', this.bound.closePointerDown);
      this.el.addEventListener('pointermove', this.bound.closePointerMove);
      this.el.addEventListener('pointerup', this.bound.closePointerUp);
      this.el.addEventListener('pointercancel', this.bound.closePointerUp);
      this.el.addEventListener('click', this.bound.closeTriggerClick);

      document.addEventListener('keydown', this.bound.keydown);

      if (this.isFixed) {
        window.addEventListener('resize', this.bound.resize);
      }
    }

    removeEventListeners() {
      this.overlay.removeEventListener('click', this.bound.overlayClick);

      this.dragTarget.removeEventListener('pointerdown', this.bound.dragTargetPointerDown);
      this.dragTarget.removeEventListener('pointermove', this.bound.dragTargetPointerMove);
      this.dragTarget.removeEventListener('pointerup', this.bound.dragTargetPointerUp);
      this.dragTarget.removeEventListener('pointercancel', this.bound.dragTargetPointerUp);
      this.dragTarget.removeEventListener('click', this.bound.dragTargetClick);

      this.overlay.removeEventListener('pointerdown', this.bound.closePointerDown);
      this.overlay.removeEventListener('pointermove', this.bound.closePointerMove);
      this.overlay.removeEventListener('pointerup', this.bound.closePointerUp);
      this.overlay.removeEventListener('pointercancel', this.bound.closePointerUp);

      this.el.removeEventListener('pointerdown', this.bound.closePointerDown);
      this.el.removeEventListener('pointermove', this.bound.closePointerMove);
      this.el.removeEventListener('pointerup', this.bound.closePointerUp);
      this.el.removeEventListener('pointercancel', this.bound.closePointerUp);
      this.el.removeEventListener('click', this.bound.closeTriggerClick);

      document.removeEventListener('keydown', this.bound.keydown);

      if (this.isFixed) {
        window.removeEventListener('resize', this.bound.resize);
      }
    }

    open(trigger = null, meta = {}) {
      if (this.isOpen && !meta.immediate) {
        return;
      }

      this.cancelAnimation();
      this.endDrag();

      this.isOpen = true;
      this.percentOpen = 1;

      this.el.classList.add('open');
      this.el.setAttribute('aria-hidden', 'false');

      this.updateDragTargetState();

      if (!meta.silent && typeof this.options.onOpenStart === 'function') {
        this.options.onOpenStart.call(this, this.el, trigger);
      }

      if (this.isCurrentlyFixed()) {
        this.enableBodyScrolling();
        this.hideOverlay();
        this.setTranslateX(0);
        this.callOpenEnd(meta);
        return;
      }

      if (this.options.preventScrolling) {
        this.preventBodyScrolling();
      }

      this.showOverlay();

      if (meta.immediate) {
        this.setTranslateX(0);
        this.setOverlayOpacity(1);
        this.callOpenEnd(meta);
        return;
      }

      this.animateSidenav(this.getClosedTranslateX(), 0, this.options.inDuration, () => {
        this.callOpenEnd(meta);
      });

      this.animateOverlay(0, 1, this.options.inDuration);
    }

    close(event = null, meta = {}) {
      if (!this.isOpen && !meta.immediate) {
        this.hideOverlay();
        this.endDrag();
        this.updateDragTargetState();
        return;
      }

      this.cancelAnimation();
      this.endDrag();

      this.isOpen = false;
      this.percentOpen = 0;

      this.el.classList.remove('open');
      this.el.setAttribute('aria-hidden', 'true');

      this.updateDragTargetState();

      if (!meta.silent && typeof this.options.onCloseStart === 'function') {
        this.options.onCloseStart.call(this, this.el, event);
      }

      if (this.isCurrentlyFixed()) {
        this.applyClosedTransform();
        this.hideOverlay();
        this.callCloseEnd(meta);
        return;
      }

      this.enableBodyScrolling();

      if (meta.immediate) {
        this.applyClosedTransform();
        this.hideOverlay();
        this.callCloseEnd(meta);
        return;
      }

      this.animateSidenav(0, this.getClosedTranslateX(), this.options.outDuration, () => {
        this.applyClosedTransform();
        this.callCloseEnd(meta);
      });

      this.animateOverlay(1, 0, this.options.outDuration, () => {
        this.hideOverlay();
      });
    }

    handleOverlayClick(event) {
      if (!this.isOpen || this.isCurrentlyFixed()) {
        return;
      }

      event.preventDefault();
      this.close(event);
    }

    handleDragTargetPointerDown(event) {
      if (!this.canOpenDrag(event)) {
        return;
      }

      this.startDrag(event);
      this.dragTarget.setPointerCapture?.(event.pointerId);
    }

    handleDragTargetPointerMove(event) {
      if (!this.isDragged || this.isOpen || event.pointerId !== this.pointerId) {
        return;
      }

      this.updateDrag(event);

      if (this.verticalDragging) {
        return;
      }

      const totalDeltaX = this.getOpeningDeltaX();

      if (totalDeltaX > DRAG_START_THRESHOLD) {
        this.hasMoved = true;
      }

      const translateX =
          this.options.edge === 'right'
              ? this.width - totalDeltaX
              : -this.width + totalDeltaX;

      this.percentOpen = Math.min(1, totalDeltaX / this.width);

      this.showOverlay();
      this.setTranslateX(translateX);
      this.setOverlayOpacity(this.percentOpen);
    }

    handleDragTargetPointerUp(event) {
      if (!this.isDragged || this.isOpen || event.pointerId !== this.pointerId) {
        return;
      }

      const shouldOpen = this.percentOpen > 0.2 || this.velocityX > 0.5;

      this.endDrag();

      if (shouldOpen) {
        this.open();
      } else {
        this.animateOutFromDrag();
      }
    }

    handleDragTargetClick(event) {
      if (this.hasMoved) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      this.forwardDragTargetClick(event);
    }

    forwardDragTargetClick(event) {
      const x = event.clientX;
      const y = event.clientY;

      this.dragTarget.style.pointerEvents = 'none';

      const underlying = document.elementFromPoint(x, y);

      this.dragTarget.style.pointerEvents = this.shouldEnableDragTarget() ? 'auto' : 'none';

      const trigger = underlying?.closest?.('.sidenav-trigger');

      if (!trigger) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const targetId = getTriggerTargetId(trigger);

      if (!targetId) {
        return;
      }

      const sidenavElement = document.getElementById(targetId);
      const instance = TinySideNav.getInstance(sidenavElement);

      if (instance) {
        instance.open(trigger);
      }
    }

    handleClosePointerDown(event) {
      if (!this.canCloseDrag(event)) {
        return;
      }

      this.startDrag(event);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }

    handleClosePointerMove(event) {
      if (!this.isDragged || !this.isOpen || event.pointerId !== this.pointerId) {
        return;
      }

      this.updateDrag(event);

      if (this.verticalDragging) {
        return;
      }

      const totalDeltaX = this.getClosingDeltaX();

      if (totalDeltaX > DRAG_START_THRESHOLD) {
        this.hasMoved = true;
      }

      const translateX =
          this.options.edge === 'right'
              ? totalDeltaX
              : -totalDeltaX;

      this.percentOpen = Math.min(1, 1 - totalDeltaX / this.width);

      this.setTranslateX(translateX);
      this.setOverlayOpacity(this.percentOpen);
    }

    handleClosePointerUp(event) {
      if (!this.isDragged || !this.isOpen || event.pointerId !== this.pointerId) {
        return;
      }

      const shouldRemainOpen = this.percentOpen > 0.8 && this.velocityX < 0.5;

      this.endDrag();

      if (shouldRemainOpen) {
        this.open();
      } else {
        this.close();
      }
    }

    handleCloseTriggerClick(event) {
      const closeTrigger = event.target.closest('.sidenav-close');

      if (closeTrigger && !this.isCurrentlyFixed()) {
        event.preventDefault();
        this.close(event);
        return;
      }

      if (!this.options.closeOnClick || this.isCurrentlyFixed()) {
        return;
      }

      const explicitCloseTrigger = event.target.closest('[data-sidenav-close]');

      if (!explicitCloseTrigger) {
        return;
      }

      event.preventDefault();
      this.close(event);
    }

    handleKeydown(event) {
      if (event.key !== 'Escape' || !this.isOpen || this.isCurrentlyFixed()) {
        return;
      }

      this.close(event);
    }

    handleResize() {
      if (this.lastWindowWidth === window.innerWidth) {
        return;
      }

      if (this.isCurrentlyFixed()) {
        this.open(null, { immediate: true });
      } else {
        this.close(null, { immediate: true });
      }

      this.lastWindowWidth = window.innerWidth;
    }

    canOpenDrag(event) {
      return (
          this.options.draggable &&
          !this.isOpen &&
          !this.isCurrentlyFixed() &&
          event.pointerType !== 'mouse'
      );
    }

    canCloseDrag(event) {
      return (
          this.options.draggable &&
          this.isOpen &&
          !this.isCurrentlyFixed() &&
          event.pointerType !== 'mouse'
      );
    }

    startDrag(event) {
      this.cancelAnimation();

      this.pointerId = event.pointerId;
      this.isDragged = true;
      this.hasMoved = false;
      this.verticalDragging = false;

      this.startingX = event.clientX;
      this.currentX = event.clientX;
      this.startingY = event.clientY;
      this.currentY = event.clientY;

      this.width = this.el.getBoundingClientRect().width || 1;
      this.time = Date.now();
      this.velocityX = 0;
    }

    updateDrag(event) {
      const now = Date.now();
      const elapsed = Math.max(1, now - this.time);

      const deltaX = Math.abs(event.clientX - this.currentX);
      const deltaY = Math.abs(event.clientY - this.startingY);

      if (deltaY > 30 && deltaY > deltaX) {
        this.verticalDragging = true;
        return;
      }

      this.velocityX = deltaX / elapsed;
      this.currentX = event.clientX;
      this.currentY = event.clientY;
      this.time = now;
    }

    endDrag() {
      this.isDragged = false;
      this.pointerId = null;
      this.verticalDragging = false;
    }

    getOpeningDeltaX() {
      const rawDelta = this.currentX - this.startingX;
      const direction = rawDelta > 0 ? 'right' : 'left';

      if (this.options.edge === direction) {
        return 0;
      }

      return Math.min(this.width, Math.abs(rawDelta));
    }

    getClosingDeltaX() {
      const rawDelta = this.currentX - this.startingX;
      const direction = rawDelta > 0 ? 'right' : 'left';

      if (this.options.edge !== direction) {
        return 0;
      }

      return Math.min(this.width, Math.abs(rawDelta));
    }

    animateOutFromDrag() {
      const from =
          this.options.edge === 'right'
              ? this.width * (1 - this.percentOpen)
              : -this.width * (1 - this.percentOpen);

      this.animateSidenav(from, this.getClosedTranslateX(), this.options.outDuration, () => {
        this.applyClosedTransform();
      });

      this.animateOverlay(this.percentOpen, 0, this.options.outDuration, () => {
        this.hideOverlay();
      });
    }

    animateSidenav(from, to, duration, complete) {
      this.animate('sidenav', {
        from,
        to,
        duration,
        update: (value) => this.setTranslateX(value),
        complete
      });
    }

    animateOverlay(from, to, duration, complete) {
      this.animate('overlay', {
        from,
        to,
        duration,
        update: (value) => this.setOverlayOpacity(value),
        complete
      });
    }

    animate(name, { from, to, duration, update, complete }) {
      const startTime = performance.now();
      const change = to - from;

      this.cancelAnimation(name);

      const tick = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1, elapsed / Math.max(1, duration));
        const eased = easeOutQuad(progress);

        update(from + change * eased);

        if (progress < 1) {
          this.animationFrames.set(name, requestAnimationFrame(tick));
          return;
        }

        this.animationFrames.delete(name);
        update(to);
        complete?.();
      };

      this.animationFrames.set(name, requestAnimationFrame(tick));
    }

    cancelAnimation(name = null) {
      if (name) {
        const frame = this.animationFrames.get(name);

        if (frame) {
          cancelAnimationFrame(frame);
          this.animationFrames.delete(name);
        }

        return;
      }

      this.animationFrames.forEach((frame) => cancelAnimationFrame(frame));
      this.animationFrames.clear();
    }

    setTranslateX(px) {
      this.el.style.transform = `translateX(${px}px)`;
    }

    getClosedTranslateX() {
      const width = this.el.getBoundingClientRect().width || 1;

      return this.options.edge === 'right'
          ? width * 1.05
          : width * -1.05;
    }

    applyClosedTransform() {
      this.setTranslateX(this.getClosedTranslateX());
    }

    showOverlay() {
      this.overlay.style.display = 'block';
      this.overlay.style.pointerEvents = 'auto';
      this.overlay.setAttribute('aria-hidden', 'false');
    }

    hideOverlay() {
      this.overlay.style.display = 'none';
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.opacity = '0';
      this.overlay.setAttribute('aria-hidden', 'true');
    }

    setOverlayOpacity(value) {
      this.overlay.style.opacity = String(Math.max(0, Math.min(1, value)));
    }

    updateDragTargetState() {
      if (this.shouldEnableDragTarget()) {
        this.dragTarget.style.display = 'block';
        this.dragTarget.style.pointerEvents = 'auto';
        this.dragTarget.setAttribute('aria-hidden', 'false');
        return;
      }

      this.dragTarget.style.display = 'none';
      this.dragTarget.style.pointerEvents = 'none';
      this.dragTarget.setAttribute('aria-hidden', 'true');
    }

    shouldEnableDragTarget() {
      return (
          this.options.draggable &&
          !this.isOpen &&
          !this.isCurrentlyFixed()
      );
    }

    preventBodyScrolling() {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add(BODY_OPEN_CLASS);
    }

    enableBodyScrolling() {
      document.body.style.overflow = this.previousBodyOverflow || '';
      document.body.classList.remove(BODY_OPEN_CLASS);
    }

    isCurrentlyFixed() {
      return this.isFixed && window.innerWidth > FIXED_BREAKPOINT;
    }

    callOpenEnd(meta) {
      if (!meta.silent && typeof this.options.onOpenEnd === 'function') {
        this.options.onOpenEnd.call(this, this.el);
      }
    }

    callCloseEnd(meta) {
      if (!meta.silent && typeof this.options.onCloseEnd === 'function') {
        this.options.onCloseEnd.call(this, this.el);
      }
    }
  }

  window.TinySideNav = TinySideNav;
})();