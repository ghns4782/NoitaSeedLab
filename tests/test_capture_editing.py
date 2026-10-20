import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtCore import Qt,QRectF,QPointF
from PySide6.QtGui import QPixmap,QColor
from PySide6.QtTest import QTest
from PySide6.QtWidgets import QApplication
from noitatool.app import Window,configure_app
from noitatool.map_capture import Capture,find_capture,remove_capture,choose_capture
from noitatool.capture_editor import CaptureEditor
from noitatool.map_ui import MapCanvas,HolyShopMarker,NativeSprite


class CaptureEditingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app=QApplication.instance() or QApplication([]);configure_app(cls.app)
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(dir='artifacts');self.root=Path(self.temp.name).resolve()
        self.patch_root=patch('noitatool.map_capture.ROOT',self.root);self.patch_registry=patch('noitatool.map_capture.REGISTRY',self.root/'registry.json')
        self.patch_root.start();self.patch_registry.start()
        self.image=self.root/'original.png';pix=QPixmap(100,80);pix.fill(QColor('red'));pix.save(str(self.image))
    def tearDown(self):
        self.patch_registry.stop();self.patch_root.stop();self.temp.cleanup()
    def tiles(self):
        folder=self.root/'.cache/map-tiles'/('a'*24);folder.mkdir(parents=True)
        path=folder/'map.dzi';path.write_text('<Image TileSize="64" Overlap="0" Format="png"><Size Width="128" Height="128"/></Image>')
        (folder/'complete').write_text(folder.name)
        for level in (0,6,7):
            tiles=folder/'map_files'/str(level);tiles.mkdir(parents=True)
            for x in range(2):
                for y in range(2):
                    pix=QPixmap(64,64);pix.fill(QColor('green'));pix.save(str(tiles/f'{x}_{y}.png'))
        return path
    def test_disabled_state_survives_reload_and_external_image_is_never_deleted(self):
        capture=Capture(self.image,123,0,10,20,enabled=False);capture.save()
        self.assertFalse(find_capture(123,0).enabled)
        self.assertFalse(remove_capture(123,0));self.assertIsNone(find_capture(123,0));self.assertTrue(self.image.exists())
    def test_managed_cache_is_deleted_only_after_last_registration(self):
        path=self.tiles()
        Capture(path,123,0,0,0).save();Capture(path,456,1,0,0).save()
        self.assertFalse(remove_capture(123,0));self.assertTrue(path.exists())
        self.assertTrue(remove_capture(456,1));self.assertFalse(path.parent.exists());self.assertTrue(self.image.exists())
    def test_external_dzi_and_unmarked_cache_are_preserved(self):
        path=self.tiles();(path.parent/'complete').unlink()
        Capture(path,123,0,0,0).save();self.assertFalse(remove_capture(123,0));self.assertTrue(path.exists())
        external=self.root/'external.dzi';external.write_text(path.read_text());(self.root/'external_files').mkdir()
        Capture(external,123,0,0,0).save();self.assertFalse(remove_capture(123,0));self.assertTrue(external.exists())
    def test_cancelled_import_preserves_source_and_does_not_register(self):
        with patch('noitatool.map_capture.QFileDialog.getOpenFileName',return_value=(str(self.image),'')),patch.object(CaptureEditor,'exec',return_value=0):
            self.assertIsNone(choose_capture(None,123,0));self.assertIsNone(find_capture(123,0));self.assertTrue(self.image.exists())
    def test_crop_and_independent_axes_round_trip_and_render(self):
        capture=Capture(self.image,123,0,1000,2000,2,crop=[10,20,40,30],scale_y=3);capture.save()
        restored=find_capture(123,0);self.assertEqual(restored.crop,[10,20,40,30]);self.assertEqual(restored.bounds(),QRectF(1000,2000,80,90))
        view=MapCanvas();restored.install(view.scene());item=restored.items['image']
        self.assertEqual(item.pixmap().size().width(),40);self.assertEqual(item.sceneBoundingRect(),restored.bounds());restored.detach();view.close()
    def test_cropped_dzi_clips_and_keeps_bounded_lod(self):
        capture=Capture(self.tiles(),123,0,1000,2000,2,crop=[32,16,64,80],scale_y=3)
        view=MapCanvas();view.resize(700,500);view.show();self.app.processEvents();capture.install(view.scene());view.fitInView(capture.bounds(),Qt.KeepAspectRatio);capture.refresh(view)
        self.assertTrue(capture.items);self.assertLessEqual(len(capture.items),24)
        self.assertEqual(capture.clip_item.sceneBoundingRect(),capture.bounds())
        self.assertTrue(all(item.parentItem() is capture.clip_item for item in capture.items.values()))
        capture.detach();self.assertIsNone(capture.clip_item);view.close()
    def test_eight_handles_crop_drag_alignment_and_original_unchanged(self):
        before=self.image.read_bytes();dialog=CaptureEditor(self.image,123,0)
        self.assertEqual(len(dialog.crop_frame.handles),8);self.assertEqual(len(dialog.map_frame.handles),8)
        dialog.crop_frame.resize_at(0,QPointF(10,20));self.assertEqual(dialog.selected_crop(),[10,20,90,60])
        dialog.crop_frame.resize_at(4,QPointF(70,60));self.assertEqual(dialog.selected_crop(),[10,20,60,40])
        dialog.map_frame.set_world_rect(QRectF(1000,2000,120,160));capture=dialog.capture()
        self.assertEqual(capture.crop,[10,20,60,40]);self.assertEqual(capture.scale,2);self.assertEqual(capture.scale_y,4)
        dialog.map_frame.setPos(1100,2200);self.assertEqual(dialog.capture().bounds(),QRectF(1100,2200,120,160))
        reopened=CaptureEditor(self.image,123,0,capture=capture);self.assertEqual(reopened.capture().crop,capture.crop)
        self.assertEqual(reopened.capture().bounds(),capture.bounds());reopened.close();dialog.close();self.assertEqual(self.image.read_bytes(),before)
    def test_mouse_drag_handle_changes_crop(self):
        dialog=CaptureEditor(self.image,123,0);dialog.show();self.app.processEvents()
        view=dialog.crop_view;start=view.mapFromScene(dialog.crop_frame.handles[4].scenePos());end=view.mapFromScene(QPointF(70,60))
        QTest.mousePress(view.viewport(),Qt.LeftButton,pos=start)
        QTest.mouseMove(view.viewport(),end);QTest.mouseRelease(view.viewport(),Qt.LeftButton,pos=end);self.app.processEvents()
        self.assertEqual(dialog.selected_crop(),[0,0,70,60]);dialog.close()
    def test_map_toggle_delete_restore_builtin_without_regeneration(self):
        window=Window();page=window.map_page
        page.data={'seed':123,'worldOffset':0,'origin':[-17920,-31744],'width':35840,'height':73728,'pois':[],'regions':[]}
        capture=Capture(self.image,123,0,0,0);capture.save()
        with patch.object(page,'request_map') as generate:
            page.capture_ready(capture);self.assertTrue(page.capture_visible.isChecked());self.assertTrue(capture.items)
            page.capture_visible.setChecked(False);self.assertFalse(capture.items);self.assertFalse(find_capture(123,0).enabled)
            self.assertTrue(page.terrain_layer);page.update_markers();self.assertFalse(capture.items)
            page.capture_visible.setChecked(True);self.assertTrue(capture.items)
            page.delete_capture_button.click();self.assertIsNone(page.capture);self.assertFalse(page.delete_capture_button.isEnabled())
            self.assertTrue(self.image.exists());self.assertIsNone(find_capture(123,0));generate.assert_not_called()
        window.close()
    def test_shop_size_grows_with_zoom_and_stays_inside_mountain(self):
        items=[{'type':'spell','spell':'LIGHT_BULLET','price':100,'source':'holy_mountain','shopLevel':0,'x':0,'y':0}]*10
        previous=0
        for zoom in (.1,.5,1,2,4,8):
            marker=HolyShopMarker(items,zoom,lambda _:None,QRectF(-1536,1024,3584,512))
            self.assertGreaterEqual(marker.width,previous);previous=marker.width
            self.assertLessEqual(marker.width,3584*zoom);self.assertLessEqual(marker.height,512*zoom)
        self.assertGreater(previous,500)
        window=Window();page=window.map_page;page.canvas.resize(700,500)
        page.data={'seed':123,'worldOffset':0,'origin':[-17920,-31744],'width':35840,'height':73728,'pois':items,'regions':[]}
        page.filters['spell'].setChecked(True);page.precise.setChecked(True)
        page.canvas.resetTransform();page.canvas.scale(4,4);page.canvas.centerOn(256,1280);page.update_markers()
        self.assertTrue(any(isinstance(marker,HolyShopMarker) for marker in page.markers))
        self.assertFalse(any(isinstance(marker,NativeSprite) for marker in page.markers));window.close()


if __name__=='__main__':unittest.main()
