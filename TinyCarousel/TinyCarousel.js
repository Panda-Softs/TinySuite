/**
 * TinyCarousel
 * Dependency-free carousel component.
 *
 * Supports:
 * - legacy Materialize-like 3D mode
 * - full-width / track layout
 * - perPage / perMove
 * - arrows, dots, progress bar
 */
class TinyCarousel {
  static defaults = {
    duration: 200,
    dist: -100,
    shift: 0,
    padding: 0,
    gap: 0,
    numVisible: 5,
    perPage: 1,
    perMove: 1,
    fullWidth: false,
    indicators: false,
    indicatorsPosition: 'bottom',
    arrows: false,
    progressBar: false,
    noWrap: false,
    onCycleTo: null
  };

  static init(target, options = {}) {
    if (target instanceof Element) return new TinyCarousel(target, options);
    if (target instanceof NodeList || Array.isArray(target)) return Array.from(target).map((el) => new TinyCarousel(el, options));
    throw new TypeError('TinyCarousel.init expected an Element, NodeList, or Array.');
  }

  static getInstance(element) {
    return element?.tinyCarousel || null;
  }

  constructor(element, options = {}) {
    if (!(element instanceof HTMLElement)) throw new TypeError('TinyCarousel requires a valid HTMLElement.');
    if (element.tinyCarousel) element.tinyCarousel.destroy();

    this.element = element;
    this.options = { ...TinyCarousel.defaults, ...options };
    this.normalizeOptions();

    this.items = Array.from(this.element.querySelectorAll('.carousel-item, .tiny-carousel__item'));
    if (!this.items.length) throw new Error('TinyCarousel requires at least one carousel item.');

    this.count = this.items.length;
    this.hasMultipleSlides = this.count > 1;
    this.showIndicators = Boolean(this.options.indicators && !this.options.progressBar && this.hasMultipleSlides);
    this.showProgressBar = Boolean(this.options.progressBar && this.hasMultipleSlides);
    this.noWrap = Boolean(this.options.noWrap || !this.hasMultipleSlides);
    this.options.numVisible = Math.min(this.count, Math.max(1, this.options.numVisible));
    this.options.perPage = Math.min(this.count, this.options.perPage);

    this.pressed = false;
    this.dragged = false;
    this.verticalDragged = false;
    this.offset = 0;
    this.target = 0;
    this.center = 0;
    this.velocity = 0;
    this.amplitude = 0;
    this.frame = 0;
    this.timestamp = 0;
    this.tickerId = null;
    this.scrollTimeoutId = null;
    this.oneTimeCallback = null;
    this.pointerId = null;

    this.bound = {
      pointerDown: this.handlePointerDown.bind(this),
      pointerMove: this.handlePointerMove.bind(this),
      pointerUp: this.handlePointerUp.bind(this),
      click: this.handleClick.bind(this),
      keydown: this.handleKeydown.bind(this),
      indicatorClick: this.handleIndicatorClick.bind(this),
      indicatorKeydown: this.handleIndicatorKeydown.bind(this),
      arrowClick: this.handleArrowClick.bind(this),
      resize: this.throttle(this.handleResize.bind(this), 200),
      track: this.track.bind(this),
      autoScroll: this.autoScroll.bind(this)
    };

    this.element.tinyCarousel = this;
    this.setup();
  }

  normalizeOptions() {
    this.options.perPage = Math.max(1, Math.floor(Number(this.options.perPage) || 1));
    this.options.perMove = Math.max(1, Math.floor(Number(this.options.perMove) || 1));
    this.options.indicatorsPosition = ['top', 'bottom', 'left', 'right'].includes(this.options.indicatorsPosition)
      ? this.options.indicatorsPosition
      : 'bottom';

    this.visualPadding = typeof this.options.padding === 'string' ? this.options.padding.trim() : '0px';
    this.legacyPadding = typeof this.options.padding === 'number' ? this.options.padding : 0;
    this.gap = this.normalizeCssLength(this.options.gap);
    this.usesTrackLayout = this.options.fullWidth || this.options.perPage > 1 || this.visualPadding !== '0px' || this.gap !== '0px';

    if (this.options.progressBar) this.options.indicators = false;
  }

