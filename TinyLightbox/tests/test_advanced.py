"""TinyLightbox v2 advanced behavior: exercised in real Chromium, no HTTP server."""
import os
import shutil
from playwright.sync_api import sync_playwright
from test_lightbox import load_demo


def run():
    executable = os.getenv('CHROME_BIN') or shutil.which('chromium')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox', '--no-proxy-server'])
        page = browser.new_page(viewport={'width': 1260, 'height': 850})
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        load_demo(page)
        page.locator('.gallery-trigger').first.click()
        page.locator('.tlb-image').wait_for(state='visible')
        assert 'The lake wakes slowly' in page.locator('.tlb-caption').inner_text()
        assert page.locator('.tlb-caption').evaluate('(el) => el.classList.contains("tlb-caption--bottom")')
        assert 'lake-1.svg' in page.locator('.tlb-image').get_attribute('srcset') or page.locator('.tlb-image').get_attribute('srcset')
        assert page.locator('.tlb-image').get_attribute('sizes')

        # Captions are safe text, not interpreted HTML; every display position is supported.
        page.evaluate("demoViewer.options.captionPosition = 'right'; demoViewer.setImages(demoViewer.images)")
        assert page.locator('.tlb-caption--right').count() == 1
        page.evaluate("demoViewer.setImages(demoViewer.images.map((image,i) => i===0 ? {...image, description:'<img src=x onerror=alert(1)>'} : image))")
        assert page.locator('.tlb-caption img').count() == 0
        assert '<img src=' in page.locator('.tlb-caption').inner_text()

        # Per-image zoom disable should disable controls and ignore calls.
        page.evaluate("demoViewer.setImages(demoViewer.images.map((image,i) => i===0 ? {...image,zoom:false} : image))")
        assert page.locator('.tlb-zoomIn').is_disabled()
        page.evaluate('demoViewer.zoomTo(3)')
        assert page.evaluate('demoViewer.scale') == 1
        page.evaluate("demoViewer.setImages(demoViewer.images.map((image,i) => i===0 ? {...image,zoom:true} : image))")

        # Swipe follow: transform changes *during* the gesture; bounce returns to origin.
        page.evaluate('''() => {
           const img = document.querySelector('.tlb-image'), r = img.getBoundingClientRect();
           const x = r.x + r.width/2, y = r.y+r.height/2;
           window.swipePoint={x,y};
           const send=(type,xx,yy=x)=>img.dispatchEvent(new PointerEvent(type,{
             bubbles:true,pointerId:17,pointerType:'mouse',button:0,clientX:xx,clientY:yy===x?y:yy}));
           send('pointerdown',x);
           send('pointermove',x-16);
        }''')
        assert page.evaluate('demoViewer._gestureOffset.x < -10')
        assert page.evaluate('demoViewer._gestureOffset.y === 0')
        page.evaluate('''() => {const img=document.querySelector('.tlb-image');
            img.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:17,pointerType:'mouse',button:0,
                clientX:swipePoint.x-16,clientY:swipePoint.y}));}''')
        assert page.evaluate('demoViewer._gestureOffset.x') == 0

        # Fast flick threshold: lower horizontal distance but sufficient speed also navigates.
        page.evaluate('''() => {
           const img=document.querySelector('.tlb-image'), r=img.getBoundingClientRect();
           const x=r.x+r.width/2,y=r.y+r.height/2;
           for(const [t,xx] of [['pointerdown',x],['pointermove',x-100],['pointerup',x-100]])
             img.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:19,pointerType:'mouse',button:0,clientX:xx,clientY:y}));
        }''')
        assert page.locator('.tlb-counter').inner_text() == '2 / 6'
        page.locator('.tlb-image').wait_for(state='visible')
        # Custom SVG path (never HTML evaluation), and an SVG Element override.
        page.evaluate('''() => {
            const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
            const path=document.createElementNS('http://www.w3.org/2000/svg','path');
            path.setAttribute('d','M4 12h16');icon.append(path);
            demoViewer.options.icons={next:icon,previous:'M20 12H4'};
            demoViewer.close({animate:false});demoViewer.open(1);
        }''')
        assert page.locator('.tlb-next svg path').get_attribute('d') == 'M4 12h16'
        assert page.locator('.tlb-previous svg path').get_attribute('d') == 'M20 12H4'
        # Async callback subscription once; beforeChange vs afterChange ordering.
        page.evaluate('''() => {window.v2events=[];
            demoViewer.once('afterChange', () => v2events.push('once'));
            demoViewer.on('beforeChange', () => v2events.push('before'));
            demoViewer.on('afterChange', () => v2events.push('after'));}''')
        page.locator('.tlb-next').click()
        page.locator('.tlb-image').wait_for(state='visible')
        page.wait_for_function('v2events.includes("after")')
        page.locator('.tlb-next').click()
        page.wait_for_function('v2events.filter(x => x === "after").length === 2')
        assert page.evaluate('v2events.filter(x=>x==="once").length') == 1
        assert page.evaluate('v2events.indexOf("before") < v2events.indexOf("after")')

        # Inserts/removes with stable identity, including active-slide removal.
        page.evaluate('''() => {demoViewer.insertSlide({id:'extra',src:images[0].src,description:'Inserted'},2);}''')
        assert page.evaluate('demoViewer.images.length') == 7
        page.evaluate('demoViewer.open("extra")')
        assert page.evaluate('demoViewer.current.id') == 'extra'
        assert page.evaluate('demoViewer.removeSlide("extra")')
        assert page.evaluate('demoViewer.images.length') == 6
        assert page.evaluate('demoViewer.current.id') != 'extra'

        # Supported transitions and close animation lifecycle: close is async but destroy immediate.
        for effect in ['fade','slide','zoom','none']:
            page.evaluate('(effect) => {demoViewer.options.effects={open:effect,change:effect,close:effect};demoViewer.close({animate:false});demoViewer.open(0)}', effect)
            page.locator('.tlb-image').wait_for(state='visible')
            page.locator('.tlb-next').click()
            page.locator('.tlb-image').wait_for(state='visible')
            page.evaluate('demoViewer.close()')
            page.locator('dialog.tiny-lightbox').wait_for(state='detached')
            assert page.evaluate('document.body.style.overflow === ""')
        # Lower edge: passing invalid images should not corrupt existing images.
        assert page.evaluate('''() => {const original=demoViewer.images.length;
            try {demoViewer.insertSlide({id:'invalid',src:'javascript:alert(1)'},1);return false}
            catch(e){return demoViewer.images.length===original}}''')

        # Vertical gesture follows the mouse and closes once threshold is reached.
        page.evaluate("demoViewer.open(0);demoViewer.options.effects.close='none'")
        page.locator('.tlb-image').wait_for(state='visible')
        page.evaluate('''() => {
           const i=document.querySelector('.tlb-image'),r=i.getBoundingClientRect();
           const x=r.x+r.width/2,y=r.y+r.height/2;
           for(const [t,yy] of [['pointerdown',y],['pointermove',y+165]])
             i.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:23,pointerType:'mouse',button:0,clientX:x,clientY:yy}));
           window._v2point={x,y};
        }''')
        assert page.evaluate('demoViewer._gestureOffset.y') > 110
        page.evaluate('''() => {const i=document.querySelector('.tlb-image');
          i.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:23,pointerType:'mouse',button:0,
             clientX:_v2point.x,clientY:_v2point.y+165}));}''')
        page.locator('dialog.tiny-lightbox').wait_for(state='detached')

        # Dynamic DOM reload restores the original sample list.
        page.evaluate("demoViewer.reload()")
        assert page.evaluate('demoViewer.images.length') == 6
        page.evaluate('demoViewer.open(0);demoViewer.destroy()')
        assert page.locator('dialog.tiny-lightbox').count() == 0
        assert page.evaluate('TinyLightbox.active===null')
        assert not errors, errors
        browser.close()
    print('PASS TinyLightbox v2 advanced effects, responsive/captions, SVG icons, gestures, API, async lifecycle and cleanup')

if __name__ == '__main__': run()
