# TinyChips

Standalone vanilla JavaScript chips input component.

TinyChips supports two mounting modes:

1. **Container mode**: instantiate on a `<div>`.
2. **Input source mode**: instantiate directly on an `<input>`. The input remains the real form field and is synchronized automatically.

## Files

```txt
TinyChips.js
TinyChips.css
TinyChips.scss
demo/demo.html
```

## Basic container usage

```html
<link rel="stylesheet" href="TinyChips.css">

<div id="chips"></div>

<script src="TinyChips.js"></script>
<script>
const chips = new TinyChips(document.querySelector('#chips'), {
    placeholder: 'Add a tag',
    secondaryPlaceholder: '+ Tag'
});
</script>
```

## Input source mode

Use this when the chips value must be submitted with a form.

```html
<input
    id="reservation_tags"
    name="reservation[tags]"
    value='["Frontend","Design, UX"]'
    data-url="/fxbase/reservation/tags"
    placeholder="Liste de balises">
```

```js
const chips = new TinyChips(document.querySelector('#reservation_tags'), {
    valueMode: 'json'
});
```

TinyChips will:

- keep the original input as the form source of truth,
- hide it visually,
- create the visible chips UI after it,
- synchronize `input.value` whenever chips change.

## Value modes

### JSON mode

Default.

```html
<input value='["Frontend","Design, UX"]'>
```

```js
new TinyChips(input, {
    valueMode: 'json'
});
```

Stored value:

```txt
["Frontend","Design, UX"]
```

This is the safest mode because tags may contain commas.

### CSV mode

```html
<input value="Frontend,Security,JS">
```

```js
new TinyChips(input, {
    valueMode: 'csv',
    separator: ','
});
```

You can change the separator:

```js
new TinyChips(input, {
    valueMode: 'csv',
    separator: '|'
});
```

## `val()` getter/setter

```js
chips.val(); 
```

Returns the serialized source value:

```txt
["Frontend","Design, UX"]
```

Set a new value:

```js
chips.val('["Updated","From val()"]');
```

For CSV:

```js
chips.val('Frontend|Security|JS');
```

`val(value)` updates chips UI and synchronizes the source input.

## Deserialization behavior

TinyChips uses `deserializeValue(value)` internally for:

- initial input-source value,
- external `change` events on the source input,
- `val(value)`,
- string data passed to `setData()`.

It accepts:

```js
chips.val('Frontend,Security');      // CSV when valueMode is 'csv'
chips.val('["Frontend","UX"]');      // JSON when valueMode is 'json'
chips.val(['Frontend', 'UX']);       // Array
chips.val([{ value: 'Frontend' }]);  // Object array, using valueField/tagField/labelField
```

In JSON mode, invalid JSON falls back to CSV parsing instead of crashing. This is defensive behavior for legacy values.

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `data` | `Array \| String \| Object` | `[]` | Initial chips. Ignored in input mode when the input has a value. |
| `placeholder` | `String` | `''` | Placeholder when no chip exists. |
| `secondaryPlaceholder` | `String` | `''` | Placeholder when at least one chip exists. |
| `valueMode` | `'json' \| 'csv'` | `'json'` | Serialization mode for input source mode and `val()`. |
| `separator` | `String` | `','` | CSV separator. |
| `autocompleteOptions` | `Object` | `{}` | Built-in autocomplete config. |
| `autocompleteOptions.url` | `String` | `''` | Remote autocomplete endpoint. |
| `autocompleteOptions.loadOnce` | `Boolean` | `false` | Fetches the URL once without appending `?q=...`, then filters locally. |
| `autocompleteOptions.preload` | `Boolean` | `false` | When used with `loadOnce`, loads suggestions immediately during setup instead of first search. |
| `autocompleteOptions.queryParam` | `String` | `'q'` | Query parameter used for normal per-query AJAX autocomplete. Ignored when `loadOnce` is true. |
| `autocompleteUrl` | `String` | `''` | Remote autocomplete endpoint. Alias of `autocompleteOptions.url`. |
| `limit` | `Number` | `Infinity` | Maximum number of chips. |
| `allowDuplicates` | `Boolean` | `false` | Allows duplicate tags. |
| `trimValue` | `Boolean` | `true` | Trims input before creating a chip. |
| `separators` | `Array` | `['Enter']` | Keys that create a chip. |
| `pattern` | `String \| RegExp \| null` | Unicode-safe default | Validation pattern applied before creating a chip. Set to `null` to disable. |
| `patternFlags` | `String` | `'u'` | Regex flags when `pattern` is a string. |
| `valueField` | `String` | `'value'` | Object field used as chip value/tag. Supports dot paths. |
| `labelField` | `String` | `'label'` | Object field used for display label. Supports dot paths. |
| `tagField` | `String` | `'tag'` | Object field used before `valueField`. Supports dot paths. |
| `imageField` | `String` | `'image'` | Object field used for chip/avatar image. Supports dot paths. |
| `transformItem` | `Function` | `null` | Normalizes a single item before TinyChips reads fields. |
| `transformData` | `Function` | `null` | Normalizes a full data payload before TinyChips reads items. |
| `onChipAdd` | `Function` | `null` | Called after a chip is added. |
| `onChipSelect` | `Function` | `null` | Called after a chip is selected. |
| `onChipDelete` | `Function` | `null` | Called after a chip is deleted. |
| `onChipInvalid` | `Function` | `null` | Called when a chip is rejected. Receives `{ value, reason }`. |
| `onChange` | `Function` | `null` | Called on add, delete, select, `setData()` and `val(value)`. |

