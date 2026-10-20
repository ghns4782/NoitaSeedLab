"""Bounded, cancellable native worker scheduling with CPU/GPU duty budgets."""
import os
import threading
import time
import json
from collections import deque
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from dataclasses import dataclass
from .engine import Engine, valid_seed

def has_layer_rule(rule):
    if rule['type']=='advanced':return has_layer_rule(rule['val'])
    return rule['type']=='layerSpells' or any(has_layer_rule(r) for r in rule.get('rules',[]))

@dataclass
class SearchConfig:
    start: int = 1
    end: int = 100000
    backend: str = 'cpu'
    cpu_percent: int = 75
    gpu_percent: int = 75
    max_workers: int = 0
    max_results: int = 100
    device_index: int = 0
    seed_list: list[int] | None = None
    diagnostics: bool = False
    seed_source: object = None  # Internal, validated disk-backed flow stage input.

    def validate(self):
        if self.seed_list is None:
            valid_seed(self.start)
            valid_seed(self.end)
            if self.end < self.start:raise ValueError('结束种子不能小于开始种子')
        if self.backend not in ('cpu','gpu'):
            raise ValueError('未知计算后端')
        if not 1 <= self.cpu_percent <= 100 or not 1 <= self.gpu_percent <= 100:
            raise ValueError('运算预算必须为 1–100%')
        if self.max_results < 0 or self.max_workers < 0:
            raise ValueError('结果上限和工作线程设置无效')
        if self.seed_list is not None:
            if not self.seed_list:raise ValueError('种子列表不能为空')
            for seed in self.seed_list:valid_seed(seed)
            self.seed_list=list(dict.fromkeys(self.seed_list))

    def workers(self):
        available=os.cpu_count() or 1
        cap=min(self.max_workers or available,available)
        return max(1,min(cap,int(available*self.cpu_percent/100)))

