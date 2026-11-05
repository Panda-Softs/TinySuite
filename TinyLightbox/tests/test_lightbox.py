"""End-to-end Chromium smoke/regression suite for the standalone TinyLightbox demo.
Requires: pip install playwright; playwright install chromium (or CHROME_BIN).
Run: python TinyLightbox/tests/test_lightbox.py
"""
import os
import pathlib
import shutil
import re
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]


def load_demo(page):
    """Test shipped scripts without file navigation (administratively blocked here).
    The sample SVGs are converted to same-origin temporary blobs for this test.
    The actual demos load local SVG image paths directly, without Base64.
    """
    demo = ROOT / 'TinyLightbox/demo'
    html = (demo / 'index.html').read_text()
    html = re.sub(r'<script\s+src="[^"]+"\s*></script>', '', html)
    html = re.sub(r'<link\s+rel="stylesheet"[^>]*>', '', html)
    page.set_content(html)
    for file in ['TinyLightbox/TinyLightbox.css', 'TinyLightbox/demo/demo.css']:
        page.add_style_tag(content=(ROOT / file).read_text())
    svgs = {f'lake-{n}.svg': (demo / f'images/lake/lake-{n}.svg').read_text() for n in range(1, 7)}
    page.evaluate('(files) => {\n        window.__testImageUrls = {};\n        for (const [name, xml] of Object.entries(files)) {\n            window.__testImageUrls[name] = URL.createObjectURL(new Blob([xml], {type: \'image/svg+xml\'}));\n        }\n        document.querySelectorAll(\'img[src*="images/lake/"]\').forEach(img => {\n            const name = img.getAttribute(\'src\').split(\'/\').pop();\n            img.src = window.__testImageUrls[name];\n        });\n        document.querySelectorAll(\'[data-lightbox-src]\').forEach(el => {\n            const name = el.dataset.lightboxSrc.split(\'/\').pop();\n            el.dataset.lightboxSrc = window.__testImageUrls[name];\n        });\n    }', svgs)
    for file in ['TinyLightbox/TinyLightbox.js', 'TinyLightbox/demo/demo.js']:
        page.add_script_tag(content=(ROOT / file).read_text())


