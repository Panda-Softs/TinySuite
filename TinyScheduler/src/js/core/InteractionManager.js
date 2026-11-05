/**
 * InteractionManager
 * ------------------
 * Handles event drag/drop.
 *
 * Important:
 * - The original event is not moved during pointermove.
 * - A fixed mirror is used for visual feedback.
 * - Drop targets are detected from cached slot rectangles.
 * - The event store is updated only on pointerup.
 *
 * This prevents flickering when dragging horizontally between week columns.
 */
class InteractionManager {
  constructor(calendar) {
    this.calendar = calendar;

    this.dragState = null;
    this.recentlyDraggingUntil = 0;
    this.pendingPointerEvent = null;
    this.rafId = null;

    this.boundPointerMove = event => this.handlePointerMove(event);
    this.boundPointerUp = event => this.handlePointerUp(event);
  }

  /**
   * Start preparing an event drag.
   *
   * @param {PointerEvent} originalEvent - Native pointerdown event.
   * @returns {InteractionManager}
   */
  handlePointerDown(originalEvent) {
    if (originalEvent.button !== 0) return this;
    if (this.calendar.options.editable === false) return this;

    if (originalEvent.target.closest(SCHEDULER_SELECTORS.eventAction)) {
      return this;
    }

    if (
        SCHEDULER_SELECTORS.eventResizeHandle
        && originalEvent.target.closest(SCHEDULER_SELECTORS.eventResizeHandle)
    ) {
      return this;
    }

    const eventElement = originalEvent.target.closest(SCHEDULER_SELECTORS.event);

    if (!eventElement || !this.calendar.rootElement.contains(eventElement)) {
      return this;
    }

    const schedulerEvent = this.calendar.eventStore.getEventById(eventElement.dataset.eventId);

    if (!schedulerEvent) {
      return this;
    }

    this.dragState = this.createInitialDragState({
      eventElement,
      schedulerEvent,
      originalEvent
    });

    eventElement.setPointerCapture?.(originalEvent.pointerId);

    document.addEventListener('pointermove', this.boundPointerMove);
    document.addEventListener('pointerup', this.boundPointerUp, { once: true });

    return this;
  }

  /**
   * Create the initial drag state before the drag is visually started.
   *
   * @param {Object} config - Drag config.
   * @param {HTMLElement} config.eventElement - Original event element.
   * @param {Object} config.schedulerEvent - Scheduler event.
   * @param {PointerEvent} config.originalEvent - Native pointerdown event.
   * @returns {Object}
   */
  createInitialDragState({ eventElement, schedulerEvent, originalEvent }) {
    const originalRect = eventElement.getBoundingClientRect();
    const slotGroupElement = eventElement.closest(SCHEDULER_SELECTORS.slotGroup);
    const slotGroupRect = slotGroupElement?.getBoundingClientRect();

    const eventStart = parseDateInput(schedulerEvent.start);
    const eventEnd = schedulerEvent.end
        ? parseDateInput(schedulerEvent.end)
        : addMinutes(eventStart, this.calendar.options.slotDuration || 30);

    return {
      pointerId: originalEvent.pointerId,

      event: schedulerEvent,
      eventElement,
      slotGroupElement,

      startClientX: originalEvent.clientX,
      startClientY: originalEvent.clientY,

      originalRect,
      originalStart: eventStart,
      originalEnd: eventEnd,
      durationMs: Math.max(0, eventEnd.getTime() - eventStart.getTime()),

      // Preserve the lane offset when an overlapping event is dragged.
      sourceInsetX: slotGroupRect
          ? Math.max(0, originalRect.left - slotGroupRect.left)
          : 2,

      isAllDay: isAllDayEvent(schedulerEvent),
      hasStarted: false,

      slots: [],
      currentHit: null,
      lastValidHit: null,
      mirrorElement: null,
      proposedEvent: null,
      hasResourceCollision: false
    };
  }

