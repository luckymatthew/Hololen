package com.holocard.scanner;
import java.util.*;

public final class ScanFusion {
    public static TextMatcher.Result combine(TextMatcher.Result text,List<CardVision.VisualHit> visuals){
        Map<String,TextMatcher.Hit> hits=new LinkedHashMap<>();for(TextMatcher.Hit h:text.hits)hits.put(h.number,h);
        for(CardVision.VisualHit v:visuals){TextMatcher.Hit h=hits.computeIfAbsent(v.number,n->new TextMatcher.Hit(n,0));h.inliers=v.inliers;h.strongVisual=v.strong();h.score+=Math.min(160,50+v.inliers*3);h.evidence=h.evidence.isEmpty()?"卡圖幾何相符":h.evidence+" ＋ 卡圖";}
        List<TextMatcher.Hit> ranked=new ArrayList<>(hits.values());ranked.sort(Comparator.comparingDouble((TextMatcher.Hit h)->h.score).reversed());String auto=text.autoNumber;
        if(!visuals.isEmpty()){
            CardVision.VisualHit best=visuals.get(0);int next=visuals.size()>1?visuals.get(1).inliers:0;
            String imageAuto=best.strong()&&best.inliers-next>=7?best.number:null;
            if(auto!=null&&imageAuto!=null&&!auto.equals(imageAuto))auto=null;
            else if(auto==null&&imageAuto!=null){
                boolean conflictingCode=text.hits.stream().anyMatch(h->h.exactCode&&!h.number.equals(imageAuto));
                if(!conflictingCode)auto=imageAuto;
            }
        }
        return new TextMatcher.Result(ranked.subList(0,Math.min(5,ranked.size())),auto);
    }
}
