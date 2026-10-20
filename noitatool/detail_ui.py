"""Small, scrollable item cards shared by overview and detail windows."""
from pathlib import Path
from PySide6.QtCore import Qt,QSize
from PySide6.QtWidgets import QWidget,QDialog,QVBoxLayout,QHBoxLayout,QGridLayout,QLabel,QScrollArea,QDialogButtonBox,QToolButton,QPushButton
from .catalog import icon,data_icon,item_icon,name,record,tr
from .icon_grid import tooltip


class InspectButton(QToolButton):
    def mouseDoubleClickEvent(self,event):
        if event.button()==Qt.LeftButton:self.click();event.accept()
        else:super().mouseDoubleClickEvent(event)

def sprite(image,tip,size=34,callback=None):
    b=InspectButton();b.setIcon(image);b.setIconSize(QSize(size,size));b.setFixedSize(size+10,size+10);b.setToolTip(tip)
    if callback:b.clicked.connect(callback)
    return b


def spell_button(key,parent=None,size=34,price=None):
    return sprite(icon(key),tooltip(key)+'\n点击查看法术详情',size,lambda _:show_spell(key,parent,price))


class SpellCard(QWidget):
    def __init__(self,key,parent=None,price=None):
        super().__init__(parent);self.key=key;data=record(key);layout=QVBoxLayout(self)
        layout.addWidget(sprite(icon(key),tooltip(key),56,lambda _:show_spell(key,self)),0,Qt.AlignHCenter)
        title=QLabel(name(key));title.setStyleSheet('font-size:16pt;color:#f1d49b');title.setWordWrap(True);layout.addWidget(title)
        desc=QLabel(tr(data.get('description','')));desc.setWordWrap(True);desc.setTextInteractionFlags(Qt.TextSelectableByMouse);layout.addWidget(desc)
        kinds=['投射物','静态投射物','修正','多重施放','材料','其他','工具','被动']
        form=QGridLayout();values=[('法术 ID',key),('类型',kinds[data['type']] if data.get('type') in range(8) else '未知')]
        for field,label in [('mana','法力消耗'),('max_uses','使用次数'),('price','基础价格'),('spawn_level','出现等级')]:
            if field in data:values.append((label,str(data[field])))
        if price is not None:values.append(('当前购买价格',f'{price:g} 金币' if price else '免费获取'))
        for i,(label,value) in enumerate(values):
            form.addWidget(QLabel(label),i,0);text=QLabel(value);text.setWordWrap(True);text.setTextInteractionFlags(Qt.TextSelectableByMouse);form.addWidget(text,i,1)
        layout.addLayout(form);layout.addStretch()
        layout.addWidget(wiki_button(key))

def wiki_button(key,material=False):
    from .item_info import open_wiki
    button=QPushButton('在外部浏览器查看 Noita Wiki ↗');button.clicked.connect(lambda:open_wiki(key,material));return button


_windows=[]
def show_window(dialog):
    dialog.setAttribute(Qt.WA_DeleteOnClose);_windows.append(dialog);dialog.finished.connect(lambda _:_windows.remove(dialog) if dialog in _windows else None);dialog.show();return dialog
def show_spell(key,parent=None,price=None):return show_window(ItemDialog('法术 · '+name(key),SpellCard(key,price=price),parent))

def show_pickup(entity,material=None,parent=None):
    from .item_info import material_effect,item_description
    key=Path(entity).stem;content=QWidget();layout=QVBoxLayout(content)
    layout.addWidget(sprite(item_icon(entity),name(key),48),0,Qt.AlignHCenter)
    layout.addWidget(QLabel(name(key)))
    if material:layout.addWidget(QLabel('内容物：'+name(material)))
    description=QLabel(material_effect(material) if material else item_description(key));description.setWordWrap(True);layout.addWidget(description)
    layout.addWidget(wiki_button(material or key,bool(material)));layout.addStretch()
    return show_window(ItemDialog(name(material or key),content,parent))
def show_perk(key,parent=None):
    content=QWidget();layout=QVBoxLayout(content);layout.addWidget(sprite(icon(key),tooltip(key),56,lambda _:show_perk(key,content)),0,Qt.AlignHCenter)
    layout.addWidget(QLabel(name(key)));desc=QLabel(tr(record(key).get('ui_description',record(key).get('description',''))));desc.setWordWrap(True);layout.addWidget(desc);layout.addWidget(QLabel('天赋 ID：'+key));return show_window(ItemDialog('天赋 · '+name(key),content,parent))


