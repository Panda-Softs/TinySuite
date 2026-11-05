# TinyScheduler

TinyScheduler is a plain JavaScript scheduling component with classic calendar views and resource planning views. It focuses on predictable DOM structure, fast event interactions, and extensible callbacks.

## Views

| View | Purpose |
| --- | --- |
| `month` | Month grid with compact events and `+ more` popovers. |
| `week` | Classic time-grid week view. |
| `day` | Classic time-grid day view. |
| `list` | Weekly list view. |
| `resourceTimeGrid` | Resource planning with vertical time axis. Supports `planningRange: 'day'` and `planningRange: 'week'`. |
| `resourceTimeline` | Resource planning with horizontal time axis. Supports `planningRange: 'day'`, `'week'`, and `'month'`. |

Planning aliases are also supported:

```js
scheduler.setView('resourceTimeGridDay');
scheduler.setView('resourceTimeGridWeek');
scheduler.setView('resourceTimelineDay');
scheduler.setView('resourceTimelineWeek');
scheduler.setView('resourceTimelineMonth');
```

## Basic usage

```js
const scheduler = new TinyScheduler('#calendar', {
  initialView: 'resourceTimeline',
  planningType: 'timeline',
  planningRange: 'week',
  editable: true,
  selectable: true,
  resources: [
    { id: 'boat-1', title: 'Cap 470 5p' },
    { id: 'boat-2', title: 'Liberty' }
  ],
  events: [
    {
      id: 'r1',
      title: 'Reservation',
      start: '2026-07-09T10:00:00',
      end: '2026-07-09T12:00:00',
      resourceId: 'boat-1'
    }
  ]
});

scheduler.render();
```

## Event refresh architecture

Event mutations are now rendered through a lightweight refresh pipeline:

```text
add / update / move / delete
→ EventStore mutation
→ activeView.refreshEvents(mutation)
→ fallback redrawPreservingScroll() only if needed
```

This means drag/drop, resize, add, update and delete no longer force a full view rebuild when the active view can refresh only its event layers.

### Optimized locally

| View | Local refresh behavior |
| --- | --- |
| `day` / `week` | Rebuilds all-day cells and timed event layers only. The scroll container stays mounted. |
| `resourceTimeGrid` | Rebuilds all-day resource cells and timed resource event layers only. Overlaps are recalculated. |
| `resourceTimeline` | Rebuilds timeline event layers only. Resource rows, headers and scroll stay mounted. |
| `month` | Rebuilds month event wrappers only. Day cells stay mounted. |
| `list` | Rebuilds list rows inside the same scroll container. |

### Extension point for custom views

Custom views can implement:

```js
refreshEvents(mutation) {
  // Return true when the view handled the refresh locally.
  // Return false to let TinyScheduler fallback to redrawPreservingScroll().
  return true;
}
```

The `mutation` object contains:

```js
{
  type: 'add' | 'update' | 'move' | 'delete' | 'refresh',
  eventId,
  event,       // new/current event, null after delete
  oldEvent,    // previous event, useful for moves/deletes
  updates,
  originalEvent
}
```

Use the shared helper from `AbstractView` when replacing event DOM:

```js
this.refreshEventContainer(eventsLayerElement, container => {
  container.append(this.createEventElement(event, 'block'));
});
```

It automatically calls `eventWillUnmount` for removed elements and queues `eventDidMount` for new elements.

## Scroll preservation

When a full redraw is still necessary, use:

```js
scheduler.redrawPreservingScroll();
```

TinyScheduler captures all `.tsh-scroll-container` elements and restores both `scrollTop` and `scrollLeft` after redraw. This prevents the annoying jump when dragging an event from a scrolled position.

## Resource conflict handling

Resource views can detect overlapping usage of the same resource. The recommended callback is the general one:

