import json
from PySide6.QtCore import Qt, QSize
from PySide6.QtWidgets import (QDialog,QVBoxLayout,QHBoxLayout,QFormLayout,QComboBox,QSpinBox,QLabel,QPushButton,QDialogButtonBox,QStackedWidget,QWidget,QListWidget,QListWidgetItem,QPlainTextEdit,QTabWidget,QMessageBox,QLineEdit,QScrollArea)
from copy import deepcopy
from .icon_grid import SelectionField
from .wand_ui import WandFilterDialog
from .catalog import options, icon, name, read_json
from .gpu import MATERIALS,SPELLS,BOMBS
from .areas import PRESETS,preset
from PySide6.QtWidgets import QCheckBox,QGridLayout

LABELS={'startingFlask':'初始药水','startingSpell':'初始法术','startingBombSpell':'初始炸弹','perk':'圣山天赋','alchemy':'炼金配方','shop':'圣山商店法术','fungalShift':'真菌转移','weather':'天气','biomeModifier':'生态修正','pacifistChest':'和平宝箱','wand':'指定坐标魔杖','waterCave':'水洞布局'}
LABELS.update(perkSet='天赋组合',layerSpells='区域搜索',shop='圣山商店',advanced='高级搜索')
ADVANCED_ONLY={'wand','pacifistChest','advanced'}

class PerkLotteryField(QListWidget):
    """A separate checkbox for each selected perk, kept in sync with the picker."""
    def __init__(self):
        super().__init__();self.setIconSize(QSize(26,26));self.setMaximumHeight(160)
        from .icon_grid import inspect_icon
        self.itemDoubleClicked.connect(lambda item:inspect_icon(item,self))
    def values(self):
        return [self.item(i).data(Qt.UserRole) for i in range(self.count()) if self.item(i).checkState()==Qt.Checked]
    def set_ids(self,ids,checked=None):
        checked=set(self.values() if checked is None else checked);self.clear()
        for key in ids:
            item=QListWidgetItem(icon(key),name(key));item.setData(Qt.UserRole,key)
            item.setFlags(item.flags()|Qt.ItemIsUserCheckable)
            item.setCheckState(Qt.Checked if key in checked else Qt.Unchecked)
            item.setToolTip('勾选：持有 1 个天赋博彩时，拾取此天赋不会使其他天赋消失。\n未勾选：只要求此天赋出现，不限制博彩结果。')
            self.addItem(item)

def describe(rule):
    kind=rule['type'];value=rule.get('val')
    if kind=='advanced':return '高级条件 · '+describe(value)
    if kind in ('and','or','not'):
        label={'and':'全部满足','or':'任一满足','not':'排除'}[kind]
        return f'{label} · {len(rule.get("rules",[]))} 个子条件'
    if isinstance(value,str):return name(value)
    if kind=='perkSet':
        where='任意一座圣山' if value['where']=='any' else '天赋牌库' if value['where']=='deck' else f'第 {value["where"]+1} 座圣山'
        return where+' · '+('全部：' if value['mode']=='all' else '任一：')+'、'.join(name(k)+('〔博彩保留〕' if k in value.get('lottery',[]) else '') for k in value['ids'])
    if kind=='layerSpells':
        layers='、'.join(str(i+1) for i in value.get('layers',[value.get('layer',0)]))
        region=value.get('area',{}).get('label','地图指定区域') if value.get('scope')=='region' else '瞭望塔下方真菌地（上层繁茂洞窟）' if value.get('scope')=='overgrown' else f'第 {layers} 层合计（含圣山）'
        if 'ranges' in value:region='、'.join(a.get('label',f'主路线区域 {a["layer"]+1}' if a.get('kind')=='layer' else '特定范围') for a in value['ranges'])
        worlds=value.get('worldRange',[0,0]);world=f'世界 {worlds[0]}' if worlds[0]==worlds[1] else f'世界 {worlds[0]} 至 {worlds[1]}'
        targets=['法术 '+name(k) for k in value.get('ids',[])]+['药水 '+name(k) for k in value.get('materials',[])]
        return region+' · '+world+' · '+('全部：' if value['mode']=='all' else '任一：')+'、'.join(targets)
    if kind=='perk':
        parts=[]
        for mode,joiner in [('all',' + '),('some',' 或 ')]:
            for row,keys in enumerate(value.get(mode,[])):
                if keys:parts.append(f'第 {row+1} 座圣山：'+joiner.join(name(k) for k in keys))
        if value.get('deck') and value['deck'][0]:parts.append('牌库包含：'+' + '.join(name(k) for k in value['deck'][0]))
        return '；'.join(parts) or '不限天赋'
    if kind=='alchemy':
        return '；'.join(k+' 允许：'+('、'.join(name(s) for s in value[k]) if value[k] else '不限') for k in ('LC','AP'))
    if kind=='shop':
        parts=[]
        props={'mana_max':'法力','mana_charge_speed':'回蓝','deck_capacity':'容量','shuffle_deck_when_empty':'乱序'}
        for i,shop in enumerate(value):
            if not shop:continue
            detail='不限商店' if shop['type']==0 else '法术商店' if shop['type']==2 else '魔杖商店'
            if shop['items']:
                if shop['type']!=1:detail+='：'+'、'.join(name(item['spell']) for item in shop['items'])
                else:
                    gun=shop['items'][0]['wand'].get('gun',{})
                    detail+=' · '+' / '.join(props.get(k,k)+f' {v[0]}–{v[1]}' for k,v in gun.items())
            parts.append(f'第 {i+1} 座圣山 · '+detail)
        return '；'.join(parts)
    if kind=='fungalShift':
        return '；'.join(f'第 {i+1} 次：'+(' / '.join(name(k) for k in v.get('from',[])) or '任意材料')+' → '+name(v.get('to','')) for i,v in enumerate(value) if v)
    if kind=='weather':return '降雨：'+name(value.get('rain_material','')) if 'rain_material' in value else '自定义天气条件'
    if kind=='waterCave':return '布局 '+str(value)
    if kind=='biomeModifier':return '生态修正 · '+'、'.join(value.keys())
    if kind=='pacifistChest':return '指定圣山宝箱内容'
    if kind=='wand':return '指定坐标魔杖属性'
    return LABELS.get(kind,kind)

