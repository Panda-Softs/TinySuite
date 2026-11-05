# TinySwal

TinySwal is a lightweight, dependency-free modal and toast component inspired by SweetAlert-style APIs.

Version **1.4.2** makes `.tiny-swal-content` the only scrollable dialog area, keeps titles and action buttons fixed, and places tall images inside that scroll container. It retains the direct CTA URL navigation introduced in version 1.4.1 and all draggable-dialog, helper-method, form, and expanded-demo improvements from version 1.4.0.

## Highlights

- Promise-based API
- Modal and toast modes
- Confirm, deny, delete, cancel, close, and toast CTA outcomes
- Content-only popup scrolling with fixed titles/actions and background-page scroll locking
- Draggable dialogs that keep buttons and form controls clickable
- Toast stacking by target and position
- Toast-only right-side call-to-action button with optional direct URL navigation
- Timers and progress bars
- Async confirmation and validation
- Native input support
- Nested form serialization with objects and arrays
- Nested dialogs
- Custom mount targets
- CSS-variable theming
- No runtime dependencies

## Files

```text
TinySwal.js
TinySwal.css
TinySwal.scss
README.md
demo/demo.html
demo/demo2.html
```

Both demo files contain the same complete catalog of **20 examples**:

- 15 modal and component examples
- 5 toast-only examples, including long content, standard actions, colors, click-to-close, and the right-side CTA
- A redesigned invoice form with a fixed title/actions area and an internally scrollable field area

## Installation

Include the compiled stylesheet and JavaScript file.

```html
<link rel="stylesheet" href="TinySwal.css">
<script src="TinySwal.js"></script>
```

## Basic usage

```js
TinySwal.fire('TinySwal is working!');
```

```js
TinySwal.fire({
  title: 'Saved',
  text: 'Your changes were stored successfully.',
  icon: 'success'
});
```

The positional shorthand is also supported.

```js
TinySwal.fire('Saved!', 'Your changes were stored.', 'success');
```

## Result object

`TinySwal.fire()` returns a Promise that resolves when the popup closes.

```js
TinySwal.fire({
  title: 'Save your changes?',
  showDenyButton: true,
  showDeleteButton: true,
  showCancelButton: true
}).then((result) => {
  if (result.isConfirmed) {
    console.log('Confirmed', result.value);
  }

  if (result.isDenied) {
    console.log('Denied', result.value);
  }

  if (result.isDeleted) {
    console.log('Deleted', result.value);
  }

  if (result.isCallToAction) {
    console.log('Toast CTA selected', result.value);
  }

  if (result.isDismissed) {
    console.log('Dismissed because:', result.dismiss);
  }
});
```

| Property | Type | Description |
|---|---:|---|
| `isConfirmed` | boolean | The confirm button completed the popup. |
| `isDenied` | boolean | The deny button completed the popup. |
| `isDeleted` | boolean | The delete button completed the popup. |
| `isCallToAction` | boolean | The toast-only CTA button completed the popup. |
| `isDismissed` | boolean | The popup was dismissed instead of completed. |
| `dismiss` | string\|undefined | The dismiss reason when relevant. |
| `value` | any | The value returned by an input, form, or pre-action hook. |

## Dismiss reasons

```js
TinySwal.DismissReason.cancel
TinySwal.DismissReason.deny
TinySwal.DismissReason.delete
TinySwal.DismissReason.close
TinySwal.DismissReason.esc
TinySwal.DismissReason.backdrop
TinySwal.DismissReason.timer
```

## Scrollable popup behavior

Viewport-level modals lock document scrolling while they are open. When popup content is taller than the viewport, only `.tiny-swal-content` scrolls. The title and action buttons remain fixed in place.

The optional `.tiny-swal-image-wrap` is rendered inside `.tiny-swal-content`, before `.tiny-swal-content-body`. This allows tall images to share the same central scroll area without moving the action buttons or scrolling the background page.

```js
TinySwal.fire({
  title: 'Scrollable content',
  imageUrl: '/images/tall-image.webp',
  imageHeight: 1200,
  imageAlt: 'A tall image'
});
```

This prevents wheel and touch scrolling from moving the page behind the modal while keeping the title and actions visible.

```text
.tiny-swal-popup
└── .tiny-swal-body
    ├── .tiny-swal-title
    ├── .tiny-swal-content          # only scroll container
    │   ├── .tiny-swal-image-wrap   # optional
    │   └── .tiny-swal-content-body # text, HTML, form or input
    └── .tiny-swal-actions
```


Custom-target modals do not lock the document because they may be intentionally mounted inside a local interface region.

## Draggable dialogs

Set `draggable: true` to drag a modal by its title.

