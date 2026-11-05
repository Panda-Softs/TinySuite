# TinyLightbox

> A framework-free, image-only lightbox with modern keyboard, touch and zoom interactions. It works **on its own** or as TinyGallery's viewing dependency.

![TinyLightbox interactive demo](demo/images/previews/viewer-desktop.png)

**Version:** 2.0 · **Language:** vanilla JavaScript · **Dependencies:** none · **Build step:** none.

## 1. What is included

- Full-screen, native `<dialog>` lightbox, with a compact toolbar and live image counter.
- Previous/next buttons, looping (optional), image preloading, and `goTo()`.
- Keyboard: Left / Right, Home / End, `+`, `-`, `0`, `Escape`.
- Wheel zoom, double-click zoom toggle, bounded drag-to-pan, two-finger pinch, mouse and touch swipe at 1×.
- Live finger-follow and mouse-drag gestures, elastic rebound, adjustable distance/velocity thresholds, and vertical swipe-to-close.
- Configurable `fade` / `slide` / `zoom` / `none` entrance, image-change and exit effects (reduced-motion aware).
- Responsive `srcset` / `sizes`, optional plain-text descriptions and caption placement (`top`, `bottom`, `left`, `right`).
- Developer-configurable SVG path icons and per-image `zoom: false`.
- `insertSlide()`, `removeSlide()`, `reload()`, `once()` and before/after lifecycle events.
- Optional animation from the source thumbnail, honoring `prefers-reduced-motion`.
- Async editor hook which **closes the lightbox before opening the external editor**.
- An accessible modal and focus restoration; scoped CSS; dynamic collections; event subscriptions; `destroy()`.
- An explicit error state for a broken image, rather than retaining the previous image.

**Not included:** upload, physical image removal, persistent storage, crops/editing itself, video, iframe or arbitrary HTML slides.

## 2. Files

```text
TinyLightbox/
├── TinyLightbox.js
├── TinyLightbox.css
├── TinyLightbox.scss
├── README.md
├── demo/
│   ├── index.html
│   ├── demo.css
│   ├── demo.js
│   ├── lake-*.svg
│   ├── images/lake/lake-1.svg ... lake-6.svg
│   └── preview-*.png / viewer-*.png
└── tests/
    ├── test_lightbox.py
    └── test_advanced.py
```

`TinyLightbox.css` is already browser-ready. The SCSS file contains the same standalone styles, for optional integration into a Sass build.

## 3. Quick start: HTML gallery mode

```html
<link rel="stylesheet" href="/assets/TinyLightbox/TinyLightbox.css">

<div id="fleet-gallery">
  <a href="/products/boat-main.webp" data-lightbox data-lightbox-title="A beautiful day">
    <img src="/products/boat-thumb.webp" alt="Boat on the lake">
  </a>
  <a href="/products/boat-detail.webp" data-lightbox>
    <img src="/products/boat-detail-thumb.webp" alt="Boat interior">
  </a>
</div>

<script src="/assets/TinyLightbox/TinyLightbox.js"></script>
<script>
  const viewer = new TinyLightbox('#fleet-gallery');
  // Delegates clicks from the [data-lightbox] elements.

  // When removing the hosting UI:
  viewer.destroy();
</script>
```

A `data-lightbox-src` attribute overrides the element's `href`, and `data-lightbox-id`, `data-lightbox-title`, and `data-lightbox-alt` supply extra metadata. Thumbnail elements are not modified or moved by TinyLightbox.

## 4. Standalone JavaScript mode

```javascript
const viewer = new TinyLightbox({
  images: [
    { id: 'boat', src: '/products/boat.webp', title: 'Boat', alt: 'Red pedal boat' },
    { id: 'detail', src: '/products/detail.webp', alt: 'Seat detail' }
  ],
  loop: false,
  maxZoom: 5,
  onChange: image => console.log('Now viewing:', image.id),
  onEdit: async image => {
    // Implement the image editor in your application.
    const newUrl = await openMyEditor(image.src);
    return newUrl ? { src: newUrl } : null;
  }
});

viewer.open('boat');
viewer.next();
viewer.zoomIn();
viewer.resetZoom();
viewer.close();
viewer.destroy();
```

`onEdit` receives `{ id, src, title, alt, thumbnail }` and the viewer instance. Returning an object with a **new `src`** updates only the viewer's in-memory descriptor. Returning `null` or `false` cancels. The viewer does not write file bytes or persist the replacement; the host must coordinate persistence. Only one lightbox instance may be open at a time.

## 5. All options

