"""Localized biome modifiers and explicit fungal-shift effects."""
from copy import deepcopy
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QGridLayout,QLabel,QComboBox,QListWidget,QListWidgetItem,QScrollArea,QGroupBox
from .catalog import name,read_json,icon
from .biome_names import biome_name
from .icon_grid import SelectionField,SingleIconPicker

MODIFIERS={'MOIST':('潮湿','空气极度潮湿，地形更湿润。'),'FOG_OF_WAR_REAPPEARS':('迷雾再生','探索过的区域会重新被黑暗笼罩。'),'HIGH_GRAVITY':('高重力','此区域重力增强。'),'LOW_GRAVITY':('低重力','此区域重力减弱。'),'CONDUCTIVE':('导电','空气电离，此处更容易发生电击。'),'FREEZING':('严寒','环境冻结，水会结冰。'),'HOT':('炎热','环境温度升高。'),'GOLD_VEIN':('金矿脉','增加黄金矿脉。'),'GOLD_VEIN_SUPER':('丰富金矿脉','增加大量黄金矿脉。'),'PLANT_INFESTED':('植物繁茂','区域中出现更多植物。'),'FURNISHED':('家具增多','区域中出现更多家具。'),'BOOBY_TRAPPED':('遍布陷阱','区域中出现更多陷阱。'),'PERFORATED':('地形疏松','地形中出现更多空洞。'),'SPOOKY':('阴森','此处令人毛骨悚然，可能出现幽灵。'),'GRAVITY_FIELDS':('重力场','区域中出现推拉物体的重力场。'),'FUNGAL':('真菌滋生','区域中有更多真菌。'),'FLOODED':('积水','区域被液体淹没。'),'GAS_FLOODED':('气体充斥','区域中充满气体。'),'SHIELDED':('护盾','区域中出现防护屏障。'),'PROTECTION_FIELDS':('保护力场','区域中出现保护力场。'),'OMINOUS':('不祥','区域中弥漫不祥气氛。'),'INVISIBILITY':('隐形','区域中的隐形效果会影响视线。'),'WORMY':('蠕虫出没','区域中有蠕虫活动。')}
def modifier_text(value):
    key=value.get('id','') if isinstance(value,dict) else value
    label,desc=MODIFIERS.get(key,(key,'未收录的生态修正'))
    from .localization import text
    return text(label,'modifier:'+key)+' · '+text(desc,'modifier_description:'+key)

def shift_tooltip(shift,held=None):
    source=' / '.join(name(k) for k in shift['from']);target=name(shift['to'])
    text=f'未使用手持材料时：{source} → {target}。'
    material=name(held) if held else '手持瓶中的材料'
    if shift.get('flaskFrom'):text+=f'\n手持材料参与时：以{material}作为来源，转化为{target}；原来的来源组不再作为本次来源。'
    elif shift.get('flaskTo'):text+=f'\n手持材料参与时：{source}转化为{material}，代替原目标{target}。'
    else:text+='\n本次不使用手持瓶中的材料，按默认来源与目标进行转移。'
    text+='\n这是材料类型的全局转化，并非只改变手上这一瓶；材料限制和之前的转移会影响实际结果。'
    for key,label in [('gold_to_x','黄金的后续结果'),('grass_to_x','草的后续结果')]:
        if shift.get(key):text+=f'\n{label}：{name(shift[key])}'
    return text

class ModifierEditor(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent);self.rows={};self.active=None;layout=QVBoxLayout(self)
        self.biome=QComboBox()
        for key in ['coalmine','coalmine_alt','mountain_hall','excavationsite','fungicave','snowcave','snowcastle','rainforest','rainforest_open','vault','crypt','watercave','lavalake','desert','pyramid_entrance','pyramid_left','pyramid_top','pyramid_right','lake_statue']:self.biome.addItem(biome_name(key),key)
        layout.addWidget(self.biome);self.list=QListWidget();layout.addWidget(self.list)
        for key in read_json('obj/biome_modifiers.json'):
            from .localization import text
            item=QListWidgetItem(text(MODIFIERS.get(key,(key,''))[0],'modifier:'+key));item.setData(Qt.UserRole,key);item.setCheckState(Qt.Unchecked);item.setToolTip(modifier_text(key));self.list.addItem(item)
        layout.addWidget(QLabel('同一区域内勾选多个修正表示满足其中任意一个；不同区域之间同时满足。'))
        self.biome.currentIndexChanged.connect(self.switch);self.switch()
    def store(self):
        if self.active is not None:
            keys=[self.list.item(i).data(Qt.UserRole) for i in range(self.list.count()) if self.list.item(i).checkState()==Qt.Checked]
            if keys:self.rows[self.active]=keys
            else:self.rows.pop(self.active,None)
    def switch(self,*_):
        self.store();self.active=self.biome.currentData()
        for i in range(self.list.count()):self.list.item(i).setCheckState(Qt.Checked if self.list.item(i).data(Qt.UserRole) in self.rows.get(self.active,[]) else Qt.Unchecked)
    def values(self):self.store();return deepcopy(self.rows)
    def set_values(self,rows):self.active=None;self.rows=deepcopy(rows);self.switch()

