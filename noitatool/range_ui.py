"""Unified selectable resource areas and a map-based range picker."""
import base64
import json
from copy import deepcopy
from PySide6.QtCore import Qt,Signal,QRectF
from PySide6.QtGui import QPixmap,QPainterPath,QPen,QColor
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QGridLayout,QCheckBox,QLabel,QPushButton,QScrollArea,QDialog,QDialogButtonBox,QComboBox,QSplitter,QListWidget,QListWidgetItem,QProgressBar
from .areas import PRESETS,MAIN_BIOMES,main_range,validate_area
from .biome_names import region_label


def range_key(area):
    if area.get('kind')=='layer':return 'layer:'+str(area['layer'])+':'+area.get('scope','main')
    geometry={k:area[k] for k in ('kind','bounds','biomes','cells') if k in area};geometry['verticalIndex']=area.get('verticalIndex',0)
    return json.dumps(geometry,sort_keys=True)


class RangeSelector(QWidget):
    changed=Signal()
    def __init__(self,parent=None):
        super().__init__(parent);self.entries=[];self.checks=[];self.map_dialog=None
        layout=QVBoxLayout(self);layout.setContentsMargins(0,0,0,0)
        row=QHBoxLayout();self.summary=QLabel();row.addWidget(self.summary,1)
        self.clear_button=QPushButton('取消全选');self.clear_button.setToolTip('取消所有标准区域和临时范围的勾选，保留范围以便重新选择。');row.addWidget(self.clear_button)
        self.map_button=QPushButton('地图选区 / 添加特定范围…');row.addWidget(self.map_button);layout.addLayout(row)
        scroll=QScrollArea();scroll.setWidgetResizable(True);scroll.setMinimumHeight(170);scroll.setMaximumHeight(255)
        self.scroll=scroll
        content=QWidget();self.grid=QGridLayout(content);self.grid.setContentsMargins(4,4,4,4);scroll.setWidget(content);layout.addWidget(scroll)
        for i in range(7):self.add_range(main_range(i),i==0)
        for area in PRESETS:self.add_range(area,False)
        owner=self.window()
        while owner and not hasattr(owner,'custom_ranges'):owner=owner.parentWidget()
        for area in getattr(owner,'custom_ranges',[]):self.add_range(area,False)
        self.map_button.clicked.connect(self.open_map);self.clear_button.clicked.connect(self.clear_selection);self.refresh()

    def add_range(self,area,checked=True):
        key=range_key(area)
        for i,entry in enumerate(self.entries):
            if range_key(entry)==key:
                self.checks[i].setChecked(checked);return self.checks[i]
        area=deepcopy(area);label=area.get('label','特定范围')
        if area.get('kind')!='layer' and not area.get('id'):label='临时范围 · '+label
        check=QCheckBox(label);check.setChecked(checked)
        if area.get('bounds'):
            x1,y1,x2,y2=area['bounds'];check.setToolTip(f'{label}\nX: {x1:g} 至 {x2:g}\nY: {y1:g} 至 {y2:g}\n坐标相对所选平行世界；左 / 上边界包含，右 / 下边界不包含。')
        else:check.setToolTip(label+'\n按生成种子的实际生态区过滤，包含对应下方圣山。')
        self.entries.append(area);self.checks.append(check)
        custom=[i for i,a in enumerate(self.entries) if a.get('kind')!='layer' and not a.get('id')]
        order=custom+[i for i in range(len(self.entries)) if i not in custom]
        for c in self.checks:self.grid.removeWidget(c)
        for slot,i in enumerate(order):self.grid.addWidget(self.checks[i],slot//2,slot%2)
        check.toggled.connect(self.refresh);self.refresh();return check

    def values(self):return [deepcopy(a) for a,c in zip(self.entries,self.checks) if c.isChecked()]
    def clear_selection(self):
        for check in self.checks:
            check.blockSignals(True);check.setChecked(False);check.blockSignals(False)
        self.refresh()
    def set_values(self,ranges):
        for c in self.checks:c.setChecked(False)
        for area in ranges:self.add_range(area)
        self.refresh()
    def refresh(self,*_):
        self.summary.setText(f'已选 {sum(c.isChecked() for c in self.checks)} 个范围 · 合并统计')
        self.changed.emit()
    def open_map(self):
        dialog=RangeMapDialog(self);self.map_dialog=dialog;dialog.exec();self.map_dialog=None
    def add_custom(self,area):
        validate_area(area);check=self.add_range(area)
        self.scroll.verticalScrollBar().setValue(0)
        owner=self.window().parentWidget()
        # RuleDialog is parented to the main window; retain additions for this run.
        while owner and not hasattr(owner,'custom_ranges'):owner=owner.parentWidget()
        if owner is not None and all(range_key(a)!=range_key(area) for a in owner.custom_ranges):owner.custom_ranges.append(deepcopy(area))


class RangeMapDialog(QDialog):
    generationProgress=Signal(object)
    def __init__(self,selector):
        super().__init__(selector);self.selector=selector;self.data=None;self.highlights=[];self.terrain_layer=None;self.terrain_item=None;self.overlay_item=None
        self.setWindowTitle('选择搜索范围 · 点击区域勾选，或添加多个框选');self.resize(1120,800)
        if self.screen():self.resize(min(1120,self.screen().availableGeometry().width()-40),min(800,self.screen().availableGeometry().height()-60))
        layout=QVBoxLayout(self);row=QHBoxLayout();layout.addLayout(row)
        self.mode=QComboBox();self.mode.addItem('点击区域 · 切换勾选','biome');self.mode.addItem('添加特定范围 · 拖动框选','rect');self.mode.addItem('拖动地图','pan');row.addWidget(self.mode)
        self.load=QPushButton('载入当前种子地图');row.addWidget(self.load)
        fit=QPushButton('适应地图');row.addWidget(fit);row.addStretch()
        reference=QPushButton('实景总览参考');row.addWidget(reference)
        from .offline_map import show_offline_map
        reference.clicked.connect(lambda:show_offline_map(self))
        self.clear_button=QPushButton('取消全选');self.clear_button.setToolTip('取消所有区域和临时范围的勾选。');self.clear_button.clicked.connect(selector.clear_selection);row.addWidget(self.clear_button)
        self.status=QLabel('载入地图后点击区域，或框选多个范围。标准区域按每个种子的实际生态区搜索；特定框选按固定坐标搜索。');self.status.setWordWrap(True);layout.addWidget(self.status)
        from .preferences import read_preferences
        prefs=read_preferences();background=QHBoxLayout();self.real_background=QCheckBox('实景图片底图');self.real_background.setChecked(prefs.get('real_background',True));background.addWidget(self.real_background)
        self.clear_background=QCheckBox('清晰像素显示 · LOD 分块');self.clear_background.setChecked(prefs.get('clear_background',True));background.addWidget(self.clear_background);background.addStretch();layout.addLayout(background)
        self.progress=QProgressBar();self.progress.hide();self.progress.setMinimumHeight(20);layout.addWidget(self.progress);self.generationProgress.connect(self.update_generation_progress)
        self.progress.setTextVisible(False)
        from .map_ui import MapCanvas
        split=QSplitter(Qt.Horizontal);layout.addWidget(split,1)
        self.canvas=MapCanvas();split.addWidget(self.canvas);self.canvas.set_selection_mode('biome')
        from PySide6.QtCore import QTimer
        self.tile_timer=QTimer(self);self.tile_timer.setSingleShot(True);self.tile_timer.setInterval(25);self.tile_timer.timeout.connect(self.refresh_tiles);self.canvas.changed.connect(lambda:self.tile_timer.start())
        self.real_background.toggled.connect(self.background_changed);self.clear_background.toggled.connect(self.background_changed)
        self.finished.connect(lambda _:self.tile_timer.stop())
        self.finished.connect(self.release_tiles)
        self.range_list=QListWidget();self.range_list.setMinimumWidth(200);self.range_list.setWordWrap(True);self.range_list.setTextElideMode(Qt.ElideNone);self.range_list.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff);split.addWidget(self.range_list);split.setSizes([800,280])
        self.range_list.itemChanged.connect(self.toggle_list)
        self.mode.currentIndexChanged.connect(lambda:self.canvas.set_selection_mode(self.mode.currentData()))
        self.canvas.areaClicked.connect(self.pick);self.canvas.areaSelected.connect(self.rectangle)
        fit.clicked.connect(self.fit);self.load.clicked.connect(self.load_map)
        self.checked=QLabel();self.checked.setWordWrap(True);layout.addWidget(self.checked)
        buttons=QDialogButtonBox(QDialogButtonBox.Close);buttons.rejected.connect(self.reject);layout.addWidget(buttons)
        selector.changed.connect(self.highlight)
        self.finished.connect(lambda _:self.selector.changed.disconnect(self.highlight))
        self.owner=selector.window().parentWidget()
        while self.owner and not hasattr(self.owner,'map_page'):self.owner=self.owner.parentWidget()
        from .paths import ROOT
        try:
            data=json.loads((ROOT/'assets/region-overview.json').read_text(encoding='utf-8'))
            data['image']=base64.b64encode((ROOT/'assets/region-overview.png').read_bytes()).decode()
            self.display(data)
        except (OSError,ValueError):
            data=getattr(getattr(self.owner,'map_page',None),'data',None)
            if data:self.display(data)
            elif self.owner:self.load_map()
            else:self.status.setText('内置参考地图缺失；请从主窗口载入种子地图。')

    def load_map(self):
        if not self.owner:return
        from .engine import valid_seed
        from shiboken6 import isValid
        try:
            seed=valid_seed(self.owner.seed.text());world=self.owner.world.value()
        except Exception as exc:self.status.setText(str(exc));return
        self.load.setEnabled(False);self.status.setText(f'正在载入种子 {seed} · 世界 {world}；生成后可反复选区。')
        self.progress.setValue(0);self.progress.show()
        def display(data):
            if isValid(self) and self.isVisible():self.load.setEnabled(True);self.display(data)
        self.owner.start_job(lambda:self.owner.view_session.request(op='map',seed=seed,worldOffset=world,verticalIndex=0,on_progress=self.generationProgress.emit),display,lambda:self.load.setEnabled(True) if isValid(self) else None)

    def update_generation_progress(self,packet):
        self.progress.setValue(packet['value']);self.progress.setFormat(packet['phase']+' · %p%');self.status.setText(packet['phase']+f' · {packet["value"]}%')

    def display(self,data):
        self.data=data;self.canvas.scene().clear();self.highlights=[];self.canvas.rubber=None;self.canvas.selection_start=None
        self.canvas.scene().setSceneRect(QRectF(*data['origin'],data['width'],data['height']))
        self.draw_terrain()
        self.status.setText(f'地图种子 {data["seed"]} · 世界 {data["worldOffset"]} · 点击区域切换勾选；框选会新增“特定范围”，悬停选项可看 X / Y。')
        if data.get('bundledReference'):self.status.setText('实景底图与游戏坐标已校准 · 内置选区边界参考种子 1234；实际搜索按目标种子生成。可载入当前种子更新边界；框选按所标坐标搜索。')
        self.fit();self.highlight()
        self.progress.hide()
        self.refresh_tiles()
    def background_changed(self,*_):
        from .preferences import set_preference
        set_preference('real_background',self.real_background.isChecked());set_preference('clear_background',self.clear_background.isChecked())
        if self.data:self.draw_terrain();self.refresh_tiles()
    def draw_terrain(self):
        from shiboken6 import isValid,delete
        if self.overlay_item and isValid(self.overlay_item):self.canvas.scene().removeItem(self.overlay_item);delete(self.overlay_item)
        self.overlay_item=None
        if self.terrain_layer:self.terrain_layer.detach();self.terrain_layer=None
        if self.terrain_item and isValid(self.terrain_item):self.canvas.scene().removeItem(self.terrain_item);delete(self.terrain_item)
        self.terrain_item=None
        if self.real_background.isChecked():
            from .real_terrain import reference_capture
            self.terrain_layer=reference_capture(self.data['seed'],self.data['worldOffset'],self.clear_background.isChecked());self.terrain_layer.install(self.canvas.scene(),extend=False)
            from .terrain_overlay import install_overlay
            self.overlay_item=install_overlay(self.canvas.scene(),self.data)
        else:
            pix=QPixmap();pix.loadFromData(base64.b64decode(self.data['image']));self.terrain_item=self.canvas.scene().addPixmap(pix);self.terrain_item.setScale(self.data['scale']);self.terrain_item.setPos(*self.data['origin']);self.terrain_item.setZValue(-100)
    def refresh_tiles(self):
        if self.terrain_layer:self.terrain_layer.refresh(self.canvas)
    def release_tiles(self,*_):
        self.tile_timer.stop()
        if self.terrain_layer:self.terrain_layer.detach()
        self.canvas.scene().clear();self.highlights=[];self.terrain_item=None;self.overlay_item=None;self.data=None
    def fit(self):
        if self.data:
            self.canvas.fitInView(QRectF(self.data['worldOffset']*35840-12000,-800,28000,17000),Qt.KeepAspectRatio)
    def pick(self,point):
        if not self.data:return
        import math
        world=self.data['worldOffset'];cx=math.floor((point.x()-world*35840+17920)/512)
        region=next((a for a in reversed(self.data.get('regions',[])) if [cx,math.floor((point.y()+7168-a.get('verticalIndex',0)*24570)/512)] in a['cells']),None)
        if not region:return
        biome=region['biomes'][0];chosen=None
        if region.get('verticalIndex',0)==0:
            # Dedicated side regions have their own checkbox; they do not toggle a whole depth band.
            chosen=next((a for a in PRESETS if biome in a['biomes'] and a['bounds'][0]<=point.x()-world*35840<a['bounds'][2] and a['bounds'][1]<=point.y()<a['bounds'][3] and (not a.get('cells') or [cx,math.floor((point.y()+7168)/512)] in a['cells'])),None)
            if chosen is None:chosen=next((main_range(i) for i,ids in enumerate(MAIN_BIOMES) if biome in ids),None)
            if chosen is None and biome.startswith('temple_'):
                center=(region['bounds'][1]+region['bounds'][3])/2
                chosen=next((main_range(i) for i,(low,high) in enumerate(zip([0,1536,3072,5120,6656,8704,10752],[1536,3072,5120,6656,8704,10752,13312])) if low<=center<high),None)
        if chosen is None:
            if biome.startswith('solid_wall'):return
            chosen=deepcopy(region);chosen['label']=region_label(region)
            x,y=min(region['cells']);chosen['id']=f'geo:{biome}:{region.get("verticalIndex",0)}:{x}:{y}'
        key=range_key(chosen)
        for entry,check in zip(self.selector.entries,self.selector.checks):
            if range_key(entry)==key:check.setChecked(not check.isChecked());return
        self.selector.add_custom(chosen)
    def rectangle(self,rect):
        if not self.data:return
        rect=rect.intersected(QRectF(*self.data['origin'],self.data['width'],self.data['height']))
        if rect.isEmpty():return
        offset=self.data['worldOffset']*35840
        count=sum(a.get('kind')=='rect' for a in self.selector.entries)+1
        area={'kind':'rect','label':f'框选 {count}','bounds':[rect.left()-offset,rect.top(),rect.right()-offset,rect.bottom()],'verticalIndex':self.data.get('verticalIndex',0)}
        self.selector.add_custom(area)
    def highlight(self,*_):
        ranges=self.selector.values();self.checked.setText('当前勾选：'+('、'.join(a.get('label','特定范围') for a in ranges) or '无'))
        self.range_list.blockSignals(True);self.range_list.clear()
        for i,check in enumerate(self.selector.checks):
            item=QListWidgetItem(check.text());item.setData(Qt.UserRole,i);item.setFlags(item.flags()|Qt.ItemIsUserCheckable);item.setCheckState(check.checkState());item.setToolTip(check.toolTip());self.range_list.addItem(item)
        self.range_list.blockSignals(False)
        if not self.data:return
        scene=self.canvas.scene()
        for item in self.highlights:scene.removeItem(item)
        self.highlights=[];offset=self.data['worldOffset']*35840
        for area in ranges:
            path=QPainterPath()
            if area['kind']=='rect':
                x1,y1,x2,y2=area['bounds'];path.addRect(QRectF(offset+x1,y1,x2-x1,y2-y1))
            else:
                for region in self.data.get('regions',[]):
                    if area['kind']=='layer':
                        low=[0,1536,3072,5120,6656,8704,10752][area['layer']];high=[1536,3072,5120,6656,8704,10752,13312][area['layer']]
                        match=region.get('verticalIndex',0)==0 and (any(k in MAIN_BIOMES[area['layer']] for k in region['biomes']) or region['biomes'][0].startswith('temple_'))
                    else:
                        low,high=area['bounds'][1],area['bounds'][3];match=bool(set(region['biomes'])&set(area['biomes'])) and region.get('verticalIndex',0)==area.get('verticalIndex',0)
                    if not match:continue
                    for x,y in region['cells']:
                        sy=y*512-7168+region.get('verticalIndex',0)*24570
                        if sy+512<=low or sy>=high or (area.get('cells') and [x,y] not in area['cells']):continue
                        cell=QRectF(offset+x*512-17920,sy,512,512)
                        if area['kind']!='layer':
                            x1,y1,x2,y2=area['bounds'];cell=cell.intersected(QRectF(offset+x1,y1,x2-x1,y2-y1))
                        path.addRect(cell)
            pen=QPen(QColor('#ffd37b'),1.5);pen.setCosmetic(True)
            item=scene.addPath(path.simplified(),pen,QColor(255,211,123,35));item.setAcceptedMouseButtons(Qt.NoButton);item.setZValue(10);self.highlights.append(item)
    def toggle_list(self,item):
        self.selector.checks[item.data(Qt.UserRole)].setChecked(item.checkState()==Qt.Checked)