```js
TinySwal.fire({
  title: 'Drag me!',
  text: 'Drag this dialog by the title.',
  icon: 'success',
  draggable: true
});
```

Dragging starts only after a small pointer-movement threshold and only from `.tiny-swal-title`. Buttons, links, inputs, selects, labels, and textareas remain clickable.

## Toast mode

Toast mode removes the overlay, uses a non-blocking layout, and stacks notifications by target and position.

```js
TinySwal.fire({
  toast: true,
  position: 'top-end',
  icon: 'success',
  title: 'Saved',
  text: 'Your changes were stored.',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  closeOnClick: true
});
```

### Toast call-to-action button

The CTA is available only when `toast: true`. Its DOM node is inserted directly after `.tiny-swal-body`, making it a right-side sibling inside the toast popup.

```js
TinySwal.fire({
  toast: true,
  position: 'top-end',
  icon: 'success',
  title: 'Your work has been saved',
  text: 'Open the saved project now.',
  showConfirmButton: false,
  showCallToActionButton: true,
  callToActionButtonText: 'View',
  callToActionButtonAriaLabel: 'Open the saved project',
  callToActionUrl: '/projects/42',
  callToActionTarget: '_self',
  closeOnClick: false,
  preCallToAction: () => ({
    action: 'open-project',
    projectId: 42
  })
}).then((result) => {
  if (result.isCallToAction) {
    console.log(result.value);
  }
});
```

Generated structure:

```html
<div class="tiny-swal-popup" role="alert" aria-live="polite" tabindex="-1">
  <div class="tiny-swal-icon">...</div>
  <div class="tiny-swal-body">...</div>
  <button type="button" class="tiny-swal-call-to-action">View</button>
</div>
```

The CTA is not created for modal mode, even when `showCallToActionButton` is set.

When `callToActionUrl` is empty, clicking the CTA only resolves the Promise with `result.isCallToAction === true`. When a URL is provided, TinySwal opens it before resolving the CTA result.

Use `callToActionTarget: '_blank'` to open the URL in a new tab:

```js
TinySwal.fire({
  toast: true,
  title: 'Documentation available',
  showCallToActionButton: true,
  callToActionButtonText: 'Open docs',
  callToActionUrl: 'https://example.com/docs',
  callToActionTarget: '_blank'
});
```

For `_blank`, TinySwal automatically applies the equivalent of `rel="noopener noreferrer"`. There is intentionally no `callToActionRel` option.

`preCallToAction` always runs before navigation. Returning `false` or rejecting keeps the toast open and prevents the URL from opening. Async hooks are supported; TinySwal reserves the new tab while the original click still has browser user activation.

### Toast with standard actions

Regular confirm, deny, delete, and cancel buttons remain available in toast mode.

```js
TinySwal.fire({
  toast: true,
  icon: 'success',
  title: 'Your work has been saved',
  showConfirmButton: true,
  showDenyButton: true,
  showCancelButton: true,
  confirmButtonText: 'Open',
  denyButtonText: 'Undo',
  cancelButtonText: 'Dismiss',
  closeOnClick: false
});
```

## Timers and static helpers

```js
let timerInterval;

TinySwal.fire({
  title: 'Auto close alert!',
  html: 'I will close in <b></b> milliseconds.',
  timer: 2000,
  timerProgressBar: true,
  didOpen: () => {
    TinySwal.showLoading();

    const timer = TinySwal.getPopup().querySelector('b');
    timerInterval = setInterval(() => {
      timer.textContent = TinySwal.getTimerLeft();
    }, 100);
  },
  willClose: () => {
    clearInterval(timerInterval);
  }
});
```

Available static helpers:

```js
TinySwal.getTop()
TinySwal.getPopup()
TinySwal.getForm()
TinySwal.getTimerLeft()
TinySwal.showLoading()
TinySwal.hideLoading()
TinySwal.isLoading()
TinySwal.showValidationMessage(message)
TinySwal.closeTop(reason)
TinySwal.closeAll(reason)
```

The helpers operate on the topmost TinySwal instance.

## Async confirmation and validation

