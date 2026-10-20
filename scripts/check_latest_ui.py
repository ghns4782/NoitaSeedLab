"""Render changed desktop views without showing native windows."""
import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.icon_grid import IconPickerDialog
from noitatool.rules_ui import RuleDialog
from noitatool.offline_map import OfflineMap

app=QApplication([]);configure_app(app)
folder=Path('artifacts');folder.mkdir(exist_ok=True)
palette=IconPickerDialog(['water','blood','oil','magic_liquid_polymorph','magic_liquid_invisibility','magic_liquid_mana_regeneration'],title='选择药水材料')
palette.resize(700,430);palette.show();app.processEvents();palette.grab().save(str(folder/'potion-picker-labelled.png'));palette.close()
shop=RuleDialog(rule={'type':'shop','val':[{'type':0,'strict':True,'items':[{'spell':'BLACK_HOLE'},{'spell':'LIGHT_BULLET'}]}]})
shop.show();app.processEvents();shop.grab().save(str(folder/'unrestricted-shop-spells.png'));shop.close()
window=Window();window.save_settings=lambda:None;window.seed.setText('123');window.resize(1360,900)
window.populate({'type':'advanced','val':{'type':'or','rules':[{'type':'startingFlask','val':'blood'},{'type':'startingSpell','val':'LIGHT_BULLET'}]}},window.tree.topLevelItem(0))
window.nav.setCurrentRow(1);window.show();app.processEvents();window.grab().save(str(folder/'advanced-condition-tree.png'))
offline=OfflineMap();offline.resize(1000,800);offline.show();app.processEvents();offline.grab().save(str(folder/'offline-overview.png'));offline.close()
window.nav.setCurrentRow(2);window.map_page.progress.show();window.map_page.update_generation_progress({'value':47,'phase':'计算地表与地下资源与固定场景'});app.processEvents();window.grab().save(str(folder/'map-generation-progress.png'));window.close()
print('Rendered changed UI views')
