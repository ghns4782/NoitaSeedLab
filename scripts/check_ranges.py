"""Render the actual range editor, map picker and categorized resource widgets."""
import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtCore import QRectF
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.rules_ui import RuleDialog
from noitatool.range_ui import RangeMapDialog
from noitatool.areas import main_range,preset
from noitatool.resources_ui import ResourceDialog

app=QApplication([]);configure_app(app);w=Window();w.resize(1360,900);w.show();w.seed.setText('123')
data=w.view_session.request(op='map',seed=123);w.map_page.display_map(data)
rule=RuleDialog(w,{'type':'layerSpells','val':{'ranges':[main_range(0),main_range(2),preset('lukki')],'ids':['BLACK_HOLE'],'mode':'all'}})
rule.show();app.processEvents();picker=RangeMapDialog(rule.widgets['ranges']);picker.show();app.processEvents()
picker.rectangle(QRectF(-1100,600,200,120));picker.rectangle(QRectF(9000,2000,1200,1800));app.processEvents()
out=Path('artifacts');out.mkdir(exist_ok=True);picker.grab().save(str(out/'search-range-map.png'))
picker.close();app.processEvents();rule.grab().save(str(out/'search-range-editor.png'));rule.close()
result=w.view_session.request(op='layer',seed=123,layer=1)
dialog=ResourceDialog('种子 123 · 煤矿 · 四类资源',result['items'],lambda _:None,lambda _:None,lambda:None,w)
dialog.show();app.processEvents();dialog.grab().save(str(out/'resources-four-categories.png'))
print('map cache:',result.get('fromMapCache'),'counts:',{k:l.count() for k,l in dialog.browser.lists.items()})
dialog.close();w.close();app.processEvents()
