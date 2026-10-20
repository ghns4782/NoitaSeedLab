"""Virtualized seed rows: store integers, create text only for visible indexes."""
from PySide6.QtCore import Qt,QSize,Signal,QAbstractListModel,QModelIndex
from PySide6.QtWidgets import QListView,QAbstractItemView

class SeedModel(QAbstractListModel):
    def __init__(self,parent=None):
        super().__init__(parent);self.seeds=[]
    def rowCount(self,parent=QModelIndex()):return 0 if parent.isValid() else len(self.seeds)
    def data(self,index,role=Qt.DisplayRole):
        if not index.isValid() or not 0<=index.row()<len(self.seeds):return None
        seed=self.seeds[index.row()]
        if role==Qt.DisplayRole:return f'{seed}\n双击查看种子信息'
        if role==Qt.UserRole:return seed
        if role==Qt.SizeHintRole:return QSize(200,62)
    def append(self,seeds):
        if not seeds:return
        first=len(self.seeds);self.beginInsertRows(QModelIndex(),first,first+len(seeds)-1)
        self.seeds.extend(seeds);self.endInsertRows()
    def clear(self):
        self.beginResetModel();self.seeds.clear();self.endResetModel()

class SeedItem:
    def __init__(self,seed):self.seed=seed
    def data(self,role):return self.seed if role==Qt.UserRole else str(self.seed)

class SeedResultView(QListView):
    itemDoubleClicked=Signal(object)
    def __init__(self,parent=None):
        super().__init__(parent);self.seed_model=SeedModel(self);self.setModel(self.seed_model)
        self.setUniformItemSizes(True);self.setLayoutMode(QListView.Batched);self.setBatchSize(128)
        self.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)
        self.doubleClicked.connect(lambda index:self.itemDoubleClicked.emit(SeedItem(index.data(Qt.UserRole))))
    def count(self):return self.seed_model.rowCount()
    def currentItem(self):
        index=self.currentIndex();return SeedItem(index.data(Qt.UserRole)) if index.isValid() else None
    def append_seeds(self,seeds):self.seed_model.append(seeds)
    def clear(self):self.seed_model.clear()
