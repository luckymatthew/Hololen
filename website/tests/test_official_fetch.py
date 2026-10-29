"""Regression tests for lossless official card evidence extraction (no network)."""
import importlib.util
import pathlib
import tempfile
import unittest
from unittest import mock

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "fetch-official-audit.py"
SPEC = importlib.util.spec_from_file_location("official_fetch", SCRIPT)
FETCH = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(FETCH)

ROW = '''<ul><li><a href="/cardlist/?id=3043&amp;view=text">
<div class="img"><img src="/wp-content/images/cardlist/hSD21/hSD21-001_OSR.png"></div>
<p class="number">hSD21-001</p><p class="name">熱千めら</p>
<dl><dt>色</dt><dd><img src="/wp-content/images/texticon/type_purple.png" alt="紫" /></dd>
<dt>収録商品</dt><dd>First<br />Second</dd></dl>
<div class="stage skill"><p>推しステージスキル</p><p><span>Stage name</span>Stage effect.</p></div>
<div class="sp arts"><p>アーツ</p><p><span><img src="/wp-content/images/texticon/arts_null.png" alt="◇" />Arts name 20<span class="tokkou"><img src="/wp-content/images/texticon/type_red.png" alt="赤" />+50</span></span>Arts effect.</p></div>
</a></li></ul>'''


class EvidenceExtractorTests(unittest.TestCase):
    def test_image_and_stable_official_id(self):
        row = FETCH.extract(ROW, "list")[0]
        self.assertEqual(row["officialId"], "3043")
        self.assertEqual(row["imageUrl"], "https://hololive-official-cardgame.com/wp-content/images/cardlist/hSD21/hSD21-001_OSR.png")
        self.assertEqual(row["sourceUrl"], "https://hololive-official-cardgame.com/cardlist/?id=3043&view=text")

    def test_preserves_string_info_and_structured_icons(self):
        row = FETCH.extract(ROW, "list")[0]
        self.assertEqual(row["info"]["色"], "紫")
        self.assertEqual(row["info"]["収録商品"], "First\nSecond")
        self.assertEqual(row["infoDetails"]["色"]["images"][0]["alt"], "紫")

    def test_stage_skill_is_not_lost_or_misclassified(self):
        fields = FETCH.extract(ROW, "list")[0]["fields"]
        self.assertEqual(fields[0]["class"], "stage skill")
        self.assertEqual(fields[0]["heading"], "Stage name")
        self.assertEqual(fields[0]["effect"], "Stage effect.")

    def test_arts_cost_and_special_bonus_html_survives(self):
        arts = FETCH.extract(ROW, "list")[0]["fields"][1]
        self.assertEqual([image["alt"] for image in arts["headingImages"]], ["◇", "赤"])
        self.assertIn('class="tokkou"', arts["headingHtml"])
        self.assertEqual(arts["effect"], "Arts effect.")
        self.assertIn("+50", arts["html"])

    def test_products_require_parseable_release_date(self):
        html = '''<a class="anchor" href="/cardlist/cardsearch/?expansion=hSD21"><div class="name">Deck</div><dl><dd>2026年10月30日(金)</dd></dl></a><a class="anchor" href="/cardlist/cardsearch/?expansion=future"><div class="name">Future</div><dl><dd>Coming soon</dd></dl></a>'''
        products = FETCH.extract_products(html, "official-index")
        self.assertEqual(products["Deck"]["releaseDate"], "2026-10-30")
        self.assertEqual(products["Deck"]["sourceUrl"], "official-index")
        self.assertNotIn("Future", products)

    def test_detail_rejects_wrong_image(self):
        row = FETCH.extract(ROW, "list")[0]
        with self.assertRaisesRegex(ValueError, "image does not match"):
            FETCH.extract_detail('<div class="cardlist-Detail_Box"><img src="/wp-content/images/cardlist/wrong.png"></div>', row)

    def test_detail_rejects_wrong_number(self):
        row = FETCH.extract(ROW, "list")[0]
        html = f'<div class="cardlist-Detail_Box"><img src="{row["imageUrl"]}"><p class="number">Wrong</p></div>'
        with self.assertRaisesRegex(ValueError, "number does not match"):
            FETCH.extract_detail(html, row)


    def test_snapshot_rejects_missing_rows(self):
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            FETCH.validate_snapshot({"pages": 2, "successfulPages": 2, "totalResults": 3, "errors": [], "printings": []})

    def test_snapshot_rejects_duplicate_official_ids(self):
        row = FETCH.extract(ROW, "list")[0]
        with self.assertRaisesRegex(ValueError, "duplicate official IDs"):
            FETCH.validate_snapshot({"pages": 1, "successfulPages": 1, "totalResults": 2, "errors": [], "printings": [row, row]})

    def test_snapshot_rejects_missing_numbered_card_image(self):
        row = FETCH.extract(ROW, "list")[0]
        row["imageUrl"] = ""
        with self.assertRaisesRegex(ValueError, "Missing official card image"):
            FETCH.validate_snapshot({"pages": 1, "successfulPages": 1, "totalResults": 1, "errors": [], "printings": [row]})


    def test_default_fetch_is_fresh_even_when_raw_file_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / "001.html"
            file.write_bytes(b"old evidence")
            response = mock.MagicMock()
            response.__enter__.return_value = response
            response.read.return_value = b"fresh evidence"
            response.headers = {"Date": "Thu, 29 Oct 2026 01:00:00 GMT"}
            with mock.patch.object(FETCH.urllib.request, "urlopen", return_value=response) as network:
                data, evidence = FETCH.fetch_file("https://hololive-official-cardgame.com/list", file)
            network.assert_called_once()
            self.assertEqual(data, b"fresh evidence")
            self.assertEqual(file.read_bytes(), b"fresh evidence")
            self.assertFalse(evidence["reusedCache"])
            self.assertIsNotNone(evidence["sourceFetchedAt"])
            self.assertEqual(evidence["sourceTimeBasis"], "recorded-network-fetch")

    def test_explicit_resume_does_not_rename_legacy_cache_time_as_fresh(self):
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / "001.html"
            file.write_bytes(b"old evidence")
            with mock.patch.object(FETCH.urllib.request, "urlopen") as network:
                data, evidence = FETCH.fetch_file("https://hololive-official-cardgame.com/list", file, resume=True)
            network.assert_not_called()
            self.assertEqual(data, b"old evidence")
            self.assertTrue(evidence["reusedCache"])
            self.assertIsNone(evidence["sourceFetchedAt"])
            self.assertEqual(evidence["sourceTimeBasis"], "unknown-legacy-cache")

    def test_resume_preserves_recorded_original_network_fetch_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / "001.html"
            response = mock.MagicMock()
            response.__enter__.return_value = response
            response.read.return_value = b"fresh evidence"
            response.headers = {}
            with mock.patch.object(FETCH.urllib.request, "urlopen", return_value=response):
                _, original = FETCH.fetch_file("https://hololive-official-cardgame.com/list", file)
            with mock.patch.object(FETCH.urllib.request, "urlopen") as network:
                _, resumed = FETCH.fetch_file("https://hololive-official-cardgame.com/list", file, resume=True)
            network.assert_not_called()
            self.assertEqual(resumed["sourceFetchedAt"], original["sourceFetchedAt"])
            self.assertTrue(resumed["reusedCache"])
            self.assertEqual(resumed["sourceTimeBasis"], "recorded-network-fetch")


if __name__ == "__main__":
    unittest.main()