def rule_icon(rule):
    if isinstance(rule.get('val'),str):return icon(rule['val'])
    if rule['type']=='perk':
        for mode in ('all','some','deck'):
            for row in rule.get('val',{}).get(mode,[]):
                if row:return icon(row[0])
    return None

def picker(values,any_value=False):
    from .icon_grid import SingleIconPicker
    return SingleIconPicker(values,any_value)

class MaterialList(QWidget):
    def __init__(self):
        super().__init__()
        layout=QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        search=QLineEdit(placeholderText='搜索材料 / ID')
        self.list=QListWidget()
        for key in MATERIALS[:48]:
            item=QListWidgetItem(icon(key),f'{name(key)} · {key}')
            item.setData(Qt.UserRole,key)
            item.setCheckState(Qt.Unchecked)
            self.list.addItem(item)
        search.textChanged.connect(lambda text:[self.list.item(i).setHidden(text.lower() not in self.list.item(i).text().lower()) for i in range(self.list.count())])
        row=QHBoxLayout()
        for title,checked in [('全选',True),('清空',False)]:
            button=QPushButton(title)
            button.clicked.connect(lambda _,c=checked:[self.list.item(i).setCheckState(Qt.Checked if c else Qt.Unchecked) for i in range(self.list.count())])
            row.addWidget(button)
        layout.addWidget(search)
        layout.addLayout(row)
        layout.addWidget(self.list)

    def selected(self):
        return [self.list.item(i).data(Qt.UserRole) for i in range(self.list.count()) if self.list.item(i).checkState()==Qt.Checked]

