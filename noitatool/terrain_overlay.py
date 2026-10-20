"""Generated areas cover only their own coordinates, leaving the photo elsewhere."""
import base64
from PySide6.QtGui import QPixmap
from .paths import ROOT

def install_overlay(scene,data):
    overlay=data.get('overlay')
    if data.get('verticalIndex',0):return None
    pix=QPixmap()
    if overlay:
        pix.loadFromData(base64.b64decode(overlay['image']));origin=overlay['origin'];scale=overlay['scale']
    elif data.get('bundledReference') and (ROOT/'assets/region-overlay.png').is_file():
        pix.load(str(ROOT/'assets/region-overlay.png'));origin=[data['worldOffset']*35840-17920,-7168];scale=10
    else:return None
    if pix.isNull():return None
    item=scene.addPixmap(pix);item.setPos(*origin);item.setScale(scale);item.setZValue(-75)
    return item
