# TinyDatePicker

**Current version: `1.1.0`**

TinyDatePicker is a pure JavaScript date picker with three rendering modes:
- `inline`
- `modal`
- `permanent`

It supports:
- synchronized month/year wheel selection
- single-date selection
- optional date range selection
- input-linked modal opening
- optional modal trigger button suffix
- optional wrapped trigger-button layout for modal inputs (`wrapInputTriggerButton`)
- CSS-variable based theming and sizing
- light / dark theme support
- `markDates` visual markers
- `events` day dots from arrays, functions, or AJAX
- locale-aware default date formatting
- locale-aware labels with global or per-instance overrides

## Project files

```text
TinyDatePicker.js
TinyDatePicker.scss
TinyDatePicker.css
README.md
demo.html
demo/
  index.html
  demo.css
  demo.js
  vendor/
    cleave-lite.js
```

The complete demo can be opened directly from either `demo.html` or `demo/index.html`, including through the `file://` protocol. It starts in dark mode and includes an accessible animated switch that changes the page and every picker between dark and light themes. It reproduces every example from the original demo: marked dates, all event source types, AJAX mocking, restrictions, modal single/range selection, the month/year wheel, permanent mode, live events and copy-ready code samples.

## Version

The component exposes its semantic version as a static property:

```js
TinyDatePicker.version; // "1.1.0"
```

## Quick start

```html
<link rel="stylesheet" href="./TinyDatePicker.css">
<script src="./TinyDatePicker.js"></script>

<input id="myDate" type="text">

<script>
  const picker = new TinyDatePicker('#myDate', {
    mode: 'modal',
    showClearBtn: true
  });
</script>
```

## Constructor

```js
const picker = new TinyDatePicker(target, options);
```

`target` may be:
- a DOM element
- a CSS selector string

## Main methods

```js
picker.open();
picker.close();
picker.toggle();
picker.setDate('2026-08-25');
picker.setDate(new Date(2026, 7, 25));
picker.getDate();
picker.val();
picker.val('2026-08-25');
picker.clear();
picker.destroy();
```

## Single-date API

### `setDate(value)`
Accepts:
- `Date`
- parseable date string

### `getDate()`
Returns:
- `Date` when a date is selected
- `null` otherwise

### `val()`
String getter/setter using the configured `dateFormat`.

## Range API

Enable range mode with:

```js
allowRangeSelection: true
```

Then use:

```js
picker.setRange('2026-08-10', '2026-08-15');
picker.setRange(new Date(2026, 7, 10), new Date(2026, 7, 15));
picker.getRange();
```

`getRange()` returns:

```js
{
  startDate: Date | null,
  endDate: Date | null,
  isComplete: boolean
}
```

### Range behavior

- first click starts the range
- the picker then waits for a second click
- hover previews the potential range while waiting
- the second click may be before the first one; the range is reordered automatically
- a range is accepted only if **every day in the interval is selectable**
- while only the start date is chosen, the input shows the start date followed by the separator

Default separator:

```js
rangeSeparator: ' – '
```

## Value property

```js
picker.value;
picker.value = '2026-08-25';
```

This is a string alias for `val()`.

## Global configuration

You can configure defaults before creating instances.

### Global date format

```js
TinyDatePicker.dateFormat = 'DD.MM.YYYY';
```

### Global locale

```js
TinyDatePicker.locale = 'fr';
```

Only the language part is used internally. For example:
- `fr-CH` → `fr`
- `en_US` → `en`

### Global i18n labels

Single pack:

```js
TinyDatePicker.i18n = {
  weekdaysMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
  months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
};
```

Locale map object:

```js
TinyDatePicker.i18n = {
  en: {
    weekdaysMin: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  },
  fr: {
    weekdaysMin: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  }
};
```

Array form is also accepted:

```js
TinyDatePicker.i18n = [
  { EN: { ... } },
  { FR: { ... } }
];
```

## Resolution order

### Locale
1. `options.locale`
2. `TinyDatePicker.locale`
3. browser locale (`navigator.language`, reduced to language only)

### Date format
1. `options.dateFormat`
2. `TinyDatePicker.dateFormat`
3. locale-derived default from `Intl.DateTimeFormat(...).formatToParts()`

