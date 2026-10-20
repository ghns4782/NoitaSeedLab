"""Searchable, multi-select pixel-icon palettes and compact selections."""
from PySide6.QtCore import Qt,QSize,Signal
from PySide6.QtWidgets import QDialog,QVBoxLayout,QHBoxLayout,QLineEdit,QLabel,QListWidget,QListWidgetItem,QDialogButtonBox,QAbstractItemView,QWidget,QPushButton
from .catalog import icon,name,record,tr,read_json


def enable_spell_inspection(grid,parent):
    grid.setContextMenuPolicy(Qt.CustomContextMenu)
    def inspect(position):
        item=grid.itemAt(position)
        if item and item.data(Qt.UserRole) in read_json('obj/spells.json'):
            from .detail_ui import show_spell
            show_spell(item.data(Qt.UserRole),parent)
    grid.customContextMenuRequested.connect(inspect)

def inspect_icon(item,parent):
    key=item.data(Qt.UserRole)
    from .detail_ui import show_spell,show_perk
    if key in read_json('obj/spells.json'):show_spell(key,parent);return True
    if key in read_json('obj/perks.json'):show_perk(key,parent);return True
    return False

def tooltip(key):
    data=record(key)
    desc=data.get('ui_description',data.get('description',''))
    if key in read_json('materials.json'):
        from .item_info import material_effect
        desc=material_effect(key)
    return name(key)+'\n'+key+('\n'+tr(desc) if desc else '')

class IconPickerDialog(QDialog):
    def __init__(self,values,selected=(),parent=None,title='选择图标',multiple=True):
        super().__init__(parent)
        values=list(values);self.material_labels=bool(values) and all(k in read_json('materials.json') for k in values)
        self.setWindowTitle(title)
        self.resize(1020,740)
        self.multiple=multiple
        layout=QVBoxLayout(self)
        row=QHBoxLayout()
        self.search=QLineEdit(placeholderText='搜索中文名、英文 ID 或描述…')
        self.search.setClearButtonEnabled(True)
        row.addWidget(self.search)
        self.count=QLabel()
        row.addWidget(self.count)
        layout.addLayout(row)
        self.grid=QListWidget()
        self.grid.setViewMode(QListWidget.IconMode)
        self.grid.setResizeMode(QListWidget.Adjust)
        self.grid.setMovement(QListWidget.Static)
        enable_spell_inspection(self.grid,self)
        self.grid.setSelectionMode(QAbstractItemView.MultiSelection if multiple else QAbstractItemView.SingleSelection)
        self.grid.setIconSize(QSize(32,32))
        self.grid.setGridSize(QSize(104,76) if self.material_labels else QSize(48,48));self.grid.setWordWrap(self.material_labels)
        self.grid.setStyleSheet('QListWidget::item{border:1px solid transparent;border-radius:4px}QListWidget::item:selected{background:#35594f;border:1px solid #8ed1c5}')
        for key in values:
            item=QListWidgetItem(icon(key),name(key) if self.material_labels else '')
            item.setData(Qt.UserRole,key)
            item.setData(Qt.UserRole+1,tooltip(key).lower())
            item.setToolTip(tooltip(key))
            item.setSizeHint(QSize(100,72) if self.material_labels else QSize(44,44))
            self.grid.addItem(item)
            item.setSelected(key in selected)
        layout.addWidget(self.grid,1)
        self.names=QLabel()
        self.names.setWordWrap(True)
        self.names.setMaximumHeight(60)
        layout.addWidget(self.names)
        footer=QHBoxLayout()
        clear=QPushButton('清空选择')
        clear.clicked.connect(self.grid.clearSelection)
        footer.addWidget(clear)
        footer.addStretch()
        buttons=QDialogButtonBox(QDialogButtonBox.Ok|QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept);buttons.rejected.connect(self.reject)
        footer.addWidget(buttons)
        layout.addLayout(footer)
        self.search.textChanged.connect(self.filter)
        self.grid.itemSelectionChanged.connect(self.update_count)
        self.grid.itemDoubleClicked.connect(lambda item:inspect_icon(item,self) or (self.accept() if not multiple else None))
        self.update_count()
        self.search.setFocus()

    def filter(self,text):
        query=text.strip().lower()
        for i in range(self.grid.count()):
            item=self.grid.item(i)
            item.setHidden(query not in item.data(Qt.UserRole+1))

    def values(self):
        return [self.grid.item(i).data(Qt.UserRole) for i in range(self.grid.count()) if self.grid.item(i).isSelected()]

    def update_count(self):
        values=self.values()
        self.count.setText(f'已选 {len(values)} / {self.grid.count()}')
        self.names.setText('、'.join(name(k) for k in values) if values else '点击图标选择；悬停查看名称与说明。')

