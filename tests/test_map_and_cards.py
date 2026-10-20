import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import base64
import random
import time
import unittest
from unittest.mock import patch
from PySide6.QtCore import Qt,QPointF
from PySide6.QtWidgets import QApplication,QToolButton,QLabel
from PySide6.QtTest import QTest
from noitatool.engine import Engine
from noitatool.app import Window,configure_app
from noitatool.detail_ui import WandCard,SpellCard,ShopCard
from noitatool.map_ui import anchored_groups,WorldSprite,HolyShopMarker,sprite_size,map_wand,group_price


class MapCardsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        with Engine() as engine:
            cls.info=engine.info(123)
            cls.main=engine.request(op='map',seed=123,worldOffset=0)
            cls.parallel=engine.request(op='map',seed=123,worldOffset=1)

    def test_generated_terrain_and_shop_prices_match_original(self):
        self.assertTrue(base64.b64decode(self.main['image']).startswith(b'\x89PNG\r\n\x1a\n'))
        shops=[p for p in self.main['pois'] if p['source']=='holy_mountain']
        originals=[item for shop in self.info['shop'] for item in shop['items']]
        self.assertEqual(len(shops),len(originals))
        for poi,item in zip(shops,originals):
            self.assertEqual(poi['price'],item['gun']['cost'] if 'gun' in item else item['price'])
            if 'spell' in item:self.assertEqual(poi['spell'],item['spell']['id'])
            else:self.assertEqual(poi['wand']['cards'],item['cards'])
        self.assertTrue(any(p['type']=='boss' for p in self.main['pois']))
        self.assertTrue(all(p.get('accuracy') in ('region','spawn') for p in self.main['pois'] if p['type']=='boss'))

    def test_parallel_world_positions_and_contents_refresh(self):
        for data in (self.main,self.parallel):
            left,top=data['origin']
            self.assertTrue(all(left<=p['x']<left+data['width'] and top<=p['y']<top+data['height'] for p in data['pois']))
        self.assertEqual(self.parallel['origin'][0]-self.main['origin'][0],35840)
        first=[p.get('spell') or map_wand(p)['cards'] for p in self.main['pois'] if p['source']=='holy_mountain']
        second=[p.get('spell') or map_wand(p)['cards'] for p in self.parallel['pois'] if p['source']=='holy_mountain']
        self.assertNotEqual(first,second)

    def test_water_layout_chests_and_special_pickups_are_generated(self):
        cave=self.main['waterCave']
        self.assertEqual(cave['layout'],self.info['waterCave']+1)
        self.assertEqual(cave['bounds'],[-2048,515,512,512])
        self.assertTrue(any(p['type']=='chest' and p.get('items') for p in self.main['pois']))
        self.assertTrue(any(p['type']=='pickup' and p.get('source')=='watercave' for p in self.main['pois']))
        self.assertTrue(any(p['type']=='potion' for p in self.main['pois']))
        from PySide6.QtGui import QImage
        image=QImage.fromData(base64.b64decode(self.main['image']))
        x=int((-2048-self.main['origin'][0])/10);y=int((515-self.main['origin'][1])/10)
        colors={image.pixel(x+dx,y+dy)&0xffffff for dx in range(2,49) for dy in range(2,49)}
        self.assertIn(0x2f554c,colors)
        self.assertIn(0x000042,colors)

    def test_holy_shop_visible_earlier_and_layer_buttons_filter_objects(self):
        w=Window();w.resize(1360,900);w.show();w.nav.setCurrentRow(2);page=w.map_page
        try:
            page.display_map(self.main)
            self.assertTrue(page.filters['wand'].isChecked())
            self.assertTrue(all(not b.isChecked() for k,b in page.filters.items() if k not in ('wand','special','tablet')))
            self.assertTrue(page.filters['special'].isChecked())
            page.canvas.resetTransform();page.canvas.scale(.1,.1);page.canvas.centerOn(-280,1395)
            self.app.processEvents();page.update_markers()
            self.assertTrue(any(isinstance(m,HolyShopMarker) for m in page.markers))
            self.assertFalse(any(isinstance(m,WorldSprite) and any(p['type']=='wand' for p in m.items) for m in page.markers))
            for marker in page.markers:
                if not isinstance(marker,HolyShopMarker):continue
                self.assertEqual(marker.pos(),marker.world_bounds.center())
                screen=marker.boundingRect()
                world=type(marker.world_bounds)(marker.pos().x()+screen.x()/.1,marker.pos().y()+screen.y()/.1,screen.width()/.1,screen.height()/.1)
                self.assertTrue(marker.world_bounds.contains(world))
            shop=next(p for p in self.main['pois'] if p.get('source')=='holy_mountain')
            page.focus_point(123,shop);self.app.processEvents()
            center=page.canvas.mapToScene(page.canvas.viewport().rect().center())
            self.assertAlmostEqual(center.x(),shop['shopBounds'][0]+shop['shopBounds'][2]/2,delta=4)
            self.assertAlmostEqual(center.y(),shop['shopBounds'][1]+shop['shopBounds'][3]/2,delta=4)
            chest=next(p for p in self.main['pois'] if p['type']=='chest')
            page.canvas.resetTransform();page.canvas.scale(.7,.7);page.canvas.centerOn(chest['x'],chest['y'])
            page.filters['chest'].setChecked(True);page.update_markers()
            self.assertTrue(any(p['type']=='chest' for m in page.markers for p in m.items))
            page.filters['chest'].setChecked(False);page.update_markers()
            self.assertFalse(any(p['type']=='chest' for m in page.markers for p in m.items))
        finally:w.close()

    def test_chest_potion_and_pickup_details_use_icon_cards(self):
        w=Window()
        try:
            for kind in ('chest','potion','pickup'):
                point=next(p for p in self.main['pois'] if p['type']==kind)
                dialogs=[]
                def inspect(dialog):dialogs.append(dialog);return 0
                with patch('noitatool.detail_ui.show_window',new=inspect):
                    w.map_page.open_item(point)
                    self.assertEqual(len(dialogs),1);dialog=dialogs[0]
                    self.assertTrue(dialog.findChildren(QLabel))
                    if kind=='chest':self.assertTrue(dialog.findChildren(QToolButton))
                self.app.processEvents()
        finally:w.close()

    def test_layer_double_click_navigates_without_detail_popup(self):
        w=Window();w.resize(1360,900);w.seed.setText('123');w.show();w.nav.setCurrentRow(0)
        try:
            w.display_info((123,self.info));w.map_page.display_map(self.main)
            wand=next(p for p in self.main['pois'] if p['type']=='wand' and p.get('source')!='holy_mountain')
            evidence={'id':'BLACK_HOLE','source':'wand','x':wand['x'],'y':wand['y'],'worldOffset':0}
            w.display_layer_info((123,0,'main',{'ids':['BLACK_HOLE'],'items':[wand],'evidence':[evidence],'bounds':[0,1536],'worldRange':[0,0]}))
            w.info_tabs.setCurrentIndex(w.info_tabs.count()-1);self.app.processEvents()
            item=w.layer_items.item(0);position=w.layer_items.visualItemRect(item).center()
            with patch.object(w,'open_layer_object') as detail,patch.object(w.map_page,'request_map') as load:
                QTest.mouseClick(w.layer_items.viewport(),Qt.LeftButton,pos=position)
                QTest.mouseDClick(w.layer_items.viewport(),Qt.LeftButton,pos=position)
                QTest.qWait(QApplication.doubleClickInterval()+100);self.app.processEvents()
                self.assertEqual(w.nav.currentRow(),2);load.assert_not_called()
                detail.assert_not_called()
            center=w.map_page.canvas.mapToScene(w.map_page.canvas.viewport().rect().center())
            self.assertAlmostEqual(center.x(),wand['x'],delta=4);self.assertAlmostEqual(center.y(),wand['y'],delta=4)
        finally:w.close()

    def test_heaven_hell_shops_prices_and_deep_section_coverage(self):
        fixed=[p for p in self.main['pois'] if p['type']=='spell' and p['source'] in ('the_sky','the_end') and p.get('paid')]
        self.assertEqual({p['source'] for p in fixed},{'the_sky','the_end'})
        self.assertTrue(all(p['price']>0 for p in fixed))
        with Engine() as engine:
            deep=engine.request(op='map',seed=123,verticalIndex=-2)
        self.assertEqual(deep['verticalIndex'],-2);self.assertEqual(deep['height'],24576)
        self.assertEqual(deep['shopCoverage'],'fixed-heaven-hell-only')
        self.assertTrue(all(deep['origin'][1]<=p['y']<deep['origin'][1]+deep['height'] for p in deep['pois']))

    def test_world_sprites_follow_zoom_and_keep_actual_positions(self):
        points=[{'type':'spell','spell':'LIGHT_BULLET','x':10,'y':20,'price':10},{'type':'spell','spell':'LIGHT_BULLET','x':11,'y':20,'price':10},{'type':'spell','spell':'LIGHT_BULLET','x':100,'y':200,'price':10}]
        self.assertLess(sprite_size(.3),sprite_size(1));self.assertLess(sprite_size(1),sprite_size(3))
        groups=anchored_groups(points,lambda p:QPointF(p['x'],p['y']),20)
        self.assertEqual(len(groups),2)
        for pos,items in groups:
            self.assertEqual(pos,QPointF(items[0]['x'],items[0]['y']))
            marker=WorldSprite(items,20,lambda _:None);marker.setPos(items[0]['x'],items[0]['y'])
            self.assertEqual(marker.pos(),pos)
        self.assertEqual(group_price([{'type':'spell','price':10},{'type':'spell','price':100}]),'10–100 金')

    def test_every_wand_and_shop_spell_opens_details(self):
        wand=WandCard(self.info['shop'][0]['items'][0]);buttons=wand.findChildren(QToolButton)
        with patch('noitatool.detail_ui.show_spell') as show:
            buttons[1].click();self.assertEqual(show.call_args.args[0],'SLIMEBALL')
        shop=ShopCard(self.info['shop'][2]);buttons=shop.findChildren(QToolButton)
        self.assertEqual(len(buttons),10)
        with patch('noitatool.detail_ui.show_spell') as show:
            buttons[0].click();self.assertEqual(show.call_args.args[0],'RECHARGE');self.assertEqual(show.call_args.args[2],340)
        card=SpellCard('LIGHT_BULLET',price=75)
        self.assertIn('75 金币',' '.join(label.text() for label in card.findChildren(QLabel)))

    def test_map_click_selects_cluster_and_world_change_requests_new_map(self):
        w=Window();w.save_settings=lambda:None;w.show_error=lambda message:self.fail(message);w.resize(1360,900);w.show();w.nav.setCurrentRow(2)
        page=w.map_page;page.display_map(self.main)
        try:
            for _ in range(8):self.app.processEvents();time.sleep(.01)
            self.assertFalse(any(p['type']=='wand' for m in page.markers for p in m.items))
            page.canvas.resetTransform();page.canvas.scale(1,1);page.canvas.centerOn(-280,1395);page.schedule_markers()
            for _ in range(8):self.app.processEvents();time.sleep(.01)
            marker=next(m for m in page.markers if page.canvas.viewport().rect().contains(page.canvas.mapFromScene(m.pos())))
            with patch('noitatool.detail_ui.show_window',return_value=None) as popup:
                QTest.mouseClick(page.canvas.viewport(),Qt.LeftButton,pos=page.canvas.mapFromScene(marker.pos()))
                self.assertTrue(popup.called)
            self.assertGreater(len(page.group),0)
            # Use real UI signal/debounce/async job handling with a verified PW payload.
            with patch.object(Engine,'request',return_value=self.parallel):
                page.world.setValue(1)
                deadline=time.monotonic()+10
                while (page.data is None or w.jobs) and time.monotonic()<deadline:self.app.processEvents();time.sleep(.01)
            self.assertEqual(page.data['worldOffset'],1);self.assertEqual(page.group,[])
            page.icon_size.setValue(64);page.canvas.resetTransform();page.canvas.scale(1,1);page.canvas.centerOn(35840-280,1395);page.schedule_markers()
            for _ in range(6):self.app.processEvents();time.sleep(.01)
            self.assertTrue(page.markers)
        finally:w.close()


if __name__=='__main__':unittest.main()
