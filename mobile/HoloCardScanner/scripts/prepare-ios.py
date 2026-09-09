"""Prepare a physical-iPhone Xcode project using the official OpenCV iOS framework.

No credentials or signing keys are requested. A Mac with Xcode 26+ performs the real build.
"""
from __future__ import annotations
import argparse, hashlib, json, pathlib, plistlib, shutil, subprocess, sys, urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
ios = root / 'ios'
url = 'https://github.com/opencv/opencv/releases/download/4.12.0/opencv-4.12.0-ios-framework.zip'
sha256 = '86b42c9f141cd9169b91be2fc380b0e556a88a95c98ccc8e7aef8349ab74cf70'
p = argparse.ArgumentParser(); p.add_argument('--generate-only', action='store_true'); args = p.parse_args()

if not args.generate_only:
    if sys.platform != 'darwin': sys.exit('The install/build step needs macOS and Xcode. Use --generate-only to regenerate project metadata elsewhere.')
    subprocess.run(['xcodebuild', '-version'], check=True)
    vendor = ios / 'Vendor'; vendor.mkdir(exist_ok=True)
    archive = vendor / 'opencv-ios.zip'
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != sha256:
        print('Downloading official OpenCV 4.12.0 (~221 MB); needed once for compilation.', flush=True)
        urllib.request.urlretrieve(url, archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != sha256: sys.exit('OpenCV checksum mismatch; no files were installed.')
    if not (vendor / 'opencv2.framework/Versions/A/opencv2').exists():
        subprocess.run(['/usr/bin/ditto', '-x', '-k', str(archive), str(vendor)], check=True)
    privacy = vendor / 'opencv2.framework/Versions/A/Resources/PrivacyInfo.xcprivacy'
    bundle = vendor / 'OpenCVPrivacy.bundle'; bundle.mkdir(exist_ok=True)
    if privacy.exists(): shutil.copy2(privacy, bundle / privacy.name)
    with (bundle / 'Info.plist').open('wb') as f: plistlib.dump({'CFBundleIdentifier': 'org.opencv.holopocket.resources', 'CFBundleName': 'OpenCVPrivacy', 'CFBundlePackageType': 'BNDL', 'CFBundleVersion': '4.12.0'}, f)

def ident(value): return hashlib.sha256(value.encode()).hexdigest()[:24].upper()
def q(value): return json.dumps(str(value), ensure_ascii=False)
objects = []
def obj(key, text): objects.append(f'\t\t{ident(key)} = {{ {text} }};'); return ident(key)
def refs(values): return '(' + ', '.join(ident(v) for v in values) + (',' if values else '') + ')'
def settings(values): return '{ ' + ' '.join(f'{q(k)} = {q(v)};' if not isinstance(v,list) else f'{q(k)} = ('+', '.join(q(x) for x in v)+');' for k,v in values.items()) + ' }'

sources = sorted(f.relative_to(ios).as_posix() for f in (ios / 'Sources').iterdir() if f.suffix in {'.swift', '.mm', '.cpp', '.h', '.hpp'})
types = {'.swift':'sourcecode.swift', '.mm':'sourcecode.cpp.objcpp', '.cpp':'sourcecode.cpp.cpp', '.h':'sourcecode.c.h', '.hpp':'sourcecode.cpp.h'}
for path in sources:
    obj(path, f'isa = PBXFileReference; lastKnownFileType = {types[pathlib.Path(path).suffix]}; path = {q(path)}; sourceTree = SOURCE_ROOT;')
    if pathlib.Path(path).suffix in {'.swift','.mm','.cpp'}: obj('build:'+path, f'isa = PBXBuildFile; fileRef = {ident(path)};')

resources = {'Sources/bridge.js': 'sourcecode.javascript', '../app/src/main/assets': 'folder', 'Assets.xcassets': 'folder.assetcatalog', 'PrivacyInfo.xcprivacy':'text.xml', 'Vendor/OpenCVPrivacy.bundle':'wrapper.plug-in'}
for path, kind in resources.items():
    obj(path, f'isa = PBXFileReference; lastKnownFileType = {kind}; path = {q(path)}; sourceTree = SOURCE_ROOT;')
    obj('build:'+path, f'isa = PBXBuildFile; fileRef = {ident(path)};')
obj('Info.plist', 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = SOURCE_ROOT;')
obj('opencv', 'isa = PBXFileReference; lastKnownFileType = wrapper.framework; path = Vendor/opencv2.framework; sourceTree = SOURCE_ROOT;')
obj('build:opencv', f'isa = PBXBuildFile; fileRef = {ident("opencv")};')
obj('product', 'isa = PBXFileReference; explicitFileType = wrapper.application; path = "Holo Pocket Lab.app"; sourceTree = BUILT_PRODUCTS_DIR;')
obj('products', f'isa = PBXGroup; children = {refs(["product"])}; name = Products; sourceTree = "<group>";')
obj('main', f'isa = PBXGroup; children = {refs(sources+list(resources)+["Info.plist","opencv","products"])}; sourceTree = "<group>";')
obj('sourcesPhase', f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {refs(["build:"+f for f in sources if pathlib.Path(f).suffix in {".swift",".mm",".cpp"}])}; runOnlyForDeploymentPostprocessing = 0;')
obj('resourcesPhase', f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {refs(["build:"+f for f in resources])}; runOnlyForDeploymentPostprocessing = 0;')
obj('frameworksPhase', f'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = {refs(["build:opencv"])}; runOnlyForDeploymentPostprocessing = 0;')
base = {'SDKROOT':'iphoneos','IPHONEOS_DEPLOYMENT_TARGET':'18.0','CLANG_ENABLE_MODULES':'YES','CLANG_ENABLE_OBJC_ARC':'YES','CLANG_CXX_LANGUAGE_STANDARD':'c++17','CLANG_CXX_LIBRARY':'libc++','SWIFT_VERSION':'5.0','SWIFT_STRICT_CONCURRENCY':'minimal','ENABLE_STRICT_OBJC_MSGSEND':'YES','GCC_C_LANGUAGE_STANDARD':'gnu17'}
target = {'PRODUCT_NAME':'Holo Pocket Lab','PRODUCT_BUNDLE_IDENTIFIER':'com.holocard.pocketlab.ios','MARKETING_VERSION':'0.2.2','CURRENT_PROJECT_VERSION':'4','CODE_SIGN_STYLE':'Automatic','DEVELOPMENT_TEAM':'','INFOPLIST_FILE':'Info.plist','GENERATE_INFOPLIST_FILE':'NO','TARGETED_DEVICE_FAMILY':'1','SUPPORTED_PLATFORMS':'iphoneos','SUPPORTS_MACCATALYST':'NO','SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD':'NO','SWIFT_OBJC_BRIDGING_HEADER':'Sources/HoloPocketLab-Bridging-Header.h','FRAMEWORK_SEARCH_PATHS':['$(inherited)','$(PROJECT_DIR)/Vendor'],'OTHER_LDFLAGS':['$(inherited)','-lc++','-lz','-framework','Accelerate','-framework','AVFoundation','-framework','CoreMedia','-framework','CoreVideo','-framework','CoreGraphics','-framework','QuartzCore'],'ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','LD_RUNPATH_SEARCH_PATHS':['$(inherited)','@executable_path/Frameworks']}
for name in ['Debug','Release']:
    b = dict(base, DEBUG_INFORMATION_FORMAT='dwarf' if name=='Debug' else 'dwarf-with-dsym', SWIFT_OPTIMIZATION_LEVEL='-Onone' if name=='Debug' else '-O', GCC_OPTIMIZATION_LEVEL='0' if name=='Debug' else 's')
    obj('project:'+name, f'isa = XCBuildConfiguration; buildSettings = {settings(b)}; name = {name};')
    obj('target:'+name, f'isa = XCBuildConfiguration; buildSettings = {settings(target)}; name = {name};')
for key in ['project','target']: obj(key+'Configs', f'isa = XCConfigurationList; buildConfigurations = {refs([key+":Debug",key+":Release"])}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
obj('target', f'isa = PBXNativeTarget; buildConfigurationList = {ident("targetConfigs")}; buildPhases = {refs(["sourcesPhase","frameworksPhase","resourcesPhase"])}; buildRules = (); dependencies = (); name = HoloPocketLab; productName = "Holo Pocket Lab"; productReference = {ident("product")}; productType = "com.apple.product-type.application";')
obj('project', f'isa = PBXProject; attributes = {{ BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; TargetAttributes = {{ {ident("target")} = {{ CreatedOnToolsVersion = 26.0; ProvisioningStyle = Automatic; }}; }}; }}; buildConfigurationList = {ident("projectConfigs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = "zh-Hant"; hasScannedForEncodings = 0; knownRegions = ("zh-Hant", en, Base); mainGroup = {ident("main")}; productRefGroup = {ident("products")}; projectDirPath = ""; projectRoot = ""; targets = {refs(["target"])};')
project = ios / 'HoloPocketLab.xcodeproj'; project.mkdir(exist_ok=True)
(project / 'project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n'+'\n'.join(objects)+'\n\t};\n\trootObject = '+ident('project')+';\n}\n')
schemes = project / 'xcshareddata/xcschemes'; schemes.mkdir(parents=True, exist_ok=True)
ref = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident("target")}" BuildableName="Holo Pocket Lab.app" BlueprintName="HoloPocketLab" ReferencedContainer="container:HoloPocketLab.xcodeproj"/>'
(schemes / 'HoloPocketLab.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables/></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/>
<ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
print('Prepared:', project)
if not args.generate_only: print('Open this project in Xcode, select your Team and a physical iPhone. Select Product > Archive for TestFlight.')
