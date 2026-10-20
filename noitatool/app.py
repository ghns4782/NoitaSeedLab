import csv
import json
import os
import sys
from dataclasses import asdict
from PySide6.QtCore import Qt, Signal, QThread, QSize,QTimer
from PySide6.QtGui import QFont, QIcon, QFontDatabase, QPalette, QColor
from PySide6.QtWidgets import (QApplication,QMainWindow,QWidget,QVBoxLayout,QHBoxLayout,QLabel,QPushButton,QStackedWidget,QListWidget,QListWidgetItem,QLineEdit,QSpinBox,QComboBox,QTabWidget,QTextBrowser,QPlainTextEdit,QTreeWidget,QTreeWidgetItem,QSplitter,QProgressBar,QFormLayout,QSlider,QCheckBox,QFileDialog,QMessageBox,QDialog,QDialogButtonBox,QGroupBox,QAbstractItemView,QScrollArea)
from .paths import STATE as ROOT,UPSTREAM
from .engine import Engine,MAX_SEED,valid_seed
from .search import SearchRunner,SearchConfig,validate_rule
from .rules_ui import RuleDialog,LABELS,describe,rule_icon
from .catalog import name
from . import info_html

STYLE='''
QWidget{background:#111721;color:#dce3ed;font-family:"Microsoft YaHei UI";font-size:10pt}
QMainWindow{background:#111721} QLabel#brand{font-size:18pt;font-weight:bold;color:#f1d49b}
QLabel#title{font-size:23pt;font-weight:bold;color:#f2f4f8} QLabel#sub{color:#8594a9;font-size:10pt}
QListWidget#nav{background:#0c111a;border:none;outline:none;font-size:11pt} QListWidget#nav::item{padding:17px 12px;border-radius:6px;margin:5px}
QListWidget#nav::item:selected{background:#293448;color:#f1d49b}
QPushButton{background:#263145;border:1px solid #37445a;border-radius:6px;padding:8px 14px}
QPushButton:hover{background:#35445b} QPushButton:disabled{color:#607087;background:#1b2330}
QPushButton#settingsNav{background:#0c111a;border:none;text-align:left;padding:17px 12px;font-size:11pt}
QPushButton#settingsNav:checked{background:#293448;color:#f1d49b}
QPushButton#primary{background:#d6b77b;color:#151b25;border:0;font-weight:bold} QPushButton#primary:hover{background:#efd09b}
QLineEdit,QSpinBox,QComboBox,QPlainTextEdit{background:#1b2330;border:1px solid #37445a;border-radius:5px;padding:7px;selection-background-color:#4a6677}
QComboBox QAbstractItemView{background:#1b2330;selection-background-color:#35445b} QTreeWidget,QListWidget,QListView,QTextBrowser{background:#151b25;border:1px solid #303b4e;border-radius:7px;padding:7px}
QTreeWidget::item{padding:8px}QTreeWidget::item:selected,QListWidget::item:selected{background:#2d4050}
QHeaderView::section{background:#202a39;color:#8594a9;border:none;padding:9px}
QTabWidget::pane{border:1px solid #303b4e;border-radius:6px} QTabBar::tab{background:#192230;padding:11px 20px;color:#8594a9}
QTabBar::tab:selected{background:#293448;color:#f1d49b}QProgressBar{border:0;background:#263145;border-radius:4px;height:8px;text-align:center}
QProgressBar::chunk{background:#8ed1c5;border-radius:4px}QGroupBox{border:1px solid #303b4e;border-radius:7px;margin-top:16px;padding:16px}
QGroupBox::title{subcontrol-origin:margin;left:14px;color:#f1d49b}QSlider::groove:horizontal{height:5px;background:#303b4e}QSlider::handle:horizontal{background:#d6b77b;width:16px;margin:-6px 0;border-radius:8px}
QScrollBar:vertical{background:#151b25;width:10px}QScrollBar::handle:vertical{background:#37445a;min-height:30px;border-radius:4px}
QToolTip{background:#263145;color:#dce3ed;border:1px solid #4a6677}
'''

class Job(QThread):
    result=Signal(object)
    error=Signal(str)
    progress=Signal(object)
    def __init__(self,fn,parent):
        super().__init__(parent)
        self.fn=fn
    def run(self):
        try:self.result.emit(self.fn())
        except Exception as exc:self.error.emit(str(exc))

def button(text,callback,primary=False):
    b=QPushButton(text)
    if primary:b.setObjectName('primary')
    b.clicked.connect(callback)
    return b

def header(layout,title,subtitle):
    label=QLabel(title,objectName='title')
    layout.addWidget(label)
    label=QLabel(subtitle,objectName='sub')
    label.setWordWrap(True)
    layout.addWidget(label)

def spin(lo,hi,value):
    box=QSpinBox()
    box.setRange(lo,hi)
    box.setValue(value)
    return box

