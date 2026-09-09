package com.holocard.scanner;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import androidx.activity.*;
import androidx.activity.result.*;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.camera.core.*;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.core.view.*;
import androidx.exifinterface.media.ExifInterface;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;
import org.opencv.android.OpenCVLoader;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class ScannerActivity extends ComponentActivity {
    private final ExecutorService analysis=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean();
    private final AtomicInteger tasks=new AtomicInteger();
    private final AtomicBoolean cleaned=new AtomicBoolean();
    private final ScanConsensus consensus=new ScanConsensus();
    private volatile boolean alive=true,foreground=false,photoMode=false,ready=false;
    private final AtomicInteger generation=new AtomicInteger();
    private PreviewView preview;
    private TextView status,detail;
    private LinearLayout candidates;
    private ImageView photo;
    private CardStore store;
    private CardVision vision;
    private TextRecognizer ocr;
    private ProcessCameraProvider cameraProvider;
    private androidx.camera.core.Camera camera;
    private boolean torch=false;
    private TextView focusHint,zoomLabel;
    private SeekBar zoomSlider;
    private volatile int previewWidth,previewHeight;
    private float requestedZoom=2f;
    private long lastFocus;
    private Bitmap photoBitmap;
    private long lastUi;
    private final ActivityResultLauncher<String> permission=registerForActivityResult(new ActivityResultContracts.RequestPermission(),granted->{if(granted)startCamera();else status.setText("未允許鏡頭；仍可選擇相片辨識。");});
    private final ActivityResultLauncher<String> photoPicker=registerForActivityResult(new ActivityResultContracts.GetContent(),uri->{
        if(uri==null){photoMode=false;if(ready)startCamera();return;}
        int token=generation.incrementAndGet();photoMode=true;if(cameraProvider!=null)cameraProvider.unbindAll();consensus.reset();
        status.setText("正在讀取相片…");
        analysis.execute(()->{try{
            Bitmap bitmap=readPhoto(uri);if(!alive||token!=generation.get()){bitmap.recycle();return;}
            runOnUiThread(()->{if(!alive||token!=generation.get()){bitmap.recycle();return;}if(photoBitmap!=null)photoBitmap.recycle();photoBitmap=bitmap;photo.setImageBitmap(bitmap);photo.setVisibility(View.VISIBLE);});
            process(bitmap.copy(Bitmap.Config.ARGB_8888,false),token,true);
        }catch(Exception e){postStatus("無法讀取相片，請試另一張。",token);}});
    });

    @Override public void onCreate(Bundle state){
        super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        requestedZoom=getPreferences(MODE_PRIVATE).getFloat("scanZoom",2f);
        WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(13,20,18));
        ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{androidx.core.graphics.Insets i=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());view.setPadding(i.left,i.top,i.right,i.bottom);return insets;});setContentView(root);
        LinearLayout head=new LinearLayout(this);head.setGravity(Gravity.CENTER_VERTICAL);head.setPadding(dp(18),dp(10),dp(18),dp(10));
        TextView title=label("HOLO / SCAN",16,true);head.addView(title,new LinearLayout.LayoutParams(0,-2,1));Button close=button("完成");close.setOnClickListener(v->finish());head.addView(close);root.addView(head);
        FrameLayout cameraArea=new FrameLayout(this){
            float touchX=-1,touchY=-1;
            @Override public boolean onInterceptTouchEvent(MotionEvent event){return !photoMode;}
            @Override public boolean onTouchEvent(MotionEvent event){if(event.getAction()==MotionEvent.ACTION_UP){touchX=event.getX();touchY=event.getY();performClick();}return true;}
            @Override public boolean performClick(){super.performClick();focusAt(touchX<0?preview.getWidth()/2f:touchX,touchY<0?preview.getHeight()/2f:touchY);touchX=touchY=-1;return true;}
        };cameraArea.setClickable(true);root.addView(cameraArea,new LinearLayout.LayoutParams(-1,0,1));
        preview=new PreviewView(this);preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);preview.setScaleType(PreviewView.ScaleType.FIT_CENTER);cameraArea.addView(preview,new FrameLayout.LayoutParams(-1,-1));
        photo=new ImageView(this);photo.setScaleType(ImageView.ScaleType.FIT_CENTER);photo.setVisibility(View.GONE);cameraArea.addView(photo,new FrameLayout.LayoutParams(-1,-1));
        View guide=new View(this){final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);@Override protected void onDraw(Canvas canvas){if(photoMode)return;double[] r=ScanGeometry.guide(getWidth(),getHeight());paint.setColor(Color.rgb(185,243,107));paint.setStrokeWidth(dp(2));paint.setStyle(Paint.Style.STROKE);canvas.drawRoundRect((float)r[0],(float)r[1],(float)(r[0]+r[2]),(float)(r[1]+r[3]),dp(14),dp(14),paint);}};cameraArea.addView(guide,new FrameLayout.LayoutParams(-1,-1));
        preview.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{previewWidth=r-l;previewHeight=b-t;});
        cameraArea.setContentDescription("點按卡片位置對焦");
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(dp(18),dp(14),dp(18),dp(12));root.addView(panel);
        status=label("正在啟動內置辨識…",18,true);panel.addView(status);detail=label("相片不會上傳。對準一張卡，稍微轉動避開反光。",14,false);detail.setPadding(0,dp(7),0,dp(10));panel.addView(detail);
        focusHint=label("可拉遠手機，用 2× 取景；點按卡片對焦。",14,false);focusHint.setPadding(0,0,0,dp(6));panel.addView(focusHint);
        ScrollView scroll=new ScrollView(this);candidates=new LinearLayout(this);candidates.setOrientation(LinearLayout.VERTICAL);scroll.addView(candidates);panel.addView(scroll,new LinearLayout.LayoutParams(-1,dp(90)));
        LinearLayout actions=new LinearLayout(this);actions.setGravity(Gravity.CENTER);Button gallery=button("選擇相片"),live=button("鏡頭"),light=button("補光");
        for(Button b:List.of(gallery,live,light))actions.addView(b,new LinearLayout.LayoutParams(0,dp(48),1));panel.addView(actions);
        gallery.setOnClickListener(v->{generation.incrementAndGet();photoMode=true;consensus.reset();if(cameraProvider!=null)cameraProvider.unbindAll();photoPicker.launch("image/*");});
        live.setOnClickListener(v->{photoMode=false;photo.setVisibility(View.GONE);generation.incrementAndGet();consensus.reset();if(ready){if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)startCamera();else permission.launch(Manifest.permission.CAMERA);}});
        light.setOnClickListener(v->{if(camera!=null&&camera.getCameraInfo().hasFlashUnit()){torch=!torch;camera.getCameraControl().enableTorch(torch);light.setText(torch?"關補光":"補光");}else Toast.makeText(this,"此鏡頭沒有補光燈。",Toast.LENGTH_SHORT).show();});
        LinearLayout zoomRow=new LinearLayout(this);zoomRow.setGravity(Gravity.CENTER_VERTICAL);panel.addView(zoomRow);
        Button one=button("1×"),two=button("2×"),refocus=button("對焦");for(Button b:List.of(one,two,refocus))zoomRow.addView(b,new LinearLayout.LayoutParams(0,dp(44),1));
        zoomLabel=label("2.0×",14,true);zoomLabel.setPadding(dp(12),0,0,0);zoomRow.addView(zoomLabel);
        one.setOnClickListener(v->applyZoom(1));two.setOnClickListener(v->applyZoom(2));refocus.setOnClickListener(v->focusAt(preview.getWidth()/2f,preview.getHeight()/2f));
        zoomSlider=new SeekBar(this);zoomSlider.setMax(100);zoomSlider.setContentDescription("鏡頭變焦倍率");panel.addView(zoomSlider);zoomSlider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int progress,boolean user){if(user&&camera!=null){ZoomState z=camera.getCameraInfo().getZoomState().getValue();if(z!=null)applyZoom(1+(Math.min(4,z.getMaxZoomRatio())-1)*progress/100f);}}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}});
        analysis.execute(()->{
            try{store=new CardStore(getAssets());if(!OpenCVLoader.initLocal())throw new IOException("無法啟動圖像引擎");org.opencv.core.Core.setNumThreads(2);
                try{vision=new CardVision(getAssets());}catch(Exception ignored){}
                ocr=TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build());ready=true;
                runOnUiThread(()->{if(!alive)return;status.setText("對準卡片，即可開始");detail.setText(vision==null?"文字辨識模式。相片不會上傳。":"內置日文辨識 ＋ 卡圖核對 · 毋須下載語言資料");if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)startCamera();else permission.launch(Manifest.permission.CAMERA);});
            }catch(Exception e){runOnUiThread(()->{if(alive)status.setText("辨識引擎未能啟動，請返回卡庫搜尋。");});}
        });
    }
    private void startCamera(){
        if(!ready||!alive||!foreground||photoMode)return;
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){status.setText("請允許鏡頭，或選擇相片辨識。");return;}
        com.google.common.util.concurrent.ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(this);
        future.addListener(()->{if(!alive||!foreground||photoMode)return;try{
            cameraProvider=future.get();Preview p=new Preview.Builder().setTargetAspectRatio(AspectRatio.RATIO_4_3).build();p.setSurfaceProvider(preview.getSurfaceProvider());
            ImageAnalysis images=new ImageAnalysis.Builder().setTargetResolution(new android.util.Size(1920,1440)).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
            images.setAnalyzer(analysis,image->{
                if(!alive||!foreground||photoMode||!busy.compareAndSet(false,true)){image.close();return;}
                int token=generation.get();Bitmap bitmap=null;
                try{bitmap=prepareFrame(image);}
                catch(Exception e){busy.set(false);}finally{image.close();}
                if(bitmap!=null)process(bitmap,token,false);
            });
            UseCaseGroup.Builder group=new UseCaseGroup.Builder().addUseCase(p).addUseCase(images);ViewPort viewport=preview.getViewPort();if(viewport!=null)group.setViewPort(viewport);
            cameraProvider.unbindAll();camera=cameraProvider.bindToLifecycle(this,CameraSelector.DEFAULT_BACK_CAMERA,group.build());applyZoom(requestedZoom);if(camera.getCameraInfo().hasFlashUnit())camera.getCameraControl().enableTorch(torch);
            preview.postDelayed(()->{if(alive&&foreground&&!photoMode)focusAt(preview.getWidth()/2f,preview.getHeight()/2f);},600);
        }catch(Exception e){status.setText("無法開啟鏡頭，請改用相片或檢查鏡頭權限。");}},ContextCompat.getMainExecutor(this));
    }
    private Bitmap prepareFrame(ImageProxy image){
        Bitmap current=image.toBitmap();
        try{
            Rect visible=new Rect(image.getCropRect());if(!visible.intersect(0,0,current.getWidth(),current.getHeight()))visible.set(0,0,current.getWidth(),current.getHeight());
            if(!visible.isEmpty()&&(visible.width()!=current.getWidth()||visible.height()!=current.getHeight())){
                Bitmap trimmed=Bitmap.createBitmap(current,visible.left,visible.top,visible.width(),visible.height());if(trimmed!=current)current.recycle();current=trimmed;
            }
            int rotation=image.getImageInfo().getRotationDegrees();
            if(rotation!=0){Matrix matrix=new Matrix();matrix.postRotate(rotation);Bitmap rotated=Bitmap.createBitmap(current,0,0,current.getWidth(),current.getHeight(),matrix,true);if(rotated!=current)current.recycle();current=rotated;}
            int[] roi=ScanGeometry.crop(current.getWidth(),current.getHeight(),previewWidth,previewHeight);
            Bitmap focused=Bitmap.createBitmap(current,roi[0],roi[1],roi[2],roi[3]);if(focused!=current)current.recycle();return focused;
        }catch(RuntimeException error){current.recycle();throw error;}
    }
    private void applyZoom(float ratio){
        if(camera==null)return;ZoomState z=camera.getCameraInfo().getZoomState().getValue();if(z==null)return;
        requestedZoom=ScanGeometry.zoom(ratio,Math.max(1,z.getMinZoomRatio()),Math.min(4,z.getMaxZoomRatio()));
        camera.getCameraControl().setZoomRatio(requestedZoom);getPreferences(MODE_PRIVATE).edit().putFloat("scanZoom",requestedZoom).apply();
        zoomLabel.setText(String.format(Locale.ROOT,"%.1f×",requestedZoom));float span=Math.min(4,z.getMaxZoomRatio())-1;
        zoomSlider.setProgress(span>0?Math.round((requestedZoom-1)/span*100):0);generation.incrementAndGet();consensus.reset();
    }
    private void focusAt(float x,float y){
        if(camera==null||!foreground||photoMode||!alive||preview.getWidth()==0)return;
        lastFocus=SystemClock.elapsedRealtime();int token=generation.incrementAndGet();consensus.reset();focusHint.setText("正在對焦…可稍微拉遠手機，避開反光。");
        MeteringPoint point=preview.getMeteringPointFactory().createPoint(x,y,.18f);
        com.google.common.util.concurrent.ListenableFuture<FocusMeteringResult> focus=camera.getCameraControl().startFocusAndMetering(new FocusMeteringAction.Builder(point,FocusMeteringAction.FLAG_AF|FocusMeteringAction.FLAG_AE).setAutoCancelDuration(3,TimeUnit.SECONDS).build());
        focus.addListener(()->{if(!alive||token!=generation.get())return;try{focusHint.setText(focus.get().isFocusSuccessful()?"已對焦 · 保持距離，卡片放在框內即可。":"未能鎖定對焦 · 拉遠手機，再試 2×。 ");}catch(Exception ignored){focusHint.setText("可點按卡片再對焦，或改用相片。");}},ContextCompat.getMainExecutor(this));
    }
    private void process(Bitmap original,int token,boolean isPhoto){
        long start=SystemClock.elapsedRealtime();
        if(!alive||token!=generation.get()||!ready){original.recycle();busy.set(false);return;}
        CardVision.Prepared prepared;
        try{prepared=CardVision.prepare(original);}catch(Exception e){original.recycle();busy.set(false);postStatus("未能處理畫面，請重新對準卡片。",token);return;}original.recycle();
        if(!isPhoto&&prepared.sharpness<28){prepared.close();busy.set(false);consensus.reset();postStatus("畫面有啲模糊，請拉遠手機再對焦。",token);runOnUiThread(()->{if(alive&&token==generation.get()&&SystemClock.elapsedRealtime()-lastFocus>3500)focusAt(preview.getWidth()/2f,preview.getHeight()/2f);});return;}
        // High-quality geometric evidence takes the short path. Ambiguous images still use OCR.
        try {
            List<CardVision.VisualHit> fast=vision==null?List.of():vision.match(prepared.bitmap,List.of());
            if(!fast.isEmpty()) {
                CardVision.VisualHit best=fast.get(0);int next=fast.size()>1?fast.get(1).inliers:0;
                if(best.inliers>=35&&best.ratio>=.6&&best.coverage>=.18&&best.inliers-next>=15) {
                    TextMatcher.Result result=ScanFusion.combine(store.matcher.match(""),fast);
                    boolean auto=isPhoto||consensus.observe(result.autoNumber,SystemClock.elapsedRealtime());
                    long elapsed=SystemClock.elapsedRealtime()-start;
                    runOnUiThread(()->{if(alive&&token==generation.get()&&(isPhoto||foreground)){if(auto)pick(best.number);else showResults(result,elapsed,prepared.glare);}});
                    prepared.close();busy.set(false);return;
                }
            }
        } catch(Exception ignored) { /* OCR remains the independent fallback. */ }
        tasks.incrementAndGet();
        ocr.process(InputImage.fromBitmap(prepared.bitmap,0)).addOnSuccessListener(analysis,text->{
            try {
                if(!alive||token!=generation.get())return;
                TextMatcher.Result textResult=store.matcher.match(text.getText());
                List<CardVision.VisualHit> visual=vision==null?List.of():vision.match(prepared.bitmap,textResult.hits);
                TextMatcher.Result result=ScanFusion.combine(textResult,visual);
                boolean auto=isPhoto?result.autoNumber!=null:consensus.observe(result.autoNumber,SystemClock.elapsedRealtime());
                long elapsed=SystemClock.elapsedRealtime()-start;
                runOnUiThread(()->{if(alive&&token==generation.get()&&(isPhoto||foreground)){if(auto&&result.autoNumber!=null)pick(result.autoNumber);else showResults(result,elapsed,prepared.glare);}});
            }catch(Exception e){postStatus("辨識未完成，請再試一次。",token);}
        }).addOnFailureListener(analysis,error->{consensus.reset();postStatus("文字辨識未完成，請重新對準或選擇相片。",token);})
          .addOnCompleteListener(analysis,task->{prepared.close();busy.set(false);tasks.decrementAndGet();cleanupIfDone();});
    }
    private void showResults(TextMatcher.Result result,long elapsed,double glare){
        status.setText(result.hits.isEmpty()?(glare>.22?"反光較強，試下轉一轉張卡。":"未能確認，請保持距離、對焦或調整倍率。"):result.autoNumber!=null?"正在再次核對…":"請核對候選卡");
        detail.setText("本次分析 "+String.format(Locale.ROOT,"%.1f",elapsed/1000.0)+" 秒 · "+(vision==null?"文字辨識":"文字 ＋ 卡圖")+" · 不確定時請自行選卡");
        // Avoid replacing a candidate button while the user's finger is landing.
        long now=SystemClock.elapsedRealtime();if(now-lastUi<850&&!photoMode)return;lastUi=now;candidates.removeAllViews();
        for(TextMatcher.Hit hit:result.hits){CardStore.Card card=store.byNumber.get(hit.number);if(card==null)continue;Button button=button(card.name+"  "+card.number+"\n"+(card.stage.isEmpty()?card.type:card.stage)+(card.hp>0?" · HP "+card.hp:"")+" · "+hit.evidence);button.setTextSize(14);button.setGravity(Gravity.START|Gravity.CENTER_VERTICAL);button.setOnClickListener(v->pick(card.number));candidates.addView(button,new LinearLayout.LayoutParams(-1,dp(66)));}
    }
    private void pick(String number){if(!alive)return;alive=false;generation.incrementAndGet();if(cameraProvider!=null)cameraProvider.unbindAll();setResult(RESULT_OK,new Intent().putExtra("number",number));finish();}
    private void postStatus(String message,int token){runOnUiThread(()->{if(alive&&token==generation.get())status.setText(message);});}
    private Bitmap readPhoto(Uri uri)throws IOException {
        return ImageDecoder.decodeBitmap(ImageDecoder.createSource(getContentResolver(),uri),(decoder,info,source)->{int w=info.getSize().getWidth(),h=info.getSize().getHeight();double scale=Math.min(1,1600.0/Math.max(w,h));decoder.setTargetSize((int)(w*scale),(int)(h*scale));decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);});
    }
    private int dp(float value){return (int)(value*getResources().getDisplayMetrics().density+.5f);}
    private TextView label(String text,int size,boolean bold){TextView v=new TextView(this);v.setText(text);v.setTextSize(size);v.setTextColor(Color.rgb(236,244,235));if(bold)v.setTypeface(null,Typeface.BOLD);return v;}
    private Button button(String text){Button b=new Button(this);b.setText(text);b.setTextSize(14);b.setAllCaps(false);b.setTextColor(Color.rgb(224,242,212));GradientDrawable bg=new GradientDrawable();bg.setColor(Color.rgb(28,40,33));bg.setCornerRadius(dp(12));bg.setStroke(dp(1),Color.rgb(57,77,62));b.setBackground(bg);b.setPadding(dp(12),dp(6),dp(12),dp(6));return b;}
    @Override protected void onResume(){super.onResume();foreground=true;if(ready&&!photoMode)startCamera();}
    @Override protected void onPause(){foreground=false;generation.incrementAndGet();consensus.reset();if(cameraProvider!=null)cameraProvider.unbindAll();super.onPause();}
    @Override protected void onDestroy(){alive=false;generation.incrementAndGet();if(cameraProvider!=null)cameraProvider.unbindAll();
        // ML Kit completion owns its bitmap; defer closing native state until prior callbacks finish.
        if(!analysis.isShutdown())try{analysis.execute(this::cleanupIfDone);}catch(RejectedExecutionException ignored){}
        if(photoBitmap!=null){photo.setImageDrawable(null);photoBitmap.recycle();}super.onDestroy();
    }
    private void cleanupIfDone(){if(!alive&&tasks.get()==0&&cleaned.compareAndSet(false,true)){if(ocr!=null)ocr.close();if(vision!=null)vision.close();analysis.shutdown();}}
}
