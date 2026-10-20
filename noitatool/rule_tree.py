from PySide6.QtCore import Qt,Signal
from PySide6.QtGui import QDrag
from PySide6.QtWidgets import QTreeWidget,QAbstractItemView


class RuleTree(QTreeWidget):
    reordered=Signal()

    def __init__(self,parent=None):
        super().__init__(parent);self.setDragDropMode(QAbstractItemView.InternalMove);self.setDefaultDropAction(Qt.MoveAction)
        self.setDragEnabled(True);self.setAcceptDrops(True);self.setDropIndicatorShown(True)
        self.setToolTip('拖动条件名称可调整顺序；放到 AND / OR / NOT 组内可移动到该组。')

    def startDrag(self,supported_actions):
        # The custom drop handler moves and rebuilds items itself. Avoid the
        # base view's post-drop source deletion, which would delete a second row.
        item=self.currentItem()
        if not item or not item.parent():return
        drag=QDrag(self);drag.setMimeData(self.model().mimeData(self.selectedIndexes()));drag.exec(Qt.MoveAction)

    def move_item(self,item,parent,index=-1):
        if not item or not item.parent() or not parent:return False
        cursor=parent
        while cursor:
            if cursor is item:return False
            cursor=cursor.parent()
        kind=parent.data(0,Qt.UserRole)['type']
        if kind not in ('and','or','not'):return False
        if kind=='not' and parent.childCount() and item.parent() is not parent:return False
        old=item.parent();old_index=old.indexOfChild(item)
        if parent is old and index>old_index:index-=1
        old.takeChild(old_index)
        parent.insertChild(parent.childCount() if index<0 else index,item)
        self.reordered.emit();return True

    def dropEvent(self,event):
        if event.source() is not self:event.ignore();return
        item=self.currentItem();target=self.itemAt(event.position().toPoint())
        if not target:event.ignore();return
        position=self.dropIndicatorPosition()
        if position==QAbstractItemView.OnItem:
            parent=target;index=-1
        else:
            parent=target.parent();index=parent.indexOfChild(target)+(position==QAbstractItemView.BelowItem) if parent else -1
        if self.move_item(item,parent,index):event.accept()
        else:event.ignore()
