#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface HoloVision : NSObject
- (nullable instancetype)initWithIndexPath:(NSString *)indexPath localPath:(NSString *)localPath;
- (NSDictionary<NSString *, id> *)prepareImage:(UIImage *)image NS_SWIFT_NAME(prepare(_:));
- (NSArray<NSDictionary<NSString *, id> *> *)matchImage:(UIImage *)image textNumbers:(NSArray<NSString *> *)numbers NS_SWIFT_NAME(match(_:textNumbers:));
@end
NS_ASSUME_NONNULL_END
