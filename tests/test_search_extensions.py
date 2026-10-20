import unittest
from noitatool.seed_lists import parse_seed_list
from noitatool.search import SearchConfig,SearchRunner,validate_rule
from noitatool.engine import Engine
from noitatool.gpu import devices

class ListSearchTests(unittest.TestCase):
    def test_parse_formats_and_reject_invalid(self):
        for text in ('123, 84\n123 284','[123,84,123,284]','seed,notes\n123,a\n84,b\n123,c\n284,d','{"seeds":[123,84,123,284]}'):
            self.assertEqual(parse_seed_list(text),[123,84,284])
        for text in ('','1,wrong,3','[true,123]','[1.5]','0','2147483646'):
            with self.assertRaises((ValueError,TypeError)):parse_seed_list(text)

    def test_cpu_list_only_and_unlimited(self):
        seeds=[123,84,284,304,521,984,123,2147483000]
        rule={'type':'startingFlask','val':'water'}
        with Engine() as e:expected=e.search(1,2,rule,seeds=list(dict.fromkeys(seeds)))
        runner=SearchRunner(SearchConfig(seed_list=seeds,max_results=0,max_workers=2),rule)
        self.assertEqual(runner.run(),sorted(expected))
        self.assertEqual(runner.checked,len(set(seeds)))
        self.assertTrue(set(runner.found)<=set(seeds))

    @unittest.skipUnless(devices(),'No GPU')
    def test_gpu_sparse_list_and_multi_perks(self):
        seeds=[1,123,84,284,304,521,984,1129,2147483000,700000013]
        rules=[{'type':'startingFlask','val':'water'},{'type':'perkSet','val':{'where':'any','mode':'all','ids':['EDIT_WANDS_EVERYWHERE','MOLD']}},{'type':'perkSet','val':{'where':0,'mode':'any','ids':['EDIT_WANDS_EVERYWHERE','MOLD']}},{'type':'perkSet','val':{'where':'deck','mode':'all','ids':['EDIT_WANDS_EVERYWHERE','MOLD']}}]
        with Engine() as e:
            for rule in rules:
                expected=e.search(1,2,rule,seeds=seeds)
                runner=SearchRunner(SearchConfig(seed_list=seeds,backend='gpu',max_results=0,max_workers=2,cpu_percent=100,gpu_percent=100),rule)
                self.assertEqual(runner.run(),sorted(expected));self.assertEqual(runner.checked,len(seeds))

class PerkLotteryTests(unittest.TestCase):
    def test_mixed_required_lottery_and_presence(self):
        with Engine() as e:
            # Seed 123: first row has homing (not marked) and fungal colony (marked).
            base={'ids':['PROJECTILE_HOMING','MOLD'],'where':0,'mode':'all'}
            good={'type':'perkSet','val':dict(base,lottery=['MOLD'])}
            bad={'type':'perkSet','val':dict(base,lottery=['PROJECTILE_HOMING'])}
            self.assertEqual(e.search(123,124,good),[123])
            self.assertEqual(e.search(123,124,bad),[])
            self.assertEqual(e.search(123,124,{'type':'not','rules':[bad]}),[123])
            self.assertEqual(e.search(123,124,{'type':'perkSet','val':dict(base,where='any',lottery=['MOLD'])}),[123])
            any_good={'type':'perkSet','val':dict(base,mode='any',lottery=['PROJECTILE_HOMING'])}
            self.assertEqual(e.search(123,124,any_good),[123])  # unmarked MOLD is sufficient
            self.assertEqual(e.search(123,124,{'type':'perkSet','val':dict(base,ids=['PROJECTILE_HOMING'],mode='any',lottery=['PROJECTILE_HOMING'])}),[])

    def test_invalid_lottery_targets(self):
        for extra in ({'lottery':['MOLD']},{'lottery':'PROJECTILE_HOMING'},{'lottery':['PROJECTILE_HOMING'],'where':'deck'}):
            with self.subTest(extra=extra),self.assertRaises(ValueError):
                validate_rule({'type':'perkSet','val':dict(ids=['PROJECTILE_HOMING'],where=0,mode='all')|extra})

    @unittest.skipUnless(devices(),'No GPU')
    def test_gpu_prefilter_still_checks_lottery(self):
        from noitatool.gpu import expression,prefilter
        seeds=[123,84,284,304,521,984]
        for target,expected in [('MOLD',[123]),('PROJECTILE_HOMING',[])]:
            rule={'type':'perkSet','val':{'ids':['PROJECTILE_HOMING','MOLD'],'where':0,'mode':'all','lottery':[target]}}
            self.assertIsNone(expression(rule));self.assertIsNotNone(prefilter(rule))
            self.assertIsNone(prefilter({'type':'not','rules':[rule]}))
            with Engine() as e:cpu=e.search(1,2,rule,seeds=seeds)
            runner=SearchRunner(SearchConfig(seed_list=seeds,backend='gpu',max_results=0,max_workers=2,cpu_percent=100,gpu_percent=100),rule)
            self.assertEqual(runner.run(),sorted(cpu))
            self.assertEqual([s for s in cpu if s==123],expected)

