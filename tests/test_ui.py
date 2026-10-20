import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import time
import unittest
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.rules_ui import RuleDialog
from noitatool.engine import Engine
from noitatool.gpu import devices

class UITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([])
        configure_app(cls.app)

    def setUp(self):
        self.window=Window()
        # Searches in UI tests must not overwrite the user's saved budgets.
        self.window.save_settings=lambda:None
        self.window.record_search_profile=False
        self.window.show_error=lambda message:self.fail(message)
        self.window.show()

    def tearDown(self):
        self.window.close()

    def wait(self,seconds=30):
        deadline=time.monotonic()+seconds
        while self.window.jobs and time.monotonic()<deadline:
            self.app.processEvents()
            time.sleep(.01)
        self.assertFalse(self.window.jobs,'GUI task timed out')

    def test_rule_round_trip_and_shop_editor(self):
        rule={'type':'or','rules':[{'type':'startingFlask','val':'water'},{'type':'not','rules':[{'type':'startingSpell','val':'SPITTER'}]}]}
        self.window.set_rule(rule)
        self.assertEqual(self.window.get_rule(),rule)
        dialog=RuleDialog(self.window)
        dialog.kind.setCurrentIndex(dialog.kind.findData('shop'))
        from noitatool.wand_ui import WandFilterDialog
        editor=dialog.widgets['editor']
        editor.type.setCurrentIndex(editor.type.findData(1))
        wand=WandFilterDialog(dialog)
        wand.ranges['mana_charge_speed'][0][0].setValue(100)
        editor.wand_values=[wand.value()]
        self.assertEqual(dialog.simple_rule()['val'][0]['items'][0]['wand']['gun']['mana_charge_speed'],[100,10000])
        wand.close();dialog.close()

    def test_multiple_layer_editor_and_old_condition(self):
        dialog=RuleDialog(self.window)
        old={'type':'layerSpells','val':{'layer':2,'scope':'main','mode':'all','ids':['BLACK_HOLE']}}
        dialog.load_rule(old)
        self.assertEqual(dialog.simple_rule()['val']['layers'],[2])
        for i,check in enumerate(dialog.widgets['layers']):check.setChecked(i in (0,2,4))
        rule=dialog.simple_rule()
        self.assertEqual([a['layer'] for a in rule['val']['ranges']],[0,2,4])
        dialog.load_rule(rule)
        self.assertEqual(dialog.simple_rule(),rule)
        from noitatool.rules_ui import describe
        self.assertIn('地下丛林',describe(rule))
        dialog.close()

    def test_default_search_range_is_full(self):
        from noitatool.engine import MAX_SEED
        self.assertEqual(self.window.range_start.text(),'1')
        self.assertEqual(self.window.range_end.text(),str(MAX_SEED))

    def test_daily_seed_opens_automatically_and_keeps_manual_input(self):
        from unittest.mock import Mock,patch
        w=self.window;tasks=[]
        w.start_job=lambda work,callback,finished=None:tasks.append((work,callback,finished))
        w.load_info=Mock()
        w.nav.setCurrentRow(0)
        self.assertEqual(len(tasks),1)
        work,callback,finished=tasks.pop()
        with patch('noitatool.daily_seed.current_daily_seed',return_value=(196176580,'2026-10-19')):
            callback(work());finished()
        self.assertEqual(w.seed.text(),'196176580');w.load_info.assert_called_once()
        self.assertIn('每日挑战',w.daily_status.text())
        w.load_info.reset_mock();w.load_daily_seed(force=True)
        work,callback,finished=tasks.pop()
        w.seed.setText('123')
        callback(((196176580,'2026-10-19'),None));finished()
        self.assertEqual(w.seed.text(),'123');w.load_info.assert_not_called()

    def test_info_job_and_icons(self):
        self.window.seed.setText('123')
        self.window.load_info()
        self.wait()
        self.assertEqual(self.window.current_info['info']['startingFlask'],'snow')
        self.assertIn('<img',self.window.info_views[1].toHtml())

    def test_cpu_search_job(self):
        w=self.window
        w.worker_cap.setValue(2)
        w.range_start.setText('1');w.range_end.setText('512');w.limit.setValue(1000)
        rule=w.get_rule()
        w.run_search()
        self.wait()
        with Engine() as engine:expected=engine.search(1,513,rule)
        self.assertEqual(w.results,expected)
        self.assertEqual(w.result_list.count(),len(expected))
        self.assertTrue(w.run_button.isEnabled())

    @unittest.skipUnless(devices(),'No OpenCL GPU')
    def test_gpu_search_job(self):
        w=self.window
        w.worker_cap.setValue(2)
        w.range_end.setText('512');w.limit.setValue(1000);w.backend.setCurrentIndex(1)
        rule=w.get_rule()
        w.run_search()
        self.wait()
        with Engine() as engine:expected=engine.search(1,513,rule)
        self.assertEqual(w.results,expected)

    def test_stop_job(self):
        w=self.window
        w.worker_cap.setValue(2)
        w.range_end.setText('10000000');w.limit.setValue(100000)
        w.run_search()
        w.stop_search()
        self.wait()
        self.assertTrue(w.run_button.isEnabled())

    def test_list_layer_search_job_with_gpu_preference(self):
        w=self.window;w.worker_cap.setValue(1)
        w.source_mode.setCurrentIndex(1);w.input_seeds=[123,84]
        w.range_start.setText('invalid ignored range')
        w.backend.setCurrentIndex(1);w.limit.setValue(0)
        w.set_rule({'type':'layerSpells','val':{'layer':0,'scope':'main','mode':'all','ids':['BLACK_HOLE','CHAINSAW']}})
        w.run_search();self.wait()
        self.assertEqual(w.results,[123])
        self.assertEqual(w.result_list.count(),1)

    def test_layer_inspection_job(self):
        w=self.window;w.seed.setText('123');w.load_info();self.wait()
        w.load_layer_info();self.wait()
        self.assertGreater(w.layer_icons.count(),0)
        self.assertTrue(any('BLACK_HOLE' in w.layer_icons.item(i).toolTip() for i in range(w.layer_icons.count())))
        self.assertGreater(w.layer_items.count(),0)

    def test_overgrown_inventory_follows_current_world_and_wand_details(self):
        from unittest.mock import patch
        from PySide6.QtCore import Qt
        w=self.window;w.seed.setText('123');w.load_info();self.wait()
        self.assertFalse(hasattr(w,'inspect_world_from'));self.assertFalse(hasattr(w,'inspect_world_to'))
        w.world.setValue(1);self.wait()
        w.inspect_layer.setCurrentIndex(w.inspect_layer.findData('overgrown'))
        self.assertFalse(w.inspect_scope.isEnabled())
        w.load_layer_info();self.wait()
        items=[w.layer_items.item(i) for i in range(w.layer_items.count())]
        self.assertEqual({i.data(Qt.UserRole)['worldOffset'] for i in items},{1})
        wand=next(i for i in items if i.data(Qt.UserRole)['type']=='wand')
        with patch('noitatool.detail_ui.show_wand') as show:
            w.open_layer_item(wand);self.assertIn('cards',show.call_args.args[0])
        w.world.setValue(2)
        self.assertEqual(w.layer_items.count(),0)

if __name__=='__main__':unittest.main()
