#!/usr/bin/env python3
"""Build shared Panda-Softs & TinySuite sites. Stdlib only; no server needed.

Run from any location: `python3 scripts/build-site.py`.
Website sources in `website/`; app distributions remain in their Tiny*/dist/.
"""
from __future__ import annotations
import html
import json
import hashlib
from pathlib import Path
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
WEBSITE=ROOT/'website'
SITE=ROOT/'.build/site'
PANDA=ROOT/'.build/panda-softs'
CATALOG=json.loads((WEBSITE/'catalog.json').read_text(encoding='utf-8'))
COMPONENT_DETAILS=json.loads((WEBSITE/'component_details.json').read_text(encoding='utf-8'))
REPO='https://github.com/Panda-Softs/TinySuite'

def esc(s):return html.escape(str(s),quote=True)

def svg_cube():
    return '''<svg viewBox="0 0 42 42" fill="none" aria-hidden="true"><path d="M21 3 38 12v19L21 40 4 31V12L21 3Z" stroke="url(#cube-a)" stroke-width="2.5" stroke-linejoin="round"/><path d="m4 12 17 9 17-9M21 21v19" stroke="url(#cube-b)" stroke-width="2.2"/><defs><linearGradient id="cube-a" x1="2" y1="0" x2="39" y2="41" gradientUnits="userSpaceOnUse"><stop stop-color="#33e8ff"/><stop offset=".53" stop-color="#7d83ff"/><stop offset="1" stop-color="#d56fff"/></linearGradient><linearGradient id="cube-b" x1="4" y1="15" x2="38" y2="38" gradientUnits="userSpaceOnUse"><stop stop-color="#3ceeff"/><stop offset="1" stop-color="#db62ff"/></linearGradient></defs></svg>'''

def svg_github():
    return '''<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.56.1.76-.24.76-.53v-2.1c-3.09.67-3.74-1.31-3.74-1.31-.5-1.27-1.23-1.6-1.23-1.6-1.01-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.47-.28-5.06-1.24-5.06-5.5 0-1.21.43-2.2 1.15-2.98-.12-.29-.5-1.41.11-2.94 0 0 .94-.3 3.06 1.14a10.7 10.7 0 0 1 5.58 0c2.12-1.44 3.05-1.14 3.05-1.14.61 1.53.23 2.65.11 2.94.72.78 1.15 1.77 1.15 2.98 0 4.27-2.6 5.21-5.08 5.49.4.35.76 1.03.76 2.08V22c0 .29.2.64.77.53A11.1 11.1 0 0 0 12 .9Z"/></svg>'''

def svg_box():
    return '''<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m3 7 9 5 9-5M12 12v10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'''

def button(label,href,primary=False,large=False,icon='',extra=''):
    style='c-button--primary' if primary else 'c-button--secondary'
    size='c-button--lg' if large else 'c-button--sm'
    icon=icon or ''
    return f'<a class="c-button {style} {size}" href="{esc(href)}" {extra}>{icon}{esc(label)}</a>'

def nav(*,brand='TinySuite',prefix='./',is_panda=False,show_cta=True):
    icon=(f'<img src="{prefix}assets/images/icon-panda.svg" alt="">' if is_panda else svg_cube())
    if is_panda:
        items=[('Products','#projects'),('JavaScript','#javascript'),('SwiftUI','#swiftui'),('About','#about')]
        cta=button('Explore Products','#projects',True)
        home='./'
    else:
        items=[('Components',prefix+'components/'),('Showcase',prefix+'#featured'),('Docs',prefix+'TinyDataTable/'),('Demos',prefix+'#demos'),('Panda-Softs ↗','https://panda-softs.github.io/')]
        cta=button('Get TinySuite',REPO,True,extra='target="_blank" rel="noopener noreferrer"')
        home=prefix
    cta=cta if show_cta else ''
    return f'''<header class="c-header"><div class="l-shell"><div class="c-header__inner">
      <a class="c-header__brand" href="{home}">{icon}<span>{esc(brand)}</span></a>
      <nav class="c-header__nav" data-site-nav aria-label="Main navigation">{''.join(f'<a href="{href}">{esc(text)}</a>' for text,href in items)}</nav>
      <div class="c-header__actions"><a class="c-header__github" href="https://github.com/Panda-Softs" target="_blank" rel="noopener noreferrer">{svg_github()} GitHub</a>{cta}
      <button class="c-header__menu" type="button" aria-label="Toggle navigation" aria-expanded="false" data-menu>☰</button></div>
    </div></div></header>'''

