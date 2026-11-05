<div align="center">

<a href="https://panda-softs.github.io/TinySuite/">
  <img src="website/assets/images/icon-tinysuite.webp" alt="TinySuite — Panda-Softs" width="112" />
</a>

# TinySuite

### Small components. Beautiful interfaces.

**A collection of independent JavaScript components for building modern, interactive, and customizable web interfaces.**

<p>
  <img alt="20 components" src="https://img.shields.io/badge/20-components-34d5f5?style=for-the-badge&labelColor=101a32" />
  <img alt="6 categories" src="https://img.shields.io/badge/6-categories-8b80ff?style=for-the-badge&labelColor=101a32" />
  <img alt="Modular JavaScript" src="https://img.shields.io/badge/JavaScript-modular-f5c84b?style=for-the-badge&labelColor=101a32" />
</p>

**[Visit the official website](https://panda-softs.github.io/TinySuite/)** · **[Explore all 20 components](https://panda-softs.github.io/TinySuite/components/)** · **[View the demos](https://panda-softs.github.io/TinySuite/#demos)** · **[GitHub repository](https://github.com/Panda-Softs/TinySuite)**

<a href="https://panda-softs.github.io/TinySuite/">
  <img src="website/assets/images/tinysuite-hero.webp" alt="Preview of several TinySuite interfaces" width="900" />
</a>

<sub>A <a href="https://panda-softs.github.io/">Panda-Softs</a> project · Focused components that can be used individually.</sub>

</div>

---

## ✦ Introduction

**TinySuite** brings together JavaScript UI components and utilities designed for practical needs: data tables, calendars, enhanced form controls, navigation, galleries, dialogs, content editing, and template rendering.

The goal is **not** to replace a framework or impose a monolithic design system. Each component has its own logic, files, options, and demo. You can integrate only the tools needed by a particular page, business application, or dashboard.

### What makes TinySuite different?

| Principle | What it means in practice |
| :-- | :-- |
| **Modularity** | Choose one component without importing the entire collection. |
| **Straightforward integration** | Most modules work with vanilla JavaScript and ordinary `<script>` / `<link>` tags. |
| **Configurable behavior** | Initialization options, callbacks, public methods, and events, depending on the component. |
| **Business-oriented interfaces** | Search, selection, validation, forms, actions, editing, scheduling, and data management. |
| **Adaptable styling** | Component-specific CSS, with variables and customization options where supported. |
| **Live demonstrations** | A dedicated page and a demo link for each of the 20 components. |
| **Verifiable builds** | Source files and generated distributions checked by repository scripts and GitHub Actions. |

> [!IMPORTANT]
> **Independent does not always mean dependency-free.** Components are separate and do not require installing *all* of TinySuite. Some integrations have explicit dependencies: **TinyGallery** uses **TinyLightbox**, **TinyInlineEditor** requires **jQuery**, and other modules offer optional libraries or plugins. These exceptions are documented below.

## Quick navigation

| Category | Components | Main purpose |
| :-- | :--: | :-- |
| [Data & scheduling](#1--data--scheduling) | **2** | Advanced tables, calendars, resource planning |
| [Forms & input](#2--forms--input) | **6** | Suggestions, selections, dates, colors, signatures |
| [Navigation & layout](#3--navigation--layout) | **5** | Tabs, menus, panels, collapsible sections, grouped actions |
| [Media](#4--media) | **3** | Galleries, image viewers, carousels |
| [Interactions & editing](#5--interactions--editing) | **3** | Manual sorting, inline editing, alerts, confirmations |
| [Developer tools](#6--developer-tools) | **1** | HTML templates and rendering |

**[Installation](#installation-and-usage)** · **[Architecture](#architecture-and-technical-philosophy)** · **[Development](#development-and-validation)** · **[FAQ](#frequently-asked-questions)**

---

## Component catalog — all 20 components

### 1 · Data & scheduling

Two components for data-rich interfaces: browsing records, performing business operations, handling bookings, and managing resources.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinyDataTable** | Display, search, sort, filter, and select tabular data. | [Explore](https://panda-softs.github.io/TinySuite/TinyDataTable/) |
| **TinyScheduler** | Organize events, time slots, and resources across multiple calendar views. | [Explore](https://panda-softs.github.io/TinySuite/TinyScheduler/) |

#### TinyDataTable — Advanced data tables

**What is it for?** Turn an array of objects or server-provided records into an interactive table. It is particularly useful for administration screens, CRMs, ERPs, reports, and operational dashboards where users need to find and manipulate information quickly.

**Key features**
- Configurable columns: titles, visibility, sorting, searching, CSS classes, and custom rendering.
- Local data, **AJAX** loading, and processing modes suitable for different data volumes.
- Global search, column filters, pagination, and page-size selection.
- Row selection, group selection, and contextual actions.
- Static or dynamic grouping, expandable child rows, and footer aggregations.
- Events (`draw`, `page`, `search`, `order`, `select`, `action`, etc.) to synchronize the table with your application.
- Additional source modules for export, inline editing, custom selectors, multiselection, rendering, and French localization.

**Configuration and API.** Important options include `columns`, `data`, `ajax`, `paging`, `grouping`, `childRows`, and search/selection settings. Public methods include `search()`, `sortBy()`, `goToPage()`, `setData()`, `getSelectedRows()`, and `on()` / `off()`.

```js
const table = new TinyDataTable('#users', {
  columns: [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'role', title: 'Role', sortable: true }
  ],
  data: [
    { name: 'Alice', role: 'Admin' },
    { name: 'Bob', role: 'Editor' }
  ],
  paging: { enabled: true, pageSize: 10 }
});
```

**Strengths.** Extensive functionality without requiring jQuery for the core table, customizable rendering, and separation between data, presentation, and pagination. **Good to know:** search highlighting may use `mark.js`; some export features and demos use third-party libraries. Load only the extensions you need, and always validate data-changing operations on the server.

**[Component website](https://panda-softs.github.io/TinySuite/TinyDataTable/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyDataTable/demo/) · [Source files](./TinyDataTable/) · [Detailed documentation](./TinyDataTable/README.md)

#### TinyScheduler — Calendars and resource scheduling

**What is it for?** Build calendars, booking tools, team schedules, and resource-availability interfaces for rooms, vehicles, staff, equipment, and more.

**Key features**
- `month`, `week`, `day`, `list`, `resourceTimeGrid`, and `resourceTimeline` views.
- Resource-based scheduling with day/week ranges and a monthly range in timeline mode.
- Local events or external event sources, with date and view navigation.
- Time-slot selection, drag-and-drop event movement, and resizing when enabled.
- Overlap detection using `eventConflictScope` and conflict-resolution callbacks.
- Targeted event refreshes and scroll-position preservation in several views.
- Lifecycle hooks and callbacks for creation, editing, movement, deletion, and loading.

**Configuration and API.** Key options include `initialView`, `initialDate`, `events`, `eventSources`, `resources`, `resourceSources`, `editable`, `selectable`, `planningRange`, `slotDuration`, `minTime`, `maxTime`, and `onEventConflict`. A callback can return `false` or `Promise<false>` to cancel the relevant operation.

```js
const scheduler = new TinyScheduler('#calendar', {
  initialView: 'resourceTimeline',
  planningRange: 'week',
  editable: true,
  resources: [{ id: 'room-1', title: 'Room 1' }],
  events: [{
    id: 'meeting-1', title: 'Meeting',
    start: '2026-11-09T10:00:00',
    end: '2026-11-09T11:00:00',
    resourceId: 'room-1'
  }]
});
scheduler.render();
```

**Strengths.** Multiple calendar models in one component, cancellable callbacks, and refresh logic designed to reduce unnecessary DOM reconstruction. **Special setup:** the distribution files are named **`tiny-scheduler.min.js`** and **`tiny-scheduler.min.css`** (lowercase), unlike many other modules. Booking conflicts must also be validated on the server to prevent concurrent double bookings.

**[Component website](https://panda-softs.github.io/TinySuite/TinyScheduler/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyScheduler/demo/) · [Source files](./TinyScheduler/) · [Detailed documentation](./TinyScheduler/README.md)

---

### 2 · Forms & input

Six components that make forms faster, more precise, and more pleasant to use.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinyAutocomplete** | Suggest matching values while typing in a text field. | [Explore](https://panda-softs.github.io/TinySuite/TinyAutocomplete/) |
| **TinySelectize** | Enhance single- or multiple-selection `<select>` elements. | [Explore](https://panda-softs.github.io/TinySuite/TinySelectize/) |
| **TinyChips** | Enter and manage tags or multiple values. | [Explore](https://panda-softs.github.io/TinySuite/TinyChips/) |
| **TinyDatePicker** | Select a date or date range. | [Explore](https://panda-softs.github.io/TinySuite/TinyDatePicker/) |
| **tinyColorPicker** | Pick colors from a palette or native color selector. | [Explore](https://panda-softs.github.io/TinySuite/tinyColorPicker/) |
| **TinySignature** | Capture a handwritten signature on a canvas. | [Explore](https://panda-softs.github.io/TinySuite/TinySignature/) |

#### TinyAutocomplete — Smart suggestions

**What is it for?** Complete text fields as the user types: cities, customers, reference numbers, addresses, categories, or business-specific searches. Unlike an enhanced select, users continue working in their native `<input>` element.

**Key features.** Local or remote suggestions via `fetch`, relevance-based sorting, match highlighting, custom result rendering, keyboard navigation (`↑`, `↓`, `Enter`, `Escape`, `Tab`), search debouncing, and cancellation of outdated requests using `AbortController`.

**Configuration and API.** `data`, `url`, `queryParam`, `minLength`, `limit`, `searchDelay`, plus rendering and sorting functions. Initialize with `TinyAutocomplete.init(selector, options)`; retrieve instances with `TinyAutocomplete.getInstance()`; instance methods include `search()`, `open()`, `close()`, `clear()`, `enable()`, `disable()`, and `destroy()`.

**Strengths.** Easy integration into existing forms, no jQuery requirement, and explicit handling of asynchronous requests. **Good to know:** remote search requires an application endpoint and server-side validation of selected values.

**[Component website](https://panda-softs.github.io/TinySuite/TinyAutocomplete/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyAutocomplete/demo/) · [Source files](./TinyAutocomplete/) · [Detailed documentation](./TinyAutocomplete/README.md)

#### TinySelectize — Enhanced single and multiple selection

**What is it for?** Upgrade an HTML `<select>` with search, multiple selection, remote loading, and customizable presentation while preserving native form behavior.

**Key features.** Single/multiple selection, keyboard filtering, local or AJAX options, asynchronous loaders (Promise or callback), search caching, optgroups, rendering templates, detached dropdowns to avoid stacking issues, tree and highlighting plugins, and optional value restoration through `localStorage`.

**Configuration and API.** `minChars`, `options`, `valueField`, `labelField`, `searchField`, `load`, `ajax.url`, `ajax.queryParam`, `render.option`, `render.item`, `dropdownParent`, `storageKey`, `maxOptions`. Methods include `val()`, `addOption()`, `addItem()`, `refreshOptions()`, `sync()`, `open()`, `close()`, `destroy()`, and `whenValueReady()`.

```js
const select = new TinySelectize('#country', {
  minChars: 0,
  searchField: ['label'],
  showSelectedInDropdown: false
});
```

**Strengths.** The original `<select>` remains the **source of truth**, retains its form values, and emits `change`. **Special setup:** load `TinySelectize.Tree.plugin.js` and `TinySelectize.Mark.plugin.js` only when needed; AJAX results must follow the loader contract or be transformed through the provided options.

**[Component website](https://panda-softs.github.io/TinySuite/TinySelectize/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinySelectize/demo/) · [Source files](./TinySelectize/) · [Detailed documentation](./TinySelectize/README.md)

#### TinyChips — Tags, labels, and structured input

**What is it for?** Add and remove multiple values in a single control: keywords, skills, recipients, categories, filters, or labels attached to a business record.

**Key features.** Chip display, adding/removing/selecting values, static or AJAX suggestions, pattern validation, duplicate and maximum-count controls, customizable value/label fields, and callbacks for addition, removal, changes, and rejection.

**Configuration and API.** Two modes: **container** (`<div>`) or **source field** (`<input>`). In source-field mode, the native input is preserved and synchronized automatically. `valueMode: 'json'` supports tags containing commas; `valueMode: 'csv'` suits simple values. Useful options include `limit`, `allowDuplicates`, `separators`, `pattern`, `autocompleteOptions.url`, `autocompleteOptions.loadOnce`, `valueField`, `labelField`, and `onChange`.

**Strengths.** Good form integration and explicit serialization behavior. **Good to know:** prefer JSON when values may contain delimiters; client-side validation does not replace backend validation.

**[Component website](https://panda-softs.github.io/TinySuite/TinyChips/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyChips/demo/) · [Source files](./TinyChips/) · [Detailed documentation](./TinyChips/README.md)

#### TinyDatePicker — Dates and date ranges

**What is it for?** Replace or enhance date inputs with a form-friendly calendar for bookings, deadlines, reporting periods, and start/end dates.

**Key features.** `inline`, `modal`, and `permanent` modes; single-date or range selection; localized month/day names and labels; output formats; min/max constraints; disabling weekends or dates defined by a function; month/year navigation; and confirmation/clear buttons.

**Configuration and API.** `mode`, `allowRangeSelection`, `selectedRange`, `rangeSeparator`, `dateFormat`, `locale`, `i18n`, `minDate`, `maxDate`, `dateRule`, `disableWeekends`, `disableDayFn`, `firstDay`, `showClearBtn`, `inputTriggerMode`, and `autoClose`. Initialize with `new TinyDatePicker(target, options)`; the component documentation describes methods for reading and updating dates and ranges.

```js
const picker = new TinyDatePicker('#booking-date', {
  mode: 'modal',
  allowRangeSelection: true,
  showClearBtn: true,
  disableWeekends: true
});
```

**Strengths.** One component for multiple layouts and business rules, with localization options. **Good to know:** define the date format expected by your server and handle time zones separately if your application works with timestamps rather than calendar dates.

**[Component website](https://panda-softs.github.io/TinySuite/TinyDatePicker/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyDatePicker/demo/) · [Source files](./TinyDatePicker/) · [Detailed documentation](./TinyDatePicker/README.md)

#### tinyColorPicker — Color palettes and custom colors

**What is it for?** Choose colors in customization interfaces: themes, categories, statuses, events, labels, or graphic elements.

**Key features.** Configurable palettes, recent colors, HEX input, optional native color picker, optional clearing, automatic upward/downward opening, configurable parent container, and the `tinycolorpicker:change` event.

**Configuration and API.** `palette`, `allowRecent`, `recentMax`, `allowCustomColor`, `allowClearColor`, `initialColor`, `direction`, `parentContainer`, `storageKey`, `onColorSelected`. Methods include `getValue()`, `setValue()`, `clear()`, `show()`, `hide()`, `toggle()`, and `destroy()`.

**Strengths.** Small integration footprint and native color selection for unrestricted colors. **Special setup:** light/dark appearance follows **CSS `color-scheme` and `light-dark()`**; there is no JavaScript `theme` option or `setTheme()` method. CSS variables such as `--tcp-color` and `--tcp-color-soft` expose the selected color.

**[Component website](https://panda-softs.github.io/TinySuite/tinyColorPicker/)** · [Live demo](https://panda-softs.github.io/TinySuite/tinyColorPicker/demo/) · [Source files](./tinyColorPicker/) · [Detailed documentation](./tinyColorPicker/README.md)

#### TinySignature — Handwritten signatures on canvas

**What is it for?** Capture a handwritten trace in the browser, for example on internal approval forms, delivery receipts, service reports, or other forms.

**Key features.** Mouse, touch, and stylus drawing; stroke width adjusted to movement; configurable pen/background colors; undo/redo history; canvas resizing; empty-signature detection; point import/export; and PNG, JPEG, or SVG image export.

**Configuration and API.** `penColor`, `backgroundColor`, `minWidth`, `maxWidth`, `minDistance`, `velocityFilterWeight`, `throttle`. Methods include `clear()`, `undo()`, `redo()`, `isEmpty()`, `resizeCanvas()`, `toDataURL()`, `fromDataURL()`, and point-manipulation functions.

**Strengths.** A standalone Canvas 2D component without a mandatory external service. **Good to know:** use an opaque background when exporting JPEG; account for device pixel density when sizing the canvas; a signature image **is not, by itself, a legally qualified electronic signature solution**.

**[Component website](https://panda-softs.github.io/TinySuite/TinySignature/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinySignature/demo/) · [Source files](./TinySignature/) · [Detailed documentation](./TinySignature/README.md)

---

### 3 · Navigation & layout

Five components for organizing page space, menus, and user journeys.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinyTabs** | Organize content into tabbed panels. | [Explore](https://panda-softs.github.io/TinySuite/TinyTabs/) |
| **TinyDropdown** | Display contextual action menus. | [Explore](https://panda-softs.github.io/TinySuite/TinyDropdown/) |
| **TinySideNav** | Build side navigation. | [Explore](https://panda-softs.github.io/TinySuite/TinySideNav/) |
| **TinyCollapsible** | Expand/collapse sections and accordion menus. | [Explore](https://panda-softs.github.io/TinySuite/TinyCollapsible/) |
| **TinyGroupButton** | Present checkboxes as a group of selection buttons. | [Explore](https://panda-softs.github.io/TinySuite/TinyGroupButton/) |

#### TinyTabs — Accessible, adaptable tabs

**What is it for?** Organize multiple sections on one page: profiles, settings, history, details, statistics, or subviews of an application.

**Key features.** Tab panels, active-tab indicator, disabled tabs, keyboard navigation, basic ARIA attributes, touch-friendly swipeable mode, configurable animation duration, and callbacks when panels change.

**Configuration and API.** `element`, `duration`, `swipeable`, `onShow`; `select(tabId)`, `updateTabIndicator()`, `destroy()`, `TinyTabs.init()`, and `TinyTabs.getInstance()`.

**Strengths.** Compact API without jQuery or an external animation engine; a good fit for settings pages and complex detail views. **Good to know:** associate each tab with the correct panel and test accessibility in your application's actual context.

**[Component website](https://panda-softs.github.io/TinySuite/TinyTabs/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyTabs/demo/) · [Source files](./TinyTabs/) · [Detailed documentation](./TinyTabs/README.md)

#### TinyDropdown — Action menus and contextual menus

**What is it for?** Show actions near a button—such as “View,” “Edit,” “Duplicate,” or “Delete”—or present choices in a toolbar.

**Key features.** Click or hover opening, left/right alignment, width constrained to the trigger, automatic closing, positioning based on available space, CSS animations, lifecycle callbacks, and shared menus for multiple rows.

**Configuration and API.** `alignment`, `constrainWidth`, `coverTrigger`, `closeOnClick`, `hover`, `container`, `virtualTrigger`, `adjustMenuState`, `onBeforeOpen`, `onItemClick`. With `virtualTrigger`, the same menu can be opened from different buttons through `openFrom(trigger)`.

**Strengths.** Particularly useful in tables and interfaces containing many action buttons. **Good to know:** a menu can be resolved through `data-target`, `aria-controls`, or a nearby element; action permissions must always be enforced server-side.

**[Component website](https://panda-softs.github.io/TinySuite/TinyDropdown/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyDropdown/demo/) · [Source files](./TinyDropdown/) · [Detailed documentation](./TinyDropdown/README.md)

#### TinySideNav — Side navigation and mobile menus

**What is it for?** Provide a side navigation panel for dashboards, management applications, or mobile interfaces.

**Key features.** Opening from the left or right, backdrop overlay, touch swipe gestures, page-scroll locking, explicit closing, and open/close lifecycle callbacks.

**Configuration and API.** `edge: 'left' | 'right'`, `draggable`, `preventScrolling`, `inDuration`, `outDuration`, `onOpenStart`, `onOpenEnd`, `onCloseStart`, `onCloseEnd`. API includes `new TinySideNav(...)`, `TinySideNav.init(...)`, and `TinySideNav.getInstance(...)`.

**Strengths.** No jQuery or external animation engine dependency; natural integration into responsive navigation. **Good to know:** test focus handling, scroll locking, and dismissal on pages with other overlays.

**[Component website](https://panda-softs.github.io/TinySuite/TinySideNav/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinySideNav/demo/) · [Source files](./TinySideNav/) · [Detailed documentation](./TinySideNav/README.md)

#### TinyCollapsible — Accordions and collapsible sections

**What is it for?** Reduce visual density by grouping information into sections: FAQs, filters, settings, categories, navigation menus, or detailed records.

**Key features.** Accordion mode (one section open at a time) or multiple open sections, configurable animations, disabled items, cancellable callbacks before opening/closing, programmatic expansion/collapse, and an additional `TinyCollapsibleMenu` controller for nested menus.

**Configuration and API.** `accordion`, `inDuration`, `outDuration`, `easing`, `headerSelector`, `bodySelector`, `activeClass`, `onOpenStart`, `onCloseStart`. Methods include `open()`, `close()`, `toggle()`, `openAll()`, `closeAll()`, and section-management functions.

**Strengths.** Works with straightforward HTML and does not require an animation library. **Good to know:** `onOpenStart` and `onCloseStart` callbacks can return `false` to prevent a transition.

**[Component website](https://panda-softs.github.io/TinySuite/TinyCollapsible/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyCollapsible/demo/) · [Source files](./TinyCollapsible/) · [Detailed documentation](./TinyCollapsible/README.md)

#### TinyGroupButton — Visual selection groups

**What is it for?** Turn a set of checkboxes into a group of selection buttons for product categories, filters, disciplines, preferences, or form attributes.

**Key features.** Native checkboxes as the source of truth, multiple selection, a special “All” option, visual-state synchronization, normalized CSV values, native `onChange` and `afterChange` events, and support for dynamically added options.

**Configuration and API.** `TinyGroupButton.getInstance('#categories', options)` creates or retrieves an instance; methods include `buildValue()`, `getValue()`, `updateValue()`, `setValue()`, `check()`, and `destroy()`. Use `activeClass` to customize the selected appearance.

**Strengths.** Lightweight and close to native form behavior. **Special setup:** the “All” checkbox has the `.all` class on its `input`; it is not included in the CSV value. `updateValue()` synchronizes the DOM without triggering `onChange`.

**[Component website](https://panda-softs.github.io/TinySuite/TinyGroupButton/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyGroupButton/demo/) · [Source files](./TinyGroupButton/) · [Detailed documentation](./TinyGroupButton/README.md)

---

### 4 · Media

Three complementary tools for presenting, browsing, and organizing images and other visual content.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinyGallery** | Manage an image collection with additions, removals, and reordering. | [Explore](https://panda-softs.github.io/TinySuite/TinyGallery/) |
| **TinyLightbox** | Open large images with zoom and navigation. | [Explore](https://panda-softs.github.io/TinySuite/TinyLightbox/) |
| **TinyCarousel** | Slide through cards, images, or other content. | [Explore](https://panda-softs.github.io/TinySuite/TinyCarousel/) |

#### TinyGallery — Editable galleries and image management

**What is it for?** Manage photos associated with a product, property, listing, or business record. The component supports both **viewing images** and **preparing changes** before saving them.

**Key features.** Thumbnails, file additions, reversible removal, reordering, tracking of existing/added/modified images, opening images in TinyLightbox, image-editing hooks, image-count and file-size limits, and change/error callbacks.

**Configuration and API.** `images`, `resolveUrl`, `maxImages`, `maxFileSize`, `sortable`, `addable`, `removable`, `editable`, `onEdit`, `confirmRemove`, `onChange`. Methods include `setImages()`, `addFiles()`, `getItems()`, `getState()`, `getValue()`, `move()`, `remove()`, `undo()`, and `destroy()`.

**Strengths.** A useful state model that distinguishes already-saved files from pending changes. **Required dependency:** load **TinyLightbox** before **TinyGallery**. **Good to know:** the gallery does not replace an upload backend; your application must save new files, process removals, and enforce authorization. An external callback provides the image editor/cropper.

**[Component website](https://panda-softs.github.io/TinySuite/TinyGallery/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyGallery/demo/) · [Source files](./TinyGallery/) · [Detailed documentation](./TinyGallery/README.md)

#### TinyLightbox — Immersive image viewer

**What is it for?** Display photos in a full-screen viewer with smooth navigation without leaving the page—ideal for product galleries, portfolios, collections, and visual attachments.

**Key features.** Opening from `data-lightbox` links or an image array, previous/next navigation, zoom and panning, mouse-wheel and double-click interactions, touch gestures, vertical swipe-to-close, keyboard shortcuts, neighboring-image preloading, captions, and customizable animations.

**Configuration and API.** `images`, `selector`, `loop`, `maxZoom`, `zoomStep`, `wheelZoom`, `swipe`, `verticalClose`, `effects`, `captions`, `captionPosition`, `keyboard`, `preload`, and callbacks (`onOpen`, `onClose`, `onChange`, etc.). Methods include `open()`, `close()`, `next()`, `previous()`, `goTo()`, `zoomIn()`, `zoomOut()`, and `destroy()`.

**Strengths.** Works on its own or as the image viewer for TinyGallery, without a framework. **Good to know:** this is documented as an **image viewer**; do not assume native video support. Validate image URLs and captions supplied by your application.

**[Component website](https://panda-softs.github.io/TinySuite/TinyLightbox/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyLightbox/demo/) · [Source files](./TinyLightbox/) · [Detailed documentation](./TinyLightbox/README.md)

#### TinyCarousel — 3D carousel and content slider

**What is it for?** Highlight images, product cards, testimonials, or editorial content in an interactive horizontal space.

**Key features.** Materialize-style 3D carousel, `fullWidth` horizontal track mode, multiple visible slides, arrow navigation, configurable indicator placement, progress bar, adjustable slides-per-move, and an option to disable wrapping.

**Configuration and API.** `fullWidth`, `perPage`, `perMove`, `gap`, `padding`, `arrows`, `indicators`, `indicatorsPosition`, `progressBar`, `noWrap`, `duration`, `numVisible`, `onCycleTo`.

```js
const carousel = new TinyCarousel(document.querySelector('#carousel'), {
  fullWidth: true,
  perPage: 3,
  perMove: 1,
  gap: '1rem',
  arrows: true,
  indicators: true
});
```

**Strengths.** One component supports two distinct presentations, with configurable navigation and slide density. **Good to know:** `progressBar` replaces the classic indicators; adapt `perPage` to screen sizes and provide alternative text for images.

**[Component website](https://panda-softs.github.io/TinySuite/TinyCarousel/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyCarousel/demo/) · [Source files](./TinyCarousel/) · [Detailed documentation](./TinyCarousel/README.md)

---

### 5 · Interactions & editing

Three components for acting directly on data and helping users make decisions.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinySortableList** | Reorder items by drag-and-drop or keyboard. | [Explore](https://panda-softs.github.io/TinySuite/TinySortableList/) |
| **TinyInlineEditor** | Edit rich text directly within a page. | [Explore](https://panda-softs.github.io/TinySuite/TinyInlineEditor/) |
| **TinySwal** | Display dialogs, confirmations, forms, and notifications. | [Explore](https://panda-softs.github.io/TinySuite/TinySwal/) |

#### TinySortableList — Reorderable lists

**What is it for?** Let users define the order of business items: resources, workflow steps, priorities, categories, images, or configuration rows.

**Key features.** Mouse, touch, and stylus drag-and-drop; keyboard movement (`ArrowUp` / `ArrowDown`); calculation of items whose positions actually changed; dynamically added items; start/change/end callbacks; and restoring the previous order when an operation fails.

**Configuration and API.** `getId`, `onStart`, `onChange`, `onEnd`, `onError`. Methods include `getItems()`, `getOrder()`, `getChanges()`, `setOrder()`, and `destroy()`.

**Strengths.** A practical persistence contract: `onEnd()` can wait for an asynchronous request; returning `false` restores the previous order. **Good to know:** validate item IDs, positions, and permissions when saving the order server-side.

**[Component website](https://panda-softs.github.io/TinySuite/TinySortableList/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinySortableList/demo/) · [Source files](./TinySortableList/) · [Detailed documentation](./TinySortableList/README.md)

#### TinyInlineEditor — In-place content editing

**What is it for?** Edit a description, note, comment, or HTML content directly where it appears, without opening a separate form.

**Key features.** Contextual formatting toolbar (bold, italic, headings, lists, links, alignment, colors); `light`, `dark`, and experimental `purple` themes; `DIV`/`SPAN`/`TEXTAREA` integration; change events; delayed and explicit saving; and multiple-instance support.

**Configuration and API.** jQuery plugin `$('#editor').tinyInlineEditor({...})`, with compatibility through `$.fn.inLine`. Options include `toolbar`, `formats`, `colors`, `theme`, `autosaveOn`, `pasteAsPlainText`, `sanitizeHTML`, `onChange`, `onSave`. Instance methods include `setContent()`, `commitChange()`, `flush()`, and `destroy()`.

**Strengths.** Fast editing, application-specific callbacks, and serialized saves per instance. **Required dependency: jQuery.** **Security warning:** the editor **does not automatically sanitize untrusted HTML**. Sanitize content before insertion and on the server; `document.execCommand`, used by this implementation, is deprecated. Await `flush()` before destroying an instance when a pending save must complete.

**[Component website](https://panda-softs.github.io/TinySuite/TinyInlineEditor/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyInlineEditor/demo/) · [Source files](./TinyInlineEditor/) · [Detailed documentation](./TinyInlineEditor/README.md)

#### TinySwal — Dialogs, alerts, and notifications

**What is it for?** Replace native alerts with confirmation, validation, deletion, or input dialogs, and display unobtrusive toast notifications.

**Key features.** Modal dialogs, stackable toasts, confirm/deny/delete/cancel buttons, forms, structured values, Promise-based results, asynchronous validation, timers and progress bars, draggable dialogs, scrollable content, configurable mount targets, and CSS-variable customization.

**Configuration and API.** `TinySwal.fire({...})` returns a **Promise**; results include flags such as `isConfirmed`, `isDenied`, or `isDeleted`. Options cover titles, icons, buttons, duration, positioning, validation, and callbacks. Static helpers simplify dialogs and notifications.

```js
const result = await TinySwal.fire({
  title: 'Delete this item?',
  text: 'This action requires confirmation.',
  icon: 'warning',
  showCancelButton: true
});

if (result.isConfirmed) {
  // Perform the server-authorized action.
}
```

**Strengths.** Clear asynchronous API, several result types, and flexible presentation. **Good to know:** client-side buttons and validation improve usability but never replace backend authorization; handle dismissal, cancellation, and network failures.

**[Component website](https://panda-softs.github.io/TinySuite/TinySwal/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinySwal/demo/) · [Source files](./TinySwal/) · [Detailed documentation](./TinySwal/README.md)

---

### 6 · Developer tools

One utility focused on interface composition and dynamic content rendering.

| Component | What does it do? | Website |
| :-- | :-- | :-- |
| **TinyT** | Compile and render HTML templates from JavaScript data. | [Explore](https://panda-softs.github.io/TinySuite/TinyT/) |

#### TinyT — JavaScript template engine

**What is it for?** Generate HTML from application data without installing a full framework: table rows, cards, panels, reusable fragments, or detail views.

**Key features.** JavaScript expression interpolation, `{{if}}` / `{{else}}` conditions, `{{each}}` loops, nested `{{tmpl}}` templates, helper functions, template registration, compilation and caching, rendering to a string or DOM element, array processing, and missing-identifier diagnostics.

**Configuration and API.** `TinyT.render(template, data)`, `TinyT.renderTo(element, template, data)`, `TinyT.compile()`, `TinyT.registerTemplate()`, `TinyT.clearCache()`, and `TinyT.configure()`. Options include `helpers`, `strict`, `missingToUndefined`, `onMissing`, and `rowTransform`. Optional jQuery integration is available through `$.tmpl()` / `$.fn.tmplTo()`.

```js
const html = TinyT.render('<strong>${name}</strong>', {
  name: 'TinySuite'
});
```

**Strengths.** Focused engine, reusable templates, and compilation caching. **Security warning:** TinyT evaluates JavaScript expressions and **does not automatically HTML-escape every interpolation**. Use only trusted templates; escape or sanitize data before inserting it into the DOM. This is not a sandboxed template engine.

**[Component website](https://panda-softs.github.io/TinySuite/TinyT/)** · [Live demo](https://panda-softs.github.io/TinySuite/TinyT/demo/) · [Source files](./TinyT/) · [Detailed documentation](./TinyT/README.md)

---

## Installation and usage

### Option A — Integrate a single component

The simplest approach is to copy the required files from the component's folder, then load its CSS (if provided) and JavaScript.

Example with **TinyTabs**, assuming the TinySuite directory structure is preserved on your server:

```html
<link rel="stylesheet" href="/assets/TinySuite/TinyTabs/dist/TinyTabs.min.css">

<ul class="tabs js-tabs">
  <li class="tab"><a href="#overview" class="active">Overview</a></li>
  <li class="tab"><a href="#settings">Settings</a></li>
</ul>
<section id="overview">Overview content</section>
<section id="settings">Settings content</section>

<script src="/assets/TinySuite/TinyTabs/dist/TinyTabs.min.js"></script>
<script>
  const tabs = new TinyTabs({ element: '.js-tabs' });
</script>
```

> Paths beginning with `/assets/TinySuite/...` are **illustrative**; adjust them to your hosting setup. Compiled files live in `dist/` when produced by the repository build. Consult the component's README for any additional scripts or styles.

### Option B — Combine multiple components

Load only the modules your page uses, in the correct order when dependencies exist. For example, **TinyLightbox + TinyGallery**:

```html
<link rel="stylesheet" href="/assets/TinySuite/TinyLightbox/dist/TinyLightbox.min.css">
<link rel="stylesheet" href="/assets/TinySuite/TinyGallery/dist/TinyGallery.min.css">

<div id="gallery"></div>

<script src="/assets/TinySuite/TinyLightbox/dist/TinyLightbox.min.js"></script>
<script src="/assets/TinySuite/TinyGallery/dist/TinyGallery.min.js"></script>
<script>
  const gallery = new TinyGallery('#gallery', {
    images: ['photo-1.webp', 'photo-2.webp'],
    resolveUrl: name => '/images/' + encodeURIComponent(name)
  });
</script>
```

### Special distribution considerations

| Component | Special considerations |
| :-- | :-- |
| **TinyScheduler** | Compiled files: `dist/tiny-scheduler.min.js` and `dist/tiny-scheduler.min.css`; source code is split across several JS/SCSS files. |
| **TinyDataTable** | Additional JavaScript modules for export, rendering, selection, editing, and localization; load the ones your integration needs. |
| **TinySelectize** | Separate tree and highlighting plugins. |
| **TinyGallery** | Requires TinyLightbox, loaded before the gallery. |
| **TinyInlineEditor** | Requires jQuery; a vendor file is supplied in the component folder. |
| **TinyGroupButton / TinySignature / TinyT** | The main build manifest produces minified JavaScript for these modules but no component-specific distribution CSS. |
| **tinyColorPicker** | Case-sensitive folder name: `tinyColorPicker`; JavaScript class: `TinyColorPicker`. |

### Which component should you choose?

| Requirement | Recommended component |
| :-- | :-- |
| Autocomplete a text `<input>` | **TinyAutocomplete** |
| Enhance a `<select>` while preserving native form behavior | **TinySelectize** |
| Enter multiple free-form tags | **TinyChips** |
| Show business data with sorting, filters, and pagination | **TinyDataTable** |
| Book time slots or schedule resources | **TinyScheduler** |
| Browse full-screen photos | **TinyLightbox** |
| Add, remove, and reorder photos | **TinyGallery** + **TinyLightbox** |
| Display cards or images as slides | **TinyCarousel** |
| Confirm an action before executing it | **TinySwal** |
| Edit HTML directly in a page | **TinyInlineEditor** |
| Reorder a business list | **TinySortableList** |

---

## Architecture and technical philosophy

### One repository, separate components

The library is organized into individual folders at the repository root. Each folder may contain JavaScript source, CSS/SCSS, distributions, documentation, demos, and sometimes tests or plugins.

```text
TinySuite/
├── TinyDataTable/
│   ├── TinyDataTable.js
│   ├── README.md
│   ├── demo/
│   └── dist/
├── TinyScheduler/
│   ├── src/js/
│   ├── src/scss/
│   ├── README.md
│   ├── demo/
│   └── dist/
├── TinyAutocomplete/
├── TinySelectize/
├── ... other components ...
├── scripts/
│   ├── dist-entries.json
│   ├── build-dist.cjs
│   ├── build-site.py
│   ├── build_site.py
│   ├── verify_site.py
│   └── check-demos.cjs
├── website/
│   ├── catalog.json
│   ├── src/scss/
│   └── assets/
├── .github/workflows/
└── README.md
```

**Implementation and organization:**

1. **Browser-side JavaScript.** Components expose constructors, initialization functions, plugins, or instance APIs as appropriate. Most rely on native DOM APIs; exceptions are documented.
2. **Local state and events.** Each module manages its own state, interactions, and callbacks. The host application remains responsible for business operations, permissions, and persistence.
3. **Independent CSS.** Components provide their own styles when needed; some styles are maintained in SCSS source files.
4. **Separate source and distribution files.** `scripts/dist-entries.json` describes build entries; `scripts/build-dist.cjs` generates distribution assets, including the TinyScheduler bundle without Gulp.
5. **Separate static website.** `website/catalog.json` describes the 20 components and their categories. Python scripts generate the component pages and copy demos/distributions into `.build/site/`.
6. **Automated publishing.** GitHub Actions checks distributions and assembles the website before deployment to GitHub Pages.

### Dependencies: general rule and exceptions

**Most components can be used on their own**, but zero dependencies is not a universal guarantee. Distinguish between:

- **Runtime dependencies:** for example, jQuery for TinyInlineEditor or TinyLightbox for TinyGallery.
- **Optional integrations:** for example, `mark.js` for certain TinyDataTable features, TinySelectize plugins, or an image-editing adapter for TinyGallery.
- **Development dependencies:** npm tools for minifying and bundling distributions and Python for building the website; these do not need to be loaded in end users' browsers.

A modular architecture makes incremental adoption easier, but does not automatically guarantee compatibility with every browser or framework.

---

## Development and validation

From the repository root:

```bash
npm ci
npm run build
npm run verify
```

- **`npm ci`** installs the dependency versions locked in `package-lock.json`.
- **`npm run build`** regenerates distribution assets defined by the build manifest.
- **`npm run verify`** checks distribution consistency, vendor files, and local references used by demos.

To build and verify the static website:

```bash
python3 scripts/build-site.py
python3 scripts/verify_site.py
```

The TinySuite website is generated in **`.build/site/`**. Deployment is handled by the repository's GitHub Actions workflow on the `main` branch.

> [!NOTE]
> Files in `dist/` are tracked build artifacts: when a source change affects a distribution, regenerate the files and verify their consistency. Outputs should remain reproducible across local development and CI environments.

### Integration best practices

- **Load only the components you need**, respecting explicit dependency order.
- **Destroy instances** when their host elements are removed, if the module provides `destroy()`, to release event listeners and resources.
- **Handle network failures** in AJAX callbacks and save operations; UI components do not replace a backend.
- **Validate and sanitize HTML** before insertion, especially with TinyT and TinyInlineEditor.
- **Test accessibility** for keyboard use, screen readers, contrast, and touch interactions in your application; keyboard shortcuts or ARIA attributes alone do not constitute WCAG certification.
- **Verify data formats** (dates, JSON/CSV, signatures, images) and server-side persistence.

---

## Frequently asked questions

<details>
<summary><strong>Do I need to install all 20 components?</strong></summary>

No. TinySuite is a collection: use only the files for the components you need, together with any explicit dependencies.

</details>

<details>
<summary><strong>Do I need React, Vue, Angular, or jQuery?</strong></summary>

No framework is required for the collection as a whole. Most components use vanilla JavaScript. **TinyInlineEditor requires jQuery**; **TinyT can optionally use it**. Framework integration is possible, but you must handle instance mounting, updates, and cleanup correctly.

</details>

<details>
<summary><strong>Can the components work without a backend?</strong></summary>

Many demos and local features work entirely in the browser. Remote search, uploads, saving, authorization, and shared bookings require an appropriate backend.

</details>

<details>
<summary><strong>Where can I find the complete list of options for a component?</strong></summary>

Each component section above links to its **individual README** and **website page**. Those guides are the reference for exact API signatures, options, and in-depth examples.

</details>

<details>
<summary><strong>Why do some compiled files have different names?</strong></summary>

Historical conventions and module architectures vary. For example, TinyScheduler uses `tiny-scheduler.min.js` / `tiny-scheduler.min.css`. The `scripts/dist-entries.json` manifest defines the maintained build inputs and outputs.

</details>

<details>
<summary><strong>Does this README replace API documentation and tests?</strong></summary>

No. This document introduces the collection, its capabilities, and integration details. Individual READMEs, source code, demos, and tests remain necessary to confirm the exact contract of a given version.

</details>

---

## Resources and links

| Resource | URL |
| :-- | :-- |
| **Official TinySuite website** | **https://panda-softs.github.io/TinySuite/** |
| Interactive component catalog | https://panda-softs.github.io/TinySuite/components/ |
| Live demos | https://panda-softs.github.io/TinySuite/#demos |
| GitHub repository | https://github.com/Panda-Softs/TinySuite |
| Panda-Softs | https://panda-softs.github.io/ |
| Catalog metadata | [`website/catalog.json`](./website/catalog.json) |
| Distribution manifest | [`scripts/dist-entries.json`](./scripts/dist-entries.json) |

### Contributing and maintenance

Improvements, bug fixes, and suggestions can be discussed through the repository's [GitHub issues](https://github.com/Panda-Softs/TinySuite/issues). Keep changes focused, document behavioral changes, add or update relevant tests, and run the available checks before submitting a contribution.

**Licensing:** consult the repository and component license files, along with third-party dependency licenses. This README does not assume that every file is covered by a single license.

---

<div align="center">

### Build only what you need. Keep every component focused.

**[Explore TinySuite →](https://panda-softs.github.io/TinySuite/)**

<sub>Made by <a href="https://panda-softs.github.io/">Panda-Softs</a> · <a href="https://github.com/Panda-Softs/TinySuite">Source on GitHub</a></sub>

</div>
