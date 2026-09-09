package com.holocard.scanner;

import android.content.Context;
import android.graphics.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.opencv.android.OpenCVLoader;
import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

/** Run with radios disabled. Optional private photo fixtures are NOT shipped in the app. */
@RunWith(AndroidJUnit4.class)
public class NativeRegressionTest {
    @Test public void bundledDataAndNativeLibrariesLoadOffline() throws Exception {
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        CardStore store=new CardStore(c.getAssets());assertTrue(store.byNumber.size()>1200);
        assertNotNull(store.byNumber.get("hBP01-060"));assertTrue(OpenCVLoader.initLocal());
        try(CardVision vision=new CardVision(c.getAssets())){
            Bitmap blank=Bitmap.createBitmap(720,1000,Bitmap.Config.ARGB_8888);blank.eraseColor(Color.WHITE);
            assertTrue(vision.match(blank,List.of()).isEmpty());blank.recycle();
        }
    }

    @Test public void bundledJapaneseModelRunsOffline() throws Exception {
        Bitmap text=Bitmap.createBitmap(1000,450,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(text);canvas.drawColor(Color.WHITE);
        Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setColor(Color.BLACK);p.setTextSize(72);
        canvas.drawText("hBP01-060",50,130,p);canvas.drawText("鷹嶺ルイ",50,260,p);
        TextRecognizer ocr=TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());
        try {String recognized=Tasks.await(ocr.process(InputImage.fromBitmap(text,0)),45,TimeUnit.SECONDS).getText();assertTrue(recognized,recognized.contains("060"));}
        finally {ocr.close();text.recycle();}
    }

    @Test public void suppliedPhotosHaveNoWrongAutomaticChoice() throws Exception {
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext(),fixtures=InstrumentationRegistry.getInstrumentation().getContext();
        List<String> names=Arrays.asList(fixtures.getAssets().list("photos"));Assume.assumeTrue("Private fixtures not provided",names.size()==10);
        String[] photos={"01-7340.jpg","02-7341.jpg","03-7342.jpg","04-7344.jpg","05-7345.jpg","06-7343.jpg","07-7346.jpg","08-7347.jpg","09-7348.jpg","10-7349.jpg"};
        String[] expected={"hBP01-060","hBP01-061","hSD01-018","hBP04-105","hEB01-019","hBP07-094","hSD01-016","hEB01-024","hBP01-104","hEB01-023"};
        assertTrue(OpenCVLoader.initLocal());CardStore store=new CardStore(c.getAssets());JSONArray results=new JSONArray();int wrong=0;
        TextRecognizer ocr=TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());
        try(CardVision vision=new CardVision(c.getAssets())){
            for(int i=0;i<photos.length;i++){
                Bitmap original;try(InputStream in=fixtures.getAssets().open("photos/"+photos[i])){original=BitmapFactory.decodeStream(in);}
                long start=android.os.SystemClock.elapsedRealtime();
                try(CardVision.Prepared prepared=CardVision.prepare(original)){
                    String text=Tasks.await(ocr.process(InputImage.fromBitmap(prepared.bitmap,0)),45,TimeUnit.SECONDS).getText();
                    TextMatcher.Result tr=store.matcher.match(text);List<CardVision.VisualHit> visual=vision.match(prepared.bitmap,tr.hits);TextMatcher.Result result=ScanFusion.combine(tr,visual);
                    if(result.autoNumber!=null&&!result.autoNumber.equals(expected[i]))wrong++;
                    boolean candidate=false;for(TextMatcher.Hit hit:result.hits)if(hit.number.equals(expected[i]))candidate=true;
                    results.put(new JSONObject().put("photo",photos[i]).put("expected",expected[i]).put("automatic",result.autoNumber==null?JSONObject.NULL:result.autoNumber).put("candidateCorrect",candidate).put("emulatorMilliseconds",android.os.SystemClock.elapsedRealtime()-start));
                }finally{original.recycle();}
            }
        }finally{ocr.close();try(FileOutputStream out=c.openFileOutput("photo-regression.json",Context.MODE_PRIVATE)){out.write(results.toString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8));}}
        assertEquals("No incorrect automatic identifications",0,wrong);
    }
}