class FungalEditor(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent);self.rows=[None]*20;self.active=None;layout=QVBoxLayout(self)
        self.index=QComboBox()
        for i in range(20):self.index.addItem(f'第 {i+1} 次真菌转移',i)
        layout.addWidget(self.index);layout.addWidget(QLabel('默认来源（多个表示允许其中任一种）'))
        self.source=SelectionField(list(read_json('materials.json')),title='选择来源材料');layout.addWidget(self.source)
        layout.addWidget(QLabel('默认目标'));self.target=SingleIconPicker(list(read_json('materials.json')),True);layout.addWidget(self.target)
        self.flask=QComboBox()
        for text,key in [('不限制手持材料参与',None),('要求手持材料作来源','flaskFrom'),('要求手持材料作目标','flaskTo')]:self.flask.addItem(text,key)
        self.flask.setToolTip('作来源：瓶内材料 → 默认目标。\n作目标：默认来源 → 瓶内材料。\n不限制：只匹配默认来源 / 目标，不限制是否使用手持材料。');layout.addWidget(self.flask)
        note=QLabel('可以逐次设置多个转移条件；修改后切换次数会保留本次条件。\n手持瓶决定参与转化的材料类型，并非只改变这一瓶。');note.setWordWrap(True);layout.addWidget(note)
        self.index.currentIndexChanged.connect(self.switch);self.switch()
    def store(self):
        if self.active is None:return
        row=deepcopy(self.rows[self.active] or {})
        for key in ('from','to','flaskFrom','flaskTo'):row.pop(key,None)
        if self.source.values():row['from']=self.source.values()
        if self.target.currentData():row['to']=self.target.currentData()
        if self.flask.currentData():row[self.flask.currentData()]=True
        self.rows[self.active]=row or None
    def switch(self,*_):
        self.store();self.active=self.index.currentIndex();row=self.rows[self.active] or {};self.source.set_values(row.get('from',[]));self.target.setCurrentIndex(max(0,self.target.findData(row.get('to'))));self.flask.setCurrentIndex(1 if row.get('flaskFrom') else 2 if row.get('flaskTo') else 0)
    def values(self):
        self.store();rows=deepcopy(self.rows)
        while rows and rows[-1] is None:rows.pop()
        return rows
    def set_values(self,rows):self.active=None;self.rows=(deepcopy(rows)+[None]*20)[:20];self.index.setCurrentIndex(0);self.switch()

class FungalView(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent);self.data=[];layout=QVBoxLayout(self)
        layout.addWidget(QLabel('手持材料预览（只影响下方说明，不改变预测的默认转移）'))
        self.held=SingleIconPicker(list(read_json('materials.json')),True);layout.addWidget(self.held)
        self.scroll=QScrollArea();self.scroll.setWidgetResizable(True);layout.addWidget(self.scroll,1)
        self.held.button.clicked.connect(self.refresh)
    def update_info(self,data):self.data=data['fungalShift'];self.refresh()
    def refresh(self,*_):
        content=QWidget();layout=QVBoxLayout(content)
        for i,shift in enumerate(self.data):
            group=QGroupBox(f'第 {i+1} 次');box=QVBoxLayout(group)
            row=QHBoxLayout();sources=QGridLayout();row.addLayout(sources,1)
            for j,key in enumerate(shift['from']):
                dot=QLabel();dot.setPixmap(icon(key).pixmap(24,24));sources.addWidget(dot,j,0);sources.addWidget(QLabel(name(key)),j,1)
            row.addWidget(QLabel('→'));target=QLabel();target.setPixmap(icon(shift['to']).pixmap(28,28));row.addWidget(target);target_name=QLabel(name(shift['to']));target_name.setWordWrap(True);row.addWidget(target_name,1);box.addLayout(row)
            effect=shift_tooltip(shift,self.held.currentData());badge=QLabel('手持材料 → 目标' if shift.get('flaskFrom') else '来源 → 手持材料' if shift.get('flaskTo') else '按默认材料转移');badge.setStyleSheet('color:#8ed1c5');badge.setToolTip(effect);box.addWidget(badge)
            note=QLabel(effect.split('\n')[1]);note.setWordWrap(True);box.addWidget(note);group.setToolTip(effect);layout.addWidget(group)
        layout.addStretch();old=self.scroll.takeWidget()
        if old:old.deleteLater()
        self.scroll.setWidget(content)
