"""Named local language packs, independent of the selected language."""
import hashlib
import json
from pathlib import Path

def directory():
    from .localization import user_path
    return user_path().parent

def selected():
    try:return json.loads((directory()/'selection.json').read_text(encoding='utf-8')).get('id','zh_CN')
    except (OSError,ValueError,AttributeError):return 'zh_CN'

def choices():
    rows=[{'id':'zh_CN','name':'简体中文 / Chinese','language':'zh_CN'},{'id':'en','name':'English','language':'en'}]
    for path in sorted((directory()/'packs').glob('*.json')):
        try:
            row=json.loads(path.read_text(encoding='utf-8'))
            if isinstance(row.get('name'),str) and isinstance(row.get('language'),str) and isinstance(row.get('values'),dict):rows.append({'id':'pack:'+path.stem,'name':row['name'],'language':row['language']})
        except (OSError,ValueError,AttributeError):continue
    return rows

def active_values():
    key=selected()
    if key in ('zh_CN','en'):return key,{}
    if key.startswith('pack:') and len(key)==29 and all(c in '0123456789abcdef' for c in key[5:]):
        try:
            row=json.loads((directory()/'packs'/f'{key[5:]}.json').read_text(encoding='utf-8'))
            values=row['values']
            if isinstance(values,dict) and all(isinstance(k,str) and isinstance(v,str) for k,v in values.items()):return row.get('language','custom'),values
        except (OSError,ValueError,KeyError,AttributeError):pass
    return 'zh_CN',{}

def activate(key):
    if key not in {row['id'] for row in choices()}:raise ValueError('找不到所选语言包')
    folder=directory();folder.mkdir(parents=True,exist_ok=True)
    temp=folder/'selection.tmp';temp.write_text(json.dumps({'id':key}),encoding='utf-8');temp.replace(folder/'selection.json')

def import_pack(path,name=None,language=None):
    from .localization import parse_table
    path=Path(path);values=parse_table(path)
    if path.suffix.lower()=='.json':
        raw=json.loads(path.read_text(encoding='utf-8-sig'))
        if isinstance(raw,dict) and 'entries' in raw:
            name=name or raw.get('name');language=language or raw.get('language')
    name=(name or path.stem).strip();language=(language or 'custom').strip()
    if not name or len(name)>100 or len(language)>40:raise ValueError('语言名称或代码无效')
    digest=hashlib.sha256((name+'\n'+language).encode()).hexdigest()[:24]
    folder=directory()/'packs';folder.mkdir(parents=True,exist_ok=True);target=folder/f'{digest}.json'
    temp=target.with_suffix('.tmp');temp.write_text(json.dumps({'name':name,'language':language,'values':values},ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(target)
    return 'pack:'+digest,len(values)