### Labels
1. explicit `options.weekdaysMin / months / days`
2. `options.i18n` locale pack if provided
3. `TinyDatePicker.i18n` locale pack if provided
4. locale-derived labels from `Intl.DateTimeFormat`

### Action and period-selector labels
1. explicit `options.clearText / cancelText / confirmText / periodMonthText / periodYearText / periodDoneText`
2. `options.i18n` locale pack if provided
3. `TinyDatePicker.i18n` locale pack if provided
4. built-in English fallback (`Clear`, `Cancel`, `OK`)

## Locale-derived default format

TinyDatePicker exposes the helper used internally:

```js
TinyDatePicker.getLocaleDateFormat('fr');
// example: DD/MM/YYYY
```

A global helper is also available in the browser:

```js
getLocaleDateFormat('en');
```


TinyDatePicker also exposes locale labels:

```js
TinyDatePicker.getLocaleLabels('fr');
```

A global helper is also available in the browser:

```js
getLocaleLabels('en');
```

## Month and year wheel selector

Click the current month or year in the picker header to open the shared iOS-style wheel selector.
The month wheel uses absolute month positions internally, so scrolling from December to January automatically increments the year wheel, and scrolling from January to December decrements it. The selected day is not modified until a day is clicked in the calendar grid.

```js
const picker = new TinyDatePicker('#date', {
  locale: 'fr',
  showPeriodSelector: true,
  yearRange: [1950, 2035]
});
```

`yearRange` accepts either:

- a number such as `10`, meaning ten years before and after the current visible year;
- an inclusive `[minYear, maxYear]` array for an explicit range.

Months and years with no selectable day are disabled automatically. This respects `minDate`, `maxDate`, `dateRule`, `allowedMonths`, `allowedYears`, disabled lists, and `disableDayFn`.

## Options

| Option | Type | Default | Description |
|---|---|---:|---|
| `mode` | `String` | `'inline'` | `inline`, `modal`, or `permanent`. |
| `appendTo` | `Element` | `document.body` | DOM node receiving the calendar root when mounted. |
| `autoClose` | `Boolean` | `false` | Close after selection. |
| `allowRangeSelection` | `Boolean` | `false` | Enable start/end range selection. |
| `selectedRange` | `Object / Array / String` | `null` | Initial range. Accepts `{ startDate, endDate }`, `[start, end]`, or a formatted range string. |
| `rangeSeparator` | `String` | `' – '` | Separator used by range input values. |
| `inputTriggerMode` | `String` | `'focus'` | In modal mode, open via input focus/click or via a trigger button when set to `'button'`. A `data-tdp-trigger` attribute on the input can override this per element. |
| `wrapInputTriggerButton` | `Boolean` | `true` | In modal button-trigger mode, wraps the input and injected trigger button inside a helper element. |
| `closeOnEscape` | `Boolean` | `true` | Close on `Escape`. |
| `closeOnOutsideClick` | `Boolean` | `true` | Close when clicking outside. |
| `showPeriodSelector` | `Boolean` | `true` | Enable the shared month/year wheel selector from the header. |
| `disableWeekends` | `Boolean` | `false` | Disable Saturdays and Sundays. |
| `disableDayFn` | `Function` | `null` | Return `true` to disable a date. |
| `firstDay` | `Number` | `1` | First day of week. Default is Monday. |
| `minDate` | `Date / String` | `null` | Minimum selectable date. |
| `maxDate` | `Date / String` | `null` | Maximum selectable date. |
| `dateRule` | `String` | `null` | `gtNow`, `gteNow`, `ltNow`, `lteNow`. |
| `yearRange` | `Number / Array` | `10` | Wheel-selector year range. A number means `±N` years; `[minYear, maxYear]` defines an explicit inclusive range. |
| `showClearBtn` | `Boolean` | `false` | Show clear button. |
| `showCalendarDisplay` | `Boolean` | `true` | Show or hide the left display panel. |
| `locale` | `String` | browser locale | Locale used for default format and label resolution. |
| `i18n` | `Object / Array` | `null` | Optional locale pack or locale-pack collection. |
| `clearText` | `String` | locale/default | Clear button label. Resolved from explicit option, i18n packs, or fallback text. |
| `cancelText` | `String` | locale/default | Cancel button label. Resolved from explicit option, i18n packs, or fallback text. |
| `confirmText` | `String` | locale/default | Confirm button label. Resolved from explicit option, i18n packs, or fallback text. |
| `periodMonthText` | `String` | locale/default | Accessible month-wheel heading. |
| `periodYearText` | `String` | locale/default | Accessible year-wheel heading. |
| `periodDoneText` | `String` | locale/default | Button text used to return from the wheel selector to the day grid. |
| `dateFormat` | `String` | locale-derived | Output format used by `val()` and input sync. |
| `value` | `Date / String` | `null` | Initial single-date value or formatted range string in range mode. |
| `selectedDate` | `Date / String` | `null` | Initial selected date. |
| `weekdaysMin` | `Array<String>` | locale-derived | Explicit weekday labels override resolved i18n. |
| `months` | `Array<String>` | locale-derived | Explicit month labels override resolved i18n. |
| `days` | `Array<String>` | locale-derived | Explicit day labels override resolved i18n. |
| `markDates` | `Array` | `[]` | Dates visually marked via `tdp-date--marked`. |
| `events` | `Array / Function / Object` | `[]` | Event source used to render day dots. |
| `themeEventColor` | `String` | `''` | Default color for event dots when an event does not provide one. |
| `onSelect` | `Function` | `null` | Callback after selection. Receives a `Date` in single mode or a range object in range mode. |
| `onOpen` | `Function` | `null` | Callback when opened. |
| `onClose` | `Function` | `null` | Callback when closed. |
| `onDraw` | `Function` | `null` | Callback after redraw. |
| `theme` | `String` | `'light'` | Theme hint. |
| `classes` | `Object` | internal map | Override class names. |
| `parseDate` | `Function` | built-in | Custom parse function. |
| `formatDate` | `Function` | built-in | Custom format function. |
| `formatAriaLabel` | `Function` | built-in | Accessible label for a day cell. |

