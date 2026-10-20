"""Translation pack import/export controls, available without developer tools."""
from PySide6.QtWidgets import QWidget,QVBoxLayout,QGridLayout,QLabel,QPushButton,QFileDialog,QMessageBox,QComboBox,QInputDialog
from PySide6.QtCore import Qt
from . import localization as loc

class TranslationPage(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent);layout=QVBoxLayout(self)
        title=QLabel('翻译管理');title.setObjectName('title');layout.addWidget(title)
        layout.addWidget(QLabel('界面语言 / Language'));self.languages=QComboBox();self.languages.preserve_language_names=True;layout.addWidget(self.languages)
        self.refresh_languages();self.languages.currentIndexChanged.connect(self.change_language)
        note=QLabel('可切换内置中文、英文和导入的其他语言包。每次导入会保留为列表中的独立选项。\nJSON 可指定 name 和 language；entries 中使用 translation 列，兼容旧版 chinese 列。CSV 同样支持 translation 列。缺少的译文使用内置文本。算法 ID、原始 JSON、文件路径和硬件型号保持原样。')
        note.setWordWrap(True);layout.addWidget(note)
        row=QGridLayout()
        for i,(label,callback) in enumerate([('导出基础英文对照表',lambda:self.export(False)),('导出当前翻译',lambda:self.export(True)),('加载外部翻译…',self.load),('恢复内置中文',self.reset)]):
            button=QPushButton(label);button.clicked.connect(callback);row.addWidget(button,i//2,i%2)
        layout.addLayout(row);self.status=QLabel();self.status.setWordWrap(True);layout.addWidget(self.status)
        example=QLabel('简易 JSON 示例：\n{\n  "kiuaskivi": "火石",\n  "Close": "关闭",\n  "$action_light_bullet": "火花弹"\n}\n\n完整表字段：key（翻译键）、english（英文原文）、chinese（中文译文）、category（分类）。\n重新打开详情可刷新名称和说明；界面按钮立即应用，重启后也会继续加载。')
        example.setWordWrap(True);example.setTextInteractionFlags(Qt.TextSelectableByMouse);layout.addWidget(example);layout.addStretch();self.update_status()
    def update_status(self,message=''):
        loc.ensure_loaded();self.status.setText((message+'\n' if message else '')+f'内置 {len(loc.base_entries())} 条 · 外部 {len(loc._overrides)} 条\n本地翻译文件：{loc.user_path()}')
    def refresh_languages(self):
        from .language_packs import choices,selected
        self.languages.blockSignals(True);self.languages.clear()
        for row in choices():self.languages.addItem(row['name'],row['id'])
        index=self.languages.findData(selected());self.languages.setCurrentIndex(max(0,index));self.languages.blockSignals(False)
    def change_language(self,*_):
        try:loc.select_language(self.languages.currentData());self.update_status()
        except (OSError,ValueError) as exc:QMessageBox.warning(self,'语言切换失败',str(exc))
    def export(self,effective):
        path,_=QFileDialog.getSaveFileName(self,'导出翻译对照表','当前翻译.json' if effective else '基础英文对照表.json','JSON (*.json);;CSV (*.csv)')
        if not path:return
        try:count=loc.export_table(path,effective);self.update_status(f'已导出 {count} 条：{path}')
        except (OSError,ValueError) as exc:QMessageBox.warning(self,'导出失败',str(exc))
    def load(self):
        path,_=QFileDialog.getOpenFileName(self,'加载外部翻译','','翻译表 (*.json *.csv)')
        if not path:return
        try:
            from .language_packs import import_pack
            from pathlib import Path
            name,ok=QInputDialog.getText(self,'语言包名称','在语言列表中显示的名称',text=Path(path).stem)
            if not ok:return
            key,count=import_pack(path,name=name);loc.select_language(key);self.refresh_languages();self.update_status(f'已加载 {count} 条外部翻译')
        except (OSError,ValueError) as exc:QMessageBox.warning(self,'翻译未加载',str(exc))
    def reset(self):
        try:loc.select_language('zh_CN');self.refresh_languages();self.update_status('已切换内置中文；导入的语言包仍保留在列表中')
        except OSError as exc:QMessageBox.warning(self,'恢复失败',str(exc))
