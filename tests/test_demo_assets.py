"""Regression tests for publishing legacy TinySuite demo assets.

Run: python3 -m unittest discover -s tests -p 'test_demo_assets.py'
"""
import importlib.util
from pathlib import Path
import tempfile
import unittest

BUILD_SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/build-site.py'
spec = importlib.util.spec_from_file_location('tinysuite_build', BUILD_SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class DemoAssetPublishingTests(unittest.TestCase):
    def setup_directories(self, root, component):
        source = root / 'src' / component
        output = root / 'published' / component
        (source / 'demo').mkdir(parents=True)
        (output / 'demo').mkdir(parents=True)
        return source, output

    def test_selectize_rewrites_all_legacy_html_to_dist(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = self.setup_directories(Path(temp), 'TinySelectize')
            legacy = '<link href="./../TinySelectize.css"><script src="./../TinySelectize.js"></script><script src="./../TinySelectize.Tree.plugin.js"></script>'
            for page in ('demo_.html', 'demo.html'):
                (output / 'demo' / page).write_text(legacy)
            dist = output / 'dist'
            dist.mkdir()
            for filename in ('TinySelectize.min.css', 'TinySelectize.min.js', 'TinySelectize.Tree.plugin.min.js'):
                (dist / filename).write_text('/* test fixture */')
            builder.publish_demo_dependencies('TinySelectize', source, output)
            for page in ('demo_.html', 'demo.html'):
                html = (output / 'demo' / page).read_text()
                self.assertEqual(html.count('../dist/'), 3)
                self.assertNotIn('./../TinySelectize.', html)

    def test_selectize_uses_sources_without_dist(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = self.setup_directories(Path(temp), 'TinySelectize')
            (output / 'demo/demo_.html').write_text('<script src="./../TinySelectize.js"></script>')
            for filename in ('TinySelectize.css', 'TinySelectize.js', 'TinySelectize.Tree.plugin.js'):
                (source / filename).write_text(filename)
            builder.publish_demo_dependencies('TinySelectize', source, output)
            self.assertEqual((output / 'TinySelectize.js').read_text(), 'TinySelectize.js')
            self.assertIn('./../TinySelectize.js', (output / 'demo/demo_.html').read_text())

    def test_selectize_fails_if_dist_and_sources_are_missing(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = self.setup_directories(Path(temp), 'TinySelectize')
            (output / 'demo/demo_.html').write_text('<script src="./../TinySelectize.js"></script>')
            with self.assertRaisesRegex(FileNotFoundError, 'Run npm run build'):
                builder.publish_demo_dependencies('TinySelectize', source, output)

    def test_inline_editor_has_offline_jquery_fallback(self):
        with tempfile.TemporaryDirectory() as temp:
            source, output = self.setup_directories(Path(temp), 'TinyInlineEditor')
            (output / 'demo/index.html').write_text('<script src="../vendor/jquery.min.js"></script>')
            builder.publish_demo_dependencies('TinyInlineEditor', source, output)
            file = output / 'vendor/jquery.min.js'
            self.assertTrue(file.is_file())
            self.assertIn('jQuery v3.6.1', file.read_text()[:200])


if __name__ == '__main__':
    unittest.main()
