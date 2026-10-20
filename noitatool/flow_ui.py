from PySide6.QtCore import Qt
from PySide6.QtWidgets import QWidget,QVBoxLayout,QHBoxLayout,QTableWidget,QTableWidgetItem,QHeaderView,QDialog,QLabel,QPushButton,QFileDialog
from .rules_ui import describe,LABELS
from .result_view import SeedResultView
from .flow_search import FlowResults


class FlowView(QWidget):
    def __init__(self,parent=None):
        super().__init__(parent);self.window=parent;self.runner=None
        layout=QVBoxLayout(self);layout.setContentsMargins(0,0,0,0)
        self.table=QTableWidget(0,4);self.table.setHorizontalHeaderLabels(['搜索链 · 按条件顺序执行','本阶段进度','剩余种子','查看'])
        self.table.horizontalHeader().setSectionResizeMode(0,QHeaderView.Stretch)
        self.table.verticalHeader().hide();self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.table.setColumnWidth(1,130);self.table.setColumnWidth(2,130);self.table.setColumnWidth(3,85);layout.addWidget(self.table)

    def reset(self,runner):
        self.runner=runner;self.table.setRowCount(len(runner.stages))
        for i,rule in enumerate(runner.stages):
            item=QTableWidgetItem(f'{i+1} → '+LABELS.get(rule['type'],rule['type'].upper())+' · '+describe(rule));item.setToolTip(describe(rule));self.table.setItem(i,0,item)
            self.table.setItem(i,1,QTableWidgetItem('等待'));self.table.setItem(i,2,QTableWidgetItem('—'))
            button=QPushButton('查看');button.clicked.connect(lambda _,s=i:self.open_stage(s));self.table.setCellWidget(i,3,button);self.table.setRowHeight(i,42)

    def update_progress(self,data):
        index=data['flow_stage']
        for i,count in enumerate(data['flow_counts']):
            done=data['flow_completed'][i]
            status='100% · 完成' if done else f'{100*data["checked"]/max(1,data["total"]):.1f}%' if i==index else '等待'
            self.table.item(i,1).setText(status);self.table.item(i,2).setText(f'{count:,}' if count is not None else '—')

    def open_stage(self,index):
        if not self.runner or self.runner.counts[index] is None:return
        result=FlowResults(self.runner.path,index,self.runner.counts[index]);dialog=QDialog(self);dialog.setWindowTitle(f'第 {index+1} 阶段 · 剩余种子');dialog.resize(550,600)
        layout=QVBoxLayout(dialog);label=QLabel();layout.addWidget(label);view=SeedResultView();view.itemDoubleClicked.connect(self.window.open_result);layout.addWidget(view,1)
        row=QHBoxLayout();offset=[0]
        def refresh():
            view.clear();view.append_seeds(result.page(offset[0]));label.setText(f'共 {len(result):,} 个 · {offset[0]+1 if len(result) else 0:,}–{min(len(result),offset[0]+500):,}'+(' · 本阶段仍在运行，当前已保存部分' if not self.runner.completed[index] else ''))
        def move(delta):offset[0]=max(0,min(max(0,((len(result)-1)//500)*500),offset[0]+delta));refresh()
        for text,action in [('上一页',lambda:move(-500)),('下一页',lambda:move(500))]:
            button=QPushButton(text);button.clicked.connect(action);row.addWidget(button)
        def export():
            path,_=QFileDialog.getSaveFileName(dialog,'导出本阶段种子','','种子列表 (*.txt)')
            if path:
                with open(path,'w',encoding='utf-8') as stream:
                    for seed in result:stream.write(str(seed)+'\n')
        button=QPushButton('导出全部');button.clicked.connect(export);row.addWidget(button);layout.addLayout(row);refresh();dialog.exec()


class FlowDialog(QDialog):
    def __init__(self,parent):
        super().__init__(parent);self.setWindowTitle('搜索流 · 条件进度与种子');self.resize(980,560)
        layout=QVBoxLayout(self)
        hint=QLabel('按条件顺序逐级筛选。点击“查看”可浏览、翻页或导出该阶段留下的种子。');hint.setWordWrap(True);layout.addWidget(hint)
        self.view=FlowView(parent);layout.addWidget(self.view,1)
        close=QPushButton('关闭');close.clicked.connect(self.close);layout.addWidget(close,0,Qt.AlignRight)
        if self.screen():self.resize(min(980,self.screen().availableGeometry().width()-60),min(560,self.screen().availableGeometry().height()-80))

    def open_details(self):
        self.show();self.raise_();self.activateWindow()
