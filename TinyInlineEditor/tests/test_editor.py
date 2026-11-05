"""Chromium regression tests. Execute with: python -m unittest discover -s tests -v"""
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class TinyInlineEditorBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox']
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1280, 'height': 800})
        self.errors = []
        self.page.on('pageerror', lambda err: self.errors.append(str(err)))
        self.page.set_content('''<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body>
            <div id="a"><p>A small <strong>editable sentence</strong> is here.</p></div>
            <div id="b">A second independent editor.</div>
            <textarea id="textarea"><p>Initial <b>text</b></p></textarea>
            </body></html>''')
        self.page.add_style_tag(content=(ROOT / 'TinyInlineEditor.css').read_text())
        for name in ['vendor/jquery.min.js', 'TinyInlineEditor.js']:
            self.page.add_script_tag(content=(ROOT / name).read_text())

    def tearDown(self):
        self.assertEqual(self.errors, [], f'JavaScript errors: {self.errors}')
        self.page.close()

    def select_text(self, selector='#a strong'):
        self.page.evaluate('''selector => {
            const el = document.querySelector(selector);
            const range = document.createRange();
            range.selectNodeContents(el);
            const selection = window.getSelection();
            selection.removeAllRanges(); selection.addRange(range);
            el.closest('.il__trigger').focus();
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        }''', selector)
        self.page.locator('.il__panel.il--visible').wait_for(timeout=2000)

    def test_multiple_instances_and_theme_switch(self):
        self.page.evaluate('''() => {
            $('#a').tinyInlineEditor({ theme: 'light' });
            $('#b').inLine({ theme: 'dark', toolbar: ['bold'] });
        }''')
        self.assertEqual(self.page.locator('[contenteditable="true"]').count(), 2)
        self.assertNotEqual(self.page.evaluate("$('#a').data('inLine').uuid"), self.page.evaluate("$('#b').data('inLine').uuid"))
        self.select_text()
        self.page.evaluate("$('#a').tinyInlineEditor('set', {theme: 'dark'})")
        self.assertEqual(self.page.locator('.il__toolbar.il--dark').count(), 1)
        self.assertEqual(self.page.locator('.il__panel.il--dark').count(), 1)
        self.assertEqual(self.page.evaluate("$('#b').data('inLine').trigger.getAttribute('contenteditable')"), 'true')

    def test_toolbar_format_triggers_change_only_when_content_changes(self):
        self.page.evaluate('''() => {
            window.changeCalls = 0;
            $('#a').tinyInlineEditor({ onChange: () => window.changeCalls++ });
        }''')
        self.select_text()
        self.page.locator('.il__button--italic').click()
        self.assertEqual(self.page.evaluate('window.changeCalls'), 1)
        self.assertRegex(self.page.locator('#a').inner_html(), r'(?i)<(?:i|em)>')
        self.assertEqual(self.page.evaluate("$('#a').data('inLine').content"), self.page.locator('#a').inner_html())

    def test_rejects_javascript_and_accepts_https_link(self):
        self.page.evaluate("$('#a').tinyInlineEditor({toolbar: ['link']})")
        self.select_text()
        self.page.locator('.il__button--link').click()
        dialog = self.page.locator('.il__dropdown--link')
        dialog.locator('input').fill('javascript:alert(document.cookie)')
        dialog.locator('.il__button--confirm').click()
        self.assertEqual(dialog.locator('input').get_attribute('aria-invalid'), 'true')
        self.assertEqual(self.page.locator('#a a').count(), 0)
        dialog.locator('input').fill('https://example.org/path')
        dialog.locator('.il__button--confirm').click()
        self.assertEqual(self.page.locator('#a a').get_attribute('href'), 'https://example.org/path')

    def test_destroy_reinit_and_restore_attrs(self):
        self.page.evaluate("$('#a').tinyInlineEditor(); $('#b').tinyInlineEditor()")
        self.select_text()
        self.page.evaluate("$('#a').tinyInlineEditor('destroy')")
        self.assertEqual(self.page.evaluate("$('#a').data('inLine')"), None)
        self.assertEqual(self.page.locator('#a').get_attribute('contenteditable'), None)
        self.assertEqual(self.page.locator('#b').get_attribute('contenteditable'), 'true')
        self.assertEqual(self.page.locator('.il__frame').count(), 1)
        self.page.evaluate("$('#a').tinyInlineEditor()")
        self.assertEqual(self.page.locator('#a').get_attribute('contenteditable'), 'true')

    def test_textarea_binding_and_destroy(self):
        self.page.evaluate("$('#textarea').tinyInlineEditor()")
        self.assertEqual(self.page.locator('#textarea').input_value(), '<p>Initial <b>text</b></p>')
        self.page.evaluate('''() => {
            const api = $('#textarea').data('inLine');
            api.trigger.innerHTML = '<p>New <strong>text</strong></p>';
            api.commitChange();
        }''')
        self.assertEqual(self.page.locator('#textarea').input_value(), '<p>New <strong>text</strong></p>')
        self.page.evaluate("$('#textarea').tinyInlineEditor('destroy')")
        self.assertEqual(self.page.locator('#textarea').is_visible(), True)
        self.assertEqual(self.page.locator('#textarea').input_value(), '<p>New <strong>text</strong></p>')
        self.assertEqual(self.page.locator('.il__trigger').count(), 0)

    def test_save_serialized_and_newer_revision_wins(self):
        self.page.evaluate('''() => {
            window.requests = [];
            window.savers = [];
            $('#a').tinyInlineEditor({
                onSave: (api, text) => new Promise(resolve => {
                    window.requests.push(text);
                    window.savers.push(resolve);
                })
            });
            window.edit = (value) => {
                const api = $('#a').data('inLine');
                api.trigger.innerHTML = value;
                api.commitChange();
            };
            window.edit('First version');
        }''')
        self.page.wait_for_timeout(1120)
        self.assertEqual(self.page.evaluate('window.requests.length'), 1)
        self.page.evaluate("window.edit('Second version')")
        self.page.wait_for_timeout(1120)
        self.assertEqual(self.page.evaluate('window.requests.length'), 1)
        self.page.evaluate('window.savers[0](true)')
        self.page.wait_for_function('window.requests.length === 2')
        self.assertEqual(self.page.evaluate('window.requests[1]'), 'Second version')
        self.assertEqual(self.page.locator('#a.il__saved').count(), 0)
        self.page.evaluate('window.savers[1](true)')
        self.page.locator('#a.il__saved').wait_for(timeout=2000)

    def test_failed_save_sets_error_state(self):
        self.page.evaluate('''() => {
            $('#a').tinyInlineEditor({onSave: () => Promise.resolve(false)});
            const api = $('#a').data('inLine');
            api.trigger.textContent = 'Changed'; api.commitChange();
        }''')
        self.page.locator('#a.il__save_error').wait_for(timeout=3000)
        self.assertEqual(self.page.locator('#a.il__saved').count(), 0)

    def test_heading_format_and_callback(self):
        self.page.evaluate('''() => {
            window.changes = 0;
            $('#a').tinyInlineEditor({toolbar: ['format'], onChange: () => window.changes++});
        }''')
        self.select_text()
        self.page.locator('.il__button--format').click()
        self.page.locator('.il__button--mediumTitle').click()
        self.assertGreaterEqual(self.page.locator('#a h2').count(), 1)
        self.assertEqual(self.page.evaluate('window.changes'), 1)

    def test_color_dropdown_and_escape(self):
        self.page.evaluate("$('#a').tinyInlineEditor({toolbar: ['color']})")
        self.select_text()
        self.page.locator('.il__button--color').click()
        self.page.locator('.il__button--textColor').click()
        dialog = self.page.locator('.il__dropdown--color.il--visible')
        dialog.wait_for(timeout=2000)
        dialog.press('Escape')
        self.page.wait_for_function("document.querySelector('.il__dropdown--color') === null || !document.querySelector('.il__dropdown--color').classList.contains('il--visible')")
        self.page.locator('.il__button--textColor').click()
        dialog = self.page.locator('.il__dropdown--color.il--visible')
        dialog.wait_for(timeout=2000)
        dialog.locator('input.il__input').fill('url(javascript:alert(1))')
        dialog.locator('input.il__input').press('Enter')
        self.assertEqual(dialog.locator('input.il__input').get_attribute('aria-invalid'), 'true')
        dialog.locator('.il__group button').nth(1).click()
        self.assertIn('color:', self.page.locator('#a').inner_html())

    def test_plain_text_paste_escapes_markup(self):
        self.page.evaluate("$('#a').tinyInlineEditor()")
        self.page.locator('#a').focus()
        self.page.evaluate('''() => {
            const el = document.querySelector('#a');
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            selection.removeAllRanges(); selection.addRange(range);
            const clipboard = new DataTransfer();
            clipboard.setData('text/plain', '<img src=x onerror=alert(1)>');
            el.dispatchEvent(new ClipboardEvent('paste', {clipboardData: clipboard, bubbles: true, cancelable: true}));
        }''')
        self.assertEqual(self.page.locator('#a img').count(), 0)
        self.assertIn('&lt;img', self.page.locator('#a').inner_html())

    def test_prototype_pollution_is_blocked_and_labels_are_validated(self):
        self.page.evaluate('''() => {
            $('#a').tinyInlineEditor();
            const api = $('#a').data('inLine');
            api.set(JSON.parse('{"__proto__":{"pwned":"yes"},"labels":{"__proto__":{"pwned":"yes"},"bold":"Strong"}}'));
            window.polluted = ({}).pwned;
            window.labelBold = api.trigger && api.content;
        }''')
        self.assertIsNone(self.page.evaluate('window.polluted'))
        self.assertIsNone(self.page.evaluate('({}).pwned'))
        self.page.evaluate('''() => $('#b').tinyInlineEditor(JSON.parse('{"__proto__":{"pwned":"yes"},"toolbar":["bold"]}'))''')
        self.assertIsNone(self.page.evaluate('({}).pwned'))

    def test_invalid_options_are_rejected_without_mutation(self):
        self.page.evaluate("$('#a').tinyInlineEditor({theme:'dark'})")
        result = self.page.evaluate('''() => {
            const api = $('#a').data('inLine');
            let failure = '';
            try {api.set({theme:'light',toolbar:null});}catch(e){failure=e.message;}
            return {failure, theme:api.set && api.trigger ? api.trigger.ownerDocument : null};
        }''')
        self.assertIn('invalid toolbar', result['failure'])
        self.assertEqual(self.page.evaluate("$('#a').data('inLine') ? $('#a').data('inLine').trigger.tagName : null"), 'DIV')
        self.page.evaluate("$('#b').tinyInlineEditor({toolbar:['bold']})")
        self.assertEqual(self.page.evaluate("$('#b').data('inLine').trigger.getAttribute('contenteditable')"), 'true')

    def test_textarea_change_is_only_emitted_on_real_modification(self):
        result = self.page.evaluate('''() => {
            window.textareaChanges = 0;
            $('#textarea').on('change', () => window.textareaChanges++);
            $('#textarea').tinyInlineEditor();
            const api = $('#textarea').data('inLine');
            api.commitChange();
            const mount = window.textareaChanges;
            api.trigger.innerHTML = '<p>Changed</p>';
            api.commitChange(); api.commitChange();
            return {mount, after:window.textareaChanges, value:$('#textarea').val()};
        }''')
        self.assertEqual(result, {'mount':0,'after':1,'value':'<p>Changed</p>'})

    def test_callback_exception_does_not_prevent_autosave(self):
        self.page.evaluate('''() => {
            window.calls = 0;
            $('#a').tinyInlineEditor({
                onChange() { throw new Error('Client handler broke'); },
                onSave() {window.calls++;return true;}
            });
            const api=$('#a').data('inLine');api.trigger.textContent='Updated';api.commitChange();
        }''')
        self.page.wait_for_function('window.calls === 1', timeout=2700)
        self.page.locator('#a.il__saved').wait_for()

    def test_autosave_deactivation_cancels_pending_timer_but_flush_works(self):
        self.page.evaluate('''() => {
            window.requests=[];
            $('#a').tinyInlineEditor({onSave(api,content){window.requests.push(content);return true;}});
            const api=$('#a').data('inLine');
            api.trigger.innerHTML='Changed';api.commitChange();api.set({autosaveOn:false});
        }''')
        self.page.wait_for_timeout(1160)
        self.assertEqual(self.page.evaluate('window.requests.length'),0)
        self.assertTrue(self.page.evaluate("$('#a').data('inLine').dirty"))
        self.assertTrue(self.page.evaluate("async () => await $('#a').tinyInlineEditor('flush')"))
        self.assertEqual(self.page.evaluate('window.requests'), ['Changed'])
        self.assertFalse(self.page.evaluate("$('#a').data('inLine').dirty"))

    def test_flush_waits_for_inflight_and_resaves_latest_revision(self):
        self.page.evaluate('''() => {
            window.requests=[];window.complete=[];
            $('#a').tinyInlineEditor({onSave(api, html){return new Promise(resolve => {
                window.requests.push(html);window.complete.push(resolve);
            });}});
            const api=$('#a').data('inLine');
            api.trigger.innerHTML='First';api.commitChange();
            window.firstFlush=api.flush();
        }''')
        self.page.wait_for_function('window.requests.length===1')
        self.page.evaluate('''() => {
            const api=$('#a').data('inLine');api.trigger.innerHTML='Second';api.commitChange();
            window.secondFlush=api.flush();window.complete[0](true);
        }''')
        self.page.wait_for_function('window.requests.length===2')
        self.assertEqual(self.page.evaluate('window.requests'), ['First','Second'])
        self.page.evaluate('window.complete[1](true)')
        result = self.page.evaluate('''async () => [await window.firstFlush, await window.secondFlush,$('#a').data('inLine').dirty]''')
        self.assertEqual(result,[True,True,False])

    def test_flush_failure_retains_dirty_flag(self):
        self.page.evaluate('''() => {
            $('#a').tinyInlineEditor({onSave(){return Promise.resolve(false);}});
            const api=$('#a').data('inLine');api.trigger.textContent='Failed';api.commitChange();
        }''')
        self.assertFalse(self.page.evaluate("async()=>await $('#a').data('inLine').flush()"))
        self.assertTrue(self.page.evaluate("$('#a').data('inLine').dirty"))

    def test_existing_blockquote_toggles_without_nested_quote(self):
        self.page.evaluate('''() => {
            $('#a').html('<blockquote><p>Quoted <strong>text</strong></p></blockquote>');
            $('#a').tinyInlineEditor({toolbar:['format']});
        }''')
        self.select_text('#a strong')
        self.page.locator('.il__button--format').click()
        self.page.locator('.il__button--blockquote').click()
        self.assertEqual(self.page.locator('#a blockquote').count(),0)
        self.assertEqual(self.page.locator('#a p strong').count(),1)

    def test_scroll_inside_parent_repositions_toolbar(self):
        self.page.evaluate('''() => {
            const container=document.createElement('div');container.id='scroller';
            container.style='height:140px;overflow-y:auto;border:1px solid black';
            const a=document.querySelector('#a');a.before(container);container.append(a);
            a.style='padding-top:180px;padding-bottom:240px';
            $('#a').tinyInlineEditor({toolbar:['bold']});
        }''')
        self.select_text()
        before = self.page.evaluate("parseFloat(document.querySelector('.il__toolbar').style.top)")
        self.page.evaluate("document.querySelector('#scroller').scrollTop=70")
        self.page.wait_for_timeout(220)
        after = self.page.evaluate("parseFloat(document.querySelector('.il__toolbar').style.top)")
        self.assertNotAlmostEqual(before,after,delta=10)

    def test_sanitizer_hook_applies_to_initial_html_and_set_content(self):
        res = self.page.evaluate('''() => {
            let received=0;
            $('#textarea').tinyInlineEditor({
                sanitizeHTML(value){received++;return value.replace(/<script[^>]*>[\\s\\S]*?<\\/script>/gi,'');},
                html:'<p>Safe</p><script>window.BAD=1</script>'
            });
            const api=$('#textarea').data('inLine');
            api.setContent('<b>Kept</b><script>window.BAD=2</script>');
            return {html:api.content,received,bad:window.BAD};
        }''')
        self.assertEqual(res['html'],'<b>Kept</b>')
        self.assertGreaterEqual(res['received'],2)
        self.assertIsNone(res['bad'])

    def test_subpanels_open_and_back(self):
        self.page.evaluate("$('#a').tinyInlineEditor({toolbar:['format','align','color']})")
        self.select_text()
        for panel in ('format','align','color'):
            self.page.locator(f'.il__button--{panel}').click()
            self.page.locator(f'.il__panel--{panel}.il--visible').wait_for(timeout=2000)
            self.page.locator(f'.il__panel--{panel}.il--visible .il__button--back').click()
            self.page.locator('.il__panel--index.il--visible:not(.il--hidden)').wait_for(timeout=2000)



if __name__ == '__main__':
    unittest.main()
