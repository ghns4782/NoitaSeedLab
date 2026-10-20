"""Exact sequential AND filtering. Large intermediate sets live on disk."""
import sqlite3
import threading
import time
from dataclasses import replace
from .paths import STATE as ROOT
from .search import SearchRunner,validate_rule


def stages_for(rule):
    if rule['type']=='and':return [stage for child in rule['rules'] for stage in stages_for(child)]
    return [rule]  # OR / NOT retain their entire boolean expression.


class DiskSeeds:
    def __init__(self,path,stage,count):
        self.path,self.stage,self.count=path,stage,count
        self.connection=sqlite3.connect(path);self.next_index=0;self.last=0;self.cache=None

    def __len__(self):return self.count

    def __getitem__(self,key):
        if not isinstance(key,slice):return self[key:key+1][0]
        start,end,step=key.indices(self.count)
        if step!=1:raise ValueError('不支持跳步')
        if self.cache and self.cache[:2]==(start,end):return self.cache[2]
        if start==self.next_index:
            values=[r[0] for r in self.connection.execute('SELECT seed FROM seeds WHERE stage=? AND seed>? ORDER BY seed LIMIT ?',(self.stage,self.last,end-start))]
        else:
            values=[r[0] for r in self.connection.execute('SELECT seed FROM seeds WHERE stage=? ORDER BY seed LIMIT ? OFFSET ?',(self.stage,end-start,start))]
        self.next_index=end
        if values:self.last=values[-1]
        self.cache=(start,end,values);return values

    def close(self):self.connection.close()


class FlowRunner:
    def __init__(self,config,rule,on_progress=lambda _:None):
        config.validate();validate_rule(rule)
        if config.max_results:raise ValueError('搜索流不支持结果上限，请设置为不限')
        self.config,self.rule,self.on_progress=config,rule,on_progress
        self.stages=stages_for(rule);self.cancel=threading.Event();self.child=None;self.profile_path=None
        folder=ROOT/'artifacts';folder.mkdir(parents=True,exist_ok=True)
        self.path=folder/f'search-flow-{time.time_ns()}.sqlite'
        self.counts=[None]*len(self.stages);self.completed=[False]*len(self.stages)
        self.checked_by_stage=[0]*len(self.stages)

    def stop(self):
        self.cancel.set()
        if self.child:self.child.stop()

    def run(self):
        connection=sqlite3.connect(self.path)
        connection.execute('CREATE TABLE seeds(stage INTEGER,seed INTEGER,PRIMARY KEY(stage,seed)) WITHOUT ROWID')
        connection.execute('CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT)')
        import json
        connection.execute('INSERT INTO metadata VALUES (?,?)',('rule',json.dumps(self.rule,ensure_ascii=False)));connection.commit()
        started=time.monotonic();final=[];index=0
        try:
            for index,rule in enumerate(self.stages):
                if self.cancel.is_set():break
                source=DiskSeeds(self.path,index-1,self.counts[index-1]) if index else None
                config=replace(self.config,seed_source=source,seed_list=None if index else self.config.seed_list,diagnostics=False)
                if config.backend=='gpu':
                    from .gpu import prefilter
                    if prefilter(rule) is None:config.backend='cpu'
                self.counts[index]=0
                def sink(seeds):
                    connection.executemany('INSERT OR IGNORE INTO seeds VALUES (?,?)',((index,int(seed)) for seed in seeds))
                    self.counts[index]+=len(seeds)
                last_commit=[0]
                def progress(packet):
                    if time.monotonic()-last_commit[0]>.5:connection.commit();last_commit[0]=time.monotonic()
                    self.checked_by_stage[index]=packet['checked']
                    packet=dict(packet,flow_stage=index,flow_counts=self.counts.copy(),flow_completed=self.completed.copy(),flow_checked=sum(self.checked_by_stage),elapsed=time.monotonic()-started)
                    self.on_progress(packet)
                self.child=SearchRunner(config,rule,progress,result_sink=sink)
                if self.cancel.is_set():self.child.stop()
                try:self.child.run()
                finally:
                    if source:source.close()
                connection.commit();self.completed[index]=not self.cancel.is_set()
                self.child._report(True)
                if self.cancel.is_set():break
                if not self.counts[index]:
                    for remaining in range(index+1,len(self.stages)):self.counts[remaining]=0;self.completed[remaining]=True
                    self.child._report(True);break
            # Final results remain disk backed too; the UI shows pages on demand.
            if all(self.completed):final=FlowResults(self.path,len(self.stages)-1,self.counts[-1])
            else:final=FlowResults(self.path,len(self.stages)-1,(self.counts[-1] or 0) if index==len(self.stages)-1 else 0,partial=True)
            return final
        finally:
            connection.commit();connection.close();self.child=None


class FlowResults:
    def __init__(self,path,stage,count,partial=False):self.path,self.stage,self.count,self.partial=path,stage,count,partial
    def __len__(self):return self.count
    def __bool__(self):return bool(self.count)
    def __iter__(self):
        connection=sqlite3.connect(self.path)
        try:
            for row in connection.execute('SELECT seed FROM seeds WHERE stage=? ORDER BY seed',(self.stage,)):yield row[0]
        finally:connection.close()
    def page(self,offset=0,size=500):
        connection=sqlite3.connect(self.path)
        try:return [r[0] for r in connection.execute('SELECT seed FROM seeds WHERE stage=? ORDER BY seed LIMIT ? OFFSET ?',(self.stage,size,offset))]
        finally:connection.close()
