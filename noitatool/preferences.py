import json
from .paths import STATE as ROOT

def read_preferences():
    try:return json.loads((ROOT/'.cache/ui-preferences.json').read_text(encoding='utf-8'))
    except (OSError,ValueError):return {}
def set_preference(key,value):
    data=read_preferences();data[key]=value;path=ROOT/'.cache/ui-preferences.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
