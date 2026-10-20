import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtCore import Qt,QRectF
from PySide6.QtGui import QImage
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.map_ui import poi_filter,MapCanvas
from noitatool.engine import Engine
from noitatool import localization as loc
from noitatool.language_packs import import_pack,choices,selected
from noitatool.image_import import prepare_raster,vips_module
from noitatool.map_capture import Capture

class MapSettingsRevisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        cls.engine=Engine();cls.data=cls.engine.request(op='map',seed=1234)
    @classmethod
    def tearDownClass(cls):cls.engine.close()
    def test_resource_categories_are_disjoint_and_named(self):
        cases={'emerald_tablet':'tablet','book_03':'tablet','orb':'special','orb_cursed':'special','heart':'health','full_heal':'health','gold':'gold','goldnugget_50':'gold','egg_worm':'egg','kiuaskivi':'stone','runestone_fire':'stone','sampo':'pickup'}
        for key,expected in cases.items():self.assertEqual(poi_filter({'type':'pickup','item':key}),expected)
        window=Window();page=window.map_page
        for key in set(cases.values()):self.assertTrue(page.filters[key].text())
        page.filters['tablet'].setChecked(False)
        self.assertFalse(page.filters['health'].isChecked());self.assertFalse(page.filters['gold'].isChecked())
        window.close()
    def test_generated_areas_cover_reference_but_leave_other_areas_transparent(self):
        import base64
        d=self.data;self.assertTrue(d['overlay']);self.assertEqual(d['overlay']['origin'],[-17920,-7168])
        image=QImage.fromData(base64.b64decode(d['overlay']['image']))
        self.assertTrue(image.hasAlphaChannel());self.assertEqual(image.pixelColor(10,10).alpha(),0)
        self.assertTrue(any(image.pixelColor(x,y).alpha() for y in range(800,2000,100) for x in range(1600,2000,100)))
        window=Window();page=window.map_page;page.display_map(d)
        self.assertIsNotNone(page.overlay_item);self.assertLess(page.terrain_layer.z,page.overlay_item.zValue())
        page.generated_overlay.setChecked(False);self.assertIsNone(page.overlay_item)
        self.assertFalse(page.progress.isVisible());page.precise.setChecked(True);self.assertFalse(page.icon_size.isEnabled());page.precise.setChecked(False);self.assertTrue(page.icon_size.isEnabled());window.close()
        sky=self.engine.request(op='map',seed=1234,verticalIndex=-1);self.assertIsNone(sky['overlay'])
    def test_settings_tabs_and_language_pack_switching_persist(self):
        old=loc._overrides,loc._loaded,loc._language
        with tempfile.TemporaryDirectory(dir='artifacts') as folder,patch('noitatool.localization.user_path',return_value=Path(folder)/'user.json'):
            try:
                loc._loaded=False;window=Window();self.assertEqual(window.nav.count(),3);self.assertEqual(window.settings_tabs.count(),2)
                window.show();self.app.processEvents()
                loc.select_language('en');self.assertEqual(window.settings_button.text(),'Settings')
                from noitatool.catalog import name
                self.assertEqual(name('LIGHT_BULLET'),'Spark bolt')
                ja=Path(folder)/'ja.json';ja.write_text(json.dumps({'language':'ja_JP','name':'日本語','entries':[{'key':'设置','translation':'設定'},{'key':'Close','translation':'閉じる'}]},ensure_ascii=False),encoding='utf-8')
                key,count=import_pack(ja);self.assertEqual(count,2);loc.select_language(key);self.assertEqual(window.settings_button.text(),'設定')
                loc.select_language('zh_CN');self.assertEqual(window.settings_button.text(),'设置');self.assertIn(key,{row['id'] for row in choices()})
                loc.select_language(key);loc._loaded=False;loc.ensure_loaded();self.assertEqual(loc.text('Close'),'閉じる');self.assertEqual(selected(),key)
                window.close()
            finally:loc._overrides,loc._loaded,loc._language=old
    def test_large_raster_import_is_tiled_cached_and_zoom_dependent(self):
        with tempfile.TemporaryDirectory(dir='artifacts') as folder:
            folder=Path(folder);vips=vips_module();path=folder/'large.png'
            # 67 million pixels exceeds the old 64 MP import rejection limit.
            vips.Image.black(8192,8192,bands=3).new_from_image([40,100,75]).pngsave(str(path),compression=1)
            progress=[];dzi=prepare_raster(path,progress.append,folder/'cache');self.assertTrue(dzi.is_file());self.assertEqual(progress[-1]['value'],100)
            self.assertEqual(prepare_raster(path,cache=folder/'cache'),dzi)
            capture=Capture(dzi,123,0,0,0);view=MapCanvas();view.resize(900,700);view.show();self.app.processEvents();capture.install(view.scene())
            view.fitInView(QRectF(0,0,8192,8192),Qt.KeepAspectRatio);capture.refresh(view);levels={key[0] for key in capture.items};self.assertTrue(levels);self.assertLessEqual(len(capture.items),24)
            view.zoom(10);capture.refresh(view);self.assertGreater(min(key[0] for key in capture.items),min(levels));self.assertLessEqual(len(capture.items),24)
            capture.detach();view.close()

if __name__=='__main__':unittest.main()
