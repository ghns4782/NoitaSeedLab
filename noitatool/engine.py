"""Persistent JSON-line adapter to the unmodified upstream WASM/providers."""
import json
import shutil
import subprocess
import threading
import atexit
import sys
from .paths import ROOT

MAX_SEED = 2_147_483_645
_live=set()
_live_lock=threading.Lock()

def close_all_engines():
    with _live_lock:engines=list(_live)
    for engine in engines:
        try:engine.close()
        except OSError:pass

atexit.register(close_all_engines)

def valid_seed(value):
    seed = int(value)
    if not 1 <= seed <= MAX_SEED:
        raise ValueError(f'种子必须在 1–{MAX_SEED:,} 之间')
    return seed

class Engine:
    def __init__(self):
        from .process_guard import OwnedPopen
        bundled=ROOT/'NoitaSeedLab.Worker.exe'
        if not bundled.is_file() and not getattr(sys,'frozen',False):bundled=ROOT/'node.exe'
        node = str(bundled) if bundled.is_file() else (None if getattr(sys,'frozen',False) else shutil.which('node'))
        if not node:
            raise RuntimeError('需要 Node.js 22 或更新版本以运行原版 WASM 内核')
        self.lock = threading.Lock()
        self.close_lock=threading.Lock();self.closed=threading.Event()
        self.process = OwnedPopen(
            [node, str(ROOT / 'runtime/engine.mjs')], cwd=ROOT,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding='utf-8', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
        )
        with _live_lock:_live.add(self)

    def request(self, on_progress=None, **request):
        with self.lock:
            if self.closed.is_set():raise RuntimeError('计算已停止')
            if self.process.poll() is not None:
                raise RuntimeError('原版算法内核已退出，请检查 runtime/engine.mjs')
            if on_progress:request['progress']=True
            self.process.stdin.write(json.dumps(request) + '\n')
            self.process.stdin.flush()
            while True:
                line = self.process.stdout.readline()
                if not line:raise RuntimeError('算法内核未返回结果')
                result = json.loads(line)
                if 'progress' not in result:break
                if on_progress:on_progress(result['progress'])
            if 'error' in result:
                raise RuntimeError(result['error'])
            return result['result']

    def info(self, seed, **config):
        return self.request(op='info', seed=valid_seed(seed), **config)

    def search(self, start, end, rule, seeds=None):
        payload = dict(op='search', start=start, end=end, rule=rule)
        if seeds is not None:
            payload['seeds'] = [int(s) for s in seeds]
        return self.request(**payload)

    def close(self):
        with self.close_lock:
            if self.closed.is_set():return
            self.closed.set()
            # Do not acquire the request lock before terminating: readline may
            # be waiting on a long-running map/search batch in another thread.
            if self.process.poll() is None:
                try:self.process.terminate()
                except ProcessLookupError:pass
                try:self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.process.kill();self.process.wait(timeout=3)
            with self.lock:
                self.process.stdin.close();self.process.stdout.close()
            with _live_lock:_live.discard(self)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
