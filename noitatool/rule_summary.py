from PySide6.QtCore import Qt,QSize,Signal
from PySide6.QtWidgets import QWidget,QVBoxLayout,QLabel,QListWidget,QListWidgetItem
from .catalog import icon,data_icon,read_json
from .icon_grid import tooltip,enable_spell_inspection
from .shop_ui import wand_summary
from PySide6.QtGui import QIcon,QPainter,QPixmap

def targets(rule):
    kind=rule['type'];v=rule.get('val');result=[]
    def add(key,extra='',lottery=False):
        image=icon(key)
        if lottery:
            pixmap=QPixmap(40,40);pixmap.fill(Qt.transparent)
            painter=QPainter(pixmap);painter.drawPixmap(0,7,image.pixmap(32,32))
            painter.drawPixmap(24,0,icon('PERKS_LOTTERY').pixmap(16,16));painter.end()
            image=QIcon(pixmap)
        result.append((image,extra+tooltip(key)))
    if isinstance(v,str):add(v)
    elif kind in ('perkSet','layerSpells'):
        for key in v.get('ids',[]):
            marked=kind=='perkSet' and key in v.get('lottery',[])
            add(key,'要求博彩保留（持有 1 个天赋博彩）\n' if marked else '',marked)
        if kind=='layerSpells':
            for key in v.get('materials',[]):add(key,'药水材料\n')
    elif kind=='perk':
        seen=set()
        for mode in ('all','some','deck'):
            for row,keys in enumerate(v.get(mode,[])):
                for key in keys:
                    if (mode,row,key) not in seen:add(key,f'{"牌库" if mode=="deck" else f"第 {row+1} 座圣山"}\n');seen.add((mode,row,key))
    elif kind=='shop':
        for row,shop in enumerate(v):
            if not shop:continue
            for item in shop['items']:
                if 'spell' in item:add(item['spell'],f'第 {row+1} 座圣山\n')
                else:result.append((data_icon(read_json('wands.json')[0]),f'第 {row+1} 座圣山\n'+wand_summary(item['wand'])))
    return result

class RuleSummary(QWidget):
    edit=Signal()
    def __init__(self,rule,parent=None):
        super().__init__(parent)
        from .rules_ui import describe
        layout=QVBoxLayout(self);layout.setContentsMargins(3,1,3,1);layout.setSpacing(1)
        kind=rule['type'];text=describe(rule)
        if kind in ('perkSet','layerSpells'):text=text.split('：',1)[0]
        elif kind=='shop':text='圣山商店 · 悬停图标查看层数与条件'
        elif kind=='perk':text='天赋组合 · 悬停查看所属圣山'
        title=QLabel(text);title.setToolTip(describe(rule));layout.addWidget(title)
        images=targets(rule)
        self.grid=None
        if images:
            self.grid=QListWidget();self.grid.setViewMode(QListWidget.IconMode);self.grid.setMovement(QListWidget.Static);self.grid.setResizeMode(QListWidget.Adjust)
            enable_spell_inspection(self.grid,self)
            self.grid.setIconSize(QSize(28,28));self.grid.setGridSize(QSize(36,36))
            self.grid.setStyleSheet('QListWidget{padding:0;border:0;background:transparent}')
            height=38 if len(images)<=10 else 76 if len(images)<=20 else 112
            self.grid.setFixedHeight(height)
            for image,tip in images:
                item=QListWidgetItem(image,'');item.setToolTip(tip);item.setSizeHint(QSize(34,34));self.grid.addItem(item)
                key=next((line for line in tip.splitlines() if line in read_json('obj/spells.json') or line in read_json('obj/perks.json')),None)
                if key:item.setData(Qt.UserRole,key);item.setToolTip(tip+'\n右键查看法术详情')
            from .icon_grid import inspect_icon
            self.grid.itemDoubleClicked.connect(lambda item:inspect_icon(item,self) or self.edit.emit())
            layout.addWidget(self.grid)
        self.setMinimumHeight(30+(self.grid.height() if self.grid else 0))
    def mouseDoubleClickEvent(self,event):self.edit.emit()
