"""Local, editable translations. Display strings only; engine identifiers stay intact."""
import csv
import io
import json
import re
from functools import lru_cache
from pathlib import Path
from .paths import ROOT, STATE, UPSTREAM

UI = {
    'Close':'关闭','Cancel':'取消','OK':'确定','Save':'保存','Open':'打开',
    'Apply':'应用','Reset':'重置','Yes':'是','No':'否','Help':'帮助',
    'Abort':'终止','Retry':'重试','Ignore':'忽略','Discard':'放弃更改',
    'Restore Defaults':'恢复默认','Save All':'全部保存','Yes to All':'全部选是','No to All':'全部选否',
    'Cut':'剪切','Copy':'复制','Paste':'粘贴','Select All':'全选','Undo':'撤销','Redo':'重做','Delete':'删除',
    'Seed Info':'种子信息','Search For Seed':'搜索种子','Wand':'魔杖','Shop Items':'商店物品',
    'Boss':'首领','chunk':'区块','Lively Concoction':'活力合剂','Alchemic Precursor':'炼金先驱',
    'Burst':'爆发','Spread':'散射','Explosion':'爆炸','Bolt':'魔弹','Beam':'光束',
    'Blast':'冲击','Sinister':'凶兆','Eradication':'歼灭',
}
WAND_NAMES={f'{a} {b}':f'{UI[a]}{c}' for a in ('Burst','Spread','Explosion','Bolt','Beam','Blast','Sinister','Eradication') for b,c in [('staff','法杖'),('stick','短杖'),('wand','魔杖')]}
_overrides={}
_loaded=False
_language='zh_CN'

def user_path():return STATE/'translations/user.zh_CN.json'

@lru_cache(maxsize=1)
def base_entries():
    en=json.loads((UPSTREAM/'public/locales/en/materials.json').read_text(encoding='utf-8'))
    zh=json.loads((UPSTREAM/'public/locales/zh/materials.json').read_text(encoding='utf-8'))
    zh.update(json.loads((ROOT/'assets/zh-supplement.json').read_text(encoding='utf-8')))
    rows={k:{'key':k,'english':v,'chinese':zh.get(k,'') or '', 'category':'游戏文本'} for k,v in en.items() if k not in ('$', '$current_language') and isinstance(v,str)}
    for key,value in {**UI,**WAND_NAMES}.items():rows[key]={'key':key,'english':key,'chinese':value,'category':'界面 / 魔杖'}
    from .catalog import read_json
    for filename,category in [('obj/spells.json','法术'),('obj/perks.json','天赋'),('materials.json','材料')]:
        for key,data in read_json(filename).items():
            label=data.get('ui_name',data.get('name',key))
            rows[key]={'key':key,'english':en.get(label,label),'chinese':zh.get(label,'') or (label if re.search('[\u4e00-\u9fff]',label) else ''),'category':category}
            if not rows[key]['chinese'] and key in zh:rows[key]['chinese']=zh[key]
    from .item_info import ITEMS,EFFECTS
    for key,(label,desc) in ITEMS.items():
        rows.setdefault(key,{'key':key,'english':en.get('$item_'+key,en.get('$animal_'+key,key.replace('_',' '))),'chinese':label,'category':'物品 / 首领'})
        rows['description:'+key]={'key':'description:'+key,'english':'','chinese':desc,'category':'物品说明'}
    for key,value in EFFECTS.items():rows['effect:'+key]={'key':'effect:'+key,'english':'','chinese':value,'category':'材料效果'}
    from .biome_names import NAMES
    region_english=ROOT/'assets/biome-english.json'
    region_english=json.loads(region_english.read_text(encoding='utf-8')) if region_english.is_file() else {}
    for key,value in NAMES.items():rows['biome:'+key]={'key':'biome:'+key,'english':region_english.get(key,en.get('$biome_'+key,key.replace('_',' '))),'chinese':value,'category':'区域'}
    from .environment_ui import MODIFIERS
    for key,(label,desc) in MODIFIERS.items():
        rows['modifier:'+key]={'key':'modifier:'+key,'english':key.replace('_',' ').title(),'chinese':label,'category':'生态修正'}
        rows['modifier_description:'+key]={'key':'modifier_description:'+key,'english':'','chinese':desc,'category':'生态修正说明'}
    # Include the application's text inventory even in a frozen build.
    inventory=ROOT/'assets/ui-texts.json'
    if inventory.is_file():
        for value in json.loads(inventory.read_text(encoding='utf-8')):
            rows.setdefault(value,{'key':value,'english':value if not re.search('[\u4e00-\u9fff]',value) else '', 'chinese':value,'category':'界面'})
    english_ui=ROOT/'assets/ui-english.json'
    if english_ui.is_file():
        for key,value in json.loads(english_ui.read_text(encoding='utf-8')).items():
            rows.setdefault(key,{'key':key,'chinese':key,'category':'界面'})['english']=value
    return rows