```js
const scheduler = new TinyScheduler('#calendar', {
  editable: true,
  eventConflictScope: 'resource',

  onEventConflict(info) {
    if (!info.isResourceConflict) return;

    const resourceTitle = info.resource?.title || info.resourceId;
    const conflictTitle = info.conflictEvent?.title || 'un autre événement';

    return Dialog.confirmYes(
      'Conflit de ressource',
      `
        <p>
          La ressource <strong>${resourceTitle}</strong> est déjà utilisée par
          <strong>${conflictTitle}</strong>.
        </p>
        <p>
          Conflit de <strong>${info.overlapMinutes} min</strong>.
        </p>
        <p>Voulez-vous quand même continuer ?</p>
      `
    );
  }
});
```

### Conflict callback result

| Return value | Behavior |
| --- | --- |
| `false` | Cancel add/move. |
| `Promise<false>` | Cancel add/move after async dialog. |
| `true` | Continue. |
| `undefined` | Continue. |

`onResourceConflict(info)` is also available as a resource-only alias. `onEventConflict(info)` has priority when both callbacks are defined.

### `eventConflictScope`

| Value | Behavior |
| --- | --- |
| `'resource'` | Default. Only events overlapping on at least one common resource are reported. |
| `'all'` | Also report non-resource event overlaps. |
| `'none'` or `false` | Disable conflict checks. |

### Conflict payload

```js
{
  type: 'event',
  action: 'conflict',
  operation: 'add' | 'move',
  event,
  proposedEvent,
  oldEvent,
  updates,
  conflictEvent,
  conflicts,
  isResourceConflict,
  resourceId,
  resourceIds,
  resource,
  overlapStart,
  overlapEnd,
  overlapDurationMs,
  overlapMinutes,
  originalEvent,
  calendar,
  view,
  date,
  range
}
```

## Current-time indicator

The now indicator is refreshed without redrawing events. It supports:

- classic `day` / `week` time-grid views;
- `resourceTimeGrid` day/week;
- `resourceTimeline` day/week/month.

The marker uses a triangle instead of a dot. For horizontal now lines, the triangle points into the line from the left edge. For vertical now lines, the triangle is rotated and points into the vertical line.

Useful option:

```js
{
  showNowIndicator: true
}
```

## Event density classes

TinyScheduler adds density classes after layout measurement:

```html
<div class="tsh-event tsh-event--timeline tsh-event--narrow"></div>
```

Current logic:

```text
narrow: rendered width <= 96px, or short height in vertical time-grid views
tiny: rendered width < 58px, or very short height in vertical time-grid views
```

Timeline events are not marked `tiny` only because of their natural row height.

## Resource timeline event height

Resource timeline events fill the useful row height instead of using a fixed `25px` height. The vertical gap is controlled in SCSS with:

```scss
--tsh-rtl-event-y-gap
```

This applies consistently to timeline `day`, `week`, and `month` ranges.

## Main options

| Option | Default | Notes |
| --- | --- | --- |
| `initialDate` | `new Date()` | Initial calendar date. |
| `initialView` | `'month'` | Initial view. |
| `planningType` | `'timeGrid'` | Resource planning type: `'timeGrid'` or `'timeline'`. |
| `planningRange` | `'day'` | Planning range: `'day'`, `'week'`, `'month'`. Month is only useful for timeline. |
| `events` | `[]` | Static event array. |
| `eventSources` | `[]` | Additional event sources. |
| `resources` | `[]` | Static resources. |
| `resourceSources` | `[]` | Additional resource sources. |
| `editable` | `false` | Enables drag/drop. |
| `selectable` | `true` | Enables slot selection. |
| `eventResizable` | `true` | Enables bottom resize handle in timed grid views. |
| `slotDuration` | `30` | Slot duration in minutes. |
| `minTime` | `'06:00'` | First visible time. |
| `maxTime` | `'22:00'` | Last visible time. |
| `rowHeight` | `46` | Resource timeline row height. |
| `showToolbar` | `true` | Render toolbar. |
| `showNowIndicator` | `true` | Render current-time indicator where supported. |
| `maxEventsPerDay` | `3` | Month cell visible event limit before `+ more`. |
| `eventConflictScope` | `'resource'` | Conflict detection scope. |
| `onEventConflict` | `null` | General conflict callback. |
| `onResourceConflict` | `null` | Resource-only conflict alias. |


