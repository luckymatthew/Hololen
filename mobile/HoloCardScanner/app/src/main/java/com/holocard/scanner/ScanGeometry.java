package com.holocard.scanner;

/** Shared guide/crop math for a FIT_CENTER preview. Values are image pixels, not sensor focus distance. */
public final class ScanGeometry {
    private ScanGeometry(){}
    public static double[] guide(double width,double height){
        double h=Math.min(height*.72,width*.62*88/63),w=h*63/88;
        return new double[]{(width-w)/2,(height-h)/2,w,h};
    }
    public static int[] crop(int frameWidth,int frameHeight,int viewWidth,int viewHeight){
        if(viewWidth<=0||viewHeight<=0)return new int[]{0,0,frameWidth,frameHeight};
        double[] guide=guide(viewWidth,viewHeight);double scale=Math.min(viewWidth/(double)frameWidth,viewHeight/(double)frameHeight);
        int w=Math.min(frameWidth,Math.max(1,(int)Math.ceil(guide[2]*1.3/scale)));
        int h=Math.min(frameHeight,Math.max(1,(int)Math.ceil(guide[3]*1.3/scale)));
        return new int[]{(frameWidth-w)/2,(frameHeight-h)/2,w,h};
    }
    public static float zoom(float requested,float min,float max){return Math.max(min,Math.min(max,requested));}
}
