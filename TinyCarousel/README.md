# TinyCarousel

`TinyCarousel` is a dependency-free vanilla JavaScript carousel component.

It supports the original Materialize-like 3D behavior and an enhanced full-width track mode with arrows, side preview padding, multiple visible slides, `perMove`, dots positions, and a progress bar.

## Files

```txt
TinyCarousel/
  TinyCarousel.js
  TinyCarousel.css
  README.md
  demo/
    demo.html
```

## Basic usage

```html
<link rel="stylesheet" href="./TinyCarousel.css">

<div class="tiny-carousel" id="demo-carousel">
  <a class="carousel-item" href="#one"><img src="./one.jpg" alt="Slide one"></a>
  <a class="carousel-item" href="#two"><img src="./two.jpg" alt="Slide two"></a>
  <a class="carousel-item" href="#three"><img src="./three.jpg" alt="Slide three"></a>
</div>

<script src="./TinyCarousel.js"></script>
<script>
  const carousel = new TinyCarousel(document.querySelector('#demo-carousel'), {
    indicators: true
  });
</script>
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `duration` | `number` | `200` | Inertia animation duration in milliseconds. |
| `dist` | `number` | `-100` | Z-axis distance for the legacy 3D layout. |
| `shift` | `number` | `0` | Horizontal shift for side items in legacy 3D layout. |
| `padding` | `number \| string` | `0` | Number = legacy internal spacing. CSS string, e.g. `'5rem'`, = visual side padding in track/full-width layout. |
| `gap` | `number \| string` | `0` | Space between slides in track/full-width layout. |
| `numVisible` | `number` | `5` | Number of visible items in legacy 3D layout. |
| `perPage` | `number` | `1` | Number of slides visible at the same time in track/full-width layout. |
| `perMove` | `number` | `1` | Number of slides moved by `next()` / `prev()` and arrows. |
| `fullWidth` | `boolean` | `false` | Enables full-width/track layout. |
| `indicators` | `boolean` | `false` | Adds clickable dot indicators. Ignored when `progressBar` is true. |
| `indicatorsPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'bottom'` | Position of dots. Left/right are vertical. |
| `arrows` | `boolean` | `false` | Adds SVG previous/next navigation arrows. |
| `progressBar` | `boolean` | `false` | Adds a progress bar instead of dots. |
| `noWrap` | `boolean` | `false` | Prevents infinite wrapping. |
| `onCycleTo` | `function \| null` | `null` | Callback called when the active slide changes. |

## Examples

### Full-width with side preview

```js
new TinyCarousel(document.querySelector('#preview-carousel'), {
  fullWidth: true,
  padding: '5rem',
  gap: '1rem',
  indicators: true,
  indicatorsPosition: 'top',
  arrows: true
});
```

### Multiple slides

```js
new TinyCarousel(document.querySelector('#multiple-carousel'), {
  fullWidth: true,
  perPage: 3,
  perMove: 1,
  gap: '1rem',
  arrows: true,
  indicators: true,
  indicatorsPosition: 'right',
  noWrap: true
});
```

### Progress bar

```js
new TinyCarousel(document.querySelector('#progress-carousel'), {
  fullWidth: true,
  progressBar: true,
  arrows: true
});
```

## Methods

```js
carousel.next();
carousel.prev();
carousel.set(2);
carousel.destroy();
```

`next()` and `prev()` use the configured `perMove` by default.

## Static helpers

```js
TinyCarousel.init(document.querySelectorAll('.tiny-carousel'), options);
TinyCarousel.getInstance(element);
```

## Accessibility notes

- Slides receive `aria-roledescription="slide"` and `aria-label="x of y"`.
- Active slides receive `tabindex="0"`; inactive slides receive `tabindex="-1"`.
- Dots are keyboard activatable with `Enter` and `Space`.
- Arrows are real `<button>` elements with labels.
- Images should still use meaningful `alt` text.

## SCSS and CSS custom properties

The package includes `TinyCarousel.scss` and the compiled `TinyCarousel.css`.

Main customization variables are exposed as CSS custom properties on `.tiny-carousel`:

```css
.my-carousel {
  --tiny-carousel-indicator-background: rgba(255, 255, 255, 0.45);
  --tiny-carousel-indicator-background-active: #fff;
  --tiny-carousel-arrow-background: rgba(0, 0, 0, 0.7);
  --tiny-carousel-arrow-color: #fff;
  --tiny-carousel-progress-fill-background: #111;
  --tiny-carousel-item-radius: 20px;
}
```
