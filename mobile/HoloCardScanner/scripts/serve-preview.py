"""Local-only UI review adapter. Never a production web server.
Cloud auth is explicitly unavailable here; missing artwork is not fetched.
"""
import http.server, json, pathlib, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]/'app/src/main/assets'
art=json.loads((ROOT/'art-map.json').read_text())
cards=(ROOT/'cards.json').read_text()
for original,local in art.items():cards=cards.replace(original,local)
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path=urllib.parse.urlparse(self.path).path
        if path=='/qa.html':
            body=b'<!doctype html><title>Android app UI review</title><body style="margin:0;background:#252b28"><iframe title="Phone preview" src="/app/index.html" style="display:block;width:390px;height:844px;border:0;margin:16px auto"></iframe></body>';mime='text/html'
        elif path=='/cards.json':body=cards.encode();mime='application/json'
        elif path.startswith('/api/'):
            body=b'{"user":null,"error":"Preview only: cloud account is unavailable."}';mime='application/json'
        else:
            if path=='/':path='/app/index.html'
            file=(ROOT/path.lstrip('/')).resolve()
            if not file.is_relative_to(ROOT) or not file.is_file():self.send_error(404);return
            body=file.read_bytes();mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.webp':'image/webp'}.get(file.suffix,'application/octet-stream')
        self.send_response(200);self.send_header('Content-Type',mime+'; charset=utf-8');self.end_headers();self.wfile.write(body)
    def log_message(self,*args):pass
print('Local UI review: http://127.0.0.1:8337/qa.html',flush=True)
http.server.ThreadingHTTPServer(('0.0.0.0',8337),Handler).serve_forever()
