"""Register the supplied stitched overview with game coordinates, then tile it."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from PySide6.QtCore import Qt
from PySide6.QtGui import QImage
from noitatool.map_tiles import write_pyramid

root=Path(__file__).resolve().parent.parent
# Static terrain matching against the upstream art: original main screenshot
# maps a 1120px-wide, 35840-world-pixel area to 1048px, offset by (4,66).
# The main screenshot begins 663 pixels down in the stitched overview.
scale=35840/1048
source=root/'scripts/inputs/world-reference-lossless.png'
image=QImage(str(source if source.exists() else root/'assets/world-reference.jpg'))
# Pixel-exact enlargement improves display sharpness; it invents no terrain.
image=image.scaled(image.width()*2,image.height()*2,Qt.IgnoreAspectRatio,Qt.FastTransformation)
stats=write_pyramid(image,root/'assets/real-terrain.dzi')
data={'origin':[-17920-4*scale,-7168-(663+66)*scale],'scale':scale/2,'nativeScale':scale,
      'source':'User-supplied stitched offline overview','fixedLayout':True,'enlargement':2,
      'registration':{'mainOffsetY':663,'artRenderedWidth':1048,'artOffset':[4,66],'artWorldOrigin':[-17920,-7168],'artWorldWidth':35840},**stats}
(root/'assets/real-terrain.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(data,ensure_ascii=False))
