# TinyCollapsible

`TinyCollapsible` is a dependency-free vanilla JavaScript collapsible / accordion component. It is designed as a cleaner replacement for Materialize-style collapsibles while keeping compatible markup.

It also includes `TinyCollapsibleMenu`, a controller for menus that contain many collapsibles, such as side navigation product/category menus.

## Files

```txt
TinyCollapsible/
├── TinyCollapsible.js
├── TinyCollapsible.scss
├── TinyCollapsible.css
├── README.md
└── demo/
    └── demo.html
```

## Basic markup

```html
<ul class="collapsible">
  <li>
    <a class="collapsible-header">First section <i class="chevron"></i></a>
    <div class="collapsible-body">
      <p>Content</p>
    </div>
  </li>
</ul>
```

## Basic initialization

```js
const collapsible = new TinyCollapsible('#basic-collapsible', {
  accordion: true
});
```

## Batch initialization

```js
const instances = TinyCollapsible.init('.collapsible', {
  accordion: true
});
```

## Options

| Option | Type | Default | Description |
|---|---:|---:|---|
| `accordion` | `boolean` | `true` | If true, only one item can be open inside one collapsible instance. |
| `inDuration` | `number` | `300` | Open animation duration in milliseconds. |
| `outDuration` | `number` | `300` | Close animation duration in milliseconds. |
| `easing` | `string` | `cubic-bezier(.4, 0, .2, 1)` | CSS transition timing function. |
| `headerSelector` | `string` | `.collapsible-header` | Header selector. |
| `bodySelector` | `string` | `.collapsible-body` | Body selector. |
| `activeClass` | `string` | `active` | Active item class. |
| `disabledClass` | `string` | `disabled` | Disabled item class. |
| `onOpenStart` | `function|null` | `null` | Called before opening. Return `false` to cancel. |
| `onOpenEnd` | `function|null` | `null` | Called after opening animation. |
| `onCloseStart` | `function|null` | `null` | Called before closing. Return `false` to cancel. |
| `onCloseEnd` | `function|null` | `null` | Called after closing animation. |

Callback signature:

```js
onOpenStart(item, index, instance) {}
onOpenEnd(item, index, instance) {}
onCloseStart(item, index, instance, meta) {}
onCloseEnd(item, index, instance) {}
```

## Instance methods

```js
collapsible.open(0);
collapsible.close(0);
collapsible.toggle(0);
collapsible.openAll();
collapsible.closeAll();
collapsible.expandAll();
collapsible.collapseAll();
collapsible.openFirst();
collapsible.openLast();
collapsible.openByHeaderText('Settings');
collapsible.closeOthers(0);
collapsible.isOpen(0);
collapsible.getOpenItems();
collapsible.refresh();
collapsible.destroy();
```

## Menu controller

Use `TinyCollapsibleMenu` when you have many collapsibles inside a menu and want to control them as one unit.

```js
const menu = new TinyCollapsibleMenu('#product_menu', {
  accordion: true
});

menu.expandAll();
menu.closeAll();
menu.expandUntil(document.querySelector('[data-product-id="77"]'));
menu.expandActivePath();
menu.setActiveLink('[data-product-id="77"]');
menu.expandToHref('?id=77');
```

## TinyCollapsibleMenu methods

```js
menu.refresh();
menu.expandAll();
menu.openAll();
menu.closeAll();
menu.collapseAll();
menu.toggleAll();
menu.hasOpenItems();
menu.getOpenItems();
menu.expandUntil(node, { scrollIntoView: true });
menu.expandActivePath();
menu.openByHeaderText('Kayak');
menu.expandToHref('?id=77');
menu.setActiveLink('[data-product-id="77"]');
menu.destroy();
```

## Recommended menu markup

This component supports your existing Materialize-style menu structure:

```html
<ul id="product_menu" class="sidenav-list has-chevron no-autoinit">
  <li class="no-padding">
    <ul class="collapsible collapsible-accordion">
      <li>
        <a class="collapsible-header" data-category-id="21">
          <span class="title">Bateau électrique</span>
          <span class="badge">1</span>
          <i class="chevron"></i>
        </a>
        <div class="collapsible-body">
          <ul>
            <li>
              <a href="?id=77" data-product-id="77">E-BOAT</a>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </li>
</ul>
```

## CSS variables

```css
:root {
  --tiny-collapsible-bg: #fff;
  --tiny-collapsible-color: #172033;
  --tiny-collapsible-header-active-bg: #eef6ff;
  --tiny-collapsible-header-active-color: #155eef;
  --tiny-collapsible-body-padding: 1rem;
  --tiny-collapsible-radius: 14px;
  --tiny-collapsible-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}
```

## Accessibility

TinyCollapsible adds:

- `role="button"` on headers when missing.
- `tabindex="0"` on headers when missing.
- `aria-expanded` on headers.
- `aria-controls` on headers.
- `aria-hidden` on bodies.
- keyboard support for Enter, Space, Arrow Up, Arrow Down, Home, End.

## Design notes

The original Materialize component used jQuery/cash and anime.js for height animation. TinyCollapsible uses vanilla DOM APIs and CSS transitions with measured `max-height`, so the visual animation remains smooth without an animation dependency.

# TinyCollapsible filterTree update

This update adds filter helpers to `TinyCollapsibleMenu`.

## API

```js
menu.filterTree(term, {
  itemSelector: '.menu-node',
  textSelector: '.title',
  hiddenClass: 'is-filter-hidden',
  matchClass: 'is-filter-match',
  ancestorClass: 'is-filter-ancestor',
  descendantClass: 'is-filter-descendant',
  highlightClass: 'tiny-collapsible-mark',
  highlight: true,
  autoExpand: true,
  includeDescendants: true,
  closeBeforeExpand: true,
  minLength: 1,
  caseSensitive: false
});
```

## Clear filter

```js
menu.clearFilter({
  itemSelector: '.menu-node'
});
```

## Recommended markup

Use explicit classes on filterable nodes:

```html
<li class="menu-node menu-node--branch">...</li>
<li class="menu-node menu-node--leaf">...</li>
```

Then search with:

```js
categoryMenuCollapsible.filterTree(term, {
  itemSelector: '.menu-node',
  textSelector: '.title'
});
```
