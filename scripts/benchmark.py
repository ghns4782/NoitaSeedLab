import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from noitatool.search import SearchConfig,SearchRunner
from noitatool.gpu import devices

rule={'type':'and','rules':[{'type':'perk','val':{'all':[['EDIT_WANDS_EVERYWHERE','MOLD']],'some':[],'deck':[]}}, {'type':'startingFlask','val':'water'}]}
report={'range':[1,100000],'rule':rule,'runs':[]}
for backend in ('cpu','gpu'):
    if backend=='gpu' and not devices():continue
    config=SearchConfig(start=1,end=100000,backend=backend,max_workers=4,cpu_percent=100,gpu_percent=100,max_results=100000)
    tick=time.monotonic()
    runner=SearchRunner(config,rule)
    result=runner.run()
    elapsed=time.monotonic()-tick
    report['runs'].append({'backend':backend,'seconds':round(elapsed,3),'seeds_per_second':round(100000/elapsed),'matches':result,'workers':config.workers()})
    print(backend,round(elapsed,3),'s',len(result),'matches',flush=True)
if len(report['runs'])==2:
    assert report['runs'][0]['matches']==report['runs'][1]['matches']
    report['speedup']=round(report['runs'][0]['seconds']/report['runs'][1]['seconds'],2)
Path('artifacts').mkdir(exist_ok=True)
Path('artifacts/benchmark.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
