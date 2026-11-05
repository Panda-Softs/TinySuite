"""Chromium regression tests for TinyGallery + TinyLightbox. Requires Playwright.
Run: python TinyGallery/tests/test_gallery.py
"""
import re
import os
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


def load_demo(page):
    """Test shipped scripts without file navigation (administratively blocked here).
    The sample SVGs are converted to same-origin temporary blobs for this test.
    The actual demos load local SVG image paths directly, without Base64.
    """
    demo = ROOT / 'TinyGallery/demo'
    html = (demo / 'index.html').read_text()
    html = re.sub(r'<script\s+src="[^"]+"\s*></script>', '', html)
    html = re.sub(r'<link\s+rel="stylesheet"[^>]*>', '', html)
    page.set_content(html)
    for file in ['TinyLightbox/TinyLightbox.css', 'TinyGallery/TinyGallery.css', 'TinyGallery/demo/demo.css']:
        page.add_style_tag(content=(ROOT / file).read_text())
    svgs = {f'lake-{n}.svg': (demo / f'images/lake/lake-{n}.svg').read_text() for n in range(1, 7)}
    page.evaluate('(files) => {\n        window.__testImageUrls = {};\n        for (const [name, xml] of Object.entries(files)) {\n            window.__testImageUrls[name] = URL.createObjectURL(new Blob([xml], {type: \'image/svg+xml\'}));\n        }\n        document.querySelectorAll(\'img[src*="images/lake/"]\').forEach(img => {\n            const name = img.getAttribute(\'src\').split(\'/\').pop();\n            img.src = window.__testImageUrls[name];\n        });\n        document.querySelectorAll(\'[data-lightbox-src]\').forEach(el => {\n            const name = el.dataset.lightboxSrc.split(\'/\').pop();\n            el.dataset.lightboxSrc = window.__testImageUrls[name];\n        });\n    }', svgs)
    for file in ['TinyLightbox/TinyLightbox.js', 'TinyGallery/TinyGallery.js', 'TinyGallery/demo/editor.js', 'TinyGallery/demo/demo.js']:
        page.add_script_tag(content=(ROOT / file).read_text())
    page.evaluate("""() => {
        const withSources = names => names.map(filename => ({
            filename, src: window.__testImageUrls[filename]
        }));
        demoGallery.setImages(withSources(['lake-1.svg', 'lake-2.svg', 'lake-3.svg', 'lake-4.svg']));
        demoInstances.readOnly.setImages(withSources(['lake-1.svg','lake-2.svg']));
        demoInstances.limited.setImages(withSources(['lake-1.svg','lake-2.svg','lake-3.svg']));
    }""")


