# TinyColorPicker

A compact, dependency-free ES6 color picker intended to replace the legacy ColorPick.js integration in fx-base.

## Files

```text
TinyColorPicker.js
TinyColorPicker.css
TinyColorPicker.scss
README.md
LICENSE
demo/
  demo.html
  demo.css
  tiny-color-picker-logo.svg
```

There is intentionally **no `src/`, no `dist/`, no package.json and no build step**.

## Run the demo

Open `demo/demo.html` directly in a browser. It uses classic `<script src="...">` loading and therefore does not require a local HTTP server or ES module CORS permissions.

The demo starts in the light color scheme. The switch in the header changes the document's native `color-scheme`, so every TinyColorPicker instance updates automatically.

## Basic usage

```html
<style>
:root {
    color-scheme: light dark;
}
</style>

<link rel="stylesheet" href="TinyColorPicker.css">
<script src="TinyColorPicker.js"></script>

<input class="colorpicker" value="#3498DB">

<script>
const picker = new TinyColorPicker(document.querySelector('.colorpicker'), {
    allowCustomColor: true,
    allowClearColor: true
});
</script>
```

## Native light / dark mode

TinyColorPicker does **not** expose a `theme` option and does **not** keep theme state in JavaScript.

The picker uses CSS `light-dark()` values and inherits the active `color-scheme` from the document. This keeps the component synchronized with native browser/OS color-scheme handling and with any document-level scheme switcher.

For automatic OS/browser preference:

```css
:root {
    color-scheme: light dark;
}
```

You can express the same support in HTML:

```html
<meta name="color-scheme" content="light dark">
```

To force one scheme for the whole document from JavaScript:

```js
document.documentElement.style.colorScheme = 'dark';
// or:
document.documentElement.style.colorScheme = 'light';
```

This is intentionally global. The component no longer accepts `theme: 'light'`, `theme: 'dark'`, or `theme: 'auto'`, and the former `setTheme()` method has been removed.

The implementation follows the native `color-scheme` / `light-dark()` approach described in:
https://pepelsbey.dev/articles/native-light-dark/

## Parent container / TinySwal

Use a selector or an Element. When a selector is supplied, TinyColorPicker first searches from the input with `closest()` and then falls back to `document.querySelector()`.

```js
new TinyColorPicker(input, {
    parentContainer: '.tiny-swal-popup'
});
```

## Styling the selected color

TinyColorPicker does **not** write `background-color` on the input. It exposes the selected value through CSS variables:

- `--tcp-color`
- `--tcp-color-contrast`
- `--tcp-color-soft`
- `--tcp-color-border`

When there is no selected color, the input receives `.tcp-input--empty` and `--tcp-color` is `transparent`.

Example for fx-base / Materialize:

```css
.input-field > .colorpicker {
    border-radius: 6px !important;
    height: 2.5rem !important;
    margin-top: .5rem !important;
    background: var(--tcp-color-soft) !important;
    border: 1px solid var(--tcp-color-border) !important;
}

.input-field > .colorpicker:not(.tcp-input--empty) {
    background: color-mix(in srgb, var(--tcp-color) 16%, transparent) !important;
    border-color: color-mix(in srgb, var(--tcp-color) 72%, light-dark(#cbd5e1, #475569)) !important;
}

.input-field > .colorpicker.tcp-input--empty {
    background: transparent !important;
    border-color: light-dark(#cbd5e1, #475569) !important;
}
```

## Main options

```js
{
    initialColor: '#3498DB',
    paletteLabel: 'Default palette:',
    recentLabel: 'Recent:',
    customColorLabel: '', // optional; original ColorPick had no HEX label
    customPickerLabel: 'Custom color', // accessibility/title for the native picker swatch
    allowRecent: true,
    recentMax: 5,
    allowCustomColor: false,
    allowClearColor: false,
    palette: TinyColorPicker.defaultPalette,
    parentContainer: null,
    direction: 'auto', // auto | down | up
    storageKey: 'colorPickRecentItems',
    closeOnSelect: true,
    onColorSelected(color, element) {}
}
```

## Custom colors

With `allowCustomColor: true`, TinyColorPicker keeps the manual HEX field and adds one 20x20 multicolor swatch to the palette. Clicking it opens the browser's native `input[type=color]` chooser, so any color can be selected without knowing its HEX value. The swatch uses the same geometry as the original ColorPick controls and does not change the picker width or spacing. Interactive swatches are rendered as `div` elements with `role="button"` and `tabindex="0"`, with Enter/Space keyboard support.

```js
new TinyColorPicker(input, {
    allowCustomColor: true
});
```

## Visual compatibility

The light color scheme intentionally keeps the original ColorPick.js geometry: a 140px content area, 15px padding, 20x20px swatches, 5px radii, the original clear-color slash, and the original palette/recent label spacing.

Dark colors are resolved by CSS from the document's native color scheme. TinyColorPicker itself only adds the requested `tcp-` class names, positioning, animation and input CSS variables.

## Dropdown lifecycle

The picker DOM is rendered **once when the TinyColorPicker instance is created**. By default it is appended to `document.body`, which keeps it above cards and other stacking contexts. An explicit `parentContainer` keeps it inside a dialog/modal when needed. `show()` only refreshes dynamic content, positions the existing picker and opens it; `hide()` only removes the open state. The dropdown is removed only by `destroy()`.

## API

```js
picker.getValue();
picker.setValue('#E74C3C');
picker.clear();
picker.show();
picker.hide();
picker.toggle();
picker.destroy();
```

A `tinycolorpicker:change` CustomEvent is emitted when the color changes.
