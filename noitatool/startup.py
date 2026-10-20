"""The two notices shown before entering the normal desktop application."""
from PySide6.QtCore import Qt
from PySide6.QtWidgets import QDialog,QVBoxLayout,QLabel,QDialogButtonBox

NOTICES=(
    ('使用提示 · 1 / 2', '请以游戏内实际情况为准',
     '本工具的种子信息、地图、物品位置和搜索结果可能存在误差，也可能受游戏版本、模组和解锁进度等影响。'
     '请在游戏中核实，一切以游戏内实际情况为准。', '我已了解，继续'),
    ('算法来源 · 2 / 2', 'Noitool 算法与本地加速搜索',
     '本工具使用 Noitool 的开源种子算法与数据，并结合 Noita Telescope 进行地图和区域计算。'
     '如发现结果不一致，请同时核对原网站、对应的 GitHub 开源项目与游戏内实际情况。<br><br>'
     '本工具的主要用途是在本机加速种子搜索，减少网页端长时间等待、仍未得到结果的情况。'
     '搜索耗时取决于电脑性能、条件复杂度和搜索范围；无法保证一定找到匹配种子。<br><br>'
     '<a href="https://noitool.com/">Noitool 原网站 · noitool.com ↗</a><br>'
     '<a href="https://github.com/TwoAbove/noita-tools">Noitool 开源项目 · TwoAbove/noita-tools ↗</a><br>'
     '<a href="https://github.com/Lymm37/noita-telescope">地图算法 · Noita Telescope ↗</a>', '进入软件'),
)


class StartupNotice(QDialog):
    def __init__(self,index,parent=None):
        super().__init__(parent)
        title,heading,body,action=NOTICES[index]
        self.setWindowTitle(title);self.setMinimumWidth(420);self.resize(580,260 if index==0 else 420)
        layout=QVBoxLayout(self);layout.setContentsMargins(24,20,24,20);layout.setSpacing(16)
        label=QLabel(heading);label.setStyleSheet('font-size:17pt;font-weight:bold;color:#f1d49b');label.setWordWrap(True);layout.addWidget(label)
        body=body.replace('<a href=', '<a style="color:#8ed1c5" href=')
        self.body=QLabel(body);self.body.setWordWrap(True);self.body.setTextFormat(Qt.RichText)
        self.body.setOpenExternalLinks(True);self.body.setTextInteractionFlags(Qt.TextBrowserInteraction)
        layout.addWidget(self.body,1)
        buttons=QDialogButtonBox();self.continue_button=buttons.addButton(action,QDialogButtonBox.AcceptRole)
        self.continue_button.setObjectName('primary');self.continue_button.setDefault(True)
        buttons.addButton('退出',QDialogButtonBox.RejectRole)
        buttons.accepted.connect(self.accept);buttons.rejected.connect(self.reject);layout.addWidget(buttons)


def show_startup_notices(parent=None):
    for index in range(len(NOTICES)):
        if StartupNotice(index,parent).exec()!=QDialog.Accepted:return False
    return True
