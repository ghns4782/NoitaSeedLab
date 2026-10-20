from PySide6.QtCore import Qt,Signal,QSize
from PySide6.QtGui import QPainter,QPen,QColor
from PySide6.QtWidgets import QWidget

class RangeSlider(QWidget):
    changed=Signal(float,float)
    def __init__(self,minimum,maximum,low,high,parent=None):
        super().__init__(parent)
        self.minimum=minimum;self.maximum=maximum;self.low=low;self.high=high;self.active=None
        self.setMinimumWidth(120);self.setFixedHeight(26);self.setCursor(Qt.SizeHorCursor)
    def sizeHint(self):return QSize(240,26)
    def x(self,value):return 9+(self.width()-18)*(value-self.minimum)/(self.maximum-self.minimum)
    def set_values(self,low,high):self.low=low;self.high=high;self.update()
    def paintEvent(self,event):
        p=QPainter(self);p.setRenderHint(QPainter.Antialiasing)
        p.setPen(QPen(QColor('#37445a'),5,Qt.SolidLine,Qt.RoundCap));p.drawLine(9,13,self.width()-9,13)
        p.setPen(QPen(QColor('#8ed1c5'),5,Qt.SolidLine,Qt.RoundCap));p.drawLine(int(self.x(self.low)),13,int(self.x(self.high)),13)
        p.setPen(QPen(QColor('#111721'),2));p.setBrush(QColor('#f1d49b'))
        for v in (self.low,self.high):p.drawEllipse(int(self.x(v))-7,6,14,14)
    def mousePressEvent(self,event):
        x=event.position().x()
        self.active='low' if abs(x-self.x(self.low))<abs(x-self.x(self.high)) else 'high'
        self.move_handle(x)
    def mouseMoveEvent(self,event):
        if self.active:self.move_handle(event.position().x())
    def mouseReleaseEvent(self,event):self.active=None
    def move_handle(self,x):
        value=self.minimum+max(0,min(1,(x-9)/max(1,self.width()-18)))*(self.maximum-self.minimum)
        if self.active=='low':self.low=min(value,self.high)
        else:self.high=max(value,self.low)
        self.changed.emit(self.low,self.high);self.update()
