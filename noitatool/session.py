"""In-memory viewing session; search workers intentionally use separate engines."""
import json
import threading
from copy import deepcopy
from .engine import Engine


class ViewSession:
    def __init__(self):
        self.lock=threading.RLock();self.engine=None;self.context=None;self.cache={};self.closed=threading.Event()

    def request(self,on_progress=None,**request):
        with self.lock:
            if self.closed.is_set():raise RuntimeError('查询已停止')
            context=(request['seed'],request.get('worldOffset',0))
            if self.context!=context:
                self.context=context;self.cache.clear()
            key=json.dumps(request,sort_keys=True,ensure_ascii=False)
            if key not in self.cache:
                if self.engine is None:self.engine=Engine()
                if self.closed.is_set():self.engine.close();raise RuntimeError('查询已停止')
                result=self.engine.request(on_progress=on_progress,**request) if on_progress else self.engine.request(**request)
                if len(self.cache)>=64:self.cache.pop(next(iter(self.cache)))
                self.cache[key]=result
            if on_progress:on_progress({'value':100,'phase':'地图已就绪（可复用缓存）'})
            return deepcopy(self.cache[key])

    def abort(self):
        self.closed.set()
        engine=self.engine
        if engine:engine.close()

    def close(self):
        self.abort()
        with self.lock:
            self.engine=None
            self.cache.clear();self.context=None
