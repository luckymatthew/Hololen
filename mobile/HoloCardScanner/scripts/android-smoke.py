"""Start an isolated test emulator and keep adb in the same process environment.
Only touches this task's AVD. No personal phone or existing user accounts.
"""
import argparse, os, pathlib, subprocess, time
p=argparse.ArgumentParser();p.add_argument('--sdk',required=True);p.add_argument('--apk',required=True);p.add_argument('--test-apk');p.add_argument('--avd',default='HoloVerify36');p.add_argument('--output',required=True);args=p.parse_args()
sdk=pathlib.Path(args.sdk);out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True);adb=str(sdk/'platform-tools/adb');env=dict(os.environ,ANDROID_SDK_ROOT=str(sdk));started=time.time()
def run(*cmd,timeout=60,check=True):return subprocess.run(cmd,env=env,capture_output=True,text=True,timeout=timeout,check=check)
run(adb,'start-server')
with (out/'emulator.log').open('w') as log:
    emulator=subprocess.Popen([str(sdk/'emulator/emulator'),'-avd',args.avd,'-no-window','-no-audio','-no-boot-anim','-no-snapshot','-accel','off','-gpu','swiftshader','-memory','2048','-cores','4','-camera-back','none','-camera-front','none','-port','5554'],env=env,stdout=log,stderr=subprocess.STDOUT)
    try:
        booted=False
        for i in range(180):
            if emulator.poll() is not None:raise RuntimeError('Test emulator stopped; see local emulator.log')
            result=run(adb,'-s','emulator-5554','shell','getprop','sys.boot_completed',timeout=8,check=False)
            if result.returncode==0 and result.stdout.strip()=='1':booted=True;break
            if i%20==0:print('Android 16 test device starting',flush=True)
            time.sleep(2)
        if not booted:raise RuntimeError('Software-emulated Android did not finish booting within the test budget')
        print('Android 16 test device booted',flush=True)
        run(adb,'-s','emulator-5554','shell','input','keyevent','82')
        run(adb,'-s','emulator-5554','install','-r','-g',args.apk,timeout=180)
        print('App installed on Android 16 test device',flush=True)
        run(adb,'-s','emulator-5554','shell','svc','wifi','disable',check=False)
        run(adb,'-s','emulator-5554','shell','svc','data','disable',check=False)
        if args.test_apk and pathlib.Path(args.test_apk).exists():
            run(adb,'-s','emulator-5554','install','-r',args.test_apk,timeout=120)
            native=run(adb,'-s','emulator-5554','shell','am','instrument','-w','-r','com.holocard.scanner.test/androidx.test.runner.AndroidJUnitRunner',timeout=600,check=False)
            (out/'instrumentation.txt').write_text(native.stdout+'\n'+native.stderr)
            print(native.stdout[-3000:],flush=True)
        run(adb,'-s','emulator-5554','shell','am','start','-n','com.holocard.scanner/.MainActivity')
        time.sleep(5)
        run(adb,'-s','emulator-5554','shell','screencap','-p','/sdcard/holo-app-screen.png')
        run(adb,'-s','emulator-5554','pull','/sdcard/holo-app-screen.png',str(out/'app-screen.png'))
        report=run(adb,'-s','emulator-5554','shell','run-as','com.holocard.scanner','cat','files/photo-regression.json',check=False)
        if report.returncode==0:(out/'android-photo-regression.json').write_text(report.stdout)
        logs=run(adb,'-s','emulator-5554','logcat','-d','-s','AndroidRuntime:E',check=False)
        (out/'android-errors.txt').write_text(logs.stdout)
        print('Native test results and screenshot saved',flush=True)
    finally:
        run(adb,'-s','emulator-5554','emu','kill',timeout=10,check=False)
        if emulator.poll() is None:emulator.terminate()