def run():
    with sync_playwright() as p:
        kw = {}
        chrome = os.environ.get('CHROME_BIN') or shutil.which('chromium')
        if chrome: kw['executable_path'] = chrome
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'], **kw)
        page = browser.new_page(viewport={'width': 1310, 'height': 850})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        load_demo(page)
        assert page.locator('#gallery-main .tgallery-tile').count() == 4
        assert page.locator('#gallery-main .tgallery-grid > :last-child').get_attribute('data-action') == 'add'
        assert page.evaluate('demoGallery.getValue()') == 'lake-1.svg;lake-2.svg;lake-3.svg;lake-4.svg'
        # Invalid replacement must not erase an existing collection.
        assert page.evaluate('''() => {const previous=demoGallery.getValue();try{demoGallery.setImages(['ok.webp','evil;filename.webp']);return false;}catch(error){return demoGallery.getValue()===previous;}}''')
        page.locator('#gallery-main .tgallery-preview').first.click()
        assert page.locator('dialog.tiny-lightbox').count() == 1
        page.keyboard.press('ArrowRight')
        assert page.locator('.tlb-counter').inner_text() == '2 / 4'
        page.keyboard.press('Escape')
        page.locator('dialog.tiny-lightbox').wait_for(state='detached')
        # Keyboard ordering / + remains last.
        page.locator('#gallery-main .tgallery-tile').first.locator('.tgallery-handle').focus()
        page.keyboard.press('ArrowRight')
        assert page.evaluate('demoGallery.getValue()') == 'lake-2.svg;lake-1.svg;lake-3.svg;lake-4.svg'
        assert page.locator('#gallery-main .tgallery-grid > :last-child').get_attribute('data-action') == 'add'
        # Mouse reorder using drag handle.
        source = page.locator('#gallery-main .tgallery-tile').first.locator('.tgallery-handle')
        target = page.locator('#gallery-main .tgallery-tile').nth(2)
        source.drag_to(target)
        assert page.evaluate('demoGallery.getItems().map(i=>i.filename).join(";")') != 'lake-2.svg;lake-1.svg;lake-3.svg;lake-4.svg'
        # Soft deletion + one-step undo.
        page.locator('#gallery-main .tgallery-remove').first.click()
        assert page.evaluate('demoGallery.getState().removed.length') == 1
        page.locator('#gallery-main [data-action=undo]').click()
        assert page.evaluate('demoGallery.getState().removed.length') == 0
        # New image staged by interactive button, getValue guard.
        page.locator('#g-add-example').click()
        page.wait_for_function('demoGallery.getItems().length===5')
        assert page.evaluate('demoGallery.getItems().at(-1).status') == 'added'
        assert page.evaluate('(() => {try {demoGallery.getValue();return false;}catch(error){return error.message.includes("pending");}})()')
        assert page.locator('#gallery-main .tgallery-grid > :last-child').get_attribute('data-action') == 'add'
        # Real external cropper receives Blob-origin sample SVGs in the sandbox.
        page.locator('#gallery-main .tgallery-tile').first.locator('.tgallery-edit').click()
        editor = page.locator('#crop-dialog')
        editor.wait_for(state='visible')
        page.locator('#editor-zoom').fill('1.5')
        page.locator('#editor-apply').click()
        page.wait_for_function('demoGallery.getItems()[0].status==="edited"')
        assert editor.is_hidden()
        # User-selected original SVG is granted to the page as a File, not Base64.
        page.locator('#gallery-main .tgallery-tile').first.locator('.tgallery-edit').click()
        editor.wait_for(state='visible')
        page.locator('#editor-file').set_input_files(str(ROOT / 'TinyGallery/demo/images/lake/lake-1.svg'))
        page.locator('#editor-apply').click()
        editor.wait_for(state='hidden')
        # Simulated save only resets state, no IO.
        page.locator('#g-save').click()
        page.wait_for_function('demoGallery.getState().images.every(i=>i.status==="saved")')
        assert page.evaluate('demoGallery.getValue().includes("demo-upload-")')
        assert page.locator('#gallery-readonly .tgallery-edit').count() == 0
        assert page.locator('#gallery-readonly .tgallery-remove').count() == 0
        assert page.locator('#gallery-readonly .tgallery-add').count() == 0
        assert page.locator('#gallery-empty .tgallery-add').count() == 1
        assert page.locator('#gallery-limited .tgallery-add').is_disabled()
        # Clipboard API fallback must not instruct users to start a server.
        page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})")
        page.locator('[data-copy]').first.evaluate('(b) => b.closest("details").open = true')
        page.locator('[data-copy]').first.click()
        assert 'localhost' not in page.locator('#toast').inner_text()
        assert 'Code copied' in page.locator('#toast').inner_text() or 'Code selected' in page.locator('#toast').inner_text()
        page.evaluate('Object.values(demoInstances).forEach(g=>g.destroy())')
        assert page.locator('#gallery-main .tgallery-tile').count() == 0
        assert page.evaluate('TinyLightbox.active===null && !document.querySelector(".tiny-lightbox")')
        assert not errors, errors
        mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        load_demo(mobile)
        assert mobile.locator('#gallery-main .tgallery-tile').count() == 4
        assert mobile.locator('#gallery-main .tgallery-grid > :last-child').get_attribute('data-action') == 'add'
        # Touch handle: simulated pointer movement to another tile.
        mobile.locator('#gallery-main .tgallery-handle').first.scroll_into_view_if_needed()
        mobile.evaluate('''() => {
            const handle=document.querySelector('#gallery-main .tgallery-handle');
            const first=handle.getBoundingClientRect();
            const third=document.querySelectorAll('#gallery-main .tgallery-tile')[2].getBoundingClientRect();
            const x=first.x+first.width/2, y=first.y+first.height/2;
            const x2=third.x+third.width/2, y2=third.y+third.height/2;
            for(const [type,xx,yy] of [['pointerdown',x,y],['pointermove',x2,y2],['pointerup',x2,y2]]) {
                handle.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:99,pointerType:'touch',button:0,clientX:xx,clientY:yy}));
            }
        }''')
        assert mobile.evaluate('demoGallery.getItems()[0].filename') == 'lake-2.svg'
        assert mobile.locator('#gallery-main .tgallery-grid > :last-child').get_attribute('data-action') == 'add'
        mobile.locator('#gallery-main .tgallery-preview').first.click()
        assert mobile.locator('dialog.tiny-lightbox').count() == 1
        mobile.keyboard.press('Escape')
        browser.close()
    print('PASS TinyGallery: preview, keyboard/mouse reorder, + placement, removal/undo, pending, editor, save, read-only, max, destroy, mobile')


if __name__ == '__main__': run()
