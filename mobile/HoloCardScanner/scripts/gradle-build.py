"""Use the environment's configured HTTPS proxy, without storing credentials in the project."""
import os, pathlib, subprocess, sys, urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
gradle=os.environ.get('HOLO_GRADLE',str(root/'gradlew'))
args=[gradle,'--no-daemon']
if os.environ.get('HOLO_JAVA_TRUSTSTORE'):
    args += ['-Djavax.net.ssl.trustStore='+os.environ['HOLO_JAVA_TRUSTSTORE']]
proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if proxy:
    p=urllib.parse.urlparse(proxy)
    if p.hostname:
        for protocol in ('http','https'):
            args += [f'-D{protocol}.proxyHost={p.hostname}',f'-D{protocol}.proxyPort={p.port or 80}']
args += sys.argv[1:] or [':app:testDebugUnitTest',':app:assembleDebug']
subprocess.run(args,cwd=root,check=True)
