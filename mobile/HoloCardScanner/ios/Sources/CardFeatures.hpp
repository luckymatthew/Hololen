#pragma once
#include <opencv2/core.hpp>
#include <opencv2/features2d.hpp>
#include <array>
#include <string>
#include <vector>

namespace holo {
struct VisualHit { std::string number; int inliers; double ratio, coverage; bool strong() const { return inliers>=18 && ratio>=.42 && coverage>=.045; } };
struct Prepared { cv::Mat rgba; bool found=false; double sharpness=0, glare=0; };
Prepared prepare(const cv::Mat& rgba);
class CardFeatures {
    struct Entry { std::string number; std::array<uint64_t,5> hashes; int count; size_t points, descriptors; };
    struct Table { std::array<int,16> bits; size_t buckets, postings; };
    const uint8_t *data_, *local_;
    size_t size_, localSize_;
    std::vector<Entry> entries_;
    std::vector<Table> tables_;
    cv::Ptr<cv::ORB> orb_;
    std::vector<size_t> localCandidates(const cv::Mat& descriptors) const;
public:
    CardFeatures(const uint8_t* data,size_t size,const uint8_t* local,size_t localSize);
    std::vector<VisualHit> match(const cv::Mat& rgba,const std::vector<std::string>& textNumbers);
};
}
