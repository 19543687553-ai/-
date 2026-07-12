#!/usr/bin/env python3
import os, json, cgi
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(WORKSPACE_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_SIZE = 100 * 1024 * 1024  # 100MB

def list_files():
    files = []
    for f in sorted(os.listdir(UPLOAD_DIR)):
        fp = os.path.join(UPLOAD_DIR, f)
        if os.path.isfile(fp):
            stat = os.stat(fp)
            files.append({'name': f, 'size': stat.st_size, 'mtime': stat.st_mtime})
    return files

def safe_filename(name):
    return os.path.basename(name)

class UploadHandler(SimpleHTTPRequestHandler):
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == '/files':
            self.send_json({'files': list_files()})
        elif path == '/download':
            fname = qs.get('name', [None])[0]
            if not fname or fname == 'undefined':
                self.send_json({'success': False, 'error': '文件名不能为空'}, 400)
                return
            filepath = os.path.join(UPLOAD_DIR, safe_filename(fname))
            if not os.path.isfile(filepath):
                self.send_json({'success': False, 'error': '文件不存在'}, 404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Disposition', 'attachment; filename="{}"'.format(fname))
            self.send_header('Content-Length', str(os.path.getsize(filepath)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(filepath, 'rb') as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk: break
                    self.wfile.write(chunk)
        else:
            super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))

        if path == '/upload':
            if content_length > MAX_SIZE:
                self.send_json({'success': False, 'error': '文件过大，单文件上限 100MB'}, 413)
                return
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self.send_json({'success': False, 'error': '需要 multipart/form-data'}, 400)
                return
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers,
                                    environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': content_type})
            uploaded_files = []
            for key in form:
                item = form[key]
                if not item.filename:
                    continue
                filename = safe_filename(item.filename)
                filepath = os.path.join(UPLOAD_DIR, filename)
                counter = 1
                name, ext = os.path.splitext(filename)
                while os.path.exists(filepath):
                    filepath = os.path.join(UPLOAD_DIR, '{}_{}{}'.format(name, counter, ext))
                    counter += 1
                with open(filepath, 'wb') as f:
                    chunk = item.file.read(65536)
                    while chunk:
                        f.write(chunk)
                        chunk = item.file.read(65536)
                uploaded_files.append({
                    'original': item.filename,
                    'saved': os.path.basename(filepath),
                    'size': os.path.getsize(filepath)
                })
            self.send_json({'success': True, 'files': uploaded_files})

        elif path == '/create':
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            filename = safe_filename(data.get('filename', 'untitled'))
            content = data.get('content', '')
            filepath = os.path.join(UPLOAD_DIR, filename)
            counter = 1
            name, ext = os.path.splitext(filename)
            while os.path.exists(filepath):
                filepath = os.path.join(UPLOAD_DIR, '{}_{}{}'.format(name, counter, ext))
                counter += 1
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            self.send_json({
                'success': True,
                'filename': os.path.basename(filepath),
                'size': len(content.encode('utf-8'))
            })

        elif path == '/delete':
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            filenames = data.get('filenames', [data.get('filename', '')])
            if isinstance(filenames, str):
                filenames = [filenames]
            deleted, missing = [], []
            for name in filenames:
                name = safe_filename(name)
                if not name:
                    continue
                filepath = os.path.join(UPLOAD_DIR, name)
                if os.path.isfile(filepath):
                    os.remove(filepath)
                    deleted.append(name)
                else:
                    missing.append(name)
            self.send_json({'success': True, 'deleted': deleted, 'missing': missing})

        else:
            self.send_json({'success': False, 'error': 'Not Found'}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    print('文件上传服务已启动: http://localhost:8000')
    HTTPServer(('0.0.0.0', 8000), UploadHandler).serve_forever()
