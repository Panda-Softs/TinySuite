#!/usr/bin/env python3
"""Validate the generated Panda-Softs and TinySuite static websites.

Runs with Python's standard library. Pillow is optional for alpha-channel checks.
The website-only archive contains no Tiny* implementations: runtime API and
interactive demo behavior must still be checked in a complete checkout.
"""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / '.build/site'
PANDA = ROOT / '.build/panda-softs'
CATALOG = json.loads((ROOT / 'website/catalog.json').read_text(encoding='utf8'))
DETAILS = json.loads((ROOT / 'website/component_details.json').read_text(encoding='utf8'))
EXPECTED_CATEGORIES = {
    'Data & Scheduling', 'Forms & Inputs', 'Navigation & Layout',
    'Media', 'Interactions', 'Developer Tools',
}


class InspectHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = set()
        self.tags = []
        self.links = []
        self.classes = []
        self.product_template_versions = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append(tag)
        if a.get('data-product-template'):
            self.product_template_versions.append(a['data-product-template'])
        self.classes.extend((a.get('class') or '').split())
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'a' and a.get('href'):
            self.refs.append(('href', a['href']))
            self.links.append(a['href'])
        elif tag in ('img', 'iframe', 'script') and a.get('src'):
            self.refs.append(('src', a['src']))
        elif tag == 'link' and a.get('href'):
            self.refs.append(('asset', a['href']))


def inspect(file):
    parser = InspectHTML()
    parser.feed(file.read_text(encoding='utf8'))
    return parser


problems = []
page_count = 0
for output in (SITE, PANDA):
    if not output.exists():
        problems.append(f'Missing site output: {output}')
        continue
    for file in output.rglob('*.html'):
        page_count += 1
        parser = inspect(file)
        for kind, raw in parser.refs:
            url = urlsplit(raw)
            if raw.startswith('//') or url.scheme or not url.path:
                continue
            local = (file.parent / unquote(url.path)).resolve()
            if local.is_dir():
                local = local / 'index.html'
            if not local.is_file():
                problems.append(f'{file.relative_to(ROOT)}: unresolved {kind}: {raw}')

names = [item['name'] for item in CATALOG]
if len(names) != len(set(names)):
    problems.append('Duplicate names in website/catalog.json')
if set(names) != set(DETAILS):
    problems.append('website/catalog.json and website/component_details.json are out of sync')
if {item['category'] for item in CATALOG} != EXPECTED_CATEGORIES:
    problems.append('Featured category taxonomy does not match the six groups')

home = SITE / 'index.html'
if home.is_file():
    hp = inspect(home)
    if 'featured' not in hp.ids or 'component-directory' not in hp.classes:
        problems.append('Home page lost its Featured Components directory')
    if sum('directory-component' == klass for klass in hp.classes) != len(CATALOG):
        problems.append('Home page does not list every Tiny* component')
    if 'https://panda-softs.github.io/' not in hp.links:
        problems.append('Home page lacks the Panda-Softs portal link')

for item in CATALOG:
    name = item['name']
    product = SITE / name / 'index.html'
    if not product.is_file():
        problems.append(f'{name}: missing product page')
        continue
    parser = inspect(product)
    if 'iframe' in parser.tags:
        problems.append(f'{name}: embedded iframe returned')
    if parser.product_template_versions != ['v3']:
        problems.append(f'{name}: outdated product template; expected v3, got {parser.product_template_versions}')
    for key in ('features', 'strengths', 'dependencies', 'use-cases', 'quickstart', 'demo'):
        if key not in parser.ids:
            problems.append(f'{name}: missing section #{key}')
    if parser.classes.count('product-feature') != len(DETAILS.get(name, {}).get('features', [])):
        problems.append(f'{name}: incorrect feature count')
    if parser.classes.count('product-strength-card') != 3:
        problems.append(f'{name}: missing individual strength cards')
    if parser.classes.count('product-code-card') != 3:
        problems.append(f'{name}: incomplete Quick Starter')
    if parser.classes.count('product-art') != 1:
        problems.append(f'{name}: missing SVG hero illustration')
    if 'demo/' not in parser.links:
        problems.append(f'{name}: missing demo link')
    if f'https://github.com/Panda-Softs/TinySuite/tree/main/{name}' not in parser.links:
        problems.append(f'{name}: missing README / documentation link')
    art = ROOT / 'website/assets/images/components' / f'component-{item["slug"]}.svg'
    try:
        ElementTree.parse(art)
    except (FileNotFoundError, ElementTree.ParseError) as error:
        problems.append(f'{name}: invalid SVG asset: {error}')

# Sticky navigation must survive shared .page child-positioning rules.
css = (ROOT / 'website/assets/site.css').read_text(encoding='utf8')
if not re.search(r'\.c-header\s*\{[^}]*position:\s*sticky;', css):
    problems.append('The shared header is no longer sticky')

transparencies = 0
images = ROOT / 'website/assets/images'
if Image:
    for path in images.glob('*.webp'):
        with Image.open(path) as picture:
            if 'A' not in picture.getbands():
                problems.append(f'{path.name}: missing WebP alpha channel')
                continue
            if picture.getchannel('A').getextrema()[0] != 0:
                problems.append(f'{path.name}: WebP has no transparent pixels')
            transparencies += 1

if problems:
    for issue in problems[:80]:
        print('ERROR:', issue, file=sys.stderr)
    raise SystemExit(f'{len(problems)} site validation error(s)')

print(f'PASS: {page_count} HTML documents; {len(CATALOG)} detailed products; '
      f'{len(EXPECTED_CATEGORIES)} homepage categories; no embedded iframes or broken links')
if Image:
    print(f'PASS: {transparencies} alpha-enabled WebP assets')
else:
    print('NOTE: Install Pillow for optional WebP alpha checks')
