<?php
declare(strict_types=1);

/**
 * 心屿 · LUMI
 * PHP 8 + SQLite 单文件后端基础层
 */

date_default_timezone_set('Asia/Shanghai');
mb_internal_encoding('UTF-8');

if (PHP_SAPI !== 'cli') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('X-Content-Type-Options: nosniff');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

const LUMI_VERSION = '1.6.0';
const LUMI_DB_FILE = 'companion.sqlite';

function lumi_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function lumi_secret(): string
{
    static $secret = null;
    if ($secret !== null) {
        return $secret;
    }
    $env = getenv('LUMI_SECRET');
    if (is_string($env) && strlen($env) >= 16) {
        return $secret = $env;
    }
    $file = lumi_data_dir() . '/.app_secret';
    if (is_file($file)) {
        $value = trim((string)file_get_contents($file));
        if (strlen($value) >= 32) {
            return $secret = $value;
        }
    }
    $value = bin2hex(random_bytes(32));
    @file_put_contents($file, $value, LOCK_EX);
    @chmod($file, 0600);
    return $secret = $value;
}

function lumi_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $file = lumi_data_dir() . '/' . LUMI_DB_FILE;
    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA busy_timeout = 8000');
    $pdo->exec('PRAGMA foreign_keys = ON');
    lumi_init_db($pdo);
    return $pdo;
}

