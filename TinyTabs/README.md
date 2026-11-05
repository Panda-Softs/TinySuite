# TinyTabs

TinyTabs is a standalone vanilla JavaScript tabs component inspired by Materialize-style tabs.

## Features

- Pure vanilla JavaScript
- No jQuery
- No external animation dependency
- Active indicator
- Disabled tabs
- Optional swipeable mode
- Responsive swipe threshold
- Keyboard navigation
- Basic ARIA support
- Programmatic API

## Project structure

```txt
TinyTabs/
├── TinyTabs.js
├── TinyTabs.css
├── README.md
└── demo/
    └── demo.html
```

## Basic HTML

```html
<link rel="stylesheet" href="TinyTabs.css">

<ul class="tabs js-tabs">
  <li class="tab"><a href="#profile" class="active">Profile</a></li>
  <li class="tab"><a href="#settings">Settings</a></li>
  <li class="tab disabled"><a href="#billing">Billing</a></li>
</ul>

<section id="profile" class="tab-panel">Profile content</section>
<section id="settings" class="tab-panel">Settings content</section>
<section id="billing" class="tab-panel">Billing content</section>

<script src="TinyTabs.js"></script>
```

## Initialization

Preferred object-style initialization:

```js
const tabs = new TinyTabs({
  element: document.querySelector('.js-tabs'),
  duration: 300,
  swipeable: false,
  onShow(panel, instance) {
    console.log(panel.id, instance);
  }
});
```

Selector-based initialization:

```js
const tabs = new TinyTabs({
  element: '.js-tabs'
});
```

Fallback selector initialization:

```html
<ul class="tabs" data-tiny-tabs>...</ul>
```

```js
const tabs = new TinyTabs({
  duration: 300
});
```

Classic initialization is also supported:

```js
const tabs = new TinyTabs(document.querySelector('.js-tabs'), {
  duration: 300
});
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `element` | HTMLElement/string/null | `null` | Tabs root element or selector |
| `selector` | string | `[data-tiny-tabs]` | Fallback selector when `element` is omitted |
| `duration` | number | `300` | Animation duration in milliseconds |
| `onShow` | function/null | `null` | Callback called when a panel is shown |
| `swipeable` | boolean | `false` | Enables touch swipe mode |
| `responsiveThreshold` | number | `Infinity` | Enables swipeable mode only at or below this viewport width |
| `activeClass` | string | `active` | Active class name |
| `disabledClass` | string | `disabled` | Disabled tab class name |

## Methods

### `select(tabId)`

```js
tabs.select('settings');
tabs.select('#settings');
```

### `updateTabIndicator()`

```js
tabs.updateTabIndicator();
```

### `destroy()`

```js
tabs.destroy();
```

### `TinyTabs.getInstance(element)`

```js
const instance = TinyTabs.getInstance(document.querySelector('.js-tabs'));
```

### `TinyTabs.init(elements, options)`

```js
const instances = TinyTabs.init('.tabs', {
  duration: 300
});
```

## Keyboard support

- Arrow Right: next enabled tab
- Arrow Left: previous enabled tab
- Home: first enabled tab
- End: last enabled tab

## Demo

Open:

```txt
demo/demo.html
```

## Notes

Swipeable mode is intentionally simple. It supports touch navigation between panels, not full carousel physics.
