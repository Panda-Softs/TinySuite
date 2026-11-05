# TinySideNav

Dependency-free vanilla JavaScript sidenav component inspired by Materialize Sidenav.

The source component reviewed used jQuery/cash and `M.anime`; this version keeps the same useful behavior without those dependencies.

## Files

```txt
TinySideNav/
  TinySideNav.js
  TinySideNav.css
  TinySideNav.scss
  README.md
  demo/
    demo.html
```

## Basic usage

```html
<link rel="stylesheet" href="TinySideNav.css">

<a class="sidenav-trigger" href="#mobile-nav">Open menu</a>

<aside id="mobile-nav" class="sidenav">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
    <li><button type="button" class="sidenav-close">Close</button></li>
  </ul>
</aside>

<script src="TinySideNav.js"></script>
<script>
  const sidenav = new TinySideNav('#mobile-nav', {
    edge: 'left',
    draggable: true
  });
</script>
```

## API

```js
new TinySideNav(selector, options);
TinySideNav.init('.sidenav', options);
TinySideNav.getInstance('#mobile-nav');
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `edge` | `string` | `'left'` | Side of screen where the sidenav appears. Use `'left'` or `'right'`. |
| `draggable` | `boolean` | `true` | Enables swipe gestures on touch/pen devices. |
| `inDuration` | `number` | `250` | Open transition duration in milliseconds. |
| `outDuration` | `number` | `200` | Close transition duration in milliseconds. |
| `onOpenStart` | `function|null` | `null` | Called when opening starts. |
| `onOpenEnd` | `function|null` | `null` | Called when opening ends. |
| `onCloseStart` | `function|null` | `null` | Called when closing starts. |
| `onCloseEnd` | `function|null` | `null` | Called when closing ends. |
| `preventScrolling` | `boolean` | `true` | Locks body scrolling while the sidenav is open. |

## Trigger support

Any element with `.sidenav-trigger` can open a matching sidenav.

```html
<a class="sidenav-trigger" href="#mobile-nav">Open</a>
<a class="sidenav-trigger" data-target="mobile-nav">Open</a>
```

## Close trigger

Any element inside the sidenav with `.sidenav-close` closes it.

```html
<button type="button" class="sidenav-close">Close</button>
```

## Methods

```js
sidenav.open();
sidenav.close();
sidenav.destroy();
```

## Styling variables

```css
:root {
  --tiny-sidenav-width: 300px;
  --tiny-sidenav-max-width: 80vw;
  --tiny-sidenav-z-index: 999;
  --tiny-sidenav-bg: #fff;
  --tiny-sidenav-color: #222;
  --tiny-sidenav-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
  --tiny-sidenav-overlay-bg: rgba(0, 0, 0, 0.5);
  --tiny-sidenav-drag-target-width: 24px;
}
```

## Notes

- Uses Pointer Events for drag handling.
- Mouse dragging is intentionally disabled by default because side drawer swipe gestures should primarily target touch/pen input.
- Fixed sidenav is detected with `.sidenav-fixed` or `.tiny-sidenav--fixed` above `993px`.