| Option | Default | Purpose |
|---|---|---|
| `images` | `[]` | Array of image descriptors or URL strings |
| `selector` | `[data-lightbox]` | Elements delegated from the optional root |
| `loop` | `true` | Wrap after the first / last image |
| `maxZoom` | `5` | Maximum zoom factor |
| `zoomStep` | `0.5` | Zoom change for a click or wheel increment |
| `wheelZoom` | `true` | Enable wheel zoom when pointing at the image |
| `swipe` | `true` | Enable horizontal swipe at 1× |
| `mouseSwipe` | `true` | Enable drag-to-navigate with a mouse |
| `swipeThreshold` | `65` | Minimum swipe distance (CSS px) |
| `swipeVelocity` | `0.6` | Minimum flick velocity (px/ms) when displacement exceeds 24px |
| `verticalClose` | `true` | Allow vertical drag-to-dismiss at 1× |
| `verticalCloseThreshold` | `110` | Vertical displacement required for close (CSS px) |
| `closeVelocity` | `0.8` | Minimum dismiss velocity (px/ms) with displacement over 32px |
| `elasticity` | `0.3` | Resistance multiplier when dragging beyond a non-looping gallery edge |
| `effects` | `{open:'zoom',change:'slide',close:'fade'}` | `fade`, `slide`, `zoom` or `none` for each transition |
| `transitionDuration` | `200` | Slide-change and rebound animation (ms) |
| `captions` | `true` | Show plain-text image descriptions |
| `captionPosition` | `'bottom'` | Default caption position: `top`, `bottom`, `left`, `right` |
| `keyboard` | `true` | Enable key-driven navigation and zoom |
| `doubleClickZoom` | `true` | Toggle 2.5× zoom on image double-click |
| `preload` | `true` | Preload preceding/following image URL |
| `icons` | `{}` | Custom icon SVG path strings or trusted `SVGElement` instances |
| `closeOnBackdrop` | `true` | Close on a click outside the content |
| `animationDuration` | `240` | Entrance animation duration, milliseconds |
| `onEdit` | `null` | Optional async editor callback; edit control hidden when absent |
| `labels` | English defaults | Override accessible labels and status messages |
| `onOpen`, `onClose`, `onChange`, `onLoad`, `onZoom`, `onImageError`, `onEdited`, `onError` | `null` | Lifecycle callbacks |

Labels available: `dialog`, `close`, `previous`, `next`, `zoomIn`, `zoomOut`, `reset`, `edit`, `loading`, `error`.

## 6. Public methods and properties

| API | Returns | Details |
|---|---|---|
| `open(indexOrId = 0, trigger?)` | `boolean` | Opens by zero-based index or string ID; optional thumbnail for animation |
| `close({animate:true} = {})` | `void` | Animate closing; removal occurs after animation. Use `{animate:false}` for immediate teardown before another modal. |
| `goTo(index)` | `boolean` | Navigate to an explicit zero-based index |
| `next()` / `previous()` | `boolean` | Navigate respecting `loop` |
| `zoomTo(scale, x?, y?)` | `void` | Zoom, optionally centered on viewport coordinates |
| `zoomIn()` / `zoomOut()` | `void` | Zoom by `zoomStep` |
| `resetZoom()` | `void` | Return to 1× and centered |
| `setImages(images)` | `this` | Replace the collection; if open, preserve ID when possible |
| `insertSlide(item, position?)` | `this` | Validate and insert an image at an exact index |
| `removeSlide(idOrIndex)` | `boolean` | Remove by ID or index; preserves active image when possible |
| `reload()` | `this` | Re-read `[data-lightbox]` elements in DOM/root mode |
| `once(name, fn)` | unsubscribe function | Invoke a registered event listener only once |
| `edit()` | `Promise<boolean>` | Invoke injected editor (and close viewer first) |
| `on(name, listener)` | unsubscribe function | Attach an event listener |
| `off(name, listener)` | `this` | Detach a listener |
| `destroy()` | `void` | Remove dialog, root click listener, subscriptions, release references |

Properties: `current` (current descriptor), `index`, `images`, `scale`, `isOpen`.

Events: `beforeOpen`, `open`, `afterOpen`, `beforeChange`, `change`, `load`, `afterChange`, `beforeClose`, `close`, `afterClose`, `zoom`, `imageError`, `edited`, `insert`, `remove`, `error`.

`afterChange` fires once the new image has loaded (not merely when navigation starts). Images that cannot load emit `imageError` instead. `close()` retains an exit animation by default; `destroy()` and `close({animate:false})` always clean up synchronously.

```javascript
const unlisten = viewer.on('zoom', ({ scale }) => console.log(scale));
unlisten();
viewer.on('imageError', image => console.warn(image.src));
```

## 7. Keyboard and touch reference

| Interaction | Effect |
|---|---|
| Left / Right | Previous / next image |
| Home / End | First / last image |
| `+` / `-` / `0` | Zoom in / out / reset |
| Escape | Close lightbox |
| Wheel over image | Zoom around pointer |
| Double-click image | Toggle 1× / 2.5× |
| Pinch two fingers | Smooth scale up or down |
| Drag at zoom > 1× | Pan inside image limits |
| Horizontal swipe / mouse drag at 1× | Thumbnail follows pointer; release navigates or rebounds |
| Vertical drag at 1× | Dismiss when distance or velocity exceeds threshold |
| Pointer release below swipe threshold | Smooth return to center |