class LegacyRuleDialog(QDialog):
    def __init__(self,parent=None,rule=None):
        super().__init__(parent)
        self.setWindowTitle('编辑搜索条件')
        self.resize(650,580)
        outer=QVBoxLayout(self)
        self.kind=QComboBox()
        for key,label in LABELS.items():
            if key=='perkSet' or key in ADVANCED_ONLY:continue
            self.kind.addItem(label,key)
        outer.addWidget(self.kind)
        self.tabs=QTabWidget()
        self.simple=QWidget()
        self.form=QFormLayout(self.simple)
        self.form.setFormAlignment(Qt.AlignTop|Qt.AlignLeft)
        self.raw=QPlainTextEdit()
        self.raw.setPlaceholderText('原站规则 JSON：{"type":"perk","val":...}')
        scroll=QScrollArea();scroll.setWidgetResizable(True);scroll.setWidget(self.simple)
        self.tabs.addTab(scroll,'条件编辑器')
        self.tabs.addTab(self.raw,'高级 JSON')
        outer.addWidget(self.tabs)
        buttons=QDialogButtonBox(QDialogButtonBox.Ok|QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.submit)
        buttons.rejected.connect(self.reject)
        outer.addWidget(buttons)
        self.kind.currentIndexChanged.connect(self.build)
        self.tabs.currentChanged.connect(self.sync_raw)
        self.build()
        if rule:
            self.kind.setCurrentIndex(max(0,self.kind.findData(rule['type'])))
            self.raw.setPlainText(json.dumps(rule,ensure_ascii=False,indent=2))
            self.tabs.setCurrentIndex(1)
            self.raw.setPlainText(json.dumps(rule,ensure_ascii=False,indent=2))

    def spin(self,minimum=1,maximum=7):
        spin=QSpinBox()
        spin.setRange(minimum,maximum)
        return spin

    def build(self):
        while self.form.rowCount():
            self.form.removeRow(0)
        kind=self.kind.currentData()
        self.widgets={}
        def add(key,label,widget):
            self.widgets[key]=widget
            self.form.addRow(label,widget)
            return widget
        if kind in ('startingFlask','startingSpell','startingBombSpell'):
            values={'startingFlask':read_json('starting-flask-materials.json'),'startingSpell':SPELLS,'startingBombSpell':BOMBS}[kind]
            add('value','目标',picker(list(values)))
        elif kind=='perk':
            add('value','天赋',picker(options('perk')))
            where=QComboBox()
            where.addItem('任意圣山（七层 OR）','any')
            for i in range(7):where.addItem(f'第 {i+1} 座圣山',i)
            where.addItem('天赋牌库','deck')
            add('where','位置',where)
        elif kind=='alchemy':
            hint=QLabel('勾选允许使用的材料；配方的三种原料必须全部在所选集合内。\n留空表示不限。LC：活力合剂；AP：炼金先驱。')
            hint.setWordWrap(True)
            self.form.addRow(hint)
            lists=QTabWidget()
            for key,label in [('LC','LC · 活力合剂'),('AP','AP · 炼金先驱')]:
                widget=MaterialList()
                self.widgets[key]=widget
                lists.addTab(widget,label)
            self.form.addRow(lists)
        elif kind=='shop':
            add('level','圣山',self.spin())
            shoptype=QComboBox()
            shoptype.addItem('法术商店',2)
            shoptype.addItem('魔杖商店',1)
            add('shoptype','商店类型',shoptype)
            add('value','包含法术（可选）',picker(options('spells'),True))
            shuffle=QComboBox()
            shuffle.addItem('不限',None)
            shuffle.addItem('非乱序',0)
            shuffle.addItem('乱序',1)
            add('shuffle','魔杖乱序',shuffle)
            add('mana','魔杖法力至少',self.spin(0,100000))
            add('regen','魔杖回蓝至少',self.spin(0,100000))
            add('capacity','魔杖容量至少',self.spin(0,100))
            self.form.addRow(QLabel('魔杖属性只在选择“魔杖商店”时生效；0 表示不限。'))
        elif kind=='fungalShift':
            add('index','转移次数',self.spin(1,20))
            add('from','来源',picker(options('materials'),True))
            add('to','目标',picker(options('materials'),True))
        elif kind=='weather':
            add('value','降雨材料',picker(['water','blood','acid','snow','sand','magic_liquid_random_polymorph'],True))
        elif kind=='waterCave':
            add('value','布局编号（0–4）',self.spin(0,4))
        else:
            self.form.addRow(QLabel('此条件使用高级 JSON 编辑器。下方提供可修改的模板。'))
        self.raw.setPlainText(json.dumps(self.template(),ensure_ascii=False,indent=2))

    def template(self):
        kind=self.kind.currentData()
        if kind=='biomeModifier':return {'type':kind,'val':{'coalmine':['MOIST']}}
        if kind=='pacifistChest':return {'type':kind,'val':[['data/entities/items/pickup/heart.xml']]}
        if kind=='wand':return {'type':kind,'params':{'x':0,'y':0,'cost':100,'level':1,'force_unshuffle':False,'unshufflePerk':False},'val':{'gun':{'mana_max':[200,10000]},'cards':[],'cardsStrict':False}}
        return self.simple_rule()

    def simple_rule(self):
        kind=self.kind.currentData()
        w=self.widgets
        if kind in ('startingFlask','startingSpell','startingBombSpell'):
            return {'type':kind,'val':w['value'].currentData()}
        if kind=='perk':
            key=w['value'].currentData()
            where=w['where'].currentData()
            def one(i):
                return {'type':'perk','val':{'all':[[] for _ in range(i)]+[[key]],'some':[],'deck':[]}}
            if where=='any':return {'type':'or','rules':[one(i) for i in range(7)]}
            if where=='deck':return {'type':'perk','val':{'all':[],'some':[],'deck':[[key]]}}
            return one(where)
        if kind=='alchemy':return {'type':kind,'val':{key:w[key].selected() for key in ('LC','AP')}}
        if kind=='shop':
            spell=w['value'].currentData()
            shop={'type':w['shoptype'].currentData(),'items':[],'strict':True}
            if shop['type']==2:
                if spell:shop['items']=[{'spell':spell}]
            else:
                gun={}
                for key,widget in [('mana_max','mana'),('mana_charge_speed','regen'),('deck_capacity','capacity')]:
                    if w[widget].value():gun[key]=[w[widget].value(),10000000]
                if w['shuffle'].currentData() is not None:
                    gun['shuffle_deck_when_empty']=[w['shuffle'].currentData()]*2
                shop['items']=[{'wand':{'gun':gun,'cards':[spell] if spell else [],'cardsStrict':True}}]
            return {'type':kind,'val':[None]*(w['level'].value()-1)+[shop]}
        if kind=='fungalShift':
            val={}
            if w['from'].currentData():val['from']=[w['from'].currentData()]
            if w['to'].currentData():val['to']=w['to'].currentData()
            return {'type':kind,'val':[None]*(w['index'].value()-1)+[val]}
        if kind=='weather':return {'type':kind,'val':{'rain_material':w['value'].currentData()} if w['value'].currentData() else {}}
        if kind=='waterCave':return {'type':kind,'val':w['value'].value()}
        return {'type':kind,'val':{}}

    def sync_raw(self,index):
        if index==1:
            if self.kind.currentData() in ('biomeModifier','pacifistChest','wand'):
                return
            self.raw.setPlainText(json.dumps(self.simple_rule(),ensure_ascii=False,indent=2))

    def submit(self):
        try:
            self.result_rule=json.loads(self.raw.toPlainText()) if self.tabs.currentIndex()==1 else self.simple_rule()
            from .search import validate_rule
            validate_rule(self.result_rule)
            if self.result_rule['type']=='fungalShift' and not any(v for v in self.result_rule['val'] if v):
                raise ValueError('请至少指定来源或目标材料')
            self.accept()
        except Exception as exc:
            QMessageBox.warning(self,'条件无效',str(exc))