```js
TinySwal.fire({
  title: 'Submit your GitHub username',
  input: 'text',
  inputPlaceholder: 'e.g. octocat',
  showCancelButton: true,
  confirmButtonText: 'Look up',
  showLoaderOnConfirm: true,
  preConfirm: async (login) => {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(login)}`
    );

    if (!response.ok) {
      TinySwal.showValidationMessage('GitHub user not found.');
      return false;
    }

    return response.json();
  },
  allowOutsideClick: () => !TinySwal.isLoading()
});
```

`allowOutsideClick` accepts either a boolean or a function. Returning `false` prevents backdrop dismissal.

## Form values

TinySwal can serialize a form inside `html` into nested objects and arrays.

```js
TinySwal.fire({
  title: 'Create invoice',
  html: `
    <form id="invoice-form">
      <input name="client[firstname]" required>
      <input name="client[tags][]" value="vip" type="checkbox">
      <input name="billing[items][description][]" value="Service A">
      <input name="billing[items][qty][]" value="1" type="number">
    </form>
  `,
  showCancelButton: true,
  returnFormValues: true,
  validateForm: true,
  preConfirm: (values) => values
}).then((result) => {
  if (result.isConfirmed) {
    console.log(result.value);
  }
});
```

Example output:

```js
{
  client: {
    firstname: 'Jane',
    tags: ['vip']
  },
  billing: {
    items: {
      description: ['Service A'],
      qty: ['1']
    }
  }
}
```

Form-related options:

| Option | Type | Default | Description |
|---|---:|---:|---|
| `returnFormValues` | boolean | `false` | Serializes the selected form when confirming. |
| `validateForm` | boolean\|function | `false` | Uses native `reportValidity()` or a custom validator. |
| `formSelector` | string | `'form'` | Selects the form inside the popup content. |

## Nested dialogs

Pass a DOM element from the parent popup through the `parent` option. The parent remains locked until the child closes.

```js
TinySwal.fire({
  title: 'Parent modal',
  html: '<button id="open-child" type="button">Open child</button>',
  showCancelButton: true
});

requestAnimationFrame(() => {
  const button = document.getElementById('open-child');

  button.addEventListener('click', () => {
    TinySwal.fire({
      title: 'Child modal',
      text: 'Close me first.',
      parent: button,
      showCancelButton: true,
      allowOutsideClick: false
    });
  });
});
```

## Custom target

```css
#local-target {
  position: relative;
}

.local-swal-container {
  position: absolute;
  inset: 0;
}
```

```js
TinySwal.fire({
  target: '#local-target',
  title: 'Mounted locally',
  icon: 'info',
  customClass: {
    container: 'local-swal-container'
  }
});
```

## Options reference

### Content and layout

| Option | Type | Default | Description |
|---|---:|---:|---|
| `title` | string | `''` | Popup title. Strings containing HTML tags are rendered as HTML. |
| `text` | string | `''` | Text content. HTML-looking strings are rendered as HTML. |
| `html` | string | `''` | Explicit HTML content. Sanitize untrusted values before use. |
| `footer` | string | `''` | Footer HTML. |
| `icon` | string | `undefined` | `success`, `error`, `warning`, `info`, or `question`. |
| `customIcon` | string | `undefined` | Custom icon glyph or HTML. |
| `width` | number\|string | `null` | Popup width. Numeric values are converted to pixels. |
| `position` | string | `'center'` | Popup or toast position. |
| `imageUrl` | string | `''` | Image source. |
| `imageAlt` | string | `''` | Image alternative text. |
| `imageHeight` | number\|string | `0` | Explicit image height. |

Supported positions:

```text
top
 top-start
 top-end
 center
 center-start
 center-end
 bottom
 bottom-start
 bottom-end
