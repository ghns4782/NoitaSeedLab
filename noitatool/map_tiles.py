"""Build bounded-size local Deep Zoom pyramids; runtime reads visible tiles only."""
import math
from pathlib import Path
from PySide6.QtCore import Qt

def write_pyramid(image,path,tile_size=512,limit=12*1024*1024):
    path=Path(path);folder=path.with_name(path.stem+'_files');folder.mkdir(parents=True,exist_ok=True)
    width,height=image.width(),image.height();top=math.ceil(math.log2(max(width,height)));total=0
    if image.isNull():raise ValueError('底图无法读取')
    for level in range(top+1):
        factor=2**(top-level);w=math.ceil(width/factor);h=math.ceil(height/factor)
        scaled=image if factor==1 else image.scaled(w,h,Qt.IgnoreAspectRatio,Qt.FastTransformation)
        directory=folder/str(level);directory.mkdir(exist_ok=True)
        for y in range(math.ceil(h/tile_size)):
            for x in range(math.ceil(w/tile_size)):
                target=directory/f'{x}_{y}.png'
                tile=scaled.copy(x*tile_size,y*tile_size,min(tile_size,w-x*tile_size),min(tile_size,h-y*tile_size))
                if not tile.save(str(target),'PNG'):raise OSError('无法保存底图切片')
                total+=target.stat().st_size
                if total>limit:raise ValueError('清晰地图切片超过 12 MB 限制')
    path.write_text(f'<Image TileSize="{tile_size}" Overlap="0" Format="png" xmlns="http://schemas.microsoft.com/deepzoom/2008"><Size Width="{width}" Height="{height}"/></Image>',encoding='utf-8')
    return {'width':width,'height':height,'levels':top+1,'bytes':total+path.stat().st_size}
