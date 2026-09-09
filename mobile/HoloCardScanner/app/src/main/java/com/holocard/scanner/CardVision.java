package com.holocard.scanner;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import org.opencv.android.Utils;
import org.opencv.calib3d.Calib3d;
import org.opencv.core.*;
import org.opencv.features2d.*;
import org.opencv.imgproc.*;
import java.io.*;
import java.nio.*;
import java.nio.channels.FileChannel;
import java.util.*;

/** On-device image retrieval: local-feature buckets, ORB + RANSAC geometric verification.
 * Image similarities are never represented as calibrated recognition probabilities. */
public final class CardVision implements AutoCloseable {
    private static final int W=360,H=503;
    static final class Entry {
        String number,key;long[] hashes=new long[5];int count,pointOffset,descOffset;
    }
    public static final class Prepared implements AutoCloseable {
        public final Bitmap bitmap;public final boolean foundCard;public final double sharpness,glare;
        Prepared(Bitmap b,boolean f,double s,double g){bitmap=b;foundCard=f;sharpness=s;glare=g;}
        @Override public void close(){bitmap.recycle();}
    }
    public static final class VisualHit {
        public final String number;public final int inliers;public final double ratio,coverage;
        VisualHit(String n,int i,double r,double c){number=n;inliers=i;ratio=r;coverage=c;}
        public boolean strong(){return inliers>=18&&ratio>=.42&&coverage>=.045;}
    }
    private final List<Entry> entries=new ArrayList<>();
    private final ByteBuffer data;
    private final FileInputStream file;
    private final AssetFileDescriptor descriptor;
    private AssetFileDescriptor localDescriptor;
    private FileInputStream localFile;
    private ByteBuffer localData;
    private final List<int[]> bucketBits=new ArrayList<>();
    private final List<Integer> bucketOffsets=new ArrayList<>(),postingOffsets=new ArrayList<>();
    private final ORB orb=ORB.create(650,1.2f,8,15,0,2,ORB.HARRIS_SCORE,31,12);
    private final DescriptorMatcher matcher=DescriptorMatcher.create(DescriptorMatcher.BRUTEFORCE_HAMMING);
    public CardVision(AssetManager assets) throws IOException {
        descriptor=assets.openFd("image-index.bin");file=new FileInputStream(descriptor.getFileDescriptor());
        data=file.getChannel().map(FileChannel.MapMode.READ_ONLY,descriptor.getStartOffset(),descriptor.getLength()).order(ByteOrder.BIG_ENDIAN);
        byte[] magic=new byte[8];data.get(magic);if(!Arrays.equals(magic,"HCIX0001".getBytes(java.nio.charset.StandardCharsets.US_ASCII)))throw new IOException("Invalid image index");
        int count=data.getInt();if(count<1||count>20000)throw new IOException("Invalid reference count");
        for(int i=0;i<count;i++){
            Entry e=new Entry();e.number=readString(data);e.key=readString(data);
            for(int h=0;h<5;h++)e.hashes[h]=data.getLong();e.count=Short.toUnsignedInt(data.getShort());
            e.pointOffset=data.position();data.position(data.position()+e.count*8);e.descOffset=data.position();data.position(data.position()+e.count*32);entries.add(e);
        }
        try {
            localDescriptor=assets.openFd("local-index.bin");localFile=new FileInputStream(localDescriptor.getFileDescriptor());
            localData=localFile.getChannel().map(FileChannel.MapMode.READ_ONLY,localDescriptor.getStartOffset(),localDescriptor.getLength()).order(ByteOrder.BIG_ENDIAN);
            byte[] signature=new byte[8];localData.get(signature);
            if(!Arrays.equals(signature,"HCLI0001".getBytes(java.nio.charset.StandardCharsets.US_ASCII))||localData.getInt()!=entries.size())throw new IOException("Local index mismatch");
            int tables=localData.getInt();if(tables<1||tables>16)throw new IOException("Invalid local tables");
            for(int t=0;t<tables;t++){
                int[] bits=new int[16];for(int j=0;j<16;j++)bits[j]=Byte.toUnsignedInt(localData.get());
                int postings=localData.getInt();bucketBits.add(bits);bucketOffsets.add(localData.position());localData.position(localData.position()+65537*4);
                postingOffsets.add(localData.position());localData.position(localData.position()+postings*4);
            }
        } catch(IOException|RuntimeException unavailable) {
            localData=null;bucketBits.clear();bucketOffsets.clear();postingOffsets.clear();
            if(localFile!=null)localFile.close();if(localDescriptor!=null)localDescriptor.close();
        }
    }
    private static String readString(ByteBuffer b){int n=Short.toUnsignedInt(b.getShort());byte[] text=new byte[n];b.get(text);return new String(text,java.nio.charset.StandardCharsets.US_ASCII);}