def page(title,description,body,*,prefix='./',mode='tinysuite',brand='TinySuite',is_panda=False):
    # Product-only cache buster: prevent an older stylesheet from being reused after a rebuild.
    css_revision = '?' + 'v=' + hashlib.sha256((WEBSITE/'assets/site.css').read_bytes()).hexdigest()[:10] if mode == 'product' else ''
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#06112a"><meta name="description" content="{esc(description)}"><title>{esc(title)}</title><link rel="stylesheet" href="{prefix}assets/site.css{css_revision}"><script defer src="{prefix}assets/site.js"></script></head>
    <body class="page page--{mode}"><div class="c-atmosphere {'c-atmosphere--panda' if is_panda else ''}" aria-hidden="true"><img class="c-atmosphere__ribbon" src="{prefix}assets/images/aurora-ribbon.svg" alt=""></div>
    {nav(brand=brand,prefix=prefix,is_panda=is_panda,show_cta=(mode!='tinysuite'))}<main id="main-content">{body}</main><footer class="l-shell c-footer"><span>© Panda-Softs · {esc(brand)}</span><span><a href="https://panda-softs.github.io/">Panda-Softs</a> · <a href="{REPO}">GitHub</a></span></footer></body></html>'''

# Categories are presented in the requested order. Details live in catalog.json.
FEATURED_CATEGORIES = (
    ('Data & Scheduling', 'Data management, tables and scheduling.', '▦'),
    ('Forms & Inputs', 'Data entry, selection and forms.', '▤'),
    ('Navigation & Layout', 'Navigation and content organization.', '▱'),
    ('Media', 'Image galleries, viewers and carousels.', '▧'),
    ('Interactions', 'Dialogs, editing and interactive manipulation.', '✧'),
    ('Developer Tools', 'Tools for JavaScript development.', '⌘'),
)


def featured_directory():
    """Render grouped components from the single catalog.json data source."""
    categories = {item['category'] for item in CATALOG}
    expected = {entry[0] for entry in FEATURED_CATEGORIES}
    if categories != expected:
        raise ValueError(f'Featured categories out of sync: {categories ^ expected}')
    if len({item['name'] for item in CATALOG}) != len(CATALOG):
        raise ValueError('Duplicate component names in catalog.json')

    parts = ['''<section class="l-shell component-directory" id="featured" aria-labelledby="featured-title">
      <div class="l-section-header component-directory__intro">
        <div><p class="c-eyebrow">EXPLORE THE LIBRARY</p><h2 id="featured-title" class="c-section-title">Featured Components</h2>
        <p class="component-directory__subtitle">All 20 independent components, organized by category. Explore their capabilities, product pages and live demos.</p></div>
        <a href="./components/">Browse the full catalog →</a>
      </div>''']
    parts.append('<nav class="component-directory__jump" aria-label="Featured component categories">')
    for name, _, _ in FEATURED_CATEGORIES:
        key = 'feature-' + name.lower().replace(' & ', '-').replace(' ', '-')
        parts.append(f'<a href="#{key}">{esc(name)}</a>')
    parts.append('</nav>')

    total = 0
    for category, description, glyph in FEATURED_CATEGORIES:
        items = [item for item in CATALOG if item['category'] == category]
        count = len(items)
        key = 'feature-' + category.lower().replace(' & ', '-').replace(' ', '-')
        parts.append(f'''<section class="component-directory__group" id="{key}" aria-labelledby="{key}-title">
          <header class="component-directory__group-header">
            <div class="component-directory__heading"><span class="component-directory__symbol" aria-hidden="true">{glyph}</span><div>
              <h3 id="{key}-title">{esc(category)}</h3><p>{esc(description)}</p></div></div>
            <span class="component-directory__count">{count} {'component' if count == 1 else 'components'}</span>
          </header><div class="component-directory__items">''')
        for item in items:
            name = item['name']
            details = item.get('featured_features')
            if not details:
                raise ValueError(f'Missing featured_features for {name} in catalog.json')
            art = f'assets/images/featured/{name.lower()}-preview.svg'
            if not (WEBSITE / art).is_file():
                raise FileNotFoundError(f'Missing component illustration: {art}')
            parts.append(f'''<article class="c-card c-card--glass directory-component">
              <a class="directory-component__art" href="./{esc(name)}/" aria-label="View {esc(name)} product details">
                <img src="./{art}" alt="" width="480" height="260" loading="lazy" decoding="async">
              </a>
              <div class="directory-component__body">
                <h4><a href="./{esc(name)}/">{esc(name)}</a></h4>
                <p>{esc(details)}</p>
                <div class="directory-component__actions"><a href="./{esc(name)}/">Product page <span aria-hidden="true">→</span></a><a href="./{esc(name)}/demo/">Live demo <span aria-hidden="true">↗</span></a></div>
              </div>
            </article>''')
            total += 1
        parts.append('</div></section>')
    if total != len(CATALOG):
        raise ValueError(f'Featured directory rendered {total}/{len(CATALOG)} components')
    parts.append('</section>')
    return ''.join(parts)


def home():
    cats=[('Data & Scheduling','Tables, schedulers and time-based components.','▣'),('Forms & Inputs','Autocomplete, select and enhanced controls.','▤'),('Navigation','Tabs, menus and content organization.','▱'),('Media','Galleries, lightboxes and media viewers.','▧'),('Interactions','Modals, alerts, toasts and feedback.','✧')]
    contents='''<section class="l-shell home-hero"><div class="home-hero__copy"><p class="c-eyebrow">TINYSUITE</p><h1 class="c-display-title">Small components.<br>Beautiful <span class="u-gradient-text">interfaces.</span></h1><p class="c-lead">TinySuite is a suite of lightweight, reusable JavaScript UI components for modern web apps. Build rich, responsive interfaces faster with clean, accessible, and customizable components.</p><div class="c-action-row">'''+button('Explore components','./components/',True,True,svg_box())+button('▷  View demos','#demos',False,True)+'''</div><div class="home-hero__benefits"><span><i>♧</i>Lightweight</span><span><i>ϟ</i>Modular</span><span><i>▤</i>Customizable</span><span><i>⬡</i>Accessible</span></div></div><div class="home-hero__visual">'''+"<img src=\"assets/images/tinysuite-hero.webp\" alt=\"Illustrative collection of six TinySuite component interfaces\" width=\"1180\" height=\"760\" fetchpriority=\"high\">"+'''</div></section>'''
    contents+='<section class="l-shell l-section category-list" id="categories">'+''.join(f'<a href="./components/" class="c-card c-card--glass category-tile"><span class="c-category-symbol">{symbol}</span><span><strong>{esc(name)}</strong><small>{esc(desc)}</small></span></a>' for name,desc,symbol in cats)+'</section>'
    contents+=featured_directory()
    contents+='<section class="l-shell home-demos" id="demos"><div><p class="c-eyebrow">LIVE DEMOS</p><h2 class="c-section-title">Explore the real components.</h2></div><div class="home-demos__links">'+''.join(button(n+' ↗','./'+n+'/demo/') for n in ('TinyDataTable','TinyScheduler','TinyGallery','TinySwal'))+'</div></section>'
    return page('TinySuite — Small components. Beautiful interfaces.','TinySuite: independent JavaScript components, product pages and interactive demos',contents)

# Asset names are derived from the existing distribution manifest rather than
# guessed from a component's display name (TinyScheduler and tinyColorPicker are
# important exceptions).
DIST_ENTRIES = json.loads((ROOT / 'scripts/dist-entries.json').read_text(encoding='utf-8'))


def dist_files(component):
    """Return the expected core files and optional modules from the build manifest."""
    if component == 'TinyScheduler':
        return ('tiny-scheduler.min.js', 'tiny-scheduler.min.css', [])
    js_sources = DIST_ENTRIES['javascript'].get(component, [])
    css_sources = DIST_ENTRIES['css'].get(component, [])
    if not js_sources:
        raise ValueError(f'Missing JS distribution entry for {component}')
    js = [name.removesuffix('.js') + '.min.js' for name in js_sources]
    css = [name.removesuffix('.css') + '.min.css' for name in css_sources]
    return (js[0], css[0] if css else None, js[1:] + css[1:])


def list_items(items, classname=None):
    klass = f' class="{classname}"' if classname else ''
    return ''.join(f'<li{klass}>{esc(item)}</li>' for item in items)


def product(c, has_demo):
    """One product template for all 20 entries; page content is data-driven."""
    name = c['name']
    details = COMPONENT_DETAILS.get(name)
    if not details:
        raise ValueError(f'Missing component details for {name}')
    required = ('summary', 'strengths', 'features', 'dependencies', 'use_cases', 'quickstart')
    absent = [key for key in required if not details.get(key)]
    if absent:
        raise ValueError(f'Incomplete details for {name}: {", ".join(absent)}')
    illustration = WEBSITE / 'assets' / 'images' / 'components' / f'component-{c["slug"]}.svg'
    if not illustration.is_file():
        raise FileNotFoundError(f'Product illustration not found: {illustration}')

    github = f'{REPO}/tree/main/{name}'
    docs = github  # The component's README lives in its own source directory.
    js_asset, css_asset, extra_assets = dist_files(name)
    badge_html = list_items(details.get('badges', []), 'product-hero__badge')
    feature_html = ''.join(
        f'<li class="product-feature"><span class="product-feature__check" aria-hidden="true">✓</span>'
        f'<span>{esc(feature)}</span></li>' for feature in details['features']
    )
    strengths_html = ''.join(
        f'<article class="c-card c-card--{("cyan", "violet", "gold")[i]} product-strength-card">'
        f'<span class="product-strength-card__number">{i + 1:02d}</span>'
        f'<h3>{esc(point["title"])}</h3><p>{esc(point["description"])}</p></article>'
        for i, point in enumerate(details['strengths'])
    )
    first_js, first_css = js_asset, css_asset
    links = []
    if first_css:
        links.append(f'<link rel="stylesheet" href="dist/{esc(first_css)}">')
    links.append(f'<script src="dist/{esc(first_js)}"></script>')
    assets_code = '\n'.join(links)
    extra = ''.join(f'<li><code>dist/{esc(asset)}</code></li>' for asset in extra_assets)
    extra_html = (
        f'<div class="product-assets__extras"><h3>Additional distribution modules</h3><ul>{extra}</ul>'
        f'<p>Load optional modules only when the relevant feature requires them, in the order documented by the component.</p></div>'
        if extra_assets else ''
    )

    starter = details['quickstart']
    snippets = [
        ('01', 'Include the distribution', assets_code, 'Available after building the component distributions.'),
        ('02', 'Add a host element', starter.get('html', ''), 'Adapt the markup to your application.'),
        ('03', 'Initialization sketch', starter.get('js', ''),
         'Illustrative configuration from the website catalog — the API and option names have not been verified against the component source.'),
    ]
    snippet_html = ''.join(
        f'<article class="c-code-panel product-code-card"><div class="product-code-card__head">'
        f'<span>{number}</span><h3>{esc(label)}</h3></div>'
        f'<pre><code>{esc(code)}</code></pre><p>{esc(note)}</p></article>'
        for number, label, code, note in snippets
    )
    # The archive contains only the website/scripts. Do not pretend to have
    # verified each JS initializer, runtime dependency or README against Tiny*.
    integration_notes = [note for note in details['dependencies']
                         if not note.startswith('Standalone JavaScript runtime.')
                         and not note.startswith('dist/')]

    body = f'''<section class="l-shell" aria-label="Breadcrumb"><nav class="product-breadcrumb" aria-label="Breadcrumb">
      <a href="../">TinySuite</a><span aria-hidden="true">/</span><a href="../components/">Components</a><span aria-hidden="true">/</span><span aria-current="page">{esc(name)}</span>
    </nav></section>
    <section class="l-shell product-hero" data-product-template="v3" aria-labelledby="product-name">
      <div class="product-hero__copy">
        <p class="c-eyebrow">{esc(c['category'])} · TINYSUITE</p>
        <h1 id="product-name" class="c-display-title c-display-title--product">{esc(name)}</h1>
        <p class="c-subtitle">{esc(c['description'])}</p>
        <p class="c-lead">{esc(details['summary'])}</p>
        <div class="c-action-row c-action-row--product">
          {button('Explore the demo →', 'demo/', True, True)}
          {button('Documentation ↗', docs, False, True, extra='target="_blank" rel="noopener noreferrer"')}
        </div>
        <ul class="product-hero__badges">{badge_html}</ul>
      </div>
      <div class="product-hero__visual"><figure class="product-art">
        <img src="../assets/images/components/component-{esc(c['slug'])}.svg" width="720" height="480" alt="Visual illustration of {esc(name)}" fetchpriority="high">
      </figure></div>
    </section>
    <section class="l-shell l-section product-strengths" id="strengths" aria-labelledby="strengths-heading">
      <div class="l-section-header"><div><p class="c-eyebrow">WHY CHOOSE IT</p><h2 id="strengths-heading" class="c-section-title">Why {esc(name)} makes a difference</h2>
      <p class="c-section-description">Three practical strengths to understand the component at a glance.</p></div></div>
      <div class="product-strengths__grid">{strengths_html}</div>
    </section>
    <section class="l-shell l-section product-capabilities" id="features" aria-labelledby="features-heading">
      <div class="l-section-header"><div><p class="c-eyebrow">CAPABILITIES</p><h2 id="features-heading" class="c-section-title">Everything {esc(name)} can do</h2>
      <p class="c-section-description">Capabilities described in the TinySuite component catalog.</p></div>
      <span class="product-capabilities__count">{len(details['features'])} capabilities</span></div>
      <ul class="product-capabilities__grid">{feature_html}</ul>
    </section>
    <section class="l-shell l-section product-context" aria-label="Integration and use cases">
      <article class="c-card c-card--glass product-context__panel" id="dependencies">
        <p class="c-eyebrow">INTEGRATION</p><h2 class="c-section-title">Dependencies &amp; assets</h2>
        <p class="product-context__intro">The minified distribution is built from TinySuite’s existing manifest.</p>
        <ul class="product-bullet-list">
          <li>Core JavaScript: <code>dist/{esc(js_asset)}</code></li>
          {f'<li>Core CSS: <code>dist/{esc(css_asset)}</code></li>' if css_asset else '<li>No core CSS entry is listed in the website build manifest.</li>'}
          {list_items(integration_notes)}
        </ul>{extra_html}
        <p class="product-context__caution">External runtime dependencies are not verified in this website-only archive. Refer to the component README before production use.</p>
      </article>
      <article class="c-card c-card--glass product-context__panel" id="use-cases">
        <p class="c-eyebrow">GOOD FIT</p><h2 class="c-section-title">Where to use it</h2>
        <p class="product-context__intro">Practical workflows where its features can add value.</p>
        <ul class="product-bullet-list">{list_items(details['use_cases'])}</ul>
      </article>
    </section>
    <section class="l-shell l-section product-starter" id="quickstart" aria-labelledby="quickstart-heading">
      <div class="l-section-header"><div><p class="c-eyebrow">QUICK STARTER</p><h2 id="quickstart-heading" class="c-section-title">Start with {esc(name)}</h2>
      <p class="c-section-description">A guided integration sketch using the published distribution filenames. Check the README for the exact API.</p></div></div>
      <div class="product-starter__grid">{snippet_html}</div>
    </section>
    <section class="l-shell l-section product-end-cta" id="demo" aria-labelledby="demo-heading">
      <div class="c-demo-callout"><div class="product-end-cta__copy"><p class="c-eyebrow">READY TO EXPLORE?</p>
        <h2 id="demo-heading" class="c-section-title">See {esc(name)} in action</h2>
        <p class="c-lead">Try the standalone demonstration in its own page, then explore the README and source code for integration details.</p>
        <div class="c-action-row">{button('Open full demo →', 'demo/', True, True)}
        {button('Read documentation ↗', docs, False, True, extra='target="_blank" rel="noopener noreferrer"')}
        </div></div><div class="c-demo-callout__illustration" aria-hidden="true"><span></span></div></div>
    </section>'''
    return page(f'{name} — TinySuite', c['description'], body, prefix='../', mode='product')


def panda_card(kind,title,desc,icon,image,href,color='cyan',badge=''):
    iconcontent=(f'<img src="assets/images/{icon}" alt="">' if icon.endswith('svg') or icon.endswith('webp') else icon)
    link_attr = 'data-tinysuite-link' if href == '../site/index.html' else ''
    return f'''<a href="{href}" {link_attr} class="c-card c-card--{color} c-promo-card" id="{esc(kind.split()[0].lower())}"><div class="c-promo-card__content"><span class="c-promo-card__type">{iconcontent}{esc(kind)}</span><h2 class="c-promo-card__name">{esc(title)} {f'<span class="c-promo-card__badge">{esc(badge)}</span>' if badge else ''}</h2><p class="c-promo-card__description">{esc(desc)}</p><span class="c-promo-card__link">Explore {esc(kind)} →</span></div><img class="c-promo-card__image" src="assets/images/{image}" alt="" loading="lazy"></a>'''

def panda_product(title,desc,image,category,href,tags,color='glass'):
    link_attr = 'data-tinysuite-link' if href == '../site/index.html' else ''
    return f'<a class="c-card c-card--{color} panda-product-card" href="{href}" {link_attr}><div class="panda-product-card__copy"><div class="panda-product-card__name">{esc(title)}</div><p>{esc(desc)}</p><div class="panda-product-card__tags">'+''.join(f'<span>{esc(t)}</span>' for t in tags)+'</div></div>'+f'<img src="assets/images/{image}" alt="" loading="lazy"></a>'

def panda():
    tinysuite_link='../site/index.html' # local preview; production href in separate portal may be updated on publishing
    header=f'''<section class="l-shell panda-hero"><div class="panda-hero__copy"><p class="c-eyebrow">PANDA-SOFTS</p><h1 class="c-display-title">Crafting elegant<br>software <span class="u-gradient-text">components.</span></h1><p class="c-lead">Panda-Softs is a software studio and component ecosystem, delivering high-quality libraries, UI components, and developer tools for JavaScript and SwiftUI.</p><div class="c-action-row">{button('Explore Products','#projects',True,True,svg_box())}{button('View on GitHub','https://github.com/Panda-Softs',False,True,svg_github(),extra='target="_blank" rel="noopener noreferrer"')}</div><div class="panda-benefits"><span><i>▱</i> UI Components</span><span><i>ϟ</i> Developer Tools</span><span><i>⌘</i> Open Source</span><span><i>◉</i> Apple &amp; Web</span></div></div><div class="panda-hero__visual"><img src="assets/images/panda-hero.webp" alt="Panda mascot illuminated in cyan and violet" fetchpriority="high" width="946" height="582"></div></section>'''
    cards='''<section class="l-shell l-grid-3 panda-promos" id="projects">'''
    cards+=panda_card('JavaScript','TinySuite','A lightweight, modern JavaScript suite with practical, high-quality utilities and components.','js-logo.svg','icon-tinysuite.webp',tinysuite_link,'gold','Flagship')
    cards+=panda_card('SwiftUI','SwiftUI Components','Native, beautiful, and reusable UI components for Apple platforms, built with SwiftUI.','swift-logo.svg','icon-swiftui.webp','https://github.com/orgs/Panda-Softs/repositories?q=SwiftUI','violet')
    cards+=panda_card('Tools / Utilities','Developer Tools','Small, focused utilities that make development and daily work more productive.','icon-tools.svg','icon-tools.webp','https://github.com/orgs/Panda-Softs/repositories?q=Tools','cyan')
    cards+='</section><section class="l-shell panda-featured" id="featured"><div class="l-section-header"><div><h2 class="c-section-title">Featured Projects</h2><p class="u-muted c-section-description">A curated selection of projects from Panda-Softs.</p></div><a href="https://github.com/orgs/Panda-Softs/repositories">View all projects →</a></div><div class="l-grid-3">'
    cards+=panda_product('TinySuite','A modern JavaScript utilities suite for real-world development.','icon-code.webp','JavaScript',tinysuite_link,['JavaScript','Utilities','Components'],'gold')
    cards+=panda_product('PixNab','A color tool for designers and developers.','icon-color.webp','macOS','https://github.com/orgs/Panda-Softs/repositories?q=PixNab',['macOS','Color Tools','Design'],'cyan')
    cards+=panda_product('SoftUI','An evolving collection of SwiftUI components.','icon-softui.webp','SwiftUI','https://github.com/orgs/Panda-Softs/repositories?q=SoftUI',['SwiftUI','iOS','macOS'],'violet')
    cards+='</div></section><section class="l-shell l-section" id="about"><p class="c-eyebrow">INDEPENDENT SOFTWARE</p><p class="c-lead">Explore reusable components and small, purposeful developer utilities.</p></section>'
    return page('Panda-Softs — Crafting elegant software components','Panda-Softs: JavaScript, SwiftUI and developer tools',header+cards,prefix='./',mode='panda',brand='Panda-Softs',is_panda=True)

def catalog_page():
    rows=[]
    for item in CATALOG:
        name=item['name'];category=item.get('category','Components');desc=item.get('description','')
        rows.append(f'<a class="c-card c-card--glass catalog-item" href="../{esc(name)}/" data-component-card data-category="{esc(category)}" data-search="{esc(name.lower()+" "+category.lower()+" "+desc.lower())}"><small>{esc(category)}</small><h3>{esc(name)}</h3><p>{esc(desc)}</p></a>')
    content='<section class="l-shell catalog-header"><p class="c-eyebrow">TINYSUITE COMPONENTS</p><h1 class="c-display-title">Pick your <span class="u-gradient-text">tools.</span></h1><p class="c-lead">Explore individual components, source code, and standalone demos.</p><div class="catalog-tools"><input placeholder="Search components…" aria-label="Search components" type="search" data-catalog-search><button type="button" data-filter="All" aria-pressed="true">All</button>'+''.join(f'<button type="button" data-filter="{esc(cat)}" aria-pressed="false">{esc(cat)}</button>' for cat in sorted({i['category'] for i in CATALOG}))+'</div><p class="u-muted" data-count aria-live="polite"></p></section><section class="l-shell catalog-grid">'+''.join(rows)+'</section>'
    return page('Components — TinySuite','All TinySuite components',content,prefix='../',mode='catalog')

def copy_assets(dest:Path):
    (dest/'assets').mkdir(parents=True,exist_ok=True)
    shutil.copy2(WEBSITE/'assets/site.css',dest/'assets/site.css')
    shutil.copy2(WEBSITE/'assets/site.js',dest/'assets/site.js')
    shutil.copytree(WEBSITE/'assets/images',dest/'assets/images',dirs_exist_ok=True)

def publish_demo_dependencies(component: str, source_folder: Path, published_folder: Path) -> None:
    """Publish the tiny number of files referenced outside their demo/ folders.

    The preferred TinySelectize demo uses the component's minified dist files.
    Older source-only checkouts still work with their local non-minified files.
    No component implementation is copied into website/.
    """
    if component == 'TinySelectize':
        # The component ships several legacy HTML demos, not only demo_.html.
        # Transform every one that references the old root-level assets.
        replacements = {
            './../TinySelectize.css': '../dist/TinySelectize.min.css',
            './../TinySelectize.js': '../dist/TinySelectize.min.js',
            './../TinySelectize.Tree.plugin.js': '../dist/TinySelectize.Tree.plugin.min.js',
        }
        legacy_pages = []
        for html_path in (published_folder / 'demo').rglob('*.html'):
            html_source = html_path.read_text(encoding='utf-8')
            if any(old in html_source for old in replacements):
                legacy_pages.append((html_path, html_source))
        if legacy_pages:
            dist_ready = all(
                (published_folder / relative[3:]).is_file()
                for relative in replacements.values()
            )
            if dist_ready:
                for html_path, markup in legacy_pages:
                    for original, replacement in replacements.items():
                        markup = markup.replace(original, replacement)
                    html_path.write_text(markup, encoding='utf-8')
                print(f'TinySelectize: {len(legacy_pages)} legacy demo(s) use minified dist assets')
            else:
                # For older checkouts that have not yet run npm run build,
                # preserve the legacy demos without broken links.
                sources = ('TinySelectize.css', 'TinySelectize.js', 'TinySelectize.Tree.plugin.js')
                missing = [name for name in sources if not (source_folder / name).is_file()]
                if missing:
                    raise FileNotFoundError(
                        'TinySelectize legacy demos require dist files or the '
                        f'original sources ({", ".join(missing)} missing). '
                        'Run npm run build in the full TinySuite checkout.'
                    )
                for name in sources:
                    shutil.copy2(source_folder / name, published_folder / name)
                print(f'TinySelectize: dist missing; {len(legacy_pages)} legacy demo(s) use original sources')

    if component == 'TinyInlineEditor':
        demo = published_folder / 'demo/index.html'
        if demo.is_file() and '../vendor/jquery.min.js' in demo.read_text(encoding='utf-8'):
            destination = published_folder / 'vendor/jquery.min.js'
            source = source_folder / 'vendor/jquery.min.js'
            # Keep the exact component-provided version when available.
            # The bundled jQuery is an offline fallback for archives that
            # contain the demo markup but not the vendor directory.
            if not source.is_file():
                source = WEBSITE / 'vendor/jquery-3.6.1.min.js'
            if not source.is_file():
                raise FileNotFoundError(
                    'TinyInlineEditor demo depends on jQuery. Expected '
                    f'{source_folder / "vendor/jquery.min.js"} or '
                    'website/vendor/jquery-3.6.1.min.js.'
                )
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            print(f'TinyInlineEditor: bundled local jQuery from {source.relative_to(ROOT)}')


def main():
    import subprocess
    print(f'TinySuite builder: demo-assets v4 ({Path(__file__).resolve()})')
    subprocess.run([sys.executable,str(ROOT/'scripts/compile_scss.py')],check=True)
    shutil.rmtree(SITE,ignore_errors=True);shutil.rmtree(PANDA,ignore_errors=True)
    SITE.mkdir(parents=True);PANDA.mkdir(parents=True)
    copy_assets(SITE);copy_assets(PANDA)
    (SITE/'index.html').write_text(home(),encoding='utf-8')
    (SITE/'components').mkdir()
    (SITE/'components/index.html').write_text(catalog_page(),encoding='utf-8')
    (PANDA/'index.html').write_text(panda(),encoding='utf-8')
    count=0
    for c in CATALOG:
        folder=ROOT/c['name']
        dest=SITE/c['name'];dest.mkdir(parents=True,exist_ok=True)
        has_demo=(folder/'demo/index.html').is_file()
        product_html = product(c, has_demo)
        if '<iframe' in product_html.lower():
            raise RuntimeError(f'{c["name"]}: product template must not contain iframes')
        (dest/'index.html').write_text(product_html,encoding='utf-8')
        if has_demo:
            shutil.copytree(folder/'demo',dest/'demo',dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','.git','.DS_Store','*.zip','.env*'))
        else:
            (dest/'demo').mkdir(exist_ok=True)
            (dest/'demo/index.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo not included — {esc(c['name'])}</title><link rel="stylesheet" href="../../assets/site.css"><body class="page--demo-placeholder"><main><h1>{esc(c['name'])} demo</h1><p>This website-only preview contains no library source. The demo will appear here when the current <code>{esc(c['name'])}/demo/</code> and <code>dist/</code> folders are available in the TinySuite repository.</p><p><a href="../index.html">Back to the product page</a></p></main></body></html>''',encoding='utf-8')
        if (folder/'dist').is_dir():
            shutil.copytree(folder/'dist',dest/'dist',dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','.DS_Store','*.map','node_modules','.env*'))
        if folder.is_dir():
            for name in ('demo.css','demo.js'):
                p=folder/name
                if p.is_file():shutil.copy2(p,dest/name)
        if has_demo:
            publish_demo_dependencies(c['name'], folder, dest)
        count+=1
    print(f'Built: {SITE} with {count} product pages (product template v3, demo-assets v4)')
    print(f'Panda-Softs portal: {PANDA}/index.html')
    print(f'Open: {(SITE/"index.html").as_uri()}')

if __name__=='__main__':main()