class SelectionField(QWidget):
    changed=Signal()
    def __init__(self,possible,selected=(),parent=None,multiple=True,title='选择图标'):
        super().__init__(parent)
        self.setFixedHeight(132)
        self.possible=list(possible);self.selected=list(selected);self.multiple=multiple;self.title=title
        self.material_labels=bool(self.possible) and all(k in read_json('materials.json') for k in self.possible)
        layout=QVBoxLayout(self);layout.setContentsMargins(0,0,0,0)
        self.grid=QListWidget()
        self.grid.setViewMode(QListWidget.IconMode)
        self.grid.setResizeMode(QListWidget.Adjust)
        self.grid.setMovement(QListWidget.Static)
        self.grid.setIconSize(QSize(30,30));self.grid.setGridSize(QSize(42,42))
        if self.material_labels:self.grid.setGridSize(QSize(104,76));self.grid.setWordWrap(True)
        self.grid.setFixedHeight(90)
        self.grid.setToolTip('点击下方按钮选择；双击法术或天赋图标打开详情，右键法术也可查看')
        enable_spell_inspection(self.grid,self)
        self.grid.itemDoubleClicked.connect(lambda item:inspect_icon(item,self) or self.choose())
        self.pick=QPushButton('选择图标…')
        self.pick.clicked.connect(self.choose)
        layout.addWidget(self.grid);layout.addWidget(self.pick)
        self.refresh()

    def values(self):return self.selected.copy()
    def set_values(self,values):
        self.selected=list(dict.fromkeys(values));self.refresh();self.changed.emit()
    def refresh(self):
        self.grid.clear()
        for key in self.selected:
            item=QListWidgetItem(icon(key),name(key) if self.material_labels else '');item.setData(Qt.UserRole,key);item.setToolTip(tooltip(key)+'\n双击打开详情；右键查看法术详情');item.setSizeHint(QSize(100,72) if self.material_labels else QSize(40,40))
            self.grid.addItem(item)
        self.pick.setText(f'{self.title}…（已选 {len(self.selected)}）')
    def choose(self):
        dialog=IconPickerDialog(self.possible,self.selected,self,self.title,self.multiple)
        if dialog.exec():self.set_values(dialog.values())

class SingleIconPicker(QWidget):
    def __init__(self,values,any_value=False):
        super().__init__();self.options=([None] if any_value else [])+list(values);self.index=0
        layout=QHBoxLayout(self);layout.setContentsMargins(0,0,0,0)
        self.button=QPushButton();self.button.setIconSize(QSize(26,26));layout.addWidget(self.button)
        self.button.clicked.connect(self.choose);self.refresh()
    def currentData(self):return self.options[self.index] if self.index>=0 else None
    def findData(self,value):return self.options.index(value) if value in self.options else -1
    def setCurrentIndex(self,index):self.index=index;self.refresh()
    def refresh(self):
        key=self.currentData();self.button.setText(name(key) if key else '不限 / 选择材料…')
        from PySide6.QtGui import QIcon
        self.button.setIcon(icon(key) if key else QIcon());self.button.setToolTip(tooltip(key) if key else '点击打开可搜索的图标面板')
    def choose(self):
        key=self.currentData();dialog=IconPickerDialog([k for k in self.options if k],[key] if key else [],self,multiple=False)
        if dialog.exec():
            selected=dialog.values();self.setCurrentIndex(self.findData(selected[0]) if selected else self.findData(None))
