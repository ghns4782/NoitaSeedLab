"""Bounded-resolution crop and world-alignment editor for imported captures."""
import math
from pathlib import Path
from PySide6.QtCore import Qt,QPointF,QRectF,QTimer,QSize
from PySide6.QtGui import QImageReader,QPixmap,QPainter,QPen,QColor,QTransform
from PySide6.QtWidgets import (QDialog,QVBoxLayout,QHBoxLayout,QLabel,QTabWidget,QGraphicsView,
    QGraphicsScene,QGraphicsRectItem,QGraphicsItem,QPushButton,QDialogButtonBox,QDoubleSpinBox,
    QFormLayout,QSlider,QSplitter,QWidget)
from .map_capture import Capture


def preview(capture,limit=1600):
    """DZI reads only a coarse level, never the full raster or its fine tiles."""
    if not capture.dzi:
        reader=QImageReader(str(capture.path));size=reader.size()
        if max(size.width(),size.height())>limit:reader.setScaledSize(size.scaled(QSize(limit,limit),Qt.KeepAspectRatio))
        image=reader.read()
        if image.isNull():raise ValueError('无法读取底图预览')
        return QPixmap.fromImage(image)
    level=min(capture.level,max(0,int(math.floor(math.log2(limit)))))
    factor=2**(capture.level-level)
    width=math.ceil(capture.width/factor);height=math.ceil(capture.height/factor)
    pix=QPixmap(width,height);pix.fill(Qt.transparent);painter=QPainter(pix)
    try:
        for y in range(math.ceil(height/capture.tile)):
            for x in range(math.ceil(width/capture.tile)):
                tile=QPixmap(str(capture.folder/str(level)/f'{x}_{y}.{capture.format}'))
                if tile.isNull():continue
                painter.drawPixmap(x*capture.tile-(capture.overlap if x else 0),y*capture.tile-(capture.overlap if y else 0),tile)
    finally:painter.end()
    return pix


class EditView(QGraphicsView):
    def __init__(self):
        super().__init__();self.setScene(QGraphicsScene(self));self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setDragMode(QGraphicsView.ScrollHandDrag);self.setBackgroundBrush(QColor('#111722'));self.pan=None
    def wheelEvent(self,event):
        zoom=self.transform().m11();factor=1.25 if event.angleDelta().y()>0 else .8
        if .0001<zoom*factor<100:self.scale(factor,factor)
        event.accept()
    def mousePressEvent(self,event):
        if event.button()==Qt.MiddleButton:self.pan=event.position();event.accept();return
        super().mousePressEvent(event)
    def mouseMoveEvent(self,event):
        if self.pan is not None:
            delta=event.position()-self.pan;self.pan=event.position()
            self.horizontalScrollBar().setValue(self.horizontalScrollBar().value()-int(delta.x()))
            self.verticalScrollBar().setValue(self.verticalScrollBar().value()-int(delta.y()));event.accept();return
        super().mouseMoveEvent(event)
    def mouseReleaseEvent(self,event):
        if event.button()==Qt.MiddleButton:self.pan=None;event.accept();return
        super().mouseReleaseEvent(event)


class Handle(QGraphicsRectItem):
    def __init__(self,owner,index):
        super().__init__(-5,-5,10,10,owner);self.owner=owner;self.index=index
        self.setFlag(QGraphicsItem.ItemIgnoresTransformations);self.setBrush(QColor('#ffda80'));self.setPen(QPen(QColor('#222833')))
        self.setCursor([Qt.SizeFDiagCursor,Qt.SizeVerCursor,Qt.SizeBDiagCursor,Qt.SizeHorCursor,
                        Qt.SizeFDiagCursor,Qt.SizeVerCursor,Qt.SizeBDiagCursor,Qt.SizeHorCursor][index])
    def mousePressEvent(self,event):event.accept()
    def mouseMoveEvent(self,event):self.owner.resize_at(self.index,event.scenePos());event.accept()
    def mouseReleaseEvent(self,event):event.accept()


