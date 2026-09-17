import copy, hashlib, importlib.util, json, os, pathlib, unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('hbp09',ROOT/'scripts/merge-hbp09.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class Hbp09DatabaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=module.load(ROOT/'scripts/hbp09-official.json')
        cls.catalog=module.load(ROOT/'public/cards.json')
        cls.release=module.load(ROOT/'public/hbp09-cards.json')
        cls.cards={c['number']:c for c in cls.catalog['cards']}
        cls.delta={c['number']:c for c in cls.release['cards']}
        cls.names=module.load(ROOT/'scripts/name-zh.json')
        cls.art=module.load(ROOT/'scripts/hbp09-art-manifest.json')
    def test_01_all_numbered_cards_present(self):
        self.assertEqual({n for n in self.delta if n.startswith('hBP09-')},{f'hBP09-{i:03}' for i in range(1,112)})
    def test_02_complete_printings(self):
        variants=[v for c in self.release['cards'] for v in c['variants']]
        self.assertEqual(len(self.delta),131);self.assertEqual(len(variants),255)
        self.assertEqual(len({v['image'] for v in variants}),255)
        self.assertEqual(len({v['id'] for v in variants}),255)
    def test_03_complete_new_cheers(self):
        self.assertEqual({n for n in self.delta if n.startswith('hY')},{'hY01-015','hY02-013','hY03-017','hY04-014','hY05-012','hY06-012'})
    def test_04_reprints_have_original_identity(self):
        reprints=[n for n in self.delta if not n.startswith(('hBP09-','hY'))]
        self.assertEqual(len(reprints),14)
        for n in reprints:self.assertIn(module.SET,self.cards[n]['sets'])
    def test_05_preview_is_full_catalog_card(self):
        card=self.cards['hBP09-037']
        self.assertFalse(card.get('preview'));self.assertFalse(card.get('simOnly'))
        self.assertTrue(card['variants']);self.assertNotEqual(card['rarity'],'先行公開')
    def test_06_idempotence(self):
        again,report=module.merge(self.catalog,self.release)
        self.assertEqual(again,self.catalog);self.assertEqual(report['addedCards'],0);self.assertEqual(report['addedVariants'],0)
    def test_07_rejects_truncated_source(self):
        source=copy.deepcopy(self.source);source['printings'].pop()
        with self.assertRaises(ValueError):module.build_release(source,self.names,{})
    def test_08_rejects_duplicate_image_source(self):
        source=copy.deepcopy(self.source);source['printings'][-1]['image']=source['printings'][0]['image']
        with self.assertRaises(ValueError):module.build_release(source,self.names,{})
    def test_09_every_image_verified(self):
        self.assertEqual(len(self.art),255)
        for row in self.art:
            p=ROOT/'public'/row['path'].lstrip('/')
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),row['sha256'])
            self.assertGreaterEqual(row['width'],300);self.assertGreaterEqual(row['height'],400)
    def test_10_offline_conversion_has_no_remote_new_art(self):
        art={r['url']:r['path'] for r in self.art}
        offline,_=module.merge({'meta':{},'cards':[]},self.release,art)
        for c in offline['cards']:
            for obj in [c]+c['variants']:self.assertTrue(obj['image'].startswith('/card-art/'))
    def test_11_no_fabricated_release_or_translation(self):
        self.assertEqual(self.release['meta']['releaseDate'],'2026-09-19')
        for card in self.release['cards']:
            self.assertEqual(card['translationStatus'],'official-japanese-fallback')
            self.assertEqual(card['simulationStatus'],'not-audited')
    def test_12_required_stats_present(self):
        for c in self.release['cards']:
            if c['group']=='holomem':self.assertIsInstance(c['hp'],int);self.assertTrue(c['arts'])
            if c['group']=='oshi':self.assertIsInstance(c['life'],int);self.assertTrue(c['oshiSkill'])
            if c['group']=='support':self.assertTrue(c['abilityText'])
    def test_13_cost_fields_exist(self):
        for c in self.release['cards']:
            for key in ['oshiSkill','spOshiSkill']:
                if c.get(key):self.assertIn('holoPowerCost',c[key]);self.assertIn('Holo Power -',c[key]['timing'])
    def test_14_scanner_japanese_covers_every_new_card(self):
        jp=module.load(ROOT/'public/hbp09-scanner-ja.json')
        self.assertEqual(set(jp),set(self.delta))
        for row in jp.values():self.assertTrue(row['titles'])
    def test_15_all_previous_card_and_variant_ids_preserved(self):
        baseline=os.environ.get('HBP09_BASELINE')
        if not baseline:self.skipTest('Pass HBP09_BASELINE for exact previous release preservation check')
        old=module.load(baseline)
        for c in old['cards']:
            new=self.cards[c['number']];self.assertEqual(new['id'],c['id'])
            self.assertTrue({v['id'] for v in c.get('variants',[])}<={v['id'] for v in new.get('variants',[])})
            if c['number'] not in self.delta:self.assertEqual(new,c)
    def test_16_totals_are_computed(self):
        self.assertEqual(self.catalog['meta']['uniqueCards'],len(self.catalog['cards']))
        self.assertEqual(self.catalog['meta']['printings'],sum(len(c.get('variants',[])) for c in self.catalog['cards']))

if __name__=='__main__':unittest.main(verbosity=2)
