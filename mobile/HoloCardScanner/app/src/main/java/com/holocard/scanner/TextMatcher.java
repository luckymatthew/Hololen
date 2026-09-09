package com.holocard.scanner;

import org.json.*;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.*;

/** OCR is evidence. Names, HP or common effects alone must never auto-select a card. */
public final class TextMatcher {
    private static final Pattern CODE=Pattern.compile("h\\s*(?:bp|bd|sd|eb|pr|ys|y)\\s*\\d{0,2}\\s*[-‐‑–—ー]?\\s*\\d{3}(?!\\d)",Pattern.CASE_INSENSITIVE);
    private static final Pattern HP=Pattern.compile("hp\\s*[:：]?\\s*(\\d{2,3})",Pattern.CASE_INSENSITIVE);
    private static final Pattern STAGE=Pattern.compile("\\b(debut|1st|2nd|spot)\\b",Pattern.CASE_INSENSITIVE);
    private final List<Row> rows=new ArrayList<>();
    private final Map<String,Integer> frequency=new HashMap<>(), effectFrequency=new HashMap<>();
    private static class Row {
        CardStore.Card card; String number; Set<String> names=new HashSet<>(),titles=new HashSet<>(),effects=new HashSet<>();
    }
    public static final class Hit {
        public final String number;
        public double score;
        public boolean exactCode, strongText, conflict, strongVisual;
        public int inliers;
        public String evidence="";
        Hit(String n,double s) { number=n;score=s; }
    }
    public static final class Result {
        public final List<Hit> hits; public final String autoNumber;
        Result(List<Hit> h,String a) { hits=h;autoNumber=a; }
    }
    public TextMatcher(List<CardStore.Card> cards,JSONObject japanese) {
        for(CardStore.Card card:cards) {
            Row r=new Row();r.card=card;r.number=normalize(card.number);
            for(String name:new String[]{card.name,card.jpName,card.enName}) if(!name.isBlank())r.names.add(normalize(name));
            List<JSONObject> skills=new ArrayList<>();
            for(String key:new String[]{"keyword","stageSkill","oshiSkill","spOshiSkill"}) {JSONObject j=card.data.optJSONObject(key);if(j!=null)skills.add(j);}
            JSONArray arts=card.data.optJSONArray("arts");
            for(int i=0;arts!=null&&i<arts.length();i++)if(arts.optJSONObject(i)!=null)skills.add(arts.optJSONObject(i));
            for(JSONObject s:skills) { addTitle(r,s.optString("name"));r.effects.addAll(grams(normalize(s.optString("effect")),5)); }
            r.effects.addAll(grams(normalize(card.data.optString("abilityText")),5));
            JSONObject ja=japanese==null?null:japanese.optJSONObject(card.number);
            if(ja!=null) {
                JSONArray titles=ja.optJSONArray("titles"), effects=ja.optJSONArray("effects");
                for(int i=0;titles!=null&&i<titles.length();i++)addTitle(r,titles.optString(i));
                for(int i=0;effects!=null&&i<effects.length();i++)r.effects.addAll(grams(normalize(effects.optString(i)),5));
            }
            rows.add(r);
            for(String t:r.titles)frequency.merge(t,1,Integer::sum);
            for(String t:r.effects)effectFrequency.merge(t,1,Integer::sum);
        }
    }
    private static void addTitle(Row r,String s){String t=normalize(s);if(t.length()>=3)r.titles.add(t);}
    public static String normalize(String s) {
        String text=Normalizer.normalize(s==null?"":s,Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        StringBuilder b=new StringBuilder();
        text.codePoints().forEach(c->{if(c>=0x30a1&&c<=0x30f6)c-=0x60;if(Character.isLetterOrDigit(c))b.appendCodePoint(c);});
        return b.toString();
    }
    private static Set<String> grams(String s,int n){Set<String> g=new HashSet<>();for(int i=0;i<=s.length()-n;i++)g.add(s.substring(i,i+n));return g;}
    public Result match(String raw) {
        if(raw==null)raw=""; raw=Normalizer.normalize(raw.substring(0,Math.min(raw.length(),12000)),Normalizer.Form.NFKC);
        String text=normalize(raw);Set<String> codes=new HashSet<>();Matcher m=CODE.matcher(raw);while(m.find())codes.add(normalize(m.group()));
        m=HP.matcher(raw);int hp=m.find()?Integer.parseInt(m.group(1)):0;
        m=STAGE.matcher(raw);String stage=m.find()?m.group(1).toLowerCase(Locale.ROOT):"";
        Set<String> tg=grams(text,3),eg=grams(text,5);eg.retainAll(effectFrequency.keySet());
        List<Hit> hits=new ArrayList<>();
        for(Row r:rows) {
            Hit h=new Hit(r.card.number,0);h.exactCode=codes.contains(r.number);if(h.exactCode){h.score=200;h.evidence="卡號相符";}
            boolean name=r.names.stream().anyMatch(n->n.length()>=3&&text.contains(n));if(name){h.score+=25;if(h.evidence.isEmpty())h.evidence="卡名相符";}
            int titleScore=0;boolean unique=false;
            for(String title:r.titles) {
                if(text.contains(title)){boolean u=frequency.get(title)==1;unique|=u&&title.length()>=5;titleScore=Math.max(titleScore,u?65:40);}
                else if(title.length()>=6){Set<String> g=grams(title,3);long count=g.stream().filter(tg::contains).count();double overlap=count/(double)g.size();if(overlap>=.6)titleScore=Math.max(titleScore,(int)Math.round(overlap*35));}
            }
            if(titleScore>0){h.score+=titleScore;if(!h.exactCode)h.evidence="技能文字";}
            double weight=0;int overlap=0;
            for(String e:eg)if(r.effects.contains(e)){overlap++;weight+=Math.log(1+rows.size()/(double)effectFrequency.get(e));}
            if(overlap>=3&&weight>=8){h.score+=Math.min(45,Math.round(weight/3));if(h.evidence.isEmpty())h.evidence="效果片段";}
            if(h.score==0)continue;
            if(hp>0&&r.card.hp>0){h.score+=hp==r.card.hp?12:-20;h.conflict|=hp!=r.card.hp;}
            if(!stage.isEmpty()&&!r.card.stage.isEmpty()){h.score+=stage.equalsIgnoreCase(r.card.stage)?8:-15;h.conflict|=!stage.equalsIgnoreCase(r.card.stage);}
            h.strongText=unique&&name&&!h.conflict;
            if(h.score>0)hits.add(h);
        }
        hits.sort(Comparator.comparingDouble((Hit h)->h.score).reversed());
        String auto=null;
        if(!hits.isEmpty()) {
            Hit b=hits.get(0);double next=hits.size()>1?hits.get(1).score:0;
            if((b.exactCode&&codes.size()==1&&(hits.size()==1||!hits.get(1).exactCode))||(codes.isEmpty()&&b.strongText&&b.score>=90&&b.score-next>=30))auto=b.number;
        }
        return new Result(new ArrayList<>(hits.subList(0,Math.min(12,hits.size()))),auto);
    }
}
