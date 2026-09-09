package com.holocard.scanner;

/** Adjacent strong observations only; weak, stale or conflicting frames reset the streak. */
public final class ScanConsensus {
    private String previous; private int count; private long last;
    public void reset(){previous=null;count=0;last=0;}
    public boolean observe(String number,long now) {
        if(number==null){reset();return false;}
        if(number.equals(previous)&&now-last<2500)count++;else count=1;
        previous=number;last=now;return count>=2;
    }
}
