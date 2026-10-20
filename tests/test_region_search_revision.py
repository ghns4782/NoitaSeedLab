import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json,unittest,tempfile
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch
from PySide6.QtCore import Qt,QPointF
from PySide6.QtWidgets import QApplication,QCheckBox
from PySide6.QtTest import QTest
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.areas import PRESETS,MAIN_BIOMES,main_range
from noitatool.rules_ui import RuleDialog
from noitatool.range_ui import RangeMapDialog
from noitatool.search import validate_rule
from noitatool.advanced_ui import AdvancedSearchDialog,EXAMPLES
from noitatool.saved_searches import SearchLibrary
from noitatool.detail_ui import show_spell,show_perk,show_wand,InspectButton,_windows

class RegionRevisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app);cls.engine=Engine();cls.map=cls.engine.request(op='map',seed=1234);cls.info=cls.engine.info(123)
    @classmethod
    def tearDownClass(cls):cls.engine.close()
    def tearDown(self):
        for dialog in list(_windows):dialog.close()
        self.app.processEvents()

    def test_actual_potion_only_and_mixed_search(self):
        point=next(p for p in self.map['pois'] if p['type']=='potion' and p.get('material') and p.get('item')!='pouch' and 0<p['y']<17000)
        x,y=point['x'],point['y'];area={'kind':'rect','bounds':[x-1,y-1,x+1,y+1]}
        rule={'type':'layerSpells','val':{'ranges':[area],'ids':[],'materials':[point['material']],'mode':'all'}}
        validate_rule(rule);self.assertEqual(self.engine.search(1234,1235,rule),[1234])
        missing=deepcopy(rule);missing['val']['materials']=['NO_SUCH_MATERIAL'];self.assertEqual(self.engine.search(1234,1235,missing),[])
        mixed=deepcopy(rule);mixed['val']['ids']=['NO_SUCH_SPELL'];self.assertEqual(self.engine.search(1234,1235,mixed),[])
        mixed['val']['mode']='any';self.assertEqual(self.engine.search(1234,1235,mixed),[1234])
        d=RuleDialog(rule=rule);self.assertEqual(d.widgets['materials'].values(),[point['material']]);self.assertEqual(d.simple_rule(),rule);d.close()

    def test_geographic_regions_and_main_excludes_sides(self):
        sand=[a for a in PRESETS if a['biomes']==['sandcave']];self.assertGreaterEqual(len(sand),2)
        for i,a in enumerate(sand):
            for b in sand[i+1:]:self.assertFalse(set(map(tuple,a['cells']))&set(map(tuple,b['cells'])))
        for key in ('meat','winter_caves','the_sky','the_end','scale'):self.assertTrue(any(a['biomes']==[key] for a in PRESETS),key)
        self.assertNotIn('fungicave',MAIN_BIOMES[1]);self.assertNotIn('wandcave',MAIN_BIOMES[2]);self.assertNotIn('dragoncave',MAIN_BIOMES[4])
        w=Window();w.map_page.display_map(self.map);d=RuleDialog(w,{'type':'layerSpells','val':{'ranges':[main_range(0)],'ids':['BLACK_HOLE'],'mode':'all'}});picker=RangeMapDialog(d.widgets['ranges'])
        try:
            region=next(a for a in self.map['regions'] if a['biomes']==['winter'] and a['bounds'][0]<-10000 and min(y for x,y in a['cells'])>=14 and a['bounds'][3]<2000)
            cx,cy=region['cells'][0];picker.pick(QPointF(cx*512-17920+256,cy*512-7168+256))
            selected=[a for a in d.widgets['ranges'].values() if a.get('biomes')==['winter']]
            self.assertEqual(len(selected),1);self.assertIn('地下遗迹',selected[0]['label']);self.assertGreaterEqual(selected[0]['bounds'][1],-64)
        finally:picker.close();d.close();w.close()

    def test_named_vertical_regions_use_their_own_biome_coordinates(self):
        for key,plane in [('the_sky',-1),('the_end',1)]:
            area=next(a for a in PRESETS if a['biomes']==[key] and a['verticalIndex']==plane)
            expected={p['spell'] for p in self.map['pois'] if p['type']=='spell' and p.get('verticalIndex')==plane and p.get('source')==key}
            actual=self.engine.request(op='area',seed=1234,area=area)
            self.assertTrue(expected);self.assertTrue(expected<=set(actual['ids']),(key,expected-set(actual['ids'])))

    def test_temporary_ranges_are_not_persisted(self):
        temp={'kind':'rect','label':'临时','bounds':[0,0,10,10]}
        rule={'type':'layerSpells','val':{'ranges':[main_range(0),temp],'ids':['BLACK_HOLE'],'mode':'all'}}
        Path('artifacts').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir='artifacts') as folder:
            library=SearchLibrary(folder);path=library.save('named',rule);saved=json.loads(path.read_text(encoding='utf-8'))['rule'];self.assertEqual(saved['val']['ranges'],[main_range(0)])
            rule['val']['ranges']=[temp]
            with self.assertRaises(ValueError):library.save('temp',rule)

    def test_advanced_examples_and_invalid_input(self):
        normal=RuleDialog();self.assertEqual(normal.kind.findData('wand'),-1);self.assertEqual(normal.kind.findData('pacifistChest'),-1);self.assertEqual(normal.tabs.count(),1);normal.close()
        for _,example in EXAMPLES:
            d=AdvancedSearchDialog(rule=example);self.assertTrue(d.save.isEnabled(),d.error.text());d.add_example();self.assertTrue(d.save.isEnabled());d.text.setPlainText('{broken');self.assertFalse(d.save.isEnabled());d.submit();self.assertEqual(d.result(),0);d.close()
        wrong=deepcopy(EXAMPLES[0][1]);wrong['val']['gun']['mana_max']=[1000,10]
        d=AdvancedSearchDialog(rule=wrong);self.assertFalse(d.save.isEnabled());d.close()
        d=AdvancedSearchDialog();d.text.setPlainText('{}');d.add_example();self.assertTrue(d.save.isEnabled());d.close()

    def test_localized_modifiers_and_fungal_editor(self):
        rule={'type':'biomeModifier','val':{'coalmine':['MOIST','HIGH_GRAVITY']}}
        d=RuleDialog(rule=rule);editor=d.widgets['editor'];self.assertEqual(d.simple_rule(),rule);self.assertEqual(editor.list.item(0).text(),'潮湿');d.close()
        shift={'type':'fungalShift','val':[{'from':['water'],'to':'blood','flaskTo':True},None,{'from':['lava'],'to':'water'}]}
        d=RuleDialog(rule=shift);self.assertEqual(d.simple_rule(),shift);self.assertIn('瓶内材料',d.widgets['editor'].flask.toolTip());d.close()
        from noitatool.environment_ui import shift_tooltip
        tip=shift_tooltip(dict(from_=[] ,**{'from':['water'],'to':'blood','flaskTo':True}),'oil');self.assertIn('代替原目标',tip);self.assertIn('全局',tip)

    def test_notice_can_be_suppressed(self):
        rule={'type':'layerSpells','val':{'ranges':[main_range(0)],'ids':['BLACK_HOLE'],'mode':'all'}}
        with patch('noitatool.preferences.read_preferences',return_value={}),patch('noitatool.preferences.set_preference') as save:
            d=RuleDialog(rule=rule);box=next(b for b in d.findChildren(QCheckBox) if b.text()=='以后不再提示');box.setChecked(True);save.assert_called_with('hide_region_notice',True);d.close()
        with patch('noitatool.preferences.read_preferences',return_value={'hide_region_notice':True}):
            d=RuleDialog(rule=rule);self.assertFalse(any(b.text()=='以后不再提示' for b in d.findChildren(QCheckBox)));d.close()

    def test_double_click_always_opens_new_detail_window(self):
        a=show_spell('BLACK_HOLE');b=show_spell('BLACK_HOLE');self.assertIsNot(a,b);self.app.processEvents()
        button=a.findChildren(InspectButton)[0];before=len(_windows);QTest.mouseDClick(button,Qt.LeftButton);self.app.processEvents();self.assertGreater(len(_windows),before)
        perk=show_perk('IRON_STOMACH');self.assertTrue(perk.isVisible())
        wand=next(w for row in self.info['shop'] if row['type']==1 for w in row['items']);c=show_wand(wand);self.app.processEvents();before=len(_windows);QTest.mouseDClick(c.findChildren(InspectButton)[0],Qt.LeftButton);self.app.processEvents();self.assertGreater(len(_windows),before)

if __name__=='__main__':unittest.main()
