"""Measure sustained world generation without retaining past seed data."""
import argparse
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from noitatool.engine import Engine

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--count',type=int,default=200)
    parser.add_argument('--layer',type=int,default=0)
    parser.add_argument('--scope',default='main')
    parser.add_argument('--start',type=int,default=123)
    parser.add_argument('--output',default='artifacts/layer-profile.json')
    args=parser.parse_args();rows=[]
    with Engine() as e:
        tick=time.monotonic()
        for i in range(args.count):
            e.request(op='layer',seed=args.start+i,layer=args.layer,scope=args.scope)
            if (i+1)%20==0 or i+1==args.count:
                now=time.monotonic();mem=e.request(op='memory')
                row=dict(count=i+1,seconds=round(now-tick,3),rss_mib=round(mem['rss']/1048576,1),heap_mib=round(mem['heapUsed']/1048576,1),arrays_mib=round(mem['arrayBuffers']/1048576,1))
                rows.append(row);print(json.dumps(row),flush=True);tick=now
    Path(args.output).write_text(json.dumps(rows,indent=2),encoding='utf-8')

if __name__=='__main__':main()
