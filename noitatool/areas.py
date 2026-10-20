import json
import math
from copy import deepcopy
from .paths import ROOT

PRESETS=json.loads((ROOT/'noitatool/area_presets.json').read_text(encoding='utf-8'))
MAIN_LABELS=['矿坑','煤矿','积雪深渊','希斯基地','地下丛林','避难所','艺术神殿']
MAIN_BIOMES=[['coalmine','coalmine_alt'],['excavationsite'],['snowcave'],['snowcastle'],['rainforest','rainforest_open'],['vault'],['crypt']]

def main_range(i,scope='main'):
    return {'kind':'layer','layer':i,'scope':scope,'label':MAIN_LABELS[i]+' + 下方圣山'+('（含全部侧区）' if scope=='depth' else '')}

def rule_ranges(val):
    if 'ranges' in val:return deepcopy(val['ranges'])
    scope=val.get('scope','main')
    if scope=='region':return [deepcopy(val['area'])]
    if scope=='overgrown':return [preset('overgrown')]
    return [main_range(i,scope) for i in val.get('layers',[val.get('layer',0)])]

def validate_ranges(ranges):
    if not isinstance(ranges,list) or not ranges or len(ranges)>64:raise ValueError('请选择 1–64 个搜索范围')
    for area in ranges:
        if isinstance(area,dict) and area.get('kind')=='layer':
            if type(area.get('layer')) is not int or area['layer'] not in range(7) or area.get('scope','main') not in ('main','depth'):raise ValueError('主路线区域无效')
        else:validate_area(area)
    return ranges
def preset(key):return deepcopy(next(p for p in PRESETS if p['id']==key))

def validate_area(area):
    if not isinstance(area,dict) or area.get('kind') not in ('rect','biome'):raise ValueError('请选择地图区域或框选范围')
    bounds=area.get('bounds')
    if not isinstance(bounds,list) or len(bounds)!=4 or any(type(n) not in (int,float) or not math.isfinite(n) for n in bounds):raise ValueError('区域坐标必须为四个有限数值')
    x1,y1,x2,y2=bounds
    if not -17920<=x1<x2<=17920 or not -25000000000<=y1<y2<=25000000000:raise ValueError('区域必须在所选水平世界内且有有效面积')
    if type(area.get('verticalIndex',0)) is not int or abs(area.get('verticalIndex',0))>1000000:raise ValueError('上下区段编号无效')
    if area['kind']=='biome':
        ids=area.get('biomes')
        if not isinstance(ids,list) or not ids or any(not isinstance(k,str) or not k or len(k)>80 for k in ids):raise ValueError('生态区域无效')
        if 'cells' in area and (not isinstance(area['cells'],list) or not area['cells'] or len(area['cells'])>3360 or any(not isinstance(c,list) or len(c)!=2 or any(type(n) is not int for n in c) or not 0<=c[0]<70 or not 0<=c[1]<48 for c in area['cells'])):raise ValueError('生态区域边界无效')
    return area