  normalizeCssLength(value) {
    if (typeof value === 'number') return `${value}px`;
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    return '0px';
  }

  parseCssLength(value, basis = this.element.clientWidth || 1) {
    if (typeof value === 'number') return value;
    const text = String(value || '0').trim();
    const numeric = Number.parseFloat(text);
    if (!Number.isFinite(numeric)) return 0;
    if (text.endsWith('rem')) return numeric * Number.parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
    if (text.endsWith('em')) return numeric * Number.parseFloat(getComputedStyle(this.element).fontSize || '16');
    if (text.endsWith('%')) return basis * numeric / 100;
    return numeric;
  }

  setup() {
    this.element.classList.add('tiny-carousel');
    this.element.setAttribute('role', 'region');
    if (!this.element.hasAttribute('aria-label')) this.element.setAttribute('aria-label', 'Carousel');

    if (this.usesTrackLayout) {
      if (this.options.fullWidth) this.options.dist = 0;
      this.element.classList.add('tiny-carousel--full-width', 'tiny-carousel--track-layout');
      this.element.style.setProperty('--tiny-carousel-side-padding', this.visualPadding);
      this.element.style.setProperty('--tiny-carousel-gap', this.gap);
    }

    this.items.forEach((item, index) => {
      item.classList.add('tiny-carousel__item');
      item.setAttribute('aria-roledescription', 'slide');
      item.setAttribute('aria-label', `${index + 1} of ${this.count}`);
      item.setAttribute('tabindex', index === 0 ? '0' : '-1');
      if (index === 0) item.classList.add('active', 'tiny-carousel__item--active');
    });

    this.measure();

    if (this.usesTrackLayout) {
      this.setCarouselHeight();
      if (this.showIndicators) {
        this.element.querySelectorAll('.carousel-fixed-item, .tiny-carousel__fixed-item').forEach((item) => {
          item.classList.add('with-indicators', 'tiny-carousel__fixed-item--with-indicators');
        });
      }
    }

    if (this.showIndicators) this.createIndicators();
    if (this.showProgressBar) this.createProgressBar();
    if (this.options.arrows && this.hasMultipleSlides) this.createArrows();

    this.addEventListeners();
    this.scroll(this.offset);
  }

  destroy() {
    this.removeEventListeners();
    this.indicatorsElement?.remove();
    this.progressElement?.remove();
    this.arrowsElement?.remove();

    this.items.forEach((item) => {
      item.style.transform = '';
      item.style.zIndex = '';
      item.style.opacity = '';
      item.style.visibility = '';
      item.style.pointerEvents = '';
      item.style.width = '';
      item.classList.remove('tiny-carousel__item', 'active', 'tiny-carousel__item--active');
      item.removeAttribute('aria-roledescription');
      item.removeAttribute('aria-label');
      item.removeAttribute('tabindex');
    });

    this.element.classList.remove(
      'tiny-carousel', 'tiny-carousel--full-width', 'tiny-carousel--track-layout',
      'tiny-carousel--scrolling', 'scrolling',
      'tiny-carousel--indicators-top', 'tiny-carousel--indicators-bottom',
      'tiny-carousel--indicators-left', 'tiny-carousel--indicators-right'
    );
    this.element.style.removeProperty('--tiny-carousel-side-padding');
    this.element.style.removeProperty('--tiny-carousel-gap');
    this.element.removeAttribute('role');
    this.element.tinyCarousel = null;
  }

