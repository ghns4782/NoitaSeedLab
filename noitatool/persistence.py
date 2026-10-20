"""Temporary map rectangles stay in memory, never in saved search files."""
from copy import deepcopy

def persistent_rule(rule):
    def visit(node):
        node=deepcopy(node)
        if node['type']=='advanced':
            node['val']=visit(node['val'])
            return node if node['val'] else None
        if node['type'] in ('and','or','not'):
            node['rules']=[child for r in node['rules'] if (child:=visit(r)) is not None]
            return node if node['rules'] else None
        if node['type']=='layerSpells':
            val=node['val']
            def permanent(a):return a.get('kind')=='layer' or a.get('kind')!='rect' and bool(a.get('id'))
            if 'ranges' in val:
                val['ranges']=[a for a in val['ranges'] if permanent(a)]
                if not val['ranges']:return None
            elif val.get('scope')=='region' and not permanent(val['area']):return None
        return node
    result=visit(rule)
    if result is None:raise ValueError('当前条件只有临时范围；临时范围不写入搜索方案，请先选择命名区域。')
    from .search import validate_rule
    validate_rule(result);return result
