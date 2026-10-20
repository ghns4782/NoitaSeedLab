import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import tempfile
import unittest
from pathlib import Path
from PySide6.QtCore import QRectF
from PySide6.QtGui import QPixmap,QColor
from PySide6.QtWidgets import QApplication
from noitatool.map_capture import Capture
from noitatool.map_ui import MapCanvas
from noitatool.paths import ROOT


class CaptureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.app=QApplication.instance() or QApplication([])

    def test_dzi_selects_resolution_and_only_reads_visible_tiles(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(ROOT))
            path=Path(folder)/'capture.dzi'
            path.write_text('<Image TileSize="512" Overlap="1" Format="png" xmlns="http://schemas.microsoft.com/deepzoom/2008"><Size Width="2048" Height="1024"/></Image>')
            for level,nx,ny in [(9,1,1),(10,2,1),(11,4,2)]:
                directory=path.with_name('capture_files')/str(level);directory.mkdir(parents=True)
                for x in range(nx):
                    for y in range(ny):
                        pix=QPixmap(512,512);pix.fill(QColor('#356a4c'));pix.save(str(directory/f'{x}_{y}.png'))
            capture=Capture(path,123,0,-100,-200,1);view=MapCanvas();view.resize(800,600);view.show();self.app.processEvents();capture.install(view.scene())
            view.fitInView(QRectF(-100,-200,2048,1024));capture.refresh(view)
            self.assertTrue(capture.items);self.assertLessEqual(len(capture.items),8)
            first={key[0] for key in capture.items}
            view.zoom(4);capture.refresh(view);self.assertTrue(capture.items);self.assertLessEqual(len(capture.items),8)
            self.assertGreaterEqual(min(key[0] for key in capture.items),min(first))
            for item in capture.items.values():self.assertEqual(item.zValue(),-50)
            view.close()

    def test_image_capture_uses_declared_origin_and_pixel_scale(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(ROOT))
            path=Path(folder)/'mine.png';pix=QPixmap(100,80);pix.fill(QColor('#383929'));pix.save(str(path))
            capture=Capture(path,321,1,35000,500,.5);view=MapCanvas();capture.install(view.scene())
            item=capture.items['image'];self.assertEqual(item.pos().x(),35000);self.assertEqual(item.pos().y(),500);self.assertEqual(item.scale(),.5)
            self.assertEqual(capture.seed,321);self.assertEqual(capture.world,1)