```

### Standard buttons

| Option | Type | Default | Description |
|---|---:|---:|---|
| `showConfirmButton` | boolean | `true` for modal | Shows confirm. |
| `showCancelButton` | boolean | `false` | Shows cancel. |
| `showDenyButton` | boolean | `false` | Shows deny. |
| `showDeleteButton` | boolean | `false` | Shows delete. |
| `showCloseButton` | boolean | `false` | Shows the close control. |
| `confirmButtonText` | string | `'OK'` | Confirm label or HTML. |
| `cancelButtonText` | string | `'Cancel'` | Cancel label or HTML. |
| `denyButtonText` | string | `'Deny'` | Deny label or HTML. |
| `deleteButtonText` | string | `'Delete'` | Delete label or HTML. |
| `confirmButtonAriaLabel` | string | `''` | Confirm accessible name. |
| `cancelButtonAriaLabel` | string | `''` | Cancel accessible name. |
| `denyButtonAriaLabel` | string | `''` | Deny accessible name. |
| `deleteButtonAriaLabel` | string | `''` | Delete accessible name. |

### Toast CTA

| Option | Type | Default | Description |
|---|---:|---:|---|
| `showCallToActionButton` | boolean | `false` | Shows the CTA in toast mode only. |
| `callToActionButtonText` | string | `'View'` | CTA label or HTML. |
| `callToActionButtonAriaLabel` | string | `''` | CTA accessible name. |
| `callToActionUrl` | string | `''` | URL opened after `preCallToAction` succeeds. Relative and absolute URLs are supported. |
| `callToActionTarget` | string | `'_self'` | Navigation target such as `_self`, `_blank`, `_parent`, `_top`, or a named browsing context. |
| `preCallToAction` | function | `null` | Runs before navigation and before the CTA result resolves. Returned data becomes `result.value`; returning `false` prevents navigation. |

### Behavior

| Option | Type | Default | Description |
|---|---:|---:|---|
| `toast` | boolean | `false` | Enables toast mode. |
| `allowEscapeKey` | boolean | `true` for modal | Enables Escape dismissal. |
| `allowOutsideClick` | boolean\|function | `true` for modal | Controls backdrop dismissal. |
| `focusConfirm` | boolean | `true` for modal | Focuses confirm after opening. |
| `showOverlay` | boolean | `true` for modal | Shows the modal overlay. |
| `closeOnClick` | boolean | toast-dependent | Closes a toast when a non-interactive area is clicked. |
| `draggable` | boolean | `false` | Enables title-based dragging. |
| `timer` | number | `0` | Auto-close duration in milliseconds. |
| `timerProgressBar` | boolean | `false` | Displays timer progress. |
| `target` | selector\|HTMLElement\|jQuery | `document.body` | Mount target. |
| `parent` | selector\|HTMLElement\|jQuery | `null` | Nested-dialog parent signal. |

### Input and async hooks

| Option | Type | Default | Description |
|---|---:|---:|---|
| `input` | string | `null` | Native input type. |
| `inputAttributes` | object | `{}` | Attributes applied to the input. |
| `inputPlaceholder` | string | `''` | Input placeholder. |
| `inputValue` | any | `''` | Initial input value. |
| `showLoaderOnConfirm` | boolean | `false` | Shows loading state during async confirmation. |
| `preConfirm` | function | `null` | Runs before confirm. |
| `preDeny` | function | `null` | Runs before deny. |
| `preDelete` | function | `null` | Runs before delete. |

Returning `false` from a pre-action hook keeps the popup open.

### Lifecycle hooks

```js
willOpen(context)
didOpen(context)
willClose(context)
didClose(context)
```

Each hook receives:

```js
{
  popup,
  form,
  swal
}
```

The hook is also called with the TinySwal instance as `this`.

### Custom classes

```js
customClass: {
  container: 'my-container',
  overlay: 'my-overlay',
  modal: 'my-modal',
  popup: 'my-popup',
  icon: 'my-icon',
  body: 'my-body',
  title: 'my-title',
  content: 'my-content',
  imageWrap: 'my-image-wrap',
  image: 'my-image',
  footer: 'my-footer',
  input: 'my-input',
  confirmButton: 'my-confirm',
  cancelButton: 'my-cancel',
  denyButton: 'my-deny',
  deleteButton: 'my-delete',
  callToActionButton: 'my-toast-cta',
  closeButton: 'my-close',
  timerProgressBarContainer: 'my-timer-track',
  timerProgressBar: 'my-timer-bar'
}
```

## CSS variables

```css
.my-popup {
  --ts-width: 430px;
  --ts-background: #0f172a;
  --ts-color: #f8fafc;
  --ts-border: 1px solid rgba(255, 255, 255, 0.16);
  --ts-border-radius: 24px;
  --ts-box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);

  --ts-confirm-button-background-color: #8b5cf6;
  --ts-deny-button-background-color: #3085d6;
  --ts-cancel-button-background-color: #64748b;
  --ts-delete-button-background-color: #dc3741;

  --ts-call-to-action-background-color: #111827;
  --ts-call-to-action-color: #ffffff;
  --ts-call-to-action-border: 0;
  --ts-call-to-action-border-radius: 999px;
}
```

## SCSS compilation

Compile the SCSS source into the distributed CSS file.

```bash
npx sass --style=expanded --no-source-map TinySwal.scss TinySwal.css
```

## Accessibility notes

- Modal popups use `role="dialog"` and `aria-modal="true"`.
- Toasts use `role="alert"` and `aria-live="polite"`.
- Keyboard focus is trapped inside the topmost modal.
- Escape closes only the topmost modal when enabled.
- Interactive toast controls are excluded from click-to-close handling.
- Draggable behavior never starts from interactive controls.
- Add explicit ARIA labels when a button uses only an icon or ambiguous HTML.

## Security note

`title`, `html`, `footer`, and HTML-looking button labels may use `innerHTML`. Never pass unsanitized user-controlled HTML. For CTA links opened with `_blank`, TinySwal automatically isolates the new tab with `noopener noreferrer` behavior.
