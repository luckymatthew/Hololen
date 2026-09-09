package com.holocard.scanner;

import org.junit.Test;
import static org.junit.Assert.*;

public class ScanGeometryTest {
    @Test public void guideLetsCardStayFartherAway(){
        double[] r=ScanGeometry.guide(400,500);
        assertEquals(63.0/88,r[2]/r[3],.00001);
        assertTrue(r[2]<=400*.62+.001);assertTrue(r[3]<=500*.72+.001);
        assertEquals(200,r[0]+r[2]/2,.0001);assertEquals(250,r[1]+r[3]/2,.0001);
    }
    @Test public void portraitCropContainsGuideWithMargin(){
        int[] crop=ScanGeometry.crop(1440,1920,400,500);
        double scale=500.0/1920;double[] guide=ScanGeometry.guide(400,500);
        assertTrue(crop[2]*scale>=guide[2]*1.29);assertTrue(crop[3]*scale>=guide[3]*1.29);
        assertEquals(720,crop[0]+crop[2]/2,1);assertEquals(960,crop[1]+crop[3]/2,1);
    }
    @Test public void letterboxedLandscapeCropStaysWithinFrame(){
        int[] crop=ScanGeometry.crop(1920,1440,800,240);
        assertTrue(crop[0]>=0&&crop[1]>=0);assertTrue(crop[0]+crop[2]<=1920);assertTrue(crop[1]+crop[3]<=1440);
        assertTrue(crop[2]>0&&crop[3]>0);
    }
    @Test public void missingPreviewSizeUsesFullFrame(){assertArrayEquals(new int[]{0,0,1440,1920},ScanGeometry.crop(1440,1920,0,0));}
    @Test public void hardwareZoomLimitIsRespected(){assertEquals(1,ScanGeometry.zoom(2,1,1),0);assertEquals(4,ScanGeometry.zoom(12,1,4),0);assertEquals(1,ScanGeometry.zoom(.5f,1,4),0);}
}
