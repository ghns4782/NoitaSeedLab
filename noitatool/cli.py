"""Command-line access to the same local engines used by the desktop UI."""
import argparse
import json
from pathlib import Path
from .engine import Engine
from .search import SearchConfig,SearchRunner
from .info_html import strip_assets

def main():
    parser=argparse.ArgumentParser(description='NoitaSeedLab 本地种子查询与搜索')
    subs=parser.add_subparsers(dest='command',required=True)
    info=subs.add_parser('info')
    info.add_argument('seed',type=int)
    info.add_argument('--world',type=int,default=0)
    search=subs.add_parser('search')
    search.add_argument('--rule',type=Path,required=True)
    search.add_argument('--start',type=int,default=1)
    search.add_argument('--end',type=int,default=100000)
    search.add_argument('--backend',choices=['cpu','gpu'],default='cpu')
    search.add_argument('--workers',type=int,default=0)
    search.add_argument('--cpu-percent',type=int,default=75)
    search.add_argument('--gpu-percent',type=int,default=75)
    search.add_argument('--limit',type=int,default=0,help='0 表示不限')
    search.add_argument('--seed-list',type=Path,help='仅搜索此 TXT / CSV / JSON 列表中的种子')
    args=parser.parse_args()
    if args.command=='info':
        with Engine() as engine:
            result=strip_assets(engine.info(args.seed,worldOffset=args.world))
    else:
        rule=json.loads(args.rule.read_text(encoding='utf-8'))
        config=SearchConfig(start=args.start,end=args.end,backend=args.backend,max_workers=args.workers,cpu_percent=args.cpu_percent,gpu_percent=args.gpu_percent,max_results=args.limit)
        if args.seed_list:
            from .seed_lists import parse_seed_list
            config.seed_list=parse_seed_list(args.seed_list.read_text(encoding='utf-8-sig'))
        if config.backend=='gpu':
            from .search import has_layer_rule
            from .gpu import prefilter
            if has_layer_rule(rule) and prefilter(rule) is None:config.backend='cpu'
        runner=SearchRunner(config,rule)
        try:result=runner.run()
        except KeyboardInterrupt:
            runner.stop()
            raise
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
