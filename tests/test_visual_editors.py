import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.rules_ui import RuleDialog
from noitatool.icon_grid import IconPickerDialog
from noitatool.catalog import options

class VisualEditorsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)

    def test_reopen_multi_perks_keeps_visual_editor_and_all_ids(self):
        rule={'type':'perkSet','val':{'ids':['EDIT_WANDS_EVERYWHERE','MOLD'],'where':3,'mode':'all'}}
        dialog=RuleDialog(rule=rule)
        self.assertEqual(dialog.tabs.currentIndex(),0)
        self.assertEqual(dialog.simple_rule(),rule)
        dialog.widgets['value'].set_values(['EDIT_WANDS_EVERYWHERE','MOLD','EXTRA_PERK'])
        self.assertEqual(len(dialog.simple_rule()['val']['ids']),3);dialog.close()

    def test_palette_search_preserves_hidden_selection(self):
        dialog=IconPickerDialog(options('spells'),['BLACK_HOLE','CHAINSAW'])
        dialog.search.setText('黑洞')
        self.app.processEvents()
        self.assertEqual(set(dialog.values()),{'BLACK_HOLE','CHAINSAW'})
        self.assertGreater(sum(not dialog.grid.item(i).isHidden() for i in range(dialog.grid.count())),0)
        dialog.search.setText('does_not_exist')
        self.assertTrue(all(dialog.grid.item(i).isHidden() for i in range(dialog.grid.count())))
        dialog.close()

    def test_per_target_lottery_round_trip(self):
        rule={'type':'perkSet','val':{'ids':['EDIT_WANDS_EVERYWHERE','IRON_STOMACH'],'where':0,'mode':'all','lottery':['IRON_STOMACH']}}
        d=RuleDialog(rule=rule)
        self.assertEqual(d.simple_rule(),rule)
        field=d.widgets['lottery']
        self.assertEqual(field.count(),2)
        self.assertEqual(field.values(),['IRON_STOMACH'])
        d.widgets['value'].set_values(['IRON_STOMACH','MOLD'])
        self.assertEqual(field.values(),['IRON_STOMACH'])
        d.widgets['value'].set_values(['MOLD'])
        self.assertEqual(field.values(),[])
        self.assertNotIn('lottery',d.simple_rule()['val'])
        d.close()

    def test_overgrown_parallel_world_range_round_trip(self):
        rule={'type':'layerSpells','val':{'ids':['BLACK_HOLE','CHAINSAW'],'layers':[0,2,4],'scope':'overgrown','worldRange':[-2,3],'mode':'all'}}
        d=RuleDialog(rule=rule);self.assertEqual(d.simple_rule(),rule)
        self.assertNotIn('scope',d.widgets)
        self.assertEqual([a['id'] for a in d.widgets['ranges'].values()],['overgrown'])
        d.widgets['layers'][0].setChecked(True)
        self.assertTrue(all(c.isEnabled() for c in d.widgets['layers']))
        self.assertEqual(len(d.simple_rule()['val']['ranges']),2)
        self.assertEqual(d.simple_rule()['val']['worldRange'],[-2,3]);d.close()

    def test_shop_reopen_multi_spell_multi_wand_and_layers(self):
        wand={'gun':{'mana_max':[500,900]},'cards':['BLACK_HOLE','CHAINSAW'],'cardsStrict':True,'permanentCard':None}
        rule={'type':'shop','val':[{'type':2,'strict':True,'items':[{'spell':'BLACK_HOLE'},{'spell':'CHAINSAW'}]},None,{'type':1,'items':[{'wand':wand},{'wand':{'gun':{},'cards':[],'cardsStrict':False}}],'wandMode':'all'}]}
        d=RuleDialog(rule=rule);self.assertEqual(d.tabs.currentIndex(),0)
        editor=d.widgets['editor'];editor.levels.setCurrentRow(2)
        self.assertEqual(len(editor.wand_values),2)
        editor.levels.setCurrentRow(0)
        self.assertEqual(editor.spells.values(),['BLACK_HOLE','CHAINSAW'])
        saved=d.simple_rule()['val'];self.assertEqual(saved[0]['items'],rule['val'][0]['items']);self.assertEqual(saved[2]['items'],rule['val'][2]['items']);d.close()

    def test_overview_is_default_and_list_mode(self):
        w=Window();self.assertEqual(w.info_tabs.currentIndex(),0);self.assertEqual(w.overview.table.rowCount(),7)
        self.assertEqual(w.limit.value(),0)
        w.source_mode.setCurrentIndex(1);self.assertFalse(w.range_start.isEnabled());self.assertTrue(w.list_button.isEnabled());w.close()

if __name__=='__main__':unittest.main()