def validate_rule(rule):
    if not isinstance(rule,dict) or 'type' not in rule:
        raise ValueError('每个条件需要 type 字段')
    if rule['type']=='advanced':
        from .advanced_ui import validate_advanced
        if set(rule)-{'type','val'}:raise ValueError('高级条件只允许 type 和 val 字段')
        validate_advanced(rule.get('val'));return
    if rule['type'] in ('and','or','not'):
        children=rule.get('rules')
        if not isinstance(children,list) or not children:
            raise ValueError('逻辑组不能为空')
        if rule['type']=='not' and len(children)!=1:
            raise ValueError('NOT 组必须恰好包含一个条件')
        for r in children:
            validate_rule(r)
    elif rule['type'] not in {'alchemy','perk','perkSet','layerSpells','fungalShift','startingFlask','startingSpell','startingBombSpell','weather','biomeModifier','shop','pacifistChest','wand','waterCave'}:
        raise ValueError(f'不支持的条件类型：{rule["type"]}')
    else:
        kind=rule['type']
        val=rule.get('val')
        expected={'alchemy':dict,'perk':dict,'perkSet':dict,'layerSpells':dict,'fungalShift':list,'startingFlask':str,'startingSpell':str,'startingBombSpell':str,'weather':dict,'biomeModifier':dict,'shop':list,'pacifistChest':list,'wand':dict,'waterCave':int}[kind]
        if not isinstance(val,expected):
            raise ValueError(f'{kind} 的 val 必须是 {expected.__name__}')
        if kind in ('perkSet','layerSpells'):
            keys=val.get('ids',[]) if kind=='layerSpells' else val.get('ids')
            materials=val.get('materials',[]) if kind=='layerSpells' else []
            if not isinstance(keys,list) or not isinstance(materials,list) or not (keys or materials) or not all(isinstance(k,str) and k for k in keys+materials):raise ValueError('请至少选择一个法术或药水材料目标' if kind=='layerSpells' else '请至少选择一个目标')
            if val.get('mode') not in ('all','any'):raise ValueError('匹配方式必须是 all 或 any')
            if kind=='perkSet' and val.get('where') not in ['any','deck',*range(7)]:raise ValueError('天赋位置无效')
            if kind=='perkSet':
                lottery=val.get('lottery',[])
                if not isinstance(lottery,list) or any(not isinstance(k,str) or k not in keys for k in lottery):raise ValueError('博彩保留天赋必须是已选目标的子集')
                if lottery and val.get('where')=='deck':raise ValueError('博彩保留需要圣山内的具体位置，不能用于完整天赋牌库')
            if kind=='layerSpells':
                if 'ranges' in val:
                    from .areas import validate_ranges
                    validate_ranges(val['ranges'])
                layers=val.get('layers',[val.get('layer')])
                if 'ranges' not in val and val.get('scope') not in ('overgrown','region') and (not isinstance(layers,list) or not layers or any(type(i) is not int or i not in range(7) for i in layers)):raise ValueError('请至少选择一个第 1–7 层范围内的层')
                if val.get('scope')=='region':
                    from .areas import validate_area
                    validate_area(val.get('area'))
                worlds=val.get('worldRange',[0,0])
                if not isinstance(worlds,list) or len(worlds)!=2 or any(type(i) is not int or not -100<=i<=100 for i in worlds) or worlds[0]>worlds[1]:raise ValueError('平行世界范围须为 -100–100 内的起止编号，起点不能大于终点')
            if kind=='layerSpells' and val.get('scope','main') not in ('main','depth','overgrown','region'):raise ValueError('整层搜索范围无效')
        if kind=='alchemy':
            for key in ('LC','AP'):
                if not isinstance(val.get(key),list) or not all(isinstance(s,str) for s in val[key]):
                    raise ValueError('炼金条件的 LC / AP 必须是材料 ID 数组')
        if kind=='perk':
            for key in ('all','some','deck'):
                if not isinstance(val.get(key,[]),list) or any(not isinstance(row,list) or any(not isinstance(p,str) for p in row) for row in val.get(key,[])):
                    raise ValueError('天赋条件的 all / some / deck 必须是二维 ID 数组')
            if any(len(val.get(k,[]))>7 for k in ('all','some')):
                raise ValueError('天赋层数超出七座圣山范围')
        if kind in ('shop','pacifistChest') and len(val)>7:
            raise ValueError('圣山层数不能超过 7')
        if kind=='shop':
            for shop in val:
                if shop is None:continue
                if not isinstance(shop,dict) or shop.get('type') not in (0,1,2) or not isinstance(shop.get('items'),list):
                    raise ValueError('商店条件需要 type=0（不限）、1（魔杖）或 2（法术）以及 items 数组')
                for item in shop['items']:
                    if not isinstance(item,dict) or ('wand' if shop['type']==1 else 'spell') not in item:
                        raise ValueError('商店 items 需要 wand 或 spell 字段')
        if kind=='fungalShift' and len(val)>20:
            raise ValueError('真菌转移次数不能超过 20')
        if kind=='fungalShift':
            if not any(val):raise ValueError('请至少指定一次真菌转移')
            for row in val:
                if row is None:continue
                if not isinstance(row,dict) or set(row)-{'from','to','flaskFrom','flaskTo','gold_to_x','grass_to_x'}:raise ValueError('真菌转移字段无效')
                if 'from' in row and (not isinstance(row['from'],list) or not row['from'] or any(not isinstance(k,str) for k in row['from'])):raise ValueError('转移来源必须是材料 ID 数组')
                for key in ('to','gold_to_x','grass_to_x'):
                    if key in row and (not isinstance(row[key],str) or not row[key]):raise ValueError('转移目标必须是材料 ID')
                for key in ('flaskFrom','flaskTo'):
                    if key in row and type(row[key]) is not bool:raise ValueError('手持参与标记必须是布尔值')
                if row.get('flaskFrom') and row.get('flaskTo'):raise ValueError('同一次转移不能同时要求手持作来源和目标')
        if kind=='biomeModifier':
            from .catalog import read_json
            valid=read_json('obj/biome_modifiers.json')
            if not val or any(not isinstance(k,str) or not isinstance(ids,list) or not ids or any(i not in valid for i in ids) for k,ids in val.items()):raise ValueError('请选择区域与有效的生态修正 ID')
        if kind=='waterCave' and val not in range(5):
            raise ValueError('水洞布局编号必须为 0–4')
        if kind=='wand' and not isinstance(rule.get('params'),dict):
            raise ValueError('魔杖条件需要 params 坐标与等级参数')

