package com.holocard.scanner;

import android.annotation.SuppressLint;
import android.content.*;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.webkit.*;
import android.widget.*;
import androidx.activity.*;
import androidx.activity.result.*;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.*;
import androidx.webkit.WebViewAssetLoader;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Packaged, offline client; only the existing account/deck API uses the live website. */
public class MainActivity extends ComponentActivity {
    private static final String HOST="hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site";
    private static final String ORIGIN="https://"+HOST;
    private WebView web;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private String exportData;
    private volatile boolean exporting=false;
    private volatile Map<String,String> artMap=Map.of();
    private OriginalArtStore originalArt;
    private final ActivityResultLauncher<Intent> scanner=registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result->{
        JSONObject data=new JSONObject();
        try {if(result.getResultCode()==RESULT_OK&&result.getData()!=null)data.put("number",result.getData().getStringExtra("number"));}catch(JSONException ignored){}
        emit("native-scan",data);
    });
    private final ActivityResultLauncher<String> exportFile=registerForActivityResult(new ActivityResultContracts.CreateDocument("application/json"),uri->{
        String data=exportData;exportData=null;
        if(uri==null||data==null){exporting=false;emitFlag("native-export",false);return;}
        io.execute(()->{boolean ok=false;try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out!=null){out.write(data.getBytes(StandardCharsets.UTF_8));ok=true;}}catch(Exception ignored){}exporting=false;boolean saved=ok;runOnUiThread(()->emitFlag("native-export",saved));});
    });
    private final ActivityResultLauncher<String[]> importFile=registerForActivityResult(new ActivityResultContracts.OpenDocument(),uri->{
        if(uri==null)return;
        io.execute(()->{JSONObject result=new JSONObject();try(InputStream in=getContentResolver().openInputStream(uri)){
            if(in==null)throw new IOException();byte[] bytes=in.readNBytes(2_000_001);if(bytes.length>2_000_000)throw new IOException("檔案太大，請選擇 2 MB 以內的牌組 JSON。");
            String name="匯入牌組.json";try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor!=null&&cursor.moveToFirst())name=cursor.getString(0);}
            result.put("name",name);result.put("json",new String(bytes,StandardCharsets.UTF_8));
        }catch(Exception e){try{result.put("error",e.getMessage()==null?"無法讀取牌組檔案。":e.getMessage());}catch(JSONException ignored){}}
            runOnUiThread(()->emit("native-import",result));
        });
    });

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(13,20,18));setContentView(root);
        WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        ViewCompat.setOnApplyWindowInsetsListener(root,(view,insets)->{androidx.core.graphics.Insets i=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout()|WindowInsetsCompat.Type.ime());view.setPadding(i.left,i.top,i.right,i.bottom);return insets;});
        web=new WebView(this);root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        originalArt=new OriginalArtStore(this);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);settings.setMediaPlaybackRequiresUserGesture(true);
        web.setBackgroundColor(Color.rgb(13,20,18));web.addJavascriptInterface(new NativeBridge(),"HoloNative");
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        WebViewAssetLoader assets=new WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/app/",path->asset("app/"+path)).build();
        try {JSONObject j=new JSONObject(CardStore.read(getAssets().open("art-map.json")));Map<String,String> map=new HashMap<>();for(Iterator<String> it=j.keys();it.hasNext();){String key=it.next();map.put(key,j.getString(key));}artMap=map;}catch(Exception ignored){}
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();String path=uri.getPath()==null?"":uri.getPath();
                if("https".equals(uri.getScheme())&&HOST.equals(uri.getHost())) {
                    WebResourceResponse local=assets.shouldInterceptRequest(uri);if(local!=null)return local;
                    if(path.equals("/")||path.equals("/account"))return asset("app/index.html");
                    if(Set.of("/cards.json","/holosim-card-index.json","/scanner-ja.json","/art-map.json").contains(path))return asset(path.substring(1));
                    if(path.matches("/card-art/[a-f0-9]{20}\\.webp"))return asset(path.substring(1));
                    if(path.matches("/api/auth/(session|login|register|logout)")||path.matches("/api/decks(?:/[A-Za-z0-9_-]{1,100})?"))return null;
                }
                if("https".equals(uri.getScheme())&&"hololive-official-cardgame.com".equals(uri.getHost())&&path.startsWith("/wp-content/images/cardlist/")){
                    WebResourceResponse full=originalArt.open(uri.toString());if(full!=null)return full;
                    String cached=artMap.get(uri.toString());if(cached!=null)return asset(cached.substring(1));return blocked();
                }
                return blocked();
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();if(!request.isForMainFrame())return true;
                if("https".equals(uri.getScheme())&&HOST.equals(uri.getHost())) {
                    String path=uri.getPath();
                    if("/app/index.html".equals(path)||"/".equals(path)||"/account".equals(path)){
                        String query=uri.getEncodedQuery()==null?"":"?"+uri.getEncodedQuery();
                        String hash="/account".equals(path)?"#account":uri.getEncodedFragment()==null?"":"#"+uri.getEncodedFragment();
                        view.loadUrl(ORIGIN+"/app/index.html"+query+hash);return true;
                    }
                    return true;
                }
                openExternal(uri.toString());return true;
            }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result){new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("知道了",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result){new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("確認",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
        });
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){@Override public void handleOnBackPressed(){web.evaluateJavascript("window.__holoBack ? window.__holoBack() : false",value->{if(!"true".equals(value))finish();});}});
        web.loadUrl(ORIGIN+"/app/index.html");
    }
    private WebResourceResponse asset(String name){
        if(name.contains(".."))return blocked();
        String mime=name.endsWith(".js")?"text/javascript":name.endsWith(".css")?"text/css":name.endsWith(".json")?"application/json":name.endsWith(".webp")?"image/webp":"text/html";
        try{return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}catch(IOException e){return blocked();}
    }
    private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Map.of(),new ByteArrayInputStream(new byte[0]));}
    private void emitFlag(String name,boolean ok){try{emit(name,new JSONObject().put("ok",ok));}catch(JSONException ignored){}}
    private void emit(String name,JSONObject data){if(web!=null)web.evaluateJavascript("window.dispatchEvent(new CustomEvent("+JSONObject.quote(name)+",{detail:"+data+"}));",null);}
    private void openExternal(String url){
        Uri uri=Uri.parse(url);if(!"https".equals(uri.getScheme())||!"hololive-official-cardgame.com".equals(uri.getHost()))return;
        try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(ActivityNotFoundException e){Toast.makeText(this,"找不到可開啟連結的瀏覽器。",Toast.LENGTH_SHORT).show();}
    }
    public final class NativeBridge {
        @JavascriptInterface public void startScanner(){runOnUiThread(()->scanner.launch(new Intent(MainActivity.this,ScannerActivity.class)));}
        @JavascriptInterface public void importJson(){runOnUiThread(()->importFile.launch(new String[]{"application/json","text/plain","application/octet-stream"}));}
        @JavascriptInterface public void exportJson(String name,String json){
            if(json==null||json.length()>2_000_000||exporting)return;
            try{new JSONObject(json);}catch(JSONException e){return;}
            exporting=true;exportData=json;
            String safe=(name==null?"holodeck.json":name).replaceAll("[^\\p{L}\\p{N} ._-]","_");
            if(safe.length()>120)safe=safe.substring(0,120);if(!safe.endsWith(".json"))safe+=".json";
            String filename=safe;runOnUiThread(()->exportFile.launch(filename));
        }
        @JavascriptInterface public void openExternal(String url){runOnUiThread(()->MainActivity.this.openExternal(url));}
    }
    @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("HoloNative");web.destroy();web=null;}io.shutdown();super.onDestroy();}
}
