"""Stitch the three user-supplied screenshots at matching scales using Qt."""
from pathlib import Path
import numpy as np
from PySide6.QtCore import Qt
from PySide6.QtGui import QImage,QPainter

ROOT=Path(__file__).resolve().parent.parent
SOURCES=[
    'codex-clipboard-e7d7251d-4124-4d7e-8aa9-57018272d6a7.png',
    'codex-clipboard-53cd0317-d5c8-4e4b-a53f-db5b421e1bf1.png',
    'codex-clipboard-ce41f913-529a-40b1-96e4-5cbef8bdfacf.png',
]

def pixels(image):
    image=image.convertToFormat(QImage.Format_RGBA8888)
    return np.frombuffer(image.bits(),np.uint8).reshape(image.height(),image.bytesPerLine())[:,:image.width()*4].reshape(image.height(),image.width(),4)[:,:,:3].copy()

def align(upper,lower,start,end):
    a,b=pixels(upper),pixels(lower)
    # Sample terrain edges to avoid giving the black sky excessive weight.
    best=None
    for dy in range(start,end):
        height=min(a.shape[0]-dy,b.shape[0])
        if height<40:continue
        for dx in range(-8,9):
            left=max(0,dx);right=min(a.shape[1],b.shape[1]+dx)
            aa=a[dy:dy+height:3,left:right:3].astype(float)
            bb=b[:height:3,left-dx:right-dx:3].astype(float)
            weights=1+(np.max(aa,axis=2)-np.min(aa,axis=2)>30)*3
            score=np.mean(np.abs(aa-bb).mean(axis=2)*weights)
            if best is None or score<best[0]:best=(score,dx,dy)
    return best

def align_sky(raw,main):
    target=pixels(main)[:80:4,400:640:4].astype(float);best=None
    for factor in np.arange(1.30,1.371,.005):
        image=raw.scaled(round(raw.width()*factor),round(raw.height()*factor),Qt.IgnoreAspectRatio,Qt.SmoothTransformation)
        source=pixels(image)
        for dy in range(620,711):
            for dx in range(-80,-9):
                patch=source[dy:dy+80:4,400-dx:640-dx:4].astype(float)
                if patch.shape!=target.shape:continue
                score=np.abs(patch-target).mean()
                if best is None or score<best[0]:best=(score,image,dx,dy)
    return best[1:]

if __name__=='__main__':
    import os
    folder=Path.home()/'AppData/Local/Temp'
    raw=[QImage(str(folder/name)) for name in SOURCES]
    if any(im.isNull() for im in raw):raise RuntimeError('Missing original screenshots')
    width=raw[1].width()
    main,hell=raw[1],raw[2]
    sky,mx,my=align_sky(raw[0],main)
    _,hx,hy=align(main,hell,650,760)
    print('alignment:',mx,my,hx,hy)
    canvas=QImage(width,my+hy+hell.height(),QImage.Format_RGB32);canvas.fill(Qt.black)
    painter=QPainter(canvas);painter.drawImage(mx,0,sky);painter.drawImage(0,my,main);painter.drawImage(hx,my+hy,hell);painter.end()
    output=ROOT/'assets/world-reference.jpg'
    assert canvas.save(str(output),'JPG',93)
    source=ROOT/'scripts/inputs/world-reference-lossless.png';source.parent.mkdir(parents=True,exist_ok=True)
    assert canvas.save(str(source),'PNG')
    print(output,canvas.size(),output.stat().st_size)
