import os
os.environ['QT_QPA_PLATFORM']='offscreen'
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PySide6.QtCore import QTimer
from PySide6.QtWidgets import QApplication,QDialog
from noitatool.paths import APP_DIR,STATE,ROOT
from noitatool.storage import initialize_storage
from noitatool.startup import StartupNotice,show_startup_notices


class PortableStartupTests(unittest.TestCase):
    def test_user_data_is_separate_from_resources(self):
        self.assertEqual(STATE,APP_DIR/'data')
        self.assertNotEqual(STATE,ROOT)
        from noitatool.saved_searches import SearchLibrary
        self.assertEqual(SearchLibrary().directory,STATE/'saved-searches')

    def test_migration_preserves_originals_and_existing_data(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            base=Path(folder);(base/'settings.json').write_text('{"old":true}')
            (base/'saved-searches').mkdir();(base/'saved-searches/a.json').write_text('{"name":"a"}')
            (base/'translations').mkdir();(base/'translations/selection.json').write_text('"en"')
            (base/'data').mkdir();(base/'data/settings.json').write_text('{"new":true}')
            (base/'artifacts').mkdir();(base/'artifacts/search-flow-1.sqlite').write_bytes(b'old-run')
            (base/'artifacts/developer-log.txt').write_text('skip')
            target=initialize_storage(base)
            self.assertEqual(json.loads((target/'settings.json').read_text()),{'new':True})
            self.assertTrue((base/'settings.json').exists())
            self.assertTrue((target/'saved-searches/a.json').exists())
            self.assertTrue((target/'translations/selection.json').exists())
            self.assertEqual((target/'artifacts/search-flow-1.sqlite').read_bytes(),b'old-run')
            self.assertFalse((target/'artifacts/developer-log.txt').exists())
            (target/'saved-searches/a.json').unlink();initialize_storage(base)
            self.assertFalse((target/'saved-searches/a.json').exists())

    def test_cached_map_registration_survives_moving_application(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            base=Path(folder);cache=base/'.cache/map-tiles/hash';cache.mkdir(parents=True)
            (cache/'map.dzi').write_text('map')
            (base/'.cache/map-captures.json').write_text(json.dumps({'1:0':{'path':str(cache/'map.dzi')}}))
            target=initialize_storage(base)
            record=json.loads((target/'.cache/map-captures.json').read_text())['1:0']
            self.assertFalse(Path(record['path']).is_absolute())
            self.assertEqual((target/record['path']).read_text(),'map')

    def test_two_notices_and_exit_behavior(self):
        with patch('noitatool.startup.StartupNotice') as notice:
            notice.return_value.exec.side_effect=[QDialog.Accepted,QDialog.Accepted]
            self.assertTrue(show_startup_notices())
            self.assertEqual([c.args[0] for c in notice.call_args_list],[0,1])
        with patch('noitatool.startup.StartupNotice') as notice:
            notice.return_value.exec.return_value=QDialog.Rejected
            self.assertFalse(show_startup_notices());self.assertEqual(notice.call_count,1)

    def test_real_dialog_buttons_and_source_links(self):
        app=QApplication.instance() or QApplication([])
        for index in range(2):
            dialog=StartupNotice(index);dialog.show();app.processEvents()
            self.assertLess(dialog.body.sizeHint().height(),dialog.height())
            if index:
                self.assertIn('https://noitool.com/',dialog.body.text())
                self.assertIn('https://github.com/TwoAbove/noita-tools',dialog.body.text())
                self.assertNotIn('noitatool.com',dialog.body.text())
            QTimer.singleShot(0,dialog.continue_button.click)
            self.assertEqual(dialog.exec(),QDialog.Accepted)


if __name__=='__main__':unittest.main()