class Window(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle('NoitaSeedLab · 本地种子工坊')
        self.resize(1280,850)
        self.setMinimumSize(820,560)
        self.setWindowIcon(QIcon(str(UPSTREAM/'public/favicon.ico')))
        self.jobs=[];self._closing=False
        from .session import ViewSession
        self.view_session=ViewSession();self.custom_ranges=[]
        self.runner=None
        self.current_info=None
        self.info_request_id=0
        self.results=[]
        self.config=self.load_settings()
        root=QWidget()
        self.setCentralWidget(root)
        layout=QHBoxLayout(root)
        layout.setContentsMargins(0,0,0,0)
        side=QWidget()
        side.setFixedWidth(205)
        sl=QVBoxLayout(side)
        sl.setContentsMargins(12,25,12,18)
        sl.addWidget(QLabel('NoitaSeedLab',objectName='brand'))
        sl.addWidget(QLabel('本 地 种 子 工 坊',objectName='sub'))
        self.nav=QListWidget(objectName='nav')
        self.nav.addItems(['种子信息','搜索种子','地图查看'])
        self.nav.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        sl.addSpacing(25)
        sl.addWidget(self.nav,1)
        status=QLabel('●  本地离线计算\n\n原版 WASM + Python\nCPU 多线程 / OpenCL GPU',objectName='sub')
        status.setWordWrap(True)
        sl.addWidget(status)
        source=QLabel('<a href="https://github.com/TwoAbove/noita-tools" style="color:#8ed1c5">算法与图标来源 ↗</a>')
        source.setOpenExternalLinks(True)
        sl.addWidget(source)
        self.settings_button=QPushButton('设置',objectName='settingsNav');self.settings_button.setCheckable(True)
        self.settings_button.clicked.connect(self.open_settings);sl.addWidget(self.settings_button)
        layout.addWidget(side)
        self.pages=QStackedWidget()
        layout.addWidget(self.pages,1)
        self.build_info()
        self.build_search()
        self.settings_tabs=QTabWidget();self.pages.addWidget(self.settings_tabs)
        self.build_settings()
        self.build_map()
        from .translation_ui import TranslationPage
        self.translation_page=TranslationPage();translation_scroll=QScrollArea();translation_scroll.setWidgetResizable(True);translation_scroll.setWidget(self.translation_page);self.settings_tabs.addTab(translation_scroll,'语言与翻译')
        self.nav.currentRowChanged.connect(self.navigate)
        self.nav.setCurrentRow(1)
        self.statusBar().showMessage('就绪 · 所有种子运算均在本机执行')

    def navigate(self,row):
        if row<0:return
        self.settings_button.setChecked(False)
        page=(0,1,3)[row];self.pages.setCurrentIndex(page);self.info_page_shown(page)

    def open_settings(self):
        self.nav.setCurrentRow(-1);self.settings_button.setChecked(True);self.pages.setCurrentIndex(2)

    def page(self,settings=False):
        widget=QWidget()
        layout=QVBoxLayout(widget)
        layout.setContentsMargins(18,14,18,12)
        layout.setSpacing(9)
        scroll=QScrollArea();scroll.setWidgetResizable(True);scroll.setWidget(widget)
        if settings:self.settings_tabs.addTab(scroll,'算力分配')
        else:self.pages.addWidget(scroll)
        return layout

    def start_job(self,fn,callback,finished=None):
        if self._closing:return None
        job=Job(fn,self)
        self.jobs.append(job)
        job.result.connect(lambda value:callback(value) if not self._closing else None)
        job.error.connect(lambda error:self.show_error(error) if not self._closing else None)
        def cleanup():
            if finished and not self._closing:finished()
            if job in self.jobs:self.jobs.remove(job)
            job.deleteLater()
        job.finished.connect(cleanup)
        job.start()
        return job

    def show_error(self,error):
        if self._closing:return
        self.statusBar().showMessage('操作失败：'+error)
        QMessageBox.warning(self,'操作失败',error)

    def build_info(self):
        layout=self.page()
        header(layout,'种子信息','查看开局配置、炼金配方、圣山天赋与商店、真菌转移和生态修正。')
        row=QHBoxLayout()
        self.seed=QLineEdit()
        self.seed.setPlaceholderText('输入种子 1–2,147,483,645')
        self.seed.returnPressed.connect(self.load_info)
        row.addWidget(self.seed,1)
        row.addWidget(QLabel('平行世界'))
        self.world=spin(-100,100,0)
        self.info_world_timer=QTimer(self);self.info_world_timer.setSingleShot(True);self.info_world_timer.setInterval(250)
        self.info_world_timer.timeout.connect(self.load_info)
        self.world.valueChanged.connect(lambda _:self.info_world_timer.start() if self.current_info else None)
        row.addWidget(self.world)
        self.info_load=button('查询种子',self.load_info,True)
        row.addWidget(self.info_load)
        self.daily_load=button('每日挑战',lambda:self.load_daily_seed(force=True))
        row.addWidget(self.daily_load)
        row.addWidget(button('导出 JSON',self.export_info))
        layout.addLayout(row)
        self.daily_status=QLabel('打开本页自动显示当天每日挑战种子；也可手动输入其他种子。',objectName='sub')
        self.daily_status.setWordWrap(True);layout.addWidget(self.daily_status)
        self.daily_attempted=False;self.daily_loading=False
        self.rerolls=[]
        for i in range(7):
            value=spin(0,100,0)
            self.rerolls.append(value)
        self.info_tabs=QTabWidget()
        from .overview_ui import SeedOverview
        self.overview=SeedOverview(self,self.rerolls)
        self.info_tabs.addTab(self.overview,'世界总览')
        self.info_views=[]
        from .detail_ui import MountainView
        self.mountains=MountainView(self)
        from .environment_ui import FungalView
        self.fungal_view=FungalView(self)
        for title in ('概览','圣山天赋与商店','真菌转移','生态修正'):
            view=QTextBrowser()
            view.setOpenLinks(False)
            view.anchorClicked.connect(self.open_asset_link)
            self.info_views.append(view)
            self.info_tabs.addTab(self.mountains if title=='圣山天赋与商店' else self.fungal_view if title=='真菌转移' else view,title)
        self.raw_info=QPlainTextEdit()
        self.raw_info.setReadOnly(True)
        self.info_tabs.addTab(self.raw_info,'原始数据')
        layer_page=QWidget();lp=QVBoxLayout(layer_page);lr=QHBoxLayout()
        self.inspect_layer=QComboBox()
        from .areas import MAIN_LABELS
        for i,title in enumerate(MAIN_LABELS):self.inspect_layer.addItem(title+' + 下方圣山',i)
        self.inspect_layer.addItem('瞭望塔下方真菌地','overgrown')
        from .areas import PRESETS
        for area in PRESETS:
            if area['id']!='overgrown':self.inspect_layer.addItem(area['label'],'area:'+area['id'])
        lr.addWidget(self.inspect_layer)
        self.inspect_scope=QComboBox();self.inspect_scope.addItem('主路线 + 圣山','main');self.inspect_scope.hide()
        self.inspect_layer.currentIndexChanged.connect(lambda:self.inspect_scope.setEnabled(isinstance(self.inspect_layer.currentData(),int)))
        self.layer_load=button('生成本区资源',self.load_layer_info);lr.addWidget(self.layer_load);lp.addLayout(lr)
        self.layer_status=QLabel('按需生成；悬停图标查看来源坐标。此操作比普通种子查询慢。');self.layer_status.setWordWrap(True);lp.addWidget(self.layer_status)
        from .resources_ui import ResourceBrowser
        self.resource_browser=ResourceBrowser(details_on_double_click=False);lp.addWidget(self.resource_browser,1)
        self.layer_items=self.resource_browser.wands;self.layer_icons=self.resource_browser.spells;self.layer_potions=self.resource_browser.potions
        self.layer_click_timer=self.resource_browser.click_timer
        self.resource_browser.detailRequested.connect(self.open_layer_object)
        self.resource_browser.locationRequested.connect(self.locate_layer_item)
        for combo in (self.inspect_layer,self.inspect_scope):combo.currentIndexChanged.connect(self.invalidate_layer_info)
        self.world.valueChanged.connect(self.invalidate_layer_info)
        self.info_tabs.addTab(layer_page,'区域资源')
        self.info_views[0].setHtml(info_html.document('<h1>每一个种子，都有自己的秘密。</h1><p class="muted">输入种子，查看原版算法生成的世界信息。</p>'))
        layout.addWidget(self.info_tabs,1)

    def info_page_shown(self,index):
        if index==0 and not self.daily_attempted and not self.seed.text().strip():self.load_daily_seed()

    def load_daily_seed(self,force=False):
        if self.daily_loading:return
        self.daily_loading=True;self.daily_attempted=True
        self.daily_load.setEnabled(False)
        self.daily_status.setText('正在获取每日挑战种子…')
        previous=(self.seed.text(),self.info_request_id,self.world.value())
        def work():
            from .daily_seed import current_daily_seed
            try:return current_daily_seed(force),None
            except Exception as exc:return None,str(exc)
        def display(payload):
            result,error=payload
            if error:
                self.daily_status.setText(error+' 可手动输入种子查询。');return
            seed,date=result
            self.daily_status.setText(f'每日挑战 · {date}（UTC 日期） · 种子 {seed}')
            # A delayed network response must not replace a manual query.
            if previous!=(self.seed.text(),self.info_request_id,self.world.value()):return
            self.info_world_timer.stop();self.world.blockSignals(True);self.world.setValue(0);self.world.blockSignals(False)
            for reroll in self.rerolls:reroll.setValue(0)
            self.seed.setText(str(seed));self.load_info()
        def finished():self.daily_loading=False;self.daily_load.setEnabled(True)
        self.start_job(work,display,finished)

    def open_spell(self,key):
        from .detail_ui import show_spell
        if key:show_spell(key,self)

    def open_asset_link(self,url):
        if url.scheme()=='spell':self.open_spell(url.path())

    def build_map(self):
        widget=QWidget();layout=QVBoxLayout(widget);layout.setContentsMargins(12,10,12,8);layout.setSpacing(6);self.pages.addWidget(widget)
        header(layout,'地图查看','滚轮缩放、拖动平移；地图内的工具栏保持固定，点击展开种子、图层和显示选项。')
        from .map_ui import MapPage
        self.map_page=MapPage(self);layout.addWidget(self.map_page,1)

    def load_info(self):
        try:
            seed=valid_seed(self.seed.text())
            config={'worldOffset':self.world.value(),'rerolls':{str(i):box.value() for i,box in enumerate(self.rerolls)}}
        except Exception as exc:
            self.show_error(str(exc));return
        self.info_load.setEnabled(False)
        self.info_request_id+=1;request_id=self.info_request_id
        self.statusBar().showMessage(f'正在计算种子 {seed}…')
        def run():
            return seed,self.view_session.request(op='info',seed=seed,**config),config,request_id
        self.start_job(run,self.display_info,lambda:self.info_load.setEnabled(True))

    def display_info(self,payload):
        seed,data=payload[:2]
        config=payload[2] if len(payload)>2 else {'worldOffset':self.world.value(),'rerolls':{str(i):s.value() for i,s in enumerate(self.rerolls)}}
        if len(payload)>3 and (payload[3]!=self.info_request_id or config['worldOffset']!=self.world.value() or str(seed)!=self.seed.text().strip()):return
        same_seed=self.current_info and self.current_info['seed']==seed
        self.current_info={'seed':seed,**config,'info':data}
        if getattr(self,'layer_display_context',None)!=(seed,config['worldOffset']):
            self.resource_browser.clear();self.layer_display_context=None
            self.layer_status.setText('按需生成；悬停图标查看来源坐标。')
        self.overview.update_info(seed,data)
        self.mountains.update_info(data)
        self.fungal_view.update_info(data)
        if not same_seed:self.info_tabs.setCurrentIndex(0)
        for view,rendered in zip(self.info_views,info_html.render(seed,data)):
            view.setHtml(rendered)
        self.raw_info.setPlainText(json.dumps(info_html.strip_assets(data),ensure_ascii=False,indent=2))
        self.statusBar().showMessage(f'种子 {seed} · 原版算法计算完成')

    def layer_selection(self):
        layer=self.inspect_layer.currentData()
        if isinstance(layer,str) and layer.startswith('area:'):return 0,'region'
        return (0,'overgrown') if layer=='overgrown' else (layer,self.inspect_scope.currentData())

    def load_layer_info(self):
        if not self.current_info:
            self.show_error('请先查询一个种子');return
        seed=self.current_info['seed'];layer,scope=self.layer_selection();world=self.world.value()
        from .areas import preset
        selected=self.inspect_layer.currentData();area=preset(selected.split(':',1)[1]) if isinstance(selected,str) and selected.startswith('area:') else None
        self.layer_request_id=getattr(self,'layer_request_id',0)+1;request_id=self.layer_request_id
        self.layer_load.setEnabled(False);self.layer_status.setText(f'正在生成当前世界 {world} 的资源…')
        def work():
            result=self.view_session.request(op='area',seed=seed,area=area,worldOffset=world) if area else self.view_session.request(op='layer',seed=seed,layer=layer,scope=scope,worldOffset=world)
            result['evidence']=[dict(p,worldOffset=world) for p in result['evidence']]
            return seed,layer,scope,{**result,'request_id':request_id}
        self.start_job(work,self.display_layer_info,lambda:self.layer_load.setEnabled(True))

    def invalidate_layer_info(self,*_):
        self.layer_click_timer.stop()
        self.layer_display_context=None
        self.layer_request_id=getattr(self,'layer_request_id',0)+1
        self.resource_browser.clear()
        self.layer_status.setText('范围已更改，请点击生成查看法杖、法术与药水。')

    def display_layer_info(self,payload):
        from .catalog import icon
        from .icon_grid import tooltip
        seed,layer,scope,data=payload
        if not self.current_info or self.current_info['seed']!=seed or str(seed)!=self.seed.text().strip() or data.get('request_id',getattr(self,'layer_request_id',0))!=getattr(self,'layer_request_id',0):return
        if (layer,scope)!=self.layer_selection() or data.get('worldOffset',0)!=self.world.value():return
        self.layer_evidence=data['evidence']
        self.layer_display_context=(seed,self.world.value())
        self.resource_browser.set_resources(data.get('items',[]),data['evidence'],data['ids'])
        region=data.get('area',{}).get('label','地图区域') if scope=='region' else '瞭望塔下方真菌地' if scope=='overgrown' else self.inspect_layer.currentText()
        self.layer_status.setText(f'种子 {seed} · {region} · 当前世界 {self.world.value()} · {len(data.get("items",[]))} 件资源（分类显示） · {len(data["ids"])} 种法术\n跟随顶部平行世界编号；单击详情，双击地图定位。')

    def locate_layer_item(self,obj):
        import time
        self.layer_ignore_click_until=time.monotonic()+QApplication.doubleClickInterval()/1000+.15
        self.layer_click_timer.stop()
        if not self.current_info:return
        self.nav.setCurrentRow(2);self.map_page.focus_point(self.current_info['seed'],obj)

    def locate_layer_spell(self,key):
        self.layer_click_timer.stop()
        points=[p for p in getattr(self,'layer_evidence',[]) if p['id']==key]
        if points:
            point=dict(points[0],type='spell',spell=key)
            self.locate_layer_item(point)

    def open_layer_item(self,item):
        self.open_layer_object(item.data(Qt.UserRole))

    def open_layer_object(self,obj):
        from .map_ui import map_wand
        from .detail_ui import show_wand,show_spell
        if obj['type']=='wand':show_wand(map_wand(obj),self)
        elif obj['type']=='spell':show_spell(obj['spell'],self,obj.get('price'))
        else:self.map_page.open_item(obj)

    def export_info(self):
        if not self.current_info:return
        path,_=QFileDialog.getSaveFileName(self,'导出种子信息',f'seed-{self.current_info["seed"]}.json','JSON (*.json)')
        if path:
            try:
                from pathlib import Path
                Path(path).write_text(json.dumps(info_html.strip_assets(self.current_info),ensure_ascii=False,indent=2),encoding='utf-8')
            except Exception as exc:self.show_error(str(exc))

    def build_search(self):
        layout=self.page()
        header(layout,'搜索种子','组合条件，在本机寻找你的下一个世界。双击结果，即可查看种子详情。')
        range_row=QHBoxLayout()
        self.range_fields=QWidget();range_fields=QHBoxLayout(self.range_fields);range_fields.setContentsMargins(0,0,0,0)
        range_fields.addWidget(QLabel('搜索范围'))
        self.range_start=QLineEdit('1')
        self.range_end=QLineEdit(str(MAX_SEED))
        range_fields.addWidget(self.range_start)
        range_fields.addWidget(QLabel('—'))
        range_fields.addWidget(self.range_end)
        range_row.addWidget(self.range_fields,1)
        range_row.addWidget(QLabel('结果上限'))
        self.limit=spin(0,MAX_SEED,0)
        self.limit.setSpecialValueText('不限')
        range_row.addWidget(self.limit)
        self.backend=QComboBox()
        self.backend.addItem('CPU · 多线程','cpu')
        self.backend.addItem('GPU · 加速 + 原版校验','gpu')
        range_row.addWidget(self.backend)
        source_row=QHBoxLayout()
        self.source_mode=QComboBox();self.source_mode.addItem('连续种子范围','range');self.source_mode.addItem('提供的种子列表','list')
        source_row.addWidget(self.source_mode)
        self.list_button=button('粘贴 / 导入种子列表…',self.edit_seed_list)
        source_row.addWidget(self.list_button)
        self.seed_list_status=QLabel('未提供列表',objectName='sub');source_row.addWidget(self.seed_list_status,1)
        self.input_seeds=None
        self.source_mode.currentIndexChanged.connect(lambda _:self.update_source_mode())
        layout.addLayout(source_row)
        layout.addLayout(range_row)
        self.update_source_mode()
        flow_row=QHBoxLayout();self.flow_enabled=QCheckBox('搜索流优化 · 按条件逐级缩小种子范围');flow_row.addWidget(self.flow_enabled);flow_row.addStretch();layout.addLayout(flow_row)
        self.flow_enabled.toggled.connect(self.toggle_flow)
        from .flow_ui import FlowDialog
        self.flow_dialog=FlowDialog(self);self.flow_view=self.flow_dialog.view
        self.flow_button=button('查看搜索流…',self.flow_dialog.open_details);self.flow_button.hide()
        self.search_split=QSplitter()
        rules_pane=QWidget()
        rules_layout=QVBoxLayout(rules_pane)
        rules_layout.setContentsMargins(0,0,0,0)
        toolbar=QHBoxLayout()
        toolbar.addWidget(button('＋ 添加条件',self.add_rule,True))
        self.group=QComboBox()
        self.group.addItems(['AND','OR','NOT'])
        toolbar.addWidget(self.group)
        toolbar.addWidget(button('＋ 逻辑组',self.add_group))
        toolbar.addWidget(button('编辑',self.edit_rule))
        toolbar.addWidget(button('删除',self.remove_rule))
        rules_layout.addLayout(toolbar)
        from .rule_tree import RuleTree
        self.tree=RuleTree()
        self.tree.reordered.connect(self.rebuild_tree)
        self.tree.setHeaderLabels(['搜索条件','目标 / 说明'])
        self.tree.setColumnWidth(0,190)
        self.tree.setSelectionMode(QAbstractItemView.SingleSelection)
        self.tree.itemDoubleClicked.connect(lambda *_:self.edit_rule())
        self.tree.currentItemChanged.connect(self.preview_rule)
        rules_layout.addWidget(self.tree,1)
        actions=QHBoxLayout()
        actions.addWidget(button('导入条件',self.import_rules))
        actions.addWidget(button('保存条件',self.save_rules))
        actions.addWidget(button('本地搜索方案',self.saved_searches))
        actions.addWidget(button('＋ 高级搜索条件…',self.add_advanced_rule))
        actions.addStretch()
        rules_layout.addLayout(actions)
        hint=QLabel('GPU 可预筛选：圣山天赋、初始药水、初始法术、初始炸弹、炼金配方。\n复杂条件在 CPU 上用原版算法复核。NOT 组只包含一个子条件。',objectName='sub')
        hint.setWordWrap(True)
        rules_layout.addWidget(hint)
        self.search_split.addWidget(rules_pane)
        results_pane=QWidget()
        results_layout=QVBoxLayout(results_pane)
        results_layout.setContentsMargins(8,0,0,0)
        results_layout.addWidget(QLabel('匹配种子',objectName='brand'))
        from .result_view import SeedResultView
        self.result_list=SeedResultView()
        self.result_list.itemDoubleClicked.connect(self.open_result)
        results_layout.addWidget(self.result_list,1)
        result_actions=QHBoxLayout()
        result_actions.addWidget(button('复制种子',self.copy_result))
        result_actions.addWidget(button('导出 CSV',self.export_results))
        results_layout.addLayout(result_actions)
        self.search_split.addWidget(results_pane)
        self.search_split.setSizes([650,290])
        layout.addWidget(self.search_split,1)
        self.preview=QLabel('')
        self.preview.setObjectName('sub')
        self.preview.setWordWrap(True)
        self.preview.setMaximumHeight(46)
        layout.addWidget(self.preview)
        self.progress=QProgressBar()
        self.progress.setRange(0,1000)
        self.progress.setTextVisible(False)
        layout.addWidget(self.progress)
        footer=QHBoxLayout()
        self.stats=QLabel('就绪 · 设置中可调整算力预算',objectName='sub')
        footer.addWidget(self.stats,1)
        footer.addWidget(self.flow_button)
        self.stop_button=button('停止',self.stop_search)
        self.stop_button.setEnabled(False)
        footer.addWidget(self.stop_button)
        self.run_button=button('开始搜索',self.run_search,True)
        footer.addWidget(self.run_button)
        layout.addLayout(footer)
        self.set_rule({'type':'and','rules':[{'type':'startingFlask','val':'water'}]})

    def populate(self,rule,parent=None):
        item=QTreeWidgetItem(parent if parent else self.tree)
        kind=rule['type']
        item.setData(0,Qt.UserRole,{k:v for k,v in rule.items() if k!='rules'})
        if kind in ('and','or','not'):
            item.setText(0,{'and':'AND · 全部满足','or':'OR · 任一满足','not':'NOT · 排除'}[kind])
            item.setText(1,f'{len(rule["rules"])} 个子条件')
            for child in rule['rules']:self.populate(child,item)
        else:
            item.setText(0,LABELS.get(kind,kind))
            item.setText(1,describe(rule))
            image=rule_icon(rule)
            if image:item.setIcon(0,image)
            from .rule_summary import RuleSummary
            summary=RuleSummary(rule,self.tree)
            item.setText(1,'')
            item.setToolTip(1,describe(rule))
            self.tree.setItemWidget(item,1,summary)
            item.setSizeHint(1,QSize(300,summary.minimumHeight()))
            summary.edit.connect(lambda i=item:self.edit_selected(i))
        item.setExpanded(True)
        if parent:parent.setText(1,f'{parent.childCount()} 个子条件')
        return item

    def edit_selected(self,item):self.tree.setCurrentItem(item);self.edit_rule()

    def set_rule(self,rule):
        validate_rule(rule)
        self.tree.clear()
        root=self.populate(rule)
        self.tree.setCurrentItem(root)

    def get_rule(self,item=None):
        if item is None:item=self.tree.topLevelItem(0)
        data=dict(item.data(0,Qt.UserRole))
        if data['type'] in ('and','or','not'):
            data['rules']=[self.get_rule(item.child(i)) for i in range(item.childCount())]
        return data

    def target_group(self):
        item=self.tree.currentItem() or self.tree.topLevelItem(0)
        if item.data(0,Qt.UserRole)['type'] not in ('and','or','not'):
            item=item.parent()
        if item is None:
            old=self.get_rule()
            self.set_rule({'type':'and','rules':[old]})
            item=self.tree.topLevelItem(0)
        if item.data(0,Qt.UserRole)['type']=='not' and item.childCount():
            raise ValueError('NOT 组只能有一个条件')
        return item

    def add_area_search(self,area,world=0):
        from copy import deepcopy
        from .range_ui import range_key
        if all(range_key(a)!=range_key(area) for a in self.custom_ranges):self.custom_ranges.append(deepcopy(area))
        val={'ranges':[deepcopy(area)],'mode':'all','ids':[]}
        if world:val['worldRange']=[world,world]
        dialog=RuleDialog(self,{'type':'layerSpells','val':val})
        if dialog.exec():
            try:self.populate(dialog.result_rule,self.target_group());self.nav.setCurrentRow(1)
            except Exception as exc:self.show_error(str(exc))

    def add_rule(self):
        try:parent=self.target_group()
        except Exception as exc:self.show_error(str(exc));return
        dialog=RuleDialog(self)
        if dialog.exec():
            self.populate(dialog.result_rule,parent)

    def add_advanced_rule(self):
        from .advanced_ui import AdvancedSearchDialog
        try:parent=self.target_group()
        except Exception as exc:self.show_error(str(exc));return
        dialog=AdvancedSearchDialog(self)
        if dialog.exec():self.populate({'type':'advanced','val':dialog.result_rule},parent)

    def add_group(self):
        try:parent=self.target_group()
        except Exception as exc:self.show_error(str(exc));return
        self.tree.setCurrentItem(self.populate({'type':self.group.currentText().lower(),'rules':[]},parent))

    def edit_rule(self):
        item=self.tree.currentItem()
        if item is None:return
        rule=self.get_rule(item)
        if rule['type'] in ('and','or','not'):
            self.edit_json();return
        from .rules_ui import ADVANCED_ONLY
        from .advanced_ui import AdvancedSearchDialog
        dialog=AdvancedSearchDialog(self,rule['val'] if rule['type']=='advanced' else rule) if rule['type'] in ADVANCED_ONLY else RuleDialog(self,rule)
        if dialog.exec():
            if rule['type']=='advanced':dialog.result_rule={'type':'advanced','val':dialog.result_rule}
            parent=item.parent()
            if parent:
                index=parent.indexOfChild(item)
                parent.takeChild(index)
                self.populate(dialog.result_rule,parent)
            else:self.set_rule(dialog.result_rule)

    def remove_rule(self):
        item=self.tree.currentItem()
        if item and item.parent():
            parent=item.parent()
            parent.removeChild(item)
            parent.setText(1,f'{parent.childCount()} 个子条件')

    def preview_rule(self,*_):
        if not hasattr(self,'preview'):return
        item=self.tree.currentItem()
        if item:
            self.preview.setText(describe(self.get_rule(item)))

    def edit_json(self):
        from .advanced_ui import AdvancedSearchDialog
        dialog=AdvancedSearchDialog(self,self.get_rule())
        if dialog.exec():
            try:self.set_rule(dialog.result_rule)
            except Exception as exc:self.show_error(str(exc))

    def import_rules(self):
        path,_=QFileDialog.getOpenFileName(self,'导入条件','','JSON (*.json)')
        if path:
            try:
                from pathlib import Path
                data=json.loads(Path(path).read_text(encoding='utf-8'))
                self.set_rule(data.get('rule',data))
            except Exception as exc:self.show_error(str(exc))

    def save_rules(self):
        path,_=QFileDialog.getSaveFileName(self,'保存条件','noita-rules.json','JSON (*.json)')
        if path:
            try:
                from pathlib import Path
                from .persistence import persistent_rule
                from .advanced_ui import validate_advanced
                rule=persistent_rule(self.get_rule());validate_advanced(rule)
                Path(path).write_text(json.dumps(rule,ensure_ascii=False,indent=2),encoding='utf-8')
            except Exception as exc:self.show_error(str(exc))

    def saved_searches(self):
        from .saved_searches import SavedSearchDialog
        SavedSearchDialog(self).exec()

    def run_search(self):
        if self._closing:return
        try:
            self.save_settings()
            listed=self.source_mode.currentData()=='list'
            config=SearchConfig(start=1 if listed else valid_seed(self.range_start.text()),end=1 if listed else valid_seed(self.range_end.text()),backend=self.backend.currentData(),cpu_percent=self.cpu_slider.value(),gpu_percent=self.gpu_slider.value(),max_workers=self.worker_cap.value(),max_results=self.limit.value(),device_index=self.gpu_device.currentIndex() if self.gpu_device.count() else 0)
            config.diagnostics=getattr(self,'record_search_profile',True)
            if self.flow_enabled.isChecked():config.max_results=0
            if self.source_mode.currentData()=='list':
                if not self.input_seeds:raise ValueError('请先提供种子列表')
                config.seed_list=self.input_seeds.copy()
            config.validate()
            rule=self.get_rule()
            validate_rule(rule)
            if config.backend=='gpu' and not self.flow_enabled.isChecked():
                from .gpu import prefilter
                if prefilter(rule) is None:
                    from .search import has_layer_rule
                    if has_layer_rule(rule):config.backend='cpu'
                    else:raise ValueError('请添加可 GPU 加速的筛选条件，或切换为 CPU 多线程。')
        except Exception as exc:self.show_error(str(exc));return
        self.results=[]
        self.result_list.clear()
        self.progress.setValue(0)
        self.run_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        self.stats.setText('正在初始化本地计算内核…')
        if self.flow_enabled.isChecked():
            from .flow_search import FlowRunner
            self.runner=FlowRunner(config,rule);self.flow_view.reset(self.runner)
            self.flow_button.show()
        else:
            self.runner=SearchRunner(config,rule);self.flow_button.hide();self.flow_dialog.close()
        job=Job(self.runner.run,self)
        self.runner.on_progress=job.progress.emit
        self.jobs.append(job)
        job.progress.connect(self.search_progress)
        job.result.connect(self.search_done)
        job.error.connect(lambda error:self.show_error(error) if not self._closing else None)
        def finish():
            self.run_button.setEnabled(True)
            self.stop_button.setEnabled(False)
            self.jobs.remove(job)
            job.deleteLater()
            if self.runner.profile_path:self.statusBar().showMessage(self.statusBar().currentMessage()+' · 性能记录：'+self.runner.profile_path)
            self.runner=None
        job.finished.connect(finish)
        job.start()

    def update_source_mode(self):
        listed=self.source_mode.currentData()=='list'
        self.range_fields.setVisible(not listed)
        self.range_start.setEnabled(not listed);self.range_end.setEnabled(not listed)
        self.list_button.setVisible(listed);self.seed_list_status.setVisible(listed)

    def edit_seed_list(self):
        from .seed_lists import parse_seed_list
        from pathlib import Path
        dialog=QDialog(self);dialog.setWindowTitle('列表搜索 · 粘贴或导入种子');dialog.resize(680,560)
        layout=QVBoxLayout(dialog)
        layout.addWidget(QLabel('支持换行、空格、逗号分隔；TXT / CSV（seed 列）/ JSON 数组。重复种子自动去重。'))
        text=QPlainTextEdit('\n'.join(map(str,self.input_seeds or [])))
        layout.addWidget(text)
        error=QLabel();layout.addWidget(error)
        def load():
            path,_=QFileDialog.getOpenFileName(dialog,'导入种子列表','','种子列表 (*.txt *.csv *.json);;所有文件 (*)')
            if path:
                try:text.setPlainText(Path(path).read_text(encoding='utf-8-sig'))
                except Exception as exc:error.setText(str(exc))
        layout.addWidget(button('从文件导入…',load))
        if self.results:layout.addWidget(button('使用当前搜索结果',lambda:text.setPlainText('\n'.join(map(str,self.results)))))
        buttons=QDialogButtonBox(QDialogButtonBox.Ok|QDialogButtonBox.Cancel);layout.addWidget(buttons)
        def accept():
            try:
                self.input_seeds=parse_seed_list(text.toPlainText());self.seed_list_status.setText(f'{len(self.input_seeds):,} 个去重种子');dialog.accept()
            except Exception as exc:error.setText(str(exc))
        buttons.accepted.connect(accept);buttons.rejected.connect(dialog.reject);dialog.exec()

    def toggle_flow(self,enabled):
        self.limit.setEnabled(not enabled)
        if enabled:self.limit.setValue(0)

    def rebuild_tree(self):
        rule=self.get_rule()
        self.tree.clear();self.populate(rule)

    def search_progress(self,data):
        if self._closing:return
        if 'flow_stage' in data:
            self.flow_view.update_progress(data)
            completed=sum(data['flow_completed']);stages=len(data['flow_completed'])
            fraction=0 if data['flow_completed'][data['flow_stage']] else min(1,data['checked']/max(1,data['total']))
            overall=(completed+fraction)/max(1,stages)
            self.progress.setValue(int(1000*overall))
            self.stats.setText(f'总进度 {overall:.1%}（按条件阶段） · 已完成 {completed} / {stages} 个条件\n累计检查 {data.get("flow_checked",data["checked"]):,} 次 · {data["elapsed"]:.1f}s · 各条件详情请点击“查看搜索流”')
            return
        self.progress.setValue(int(1000*data['checked']/max(1,data['total'])))
        phase=data.get('phase','筛选')
        pending=data.get('pending_candidates',0)
        self.stats.setText(f'{data["backend"]} · {phase}'+(f' · 待复核 {pending:,}' if pending else '')+f'\n已检查 {data["checked"]:,} / {data["total"]:,}  ·  近期 {data["rate"]:,.0f} / 平均 {data.get("average_rate",data["rate"]):,.0f} 种子/秒  ·  {data["elapsed"]:.1f}s')
        incoming=data['new_results']
        self.results.extend(incoming)
        self.result_list.append_seeds(incoming)

    def search_done(self,seeds):
        if self._closing:return
        self.results=seeds
        if hasattr(seeds,'page'):
            self.result_list.clear();self.result_list.append_seeds(seeds.page())
            self.result_list.setToolTip('当前显示前 500 个；在搜索链最后阶段点击“查看”翻页或导出全部。')
        limit=self.runner.config.max_results if self.runner else self.limit.value()
        reason='达到结果上限' if limit and len(seeds)>=limit else '已停止' if self.runner and self.runner.cancel.is_set() else '扫描完成'
        self.statusBar().showMessage(f'{reason} · 找到 {len(seeds)} 个种子')
        self.stats.setText(self.stats.text()+f'\n{reason} · 匹配 {len(seeds)} 个')
        if hasattr(seeds,'page') and len(seeds)>500:self.stats.setText(self.stats.text()+' · 结果栏显示前 500 个，搜索链“查看”可翻页和导出全部')

    def stop_search(self):
        if self.runner:
            self.runner.stop()
            self.stats.setText('正在停止，等待当前计算批次完成…')

    def open_result(self,item):
        self.seed.setText(str(item.data(Qt.UserRole)))
        self.nav.setCurrentRow(0)
        self.load_info()

    def copy_result(self):
        item=self.result_list.currentItem()
        text=str(item.data(Qt.UserRole)) if item else '\n'.join(map(str,self.results))
        QApplication.clipboard().setText(text)

    def export_results(self):
        if not self.results:return
        path,_=QFileDialog.getSaveFileName(self,'导出搜索结果','noita-seeds.csv','CSV (*.csv)')
        if path:
            try:
                with open(path,'w',encoding='utf-8-sig',newline='') as f:
                    writer=csv.writer(f);writer.writerow(['seed']);writer.writerows([[s] for s in self.results])
            except Exception as exc:self.show_error(str(exc))

    def load_settings(self):
        try:return json.loads((ROOT/'settings.json').read_text(encoding='utf-8'))
        except (OSError,ValueError):return {}

    def build_settings(self):
        layout=self.page(settings=True)
        header(layout,'算力设置','控制给搜索任务的运算预算；设置会保存到本地。')
        self.full=QCheckBox('使用全部算力（CPU 与 GPU 预算均为 100%）')
        layout.addWidget(self.full)
        group=QGroupBox('CPU · 多线程')
        form=QFormLayout(group)
        self.cpu_slider=QSlider(Qt.Horizontal)
        self.cpu_slider.setRange(1,100)
        self.cpu_slider.setValue(self.config.get('cpu_percent',75))
        self.cpu_label=QLabel()
        form.addRow('CPU 运算预算',self.cpu_slider)
        form.addRow('',self.cpu_label)
        self.worker_cap=spin(0,os.cpu_count() or 1,self.config.get('max_workers',0))
        self.worker_cap.setSpecialValueText('自动（按预算分配）')
        form.addRow('工作线程上限',self.worker_cap)
        form.addRow(QLabel(f'本机 {os.cpu_count() or 1} 个逻辑处理器。每个线程管理独立计算内核，可并行使用多个 CPU 核心。'))
        layout.addWidget(group)
        gpu_group=QGroupBox('GPU · OpenCL 加速')
        gpu_form=QFormLayout(gpu_group)
        self.gpu_slider=QSlider(Qt.Horizontal)
        self.gpu_slider.setRange(1,100)
        self.gpu_slider.setValue(self.config.get('gpu_percent',75))
        self.gpu_label=QLabel()
        gpu_form.addRow('GPU 运算预算',self.gpu_slider)
        gpu_form.addRow('',self.gpu_label)
        from .gpu import devices
        self.gpu_device=QComboBox()
        for d in devices():self.gpu_device.addItem(d.name.strip())
        if not self.gpu_device.count():self.gpu_device.addItem('未检测到可用 GPU')
        gpu_form.addRow('计算设备',self.gpu_device)
        label=QLabel('GPU 对圣山天赋、开局配置和炼金配方执行并行预筛选，CPU 使用原版算法校验完整条件。\n百分比通过批次间休眠限制计算占空比；不是驱动级功耗、显存或全系统利用率硬限制。')
        label.setWordWrap(True)
        gpu_form.addRow(label)
        layout.addWidget(gpu_group)
        about=QLabel('算法：Noitool + Noita Telescope（MIT）\n图标与游戏文本：直接使用上游资源。种子算法在本地运行；每日种子查询需要联网。\n整层法术支持指定平行世界或范围，普通新游戏；CPU 生成世界，GPU 可加速前置条件。')
        about.setWordWrap(True)
        about.setObjectName('sub')
        layout.addWidget(about)
        self.cpu_slider.valueChanged.connect(self.update_budget)
        self.gpu_slider.valueChanged.connect(self.update_budget)
        self.worker_cap.valueChanged.connect(self.update_budget)
        self.full.toggled.connect(self.toggle_full)
        self.update_budget()
        layout.addStretch()
        layout.addWidget(button('保存设置',self.save_settings,True),alignment=Qt.AlignRight)

    def update_budget(self,*_):
        cpu=self.cpu_slider.value();gpu=self.gpu_slider.value()
        workers=SearchConfig(cpu_percent=cpu,max_workers=self.worker_cap.value()).workers()
        self.cpu_label.setText(f'使用 {cpu}% · 预留 {100-cpu}% · {workers} 个工作线程')
        self.gpu_label.setText(f'使用 {gpu}% · 预留 {100-gpu}%')
        self.full.blockSignals(True)
        self.full.setChecked(cpu==gpu==100)
        self.full.blockSignals(False)

    def toggle_full(self,checked):
        if checked:
            self.cpu_slider.setValue(100)
            self.gpu_slider.setValue(100)
            self.worker_cap.setValue(0)
        else:
            self.cpu_slider.setValue(75)
            self.gpu_slider.setValue(75)

    def save_settings(self):
        self.config={'cpu_percent':self.cpu_slider.value(),'gpu_percent':self.gpu_slider.value(),'max_workers':self.worker_cap.value()}
        try:
            ROOT.mkdir(parents=True,exist_ok=True)
            (ROOT/'settings.json').write_text(json.dumps(self.config,indent=2),encoding='utf-8')
            self.statusBar().showMessage('算力设置已保存；下一次搜索生效')
        except OSError as exc:self.show_error(str(exc))

    def shutdown(self):
        if self._closing:return
        self._closing=True
        self.layer_click_timer.stop();self.info_world_timer.stop()
        self.map_page.world_timer.stop();self.map_page.refresh_timer.stop()
        for job in self.jobs:job.requestInterruption()
        if self.runner:self.runner.stop()
        self.view_session.abort()

    def closeEvent(self,event):
        self.shutdown()
        if any(job.isRunning() for job in self.jobs):
            self.statusBar().showMessage('正在结束计算并回收子进程…')
            event.ignore()
            QTimer.singleShot(100,self.close)
        else:
            for dialog in self.findChildren(QDialog):dialog.close()
            self.info_world_timer.stop();self.map_page.world_timer.stop();self.map_page.refresh_timer.stop();self.view_session.close();event.accept()

def main():
    app=QApplication(sys.argv)
    try:
        from .storage import initialize_storage
        initialize_storage()
    except OSError as exc:
        QMessageBox.critical(None,'无法准备本地数据','无法创建或迁移软件目录下的 data 文件夹。请将软件放在可写目录后重试。\n\n'+str(exc))
        return 1
    configure_app(app)
    from .startup import show_startup_notices
    app.setQuitOnLastWindowClosed(False)
    if not show_startup_notices():return 0
    window=Window()
    app.aboutToQuit.connect(window.shutdown)
    window.show()
    app.setQuitOnLastWindowClosed(True)
    return app.exec()

def configure_app(app):
    from .process_guard import set_application_identity
    set_application_identity()
    from .storage import initialize_storage
    initialize_storage()
    from .localization import install_ui
    install_ui(app)
    from PySide6.QtCore import QTranslator,QLibraryInfo
    if not hasattr(app,'chinese_translator'):
        translator=QTranslator(app)
        if translator.load('qtbase_zh_CN',QLibraryInfo.path(QLibraryInfo.TranslationsPath)):app.installTranslator(translator)
        app.chinese_translator=translator
    if not QFontDatabase.families():
        from pathlib import Path
        for filename in ('msyh.ttc','msyhbd.ttc'):
            path=Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/filename
            if path.exists():QFontDatabase.addApplicationFont(str(path))
    app.setFont(QFont('Microsoft YaHei UI',10))
    app.setStyle('Fusion')
    palette=QPalette()
    for role,color in [(QPalette.Window,'#111721'),(QPalette.WindowText,'#dce3ed'),(QPalette.Base,'#151b25'),(QPalette.AlternateBase,'#202a39'),(QPalette.Text,'#dce3ed'),(QPalette.Button,'#263145'),(QPalette.ButtonText,'#dce3ed'),(QPalette.Highlight,'#3c5969'),(QPalette.HighlightedText,'#ffffff')]:
        palette.setColor(role,QColor(color))
    app.setPalette(palette)
    app.setStyleSheet(STYLE)