## `markDates` vs `events`

### `markDates`
Use `markDates` when you want a date cell to be visually marked without dots.

```js
markDates: [new Date(2026, 3, 4), new Date(2026, 3, 9)]
```

### `events`
Use `events` when you want dots under the day number.

#### Array of dates

```js
events: [new Date(2026, 3, 4), new Date(2026, 3, 9)]
```

#### Array of event objects

```js
events: [
  { date: '2026-04-10 08:48', color: '#ef4444' },
  { date: '2026-04-10 09:48', color: '#22c55e' },
  { date: '2026-04-12 11:15' }
]
```

#### Function source

```js
events(startDate, endDate) {
  return [
    { date: new Date(startDate.getFullYear(), startDate.getMonth(), 5, 9, 0), color: '#8b5cf6' }
  ];
}
```

#### AJAX source

```js
events: {
  url: '/calendar/events',
  method: 'GET',
  startParam: 'startDate',
  endParam: 'endDate',
  paramFormat: 'date'
}
```

Supported AJAX keys:
- `url`
- `method`
- `headers`
- `params`
- `startParam`
- `endParam`
- `paramFormat` (`'date'` or `'iso'`)
- `transformResponse(payload, range, options)`

Accepted response shapes:
- array
- `{ events: [...] }`
- `{ data: [...] }`

## Input-linked modal behavior

### Default modal trigger

```js
new TinyDatePicker('#checkin', {
  mode: 'modal'
});
```

The modal opens when the input is focused or clicked.

### Button trigger mode

```html
<input id="checkin" data-tdp-trigger="button">
```

```js
new TinyDatePicker('#checkin', {
  mode: 'modal'
});
```

The component injects a small calendar button at the right side of the input.
The input remains editable, but the modal opens via the button.

### Reusing an existing trigger button

If the input parent already contains an element with the trigger class, TinyDatePicker reuses it instead of injecting a new one.

```html
<div class="field">
  <input id="checkin" data-tdp-trigger="button">
  <button type="button" class="tdp-input-trigger" aria-label="Open calendar"></button>
</div>
```

### Disabling the wrapper

```js
new TinyDatePicker('#checkin', {
  mode: 'modal',
  inputTriggerMode: 'button',
  wrapInputTriggerButton: false
});
```

## Custom events

```js
picker.on('tdp:change', (event) => {
  console.log(event.detail.value, event.detail.date, event.detail.range);
});
```

