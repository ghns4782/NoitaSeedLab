"""Small offline screenshot overview, kept separate from seed-specific data."""
from PySide6.QtCore import Qt,QRectF,QTimer
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QLabel,QPushButton
from .paths import ROOT

class OfflineMap(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent)
        from .map_ui import MapCanvas
        layout=QVBoxLayout(self)
        note=QLabel('离线实景总览 · 已校准游戏坐标，直接用于区域搜索与地图查看。\n固定截图布局，当前种子的随机内部地形可能不同；放大时按需读取清晰切片。');note.setWordWrap(True);layout.addWidget(note)
        row=QHBoxLayout();layout.addLayout(row)
        self.canvas=MapCanvas();self.canvas.set_selection_mode('pan')
        from .real_terrain import reference_capture
        self.tiles=reference_capture(0);self.tiles.install(self.canvas.scene())
        self.image=QPixmap(str(ROOT/'assets/real-terrain_files/8/0_0.png'))
        self.refresh_timer=QTimer(self);self.refresh_timer.setSingleShot(True);self.refresh_timer.setInterval(25);self.refresh_timer.timeout.connect(lambda:self.tiles.refresh(self.canvas));self.canvas.changed.connect(lambda:self.refresh_timer.start())
        for title,action in [('全图',self.fit),('＋',lambda:self.canvas.zoom(1.4)),('－',lambda:self.canvas.zoom(1/1.4))]:
            button=QPushButton(title);button.clicked.connect(action);row.addWidget(button)
        row.addStretch();layout.addWidget(self.canvas,1)
        layout.addWidget(QLabel('滚轮缩放 · 按住鼠标拖动 · 原始截图以外的区域未补画'))
        QTimer.singleShot(0,self.fit)
    def fit(self):self.canvas.fitInView(self.canvas.sceneRect(),Qt.KeepAspectRatio);self.tiles.refresh(self.canvas)
    def showEvent(self,event):super().showEvent(event);QTimer.singleShot(0,self.fit)

def show_offline_map(parent=None):
    from .detail_ui import ItemDialog,show_window
    dialog=ItemDialog('离线实景总览',OfflineMap(),parent);dialog.resize(1000,800)
    return show_window(dialog)
