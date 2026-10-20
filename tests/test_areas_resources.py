import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
import time
from copy import deepcopy
from unittest.mock import patch
from PySide6.QtCore import Qt,QPointF
from PySide6.QtWidgets import QApplication,QGraphicsItem,QPushButton
from PySide6.QtTest import QTest
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.areas import validate_area,preset
from noitatool.search import validate_rule,SearchConfig,SearchRunner
from noitatool.gpu import devices
from noitatool.resources_ui import ResourceBrowser
from noitatool.map_ui import NativeSprite,HolyShopMarker
from noitatool.rules_ui import RuleDialog

class AreaResourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        with Engine() as e:
            cls.map=e.request(op='map',seed=123)
            cls.layer=e.request(op='layer',seed=123,layer=0)

    def test_rectangle_search_exact_edges_and_potion_resources(self):
        area={'kind':'rect','label':'小范围','bounds':[-1100,600,-900,720]}
        rule={'type':'layerSpells','val':{'scope':'region','area':area,'ids':['BLACK_HOLE'],'mode':'all','layers':[]}}
        validate_rule(rule)
        with Engine() as e:
            resources=e.request(op='area',seed=123,area=area)
            self.assertEqual(e.search(123,124,rule),[123])
            self.assertTrue(all(-1100<=p['x']<-900 and 600<=p['y']<720 for p in resources['items']))
            outside=deepcopy(rule);outside['val']['area']['bounds']=[-1100,600,-1005,720]
            self.assertEqual(e.search(123,124,outside),[])
            spider=e.request(op='area',seed=123,area=preset('lukki'))
            self.assertGreater(len(spider['items']),0)
            self.assertTrue(all(p.get('biome')=='rainforest_dark' for p in spider['items']))
        self.assertTrue(any(p['type']=='potion' for p in self.layer['items']))

    def test_area_validation_and_visual_rule_round_trip(self):
        for area in ({'kind':'rect','bounds':[0,0,0,10]},{'kind':'rect','bounds':[0,0,float('inf'),1]},{'kind':'biome','bounds':[0,0,10,10],'biomes':[]},{'kind':'biome','bounds':[0,0,10,10],'biomes':['fungicave'],'cells':[[70,0]]}):
            with self.subTest(area=area),self.assertRaises(ValueError):validate_area(area)
        rule={'type':'layerSpells','val':{'scope':'region','area':preset('lukki'),'ids':['BLACK_HOLE'],'mode':'all','layers':[],'worldRange':[-1,1]}}
        dialog=RuleDialog(rule=rule);self.assertEqual(dialog.simple_rule(),rule);dialog.close()

    def test_resource_columns_are_separate_and_searchable(self):
        browser=ResourceBrowser();browser.set_resources(self.layer['items'],self.layer['evidence'],self.layer['ids'])
        self.assertGreater(browser.wands.count(),0);self.assertGreater(browser.potions.count(),0);self.assertGreater(browser.spells.count(),0)
        for kind,listing in [('wand',browser.wands),('potion',browser.potions)]:self.assertTrue(all(listing.item(i).data(Qt.UserRole)['type']==kind for i in range(listing.count())))
        browser.search.setText('BLACK_HOLE')
        self.assertTrue(any(not browser.spells.item(i).isHidden() and browser.spells.item(i).data(Qt.UserRole)=='BLACK_HOLE' for i in range(browser.spells.count())))
        browser.close()

    def test_map_drag_selection_and_biome_click(self):
        w=Window();w.resize(1360,900);w.show();w.nav.setCurrentRow(2);page=w.map_page;page.display_map(self.map)
        try:
            page.canvas.resetTransform();page.canvas.scale(1,1);page.canvas.centerOn(-1005,658);self.app.processEvents()
            page.selection_mode.setCurrentIndex(page.selection_mode.findData('rect'))
            with patch.object(page,'show_area_resources') as popup:
                start=page.canvas.mapFromScene(QPointF(-1100,600));end=page.canvas.mapFromScene(QPointF(-900,720))
                QTest.mousePress(page.canvas.viewport(),Qt.LeftButton,pos=start);QTest.mouseMove(page.canvas.viewport(),end);QTest.mouseRelease(page.canvas.viewport(),Qt.LeftButton,pos=end)
                popup.assert_called_once();self.assertEqual(page.selected_area['kind'],'rect');self.assertTrue(page.resources_button.isEnabled());self.assertTrue(page.area_shapes)
            region=next(a for a in self.map['regions'] if a['biomes']==['fungiforest'] and a['verticalIndex']==0 and a['bounds'][1]<8704)
            x,y=region['cells'][len(region['cells'])//2];point=QPointF(x*512-17920+256,y*512-7168+256)
            page.canvas.centerOn(point);self.app.processEvents();page.selection_mode.setCurrentIndex(page.selection_mode.findData('biome'))
            with patch.object(page,'show_area_resources'):QTest.mouseClick(page.canvas.viewport(),Qt.LeftButton,pos=page.canvas.mapFromScene(point))
            self.assertEqual(page.selected_area['biomes'],['fungiforest'])
        finally:w.close()

    def test_precise_mode_uses_world_sized_unframed_sprites(self):
        w=Window();w.resize(1360,900);w.show();w.nav.setCurrentRow(2);page=w.map_page;page.display_map(self.map)
        try:
            point=next(p for p in self.map['pois'] if p['type']=='wand' and p.get('source')!='holy_mountain' and 0<=p['y']<1500)
            page.canvas.resetTransform();page.canvas.scale(2,2);page.canvas.centerOn(point['x'],point['y']);self.app.processEvents()
            page.precise.setChecked(True);page.update_markers();self.assertTrue(page.markers)
            self.assertTrue(all(isinstance(m,(NativeSprite,HolyShopMarker)) for m in page.markers))
            for sprite in page.markers:
                if isinstance(sprite,HolyShopMarker):continue
                self.assertFalse(sprite.flags()&QGraphicsItem.ItemIgnoresTransformations)
                self.assertEqual(sprite.pos(),QPointF(sprite.items[0]['x'],sprite.items[0]['y']))
                self.assertEqual(sprite.boundingRect().width(),sprite.image.width())
        finally:w.close()

    def test_side_region_is_separate_and_gpu_area_search(self):
        with Engine() as e:
            second=e.request(op='layer',seed=123,layer=1)
            fungal=e.request(op='area',seed=123,area=preset('fungal'))
            self.assertTrue(fungal['items'])
            self.assertFalse(any(p.get('biome')=='fungicave' for p in second['items']))
            rule={'type':'and','rules':[{'type':'perkSet','val':{'ids':['MOLD'],'where':0,'mode':'all'}},{'type':'layerSpells','val':{'scope':'region','area':{'kind':'rect','bounds':[-1100,600,-900,720]},'mode':'all','ids':['BLACK_HOLE']}}]}
            expected=e.search(1,2,rule,seeds=[123,84])
        self.assertIn(123,expected)
        if devices():
            runner=SearchRunner(SearchConfig(seed_list=[123,84],backend='gpu',max_workers=2,cpu_percent=100,gpu_percent=100,max_results=0),rule)
            self.assertEqual(runner.run(),sorted(expected))

    def test_area_resource_window_uses_same_three_columns(self):
        w=Window();w.resize(1360,900);w.show();w.nav.setCurrentRow(2);page=w.map_page;page.display_map(self.map)
        errors=[];w.show_error=errors.append
        try:
            page.set_selected_area(preset('lukki'));page.show_area_resources()
            deadline=time.monotonic()+20
            while w.jobs and time.monotonic()<deadline:self.app.processEvents();time.sleep(.01)
            self.assertFalse(w.jobs);self.assertFalse(errors)
            dialog=page.resource_windows[0]
            self.assertGreater(dialog.browser.wands.count(),0);self.assertGreater(dialog.browser.potions.count(),0);self.assertGreater(dialog.browser.spells.count(),0)
            listing=dialog.browser.wands;position=listing.visualItemRect(listing.item(0)).center()
            QTest.mouseClick(listing.viewport(),Qt.LeftButton,pos=position);QTest.mouseDClick(listing.viewport(),Qt.LeftButton,pos=position);self.app.processEvents()
            self.assertTrue(dialog.isVisible());self.assertIn(dialog,page.resource_windows);self.assertFalse(dialog.browser.click_timer.isActive())
            button=next(b for b in dialog.findChildren(QPushButton) if b.text()=='地图精细查看')
            button.click();self.app.processEvents();self.assertIn(dialog,page.resource_windows);self.assertTrue(dialog.isVisible())
            self.assertTrue(page.precise.isChecked());self.assertAlmostEqual(page.canvas.transform().m11(),2)
            self.assertTrue(all(page.filters[k].isChecked() for k in ('wand','spell','potion')))
            dialog.close();self.app.processEvents();self.assertFalse(page.resource_windows)
        finally:w.close()

if __name__=='__main__':unittest.main()
