# Changelog

## 3.8.0

### Added

- Added `TinyT.configure({ missingToUndefined, onMissing })` for live global missing-identifier defaults. Compiled renderers observe configuration and callback changes without recompilation.
- Per-render `missingToUndefined` and `onMissing` continue to override the corresponding global values. `onMissing: null` clears the global callback, invalid callback values and unknown configuration keys fail fast with `TypeError`.

### Performance

- The production default remains `missingToUndefined: false`, keeping normal rendering off the diagnostic `Proxy` / `Set` path. A configured `onMissing` callback stays dormant while collection is disabled, so switching diagnostics off restores the shared empty-options fast path.
- `$.tmpl()` no longer forces either missing-identifier mode or callback; both now inherit `TinyT.configure()`, so application-wide diagnostics really are application-wide.
- Existing split caches, registered-renderer reuse, trim-free common paths, normalized nested ids and `compileTemplateMap()` helper-map optimizations remain intact.
- The helper/data scope still uses `Object.assign(Object.create(helpers), data)`. Faster alternate scope models were deliberately rejected because they change observable `this`, getter/setter, assignment, prototype or `Proxy` behavior.

### Compatibility

- Template syntax, renderer signatures, helper precedence, nested-template behavior, `$index`, strict/loose semantics and cache APIs are unchanged from 3.7.3.
- **jQuery migration note:** applications that relied on `$.tmpl()` automatically tolerating missing identifiers must either enable global diagnostics or fix those missing identifiers before using the default production configuration.

### Validation

- Expanded the automated suite with global configuration/callback inheritance, local override/disable behavior, runtime override and live compiled-renderer configuration tests.
- UMD and compact builds are syntax-checked and run through the same regression suite.

## 3.7.3

### Fixed

- `{{each ... as ...}}` now locates the `as` separator lexically, so strings, regexes, comments, template literals and nested JavaScript containing ` as ` no longer corrupt the directive.
- JavaScript identifiers containing Unicode characters are recognized by the embedded-expression scanner, including astral identifier code points.
- Loop aliases are validated before generated JavaScript compilation, producing TinyT source errors for reserved/invalid/duplicate aliases.
- Strict rendering preserves the historical 3.7.0 behavior for data objects exposing `Symbol.unscopables` by selecting the compatibility Proxy path only for those objects.
- `compileTemplateMap()` is transactional with respect to the template registry: a failed map no longer leaves partial registrations or replaces an existing working template.

### Performance

- `compileTemplateMap()` no longer clones a plain compile-time helper map when call-time options do not override helpers. This removes an O(helper-count) copy from a potentially hot renderer path.
- Existing loose/strict caches, registered renderer reuse, normalized nested ids, trim-free render fast paths and shared runtime API remain intact.
- Compatibility-sensitive helper-data scope copying is intentionally retained because removing it changes observable getter/assignment/prototype semantics.

### Packaging and maintenance

- Added documented file/function comments explaining parser, scope, compatibility and performance decisions.
- Added `TinyT.min.js`, a compact UMD production build, alongside the documented and UMD sources.
- Expanded the automated suite with regressions for lexical `each` parsing, Unicode identifiers, aliases, `Symbol.unscopables`, runtime helper options and transactional template-map registration.

## 3.7.2

- Fix directive scanning for closing blocks such as `{{/if}}` and `{{/each}}` when a later `/` in surrounding HTML could be misread as the end of a regular-expression literal.
- Keep JavaScript regex literals fully supported inside directive expressions, e.g. `{{if /foo/.test(value)}}`.
- Add regression tests for closing `if`/`each` blocks immediately followed by closing HTML tags.

## 3.7.1

### Performance

- Split the compiled-source cache into independent loose/strict `Map` instances, removing prefixed cache-key construction from hot `compile()` cache hits.
- Added a compatibility-safe native strict fast path: normal strict renders bypass `Proxy` when JavaScript's own scope resolution is observably equivalent; missing-identifier diagnostics and historical falsey-root cases retain the existing `Proxy` path.
- Exact `#id` renders and ordinary raw-template renders avoid unconditional `trim()` work on the common path while preserving padded-id behavior.
- Nested `{{tmpl}}` ids are normalized once during compilation and dispatch directly through dedicated loose/strict runtime methods.
- Reuse the shared `makeScope` runtime function instead of embedding/calling a fresh function expression from generated strict/diagnostic code.
- Registered-template renderer lookup now uses normalized ids internally and direct loose/strict entry fields.

### Validation

- Expanded the automated suite to cover render fast paths, ECMAScript whitespace-padded ids, strict helper/global behavior, diagnostic fallback, split-cache identity and nested child replacement.
- Differential validation against 3.7.0 covered more than 1,200 combinations of templates, data shapes and options with no observed output/error differences.
- Missing-identifier debug logging and `tmplTo()` callback timing remain unchanged.

### Compatibility

- No public API or template-syntax changes.
- `cacheSize()` still reports one total count even though loose and strict compiled sources now live in separate internal maps.
- 3.7.0 parser/correctness fixes and historical falsey primitive behavior are preserved.

## 3.7.0

### Fixed

- Template boundaries no longer break on `}` / `}}` inside JavaScript strings, comments, regular expressions or template literals.
- `compileTemplateMap()` now constructs `AggregateError` correctly and preserves the original compilation error in `errors`.
- Truthy primitive root data can be rendered in strict or missing-identifier diagnostic mode without passing a primitive directly to `Proxy`.

### Performance

- Registered templates retain loose/strict compiled renderers for fast repeated and nested rendering.
- Shared runtime API removes per-render API-object and closure creation.
- Nested `{{tmpl}}` propagation no longer clones the whole child object only to carry `$index`.
- `compileTemplateMap()` reuses bound runtime options on the normal no-override path.
- Top-level and loose fast paths remain allocation-conscious and continue to avoid `Proxy` unless strict/diagnostic behavior requires it.

### Added

- `TinyT.clearCache()` clears compiled renderers while preserving registered template sources.
- `TinyT.cacheSize()` reports the compiled renderer cache size.
- Automated regression tests under `tests/`.
- Repeatable micro-benchmarks under `bench/`.
- Demo coverage for JavaScript delimiter edge cases and cache APIs.

### Compatibility

- Template syntax and existing public method signatures remain unchanged.
- Missing-identifier `console.debug()` diagnostics are intentionally preserved.
- `$.fn.tmplTo()` callback timing remains on the next animation frame.
