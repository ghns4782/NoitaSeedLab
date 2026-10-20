import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
from copy import deepcopy
from unittest.mock import patch
from PySide6.QtCore import Qt,QRectF,QPointF
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.session import ViewSession
from noitatool.areas import preset,main_range
from noitatool.range_ui import RangeSelector,RangeMapDialog,range_key
from noitatool.rules_ui import RuleDialog
from noitatool.search import validate_rule


class RangeSessionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        cls.engine=Engine();cls.map=cls.engine.request(op='map',seed=123)
    @classmethod
    def tearDownClass(cls):cls.engine.close()

    def test_session_reuses_engine_copies_results_and_invalidates_context(self):
        with patch('noitatool.session.Engine') as factory:
            factory.return_value.request.return_value={'items':[1]}
            session=ViewSession();req={'op':'map','seed':123,'worldOffset':0}
            first=session.request(**req);first['items'].append(2)
            self.assertEqual(session.request(**req),{'items':[1]});self.assertEqual(factory.return_value.request.call_count,1)
            session.request(**dict(req,worldOffset=1));session.request(**req)
            self.assertEqual(factory.return_value.request.call_count,3);self.assertEqual(factory.call_count,1)
            session.close();factory.return_value.close.assert_called_once()

    def test_cached_map_area_and_other_category(self):
        e=self.engine;area=preset('lukki');result=e.request(op='area',seed=123,area=area)
        self.assertTrue(result['fromMapCache'])
        from noitatool.resources_ui import ResourceBrowser
        browser=ResourceBrowser();browser.set_resources(result['items'],result['evidence'],result['ids'])
        self.assertEqual(set(browser.lists),{'wand','spell','potion','other'})
        self.assertGreater(browser.others.count(),0)
        for i in range(browser.others.count()):self.assertIn(browser.others.item(i).data(Qt.UserRole)['type'],('pickup','chest'))
        first=self.map['pois'];again=e.request(op='map',seed=123)
        self.assertEqual(len(again['pois']),len(first))
        browser.close()

    def test_cached_and_fresh_region_spell_results_agree(self):
        with Engine() as fresh:
            for request in ({'op':'area','area':preset('lukki')},{'op':'layer','layer':0},{'op':'layer','layer':2}):
                cached=self.engine.request(seed=123,**request);uncached=fresh.request(seed=123,**request)
                self.assertEqual(set(cached['ids']),set(uncached['ids']),request)

    def test_union_of_main_side_and_multiple_rectangles(self):
        e=self.engine;a={'kind':'rect','label':'A','bounds':[-1100,600,-900,720]}
        first=e.request(op='area',seed=123,area=a)
        point=next(p for p in self.map['pois'] if p['type']=='wand' and p.get('source')!='holy_mountain' and 0<p['y']<17000 and set(p.get('cards',[]))-set(first['ids']))
        b={'kind':'rect','label':'B','bounds':[point['x']-2,point['y']-2,point['x']+2,point['y']+2]}
        second=e.request(op='area',seed=123,area=b);key=next(iter(set(second['ids'])-set(first['ids'])))
        rule={'type':'layerSpells','val':{'ranges':[a,b],'ids':['BLACK_HOLE',key],'mode':'all'}}
        validate_rule(rule);self.assertEqual(e.search(123,124,rule),[123])
        for area in (a,b):
            one=deepcopy(rule);one['val']['ranges']=[area]
            self.assertEqual(e.search(123,124,one),[])
        broad=deepcopy(rule);broad['val']['ranges']=[main_range(0),preset('overgrown'),a,b]
        self.assertEqual(e.search(123,124,broad),[123])
        dialog=RuleDialog(rule=broad);self.assertNotIn('scope',dialog.widgets)
        self.assertEqual({range_key(a) for a in dialog.simple_rule()['val']['ranges']},{range_key(a) for a in broad['val']['ranges']})
        dialog.close()

    def test_map_picker_toggles_checks_and_keeps_multiple_custom_boxes(self):
        w=Window();w.resize(1360,900);w.map_page.display_map(self.map)
        rule=RuleDialog(w,{'type':'layerSpells','val':{'ranges':[main_range(0)],'ids':['BLACK_HOLE'],'mode':'all'}})
        selector=rule.widgets['ranges'];dialog=RangeMapDialog(selector)
        try:
            dialog.show();self.app.processEvents()
            dialog.rectangle(QRectF(-1100,600,200,120));dialog.rectangle(QRectF(1000,3000,100,200))
            boxes=[(a,c) for a,c in zip(selector.entries,selector.checks) if a['kind']=='rect']
            self.assertEqual(len(boxes),2);self.assertEqual(len(w.custom_ranges),2)
            self.assertTrue(all(c.isChecked() and 'X:' in c.toolTip() and 'Y:' in c.toolTip() for _,c in boxes))
            before=len(dialog.highlights);boxes[0][1].setChecked(False);self.assertEqual(len(dialog.highlights),before-1)
            region=next(a for a in self.map['regions'] if a['biomes']==['rainforest_dark'] and a['verticalIndex']==0)
            x,y=region['cells'][len(region['cells'])//2];dialog.pick(QPointF(x*512-17920+256,y*512-7168+256))
            self.assertTrue(any(a.get('id')=='lukki' for a in selector.values()))
            dialog.pick(QPointF(x*512-17920+256,y*512-7168+256));self.assertFalse(any(a.get('id')=='lukki' for a in selector.values()))
            dialog.range_list.item(0).setCheckState(Qt.Unchecked);self.assertFalse(selector.checks[0].isChecked())
        finally:dialog.close();rule.close();w.close()

    def test_invalid_new_ranges_are_rejected(self):
        for ranges in ([],[{'kind':'layer','layer':True}],[{'kind':'rect','bounds':[0,0,0,1]}],None):
            with self.subTest(ranges=ranges),self.assertRaises(ValueError):validate_rule({'type':'layerSpells','val':{'ranges':ranges,'ids':['BLACK_HOLE'],'mode':'all'}})

if __name__=='__main__':unittest.main()
