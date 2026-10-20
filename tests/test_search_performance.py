import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication
from noitatool.app import configure_app
from noitatool.search import SearchRunner,SearchConfig
from noitatool.result_view import SeedResultView
from noitatool.engine import Engine
from noitatool.gpu import devices

RULE={'type':'startingFlask','val':'water'}

class NoHistoryScan(list):
    def __iter__(self):raise AssertionError('Historical results were scanned')
    def copy(self):raise AssertionError('Historical results were copied')

class SearchPerformanceTests(unittest.TestCase):
    def test_reports_transfer_only_new_matches(self):
        packets=[];runner=SearchRunner(SearchConfig(max_results=0),RULE,packets.append)
        runner.started=time.monotonic()
        runner.found=NoHistoryScan(range(100000))
        runner.reported_results=len(runner.found)
        runner.found.extend([100001,100002])
        runner._report(True)
        self.assertEqual(packets[-1]['new_results'],[100001,100002])
        self.assertEqual(packets[-1]['found_count'],100002)
        self.assertNotIn('results',packets[-1])
        runner._report(True)
        self.assertEqual(packets[-1]['new_results'],[])

    def test_virtual_rows_keep_all_results_and_roles(self):
        app=QApplication.instance() or QApplication([]);configure_app(app)
        view=SeedResultView()
        view.append_seeds(list(range(1,100001)));view.append_seeds([2147483645])
        self.assertEqual(view.count(),100001)
        self.assertTrue(view.uniformItemSizes())
        last=view.seed_model.index(100000)
        self.assertEqual(last.data(Qt.UserRole),2147483645)
        self.assertIn('2147483645',last.data(Qt.DisplayRole))
        view.setCurrentIndex(last);self.assertEqual(view.currentItem().data(Qt.UserRole),2147483645)
        view.clear();self.assertEqual(view.count(),0);view.close()

    def test_reserved_verifier_and_cpu_search_run_concurrently(self):
        rule={'type':'layerSpells','val':{'layer':0,'mode':'all','ids':['BLACK_HOLE']}}
        cpu_started=threading.Event();unblocked=[];packets=[];calls=[]
        runner=SearchRunner(SearchConfig(start=1,end=4,backend='gpu',max_workers=2,max_results=0,cpu_percent=100,gpu_percent=100),rule,packets.append)
        def fake_batch(start,end,seeds=None):
            calls.append((threading.current_thread().name,seeds.copy() if seeds is not None else list(range(start,end))))
            if seeds==[1]:unblocked.append(cpu_started.wait(2))
            if threading.current_thread().name.startswith('NoitaCPU'):cpu_started.set()
            return seeds if seeds is not None else list(range(start,end))
        runner._batch=fake_batch
        fake=SimpleNamespace(device=SimpleNamespace(name='Test GPU'),candidates=lambda start,end:list(range(start,end)))
        with patch('noitatool.gpu.GPU',return_value=fake),patch('noitatool.search.os.cpu_count',return_value=2):
            result=runner.run()
        self.assertEqual(unblocked,[True],'Direct CPU search stalled behind GPU verification')
        self.assertEqual(result,[1,2,3,4]);self.assertEqual(runner.checked,4)
        self.assertEqual(sorted(s for p in packets for s in p['new_results']),result)
        self.assertEqual(runner.verified_count,3)
        self.assertEqual(sorted(s for _,seeds in calls for s in seeds),[1,2,3,4])
        self.assertEqual(len({n for n,_ in calls if n.startswith('NoitaVerify')}),1)
        self.assertTrue(any(n.startswith('NoitaCPU') for n,_ in calls))

    def test_hybrid_sparse_list_disjoint_coverage_and_single_worker(self):
        for workers in (1,3):
            with self.subTest(workers=workers):
                seeds=[984,1,700000013,123,2,284,304,42,84]
                calls=[];gpu_inputs=[];packets=[]
                def filter_list(values):
                    gpu_inputs.extend(values);return [s for s in values if s%2==0]
                def batch(start,end,values=None):
                    calls.append((threading.current_thread().name,values.copy()))
                    return [s for s in values if s%2==0]
                fake=SimpleNamespace(device=SimpleNamespace(name='Test'),candidate_seeds=filter_list)
                runner=SearchRunner(SearchConfig(seed_list=seeds,backend='gpu',max_workers=workers,max_results=0,cpu_percent=100,gpu_percent=100),RULE,packets.append)
                runner._batch=batch
                with patch('noitatool.gpu.GPU',return_value=fake),patch('noitatool.search.os.cpu_count',return_value=3):
                    self.assertEqual(runner.run(),sorted(s for s in seeds if s%2==0))
                cpu_inputs=[s for n,v in calls if n.startswith('NoitaCPU') for s in v]
                verify_inputs=[s for n,v in calls if n.startswith('NoitaVerify') for s in v]
                self.assertEqual(sorted(gpu_inputs+cpu_inputs),sorted(seeds))
                self.assertFalse(set(gpu_inputs)&set(cpu_inputs))
                self.assertEqual(sorted(verify_inputs),sorted(s for s in gpu_inputs if s%2==0))
                self.assertEqual(runner.checked,len(seeds));self.assertEqual(runner.pending_candidates,0)
                self.assertEqual([p['checked'] for p in packets],sorted(p['checked'] for p in packets))
                self.assertEqual(bool(cpu_inputs),workers>1)

    def test_gpu_multiple_blocks_count_rejections_once(self):
        spans=[]
        def candidates(start,end):
            spans.append((start,end));return [s for s in range(start,end) if s%10000==0]
        fake=SimpleNamespace(device=SimpleNamespace(name='Test'),candidates=candidates)
        runner=SearchRunner(SearchConfig(start=1,end=70001,backend='gpu',max_workers=1,max_results=0,cpu_percent=100,gpu_percent=100),RULE)
        runner._batch=lambda start,end,seeds:list(seeds)
        with patch('noitatool.gpu.GPU',return_value=fake):
            self.assertEqual(runner.run(),list(range(10000,70001,10000)))
        self.assertEqual(spans,[(1,65537),(65537,70002)])
        self.assertEqual(runner.checked,70001)
        self.assertEqual(runner.verified_count,7)
        self.assertEqual(runner.pending_candidates,0)

    @unittest.skipUnless(devices(),'No OpenCL GPU')
    def test_real_gpu_perk_then_layer_generation(self):
        rule={'type':'and','rules':[{'type':'perkSet','val':{'where':0,'mode':'all','ids':['MOLD']}},{'type':'layerSpells','val':{'layer':0,'scope':'main','mode':'all','ids':['BLACK_HOLE','CHAINSAW']}}]}
        seeds=[123,84,284]
        with Engine() as e:expected=e.search(1,2,rule,seeds=seeds)
        packets=[]
        runner=SearchRunner(SearchConfig(seed_list=seeds,backend='gpu',max_workers=2,max_results=0,cpu_percent=100,gpu_percent=100),rule,packets.append)
        self.assertEqual(runner.run(),sorted(expected));self.assertIn(123,expected)
        checked=[p['checked'] for p in packets]
        self.assertEqual(checked,sorted(checked));self.assertEqual(checked[-1],len(seeds))
        self.assertGreater(runner.candidate_count,0)
        self.assertEqual(runner.candidate_count,runner.verified_count)

if __name__=='__main__':unittest.main()