  /**
   * Handle pointer move.
   *
   * Drag is started only after a small distance threshold.
   *
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {InteractionManager}
   */
  handlePointerMove(originalEvent) {
    const state = this.dragState;

    if (!state) {
      return this;
    }

    const distanceX = originalEvent.clientX - state.startClientX;
    const distanceY = originalEvent.clientY - state.startClientY;
    const distance = Math.hypot(distanceX, distanceY);
    const minDistance = this.calendar.options.eventDragMinDistance ?? 4;

    if (!state.hasStarted && distance < minDistance) {
      return this;
    }

    if (!state.hasStarted) {
      this.startEventDrag(state, originalEvent);
    }

    originalEvent.preventDefault();

    this.pendingPointerEvent = originalEvent;
    this.requestDragFrame();

    return this;
  }

  /**
   * Start visual dragging.
   *
   * @param {Object} state - Drag state.
   * @param {PointerEvent} originalEvent - Native pointermove event.
   * @returns {InteractionManager}
   */
  startEventDrag(state, originalEvent) {
    state.hasStarted = true;
    state.slots = this.collectDragSlots(state);
    state.mirrorElement = this.createDragMirror(state);

    state.eventElement.classList.add(
        CLASS_NAMES.calendar.eventDragging,
        CLASS_NAMES.calendar.eventDragSourceHidden
    );

    this.calendar.hideEventActionToolbar?.();
    this.calendar.clearSlotSelectionClasses?.();

    this.calendar._notify('eventDragStart', {
      type: 'event',
      action: 'dragStart',
      event: state.event,
      eventElement: state.eventElement,
      originalEvent
    });

    return this;
  }

  /**
   * Cache all valid drop slots once per drag.
   *
   * Using cached rects avoids unstable elementFromPoint() results when the
   * dragged event or mirror is under the pointer.
   *
   * @param {Object} state - Drag state.
   * @returns {Array<Object>}
   */
  collectDragSlots(state) {
    const expectedAllDay = state.isAllDay ? 'true' : 'false';

    return Array.from(this.calendar.rootElement.querySelectorAll(SCHEDULER_SELECTORS.slot))
        .filter(slotElement => {
          return slotElement.dataset.slotStart
              && slotElement.dataset.slotEnd
              && slotElement.dataset.slotAllDay === expectedAllDay;
        })
        .map(slotElement => {
          return {
            element: slotElement,
            rect: slotElement.getBoundingClientRect(),
            start: parseDateInput(slotElement.dataset.slotStart),
            end: parseDateInput(slotElement.dataset.slotEnd)
          };
        });
  }

  /**
   * Create the fixed drag mirror.
   *
   * @param {Object} state - Drag state.
   * @returns {HTMLElement}
   */
  createDragMirror(state) {
    const mirrorElement = state.eventElement.cloneNode(true);

    mirrorElement.classList.remove(
        CLASS_NAMES.calendar.eventSelected,
        CLASS_NAMES.calendar.eventCollision,
        CLASS_NAMES.calendar.eventCollisionPreview
    );
    mirrorElement.classList.add(CLASS_NAMES.calendar.eventDragMirror);

    mirrorElement.removeAttribute('id');
    mirrorElement.removeAttribute('tabindex');
    mirrorElement.setAttribute('aria-hidden', 'true');

    Object.assign(mirrorElement.style, {
      position: 'fixed',
      left: `${Math.round(state.originalRect.left)}px`,
      top: `${Math.round(state.originalRect.top)}px`,
      width: `${Math.round(state.originalRect.width)}px`,
      height: `${Math.round(state.originalRect.height)}px`,
      pointerEvents: 'none',
      margin: '0'
    });

    document.body.append(mirrorElement);

    return mirrorElement;
  }

  /**
   * Request one visual update per animation frame.
   *
   * @returns {InteractionManager}
   */
  requestDragFrame() {
    if (this.rafId) {
      return this;
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.updateDragPreview();
    });

