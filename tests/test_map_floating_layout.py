import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
from PySide6.QtCore import QPoint,QRectF
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app

class FloatingMapLayoutTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
    def setUp(self):
        self.window=Window();self.window.nav.setCurrentRow(2);self.window.show();self.app.processEvents();self.page=self.window.map_page
    def tearDown(self):
        self.page.seed_menu.close();self.page.layer_menu.close();self.page.options_menu.close();self.window.close();self.app.processEvents()
    def test_map_occupies_the_page_from_the_old_seed_row_to_the_bottom(self):
        for width,height in ((820,560),(1280,900),(1920,1080)):
            self.window.resize(width,height);self.app.processEvents();canvas=self.page.canvas
            top=canvas.mapTo(self.window,QPoint(0,0)).y();bottom=canvas.mapTo(self.window,QPoint(0,canvas.height())).y()
            self.assertLess(top,160);self.assertGreater(bottom,height-45);self.assertGreater(canvas.height(),height*.70)
            self.assertLessEqual(self.page.floating_tools.width()+16,canvas.viewport().width())
    def test_tools_stay_fixed_during_zoom_and_pan_and_menus_keep_working(self):
        p=self.page;p.canvas.scene().setSceneRect(QRectF(-10000,-10000,20000,20000));self.app.processEvents()
        before=p.floating_tools.pos();bottom=p.floating_status.pos()
        p.canvas.zoom(3);p.canvas.centerOn(3000,4500);self.app.processEvents()
        self.assertEqual(p.floating_tools.pos(),before);self.assertEqual(p.floating_status.pos(),bottom)
        p.seed_menu.popup(p.seed_menu_button.mapToGlobal(QPoint(0,p.seed_menu_button.height())));self.app.processEvents()
        self.assertTrue(p.seed.isVisible());self.assertTrue(p.load.isVisible());p.seed.setText('42');p.world.setValue(2);self.assertEqual(p.seed.text(),'42');p.seed_menu.close()
        p.layer_menu.popup(p.layer_menu_button.mapToGlobal(QPoint(0,p.layer_menu_button.height())));self.app.processEvents()
        self.assertTrue(p.filters['gold'].isVisible());state=p.filters['gold'].isChecked();p.filters['gold'].click();self.assertNotEqual(p.filters['gold'].isChecked(),state)
    def test_generation_progress_stays_inside_the_fixed_status_panel(self):
        p=self.page;p.progress.show();p.update_generation_progress({'value':40,'phase':'正在生成地图'});self.app.processEvents()
        self.assertTrue(p.progress.isVisible());self.assertLessEqual(p.floating_status.geometry().bottom(),p.canvas.viewport().height())

if __name__=='__main__':unittest.main()