## Cancellable move and resize

`onEventMove(info)` runs before TinyScheduler mutates the `EventStore`. This is the right place for async confirmation dialogs and backend saves.

```js
new TinyScheduler('#calendar', {
  editable: true,

  async onEventMove(info) {
    const ok = await Dialog.confirmYes(
      'Déplacer l’événement ?',
      `<p>Nouvelle heure: <strong>${info.start.toLocaleString()}</strong></p>`
    );

    if (!ok) return false;

    const saved = await saveEventOnServer(info.proposedEvent);
    return saved !== false;
  },

  async onEventResize(info) {
    const saved = await saveEventOnServer({
      ...info.event,
      end: info.end
    });

    return saved !== false;
  }
});
```

Return handling:

| Return value | Move behavior | Resize behavior |
| --- | --- | --- |
| `false` | Cancel; event stays at its original place. | Cancel; event height/end is reverted. |
| `Promise<false>` | Same, after the Promise resolves. | Same, after the Promise resolves. |
| `undefined` / `true` | Apply proposed change. | Apply proposed change. |
| Object | Merge into final move updates. | Merge into final resize updates. |

`onEventMoved(info)` remains available after the move has been applied, but it is not the right callback for cancellation.

## Main callbacks

| Callback | When it runs |
| --- | --- |
| `onEventClick(info)` | Event click. |
| `onEventEdit(info)` | Event edit action / keyboard edit. May return updates. |
| `onEventDelete(info)` | Event delete action. Return `false` to cancel. |
| `onEventAdd(info)` | Add action. May return an event object. |
| `onEventMove(info)` | Before a drag/drop move is applied. Return `false` or `Promise<false>` to keep the event at its original position. Return an object to override the final updates. |
| `onEventMoved(info)` | After a move has been applied. Informational callback/event. Do not use it to cancel; use `onEventMove`. |
| `onEventMoveCancelled(info)` | Move cancelled by conflict, callback, or callback error. |
| `onEventMoveError(info)` | `onEventMove` threw or rejected. |
| `onEventResize(info)` | Resize end. Return `false` or `Promise<false>` to revert, or an update object. |
| `onEventResizeStart(info)` | Resize starts. |
| `onEventResizeStop(info)` | Resize finishes. |
| `onEventResizeCancelled(info)` | Resize cancelled by callback or callback error. |
| `onEventResizeError(info)` | Resize callback error. |
| `onEventConflict(info)` | Add/move conflict detected. Return `false` or `Promise<false>` to cancel. |
| `onResourceConflict(info)` | Resource conflict alias. |
| `onDateClick(info)` | Date navigation click. |
| `select(info)` / `onSelect(info)` | Slot selection. |
| `eventDidMount(info)` | Event element inserted. |
| `eventWillUnmount(info)` | Event element removed. |
| `viewDidMount(info)` | View mounted. |
| `viewWillUnmount(info)` | View unmounted. |
| `loading(isLoading, info)` | Loading state changed. |

## Practical tricks

### Keep an async confirmation dialog simple

```js
onEventConflict(info) {
  if (!info.isResourceConflict) return;

  return Dialog.confirmYes(
    'Conflit',
    `La ressource est déjà utilisée pendant ${info.overlapMinutes} minutes.`
  );
}
```

### Refresh only event DOM manually

```js
scheduler.refreshEventDisplay({ type: 'refresh' });
```

### Force a full redraw but keep scroll

```js
scheduler.redrawPreservingScroll();
```

### Disable conflict checks

```js
const scheduler = new TinyScheduler('#calendar', {
  eventConflictScope: 'none'
});
```