class EditFrame(QGraphicsRectItem):
    def __init__(self,rect,on_change,limit=None):
        super().__init__();self.on_change=on_change;self.limit=limit;self.updating=True
        self.setFlags(QGraphicsItem.ItemIsMovable|QGraphicsItem.ItemSendsGeometryChanges)
        pen=QPen(QColor('#ffda80'),2);pen.setCosmetic(True);self.setPen(pen);self.setBrush(Qt.NoBrush);self.setZValue(5)
        self.handles=[Handle(self,i) for i in range(8)]
        self.set_world_rect(rect,notify=False);self.updating=False
    def world_rect(self):return self.mapRectToScene(self.rect())
    def set_world_rect(self,rect,notify=True):
        self.updating=True;self.setRect(0,0,rect.width(),rect.height());self.setPos(rect.topLeft())
        r=self.rect();points=[r.topLeft(),QPointF(r.center().x(),r.top()),r.topRight(),QPointF(r.right(),r.center().y()),
            r.bottomRight(),QPointF(r.center().x(),r.bottom()),r.bottomLeft(),QPointF(r.left(),r.center().y())]
        for handle,point in zip(self.handles,points):handle.setPos(point)
        self.updating=False
        if notify:self.on_change()
    def resize_at(self,index,point):
        rect=self.world_rect();x,y=point.x(),point.y()
        if self.limit is not None:
            x=max(self.limit.left(),min(self.limit.right(),x));y=max(self.limit.top(),min(self.limit.bottom(),y))
        if index in (0,6,7):rect.setLeft(min(x,rect.right()-1))
        if index in (2,3,4):rect.setRight(max(x,rect.left()+1))
        if index in (0,1,2):rect.setTop(min(y,rect.bottom()-1))
        if index in (4,5,6):rect.setBottom(max(y,rect.top()+1))
        self.set_world_rect(rect)
    def itemChange(self,change,value):
        if change==QGraphicsItem.ItemPositionChange and self.limit is not None and not self.updating:
            value=QPointF(max(self.limit.left(),min(self.limit.right()-self.rect().width(),value.x())),
                          max(self.limit.top(),min(self.limit.bottom()-self.rect().height(),value.y())))
        result=super().itemChange(change,value)
        if change==QGraphicsItem.ItemPositionHasChanged and not self.updating:self.on_change()
        return result