def run():
    with sync_playwright() as p:
        kw = {}
        browser_path = os.environ.get('CHROME_BIN') or shutil.which('chromium')
        if browser_path: kw['executable_path'] = browser_path
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--no-proxy-server'], **kw)
        desktop = browser.new_page(viewport={'width': 1300, 'height': 840})
        errors = []
        desktop.on('pageerror', lambda e: errors.append(str(e)))
        load_demo(desktop)
        # URLs deliberately disagree, but stable identity still opens photo 1.
        desktop.locator('.gallery-trigger').first.evaluate(
            '(el) => { el.dataset.lightboxSrc = "images/lake/lake-1.svg"; }')
        desktop.locator('.gallery-trigger').first.click()
        desktop.locator('.tlb-image').wait_for(state='visible')
        assert desktop.locator('dialog.tiny-lightbox').count() == 1
        assert desktop.locator('.tlb-counter').inner_text() == '1 / 6'
        desktop.keyboard.press('ArrowRight')
        assert desktop.locator('.tlb-counter').inner_text() == '2 / 6'
        desktop.keyboard.press('End')
        assert desktop.locator('.tlb-counter').inner_text() == '6 / 6'
        desktop.keyboard.press('ArrowRight')
        assert desktop.locator('.tlb-counter').inner_text() == '1 / 6'
        desktop.locator('.tlb-image').wait_for(state='visible')
        desktop.keyboard.press('+')
        assert desktop.evaluate('demoViewer.scale') > 1
        desktop.keyboard.press('0')
        assert desktop.evaluate('demoViewer.scale') == 1
        # Wheel and double-click zoom use the same bounded transform.
        desktop.locator('.tlb-image').hover()
        desktop.mouse.wheel(0, -120)
        assert desktop.evaluate('demoViewer.scale') > 1
        desktop.keyboard.press('0')
        desktop.locator('.tlb-image').dblclick()
        assert desktop.evaluate('demoViewer.scale') > 1
        desktop.keyboard.press('0')
        desktop.keyboard.press('Escape')
        desktop.locator('dialog.tiny-lightbox').wait_for(state='detached')
        assert desktop.evaluate('document.activeElement === document.querySelector(".gallery-trigger")')
        # Backdrop click closes; edit is injected and closes before invoking it.
        desktop.evaluate('demoViewer.open(0)')
        desktop.locator('.tlb-stage').click(position={'x': 2, 'y': 2})
        desktop.locator('dialog.tiny-lightbox').wait_for(state='detached')
        desktop.evaluate('''() => { demoViewer.options.onEdit = async image => ({src: images[1].src}); demoViewer.open(0); }''')
        desktop.locator('.tlb-edit').click()
        desktop.locator('dialog.tiny-lightbox').wait_for(state='detached')
        desktop.wait_for_function('demoViewer.images[0].src === images[1].src')

        desktop.locator('#loop').uncheck()
        desktop.locator('#open-first').click()
        desktop.keyboard.press('End')
        desktop.keyboard.press('ArrowRight')
        assert desktop.locator('.tlb-counter').inner_text() == '6 / 6'
        desktop.keyboard.press('Escape')
        desktop.locator('#show-error').click()
        desktop.locator('.tlb-message').get_by_text('Image could not be loaded.').wait_for()
        desktop.keyboard.press('Escape')
        desktop.locator('#reset-set').click()
        desktop.locator('.gallery-trigger').nth(2).click()
        assert desktop.locator('.tlb-counter').inner_text() == '3 / 6'
        desktop.keyboard.press('Escape')
        desktop.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})")
        desktop.locator('[data-copy]').first.evaluate('(b) => b.closest("details").open = true')
        desktop.locator('[data-copy]').first.click()
        assert 'localhost' not in desktop.locator('#toast').inner_text()
        assert 'Code copied' in desktop.locator('#toast').inner_text() or 'Code selected' in desktop.locator('#toast').inner_text()
        desktop.evaluate('demoViewer.destroy()')
        desktop.locator('dialog.tiny-lightbox').wait_for(state='detached')
        assert desktop.evaluate('TinyLightbox.active === null && document.body.style.overflow === ""')
        # Independent programmatic instance, no source gallery required.
        desktop.evaluate('''() => {window.standalone=new TinyLightbox({images:[{id:'one',src:images[3].src}]});standalone.open('one');}''')
        assert desktop.locator('.tlb-counter').inner_text() == '1 / 1'
        desktop.evaluate('standalone.destroy()')
        desktop.locator('dialog.tiny-lightbox').wait_for(state='detached')
        assert not errors, errors
        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        load_demo(mobile)
        mobile.locator('.gallery-trigger').first.click()
        mobile.locator('.tlb-image').wait_for(state='visible')
        mobile.evaluate('''() => {
           const img=document.querySelector('.tlb-image'), r=img.getBoundingClientRect();
           const x=r.x+r.width/2,y=r.y+r.height/2;
           const send=(type,id,xx,yy)=>img.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,clientX:xx,clientY:yy}));
           send('pointerdown',1,x-30,y);send('pointerdown',2,x+30,y);
           send('pointermove',1,x-88,y);send('pointermove',2,x+88,y);
           send('pointerup',1,x-88,y);send('pointerup',2,x+88,y);
        }''')
        assert mobile.evaluate('demoViewer.scale') > 1
        mobile.evaluate('demoViewer.resetZoom()')
        mobile.evaluate('''() => {const i=document.querySelector('.tlb-image'),r=i.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;for(const [type,xx] of [['pointerdown',x],['pointermove',x-140],['pointerup',x-140]])i.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:3,pointerType:'touch',button:0,clientX:xx,clientY:y}));}''')
        assert mobile.locator('.tlb-counter').inner_text() == '2 / 6'
        browser.close()
    print('PASS TinyLightbox: navigation, zoom, keyboard, loading errors, focus, lifecycle, independent mode, touch and swipe')


if __name__ == '__main__': run()
