// Include OpenCV before Apple headers to avoid the Objective-C YES/NO macro collision.
#include "CardFeatures.hpp"
#include <opencv2/imgcodecs/ios.h>
#import "HoloVision.h"
#include <memory>

@implementation HoloVision {
    NSData *_index;
    NSData *_local;
    std::unique_ptr<holo::CardFeatures> _features;
}
- (nullable instancetype)initWithIndexPath:(NSString *)indexPath localPath:(NSString *)localPath {
    if ((self=[super init])) {
        _index=[NSData dataWithContentsOfFile:indexPath options:NSDataReadingMappedIfSafe error:nil];
        _local=[NSData dataWithContentsOfFile:localPath options:NSDataReadingMappedIfSafe error:nil];
        if (!_index) return nil;
        try { _features=std::make_unique<holo::CardFeatures>((const uint8_t*)_index.bytes,_index.length,(const uint8_t*)_local.bytes,_local.length); }
        catch (...) { return nil; }
    }
    return self;
}
- (NSDictionary<NSString *,id> *)prepareImage:(UIImage *)image {
    try {
        cv::Mat rgba;UIImageToMat(image,rgba,true);auto result=holo::prepare(rgba);
        return @{ @"image": MatToUIImage(result.rgba), @"sharpness": @(result.sharpness), @"glare": @(result.glare), @"found": @(result.found) };
    } catch (...) { return @{ @"image": image, @"sharpness": @0, @"glare": @0, @"found": @NO }; }
}
- (NSArray<NSDictionary<NSString *,id> *> *)matchImage:(UIImage *)image textNumbers:(NSArray<NSString *> *)numbers {
    try {
        cv::Mat rgba;UIImageToMat(image,rgba,true);std::vector<std::string> text;for(NSString *number in numbers)text.push_back(number.UTF8String);
        auto hits=_features->match(rgba,text);NSMutableArray *out=[NSMutableArray array];
        for(auto& h:hits)[out addObject:@{ @"number": [NSString stringWithUTF8String:h.number.c_str()], @"inliers": @(h.inliers), @"ratio": @(h.ratio), @"coverage": @(h.coverage), @"strong": @(h.strong()) }];
        return out;
    } catch (...) { return @[]; }
}
@end
