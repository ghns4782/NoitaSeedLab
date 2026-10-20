"""Compare shipped Node assets and the selected Python/OpenCL environment.

This is a diagnostic, not a startup action. Run identical workloads under each
build environment; timing excludes correctness hashing and report serialization.
"""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import sys
import time

PROJECT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(PROJECT))


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def run(root,samples,only='all'):
    import noitatool.engine as adapter
    adapter.ROOT=Path(root).resolve()
    from noitatool.gpu import GPU,devices
    report={'root':str(adapter.ROOT),'python':sys.executable,'samples':samples,'cases':{}}
    rule={'type':'startingFlask','val':'water'}
    def measure(name,action):
        times=[];hashes=[]
        for i in range(samples):
            start=time.perf_counter();value=action(i);times.append(time.perf_counter()-start)
            hashes.append(digest(value))
        report['cases'][name]={'seconds':times,'median':statistics.median(times),'hashes':hashes}
    if only in ('all','cpu','map'):
      with adapter.Engine() as engine:
        # Warm the persistent process before measuring steady-state requests.
        engine.info(123)
        if only in ('all','cpu'):
            for _ in range(3):engine.search(1,100001,rule)
            measure('cpu_search',lambda _:engine.search(1,1000001,rule))
            measure('seed_info',lambda i:engine.info([123,5151515,1,2147483645,5000][i%5]))
        if only in ('all','map'):
            measure('map',lambda i:engine.request(op='map',seed=[123,5000,5151515,1,2147483645][i%5],worldOffset=0))
    if only in ('all','gpu') and devices():
        gpu=GPU(rule);gpu.candidates(1,262145)
        measure('gpu_candidates',lambda _:gpu.candidates(1,1048577))
        measure('gpu_sparse',lambda _:gpu.candidate_seeds(list(range(1,262145,3))))
        report['gpu']=gpu.device.name
    else:report['gpu']=None
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--samples',type=int,default=5)
    parser.add_argument('--only',choices=['all','cpu','gpu','map'],default='all')
    args=parser.parse_args();result=run(args.root,args.samples,args.only)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({name:row['median'] for name,row in result['cases'].items()}))