    public static Prepared prepare(Bitmap bitmap) {
        Mat rgba=new Mat(),gray=new Mat(),edges=new Mat();Utils.bitmapToMat(bitmap,rgba);
        double scale=Math.min(1,1000.0/Math.max(rgba.cols(),rgba.rows()));
        if(scale<1)Imgproc.resize(rgba,rgba,new Size(Math.round(rgba.cols()*scale),Math.round(rgba.rows()*scale)));
        Imgproc.cvtColor(rgba,gray,Imgproc.COLOR_RGBA2GRAY);Imgproc.GaussianBlur(gray,edges,new Size(5,5),0);Imgproc.Canny(edges,edges,45,140);
        Mat kernel=Imgproc.getStructuringElement(Imgproc.MORPH_RECT,new Size(3,3));Imgproc.morphologyEx(edges,edges,Imgproc.MORPH_CLOSE,kernel);kernel.release();
        List<MatOfPoint> contours=new ArrayList<>();Mat hierarchy=new Mat();Imgproc.findContours(edges,contours,hierarchy,Imgproc.RETR_LIST,Imgproc.CHAIN_APPROX_SIMPLE);
        Point[] best=null;double bestArea=gray.total()*.16;
        for(MatOfPoint contour:contours){
            MatOfPoint2f curve=new MatOfPoint2f(contour.toArray()),approx=new MatOfPoint2f();Imgproc.approxPolyDP(curve,approx,.025*Imgproc.arcLength(curve,true),true);
            Point[] p=approx.toArray();MatOfPoint polygon=new MatOfPoint(p);double area=Math.abs(Imgproc.contourArea(polygon));
            if(p.length==4&&area>bestArea&&Imgproc.isContourConvex(polygon)){
                Point[] ordered=order(p);double width=(distance(ordered[0],ordered[1])+distance(ordered[2],ordered[3]))/2,height=(distance(ordered[1],ordered[2])+distance(ordered[3],ordered[0]))/2;
                double ratio=Math.max(width,height)/Math.min(width,height);
                double top=distance(ordered[0],ordered[1]),bottom=distance(ordered[2],ordered[3]),right=distance(ordered[1],ordered[2]),left=distance(ordered[3],ordered[0]);
                // Avoid mistaking a large foil/text region for the physical card border.
                if(ratio>1.18&&ratio<1.85&&Math.max(top,bottom)/Math.min(top,bottom)<1.3&&Math.max(left,right)/Math.min(left,right)<1.3){best=ordered;bestArea=area;}
            }
            polygon.release();approx.release();curve.release();contour.release();
        }
        Mat crop=new Mat();
        if(best!=null){
            double width=distance(best[0],best[1]),height=distance(best[1],best[2]);boolean landscape=width>height;
            int outW=landscape?1000:716,outH=landscape?716:1000;
            MatOfPoint2f src=new MatOfPoint2f(best),dst=new MatOfPoint2f(new Point(0,0),new Point(outW-1,0),new Point(outW-1,outH-1),new Point(0,outH-1));
            Mat transform=Imgproc.getPerspectiveTransform(src,dst);Imgproc.warpPerspective(rgba,crop,transform,new Size(outW,outH));
            if(landscape)Core.rotate(crop,crop,Core.ROTATE_90_CLOCKWISE);src.release();dst.release();transform.release();
        } else rgba.copyTo(crop);
        Mat quality=new Mat(),lap=new Mat();Imgproc.cvtColor(crop,quality,Imgproc.COLOR_RGBA2GRAY);Imgproc.resize(quality,quality,new Size(W,H));
        Imgproc.Laplacian(quality,lap,CvType.CV_64F);MatOfDouble mean=new MatOfDouble(),std=new MatOfDouble();Core.meanStdDev(lap,mean,std);double sharpness=Math.pow(std.toArray()[0],2);
        Mat bright=new Mat();Imgproc.threshold(quality,bright,248,255,Imgproc.THRESH_BINARY);double glare=Core.countNonZero(bright)/(double)bright.total();
        Bitmap out=Bitmap.createBitmap(crop.cols(),crop.rows(),Bitmap.Config.ARGB_8888);Utils.matToBitmap(crop,out);
        for(Mat mat:List.of(rgba,gray,edges,hierarchy,crop,quality,lap,mean,std,bright))mat.release();
        return new Prepared(out,best!=null,sharpness,glare);
    }
    private static Point[] order(Point[] points){
        double cx=Arrays.stream(points).mapToDouble(p->p.x).average().orElse(0),cy=Arrays.stream(points).mapToDouble(p->p.y).average().orElse(0);
        Arrays.sort(points,Comparator.comparingDouble(p->Math.atan2(p.y-cy,p.x-cx)));
        int start=0;for(int i=1;i<4;i++)if(points[i].x+points[i].y<points[start].x+points[start].y)start=i;
        Point[] out=new Point[4];for(int i=0;i<4;i++)out[i]=points[(start+i)%4];return out;
    }
    private static double distance(Point a,Point b){return Math.hypot(a.x-b.x,a.y-b.y);}
    public List<VisualHit> match(Bitmap bitmap,List<TextMatcher.Hit> textHits){
        Mat rgba=new Mat(),gray=new Mat(),enhanced=new Mat(),desc=new Mat();Utils.bitmapToMat(bitmap,rgba);Imgproc.cvtColor(rgba,gray,Imgproc.COLOR_RGBA2GRAY);
        double scale=755.0/Math.max(gray.cols(),gray.rows());Imgproc.resize(gray,gray,new Size(Math.round(gray.cols()*scale),Math.round(gray.rows()*scale)));
        long[] hashes=hashes(gray);Mat rotated=new Mat();Core.rotate(gray,rotated,Core.ROTATE_180);long[] reverse=hashes(rotated);rotated.release();
        Set<String> textNumbers=new HashSet<>();for(int i=0;i<Math.min(5,textHits.size());i++)textNumbers.add(textHits.get(i).number);
        List<Entry> shortlist=new ArrayList<>(entries);shortlist.sort(Comparator.comparingDouble(e->Math.min(hashDistance(hashes,e.hashes),hashDistance(reverse,e.hashes))));
        CLAHE clahe=Imgproc.createCLAHE(2,new Size(8,8));clahe.apply(gray,enhanced);clahe.collectGarbage();MatOfKeyPoint queryPoints=new MatOfKeyPoint();Mat mask=new Mat();orb.detectAndCompute(enhanced,mask,queryPoints,desc);mask.release();KeyPoint[] points=queryPoints.toArray();
        Set<Entry> selected=new LinkedHashSet<>(shortlist.subList(0,Math.min(localData==null?40:12,shortlist.size())));
        selected.addAll(localCandidates(desc));for(Entry e:entries)if(textNumbers.contains(e.number))selected.add(e);
        Map<String,VisualHit> best=new HashMap<>();
        if(!desc.empty())for(Entry e:selected){
            if(e.count<8)continue;ByteBuffer b=data.duplicate();b.position(e.descOffset);byte[] bytes=new byte[e.count*32];b.get(bytes);Mat ref=new Mat(e.count,32,CvType.CV_8U);ref.put(0,0,bytes);
            List<MatOfDMatch> pairs=new ArrayList<>();matcher.knnMatch(desc,ref,pairs,2);List<Point> src=new ArrayList<>(),dst=new ArrayList<>();Set<Integer> used=new HashSet<>();
            for(MatOfDMatch pair:pairs){DMatch[] matches=pair.toArray();if(matches.length==2&&matches[0].distance<.72*matches[1].distance&&used.add(matches[0].trainIdx)){
                DMatch match=matches[0];int offset=e.pointOffset+match.trainIdx*8;src.add(new Point(b.getFloat(offset),b.getFloat(offset+4)));dst.add(points[match.queryIdx].pt);
            }pair.release();}
            if(src.size()>=8){
                MatOfPoint2f s=new MatOfPoint2f(),d=new MatOfPoint2f();s.fromList(src);d.fromList(dst);Mat inlierMask=new Mat(),homography=Calib3d.findHomography(s,d,Calib3d.RANSAC,3.5,inlierMask,1000,.995);
                if(!homography.empty()){
                    int inliers=Core.countNonZero(inlierMask);byte[] flags=new byte[(int)inlierMask.total()];inlierMask.get(0,0,flags);
                    List<Point> verified=new ArrayList<>();for(int i=0;i<flags.length;i++)if(flags[i]!=0)verified.add(src.get(i));
                    double coverage=0;if(!verified.isEmpty()){MatOfPoint mp=new MatOfPoint();mp.fromList(verified);Rect rect=Imgproc.boundingRect(mp);coverage=rect.area()/(W*(double)H);mp.release();}
                    if(inliers>=7){VisualHit hit=new VisualHit(e.number,inliers,inliers/(double)src.size(),coverage);VisualHit old=best.get(e.number);if(old==null||inliers>old.inliers)best.put(e.number,hit);}
                }
                s.release();d.release();inlierMask.release();homography.release();
            }ref.release();
        }
        for(Mat mat:List.of(rgba,gray,enhanced,desc,queryPoints))mat.release();
        List<VisualHit> hits=new ArrayList<>(best.values());hits.sort(Comparator.comparingInt((VisualHit h)->h.inliers).reversed());return hits;
    }
    private List<Entry> localCandidates(Mat descriptors){
        if(localData==null||descriptors.empty())return List.of();
        byte[] query=new byte[descriptors.rows()*32];descriptors.get(0,0,query);ByteBuffer q=ByteBuffer.wrap(query).order(ByteOrder.BIG_ENDIAN);
        int[] scores=new int[entries.size()],best=new int[entries.size()],touched=new int[entries.size()];
        for(int row=0;row<descriptors.rows();row++){
            Arrays.fill(best,71);int touchedCount=0,base=row*32;long a=q.getLong(base),b=q.getLong(base+8),c=q.getLong(base+16),d=q.getLong(base+24);
            for(int t=0;t<bucketBits.size();t++){
                int key=0;int[] bits=bucketBits.get(t);for(int j=0;j<16;j++)key|=((query[base+bits[j]/8]>>>(bits[j]%8))&1)<<j;
                for(int probe=-1;probe<16;probe++){
                    int lookup=probe<0?key:key^(1<<probe),offset=bucketOffsets.get(t)+lookup*4;
                    int start=localData.getInt(offset),end=localData.getInt(offset+4);
                    // Very common text/background buckets carry little identifying evidence.
                    if(end-start>256)continue;
                    for(int k=start;k<end;k++){
                        int packed=localData.getInt(postingOffsets.get(t)+k*4),entryId=packed>>>10,feature=packed&1023;
                        Entry e=entries.get(entryId);int pos=e.descOffset+feature*32;
                        int distance=Long.bitCount(a^data.getLong(pos))+Long.bitCount(b^data.getLong(pos+8))+Long.bitCount(c^data.getLong(pos+16))+Long.bitCount(d^data.getLong(pos+24));
                        if(distance<=68&&distance<best[entryId]){if(best[entryId]==71)touched[touchedCount++]=entryId;best[entryId]=distance;}
                    }
                }
            }
            for(int j=0;j<touchedCount;j++){int id=touched[j];scores[id]+=70-best[id];}
        }
        List<Integer> ids=new ArrayList<>();for(int i=0;i<scores.length;i++)if(scores[i]>0)ids.add(i);
        ids.sort(Comparator.comparingInt((Integer id)->scores[id]).reversed());List<Entry> result=new ArrayList<>();
        for(int i=0;i<Math.min(32,ids.size());i++)result.add(entries.get(ids.get(i)));return result;
    }
    private static double hashDistance(long[] a,long[] b){int[] quadrants=new int[4];for(int i=0;i<4;i++)quadrants[i]=Long.bitCount(a[i+1]^b[i+1]);Arrays.sort(quadrants);return Long.bitCount(a[0]^b[0])*.4+(quadrants[0]+quadrants[1]+quadrants[2])*.2;}
    private static long[] hashes(Mat gray){
        int h=gray.rows(),w=gray.cols();Rect[] regions={new Rect(0,0,w,h),new Rect(0,0,w/2,h/2),new Rect(w/2,0,w-w/2,h/2),new Rect(0,h/2,w/2,h-h/2),new Rect(w/2,h/2,w-w/2,h-h/2)};
        long[] result=new long[5];for(int i=0;i<5;i++){Mat area=gray.submat(regions[i]),small=new Mat(),dct=new Mat();Imgproc.resize(area,small,new Size(32,32),0,0,Imgproc.INTER_AREA);small.convertTo(small,CvType.CV_32F);Core.dct(small,dct);float[] values=new float[64];int k=0;for(int y=0;y<8;y++)for(int x=0;x<8;x++)values[k++]=(float)dct.get(y,x)[0];float[] sorted=Arrays.copyOfRange(values,1,64);Arrays.sort(sorted);float median=sorted[31];long hash=0;for(int j=0;j<64;j++)if(values[j]>median)hash|=1L<<j;result[i]=hash;area.release();small.release();dct.release();}return result;
    }
    @Override public void close(){orb.clear();matcher.clear();try{file.close();descriptor.close();if(localFile!=null)localFile.close();if(localDescriptor!=null)localDescriptor.close();}catch(IOException ignored){}}
}
