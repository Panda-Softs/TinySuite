# TinySignature

**TinySignature** is a standalone, dependency-free JavaScript signature component for HTML canvas.
It is built as a single ES6 UMD file and can be used directly in the browser, with AMD loaders, or with CommonJS-style bundlers.

The component is inspired by the provided `signature_pad` source files, but renamed, cleaned up, converted to pure JavaScript, and packaged as one reusable class: `TinySignature`.

---

## Package structure

```txt
TinySignature.js
README.md
demo/
  demo.html
```

`TinySignature.js` is intentionally placed at the root as requested. There is no `src/` directory.

---

## Features

- Pure JavaScript, ES6 class syntax
- UMD wrapper: browser global, AMD, CommonJS
- No dependencies
- Smooth Bézier stroke rendering
- Variable stroke width based on pointer velocity
- Mouse, touch, and pointer event support
- HiDPI canvas resizing helper
- Undo / redo support
- Clear / redraw support
- PNG, JPG, and SVG export
- SVG export with optional background
- Import/export raw point data
- Custom events for stroke lifecycle
- Works well on desktop, tablet, and mobile

---

## Quick start

### 1. Add the script

```html
<script src="TinySignature.js"></script>
```

### 2. Add a canvas

```html
<div style="width: 100%; height: 320px;">
  <canvas id="signature" style="width: 100%; height: 100%;"></canvas>
</div>
```

### 3. Create the component

```html
<script>
  const canvas = document.getElementById('signature');

  const signature = new TinySignature(canvas, {
    penColor: '#111827',
    backgroundColor: '#ffffff',
    minWidth: 0.8,
    maxWidth: 2.8,
  });

  signature.resizeCanvas();

  window.addEventListener('resize', () => {
    signature.resizeCanvas({ preserve: true });
  });
</script>
```

---

## Complete basic example

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TinySignature basic example</title>
  <script src="TinySignature.js"></script>
  <style>
    .signature-box {
      width: 100%;
      height: 300px;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      overflow: hidden;
    }

    .signature-box canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="signature-box">
    <canvas id="signature-canvas"></canvas>
  </div>

  <button type="button" id="clear">Clear</button>
  <button type="button" id="undo">Undo</button>
  <button type="button" id="redo">Redo</button>
  <button type="button" id="save">Save PNG</button>

  <script>
    const signature = new TinySignature(document.getElementById('signature-canvas'), {
      backgroundColor: '#ffffff',
      penColor: '#111827',
    });

    signature.resizeCanvas();

    document.getElementById('clear').addEventListener('click', () => signature.clear());
    document.getElementById('undo').addEventListener('click', () => signature.undo());
    document.getElementById('redo').addEventListener('click', () => signature.redo());

    document.getElementById('save').addEventListener('click', () => {
      if (signature.isEmpty()) {
        alert('Please sign first.');
        return;
      }

      signature.download('signature.png', 'image/png');
    });

    window.addEventListener('resize', () => signature.resizeCanvas({ preserve: true }));
  </script>
</body>
</html>
```

---

## Options

Pass options as the second argument:

```js
const signature = new TinySignature(canvas, options);
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `dotSize` | `number` | `0` | Radius for single-point dots. When `0`, TinySignature uses the average of `minWidth` and `maxWidth`. |
| `minWidth` | `number` | `0.5` | Minimum stroke width in CSS pixels. Fast strokes will not go below this value. |
| `maxWidth` | `number` | `2.5` | Maximum stroke width in CSS pixels. Slow strokes can reach this value. |
| `penColor` | `string` | `'black'` | CSS color used for new strokes. |
| `minDistance` | `number` | `5` | Minimum distance between captured points. Higher values reduce data size and smooth tiny jitter. |
| `velocityFilterWeight` | `number` | `0.7` | Weight used to smooth velocity-based stroke width. Values closer to `1` react faster. |
| `backgroundColor` | `string` | `'rgba(0,0,0,0)'` | Background fill used when clearing/redrawing the canvas. Use an opaque color for JPG export. |
| `throttle` | `number` | `16` | Milliseconds between move updates. Use `0` to disable throttling. |
| `compositeOperation` | `string` | `'source-over'` | Canvas `globalCompositeOperation` used for new strokes. |
| `canvasContextOptions` | `object` | `{}` | Options passed to `canvas.getContext('2d', options)`. |