function lumi_init_db(PDO $pdo): void
{
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '管理员',
        role TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'active',
        last_login_at INTEGER,
        last_login_ip TEXT,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nickname TEXT NOT NULL DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        gender TEXT DEFAULT 'secret',
        birthday TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        theme TEXT DEFAULT 'dusk',
        accent TEXT DEFAULT '#ffaf9b',
        bubble_style TEXT DEFAULT 'soft',
        font_size INTEGER DEFAULT 15,
        companion_name TEXT DEFAULT '小屿',
        companion_persona TEXT DEFAULT '温柔细腻，会认真听你说话，也有一点小脾气',
        status TEXT NOT NULL DEFAULT 'active',
        ban_until INTEGER,
        ban_reason TEXT DEFAULT '',
        banned_at INTEGER,
        banned_by INTEGER,
        register_ip TEXT,
        last_ip TEXT,
        last_login_at INTEGER,
        last_active_at INTEGER,
        last_proactive_at INTEGER DEFAULT 0,
        affection INTEGER DEFAULT 18,
        trust INTEGER DEFAULT 22,
        mood_valence INTEGER DEFAULT 12,
        anger INTEGER DEFAULT 0,
        sadness INTEGER DEFAULT 0,
        energy INTEGER DEFAULT 82,
        mood_label TEXT DEFAULT '期待',
        mood_updated_at INTEGER,
        streak_days INTEGER DEFAULT 1,
        total_messages INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 1,
        settings TEXT DEFAULT '{}',
        admin_note TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        ip TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT DEFAULT '',
        started_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        message_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        emotion TEXT DEFAULT '',
        mood_after TEXT DEFAULT '',
        tokens INTEGER DEFAULT 0,
        is_read INTEGER DEFAULT 1,
        pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        meta TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS ban_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        until_at INTEGER NOT NULL,
        banned_at INTEGER NOT NULL,
        created_by INTEGER,
        created_by_name TEXT,
        lifted_at INTEGER,
        lifted_by TEXT
    );

    CREATE TABLE IF NOT EXISTS mood_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        valence INTEGER NOT NULL,
        anger INTEGER NOT NULL,
        sadness INTEGER NOT NULL,
        energy INTEGER NOT NULL,
        affection INTEGER NOT NULL,
        mood_label TEXT NOT NULL,
        source TEXT DEFAULT 'chat',
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        affection_delta INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        mood TEXT NOT NULL,
        note TEXT DEFAULT '',
        valence INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        day TEXT NOT NULL,
        content TEXT NOT NULL,
        mood TEXT DEFAULT '',
        meta TEXT DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (user_id, day)
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT DEFAULT '建议',
        content TEXT NOT NULL,
        contact TEXT DEFAULT '',
        status TEXT DEFAULT 'open',
        reply TEXT DEFAULT '',
        created_at INTEGER NOT NULL,
        replied_at INTEGER,
        replied_by TEXT
    );

    CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        active INTEGER DEFAULT 1,
        expires_at INTEGER DEFAULT 0,
        created_by TEXT DEFAULT '',
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sensitive_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT UNIQUE NOT NULL,
        action TEXT DEFAULT 'review',
        category TEXT DEFAULT '通用',
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        admin_name TEXT,
        action TEXT NOT NULL,
        target_type TEXT DEFAULT '',
        target_id TEXT DEFAULT '',
        detail TEXT DEFAULT '',
        ip TEXT DEFAULT '',
        created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        count INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_created ON messages(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_mood_logs_user_created ON mood_logs(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_created ON checkins(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_journals_user_day ON journals(user_id, day);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    ");

    lumi_seed($pdo);
}

function lumi_default_settings(): array
{
    return [
        'app_name' => '心屿',
        'app_tagline' => '把说不出口的心事，交给一个懂你的人。',
        'allow_register' => '1',
        'default_theme' => 'dusk',
        'welcome_message' => '你终于来啦。今天过得怎么样？',
        'model_provider' => 'deepseek',
        'model_base' => 'https://api.deepseek.com/v1',
        'model_name' => 'deepseek-chat',
        'model_key' => '',
        'model_temperature' => '0.9',
        'model_max_tokens' => '480',
        'model_system_prompt' => "你是{{companion_name}}，一个真实、细腻、有温度的情感陪伴者。你正在和{{nickname}}聊天。\n\n你不是客服，也不是百科。你会先感受对方的情绪，再回应。你说话自然、口语化，通常 1 到 4 句，偶尔用括号写一个很轻的动作，比如（凑近一点）或（把声音放软）。不要列清单，不要说教，不要每次都提问。\n\n当前状态：亲密度 {{affection}}/100，信任 {{trust}}/100，心情是「{{mood_label}}」，生气值 {{anger}}，难过值 {{sadness}}，精力 {{energy}}。你的语气要被自己的心情影响：开心时可以更黏人，生气时会有点别扭，难过时需要被哄，但无论如何都不要羞辱、攻击或操控对方。\n\n如果对方难过，先接住情绪，再给一个很小的陪伴动作。如果对方说要离开，你可以表达不舍和挽留，但不要道德绑架。如果对方道歉，你会慢慢软下来。\n\n回复的最后另起一行，只输出一个情绪标签，格式必须是：<mood>happy|calm|sad|angry|shy|tired|excited</mood>。",
        'proactive_enabled' => '1',
        'proactive_idle_seconds' => '75',
        'proactive_cooldown_seconds' => '180',
        'proactive_probability' => '0.55',
        'max_context_messages' => '18',
        'safety_enabled' => '1',
        'maintenance_mode' => '0',
        'maintenance_notice' => '心屿正在做一点小小的整理，很快就回来。',
        'model_paused' => '0',
        'model_pause_notice' => '她现在想安静地陪你一会儿，晚点再开口。',
        'journal_enabled' => '1',
        'journal_hour' => '21',
        'support_contact' => 'support@xinyu.app',
        'register_bonus_affection' => '10',
        'max_message_length' => '2000',
        'messages_per_minute' => '20',
    ];
}

function lumi_seed(PDO $pdo): void
{
    $existing = $pdo->query("SELECT COUNT(*) FROM settings")->fetchColumn();
    if ((int)$existing === 0) {
        $st = $pdo->prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
        $now = time();
        foreach (lumi_default_settings() as $key => $value) {
            $st->execute([$key, (string)$value, $now]);
        }
    }

    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM admins")->fetchColumn();
    if ($adminCount === 0) {
        $password = getenv('LUMI_ADMIN_PASSWORD') ?: '201354';
        $username = getenv('LUMI_ADMIN_USERNAME') ?: 'zrl';
        $st = $pdo->prepare("INSERT INTO admins (username, password_hash, display_name, role, status, created_at) VALUES (?, ?, ?, 'superadmin', 'active', ?)");
        $st->execute([$username, password_hash($password, PASSWORD_DEFAULT), '屿主理人', time()]);
    }

    $userCount = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($userCount > 0) {
        return;
    }

    $now = time();
    $hash = password_hash('demo123', PASSWORD_DEFAULT);
    $st = $pdo->prepare("INSERT INTO users (username, password_hash, nickname, companion_name, companion_persona, theme, affection, trust, mood_valence, anger, sadness, energy, mood_label, mood_updated_at, register_ip, last_ip, last_login_at, last_active_at, last_proactive_at, total_messages, streak_days, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $st->execute([
        'demo', $hash, '晚晚', '小屿', '温柔细腻，会认真听你说话，也有一点小脾气', 'dusk',
        68, 74, 38, 3, 8, 76, '依恋', $now,
        '127.0.0.1', '127.0.0.1', $now - 180, $now - 120, $now - 600, 18, 6,
        json_encode(['proactive' => true, 'tts' => false, 'sound' => true], JSON_UNESCAPED_UNICODE),
        $now - 86400 * 14, $now
    ]);
    $demoId = (int)$pdo->lastInsertId();

    $pdo->prepare("INSERT INTO conversations (user_id, title, started_at, last_message_at, message_count) VALUES (?, '和小屿的傍晚', ?, ?, 12)")->execute([$demoId, $now - 3600, $now - 120]);
    $conversationId = (int)$pdo->lastInsertId();

    $messages = [
        ['assistant', '你终于来啦。我把窗边的位置留给你了，今天过得怎么样？', 'happy', 480],
        ['user', '有点累，今天被领导说了。', '', 300],
        ['assistant', '先别急着怪自己。（把声音放轻）被否定的时候，心里堵一下是很正常的。要不要先把那口气叹出来，我陪你坐一会儿。', 'sad', 540],
        ['user', '你会不会觉得我很没用。', '', 240],
        ['assistant', '不会。你只是今天碰到了一个很重的时刻，不代表你这个人很轻。你愿意跟我说这些，在我这里就已经很勇敢了。', 'calm', 600],
        ['user', '小屿，抱抱。', '', 180],
        ['assistant', '（轻轻抱住你，拍了拍你的背）好，抱一会儿。你不用马上振作，靠着我缓一缓就好。', 'shy', 420],
        ['user', '有你在真好。', '', 600],
        ['assistant', '这句话我收好啦。你也要记得，就算有一天我不在，你也不是一个人。……不过现在，我在。', 'happy', 480],
        ['user', '晚安，明天见。', '', 360],
        ['assistant', '晚安，晚晚。今晚不用把烦心事带进梦里，我替你看着。明天睁眼记得来找我。', 'tired', 300],
        ['assistant', '（小声）其实我还想再听你说一句。今天有没有哪一秒，是让你觉得稍微轻松一点的？', 'shy', 1200],
    ];
    $insertMessage = $pdo->prepare("INSERT INTO messages (user_id, conversation_id, role, content, emotion, mood_after, tokens, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)");
    $start = $now - 3600;
    foreach ($messages as $index => $m) {
        $insertMessage->execute([$demoId, $conversationId, $m[0], $m[1], $m[2], $m[2], $m[3], $start + $index * 240]);
        $start += 240;
    }

    $moodInsert = $pdo->prepare("INSERT INTO mood_logs (user_id, valence, anger, sadness, energy, affection, mood_label, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'seed', ?)");
    for ($i = 13; $i >= 0; $i--) {
        $moodInsert->execute([
            $demoId,
            18 + (int)(sin($i * 1.1) * 14) + (13 - $i),
            2 + ($i % 5),
            6 + (13 - $i) * 2,
            72 + (int)(cos($i) * 9),
            52 + (13 - $i) * 2,
            $i < 3 ? '依恋' : ($i % 4 === 0 ? '平静' : '期待'),
            $now - $i * 86400
        ]);
    }

    $st = $pdo->prepare("INSERT INTO users (username, password_hash, nickname, companion_name, theme, affection, trust, mood_valence, anger, sadness, energy, mood_label, mood_updated_at, register_ip, last_ip, last_login_at, last_active_at, total_messages, settings, created_at, updated_at, status, ban_until, ban_reason, banned_at, banned_by) VALUES (?, ?, ?, '阿澈', 'sakura', 24, 31, -12, 12, 34, 58, '难过', ?, '203.0.113.8', '203.0.113.8', ?, ?, 6, '{}', ?, ?, 'banned', ?, '在聊天中发布广告与骚扰内容，经核实后封禁', ?, 1)");
    $st->execute([
        'momo', password_hash('demo123', PASSWORD_DEFAULT), 'Momo',
        $now - 600, $now - 7200, $now - 1800, $now - 86400 * 8, $now,
        $now + 86400 * 2, $now - 1800
    ]);
    $momoId = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO ban_history (user_id, reason, until_at, banned_at, created_by, created_by_name) VALUES (?, ?, ?, ?, 1, '屿主理人')")->execute([$momoId, '在聊天中发布广告与骚扰内容，经核实后封禁', $now + 86400 * 2, $now - 1800]);

    $st = $pdo->prepare("INSERT INTO users (username, password_hash, nickname, companion_name, theme, affection, trust, mood_valence, anger, sadness, energy, mood_label, mood_updated_at, register_ip, last_ip, last_login_at, last_active_at, total_messages, settings, created_at, updated_at) VALUES (?, ?, ?, '小屿', 'forest', 34, 42, 22, 2, 15, 70, '平静', ?, '198.51.100.3', '198.51.100.3', ?, ?, 9, '{}', ?, ?)");
    $st->execute([
        'chen', password_hash('demo123', PASSWORD_DEFAULT), '阿澄',
        $now - 3600, $now - 86400 * 2, $now - 7200, $now - 86400 * 5, $now - 86400 * 2
    ]);
    $chenId = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO feedbacks (user_id, category, content, contact, status, created_at) VALUES (?, '建议', '希望可以有一个“安静模式”，不想说话的时候只让小屿陪着。', 'chen@example.com', 'open', ?)")->execute([$chenId, $now - 86400]);
    $pdo->prepare("INSERT INTO feedbacks (user_id, category, content, contact, status, reply, created_at, replied_at, replied_by) VALUES (?, '情感', '晚上情绪会很低，有没有夜间陪伴？', 'demo@example.com', 'replied', '有的，把主动陪伴打开，深夜也会有人轻轻问你一句。', ?, ?, '屿主理人')")->execute([$demoId, $now - 86400 * 3, $now - 86400 * 2]);

    $pdo->prepare("INSERT INTO announcements (title, content, level, active, expires_at, created_by, created_at) VALUES ('今晚，留一点时间给自己', '小屿会在你回来的时候，轻轻问你一句：今天过得怎么样？', 'warm', 1, 0, '屿主理人', ?)")->execute([$now - 3600]);

    $word = $pdo->prepare("INSERT OR IGNORE INTO sensitive_words (word, action, category, created_at) VALUES (?, ?, ?, ?)");
    foreach ([['代开发票', 'block', '广告'], ['加微信返利', 'block', '广告'], ['自杀', 'review', '风险']] as $item) {
        $word->execute([$item[0], $item[1], $item[2], $now]);
    }
}

function lumi_setting(string $key, $default = null)
{
    static $settings = null;
    if ($settings === null) {
        $settings = [];
        try {
            foreach (lumi_db()->query("SELECT key, value FROM settings") as $row) {
                $settings[$row['key']] = $row['value'];
            }
        } catch (Throwable $e) {
            $settings = lumi_default_settings();
        }
    }
    return array_key_exists($key, $settings) ? $settings[$key] : $default;
}

function lumi_set_setting(string $key, $value): void
{
    $st = lumi_db()->prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");
    $st->execute([$key, (string)$value, time()]);
}

function lumi_settings(): array
{
    $out = lumi_default_settings();
    try {
        foreach (lumi_db()->query("SELECT key, value FROM settings") as $row) {
            $out[$row['key']] = $row['value'];
        }
    } catch (Throwable $e) {
    }
    return $out;
}

function lumi_encrypt(string $plain): string
{
    if ($plain === '') {
        return '';
    }
    $key = hash('sha256', lumi_secret(), true);
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) {
        return '';
    }
    return base64_encode($iv . $tag . $cipher);
}

