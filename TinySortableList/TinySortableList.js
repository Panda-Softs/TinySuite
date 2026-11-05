/**
 * TinySortableList.js
 *
 * Lightweight sortable list component using Pointer Events.
 *
 * Features:
 * - Mouse, touch and pen support through a single Pointer Events implementation.
 * - Dragging starts only from the configured handle.
 * - Uses document.elementFromPoint() to locate the item under the pointer.
 * - Event delegation: items can be added or re-rendered without rebinding listeners.
 * - Reports the complete order and only positions that actually changed.
 * - Optional asynchronous persistence through onEnd with automatic rollback on failure.
 * - Keyboard reordering with ArrowUp / ArrowDown from the drag handle.
 * - No dependency on TinyDataTable, jQuery or external drag libraries.
 */
(function (global) {
    'use strict';

    // Keep every CSS class name in one place so the DOM/CSS contract is easy to maintain.
    const CLASSES = Object.freeze({
        root: 'tiny-sortable-list',
        item: 'tiny-sortable-list-item',
        handle: 'tiny-sortable-list-handle',
        dragging: 'is-dragging',
        sorting: 'is-sorting',
        saving: 'is-saving'
    });

    // Small public API: lifecycle is exposed through callbacks rather than custom DOM events.
    const DEFAULT_OPTIONS = Object.freeze({
        itemSelector: `.${CLASSES.item}`,
        handleSelector: `.${CLASSES.handle}`,
        dragThreshold: 4,
        getId: element => element.dataset.id,
        onStart: null,
        onChange: null,
        onEnd: null,
        onError: null
    });

    class TinySortableList {
        /**
         * @param {String|HTMLElement} target Root list element or selector.
         * @param {Object} options Component configuration.
         */
        constructor(target, options = {}) {
            this.root = typeof target === 'string' ? document.querySelector(target) : target;
            if (!this.root) throw new Error(`TinySortableList: target not found (${target})`);

            this.options = { ...DEFAULT_OPTIONS, ...options };
            this.draggedItem = null;
            this.dragHandle = null;
            this.pointerId = null;
            this.previousOrder = null;
            this.startX = 0;
            this.startY = 0;
            this.dragStarted = false;
            this.saving = false;

            // Pointermove can fire faster than rendering; keep only the latest position per frame.
            this.pointerPosition = null;
            this.moveFrame = null;

            this._onPointerDown = this._onPointerDown.bind(this);
            this._onPointerMove = this._onPointerMove.bind(this);
            this._onPointerEnd = this._onPointerEnd.bind(this);
            this._onKeyDown = this._onKeyDown.bind(this);

            this.root.classList.add(CLASSES.root);
            this._bindEvents();
        }

        /** Return sortable items in their current DOM order. */
        getItems() {
            return [...this.root.querySelectorAll(this.options.itemSelector)];
        }

        /** Return logical IDs in their current DOM order. */
        getOrder() {
            return this.getItems().map(item => this.options.getId(item));
        }

        /**
         * Return only positions that changed between two complete orders.
         * Order values are 1-based so they can be persisted directly.
         */
        getChanges(previousOrder, currentOrder) {
            const previousPositions = new Map(previousOrder.map((id, index) => [id, index]));
            return currentOrder.reduce((changes, id, index) => {
                if (previousPositions.get(id) !== index) changes.push({ id, order: index + 1 });
                return changes;
            }, []);
        }

        /**
         * Apply a complete DOM order.
         * Unknown IDs are ignored and items missing from `order` are preserved at the end.
         */
        setOrder(order) {
            if (!Array.isArray(order)) return this;

            const items = this.getItems();
            const itemsById = new Map(items.map(item => [this.options.getId(item), item]));
            const used = new Set();
            const fragment = document.createDocumentFragment();

            order.forEach(id => {
                const item = itemsById.get(id);
                if (!item) return;
                used.add(id);
                fragment.appendChild(item);
            });

            items.forEach(item => {
                if (!used.has(this.options.getId(item))) fragment.appendChild(item);
            });

            this.root.appendChild(fragment);
            return this;
        }

        /** Remove listeners and transient state. */
        destroy() {
            this._cancelMoveFrame();
            this._releasePointer();
            this._resetDragState();

            this.root.removeEventListener('pointerdown', this._onPointerDown);
            this.root.removeEventListener('pointermove', this._onPointerMove);
            this.root.removeEventListener('pointerup', this._onPointerEnd);
            this.root.removeEventListener('pointercancel', this._onPointerEnd);
            this.root.removeEventListener('keydown', this._onKeyDown);
            this.root.classList.remove(CLASSES.root, CLASSES.sorting, CLASSES.saving);
        }

        /** Bind events once on the root; dynamic items work automatically through delegation. */
        _bindEvents() {
            this.root.addEventListener('pointerdown', this._onPointerDown);
            this.root.addEventListener('pointermove', this._onPointerMove);
            this.root.addEventListener('pointerup', this._onPointerEnd);
            this.root.addEventListener('pointercancel', this._onPointerEnd);
            this.root.addEventListener('keydown', this._onKeyDown);
        }

        /** Call one optional lifecycle callback. */
        _callback(name, ...args) {
            const callback = this.options[name];
            return typeof callback === 'function' ? callback(...args) : undefined;
        }

        /** Resolve an element only when it belongs to this sortable list. */
        _closest(element, selector) {
            if (!(element instanceof Element)) return null;
            const found = element.closest(selector);
            return found && this.root.contains(found) ? found : null;
        }

        /**
         * Start tracking a potential drag from the configured handle.
         * The actual drag starts only after dragThreshold is exceeded.
         */
        _onPointerDown(event) {
            if (this.saving || this.pointerId !== null) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;

            const handle = this._closest(event.target, this.options.handleSelector);
            const item = handle && this._closest(handle, this.options.itemSelector);
            if (!item) return;

            event.preventDefault();

            this.draggedItem = item;
            this.dragHandle = handle;
            this.pointerId = event.pointerId;
            this.previousOrder = this.getOrder();
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.dragStarted = false;

            // Pointer capture keeps events flowing even if the pointer leaves the handle.
            if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
        }

        /** Track movement and throttle DOM work to one operation per animation frame. */
        _onPointerMove(event) {
            if (event.pointerId !== this.pointerId || !this.draggedItem) return;

            if (!this.dragStarted) {
                const dx = event.clientX - this.startX;
                const dy = event.clientY - this.startY;
                if (Math.hypot(dx, dy) < this.options.dragThreshold) return;

                this.dragStarted = true;
                this.draggedItem.classList.add(CLASSES.dragging);
                this.root.classList.add(CLASSES.sorting);

                this._callback('onStart', this._buildContext(this.previousOrder));
            }

            event.preventDefault();
            this.pointerPosition = { x: event.clientX, y: event.clientY };
            if (this.moveFrame !== null) return;

            this.moveFrame = requestAnimationFrame(() => {
                this.moveFrame = null;
                if (this.pointerPosition) this._moveAt(this.pointerPosition.x, this.pointerPosition.y);
            });
        }

        /**
         * Move the dragged item relative to the row currently under the pointer.
         * document.elementFromPoint() works consistently for mouse, touch and pen.
         */
        _moveAt(clientX, clientY) {
            if (!this.draggedItem) return;

            const target = this._closest(document.elementFromPoint(clientX, clientY), this.options.itemSelector);
            if (!target || target === this.draggedItem) return;

            const rect = target.getBoundingClientRect();
            const insertAfter = clientY > rect.top + rect.height / 2;

            // Skip no-op insertions to avoid unnecessary layouts and onChange callbacks.
            if (
                (insertAfter && target.nextElementSibling === this.draggedItem) ||
                (!insertAfter && target.previousElementSibling === this.draggedItem)
            ) return;

            if (insertAfter) target.insertAdjacentElement('afterend', this.draggedItem);
            else target.insertAdjacentElement('beforebegin', this.draggedItem);

            this._callback('onChange', this._buildContext(this.previousOrder));
        }

        /** Finish pointer dragging and let onEnd persist the final order. */
        _onPointerEnd(event) {
            if (event.pointerId !== this.pointerId) return;

            const item = this.draggedItem;
            const previousOrder = this.previousOrder;
            const dragStarted = this.dragStarted;

            this._releasePointer();
            this._cancelMoveFrame();
            if (item) item.classList.remove(CLASSES.dragging);
            this.root.classList.remove(CLASSES.sorting);
            this._resetDragState();

            if (!dragStarted || !previousOrder) return;
            this._commitOrder(previousOrder, item);
        }

        /**
         * Keyboard reordering from the focused handle.
         * ArrowUp / ArrowDown use the same callbacks and rollback logic as pointer dragging.
         */
        _onKeyDown(event) {
            if (this.saving || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;

            const handle = this._closest(event.target, this.options.handleSelector);
            const item = handle && this._closest(handle, this.options.itemSelector);
            if (!item) return;

            const sibling = event.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
            if (!sibling || !sibling.matches(this.options.itemSelector)) return;

            event.preventDefault();

            const previousOrder = this.getOrder();
            this._callback('onStart', this._buildContext(previousOrder, item));

            if (event.key === 'ArrowUp') sibling.insertAdjacentElement('beforebegin', item);
            else sibling.insertAdjacentElement('afterend', item);

            this._callback('onChange', this._buildContext(previousOrder, item));
            this._commitOrder(previousOrder, item);
        }

        /**
         * Build the callback payload from the current DOM state.
         * `changes` contains only rows whose 1-based position changed.
         */
        _buildContext(previousOrder, item = this.draggedItem) {
            const order = this.getOrder();
            const movedId = item ? this.options.getId(item) : null;
            return {
                item,
                movedId,
                previousOrder: previousOrder ? previousOrder.slice() : [],
                order,
                changes: previousOrder ? this.getChanges(previousOrder, order) : [],
                oldIndex: previousOrder ? previousOrder.indexOf(movedId) : -1,
                newIndex: movedId == null ? -1 : order.indexOf(movedId),
                list: this
            };
        }

        /**
         * Execute onEnd once with the final order.
         * If onEnd returns false or throws, the previous DOM order is restored automatically.
         */
        async _commitOrder(previousOrder, item) {
            const context = this._buildContext(previousOrder, item);
            if (typeof this.options.onEnd !== 'function') return;

            const hasChanges = context.changes.length > 0;
            if (hasChanges) {
                this.saving = true;
                this.root.classList.add(CLASSES.saving);
            }

            try {
                const result = await this._callback('onEnd', context);
                if (result === false && hasChanges) this.setOrder(previousOrder);
            } catch (error) {
                if (hasChanges) this.setOrder(previousOrder);
                this._callback('onError', error, context);
            } finally {
                if (hasChanges) {
                    this.saving = false;
                    this.root.classList.remove(CLASSES.saving);
                }
            }
        }

        /** Release pointer capture when supported. */
        _releasePointer() {
            if (
                this.dragHandle &&
                this.pointerId !== null &&
                this.dragHandle.hasPointerCapture?.(this.pointerId)
            ) this.dragHandle.releasePointerCapture(this.pointerId);
        }

        /** Cancel a pending pointermove animation frame. */
        _cancelMoveFrame() {
            if (this.moveFrame !== null) {
                cancelAnimationFrame(this.moveFrame);
                this.moveFrame = null;
            }
            this.pointerPosition = null;
        }

        /** Clear transient pointer/drag state without changing the DOM order. */
        _resetDragState() {
            this.draggedItem = null;
            this.dragHandle = null;
            this.pointerId = null;
            this.previousOrder = null;
            this.dragStarted = false;
        }
    }

    // Expose the class contract without duplicating CSS class strings in consumers.
    TinySortableList.CLASSES = CLASSES;
    global.TinySortableList = TinySortableList;

})(window);
