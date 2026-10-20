import io
import json
import tempfile
import unittest
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
from noitatool.paths import ROOT
from noitatool.daily_seed import current_daily_seed

class DailySeedTests(unittest.TestCase):
    def test_official_response_and_current_day_cache(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as directory,patch('noitatool.daily_seed.ROOT',Path(directory)):
            today=datetime.now(timezone.utc).date().isoformat()
            with patch('noitatool.daily_seed.urllib.request.urlopen',return_value=io.BytesIO(b'version;196176580;1179659765;1;')) as fetch:
                self.assertEqual(current_daily_seed(),(196176580,today))
                self.assertEqual(current_daily_seed(),(196176580,today))
                self.assertEqual(fetch.call_count,1)

    def test_expired_cache_fallback_and_failure(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as directory,patch('noitatool.daily_seed.ROOT',Path(directory)):
            cache=Path(directory)/'.cache'/'daily-seed.json';cache.parent.mkdir()
            yesterday=(datetime.now(timezone.utc).date()-timedelta(days=1)).isoformat()
            cache.write_text(json.dumps({'seed':123,'date':yesterday}),encoding='utf-8')
            with patch('noitatool.daily_seed.urllib.request.urlopen',side_effect=[OSError('offline'),io.BytesIO(b'{"seed":"196176580"}')]):
                self.assertEqual(current_daily_seed()[0],196176580)
            with patch('noitatool.daily_seed.urllib.request.urlopen',side_effect=OSError('offline')):
                with self.assertRaises(RuntimeError):current_daily_seed(force=True)

if __name__=='__main__':unittest.main()