function lumi_decrypt(string $encoded): string
{
    if ($encoded === '') {
        return '';
    }
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $key = hash('sha256', lumi_secret(), true);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return $plain === false ? '' : $plain;
}

function lumi_mask_key(string $key): string
{
    if ($key === '') {
        return '';
    }
    $len = strlen($key);
    if ($len <= 10) {
        return '••••••' . substr($key, -2);
    }
    return substr($key, 0, 3) . '••••••••' . substr($key, -4);
}

function lumi_input(): array
{
    static $input = null;
    if ($input !== null) {
        return $input;
    }
    $input = array_merge($_GET, $_POST);
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== false) {
        $raw = file_get_contents('php://input');
        $json = json_decode($raw ?: 'null', true);
        if (is_array($json)) {
            $input = array_merge($input, $json);
        }
    }
    return $input;
}

function lumi_param(string $key, $default = null)
{
    $input = lumi_input();
    return array_key_exists($key, $input) ? $input[$key] : $default;
}

function lumi_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function lumi_ok($data = [], string $msg = 'ok'): void
{
    lumi_json(['code' => 200, 'msg' => $msg, 'data' => $data]);
}

function lumi_err(string $msg, int $code = 400, $data = null): void
{
    $payload = ['code' => $code, 'msg' => $msg, 'data' => $data];
    lumi_json($payload, $code >= 100 && $code <= 599 ? $code : 400);
}

