package com.holocard.scanner;

import android.content.res.AssetManager;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** The same offline translation snapshot as the website. One result per rules card, not foil rarity. */
public final class CardStore {
    public static final class Card {
        public final String number, name, jpName, enName, stage, type;
        public final int hp;
        public final JSONObject data;
        Card(JSONObject j) {
            data=j; number=j.optString("number"); name=j.optString("name");
            jpName=j.optString("jpName"); enName=j.optString("enName");
            stage=j.optString("stage", ""); type=j.optString("type"); hp=j.optInt("hp",0);
        }
        public String summary() { return number+"  ·  "+(stage.isEmpty()?type:stage)+(hp>0?"  ·  HP "+hp:""); }
    }
    public final List<Card> cards = new ArrayList<>();
    public final Map<String,Card> byNumber = new LinkedHashMap<>();
    public final TextMatcher matcher;
    public final String snapshot;

    public CardStore(AssetManager assets) throws Exception {
        this(new JSONObject(read(assets.open("cards.json"))), new JSONObject(read(assets.open("scanner-ja.json"))));
    }
    public CardStore(JSONObject root, JSONObject japanese) {
        JSONArray array=root.optJSONArray("cards");
        for(int i=0;array!=null&&i<array.length();i++) {
            JSONObject j=array.optJSONObject(i); if(j==null||j.optBoolean("simOnly")) continue;
            Card card=new Card(j); cards.add(card); byNumber.put(card.number,card);
        }
        snapshot=root.optJSONObject("meta")==null?"":root.optJSONObject("meta").optString("snapshotDate");
        matcher=new TextMatcher(cards,japanese.optJSONObject("cards"));
    }
    static String read(InputStream stream) throws IOException {
        try(InputStream in=stream; ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] b=new byte[8192]; int n; while((n=in.read(b))!=-1) out.write(b,0,n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
    public List<Card> search(String query) {
        String q=TextMatcher.normalize(query); List<Card> found=new ArrayList<>();
        for(Card c:cards) {
            if(q.isEmpty()||TextMatcher.normalize(c.number+" "+c.name+" "+c.jpName+" "+c.enName).contains(q)) found.add(c);
            if(found.size()>=60) break;
        }
        return found;
    }
}
