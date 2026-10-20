"""Build geographically distinct normal-game area presets from upstream biome data."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from noitatool.engine import Engine
from noitatool.biome_names import region_label
path=Path('noitatool/area_presets.json');old=json.loads(path.read_text(encoding='utf-8'))
split={'wizardcave','wandcave','sandcave','meat','winter','winter_caves','the_sky','the_end','scale','liquidcave','dragoncave'}
rows=[a for a in old if a['biomes'][0] not in split]
with Engine() as e:data=e.request(op='map',seed=1234)
for area in data['regions']:
    key=area['biomes'][0]
    if key not in split:continue
    if key not in ('the_sky','the_end') and area['verticalIndex']!=0:continue
    if key=='winter' and max(y for x,y in area['cells'])<14:continue
    x,y=min(area['cells']);area.update(id=f'geo:{key}:{area["verticalIndex"]}:{x}:{y}',label=region_label(area))
    if key=='wizardcave' and area['bounds'][2]<0:area['id']='wizards'
    rows.append(area)
path.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print('named regions:',len(rows))