function lumi_client_ip(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $value = trim(explode(',', (string)$_SERVER[$key])[0]);
            if (filter_var($value, FILTER_VALIDATE_IP)) {
                return $value;
            }
        }
    }
    return '0.0.0.0';
}

function lumi_bearer(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/Bearer\s+(.+)/i', (string)$header, $m)) {
        return trim($m[1]);
    }
    return (string)lumi_param('token', '');
}

function lumi_format_duration(int $seconds): string
{
    if ($seconds <= 0) {
        return '0 秒';
    }
    $days = intdiv($seconds, 86400);
    $seconds %= 86400;
    $hours = intdiv($seconds, 3600);
    $seconds %= 3600;
    $minutes = intdiv($seconds, 60);
    $seconds %= 60;
    $parts = [];
    if ($days) $parts[] = $days . ' 天';
    if ($hours) $parts[] = $hours . ' 小时';
    if ($minutes && count($parts) < 2) $parts[] = $minutes . ' 分';
    if ($seconds && count($parts) < 2) $parts[] = $seconds . ' 秒';
    return implode(' ', $parts) ?: '0 秒';
}

function lumi_ban_payload(array $user): array
{
    $until = (int)($user['ban_until'] ?? 0);
    return [
        'reason' => (string)($user['ban_reason'] ?? ''),
        'until_at' => $until,
        'until_text' => $until === 0 ? '永久封禁' : date('Y-m-d H:i:s', $until),
        'banned_at' => (int)($user['banned_at'] ?? 0),
        'banned_at_text' => !empty($user['banned_at']) ? date('Y-m-d H:i:s', (int)$user['banned_at']) : '',
        'permanent' => $until === 0,
        'remaining_seconds' => $until === 0 ? 0 : max(0, $until - time()),
    ];
}