class SearchRunner:
    def __init__(self, config, rule, on_progress=lambda _:None, result_sink=None):
        config.validate()
        validate_rule(rule)
        self.config,self.rule,self.on_progress=config,rule,on_progress
        self.cancel=threading.Event()
        self.engines=[]
        self.lock=threading.Lock()
        self.local=threading.local()
        self.checked=0
        self.found=[]
        self.started=0
        self.last_report=0
        self.reported_results=0
        self.reported_checked=0
        self.phase='初始化'
        self.pending_candidates=0
        self.gpu_seconds=0
        self.verification_seconds=0
        self.verify_started=None
        self.candidate_count=0
        self.verified_count=0
        self.profile=[]
        self.last_profile=0
        self.profile_path=None
        self.rate_samples=deque()
        self.backend_name='CPU'
        self.result_sink=result_sink
        self.matched_count=0

    def _source(self):
        return self.config.seed_source if self.config.seed_source is not None else self.config.seed_list

    def stop(self):
        self.cancel.set()
        with self.lock:engines=list(self.engines)
        for engine in engines:engine.close()

    def _engine(self):
        if not hasattr(self.local,'engine'):
            with self.lock:
                if self.cancel.is_set():raise RuntimeError('搜索已停止')
                self.local.engine=Engine()
                self.engines.append(self.local.engine)
        return self.local.engine

    def _batch(self,start,end,seeds=None):
        if self.cancel.is_set():
            return None
        started=time.monotonic()
        try:result=self._engine().search(start,end,self.rule,seeds)
        except (OSError,RuntimeError,ValueError):
            if self.cancel.is_set():return None
            raise
        # Threads run independent Node/WASM instances, outside Python's GIL.
        workers=self.config.workers()
        fraction=min(1,(os.cpu_count() or 1)*self.config.cpu_percent/100/workers)
        elapsed=time.monotonic()-started
        self.cancel.wait(elapsed*(1/fraction-1))
        return result

    def _report(self,force=False):
        now=time.monotonic()
        if not force and now-self.last_report<.2:return
        if not self.rate_samples:self.rate_samples.append((self.started,0))
        self.rate_samples.append((now,self.checked))
        while len(self.rate_samples)>2 and self.rate_samples[1][0]<now-3:self.rate_samples.popleft()
        then,count=self.rate_samples[0]
        current_rate=(self.checked-count)/max(.001,now-then)
        self.last_report=now
        elapsed=max(.001,time.monotonic()-self.started)
        source=self._source()
        total=len(source) if source is not None else self.config.end-self.config.start+1
        added=self.found[self.reported_results:]
        self.reported_results=len(self.found)
        self.reported_checked=self.checked
        verification=self.verification_seconds+(now-self.verify_started if self.verify_started is not None else 0)
        packet=dict(checked=self.checked,total=total,rate=current_rate,average_rate=self.checked/elapsed,elapsed=elapsed,new_results=added,found_count=self.matched_count if self.result_sink else len(self.found),backend=self.backend_name,phase=self.phase,pending_candidates=self.pending_candidates,gpu_seconds=self.gpu_seconds,verification_seconds=verification,candidates=self.candidate_count,verified_candidates=self.verified_count,cancelled=self.cancel.is_set())
        if self.config.diagnostics and (force or now-self.last_profile>=1):
            self.profile.append({k:v for k,v in packet.items() if k!='new_results'})
            self.last_profile=now
        self.on_progress(packet)

    def run(self):
        self.started=time.monotonic()
        try:
            if self.config.backend=='gpu':
                self._run_gpu()
            else:
                self._run_cpu()
            self.phase='已停止' if self.cancel.is_set() else '完成'
            self._report(True)
            return sorted(self.found)
        finally:
            for engine in self.engines:
                engine.close()
            if self.config.diagnostics:
                from .paths import STATE as ROOT
                path=ROOT/'artifacts'/f'search-profile-{time.time_ns()}.json'
                try:
                    path.parent.mkdir(parents=True,exist_ok=True)
                    path.write_text(json.dumps({'workers':self.config.workers(),'backend':self.config.backend,'samples':self.profile},ensure_ascii=False,indent=2),encoding='utf-8')
                    self.profile_path=str(path)
                except OSError:pass

    def _collect(self, result, count):
        if result is None:
            return
        self.checked+=count
        self._accept(result)
        self._report()

    def _accept(self,result):
        if self.result_sink:
            self.result_sink(result);self.matched_count+=len(result);return
        remaining=max(0,self.config.max_results-len(self.found)) if self.config.max_results else None
        self.found.extend(result[:remaining])
        if self.config.max_results and len(self.found)>=self.config.max_results:
            self.cancel.set()

    def _run_cpu(self):
        workers=self.config.workers()
        self.backend_name=f'CPU · {workers} 工作线程'
        self.phase='CPU 整层生成' if has_layer_rule(self.rule) else 'CPU 筛选'
        source=self._source()
        cursor=0 if source is not None else self.config.start
        last=len(source)-1 if source is not None else self.config.end
        batch=1 if has_layer_rule(self.rule) else 256
        with ThreadPoolExecutor(workers,thread_name_prefix='NoitaWASM') as pool:
            pending={}
            while pending or cursor<=last:
                while not self.cancel.is_set() and len(pending)<workers and cursor<=last:
                    end=min(cursor+batch,last+1)
                    pending[pool.submit(self._batch,cursor,end,source[cursor:end] if source is not None else None)]=end-cursor
                    cursor=end
                if not pending:
                    break
                done,_=wait(pending,timeout=.1,return_when=FIRST_COMPLETED)
                for future in done:
                    self._collect(future.result(),pending.pop(future))
                if self.cancel.is_set():
                    for future in pending:
                        future.cancel()
                    break

    def _run_gpu(self):
        from .gpu import GPU
        gpu=GPU(self.rule,self.config.device_index)
        workers=self.config.workers()
        direct_workers=workers-1
        self.backend_name=f'GPU · {gpu.device.name.strip()} + CPU（1 复核 / {direct_workers} 搜索）'
        self.phase='GPU / CPU 混合搜索'
        source=self._source()
        cursor=0 if source is not None else self.config.start
        last=len(source)-1 if source is not None else self.config.end
        batch=1 if has_layer_rule(self.rule) else 256
        candidates=deque()
        gpu_future=verify_future=None
        cpu_pending={}

        def allocate(size):
            nonlocal cursor
            start=cursor;end=min(start+size,last+1);cursor=end
            return start,end,source[start:end] if source is not None else None

        def filter_gpu(start,end,seeds):
            tick=time.monotonic()
            result=gpu.candidate_seeds(seeds) if seeds is not None else gpu.candidates(start,end)
            compute=time.monotonic()-tick
            self.cancel.wait(compute*(100/self.config.gpu_percent-1))
            return result,compute

        # Each CPU lane keeps its own persistent Node/WASM engine. Only the
        # verifier receives GPU candidates; other lanes claim disjoint source
        # ranges and evaluate the complete rule directly.
        with ThreadPoolExecutor(1,thread_name_prefix='NoitaGPU') as gpu_pool, \
             ThreadPoolExecutor(1,thread_name_prefix='NoitaVerify') as verify_pool, \
             ThreadPoolExecutor(max(1,direct_workers),thread_name_prefix='NoitaCPU') as cpu_pool:
            while True:
                if self.cancel.is_set():break
                if gpu_future is None and not candidates and verify_future is None and cursor<=last:
                    remaining=last-cursor+1
                    # Leave work for CPU lanes even for short lists/ranges.
                    reserve=min(direct_workers*batch,remaining//2)
                    gpu_start,gpu_end,seeds=allocate(min(65536,max(1,remaining-reserve)))
                    gpu_future=gpu_pool.submit(filter_gpu,gpu_start,gpu_end,seeds)
                if verify_future is None and candidates:
                    chunk=[candidates.popleft() for _ in range(min(batch,len(candidates)))]
                    verify_size=len(chunk);self.verify_started=time.monotonic()
                    verify_future=verify_pool.submit(self._batch,0,0,chunk)
                while len(cpu_pending)<direct_workers and cursor<=last:
                    start,end,seeds=allocate(batch)
                    cpu_pending[cpu_pool.submit(self._batch,start,end,seeds)]=end-start
                pending=set(cpu_pending)
                if gpu_future is not None:pending.add(gpu_future)
                if verify_future is not None:pending.add(verify_future)
                if not pending:
                    if cursor>last:break
                    continue
                finished,_=wait(pending,timeout=.1,return_when=FIRST_COMPLETED)
                for future in finished:
                    if future is gpu_future:
                        values,compute=future.result();gpu_future=None
                        self.gpu_seconds+=compute;self.candidate_count+=len(values)
                        candidates.extend(values);self.pending_candidates+=len(values)
                        # Rejections have been fully classified; candidates only
                        # count after exact verification. CPU counts are additive.
                        self.checked+=gpu_end-gpu_start-len(values)
                    elif future is verify_future:
                        result=future.result();verify_future=None
                        self.verification_seconds+=time.monotonic()-self.verify_started
                        self.verify_started=None
                        if result is not None:
                            self.checked+=verify_size;self.verified_count+=verify_size
                            self.pending_candidates-=verify_size;self._accept(result)
                    else:
                        count=cpu_pending.pop(future);result=future.result()
                        if result is not None:
                            self.checked+=count;self._accept(result)
                self._report()
            for future in cpu_pending:future.cancel()
            if gpu_future is not None:gpu_future.cancel()
            if verify_future is not None:verify_future.cancel()
        if self.verify_started is not None:
            self.verification_seconds+=time.monotonic()-self.verify_started
            self.verify_started=None
