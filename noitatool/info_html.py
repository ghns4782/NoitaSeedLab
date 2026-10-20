import html
import json
from .catalog import badge, image_html, name, tr

def esc(value):
    return html.escape(str(value))

def document(body):
    return '''<html><head><style>
    body{background:#151b25;color:#dce3ed;font-family:'Microsoft YaHei';font-size:11pt;line-height:1.5}
    h1{font-size:22pt;color:#f1d49b}h2{font-size:15pt;color:#f1d49b;margin-top:24px}
    h3{font-size:12pt;color:#8ed1c5}td{padding:12px;border-bottom:1px solid #30394a}th{color:#8594a9;text-align:left;padding:12px}
    .muted{color:#8594a9}a{color:#8ed1c5}p{margin:10px 0}code{color:#9db9cd}
    </style></head><body>'''+body+'</body></html>'

def strip_assets(value):
    if isinstance(value,dict):
        return {k:strip_assets(v) for k,v in value.items() if not (isinstance(v,str) and (v.startswith('data:image') or len(v)>2000))}
    if isinstance(value,list):
        return [strip_assets(v) for v in value]
    return value

def chest_html(items):
    from .detail_ui import chest_entries
    from .paths import STATE as ROOT
    out=''
    for image,label,tip,wand in chest_entries(items):
        path=ROOT/'.cache/icons'/('item-'+str(abs(hash(tip)))+'.png');path.parent.mkdir(parents=True,exist_ok=True)
        image.pixmap(38,38).save(str(path))
        out+=f'<span title="{esc(tip)}"><img src="{path.as_uri()}" width="32" height="32"/> {esc(label)}</span>　'
        if wand:
            out+=' '.join(badge(k) for k in wand.get('cards',{}).get('cards',[]))
    return out or '空'

def render(seed,info):
    alchemy=info['alchemy']
    summary=f'<p class="muted">种子信息 / 本地计算</p><h1>{seed:,}</h1><h2>开局配置</h2><table width="100%">'
    for label,key in [('初始药水','startingFlask'),('初始法术','startingSpell'),('初始炸弹','startingBombSpell')]:
        summary+=f'<tr><td width="25%">{label}</td><td>{badge(info[key])} <span class="muted">{esc(info[key])}</span></td></tr>'
    summary+='</table><h2>炼金配方</h2><table width="100%">'
    for key,label in [('LC','活力合剂 · Lively Concoction'),('AP','炼金先驱 · Alchemic Precursor')]:
        summary+=f'<tr><td width="30%">{label}</td><td>'+ ' ＋ '.join(badge(m) for m in alchemy[key])+'</td></tr>'
    summary+='</table><h2>环境</h2><p>水洞布局：'+esc(info['waterCave'])+'</p>'
    weather=info['weather']
    summary+='<p>降雨材料：'+esc(name(weather.get('rain_material','')))+' · 雾：'+esc(round(weather.get('fog',0),3))+' · 云量：'+esc(round(weather.get('clouds',0),3))+'</p><p class="muted">天气中的降雪受本机日期、时间影响，与原站算法一致。</p>'
    mountains='<h1>圣山</h1><p class="muted">按进入顺序 · 天赋 / 商店 / 和平宝箱</p>'
    for level,perks in enumerate(info['perk']):
        mountains+=f'<h2>第 {level+1} 座圣山</h2><p>'+ '　　'.join(badge(p['id']) for p in perks)+'</p>'
        if level<len(info['shop']):
            shop=info['shop'][level]
            mountains+='<table width="100%">'
            for item in shop['items']:
                if shop['type']==2:
                    spell=item.get('spell',{})
                    key=spell.get('id','') if isinstance(spell,dict) else spell
                    mountains+='<tr><td>'+badge(key)+'</td><td>'+esc(item.get('cost',item.get('price','')))+' 金币</td></tr>'
                else:
                    gun=item['gun'];cards=item.get('cards',{})
                    mountains+='<tr><td width="20%">'+image_html(item.get('ui',{}))+' '+esc(tr(item.get('ui',{}).get('name','魔杖')))+'</td><td>'
                    mountains+=('乱序' if gun.get('shuffle_deck_when_empty') else '非乱序')+f' · 容量 {gun.get("deck_capacity",0):.0f} · 法力 {gun.get("mana_max",0):.0f} / +{gun.get("mana_charge_speed",0):.0f}<br/>'
                    mountains+=f'施放 {gun.get("fire_rate_wait",0)/60:.2f}s · 充能 {gun.get("reload_time",0)/60:.2f}s · 多重 {gun.get("actions_per_round",1)}<br/>'
                    mountains+='　'.join(badge(c) for c in cards.get('cards',[]))
                    mountains+='　□'*max(0,int(gun.get('deck_capacity',0))-len(cards.get('cards',[])))
                    if cards.get('permanentCard'):mountains+='<br/>始终施放：'+badge(cards['permanentCard'])
                    mountains+='</td></tr>'
            mountains+='</table>'
        if level<len(info.get('pacifistChest',[])):
            mountains+='<p>和平宝箱：'+chest_html(info['pacifistChest'][level])+'</p>'
    fungal='<h1>真菌转移</h1><table width="100%"><tr><th>次数</th><th>来源</th><th>目标</th><th>手持药水参与</th></tr>'
    for i,shift in enumerate(info['fungalShift']):
        fungal+=f'<tr><td>{i+1}</td><td>'+ ' / '.join(esc(name(m)) for m in shift['from'])+'</td><td>'+esc(name(shift['to']))+'</td><td>'+('替换来源' if shift['flaskFrom'] else '替换目标' if shift['flaskTo'] else '否')+'</td></tr>'
    fungal+='</table>'
    biome='<h1>生态修正</h1><table width="100%">'
    from .biome_names import biome_name
    from .environment_ui import modifier_text
    for key,value in info['biomeModifier'].items():
        if value:
            biome+='<tr><td>'+esc(biome_name(key))+'</td><td>'+esc(modifier_text(value))+'</td></tr>'
    biome+='</table>'
    return [document(body) for body in (summary,mountains,fungal,biome)]
