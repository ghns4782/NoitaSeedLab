import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import ast
import unittest
from unittest.mock import patch
from PySide6.QtCore import QPoint
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.paths import ROOT


class OfflineMapOnlyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)

    def test_browser_modules_are_not_imported_by_application(self):
        for path in (ROOT/'noitatool').glob('*.py'):
            for node in ast.walk(ast.parse(path.read_text(encoding='utf-8-sig'))):
                if isinstance(node,ast.ImportFrom):
                    self.assertNotIn('WebEngine',node.module or '',str(path))
                elif isinstance(node,ast.Import):
                    self.assertFalse(any('WebEngine' in alias.name for alias in node.names),str(path))
        self.assertFalse((ROOT/'noitatool/reference_map.py').exists())

    def test_reference_is_visible_without_a_seed_and_mode_row_is_removed(self):
        with patch('noitatool.preferences.read_preferences',return_value={'real_background':False}):
            w=Window();w.nav.setCurrentRow(2);w.show();self.app.processEvents();page=w.map_page
            try:
                self.assertIsNone(page.data);self.assertTrue(page.terrain_layer.items)
                self.assertFalse(hasattr(page,'source_mode'));self.assertFalse(hasattr(page,'mode_pages'))
                self.assertFalse(hasattr(page,'reference'));self.assertFalse(hasattr(page,'real_background'))
                self.assertFalse(w.jobs)
                self.assertLess(page.canvas.mapTo(w,QPoint(0,0)).y(),120)
                page.clear_background.setChecked(False);self.assertFalse(page.terrain_layer.detailed)
            finally:w.close()

    def test_settings_stay_at_sidebar_bottom_and_navigation_still_works(self):
        w=Window();w.show()
        try:
            self.assertEqual(w.nav.count(),3)
            for width,height in [(820,560),(1280,900),(1920,1080)]:
                w.resize(width,height);self.app.processEvents()
                button=w.settings_button;parent=button.parentWidget()
                self.assertLess(parent.height()-button.geometry().bottom(),25)
                button.click();self.app.processEvents()
                self.assertIs(w.pages.currentWidget(),w.settings_tabs);self.assertTrue(button.isChecked())
                w.nav.setCurrentRow(2);self.app.processEvents()
                self.assertTrue(w.map_page.isVisible());self.assertFalse(button.isChecked())
        finally:w.close()
