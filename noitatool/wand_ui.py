from copy import deepcopy
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QDialog,QVBoxLayout,QFormLayout,QHBoxLayout,QWidget,QComboBox,QDoubleSpinBox,QLabel,QDialogButtonBox
from .catalog import options
from .icon_grid import SelectionField
from .range_slider import RangeSlider

PROPS=[('deck_capacity','容量',0,100,1),('actions_per_round','法术数 / 施放',1,100,1),('reload_time','充能时间（秒）',0,30,60),('fire_rate_wait','施放延迟（秒）',-5,30,60),('spread_degrees','散射（度）',-180,180,1),('mana_charge_speed','回蓝 / 秒',0,10000,1),('mana_max','法力最大值',0,100000,1),('speed_multiplier','速度倍率',0,20,1)]

class WandFilterDialog(QDialog):
    def __init__(self,parent=None,value=None):
        super().__init__(parent)
        self.setWindowTitle('魔杖搜索 · 属性、始终施放与法术')
        self.resize(720,790)
        self.original=deepcopy(value or {'gun':{},'cards':[],'cardsStrict':True})
        value=self.original
        layout=QVBoxLayout(self)
        form=QFormLayout()
        self.shuffle=QComboBox()
        for label,v in [('任何乱序',None),('非乱序',0),('乱序',1)]:self.shuffle.addItem(label,v)
        sh=value.get('gun',{}).get('shuffle_deck_when_empty')
        if sh and sh[0]==sh[1]:self.shuffle.setCurrentIndex(self.shuffle.findData(sh[0]))
        form.addRow('乱序',self.shuffle)
        self.acmode=QComboBox()
        for label,v in [('始终施放：任何','any'),('必须有始终施放','must'),('不能有始终施放','none'),('指定始终施放法术','specific')]:self.acmode.addItem(label,v)
        ac=value.get('permanentCard')
        mode='specific' if isinstance(ac,list) else 'must' if ac is True else 'none' if 'permanentCard' in value and ac is None else 'any'
        self.acmode.setCurrentIndex(self.acmode.findData(mode));form.addRow('始终施放',self.acmode)
        self.ranges={}
        for key,label,low,high,scale in PROPS:
            row=QWidget();line=QHBoxLayout(row);line.setContentsMargins(0,0,0,0)
            boxes=[]
            initial=value.get('gun',{}).get(key,[low*scale,high*scale])
            for i in range(2):
                box=QDoubleSpinBox();box.setDecimals(2 if scale==60 or key=='speed_multiplier' else 0)
                box.setRange(min(low,initial[0]/scale),max(high,initial[1]/scale));box.setValue(initial[i]/scale)
                line.addWidget(box);boxes.append(box)
                if i==0:line.addWidget(QLabel('—'))
            slider=RangeSlider(min(low,initial[0]/scale),max(high,initial[1]/scale),boxes[0].value(),boxes[1].value())
            line.insertWidget(0,slider,1)
            for b in boxes:b.setFixedWidth(88)
            def changed(a,b,fields=boxes):
                for field,value in zip(fields,(a,b)):
                    field.blockSignals(True);field.setValue(value);field.blockSignals(False)
            slider.changed.connect(changed)
            for b in boxes:b.valueChanged.connect(lambda _,fields=boxes,s=slider:s.set_values(fields[0].value(),fields[1].value()))
            self.ranges[key]=(boxes,scale,(low,high))
            form.addRow(label,row)
        layout.addLayout(form)
        self.ac=SelectionField(options('spells'),ac if isinstance(ac,list) else [],title='选择始终施放法术')
        layout.addWidget(self.ac)
        self.acmode.currentIndexChanged.connect(lambda _:self.ac.setVisible(self.acmode.currentData()=='specific'))
        self.ac.setVisible(mode=='specific')
        self.cards=SelectionField(options('spells'),value.get('cards',[]),title='选择魔杖内法术')
        layout.addWidget(self.cards)
        self.match=QComboBox()
        self.match.addItem('必须包含全部所选法术',True);self.match.addItem('包含任意一个所选法术',False)
        self.match.setCurrentIndex(0 if value.get('cardsStrict',True) else 1)
        layout.addWidget(self.match)
        layout.addStretch()
        self.error=QLabel();layout.addWidget(self.error)
        buttons=QDialogButtonBox(QDialogButtonBox.Ok|QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.submit);buttons.rejected.connect(self.reject);layout.addWidget(buttons)

    def value(self):
        gun={k:v for k,v in self.original.get('gun',{}).items() if k not in dict((p[0],None) for p in PROPS) and k!='shuffle_deck_when_empty'}
        for key,(boxes,scale,defaults) in self.ranges.items():
            low,high=[b.value() for b in boxes]
            if low>high:raise ValueError('最小值不能大于最大值')
            if (low,high)!=defaults or key in self.original.get('gun',{}):gun[key]=[low*scale,high*scale]
        if self.shuffle.currentData() is not None:gun['shuffle_deck_when_empty']=[self.shuffle.currentData()]*2
        value={**self.original,'gun':gun,'cards':self.cards.values(),'cardsStrict':self.match.currentData()}
        value.pop('permanentCard',None)
        mode=self.acmode.currentData()
        if mode=='must':value['permanentCard']=True
        elif mode=='none':value['permanentCard']=None
        elif mode=='specific':
            if not self.ac.values():raise ValueError('请选择始终施放法术')
            value['permanentCard']=self.ac.values()
        return value

    def submit(self):
        try:self.result_filter=self.value();self.accept()
        except ValueError as exc:self.error.setText(str(exc))
