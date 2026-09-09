#include "CardFeatures.hpp"
#include <opencv2/imgproc.hpp>
#include <opencv2/calib3d.hpp>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <map>
#include <numeric>
#include <set>
#include <stdexcept>

namespace holo {
static uint32_t u32(const uint8_t* p){return (uint32_t(p[0])<<24)|(uint32_t(p[1])<<16)|(uint32_t(p[2])<<8)|p[3];}
static uint64_t u64(const uint8_t* p){return (uint64_t(u32(p))<<32)|u32(p+4);}
static float f32(const uint8_t* p){uint32_t bits=u32(p);float result;std::memcpy(&result,&bits,4);return result;}
struct Reader {
    const uint8_t* data;size_t size,pos=0;
    void skip(size_t n){if(n>size-pos)throw std::runtime_error("Truncated card index");pos+=n;}
    uint32_t integer(){size_t start=pos;skip(4);return u32(data+start);}
    uint16_t shortInt(){size_t start=pos;skip(2);return uint16_t(data[start])<<8|data[start+1];}
    std::string string(){size_t length=shortInt(),start=pos;skip(length);return std::string(reinterpret_cast<const char*>(data+start),length);}
};
CardFeatures::CardFeatures(const uint8_t* data,size_t size,const uint8_t* local,size_t localSize):data_(data),local_(local),size_(size),localSize_(localSize),orb_(cv::ORB::create(650,1.2f,8,15,0,2,cv::ORB::HARRIS_SCORE,31,12)) {
    cv::setNumThreads(2);
    Reader r{data,size};r.skip(8);if(std::memcmp(data,"HCIX0001",8))throw std::runtime_error("Invalid card index");
    uint32_t count=r.integer();if(count<1||count>20000)throw std::runtime_error("Invalid card count");
    for(uint32_t i=0;i<count;i++){
        Entry e;e.number=r.string();r.string();for(auto& hash:e.hashes){size_t p=r.pos;r.skip(8);hash=u64(data+p);}
        e.count=r.shortInt();if(e.count>1023)throw std::runtime_error("Invalid descriptor count");
        e.points=r.pos;r.skip(e.count*8);e.descriptors=r.pos;r.skip(e.count*32);entries_.push_back(e);
    }
    if(!local||localSize<16)return;
    Reader l{local,localSize};l.skip(8);if(std::memcmp(local,"HCLI0001",8)||l.integer()!=count)throw std::runtime_error("Mismatched local index");
    uint32_t tables=l.integer();if(tables<1||tables>16)throw std::runtime_error("Invalid table count");
    for(uint32_t t=0;t<tables;t++){
        Table table;size_t start=l.pos;l.skip(16);for(int j=0;j<16;j++)table.bits[j]=local[start+j];
        uint32_t postings=l.integer();table.buckets=l.pos;l.skip(65537*4);table.postings=l.pos;l.skip(size_t(postings)*4);
        if(u32(local+table.buckets+65536*4)!=postings)throw std::runtime_error("Invalid postings");
        tables_.push_back(table);
    }
}
static std::array<cv::Point2f,4> order(std::vector<cv::Point> points){
    cv::Point2f center(0,0);for(auto p:points)center+=cv::Point2f(p);center*=.25f;
    std::sort(points.begin(),points.end(),[&](auto a,auto b){return std::atan2(a.y-center.y,a.x-center.x)<std::atan2(b.y-center.y,b.x-center.x);});
    size_t start=0;for(size_t i=1;i<4;i++)if(points[i].x+points[i].y<points[start].x+points[start].y)start=i;
    std::array<cv::Point2f,4> result;for(int i=0;i<4;i++)result[i]=points[(start+i)%4];return result;
}
Prepared prepare(const cv::Mat& input){
    cv::Mat rgba,gray,edges;double scale=std::min(1.,1000./std::max(input.cols,input.rows));cv::resize(input,rgba,cv::Size(),scale,scale);
    cv::cvtColor(rgba,gray,cv::COLOR_RGBA2GRAY);cv::GaussianBlur(gray,edges,{5,5},0);cv::Canny(edges,edges,45,140);
    cv::morphologyEx(edges,edges,cv::MORPH_CLOSE,cv::getStructuringElement(cv::MORPH_RECT,{3,3}));
    std::vector<std::vector<cv::Point>> contours;cv::findContours(edges,contours,cv::RETR_LIST,cv::CHAIN_APPROX_SIMPLE);
    double bestArea=gray.total()*.16;std::array<cv::Point2f,4> best;bool found=false;
    for(auto& contour:contours){
        std::vector<cv::Point> polygon;cv::approxPolyDP(contour,polygon,.025*cv::arcLength(contour,true),true);
        double area=std::abs(cv::contourArea(polygon));if(polygon.size()!=4||area<=bestArea||!cv::isContourConvex(polygon))continue;
        auto p=order(polygon);double top=cv::norm(p[0]-p[1]),right=cv::norm(p[1]-p[2]),bottom=cv::norm(p[2]-p[3]),left=cv::norm(p[3]-p[0]);
        double width=(top+bottom)/2,height=(left+right)/2,ratio=std::max(width,height)/std::max(1.,std::min(width,height));
        if(ratio>1.18&&ratio<1.85&&std::max(top,bottom)/std::max(1.,std::min(top,bottom))<1.3&&std::max(left,right)/std::max(1.,std::min(left,right))<1.3){found=true;best=p;bestArea=area;}
    }
    cv::Mat crop;
    if(found){
        bool landscape=cv::norm(best[0]-best[1])>cv::norm(best[1]-best[2]);int width=landscape?1000:716,height=landscape?716:1000;
        std::array<cv::Point2f,4> dst{cv::Point2f(0,0),cv::Point2f(width-1,0),cv::Point2f(width-1,height-1),cv::Point2f(0,height-1)};
        cv::warpPerspective(rgba,crop,cv::getPerspectiveTransform(best.data(),dst.data()),{width,height});if(landscape)cv::rotate(crop,crop,cv::ROTATE_90_CLOCKWISE);
    }else crop=rgba;
    cv::Mat quality,lap,bright;cv::cvtColor(crop,quality,cv::COLOR_RGBA2GRAY);cv::resize(quality,quality,{360,503});cv::Laplacian(quality,lap,CV_64F);
    cv::Scalar mean,stddev;cv::meanStdDev(lap,mean,stddev);cv::threshold(quality,bright,248,255,cv::THRESH_BINARY);
    return {crop,found,stddev[0]*stddev[0],cv::countNonZero(bright)/double(bright.total())};
}
static std::array<uint64_t,5> hashes(const cv::Mat& gray){
    int w=gray.cols,h=gray.rows;std::array<cv::Rect,5> areas{cv::Rect(0,0,w,h),cv::Rect(0,0,w/2,h/2),cv::Rect(w/2,0,w-w/2,h/2),cv::Rect(0,h/2,w/2,h-h/2),cv::Rect(w/2,h/2,w-w/2,h-h/2)};
    std::array<uint64_t,5> result{};
    for(int i=0;i<5;i++){
        cv::Mat small,dct;cv::resize(gray(areas[i]),small,{32,32},0,0,cv::INTER_AREA);small.convertTo(small,CV_32F);cv::dct(small,dct);
        std::array<float,64> values;int k=0;for(int y=0;y<8;y++)for(int x=0;x<8;x++)values[k++]=dct.at<float>(y,x);
        std::vector<float> ordered(values.begin()+1,values.end());std::sort(ordered.begin(),ordered.end());float median=ordered[31];
        for(int j=0;j<64;j++)if(values[j]>median)result[i]|=uint64_t(1)<<j;
    }
    return result;
}
static double hashDistance(const std::array<uint64_t,5>& a,const std::array<uint64_t,5>& b){
    std::array<int,4> q;for(int i=0;i<4;i++)q[i]=__builtin_popcountll(a[i+1]^b[i+1]);std::sort(q.begin(),q.end());return __builtin_popcountll(a[0]^b[0])*.4+(q[0]+q[1]+q[2])*.2;
}
std::vector<size_t> CardFeatures::localCandidates(const cv::Mat& descriptors)const{
    if(tables_.empty()||descriptors.empty())return {};
    std::vector<int> scores(entries_.size()),best(entries_.size());std::vector<size_t> touched;
    for(int row=0;row<descriptors.rows;row++){
        std::fill(best.begin(),best.end(),71);touched.clear();auto q=descriptors.ptr<uint8_t>(row);
        uint64_t a=u64(q),b=u64(q+8),c=u64(q+16),d=u64(q+24);
        for(auto& table:tables_){
            unsigned key=0;for(int j=0;j<16;j++)key|=((q[table.bits[j]/8]>>(table.bits[j]%8))&1)<<j;
            for(int probe=-1;probe<16;probe++){
                unsigned lookup=probe<0?key:key^(1<<probe);size_t offset=table.buckets+lookup*4;
                uint32_t start=u32(local_+offset),end=u32(local_+offset+4);
                if(end<start||end-start>256||table.postings+size_t(end)*4>localSize_)continue;
                for(uint32_t k=start;k<end;k++){
                    uint32_t packed=u32(local_+table.postings+size_t(k)*4),id=packed>>10,feature=packed&1023;
                    if(id>=entries_.size()||feature>=unsigned(entries_[id].count))continue;
                    auto ref=data_+entries_[id].descriptors+feature*32;
                    int distance=__builtin_popcountll(a^u64(ref))+__builtin_popcountll(b^u64(ref+8))+__builtin_popcountll(c^u64(ref+16))+__builtin_popcountll(d^u64(ref+24));
                    if(distance<=68&&distance<best[id]){if(best[id]==71)touched.push_back(id);best[id]=distance;}
                }
            }
        }
        for(auto id:touched)scores[id]+=70-best[id];
    }
    std::vector<size_t> ids;for(size_t i=0;i<scores.size();i++)if(scores[i]>0)ids.push_back(i);
    std::sort(ids.begin(),ids.end(),[&](size_t a,size_t b){return scores[a]>scores[b];});if(ids.size()>32)ids.resize(32);return ids;
}
std::vector<VisualHit> CardFeatures::match(const cv::Mat& rgba,const std::vector<std::string>& textNumbers){
    cv::Mat gray,enhanced,desc,rotated;cv::cvtColor(rgba,gray,cv::COLOR_RGBA2GRAY);double scale=755./std::max(gray.cols,gray.rows);cv::resize(gray,gray,cv::Size(),scale,scale);
    auto forward=hashes(gray);cv::rotate(gray,rotated,cv::ROTATE_180);auto reverse=hashes(rotated);
    std::vector<size_t> order(entries_.size());std::iota(order.begin(),order.end(),0);
    std::sort(order.begin(),order.end(),[&](size_t a,size_t b){return std::min(hashDistance(forward,entries_[a].hashes),hashDistance(reverse,entries_[a].hashes))<std::min(hashDistance(forward,entries_[b].hashes),hashDistance(reverse,entries_[b].hashes));});
    cv::createCLAHE(2,{8,8})->apply(gray,enhanced);std::vector<cv::KeyPoint> points;orb_->detectAndCompute(enhanced,cv::noArray(),points,desc);
    if(desc.empty())return {};
    std::set<size_t> selected(order.begin(),order.begin()+std::min(order.size(),tables_.empty()?size_t(40):size_t(12)));
    auto local=localCandidates(desc);selected.insert(local.begin(),local.end());
    for(size_t i=0;i<entries_.size();i++)if(std::find(textNumbers.begin(),textNumbers.end(),entries_[i].number)!=textNumbers.end())selected.insert(i);
    std::map<std::string,VisualHit> best;cv::BFMatcher matcher(cv::NORM_HAMMING);
    for(auto id:selected){
        auto& e=entries_[id];if(e.count<8)continue;
        cv::Mat reference(e.count,32,CV_8U,const_cast<uint8_t*>(data_+e.descriptors));std::vector<std::vector<cv::DMatch>> pairs;matcher.knnMatch(desc,reference,pairs,2);
        std::vector<cv::Point2f> src,dst;std::set<int> used;
        for(auto& pair:pairs)if(pair.size()==2&&pair[0].distance<.72*pair[1].distance&&used.insert(pair[0].trainIdx).second){auto m=pair[0];auto p=data_+e.points+m.trainIdx*8;src.emplace_back(f32(p),f32(p+4));dst.push_back(points[m.queryIdx].pt);}
        if(src.size()<8)continue;
        cv::Mat mask,homography=cv::findHomography(src,dst,cv::RANSAC,3.5,mask,1000,.995);if(homography.empty())continue;
        int inliers=cv::countNonZero(mask);std::vector<cv::Point2f> verified;for(size_t i=0;i<src.size();i++)if(mask.at<uint8_t>(int(i)))verified.push_back(src[i]);
        double coverage=verified.empty()?0:cv::boundingRect(verified).area()/(360.*503);
        if(inliers>=7){VisualHit hit{e.number,inliers,inliers/double(src.size()),coverage};auto old=best.find(e.number);if(old==best.end()||inliers>old->second.inliers)best.insert_or_assign(e.number,hit);}
    }
    std::vector<VisualHit> result;for(auto& pair:best)result.push_back(pair.second);std::sort(result.begin(),result.end(),[](auto& a,auto& b){return a.inliers>b.inliers;});return result;
}
}
