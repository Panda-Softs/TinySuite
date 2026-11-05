# TinyT 3.8.0

TinyT is a compact browser-side templating engine for trusted application templates. It supports JavaScript expressions, conditionals, collection loops, reusable nested templates, helper functions, strict or tolerant scopes, missing-identifier diagnostics, top-level array rendering, template registration, DOM rendering and optional jQuery helpers.

Version **3.8.0** adds global runtime configuration for missing-identifier diagnostics and their callback, and makes the production fast path consistently usable by the core renderer and the jQuery adapter. The defaults remain `missingToUndefined: false` and `onMissing: null`. Development can enable tolerant missing-variable collection and one application-wide reporter with `TinyT.configure({ missingToUndefined: true, onMissing })`. Per-render options still override the corresponding global values.

The 3.8.0 implementation deliberately keeps the 3.7.3 helper/data scope contract based on `Object.assign(Object.create(helpers), data)`. Several more aggressive alternatives benchmark faster on wide records, but they alter observable JavaScript behavior around `this`, getters, setters, assignment, prototypes or `Proxy`; they are therefore not used automatically. The release instead keeps the proven 3.7.x parser/cache optimizations and removes the formerly forced diagnostic mode from `$.tmpl()`, allowing verified production templates to avoid the expensive `Proxy`/`Set` diagnostic path.

---

## Contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [Quick start](#quick-start)
4. [Global configuration](#global-configuration)
5. [Template syntax](#template-syntax)
5. [Expressions and output](#expressions-and-output)
6. [Conditionals](#conditionals)
7. [Loops](#loops)
8. [Reserved `$index`](#reserved-index)
9. [Nested templates](#nested-templates)
10. [Helpers](#helpers)
11. [Template registry](#template-registry)
12. [Compilation and caching](#compilation-and-caching)
13. [Top-level array rendering](#top-level-array-rendering)
14. [Missing identifiers](#missing-identifiers)
15. [Strict and loose modes](#strict-and-loose-modes)
16. [Public API](#public-api)
17. [Options reference](#options-reference)
18. [jQuery integration](#jquery-integration)
19. [Complete nested-template example](#complete-nested-template-example)
20. [Security](#security)
21. [Performance](#performance)
22. [Limitations](#limitations)
23. [Troubleshooting](#troubleshooting)
25. [Migration to 3.8.0](#migration-to-380)
25. [Demo](#demo)

---

## Requirements

TinyT is designed for modern browsers with support for:

- `Map`, `Set`, `Proxy` and `Object.assign`;
- template literals;
- `new Function`;
- optional chaining;
- object spread syntax;
- `globalThis`.

The package provides two builds:

| File | Format | jQuery behavior |
|---|---|---|
| `TinyT.js` | Browser script | Core works without jQuery; helpers are installed when jQuery is already present. |
| `TinyT.umd.js` | ES6 UMD | Supports browser globals, AMD and CommonJS. jQuery integration is installed automatically when jQuery is available. |
| `TinyT.min.js` | Compact ES6 UMD | Production-oriented compact build with the same public API as `TinyT.umd.js`. |

Browser script build:

```html
<script src="TinyT.js"></script>
```

Load jQuery first only when `$.tmpl()` / `$.fn.tmplTo()` are needed:

```html
<script src="jquery.min.js"></script>
<script src="TinyT.js"></script>
```

ES6 UMD browser build:

```html
<script src="jquery.min.js"></script>
<script src="TinyT.umd.js"></script>
```

Compact production build:

```html
<script src="TinyT.min.js"></script>
```

The UMD core can also run without jQuery. Only `$.tmpl()` and `$.fn.tmplTo()` require jQuery.

---

## Installation

Copy either build into your project. No build step is required.

### Browser global — ES6 UMD

```html
<script src="/assets/jquery.min.js"></script>
<script src="/assets/TinyT.umd.js"></script>
<script>
  const html = TinyT.render('<strong>${name}</strong>', { name: 'TinyT' });
</script>
```

jQuery is optional for the core renderer:

```html
<script src="/assets/TinyT.umd.js"></script>
```

### AMD

```js
define(['TinyT'], TinyT => {
    return TinyT.render('<strong>${name}</strong>', { name: 'TinyT' });
});
```

When the AMD loader resolves the declared `jquery` dependency, TinyT also installs its jQuery helpers.

### CommonJS

```js
const TinyT = require('./TinyT.umd.js');

const html = TinyT.render(
    '<strong>${name}</strong>',
    { name: 'TinyT' }
);
```

The CommonJS wrapper attempts to load `jquery` when it is installed, but the TinyT core remains available without it.

### Suggested file layout

```text
project/
├─ assets/
│  ├─ jquery.min.js
│  ├─ TinyT.js
│  └─ TinyT.umd.js
└─ templates/
   └─ app.js
```

---

## Quick start

```js
const template = `
  <article>
    <h2>\${title}</h2>
    <p>\${description}</p>
  </article>
`;

const html = TinyT.render(template, {
  title: 'TinyT',
  description: 'Small, reusable browser templates.'
});

document.getElementById('output').innerHTML = html;
```

Or render directly into an element:

```js
TinyT.renderTo(
  document.getElementById('output'),
  template,
  {
    title: 'TinyT',
    description: 'Rendered with renderTo().' 
  }
);
```

---

## Global configuration

TinyT 3.8.0 provides two global missing-identifier defaults:

```js
TinyT.configure({
  missingToUndefined: false,
  onMissing: null
});
```

Enable diagnostics once in development and centralize their reporting instead of repeating the callback on every render:

```js
TinyT.configure({
  missingToUndefined: true,
  onMissing: names => console.warn(
    '[TinyT] Missing template value(s):',
    Array.isArray(names) ? names.join(', ') : names
  )
});
```

Compiled renderers observe later configuration changes; recompilation is not required. Explicit per-render values always win over their corresponding global defaults:

```js
TinyT.configure({
  missingToUndefined: true,
  onMissing: globalMissingHandler
});

renderer(data, {
  missingToUndefined: false, // disables collection for this render
  onMissing: null            // disables the global callback for this render
});
```

`onMissing` must be a function or `null`; use `null` to clear the configured callback. Only documented configuration keys are accepted. Unknown keys throw a `TypeError` instead of silently creating a misspelled setting.

---

## Template syntax

| Syntax | Purpose | Example |
|---|---|---|
| `${expression}` | Evaluate and output an expression | `${title}` |
| `{{html expression}}` | Output an expression as HTML | `{{html content}}` |
| `{{if condition}}` | Start a conditional block | `{{if active}}` |
| `{{elsif condition}}` | Add a conditional branch | `{{elsif pending}}` |
| `{{else}}` | Add a fallback branch | `{{else}}` |
| `{{/if}}` | Close a conditional block | `{{/if}}` |
| `{{each list}}` | Iterate with `$value` and `$index` | `{{each items}}` |
| `{{each list as item}}` | Iterate with a value alias and `$index` | `{{each items as item}}` |
| `{{each list as item, index}}` | Iterate with aliases plus reserved `$index` | `{{each items as item, index}}` |
| `{{/each}}` | Close a loop | `{{/each}}` |
| `{{tmpl(data) "#id"}}` | Render a nested registered template | `{{tmpl(item) "#card"}}` |

Unknown `{{...}}` directives are emitted literally rather than silently discarded.

---

## Expressions and output

Expressions are normal JavaScript expressions evaluated against the template scope.

```html
<h2>${firstName + ' ' + lastName}</h2>
<p>${price * quantity}</p>
<p>${enabled ? 'Enabled' : 'Disabled'}</p>
```

### Property access

```html
<p>${client.name}</p>
<p>${order.total}</p>
```

### Optional chaining and fallback values

```html
<p>${client?.company ?? 'Private client'}</p>
```

### Function calls

Helpers or globally available functions can be called inside expressions:

```html
<p>${formatMoney(total)}</p>
<p>${escapeHtml(client)}</p>
```

Helper calls are standard JavaScript expressions. Errors thrown by a helper are not silently swallowed by TinyT.

### Ternaries and fallback operators

Standard JavaScript ternaries already work:

```html
${enabled ? 'yes' : ''}
${enabled ? enabled : 'no'}
```

For compact fallbacks, use JavaScript operators rather than custom TinyT syntax:

```html
${value || 'no'}
${value ?? 'no'}
```

`||` falls back for every falsy value, while `??` falls back only for `null` or `undefined`.

### No automatic HTML escaping

TinyT does not automatically escape interpolated values. Escape untrusted text explicitly:

```js
const helpers = {
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }
};
```

```html
<span>${escapeHtml(clientName)}</span>
```

`{{html expression}}` also outputs raw HTML. Use it only with trusted or sanitized content.

---

## Conditionals

### Basic condition

```html
{{if active}}
  <span>Active</span>
{{/if}}
```

### Complete branching

```html
{{if score >= 90}}
  <strong>Excellent</strong>
{{elsif score >= 70}}
  <strong>Good</strong>
{{else}}
  <strong>Keep going</strong>
{{/if}}
```

Conditions can use data properties, helpers and normal JavaScript operators.

```html
{{if status === 'pending' && total > 0}}
  <button>Confirm</button>
{{/if}}
```

Blocks must be correctly nested and closed. TinyT produces a code-frame syntax error when a block is unclosed or mismatched.

---

## Loops

TinyT accepts arrays and plain objects.

- arrays are iterated in array order;
- objects are converted with `Object.values()`;
- `null`, `undefined` and primitive non-object values become an empty collection.

### Default variables

```html
<ul>
  {{each items}}
    <li>${$index}: ${$value}</li>
  {{/each}}
</ul>
```

Available variables:

| Variable | Description |
|---|---|
| `$value` | Current collection value |
| `$index` | Zero-based current loop index |

### Value alias

```html
{{each clients as client}}
  <p>${$index + 1}. ${client.name}</p>
{{/each}}
```

The reserved `$index` remains available even when a value alias is used.

### Value and index aliases

```html
{{each clients as client, position}}
  <p>
    Reserved index: ${$index}<br>
    Explicit alias: ${position}<br>
    Client: ${client.name}
  </p>
{{/each}}
```

Both `position` and `$index` contain the same current zero-based index. The alias is provided for readability or compatibility, while `$index` is owned by TinyT.

### Accessing current object properties directly

For an object row, TinyT also opens the row as an inner scope:

```html
{{each clients as client}}
  <p>${name} — ${email}</p>
{{/each}}
```

The explicit alias is still useful when clarity matters:

```html
{{each clients as client}}
  <p>${client.name} — ${client.email}</p>
{{/each}}
```

### Nested loops

Each loop creates its own `$index`. The innermost loop shadows the outer one while it is active.

```html
{{each groups as group}}
  <section>
    <h2>Group ${$index + 1}</h2>

    {{each group.items as item}}
      <p>Inner index: ${$index} — ${item.name}</p>
    {{/each}}
  </section>
{{/each}}
```

Pass the outer index explicitly under another name when the child content needs both indexes:

```html
{{each groups as group, groupIndex}}
  {{each group.items as item}}
    <p>Group ${groupIndex}, item ${$index}</p>
  {{/each}}
{{/each}}
```

---

## Reserved `$index`

`$index` is a TinyT-reserved loop variable. It exists to avoid colliding with a data property or user alias named `index`.

Given this row:

```js
{
  index: 900,
  name: 'Rental item'
}
```

and this template:

```html
{{each items as item, position}}
  <p>
    Data index: ${item.index}<br>
    Explicit alias: ${position}<br>
    TinyT index: ${$index}
  </p>
{{/each}}
```

all three values remain independent:

- `item.index` is application data;
- `position` is the explicit loop alias;
- `$index` is the reserved TinyT index.

### Availability rules

| Context | `$index` availability |
|---|---|
| Inside `{{each}}` | Always available |
| Inside a nested `{{tmpl}}` called from `{{each}}` | Automatically injected |
| Outside a loop | Not automatically defined |
| Top-level array renderer | Not automatically injected; use `rowTransform` |

---

## Nested templates

Nested templates allow reusable components.

### Register templates

```js
TinyT.registerTemplate('user-card', `
  <article>
    <strong>\${name}</strong>
  </article>
`);
```

### Render a child template

```html
{{tmpl(user) "#user-card"}}
```

The template ID must be quoted and begin with `#`.

### Nested template in a loop

```js
const templates = {
  'rental-item': `
    <article class="rental rental-\${$index}">
      <strong>\${title}</strong>
      <small>position alias: \${position}</small>
    </article>
  `,

  main: `
    {{each items as item, position}}
      {{tmpl({ ...item, position }) "#rental-item"}}
    {{/each}}
  `
};
```

In TinyT 3.7.0, nested rendering no longer copies every enumerable property of the child object only to inject `$index`. The current loop index is passed through the compiled runtime and exposed lexically to the child template.

Consequences:

- the original `item` object is not mutated;
- no full child-object clone is required for the normal nested-template path;
- explicitly passed properties such as `position` remain available;
- an application property named `index` is not overwritten;
- historical scope precedence is preserved: if the active loop item itself exposes a `$index` property, that property can shadow TinyT's lexical `$index`, exactly as in 3.6.4.

### Nested options inheritance

Nested templates inherit the current rendering options, including:

- `helpers`;
- `strict`;
- `missingToUndefined`;
- `onMissing`;
- other runtime options.

---

## Helpers

Helpers are functions or values merged into the template scope.

```js
const helpers = {
  uppercase: value => String(value ?? '').toUpperCase(),
  formatMoney: value => `${Number(value).toFixed(2)} CHF`,
  displayDate: value => new Date(value).toLocaleDateString()
};
```

```html
<h2>${uppercase(title)}</h2>
<p>${formatMoney(total)}</p>
<p>${displayDate(startDate)}</p>
```

### Compile-time helpers

```js
const renderer = TinyT.compile(template, {
  strict: false
});

renderer(data, {
  helpers
});
```

`compile()` itself caches the template renderer. Helpers are supplied when the renderer is called.

### Helpers with `compileTemplateMap`

```js
const renderers = TinyT.compileTemplateMap(
  {
    card: `<article>\${displayDate(date)}</article>`,
    main: `{{tmpl(item) "#card"}}`
  },
  {
    strict: false,
    helpers
  }
);

const html = renderers.main({ item: { date: '2026-07-06' } });
```

`compileTemplateMap()` returns bound renderer functions that merge compile-time helpers with call-time helpers.

The helper functions do not need to exist on `window` or `globalThis`. They may remain private inside a module, closure or page initializer:

```js
(() => {
  const display_date = value => new Date(value).toLocaleDateString('fr-CH');

  const renderers = TinyT.compileTemplateMap(templates, {
    strict: false,
    helpers: { display_date }
  });

  output.innerHTML = renderers.main(data);
})();
```

Nested `{{tmpl}}` renders inherit the same helper scope automatically.

### Call-time helper override

```js
renderers.main(data, {
  helpers: {
    displayDate: value => `Custom: ${value}`
  }
});
```

Call-time helpers override helpers with the same name.

### Data takes precedence over helpers

TinyT exposes helpers behind the data scope so data remains the first lookup layer. Therefore, a data property overrides a helper with the same name.

```js
const helpers = { label: 'Helper label' };
const data = { label: 'Data label' };
```

`${label}` produces `Data label`.

### Important: registry does not store helpers

This compiles and registers templates, but ignoring the returned renderers loses the bound helper defaults:

```js
TinyT.compileTemplateMap(definitions, {
  strict: false,
  helpers
});

// This raw render does not automatically recover compileTemplateMap helpers.
TinyT.render('#main', data);
```

Keep and use the returned renderer map:

```js
const renderers = TinyT.compileTemplateMap(definitions, {
  strict: false,
  helpers
});

const html = renderers.main(data);
```

This is the usual solution for warnings such as:

```text
Missing identifier "display_date" — ignored
```

---

## Template registry

TinyT maintains an in-memory template registry.

### `configure(options)`

```js
TinyT.configure({
  missingToUndefined: true,
  onMissing: names => console.warn(names.join(', '))
});
```

The 3.8.0 configuration surface contains `missingToUndefined` and `onMissing`. The method validates keys and callback type, updates the live global defaults and returns a frozen snapshot of the resulting configuration. Per-render values override the matching global value; `onMissing: null` clears or locally disables the callback.

### `registerTemplate(id, tpl)`

```js
TinyT.registerTemplate('notice', `<p>\${message}</p>`);
```

A leading `#` is optional during registration:

```js
TinyT.registerTemplate('#notice', `<p>\${message}</p>`);
```

Registering the same ID again replaces its stored template source.

### `getTemplate(id)`

```js
const source = TinyT.getTemplate('#notice');
```

Resolution order:

1. in-memory registry;
2. DOM element with the matching ID;
3. throw `Template "id" not found`.

### DOM-backed templates

```html
<script id="welcome-template" type="text/x-tinyt">
  <h2>${title}</h2>
</script>
```

```js
const source = TinyT.getTemplate('#welcome-template');
```

The DOM template is cached in the registry after the first lookup.

---

## Compilation and caching

### Compile once

```js
const renderer = TinyT.compile(`
  <article>\${title}</article>
`);

const first = renderer({ title: 'First' });
const second = renderer({ title: 'Second' });
```

### Cache key

Compiled renderers are cached by:

- template source;
- strict-mode prefix.

The same source compiled with the same strict setting reuses the cached renderer.

### `compileTemplateMap`

Use a map for related components:

```js
const renderers = TinyT.compileTemplateMap({
  item: `<li>\${name}</li>`,
  list: `<ul>{{each items as item}}{{tmpl(item) "#item"}}{{/each}}</ul>`
}, {
  strict: false,
  helpers
});
```

It performs three operations per definition:

1. registers the source;
2. precompiles the source;
3. returns a bound renderer.

```js
const html = renderers.list({
  items: [
    { name: 'One' },
    { name: 'Two' }
  ]
});
```

---

## Top-level array rendering

A compiled renderer accepts an array directly:

```js
const renderer = TinyT.compile(`<article>\${name}</article>`);

const html = renderer([
  { name: 'One' },
  { name: 'Two' }
]);
```

TinyT renders every row and concatenates the strings.

### `rowTransform`

Use `rowTransform` to enrich or replace each top-level row:

```js
const html = renderer(rows, {
  rowTransform(row, index) {
    return {
      ...row,
      rowNumber: index + 1
    };
  }
});
```

If `rowTransform` returns `undefined`, TinyT keeps the original row.

```js
rowTransform(row) {
  if (!row.needsChange) return undefined;
  return { ...row, changed: true };
}
```

### Top-level `$index`

The top-level array wrapper is not a template `{{each}}` block and does not automatically inject `$index`. Add an index property with `rowTransform` when needed:

```js
renderer(rows, {
  rowTransform: (row, index) => ({
    ...row,
    $index: index
  })
});
```

---

## Missing identifiers

Use `missingToUndefined` to collect missing identifiers instead of throwing immediately. Both the collection mode and its `onMissing` callback can be configured globally with `TinyT.configure()` or overridden for one render.

```js
const html = TinyT.render(
  `<p>\${known}</p><p>\${missing}</p>`,
  { known: 'Available' },
  {
    missingToUndefined: true,
    onMissing(names) {
      console.warn(names.join(', '));
    }
  }
);
```

The missing expression resolves to `undefined`, and output expressions use an empty-string fallback.

### Callback signature

```js
onMissing(names)
```

| Argument | Type | Description |
|---|---|---|
| `names` | `string[]` | Unique missing identifier names found during this render |

### Recommended warning format

```js
onMissing: names => console.warn(
  `[TinyT] Missing variables: ${names.join(', ')}`
)
```

For an application-wide reporter, configure it once:

```js
TinyT.configure({
  missingToUndefined: true,
  onMissing: names => console.warn(
    '[initAjaxPageSearchTpl] Missing template value(s):',
    Array.isArray(names) ? names.join(', ') : names
  )
});
```

### Debug output

The current implementation also emits a debug message when a missing identifier is detected:

```text
[TinyT] Missing identifier "name" — ignored
```

### Missing property versus missing identifier

This reports a missing identifier:

```html
${unknownVariable}
```

This may throw a normal JavaScript property-access error if `user` itself is undefined and optional chaining is not used:

```html
${user.name}
```

Prefer:

```html
${user?.name ?? ''}
```

---

## Strict and loose modes

### Loose mode

Loose mode is the default for `compile()` and `render()` unless `strict: true` is supplied.

```js
TinyT.render(template, data, {
  strict: false
});
```

Unknown identifiers can resolve as `undefined` in tolerant paths. Use `missingToUndefined` when you want explicit collection and reporting.

### Strict mode

```js
TinyT.render(template, data, {
  strict: true
});
```

Strict mode allows TinyT-generated lexical variables such as loop aliases, `$value`, `$index`, `apiLocal`, `opts` and internal result variables while unknown identifiers can produce a `ReferenceError` when missing collection is disabled.

### Strict mode with missing collection

```js
TinyT.render(template, data, {
  strict: true,
  missingToUndefined: true,
  onMissing: names => console.warn(names)
});
```

When missing collection is active, unknown identifiers are admitted as `undefined` so they can be reported.

### `compileTemplateMap` strict default

Calling `compileTemplateMap(defs)` with no options uses its declared default `{ strict: true }`.

When passing an options object, set `strict` explicitly:

```js
TinyT.compileTemplateMap(defs, {
  strict: false,
  helpers
});
```

This avoids relying on the nested `compile()` default when `strict` is absent from a provided options object.

---

## Public API

### API summary

| Method | Signature | Returns | Purpose |
|---|---|---|---|
| `configure` | `configure(options)` | `Object` | Update global runtime defaults and return a frozen snapshot |
| `registerTemplate` | `registerTemplate(id, tpl)` | `undefined` | Store or replace a template source |
| `getTemplate` | `getTemplate(id)` | `string` | Resolve a registered or DOM template |
| `compile` | `compile(tpl, options?)` | `Function` | Compile and cache a renderer |
| `render` | `render(tplOrId, data, options?)` | `string` | Compile and render in one call |
| `renderTo` | `renderTo(elementOrId, tplOrId, data, options?)` | `string` | Render directly into a DOM element |
| `compileTemplateMap` | `compileTemplateMap(definitions, options?)` | `Object<string, Function>` | Register and precompile a component map |
| `clearCache` | `clearCache()` | `undefined` | Clear compiled renderers while keeping registered sources |
| `cacheSize` | `cacheSize()` | `number` | Return the current compiled-renderer cache size |

### `registerTemplate(id, tpl)`

```js
TinyT.registerTemplate('card', `<article>\${title}</article>`);
```

Parameters:

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | Registry ID, with or without a leading `#` |
| `tpl` | any | Converted to a string before storage |

### `getTemplate(id)`

```js
const template = TinyT.getTemplate('#card');
```

Throws when neither the registry nor the DOM contains the template.

### `compile(tpl, options?)`

```js
const renderer = TinyT.compile(template, {
  strict: false
});
```

Renderer signature:

```js
renderer(data, runtimeOptions?) => string
```

The renderer accepts either:

- one data object;
- an array of data rows.

### `render(tpl, data, options?)`

```js
const html = TinyT.render('#card', data, options);
```

If `tpl` begins with `#`, TinyT resolves it through `getTemplate()`.

### `renderTo(elementOrId, tpl, data, options?)`

```js
TinyT.renderTo('#output', '#card', data, options);
```

The first argument can be:

- a DOM element;
- an element ID such as `'output'`;
- an ID prefixed with `#`, such as `'#output'`.

The method assigns `element.innerHTML` and returns the generated HTML string.

### `compileTemplateMap(definitions, options?)`

```js
const renderers = TinyT.compileTemplateMap({
  card: `<article>\${title}</article>`,
  main: `{{tmpl(card) "#card"}}`
}, {
  strict: false,
  helpers
});
```

The returned object uses the same keys:

```js
renderers.card(data);
renderers.main(data);
```

### `clearCache()` and `cacheSize()`

```js
console.log(TinyT.cacheSize());
TinyT.clearCache();
```

`clearCache()` removes compiled-source cache entries and compiled renderer references held by registered templates. Registered template source strings remain available and are compiled lazily again on the next render.

These methods are mainly useful when an application generates many unique template sources at runtime. Static applications normally do not need to clear the cache.

---

## Options reference

### Compile and render options

| Option | Type | Default | Applies to | Description |
|---|---|---:|---|---|
| `strict` | `boolean` | `false` for `compile`/`render` | Compilation | Enables strict unknown-identifier behavior |
| `helpers` | `Object` | `{}` | Rendering | Values/functions merged into template scope |
| `missingToUndefined` | `boolean` | global default (`false`) | Rendering | Collect unknown identifiers and resolve them as `undefined`; per-render value overrides `TinyT.configure()` |
| `onMissing` | `Function \| null` | global default (`null`) | Rendering | Called once with the unique missing-name array; per-render value overrides `TinyT.configure()` and `null` disables it |
| `rowTransform` | `Function` | — | Top-level array rendering | Transforms each row before it is rendered |

### `onMissing`

```js
onMissing(names) {
  console.warn(names.join(', '));
}
```

### `rowTransform`

```js
rowTransform(row, index) {
  return { ...row, rowNumber: index + 1 };
}
```

| Argument | Type | Description |
|---|---|---|
| `row` | any | Current array row |
| `index` | `number` | Zero-based top-level row index |

Return value:

| Return | Behavior |
|---|---|
| transformed value | Render transformed value |
| `undefined` | Render original row |

### `compileTemplateMap` helper merging

Compile-time options:

```js
const renderers = TinyT.compileTemplateMap(defs, {
  strict: false,
  helpers: baseHelpers,
  missingToUndefined: true
});
```

Call-time options:

```js
renderers.main(data, {
  helpers: pageHelpers,
  onMissing: handleMissing
});
```

Merge order:

1. compile-time non-helper options;
2. call-time non-helper options;
3. compile-time helpers;
4. call-time helpers override matching compile-time helpers.

---

## jQuery integration

The bundled file adds two jQuery utilities.

### `$.tmpl(element, data, strict = false)`

```js
const $rendered = $.tmpl(
  '<article>${title}</article>',
  { title: 'TinyT' }
);
```

Accepted first argument:

- jQuery object;
- DOM element;
- string containing a selector or HTML/template source.

The helper renders each supplied source and returns a jQuery collection built from the rendered results.

`$.tmpl()` now inherits both global missing-identifier settings. When diagnostics are enabled, a configured global `onMissing` callback is invoked exactly like core TinyT renders; `$.tmpl()` no longer installs its own callback that could mask the application-wide reporter.

### `$.fn.tmplTo(templateAlias, data, callback, strict = false)`

```js
$('#output').tmplTo(
  'card',
  { title: 'TinyT' },
  $element => {
    console.log('Rendered', $element);
  }
);
```

Behavior:

1. renders registered template `#card` into the first matched element;
2. invokes the optional callback on the next animation frame;
3. returns the original jQuery collection.

Parameters:

| Parameter | Type | Default | Description |
|---|---|---:|---|
| `templateAlias` | `string` | — | Template registry/DOM ID without `#` |
| `data` | any | — | Template data |
| `callback` | `Function` | — | Called with the jQuery collection after rendering |
| `strict` | `boolean` | `false` | Strict compilation setting |

### Helper limitation in `tmplTo`

The current `tmplTo` integration passes only the strict option. Templates requiring custom helpers should normally be rendered through a bound renderer or `TinyT.renderTo()` with `helpers`.

---

## Complete nested-template example

This example mirrors a typical rental-card architecture.

```js
const helpers = {
  escapeHtml,
  str_normalize,
  display_date,
  url_product,
  client_link
};

const templates = {
  'rental-item': `
    <article class="rental-item rental-item-\${$index} \${str_normalize(status_id)}">
      <img src="\${url_product(image)}" alt="">
      <h3>\${escapeHtml(title)}</h3>
      <a href="\${client_link(client_id)}">\${escapeHtml(client)}</a>
      <time>\${display_date(start_date)}</time>
      <small>Explicit alias: \${position}</small>
    </article>
  `,

  main: `
    <div class="rental-grid">
      {{each items as item, position}}
        {{tmpl({ ...item, position }) "#rental-item"}}
      {{/each}}
    </div>
  `
};

const renderers = TinyT.compileTemplateMap(templates, {
  strict: false,
  helpers
});

const html = renderers.main({
  items: rentals
}, {
  missingToUndefined: true,
  onMissing: names => console.warn(names.join(', '))
});

document.getElementById('rentals').innerHTML = html;
```

Inside `rental-item`:

- `$index` is injected automatically by TinyT;
- `position` is passed explicitly;
- helper functions are inherited from the bound `main` renderer;
- the source rental object remains unchanged.

---

## Security

TinyT compiles templates with `new Function` and evaluates expressions with `with` scopes.

### Trusted templates only

Never allow end users to submit or edit template source that is executed by TinyT. Template expressions are JavaScript code.

Safe model:

- template source is controlled by the application developer;
- template data may come from users, but is escaped before HTML output.

Unsafe model:

- user-provided string is passed as TinyT template source;
- arbitrary expressions are allowed from an untrusted editor.

### Escape data values

```html
<!-- Unsafe if title contains user HTML -->
<h2>${title}</h2>

<!-- Safer -->
<h2>${escapeHtml(title)}</h2>
```

### Raw HTML

`{{html value}}` and normal expression output are not sanitized. Sanitize externally when HTML content is expected.

### Global access

The scope allows fallback access to `globalThis` to preserve access to standard globals such as `Math` and `Date`. This reinforces the rule that template source must be trusted.

---

## Performance

TinyT 3.8.0 retains the 3.7.x cache/parser fast paths and focuses the production default on avoiding diagnostic overhead.

### Runtime optimizations

- global `missingToUndefined: false` keeps production rendering on the native non-diagnostic scope path and restores the shared empty runtime options even if an `onMissing` reporter remains configured; `$.tmpl()` no longer forces the diagnostic `Proxy` path in 3.8.0;
- loose and strict compiled renderers use separate `Map` caches, so a hot cache lookup uses the template source directly instead of allocating a prefixed cache key;
- registered templates retain their already compiled loose/strict renderer, avoiding repeated source compilation for `#id` and `{{tmpl}}` calls;
- exact `#id` renders and ordinary raw templates skip `trim()` on the common path while padded template ids retain their historical behavior;
- nested `{{tmpl}}` ids are normalized once during parent compilation and use dedicated loose/strict child dispatch;
- the runtime API object and `makeScope` function are shared rather than rebuilt/embedded for every render;
- loose rendering and normal strict rendering bypass `Proxy`; strict/loose missing-identifier collection still uses `Proxy`, and strict falsey roots without helpers retain the historical compatibility path;
- helpers are not copied when no helper scope is configured;
- `compileTemplateMap()` reuses bound options on the normal no-override path instead of rebuilding helper and option objects for every call;
- top-level arrays use an indexed loop and one output accumulator;
- nested `{{tmpl}}` calls pass `$index` through the compiled runtime instead of cloning the full child object;
- a shared frozen empty object avoids normal-path empty-object allocations.

### Benchmarking

The package includes `bench/benchmark.js` for repeatable Node-side micro-benchmarks:

```bash
node bench/benchmark.js
TINYT_BENCH_ITERATIONS=1000000 node bench/benchmark.js
```

For browser-engine measurements, open `bench/browser.html` locally in Chrome, Firefox or Safari and run the same release in the target browser.

These measurements compare TinyT internals, not browser DOM cost. Browser performance must still be checked with the application's real templates in Chrome, Firefox and Safari. DOM parsing, style recalculation, layout and painting can cost substantially more than string rendering.

In one Node 22/V8 measurement of the 3.8.0 scalar renderer, the same already-valid template rendered at about **5.4 million ops/s** with global diagnostics disabled and about **1.6 million ops/s** with global diagnostics enabled. That roughly 3× gap is expected because tolerant missing-variable collection uses `Proxy`, `Set`, identifier traps and bookkeeping. Treat those numbers only as an illustration of the cost class, not as a browser/UI guarantee; CPU, JIT state, data shape, garbage collection and template complexity materially affect results.

Wide data objects combined with helpers remain an important JavaScript-engine bottleneck because TinyT intentionally preserves `Object.assign(Object.create(helpers), data)` semantics. 3.8.0 does **not** replace that operation with a faster but behavior-changing scope model. If wide-record helper rendering dominates a real application, benchmark the actual templates before considering any future contract change.

### Recommended usage

Compile stable templates once:

```js
const renderer = TinyT.compile(template);

function updateView(data) {
  output.innerHTML = renderer(data, { helpers });
}
```

For component families, keep the renderer map returned by `compileTemplateMap()`:

```js
const renderers = TinyT.compileTemplateMap(templates, {
  strict: false,
  helpers
});

output.innerHTML = renderers.main(data);
```

For the fastest production path, disable missing-identifier diagnostics after templates have been verified:

```js
TinyT.configure({
  missingToUndefined: false,
  onMissing: null
});
```

`missingToUndefined: true` intentionally enables `Proxy`, a `Set`, identifier tracking and debug logging, so it is materially slower than the normal loose/strict fast paths.

Avoid generating a new template source string on every render. Every unique source can create another compiled cache entry; use `clearCache()` when truly dynamic template generation has a bounded lifecycle.

---

## Limitations

### JavaScript scanner is intentionally lightweight

TinyT 3.8.0 includes the 3.7.x lexical JavaScript scanner for template boundaries. It understands quoted strings, escapes, line/block comments, nested braces, template literals (including nested `${...}`) and regular-expression literals, so delimiter-like `}` / `}}` characters in those constructs are handled correctly.

It is still not a complete ECMAScript parser. TinyT ultimately delegates JavaScript validation to `new Function`, and extremely exotic context-sensitive slash syntax may remain outside the scanner's intended scope. Keep complicated business logic in helpers rather than turning templates into miniature programs.

Prefer:

```html
${formatRentalLabel(rental)}
```

instead of a large inline expression.

### No automatic HTML escaping

All output is raw. Explicitly escape untrusted values.

### Object loops discard keys

Plain objects are iterated through `Object.values()`. Original object keys are not exposed as indexes.

```js
{
  a: { name: 'One' },
  b: { name: 'Two' }
}
```

is treated like:

```js
[
  { name: 'One' },
  { name: 'Two' }
]
```

### Top-level array index differs from loop `$index`

`$index` is automatically created by template `{{each}}` blocks. Use `rowTransform` to add an index to top-level array rows.

### Template registry stores source, not bound helpers

The registry stores template strings only. Bound helper defaults live in renderer functions returned by `compileTemplateMap()`.

### jQuery integration is optional

Both distributed builds can run the core renderer without jQuery. Load jQuery before TinyT when `$.tmpl()` or `$.fn.tmplTo()` are required.

---

## Troubleshooting

### `$index` is reported as missing

Use TinyT 3.8.0 and ensure the child template is rendered by a `{{tmpl}}` call inside an active `{{each}}` block.

```html
{{each items as item, position}}
  {{tmpl({ ...item, position }) "#item"}}
{{/each}}
```

Child:

```html
<div class="item-${$index}">${title}</div>
```

`$index` is now automatically injected.

### I have data property `index` and need the loop index

Use both independently:

```html
<p>Data: ${item.index}</p>
<p>Loop: ${$index}</p>
```

### `display_date` or another helper is missing

Make sure it exists in the helpers object:

```js
const helpers = {
  display_date
};
```

Retain and use the renderer returned by `compileTemplateMap()`:

```js
const renderers = TinyT.compileTemplateMap(defs, {
  strict: false,
  helpers
});

renderers.main(data);
```

Do not compile the map and later render the raw registry ID without passing helpers.

### Missing warnings are difficult to read

```js
onMissing: names => console.warn(names.join(', '))
```

### Nested template cannot see parent data

A child receives only the object passed to `{{tmpl}}`, plus the reserved `$index` when the call occurs in a loop.

Pass additional values explicitly:

```html
{{tmpl({ ...item, parentStatus: status }) "#item"}}
```

### Template not found

Check that the template is registered or present in the DOM:

```js
TinyT.registerTemplate('item', source);
TinyT.getTemplate('#item');
```

### Strict mode throws a `ReferenceError`

Either provide the missing value or enable missing collection:

```js
{
  strict: true,
  missingToUndefined: true,
  onMissing: names => console.warn(names)
}
```

### `renderTo` cannot find the destination

Use a valid DOM element, ID or `#id`:

```js
TinyT.renderTo('#output', template, data);
```

### A helper is overridden unexpectedly

Data properties override helpers with the same name. Rename one of them.

---

## Migration to 3.8.0

3.8.0 keeps the template language and renderer signatures from 3.7.3 and adds `TinyT.configure()` with global `missingToUndefined` and `onMissing` defaults. Core `compile()`/`render()` behavior with the default configuration is unchanged because missing collection remains disabled and the callback defaults to `null`.

The deliberate jQuery integration change is that `$.tmpl()` no longer hard-codes `missingToUndefined: true` or its own missing callback; it inherits the global settings. Applications that relied on `$.tmpl()` silently tolerating and warning about missing identifiers should configure both diagnostics and their reporter globally during migration, or verify/fix those templates before using the production defaults.

### Compatibility preserved

- `${...}`, `{{html}}`, `{{if}}`, `{{elsif}}`, `{{else}}`, `{{each}}` and `{{tmpl}}` syntax is unchanged;
- `$value`, explicit loop aliases and reserved `$index` remain available;
- top-level array rendering and `rowTransform` keep their existing behavior;
- data still takes precedence over helpers;
- nested templates inherit helpers, diagnostics and the parent's compiled strictness;
- `globalThis` fallback remains available;
- jQuery `tmplTo()` still invokes its callback on the next animation frame;
- the helper/data scope model remains the 3.7.3 model; no `scopeMode` or record-only execution contract was introduced;
- development missing-identifier `console.debug()` output is intentionally retained.

### Correctness fixes

Expressions such as these now compile correctly:

```html
${"}"}
${`template } literal`}
${/}/.test("}")}
{{if value === "}}"}}safe{{/if}}
```

`compileTemplateMap()` now throws a real `AggregateError` whose `message` describes the failed template and whose `errors[0]` contains the original error.

Truthy primitive root data (`"text"`, `42`, `true`) can be used with strict/diagnostic scopes. Since 3.7.1, normal strict rendering uses the native fast path; diagnostics and falsey-root compatibility retain the `Proxy` path where required.

### Performance changes

The public renderer signatures are unchanged. 3.8.0 adds a global production/development switch for missing diagnostics and lets the jQuery adapter use the same setting. Existing 3.7.x split caches, strict native fast path, registered renderer reuse, normalized nested ids and `compileTemplateMap()` allocation reductions remain in place. The compatibility-sensitive helper/data `Object.assign` scope is intentionally retained.

Two cache-management methods are additive:

```js
TinyT.cacheSize();
TinyT.clearCache();
```

---

## Demo

Open:

```text
demo/index.html
```

The demo includes:

- a live editable template studio;
- the 3.8.0 global `TinyT.configure()` diagnostic settings;
- interpolation and helper functions;
- `if`, `elsif` and `else` branches;
- default `$value` and `$index` loop variables;
- explicit loop aliases alongside reserved `$index`;
- automatic `$index` propagation into nested templates;
- missing-identifier reporting;
- top-level array rendering and `rowTransform`;
- registry and DOM-template resolution;
- `renderTo()`;
- jQuery `tmplTo()` integration;
- a public API overview.

The demo uses a local copy of jQuery 3.7.1 under `demo/vendor/`, so it can be opened without a network connection.

---

## Version

```text
TinyT 3.8.0
```

This release adds global missing-identifier configuration, keeps the verified 3.7.3 scope contract, and makes the non-diagnostic production path available consistently to core and jQuery rendering.