class CaptureEditor(QDialog):
    def __init__(self,path,seed,world,parent=None,capture=None):
        super().__init__(parent);self.setWindowTitle('高清底图 · 裁切与地图对齐');self.resize(1080,780)
        self.source=capture or Capture(path,seed,world,-17920+world*35840,-31744)
        self.image=preview(self.source);self.updating=True
        layout=QVBoxLayout(self);intro=QLabel('先用八点框裁切，再切到地图对齐，拖动框体定位、拖动角点或边点调整覆盖范围。滚轮缩放，中键平移。')
        intro.setWordWrap(True);layout.addWidget(intro)
        self.tabs=QTabWidget();layout.addWidget(self.tabs,1)
        crop_page=QWidget();crop_layout=QVBoxLayout(crop_page);self.crop_view=EditView();crop_layout.addWidget(self.crop_view,1)
        self.crop_view.scene().addPixmap(self.image);self.crop_view.scene().setSceneRect(QRectF(self.image.rect()))
        cx,cy,cw,ch=self.source.crop;sx=self.image.width()/self.source.width;sy=self.image.height()/self.source.height
        self.crop_frame=EditFrame(QRectF(cx*sx,cy*sy,cw*sx,ch*sy),self.crop_changed,QRectF(self.image.rect()))
        self.crop_view.scene().addItem(self.crop_frame)
        reset=QPushButton('保留整张图片');reset.clicked.connect(lambda:self.crop_frame.set_world_rect(QRectF(self.image.rect())))
        crop_layout.addWidget(reset);self.tabs.addTab(crop_page,'1 · 八点框裁切')
        align_page=QWidget();align_layout=QVBoxLayout(align_page);split=QSplitter();align_layout.addWidget(split,1)
        self.map_view=EditView();split.addWidget(self.map_view);side=QWidget();form=QFormLayout(side);split.addWidget(side)
        from .real_terrain import reference_capture
        reference=reference_capture(seed,world);background=preview(reference,1024)
        item=self.map_view.scene().addPixmap(background)
        item.setTransform(QTransform.fromScale(reference.width*reference.scale/background.width(),reference.height*reference.scale/background.height()))
        item.setPos(reference.x,reference.y);item.setZValue(-10)
        self.reference_bounds=reference.bounds();self.map_view.scene().setSceneRect(self.reference_bounds)
        self.overlay=self.map_view.scene().addPixmap(self.image);self.overlay.setOpacity(.7)
        self.map_frame=EditFrame(self.source.bounds(),self.map_changed);self.map_view.scene().addItem(self.map_frame)
        self.fields=[]
        for title in ['左边界 X','上边界 Y','覆盖宽度','覆盖高度']:
            field=QDoubleSpinBox();field.setDecimals(3);field.setRange(-1e8 if len(self.fields)<2 else .001,1e8)
            form.addRow(title,field);field.valueChanged.connect(self.fields_changed);self.fields.append(field)
        opacity=QSlider(Qt.Horizontal);opacity.setRange(10,100);opacity.setValue(70);opacity.valueChanged.connect(lambda value:self.overlay.setOpacity(value/100))
        form.addRow('预览透明度',opacity)
        fit_world=QPushButton('按标准世界宽度对齐');fit_world.clicked.connect(self.align_world);form.addRow(fit_world)
        fit_view=QPushButton('查看全部定位范围');fit_view.clicked.connect(self.fit_alignment);form.addRow(fit_view)
        self.summary=QLabel();self.summary.setWordWrap(True);form.addRow(self.summary)
        hint=QLabel('参考底图用于判断位置，不代表当前种子的精确随机地形。\n裁切和定位只保存参数，不修改原始图片。');hint.setWordWrap(True);form.addRow(hint)
        split.setStretchFactor(0,1);split.setSizes([780,250]);self.tabs.addTab(align_page,'2 · 在地图上拖动对齐')
        buttons=QDialogButtonBox(QDialogButtonBox.Ok|QDialogButtonBox.Cancel);buttons.accepted.connect(self.accept);buttons.rejected.connect(self.reject);layout.addWidget(buttons)
        self.updating=False;self.last_crop=list(self.source.crop)
        if capture is None:self.align_world()
        self.crop_changed();self.tabs.currentChanged.connect(self.fit_tab);QTimer.singleShot(0,self.fit_tab)
    def selected_crop(self):
        rect=self.crop_frame.world_rect();sx=self.source.width/self.image.width();sy=self.source.height/self.image.height()
        x=max(0,min(self.source.width-1,round(rect.x()*sx)));y=max(0,min(self.source.height-1,round(rect.y()*sy)))
        right=max(x+1,min(self.source.width,round(rect.right()*sx)));bottom=max(y+1,min(self.source.height,round(rect.bottom()*sy)))
        return [x,y,right-x,bottom-y]
    def crop_changed(self):
        if self.updating:return
        crop=self.selected_crop();old=self.last_crop;rect=self.map_frame.world_rect();sx=rect.width()/old[2];sy=rect.height()/old[3]
        self.last_crop=crop
        self.map_frame.set_world_rect(QRectF(rect.x()+(crop[0]-old[0])*sx,rect.y()+(crop[1]-old[1])*sy,crop[2]*sx,crop[3]*sy))
    def map_changed(self):
        if self.updating:return
        rect=self.map_frame.world_rect();crop=self.selected_crop()
        preview_rect=self.crop_frame.world_rect().toAlignedRect().intersected(self.image.rect())
        pix=self.image.copy(preview_rect);self.overlay.setPixmap(pix)
        self.overlay.setPos(rect.topLeft());self.overlay.setTransform(QTransform.fromScale(rect.width()/pix.width(),rect.height()/pix.height()))
        self.updating=True
        for field,value in zip(self.fields,[rect.x(),rect.y(),rect.width(),rect.height()]):field.setValue(value)
        self.updating=False
        self.summary.setText(f'原图裁切：X {crop[0]} / Y {crop[1]}\n{crop[2]} × {crop[3]} 像素\n地图比例：{rect.width()/crop[2]:.6f} × {rect.height()/crop[3]:.6f}')
    def fields_changed(self):
        if not self.updating:self.map_frame.set_world_rect(QRectF(*(field.value() for field in self.fields)))
    def align_world(self):
        crop=self.selected_crop();self.map_frame.set_world_rect(QRectF(-17920+self.source.world*35840,-31744,35840,crop[3]*35840/crop[2]))
        self.fit_alignment()
    def fit_alignment(self):
        bounds=self.reference_bounds.united(self.map_frame.world_rect());padding=max(bounds.width(),bounds.height())*.02
        bounds=bounds.adjusted(-padding,-padding,padding,padding);self.map_view.scene().setSceneRect(bounds)
        self.map_view.fitInView(bounds,Qt.KeepAspectRatio)
    def fit_tab(self,*_):
        if self.tabs.currentIndex()==0:
            padding=max(self.image.width(),self.image.height())*.02
            bounds=QRectF(self.image.rect()).adjusted(-padding,-padding,padding,padding)
            self.crop_view.scene().setSceneRect(bounds);self.crop_view.fitInView(bounds,Qt.KeepAspectRatio)
        else:self.fit_alignment()
    def capture(self):
        rect=self.map_frame.world_rect();crop=self.selected_crop()
        return Capture(self.source.path,self.source.seed,self.source.world,rect.x(),rect.y(),rect.width()/crop[2],
                       crop=crop,scale_y=rect.height()/crop[3])