## `onChange`

Use `onChange` instead of repeating the same callback in `onChipAdd`, `onChipDelete` and `onChipSelect`.

```js
new TinyChips(input, {
    onChange(data, action, instance) {
        console.log(action); // add, delete, select, setData, val, external
        console.log(data);
        console.log(instance.val());
    }
});
```

## Data normalization

TinyChips can consume:

```js
['Frontend', 'Security']
```

```js
[
    { tag: 'Frontend' },
    { value: 'Frontend' },
    { label: 'Frontend', value: 'frontend' }
]
```

```js
{
    Frontend: null,
    Security: null
}
```

### Field mapping

If your objects contain the value in a specific field:

```js
new TinyChips(input, {
    valueField: 'value'
});
```

For nested fields:

```js
new TinyChips(input, {
    valueField: 'attributes.name',
    imageField: 'avatar.url'
});
```

### Transform one item

```js
new TinyChips(input, {
    transformItem(item) {
        return {
            value: item.id,
            label: item.name,
            image: item.avatar
        };
    }
});
```

### Transform a full payload

```js
new TinyChips(input, {
    transformData(payload) {
        return payload.items;
    }
});
```

## Static autocomplete

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        minLength: 1,
        limit: 6,
        data: ['React', 'Vue', 'Svelte'],
        onAutocomplete(value, item) {
            console.log(value, item);
        }
    }
});
```

For object values:

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        data: [
            { label: 'Ada Lovelace', value: 'Ada Lovelace', image: '/ada.jpg' },
            { label: 'Grace Hopper', value: 'Grace Hopper', image: '/grace.jpg' }
        ],
        valueField: 'value',
        labelField: 'label',
        imageField: 'image'
    }
});
```

## AJAX autocomplete

Use `autocompleteOptions.url`:

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        url: '/api/skills',
        queryParam: 'q',
        minLength: 2,
        debounce: 200,
        limit: 8
    }
});
```

The request URL becomes:

```txt
/api/skills?q=userInput
```

Supported default JSON response shapes:

```js
['JavaScript', 'CSS']
```

```js
{ "results": ['JavaScript', 'CSS'] }
```

```js
{ "items": [{ "label": "JavaScript", "value": "JavaScript" }] }
```

```js
{ "data": [{ "label": "JavaScript", "value": "JavaScript" }] }
```

For custom API responses, use `transformResponse`:

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        url: '/api/users',
        transformResponse(payload) {
            return payload.users.map((user) => ({
                label: user.full_name,
                value: user.full_name,
                image: user.avatar_url
            }));
        }
    }
});
```

## AJAX load-once autocomplete

Use this when the endpoint returns the complete suggestion list and you do **not** want a request for every typed character.

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        url: '/api/all-skills',
        loadOnce: true,
        minLength: 1,
        limit: 8
    }
});
```

Behavior:

1. The URL is fetched once, without `?q=...`.
2. The returned list is cached inside `autocompleteOptions.data`.
3. Later typing filters that cached list locally.
4. No additional AJAX request is made for each character.

With preload:

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        url: '/api/all-skills',
        loadOnce: true,
        preload: true
    }
});
```

