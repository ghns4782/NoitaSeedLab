import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtCore import QRectF,Qt
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.detail_ui import _windows

app=QApplication([]);configure_app(app)
from noitatool.engine import Engine
with Engine() as engine:data=engine.request(op='map',seed=1234)
Path('artifacts').mkdir(exist_ok=True)
window=Window();window.save_settings=lambda:None;window.seed.setText('1234');window.resize(1360,950);window.nav.setCurrentRow(2);window.show();page=window.map_page;page.display_map(data);app.processEvents()
page.canvas.fitInView(QRectF(-13000,-2000,28500,21000),Qt.KeepAspectRatio);page.update_markers();app.processEvents();window.grab().save('artifacts/real-terrain-overview.png')
tablet=next(p for p in data['pois'] if p.get('item')=='emerald_tablet' and p['x']==2339)
page.canvas.resetTransform();page.canvas.scale(.7,.7);page.canvas.centerOn(tablet['x'],tablet['y']);page.update_markers();app.processEvents();window.grab().save('artifacts/real-terrain-tablet.png')
page.open_item(tablet);app.processEvents();_windows[-1].grab().save('artifacts/real-terrain-tablet-detail.png')
print('visible tiles:',len(page.terrain_layer.items),'decoded bytes:',sum(i.pixmap().width()*i.pixmap().height()*4 for i in page.terrain_layer.items.values()))
for dialog in list(_windows):dialog.close()
window.close();app.processEvents()