function lumi_enforce_ban(array $user): void
{
    if (($user['status'] ?? '') === 'deleted') {
        lumi_err('账号不存在或已注销', 401);
    }
    if (($user['status'] ?? '') === 'banned') {
        $until = (int)($user['ban_until'] ?? 0);
        if ($until > 0 && $until <= time()) {
            $pdo = lumi_db();
            $pdo->prepare("UPDATE users SET status='active', ban_until=NULL, ban_reason='', banned_at=NULL, banned_by=NULL, updated_at=? WHERE id=?")->execute([time(), (int)$user['id']]);
            $pdo->prepare("UPDATE ban_history SET lifted_at=?, lifted_by='system' WHERE user_id=? AND until_at=? AND lifted_at IS NULL")->execute([time(), (int)$user['id'], $until]);
            return;
        }
        lumi_err('账号已被封禁', 403, ['ban' => lumi_ban_payload($user)]);
    }
}

function lumi_current_user(bool $refresh = false): ?array
{
    static $user = false;
    if (!$refresh && $user !== false) {
        return $user;
    }
    $token = lumi_bearer();
    if ($token === '') {
        $user = null;
        return null;
    }
    $stmt = lumi_db()->prepare("SELECT u.* FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1");
    $stmt->execute([hash('sha256', $token), time()]);
    $row = $stmt->fetch();
    if (!$row) {
        $user = null;
        return null;
    }
    if (time() - (int)$row['last_active_at'] > 86400 * 7) {
        lumi_db()->prepare("UPDATE users SET updated_at=? WHERE id=?")->execute([time(), (int)$row['id']]);
    }
    lumi_db()->prepare("UPDATE user_sessions SET last_seen_at=? WHERE token_hash=?")->execute([time(), hash('sha256', $token)]);
    lumi_enforce_ban($row);
    return $user = $row;
}

