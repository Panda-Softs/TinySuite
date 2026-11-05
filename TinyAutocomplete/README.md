# TinyAutocomplete

TinyAutocomplete is a dependency-free autocomplete component for native `<input>` elements.

It is intentionally separate from select-style components. Use it when the user types into an input and selects a suggestion, while keeping the selected value inside the same input.

## Features

- Vanilla JavaScript, no jQuery dependency.
- Works with local data or remote AJAX/fetch endpoints.
- Fast default sorting: best match position first, alphabetical fallback.
- Renderer receives the full object returned by AJAX.
- Built-in fast highlighting via `<span class="highlight">...</span>`.
- Keyboard support: ArrowDown, ArrowUp, Enter, Escape, Tab.
- AbortController support for stale AJAX requests.
- Safe instance API: `TinyAutocomplete.init()` and `TinyAutocomplete.getInstance()`.
- URL can be provided through `options.url`, `data-url`, or `url` attribute.

## Installation

Include the JavaScript and compiled CSS:

```html
<link rel="stylesheet" href="tiny-autocomplete.css">
<script src="TinyAutocomplete.js"></script>
```

If you use SCSS, import:

```scss
@import "tiny-autocomplete";
```

## Basic HTML

```html
<input id="city" type="text" placeholder="Search city">
```

```js
TinyAutocomplete.init('#city', {
    data: [
        { value: 'Lausanne' },
        { value: 'Genève' },
        { value: 'Zürich' }
    ]
});
```

## API

### `TinyAutocomplete.init(selector, options)`

Initializes all matching inputs and returns an array of instances.

```js
const instances = TinyAutocomplete.init('input.autocomplete', options);
```

### `TinyAutocomplete.getInstance(input)`

Returns the existing instance for an input.

```js
const instance = TinyAutocomplete.getInstance('#city');
```

### Instance methods

| Method | Description |
|---|---|
| `search(query)` | Runs a search manually. |
| `open()` | Opens the dropdown if rendered. |
| `close()` | Closes the dropdown. |
| `clear()` | Clears the input and emits input/change events. |
| `enable()` | Enables the input. |
| `disable()` | Disables the input. |
| `setDisabled(boolean)` | Sets disabled state. |
| `destroy()` | Removes listeners and restores the original input. |

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `data` | `Array\|Object\|null` | `null` | Local data source. Array of objects is recommended. Object mode supports Materialize-style `{ "Apple": null }`. |
| `url` | `string\|null` | `null` | Remote endpoint. If absent, `data-url` or `url` attribute is used. |
| `queryParam` | `string` | `'q'` | Query string parameter used for remote search. |
| `limit` | `number` | `Infinity` | Maximum number of displayed suggestions. Sent as `limit` for remote requests when finite. |
| `minLength` | `number` | `1` | Minimum query length before searching. |
| `searchDelay` | `number` | `150` | Debounce delay in milliseconds. |
| `valueField` | `string` | `'value'` | Field written into the input when selecting an object. |
| `labelField` | `string\|null` | `null` | Field displayed by default renderer. Falls back to `valueField`. |
| `searchFields` | `string[]\|null` | `null` | Fields used for local matching and default sorting. Falls back to `valueField` + `labelField`. |
| `responsePath` | `string\|null` | `null` | Dot-path to the remote array, e.g. `'data.items'`. If omitted, direct arrays, `{data: []}`, and `{options: []}` are supported. |
| `headers` | `object\|null` | `{'X-Requested-With':'XMLHttpRequest'}` | Fetch headers. |
| `credentials` | `string` | `'same-origin'` | Fetch credentials mode. |
| `method` | `string` | `'GET'` | Fetch method. Current implementation appends query params to the URL. |
| `requestData` | `object\|Function\|null` | `null` | Extra query parameters. Function receives `(query, input, instance)`. |
| `mapResponse` | `Function\|null` | `null` | Custom response mapper. Receives `(json, query, instance)` and returns an array. |
| `sortFunction` | `Function\|null` | `null` | Custom sorter. Receives `(a, b, query)`. Default sorts by match position, then alphabetically. |
| `onAutocomplete` | `Function\|null` | `null` | Called after selection. Receives `(item, context)`. |
| `onInput` | `Function\|null` | `null` | Called on input. Receives `(query, input, instance)`. |
| `onClear` | `Function\|null` | `null` | Called when input becomes empty or `clear()` is called. |
| `onError` | `Function\|null` | `null` | Called when remote fetch fails. |
| `renderer` | `Function\|null` | `null` | Custom option renderer. Receives `(item, context)` and may return HTML string or Node. |
| `noResultsText` | `string` | `'Aucun résultat'` | Empty state text. |
| `loadingText` | `string` | `'Chargement…'` | Loading state text. |
| `errorText` | `string` | `'Erreur de chargement'` | Error state text. |
| `highlight` | `boolean` | `true` | Enables built-in `<span class="highlight">` wrapping. |
| `autoSelectFirst` | `boolean` | `false` | Preselects the first result. |
| `closeOnSelect` | `boolean` | `true` | Closes dropdown after selection. |
| `clearOnEscape` | `boolean` | `false` | Clears input when Escape is pressed while dropdown is closed. |
| `disabled` | `boolean` | `false` | Starts disabled. |

