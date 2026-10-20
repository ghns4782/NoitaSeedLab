"""Local, seed-labelled Deep Zoom captures. Only visible tiles are decoded."""
import json
import math
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from PySide6.QtCore import QRectF,Qt
from PySide6.QtGui import QImageReader,QPixmap,QTransform
from PySide6.QtWidgets import QFileDialog,QGraphicsRectItem,QGraphicsItem,QMessageBox
from .paths import STATE as ROOT

REGISTRY=ROOT/'.cache/map-captures.json'

def _registry():
    try:
        value=json.loads(REGISTRY.read_text(encoding='utf-8'))
        return value if isinstance(value,dict) else {}
    except (ValueError,OSError):return {}

def _write_registry(value):
    REGISTRY.parent.mkdir(parents=True,exist_ok=True)
    temporary=REGISTRY.with_suffix('.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    temporary.replace(REGISTRY)

def _record_path(record):
    path=Path(record['path'])
    return (path if path.is_absolute() else ROOT/path).resolve()

def _prune_cache(path,records):
    folder=path.parent;cache=(ROOT/'.cache/map-tiles').resolve()
    shared=any(_record_path(value).is_relative_to(folder) for value in records.values())
    owned=(folder.parent==cache and re.fullmatch(r'[0-9a-f]{24}',folder.name)
           and path.name=='map.dzi' and (folder/'complete').is_file()
           and (folder/'complete').read_text(encoding='ascii').strip()==folder.name)
    if owned and not shared:
        # resolve() above rejects paths redirected outside the managed cache.
        shutil.rmtree(folder)
    return bool(owned and not shared)

def remove_capture(seed,world):
    """Forget this registration; delete only our unshared generated tile cache."""
    records=_registry();key=f'{seed}:{world}';record=records.get(key)
    if record is None:return False
    remaining={k:v for k,v in records.items() if k!=key}
    cleared=_prune_cache(_record_path(record),remaining)
    _write_registry(remaining)
    return cleared


class Capture:
    def __init__(self,path,seed,world,x,y,scale=1,enabled=True,crop=None,scale_y=None):
        self.path=Path(path)
        if not self.path.is_absolute():self.path=ROOT/self.path
        self.seed=seed;self.world=world;self.x=x;self.y=y;self.scale=scale;self.enabled=enabled;self.items={};self.scene=None;self.detailed=True;self.z=-50;self.max_visible_tiles=24
        self.dzi=self.path.suffix.lower()=='.dzi'
        if self.dzi:
            root=ET.parse(self.path).getroot();size=next(e for e in root if e.tag.endswith('Size'))
            self.width=int(size.attrib['Width']);self.height=int(size.attrib['Height']);self.tile=int(root.attrib['TileSize']);self.overlap=int(root.attrib.get('Overlap',0));self.format=root.attrib['Format'];self.level=math.ceil(math.log2(max(self.width,self.height)))
            if not 1<=self.tile<=4096 or not 0<=self.overlap<=32 or self.format.lower() not in ('png','jpg','jpeg','webp'):raise ValueError('不支持的 DZI 切片参数')
            self.folder=self.path.with_name(self.path.stem+'_files')
            if not self.folder.is_dir():raise ValueError('找不到 DZI 同名的 _files 切片目录')
        else:
            size=QImageReader(str(self.path)).size();self.width=size.width();self.height=size.height()
            if self.width<=0 or self.height<=0:raise ValueError('无法读取图片尺寸')
            if self.width*self.height>64_000_000:raise ValueError('图片过大，请使用 DZI 切片，避免整张地图占满内存')
        self.scale_y=scale if scale_y is None else scale_y
        self.crop=list(crop) if crop is not None else [0,0,self.width,self.height]
        if (self.width<=0 or self.height<=0 or not all(math.isfinite(v) for v in [x,y,scale,self.scale_y,*self.crop])
            or scale<=0 or self.scale_y<=0 or len(self.crop)!=4):raise ValueError('底图尺寸或比例无效')
        cx,cy,cw,ch=self.crop
        if cx<0 or cy<0 or cw<=0 or ch<=0 or cx+cw>self.width or cy+ch>self.height:raise ValueError('裁切范围超出图片')
        self.clip_item=None

    def bounds(self):return QRectF(self.x,self.y,self.crop[2]*self.scale,self.crop[3]*self.scale_y)

    def install(self,scene,extend=True):
        if not self.enabled:return
        if self.scene is not None:self.detach()
        self.items={};self.scene=scene
        if extend:scene.setSceneRect(scene.sceneRect().united(self.bounds()))
        if not self.dzi:
            pix=QPixmap(str(self.path))
            if pix.isNull():raise ValueError('无法解码高清底图')
            if self.crop!=[0,0,self.width,self.height]:pix=pix.copy(QRectF(*self.crop).toAlignedRect())
            item=scene.addPixmap(pix);item.setPos(self.x,self.y);item.setScale(self.scale);item.setTransform(QTransform.fromScale(1,self.scale_y/self.scale));item.setZValue(self.z);self.items['image']=item
        elif self.crop!=[0,0,self.width,self.height]:
            self.clip_item=QGraphicsRectItem(QRectF(0,0,self.bounds().width(),self.bounds().height()))
            self.clip_item.setPen(Qt.NoPen);self.clip_item.setFlag(QGraphicsItem.ItemClipsChildrenToShape)
            self.clip_item.setPos(self.x,self.y);self.clip_item.setZValue(self.z);scene.addItem(self.clip_item)

    def detach(self):
        from shiboken6 import isValid,delete
        for item in self.items.values():
            if isValid(item):
                if item.scene():item.scene().removeItem(item)
                delete(item)
        self.items={};self.scene=None
        if self.clip_item is not None and isValid(self.clip_item):delete(self.clip_item)
        self.clip_item=None

    def refresh(self,view):
        if not self.enabled or not self.dzi or self.scene is not view.scene():return
        density=max(abs(view.transform().m11()*self.scale),abs(view.transform().m22()*self.scale_y))
        level=max(0,min(self.level,math.ceil(self.level+math.log2(max(.00001,density)))))
        if not self.detailed:level=min(level,max(0,self.level-3))
        factor=2**(self.level-level);span=self.tile*factor*self.scale
        world_rect=view.mapToScene(view.viewport().rect()).boundingRect()
        cx,cy,cw,ch=self.crop
        rect=QRectF((world_rect.left()-self.x)/self.scale+cx,(world_rect.top()-self.y)/self.scale_y+cy,
                    world_rect.width()/self.scale,world_rect.height()/self.scale_y).intersected(QRectF(*self.crop))
        # Large/high-DPI viewports also stay bounded: use a coarser level rather
        # than decoding an unbounded number of visible high-resolution tiles.
        while level>0:
            factor=2**(self.level-level);span=self.tile*factor
            cols=max(0,min(math.ceil(self.width/span),math.ceil(rect.right()/span))-max(0,math.floor(rect.left()/span)))
            rows=max(0,min(math.ceil(self.height/span),math.ceil(rect.bottom()/span))-max(0,math.floor(rect.top()/span)))
            if cols*rows<=self.max_visible_tiles:break
            level-=1
        factor=2**(self.level-level);span=self.tile*factor
        nx=math.ceil(self.width/(self.tile*factor));ny=math.ceil(self.height/(self.tile*factor))
        wanted=set()
        for ty in range(max(0,math.floor(rect.top()/span)),min(ny,math.ceil(rect.bottom()/span))):
            for tx in range(max(0,math.floor(rect.left()/span)),min(nx,math.ceil(rect.right()/span))):wanted.add((level,tx,ty))
        for key in list(self.items):
            if key not in wanted:
                from shiboken6 import delete
                item=self.items.pop(key);self.scene.removeItem(item);delete(item)
        for lev,tx,ty in sorted(wanted):
            if (lev,tx,ty) in self.items:continue
            path=self.folder/str(lev)/f'{tx}_{ty}.{self.format}'
            if not path.is_file():continue
            pix=QPixmap(str(path))
            if pix.isNull():continue
            item=self.scene.addPixmap(pix);item.setScale(factor*self.scale);item.setTransform(QTransform.fromScale(1,self.scale_y/self.scale))
            px=((tx*self.tile-(self.overlap if tx else 0))*factor-cx)*self.scale
            py=((ty*self.tile-(self.overlap if ty else 0))*factor-cy)*self.scale_y
            if self.clip_item is not None:item.setParentItem(self.clip_item);item.setPos(px,py)
            else:item.setPos(self.x+px,self.y+py)
            item.setZValue(self.z);self.items[(lev,tx,ty)]=item

    def save(self):
        registry=_registry()
        path=self.path.relative_to(ROOT) if self.path.is_relative_to(ROOT) else self.path
        registry[f'{self.seed}:{self.world}']={'path':str(path),'seed':self.seed,'world':self.world,'x':self.x,'y':self.y,'scale':self.scale,'scale_y':self.scale_y,'crop':self.crop,'enabled':self.enabled}
        _write_registry(registry)


def find_capture(seed,world):
    try:
        record=_registry().get(f'{seed}:{world}')
        return Capture(**record) if record else None
    except (ValueError,OSError,ET.ParseError,TypeError,KeyError):return None


def choose_capture(parent,seed,world,on_ready=None):
    path,_=QFileDialog.getOpenFileName(parent,'导入当前种子的高清截图 / Deep Zoom 地图','','地图底图 (*.dzi *.png *.jpg *.jpeg *.webp *.tif *.tiff)')
    if not path:return None
    from .capture_editor import CaptureEditor
    def edit(prepared):
        dialog=CaptureEditor(prepared,seed,world,parent)
        try:
            if not dialog.exec():
                _prune_cache(Path(prepared).resolve(),_registry());return None
            capture=dialog.capture();capture.save();return capture
        finally:dialog.deleteLater()
    try:
        size=QImageReader(path).size()
        if Path(path).suffix.lower()!='.dzi' and (size.width()*size.height()>4_000_000 or not size.isValid()):
            from .image_import import prepare_raster
            owner=getattr(parent,'window',None)
            if on_ready and hasattr(owner,'start_job'):
                parent.capture_importing=True;parent.capture_button.setEnabled(False);parent.sync_capture_controls()
                parent.progress.setValue(0);parent.progress.show()
                def work():return prepare_raster(path,parent.generationProgress.emit)
                def ready(prepared):
                    capture=edit(prepared)
                    if capture:on_ready(capture)
                def finished():
                    parent.capture_importing=False;parent.capture_button.setEnabled(not parent.working);parent.sync_capture_controls()
                    if not parent.working:parent.progress.hide()
                owner.start_job(work,ready,finished);return None
            path=prepare_raster(path)
        return edit(path)
    except Exception as exc:QMessageBox.warning(parent,'底图加载失败',str(exc))