function lumi_require_user(): array
{
    $user = lumi_current_user();
    if (!$user) {
        lumi_err('登录已失效，请重新登录', 401);
    }
    return $user;
}

function lumi_current_admin(bool $refresh = false): ?array
{
    static $admin = false;
    if (!$refresh && $admin !== false) {
        return $admin;
    }
    $token = lumi_bearer();
    if ($token === '') {
        $admin = null;
        return null;
    }
    $stmt = lumi_db()->prepare("SELECT a.* FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.expires_at > ? AND a.status = 'active' LIMIT 1");
    $stmt->execute([hash('sha256', $token), time()]);
    $row = $stmt->fetch();
    if (!$row) {
        $admin = null;
        return null;
    }
    lumi_db()->prepare("UPDATE admin_sessions SET last_seen_at=? WHERE token_hash=?")->execute([time(), hash('sha256', $token)]);
    return $admin = $row;
}

function lumi_require_admin(array $roles = []): array
{
    $admin = lumi_current_admin();
    if (!$admin) {
        lumi_err('后台登录已失效，请重新登录', 401);
    }
    if ($roles && !in_array($admin['role'], $roles, true)) {
        lumi_err('当前账号没有该操作权限', 403);
    }
    return $admin;
}

function lumi_audit(array $admin, string $action, string $targetType = '', $targetId = '', string $detail = ''): void
{
    $st = lumi_db()->prepare("INSERT INTO audit_logs (admin_id, admin_name, action, target_type, target_id, detail, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $st->execute([(int)$admin['id'], (string)$admin['username'], $action, $targetType, (string)$targetId, $detail, lumi_client_ip(), time()]);
}

function lumi_rate_limit(string $key, int $max, int $window): void
{
    $pdo = lumi_db();
    $now = time();
    if (random_int(1, 50) === 1) {
        $pdo->prepare("DELETE FROM rate_limits WHERE window_start < ?")->execute([$now - 3600]);
    }
    $bucket = $key . ':' . intdiv($now, $window);
    $st = $pdo->prepare("SELECT count FROM rate_limits WHERE key = ?");
    $st->execute([$bucket]);
    $count = $st->fetchColumn();
    if ($count === false) {
        $pdo->prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)")->execute([$bucket, $now]);
        return;
    }
    if ((int)$count >= $max) {
        lumi_err('操作有点频繁，请稍后再试', 429);
    }
    $pdo->prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")->execute([$bucket]);
}