@lru_cache(maxsize=1)
def source_entries():
    sources={}
    for row in base_entries().values():
        if row['english'] and row['chinese']:sources.setdefault(row['english'],row['key'])
        if row['chinese']:sources.setdefault(row['chinese'],row['key'])
    return sources

def ensure_loaded():
    global _loaded,_overrides,_language
    if _loaded:return
    _loaded=True
    from .language_packs import active_values,selected
    _language,_overrides=active_values()
    if selected()=='zh_CN':
        try:_overrides=parse_table(user_path())
        except (OSError,ValueError):_overrides={}

def text(value,key=None):
    if not isinstance(value,str) or not value:return value
    ensure_loaded()
    for candidate in (key,value):
        if candidate in _overrides:return _overrides[candidate]
    rows=base_entries()
    column='english' if _language.lower().startswith('en') else 'chinese'
    if key in rows and rows[key].get(column):return rows[key][column]
    if value in rows and rows[value].get(column):return rows[value][column]
    source=source_entries().get(value)
    if source:return _overrides.get(source,rows[source].get(column)) or value
    return value

def display_text(value):
    """Translate whole UI strings and known English fragments in mixed labels."""
    result=text(value)
    if result!=value or not isinstance(value,str):return result
    # Do not rewrite links, identifiers in editors, filenames or technical formats.
    if '<' in value or '://' in value:return value
    for english in ('Seed Info','Search For Seed','Lively Concoction','Alchemic Precursor','Boss','chunk'):
        result=re.sub(r'(?<![A-Za-z_])'+re.escape(english)+r'(?![A-Za-z_])',lambda _:text(english),result)
    return result

def parse_table(path):
    path=Path(path)
    if path.stat().st_size>32*1024*1024:raise ValueError('翻译文件不能超过 32 MB')
    raw=path.read_text(encoding='utf-8-sig')
    if path.suffix.lower()=='.csv':rows=list(csv.DictReader(io.StringIO(raw)))
    else:
        try:data=json.loads(raw)
        except json.JSONDecodeError as exc:raise ValueError(f'翻译 JSON 格式有误：第 {exc.lineno} 行，第 {exc.colno} 列') from exc
        if isinstance(data,dict) and 'entries' in data:rows=data['entries']
        elif isinstance(data,dict):rows=[{'key':k,'chinese':v} for k,v in data.items()]
        else:rows=data
    if not isinstance(rows,list) or len(rows)>50000:raise ValueError('翻译表须为 entries 列表、键值字典或 CSV，最多 50000 条')
    result={};seen=set()
    for i,row in enumerate(rows,1):
        if not isinstance(row,dict):raise ValueError(f'第 {i} 条翻译必须为对象')
        key=row.get('key');value=row.get('translation',row.get('text',row.get('chinese')))
        if not isinstance(key,str) or not key.strip() or not isinstance(value,str):raise ValueError(f'第 {i} 条须包含字符串 key 和 chinese')
        if key in seen:raise ValueError(f'第 {i} 条重复了键：{key}')
        if len(key)>16000 or len(value)>16000:raise ValueError(f'第 {i} 条翻译过长')
        seen.add(key)
        if value.strip():result[key]=value
    return result