---

## Public API

### `new TinySignature(canvas, options)`

Creates a new signature component.

```js
const signature = new TinySignature(canvas, {
  penColor: '#0f172a',
  backgroundColor: '#ffffff',
});
```

---

### `clear()`

Clears the canvas and removes stored point data.

```js
signature.clear();
```

---

### `redraw()`

Redraws the current stored signature data.
This is useful after changing background color or manually changing canvas size.

```js
signature.redraw();
```

---

### `resizeCanvas(options)`

Resizes the canvas backing store using the current `devicePixelRatio`.
This keeps strokes sharp on retina/HiDPI screens.

```js
signature.resizeCanvas({ preserve: true });
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `preserve` | `boolean` | `true` | Redraw existing signature after resizing. |

---

### `isEmpty()`

Returns `true` when there is no signature.

```js
if (signature.isEmpty()) {
  alert('Please sign first.');
}
```

---

### `undo()`

Removes the latest stroke.
Returns `true` if a stroke was removed.

```js
signature.undo();
```

---

### `redo()`

Restores the latest undone stroke.
Returns `true` if a stroke was restored.

```js
signature.redo();
```

---

### `setPenColor(color)`

Changes the color for future strokes.
Existing strokes keep their original color.

```js
signature.setPenColor('#7c3aed');
```

---

### `setBackgroundColor(color, options)`

Changes the canvas background color.

```js
signature.setBackgroundColor('#fff7ed');
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `redraw` | `boolean` | `true` | Immediately repaint the canvas with the new background. |

---

### `setStrokeWidth(minWidth, maxWidth)`

Changes the stroke width range for future strokes.

```js
signature.setStrokeWidth(0.8, 4.2);
```

---

### `setCompositeOperation(compositeOperation)`

Changes the canvas composite operation for future strokes.

```js
signature.setCompositeOperation('source-over');
```

---

### `toData()`

Returns a deep clone of the raw signature point groups.
Use this if you want to store the signature as JSON.

```js
const data = signature.toData();
localStorage.setItem('signature', JSON.stringify(data));
```

---

### `fromData(pointGroups, options)`

Restores a signature from raw point data.

```js
const data = JSON.parse(localStorage.getItem('signature'));
signature.fromData(data);
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `clear` | `boolean` | `true` | Clear the canvas before drawing the imported data. |

---

### `toDataURL(type, encoderOptions)`

Exports the signature as a data URL.

```js
const png = signature.toDataURL('image/png');
const jpg = signature.toDataURL('image/jpeg', 0.92);
const svg = signature.toDataURL('image/svg+xml', {
  includeBackgroundColor: true,
});
```

Supported export types:

| Type | Notes |
|---|---|
| `image/png` | Best default. Supports transparency. |
| `image/jpeg` | Use an opaque `backgroundColor`, otherwise transparent pixels may become black. |
| `image/svg+xml` | Vector export from stored point data. |

---

### `toSVG(options)`

Exports SVG markup directly.

```js
const svgMarkup = signature.toSVG({
  includeBackgroundColor: true,
  includeDataUrl: true,
});
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `includeBackgroundColor` | `boolean` | `false` | Adds a `<rect>` with the current `backgroundColor`. |
| `includeDataUrl` | `boolean` | `false` | Includes an imported image data URL, if one was loaded with `fromDataURL()`. |

---

### `download(filename, type, encoderOptions)`

Exports and downloads the signature.

```js
signature.download('signature.png', 'image/png');
signature.download('signature.jpg', 'image/jpeg', 0.92);
signature.download('signature.svg', 'image/svg+xml', {
  includeBackgroundColor: true,
});
```

---

### `fromDataURL(dataUrl, options)`

Draws an image data URL onto the canvas.
This can be useful when you want to load a previously saved raster signature.

