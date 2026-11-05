/**
 * TinyLightbox 2.0 — standalone image viewer, no runtime dependencies.
 * Source thumbnails are never reparented or modified.
 */
(function (global) {
    'use strict';

    const PATHS = {
        close: 'M18 6 6 18M6 6l12 12', previous: 'm15 18-6-6 6-6', next: 'm9 18 6-6-6-6',
        zoomIn: 'M12 5v14M5 12h14', zoomOut: 'M5 12h14',
        reset: 'M3 11a9 9 0 1 1 2.5 6.3M3 16v-5h5',
        edit: 'm16 4 4 4-11 11-5 1 1-5L16 4zM14 6l4 4'
    };
    const TEXT = {
        dialog: 'Image gallery', close: 'Close viewer', previous: 'Previous image',
        next: 'Next image', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset zoom',
        edit: 'Edit image', loading: 'Loading image…', error: 'Image could not be loaded.'
    };
    const clamp = (n, min, max) => Math.min(max, Math.max(n, min));
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const icon = spec => {
        if (spec instanceof SVGElement && spec.localName === 'svg') {
            const svg = spec.cloneNode(true);
            svg.setAttribute('aria-hidden', 'true');
            return svg;
        }
        const svg = document.createElementNS(SVG_NS, 'svg');
        for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '19', height: '19',
            'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
            'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(key, value);
        const path = document.createElementNS(SVG_NS, 'path');
        // Path data is an SVG attribute, never untrusted markup or innerHTML.
        path.setAttribute('d', String(spec ?? ''));
        svg.append(path);
        return svg;
    };
    const button = (name, title, iconSpec) => {
        const el = document.createElement('button');
        el.type = 'button'; el.className = `tlb-button tlb-${name}`;
        el.dataset.action = name; el.title = title; el.setAttribute('aria-label', title);
        el.append(icon(iconSpec ?? PATHS[name]));
        return el;
    };
    const EFFECTS = new Set(['fade', 'slide', 'zoom', 'none']);
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const validUrl = url => typeof url === 'string' && url.trim() !== '' &&
        !/^(?:javascript|vbscript|data:(?!image\/(?:png|jpeg|gif|webp|avif|svg\+xml);))/i.test(url.trim());

    class TinyLightbox {
        static active = null;

        constructor(targetOrOptions = {}, options = {}) {
            this.root = typeof targetOrOptions === 'string'
                ? document.querySelector(targetOrOptions)
                : targetOrOptions instanceof Element ? targetOrOptions : null;
            if (typeof targetOrOptions === 'string' && !this.root) throw new Error('TinyLightbox: target not found.');
            this.options = {
                images: [], selector: '[data-lightbox]', loop: true, maxZoom: 5,
                mode: 'fullscreen', // 'contained' fits a compact modal, without modifying the historical zoom
                zoomStep: 0.5, wheelZoom: true, doubleClickZoom: true, keyboard: true,
                swipe: true, mouseSwipe: true, swipeThreshold: 65, swipeVelocity: 0.6,
                verticalClose: true, verticalCloseThreshold: 110, closeVelocity: 0.8,
                elasticity: 0.3, closeOnBackdrop: true, preload: true,
                animationDuration: 240, transitionDuration: 200,
                effects: { open: 'zoom', change: 'slide', close: 'fade' },
                captions: true, captionPosition: 'bottom', icons: {},
                onEdit: null, labels: {},
                ...(this.root ? options : targetOrOptions)
            };
            this.labels = { ...TEXT, ...this.options.labels };
            this.images = []; this.index = -1; this.scale = 1;
            this.pan = { x: 0, y: 0 }; this._pointers = new Map();
            this._gesture = null; this._listeners = new Map(); this._loadId = 0;
            this._open = false; this._destroyed = false; this._editing = false;
            this._preloads = []; this._focusBefore = null; this._trigger = null;
            this._bodyOverflow = null;
            this._closing = false; this._closingAnimation = null; this._closingToken = 0;
            this._effectAnimations = new Set(); this._gestureOffset = { x: 0, y: 0 };
            this._lastChange = null;
            this._rootClick = this._rootClick.bind(this);
            this._keyDown = this._keyDown.bind(this);
            this._pointerDown = this._pointerDown.bind(this);
            this._pointerMove = this._pointerMove.bind(this);
            this._pointerUp = this._pointerUp.bind(this);
            this._wheel = this._wheel.bind(this);
            this._resize = this._resize.bind(this);
            this.setImages(this.options.images.length ? this.options.images : this._domImages());
            if (this.root) this.root.addEventListener('click', this._rootClick);
        }

        _domImages() {
            return this.root ? [...this.root.querySelectorAll(this.options.selector)].map((node, i) => ({
                id: node.dataset.lightboxId || String(i),
                src: node.dataset.lightboxSrc || node.getAttribute('href') || node.currentSrc || node.src,
                alt: node.dataset.lightboxAlt || node.querySelector('img')?.alt || '',
                title: node.dataset.lightboxTitle || '',
                description: node.dataset.lightboxDescription || '',
                srcset: node.dataset.lightboxSrcset || '', sizes: node.dataset.lightboxSizes || '',
                captionPosition: node.dataset.lightboxCaptionPosition || '',
                thumbnail: node.matches('img') ? node : node.querySelector('img')
            })) : [];
        }

        _normalize(item, i) {
            if (typeof item === 'string') item = { src: item };
            if (!item || !validUrl(item.src)) throw new TypeError(`TinyLightbox: invalid image ${i}.`);
            return {
                id: String(item.id ?? i), src: item.src.trim(),
                alt: String(item.alt ?? ''), title: String(item.title ?? ''),
                description: String(item.description ?? ''),
                srcset: String(item.srcset ?? ''), sizes: String(item.sizes ?? ''),
                captionPosition: String(item.captionPosition ?? ''),
                zoom: item.zoom !== false,
                thumbnail: item.thumbnail instanceof Element ? item.thumbnail : null
            };
        }

        setImages(items) {
            this._alive();
            if (!Array.isArray(items)) throw new TypeError('TinyLightbox: images must be an array.');
            const images = items.map((item, i) => this._normalize(item, i));
            if (new Set(images.map(i => i.id)).size !== images.length) throw new Error('TinyLightbox: duplicate image ID.');
            const id = this.current?.id;
            this.images = images;
            if (this._open) {
                if (!images.length) this.close();
                else {
                    this.index = Math.max(0, images.findIndex(i => i.id === id));
                    this._display();
                }
            }
            return this;
        }

        /** Insert a validated image at an exact position; existing IDs are immutable. */
        insertSlide(item, at = this.images.length) {
            this._alive();
            if (!Number.isInteger(at) || at < 0 || at > this.images.length) throw new RangeError('Invalid insertion index.');
            const normalized = this._normalize(item, at);
            if (this.images.some(image => image.id === normalized.id)) throw new Error('TinyLightbox: duplicate image ID.');
            const activeId = this.current?.id;
            this.images.splice(at, 0, normalized);
            if (this._open) {
                this.index = Math.max(0, this.images.findIndex(image => image.id === activeId));
                this._display();
            }
            this._emit('insert', normalized);
            return this;
        }
        removeSlide(indexOrId) {
            this._alive();
            const at = typeof indexOrId === 'number' ? indexOrId : this.images.findIndex(image => image.id === String(indexOrId));
            if (!Number.isInteger(at) || at < 0 || at >= this.images.length) return false;
            const [removed] = this.images.splice(at, 1);
            if (this._open) {
                if (!this.images.length) this.close({ animate: false });
                else {
                    this.index = Math.min(this.index - (at < this.index ? 1 : 0), this.images.length - 1);
                    this._display();
                }
            }
            this._emit('remove', removed);
            return true;
        }
        reload() { this._alive(); if (this.root) this.setImages(this._domImages()); return this; }
        get current() { return this.images[this.index] ?? null; }
        get isOpen() { return this._open; }
        _alive() { if (this._destroyed) throw new Error('TinyLightbox: destroyed.'); }

        open(indexOrId = 0, trigger = null) {
            this._alive();
            if (!this.images.length) return false;
            const i = typeof indexOrId === 'number' ? indexOrId : this.images.findIndex(e => e.id === String(indexOrId));
            if (!Number.isInteger(i) || i < 0 || i >= this.images.length) return false;
            if (TinyLightbox.active && TinyLightbox.active !== this) TinyLightbox.active.close({ animate: false });
            if (this._closing) this._finishClose();
            if (this._open) return this.goTo(i);
            this.index = i;
            this._trigger = trigger instanceof Element ? trigger : this.current.thumbnail;
            this._focusBefore = document.activeElement;
            this._emit('beforeOpen', this.current);
            this._mount();
            try { this.dialog.showModal(); }
            catch (error) { this.dialog.remove(); this.dialog = null; throw error; }
            this._bodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            this._open = true; TinyLightbox.active = this;
            this._display(true);
            this.controls.close.focus();
            this._emit('open', this.current);
            this._emit('afterOpen', this.current);
            return true;
        }

        _mount() {
            const dialog = document.createElement('dialog');
            dialog.className = 'tiny-lightbox';
            if (this.options.mode === 'contained') dialog.classList.add('tiny-lightbox--contained'); dialog.setAttribute('aria-label', this.labels.dialog);
            const shell = document.createElement('div'); shell.className = 'tlb-shell';
            const header = document.createElement('header'); header.className = 'tlb-header';
            this.counter = document.createElement('span'); this.counter.className = 'tlb-counter';
            this.title = document.createElement('span'); this.title.className = 'tlb-title';
            const tools = document.createElement('div'); tools.className = 'tlb-tools';
            this.controls = {};
            for (const name of ['zoomOut', 'zoomIn', 'reset', 'edit', 'close']) {
                const control = button(name, this.labels[name], this.options.icons[name]);
                this.controls[name] = control;
                tools.append(control);
            }
            this.controls.edit.hidden = typeof this.options.onEdit !== 'function';
            header.append(this.counter, this.title, tools);
            this.stage = document.createElement('div'); this.stage.className = 'tlb-stage';
            this.image = document.createElement('img'); this.image.className = 'tlb-image'; this.image.draggable = false;
            this.image.alt = ''; this.image.hidden = true;
            this.message = document.createElement('p'); this.message.className = 'tlb-message';
            this.message.setAttribute('role', 'status'); this.message.setAttribute('aria-live', 'polite');
            this.controls.previous = button('previous', this.labels.previous, this.options.icons.previous);
            this.controls.next = button('next', this.labels.next, this.options.icons.next);
            this.stage.append(this.image, this.message, this.controls.previous, this.controls.next);
            this.caption = document.createElement('div'); this.caption.className = 'tlb-caption';
            this.caption.setAttribute('aria-live', 'polite');
            this.stage.append(this.caption);
            const foot = document.createElement('footer'); foot.className = 'tlb-footer';
            foot.textContent = '← → Navigate   ·   + / − Zoom   ·   0 Reset   ·   Esc Close';
            shell.append(header, this.stage, foot); dialog.append(shell);
            document.body.append(dialog); this.dialog = dialog;
            this._onDialogClick = event => {
                const action = event.target.closest('button[data-action]')?.dataset.action;
                if (action && this.dialog?.contains(event.target)) {
                    ({ previous: () => this.previous(), next: () => this.next(),
                        zoomIn: () => this.zoomIn(), zoomOut: () => this.zoomOut(),
                        reset: () => this.resetZoom(), edit: () => this.edit(), close: () => this.close() })[action]?.();
                } else if (this.options.closeOnBackdrop && (event.target === dialog || event.target === this.stage)) this.close();
            };
            this._onDoubleClick = event => {
                if (this.options.doubleClickZoom && this.current?.zoom !== false && event.target === this.image) {
                    this.scale > 1 ? this.resetZoom() : this.zoomTo(2.5, event.clientX, event.clientY);
                }
            };
            this._onCancel = event => { event.preventDefault(); this.close(); };
            dialog.addEventListener('click', this._onDialogClick);
            dialog.addEventListener('keydown', this._keyDown);
            dialog.addEventListener('cancel', this._onCancel);
            this.stage.addEventListener('pointerdown', this._pointerDown);
            this.stage.addEventListener('pointermove', this._pointerMove);
            this.stage.addEventListener('pointerup', this._pointerUp);
            this.stage.addEventListener('pointercancel', this._pointerUp);
            this.stage.addEventListener('wheel', this._wheel, { passive: false });
            this.stage.addEventListener('dblclick', this._onDoubleClick);
            window.addEventListener('resize', this._resize);
        }

        _display(animate = false) {
            if (!this._open || !this.current) return;
            const item = this.current; const request = ++this._loadId;
            this._cancelAnimations();
            this._pointers.clear(); this._gesture = null;
            this._gestureOffset = { x: 0, y: 0 };
            this.scale = 1; this.pan = { x: 0, y: 0 }; this._renderTransform();
            this.image.hidden = true; this.message.textContent = this.labels.loading;
            this.image.onload = () => {
                if (!this._open || request !== this._loadId) return;
                this.image.hidden = false; this.message.textContent = '';
                this._renderTransform();
                if (animate) this._animate();
                else if (this._lastChange) this._animateChange(this._lastChange);
                this._lastChange = null;
                this._preload(); this._emit('load', item);
                if (!animate) this._emit('afterChange', item);
            };
            this.image.onerror = () => {
                if (!this._open || request !== this._loadId) return;
                this._lastChange = null;
                this.image.hidden = true; this.message.textContent = this.labels.error;
                this._emit('imageError', item);
            };
            this.image.alt = item.alt;
            this.image.removeAttribute('srcset'); this.image.removeAttribute('sizes');
            if (item.srcset) this.image.setAttribute('srcset', item.srcset);
            if (item.sizes) this.image.setAttribute('sizes', item.sizes);
            this.image.src = item.src;
            const position = item.captionPosition || this.options.captionPosition;
            this.caption.className = 'tlb-caption tlb-caption--' + (['top','bottom','left','right'].includes(position) ? position : 'bottom');
            this.caption.textContent = this.options.captions ? item.description : '';
            this.caption.hidden = !this.caption.textContent;
            this.counter.textContent = `${this.index + 1} / ${this.images.length}`;
            this.title.textContent = item.title || item.alt;
            const multiple = this.images.length > 1;
            this.controls.previous.hidden = this.controls.next.hidden = !multiple;
            this.controls.previous.disabled = !this.options.loop && this.index === 0;
            this.controls.next.disabled = !this.options.loop && this.index === this.images.length - 1;
            this._renderTransform();
            this._emit('change', item);
        }

        _effect(kind) {
            const effect = this.options.effects?.[kind] ?? 'none';
            return EFFECTS.has(effect) ? effect : 'none';
        }
        _reducedMotion() {
            return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        _animate() {
            const effect = this._effect('open');
            if (effect === 'none' || this._reducedMotion() || !this.image?.animate) return;
            const end = this.image.getBoundingClientRect();
            const from = this._trigger?.isConnected ? this._trigger.getBoundingClientRect() : null;
            let start = { opacity: 0, transform: 'scale(.93)' };
            if (effect === 'slide') start.transform = 'translateX(80px)';
            if (effect === 'fade') start.transform = 'none';
            if (effect === 'zoom' && from?.width && end.width) {
                const dx = from.left + from.width / 2 - end.left - end.width / 2;
                const dy = from.top + from.height / 2 - end.top - end.height / 2;
                const ratio = Math.max(.06, Math.min(from.width / end.width, from.height / end.height));
                start = { opacity: .25, transform: `translate(${dx}px, ${dy}px) scale(${ratio})` };
            }
            this._track(this.image.animate([start, { opacity: 1, transform: 'none' }], {
                duration: this.options.animationDuration, easing: 'cubic-bezier(.2,.8,.2,1)'
            }));
        }
        _track(animation) {
            this._effectAnimations.add(animation);
            animation.finished.catch(() => {}).finally(() => this._effectAnimations.delete(animation));
            return animation;
        }
        _cancelAnimations() {
            for (const animation of this._effectAnimations) animation.cancel();
            this._effectAnimations.clear();
            this.stage?.querySelectorAll('.tlb-ghost').forEach(ghost => ghost.remove());
        }
        _animateChange(change) {
            const effect = this._effect('change');
            if (effect === 'none' || this._reducedMotion() || !this.image?.animate) return;
            const direction = change.direction || 1;
            const shift = `${direction * Math.min(170, this.stage.clientWidth * .3)}px`;
            const before = effect === 'slide' ? `translateX(${shift})` : effect === 'zoom' ? 'scale(.89)' : 'none';
            this._track(this.image.animate([
                { opacity: 0, transform: before }, { opacity: 1, transform: 'none' }
            ], { duration: this.options.transitionDuration, easing: 'cubic-bezier(.2,.8,.2,1)' }));
            if (change.src) {
                const ghost = document.createElement('img');
                ghost.className = 'tlb-ghost';
                ghost.alt = ''; ghost.setAttribute('aria-hidden', 'true');
                ghost.src = change.src;
                this.stage.insertBefore(ghost, this.image);
                const out = effect === 'slide' ? `translateX(-${shift})` : effect === 'zoom' ? 'scale(1.08)' : 'none';
                const animation = this._track(ghost.animate([
                    { opacity: 1, transform: 'none' }, { opacity: 0, transform: out }
                ], { duration: this.options.transitionDuration, easing: 'cubic-bezier(.2,.8,.2,1)' }));
                animation.finished.catch(() => {}).finally(() => ghost.remove());
            }
        }
        _bounce() {
            if (!this.image || !this._open) return;
            const from = this.image.style.transform;
            this._gestureOffset = { x: 0, y: 0 };
            this._renderTransform();
            if (this.image.animate && !this._reducedMotion()) this._track(this.image.animate([
                { transform: from }, { transform: this.image.style.transform }
            ], { duration: this.options.transitionDuration, easing: 'cubic-bezier(.15,.85,.2,1)' }));
            this.dialog.style.removeProperty('--tlb-drag-alpha');
        }
        _preload() {
            this._preloads = [];
            if (!this.options.preload) return;
            for (const offset of [-1, 1]) {
                if (this.images.length <= 1) break;
                const index = (this.index + offset + this.images.length) % this.images.length;
                const img = new Image(); img.src = this.images[index].src;
                this._preloads.push(img);
            }
        }

        _rootClick(event) {
            const el = event.target.closest(this.options.selector);
            if (!el || !this.root.contains(el)) return;
            // A thumbnail's identity must not depend on its src: URLs may be
            // normalized, signed or replaced while the collection remains the same.
            const id = el.dataset.lightboxId;
            const thumbnail = el.matches('img') ? el : el.querySelector('img');
            const src = el.dataset.lightboxSrc || el.getAttribute('href') || el.currentSrc || el.src;
            const absolute = value => {
                try { return new URL(value, document.baseURI).href; }
                catch (_) { return String(value || ''); }
            };
            const i = this.images.findIndex(item =>
                (id && item.id === id) || (thumbnail && item.thumbnail === thumbnail) ||
                (!id && absolute(item.src) === absolute(src)));
            if (i < 0) return;
            event.preventDefault();
            this.open(i, el.matches('img') ? el : el.querySelector('img') || el);
        }

        _keyDown(event) {
            if (!this.options.keyboard || event.altKey || event.ctrlKey || event.metaKey || this._editing) return;
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
            const actions = {
                ArrowLeft: () => this.previous(), ArrowRight: () => this.next(),
                Home: () => this.goTo(0), End: () => this.goTo(this.images.length - 1),
                '+': () => this.zoomIn(), '=': () => this.zoomIn(),
                '-': () => this.zoomOut(), '0': () => this.resetZoom(), Escape: () => this.close()
            };
            if (actions[event.key]) { event.preventDefault(); actions[event.key](); }
        }

        goTo(index) {
            if (!this._open || !Number.isInteger(index) || index < 0 || index >= this.images.length) return false;
            if (index !== this.index) {
                this._emit('beforeChange', { from: this.current, to: this.images[index] });
                this._lastChange = { direction: index > this.index ? 1 : -1, src: this.current?.src };
                this.index = index; this._display();
            }
            return true;
        }
        next() { if (!this.images.length) return false; return this.goTo(this.index + 1 >= this.images.length ? (this.options.loop ? 0 : this.index) : this.index + 1); }
        previous() { if (!this.images.length) return false; return this.goTo(this.index - 1 < 0 ? (this.options.loop ? this.images.length - 1 : this.index) : this.index - 1); }

        zoomTo(value, x, y) {
            if (!this._open || this.image.hidden || this.current?.zoom === false) return;
            const scale = clamp(Number(value) || 1, 1, this.options.maxZoom);
            const rect = this.stage.getBoundingClientRect();
            const px = (x ?? (rect.left + rect.width / 2)) - (rect.left + rect.width / 2);
            const py = (y ?? (rect.top + rect.height / 2)) - (rect.top + rect.height / 2);
            const ratio = scale / this.scale;
            this.pan.x = px - (px - this.pan.x) * ratio;
            this.pan.y = py - (py - this.pan.y) * ratio;
            this.scale = scale; this._limitPan(); this._emit('zoom', { scale });
        }
        zoomIn() { this.zoomTo(this.scale + this.options.zoomStep); }
        zoomOut() { this.zoomTo(this.scale - this.options.zoomStep); }
        resetZoom() { if (this._open) { this.scale = 1; this.pan = { x: 0, y: 0 }; this._renderTransform(); this._emit('zoom', { scale: 1 }); } }
        _limitPan() {
            if (!this.image) return;
            const width = this.image.offsetWidth, height = this.image.offsetHeight;
            const limitX = Math.max(0, (width * this.scale - this.stage.clientWidth) / 2);
            const limitY = Math.max(0, (height * this.scale - this.stage.clientHeight) / 2);
            this.pan.x = clamp(this.pan.x, -limitX, limitX);
            this.pan.y = clamp(this.pan.y, -limitY, limitY);
            if (this.scale === 1) this.pan = { x: 0, y: 0 };
            this._renderTransform();
        }
        _renderTransform() {
            if (!this.image) return;
            this.image.style.transform = `translate3d(${this.pan.x + this._gestureOffset.x}px, ${this.pan.y + this._gestureOffset.y}px, 0) scale(${this.scale})`;
            this.image.classList.toggle('is-zoomed', this.scale > 1);
            const enabled = this.current?.zoom !== false;
            this.controls.zoomIn.disabled = !enabled || this.scale >= this.options.maxZoom;
            this.controls.zoomOut.disabled = this.controls.reset.disabled = !enabled || this.scale <= 1;
        }
        _wheel(event) {
            if (!this.options.wheelZoom || this.current?.zoom === false || event.target !== this.image) return;
            event.preventDefault();
            this.zoomTo(this.scale + (event.deltaY < 0 ? this.options.zoomStep : -this.options.zoomStep), event.clientX, event.clientY);
        }
        _resize() { if (this._open) this._limitPan(); }
        _pointerDown(event) {
            if (event.target !== this.image || (event.pointerType === 'mouse' && event.button !== 0) || this._editing) return;
            this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (this._pointers.size === 1) {
                this._cancelAnimations();
                this._gesture = { type: 'single', origin: { x: event.clientX, y: event.clientY },
                    pan: { ...this.pan }, axis: null, startTime: performance.now(),
                    lastTime: performance.now(), lastX: event.clientX, lastY: event.clientY,
                    vx: 0, vy: 0 };
            } else if (this._pointers.size === 2) {
                const [a, b] = [...this._pointers.values()];
                this._gestureOffset = { x: 0, y: 0 }; this._renderTransform();
                this._gesture = { type: 'pinch', initialDistance: distance(a, b), initialScale: this.scale };
            }
            try { this.image.setPointerCapture(event.pointerId); } catch (_) { /* Optional in synthetic tests. */ }
        }
        _pointerMove(event) {
            if (!this._pointers.has(event.pointerId) || !this._gesture) return;
            this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (this._gesture.type === 'pinch' && this._pointers.size === 2) {
                const [a, b] = [...this._pointers.values()];
                const center = mid(a, b);
                this.zoomTo(this._gesture.initialScale * distance(a, b) / Math.max(1, this._gesture.initialDistance), center.x, center.y);
                return;
            }
            if (this._gesture.type !== 'single' || this._pointers.size !== 1) return;
            const g = this._gesture;
            const dx = event.clientX - g.origin.x, dy = event.clientY - g.origin.y;
            const now = performance.now(), deltaTime = Math.max(1, now - g.lastTime);
            // Keep the last sampled instantaneous velocity for quick flicks.
            g.vx = (event.clientX - g.lastX) / deltaTime;
            g.vy = (event.clientY - g.lastY) / deltaTime;
            g.lastTime = now; g.lastX = event.clientX; g.lastY = event.clientY;
            if (this.scale > 1) {
                this.pan = { x: g.pan.x + dx, y: g.pan.y + dy };
                this._limitPan();
                return;
            }
            if (!g.axis && Math.hypot(dx, dy) > 9) g.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
            const pointerAllowed = event.pointerType !== 'mouse' || this.options.mouseSwipe;
            if (!pointerAllowed) return;
            if (g.axis === 'horizontal' && this.options.swipe && this.images.length > 1) {
                const edge = (!this.options.loop && ((dx > 0 && this.index === 0) || (dx < 0 && this.index === this.images.length - 1)));
                this._gestureOffset.x = edge ? dx * this.options.elasticity : dx;
                this._renderTransform();
            } else if (g.axis === 'vertical' && this.options.verticalClose) {
                this._gestureOffset.y = dy;
                this.dialog.style.setProperty('--tlb-drag-alpha', String(clamp(1 - Math.abs(dy) / this.stage.clientHeight, .3, 1)));
                this._renderTransform();
            }
        }
        _pointerUp(event) {
            if (!this._pointers.has(event.pointerId)) return;
            const g = this._gesture;
            this._pointers.delete(event.pointerId);
            if (event.type === 'pointercancel') {
                if (!this._pointers.size) { this._gesture = null; this._bounce(); }
                return;
            }
            if (this._pointers.size === 1) {
                const [point] = [...this._pointers.values()];
                this._gesture = { type: 'single', origin: point, pan: { ...this.pan }, axis: null,
                    startTime: performance.now(), lastTime: performance.now(), lastX: point.x, lastY: point.y, vx: 0, vy: 0 };
                return;
            }
            this._gesture = null;
            if (!g || g.type !== 'single' || this.scale > 1 || !g.axis) { this._bounce(); return; }
            const dx = event.clientX - g.origin.x, dy = event.clientY - g.origin.y;
            const duration = Math.max(1, performance.now() - g.startTime);
            const vx = Math.max(Math.abs(dx / duration), Math.abs(g.vx));
            const vy = Math.max(Math.abs(dy / duration), Math.abs(g.vy));
            if (g.axis === 'vertical' && this.options.verticalClose &&
                (Math.abs(dy) >= this.options.verticalCloseThreshold || (Math.abs(dy) > 32 && vy >= this.options.closeVelocity))) {
                this._gestureOffset = { x: 0, y: 0 };
                this.close();
                return;
            }
            if (g.axis === 'horizontal' && this.options.swipe &&
                (event.pointerType !== 'mouse' || this.options.mouseSwipe) &&
                (Math.abs(dx) >= this.options.swipeThreshold || (Math.abs(dx) > 24 && vx >= this.options.swipeVelocity))) {
                this._gestureOffset = { x: 0, y: 0 };
                const before = this.index;
                if (dx < 0 ? this.next() : this.previous()) {
                    if (this.index !== before) {
                        this.dialog?.style.removeProperty('--tlb-drag-alpha');
                        this._renderTransform();
                        return;
                    }
                }
            }
            this._bounce();
        }

        async edit() {
            if (!this._open || this._editing || typeof this.options.onEdit !== 'function') return false;
            const image = this.current; this._editing = true;
            this.close({ animate: false }); // external editor can now open its own modal
            try {
                const result = await this.options.onEdit({ ...image }, this);
                if (this._destroyed || !result) return false;
                if (typeof result === 'object' && validUrl(result.src)) {
                    const index = this.images.findIndex(item => item.id === image.id);
                    if (index < 0) return false;
                    this.images[index] = this._normalize({ ...this.images[index], ...result, id: image.id }, index);
                    this._emit('edited', this.images[index]);
                    return true;
                }
                return false;
            } catch (error) { this._emit('error', error); return false; }
            finally { this._editing = false; }
        }

        on(name, fn) {
            if (typeof fn !== 'function') throw new TypeError('TinyLightbox: listener must be a function.');
            if (!this._listeners.has(name)) this._listeners.set(name, new Set());
            this._listeners.get(name).add(fn);
            return () => this.off(name, fn);
        }
        once(name, fn) {
            if (typeof fn !== 'function') throw new TypeError('TinyLightbox: listener must be a function.');
            const unsubscribe = this.on(name, (...args) => { unsubscribe(); fn(...args); });
            return unsubscribe;
        }
        off(name, fn) { this._listeners.get(name)?.delete(fn); return this; }
        _emit(name, detail) {
            for (const fn of [this.options[`on${name[0].toUpperCase()}${name.slice(1)}`], ...(this._listeners.get(name) || [])]) {
                if (typeof fn === 'function') {
                    try { fn(detail, this); } catch (error) { console.error('TinyLightbox callback:', error); }
                }
            }
        }
        close({ animate = true } = {}) {
            if (this._closing) { if (!animate) this._finishClose(); return; }
            if (!this._open) return;
            this._open = false; ++this._loadId; this._closing = true;
            this._emit('beforeClose', this.current);
            this._pointers.clear(); this._gesture = null; this._preloads = [];
            this.image.onload = this.image.onerror = null;
            this._cancelAnimations();
            const effect = this._effect('close');
            if (animate && effect !== 'none' && !this._reducedMotion() && this.dialog.animate) {
                const frames = effect === 'slide' ? [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(35px)' }]
                    : effect === 'zoom' ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.93)' }]
                        : [{ opacity: 1 }, { opacity: 0 }];
                const token = ++this._closingToken;
                this._closingAnimation = this.dialog.animate(frames, {
                    duration: this.options.animationDuration, easing: 'cubic-bezier(.2,.8,.2,1)'
                });
                this._closingAnimation.finished.catch(() => {}).finally(() => {
                    if (token === this._closingToken) this._finishClose();
                });
            } else this._finishClose();
        }
        _finishClose() {
            if (!this._closing) return;
            ++this._closingToken;
            this._closingAnimation?.cancel(); this._closingAnimation = null;
            this._cancelAnimations();
            this.image?.removeAttribute('src');
            window.removeEventListener('resize', this._resize);
            this.dialog?.close(); this.dialog?.remove();
            this.dialog = this.image = this.stage = this.caption = null;
            document.body.style.overflow = this._bodyOverflow;
            this._bodyOverflow = null;
            this._closing = false;
            if (TinyLightbox.active === this) TinyLightbox.active = null;
            const focus = this._focusBefore; this._focusBefore = null;
            if (focus?.isConnected) focus.focus({ preventScroll: true });
            this._emit('close', this.current);
            this._emit('afterClose', this.current);
        }
        destroy() {
            if (this._destroyed) return;
            this.close({ animate: false });
            if (this._closing) this._finishClose();
            this.root?.removeEventListener('click', this._rootClick);
            this._listeners.clear(); this.images = []; this._destroyed = true;
        }
    }
    global.TinyLightbox = TinyLightbox;
})(window);