class RuleDialog(LegacyRuleDialog):
    """Visual editing is the default, including when reopening saved conditions."""
    def __init__(self,parent=None,rule=None):
        self.original=None
        super().__init__(parent,None)
        self.tabs.removeTab(1);self.tabs.tabBar().hide()
        self.resize(920,760)
        if self.screen():self.resize(min(920,self.screen().availableGeometry().width()-40),min(760,self.screen().availableGeometry().height()-60))
        if rule:self.load_rule(rule)

    def build(self):
        kind=self.kind.currentData()
        if kind not in ('startingFlask','startingSpell','startingBombSpell','perk','shop','layerSpells','biomeModifier','fungalShift'):
            return super().build()
        while self.form.rowCount():self.form.removeRow(0)
        self.widgets={};self.original=None
        def add(key,label,w):self.widgets[key]=w;self.form.addRow(label,w);return w
        if kind in ('startingFlask','startingSpell','startingBombSpell'):
            vals={'startingFlask':read_json('starting-flask-materials.json'),'startingSpell':SPELLS,'startingBombSpell':BOMBS}[kind]
            add('value','目标',SelectionField(vals,[vals[0]],multiple=False,title='选择目标'))
        elif kind=='perk':
            where=QComboBox();where.addItem('任意一座圣山','any')
            for i in range(7):where.addItem(f'第 {i+1} 座圣山',i)
            where.addItem('完整天赋牌库','deck');add('where','位置',where)
            mode=QComboBox();mode.addItem('必须同时有全部所选天赋','all');mode.addItem('包含任意一个所选天赋','any');add('mode','匹配方式',mode)
            pool=[k for k,v in read_json('obj/perks.json').items() if not v.get('not_in_default_perk_pool')]
            add('value','天赋',SelectionField(pool,title='批量选择天赋'))
            lottery=add('lottery','要求博彩保留',PerkLotteryField())
            self.widgets['value'].changed.connect(lambda:lottery.set_ids(self.widgets['value'].values()))
            where.currentIndexChanged.connect(lambda:lottery.setEnabled(where.currentData()!='deck'))
            self.form.addRow(QLabel('逐项勾选需要博彩保留的天赋；未勾选的仅要求出现。\n按持有 1 个天赋博彩、圣山未重抽计算；完整牌库不支持此限制。'))
            self.form.addRow(QLabel('点击“批量选择天赋”打开全部图标；支持中英文搜索，悬停查看名称。'))
        elif kind=='shop':
            from .shop_ui import ShopEditor
            add('editor','',ShopEditor(self))
        elif kind in ('biomeModifier','fungalShift'):
            from .environment_ui import ModifierEditor,FungalEditor
            add('editor','',ModifierEditor(self) if kind=='biomeModifier' else FungalEditor(self))
        elif kind=='layerSpells':
            from .preferences import read_preferences,set_preference
            if not read_preferences().get('hide_region_notice',False):
                notice=QWidget();nl=QVBoxLayout(notice);notice.setStyleSheet('QWidget{background:#332c1c}');text=QLabel('区域搜索需要生成地形并检查法杖内法术、散落法术和药水，计算非常繁杂，范围较大时可能耗时很长。建议搭配“列表搜索”或“搜索流优化”，先用天赋等条件缩小种子范围。');text.setWordWrap(True);nl.addWidget(text)
                hide=QCheckBox('以后不再提示');hide.toggled.connect(lambda checked:set_preference('hide_region_notice',checked));nl.addWidget(hide);self.form.addRow(notice)
            from .range_ui import RangeSelector
            ranges=add('ranges','搜索范围（可多选）',RangeSelector(self))
            self.widgets['layers']=ranges.checks[:7]
            self.loaded_ranges=None;self.legacy_range_value=None
            mode=QComboBox();mode.addItem('必须找到全部所选法术与药水','all');mode.addItem('找到任意一个所选法术或药水','any');add('mode','匹配方式',mode)
            worlds=QWidget();world_layout=QHBoxLayout(worlds);world_layout.setContentsMargins(0,0,0,0)
            for key in ('world_from','world_to'):
                box=QSpinBox();box.setRange(-100,100);self.widgets[key]=box
                world_layout.addWidget(QLabel('起始' if key=='world_from' else '至'));world_layout.addWidget(box)
            add('world_range','平行世界（含两端）',worlds)
            self.form.addRow(QLabel('0 为主世界，负数为西侧、正数为东侧；同一编号表示只搜该世界。'))
            targets=QWidget();target_row=QHBoxLayout(targets);target_row.setContentsMargins(0,0,0,0)
            for key,label,pool,title in [('value','法术',options('spells'),'选择法术'),('materials','药水材料',options('materials'),'选择药水材料')]:
                column=QVBoxLayout();column.addWidget(QLabel(label));self.widgets[key]=SelectionField(pool,title=title);column.addWidget(self.widgets[key]);target_row.addLayout(column,1)
            self.form.addRow('搜索目标',targets)
            label=QLabel('所选区域、特定框选与平行世界合并统计，目标法术可以分布在多个范围。\n点击“地图选区”可切换区域勾选，或添加多个固定坐标的特定范围；悬停选项查看 X / Y。\n统计散落法术、法杖内容与始终施放、宝箱和固定房间中的法术。\n普通新游戏 / 全法术解锁；范围越大生成越慢，建议先用其他条件缩小种子范围。')
            label.setWordWrap(True);self.form.addRow(label)
        self.raw.setPlainText(json.dumps(self.simple_rule(),ensure_ascii=False,indent=2))

    def simple_rule(self):
        kind=self.kind.currentData();w=self.widgets
        if kind in ('startingFlask','startingSpell','startingBombSpell'):
            values=w['value'].values();return {'type':kind,'val':values[0] if values else ''}
        if kind=='perk':
            ids=w['value'].values();where=w['where'].currentData();mode=w['mode'].currentData()
            if self.original and self.original['type']=='perk':
                old=deepcopy(self.original['val'])
                occupied=[(m,i) for m in ('all','some') for i,row in enumerate(old.get(m,[])) if row]
                if len(occupied)>1 and isinstance(where,int):
                    key='all' if mode=='all' else 'some'
                    old.setdefault(key,[])
                    while len(old[key])<=where:old[key].append([])
                    old[key][where]=ids
                    lottery=w['lottery'].values()
                    if lottery:
                        return {'type':'and','rules':[{'type':'perk','val':old},{'type':'perkSet','val':{'ids':ids,'where':where,'mode':mode,'lottery':lottery}}]}
                    return {'type':'perk','val':old}
            val={'ids':ids,'where':where,'mode':mode}
            lottery=w['lottery'].values() if where!='deck' else []
            if lottery:val['lottery']=lottery
            return {'type':'perkSet','val':val}
        if kind=='shop':return {'type':'shop','val':w['editor'].values()}
        if kind=='layerSpells':
            selected=w['ranges'].values()
            val=deepcopy(self.legacy_range_value) if self.legacy_range_value is not None and selected==self.loaded_ranges else {'ranges':selected}
            val.update(ids=w['value'].values(),mode=w['mode'].currentData());val.pop('worldRange',None)
            if w['materials'].values():val['materials']=w['materials'].values()
            else:val.pop('materials',None)
            worlds=[w['world_from'].value(),w['world_to'].value()]
            if worlds!=[0,0]:val['worldRange']=worlds
            return {'type':kind,'val':val}
        if kind in ('biomeModifier','fungalShift'):return {'type':kind,'val':w['editor'].values()}
        return super().simple_rule()

    def load_rule(self,rule):
        kind=rule['type'];selected_kind='perk' if kind=='perkSet' else kind
        self.kind.setCurrentIndex(max(0,self.kind.findData(selected_kind)))
        self.original=deepcopy(rule);w=self.widgets;val=rule.get('val')
        if kind in ('startingFlask','startingSpell','startingBombSpell'):w['value'].set_values([val])
        elif kind in ('perk','perkSet'):
            if kind=='perkSet':where,mode,ids=val['where'],val['mode'],val['ids']
            else:
                where,mode,ids='deck','all',(val.get('deck') or [[]])[0]
                for m in ('some','all'):
                    for i,row in enumerate(val.get(m,[])):
                        if row:where,mode,ids=i,'all' if m=='all' else 'any',row;break
            w['where'].setCurrentIndex(w['where'].findData(where));w['mode'].setCurrentIndex(w['mode'].findData(mode));w['value'].set_values(ids)
            w['lottery'].set_ids(ids,val.get('lottery',[]) if kind=='perkSet' else [])
        elif kind=='shop':
            ed=w['editor'];ed.rows=(deepcopy(val)+[None]*7)[:7];ed.active=-1;ed.switch(0);ed.refresh_labels()
        elif kind=='layerSpells':
            from .areas import rule_ranges
            w['ranges'].set_values(rule_ranges(val));self.loaded_ranges=w['ranges'].values()
            self.legacy_range_value=deepcopy(val) if 'ranges' not in val else None
            if self.legacy_range_value is not None and 'layer' in val:
                self.legacy_range_value.pop('layer',None);self.legacy_range_value['layers']=[val['layer']]
            for key,num in zip(('world_from','world_to'),val.get('worldRange',[0,0])):w[key].setValue(num)
            w['mode'].setCurrentIndex(max(0,w['mode'].findData(val.get('mode','all'))))
            w['value'].set_values(val.get('ids',[]));w['materials'].set_values(val.get('materials',[]))
        elif kind=='alchemy':
            for key in ('LC','AP'):
                listing=w[key].list
                for i in range(listing.count()):listing.item(i).setCheckState(Qt.Checked if listing.item(i).data(Qt.UserRole) in val[key] else Qt.Unchecked)
        elif kind=='waterCave':w['value'].setValue(val)
        elif kind in ('fungalShift','biomeModifier'):w['editor'].set_values(val)
        elif kind=='weather':w['value'].setCurrentIndex(max(0,w['value'].findData(val.get('rain_material'))))
        else:self.tabs.setCurrentIndex(1)
        self.raw.setPlainText(json.dumps(rule,ensure_ascii=False,indent=2))
