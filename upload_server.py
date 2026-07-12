#!/usr/bin/env python3
import os, json, cgi, hashlib, time, base64, binascii, zipfile, io
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(WORKSPACE_DIR, 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_SIZE = 100 * 1024 * 1024  # 100MB

GAME_DATA_DIR = os.path.join(WORKSPACE_DIR, 'uploads', 'data')
os.makedirs(GAME_DATA_DIR, exist_ok=True)

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

def hash_password(pwd):
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', pwd.encode(), salt, 100000)
    return binascii.hexlify(salt + dk).decode()

def verify_password(pwd, hashed):
    try:
        raw = binascii.unhexlify(hashed)
        salt, stored = raw[:16], raw[16:]
        dk = hashlib.pbkdf2_hmac('sha256', pwd.encode(), salt, 100000)
        return dk == stored
    except:
        return False

def get_user_file(username):
    return os.path.join(GAME_DATA_DIR, username + '.json')

def handle_api(handler, qs):
    action = qs.get('action', [None])[0]

    if action == 'register':
        username = (qs.get('name', [''])[0] or '').strip()
        password = qs.get('pwd', [''])[0] or ''
        if not username or not password:
            return {'code': 400, 'msg': '用户名或密码不能为空'}
        if len(username) < 2 or len(username) > 20:
            return {'code': 400, 'msg': '用户名长度2-20'}
        fpath = get_user_file(username)
        if os.path.exists(fpath):
            return {'code': 400, 'msg': '用户名已被注册'}
        data = {
            'name': username, 'stage': 0, 'exp': 0, 'maxExp': 1000,
            'age': 18, 'life': 100, 'grade': 0, 'dead': False,
            'stones': 1000, 'cores': 0, 'pills': 5, 'fame': 0,
            'skills': ['base'],
            'herbs': {'lingzhi': 0, 'xueying': 0, 'tianxin': 0, 'hunyuan': 0},
            'attrs': {'str': 10, 'int': 10, 'vit': 10, 'luk': 10},
            'auto': False, 'clickLevel': 0, 'friends': [],
            'chatHistory': {}, 'unreadMessages': {},
            'challenges': [], 'powerPills': 0, 'shopPurchased': {},
            'rebirthCount': 0,
            'dataVerify': {'enabled': True, 'restricted': False, 'restrictUntil': None,
                           'banReason': None, 'lastStoneCheck': 0, 'lastCheckTime': int(time.time() * 1000)},
            'lastChallengeTime': 0, 'lastLogoutTime': None,
            'lastSaveTime': int(time.time() * 1000),
            'signInData': None, 'taskData': None,
            'clanData': {'clanId': None, 'clanName': None, 'contribution': 0,
                         'joinTime': 0, 'disciples': [], 'master': None,
                         'clanTasks': {}, 'lastTaskReset': int(time.time() * 1000)},
            'partner': None, 'partnerBond': 0,
            'partnerData': {'lastDualCultivation': 0, 'totalDual': 0,
                            'marriedTime': None, 'marriageCooldownEnd': None,
                            'lastBreakupTime': None},
            'proposals': [], 'notifications': [], 'sadnessBuff': None,
            'qingmingEvent': None
        }
        data['password'] = hash_password(password)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        return {'code': 200, 'msg': '注册成功', 'data': {'username': username}}

    elif action == 'login':
        username = (qs.get('name', [''])[0] or '').strip()
        password = qs.get('pwd', [''])[0] or ''
        if not username or not password:
            return {'code': 400, 'msg': '用户名或密码不能为空'}
        fpath = get_user_file(username)
        if not os.path.exists(fpath):
            return {'code': 400, 'msg': '用户不存在'}
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not verify_password(password, data.get('password', '')):
            return {'code': 400, 'msg': '密码错误'}
        dv = data.get('dataVerify', {})
        if dv.get('restricted') and (dv.get('restrictUntil') or 0) > time.time() * 1000:
            return {'code': 403, 'msg': '账号已被封禁', 'until': dv.get('restrictUntil')}
        data.pop('password', None)
        return {'code': 200, 'msg': '登录成功', 'data': data}

    elif action == 'save':
        username = (qs.get('name', [''])[0] or '').strip()
        payload = qs.get('data', [''])[0] or ''
        if not username or not payload:
            return {'code': 400, 'msg': '缺少参数'}
        fpath = get_user_file(username)
        if not os.path.exists(fpath):
            return {'code': 400, 'msg': '用户不存在'}
        with open(fpath, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        try:
            new_data = json.loads(base64.b64decode(payload).decode('utf-8'))
        except:
            return {'code': 400, 'msg': '数据格式错误'}
        new_data['password'] = existing.get('password', '')
        new_data['lastSaveTime'] = int(time.time() * 1000)
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False)
        return {'code': 200, 'msg': '保存成功'}

    elif action == 'load':
        username = (qs.get('name', [''])[0] or '').strip()
        if not username:
            return {'code': 400, 'msg': '缺少用户名'}
        fpath = get_user_file(username)
        if not os.path.exists(fpath):
            return {'code': 400, 'msg': '用户不存在'}
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data.pop('password', None)
        return {'code': 200, 'msg': '加载成功', 'data': data}

    return {'code': 400, 'msg': '无效操作'}

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
        elif path == '/api.php':
            self.send_json(handle_api(self, qs))
        elif path == '/batch-download':
            names = qs.get('names', [''])[0]
            if not names:
                self.send_json({'success': False, 'error': '请选择文件'}, 400)
                return
            names = [safe_filename(n.strip()) for n in names.split(',') if n.strip()]
            if not names:
                self.send_json({'success': False, 'error': '请选择文件'}, 400)
                return

            buf = io.BytesIO()
            with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                for n in names:
                    fp = os.path.join(UPLOAD_DIR, n)
                    if os.path.isfile(fp):
                        zf.write(fp, n)

            buf.seek(0)
            data = buf.getvalue()
            zip_name = 'files_{}.zip'.format(time.strftime('%Y%m%d_%H%M%S'))
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Disposition', 'attachment; filename="{}"'.format(zip_name))
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)
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
            self.send_json({'success': True, 'filename': os.path.basename(filepath),
                            'size': len(content.encode('utf-8'))})

        elif path == '/delete':
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            filenames = data.get('filenames', [data.get('filename', '')])
            if isinstance(filenames, str):
                filenames = [filenames]
            deleted, missing = [], []
            for name in filenames:
                name = safe_filename(name)
                if not name: continue
                filepath = os.path.join(UPLOAD_DIR, name)
                if os.path.isfile(filepath):
                    os.remove(filepath)
                    deleted.append(name)
                else:
                    missing.append(name)
            self.send_json({'success': True, 'deleted': deleted, 'missing': missing})
        elif path == '/rename':
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            old = safe_filename(data.get('old', ''))
            new = safe_filename(data.get('new', ''))
            if not old or not new:
                self.send_json({'success': False, 'error': '参数不完整'}, 400)
                return
            oldpath = os.path.join(UPLOAD_DIR, old)
            newpath = os.path.join(UPLOAD_DIR, new)
            if not os.path.isfile(oldpath):
                self.send_json({'success': False, 'error': '文件不存在'}, 404)
                return
            if os.path.exists(newpath):
                self.send_json({'success': False, 'error': '目标文件名已存在'}, 400)
                return
            os.rename(oldpath, newpath)
            self.send_json({'success': True, 'filename': new})
        else:
            self.send_json({'success': False, 'error': 'Not Found'}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    print('服务已启动: http://localhost:8000')
    HTTPServer(('0.0.0.0', 8000), UploadHandler).serve_forever()
