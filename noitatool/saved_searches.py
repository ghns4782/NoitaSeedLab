"""Named search rules stored locally, independently of computation settings."""
import json
import uuid
from pathlib import Path
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QDialog,QVBoxLayout,QHBoxLayout,QListWidget,QListWidgetItem,QLineEdit,QPushButton,QLabel,QMessageBox
from .paths import STATE as ROOT
from .search import validate_rule

class SearchLibrary:
    def __init__(self,directory=None):self.directory=Path(directory) if directory is not None else ROOT/'saved-searches'
    def entries(self):
        result=[]
        if self.directory.exists():
            for path in sorted(self.directory.glob('*.json')):
                data=json.loads(path.read_text(encoding='utf-8'))
                validate_rule(data['rule']);result.append((path,data))
        return sorted(result,key=lambda entry:entry[1]['name'].casefold())
    def save(self,name,rule):
        from .persistence import persistent_rule
        rule=persistent_rule(rule)
        from .advanced_ui import validate_advanced
        validate_advanced(rule)
        name=name.strip()
        if not name:raise ValueError('请填写方案名称')
        validate_rule(rule)
        path=next((p for p,d in self.entries() if d['name']==name),None)
        self.directory.mkdir(parents=True,exist_ok=True)
        path=path or self.directory/(uuid.uuid4().hex+'.json')
        temporary=path.with_suffix('.tmp')
        temporary.write_text(json.dumps({'name':name,'rule':rule},ensure_ascii=False,indent=2),encoding='utf-8')
        temporary.replace(path)
        return path

class SavedSearchDialog(QDialog):
    def __init__(self,window):
        super().__init__(window);self.window=window;self.library=SearchLibrary()
        self.setWindowTitle('本地搜索方案');self.resize(560,460)
        layout=QVBoxLayout(self)
        layout.addWidget(QLabel('命名保存当前搜索逻辑；双击方案载入。相同名称会更新原方案。'))
        self.list=QListWidget();layout.addWidget(self.list,1)
        self.name=QLineEdit(placeholderText='方案名称，例如：1、3、5 层黑洞 + 第一层铁胃博彩')
        layout.addWidget(self.name)
        row=QHBoxLayout();layout.addLayout(row)
        for label,callback in [('保存当前逻辑',self.save),('载入选中',self.load),('删除选中',self.remove),('关闭',self.accept)]:
            button=QPushButton(label);button.clicked.connect(callback);row.addWidget(button)
        self.status=QLabel(str(self.library.directory));self.status.setWordWrap(True);layout.addWidget(self.status)
        self.list.currentItemChanged.connect(lambda item,*_:self.name.setText(item.data(Qt.UserRole)[1]['name']) if item else None)
        self.list.itemDoubleClicked.connect(lambda *_:self.load())
        self.refresh()
    def refresh(self,selected=None):
        self.list.clear()
        try:
            for path,data in self.library.entries():
                item=QListWidgetItem(data['name']);item.setData(Qt.UserRole,(path,data));self.list.addItem(item)
                if path==selected:self.list.setCurrentItem(item)
        except Exception as exc:self.error(exc)
    def error(self,exc):QMessageBox.warning(self,'本地搜索方案',str(exc))
    def save(self):
        try:
            path=self.library.save(self.name.text(),self.window.get_rule());self.refresh(path)
            self.status.setText(f'已保存（不包含临时范围）：{path}')
        except Exception as exc:self.error(exc)
    def load(self):
        item=self.list.currentItem()
        if item:
            try:self.window.set_rule(item.data(Qt.UserRole)[1]['rule']);self.accept()
            except Exception as exc:self.error(exc)
    def remove(self):
        item=self.list.currentItem()
        if item:
            try:
                path,data=item.data(Qt.UserRole);path.unlink();self.refresh();self.status.setText(f'已删除：{data["name"]}')
            except Exception as exc:self.error(exc)
