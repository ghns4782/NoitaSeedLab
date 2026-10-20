"""Zoomable initial world map with screen-space, non-overlapping POI clusters."""
import base64
import math
from pathlib import Path
from PySide6.QtCore import Qt,QRectF,QPointF,QTimer,Signal,QSize
from PySide6.QtGui import QPixmap,QIcon,QColor,QPen,QFont,QPainter,QPainterPath
from PySide6.QtWidgets import (QWidget,QVBoxLayout,QHBoxLayout,QLabel,QLineEdit,QSpinBox,QComboBox,QPushButton,QSlider,QCheckBox,QSplitter,QGraphicsView,QGraphicsScene,QGraphicsObject,QGraphicsItem,QListWidget,QListWidgetItem,QScrollArea,QToolButton,QGridLayout,QProgressBar,QFrame,QMenu,QWidgetAction,QSizePolicy)
from .paths import ROOT
from .catalog import icon,data_icon,item_icon,name,tr,image_url
from .engine import Engine,valid_seed
from .detail_ui import WandCard,SpellCard,ItemDialog


def map_wand(poi):
    if poi.get('wand'):return poi['wand']
    gun={k:poi.get(k,0) for k in ('deck_capacity','actions_per_round','reload_time','shuffle_deck_when_empty','fire_rate_wait','spread_degrees','mana_charge_speed','mana_max')}
    gun['deck_capacity']=int(gun['deck_capacity']);gun['actions_per_round']=max(1,int(gun['actions_per_round']))
    path=ROOT/'vendor/noita-telescope-main/data/wand_sprites'/f'{poi.get("sprite","wand_0000")}.png'
    ui={'file':'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()} if path.is_file() else {}
    return {'gun':gun,'ui':ui,'cards':{'cards':poi.get('cards',[]),'permanentCard':poi.get('always_casts',[])}}


def poi_icon(poi):
    if poi['type']=='spell':return icon(poi['spell'])
    if poi['type'] in ('chest','pickup','potion'):return item_icon('chest' if poi['type']=='chest' else poi.get('item','potion'))
    if poi['type']=='wand':
        if poi.get('wand'):return data_icon(poi['wand'].get('ui',{}))
        path=ROOT/'vendor/noita-telescope-main/data/wand_sprites'/f'{poi.get("sprite","wand_0000")}.png'
    else:path=ROOT/'vendor/noita-telescope-main/data/enemy_sprites'/f'{Path(poi.get("entity","boss_centipede")).stem}.png'
    pix=QPixmap(str(path))
    if pix.isNull() and poi['type']=='boss':pix=QPixmap(str(ROOT/'vendor/noita-telescope-main/data/enemy_sprites/boss_centipede.png'))
    return QIcon(pix.scaled(42,42,Qt.KeepAspectRatio,Qt.FastTransformation)) if not pix.isNull() else icon('EDIT_WANDS_EVERYWHERE')


def price_label(poi):
    if poi['type']=='boss':return '首领区域' if poi.get('accuracy')=='region' else '首领'
    if poi.get('accuracy')=='region':return '位置参考 · 房间内'
    value=poi.get('price')
    return '价格未知' if value is None else f'{value:g} 金币' if value else '免费'


def poi_title(poi):
    if poi['type']=='spell':return name(poi['spell'])
    if poi['type']=='wand':return '魔杖'
    if poi['type']=='chest':return '宝箱'
    if poi['type'] in ('pickup','potion'):
        from .localization import text
        if poi.get('label'):
            label=poi['label']
            # Generator labels sometimes repeat an untranslated internal item ID.
            if label==poi.get('item') or not any('\u4e00'<=c<='\u9fff' for c in label):
                localized=name(poi.get('item',''))
                if localized and localized!=poi.get('item'):return localized
            return text(label)
        labels={'heart':'生命上限','full_heal':'完全治疗','potion':'药水','potion_empty':'空瓶','pouch':'粉末袋','gold':'金币','orb':'真知魔球','true_orb':'真知魔球','sampo':'三眼之物','spell_refresh':'法术恢复'}
        return labels.get(poi.get('item'),name(poi.get('item','物品')))
    from .localization import text
    key=Path(poi.get('entity','Boss')).stem
    return text(poi.get('label',key),key) if name(key)==key.replace('_',' ') else name(key)

def poi_filter(poi):
    if poi['type']!='pickup':return poi['type']
    key=Path(poi.get('item','')).stem
    if key in ('orb','true_orb','orb_cursed'):return 'special'
    if key.startswith(('emerald_tablet','book')):return 'tablet'
    if key in ('heart','heart_bigger','heart_better','heart_fullhp','full_heal','spell_refresh','heart_mimic','refresh_mimic'):return 'health'
    if key.startswith('gold') or key=='physics_gold_orb':return 'gold'
    if key.startswith('egg') or key=='robot_egg':return 'egg'
    if key in ('kiuaskivi','ukkoskivi','vuoksikivi','kuu','stonestone','evil_eye','paha_silma','chaos_die','greed_die','kammi') or key.startswith('runestone'):return 'stone'
    return 'pickup'


def group_price(items):
    if len(items)==1:return price_label(items[0])
    values=[p.get('price') for p in items if p['type']!='boss']
    if not values:return '首领区域'
    if any(value is None for value in values):return '价格不定'
    low,high=min(values),max(values)
    return ('免费' if not high else f'{low:g} 金币') if low==high else f'{low:g}–{high:g} 金'


class Marker(QGraphicsObject):
    def __init__(self,items,size,callback):
        super().__init__();self.items,self.size,self.callback=items,size,callback
        self.setFlag(QGraphicsItem.ItemIgnoresTransformations);self.setZValue(20)
        self.setCursor(Qt.PointingHandCursor);self.image=poi_icon(items[0]).pixmap(size,size)
        self.setAcceptHoverEvents(True);self.hovered=False
        self.setToolTip('\n'.join(f'{poi_title(p)} · {price_label(p)} · ({p["x"]:g}, {p["y"]:g})' for p in items[:8])+ ('\n点击查看全部' if len(items)>8 else '\n点击查看详情'))

    def mousePressEvent(self,event):
        if event.button()==Qt.LeftButton:self.callback(self.items);event.accept()
        else:super().mousePressEvent(event)

    def hoverEnterEvent(self,event):self.hovered=True;self.update();super().hoverEnterEvent(event)
    def hoverLeaveEvent(self,event):self.hovered=False;self.update();super().hoverLeaveEvent(event)


class WorldSprite(Marker):
    """High-contrast UI icon at its real coordinate, visible only after zooming."""
    def boundingRect(self):return QRectF(-self.size/2-7,-self.size/2-7,self.size+14,self.size+14)

    def paint(self,painter,option,widget=None):
        painter.setRenderHint(QPainter.SmoothPixmapTransform,False)
        frame=QRectF(-self.size/2-4,-self.size/2-4,self.size+8,self.size+8)
        color='#f4ce83' if self.items[0]['type']=='wand' else '#8ed1e5' if self.items[0]['type']=='spell' else '#ed9789'
        painter.setPen(QPen(QColor('#060a10'),4));painter.setBrush(QColor('#243b50') if self.hovered else QColor('#111c2a'));painter.drawRoundedRect(frame,5,5)
        painter.setPen(QPen(QColor('#fff1bf') if self.hovered else QColor(color),2 if self.hovered else 1.5));painter.drawRoundedRect(frame,5,5)
        actual=self.image.size();actual.scale(self.size,self.size,Qt.KeepAspectRatio)
        painter.drawPixmap(QRectF(-actual.width()/2,-actual.height()/2,actual.width(),actual.height()).toRect(),self.image)
        if len(self.items)>1:
            badge=QRectF(self.size/2-14,-self.size/2-5,19,19);painter.setPen(Qt.NoPen);painter.setBrush(QColor('#f1d49b'));painter.drawEllipse(badge)
            painter.setPen(QColor('#10151e'));painter.setFont(QFont('Microsoft YaHei UI',8));painter.drawText(badge,Qt.AlignCenter,str(len(self.items)))

class NativeSprite(QGraphicsObject):
    """Game-sized sprite using world units, with no UI frame or clustering."""
    def __init__(self,point,callback):
        super().__init__();self.items=[point];self.callback=callback;self.setZValue(20);self.setCursor(Qt.PointingHandCursor)
        self.image=QPixmap();kind=point['type']
        if kind=='wand' and not point.get('wand'):
            self.image.load(str(ROOT/'vendor/noita-telescope-main/data/wand_sprites'/f'{point.get("sprite","wand_0000")}.png'))
        else:
            url=image_url(point.get('wand',{}).get('ui',{})) if kind=='wand' else image_url(point['spell']) if kind=='spell' else None
            if url:self.image.loadFromData(base64.b64decode(url.split(',',1)[1]))
            elif kind in ('chest','potion','pickup'):
                key='chest' if kind=='chest' else point.get('item','potion')
                self.image.load(str(ROOT/'vendor/noita-telescope-main/data/item_sprites'/f'{key}.png'))
        if self.image.isNull():self.image=poi_icon(point).pixmap(16,16)
        grip=point.get('grip');self.origin=QPointF(-grip['x'],-grip['y']) if kind=='wand' and grip else QPointF(-self.image.width()/2,-self.image.height()/2)
        self.setToolTip(f'{poi_title(point)} · {price_label(point)}\n生成坐标：({point["x"]:g}, {point["y"]:g}) · 原像素尺寸显示')
    def boundingRect(self):return QRectF(self.origin.x(),self.origin.y(),self.image.width(),self.image.height())
    def paint(self,painter,option,widget=None):painter.setRenderHint(QPainter.SmoothPixmapTransform,False);painter.drawPixmap(self.origin,self.image)
    def mousePressEvent(self,event):
        if event.button()==Qt.LeftButton:self.callback(self.items);event.accept()
        else:super().mousePressEvent(event)


MIN_ITEM_ZOOM=.22
MIN_SHOP_ZOOM=.06


class HolyShopMarker(QGraphicsObject):
    """Compact shop panel constrained to the Holy Mountain's actual bounds."""
    def __init__(self,items,zoom,callback,bounds):
        super().__init__();self.items,self.callback,self.world_bounds=items,callback,bounds
        self.setFlag(QGraphicsItem.ItemIgnoresTransformations);self.setZValue(21);self.setCursor(Qt.PointingHandCursor)
        self.rows=math.ceil(len(items)/5)
        self.ui_scale=min(2.2,max(1,(zoom/.65)**.35))
        self.width=min(260*self.ui_scale,max(1,(bounds.width()-96)*zoom))
        self.height=min((18+self.rows*52)*self.ui_scale,max(1,(bounds.height()-64)*zoom))
        self.header=16*self.ui_scale if self.height>=(16+self.rows*42)*self.ui_scale else 0
        self.row_height=(self.height-self.header)/self.rows
        self.price_height=12*self.ui_scale if self.row_height>=34*self.ui_scale else 0
        self.cell=self.width/5
        self.image_size=max(1,int(min(self.cell-8,self.row_height-self.price_height-6)))
        self.images=[poi_icon(p).pixmap(self.image_size,self.image_size) for p in items]
        self.setAcceptHoverEvents(True)
        self.setToolTip('圣山商店 · 单击图标查看详情；悬停查看价格与实际坐标')
    def boundingRect(self):return QRectF(-self.width/2,-self.height/2,self.width,self.height)
    def paint(self,painter,option,widget=None):
        painter.setPen(QPen(QColor('#d6b77b'),1));painter.setBrush(QColor('#111c2a'));painter.drawRoundedRect(self.boundingRect(),4,4)
        if self.header:
            painter.setFont(QFont('Microsoft YaHei UI',round(8*self.ui_scale)));painter.setPen(QColor('#f1d49b'))
            painter.drawText(QRectF(-self.width/2,-self.height/2,self.width,self.header),Qt.AlignCenter,f'第 {self.items[0].get("shopLevel",0)+1} 座圣山商店')
        painter.setRenderHint(QPainter.SmoothPixmapTransform,False)
        for i,(obj,image) in enumerate(zip(self.items,self.images)):
            x=-self.width/2+(i%5)*self.cell;y=-self.height/2+self.header+(i//5)*self.row_height
            actual=image.size();actual.scale(self.image_size,self.image_size,Qt.KeepAspectRatio)
            icon_height=self.row_height-self.price_height
            painter.drawPixmap(QRectF(x+(self.cell-actual.width())/2,y+(icon_height-actual.height())/2,actual.width(),actual.height()).toRect(),image)
            if self.price_height:
                painter.setFont(QFont('Microsoft YaHei UI',round(7*self.ui_scale)));painter.setPen(QColor('#dce3ed'))
                price=obj.get('price');text='?' if price is None else '免费' if not price else f'{price:g}'
                painter.drawText(QRectF(x,y+icon_height,self.cell,self.price_height),Qt.AlignCenter,text)
    def index_at(self,pos):
        x=pos.x()+self.width/2;y=pos.y()+self.height/2-self.header
        index=int(y//self.row_height)*5+int(x//self.cell)
        return index if y>=0 and 0<=index<len(self.items) else None
    def mousePressEvent(self,event):
        if event.button()!=Qt.LeftButton:return super().mousePressEvent(event)
        index=self.index_at(event.pos());self.callback([self.items[index]] if index is not None else self.items);event.accept()
    def hoverMoveEvent(self,event):
        index=self.index_at(event.pos())
        if index is not None:
            obj=self.items[index];cards=(obj.get('wand') or {}).get('cards',{}).get('cards',[])
            self.setToolTip(f'{poi_title(obj)} · {price_label(obj)}\n'+('、'.join(name(k) for k in cards)+'\n' if cards else '')+f'实际位置：({obj["x"]:g}, {obj["y"]:g})')
        super().hoverMoveEvent(event)


def sprite_size(zoom,setting=32):
    # Crossing the visibility threshold should immediately yield a readable icon.
    return max(24,min(96,(28+10*math.log2(max(MIN_ITEM_ZOOM,zoom)/MIN_ITEM_ZOOM))*setting/32))


def anchored_groups(points,project,size):
    """Only merge colliding sprites; a group stays on its first real point."""
    groups=[]
    for point in points:
        pos=project(point)
        for anchor,items in groups:
            if abs(pos.x()-anchor.x())<size+14 and abs(pos.y()-anchor.y())<size+14:
                items.append(point);break
        else:groups.append((QPointF(pos),[point]))
    return groups


class MapCanvas(QGraphicsView):
    changed=Signal()
    cursorMoved=Signal(object)
    areaClicked=Signal(object)
    areaSelected=Signal(object)
    def __init__(self):
        super().__init__();self.setScene(QGraphicsScene(self));self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse);self.setResizeAnchor(QGraphicsView.AnchorViewCenter)
        self.setRenderHint(QPainter.SmoothPixmapTransform,False);self.setBackgroundBrush(QColor('#0d111a'))
        self.setMouseTracking(True)
        self.selection_mode='pan';self.selection_start=None;self.rubber=None
        self.horizontalScrollBar().valueChanged.connect(self.changed);self.verticalScrollBar().valueChanged.connect(self.changed)

    def zoom(self,factor):
        current=self.transform().m11();target=max(.003,min(12,current*factor));self.scale(target/current,target/current);self.changed.emit()

    def wheelEvent(self,event):self.zoom(1.2 if event.angleDelta().y()>0 else 1/1.2);event.accept()
    def resizeEvent(self,event):super().resizeEvent(event);self.changed.emit()
    def set_selection_mode(self,mode):
        self.selection_mode=mode;self.setDragMode(QGraphicsView.ScrollHandDrag if mode=='pan' else QGraphicsView.NoDrag)
        self.setCursor(Qt.ArrowCursor if mode=='pan' else Qt.CrossCursor)
    def mousePressEvent(self,event):
        if event.button()==Qt.LeftButton and self.selection_mode!='pan':
            self.selection_start=self.mapToScene(event.position().toPoint())
            if self.selection_mode=='rect':
                pen=QPen(QColor('#f1d49b'),2);pen.setCosmetic(True)
                self.rubber=self.scene().addRect(QRectF(self.selection_start,self.selection_start),pen,QColor(241,212,155,25));self.rubber.setZValue(40);self.rubber.setAcceptedMouseButtons(Qt.NoButton)
            event.accept();return
        super().mousePressEvent(event)
    def mouseMoveEvent(self,event):
        pos=self.mapToScene(event.position().toPoint());self.cursorMoved.emit(pos)
        if self.selection_start is not None:
            if self.rubber:self.rubber.setRect(QRectF(self.selection_start,pos).normalized())
            event.accept();return
        super().mouseMoveEvent(event)
    def mouseReleaseEvent(self,event):
        if self.selection_start is not None:
            point=self.mapToScene(event.position().toPoint());rect=QRectF(self.selection_start,point).normalized();self.selection_start=None
            if self.rubber:self.scene().removeItem(self.rubber);self.rubber=None
            if self.selection_mode=='biome':self.areaClicked.emit(point)
            elif rect.width()*self.transform().m11()>=4 and rect.height()*self.transform().m11()>=4:self.areaSelected.emit(rect)
            event.accept();return
        super().mouseReleaseEvent(event)


class MapPage(QWidget):
    generationProgress=Signal(object)
    def __init__(self,window):
        super().__init__();self.window=window;self.data=None;self.requested=None;self.working=False;self.markers=[];self.lines=[];self.terrain_layer=None;self.terrain_item=None;self.overlay_item=None
        outer=QVBoxLayout(self);outer.setContentsMargins(0,0,0,0)
        self.map_surface=QWidget();outer.addWidget(self.map_surface,1)
        layout=QVBoxLayout(self.map_surface);layout.setContentsMargins(0,0,0,0)
        row=QHBoxLayout();row.addWidget(QLabel('种子'));self.seed=QLineEdit('123');row.addWidget(self.seed,1)
        row.addWidget(QLabel('平行世界'));self.world=QSpinBox();self.world.setRange(-100,100);row.addWidget(self.world)
        self.load=QPushButton('生成地图');row.addWidget(self.load);self.load.clicked.connect(self.request_map);self.seed.returnPressed.connect(self.request_map);layout.addLayout(row)
        tools=QHBoxLayout();self.region=QComboBox();self.region.addItem('全世界',None)
        for i,label in enumerate(['矿坑','煤矿','积雪深渊','希斯基地','地下丛林','避难所','艺术神殿']):self.region.addItem(f'第 {i+1} 层 · {label}',i)
        for label,value in [('水洞','water'),('天界商店','sky'),('地狱商店','hell')]:self.region.addItem(label,value)
        tools.addWidget(self.region)
        for title,action in [('适应区域',self.fit_region),('＋',lambda:self.canvas.zoom(1.3)),('－',lambda:self.canvas.zoom(1/1.3))]:
            b=QPushButton(title);b.clicked.connect(action);tools.addWidget(b)
        tools.addWidget(QLabel('图标大小'));self.icon_size=QSpinBox();self.icon_size.setRange(24,64);self.icon_size.setValue(32);self.icon_size.setSuffix(' px');self.icon_size.setToolTip('调整放大后带边框的资源图标大小；原尺寸精细定位使用游戏原始像素。');tools.addWidget(self.icon_size)
        layout.addLayout(tools)
        from .preferences import read_preferences
        prefs=read_preferences();background=QHBoxLayout()
        self.clear_background=QCheckBox('清晰像素显示 · LOD 分块');self.clear_background.setChecked(prefs.get('clear_background',True));background.addWidget(self.clear_background);background.addStretch();layout.addLayout(background)
        self.generated_overlay=QCheckBox('叠加当前种子可生成地形');self.generated_overlay.setChecked(True);self.generated_overlay.setToolTip('将可计算的洞窟和固定场景覆盖在实景参考上；天界、地狱保留参考布局。');background.insertWidget(2,self.generated_overlay);self.generated_overlay.toggled.connect(self.background_changed)
        self.clear_background.setToolTip('放大时按需读取清晰切片，缩小时使用低分辨率；关闭后仅使用粗略底图。截图原本没有的细节不会被补画。')
        self.clear_background.toggled.connect(self.background_changed)
        layers=QVBoxLayout();layers.addWidget(QLabel('显示图层 · 按资源类型独立开关'));layer_grid=QGridLayout();layers.addLayout(layer_grid)
        self.filters={}
        categories=[('wand','法杖','EDIT_WANDS_EVERYWHERE'),('spell','法术','LIGHT_BULLET'),('potion','药水 / 粉末袋',None),('chest','宝箱',None),('tablet','石板',None),('special','魔球',None),('health','生命 / 恢复',None),('gold','金币',None),('stone','特殊道具',None),('egg','蛋',None),('pickup','其它物品',None),('boss','首领','GLASS_CANNON')]
        item_keys={'chest':'chest','potion':'potion','tablet':'emerald_tablet','special':'orb','health':'heart','gold':'gold','stone':'kiuaskivi','egg':'egg','pickup':'utility_box'}
        for i,(kind,label,key) in enumerate(categories):
            box=QToolButton();box.setCheckable(True);box.setChecked(kind in ('wand','special','tablet'));box.setIcon(icon(key) if key else item_icon(item_keys[kind]));box.setIconSize(QSize(22,22));box.setToolButtonStyle(Qt.ToolButtonTextBesideIcon);box.setText(label);box.setMinimumHeight(32);box.setToolTip(label+' · 只控制这一类资源，点击切换显示');box.setAccessibleName(label)
            if kind=='wand':box.setIcon(item_icon('wand_0000'))
            if kind=='boss':box.setIcon(poi_icon({'type':'boss','entity':'boss_centipede'}))
            box.setStyleSheet('QToolButton{border:1px solid #37445a;border-radius:4px;background:#16202d}QToolButton:checked{background:#35594f;border:1px solid #8ed1c5}')
            self.filters[kind]=box;layer_grid.addWidget(box,i//6,i%6);box.toggled.connect(self.schedule_markers)
        vertical_row=QHBoxLayout();vertical_row.addStretch();vertical_row.addWidget(QLabel('天界 / 地狱区段'))
        self.vertical=QSpinBox();self.vertical.setRange(-1000000,1000000);self.vertical.setToolTip('0：主世界总览；负数：天界区段；正数：地狱区段。每段间隔 24570 游戏像素，按需生成。');vertical_row.addWidget(self.vertical);layers.addLayout(vertical_row);layout.addLayout(layers)
        selection=QHBoxLayout();selection.addWidget(QLabel('地图操作'))
        self.selection_mode=QComboBox()
        for title,key in [('拖动地图','pan'),('点选生态区域','biome'),('框选资源范围','rect')]:self.selection_mode.addItem(title,key)
        selection.addWidget(self.selection_mode)
        self.precise=QCheckBox('精细定位 · 原尺寸物品');self.precise.setToolTip('按游戏像素大小绘制，放大地图后便于核对坐标；关闭可用醒目的图标查看。');selection.addWidget(self.precise);self.precise.toggled.connect(self.schedule_markers);self.precise.toggled.connect(lambda checked:self.icon_size.setEnabled(not checked));selection.addStretch();layout.addLayout(selection)
        selection=QHBoxLayout()
        self.resources_button=QPushButton('查看选区资源');self.resources_button.setEnabled(False);self.resources_button.clicked.connect(self.show_area_resources);selection.addWidget(self.resources_button)
        self.search_area_button=QPushButton('选区用于搜索');self.search_area_button.setEnabled(False);self.search_area_button.clicked.connect(self.use_area_search);selection.addWidget(self.search_area_button);selection.addStretch();layout.addLayout(selection)
        self.status=QLabel('查询种子后显示资源。魔球与石板地标默认可见；放大后显示法杖等物品，点击查看详情。');self.status.setWordWrap(True);layout.addWidget(self.status)
        self.progress=QProgressBar();self.progress.setRange(0,100);self.progress.setVisible(False);self.progress.setMinimumHeight(20);layout.addWidget(self.progress)
        self.progress.setTextVisible(False)
        self.generationProgress.connect(self.update_generation_progress)
        self.canvas=MapCanvas();layout.addWidget(self.canvas,1)
        self.selection_mode.currentIndexChanged.connect(lambda:self.canvas.set_selection_mode(self.selection_mode.currentData()))
        self.canvas.areaClicked.connect(self.select_biome);self.canvas.areaSelected.connect(self.select_rectangle)
        self.selected_area=None;self.area_shapes=[];self.resource_windows=[]
        self.note=QLabel('当前种子生成地形：10 游戏像素 / 图像像素。对应种子的高清截图可通过“导入高清底图”加载；首领区域不是精确出生点。');self.note.setWordWrap(True);layout.addWidget(self.note)
        self.coordinates=QLabel('滚轮缩放 · 拖动平移');layout.addWidget(self.coordinates)
        self.canvas.cursorMoved.connect(lambda pos:self.coordinates.setText(f'({pos.x():.0f}, {pos.y():.0f}) · 区块 ({math.floor(pos.x()/512)}, {math.floor(pos.y()/512)}) · 缩放 {self.canvas.transform().m11():.2f}×'))
        self.capture_button=QPushButton('导入高清底图…');row.addWidget(self.capture_button);self.capture_button.clicked.connect(self.import_capture)
        self.capture=None;self.capture_items=[]
        self.capture_visible=QCheckBox('显示导入的高清底图');self.capture_visible.setEnabled(False)
        self.capture_visible.toggled.connect(self.toggle_capture)
        self.edit_capture_button=QPushButton('重新裁切 / 定位');self.edit_capture_button.setEnabled(False)
        self.edit_capture_button.clicked.connect(self.edit_capture)
        self.delete_capture_button=QPushButton('删除已导入底图');self.delete_capture_button.setEnabled(False)
        self.delete_capture_button.setToolTip('移除当前地图的导入记录及未被其他地图使用的程序切片缓存，保留原始图片和外部 DZI 文件')
        self.delete_capture_button.clicked.connect(self.delete_capture)
        self.refresh_timer=QTimer(self);self.refresh_timer.setSingleShot(True);self.refresh_timer.timeout.connect(self.update_markers)
        self.world_timer=QTimer(self);self.world_timer.setSingleShot(True);self.world_timer.setInterval(250);self.world_timer.timeout.connect(self.request_map)
        self.world.valueChanged.connect(self.world_changed);self.vertical.valueChanged.connect(self.world_changed);self.region.currentIndexChanged.connect(self.region_changed);self.icon_size.valueChanged.connect(self.schedule_markers);self.canvas.changed.connect(self.schedule_markers)
        self.group=[];self.pending_focus=None
        self.install_floating_controls(layout)
        from .real_terrain import reference_capture
        self.terrain_layer=reference_capture(123,0,self.clear_background.isChecked())
        self.terrain_layer.install(self.canvas.scene())
        self.note.setText('离线实景参考底图；输入种子生成对应资源标记。参考地形不随种子变化。')
        QTimer.singleShot(0,self.fit_initial_reference)

    def fit_initial_reference(self):
        if self.data is None:
            self.canvas.fitInView(self.canvas.sceneRect(),Qt.KeepAspectRatio)
            self.terrain_layer.refresh(self.canvas)

    def install_floating_controls(self,layout):
        """Viewport children stay at fixed screen positions while the scene pans."""
        # Retain control identities and connections; remove the old stacked rows.
        self.retired_layouts=[]
        while layout.count():
            item=layout.takeAt(0)
            if item.layout():self.retired_layouts.append(item.layout())
        for child in self.map_surface.findChildren(QWidget,options=Qt.FindDirectChildrenOnly):
            if child is not self.canvas:child.hide()
        layout.setSpacing(0);layout.addWidget(self.canvas,1)
        self.floating_tools=QFrame(self.canvas.viewport());self.floating_tools.setObjectName('mapFloatingTools')
        self.floating_tools.setStyleSheet('QFrame#mapFloatingTools{background:rgba(17,23,33,235);border:1px solid #485568;border-radius:6px} QToolButton{padding:4px 6px;border:1px solid #37445a;border-radius:4px;background:#263145}')
        bar=QHBoxLayout(self.floating_tools);bar.setContentsMargins(6,5,6,5);bar.setSpacing(4)
        def popup(title):
            button=QToolButton();button.setText(title);button.setPopupMode(QToolButton.InstantPopup)
            menu=QMenu(button);content=QWidget();action=QWidgetAction(menu);action.setDefaultWidget(content);menu.addAction(action);button.setMenu(menu);bar.addWidget(button)
            return button,menu,content
        self.seed_menu_button,self.seed_menu,query=popup('种子 / 世界')
        query_grid=QGridLayout(query);query_grid.setContentsMargins(10,10,10,10);query_grid.setSpacing(6)
        query_grid.addWidget(QLabel('种子'),0,0);query_grid.addWidget(self.seed,0,1,1,3)
        query_grid.addWidget(QLabel('平行世界'),1,0);query_grid.addWidget(self.world,1,1)
        query_grid.addWidget(self.load,2,0,1,2);query_grid.addWidget(self.capture_button,2,2,1,2)
        query_grid.addWidget(self.capture_visible,3,0,1,2);query_grid.addWidget(self.delete_capture_button,3,2,1,2)
        query_grid.addWidget(self.edit_capture_button,4,0,1,4)
        self.seed.setMinimumWidth(180);self.load.clicked.connect(self.seed_menu.close)
        self.seed_menu_button.setToolTip('更改种子、平行世界，生成地图或导入高清底图')
        self.layer_menu_button,self.layer_menu,layers=popup('图层')
        grid=QGridLayout(layers);grid.setContentsMargins(8,8,8,8);grid.setSpacing(4)
        for i,button in enumerate(self.filters.values()):grid.addWidget(button,i//3,i%3)
        self.options_menu_button,self.options_menu,options=popup('显示 / 选区')
        settings=QVBoxLayout(options);settings.setContentsMargins(10,10,10,10);settings.setSpacing(6)
        for widget in (self.clear_background,self.generated_overlay):settings.addWidget(widget)
        form=QGridLayout();settings.addLayout(form)
        for row,(title,widget) in enumerate([('图标大小',self.icon_size),('天界 / 地狱区段',self.vertical),('地图操作',self.selection_mode)]):
            form.addWidget(QLabel(title),row,0);form.addWidget(widget,row,1)
        settings.addWidget(self.precise)
        actions=QHBoxLayout();actions.addWidget(self.resources_button);actions.addWidget(self.search_area_button);settings.addLayout(actions)
        self.resources_button.clicked.connect(self.options_menu.close);self.search_area_button.clicked.connect(self.options_menu.close)
        self.note.setMaximumWidth(390);settings.addWidget(self.note)
        self.region.setMinimumContentsLength(6);self.region.setSizeAdjustPolicy(QComboBox.AdjustToMinimumContentsLengthWithIcon);self.region.setFixedWidth(142);bar.addWidget(self.region)
        fit=QToolButton();fit.setText('适应');fit.setToolTip('缩放至所选区域');fit.clicked.connect(self.fit_region);bar.addWidget(fit)
        for text,factor in [('＋',1.3),('－',1/1.3)]:
            button=QToolButton();button.setText(text);button.setFixedWidth(28);button.clicked.connect(lambda _,f=factor:self.canvas.zoom(f));bar.addWidget(button)
        # Explicitly show reclaimed controls; their popup ancestors remain hidden.
        for widget in (self.seed,self.world,self.load,self.capture_button,self.capture_visible,self.delete_capture_button,self.edit_capture_button,self.region,self.clear_background,self.generated_overlay,self.icon_size,self.vertical,self.selection_mode,self.precise,self.resources_button,self.search_area_button,self.note,*self.filters.values()):widget.show()
        self.floating_status=QFrame(self.canvas.viewport());self.floating_status.setObjectName('mapFloatingStatus')
        self.floating_status.setStyleSheet('QFrame#mapFloatingStatus{background:rgba(17,23,33,225);border-radius:4px}')
        bottom=QVBoxLayout(self.floating_status);bottom.setContentsMargins(6,3,6,3);bottom.setSpacing(2)
        status_row=QHBoxLayout();status_row.setSpacing(10);bottom.addLayout(status_row)
        for widget in (self.status,self.coordinates):
            widget.setWordWrap(False);widget.setSizePolicy(QSizePolicy.Ignored,QSizePolicy.Fixed);widget.setMaximumHeight(22);status_row.addWidget(widget,1);widget.show()
        bottom.addWidget(self.progress);self.progress.setFixedHeight(8);self.progress.hide()
        self.floating_tools.show();self.floating_status.show()
        self.canvas.changed.connect(self.position_floating_controls)
        self.position_floating_controls()

    def position_floating_controls(self,*_):
        if not hasattr(self,'floating_tools'):return
        viewport=self.canvas.viewport();width=max(1,viewport.width()-16)
        self.floating_tools.adjustSize();self.floating_tools.move(8,8);self.floating_tools.raise_()
        self.floating_status.setFixedWidth(width);self.floating_status.adjustSize();self.floating_status.move(8,max(8,viewport.height()-self.floating_status.height()-8));self.floating_status.raise_()

    def select_biome(self,point):
        if not self.data:return
        from copy import deepcopy
        offset=self.data['worldOffset']*35840;cx=math.floor((point.x()-offset+17920)/512)
        for region in reversed(self.data.get('regions',[])):
            cy=math.floor((point.y()+7168-region.get('verticalIndex',0)*24570)/512)
            if [cx,cy] not in region['cells']:continue
            key=region['biomes'][0]
            if key in ('solid_wall','solid_wall_tower','solid_wall_temple'):
                self.status.setText('此处是实心岩层；请点选资源区域，或切换框选。');return
            area=deepcopy(region)
            labels={'coalmine':'矿坑','coalmine_alt':'坍塌矿坑','excavationsite':'煤矿','snowcave':'积雪深渊','snowcastle':'希斯基地','rainforest':'地下丛林','rainforest_dark':'蜘蛛洞 / 卢基巢穴','fungicave':'真菌洞穴','fungiforest':'繁茂洞窟','wandcave':'魔法神殿','wizardcave':'法师巢穴','vault':'避难所','vault_frozen':'冻结避难所','crypt':'艺术神殿','robobase':'发电站','temple_altar':'圣山','secret_lab':'废弃炼金实验室','liquidcave':'远古实验室'}
            from .biome_names import region_label
            area['label']=region_label(area);self.set_selected_area(area);self.show_area_resources();return
        self.status.setText('这里没有可点选的生态区域；可以改用框选。')

    def select_rectangle(self,rect):
        if not self.data:return
        from .areas import validate_area
        rect=rect.intersected(QRectF(*self.data['origin'],self.data['width'],self.data['height']))
        if rect.isEmpty():return
        offset=self.data['worldOffset']*35840
        area={'kind':'rect','label':'地图框选区域','bounds':[rect.left()-offset,rect.top(),rect.right()-offset,rect.bottom()],'verticalIndex':self.data.get('verticalIndex',0)}
        try:validate_area(area)
        except ValueError as exc:self.status.setText(str(exc));return
        self.set_selected_area(area);self.show_area_resources()

    def set_selected_area(self,area):
        from .areas import validate_area
        validate_area(area)
        for item in self.area_shapes:self.canvas.scene().removeItem(item)
        self.area_shapes=[];self.selected_area=area;offset=self.data['worldOffset']*35840
        path=QPainterPath()
        if area['kind']=='biome' and area.get('cells'):
            for x,y in area['cells']:path.addRect(QRectF(offset+x*512-17920,y*512-7168+area.get('verticalIndex',0)*24570,512,512))
        else:
            x1,y1,x2,y2=area['bounds'];path.addRect(QRectF(offset+x1,y1,x2-x1,y2-y1))
        pen=QPen(QColor('#8ed1c5'),1.5);pen.setCosmetic(True)
        shape=self.canvas.scene().addPath(path,pen,QColor(142,209,197,25));shape.setZValue(8);shape.setAcceptedMouseButtons(Qt.NoButton);self.area_shapes.append(shape)
        self.resources_button.setEnabled(True);self.search_area_button.setEnabled(True)
        self.status.setText(f'已选择：{area.get("label","区域")} · 世界 {self.data["worldOffset"]} · 可查看资源或用于搜索')

    def show_area_resources(self):
        if not self.selected_area or not self.data:return
        from copy import deepcopy
        from shiboken6 import isValid
        from .resources_ui import ResourceDialog
        seed,world=self.data['seed'],self.data['worldOffset'];area=deepcopy(self.selected_area)
        def locate(obj):
            self.window.nav.setCurrentRow(2);self.focus_point(seed,dict(obj,worldOffset=world))
        def search():
            if isValid(dialog):dialog.close()
            self.window.add_area_search(area,world)
        def precise():
            point=None
            for kind,listing in dialog.browser.lists.items():
                if listing.count():
                    point=dialog.browser.object_for(kind,listing.item(0));break
            if point is None:
                x1,y1,x2,y2=area['bounds'];point={'type':'wand','x':(x1+x2)/2+world*35840,'y':(y1+y2)/2,'verticalIndex':area.get('verticalIndex',0)}
            self.precise.setChecked(True)
            for box in self.filters.values():box.setChecked(True)
            locate(dict(point,zoom=2))
        dialog=ResourceDialog(f'种子 {seed} · 世界 {world} · {area.get("label","选区资源")}',[],self.open_item,locate,search,self,precise=precise)
        dialog.setAttribute(Qt.WA_DeleteOnClose);self.resource_windows.append(dialog)
        dialog.finished.connect(lambda _:self.resource_windows.remove(dialog) if dialog in self.resource_windows else None)
        dialog.show();dialog.setWindowTitle(dialog.windowTitle()+' · 正在读取…')
        def work():
            return self.window.view_session.request(op='area',seed=seed,worldOffset=world,area=area)
        def display(data):
            if not isValid(dialog):return
            items=[dict(p,worldOffset=world) for p in data['items']]
            evidence=[dict(p,worldOffset=world) for p in data['evidence']]
            dialog.browser.set_resources(items,evidence,data['ids']);dialog.setWindowTitle(f'选区资源 · {area.get("label","框选")} · {len(items)} 件资源'+(' · 已生成地图缓存' if data.get('fromMapCache') else ''))
        self.window.start_job(work,display)

    def use_area_search(self):
        if self.selected_area and self.data:self.window.add_area_search(self.selected_area,self.data['worldOffset'])

    def import_capture(self):
        self.seed_menu.close()
        from .map_capture import choose_capture
        try:seed=valid_seed(self.seed.text())
        except Exception as exc:self.status.setText(str(exc));return
        capture=choose_capture(self,seed,self.world.value(),self.capture_ready)
        if capture:self.capture_ready(capture)

    def capture_ready(self,capture):
        if self.capture:self.capture.detach()
        self.capture=capture
        self.sync_capture_controls()
        if not self.data or (capture.seed,capture.world)!=(self.data['seed'],self.data['worldOffset']):
            if self.seed.text()==str(capture.seed) and self.world.value()==capture.world:self.request_map()
            return
        if self.data:
            self.install_capture()
            if (capture.seed,capture.world)==(self.data['seed'],self.data['worldOffset']):self.canvas.fitInView(capture.bounds(),Qt.KeepAspectRatio)

    def install_capture(self):
        self.sync_capture_controls()
        if not self.data or not self.capture or not self.capture.enabled:return
        if (self.capture.seed,self.capture.world)!=(self.data['seed'],self.data['worldOffset']):return
        self.capture.install(self.canvas.scene());self.capture.refresh(self.canvas);self.note.setText(f'高清底图：种子 {self.capture.seed} · 平行世界 {self.capture.world} · 可见区域分块加载，缩小自动使用低清层级')
        self.schedule_markers()

    def sync_capture_controls(self):
        available=bool(self.capture and self.data and (self.capture.seed,self.capture.world)==(self.data['seed'],self.data['worldOffset']))
        self.capture_visible.blockSignals(True)
        self.capture_visible.setChecked(bool(available and self.capture.enabled))
        self.capture_visible.blockSignals(False)
        editable=available and not self.working and not getattr(self,'capture_importing',False)
        self.capture_visible.setEnabled(editable)
        self.delete_capture_button.setEnabled(editable);self.edit_capture_button.setEnabled(editable)

    def edit_capture(self):
        if not self.capture:return
        self.seed_menu.close()
        from .capture_editor import CaptureEditor
        try:
            dialog=CaptureEditor(self.capture.path,self.capture.seed,self.capture.world,self,capture=self.capture)
            try:
                if dialog.exec():
                    capture=dialog.capture();capture.save();self.capture.detach();self.capture=capture
                    self.reset_capture_view();self.canvas.fitInView(capture.bounds(),Qt.KeepAspectRatio)
            finally:dialog.deleteLater()
        except (OSError,ValueError) as exc:self.window.show_error(str(exc))

    def reset_capture_view(self):
        if not self.data:return
        self.canvas.scene().setSceneRect(QRectF(*self.data['origin'],self.data['width'],self.data['height']))
        self.draw_terrain();self.install_capture();self.schedule_markers()
        if not self.canvas.mapToScene(self.canvas.viewport().rect()).boundingRect().intersects(self.canvas.sceneRect()):self.fit_region()

    def toggle_capture(self,enabled):
        if not self.capture:return
        self.capture.detach();self.capture.enabled=enabled
        try:self.capture.save()
        except OSError as exc:self.window.show_error(str(exc))
        self.reset_capture_view()

    def delete_capture(self):
        if not self.capture:return
        from .map_capture import remove_capture
        capture=self.capture;capture.detach()
        try:
            cleared=remove_capture(capture.seed,capture.world)
        except (OSError,ValueError,KeyError) as exc:
            self.window.show_error(str(exc));self.reset_capture_view();return
        self.capture=None;self.reset_capture_view();self.sync_capture_controls()
        self.status.setText('已删除导入记录'+('及生成的切片缓存' if cleared else '')+'；原始图片已保留')

    def world_changed(self,*_):
        if self.data or self.working:
            if self.capture:self.capture.detach()
            if self.terrain_layer:self.terrain_layer.detach();self.terrain_layer=None
            self.data=None;self.sync_capture_controls();self.canvas.scene().clear();self.markers=[];self.lines=[];self.area_shapes=[];self.selected_area=None;self.resources_button.setEnabled(False);self.search_area_button.setEnabled(False);self.clear_selection();self.status.setText('世界区段已切换，正在刷新…');self.world_timer.start()

    def request_map(self):
        try:request=(valid_seed(self.seed.text()),self.world.value(),self.vertical.value())
        except Exception as exc:self.status.setText(str(exc));return
        self.requested=request
        if self.working:return
        self.working=True;self.sync_capture_controls();self.load.setEnabled(False);self.capture_button.setEnabled(False);self.status.setText(f'正在生成种子 {request[0]} · 平行世界 {request[1]} 的初始地形和物品…')
        self.progress.setValue(0);self.progress.setFormat('初始化 %p%');self.progress.show()
        def work():
            return request,self.window.view_session.request(op='map',seed=request[0],worldOffset=request[1],verticalIndex=request[2],on_progress=self.generationProgress.emit)
        def result(payload):
            if payload[0]==self.requested and payload[0]==(int(self.seed.text()) if self.seed.text().isdigit() else None,self.world.value(),self.vertical.value()):self.display_map(payload[1])
        def finish():
            self.working=False;self.sync_capture_controls();self.load.setEnabled(True);self.capture_button.setEnabled(True)
            if self.progress.value()<100:self.progress.setFormat('生成未完成，请重试')
            else:self.progress.hide()
            if self.requested!=request:self.request_map()
        self.window.start_job(work,result,finish)

    def update_generation_progress(self,packet):
        self.progress.setValue(packet['value']);self.progress.setFormat(packet['phase']+' · %p%');self.status.setText(packet['phase']+f' · {packet["value"]}%')
        self.position_floating_controls()

    def background_changed(self,*_):
        from .preferences import set_preference
        set_preference('clear_background',self.clear_background.isChecked())
        if self.data:self.draw_terrain();self.schedule_markers()
        elif self.terrain_layer:
            self.terrain_layer.detailed=self.clear_background.isChecked();self.terrain_layer.refresh(self.canvas)

    def draw_terrain(self):
        from shiboken6 import isValid,delete
        if self.overlay_item and isValid(self.overlay_item):self.canvas.scene().removeItem(self.overlay_item);delete(self.overlay_item)
        self.overlay_item=None
        if self.terrain_layer:self.terrain_layer.detach();self.terrain_layer=None
        if self.terrain_item and isValid(self.terrain_item):
            self.canvas.scene().removeItem(self.terrain_item);delete(self.terrain_item)
        self.terrain_item=None
        from .real_terrain import reference_capture
        layer=reference_capture(self.data['seed'],self.data['worldOffset'],self.clear_background.isChecked())
        bounds=QRectF(layer.x,layer.y,layer.width*layer.scale,layer.height*layer.scale)
        self.terrain_layer=layer;layer.install(self.canvas.scene(),extend=not self.data.get('verticalIndex',0));layer.refresh(self.canvas)
        if self.generated_overlay.isChecked():
            from .terrain_overlay import install_overlay
            self.overlay_item=install_overlay(self.canvas.scene(),self.data)
        if bounds.intersects(QRectF(*self.data['origin'],self.data['width'],self.data['height'])):
            self.note.setText('离线实景参考底图；可叠加当前种子可计算区域与资源。参考截图不随种子变化，天界、地狱不叠加生成地形。')
        else:self.note.setText('当前天界 / 地狱区段超出离线实景截图范围；资源标记仍可查看，也可导入对应区段的高清截图。')

    def display_map(self,data):
        self.canvas.selection_start=None;self.canvas.rubber=None
        self.data=data;scene=self.canvas.scene();scene.clear();self.markers=[];self.lines=[];self.area_shapes=[];self.selected_area=None;self.resources_button.setEnabled(False);self.search_area_button.setEnabled(False);self.clear_selection()
        from .map_capture import find_capture
        self.capture=find_capture(data['seed'],data['worldOffset'])
        self.note.setText('当前种子生成地形：10 游戏像素 / 图像像素；对应种子的高清截图可通过“导入高清底图”加载。首领区域不是精确出生点。')
        scene.setSceneRect(QRectF(*data['origin'],data['width'],data['height']))
        self.draw_terrain()
        self.status.setText(f'种子 {data["seed"]} · 平行世界 {data["worldOffset"]} · 上下区段 {data.get("verticalIndex",0)} · {len(data["pois"])} 个物品 / 首领点 · 滚轮缩放，拖动平移')
        if data.get('verticalIndex',0):self.note.setText('天界 / 地狱：已知首段固定商店可查看法术与价格；深处随机商店尚未完整覆盖。实景图只覆盖已拍摄区段，超出范围可导入对应截图。')
        self.fit_region()
        self.install_capture()
        self.progress.hide()
        self.apply_focus()

    def region_changed(self,*_):
        region=self.region.currentData()
        if region in ('sky','hell'):
            direction=-1 if region=='sky' else 1
            self.filters['spell'].setChecked(True)
            if self.vertical.value()*direction<=0:self.vertical.setValue(direction);return
        elif region is None or region=='water' or isinstance(region,int):
            if self.vertical.value()!=0:self.vertical.setValue(0);return
        self.fit_region()

    def fit_region(self,*_):
        if not self.data:return
        region=self.region.currentData();offset=self.data['worldOffset']*35840
        bounds=[0,1536,3072,5120,6656,8704,10752,13312]
        if region=='water':
            rect=QRectF(*(self.data.get('waterCave') or {}).get('bounds',[-2048,515,512,512])).adjusted(-80,-80,80,80)
            if not self.data.get('waterCave'):self.status.setText('此世界没有可确认的水洞布局；主世界可显示种子对应的布局。')
        elif region in ('sky','hell'):
            shops=[p for p in self.data['pois'] if p['type']=='spell' and p.get('paid')]
            rect=QRectF(shops[0]['x']-650,shops[0]['y']-400,1300,800) if shops else QRectF(*self.data['origin'],self.data['width'],self.data['height'])
        elif region is None or self.data.get('verticalIndex',0):rect=QRectF(*self.data['origin'],self.data['width'],self.data['height'])
        else:rect=QRectF(offset-2560,bounds[region]-128,6144,bounds[region+1]-bounds[region]+256)
        self.canvas.fitInView(rect,Qt.KeepAspectRatio);self.schedule_markers()

    def focus_point(self,seed,point):
        self.selection_mode.setCurrentIndex(0)
        world=point.get('worldOffset',math.floor((point['x']+17920)/35840))
        vertical=point.get('verticalIndex',0)
        if self.data and (self.data['seed'],self.data['worldOffset'])==(seed,world):
            if QRectF(*self.data['origin'],self.data['width'],self.data['height']).contains(QPointF(point['x'],point['y'])):vertical=self.data.get('verticalIndex',0)
        self.pending_focus=(seed,world,vertical,point)
        self.seed.setText(str(seed))
        for box,value in ((self.world,world),(self.vertical,vertical)):
            box.blockSignals(True);box.setValue(value);box.blockSignals(False)
        self.world_timer.stop()
        kind=poi_filter(point)
        if kind in self.filters:self.filters[kind].setChecked(True)
        if self.data and (self.data['seed'],self.data['worldOffset'],self.data.get('verticalIndex',0))==(seed,world,vertical):self.apply_focus()
        else:self.request_map()

    def apply_focus(self):
        if not self.pending_focus or not self.data:return
        seed,world,vertical,point=self.pending_focus
        if (self.data['seed'],self.data['worldOffset'],self.data.get('verticalIndex',0))!=(seed,world,vertical):return
        x,y=point['x'],point['y']
        if point.get('source')=='holy_mountain':
            match=next((p for p in self.data['pois'] if p.get('source')=='holy_mountain' and abs(p['x']-x)<1 and abs(p['y']-y)<1),None)
            if match and match.get('shopBounds'):
                center=QRectF(*match['shopBounds']).center();x,y=center.x(),center.y()
        zoom=max(.003,min(12,float(point.get('zoom',.65))))
        self.pending_focus=None;self.canvas.resetTransform();self.canvas.scale(zoom,zoom);self.canvas.centerOn(x,y);self.schedule_markers()
        self.status.setText(f'已定位：{poi_title(point)} · 世界 {world} · ({point["x"]:g}, {point["y"]:g})')

    def schedule_markers(self,*_):self.refresh_timer.start(25)

    def update_markers(self):
        scene=self.canvas.scene()
        for item in self.markers+self.lines:scene.removeItem(item)
        self.markers=[];self.lines=[]
        if self.terrain_layer:self.terrain_layer.refresh(self.canvas)
        if not self.data:return
        if self.capture and self.capture.enabled and (self.capture.seed,self.capture.world)==(self.data['seed'],self.data['worldOffset']):self.capture.refresh(self.canvas)
        zoom=self.canvas.transform().m11()
        visible=self.canvas.mapToScene(self.canvas.viewport().rect()).boundingRect();size=sprite_size(zoom,self.icon_size.value())
        points=[p for p in self.data['pois'] if poi_filter(p) in self.filters and self.filters[poi_filter(p)].isChecked()]
        if zoom<MIN_ITEM_ZOOM and not self.precise.isChecked():
            landmarks=[p for p in points if poi_filter(p) in ('special','tablet') and visible.contains(QPointF(p['x'],p['y']))]
            for pos,items in anchored_groups(landmarks,lambda p:self.canvas.mapFromScene(QPointF(p['x'],p['y'])),20):
                marker=WorldSprite(items,20,self.select_group);marker.setPos(items[0]['x'],items[0]['y']);scene.addItem(marker);self.markers.append(marker)
        if self.precise.isChecked():
            if zoom>=MIN_ITEM_ZOOM:
                for point in points:
                    if point.get('source')=='holy_mountain':continue
                    if not visible.contains(QPointF(point['x'],point['y'])):continue
                    marker=NativeSprite(point,self.select_group);marker.setPos(point['x'],point['y']);scene.addItem(marker);self.markers.append(marker)
        shops={}
        if zoom>=MIN_SHOP_ZOOM:
            for p in points:
                if p.get('source')=='holy_mountain':shops.setdefault(p.get('shopLevel',int(p['y']//1536)),[]).append(p)
            for items in shops.values():
                level=items[0].get('shopLevel',0)
                offset=self.data['worldOffset']*35840
                default_bounds=[offset+[-3,-4,-5,-4,-5,-6,-6][level]*512,[2,5,9,12,16,20,25][level]*512,[7,8,10,7,9,11,9][level]*512,512]
                bounds=QRectF(*items[0].get('shopBounds',default_bounds));x=bounds.center().x();y=bounds.center().y()
                if not visible.adjusted(-500/zoom,-150/zoom,500/zoom,150/zoom).contains(QPointF(x,y)):continue
                marker=HolyShopMarker(items,zoom,self.select_group,bounds);marker.setPos(x,y);scene.addItem(marker);self.markers.append(marker)
        if self.precise.isChecked():return
        if zoom<MIN_ITEM_ZOOM:return
        points=[p for p in points if p.get('source')!='holy_mountain' and visible.contains(QPointF(p['x'],p['y']))]
        groups=anchored_groups(points,lambda p:self.canvas.mapFromScene(QPointF(p['x'],p['y'])),size)
        for pos,items in groups:
            marker=WorldSprite(items,int(size),self.select_group);marker.setPos(items[0]['x'],items[0]['y']);scene.addItem(marker);self.markers.append(marker)

    def clear_selection(self):self.group=[]

    def select_group(self,items):
        self.group=items
        if len(items)==1:
            self.open_item(items[0]);return
        content=QWidget();layout=QVBoxLayout(content);listing=QListWidget();listing.setIconSize(QSize(36,36));layout.addWidget(QLabel('这些物品在当前位置重叠，选择一项查看详情。'));layout.addWidget(listing)
        for p in items:listing.addItem(QListWidgetItem(poi_icon(p),f'{poi_title(p)} · {price_label(p)}'))
        listing.itemClicked.connect(lambda item:self.open_item(items[listing.row(item)]))
        dialog=ItemDialog('当前位置的物品',content,self);dialog.exec();dialog.deleteLater()

    def open_item(self,p):
        if p['type']=='wand':
            content=QWidget();layout=QVBoxLayout(content);layout.addWidget(WandCard(map_wand(p)));layout.addWidget(QLabel('获取花费：'+price_label(p)));layout.addWidget(QLabel(f'位置：({p["x"]:g}, {p["y"]:g})'))
        elif p['type']=='spell':content=SpellCard(p['spell'],price=p.get('price'))
        elif p['type'] in ('chest','pickup','potion'):
            content=QWidget();layout=QVBoxLayout(content)
            label=QLabel();label.setPixmap(poi_icon(p).pixmap(48,48));layout.addWidget(label)
            layout.addWidget(QLabel(poi_title(p)+f' · ({p["x"]:g}, {p["y"]:g})'))
            if p.get('material'):layout.addWidget(QLabel('内容物：'+name(p['material'])))
            from .item_info import material_effect,item_description
            from .detail_ui import wiki_button
            description=QLabel(material_effect(p['material']) if p.get('material') else item_description(p.get('item','chest')));description.setWordWrap(True);layout.addWidget(description)
            layout.addWidget(wiki_button(p.get('material') or p.get('item','chest'),bool(p.get('material'))))
            if p.get('accuracy')=='region':layout.addWidget(QLabel('房间内参考位置，非物品的精确落点。'))
            if p.get('relatedSpell'):
                from .detail_ui import spell_button
                layout.addWidget(QLabel('关联魔球的解锁法术'));layout.addWidget(spell_button(p['relatedSpell'],self),0,Qt.AlignLeft)
            if p.get('amount'):layout.addWidget(QLabel('数量：'+str(p['amount'])))
            if p['type']=='chest':
                layout.addWidget(QLabel('预计宝箱内容（点击图标查看详情）'))
                grid=QGridLayout();layout.addLayout(grid)
                for i,child in enumerate(p.get('items',[])):
                    obj=dict(child,x=child.get('x',p['x']),y=child.get('y',p['y']),price=0)
                    obj['type']='wand' if child.get('type')=='wand' else 'spell' if child.get('spell') else 'chest' if child.get('type') in ('chest','great_chest') else 'potion' if child.get('item')=='potion' else 'pickup'
                    tile=QToolButton();tile.setIcon(poi_icon(obj));tile.setIconSize(QSize(36,36));tile.setFixedSize(54,54);tile.setToolTip(poi_title(obj));tile.clicked.connect(lambda _,o=obj:self.open_item(o));grid.addWidget(tile,i//6,i%6)
            layout.addStretch()
        else:
            from .biome_names import biome_name
            content=QLabel(f'{poi_title(p)}\n区域：{biome_name(p.get("source",""))}\n位置：({p["x"]:g}, {p["y"]:g})\n'+('房间区域中心，并非精确出生坐标。' if p.get('accuracy')=='region' else '生成实体点'))
        from .detail_ui import show_window
        show_window(ItemDialog(poi_title(p),content,self))