  addEventListeners() {
    this.element.addEventListener('pointerdown', this.bound.pointerDown);
    this.element.addEventListener('pointermove', this.bound.pointerMove);
    this.element.addEventListener('pointerup', this.bound.pointerUp);
    this.element.addEventListener('pointercancel', this.bound.pointerUp);
    this.element.addEventListener('lostpointercapture', this.bound.pointerUp);
    this.element.addEventListener('click', this.bound.click);
    this.element.addEventListener('keydown', this.bound.keydown);
    this.indicatorsElement?.addEventListener('click', this.bound.indicatorClick);
    this.indicatorsElement?.addEventListener('keydown', this.bound.indicatorKeydown);
    this.arrowsElement?.addEventListener('click', this.bound.arrowClick);
    window.addEventListener('resize', this.bound.resize);
  }

  removeEventListeners() {
    this.element.removeEventListener('pointerdown', this.bound.pointerDown);
    this.element.removeEventListener('pointermove', this.bound.pointerMove);
    this.element.removeEventListener('pointerup', this.bound.pointerUp);
    this.element.removeEventListener('pointercancel', this.bound.pointerUp);
    this.element.removeEventListener('lostpointercapture', this.bound.pointerUp);
    this.element.removeEventListener('click', this.bound.click);
    this.element.removeEventListener('keydown', this.bound.keydown);
    this.indicatorsElement?.removeEventListener('click', this.bound.indicatorClick);
    this.indicatorsElement?.removeEventListener('keydown', this.bound.indicatorKeydown);
    this.arrowsElement?.removeEventListener('click', this.bound.arrowClick);
    window.removeEventListener('resize', this.bound.resize);
    window.clearInterval(this.tickerId);
    window.clearTimeout(this.scrollTimeoutId);
  }

  measure() {
    const firstItem = this.items[0];
    const containerWidth = this.element.clientWidth || 1;
    const sidePadding = this.parseCssLength(this.visualPadding, containerWidth);
    const gap = this.parseCssLength(this.gap, containerWidth);
    const visibleWidth = Math.max(1, containerWidth - sidePadding * 2);

    this.sidePaddingPx = sidePadding;
    this.gapPx = gap;

    if (this.usesTrackLayout) {
      this.itemWidth = Math.max(1, (visibleWidth - gap * (this.options.perPage - 1)) / this.options.perPage);
      this.itemHeight = firstItem.offsetHeight || 1;
      this.dim = this.itemWidth + gap;
      this.items.forEach((item) => { item.style.width = `${this.itemWidth}px`; });
      return;
    }

    this.itemWidth = firstItem.offsetWidth || 1;
    this.itemHeight = firstItem.offsetHeight || 1;
    this.dim = this.itemWidth * 2 + this.legacyPadding || 1;
  }

  createIndicators() {
    this.indicatorsElement = document.createElement('ul');
    this.indicatorsElement.className = `tiny-carousel__indicators tiny-carousel__indicators--${this.options.indicatorsPosition} indicators`;
    this.element.classList.add(`tiny-carousel--indicators-${this.options.indicatorsPosition}`);
    this.indicatorsElement.setAttribute('aria-label', 'Carousel slides');

    this.indicatorItems = this.items.map((_, index) => {
      const indicator = document.createElement('li');
      indicator.className = 'tiny-carousel__indicator indicator-item';
      indicator.setAttribute('role', 'button');
      indicator.setAttribute('tabindex', '0');
      indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
      if (index === 0) {
        indicator.classList.add('tiny-carousel__indicator--active', 'active');
        indicator.setAttribute('aria-current', 'true');
      }
      this.indicatorsElement.append(indicator);
      return indicator;
    });

    this.element.append(this.indicatorsElement);
  }

  createProgressBar() {
    this.progressElement = document.createElement('div');
    this.progressElement.className = 'tiny-carousel__progress splide__progress';
    this.progressElement.setAttribute('aria-hidden', 'true');
    this.progressSlideElement = document.createElement('div');
    this.progressSlideElement.className = 'tiny-carousel__progress-slide splide__progress__slide';
    this.progressElement.append(this.progressSlideElement);
    this.element.append(this.progressElement);
  }

