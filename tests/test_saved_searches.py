import tempfile
import unittest
from pathlib import Path
from noitatool.paths import ROOT
from noitatool.saved_searches import SearchLibrary

class SavedSearchTests(unittest.TestCase):
    def test_named_round_trip_updates_and_validation(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'artifacts') as folder:
            library=SearchLibrary(folder)
            rule={'type':'and','rules':[
                {'type':'perkSet','val':{'ids':['EDIT_WANDS_EVERYWHERE','IRON_STOMACH'],'where':0,'mode':'all','lottery':['IRON_STOMACH']}},
                {'type':'layerSpells','val':{'ids':['BLACK_HOLE'],'layers':[0,2,4],'scope':'main','mode':'all'}}]}
            path=library.save('搜索方案 / 天赋与法术',rule)
            fresh=SearchLibrary(folder)
            self.assertEqual(fresh.entries(),[(path,{'name':'搜索方案 / 天赋与法术','rule':rule})])
            replacement={'type':'not','rules':[rule]}
            self.assertEqual(fresh.save('搜索方案 / 天赋与法术',replacement),path)
            self.assertEqual(len(fresh.entries()),1)
            self.assertEqual(fresh.entries()[0][1]['rule'],replacement)
            before=path.read_bytes()
            with self.assertRaises(ValueError):fresh.save('搜索方案 / 天赋与法术',{'type':'and','rules':[]})
            self.assertEqual(path.read_bytes(),before)
            with self.assertRaises(ValueError):fresh.save('  ',rule)
            self.assertFalse(list(Path(folder).glob('*.tmp')))

if __name__=='__main__':unittest.main()