The native `<dialog>` supplies modal focus behavior. On close, the previous focused element is restored when still connected to the DOM. The viewer prevents page scrolling while open and restores the previous inline overflow setting.

## 8. Full interactive demo

**Open [`demo/index.html`](demo/index.html)**. The design references the soft violet, layered cards, inspector and theme switch from the supplied TinyInlineEditor demo, without depending on its scripts.

The demonstration includes: a six-photo nautical gallery; theme modes; configurable open/change/close transitions; mouse/touch swipe, vertical dismissal and distance/velocity thresholds; responsive source attributes and captions; custom SVG icons; per-image zoom; dynamic insert/remove/reload; `once()` and before/after events; error scenarios; a live inspector; and collapsible copyable code examples throughout.

**Offline launch:** double-click `TinyLightbox/demo/index.html` after extracting the ZIP.
The standalone demo loads SVGs from `demo/images/lake/`, with screenshots in `demo/images/previews/`, alongside local CSS and classic JS files via relative paths; no Base64 and no server are required.
No HTTP server, CDN, internet connection, or npm installation is required.
If automatic clipboard access is unavailable under `file://`, the Copy button selects
its snippet so you can copy it using Cmd+C / Ctrl+C.

The demo illustrations and screenshot assets are local. No CDN or API is required.

![Lightbox desktop demo](demo/images/previews/preview-desktop.png)

![Lightbox dark theme](demo/images/previews/preview-dark.png)

## 9. Validation and limitations

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 TinyLightbox/tests/test_lightbox.py
```

The test exercises Chromium desktop and mobile emulation, including navigation, keyboard, a missing image, focus restoration, standalone mode, zoom, synthetic pointer pinch/swipe and destruction. To use a locally installed Chromium, set `CHROME_BIN=/path/to/chromium`.

Limitations: physical-device Safari/iOS and Android have not been manually certified; pointer tests are simulated in Chromium. Entrance, slide-change and exit animations are configurable and honor reduced motion. `close()` is asynchronous when animations are enabled; use `close({animate:false})` for immediate removal before a cropper modal. A physical-device gesture audit (Safari/iPhone and Android) is still recommended. Editor cancellation or failures leave the stored file untouched. URL authorization, network access, server validation and image persistence remain the application's responsibility.

## 10. Advanced image descriptor

```javascript
{
  id: 'boat-1',
  src: 'images/lake/boat.webp',
  srcset: 'images/lake/boat-800.webp 800w, images/lake/boat-1600.webp 1600w',
  sizes: '(max-width: 640px) 100vw, 80vw',
  alt: 'Sailboat', title: 'On the lake',
  description: 'A calm morning near the mountains',
  captionPosition: 'bottom', zoom: true,
  thumbnail: document.querySelector('#boat-photo')
}
```

`srcset` and `sizes` are assigned to the actual viewer image (`<img>`); use real resolution-specific image files in production. The offline SVG demonstration uses only locally packaged files and does not fabricate higher-resolution variants. Descriptions use `textContent`, never HTML. A per-image `zoom: false` disables wheel/double-click/programmatic zoom and toolbar zoom controls. For security, **custom icons are developer-controlled SVG path data or SVG DOM elements, not user-supplied markup**.

## 11. Interaction and animation semantics

- At 1×, an eligible drag follows the pointer. The dominant direction selects horizontal navigation or vertical dismissal after a short dead zone. Under the distance and velocity thresholds, the image rebounds to its original position.
- At zoom > 1×, the same drag pans the image, not the gallery. Two-pointer pinch zooms around the moving midpoint. Pointers canceled by the browser never trigger navigation.
- `effects.open`, `effects.change`, and `effects.close` independently accept `fade`, `slide`, `zoom`, `none`. DOM thumbnails are never moved or wrapped.
- For a close requested while an exit animation is running, the viewer remains transiently mounted until the animation ends. A new `open()` or `destroy()` immediately finalizes any pending close to avoid stale dialogs or scroll locks.
- `close({animate:false})` is required before displaying a separate native modal editor. `edit()` already uses this mode.
- `insertSlide` and `removeSlide` update in-memory descriptors only. Image creation, storage and deletion remain the host application's responsibility.

## 12. Advanced validation

```bash
python3 TinyLightbox/tests/test_lightbox.py
python3 TinyLightbox/tests/test_advanced.py
```

The advanced suite covers: drag following, elastic rebound, horizontal mouse drag and vertical dismissal, transitions, responsive attributes, caption positions, plain-text safety, icon overrides, per-image zoom, dynamic slides and stable identities, `once()`, ordered events, return-to-focus and destruction. Browser automation uses injected local resources because the test sandbox prohibits navigating to `file://`; the actual demo uses relative SVG files and classic scripts so it can be opened via `file://` on a local computer.