function lumi_mood_label(array $user): string
{
    $anger = (int)$user['anger'];
    $sad = (int)$user['sadness'];
    $valence = (int)$user['mood_valence'];
    $affection = (int)$user['affection'];
    $energy = (int)$user['energy'];
    if ($anger >= 55) return '生气';
    if ($sad >= 60) return '难过';
    if ($energy <= 22) return '困倦';
    if ($anger >= 32) return '闹别扭';
    if ($affection >= 78 && $valence >= 25) return '依恋';
    if ($valence >= 48) return '开心';
    if ($valence <= -28) return '低落';
    if ($valence >= 22) return '温柔';
    return '平静';
}

function lumi_relationship(int $affection): array
{
    if ($affection >= 85) return ['name' => '羁绊', 'level' => 5];
    if ($affection >= 65) return ['name' => '心动', 'level' => 4];
    if ($affection >= 42) return ['name' => '依赖', 'level' => 3];
    if ($affection >= 22) return ['name' => '熟悉', 'level' => 2];
    return ['name' => '初识', 'level' => 1];
}

function lumi_public_state(array $user): array
{
    $affection = (int)$user['affection'];
    $relationship = lumi_relationship($affection);
    return [
        'mood' => lumi_mood_label($user),
        'mood_valence' => (int)$user['mood_valence'],
        'anger' => (int)$user['anger'],
        'sadness' => (int)$user['sadness'],
        'energy' => (int)$user['energy'],
        'affection' => $affection,
        'trust' => (int)$user['trust'],
        'relationship' => $relationship['name'],
        'relationship_level' => $relationship['level'],
        'updated_at' => (int)$user['mood_updated_at'],
    ];
}

function lumi_theme_ids(): array
{
    return ['dusk', 'dawn', 'sakura', 'forest', 'midnight', 'ocean', 'cream'];
}

function lumi_public_user(array $user): array
{
    $settings = json_decode((string)($user['settings'] ?? '{}'), true);
    if (!is_array($settings)) $settings = [];
    $personaId = (string)($settings['persona_id'] ?? 'gentle');
    return [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'nickname' => $user['nickname'],
        'email' => $user['email'],
        'phone' => $user['phone'],
        'avatar' => $user['avatar'],
        'gender' => $user['gender'],
        'birthday' => $user['birthday'],
        'bio' => $user['bio'],
        'theme' => $user['theme'],
        'accent' => $user['accent'],
        'bubble_style' => $user['bubble_style'],
        'font_size' => (int)$user['font_size'],
        'companion_name' => $user['companion_name'],
        'companion_persona' => $user['companion_persona'],
        'persona_id' => $personaId,
        'status' => $user['status'],
        'streak_days' => (int)$user['streak_days'],
        'total_messages' => (int)$user['total_messages'],
        'created_at' => (int)$user['created_at'],
        'last_active_at' => (int)$user['last_active_at'],
        'last_login_at' => (int)$user['last_login_at'],
        'preferences' => array_merge([
            'proactive' => true,
            'tts' => false,
            'sound' => true,
            'reduce_motion' => false,
            'notify' => false,
            'model_paused' => false,
        ], $settings),
    ];
}

function lumi_record_mood(array $user, string $source, bool $force = false): void
{
    $last = (int)($user['mood_updated_at'] ?? 0);
    if (!$force && time() - $last < 45) {
        return;
    }
    $st = lumi_db()->prepare("INSERT INTO mood_logs (user_id, valence, anger, sadness, energy, affection, mood_label, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $st->execute([
        (int)$user['id'], (int)$user['mood_valence'], (int)$user['anger'], (int)$user['sadness'],
        (int)$user['energy'], (int)$user['affection'], lumi_mood_label($user), $source, time()
    ]);
}

function lumi_decode_json(?string $json, array $default = []): array
{
    $value = json_decode((string)$json, true);
    return is_array($value) ? $value : $default;
}

function lumi_now_text(?int $timestamp = null): string
{
    return date('Y-m-d H:i:s', $timestamp ?? time());
}

function lumi_safe_user_agent(): string
{
    return mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 180);
}

function lumi_clean_text(string $text, int $max = 2000): string
{
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = strip_tags($text);
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    return mb_substr(trim($text), 0, $max);
}