  createArrows() {
    this.arrowsElement = document.createElement('div');
    this.arrowsElement.className = 'tiny-carousel__arrows';
    this.prevButton = this.createArrowButton('prev', 'Previous slide');
    this.nextButton = this.createArrowButton('next', 'Next slide');
    this.arrowsElement.append(this.prevButton, this.nextButton);
    this.element.append(this.arrowsElement);
    this.updateArrows();
  }

  createArrowButton(direction, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tiny-carousel__arrow tiny-carousel__arrow--${direction}`;
    button.dataset.carouselDirection = direction;
    button.setAttribute('aria-label', label);
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false"><path d="m13.5 7.01 13 13m-13 13 13-13"></path></svg>';
    return button;
  }

  handleArrowClick(event) {
    const button = event.target.closest('[data-carousel-direction]');
    if (!button || !this.arrowsElement.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    button.dataset.carouselDirection === 'prev' ? this.prev() : this.next();
  }

  handlePointerDown(event) {
    if (event.target.closest('.tiny-carousel__indicators, .indicators, .tiny-carousel__arrows, .tiny-carousel__progress')) return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target instanceof HTMLImageElement) event.preventDefault();

    this.pointerId = event.pointerId;
    this.element.setPointerCapture?.(event.pointerId);
    this.pressed = true;
    this.dragged = false;
    this.verticalDragged = false;
    this.referenceX = event.clientX;
    this.referenceY = event.clientY;
    this.velocity = 0;
    this.amplitude = 0;
    this.frame = this.offset;
    this.timestamp = Date.now();
    window.clearInterval(this.tickerId);
    this.tickerId = window.setInterval(this.bound.track, 100);
  }

  handlePointerMove(event) {
    if (!this.pressed || event.pointerId !== this.pointerId) return;
    const deltaX = this.referenceX - event.clientX;
    const deltaY = Math.abs(this.referenceY - event.clientY);

    if (deltaY < 30 && !this.verticalDragged) {
      if (Math.abs(deltaX) > 2) {
        this.dragged = true;
        this.referenceX = event.clientX;
        this.scroll(this.offset + deltaX);
      }
    } else if (!this.dragged) {
      this.verticalDragged = true;
    }

    if (this.dragged) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handlePointerUp(event) {
    if (!this.pressed || event.pointerId !== this.pointerId) return;
    this.pressed = false;
    this.pointerId = null;
    window.clearInterval(this.tickerId);

    this.target = this.offset;
    if (Math.abs(this.velocity) > 10) {
      this.amplitude = 0.9 * this.velocity;
      this.target = this.offset + this.amplitude;
    }

    this.target = Math.round(this.target / this.dim) * this.dim;
    if (this.noWrap) {
      const maxIndex = this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1;
      this.target = this.clamp(this.target, 0, this.dim * maxIndex);
    }

    this.amplitude = this.target - this.offset;
    this.timestamp = Date.now();
    requestAnimationFrame(this.bound.autoScroll);

    if (this.dragged) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  handleClick(event) {
    if (this.dragged) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (this.usesTrackLayout) return;

    const clickedItem = event.target.closest('.carousel-item, .tiny-carousel__item');
    if (!clickedItem || !this.element.contains(clickedItem)) return;
    const clickedIndex = this.items.indexOf(clickedItem);
    const diff = this.wrap(this.center) - clickedIndex;
    if (diff !== 0) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.cycleTo(clickedIndex);
  }

  handleKeydown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  handleIndicatorClick(event) {
    const indicator = event.target.closest('.indicator-item, .tiny-carousel__indicator');
    if (!indicator || !this.indicatorsElement.contains(indicator)) return;
    event.preventDefault();
    event.stopPropagation();
    this.setIndicatorTarget(indicator);
  }

  handleIndicatorKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const indicator = event.target.closest('.indicator-item, .tiny-carousel__indicator');
    if (!indicator || !this.indicatorsElement.contains(indicator)) return;
    event.preventDefault();
    this.setIndicatorTarget(indicator);
  }

  setIndicatorTarget(indicator) {
    const index = this.indicatorItems.indexOf(indicator);
    if (index !== -1) this.cycleTo(index);
  }

  handleResize() {
    this.measure();
    if (this.usesTrackLayout) {
      this.offset = this.center * this.dim;
      this.target = this.offset;
      this.setCarouselHeight(true);
    }
    this.scroll(this.offset);
  }

  setCarouselHeight(imageOnly = false) {
    const activeItem = this.items[this.wrap(this.center)] || this.items[0];
    const firstImage = activeItem.querySelector('img');

    if (firstImage) {
      if (firstImage.complete) {
        const height = firstImage.offsetHeight || this.getImageFallbackHeight(firstImage);
        if (height > 0) this.element.style.height = `${height}px`;
        return;
      }
      firstImage.addEventListener('load', () => { this.element.style.height = `${firstImage.offsetHeight}px`; }, { once: true });
      return;
    }

    if (!imageOnly) this.element.style.height = `${activeItem.offsetHeight}px`;
  }

  getImageFallbackHeight(image) {
    if (!image.naturalWidth || !image.naturalHeight) return 0;
    return (this.itemWidth / image.naturalWidth) * image.naturalHeight;
  }

  track() {
    const now = Date.now();
    const elapsed = now - this.timestamp;
    const delta = this.offset - this.frame;
    this.timestamp = now;
    this.frame = this.offset;
    this.velocity = 0.8 * ((1000 * delta) / (1 + elapsed)) + 0.2 * this.velocity;
  }

  autoScroll() {
    if (!this.amplitude) return;
    const elapsed = Date.now() - this.timestamp;
    const delta = this.amplitude * Math.exp(-elapsed / this.options.duration);
    if (Math.abs(delta) > 2) {
      this.scroll(this.target - delta);
      requestAnimationFrame(this.bound.autoScroll);
      return;
    }
    this.scroll(this.target);
  }

  scroll(x = this.offset) {
    const previousCenter = this.center;
    this.markAsScrolling();
    this.offset = typeof x === 'number' ? x : this.offset;
    this.center = Math.floor((this.offset + this.dim / 2) / this.dim);

    if (this.usesTrackLayout) {
      if (this.noWrap) this.center = this.clamp(this.center, 0, this.getMaxStartIndex());
      this.renderTrackItems();
      this.updateIndicators();
      this.updateProgressBar();
      this.updateActiveItem();
      this.updateArrows();
      this.runCycleCallbacks(previousCenter);
      return;
    }

    const delta = this.offset - this.center * this.dim;
    const direction = delta < 0 ? 1 : -1;
    const tween = (-direction * delta * 2) / this.dim;
    const half = this.count >> 1;
    const visibleOpacityStep = 1 / this.options.numVisible;
    const alignment = this.getAlignment();
    const centerOpacity = 1 - visibleOpacityStep * tween;

    this.hideAllItems();
    this.updateIndicators();
    this.updateProgressBar();
    this.updateArrows();

    this.renderItem(this.center, {
      opacity: centerOpacity,
      zIndex: 0,
      transform: this.getCenterTransform(alignment, delta, direction, tween)
    });

    for (let distance = 1; distance <= half; distance += 1) {
      this.renderSideItem({ side: 'right', distance, alignment, delta, direction, tween, visibleOpacityStep });
      this.renderSideItem({ side: 'left', distance, alignment, delta, direction, tween, visibleOpacityStep });
    }

    this.renderItem(this.center, {
      opacity: centerOpacity,
      zIndex: 0,
      transform: this.getCenterTransform(alignment, delta, direction, tween)
    });

    this.updateActiveItem();
    this.runCycleCallbacks(previousCenter);
  }

  renderTrackItems() {
    const rawProgress = this.offset / this.dim;

    // In loop mode the physical offset is allowed to grow forever so that
    // transitions stay continuous. Rendering, however, must be based on a
    // modulo progress value. Otherwise, after enough arrow clicks every slide
    // is translated far outside the viewport and the carousel appears blank.
    const progress = this.noWrap ? rawProgress : this.wrapProgress(rawProgress);
    const activeIndex = this.wrap(this.center);

    this.items.forEach((item, index) => {
      let relativeIndex = index - progress;

      if (!this.noWrap) {
        const halfCount = this.count / 2;

        if (relativeIndex > halfCount) {
          relativeIndex -= this.count;
        } else if (relativeIndex < -halfCount) {
          relativeIndex += this.count;
        }
      }

      const x = this.sidePaddingPx + relativeIndex * this.dim;
      const isVisibleRange = relativeIndex > -1 && relativeIndex < this.options.perPage;

      item.style.transform = `translateX(${x}px) translateZ(0)`;
      item.style.zIndex = String(index === activeIndex ? 1 : 0);
      item.style.opacity = '1';
      item.style.visibility = 'visible';
      item.style.pointerEvents = isVisibleRange ? '' : 'none';
    });
  }

  runCycleCallbacks(previousCenter) {
    const currentItem = this.items[this.wrap(this.center)];
    if (previousCenter !== this.center && typeof this.options.onCycleTo === 'function') {
      this.options.onCycleTo.call(this, currentItem, this.dragged);
    }
    if (typeof this.oneTimeCallback === 'function') {
      this.oneTimeCallback.call(this, currentItem, this.dragged);
      this.oneTimeCallback = null;
    }
  }

  renderSideItem({ side, distance, alignment, delta, direction, tween, visibleOpacityStep }) {
    const isRight = side === 'right';
    const index = isRight ? this.center + distance : this.center - distance;
    if (this.noWrap && (index < 0 || index >= this.count)) return;

    const tweenDirection = isRight ? distance * 2 + tween * direction : distance * 2 - tween * direction;
    const zTranslation = this.options.dist * tweenDirection;
    const opacity = 1 - visibleOpacityStep * tweenDirection;
    const translateX = isRight
      ? this.options.shift + (this.dim * distance - delta) / 2
      : -this.options.shift + (-this.dim * distance - delta) / 2;

    this.renderItem(index, {
      opacity,
      zIndex: -distance,
      transform: `${alignment} translateX(${translateX}px) translateZ(${zTranslation}px)`
    });
  }

  renderItem(index, style) {
    if (this.noWrap && (index < 0 || index >= this.count)) return;
    const item = this.items[this.wrap(index)];
    item.style.transform = style.transform;
    item.style.zIndex = String(style.zIndex);
    item.style.opacity = String(this.clamp(style.opacity, 0, 1));
    item.style.visibility = 'visible';
    item.style.pointerEvents = style.zIndex === 0 ? '' : 'none';
  }

  hideAllItems() {
    this.items.forEach((item) => { item.style.visibility = 'hidden'; });
  }

  updateActiveItem() {
    const activeIndex = this.wrap(this.center);
    this.items.forEach((item, index) => {
      const isActive = index === activeIndex;
      item.classList.toggle('active', isActive);
      item.classList.toggle('tiny-carousel__item--active', isActive);
      item.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  updateIndicators() {
    if (!this.showIndicators || !this.indicatorItems) return;
    const activeIndex = this.wrap(this.center);
    this.indicatorItems.forEach((indicator, index) => {
      const isActive = index === activeIndex;
      indicator.classList.toggle('active', isActive);
      indicator.classList.toggle('tiny-carousel__indicator--active', isActive);
      if (isActive) indicator.setAttribute('aria-current', 'true');
      else indicator.removeAttribute('aria-current');
    });
  }

  updateProgressBar() {
    if (!this.progressSlideElement) return;
    const maxIndex = this.usesTrackLayout && this.noWrap ? this.getMaxStartIndex() : this.count - 1;
    const denominator = Math.max(1, maxIndex);
    const width = ((this.wrap(this.center) || 0) / denominator) * 100;
    this.progressSlideElement.style.width = `${this.clamp(width, 0, 100)}%`;
  }

  updateArrows() {
    if (!this.prevButton || !this.nextButton) return;
    if (!this.noWrap) {
      this.prevButton.disabled = false;
      this.nextButton.disabled = false;
      return;
    }
    const maxIndex = this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1;
    this.prevButton.disabled = this.center <= 0;
    this.nextButton.disabled = this.center >= maxIndex;
  }

  getAlignment() {
    const x = (this.element.clientWidth - this.itemWidth) / 2;
    const y = (this.element.clientHeight - this.itemHeight) / 2;
    return `translateX(${x}px) translateY(${y}px)`;
  }

  getCenterTransform(alignment, delta, direction, tween) {
    return `${alignment} translateX(${-delta / 2}px) translateX(${direction * this.options.shift * tween}px) translateZ(${this.options.dist * tween}px)`;
  }

  cycleTo(index, callback) {
    if (this.noWrap) index = this.clamp(index, 0, this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1);
    let diff = this.wrap(this.center) - index;

    if (!this.noWrap) {
      if (diff < 0 && Math.abs(diff + this.count) < Math.abs(diff)) diff += this.count;
      else if (diff > 0 && Math.abs(diff - this.count) < diff) diff -= this.count;
    }

    this.target = this.dim * Math.round(this.offset / this.dim);
    if (diff < 0) this.target += this.dim * Math.abs(diff);
    else if (diff > 0) this.target -= this.dim * diff;

    if (typeof callback === 'function') this.oneTimeCallback = callback;
    if (this.offset !== this.target) {
      this.amplitude = this.target - this.offset;
      this.timestamp = Date.now();
      requestAnimationFrame(this.bound.autoScroll);
    }
  }

  next(amount = this.options.perMove) {
    const step = Number.isFinite(Number(amount)) ? Number(amount) : this.options.perMove;
    let index = this.center + step;
    const maxIndex = this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1;
    if (index > maxIndex || index < 0) index = this.noWrap ? this.clamp(index, 0, maxIndex) : this.wrap(index);
    this.cycleTo(index);
  }

  prev(amount = this.options.perMove) {
    const step = Number.isFinite(Number(amount)) ? Number(amount) : this.options.perMove;
    let index = this.center - step;
    const maxIndex = this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1;
    if (index > maxIndex || index < 0) index = this.noWrap ? this.clamp(index, 0, maxIndex) : this.wrap(index);
    this.cycleTo(index);
  }

  set(index = 0, callback) {
    let targetIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    const maxIndex = this.usesTrackLayout ? this.getMaxStartIndex() : this.count - 1;
    if (targetIndex > maxIndex || targetIndex < 0) targetIndex = this.noWrap ? this.clamp(targetIndex, 0, maxIndex) : this.wrap(targetIndex);
    this.cycleTo(targetIndex, callback);
  }

  getMaxStartIndex() {
    return Math.max(0, this.count - this.options.perPage);
  }

  markAsScrolling() {
    this.element.classList.add('tiny-carousel--scrolling', 'scrolling');
    window.clearTimeout(this.scrollTimeoutId);
    this.scrollTimeoutId = window.setTimeout(() => {
      this.element.classList.remove('tiny-carousel--scrolling', 'scrolling');
    }, this.options.duration);
  }

  wrap(index) {
    return ((index % this.count) + this.count) % this.count;
  }

  wrapProgress(value) {
    return ((value % this.count) + this.count) % this.count;
  }

  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  throttle(callback, delay) {
    let timeoutId = null;
    let lastRun = 0;
    return (...args) => {
      const now = Date.now();
      const remaining = delay - (now - lastRun);
      window.clearTimeout(timeoutId);
      if (remaining <= 0) {
        lastRun = now;
        callback(...args);
        return;
      }
      timeoutId = window.setTimeout(() => {
        lastRun = Date.now();
        callback(...args);
      }, remaining);
    };
  }
}

window.TinyCarousel = TinyCarousel;
