# TinyDropdown

Dependency-free vanilla JavaScript dropdown component inspired by Materialize Dropdown, re-engineered for modern DOM-heavy apps.

## Features

- Vanilla JS, no jQuery/cash/anime.
- CSS-based fade-down animation.
- `data-target` / `aria-controls` target resolution.
- Automatic sibling `.dropdown-content` resolution for compact table-row actions.
- Shared contextual dropdown via `virtualTrigger: true` and `openFrom(trigger)`.
- Dedicated `adjustMenuState(context)` hook for row/action state mutation.
- TinyDataTable-friendly `tr._data` support.
- Action registry from `[data-action]`.
- Keyboard navigation, Escape close, typeahead.
- Auto positioning, viewport collision handling, long menu max height.
- Shared global outside-click, resize, scroll, and keydown listeners.

## Files

```txt
TinyDropdown.js
TinyDropdown.scss
TinyDropdown.css
README.md
demo/demo.html
```



## Demo coverage

The bundled `demo/demo.html` is intentionally exhaustive and ergonomic. It covers:

1. Basic click dropdown
2. Right alignment and viewport correction
3. Below-trigger positioning
4. Natural-width menus
5. Sibling `.dropdown-content` without `data-target`
6. Compact table-cell action menus
7. Hover dropdowns
8. `closeOnClick: false` filter menus
9. Lifecycle callbacks and `onItemClick`
10. Keyboard navigation and typeahead
11. Direct dropdown theming with CSS custom properties
12. Explicit scroll-container placement
13. Batch initialization
14. Long menu auto-height
15. Shared contextual table action dropdown with `virtualTrigger`, `openFrom(trigger)`, `adjustMenuState(context)`, and TinyDataTable-style `tr._data`

Every demo card includes the exact code used by that example.

## Basic usage

```html
<button class="dropdown-trigger" data-target="basic-menu">Actions</button>

<ul id="basic-menu" class="dropdown-content">
  <li><a href="#">View</a></li>
  <li><a href="#">Edit</a></li>
</ul>
```

```js
new TinyDropdown('.dropdown-trigger');
```

## Target resolution

TinyDropdown resolves the menu in this order:

1. `data-target`
2. `aria-controls`
3. `nextElementSibling.dropdown-content`
4. direct sibling `.dropdown-content` in the same parent

This means table-row menus can avoid heavy IDs:

```html
<td class="action text-right">
  <button type="button" class="dropdown-trigger">Actions</button>
  <ul class="dropdown-content">
    <li><a href="/clients/42" data-action="view">View</a></li>
    <li><a href="/clients/42/edit" data-action="edit">Edit</a></li>
  </ul>
</td>
```

```js
TinyDropdown.init('.dropdown-trigger');
```

## Shared contextual dropdown for tables

Use one menu for all rows:

```html
<table id="clients-table">
  <tr data-id="42">
    <td>Client name</td>
    <td><button type="button" class="js-client-actions">Actions</button></td>
  </tr>
</table>

<ul id="client-actions-menu" class="dropdown-content">
  <li><a href="#" data-action="view">View</a></li>
  <li><a href="#" data-action="edit">Edit</a></li>
  <li><button type="button" data-action="delete">Delete</button></li>
</ul>
```

```js
const dropdown = new TinyDropdown('#client-actions-menu', {
  virtualTrigger: true,

  adjustMenuState({ data, setHref, show, hide }) {
    setHref('view', `/clients/${data.id}`);
    setHref('edit', `/clients/${data.id}/edit`);

    data.canDelete ? show('delete') : hide('delete');
  },

  onItemClick(item, event, context) {
    if (item.dataset.action === 'delete') {
      event.preventDefault();
      deleteClient(context.data.id);
    }
  }
});

clientsTable.addEventListener('click', (event) => {
  const trigger = event.target.closest('.js-client-actions');
  if (!trigger) return;

  event.preventDefault();
  dropdown.openFrom(trigger);
});
```

## `adjustMenuState(context)`

Dedicated hook for contextual menu mutation. It is called before `onBeforeOpen`.

```js
adjustMenuState(context) {
  context.setHref('view', `/clients/${context.data.id}`);
  context.data.canEdit ? context.show('edit') : context.hide('edit');
}
```

Context shape:

```js
{
  trigger,
  dropdown,
  row,
  data,
  actions,
  instance,
  getAction(name),
  getActionContainer(name),
  show(name),
  hide(name),
  enable(name),
  disable(name),
  setHref(name, href)
}
```

For TinyDataTable rows, data is read from:

```js
tr._data
```

Fallback:

```js
tr.dataset
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `alignment` | string | `'left'` | Horizontal alignment: `left` or `right`. |
| `autoFocus` | boolean | `true` | Focus menu/trigger during open/close. |
| `constrainWidth` | boolean | `true` | Minimum width follows trigger width. |
| `container` | Element/string/null | `null` | Container for menu. Defaults to `body`. |
| `coverTrigger` | boolean | `true` | Menu covers trigger vertically. If false, opens below/above trigger. |
| `closeOnClick` | boolean | `true` | Close after clicking an item. |
| `hover` | boolean | `false` | Open on hover. |
| `inDuration` | number | `150` | CSS open duration in ms. |
| `outDuration` | number | `250` | CSS close duration in ms. |
| `virtualTrigger` | boolean | `false` | Use menu as shared dropdown, opened via `openFrom(trigger)`. |
| `adjustMenuState` | function/null | `null` | Contextual action state hook. |
| `onBeforeOpen` | function/null | `null` | Lifecycle hook. Return `false` to cancel open. |
| `onItemClick` | function/null | `null` | Called with `(item, event, context)`. |
| `onOpenStart` | function/null | `null` | Called before opening. |
| `onOpenEnd` | function/null | `null` | Called after opening animation. |
| `onCloseStart` | function/null | `null` | Called before closing. |
| `onCloseEnd` | function/null | `null` | Called after close animation. |

## Methods

```js
const dropdown = new TinyDropdown('#trigger');

dropdown.openFrom(trigger);
dropdown.close();
dropdown.recalculateDimensions();
dropdown.destroy();
```

## Styling

Use CSS custom properties:

```css
.dropdown-content.my-theme {
  --tiny-dropdown-bg: #111827;
  --tiny-dropdown-color: #ffffff;
  --tiny-dropdown-item-hover-bg: rgba(255, 255, 255, 0.1);
}
```

No `copyCssVariablesFromTrigger()` is used. Theme the dropdown directly or put it in a themed container.