class LayerSearchTests(unittest.TestCase):
    def test_overgrown_inventory_parallel_worlds_and_union(self):
        with Engine() as e:
            rows=[e.request(op='layer',seed=123,scope='overgrown',worldOffset=pw) for pw in (0,1,-1)]
            main,east,west=rows
            self.assertIn('FIREBALL_RAY_LINE',main['ids'])  # always cast on a wand
            self.assertTrue(any(i['type']=='wand' and i['x']==15135 and i['y']==4070 for i in main['items']))
            for pw,row in zip((0,1,-1),rows):
                self.assertGreater(len(row['items']),20)
                self.assertTrue(all(pw*35840-17920<=p['x']<pw*35840+17920 and 0<=p['y']<8704 for p in row['items']))
                self.assertTrue(all(p['worldOffset']==pw for p in row['items']))
                for item in row['items']:
                    if item['type']=='wand':self.assertTrue(set(item.get('cards',[])+item.get('always_casts',[]))<=set(row['ids']))
            a=next(iter(set(main['ids'])-set(east['ids'])))
            b=next(iter(set(east['ids'])-set(main['ids'])))
            base={'scope':'overgrown','mode':'all','ids':[a,b]}
            for worlds,expected in [([0,0],[]),([1,1],[]),([0,1],[123])]:
                rule={'type':'layerSpells','val':dict(base,worldRange=worlds)}
                validate_rule(rule);self.assertEqual(e.search(123,124,rule),expected)
            shop=e.request(op='layer',seed=123,layer=0,worldOffset=1)
            self.assertTrue(any(i['source']=='holy_mountain' and i['price']>0 for i in shop['items']))

    def test_parallel_world_range_validation(self):
        for worlds in ([],[0],[1,0],[-101,0],[0,101],[False,1],'1',None):
            with self.subTest(worlds=worlds),self.assertRaises(ValueError):
                validate_rule({'type':'layerSpells','val':{'scope':'overgrown','worldRange':worlds,'mode':'all','ids':['BLACK_HOLE']}})

    @unittest.skipUnless(devices(),'No GPU')
    def test_gpu_prefilter_overgrown_parallel_range(self):
        rule={'type':'and','rules':[{'type':'perkSet','val':{'ids':['MOLD'],'where':0,'mode':'all'}},{'type':'layerSpells','val':{'scope':'overgrown','worldRange':[0,1],'mode':'all','ids':['FIREBALL_RAY_LINE']}}]}
        seeds=[123,84]
        with Engine() as e:expected=e.search(1,2,rule,seeds=seeds)
        runner=SearchRunner(SearchConfig(seed_list=seeds,backend='gpu',max_workers=2,cpu_percent=100,gpu_percent=100,max_results=0),rule)
        self.assertIn(123,expected);self.assertEqual(runner.run(),sorted(expected))

    def test_selected_layers_union_and_legacy_rules(self):
        with Engine() as e:
            rows=[set(e.request(op='layer',seed=123,layer=i)['ids']) for i in (0,2,4)]
            first_only=next(iter(rows[0]-rows[1]))
            third_only=next(iter(rows[1]-rows[0]))
            rule={'type':'layerSpells','val':{'layers':[0,2,4],'scope':'main','mode':'all','ids':[first_only,third_only]}}
            validate_rule(rule)
            self.assertEqual(e.search(123,124,rule),[123])
            # Neither individual layer contains both; the selected union does.
            for layer in (0,2):
                single={'type':'layerSpells','val':dict(rule['val'],layers=[layer])}
                self.assertEqual(e.search(123,124,single),[])
            excluded=next(iter(set(e.request(op='layer',seed=123,layer=1)['ids'])-set.union(*rows)),None)
            if excluded:
                self.assertEqual(e.search(123,124,{'type':'layerSpells','val':dict(rule['val'],ids=[excluded])}),[])
            self.assertEqual(e.search(123,124,{'type':'layerSpells','val':dict(rule['val'],mode='any',ids=[third_only,'NO_SUCH_SPELL'])}),[123])

    def test_selected_layers_validation(self):
        for layers in ([],[-1],[7],[True],[0.5],'135',None):
            with self.subTest(layers=layers),self.assertRaises(ValueError):
                validate_rule({'type':'layerSpells','val':{'layers':layers,'mode':'all','ids':['BLACK_HOLE']}})

    def test_real_outside_spells_shop_union_and_bounds(self):
        with Engine() as e:
            info=e.info(123)
            generated=e.request(op='layer',seed=123,layer=0)
            first_shop=set(c for w in info['shop'][0]['items'] for c in w['cards']['cards'])
            self.assertTrue(first_shop<=set(generated['ids']))
            # Independent fixed-position evidence: mine wand with Black Hole, outside the HM.
            self.assertIn({'id':'BLACK_HOLE','x':-1005,'y':658,'source':'wand'},generated['evidence'])
            self.assertNotIn('BLACK_HOLE',first_shop)
            self.assertTrue(all(0<=p['y']<1536 for p in generated['evidence']))
            self.assertNotIn('ZETA',generated['ids'])
            deep=e.request(op='layer',seed=123,layer=0,scope='depth')
            self.assertIn('ZETA',deep['ids'])
            second=e.request(op='layer',seed=123,layer=1)
            self.assertTrue(all(1536<=p['y']<3072 for p in second['evidence']))
            good={'type':'layerSpells','val':{'layer':0,'scope':'main','mode':'all','ids':['BLACK_HOLE','CHAINSAW']}}
            self.assertEqual(e.search(123,124,good),[123])
            bad={'type':'layerSpells','val':{'layer':0,'mode':'all','ids':['BLACK_HOLE','ZETA']}}
            self.assertEqual(e.search(123,124,bad),[])
            any_rule={'type':'layerSpells','val':{'layer':0,'mode':'any','ids':['BLACK_HOLE','ZETA']}}
            self.assertEqual(e.search(123,124,any_rule),[123])

    def test_multiple_wand_templates(self):
        with Engine() as e:
            def make(mode):return {'type':'shop','val':[{'type':1,'wandMode':mode,'strict':True,'items':[{'wand':{'gun':{},'cards':['SLIMEBALL'],'cardsStrict':True}},{'wand':{'gun':{'mana_max':[999999,1000000]},'cards':[],'cardsStrict':True}}]}]}
            self.assertEqual(e.search(123,124,make('all')),[])
            self.assertEqual(e.search(123,124,make('any')),[123])

if __name__=='__main__':unittest.main()
