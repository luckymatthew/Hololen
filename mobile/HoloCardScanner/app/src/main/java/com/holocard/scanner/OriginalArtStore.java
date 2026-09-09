package com.holocard.scanner;

import android.content.Context;
import android.graphics.BitmapFactory;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded cache of the original, unmodified official artwork. Thumbnails are a fallback only. */
final class OriginalArtStore {
    private static final int MAX_IMAGE=8*1024*1024;
    private static final long MAX_CACHE=160L*1024*1024;
    private final File directory;
    private final ConnectivityManager connectivity;
    private final Map<String,Object> locks=new ConcurrentHashMap<>();
    OriginalArtStore(Context context){directory=new File(context.getCacheDir(),"original-card-art-v1");directory.mkdirs();connectivity=context.getSystemService(ConnectivityManager.class);}

    static boolean allowed(String raw){
        try {
            URI u=new URI(raw);
            return "https".equals(u.getScheme())&&"hololive-official-cardgame.com".equals(u.getHost())
                &&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)
                &&u.getPath()!=null&&u.getPath().startsWith("/wp-content/images/cardlist/")
                &&!u.getPath().contains("..")&&u.getFragment()==null;
        }catch(Exception e){return false;}
    }
    WebResourceResponse open(String url){
        if(!allowed(url))return null;
        synchronized(locks.computeIfAbsent(url,key->new Object())) {
            try {
                File file=new File(directory,key(url));
                byte[] bytes=null;
                if(file.isFile()&&file.length()<=MAX_IMAGE){
                    try(InputStream in=new FileInputStream(file)){bytes=in.readNBytes(MAX_IMAGE+1);}
                    if(mime(bytes)!=null)file.setLastModified(System.currentTimeMillis());else bytes=null;
                }
                if(bytes==null){
                    NetworkCapabilities network=connectivity==null?null:connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
                    if(network==null||!network.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))return null;
                    bytes=download(url);
                    if(bytes==null||mime(bytes)==null)return null;
                    File temp=File.createTempFile("art-",".part",directory);
                    try{try(OutputStream out=new FileOutputStream(temp)){out.write(bytes);}if(!temp.renameTo(file))temp.delete();}
                    finally{temp.delete();}
                    trim();
                }
                return new WebResourceResponse(mime(bytes),null,200,"OK",Map.of("Cache-Control","private, max-age=31536000"),new ByteArrayInputStream(bytes));
            }catch(Exception e){return null;}
        }
    }
    private byte[] download(String url)throws IOException {
        // Follow only official artwork redirects, never an arbitrary remote target.
        for(int redirect=0;redirect<4;redirect++){
            if(!allowed(url))return null;
            HttpURLConnection connection=(HttpURLConnection)new URL(url).openConnection();
            connection.setConnectTimeout(6000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept","image/avif,image/webp,image/png,image/jpeg,image/*");
            try {
                int code=connection.getResponseCode();
                if(code>=300&&code<400){String location=connection.getHeaderField("Location");if(location==null)return null;url=new URL(new URL(url),location).toString();continue;}
                if(code!=200||connection.getContentLengthLong()>MAX_IMAGE)return null;
                try(InputStream in=connection.getInputStream()){byte[] bytes=in.readNBytes(MAX_IMAGE+1);return bytes.length<=MAX_IMAGE?bytes:null;}
            }finally{connection.disconnect();}
        }
        return null;
    }
    private static String mime(byte[] bytes){
        if(bytes==null||bytes.length==0||bytes.length>MAX_IMAGE)return null;
        BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
        BitmapFactory.decodeByteArray(bytes,0,bytes.length,bounds);
        return bounds.outWidth>0&&bounds.outHeight>0&&bounds.outWidth<=8192&&bounds.outHeight<=8192&&bounds.outMimeType!=null&&bounds.outMimeType.startsWith("image/")?bounds.outMimeType:null;
    }
    private static String key(String value)throws Exception {
        byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format(Locale.ROOT,"%02x",b&255));return out+".image";
    }
    private synchronized void trim(){
        File[] files=directory.listFiles((dir,name)->name.endsWith(".image"));if(files==null)return;
        Arrays.sort(files,Comparator.comparingLong(File::lastModified));long size=0;for(File f:files)size+=f.length();
        for(File f:files){if(size<=MAX_CACHE)break;long bytes=f.length();if(f.delete())size-=bytes;}
    }
}
