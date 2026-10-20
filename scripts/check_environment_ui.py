import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.advanced_ui import AdvancedSearchDialog

app=QApplication([]);configure_app(app);w=Window();w.resize(1360,900);w.seed.setText('123')
with Engine() as engine:info=engine.info(123)
w.display_info((123,info));w.nav.setCurrentRow(0);w.show();app.processEvents()
for title,file in [('真菌转移','fungal-shift-cards.png'),('生态修正','biome-modifiers-zh.png')]:
    w.info_tabs.setCurrentIndex(next(i for i in range(w.info_tabs.count()) if w.info_tabs.tabText(i)==title));app.processEvents();w.grab().save(str(Path('artifacts')/file))
dialog=AdvancedSearchDialog(w);dialog.show();app.processEvents();dialog.grab().save('artifacts/advanced-search.png');dialog.close();w.close()