```js
signature.fromDataURL(savedPngDataUrl, {
  xOffset: 0,
  yOffset: 0,
});
```

| Option | Type | Default | Description |
|---|---:|---:|---|
| `ratio` | `number` | `devicePixelRatio` | Pixel ratio used for width/height defaults. |
| `width` | `number` | `canvas.width / ratio` | Drawn image width in CSS pixels. |
| `height` | `number` | `canvas.height / ratio` | Drawn image height in CSS pixels. |
| `xOffset` | `number` | `0` | Horizontal placement offset. |
| `yOffset` | `number` | `0` | Vertical placement offset. |

---

### `on()` / `off()`

Enable or disable drawing event listeners.

```js
signature.off(); // read-only mode
signature.on();  // drawing mode
```

---

### `destroy()`

Removes component event listeners.
Call this before removing the canvas from the DOM.

```js
signature.destroy();
```

---

## Events

TinySignature exposes DOM-style events with `addEventListener()`.

```js
signature.addEventListener('endStroke', () => {
  console.log('Signature updated');
});
```

| Event | Cancelable | Description |
|---|---:|---|
| `beginStroke` | Yes | Fired before a new stroke starts. Call `event.preventDefault()` to block it. |
| `beforeUpdateStroke` | No | Fired before a point is added to the active stroke. |
| `afterUpdateStroke` | No | Fired after a point is processed. |
| `endStroke` | No | Fired after the active stroke ends. |
| `clear` | No | Fired after `clear()` is called. |
| `undo` | No | Fired after a successful undo. |
| `redo` | No | Fired after a successful redo. |

Event details for stroke events include:

```js
{
  event,    // original MouseEvent, TouchEvent, or PointerEvent
  type,     // original event type
  x,        // viewport x coordinate
  y,        // viewport y coordinate
  pressure  // pointer pressure where available
}
```

---

## Keyboard shortcuts example

```js
window.addEventListener('keydown', (event) => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const modifierPressed = isMac ? event.metaKey : event.ctrlKey;

  if (!modifierPressed) return;

  if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
    event.preventDefault();
    signature.undo();
  }

  if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
    event.preventDefault();
    signature.redo();
  }
});
```

---

## Saving data on the server

You have two common options.

### Option A: Save as image

```js
const pngDataUrl = signature.toDataURL('image/png');
```

Send `pngDataUrl` to your backend and store it as an image.

### Option B: Save as JSON points

```js
const pointData = signature.toData();
const json = JSON.stringify(pointData);
```

This is usually smaller and allows SVG/vector export later, but it requires TinySignature to render it again.

---

## Best practice for JPG export

JPEG does not support transparency. Use an opaque background color:

```js
const signature = new TinySignature(canvas, {
  backgroundColor: '#ffffff',
});

signature.download('signature.jpg', 'image/jpeg', 0.92);
```

---

## Demo

Open:

```txt
demo/demo.html
```

The demo includes:

- Color controls
- Paper/background controls
- Stroke width slider
- Clear / undo / redo
- Keyboard shortcuts
- PNG / JPG / SVG export
- Live preview
- Responsive, polished UI

---

## Browser support notes

TinySignature uses modern browser APIs:

- Canvas 2D
- Pointer events where available
- Touch/mouse fallback
- `CustomEvent`
- `Blob`
- `URL.createObjectURL`

The code includes a fallback for older `CustomEvent` and `EventTarget` behavior.

---

## Performance notes

TinySignature is designed to stay fast while drawing:

- DOM references are not repeatedly queried internally.
- Pointer move events are throttled by default.
- Tiny jitter is filtered using `minDistance`.
- Canvas drawing avoids full redraw during active strokes.
- Redraw is only used when needed: resize, undo, redo, background changes, and import.

For very large canvases or long sessions, increasing `minDistance` slightly can reduce stored point count and improve performance.

---

## License / source note

The core stroke algorithm is adapted from the provided `signature_pad` source files and converted into this standalone TinySignature component.
Check the license of your original source package before publishing or redistributing commercially.
