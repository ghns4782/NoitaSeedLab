import csv
import io
import json
import re
from .engine import valid_seed

def parse_seed_list(text):
    text=text.lstrip('\ufeff').strip()
    if not text:raise ValueError('请粘贴或导入种子列表')
    if text.startswith(('[','{')):
        data=json.loads(text)
        if isinstance(data,dict):data=data.get('seeds',data.get('results'))
        if not isinstance(data,list):raise ValueError('JSON 需要种子数组，或含 seeds 数组的对象')
        values=[r.get('seed') if isinstance(r,dict) else r for r in data]
    elif text.splitlines()[0].strip().lower().split(',')[0] == 'seed':
        values=[row['seed'] for row in csv.DictReader(io.StringIO(text))]
    else:values=[v for v in re.split(r'[,;，；\s]+',text) if v]
    result=[]
    for i,v in enumerate(values,1):
        if isinstance(v,bool) or not re.fullmatch(r'\d+',str(v).strip()):raise ValueError(f'第 {i} 项不是有效整数种子：{v}')
        result.append(valid_seed(str(v).strip()))
    if not result:raise ValueError('列表没有种子')
    return list(dict.fromkeys(result))
