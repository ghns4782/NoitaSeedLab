import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest,json
from unittest.mock import patch
from PySide6.QtCore import Qt,QRectF,QPointF
from PySide6.QtWidgets import QApplication
from noitatool.engine import Engine
from noitatool.app import Window,configure_app
from noitatool.real_terrain import calibration,reference_capture
from noitatool.map_ui import MapCanvas,poi_filter,WorldSprite
from noitatool.range_ui import RangeSelector,RangeMapDialog
from noitatool.catalog import read_json
from noitatool.paths import ROOT

class RealTerrainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        cls.engine=Engine();cls.data=cls.engine.request(op='map',seed=1234)
    @classmethod
    def tearDownClass(cls):cls.engine.close()
    def setUp(self):
        self.prefs=patch('noitatool.preferences.read_preferences',return_value={});self.prefs.start()
        self.save=patch('noitatool.preferences.set_preference');self.save.start()
    def tearDown(self):self.prefs.stop();self.save.stop()

    def test_pyramid_budget_and_registration(self):
        data=calibration();files=list((ROOT/'assets/real-terrain_files').rglob('*.png'))
        self.assertGreater(len(files),10);self.assertLessEqual(sum(p.stat().st_size for p in files),12*1024*1024)
        self.assertEqual(data['width'],2122);self.assertEqual(data['height'],4350)
        # Game-space pyramid landmark maps back to the peak visible in the photo.
        x=(9983-data['origin'][0])/data['nativeScale'];y=(-1222-data['origin'][1])/data['nativeScale']
        self.assertAlmostEqual(x,820,delta=2);self.assertAlmostEqual(y,903,delta=2)
        world=reference_capture(1,2);main=reference_capture(1,0)
        self.assertEqual(world.x-main.x,2*35840);self.assertEqual(world.y,main.y)

    def test_zoom_reads_only_visible_tiles_and_pan_evicts_them(self):
        view=MapCanvas();view.resize(1000,700);view.show();self.app.processEvents()
        layer=reference_capture(1234);layer.install(view.scene());view.fitInView(view.sceneRect(),Qt.KeepAspectRatio);layer.refresh(view)
        low=max(key[0] for key in layer.items);self.assertLessEqual(len(layer.items),24)
        view.resetTransform();view.scale(.4,.4);view.centerOn(0,1500);layer.refresh(view)
        high=max(key[0] for key in layer.items);old=set(layer.items)
        self.assertGreater(high,low);self.assertLessEqual(len(layer.items),24)
        view.centerOn(12000,13000);layer.refresh(view);self.assertFalse(set(layer.items)&old)
        self.assertLessEqual(sum(i.pixmap().width()*i.pixmap().height()*4 for i in layer.items.values()),24*512*512*4)
        layer.detach();self.assertFalse(layer.items);view.close()

    def test_detail_toggle_keeps_coordinates_and_limits_resolution(self):
        view=MapCanvas();view.resize(1000,700);view.show();self.app.processEvents()
        layer=reference_capture(1234);layer.install(view.scene());view.resetTransform();view.scale(.4,.4);view.centerOn(0,1500);layer.refresh(view)
        transform=view.transform();center=view.mapToScene(view.viewport().rect().center());high=max(k[0] for k in layer.items)
        layer.detailed=False;layer.refresh(view)
        self.assertLess(max(k[0] for k in layer.items),high);self.assertEqual(view.transform(),transform);self.assertEqual(view.mapToScene(view.viewport().rect().center()),center)
        layer.detach();view.close()

    def test_search_picker_and_map_use_the_same_image_transform(self):
        window=Window();window.save_settings=lambda:None;window.seed.setText('1234');window.nav.setCurrentRow(2);window.show();window.map_page.display_map(self.data)
        selector=RangeSelector();picker=RangeMapDialog(selector);picker.show();self.app.processEvents();picker.refresh_tiles()
        page=window.map_page;self.assertTrue(page.terrain_layer.path.is_file());self.assertTrue(picker.real_background.isChecked())
        self.assertEqual(page.terrain_layer.path,picker.terrain_layer.path)
        self.assertEqual((page.terrain_layer.x,page.terrain_layer.y,page.terrain_layer.scale),(picker.terrain_layer.x,picker.terrain_layer.y,picker.terrain_layer.scale))
        before=selector.values();transform=picker.canvas.transform();picker.clear_background.setChecked(False)
        self.assertEqual(selector.values(),before);self.assertEqual(picker.canvas.transform(),transform)
        picker.close();self.assertFalse(picker.terrain_layer.items);self.assertIsNone(picker.data);selector.close();window.close()

    def test_special_locations_have_valid_details_and_are_visible_by_default(self):
        orbs=[p for p in self.data['pois'] if p.get('item')=='orb'];tablets=[p for p in self.data['pois'] if p.get('item')=='emerald_tablet']
        self.assertEqual(len(orbs),11);self.assertEqual(len(tablets),13)
        self.assertTrue(any(p['x']==780 and p['y']==-1088 for p in orbs));self.assertTrue(any(p['x']==3472 and p['y']==1879 for p in orbs))
        self.assertTrue(all(p['relatedSpell'] in read_json('obj/spells.json') for p in orbs+tablets if p.get('relatedSpell')))
        self.assertTrue(any(p['x']==2339 and p['y']==840 and p.get('accuracy')=='spawn' for p in tablets))
        self.assertTrue(any(p['x']==-1328 and p['y']==-209 and p.get('accuracy')=='spawn' for p in tablets))
        self.assertEqual(sum(p.get('accuracy')=='region' for p in tablets),10)
        window=Window();window.save_settings=lambda:None;window.seed.setText('1234');window.resize(1360,900);window.nav.setCurrentRow(2);window.show();page=window.map_page;page.display_map(self.data);self.app.processEvents();page.update_markers()
        self.assertTrue(page.filters['special'].isChecked());self.assertTrue(page.markers)
        self.assertTrue(all(poi_filter(p) in ('special','tablet') for m in page.markers for p in m.items))
        page.precise.setChecked(True);page.update_markers();self.assertFalse(page.markers)
        window.close()

    def test_parallel_world_excludes_main_only_lava_orb(self):
        data=self.engine.request(op='map',seed=1234,worldOffset=1)
        cursed=[p for p in data['pois'] if p.get('item')=='orb_cursed']
        self.assertEqual(len(cursed),10);self.assertFalse(any(p['relatedSpell']=='NUKE' for p in cursed))

if __name__=='__main__':unittest.main()