def import_table(path):
    global _overrides,_loaded,_language
    values=parse_table(path)  # Validate the whole file before writing or changing active text.
    target=user_path();target.parent.mkdir(parents=True,exist_ok=True)
    temp=target.with_suffix('.tmp');temp.write_text(json.dumps(values,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(target)
    from .language_packs import activate
    activate('zh_CN');_language='zh_CN';_overrides=values;_loaded=True
    return len(values)

def reset_table():
    global _overrides,_loaded,_language
    from .language_packs import activate
    user_path().unlink(missing_ok=True);activate('zh_CN');_overrides={};_language='zh_CN';_loaded=True

def select_language(key):
    global _loaded
    from .language_packs import activate
    activate(key);_loaded=False;ensure_loaded();refresh_ui()

def export_table(path,effective=False):
    ensure_loaded();rows=[dict(row) for row in base_entries().values()]
    if effective:
        for row in rows:row['translation']=text(row['chinese'],row['key'])
        known={r['key'] for r in rows}
        rows.extend({'key':k,'english':k,'chinese':'','translation':v,'category':'自定义'} for k,v in _overrides.items() if k not in known)
    path=Path(path)
    if path.suffix.lower()=='.csv':
        with path.open('w',encoding='utf-8-sig',newline='') as handle:
            writer=csv.DictWriter(handle,fieldnames=['key','english','chinese','category']+(['translation'] if effective else []));writer.writeheader();writer.writerows(rows)
    else:path.write_text(json.dumps({'format':'noitatool-translations-v1','language':_language if effective else 'zh_CN','entries':rows},ensure_ascii=False,indent=2),encoding='utf-8')
    return len(rows)

def install_ui(app):
    from PySide6.QtCore import QObject,QEvent,QTimer,QTranslator
    if hasattr(app,'localization_filter'):return
    class DisplayFilter(QObject):
        def eventFilter(self,obj,event):
            if event.type() in (QEvent.Show,QEvent.PolishRequest):
                from PySide6.QtWidgets import QWidget
                if isinstance(obj,QWidget):translate_widget(obj)
            return False
    app.localization_filter=DisplayFilter(app);app.installEventFilter(app.localization_filter)
    class NativeTranslator(QTranslator):
        def translate(self,context,source,disambiguation=None,n=-1):
            plain=source.replace('&','')
            # Only native UI terms; no edits to user text or engine values.
            return text(plain) if plain in UI else ''
    app.external_translator=NativeTranslator(app);app.installTranslator(app.external_translator)
    QTimer.singleShot(0,lambda:refresh_ui(app))

def translate_widget(widget):
    from PySide6.QtWidgets import QLabel,QAbstractButton,QGroupBox,QLineEdit,QComboBox,QTabWidget,QListWidget,QTreeWidget,QDialogButtonBox
    # Reapply from the original text when changing packs, without touching user input.
    def apply(obj,field,getter,setter):
        from PySide6.QtCore import Qt
        from PySide6.QtWidgets import QListWidgetItem,QTreeWidgetItem
        value=getter();attribute='_translation_'+field
        role=int(Qt.UserRole)+13000+(1 if field.startswith('tip') else 0)
        column=int(re.search(r'\d+$',field).group()) if re.search(r'\d+$',field) else 0
        if isinstance(obj,QListWidgetItem):old=obj.data(role)
        elif isinstance(obj,QTreeWidgetItem):old=obj.data(column,role)
        else:old=obj.property(attribute)
        source=old[0] if old and value==old[1] else value
        translated=display_text(source)
        if translated!=value:setter(translated)
        if isinstance(obj,QListWidgetItem):obj.setData(role,[source,translated])
        elif isinstance(obj,QTreeWidgetItem):obj.setData(column,role,[source,translated])
        else:obj.setProperty(attribute,[source,translated])
    try:
        apply(widget,'windowTitle',widget.windowTitle,widget.setWindowTitle)
        apply(widget,'toolTip',widget.toolTip,widget.setToolTip)
        if isinstance(widget,(QLabel,QAbstractButton)):apply(widget,'text',widget.text,widget.setText)
        if isinstance(widget,QGroupBox):apply(widget,'title',widget.title,widget.setTitle)
        if isinstance(widget,QLineEdit):apply(widget,'placeholder',widget.placeholderText,widget.setPlaceholderText)
        if isinstance(widget,QComboBox) and not getattr(widget,'preserve_language_names',False):
            for i in range(widget.count()):apply(widget,'combo'+str(i),lambda i=i:widget.itemText(i),lambda v,i=i:widget.setItemText(i,v))
        if isinstance(widget,QTabWidget):
            for i in range(widget.count()):apply(widget,'tab'+str(i),lambda i=i:widget.tabText(i),lambda v,i=i:widget.setTabText(i,v))
        if isinstance(widget,QListWidget):
            for i in range(widget.count()):
                item=widget.item(i);apply(item,'text',item.text,item.setText);apply(item,'tip',item.toolTip,item.setToolTip)
        if isinstance(widget,QTreeWidget):
            def visit(item):
                for column in range(widget.columnCount()):
                    apply(item,'text'+str(column),lambda c=column:item.text(c),lambda v,c=column:item.setText(c,v))
                    apply(item,'tip'+str(column),lambda c=column:item.toolTip(c),lambda v,c=column:item.setToolTip(c,v))
                for i in range(item.childCount()):visit(item.child(i))
            visit(widget.invisibleRootItem())
        if isinstance(widget,QDialogButtonBox):
            labels={'Close':'关闭','Cancel':'取消','Ok':'确定','Save':'保存','Open':'打开','Apply':'应用','Reset':'重置','Yes':'是','No':'否','Help':'帮助'}
            for key,label in labels.items():
                button=widget.button(getattr(QDialogButtonBox,key))
                if button:button.setText(text(key if key!='Ok' else 'OK') or label)
    except RuntimeError:pass  # A modeless window may have been deleted while refreshing.

def refresh_ui(app=None):
    from PySide6.QtWidgets import QApplication
    app=app or QApplication.instance()
    if app:
        for widget in app.allWidgets():translate_widget(widget)
