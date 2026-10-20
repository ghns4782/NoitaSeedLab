import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import unittest
from PySide6.QtWidgets import QApplication,QToolButton
from noitatool.engine import Engine
from noitatool.flow_search import FlowRunner,DiskSeeds,stages_for
from noitatool.search import SearchConfig
from noitatool.app import Window,configure_app
from noitatool.detail_ui import WandCard,chest_entries


class FlowDetailsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)

    def test_flow_preserves_nested_boolean_logic_and_disk_results(self):
        rule={'type':'and','rules':[{'type':'startingFlask','val':'snow'},{'type':'and','rules':[{'type':'or','rules':[{'type':'startingSpell','val':'LIGHT_BULLET'},{'type':'startingSpell','val':'SPITTER'}]},{'type':'not','rules':[{'type':'startingBombSpell','val':'BOMB'}]}]}]}
        self.assertEqual([r['type'] for r in stages_for(rule)],['startingFlask','or','not'])
        seeds=list(range(1,257));events=[]
        runner=FlowRunner(SearchConfig(seed_list=seeds,max_workers=2,max_results=0),rule,events.append)
        try:
            result=runner.run()
            with Engine() as engine:expected=engine.search(1,257,rule,seeds)
            self.assertEqual(list(result),expected);self.assertEqual(result.page(),expected)
            self.assertTrue(all(runner.completed));self.assertTrue(all(a>=b for a,b in zip(runner.counts,runner.counts[1:])))
            self.assertEqual(events[-1]['flow_completed'],[True]*3)
            source=DiskSeeds(runner.path,0,runner.counts[0])
            try:
                whole=source[:len(source)]
                self.assertEqual(source[:2],whole[:2]);self.assertEqual(source[:2],whole[:2]);self.assertEqual(source[2:4],whole[2:4])
            finally:source.close()
        finally:runner.path.unlink(missing_ok=True)

    def test_chest_generated_contents_and_wand_empty_slots(self):
        with Engine() as engine:data=engine.info(123)
        wand=data['pacifistChest'][0][0]['wand']
        self.assertEqual(wand['cards']['cards'],['DYNAMITE','DYNAMITE','SCATTER_4','DYNAMITE','DYNAMITE','DYNAMITE'])
        self.assertEqual(data['pacifistChest'][1][0]['material'],'magic_liquid_charm')
        self.assertEqual(chest_entries(data['pacifistChest'][5])[-1][1],'270')
        self.assertEqual(len(data['perkLottery']),7)
        card=WandCard(wand)
        self.assertEqual(len(card.findChildren(QToolButton)),7)
        empty=[w for w in card.findChildren(__import__('PySide6.QtWidgets',fromlist=['QLabel']).QLabel) if w.toolTip().startswith('空法术槽')]
        self.assertEqual(len(empty),int(wand['gun']['deck_capacity'])-6)
        card.close()

    def test_flow_stop_keeps_intermediates_out_of_final_results(self):
        rule={'type':'and','rules':[{'type':'startingFlask','val':'snow'},{'type':'startingSpell','val':'SPITTER'}]}
        runner=FlowRunner(SearchConfig(start=1,end=10000,max_results=0,max_workers=1),rule)
        runner.on_progress=lambda packet:runner.stop() if packet['checked'] else None
        try:
            result=runner.run();self.assertTrue(result.partial);self.assertEqual(len(result),0)
            self.assertFalse(runner.completed[0]);self.assertIsNone(runner.counts[1])
        finally:runner.path.unlink(missing_ok=True)

    def test_gpu_flow_with_real_layer_stage(self):
        from noitatool.gpu import devices
        if not devices():self.skipTest('No OpenCL device')
        rule={'type':'and','rules':[{'type':'perkSet','val':{'ids':['MOLD'],'where':0,'mode':'all'}},{'type':'layerSpells','val':{'ids':['BLACK_HOLE','CHAINSAW'],'mode':'any','layer':0,'scope':'main'}}]}
        seeds=[123,84,284];runner=FlowRunner(SearchConfig(seed_list=seeds,max_results=0,max_workers=2,backend='gpu'),rule)
        try:
            result=runner.run()
            with Engine() as engine:expected=engine.search(1,285,rule,seeds)
            self.assertEqual(list(result),expected);self.assertIn(123,expected)
        finally:runner.path.unlink(missing_ok=True)

    def test_drag_between_groups_and_range_visibility(self):
        w=Window();w.save_settings=lambda:None
        try:
            w.set_rule({'type':'and','rules':[{'type':'startingFlask','val':'water'},{'type':'or','rules':[{'type':'startingSpell','val':'LIGHT_BULLET'}]},{'type':'not','rules':[{'type':'startingBombSpell','val':'BOMB'}]}]})
            root=w.tree.topLevelItem(0);self.assertFalse(w.tree.move_item(root,root.child(1)))
            self.assertFalse(w.tree.move_item(root.child(0),root.child(2)))
            self.assertTrue(w.tree.move_item(root.child(0),root.child(1)))
            rule=w.get_rule();self.assertEqual(len(rule['rules']),2);self.assertEqual(rule['rules'][0]['rules'][1]['val'],'water')
            w.source_mode.setCurrentIndex(1);self.assertTrue(w.range_fields.isHidden())
            w.source_mode.setCurrentIndex(0);self.assertFalse(w.range_fields.isHidden())
            w.flow_enabled.setChecked(True);self.assertFalse(w.limit.isEnabled());self.assertEqual(w.limit.value(),0)
        finally:w.close()

    def test_flow_details_do_not_resize_main_page_and_progress_is_overall(self):
        w=Window();w.save_settings=lambda:None;w.resize(1280,850);w.show();self.app.processEvents()
        rule={'type':'and','rules':[{'type':'startingFlask','val':'snow'},{'type':'startingSpell','val':'SPITTER'}]}
        runner=FlowRunner(SearchConfig(max_results=0),rule)
        try:
            before=w.search_split.geometry();w.flow_enabled.setChecked(True);self.app.processEvents()
            self.assertEqual(w.search_split.geometry(),before);self.assertFalse(w.flow_dialog.isVisible())
            w.flow_view.reset(runner)
            packet=dict(flow_stage=0,flow_counts=[3,None],flow_completed=[False,False],checked=50,total=100,elapsed=1,flow_checked=50)
            w.search_progress(packet);self.assertEqual(w.progress.value(),250)
            packet.update(flow_stage=1,flow_counts=[3,0],flow_completed=[True,False],checked=0,total=3)
            w.search_progress(packet);self.assertEqual(w.progress.value(),500)
            packet.update(checked=3,flow_completed=[True,True],flow_counts=[3,1],flow_checked=103)
            w.search_progress(packet);self.assertEqual(w.progress.value(),1000)
            self.assertIn('总进度 100.0%',w.stats.text());self.assertIn('103',w.stats.text())
            w.flow_button.show();self.app.processEvents();after=w.search_split.geometry()
            w.flow_button.click();self.app.processEvents()
            self.assertTrue(w.flow_dialog.isVisible());self.assertFalse(w.flow_dialog.isModal())
            self.assertEqual(w.search_split.geometry(),after);self.assertEqual(w.flow_view.table.item(1,1).text(),'100% · 完成')
            w.flow_dialog.close();w.flow_button.click();self.assertEqual(w.flow_view.table.rowCount(),2)
        finally:w.flow_dialog.close();w.close()


if __name__=='__main__':unittest.main()
