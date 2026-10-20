import json
import math
from copy import deepcopy
from PySide6.QtWidgets import QDialog,QVBoxLayout,QHBoxLayout,QPlainTextEdit,QLabel,QComboBox,QPushButton,QDialogButtonBox
from .search import validate_rule

EXAMPLES=[('指定坐标魔杖',{'type':'wand','params':{'x':0,'y':0,'cost':100,'level':1,'force_unshuffle':False,'unshufflePerk':False},'val':{'gun':{'mana_max':[200,10000]},'cards':[],'cardsStrict':False}}),('和平宝箱',{'type':'pacifistChest','val':[['data/entities/items/pickup/heart.xml']]}),('天赋组合',{'type':'perkSet','val':{'where':0,'ids':['IRON_STOMACH'],'mode':'all'}}),('区域内药水',{'type':'layerSpells','val':{'ranges':[{'kind':'layer','layer':0}],'ids':[],'materials':['water'],'mode':'all'}}),('生态修正',{'type':'biomeModifier','val':{'coalmine':['MOIST']}}),('真菌转移',{'type':'fungalShift','val':[{'from':['water'],'to':'blood','flaskTo':True}]})]
EXAMPLES += [
    ('初始药水',{'type':'startingFlask','val':'water'}),
    ('初始法术',{'type':'startingSpell','val':'LIGHT_BULLET'}),
    ('初始炸弹',{'type':'startingBombSpell','val':'BOMB'}),
    ('圣山天赋（逐层）',{'type':'perk','val':{'all':[['EDIT_WANDS_EVERYWHERE']],'some':[],'deck':[]}}),
    ('炼金配方',{'type':'alchemy','val':{'LC':['water'],'AP':[]}}),
    ('圣山商店',{'type':'shop','val':[{'type':2,'items':[{'spell':'LIGHT_BULLET'}],'strict':True}]}),
    ('天气',{'type':'weather','val':{'rain_material':'water'}}),
    ('水洞布局',{'type':'waterCave','val':0}),
    ('区域内法术',{'type':'layerSpells','val':{'ranges':[{'kind':'layer','layer':0}],'ids':['BLACK_HOLE'],'materials':[],'mode':'all'}}),
    ('AND · 全部满足',{'type':'and','rules':[{'type':'startingFlask','val':'water'},{'type':'startingSpell','val':'LIGHT_BULLET'}]}),
    ('OR · 任一满足',{'type':'or','rules':[{'type':'startingFlask','val':'water'},{'type':'startingFlask','val':'blood'}]}),
    ('NOT · 排除',{'type':'not','rules':[{'type':'startingFlask','val':'water'}]}),
]

def validate_advanced(rule):
    validate_rule(rule)
    if rule['type']=='advanced':return
    if rule['type'] in ('and','or','not'):
        if set(rule)-{'type','rules'}:raise ValueError('逻辑组只允许 type、rules 字段')
        for child in rule['rules']:validate_advanced(child)
    elif set(rule)-{'type','val','params'}:raise ValueError('条件存在未知字段：'+', '.join(set(rule)-{'type','val','params'}))
    if rule['type']=='layerSpells':
        from .catalog import read_json
        value=rule['val']
        if set(value)-{'ranges','ids','materials','mode','layer','layers','scope','area','worldRange'}:raise ValueError('区域搜索只支持法术和药水目标；存在未知字段')
        for field,file in [('ids','obj/spells.json'),('materials','materials.json')]:
            valid=read_json(file)
            if any(key not in valid for key in value.get(field,[])):raise ValueError('区域搜索中存在未知的法术或材料 ID')
    if rule['type']=='pacifistChest' and any(row is not None and (not isinstance(row,list) or any(not isinstance(x,str) for x in row)) for row in rule['val']):raise ValueError('和平宝箱需要按圣山分组的物品路径数组')
    if rule['type']=='wand':
        params=rule['params']
        for key in ('x','y','cost','level'):
            if type(params.get(key)) not in (int,float) or not math.isfinite(params[key]):raise ValueError('魔杖 params.'+key+' 必须为有限数值')
        for key in ('force_unshuffle','unshufflePerk'):
            if type(params.get(key)) is not bool:raise ValueError('魔杖 params.'+key+' 必须为布尔值')
        if not 0<=params['level']<=10 or params['cost']<0:raise ValueError('魔杖等级或花费无效')
        value=rule['val']
        if set(value)-{'gun','cards','cardsStrict','permanentCard'}:raise ValueError('魔杖 val 存在未知字段')
        if not isinstance(value.get('gun',{}),dict):raise ValueError('gun 必须是属性对象')
        for key,bounds in value.get('gun',{}).items():
            if key not in {'deck_capacity','actions_per_round','reload_time','shuffle_deck_when_empty','fire_rate_wait','spread_degrees','mana_charge_speed','mana_max','speed_multiplier'}:raise ValueError('未知的魔杖属性：'+key)
            if not isinstance(bounds,list) or len(bounds)!=2 or any(type(x) not in (int,float) or not math.isfinite(x) for x in bounds) or bounds[0]>bounds[1]:raise ValueError(key+' 必须是 [最小值, 最大值]')
        if not isinstance(value.get('cards',[]),list) or any(not isinstance(x,str) for x in value.get('cards',[])):raise ValueError('cards 必须是法术 ID 数组')

class AdvancedSearchDialog(QDialog):
    def __init__(self,parent=None,rule=None):
        super().__init__(parent);self.setWindowTitle('高级搜索 · JSON 条件');self.resize(880,700);layout=QVBoxLayout(self)
        layout.addWidget(QLabel('完整 JSON 编辑；“＋”会把示例添加到 AND 组。只有通过格式与条件校验后才能应用。'))
        row=QHBoxLayout();self.examples=QComboBox()
        for label,_ in EXAMPLES:self.examples.addItem(label)
        row.addWidget(self.examples,1);plus=QPushButton('＋ 添加示例');plus.clicked.connect(self.add_example);row.addWidget(plus);layout.addLayout(row)
        self.text=QPlainTextEdit();layout.addWidget(self.text,1);self.error=QLabel();self.error.setWordWrap(True);layout.addWidget(self.error)
        buttons=QDialogButtonBox(QDialogButtonBox.Save|QDialogButtonBox.Cancel);self.save=buttons.button(QDialogButtonBox.Save);buttons.accepted.connect(self.submit);buttons.rejected.connect(self.reject);layout.addWidget(buttons)
        self.text.textChanged.connect(self.check);self.text.setPlainText(json.dumps(rule or EXAMPLES[0][1],ensure_ascii=False,indent=2))
    def check(self):
        try:self.result_rule=json.loads(self.text.toPlainText());validate_advanced(self.result_rule)
        except Exception as exc:self.save.setEnabled(False);self.error.setText('无法保存：'+str(exc));return
        self.save.setEnabled(True);self.error.setText('校验通过')
    def add_example(self):
        text=self.text.toPlainText().strip()
        try:result=json.loads(text) if text else {}
        except ValueError:
            self.error.setText('请先修正已有 JSON，或清空编辑框后添加示例。');return
        if not isinstance(result,dict):
            self.error.setText('条件必须是 JSON 对象；可清空编辑框后添加示例。');return
        example=deepcopy(EXAMPLES[self.examples.currentIndex()][1])
        if not result:result=example
        elif result.get('type')=='and' and isinstance(result.get('rules'),list):result['rules'].append(example)
        else:result={'type':'and','rules':[result,example]}
        self.text.setPlainText(json.dumps(result,ensure_ascii=False,indent=2))
    def submit(self):
        self.check()
        if self.save.isEnabled():self.accept()
