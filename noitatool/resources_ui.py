"""Separate resource categories shared by Seed Info and map selections."""
from PySide6.QtCore import Qt,QSize,QTimer,Signal
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QLabel,QLineEdit,QListWidget,QListWidgetItem,QSplitter,QGroupBox,QApplication,QDialog,QPushButton
from .catalog import name,icon
from .icon_grid import tooltip

class ResourceBrowser(QWidget):
    detailRequested=Signal(object)
    locationRequested=Signal(object)
    def __init__(self,parent=None,details_on_double_click=True):
        super().__init__(parent);self.details_on_double_click=details_on_double_click;layout=QVBoxLayout(self);layout.setContentsMargins(0,0,0,0)
        self.search=QLineEdit(placeholderText='筛选资源名称、法术、材料、坐标…');self.search.setClearButtonEnabled(True);layout.addWidget(self.search)
        split=QSplitter(Qt.Horizontal);layout.addWidget(split,1);self.lists={};self.titles={}
        for kind,label in [('wand','法杖'),('spell','法术'),('potion','药水 / 粉末袋'),('other','其它 · 生命 / 宝箱等')]:
            group=QGroupBox(label);box=QVBoxLayout(group);box.setContentsMargins(6,12,6,6)
            listing=QListWidget();listing.setViewMode(QListWidget.IconMode);listing.setResizeMode(QListWidget.Adjust);listing.setMovement(QListWidget.Static)
            listing.setIconSize(QSize(34,34));listing.setGridSize(QSize(78,78));listing.setUniformItemSizes(True);listing.setWordWrap(False)
            listing.setMinimumWidth(120);box.addWidget(listing);split.addWidget(group)
            self.lists[kind]=listing;self.titles[kind]=group
            listing.itemClicked.connect(lambda item,k=kind:self.schedule(k,item))
            listing.itemDoubleClicked.connect(lambda item,k=kind:self.locate(k,item))
        split.setSizes([320,320,240,240]);self.wands=self.lists['wand'];self.spells=self.lists['spell'];self.potions=self.lists['potion'];self.others=self.lists['other']
        self.click_timer=QTimer(self);self.click_timer.setSingleShot(True);self.click_timer.timeout.connect(lambda:self.detailRequested.emit(self.pending))
        self.search.textChanged.connect(self.filter);self.ignore_until=0
    def object_for(self,kind,item):return item.data(Qt.UserRole+1) if kind=='spell' else item.data(Qt.UserRole)
    def schedule(self,kind,item):
        import time
        if time.monotonic()<self.ignore_until:return
        self.pending=self.object_for(kind,item);self.click_timer.start(QApplication.doubleClickInterval()+30)
    def locate(self,kind,item):
        import time
        self.click_timer.stop();self.ignore_until=time.monotonic()+QApplication.doubleClickInterval()/1000+.15
        if self.details_on_double_click:self.detailRequested.emit(self.object_for(kind,item))
        self.locationRequested.emit(self.object_for(kind,item))
    def clear(self):
        self.click_timer.stop()
        for listing in self.lists.values():listing.clear()
        self.filter()
    def set_resources(self,items,evidence=(),ids=()):
        from .map_ui import poi_icon,map_wand,price_label,poi_title
        self.clear();locations={}
        for p in evidence:locations.setdefault(p['id'],[]).append(p)
        for obj in items:
            kind=obj.get('type')
            if kind=='wand':
                wand=map_wand(obj);cards=wand['cards'].get('cards',[]);permanent=wand['cards'].get('permanentCard') or []
                if isinstance(permanent,str):permanent=[permanent]
                for key in cards+permanent:locations.setdefault(key,[]).append(obj)
                gun=wand['gun'];caption=f'容量 {int(gun.get("deck_capacity",0))}'
                contents='、'.join(name(k) for k in cards+permanent)
            elif kind=='potion':caption=name(obj['material']) if obj.get('material') else poi_title(obj);contents=caption
            elif kind=='spell':
                locations.setdefault(obj['spell'],[]).append(obj);continue
            elif kind in ('chest','pickup'):
                kind='other';caption=poi_title(obj);contents=caption
            else:continue
            tip=f'世界 {obj.get("worldOffset",0)} · ({obj["x"]:g}, {obj["y"]:g})\n{contents}\n{price_label(obj)}\n单击详情 / 双击地图定位'
            item=QListWidgetItem(poi_icon(obj),caption);item.setData(Qt.UserRole,obj);item.setToolTip(tip);item.setSizeHint(QSize(74,74));self.lists[kind].addItem(item)
        for key in sorted(set(ids)|set(locations)):
            points=locations.get(key,[])
            if not points:continue
            point=next((p for p in points if p.get('type')=='spell'),points[0]);obj=dict(point,type='spell',spell=key)
            from .biome_names import biome_name
            tip=tooltip(key)+'\n\n'+'\n'.join(f'世界 {p.get("worldOffset",0)} · ({p["x"]:g}, {p["y"]:g}) · {biome_name(p.get("source",""))}' for p in points[:30])+'\n单击详情 / 双击定位首个来源'
            item=QListWidgetItem(icon(key),name(key));item.setData(Qt.UserRole,key);item.setData(Qt.UserRole+1,obj);item.setToolTip(tip);item.setSizeHint(QSize(74,74));self.spells.addItem(item)
        self.filter()
    def filter(self,*_):
        query=self.search.text().strip().casefold()
        labels={'wand':'法杖','spell':'法术（含杖内 / 始终施放）','potion':'药水 / 粉末袋','other':'其它 · 生命 / 宝箱等'}
        for kind,listing in self.lists.items():
            shown=0
            for i in range(listing.count()):
                item=listing.item(i);item.setHidden(query not in (item.text()+' '+item.toolTip()).casefold());shown+=not item.isHidden()
            self.titles[kind].setTitle(f'{labels[kind]} · {shown} / {listing.count()}')

class ResourceDialog(QDialog):
    def __init__(self,title,items,detail,locate,search,parent=None,precise=None):
        super().__init__(parent);self.setWindowTitle(title);self.resize(1120,700)
        layout=QVBoxLayout(self);layout.addWidget(QLabel(title))
        self.browser=ResourceBrowser();self.browser.set_resources(items);layout.addWidget(self.browser,1)
        self.browser.detailRequested.connect(detail);self.browser.locationRequested.connect(locate)
        row=QHBoxLayout();row.addStretch();layout.addLayout(row)
        if precise:
            b=QPushButton('地图精细查看');b.clicked.connect(precise);row.addWidget(b)
        b=QPushButton('将此区域用于搜索');b.clicked.connect(search);row.addWidget(b)
        b=QPushButton('关闭');b.clicked.connect(self.close);row.addWidget(b)
        if self.screen():self.resize(min(1120,self.screen().availableGeometry().width()-60),min(700,self.screen().availableGeometry().height()-80))
    def closeEvent(self,event):self.browser.click_timer.stop();super().closeEvent(event)