    return this;
  }

  /**
   * Update the mirror position and drop target hover.
   *
   * @returns {InteractionManager}
   */
  updateDragPreview() {
    const state = this.dragState;
    const originalEvent = this.pendingPointerEvent;

    if (!state || !state.hasStarted || !originalEvent) {
      return this;
    }

    const hit = this.getStableDragHit(state, originalEvent.clientX, originalEvent.clientY);

    // Keep the last valid position instead of jumping back to origin.
    if (!hit) {
      return this;
    }

    if (hit !== state.currentHit) {
      this.setDropTargetHover(state.currentHit?.element, false);
      this.setDropTargetHover(hit.element, true);

      state.currentHit = hit;
      state.lastValidHit = hit;
    }

    this.positionMirrorOnHit(state, hit);
    this.updateDragCollisionPreview(state, hit);

    this.calendar._notify('eventDrag', {
      type: 'event',
      action: 'drag',
      event: state.event,
      eventElement: state.eventElement,
      slotElement: hit.element,
      start: hit.start,
      end: this.getMovedEventEnd(state, hit.start),
      originalEvent
    });

    return this;
  }

  /**
   * Build the event state represented by the current drag hit.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Current slot hit.
   * @returns {Object}
   */
  getProposedEventForHit(state, hit) {
    const resourceId = hit.element.dataset.resourceId
        || state.event.resourceId
        || state.event.resourceIds?.[0]
        || null;

    return {
      ...state.event,
      start: hit.start,
      end: this.getMovedEventEnd(state, hit.start),
      allDay: state.isAllDay,
      resourceId: resourceId ? String(resourceId) : null,
      resourceIds: resourceId ? [String(resourceId)] : []
    };
  }

  /**
   * Show immediate warning feedback when the dragged event overlaps another
   * event on the same resource.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Current slot hit.
   * @returns {InteractionManager}
   */
  updateDragCollisionPreview(state, hit) {
    state.proposedEvent = this.getProposedEventForHit(state, hit);
    state.hasResourceCollision = this.calendar.updateEventCollisionPreview(
        state.mirrorElement,
        state.proposedEvent,
        state.event
    );

    return this;
  }

  /**
   * Return the current slot hit with small hysteresis.
   *
   * Hysteresis avoids flickering when the pointer is near a column or row border.
   *
   * @param {Object} state - Drag state.
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @returns {Object|null}
   */
  getStableDragHit(state, clientX, clientY) {
    const tolerance = this.calendar.options.eventDragHitTolerance ?? 3;

    if (
        state.currentHit
        && this.isPointInsideRect(clientX, clientY, state.currentHit.rect, tolerance)
    ) {
      return state.currentHit;
    }

    return this.findDragHitAtPoint(state, clientX, clientY);
  }

  /**
   * Find the slot under the pointer.
   *
   * @param {Object} state - Drag state.
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @returns {Object|null}
   */
  findDragHitAtPoint(state, clientX, clientY) {
    for (const slot of state.slots) {
      if (this.isPointInsideRect(clientX, clientY, slot.rect, 0)) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Check if a point is inside a rect.
   *
   * @param {number} clientX - Pointer X.
   * @param {number} clientY - Pointer Y.
   * @param {DOMRect} rect - Target rect.
   * @param {number} tolerance - Extra tolerance in px.
   * @returns {boolean}
   */
  isPointInsideRect(clientX, clientY, rect, tolerance = 0) {
    return clientX >= rect.left - tolerance
        && clientX <= rect.right + tolerance
        && clientY >= rect.top - tolerance
        && clientY <= rect.bottom + tolerance;
  }

  /**
   * Position the mirror on the selected slot.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Slot hit.
   * @returns {InteractionManager}
   */
  positionMirrorOnHit(state, hit) {
    const mirrorElement = state.mirrorElement;

    if (!mirrorElement) {
      return this;
    }

    const slotRect = hit.element.getBoundingClientRect();
    const width = Math.min(
        state.originalRect.width,
        Math.max(24, slotRect.width - 4)
    );

    const left = slotRect.left + Math.min(
        state.sourceInsetX,
        Math.max(2, slotRect.width - width - 2)
    );

    mirrorElement.style.left = `${Math.round(left)}px`;
    mirrorElement.style.top = `${Math.round(slotRect.top)}px`;
    mirrorElement.style.width = `${Math.round(width)}px`;
    mirrorElement.style.height = `${Math.round(state.originalRect.height)}px`;

    return this;
  }

  /**
   * Finish drag.
   *
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {InteractionManager}
   */
  async handlePointerUp(originalEvent) {
    const state = this.dragState;

    document.removeEventListener('pointermove', this.boundPointerMove);

    if (!state) {
      return this;
    }

    state.eventElement.releasePointerCapture?.(state.pointerId);

    if (!state.hasStarted) {
      this.dragState = null;
      return this;
    }

    originalEvent.preventDefault();

    const finalHit = state.lastValidHit || state.currentHit;

    this.cleanupEventDrag(state);

    if (finalHit) {
      await this.applyEventDrop(state, finalHit, originalEvent);
    }

    this.recentlyDraggingUntil = Date.now() + 250;

    this.calendar._notify('eventDragEnd', {
      type: 'event',
      action: 'dragEnd',
      event: state.event,
      eventElement: state.eventElement,
      slotElement: finalHit?.element || null,
      originalEvent
    });

    this.dragState = null;

    return this;
  }

  /**
   * Apply the final move once on pointerup.
   *
   * @param {Object} state - Drag state.
   * @param {Object} hit - Final slot hit.
   * @param {PointerEvent} originalEvent - Native pointerup event.
   * @returns {InteractionManager}
   */
  async applyEventDrop(state, hit, originalEvent) {
    const newStart = hit.start;
    const newEnd = this.getMovedEventEnd(state, newStart);
    const oldStartTime = state.originalStart.getTime();
    const oldEndTime = state.originalEnd.getTime();

    const didDateChange =
        newStart.getTime() !== oldStartTime
        || newEnd.getTime() !== oldEndTime;

    const updates = {
      start: newStart,
      end: newEnd,
      allDay: state.isAllDay
    };

    const resourceId = hit.element.dataset.resourceId;

    if (resourceId) {
      updates.resourceId = resourceId;
      updates.resourceIds = [resourceId];
    }

    if (!didDateChange && !resourceId) {
      return this;
    }

    await Promise.resolve(this.calendar.moveEvent(state.event.id, updates, originalEvent));

    return this;
  }

  /**
   * Keep the original event duration.
   *
   * @param {Object} state - Drag state.
   * @param {Date} newStart - New start date.
   * @returns {Date}
   */
  getMovedEventEnd(state, newStart) {
    return new Date(newStart.getTime() + state.durationMs);
  }

  /**
   * Cleanup mirror, source state and hover target.
   *
   * @param {Object} state - Drag state.
   * @returns {InteractionManager}
   */
  cleanupEventDrag(state) {
    this.setDropTargetHover(state.currentHit?.element, false);

    state.eventElement.classList.remove(
        CLASS_NAMES.calendar.eventDragging,
        CLASS_NAMES.calendar.eventDragSourceHidden
    );

    state.mirrorElement?.classList.remove(CLASS_NAMES.calendar.eventCollisionPreview);
    state.mirrorElement?.remove();

    this.pendingPointerEvent = null;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    return this;
  }

  /**
   * Toggle hover state on the current drop target.
   *
   * @param {HTMLElement|null} slotElement - Slot element.
   * @param {boolean} isActive - Active state.
   * @returns {InteractionManager}
   */
  setDropTargetHover(slotElement, isActive) {
    if (!slotElement) {
      return this;
    }

    slotElement.classList.toggle(CLASS_NAMES.calendar.dropTargetHover, isActive);

    return this;
  }

  /**
   * Used by TinyScheduler to ignore the click generated after a drag.
   *
   * @returns {boolean}
   */
  wasRecentlyDragging() {
    return Date.now() < this.recentlyDraggingUntil;
  }

  /**
   * Cleanup listeners and mirrors.
   */
  destroy() {
    document.removeEventListener('pointermove', this.boundPointerMove);
    document.removeEventListener('pointerup', this.boundPointerUp);

    if (this.dragState) {
      this.cleanupEventDrag(this.dragState);
      this.dragState = null;
    }
  }
}