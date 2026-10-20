import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication,QListWidgetItem
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.range_ui import RangeSelector,RangeMapDialog
from noitatool.advanced_ui import AdvancedSearchDialog,EXAMPLES,validate_advanced
from noitatool.resources_ui import ResourceBrowser
from noitatool.search import validate_rule
from noitatool.gpu import prefilter
from noitatool.persistence import persistent_rule
from noitatool.catalog import name

class DesktopRevisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
        cls.engine=Engine();cls.progress=[]
        cls.map=cls.engine.request(op='map',seed=1234,on_progress=cls.progress.append)
    @classmethod
    def tearDownClass(cls):cls.engine.close()

    def test_clear_all_in_both_views_keeps_custom_ranges(self):
        selector=RangeSelector();selector.add_range({'kind':'rect','label':'临时范围','bounds':[0,0,20,20]})
        for check in selector.checks:check.setChecked(True)
        dialog=RangeMapDialog(selector)
        self.assertTrue(dialog.data['bundledReference'])
        count=len(selector.entries);changes=[];selector.changed.connect(lambda:changes.append(1))
        dialog.clear_button.click()
        self.assertEqual(selector.values(),[]);self.assertEqual(len(changes),1)
        self.assertEqual(dialog.range_list.count(),count);self.assertEqual(dialog.highlights,[])
        self.assertTrue(all(dialog.range_list.item(i).checkState()==Qt.Unchecked for i in range(count)))
        selector.checks[-1].setChecked(True);selector.clear_button.click()
        self.assertEqual(selector.values(),[]);self.assertEqual(len(selector.entries),count)
        dialog.close();selector.close()

    def test_double_click_only_locates_in_seed_info(self):
        browser=ResourceBrowser(details_on_double_click=False);details=[];locations=[]
        browser.detailRequested.connect(details.append);browser.locationRequested.connect(locations.append)
        point={'type':'pickup','item':'heart','x':1,'y':2};item=QListWidgetItem();item.setData(Qt.UserRole,point)
        browser.schedule('other',item);browser.locate('other',item)
        self.assertFalse(browser.click_timer.isActive());self.assertEqual(details,[]);self.assertEqual(locations,[point]);browser.close()

    def test_examples_cover_all_types_and_allow_blank(self):
        expected={'alchemy','perk','perkSet','layerSpells','fungalShift','startingFlask','startingSpell','startingBombSpell','weather','biomeModifier','shop','pacifistChest','wand','waterCave','and','or','not'}
        self.assertTrue(expected<={r['type'] for _,r in EXAMPLES})
        for _,r in EXAMPLES:validate_advanced(r)
        dialog=AdvancedSearchDialog()
        for text in ('','  ','{}'):
            dialog.text.setPlainText(text);dialog.add_example();self.assertTrue(dialog.save.isEnabled())
        dialog.text.setPlainText('{bad');dialog.add_example();self.assertEqual(dialog.text.toPlainText(),'{bad');self.assertFalse(dialog.save.isEnabled());dialog.close()

    def test_advanced_is_addable_condition_with_full_execution(self):
        child={'type':'startingFlask','val':'water'};advanced={'type':'advanced','val':child}
        validate_rule(advanced);self.assertEqual(prefilter(advanced),prefilter(child));self.assertEqual(persistent_rule(advanced),advanced)
        self.assertEqual(self.engine.search(1,30,advanced),self.engine.search(1,30,child))
        window=Window();window.save_settings=lambda:None
        with patch('noitatool.advanced_ui.AdvancedSearchDialog') as factory:
            factory.return_value.exec.return_value=1;factory.return_value.result_rule=child
            window.add_advanced_rule()
        self.assertEqual(window.get_rule()['rules'][-1],advanced)
        for plane in (-1,1):
            page=window.map_page;page.vertical.blockSignals(True);page.vertical.setValue(plane);page.vertical.blockSignals(False)
            page.region.setCurrentIndex(0);page.region_changed();self.assertEqual(page.vertical.value(),0)
        self.assertTrue(window.map_page.terrain_layer.path.is_file());window.close()

    def test_map_progress_and_tablets(self):
        values=[p['value'] for p in self.progress]
        self.assertEqual(values,sorted(values));self.assertEqual(values[0],0);self.assertEqual(values[-1],100)
        self.assertTrue(any(p.get('item')=='emerald_tablet' for p in self.map['pois']))
        self.assertTrue(self.engine.info(123)['shop'])  # Progress packets leave the protocol synchronized.

    def test_material_names_external_links_and_pickup_translation(self):
        from noitatool.icon_grid import IconPickerDialog,SelectionField
        from noitatool.detail_ui import wiki_button
        from noitatool.item_info import ITEMS,material_effect
        dialog=IconPickerDialog(['water','blood']);field=SelectionField(['water'],['water'])
        self.assertEqual(dialog.grid.item(0).text(),name('water'));self.assertEqual(field.grid.item(0).text(),name('water'))
        with patch('noitatool.item_info.QDesktopServices.openUrl',return_value=True) as launch:
            button=wiki_button('LIGHT_BULLET');button.click()
            self.assertIn('noita.wiki.gg',launch.call_args.args[0].toString())
        self.assertIn('灭火',material_effect('water'))
        self.assertTrue(all(p.stem in ITEMS for p in Path('vendor/noita-telescope-main/data/item_sprites').glob('*.png')))
        dialog.close();field.close()

    def test_chest_potions_and_tablets_have_effect_and_wiki_details(self):
        from noitatool.detail_ui import ChestCard,show_pickup,_windows
        from PySide6.QtWidgets import QToolButton,QPushButton,QLabel
        card=ChestCard([{'entity':'data/entities/items/pickup/potion.xml','material':'water'}])
        with patch('noitatool.detail_ui.show_pickup') as show:
            card.findChild(QToolButton).click();show.assert_called_once()
        for entity,material in [('potion','water'),('emerald_tablet',None)]:
            dialog=show_pickup(entity,material)
            self.assertTrue(any('Wiki' in b.text() for b in dialog.findChildren(QPushButton)))
            self.assertTrue(any('灭火' in label.text() for label in dialog.findChildren(QLabel)) if material else any('炼金术' in label.text() for label in dialog.findChildren(QLabel)))
            dialog.close()
        self.app.processEvents();card.close()

    def test_unrestricted_shop_matches_spell_or_wand_shop(self):
        from noitatool.shop_ui import ShopEditor
        editor=ShopEditor();editor.spells.set_values(['LIGHT_BULLET']);self.assertEqual(editor.values()[0]['type'],0)
        editor.switch(1);editor.switch(0);self.assertEqual(editor.spells.values(),['LIGHT_BULLET']);editor.close()
        found=set()
        for seed in range(1,8):
            shop=self.engine.info(seed)['shop'][0]
            keys=[c for w in shop['items'] for c in w['cards']['cards']] if shop['type']==1 else [i['spell']['id'] for i in shop['items']]
            if not keys:continue
            rule={'type':'shop','val':[{'type':0,'items':[{'spell':keys[0]}],'strict':True}]}
            validate_rule(rule);self.assertEqual(self.engine.search(seed,seed+1,rule),[seed]);found.add(shop['type'])
            rule['val'][0]['items'].append({'spell':'DOES_NOT_EXIST'});self.assertEqual(self.engine.search(seed,seed+1,rule),[])
            rule['val'][0]['strict']=False;self.assertEqual(self.engine.search(seed,seed+1,rule),[seed])
        self.assertEqual(found,{1,2})

if __name__=='__main__':unittest.main()
