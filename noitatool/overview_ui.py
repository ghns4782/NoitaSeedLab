import json
from pathlib import Path
from PySide6.QtCore import Qt,QSize,Signal
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QGridLayout,QLabel,QTableWidget,QHeaderView,QToolButton,QDialog,QTextBrowser,QDialogButtonBox,QSplitter,QListWidget,QListWidgetItem,QGroupBox,QScrollArea
from PySide6.QtGui import QPixmap
from .catalog import icon,data_icon,item_icon,name,tr
from .icon_grid import tooltip
from .paths import ROOT
from .info_html import document,render,strip_assets
from .detail_ui import ChestCard,ItemDialog,show_wand

def icon_button(image,tip,callback=None,size=30):
    from .detail_ui import InspectButton
    b=InspectButton();b.setIcon(image);b.setIconSize(QSize(size,size));b.setFixedSize(size+7,size+7);b.setToolTip(tip)
    b.setStyleSheet('QToolButton{border:1px solid transparent;border-radius:4px;padding:0;background:transparent}QToolButton:hover{background:#35445b;border-color:#8ed1c5}')
    if callback:b.clicked.connect(callback)
    return b

class SeedOverview(QWidget):
    def __init__(self,parent=None,rerolls=()):
        super().__init__(parent)
        layout=QVBoxLayout(self);layout.setContentsMargins(8,8,8,8);layout.setSpacing(8)
        self.hint=QLabel('输入种子，七座圣山和世界概况将在这里同时显示。')
        layout.addWidget(self.hint)
        split=QSplitter();scroll=QScrollArea();scroll.setWidgetResizable(True);scroll.setWidget(split);layout.addWidget(scroll,1)
        split.setMinimumWidth(914);split.setMinimumHeight(510)
        left=QWidget();left.setMinimumWidth(650);ll=QVBoxLayout(left);ll.setContentsMargins(0,0,6,0);ll.setSpacing(6)
        self.table=QTableWidget(7,5)
        self.table.setHorizontalHeaderLabels(['层','商店 · 点击展开','和平宝箱','天赋 · 悬停查看','重抽'])
        self.table.verticalHeader().hide();self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setSelectionMode(QTableWidget.NoSelection)
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(0,QHeaderView.Fixed);self.table.setColumnWidth(0,38)
        self.table.horizontalHeader().setSectionResizeMode(2,QHeaderView.Fixed);self.table.setColumnWidth(2,130)
        self.table.horizontalHeader().setSectionResizeMode(4,QHeaderView.Fixed);self.table.setColumnWidth(4,64)
        for i,box in enumerate(rerolls):self.table.setCellWidget(i,4,box)
        for i in range(7):self.table.setRowHeight(i,68)
        self.table.setMinimumHeight(300);ll.addWidget(self.table,1)
        self.bottom=QWidget();self.bottom_layout=QGridLayout(self.bottom);self.bottom_layout.setContentsMargins(0,0,0,0)
        ll.addWidget(self.bottom,0);split.addWidget(left)
        right=QWidget();right.setMinimumWidth(250);rl=QVBoxLayout(right);rl.setContentsMargins(6,0,0,0)
        rl.addWidget(QLabel('真菌转移 · 来源 → 目标（持瓶标记）'))
        self.fungal=QListWidget();self.fungal.setWordWrap(True);self.fungal.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff);rl.addWidget(self.fungal,1)
        self.environment=QLabel();self.environment.setWordWrap(True);rl.addWidget(self.environment)
        self.cave=QLabel();self.cave.setAlignment(Qt.AlignCenter);rl.addWidget(self.cave)
        split.addWidget(right);split.setSizes([730,300])
        self.data=None

    def update_info(self,seed,data):
        self.data=data;self.seed=seed
        self.hint.setText(f'种子 {seed}  ·  七座圣山一览  ·  点击商店或宝箱查看详情')
        for row in range(7):
            number=QLabel(str(row+1));number.setAlignment(Qt.AlignCenter);self.table.setCellWidget(row,0,number)
            shop=QWidget();grid=QGridLayout(shop);grid.setContentsMargins(2,1,2,1);grid.setSpacing(0)
            value=data['shop'][row] if row<len(data['shop']) else {'items':[],'type':0}
            for j,item in enumerate(value['items']):
                if value['type']==2:
                    key=item['spell']['id'];image=icon(key);tip=tooltip(key)+f'\n价格：{item.get("cost",item.get("price","?"))} 金币'
                else:
                    image=data_icon(item.get('ui',{}));gun=item['gun'];tip=('乱序' if gun.get('shuffle_deck_when_empty') else '非乱序')+f'\n容量 {gun.get("deck_capacity",0):.0f} · 法力 {gun.get("mana_max",0):.0f}\n回蓝 {gun.get("mana_charge_speed",0):.0f} · 充能 {gun.get("reload_time",0)/60:.2f}s\n'+'、'.join(name(k) for k in item.get('cards',{}).get('cards',[]))
                b=icon_button(image,tip,(lambda _,k=item:self.show_spell(k)) if value['type']==2 else (lambda _,w=item:show_wand(w,self)),size=26 if value['type']==2 else 32)
                grid.addWidget(b,j//5,j%5)
            self.table.setCellWidget(row,1,shop)
            items=data.get('pacifistChest',[[]]*7)[row]
            self.table.setCellWidget(row,2,ChestCard(items,self,compact=True))
            from .detail_ui import chest_entries
            self.table.setRowHeight(row,max(68,((len(chest_entries(items))+1)//2)*66))
            perks=QWidget();pl=QHBoxLayout(perks);pl.setContentsMargins(2,0,2,0);pl.setSpacing(5)
            for index,perk in enumerate(data['perk'][row] if row<len(data['perk']) else []):
                from .detail_ui import show_perk
                button=icon_button(icon(perk['id']),tooltip(perk['id']),lambda _,k=perk['id']:show_perk(k,self),size=38)
                if data.get('perkLottery',[[]]*7)[row] and data['perkLottery'][row][index]:
                    badge=QLabel(button);badge.setPixmap(icon('PERKS_LOTTERY').pixmap(16,16));badge.setGeometry(29,0,16,16);badge.setAttribute(Qt.WA_TransparentForMouseEvents)
                    button.setToolTip(button.toolTip()+'\n天赋博彩：拾取此天赋后其他天赋不会消失（持有 1 个天赋博彩时预览）')
                pl.addWidget(button)
            pl.addStretch();self.table.setCellWidget(row,3,perks)
        while self.bottom_layout.count():
            item=self.bottom_layout.takeAt(0)
            if item.widget():item.widget().deleteLater()
        start=QGroupBox('开局配置');sl=QHBoxLayout(start)
        for key in ('startingSpell','startingBombSpell','startingFlask'):
            from .detail_ui import show_spell,show_pickup
            sl.addWidget(icon_button(icon(data[key]),tooltip(data[key]),(lambda _,k=data[key]:show_spell(k,self)) if key!='startingFlask' else (lambda _,k=data[key]:show_pickup('potion',k,self)),size=29))
        self.bottom_layout.addWidget(start,0,0)
        for col,(key,label) in enumerate([('LC','活力合剂'),('AP','炼金先驱')],1):
            group=QGroupBox(label);gl=QVBoxLayout(group);gl.setSpacing(1)
            for mat in data['alchemy'][key]:
                line=QWidget();hl=QHBoxLayout(line);hl.setContentsMargins(0,0,0,0);hl.addWidget(icon_button(icon(mat),tooltip(mat),size=15));hl.addWidget(QLabel(name(mat)),1);gl.addWidget(line)
            self.bottom_layout.addWidget(group,0,col)
        self.fungal.clear()
        for i,v in enumerate(data['fungalShift']):
            from .environment_ui import shift_tooltip
            suffix=' · 持瓶作来源' if v['flaskFrom'] else ' · 持瓶作目标' if v['flaskTo'] else ''
            text=f'{i+1:02d}  '+ ' / '.join(name(k) for k in v['from'])+' → '+name(v['to'])+suffix
            item=QListWidgetItem(icon(v['to']),text);item.setToolTip(shift_tooltip(v));item.setSizeHint(QSize(260,76));self.fungal.addItem(item)
        weather=data['weather'];self.environment.setText('天气：'+name(weather.get('rain_material',''))+f'  雾 {weather.get("fog",0):.0%} / 云 {weather.get("clouds",0):.0%}\n水洞布局 '+str(data['waterCave']+1))
        path=ROOT/'vendor/noita-telescope-main/data/pixel_scenes/general'/f'watercave_layout_{data["waterCave"]+1}.png'
        if path.exists():self.cave.setPixmap(QPixmap(str(path)).scaled(145,100,Qt.KeepAspectRatio,Qt.FastTransformation))

    def show_detail(self,title,content):
        dlg=QDialog(self);dlg.setWindowTitle(title);dlg.resize(850,650);layout=QVBoxLayout(dlg)
        browser=QTextBrowser();browser.setHtml(document(content));layout.addWidget(browser)
        buttons=QDialogButtonBox(QDialogButtonBox.Close);buttons.rejected.connect(dlg.reject);layout.addWidget(buttons);dlg.exec()

    def show_spell(self,item):
        from .detail_ui import show_spell
        show_spell(item['spell']['id'],self,item.get('price',item.get('cost')))

    def shop_detail(self,row):
        from .detail_ui import ShopCard
        card=ShopCard(self.data['shop'][row],self)
        ItemDialog(f'第 {row+1} 座圣山 · 商店',card,self).exec()

    def chest_detail(self,row):
        ItemDialog(f'第 {row+1} 座圣山 · 和平宝箱',ChestCard(self.data['pacifistChest'][row]),self).exec()
