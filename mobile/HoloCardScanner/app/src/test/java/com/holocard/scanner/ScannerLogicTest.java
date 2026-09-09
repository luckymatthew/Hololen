package com.holocard.scanner;

import org.junit.*;
import org.json.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

public class ScannerLogicTest {
    private static CardStore store;
    @BeforeClass public static void load()throws Exception{
        store=new CardStore(new JSONObject(new String(Files.readAllBytes(Paths.get("src/main/assets/cards.json")),java.nio.charset.StandardCharsets.UTF_8)),new JSONObject(new String(Files.readAllBytes(Paths.get("src/main/assets/scanner-ja.json")),java.nio.charset.StandardCharsets.UTF_8)));
    }
    @Test public void cardSnapshotPresent(){assertTrue(store.cards.size()>1200);assertNotNull(store.byNumber.get("hEB01-023"));assertNotNull(store.byNumber.get("hEB01-024"));}
    @Test public void normalizesJapaneseAndFullwidth(){assertEquals(TextMatcher.normalize("ホロライブ １２３"),TextMatcher.normalize("ほろらいぶ123"));}
    @Test public void unknownTextDoesNotAutoSelect(){assertNull(store.matcher.match("water bottle XYZ").autoNumber);}
    @Test public void exactNumberIdentifiesCard(){assertEquals("hBP01-060",store.matcher.match("SR hBP01-060").autoNumber);}
    @Test public void whitespaceNumberAccepted(){assertEquals("hBP01-060",store.matcher.match("h BP 01 - 060").autoNumber);}
    @Test public void twoNumbersNeverAutoSelect(){assertNull(store.matcher.match("hBP01-060 hBP01-061").autoNumber);}
    @Test public void nameHpStageNotSufficient(){assertNull(store.matcher.match("博衣こより 2nd HP200").autoNumber);}
    @Test public void commonEffectNeverAutoSelect(){assertNull(store.matcher.match("自分のデッキを3枚引く。").autoNumber);}
    @Test public void uniqueLuiSkillAndName(){assertEquals("hBP01-060",store.matcher.match("鷹嶺ルイ 本当にみんなのおかげ！！ 1st HP100").autoNumber);}
    @Test public void conflictingHpBlocksTextOnlyAuto(){assertNull(store.matcher.match("鷹嶺ルイ 本当にみんなのおかげ！！ HP190").autoNumber);}
    @Test public void consensusRequiresConsecutiveObservations(){ScanConsensus c=new ScanConsensus();assertFalse(c.observe("A",1000));assertTrue(c.observe("A",1400));c.reset();assertFalse(c.observe("A",1500));assertFalse(c.observe("B",1700));assertTrue(c.observe("B",1800));}
    @Test public void weakAndStaleFramesResetConsensus(){ScanConsensus c=new ScanConsensus();c.observe("A",1000);assertFalse(c.observe(null,1200));assertFalse(c.observe("A",1300));assertFalse(c.observe("A",5000));}
    @Test public void disagreementRequiresUserSelection(){TextMatcher.Result t=store.matcher.match("hBP01-060");assertNull(ScanFusion.combine(t,List.of(new CardVision.VisualHit("hBP01-061",40,.8,.4))).autoNumber);}
    @Test public void geometryCanIdentifyWithoutText(){assertEquals("hBP01-060",ScanFusion.combine(store.matcher.match(""),List.of(new CardVision.VisualHit("hBP01-060",30,.8,.3))).autoNumber);}
    @Test public void closeVisualCandidatesRequireSelection(){assertNull(ScanFusion.combine(store.matcher.match(""),List.of(new CardVision.VisualHit("hBP01-060",30,.8,.3),new CardVision.VisualHit("hBP01-061",28,.8,.3))).autoNumber);}
}
