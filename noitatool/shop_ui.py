from copy import deepcopy
from PySide6.QtCore import Qt,QSize,Signal
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QListWidget,QListWidgetItem,QComboBox,QPushButton,QLabel,QStackedWidget
from .catalog import options,icon,name
from .icon_grid import SelectionField
from .wand_ui import WandFilterDialog

def wand_summary(value):
    labels={'deck_capacity':'容量','actions_per_round':'多重','reload_time':'充能(帧)','fire_rate_wait':'延迟(帧)','spread_degrees':'散射','mana_charge_speed':'回蓝','mana_max':'法力','shuffle_deck_when_empty':'乱序'}
    parts=[labels.get(k,k)+f' {v[0]:g}–{v[1]:g}' for k,v in value.get('gun',{}).items()]
    if value.get('cards'):parts.append('法术：'+'、'.join(name(k) for k in value['cards']))
    if 'permanentCard' in value:
        ac=value['permanentCard']
        parts.append('始终施放：'+('必须有' if ac is True else '不能有' if ac is None else '、'.join(name(k) for k in ac)))
    return '\n'.join(parts) or '任意属性魔杖'

class ShopEditor(QWidget):
    def __init__(self,parent=None,values=None):
        super().__init__(parent)
        self.rows=deepcopy(values or [])+[None]*7
        self.rows=self.rows[:7];self.active=-1;self.loading=False
        layout=QHBoxLayout(self)
        self.levels=QListWidget();self.levels.setFixedWidth(160)
        for i in range(7):
            item=QListWidgetItem(f'第 {i+1} 座圣山');item.setSizeHint(QSize(140,55));self.levels.addItem(item)
        layout.addWidget(self.levels)
        pane=QWidget();right=QVBoxLayout(pane);right.setContentsMargins(0,0,0,0)
        self.type=QComboBox()
        for label,v in [('不限商店',0),('魔杖商店',1),('法术商店',2)]:self.type.addItem(label,v)
        right.addWidget(self.type)
        self.spells=SelectionField(options('spells'),title='批量选择商店法术')
        self.strict=QComboBox();self.strict.addItem('必须包含全部所选法术',True);self.strict.addItem('包含任意一个所选法术',False)
        right.addWidget(self.spells);right.addWidget(self.strict)
        self.wands=QListWidget();self.wands.setIconSize(QSize(38,38));self.wands.setMaximumHeight(220)
        right.addWidget(self.wands)
        self.wandmode=QComboBox();self.wandmode.addItem('全部魔杖条件均能在该商店找到','all');self.wandmode.addItem('找到任意一种魔杖即可','any')
        right.addWidget(self.wandmode)
        actions=QHBoxLayout()
        self.add=QPushButton('＋ 添加魔杖条件');self.edit=QPushButton('编辑魔杖');self.remove=QPushButton('删除')
        for b in (self.add,self.edit,self.remove):actions.addWidget(b)
        right.addLayout(actions)
        hint=QLabel('一次选择多个法术；每座圣山可以保存多个魔杖条件。\n双击魔杖编辑完整属性，悬停查看筛选要求。');hint.setWordWrap(True);right.addWidget(hint)
        right.addStretch();layout.addWidget(pane,1)
        self.wand_values=[]
        self.levels.currentRowChanged.connect(self.switch)
        self.type.currentIndexChanged.connect(self.type_changed)
        self.spells.changed.connect(self.save_row)
        self.strict.currentIndexChanged.connect(lambda _:self.save_row())
        self.wandmode.currentIndexChanged.connect(lambda _:self.save_row())
        self.add.clicked.connect(lambda:self.edit_wand(True));self.edit.clicked.connect(lambda:self.edit_wand(False))
        self.wands.itemDoubleClicked.connect(lambda _:self.edit_wand(False));self.remove.clicked.connect(self.remove_wand)
        self.levels.setCurrentRow(0)

    def save_row(self):
        if self.loading or self.active<0:return
        kind=self.type.currentData()
        self.rows[self.active]=None if kind==0 and not self.spells.values() else {'type':kind,'strict':self.strict.currentData(),'wandMode':self.wandmode.currentData(),'items':[{'spell':s} for s in self.spells.values()] if kind!=1 else [{'wand':deepcopy(w)} for w in self.wand_values]}
        label=('不限商店 · ' if kind==0 else '')+f'{len(self.spells.values())} 法术' if kind!=1 and self.spells.values() else '不限' if not kind else f'{len(self.wand_values)} 魔杖' if kind==1 else '任意法术'
        self.levels.item(self.active).setText(f'第 {self.active+1} 座圣山\n{label}')

    def switch(self,index):
        self.save_row();self.active=max(0,index);self.loading=True
        data=self.rows[self.active] or {'type':0,'items':[]}
        self.type.setCurrentIndex(self.type.findData(data['type']))
        self.spells.set_values([v['spell'] for v in data['items'] if 'spell' in v])
        self.strict.setCurrentIndex(0 if data.get('strict',True) else 1)
        self.wandmode.setCurrentIndex(1 if data.get('wandMode')=='any' else 0)
        self.wand_values=[deepcopy(v['wand']) for v in data['items'] if 'wand' in v]
        self.refresh_wands();self.loading=False;self.type_changed()

    def type_changed(self,*_):
        kind=self.type.currentData()
        self.spells.setVisible(kind!=1);self.strict.setVisible(kind!=1)
        for widget in (self.wands,self.wandmode,self.add,self.edit,self.remove):widget.setVisible(kind==1)
        if not self.loading:self.save_row()

    def refresh_labels(self):
        for i,row in enumerate(self.rows):
            label='不限' if not row else ('不限商店 · ' if row['type']==0 else '')+f'{len(row["items"])} '+('魔杖' if row['type']==1 else '法术')
            self.levels.item(i).setText(f'第 {i+1} 座圣山\n{label}')

    def refresh_wands(self):
        self.wands.clear()
        # Use an actual upstream wand sprite as the filter's visual marker.
        from .catalog import read_json,image_url
        from PySide6.QtGui import QIcon,QPixmap
        import base64
        sprites=read_json('wands.json');first=sprites[0] if isinstance(sprites,list) else next(iter(sprites.values()))
        url=image_url(first)
        wand_icon=QIcon()
        if url:
            pix=QPixmap();pix.loadFromData(base64.b64decode(url.split(',',1)[1]));wand_icon=QIcon(pix)
        for i,w in enumerate(self.wand_values):
            item=QListWidgetItem(wand_icon,f'魔杖条件 {i+1}')
            item.setToolTip(wand_summary(w));item.setSizeHint(QSize(150,48));self.wands.addItem(item)

    def edit_wand(self,add=False):
        index=self.wands.currentRow()
        if not add and index<0:return
        dialog=WandFilterDialog(self,None if add else self.wand_values[index])
        if dialog.exec():
            if add:self.wand_values.append(dialog.result_filter)
            else:self.wand_values[index]=dialog.result_filter
            self.refresh_wands()
            self.save_row()

    def remove_wand(self):
        index=self.wands.currentRow()
        if index>=0:self.wand_values.pop(index);self.refresh_wands();self.save_row()

    def values(self):self.save_row();return deepcopy(self.rows)