## Renderer context

`renderer(item, context)` receives:

| Property | Description |
|---|---|
| `query` | Current search query. |
| `index` | Result index. |
| `input` | Original input element. |
| `instance` | TinyAutocomplete instance. |
| `escape(value)` | HTML escaping helper. |
| `highlight(value)` | Escapes and highlights the current query with `<span class="highlight">`. |
| `value` | The computed selected value based on `valueField`. |

Example:

```js
TinyAutocomplete.init('#postcode', {
    url: '/locations',
    minLength: 2,
    limit: 20,
    valueField: 'postcode',
    searchFields: ['postcode', 'location'],
    renderer(item, { highlight }) {
        return `
            <span>${highlight(item.postcode)}</span>
            <small>${highlight(item.location)}</small>
        `;
    },
    onAutocomplete(item) {
        document.querySelector('#city').value = item.location || '';
    }
});
```

## Examples

### Local array

```js
TinyAutocomplete.init('#example-local', {
    data: [
        { value: 'Apple' },
        { value: 'Apricot' },
        { value: 'Banana' }
    ]
});
```

### Materialize-style object data

```js
TinyAutocomplete.init('#example-object', {
    data: {
        Apple: null,
        Microsoft: null,
        Google: null
    }
});
```

### AJAX with URL option

```js
TinyAutocomplete.init('#postcode', {
    url: '/api/locations',
    minLength: 2,
    limit: 20,
    valueField: 'postcode',
    searchFields: ['postcode', 'location'],
    onAutocomplete(item) {
        document.querySelector('#location').value = item.location || '';
    }
});
```

### AJAX with `data-url`

```html
<input id="postcode" data-url="/api/locations">
```

```js
TinyAutocomplete.init('#postcode', {
    valueField: 'postcode',
    searchFields: ['postcode', 'location']
});
```

### Custom sorting

```js
TinyAutocomplete.init('#priority', {
    data: products,
    valueField: 'name',
    sortFunction(a, b, query) {
        return Number(b.priority || 0) - Number(a.priority || 0);
    }
});
```

## Accessibility notes

The input is configured as a combobox with `aria-autocomplete="list"`, `aria-expanded`, and a listbox dropdown. Keyboard support includes arrows, Enter, Escape, and Tab.

## Security notes

If your renderer returns an HTML string, escape user-controlled values using `context.escape()` or `context.highlight()`. The default renderer escapes values automatically.

Unsafe:

```js
renderer(item) {
    return `<span>${item.name}</span>`;
}
```

Safe:

```js
renderer(item, { highlight }) {
    return `<span>${highlight(item.name)}</span>`;
}
```

## Browser support

Modern browsers. Fetch and AbortController are used for remote mode. For old browsers, provide polyfills or replace remote loading logic.
