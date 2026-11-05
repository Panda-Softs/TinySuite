# TinySortableList

Small dependency-free sortable list for persistent business ordering.

## Files

- `TinySortableList.js` — component source.
- `_tinySortableList.scss` — generic component SCSS.
- `TinySortableList.css` — ready-to-use compiled CSS.
- `demo/demo.html` — standalone interactive demo.
- `demo/demo.css` — demo-only presentation styles.

## Minimal DOM

```html
<div id="resources">
    <div class="tiny-sortable-list-item" data-id="1">
        <button type="button" class="tiny-sortable-list-handle" aria-label="Move">↕</button>
        Resource A
    </div>
    <div class="tiny-sortable-list-item" data-id="2">
        <button type="button" class="tiny-sortable-list-handle" aria-label="Move">↕</button>
        Resource B
    </div>
</div>
```

The handle is intentionally a direct child of `.tiny-sortable-list-item`, matching the generic SCSS hierarchy.

## Usage

```js
const sortable = new TinySortableList('#resources', {
    getId: item => Number(item.dataset.id),

    onStart(context) {
        // Drag/keyboard move started.
    },

    onChange({ order, changes }) {
        // DOM order changed. Keep this callback lightweight.
    },

    async onEnd({ changes }) {
        if (!changes.length) return true;

        const response = await fetch('/resources/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resources: changes })
        });

        // false automatically restores the previous DOM order.
        return response.ok;
    },

    onError(error, context) {
        // onEnd threw; TinySortableList already restored previousOrder.
    }
});
```

`changes` contains only rows whose position changed:

```js
[
    { id: 4, order: 2 },
    { id: 2, order: 3 },
    { id: 3, order: 4 }
]
```

## Public methods

```js
sortable.getItems();
sortable.getOrder();
sortable.getChanges(previousOrder, currentOrder);
sortable.setOrder(order);
sortable.destroy();
```

## Interaction

- Mouse, touch and pen: drag from `.tiny-sortable-list-handle`.
- Keyboard: focus the handle and use `ArrowUp` / `ArrowDown`.
- Items added after initialization work automatically because events are delegated from the root.