class ItemDialog(QDialog):
    def __init__(self,title,content,parent=None):
        super().__init__(parent);self.setWindowTitle(title);self.resize(540,570)
        layout=QVBoxLayout(self);scroll=QScrollArea();scroll.setWidgetResizable(True);scroll.setWidget(content);layout.addWidget(scroll)
        buttons=QDialogButtonBox(QDialogButtonBox.Close);buttons.rejected.connect(self.reject);layout.addWidget(buttons)
        if self.screen():self.resize(min(max(440,content.sizeHint().width()+40),600,self.screen().availableGeometry().width()-60),min(max(230,content.sizeHint().height()+85),640,self.screen().availableGeometry().height()-80))


class WandCard(QWidget):
    def __init__(self,wand,parent=None):
        super().__init__(parent);self.setObjectName('wandCard');self.setStyleSheet('QWidget#wandCard{border:1px solid #354154;border-radius:5px}')
        layout=QVBoxLayout(self);top=QHBoxLayout();grid=QGridLayout();top.addLayout(grid,1)
        gun=wand['gun'];self.wand=wand
        values=[('乱序','是' if gun.get('shuffle_deck_when_empty') else '否'),('法术数 / 施放',f'{gun.get("actions_per_round",1):g}'),('施放延迟',f'{gun.get("fire_rate_wait",0)/60:.2f} 秒'),('充能时间',f'{gun.get("reload_time",0)/60:.2f} 秒'),('法力上限',f'{gun.get("mana_max",0):g}'),('法力充能速度',f'{gun.get("mana_charge_speed",0):g}'),('容量',f'{gun.get("deck_capacity",0):g}'),('散射',f'{gun.get("spread_degrees",0):g}°')]
        values[6]=('容量',str(int(gun.get('deck_capacity',0))))
        for i,(label,value) in enumerate(values):grid.addWidget(QLabel(label),i,0);grid.addWidget(QLabel(value),i,1)
        top.addWidget(sprite(data_icon(wand.get('ui',{})),'魔杖外观 · 双击可再开详情窗口',64,lambda _:show_wand(wand,self)),0,Qt.AlignTop);layout.addLayout(top)
        cards=wand.get('cards',{});permanent=cards.get('permanentCard')
        if permanent:
            layout.addWidget(QLabel('始终施放'));row=QHBoxLayout()
            for key in permanent if isinstance(permanent,list) else [permanent]:row.addWidget(spell_button(key,self))
            row.addStretch();layout.addLayout(row)
        spells=cards.get('cards',[]);capacity=max(len(spells),int(gun.get('deck_capacity',0)))
        layout.addWidget(QLabel(f'法术槽 · {len(spells)} / {capacity}'));slots=QGridLayout();slots.setSpacing(5);slots.setAlignment(Qt.AlignLeft|Qt.AlignTop)
        for i in range(capacity):
            if i<len(spells):b=spell_button(spells[i],self)
            else:b=QLabel('');b.setFixedSize(44,44);b.setToolTip(f'空法术槽 {i+1}');b.setStyleSheet('border:1px solid #607087;border-radius:4px;background:#101620')
            slots.addWidget(b,i//8,i%8)
        layout.addLayout(slots);layout.addStretch()


def show_wand(wand,parent=None):return show_window(ItemDialog('魔杖',WandCard(wand),parent))


class ShopCard(QWidget):
    def __init__(self,shop,parent=None):
        super().__init__(parent);grid=QGridLayout(self);grid.setAlignment(Qt.AlignTop|Qt.AlignLeft);grid.setSpacing(16);self.grid=grid;self.kind=shop['type'];self.tiles=[]
        for i,item in enumerate(shop['items']):
            tile=QWidget();layout=QVBoxLayout(tile);layout.setSpacing(5)
            if shop['type']==1:
                layout.addWidget(WandCard(item));price=item.get('gun',{}).get('cost')
            else:
                key=item['spell']['id'];price=item.get('price',item.get('cost'));layout.addWidget(spell_button(key,self,38,price),0,Qt.AlignHCenter)
            text=QLabel(f'{price:g} 金币' if price is not None else '价格未知');text.setAlignment(Qt.AlignCenter);layout.addWidget(text)
            self.tiles.append(tile);grid.addWidget(tile,i//(2 if shop['type']==1 else 5),i%(2 if shop['type']==1 else 5))

    def resizeEvent(self,event):
        super().resizeEvent(event);columns=max(1,min(2 if self.kind==1 else 5,self.width()//(440 if self.kind==1 else 86)))
        for i,tile in enumerate(self.tiles):self.grid.addWidget(tile,i//columns,i%columns)


class MountainView(QWidget):
    def __init__(self,parent=None):
        from PySide6.QtWidgets import QComboBox
        super().__init__(parent);layout=QVBoxLayout(self);self.level=QComboBox()
        for i in range(7):self.level.addItem(f'第 {i+1} 座圣山',i)
        layout.addWidget(self.level);self.scroll=QScrollArea();self.scroll.setWidgetResizable(True);layout.addWidget(self.scroll,1)
        self.data=None;self.level.currentIndexChanged.connect(self.refresh)

    def update_info(self,data):self.data=data;self.refresh()

    def refresh(self,*_):
        if not self.data:return
        index=self.level.currentIndex();content=QWidget();layout=QVBoxLayout(content)
        perks=QHBoxLayout()
        for perk in self.data['perk'][index]:perks.addWidget(sprite(icon(perk['id']),tooltip(perk['id']),callback=lambda _,k=perk['id']:show_perk(k,self)))
        perks.addStretch();layout.addLayout(perks)
        layout.addWidget(ShopCard(self.data['shop'][index],self));layout.addWidget(QLabel('和平宝箱'));layout.addWidget(ChestCard(self.data['pacifistChest'][index],self));layout.addStretch()
        old=self.scroll.takeWidget()
        if old:old.deleteLater()
        self.scroll.setWidget(content)


def chest_entries(items):
    """Aggregate gold only; preserve separate wands, bottles and spell drops."""
    gold=0;out=[]
    labels={'heart':'生命上限 +25','heart_better':'生命上限 +50','heart_fullhp':'完全治疗','spell_refresh':'法术恢复','powder_stash':'粉末袋','potion':'药水','potion_secret':'秘密药水','potion_random_material':'随机材料药水','bomb':'炸弹'}
    for item in items:
        key=Path(item['entity']).stem
        if key.startswith('goldnugget'):
            gold+=int(key.split('_')[-1]) if '_' in key else 10;continue
        if item.get('wand'):
            wand=item['wand'];tip='魔杖 · 点击查看属性与法术\n'+'、'.join(name(k) for k in wand.get('cards',{}).get('cards',[]));image=data_icon(wand.get('ui',{}));label='魔杖'
        elif item.get('material'):
            label=name(item['material']);tip=labels.get(key,key)+' · '+label;image=item_icon(item['entity'])
        elif item['entity']=='Spell':
            label=name(item.get('extra','LIGHT_BULLET'));tip=tooltip(item.get('extra','LIGHT_BULLET'));image=icon(item.get('extra','LIGHT_BULLET'))
        else:
            from .item_info import item_description
            label=labels.get(key,name(key));tip=label+'\n'+item_description(key);image=item_icon(item['entity'])
        out.append((image,label,tip,item.get('wand')))
    if gold:out.append((item_icon('goldnugget.xml'),str(gold),f'{gold} 金币',None))
    return out


class ChestCard(QWidget):
    def __init__(self,items,parent=None,compact=False):
        super().__init__(parent);grid=QGridLayout(self);grid.setContentsMargins(3,3,3,3);grid.setSpacing(4)
        objects=[item for item in items if not Path(item['entity']).stem.startswith('goldnugget')]
        for i,(image,label,tip,wand) in enumerate(chest_entries(items)):
            tile=QWidget();layout=QVBoxLayout(tile);layout.setContentsMargins(0,0,0,0);layout.setSpacing(1)
            spell=objects[i].get('extra') if i<len(objects) and objects[i]['entity']=='Spell' else 'BOMB' if i<len(objects) and Path(objects[i]['entity']).stem=='bomb' else None
            obj=objects[i] if i<len(objects) else None
            callback=(lambda _,w=wand:show_wand(w,self)) if wand else (lambda _,k=spell:show_spell(k,self)) if spell else (lambda _,o=obj:show_pickup(o['entity'],o.get('material'),self)) if obj else None
            b=sprite(image,tip,30 if compact else 42,callback);layout.addWidget(b,0,Qt.AlignHCenter)
            text=QLabel(label);text.setAlignment(Qt.AlignCenter);text.setWordWrap(True);text.setToolTip(tip);layout.addWidget(text)
            grid.addWidget(tile,i//(2 if compact else 5),i%(2 if compact else 5))
        grid.setRowStretch(grid.rowCount(),1)