The component emits:
- `tdp:open`
- `tdp:close`
- `tdp:draw`
- `tdp:select`
- `tdp:change`
- `tdp:clear`
- `tdp:rangestart`
- `tdp:eventserror`

## Theming and sizing

The CSS uses variables.

| Variable | Description | Default |
|---|---|---|
| `--tdp-modal-width` | Modal width | `400px` |
| `--tdp-display-width` | Modal display panel width | `200px` |
| `--tdp-cell-size` | Day cell size | `36px` |
| `--tdp-grid-gap-y` | Vertical week gap | `4px` |
| `--tdp-theme-color` | Accent color | `#38ada9` |
| `--tdp-event-dot-color` | Default event dot color | `var(--tdp-theme-color)` |
| `--tdp-event-dot-size` | Event dot size | `6px` |
| `--tdp-event-dot-gap` | Event dot gap | `3px` |
| `--tdp-range-fill-background` | Committed range fill | themed |
| `--tdp-range-preview-background` | Hover preview fill | themed |
| `--tdp-range-edge-background` | Range start/end background | themed |
| `--tdp-range-edge-foreground` | Range start/end text color | themed |

## Notes

- `setDate()` accepts `Date` or string.
- `getDate()` returns a `Date` in single mode.
- in range mode, prefer `getRange()` and `setRange()`.
- `markDates` and `events` are intentionally separate concepts.
- event dots create the inner layout only when the day actually has events.
- modal calendars mount when opened and unmount when closed.
- permanent calendars stay mounted.
- non-input targets receive the current formatted value in `data-tdp-value`.
- `events` function and AJAX sources are refreshed per visible month and ignore stale async responses after fast navigation.
- when an events request fails, the component emits `tdp:eventserror`.
- action button labels can be localized through `clearText`, `cancelText`, `confirmText`, or i18n packs.


## Custom parsing and formatting

You can replace the built-in parsing/formatting helpers per instance.

```js
new TinyDatePicker('#myDate', {
  parseDate(value) {
    // return a Date or null
  },
  formatDate(date) {
    // return the formatted string written to the input/value
  },
  formatAriaLabel(date, options) {
    return `${options.days[date.getDay()]} ${date.getDate()} ${options.months[date.getMonth()]} ${date.getFullYear()}`;
  }
});
```

## DOM instance access

Each target stores its picker instance:

```js
const picker = document.querySelector('#myDate')._tinyDatePicker;
```

A `data-tdp-id` attribute is also added to the target.


---

## Advanced date restriction system

TinyDatePicker provides a flexible rule-based system to control which dates are selectable.

### New options

| Option | Type | Default | Description |
|---|---|---:|---|
| `disableWeekDays` | `Array<number>` | `[]` | Disable specific weekdays (`0 = Sunday` → `6 = Saturday`). |
| `disableDates` | `Array<Date \| String>` | `[]` | Disable specific calendar dates. |
| `disableMonths` | `Array<number>` | `[]` | Disable specific months (`0 = January` → `11 = December`). |
| `disableYears` | `Array<number>` | `[]` | Disable specific years. |
| `allowedMonths` | `Array<number>` | `[]` | If non-empty, only these months are selectable. |
| `allowedYears` | `Array<number>` | `[]` | If non-empty, only these years are selectable. |

### Rule precedence

1. bounds (`minDate`, `maxDate`, `dateRule`)
2. allow-lists (`allowedMonths`, `allowedYears`)
3. disable rules (`disableWeekends`, `disableWeekDays`, `disableDates`, `disableMonths`, `disableYears`)
4. `disableDayFn`

---

## Why `wrapInputTriggerButton` exists

When using `inputTriggerMode: 'button'`, the component may inject a trigger button next to the input.

By default:

```js
wrapInputTriggerButton: true
```

### Why?

- ensures layout consistency
- avoids DOM breakage
- simplifies styling
- keeps input + button aligned

### When to disable it

```js
wrapInputTriggerButton: false
```

Use this when:
- you already manage layout
- you want full control

---

## Advanced restriction examples

```js
// Disable weekdays
disableWeekDays: [1, 2]

// Disable dates
disableDates: ['2026-12-25']

// Disable months
disableMonths: [0, 1]

// Disable years
disableYears: [2025]

// Allow only months
allowedMonths: [5, 6, 7]

// Allow only years
allowedYears: [2026, 2027]
```

