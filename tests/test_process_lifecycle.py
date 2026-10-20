import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.engine import Engine,MAX_SEED
from noitatool.search import SearchRunner,SearchConfig
from noitatool.paths import ROOT


class ProcessLifecycleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
    def test_close_interrupts_blocked_engine_request_and_is_idempotent(self):
        engine=Engine();engine.info(123);errors=[]
        def work():
            try:engine.search(1,MAX_SEED,{'type':'startingFlask','val':'water'})
            except RuntimeError as exc:errors.append(str(exc))
        worker=threading.Thread(target=work);worker.start();time.sleep(.15)
        start=time.monotonic();engine.close();engine.close();worker.join(3)
        self.assertLess(time.monotonic()-start,3);self.assertFalse(worker.is_alive())
        self.assertIsNotNone(engine.process.poll());self.assertTrue(errors)
    def test_search_stop_reaps_all_workers(self):
        runner=SearchRunner(SearchConfig(start=1,end=MAX_SEED,max_workers=2,max_results=0,cpu_percent=100),{'type':'startingFlask','val':'water'})
        errors=[]
        def work():
            try:runner.run()
            except Exception as exc:errors.append(exc)
        worker=threading.Thread(target=work);worker.start();deadline=time.monotonic()+8
        while not runner.engines and time.monotonic()<deadline:time.sleep(.01)
        self.assertTrue(runner.engines);runner.stop();worker.join(4)
        self.assertFalse(worker.is_alive());self.assertFalse(errors)
        self.assertTrue(all(engine.process.poll() is not None for engine in runner.engines))
    def test_window_closes_automatically_during_query_without_error_popup(self):
        window=Window();window.show();errors=[]
        with patch.object(window,'show_error',side_effect=errors.append):
            window.start_job(lambda:window.view_session.request(op='search',seed=1,start=1,end=MAX_SEED,rule={'type':'startingFlask','val':'water'}),lambda _:self.fail('Closed window received results'))
            deadline=time.monotonic()+5
            while window.view_session.engine is None and time.monotonic()<deadline:self.app.processEvents();time.sleep(.01)
            engine=window.view_session.engine;self.assertIsNotNone(engine)
            window.close();deadline=time.monotonic()+4
            while (window.isVisible() or window.jobs) and time.monotonic()<deadline:self.app.processEvents();time.sleep(.01)
            self.assertFalse(window.isVisible());self.assertFalse(window.jobs);self.assertFalse(errors)
            self.assertIsNotNone(engine.process.poll());self.assertIsNone(window.start_job(lambda:None,lambda _:None))

    @unittest.skipUnless(os.name=='nt','Windows Job Object')
    def test_forced_owner_termination_kills_node_without_atexit(self):
        import ctypes as c
        from ctypes import wintypes as w
        api=c.WinDLL('kernel32',use_last_error=True)
        api.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];api.OpenProcess.restype=w.HANDLE
        api.WaitForSingleObject.argtypes=[w.HANDLE,w.DWORD];api.WaitForSingleObject.restype=w.DWORD
        api.CloseHandle.argtypes=[w.HANDLE]
        api.TerminateProcess.argtypes=[w.HANDLE,w.UINT]
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            pid_file=Path(folder)/'node.json'
            code="from noitatool.engine import Engine;import time,json,sys,pathlib,subprocess;e=Engine();e.info(123);e.process.stdin.write(json.dumps({'op':'search','start':1,'end':2147483645,'rule':{'type':'startingFlask','val':'water'}})+'\\n');e.process.stdin.flush();other=subprocess.Popen([sys.executable,'-c','import time;time.sleep(60)'],creationflags=subprocess.CREATE_NO_WINDOW);pathlib.Path(sys.argv[1]).write_text(json.dumps({'node':e.process.pid,'external':other.pid}));time.sleep(60)"
            owner=subprocess.Popen([sys.executable,'-c',code,str(pid_file)],cwd=ROOT,creationflags=subprocess.CREATE_NO_WINDOW)
            handle=external=None
            try:
                deadline=time.monotonic()+8
                while not pid_file.exists() and owner.poll() is None and time.monotonic()<deadline:time.sleep(.02)
                self.assertTrue(pid_file.exists());ids=json.loads(pid_file.read_text());pid=ids['node']
                handle=api.OpenProcess(0x100001,False,pid);self.assertTrue(handle)
                external=api.OpenProcess(0x100001,False,ids['external']);self.assertTrue(external)
                owner.terminate();owner.wait(timeout=4)
                self.assertEqual(api.WaitForSingleObject(handle,4000),0,'Node survived its owner process')
                self.assertEqual(api.WaitForSingleObject(external,0),258,'Unrelated external application was killed')
            finally:
                if owner.poll() is None:owner.kill();owner.wait(timeout=4)
                if handle:
                    if api.WaitForSingleObject(handle,0)!=0:api.TerminateProcess(handle,1);api.WaitForSingleObject(handle,4000)
                    api.CloseHandle(handle)
                if external:api.TerminateProcess(external,0);api.WaitForSingleObject(external,4000);api.CloseHandle(external)


if __name__=='__main__':unittest.main()