Use `preload: true` only when you really want to load suggestions immediately. Otherwise, TinyChips waits until the user types for the first time.

### Load-once URL via data attribute

For this use case, prefer the semantic attribute:

```html
<input
    id="chips"
    data-autocomplete-source-url="/api/all-skills">
```

or:

```html
<input
    id="chips"
    data-source-url="/api/all-skills">
```

Both aliases automatically enable `autocompleteOptions.loadOnce`.

You can also be explicit:

```html
<input
    id="chips"
    data-autocomplete-url="/api/all-skills"
    data-autocomplete-load-once="true">
```


## AJAX URL via data attribute

You can declare the autocomplete URL in HTML:

```html
<input
    id="chips"
    data-autocomplete-url="/api/skills">
```

Then initialize normally:

```js
new TinyChips(document.querySelector('#chips'), {
    autocompleteOptions: {
        minLength: 1,
        limit: 8
    }
});
```

Supported attributes:

```txt
data-autocomplete-url
data-url
data-tiny-chips-url
data-chips-url
data-autocomplete-source-url
data-source-url
data-autocomplete-load-once
data-autocomplete-preload
data-pattern
data-pattern-flags
data-limit
data-placeholder
data-secondary-placeholder
data-value-mode
data-separator
data-value-field
data-label-field
data-tag-field
data-image-field
data-autocomplete-value-field
data-autocomplete-label-field
data-autocomplete-tag-field
data-autocomplete-image-field
```

URL naming guidance:

- Use `data-autocomplete-url` or `data-url` for per-query autocomplete. TinyChips calls the endpoint as `url?q=input`.
- Use `data-autocomplete-source-url` or `data-source-url` when the endpoint returns the complete list and should be loaded only once.


## Validation

TinyChips validates input before creating a chip.

Default validation pattern:

```js
/^[\p{L}\p{N}][\p{L}\p{N}'’‘`´ʼ._,\-\s]*$/u
```

Accepted by default:

```txt
Jean-Pierre
O'Connor
D’Angelo
Müller
Élodie
tag_1
product, basic
v2.1
```

Rejected by default:

```txt
;..--
---
...
,,,
```

Validation behavior:

| Case | Behavior |
|---|---|
| Empty value | Chip is not created. |
| Duplicate value | Input value is cleared and nothing else happens. |
| Limit reached | Chip is not created and input is marked invalid. |
| Pattern mismatch | Input/root receives invalid styling. The value stays visible so the user can correct it. |
| User types again | Invalid styling is removed. |

Possible `onChipInvalid` reasons:

```txt
empty
duplicate
limit
pattern
```

## Smart dropdown placement

The autocomplete dropdown opens below the chips field by default.
If there is not enough viewport space below, it automatically opens above.

Relevant classes:

```txt
.has-autocomplete-bottom
.has-autocomplete-top
.tiny-chips__autocomplete.is-bottom
.tiny-chips__autocomplete.is-top
```

If the root/source input has class `dropdown-up`, the dropdown is forced upward.

## Methods

```js
chips.getData();
chips.setData([{ tag: 'Frontend' }]);
chips.addChip({ tag: 'JavaScript' });
chips.deleteChip(0);
chips.selectChip(0);
chips.val();
chips.val('["Frontend","Security"]');
chips.destroy();
```

## CSS custom properties

```css
.my-chips {
    --tiny-chips-border-color-focus: #7c3aed;
    --tiny-chips-chip-background: #ede9fe;
    --tiny-chips-chip-text-color: #3b0764;
    --tiny-chips-chip-background-selected: #7c3aed;
    --tiny-chips-dropdown-background: #fff;
    --tiny-chips-dropdown-option-active-background: #e0ecff;
    --tiny-chips-radius: 999px;
}
```

## Keyboard behavior

- `Enter`: add chip.
- `Backspace` on empty input: select previous chip.
- `Backspace` / `Delete` on selected chip: delete chip.
- `ArrowLeft` / `ArrowRight`: navigate selected chips.
- `ArrowDown` / `ArrowUp`: navigate autocomplete options.
- `Escape`: close autocomplete.
