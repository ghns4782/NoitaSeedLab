import random
import unittest
from noitatool.engine import Engine
from noitatool.gpu import GPU, MATERIALS, SPELLS, BOMBS, devices
from noitatool.search import SearchConfig, SearchRunner

RULE={'type':'startingFlask','val':'snow'}

class EngineTests(unittest.TestCase):
    def test_upstream_fixtures(self):
        with Engine() as engine:
            info=engine.info(123)
            self.assertEqual(info['startingFlask'],'snow')
            self.assertEqual(info['alchemy'],{'AP':['swamp','magic_liquid_movement_faster','wax'],'LC':['lava','magic_liquid_invisibility','diamond']})
            self.assertEqual([p['id'] for p in info['perk'][0]],['LOW_HP_DAMAGE_BOOST','PROJECTILE_HOMING','MOLD'])
            self.assertEqual(engine.info(5151515)['startingFlask'],'mud')
            self.assertEqual([s['spell']['id'] for s in info['shop'][2]['items']],['RECHARGE','CLOUD_ACID','TELEPORT_PROJECTILE_CLOSER','MANA_REDUCE','EXPLOSION_TINY','ROCKET_OCTAGON','PROPANE_TANK','GRENADE_TRIGGER','BULLET_TIMER','LIGHTNING'])

    def test_cpu_parallel_range(self):
        with Engine() as engine:
            expected=engine.search(1,513,RULE)
        for workers in (1,2):
            runner=SearchRunner(SearchConfig(start=1,end=512,max_workers=workers,max_results=1000,cpu_percent=100),RULE)
            self.assertEqual(runner.run(),expected)
            self.assertEqual(runner.checked,512)

    def test_invalid_conditions_fail(self):
        with Engine() as engine:
            with self.assertRaises(RuntimeError):
                engine.search(1,2,{'type':'unimplemented','val':0})

    def test_rerolls_and_shop_conditions(self):
        with Engine() as engine:
            base=engine.info(123)
            rerolled=engine.info(123,rerolls={'1':1})
            self.assertEqual(base['perk'][0],rerolled['perk'][0])
            self.assertNotEqual(base['perk'][1],rerolled['perk'][1])
            self.assertEqual(base['perk'][2],rerolled['perk'][2])
            # The first matching shop must not skip later, incompatible shops.
            rule={'type':'shop','val':[{'type':1,'items':[]},None,{'type':1,'items':[]}]}
            self.assertEqual(engine.search(123,124,rule),[])
            good={'type':'shop','val':[None,None,{'type':2,'items':[{'spell':'MANA_REDUCE'}],'strict':True}]}
            self.assertEqual(engine.search(123,124,good),[123])
            self.assertEqual(engine.search(123,124,{'type':'waterCave','val':base['waterCave']}),[123])
            self.assertEqual(engine.search(123,124,{'type':'waterCave','val':(base['waterCave']+1)%5}),[])
            for no_op in ('spells','potion','biome','chestRandom','alwaysCast','lottery'):
                with self.assertRaises(RuntimeError):engine.search(123,124,{'type':no_op,'val':{}})

    @unittest.skipUnless(devices(),'No FP64 OpenCL GPU')
    def test_gpu_matches_upstream(self):
        gpu=GPU(RULE)
        rng=random.Random(20261019)
        starts=[1,123,5151515,2147483000]+[rng.randrange(1,2147483000) for _ in range(16)]
        with Engine() as engine:
            for start in starts:
                count=64
                expected=engine.request(op='probe',seeds=list(range(start,start+count)))
                actual=gpu.diagnostic(start,count)
                for i,item in enumerate(expected):
                    decoded={'startingFlask':MATERIALS[int(actual[i,0])],'startingSpell':SPELLS[int(actual[i,1])],'startingBombSpell':BOMBS[int(actual[i,2])],'alchemy':{'LC':[MATERIALS[int(v)] for v in actual[i,3:6]],'AP':[MATERIALS[int(v)] for v in actual[i,6:9]]}}
                    self.assertEqual(decoded,item,f'seed {start+i}')

    @unittest.skipUnless(devices(),'No FP64 OpenCL GPU')
    def test_gpu_search_no_false_negatives(self):
        rules=[RULE,{'type':'alchemy','val':{'LC':MATERIALS[:30],'AP':[]}}, {'type':'and','rules':[RULE,{'type':'perk','val':{'all':[['MOLD']],'some':[],'deck':[]}}]}, {'type':'not','rules':[{'type':'startingSpell','val':'LIGHT_BULLET'}]}, {'type':'perk','val':{'all':[[],[],['EDIT_WANDS_EVERYWHERE']],'some':[['MOLD','EXTRA_PERK']],'deck':[['EDIT_WANDS_EVERYWHERE']]}}, {'type':'or','rules':[{'type':'perk','val':{'all':[['MOLD']],'some':[],'deck':[]}},RULE]}]
        with Engine() as engine:
            for rule in rules:
                expected=engine.search(1,4097,rule)
                runner=SearchRunner(SearchConfig(start=1,end=4096,backend='gpu',max_workers=2,max_results=5000,cpu_percent=100,gpu_percent=100),rule)
                self.assertEqual(runner.run(),expected)

    @unittest.skipUnless(devices(),'No FP64 OpenCL GPU')
    def test_gpu_perk_decks(self):
        gpu=GPU({'type':'perk','val':{'all':[['EDIT_WANDS_EVERYWHERE']]}})
        rng=random.Random(9133)
        starts=[1,123,2147483000]+[rng.randrange(1,2147483000) for _ in range(13)]
        with Engine() as engine:
            for start in starts:
                expected=engine.request(op='probe',perks=True,seeds=list(range(start,start+64)))
                actual=gpu.diagnostic_perks(start,64)
                self.assertEqual(actual,expected,f'seed range {start}')

if __name__=='__main__':
    unittest.main()
