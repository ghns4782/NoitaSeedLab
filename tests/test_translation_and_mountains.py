import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtCore import QPointF
from PySide6.QtWidgets import QApplication,QDialogButtonBox,QLineEdit,QLabel,QWidget,QVBoxLayout
from noitatool.app import configure_app
from noitatool import localization as loc
from noitatool.catalog import name,tr
from noitatool.map_ui import poi_title
from noitatool.range_ui import RangeSelector,RangeMapDialog
from noitatool.engine import Engine

class TranslationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir='artifacts');self.folder=Path(self.temp.name)
        self.old=loc._overrides,loc._loaded;loc._overrides={};loc._loaded=True
        self.path_patch=patch('noitatool.localization.user_path',return_value=self.folder/'user.json');self.path_patch.start()
    def tearDown(self):
        loc._overrides,loc._loaded=self.old;self.path_patch.stop();self.temp.cleanup()
    def test_table_roundtrip_and_aliases(self):
        self.assertFalse([k for k,v in loc.base_entries().items() if v['english'] and not v['chinese']])
        self.assertEqual(tr('$item_brimstone'),'火石');self.assertEqual(name('METEOR_RAIN'),'陨石雨')
        for extension in ('json','csv'):
            path=self.folder/f'base.{extension}';count=loc.export_table(path)
            self.assertGreater(count,5000);entries=loc.parse_table(path)
            self.assertEqual(entries['kiuaskivi'],'火石');self.assertEqual(entries['Close'],'关闭')
        p=self.folder/'external.json';p.write_text(json.dumps({'kiuaskivi':'自定义火石','LIGHT_BULLET':'自定义火花弹','description:kiuaskivi':'自定义说明','biome:coalmine':'自定义矿坑'}),encoding='utf-8')
        self.assertEqual(loc.import_table(p),4)
        self.assertEqual(poi_title({'type':'pickup','item':'kiuaskivi','label':'kiuaskivi'}),'自定义火石')
        self.assertEqual(name('LIGHT_BULLET'),'自定义火花弹')
        from noitatool.biome_names import biome_name
        from noitatool.item_info import item_description
        self.assertEqual(biome_name('coalmine'),'自定义矿坑');self.assertEqual(item_description('kiuaskivi'),'自定义说明')
        loc._loaded=False;loc._overrides={};self.assertEqual(name('kiuaskivi'),'自定义火石')
        loc.reset_table();self.assertEqual(name('kiuaskivi'),'火石');self.assertEqual(tr('Spread stick'),'散射短杖')
    def test_invalid_pack_never_replaces_active_translations(self):
        valid=self.folder/'valid.json';valid.write_text('{"Close":"收起"}',encoding='utf-8');loc.import_table(valid)
        for raw in ('{broken','{"Close":42}','[{"key":"Close","chinese":"甲"},{"key":"Close","chinese":"乙"}]','{"entries":{}}'):
            path=self.folder/'bad.json';path.write_text(raw,encoding='utf-8')
            with self.assertRaises(ValueError):loc.import_table(path)
            self.assertEqual(loc.text('Close'),'收起');self.assertEqual(json.loads(loc.user_path().read_text(encoding='utf-8')),{'Close':'收起'})
    def test_ui_refresh_translates_labels_and_leaves_editor_ids_intact(self):
        w=QWidget();layout=QVBoxLayout(w);label=QLabel('Burst stick');editor=QLineEdit('LIGHT_BULLET');box=QDialogButtonBox(QDialogButtonBox.Close)
        layout.addWidget(label);layout.addWidget(editor);layout.addWidget(box);w.show();self.app.processEvents()
        self.assertEqual(label.text(),'爆发短杖');self.assertEqual(box.buttons()[0].text(),'关闭')
        p=self.folder/'pack.json';p.write_text('{"Close":"收起","Burst stick":"爆发木杖"}',encoding='utf-8');loc.import_table(p);loc.refresh_ui()
        self.assertEqual(box.buttons()[0].text(),'收起');self.assertEqual(label.text(),'爆发木杖');self.assertEqual(editor.text(),'LIGHT_BULLET')
        loc.reset_table();loc.refresh_ui();self.assertEqual(label.text(),'爆发短杖');self.assertEqual(box.buttons()[0].text(),'关闭');w.close()

class MountainAreaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        cls.engine=Engine();cls.data=cls.engine.request(op='map',seed=1234)
    @classmethod
    def tearDownClass(cls):cls.engine.close()
    def test_reservoir_and_altar_are_one_connected_area(self):
        temples=[a for a in self.data['regions'] if any(k.startswith('temple_') for k in a['biomes'])]
        self.assertEqual(len(temples),7)
        first=min(temples,key=lambda a:a['bounds'][1]);self.assertIn('temple_wall',first['biomes']);self.assertIn('temple_altar',first['biomes'])
        # Both far-side reservoir cells belong to the same area as the shop.
        cells=first['cells'];self.assertLess(min(x for x,y in cells),34);self.assertGreater(max(x for x,y in cells),36)
        result=self.engine.request(op='area',seed=1234,area=first)
        self.assertTrue(any(p.get('source')=='holy_mountain' for p in result['items']))
    def test_clicks_on_reservoir_and_altar_toggle_the_same_existing_range(self):
        selector=RangeSelector();selector.clear_selection();picker=RangeMapDialog(selector);picker.display(self.data)
        temple=min((a for a in self.data['regions'] if 'temple_altar' in a['biomes']),key=lambda a:a['bounds'][1])
        before=len(selector.entries);x,y=min(temple['cells']);picker.pick(QPointF(x*512-17920+256,y*512-7168+256))
        self.assertEqual(selector.values()[0]['kind'],'layer');self.assertEqual(selector.values()[0]['layer'],0)
        altar=next((x,y) for x,y in temple['cells'] if x==34)
        picker.pick(QPointF(altar[0]*512-17920+256,altar[1]*512-7168+256))
        self.assertEqual(selector.values(),[]);self.assertEqual(len(selector.entries),before);picker.close();selector.close()

if __name__=='__main__':unittest.main()
