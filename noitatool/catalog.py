import base64
import hashlib
import html
import json
from functools import lru_cache
from PySide6.QtGui import QIcon, QPixmap, QColor,QPainter,QPen
from PySide6.QtCore import Qt
from .paths import DATA, UPSTREAM, ROOT,STATE

@lru_cache
def read_json(name):
    return json.loads((DATA/name).read_text(encoding='utf-8'))

@lru_cache
def translations():
    rows=json.loads((UPSTREAM/'public/locales/zh/materials.json').read_text(encoding='utf-8'))
    rows.update(json.loads((ROOT/'assets/zh-supplement.json').read_text(encoding='utf-8')))
    return rows

@lru_cache
def read_english():
    return json.loads((UPSTREAM/'public/locales/en/materials.json').read_text(encoding='utf-8'))

def tr(key):
    from .localization import text
    return text(translations().get(key,key.lstrip('$').replace('_',' ')),key)

def record(key):
    for filename in ('obj/perks.json','obj/spells.json','materials.json'):
        data=read_json(filename)
        if key in data:
            return data[key]
    return {}

def name(key):
    if not key:
        return '无'
    from .item_info import ITEMS
    data=record(key)
    from .localization import text
    if not data and key in ITEMS:return text(ITEMS[key][0],key)
    if not data:
        for candidate in ('$animal_'+key,'$item_'+key,'$material_'+key):
            if candidate in translations():return text(text(translations()[candidate],candidate),key)
    return text(tr(data.get('ui_name',data.get('name',key))),key)

def image_url(data):
    if isinstance(data,dict):
        return next((data[k] for k in ('ui_icon','sprite','perk_icon','file') if isinstance(data.get(k),str) and data[k].startswith('data:image')),None)
    return image_url(record(data))

@lru_cache(maxsize=2048)
def icon(key):
    pixmap=QPixmap()
    url=image_url(key)
    if url:
        pixmap.loadFromData(base64.b64decode(url.split(',',1)[1]))
        pixmap=pixmap.scaled(28,28,Qt.KeepAspectRatio,Qt.FastTransformation)
    else:
        pixmap=QPixmap(20,20)
        color=record(key).get('color','596273ff')
        try:
            pixmap.fill(QColor('#'+color[:6]))
        except Exception:
            pixmap.fill(QColor('#596273'))
    return QIcon(pixmap)

def data_icon(data):
    url=image_url(data)
    pix=QPixmap()
    if url:
        pix.loadFromData(base64.b64decode(url.split(',',1)[1]))
        pix=pix.scaled(48,48,Qt.KeepAspectRatio,Qt.FastTransformation)
    return QIcon(pix)

def item_icon(entity):
    from pathlib import Path
    key=Path(entity).stem
    aliases={'heart':'heart','heart_fullhp':'full_heal','heart_better':'heart_bigger','spell_refresh':'spell_refresh','physics_gold_orb':'gold_rain','physics_die':'chaos_die','egg':'egg_monster','powder_stash':'pouch','powder_pouch':'pouch'}
    if key in ('orb','true_orb','orb_cursed'):
        # The upstream orb files contain a flask placeholder; use an unmistakable
        # round UI symbol rather than showing a potion as an orb.
        pix=QPixmap(32,32);pix.fill(Qt.transparent);painter=QPainter(pix);painter.setRenderHint(QPainter.Antialiasing)
        painter.setPen(QPen(QColor('#eed999'),2));painter.setBrush(QColor('#5e3c94' if key=='orb_cursed' else '#2976a8'));painter.drawEllipse(4,4,24,24)
        painter.setPen(QPen(QColor('#ecdfff' if key=='orb_cursed' else '#9eeaff'),2));painter.drawEllipse(9,9,14,14);painter.setBrush(QColor('#f8f1ce'));painter.setPen(Qt.NoPen);painter.drawEllipse(10,8,5,5);painter.end();return QIcon(pix)
    if key.startswith('book'):key='emerald_tablet'
    if 'wand_' in key:
        return data_icon(read_json('wands.json')[0])
    if key.startswith('goldnugget'):key='gold'
    path=ROOT/'vendor/noita-telescope-main/data/item_sprites'/f'{aliases.get(key,key)}.png'
    if not path.exists():path=ROOT/'vendor/noita-telescope-main/data/item_sprites/utility_box.png'
    return QIcon(QPixmap(str(path)).scaled(32,32,Qt.KeepAspectRatio,Qt.FastTransformation))

def image_html(value,width=28):
    url=image_url(value)
    if not url:
        return ''
    cache=STATE/'.cache/icons'
    cache.mkdir(parents=True,exist_ok=True)
    path=cache/(hashlib.sha256(url.encode()).hexdigest()+'.png')
    if not path.exists():
        path.write_bytes(base64.b64decode(url.split(',',1)[1]))
    return f'<img src="{path.as_uri()}" width="{width}" height="{width}" />'

def badge(key):
    body=image_html(key)+' '+html.escape(name(key))
    return '<a href="spell:'+html.escape(key,quote=True)+'">'+body+'</a>' if key in read_json('obj/spells.json') else body

def options(kind):
    if kind=='perk':
        return list(read_json('obj/perks.json'))
    if kind=='spells':
        return list(read_json('obj/spells.json'))
    return list(read_json('materials.json'))
