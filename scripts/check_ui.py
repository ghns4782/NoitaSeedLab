"""Render real Qt widgets without starting a persistent desktop window."""
import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.engine import Engine
from noitatool.rules_ui import RuleDialog,LABELS
from noitatool.search import SearchRunner,SearchConfig
from noitatool.gpu import devices
import json

app=QApplication([])
configure_app(app)
window=Window()
window.resize(1360,920)
window.show()
app.processEvents()
out=Path('artifacts')
out.mkdir(exist_ok=True)
rule={'type':'and','rules':[{'type':'startingFlask','val':'water'},{'type':'perkSet','val':{'ids':['EDIT_WANDS_EVERYWHERE','MOLD'],'where':0,'mode':'all'}}]}
window.set_rule(rule)
backend='gpu' if devices() else 'cpu'
window.backend.setCurrentIndex(1 if backend=='gpu' else 0)
runner=SearchRunner(SearchConfig(start=1,end=100000,backend=backend,max_workers=4,max_results=0),rule,window.search_progress)
runner.run()
window.search_done(runner.found)
app.processEvents()
window.grab().save(str(out/'search.png'))
with Engine() as engine:
    window.display_info((123,engine.info(123)))
window.nav.setCurrentRow(0)
app.processEvents()
window.grab().save(str(out/'seed-info.png'))
window.info_tabs.setCurrentIndex(2)
app.processEvents()
window.grab().save(str(out/'mountains.png'))
window.open_settings()
app.processEvents()
window.grab().save(str(out/'settings.png'))
dialog=RuleDialog(window)
for key in LABELS:
    if dialog.kind.findData(key)<0:continue
    dialog.kind.setCurrentIndex(dialog.kind.findData(key))
    app.processEvents()
    assert dialog.template()['type'] in LABELS or dialog.template()['type']=='or'
dialog.kind.setCurrentIndex(dialog.kind.findData('perk'))
dialog.widgets['value'].set_values(['EDIT_WANDS_EVERYWHERE','MOLD','EXTRA_PERK'])
dialog.show()
app.processEvents()
dialog.grab().save(str(out/'rule-editor.png'))
dialog.close()
from noitatool.icon_grid import IconPickerDialog
from noitatool.catalog import options
palette=IconPickerDialog(options('perk'),['EDIT_WANDS_EVERYWHERE','MOLD'],window,'天赋图标 · 批量选择')
palette.show();app.processEvents();palette.grab().save(str(out/'icon-picker.png'));palette.close()
from noitatool.wand_ui import WandFilterDialog
wand=WandFilterDialog(window,{'gun':{'mana_max':[300,1000],'mana_charge_speed':[100,500]},'cards':['BLACK_HOLE','CHAINSAW'],'cardsStrict':True})
wand.show();app.processEvents();wand.grab().save(str(out/'wand-filter.png'));wand.close()
shop=RuleDialog(window,{'type':'shop','val':[{'type':2,'strict':True,'items':[{'spell':'BLACK_HOLE'},{'spell':'CHAINSAW'},{'spell':'TELEPORT_PROJECTILE_SHORT'}]}]})
shop.show();app.processEvents();shop.grab().save(str(out/'shop-editor.png'));shop.close()
window.close()
print('Qt UI render and all rule editors: OK')
