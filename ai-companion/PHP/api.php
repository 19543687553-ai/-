<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/emotion.php';

$action = (string)lumi_param('action', '');

try {
    switch ($action) {
        // ---------- 公共 ----------
        case 'health':                 lumi_action_health(); break;
        case 'appConfig':              lumi_action_app_config(); break;
        case 'announcementPublic':     lumi_action_announcement_public(); break;

        // ---------- 用户认证 ----------
        case 'register':               lumi_action_register(); break;
        case 'login':                  lumi_action_login(); break;
        case 'logout':                 lumi_action_logout(); break;
        case 'me':                     lumi_action_me(); break;
        case 'updateProfile':          lumi_action_update_profile(); break;
        case 'changePassword':         lumi_action_change_password(); break;
        case 'deleteAccount':          lumi_action_delete_account(); break;

        // ---------- 陪伴 ----------
        case 'chat':                   lumi_action_chat(); break;
        case 'gesture':                lumi_action_gesture(); break;
        case 'poll':                   lumi_action_poll(); break;
        case 'history':                lumi_action_history(); break;
        case 'markRead':               lumi_action_mark_read(); break;
        case 'insights':               lumi_action_insights(); break;
        case 'pinMessage':             lumi_action_pin_message(); break;
        case 'feedbackCreate':         lumi_action_feedback_create(); break;
        case 'feedbackList':           lumi_action_feedback_list(); break;

        // ---------- 管理后台 ----------
        case 'adminLogin':             lumi_action_admin_login(); break;
        case 'adminLogout':            lumi_action_admin_logout(); break;
        case 'adminMe':                lumi_action_admin_me(); break;
        case 'adminStats':             lumi_action_admin_stats(); break;
        case 'adminUsers':             lumi_action_admin_users(); break;
        case 'adminUserDetail':        lumi_action_admin_user_detail(); break;
        case 'adminUpdateUser':        lumi_action_admin_update_user(); break;
        case 'adminBanUser':           lumi_action_admin_ban_user(); break;
        case 'adminUnbanUser':         lumi_action_admin_unban_user(); break;
        case 'adminResetPassword':     lumi_action_admin_reset_password(); break;
        case 'adminDeleteUser':        lumi_action_admin_delete_user(); break;
        case 'adminConversations':     lumi_action_admin_conversations(); break;
        case 'adminMessages':          lumi_action_admin_messages(); break;
        case 'adminDeleteMessage':     lumi_action_admin_delete_message(); break;
        case 'adminPinMessage':        lumi_action_admin_pin_message(); break;
        case 'adminSendMessage':       lumi_action_admin_send_message(); break;
        case 'adminMoodAnalytics':     lumi_action_admin_mood_analytics(); break;
        case 'adminSettings':          lumi_action_admin_settings(); break;
        case 'adminSaveSettings':      lumi_action_admin_save_settings(); break;
        case 'adminModelSave':         lumi_action_admin_model_save(); break;
        case 'adminModelTest':         lumi_action_admin_model_test(); break;
        case 'adminModelList':         lumi_action_admin_model_list(); break;
        case 'adminAnnouncements':     lumi_action_admin_announcements(); break;
        case 'adminAnnouncementSave':  lumi_action_admin_announcement_save(); break;
        case 'adminAnnouncementDelete':lumi_action_admin_announcement_delete(); break;
        case 'adminWords':             lumi_action_admin_words(); break;
        case 'adminWordSave':          lumi_action_admin_word_save(); break;
        case 'adminWordDelete':        lumi_action_admin_word_delete(); break;
        case 'adminFeedbacks':         lumi_action_admin_feedbacks(); break;
        case 'adminFeedbackReply':     lumi_action_admin_feedback_reply(); break;
        case 'adminAdmins':            lumi_action_admin_admins(); break;
        case 'adminAdminSave':         lumi_action_admin_save_admin(); break;
        case 'adminAdminDelete':       lumi_action_admin_delete_admin(); break;
        case 'adminAuditLogs':         lumi_action_admin_audit_logs(); break;
        case 'adminBroadcast':         lumi_action_admin_broadcast(); break;
        case 'adminBackup':            lumi_action_admin_backup(); break;
        case 'adminExportUsers':       lumi_action_admin_export_users(); break;
        case 'adminSystemInfo':        lumi_action_admin_system_info(); break;

        default:
            lumi_err('无效的接口操作', 404);
    }
} catch (Throwable $e) {
    @file_put_contents(
        lumi_data_dir() . '/error.log',
        '[' . lumi_now_text() . '] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
    lumi_err('服务暂时开小差了，请稍后再试', 500);
}

// =====================================================================
// 公共
// =====================================================================

function lumi_action_health(): void
{
    $dbOk = false;
    try {
        lumi_db()->query('SELECT 1');
        $dbOk = true;
    } catch (Throwable $e) {
    }
    lumi_ok([
        'version' => LUMI_VERSION,
        'time' => lumi_now_text(),
        'timestamp' => time(),
        'db' => $dbOk,
        'php' => PHP_VERSION,
        'model_configured' => lumi_model_config()['configured'],
        'brand' => lumi_setting('app_name', '心屿'),
    ]);
}

function lumi_action_app_config(): void
{
    lumi_ok([
        'app_name' => lumi_setting('app_name', '心屿'),
        'app_tagline' => lumi_setting('app_tagline', '把说不出口的心事，交给一个懂你的人。'),
        'allow_register' => (bool)(int)lumi_setting('allow_register', '1'),
        'default_theme' => lumi_setting('default_theme', 'dusk'),
        'support_contact' => lumi_setting('support_contact', ''),
        'maintenance_mode' => (bool)(int)lumi_setting('maintenance_mode', '0'),
        'server_time' => time(),
    ]);
}

function lumi_action_announcement_public(): void
{
    $row = lumi_db()->query("SELECT id, title, content, level, created_at FROM announcements WHERE active=1 AND (expires_at=0 OR expires_at> " . time() . ") ORDER BY id DESC LIMIT 1")->fetch();
    lumi_ok(['announcement' => $row ?: null]);
}

// =====================================================================
// 用户认证
// =====================================================================

function lumi_create_user_session(int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $now = time();
    $expires = $now + 86400 * 30;
    lumi_db()->prepare("INSERT INTO user_sessions (user_id, token_hash, ip, user_agent, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        ->execute([$userId, hash('sha256', $token), lumi_client_ip(), lumi_safe_user_agent(), $now, $now, $expires]);
    lumi_db()->prepare("DELETE FROM user_sessions WHERE user_id=? AND expires_at < ?")->execute([$userId, $now]);
    return $token;
}

function lumi_active_announcement(): ?array
{
    $now = time();
    $st = lumi_db()->prepare("SELECT id, title, content, level, created_at FROM announcements WHERE active=1 AND (expires_at=0 OR expires_at>?) ORDER BY id DESC LIMIT 1");
    $st->execute([$now]);
    $row = $st->fetch();
    return $row ?: null;
}

function lumi_unread_count(int $userId): int
{
    $st = lumi_db()->prepare("SELECT COUNT(*) FROM messages WHERE user_id=? AND is_read=0 AND role IN ('assistant','proactive','system')");
    $st->execute([$userId]);
    return (int)$st->fetchColumn();
}

function lumi_action_register(): void
{
    if (!(int)lumi_setting('allow_register', '1')) {
        lumi_err('当前暂未开放注册，请稍后再来', 403);
    }
    if ((int)lumi_setting('maintenance_mode', '0')) {
        lumi_err('心屿正在短暂维护，请稍后再来', 503);
    }
    lumi_rate_limit('register:' . lumi_client_ip(), 6, 3600);

    $username = trim((string)lumi_param('username', ''));
    $password = (string)lumi_param('password', '');
    $nickname = lumi_clean_text((string)lumi_param('nickname', ''), 20);
    $agree = (int)lumi_param('agree', 1);

    if (!preg_match('/^[\p{L}\p{N}_-]{2,20}$/u', $username)) {
        lumi_err('用户名需为 2-20 位文字、字母、数字或下划线');
    }
    if (mb_strlen($password) < 6 || mb_strlen($password) > 72) {
        lumi_err('密码长度需为 6-72 位');
    }
    if (!$agree) {
        lumi_err('请先同意陪伴协议与隐私说明');
    }
    if ($nickname === '') {
        $nickname = $username;
    }

    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT id FROM users WHERE username=? LIMIT 1");
    $st->execute([$username]);
    if ($st->fetch()) {
        lumi_err('这个名字已经被带走了，换一个试试');
    }

    $now = time();
    $theme = (string)lumi_param('theme', (string)lumi_setting('default_theme', 'dusk'));
    if (!in_array($theme, lumi_theme_ids(), true)) {
        $theme = (string)lumi_setting('default_theme', 'dusk');
    }
    $welcome = str_replace('{{nickname}}', $nickname, (string)lumi_setting('welcome_message', '你终于来啦。'));
    $bonus = (int)lumi_setting('register_bonus_affection', '10');

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare("INSERT INTO users (username, password_hash, nickname, theme, affection, trust, mood_valence, energy, mood_label, mood_updated_at, register_ip, last_ip, last_login_at, last_active_at, total_sessions, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 24, 20, 85, '期待', ?, ?, ?, ?, ?, 1, ?, ?, ?)");
        $st->execute([
            $username, password_hash($password, PASSWORD_DEFAULT), $nickname, $theme,
            min(45, 18 + $bonus), $now, lumi_client_ip(), lumi_client_ip(), $now, $now,
            json_encode(['proactive' => true, 'tts' => false, 'sound' => true], JSON_UNESCAPED_UNICODE),
            $now, $now
        ]);
        $userId = (int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO conversations (user_id, title, started_at, last_message_at, message_count) VALUES (?, ?, ?, ?, 1)")
            ->execute([$userId, date('n月j日') . '的初见', $now, $now]);
        $conversationId = (int)$pdo->lastInsertId();
        $pdo->prepare("INSERT INTO messages (user_id, conversation_id, role, content, emotion, mood_after, tokens, is_read, created_at) VALUES (?, ?, 'assistant', ?, 'shy', '期待', 0, 1, ?)")
            ->execute([$userId, $conversationId, $welcome, $now]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $user = $pdo->query("SELECT * FROM users WHERE id=" . (int)$userId)->fetch();
    lumi_record_mood($user, 'register', true);
    $token = lumi_create_user_session($userId);

    lumi_ok([
        'token' => $token,
        'user' => lumi_public_user($user),
        'state' => lumi_public_state($user),
        'announcement' => lumi_active_announcement(),
        'model_configured' => lumi_model_config()['configured'],
    ], '欢迎来到心屿');
}

function lumi_action_login(): void
{
    $username = trim((string)lumi_param('username', ''));
    $password = (string)lumi_param('password', '');
    if ($username === '' || $password === '') {
        lumi_err('请输入用户名和密码');
    }
    lumi_rate_limit('login:' . lumi_client_ip() . ':' . $username, 10, 300);

    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM users WHERE username=? LIMIT 1");
    $st->execute([$username]);
    $user = $st->fetch();
    if (!$user || !password_verify($password, (string)$user['password_hash'])) {
        lumi_err('用户名或密码不正确');
    }
    if ($user['status'] === 'deleted') {
        lumi_err('账号不存在或已注销', 401);
    }
    if ($user['status'] === 'banned') {
        lumi_enforce_ban($user);
    }

    $now = time();
    $lastLogin = (int)$user['last_login_at'];
    $streak = (int)$user['streak_days'];
    if ($lastLogin > 0) {
        $lastDay = date('Y-m-d', $lastLogin);
        $today = date('Y-m-d', $now);
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        if ($lastDay === $today) {
            $streak = max(1, $streak);
        } elseif ($lastDay === $yesterday) {
            $streak += 1;
        } else {
            $streak = 1;
        }
    }
    $pdo->prepare("UPDATE users SET last_login_at=?, last_active_at=?, last_ip=?, streak_days=?, total_sessions=total_sessions+1, updated_at=? WHERE id=?")
        ->execute([$now, $now, lumi_client_ip(), $streak, $now, (int)$user['id']]);

    $user = $pdo->query("SELECT * FROM users WHERE id=" . (int)$user['id'])->fetch();
    $user = lumi_mood_decay($user);
    $token = lumi_create_user_session((int)$user['id']);

    lumi_ok([
        'token' => $token,
        'user' => lumi_public_user($user),
        'state' => lumi_public_state($user),
        'announcement' => lumi_active_announcement(),
        'model_configured' => lumi_model_config()['configured'],
        'unread_count' => lumi_unread_count((int)$user['id']),
        'returning' => $lastLogin > 0 && ($now - $lastLogin) > 43200,
    ], '欢迎回来');
}

function lumi_action_logout(): void
{
    $token = lumi_bearer();
    if ($token !== '') {
        lumi_db()->prepare("DELETE FROM user_sessions WHERE token_hash=?")->execute([hash('sha256', $token)]);
    }
    lumi_ok([], '已退出登录');
}

function lumi_action_me(): void
{
    $user = lumi_require_user();
    $user = lumi_mood_decay($user);
    lumi_ok([
        'user' => lumi_public_user($user),
        'state' => lumi_public_state($user),
        'announcement' => lumi_active_announcement(),
        'unread_count' => lumi_unread_count((int)$user['id']),
        'model_configured' => lumi_model_config()['configured'],
        'app_name' => lumi_setting('app_name', '心屿'),
        'personas' => lumi_persona_catalog(),
        'server_time' => time(),
    ]);
}

function lumi_action_update_profile(): void
{
    $user = lumi_require_user();
    $pdo = lumi_db();
    $fields = [];
    $params = [];

    $nickname = lumi_clean_text((string)lumi_param('nickname', $user['nickname']), 20);
    if ($nickname === '') lumi_err('昵称不能为空');
    $fields[] = 'nickname=?';
    $params[] = $nickname;

    $companion = lumi_clean_text((string)lumi_param('companion_name', $user['companion_name']), 12);
    if ($companion === '') lumi_err('陪伴者名字不能为空');
    $fields[] = 'companion_name=?';
    $params[] = $companion;

    $persona = lumi_clean_text((string)lumi_param('companion_persona', $user['companion_persona']), 200);
    $fields[] = 'companion_persona=?';
    $params[] = $persona;

    $bio = lumi_clean_text((string)lumi_param('bio', $user['bio']), 200);
    $fields[] = 'bio=?';
    $params[] = $bio;

    $email = trim((string)lumi_param('email', $user['email']));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        lumi_err('邮箱格式不正确');
    }
    $fields[] = 'email=?';
    $params[] = mb_substr($email, 0, 120);

    $phone = lumi_clean_text((string)lumi_param('phone', $user['phone']), 30);
    $fields[] = 'phone=?';
    $params[] = $phone;

    $gender = (string)lumi_param('gender', $user['gender']);
    if (!in_array($gender, ['secret', 'female', 'male', 'other'], true)) $gender = 'secret';
    $fields[] = 'gender=?';
    $params[] = $gender;

    $birthday = (string)lumi_param('birthday', $user['birthday']);
    if ($birthday !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthday)) {
        lumi_err('生日格式不正确');
    }
    $fields[] = 'birthday=?';
    $params[] = $birthday;

    $theme = (string)lumi_param('theme', $user['theme']);
    if (!in_array($theme, lumi_theme_ids(), true)) $theme = 'dusk';
    $fields[] = 'theme=?';
    $params[] = $theme;

    $accent = (string)lumi_param('accent', $user['accent']);
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $accent)) $accent = '#ffaf9b';
    $fields[] = 'accent=?';
    $params[] = $accent;

    $bubble = (string)lumi_param('bubble_style', $user['bubble_style']);
    if (!in_array($bubble, ['soft', 'glass', 'paper'], true)) $bubble = 'soft';
    $fields[] = 'bubble_style=?';
    $params[] = $bubble;

    $fontSize = (int)lumi_param('font_size', $user['font_size']);
    $fields[] = 'font_size=?';
    $params[] = max(13, min(18, $fontSize));

    $existing = lumi_decode_json((string)$user['settings']);
    $preferences = lumi_param('preferences', []);
    if (is_array($preferences)) {
        foreach (['proactive', 'tts', 'sound', 'reduce_motion'] as $key) {
            if (array_key_exists($key, $preferences)) {
                $existing[$key] = (bool)$preferences[$key];
            }
        }
    }
    $personaId = (string)lumi_param('persona_id', '');
    if ($personaId !== '') {
        if (!array_key_exists($personaId, lumi_personas())) {
            lumi_err('这个人格还不存在');
        }
        $existing['persona_id'] = $personaId;
    }
    $fields[] = 'settings=?';
    $params[] = json_encode($existing, JSON_UNESCAPED_UNICODE);

    $fields[] = 'updated_at=?';
    $params[] = time();
    $params[] = (int)$user['id'];
    $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id=?")->execute($params);
    $fresh = $pdo->query("SELECT * FROM users WHERE id=" . (int)$user['id'])->fetch();
    lumi_ok(['user' => lumi_public_user($fresh), 'state' => lumi_public_state($fresh)], '已经悄悄记下你的偏好了');
}

function lumi_action_change_password(): void
{
    $user = lumi_require_user();
    $old = (string)lumi_param('old_password', '');
    $new = (string)lumi_param('new_password', '');
    if (!password_verify($old, (string)$user['password_hash'])) {
        lumi_err('原来的密码不正确');
    }
    if (mb_strlen($new) < 6) {
        lumi_err('新密码至少需要 6 位');
    }
    lumi_db()->prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?")
        ->execute([password_hash($new, PASSWORD_DEFAULT), time(), (int)$user['id']]);
    lumi_ok([], '密码已更新');
}

function lumi_action_delete_account(): void
{
    $user = lumi_require_user();
    $password = (string)lumi_param('password', '');
    if (!password_verify($password, (string)$user['password_hash'])) {
        lumi_err('密码不正确，无法注销');
    }
    lumi_db()->prepare("UPDATE users SET status='deleted', updated_at=? WHERE id=?")->execute([time(), (int)$user['id']]);
    lumi_db()->prepare("DELETE FROM user_sessions WHERE user_id=?")->execute([(int)$user['id']]);
    lumi_ok([], '账号已注销。愿你往后被好好接住。');
}

// =====================================================================
// 陪伴核心
// =====================================================================

function lumi_check_safety(string $text): array
{
    if (!(int)lumi_setting('safety_enabled', '1')) {
        return ['allowed' => true, 'flagged' => false, 'matched' => ''];
    }
    $rows = lumi_db()->query("SELECT word, action, category FROM sensitive_words ORDER BY LENGTH(word) DESC")->fetchAll();
    foreach ($rows as $row) {
        if ($row['word'] !== '' && mb_strpos($text, $row['word']) !== false) {
            if ($row['action'] === 'block') {
                return ['allowed' => false, 'flagged' => true, 'matched' => $row['word'], 'category' => $row['category']];
            }
            return ['allowed' => true, 'flagged' => true, 'matched' => $row['word'], 'category' => $row['category']];
        }
    }
    return ['allowed' => true, 'flagged' => false, 'matched' => ''];
}

function lumi_chat_suggestions(string $primary, array $state): array
{
    $map = [
        'sad' => ['抱抱你', '慢慢说，我在听', '今天真的很不容易'],
        'lonely' => ['陪我说会儿话', '你在就好', '不想一个人待着'],
        'angry' => ['让我先缓缓', '我有点委屈', '你会哄我吗'],
        'tired' => ['今天好累', '想靠一会儿', '陪我安静待着'],
        'intimacy' => ['再抱一下', '我想你了', '别走开'],
        'apology' => ['是我不好', '别生气了好吗', '过来让我抱抱'],
        'leave' => ['我不会真的走', '再陪我一会', '刚才是我冲动'],
        'positive' => ['今天有件开心的事', '想第一个告诉你', '和你分享'],
        'neutral' => ['今天有点复杂', '你猜我在想什么', '想听你说说话'],
    ];
    $base = $map[$primary] ?? $map['neutral'];
    if ($state['anger'] >= 45) {
        $base = ['先别生气', '是我不好', '我想听你说'];
    } elseif ($state['mood'] === '依恋') {
        $base = ['我想你了', '再陪我一会儿', '今天也辛苦了'];
    }
    return $base;
}

function lumi_sse_start(): void
{
    @ini_set('zlib.output_compression', '0');
    @ini_set('implicit_flush', '1');
    @set_time_limit(0);
    ignore_user_abort(true);
    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }
}

function lumi_sse_send(array $payload): void
{
    echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n\n";
    @ob_flush();
    @flush();
}

/**
 * 从流式缓冲里取出可安全显示的文本：剔除 <mood> 标签，并暂存可能是标签前缀的尾部。
 */
function lumi_stream_filter(string &$pending, bool $final = false): string
{
    $pending = preg_replace('/<mood>.*?<\/mood>/is', '', $pending) ?? $pending;
    if ($final) {
        $pending = preg_replace('/<mood[^>]*>/i', '', $pending) ?? $pending;
        $pending = preg_replace('/<\/mood>/i', '', $pending) ?? $pending;
    }
    $cut = strlen($pending);
    if (!$final && ($lt = strrpos($pending, '<')) !== false) {
        $tail = substr($pending, $lt);
        if (strpos($tail, '>') === false && strlen($tail) < 16) {
            $cut = $lt;
        }
    }
    if ($cut <= 0) {
        return '';
    }
    $out = substr($pending, 0, $cut);
    $pending = substr($pending, $cut);
    return $out;
}

function lumi_stream_text(string $text, callable $emit): void
{
    // 控制总时长：长回复分更多字一组，短回复逐字出现，最多约 4 秒
    $length = mb_strlen($text);
    $size = max(1, (int)ceil($length / 140));
    foreach (mb_str_split($text, $size) as $chunk) {
        $emit($chunk);
        if (connection_aborted()) {
            return;
        }
        usleep(30000);
    }
}

function lumi_stream_chat(array $user, int $conversationId, array $analysis, array $safety): void
{
    lumi_sse_start();
    lumi_sse_send(['type' => 'start', 'conversation_id' => $conversationId]);

    $pending = '';
    $shown = '';
    $emit = static function (string $text) use (&$pending, &$shown): void {
        $pending .= $text;
        $visible = lumi_stream_filter($pending);
        if ($visible !== '') {
            $shown .= $visible;
            lumi_sse_send(['type' => 'delta', 'text' => $visible]);
        }
    };

    try {
        $config = lumi_model_config();
        $context = lumi_context_messages((int)$user['id'], $conversationId, (int)lumi_setting('max_context_messages', '18'));
        $degraded = true;
        $tokens = 0;
        $latency = 0;
        $mood = '';
        $modelError = '';

        if ($config['configured']) {
            $messages = array_merge(
                [['role' => 'system', 'content' => lumi_build_system_prompt($user)]],
                $context
            );
            $result = lumi_model_stream($messages, $emit);
            $latency = (int)($result['latency'] ?? 0);
            if ($result['ok']) {
                $degraded = false;
                $tokens = (int)($result['usage']['total_tokens'] ?? 0);
                $mood = lumi_extract_mood_tag($result['content']);
            } else {
                $modelError = (string)($result['error'] ?? '');
                if ($shown === '') {
                    // 服务商可能不支持 stream，退回一次普通请求
                    $retry = lumi_model_request($messages);
                    $latency += (int)($retry['latency'] ?? 0);
                    if ($retry['ok']) {
                        $degraded = false;
                        $tokens = (int)($retry['usage']['total_tokens'] ?? 0);
                        $content = $retry['content'];
                        $mood = lumi_extract_mood_tag($content);
                        lumi_stream_text($content, $emit);
                    } else {
                        $modelError = (string)($retry['error'] ?? $modelError);
                    }
                } else {
                    $emit('（刚刚信号断了一下，但我还在）');
                }
            }
        }

        if ($shown === '') {
            $degraded = true;
            $fallback = lumi_fallback_reply($user, (string)(end($context)['content'] ?? ''));
            $mood = $fallback['mood'];
            lumi_stream_text($fallback['content'], $emit);
        }

        $tail = lumi_stream_filter($pending, true);
        if ($tail !== '') {
            $shown .= $tail;
            lumi_sse_send(['type' => 'delta', 'text' => $tail]);
        }
        if ($mood === '') {
            $mood = lumi_mood_label($user);
        }

        $user = lumi_apply_assistant_mood($user, $mood);
        lumi_record_mood($user, 'chat', true);
        $saved = lumi_save_message((int)$user['id'], $conversationId, 'assistant', $shown, $mood, $tokens, true, [
            'degraded' => $degraded,
            'latency' => $latency,
            'model_error' => $modelError,
        ]);

        $state = lumi_public_state($user);
        lumi_sse_send([
            'type' => 'done',
            'message' => [
                'id' => $saved['id'],
                'role' => 'assistant',
                'content' => $shown,
                'emotion' => $mood,
                'mood_after' => $mood,
                'created_at' => $saved['created_at'],
                'is_read' => 1,
                'pinned' => 0,
                'tokens' => $tokens,
                'meta' => ['degraded' => $degraded],
            ],
            'state' => $state,
            'suggestions' => lumi_chat_suggestions($analysis['primary'], $state),
            'degraded' => $degraded,
            'model_configured' => $config['configured'],
            'latency' => $latency,
            'flagged' => $safety['flagged'],
            'unread_count' => lumi_unread_count((int)$user['id']),
        ]);
    } catch (Throwable $e) {
        @file_put_contents(
            lumi_data_dir() . '/error.log',
            '[' . lumi_now_text() . '] stream: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
        lumi_sse_send(['type' => 'error', 'msg' => '回应中断了，再试一次好吗']);
    }
}

function lumi_action_chat(): void
{
    $user = lumi_require_user();
    if ((int)lumi_setting('maintenance_mode', '0')) {
        lumi_err('心屿正在短暂维护，晚一点再来找我，好吗', 503);
    }
    $maxLen = (int)lumi_setting('max_message_length', '2000');
    $text = lumi_clean_text((string)lumi_param('message', ''), $maxLen);
    if ($text === '') {
        lumi_err('说点什么吧，我在听');
    }
    lumi_rate_limit('chat:' . (int)$user['id'], (int)lumi_setting('messages_per_minute', '20'), 60);

    $safety = lumi_check_safety($text);
    if (!$safety['allowed']) {
        lumi_err('这句话里有一些不适合发送的内容，换个方式告诉我，好吗', 422, ['flagged' => true, 'matched' => $safety['matched']]);
    }

    $user = lumi_mood_decay($user);
    $conversationId = (int)lumi_param('conversation_id', 0);
    if ($conversationId <= 0) {
        $conversationId = lumi_current_conversation_id((int)$user['id']);
    } else {
        $st = lumi_db()->prepare("SELECT id FROM conversations WHERE id=? AND user_id=?");
        $st->execute([$conversationId, (int)$user['id']]);
        if (!$st->fetch()) {
            $conversationId = lumi_current_conversation_id((int)$user['id']);
        }
    }

    $meta = ['flagged' => $safety['flagged'], 'matched' => $safety['matched'], 'category' => $safety['category'] ?? ''];
    lumi_save_message((int)$user['id'], $conversationId, 'user', $text, '', 0, true, $meta);
    $user = lumi_apply_mood($user, $text);
    lumi_touch_user((int)$user['id']);

    $analysis = lumi_analyze_user_message($text);
    if ((int)lumi_param('stream', 0) === 1) {
        lumi_stream_chat($user, $conversationId, $analysis, $safety);
        exit;
    }
    $context = lumi_context_messages((int)$user['id'], $conversationId, (int)lumi_setting('max_context_messages', '18'));
    $reply = lumi_generate_reply($user, $context);
    $user = lumi_apply_assistant_mood($user, (string)$reply['mood']);
    lumi_record_mood($user, 'chat', true);
    $saved = lumi_save_message((int)$user['id'], $conversationId, 'assistant', $reply['content'], (string)$reply['mood'], (int)$reply['tokens'], true, [
        'degraded' => (bool)$reply['degraded'],
        'latency' => $reply['latency'] ?? 0,
        'model_error' => $reply['error'] ?? '',
    ]);

    lumi_ok([
        'conversation_id' => $conversationId,
        'message' => [
            'id' => $saved['id'],
            'role' => 'assistant',
            'content' => $reply['content'],
            'emotion' => $reply['mood'],
            'created_at' => $saved['created_at'],
            'is_read' => 1,
            'pinned' => 0,
            'tokens' => (int)$reply['tokens'],
            'meta' => ['degraded' => (bool)$reply['degraded']],
        ],
        'state' => lumi_public_state($user),
        'suggestions' => lumi_chat_suggestions($analysis['primary'], lumi_public_state($user)),
        'degraded' => (bool)$reply['degraded'],
        'model_configured' => lumi_model_config()['configured'],
        'flagged' => $safety['flagged'],
        'unread_count' => lumi_unread_count((int)$user['id']),
    ]);
}

function lumi_action_gesture(): void
{
    $user = lumi_require_user();
    $type = (string)lumi_param('type', 'hug');
    if (!in_array($type, ['hug', 'headpat', 'flower', 'hand', 'warm', 'kiss', 'tea'], true)) {
        lumi_err('这个动作还不会做');
    }
    lumi_rate_limit('gesture:' . (int)$user['id'], 20, 60);
    $user = lumi_mood_decay($user);
    $effect = lumi_gesture_effect($type, $user);
    $user = lumi_db()->query("SELECT * FROM users WHERE id=" . (int)$user['id'])->fetch();
    $conversationId = lumi_current_conversation_id((int)$user['id']);
    $saved = lumi_save_message((int)$user['id'], $conversationId, 'assistant', (string)$effect['reply'], lumi_mood_label($user), 0, true, ['gesture' => $type, 'gesture_label' => $effect['label']]);
    lumi_record_mood($user, 'gesture', true);
    lumi_touch_user((int)$user['id']);
    lumi_ok([
        'conversation_id' => $conversationId,
        'message' => lumi_message_row([
            'id' => $saved['id'], 'role' => 'assistant', 'content' => $effect['reply'], 'emotion' => lumi_mood_label($user),
            'mood_after' => lumi_mood_label($user), 'tokens' => 0, 'is_read' => 1, 'pinned' => 0, 'created_at' => $saved['created_at'],
            'meta' => json_encode(['gesture' => $type, 'gesture_label' => $effect['label']])
        ]),
        'state' => lumi_public_state($user),
        'effect' => ['label' => $effect['label'], 'affection_delta' => $effect['affection']],
    ]);
}

function lumi_action_poll(): void
{
    $user = lumi_require_user();
    $user = lumi_mood_decay($user);
    $unread = [];
    $st = lumi_db()->prepare("SELECT * FROM messages WHERE user_id=? AND is_read=0 AND role IN ('assistant','proactive','system') ORDER BY id ASC LIMIT 6");
    $st->execute([(int)$user['id']]);
    foreach ($st->fetchAll() as $row) {
        $unread[] = lumi_message_row($row);
    }

    $proactiveSent = false;
    $proactiveEnabled = (int)lumi_setting('proactive_enabled', '1');
    $idleSeconds = max(20, (int)lumi_setting('proactive_idle_seconds', '75'));
    $cooldown = max(30, (int)lumi_setting('proactive_cooldown_seconds', '180'));
    $now = time();
    $idle = $now - (int)$user['last_active_at'];
    $sinceLast = $now - (int)$user['last_proactive_at'];

    if ($proactiveEnabled && !$unread && $idle >= $idleSeconds && $sinceLast >= $cooldown) {
        $probability = max(0.0, min(1.0, (float)lumi_setting('proactive_probability', '0.55')));
        if (random_int(1, 1000) <= (int)round($probability * 1000)) {
            $message = lumi_proactive_message($user);
            $conversationId = lumi_current_conversation_id((int)$user['id']);
            $saved = lumi_save_message((int)$user['id'], $conversationId, 'proactive', (string)$message['content'], (string)$message['mood'], 0, false, [
                'degraded' => (bool)$message['degraded'],
                'proactive' => true,
            ]);
            lumi_db()->prepare("UPDATE users SET last_proactive_at=?, updated_at=? WHERE id=?")->execute([$now, $now, (int)$user['id']]);
            $row = lumi_db()->query("SELECT * FROM messages WHERE id=" . (int)$saved['id'])->fetch();
            $unread[] = lumi_message_row($row);
            $proactiveSent = true;
            $user = lumi_db()->query("SELECT * FROM users WHERE id=" . (int)$user['id'])->fetch();
        }
    }

    lumi_ok([
        'state' => lumi_public_state($user),
        'messages' => $unread,
        'proactive' => $proactiveSent,
        'announcement' => lumi_active_announcement(),
        'unread_count' => count($unread),
        'server_time' => $now,
        'next_poll' => 22000,
    ]);
}

function lumi_action_history(): void
{
    $user = lumi_require_user();
    $beforeId = (int)lumi_param('before_id', 0);
    $limit = max(10, min(50, (int)lumi_param('limit', 30)));
    $sql = "SELECT * FROM messages WHERE user_id=?";
    $params = [(int)$user['id']];
    if ($beforeId > 0) {
        $sql .= " AND id < ?";
        $params[] = $beforeId;
    }
    $sql .= " ORDER BY id DESC LIMIT " . ($limit + 1);
    $st = lumi_db()->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll();
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);
    $rows = array_reverse($rows);
    $messages = array_map('lumi_message_row', $rows);
    lumi_ok([
        'messages' => $messages,
        'has_more' => $hasMore,
        'state' => lumi_public_state($user),
        'unread_count' => lumi_unread_count((int)$user['id']),
    ]);
}

function lumi_action_mark_read(): void
{
    $user = lumi_require_user();
    $ids = lumi_param('ids', []);
    if (is_array($ids) && $ids) {
        $clean = array_values(array_filter(array_map('intval', $ids)));
        if ($clean) {
            $in = implode(',', array_fill(0, count($clean), '?'));
            $params = array_merge([(int)$user['id']], $clean);
            lumi_db()->prepare("UPDATE messages SET is_read=1 WHERE user_id=? AND id IN ($in)")->execute($params);
        }
    } else {
        lumi_db()->prepare("UPDATE messages SET is_read=1 WHERE user_id=? AND role IN ('assistant','proactive','system')")->execute([(int)$user['id']]);
    }
    lumi_ok(['unread_count' => lumi_unread_count((int)$user['id'])]);
}

function lumi_action_insights(): void
{
    $user = lumi_require_user();
    $pdo = lumi_db();
    $userId = (int)$user['id'];
    $state = lumi_public_state($user);

    $days = [];
    for ($i = 13; $i >= 0; $i--) {
        $days[date('m-d', strtotime("-{$i} day"))] = [
            'day' => date('m-d', strtotime("-{$i} day")),
            'date' => date('Y-m-d', strtotime("-{$i} day")),
            'valence' => null,
            'affection' => null,
            'messages' => 0,
        ];
    }
    $st = $pdo->prepare("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, ROUND(AVG(valence)) v, ROUND(AVG(affection)) a FROM mood_logs WHERE user_id=? AND created_at>=? GROUP BY d");
    $st->execute([$userId, strtotime('-13 days midnight')]);
    foreach ($st->fetchAll() as $row) {
        $key = date('m-d', strtotime((string)$row['d']));
        if (isset($days[$key])) {
            $days[$key]['valence'] = (int)$row['v'];
            $days[$key]['affection'] = (int)$row['a'];
        }
    }
    $st = $pdo->prepare("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, COUNT(*) c FROM messages WHERE user_id=? AND role='user' AND created_at>=? GROUP BY d");
    $st->execute([$userId, strtotime('-13 days midnight')]);
    foreach ($st->fetchAll() as $row) {
        $key = date('m-d', strtotime((string)$row['d']));
        if (isset($days[$key])) $days[$key]['messages'] = (int)$row['c'];
    }

    $distribution = [];
    $st = $pdo->prepare("SELECT mood_label, COUNT(*) c FROM mood_logs WHERE user_id=? AND created_at>=? GROUP BY mood_label ORDER BY c DESC");
    $st->execute([$userId, strtotime('-30 days midnight')]);
    foreach ($st->fetchAll() as $row) {
        $distribution[] = ['label' => $row['mood_label'], 'value' => (int)$row['c']];
    }

    $interactions = [];
    $st = $pdo->prepare("SELECT type, COUNT(*) c FROM interactions WHERE user_id=? GROUP BY type ORDER BY c DESC");
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $row) {
        $interactions[] = ['type' => $row['type'], 'count' => (int)$row['c']];
    }

    $pinned = [];
    $st = $pdo->prepare("SELECT * FROM messages WHERE user_id=? AND pinned=1 ORDER BY id DESC LIMIT 6");
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $row) $pinned[] = lumi_message_row($row);

    $first = $pdo->prepare("SELECT * FROM messages WHERE user_id=? AND role IN ('assistant','proactive') ORDER BY id ASC LIMIT 1");
    $first->execute([$userId]);
    $firstRow = $first->fetch();
    $latest = $pdo->prepare("SELECT * FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 1");
    $latest->execute([$userId]);
    $latestRow = $latest->fetch();

    $milestones = [];
    if ($firstRow) $milestones[] = ['title' => '第一次相遇', 'icon' => 'spark', 'content' => $firstRow['content'], 'created_at' => (int)$firstRow['created_at']];
    if ($state['affection'] >= 42) $milestones[] = ['title' => '关系变成依赖', 'icon' => 'heart', 'content' => '你们开始习惯彼此的存在。', 'created_at' => (int)$user['mood_updated_at']];
    if ($interactions) $milestones[] = ['title' => '第一次主动靠近', 'icon' => 'hand', 'content' => '有些温度，是从一个动作开始的。', 'created_at' => time()];

    $totalMessages = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE user_id=" . $userId)->fetchColumn();
    $todayMessages = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE user_id=" . $userId . " AND created_at>=" . strtotime('today'))->fetchColumn();

    lumi_ok([
        'state' => $state,
        'days' => array_values($days),
        'distribution' => $distribution,
        'interactions' => $interactions,
        'pinned' => $pinned,
        'milestones' => $milestones,
        'latest' => $latestRow ? lumi_message_row($latestRow) : null,
        'stats' => ['total_messages' => $totalMessages, 'today_messages' => $todayMessages, 'streak_days' => (int)$user['streak_days']],
    ]);
}

function lumi_action_pin_message(): void
{
    $user = lumi_require_user();
    $messageId = (int)lumi_param('message_id', 0);
    $pinned = (int)lumi_param('pinned', 1) ? 1 : 0;
    $st = lumi_db()->prepare("SELECT id FROM messages WHERE id=? AND user_id=?");
    $st->execute([$messageId, (int)$user['id']]);
    if (!$st->fetch()) lumi_err('没有找到这条回忆');
    lumi_db()->prepare("UPDATE messages SET pinned=? WHERE id=? AND user_id=?")->execute([$pinned, $messageId, (int)$user['id']]);
    lumi_ok(['pinned' => $pinned], $pinned ? '已经收进回忆里了' : '已取消收藏');
}

function lumi_action_feedback_create(): void
{
    $user = lumi_require_user();
    $content = lumi_clean_text((string)lumi_param('content', ''), 1000);
    if (mb_strlen($content) < 5) lumi_err('再多写一点吧，至少 5 个字');
    $category = (string)lumi_param('category', '建议');
    if (!in_array($category, ['建议', '问题', '情感', '其他'], true)) $category = '其他';
    $contact = lumi_clean_text((string)lumi_param('contact', ''), 100);
    lumi_rate_limit('feedback:' . (int)$user['id'], 4, 86400);
    lumi_db()->prepare("INSERT INTO feedbacks (user_id, category, content, contact, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)")
        ->execute([(int)$user['id'], $category, $content, $contact, time()]);
    lumi_ok([], '收到啦，我会认真看的');
}

function lumi_action_feedback_list(): void
{
    $user = lumi_require_user();
    $st = lumi_db()->prepare("SELECT id, category, content, contact, status, reply, created_at, replied_at FROM feedbacks WHERE user_id=? ORDER BY id DESC LIMIT 30");
    $st->execute([(int)$user['id']]);
    lumi_ok(['items' => $st->fetchAll()]);
}

// =====================================================================
// 管理后台认证
// =====================================================================

function lumi_admin_public(array $admin): array
{
    return [
        'id' => (int)$admin['id'],
        'username' => $admin['username'],
        'display_name' => $admin['display_name'],
        'role' => $admin['role'],
        'last_login_at' => (int)$admin['last_login_at'],
    ];
}

function lumi_action_admin_login(): void
{
    $username = trim((string)lumi_param('username', ''));
    $password = (string)lumi_param('password', '');
    if ($username === '' || $password === '') lumi_err('请输入后台账号和密码');
    lumi_rate_limit('admin_login:' . lumi_client_ip() . ':' . $username, 8, 300);

    $st = lumi_db()->prepare("SELECT * FROM admins WHERE username=? AND status='active' LIMIT 1");
    $st->execute([$username]);
    $admin = $st->fetch();
    if (!$admin || !password_verify($password, (string)$admin['password_hash'])) {
        lumi_err('后台账号或密码不正确');
    }
    $now = time();
    $token = bin2hex(random_bytes(32));
    lumi_db()->prepare("INSERT INTO admin_sessions (admin_id, token_hash, ip, user_agent, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        ->execute([(int)$admin['id'], hash('sha256', $token), lumi_client_ip(), lumi_safe_user_agent(), $now, $now, $now + 86400]);
    lumi_db()->prepare("UPDATE admins SET last_login_at=?, last_login_ip=? WHERE id=?")->execute([$now, lumi_client_ip(), (int)$admin['id']]);
    lumi_audit($admin, 'admin.login', 'admin', (string)$admin['id'], '管理员登录后台');
    lumi_ok(['token' => $token, 'admin' => lumi_admin_public($admin)]);
}

function lumi_action_admin_me(): void
{
    $admin = lumi_require_admin();
    lumi_ok([
        'admin' => lumi_admin_public($admin),
        'pending_feedback' => (int)lumi_db()->query("SELECT COUNT(*) FROM feedbacks WHERE status='open'")->fetchColumn(),
        'version' => LUMI_VERSION,
        'server_time' => time(),
    ]);
}

function lumi_action_admin_logout(): void
{
    $token = lumi_bearer();
    if ($token !== '') {
        lumi_db()->prepare("DELETE FROM admin_sessions WHERE token_hash=?")->execute([hash('sha256', $token)]);
    }
    lumi_ok([], '已退出后台');
}

// =====================================================================
// 管理后台 · 数据总览
// =====================================================================

function lumi_expire_bans(): void
{
    $now = time();
    $pdo = lumi_db();
    $rows = $pdo->query("SELECT id, ban_until FROM users WHERE status='banned' AND ban_until>0 AND ban_until<=" . $now)->fetchAll();
    foreach ($rows as $row) {
        $pdo->prepare("UPDATE users SET status='active', ban_until=NULL, ban_reason='', banned_at=NULL, banned_by=NULL, updated_at=? WHERE id=?")->execute([$now, (int)$row['id']]);
        $pdo->prepare("UPDATE ban_history SET lifted_at=?, lifted_by='system' WHERE user_id=? AND until_at=? AND lifted_at IS NULL")->execute([$now, (int)$row['id'], (int)$row['ban_until']]);
    }
}

function lumi_action_admin_stats(): void
{
    lumi_require_admin();
    lumi_expire_bans();
    $pdo = lumi_db();
    $today = strtotime('today');
    $now = time();
    $totalUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status!='deleted'")->fetchColumn();
    $newToday = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE created_at>=$today AND status!='deleted'")->fetchColumn();
    $activeToday = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE last_active_at>=$today AND status='active'")->fetchColumn();
    $banned = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE status='banned'")->fetchColumn();
    $messageTotal = (int)$pdo->query("SELECT COUNT(*) FROM messages")->fetchColumn();
    $messageToday = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE created_at>=$today")->fetchColumn();
    $avgAffection = (float)$pdo->query("SELECT COALESCE(AVG(affection),0) FROM users WHERE status!='deleted'")->fetchColumn();
    $openFeedback = (int)$pdo->query("SELECT COUNT(*) FROM feedbacks WHERE status='open'")->fetchColumn();
    $activeAnnouncements = (int)$pdo->query("SELECT COUNT(*) FROM announcements WHERE active=1 AND (expires_at=0 OR expires_at> $now)")->fetchColumn();

    $days = [];
    for ($i = 13; $i >= 0; $i--) {
        $day = date('Y-m-d', strtotime("-{$i} day"));
        $days[$day] = ['date' => date('m-d', strtotime($day)), 'users' => 0, 'messages' => 0, 'active' => 0];
    }
    $start = strtotime('-13 days midnight');
    foreach ($pdo->query("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, COUNT(*) c FROM users WHERE created_at>=$start GROUP BY d")->fetchAll() as $row) {
        if (isset($days[$row['d']])) $days[$row['d']]['users'] = (int)$row['c'];
    }
    foreach ($pdo->query("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, COUNT(*) c FROM messages WHERE created_at>=$start GROUP BY d")->fetchAll() as $row) {
        if (isset($days[$row['d']])) $days[$row['d']]['messages'] = (int)$row['c'];
    }
    foreach ($pdo->query("SELECT strftime('%Y-%m-%d', last_active_at, 'unixepoch', '+8 hours') d, COUNT(*) c FROM users WHERE last_active_at>=$start GROUP BY d")->fetchAll() as $row) {
        if (isset($days[$row['d']])) $days[$row['d']]['active'] = (int)$row['c'];
    }

    $moodDistribution = [];
    foreach ($pdo->query("SELECT mood_label, COUNT(*) c FROM users WHERE status!='deleted' GROUP BY mood_label ORDER BY c DESC")->fetchAll() as $row) {
        $moodDistribution[] = ['label' => $row['mood_label'], 'value' => (int)$row['c']];
    }
    $themeDistribution = [];
    foreach ($pdo->query("SELECT theme, COUNT(*) c FROM users WHERE status!='deleted' GROUP BY theme ORDER BY c DESC")->fetchAll() as $row) {
        $themeDistribution[] = ['theme' => $row['theme'], 'value' => (int)$row['c']];
    }
    $recentUsers = [];
    foreach ($pdo->query("SELECT * FROM users WHERE status!='deleted' ORDER BY id DESC LIMIT 6")->fetchAll() as $row) {
        $recentUsers[] = [
            'id' => (int)$row['id'], 'username' => $row['username'], 'nickname' => $row['nickname'],
            'theme' => $row['theme'], 'mood' => lumi_mood_label($row), 'affection' => (int)$row['affection'],
            'status' => $row['status'], 'created_at' => (int)$row['created_at'], 'last_active_at' => (int)$row['last_active_at'],
        ];
    }
    $audit = $pdo->query("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 7")->fetchAll();
    $feedbacks = [];
    foreach ($pdo->query("SELECT f.*, u.nickname, u.username FROM feedbacks f LEFT JOIN users u ON u.id=f.user_id ORDER BY f.id DESC LIMIT 5")->fetchAll() as $row) {
        $feedbacks[] = ['id' => (int)$row['id'], 'category' => $row['category'], 'content' => $row['content'], 'status' => $row['status'], 'nickname' => $row['nickname'] ?: $row['username'], 'created_at' => (int)$row['created_at']];
    }
    $dbSize = is_file(lumi_data_dir() . '/' . LUMI_DB_FILE) ? (int)filesize(lumi_data_dir() . '/' . LUMI_DB_FILE) : 0;

    lumi_ok([
        'stats' => [
            'total_users' => $totalUsers, 'new_today' => $newToday, 'active_today' => $activeToday,
            'banned' => $banned, 'message_total' => $messageTotal, 'message_today' => $messageToday,
            'avg_affection' => round($avgAffection, 1), 'open_feedback' => $openFeedback,
            'announcements' => $activeAnnouncements, 'model_configured' => lumi_model_config()['configured'],
            'db_size' => $dbSize, 'version' => LUMI_VERSION,
        ],
        'series' => array_values($days),
        'mood_distribution' => $moodDistribution,
        'theme_distribution' => $themeDistribution,
        'recent_users' => $recentUsers,
        'recent_audit' => $audit,
        'recent_feedbacks' => $feedbacks,
        'server_time' => $now,
    ]);
}

function lumi_action_admin_users(): void
{
    lumi_require_admin();
    lumi_expire_bans();
    $pdo = lumi_db();
    $q = trim((string)lumi_param('q', ''));
    $status = (string)lumi_param('status', 'all');
    $page = max(1, (int)lumi_param('page', 1));
    $perPage = min(50, max(8, (int)lumi_param('per_page', 12)));
    $offset = ($page - 1) * $perPage;

    $where = ["status!='deleted'"];
    $params = [];
    if ($q !== '') {
        $where[] = "(username LIKE ? OR nickname LIKE ? OR CAST(id AS TEXT)=?)";
        $params[] = '%' . $q . '%';
        $params[] = '%' . $q . '%';
        $params[] = $q;
    }
    if ($status === 'active') $where[] = "status='active'";
    if ($status === 'banned') $where[] = "status='banned'";
    if ($status === 'high') $where[] = "(sadness>=50 OR anger>=45 OR affection>=75)";
    $whereSql = ' WHERE ' . implode(' AND ', $where);
    $countSt = $pdo->prepare("SELECT COUNT(*) FROM users" . $whereSql);
    $countSt->execute($params);
    $total = (int)$countSt->fetchColumn();
    $sql = "SELECT * FROM users" . $whereSql . " ORDER BY last_active_at DESC LIMIT $perPage OFFSET $offset";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $items = [];
    foreach ($st->fetchAll() as $row) {
        $lastMessage = $pdo->prepare("SELECT content, role, created_at FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 1");
        $lastMessage->execute([(int)$row['id']]);
        $last = $lastMessage->fetch();
        $items[] = [
            'id' => (int)$row['id'],
            'username' => $row['username'],
            'nickname' => $row['nickname'],
            'companion_name' => $row['companion_name'],
            'theme' => $row['theme'],
            'status' => $row['status'],
            'ban' => $row['status'] === 'banned' ? lumi_ban_payload($row) : null,
            'affection' => (int)$row['affection'],
            'mood' => lumi_mood_label($row),
            'sadness' => (int)$row['sadness'],
            'anger' => (int)$row['anger'],
            'total_messages' => (int)$row['total_messages'],
            'created_at' => (int)$row['created_at'],
            'last_active_at' => (int)$row['last_active_at'],
            'last_login_at' => (int)$row['last_login_at'],
            'last_message' => $last ? mb_substr($last['content'], 0, 42) : '',
            'last_message_role' => $last['role'] ?? '',
            'last_message_at' => $last ? (int)$last['created_at'] : 0,
        ];
    }
    lumi_ok(['items' => $items, 'total' => $total, 'page' => $page, 'per_page' => $perPage, 'pages' => max(1, (int)ceil($total / $perPage))]);
}

function lumi_action_admin_user_detail(): void
{
    lumi_require_admin();
    $userId = (int)lumi_param('user_id', 0);
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM users WHERE id=? AND status!='deleted'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);

    $messages = [];
    $st = $pdo->prepare("SELECT * FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 30");
    $st->execute([$userId]);
    foreach ($st->fetchAll() as $row) $messages[] = lumi_message_row($row);
    $messages = array_reverse($messages);

    $mood = [];
    $st = $pdo->prepare("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, ROUND(AVG(valence)) v, ROUND(AVG(affection)) a, COUNT(*) c FROM mood_logs WHERE user_id=? AND created_at>=? GROUP BY d ORDER BY d ASC");
    $st->execute([$userId, strtotime('-13 days midnight')]);
    $mood = $st->fetchAll();

    $banHistory = [];
    $st = $pdo->prepare("SELECT * FROM ban_history WHERE user_id=? ORDER BY id DESC LIMIT 20");
    $st->execute([$userId]);
    $banHistory = $st->fetchAll();

    $feedbacks = [];
    $st = $pdo->prepare("SELECT * FROM feedbacks WHERE user_id=? ORDER BY id DESC LIMIT 10");
    $st->execute([$userId]);
    $feedbacks = $st->fetchAll();

    $interactions = [];
    $st = $pdo->prepare("SELECT type, COUNT(*) c FROM interactions WHERE user_id=? GROUP BY type ORDER BY c DESC");
    $st->execute([$userId]);
    $interactions = $st->fetchAll();

    $conversationCount = (int)$pdo->query("SELECT COUNT(*) FROM conversations WHERE user_id=$userId")->fetchColumn();
    $userMessages = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE user_id=$userId AND role='user'")->fetchColumn();
    $assistantMessages = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE user_id=$userId AND role IN ('assistant','proactive')")->fetchColumn();
    $lastSession = null;
    $st = $pdo->prepare("SELECT ip, user_agent, created_at, last_seen_at, expires_at FROM user_sessions WHERE user_id=? ORDER BY id DESC LIMIT 1");
    $st->execute([$userId]);
    $lastSession = $st->fetch() ?: null;

    $public = lumi_public_user($user);
    $public['admin_note'] = $user['admin_note'];
    $public['register_ip'] = $user['register_ip'];
    $public['last_ip'] = $user['last_ip'];
    $public['password_hash_preview'] = '••••••••';

    lumi_ok([
        'user' => $public,
        'state' => lumi_public_state($user),
        'ban' => $user['status'] === 'banned' ? lumi_ban_payload($user) : null,
        'messages' => $messages,
        'mood_series' => $mood,
        'ban_history' => $banHistory,
        'feedbacks' => $feedbacks,
        'interactions' => $interactions,
        'last_session' => $lastSession,
        'stats' => [
            'conversations' => $conversationCount,
            'user_messages' => $userMessages,
            'assistant_messages' => $assistantMessages,
            'total_messages' => $userMessages + $assistantMessages,
            'streak_days' => (int)$user['streak_days'],
        ],
    ]);
}

function lumi_action_admin_update_user(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $userId = (int)lumi_param('user_id', 0);
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM users WHERE id=? AND status!='deleted'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);

    $fields = [];
    $params = [];
    $allowedText = ['nickname' => 20, 'companion_name' => 12, 'companion_persona' => 200, 'bio' => 200, 'admin_note' => 1000];
    foreach ($allowedText as $field => $max) {
        if (lumi_param($field, null) !== null) {
            $fields[] = "$field=?";
            $params[] = lumi_clean_text((string)lumi_param($field), $max);
        }
    }
    foreach (['affection', 'trust', 'mood_valence', 'anger', 'sadness', 'energy'] as $field) {
        if (lumi_param($field, null) !== null) {
            $value = (int)lumi_param($field);
            $min = $field === 'mood_valence' ? -100 : 0;
            $fields[] = "$field=?";
            $params[] = max($min, min(100, $value));
        }
    }
    if (lumi_param('theme', null) !== null) {
        $theme = (string)lumi_param('theme');
        if (in_array($theme, lumi_theme_ids(), true)) {
            $fields[] = 'theme=?';
            $params[] = $theme;
        }
    }
    if (lumi_param('status', null) !== null) {
        $status = (string)lumi_param('status');
        if (in_array($status, ['active', 'banned'], true)) {
            $fields[] = 'status=?';
            $params[] = $status;
        }
    }
    if (!$fields) lumi_err('没有需要更新的内容');

    $fields[] = 'mood_label=?';
    $preview = array_merge($user, [
        'affection' => lumi_param('affection', $user['affection']),
        'trust' => lumi_param('trust', $user['trust']),
        'mood_valence' => lumi_param('mood_valence', $user['mood_valence']),
        'anger' => lumi_param('anger', $user['anger']),
        'sadness' => lumi_param('sadness', $user['sadness']),
        'energy' => lumi_param('energy', $user['energy']),
    ]);
    $params[] = lumi_mood_label($preview);
    $fields[] = 'mood_updated_at=?';
    $params[] = time();
    $fields[] = 'updated_at=?';
    $params[] = time();
    $params[] = $userId;
    $pdo->prepare("UPDATE users SET " . implode(', ', $fields) . " WHERE id=?")->execute($params);
    lumi_audit($admin, 'user.update', 'user', (string)$userId, '更新用户资料/情绪状态');
    lumi_ok([], '用户资料已更新');
}

function lumi_action_admin_ban_user(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $userId = (int)lumi_param('user_id', 0);
    $reason = lumi_clean_text((string)lumi_param('reason', ''), 500);
    $permanent = (int)lumi_param('permanent', 0);
    $untilAt = (int)lumi_param('until_at', 0);
    if (mb_strlen($reason) < 2) lumi_err('请填写封禁原因，至少 2 个字');
    if (!$permanent && $untilAt <= time()) lumi_err('封禁结束时间必须晚于当前时间，且可精确到秒');
    if ($permanent) $untilAt = 0;
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM users WHERE id=? AND status!='deleted'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);
    $now = time();
    $pdo->prepare("UPDATE users SET status='banned', ban_until=?, ban_reason=?, banned_at=?, banned_by=?, updated_at=? WHERE id=?")
        ->execute([$untilAt, $reason, $now, (int)$admin['id'], $now, $userId]);
    $pdo->prepare("INSERT INTO ban_history (user_id, reason, until_at, banned_at, created_by, created_by_name) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$userId, $reason, $untilAt, $now, (int)$admin['id'], $admin['username']]);
    $user['status'] = 'banned';
    $user['ban_until'] = $untilAt;
    $user['ban_reason'] = $reason;
    $user['banned_at'] = $now;
    lumi_audit($admin, 'user.ban', 'user', (string)$userId, '封禁至 ' . ($permanent ? '永久' : date('Y-m-d H:i:s', $untilAt)) . '，原因：' . $reason);
    lumi_ok(['ban' => lumi_ban_payload($user)], '用户已封禁');
}

function lumi_action_admin_unban_user(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $userId = (int)lumi_param('user_id', 0);
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM users WHERE id=? AND status='banned'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('该用户当前没有被封禁', 404);
    $now = time();
    $pdo->prepare("UPDATE users SET status='active', ban_until=NULL, ban_reason='', banned_at=NULL, banned_by=NULL, updated_at=? WHERE id=?")->execute([$now, $userId]);
    $pdo->prepare("UPDATE ban_history SET lifted_at=?, lifted_by=? WHERE user_id=? AND lifted_at IS NULL")->execute([$now, (string)$admin['username'], $userId]);
    lumi_audit($admin, 'user.unban', 'user', (string)$userId, '解除封禁');
    lumi_ok([], '已解除封禁');
}

function lumi_action_admin_reset_password(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $userId = (int)lumi_param('user_id', 0);
    $new = (string)lumi_param('new_password', '');
    if (mb_strlen($new) < 6) lumi_err('新密码至少 6 位');
    $st = lumi_db()->prepare("SELECT id, username FROM users WHERE id=? AND status!='deleted'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);
    lumi_db()->prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?")->execute([password_hash($new, PASSWORD_DEFAULT), time(), $userId]);
    lumi_db()->prepare("DELETE FROM user_sessions WHERE user_id=?")->execute([$userId]);
    lumi_audit($admin, 'user.reset_password', 'user', (string)$userId, '重置密码并退出所有登录');
    lumi_ok([], '密码已重置，用户需要重新登录');
}

function lumi_action_admin_delete_user(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $userId = (int)lumi_param('user_id', 0);
    $hard = (int)lumi_param('hard', 0);
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT id, username FROM users WHERE id=?");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);
    if ($hard) {
        foreach (['messages', 'conversations', 'mood_logs', 'interactions', 'feedbacks', 'ban_history', 'user_sessions'] as $table) {
            $pdo->prepare("DELETE FROM $table WHERE user_id=?")->execute([$userId]);
        }
        $pdo->prepare("DELETE FROM users WHERE id=?")->execute([$userId]);
    } else {
        $pdo->prepare("UPDATE users SET status='deleted', updated_at=? WHERE id=?")->execute([time(), $userId]);
        $pdo->prepare("DELETE FROM user_sessions WHERE user_id=?")->execute([$userId]);
    }
    lumi_audit($admin, $hard ? 'user.hard_delete' : 'user.delete', 'user', (string)$userId, '删除用户 ' . $user['username']);
    lumi_ok([], $hard ? '用户及关联数据已彻底删除' : '用户已停用');
}

// =====================================================================
// 管理后台 · 聊天数据
// =====================================================================

function lumi_action_admin_conversations(): void
{
    lumi_require_admin();
    $pdo = lumi_db();
    $q = trim((string)lumi_param('q', ''));
    $page = max(1, (int)lumi_param('page', 1));
    $perPage = 15;
    $offset = ($page - 1) * $perPage;
    $where = ["u.status!='deleted'"];
    $params = [];
    if ($q !== '') {
        $where[] = "(u.username LIKE ? OR u.nickname LIKE ? OR m.content LIKE ?)";
        $params = ['%' . $q . '%', '%' . $q . '%', '%' . $q . '%'];
    }
    $whereSql = implode(' AND ', $where);
    $countSql = "SELECT COUNT(DISTINCT u.id) FROM users u LEFT JOIN messages m ON m.user_id=u.id WHERE $whereSql";
    $st = $pdo->prepare($countSql);
    $st->execute($params);
    $total = (int)$st->fetchColumn();
    $sql = "SELECT u.id, u.username, u.nickname, u.theme, u.status, u.affection, u.mood_label, u.sadness, u.anger,
            c.id conversation_id, c.last_message_at, c.message_count,
            (SELECT content FROM messages m2 WHERE m2.user_id=u.id ORDER BY m2.id DESC LIMIT 1) last_content,
            (SELECT role FROM messages m3 WHERE m3.user_id=u.id ORDER BY m3.id DESC LIMIT 1) last_role
            FROM users u
            LEFT JOIN conversations c ON c.id=(SELECT id FROM conversations c2 WHERE c2.user_id=u.id ORDER BY c2.id DESC LIMIT 1)
            WHERE $whereSql
            GROUP BY u.id
            ORDER BY COALESCE(c.last_message_at, u.last_active_at) DESC
            LIMIT $perPage OFFSET $offset";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $items = [];
    foreach ($st->fetchAll() as $row) {
        $items[] = [
            'user_id' => (int)$row['id'], 'username' => $row['username'], 'nickname' => $row['nickname'],
            'theme' => $row['theme'], 'status' => $row['status'], 'affection' => (int)$row['affection'],
            'mood' => $row['mood_label'], 'sadness' => (int)$row['sadness'], 'anger' => (int)$row['anger'],
            'conversation_id' => (int)$row['conversation_id'], 'last_message_at' => (int)$row['last_message_at'],
            'message_count' => (int)$row['message_count'], 'last_content' => mb_substr((string)$row['last_content'], 0, 48),
            'last_role' => $row['last_role'],
        ];
    }
    lumi_ok(['items' => $items, 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $perPage))]);
}

function lumi_action_admin_messages(): void
{
    lumi_require_admin();
    $pdo = lumi_db();
    $page = max(1, (int)lumi_param('page', 1));
    $perPage = min(60, max(10, (int)lumi_param('per_page', 30)));
    $offset = ($page - 1) * $perPage;
    $userId = (int)lumi_param('user_id', 0);
    $q = trim((string)lumi_param('q', ''));
    $role = (string)lumi_param('role', '');
    $from = (int)lumi_param('from', 0);
    $to = (int)lumi_param('to', 0);
    $where = ['1=1'];
    $params = [];
    if ($userId > 0) { $where[] = 'm.user_id=?'; $params[] = $userId; }
    if ($q !== '') { $where[] = 'm.content LIKE ?'; $params[] = '%' . $q . '%'; }
    if (in_array($role, ['user', 'assistant', 'proactive', 'system'], true)) { $where[] = 'm.role=?'; $params[] = $role; }
    if ($from > 0) { $where[] = 'm.created_at>=?'; $params[] = $from; }
    if ($to > 0) { $where[] = 'm.created_at<=?'; $params[] = $to; }
    $whereSql = implode(' AND ', $where);
    $countSt = $pdo->prepare("SELECT COUNT(*) FROM messages m JOIN users u ON u.id=m.user_id WHERE $whereSql");
    $countSt->execute($params);
    $total = (int)$countSt->fetchColumn();
    $sql = "SELECT m.*, u.username, u.nickname, u.companion_name, u.status user_status FROM messages m JOIN users u ON u.id=m.user_id WHERE $whereSql ORDER BY m.id DESC LIMIT $perPage OFFSET $offset";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $items = [];
    foreach ($st->fetchAll() as $row) {
        $item = lumi_message_row($row);
        $item['username'] = $row['username'];
        $item['nickname'] = $row['nickname'];
        $item['companion_name'] = $row['companion_name'];
        $item['user_status'] = $row['user_status'];
        $items[] = $item;
    }
    lumi_ok(['items' => $items, 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $perPage))]);
}

function lumi_action_admin_delete_message(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $messageId = (int)lumi_param('message_id', 0);
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT * FROM messages WHERE id=?");
    $st->execute([$messageId]);
    $message = $st->fetch();
    if (!$message) lumi_err('消息不存在', 404);
    $pdo->prepare("DELETE FROM messages WHERE id=?")->execute([$messageId]);
    $pdo->prepare("UPDATE conversations SET message_count=MAX(0, message_count-1) WHERE id=?")->execute([(int)$message['conversation_id']]);
    $pdo->prepare("UPDATE users SET total_messages=MAX(0, total_messages-1) WHERE id=?")->execute([(int)$message['user_id']]);
    lumi_audit($admin, 'message.delete', 'message', (string)$messageId, '删除用户 ' . $message['user_id'] . ' 的一条消息');
    lumi_ok([], '消息已删除');
}

function lumi_action_admin_pin_message(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $messageId = (int)lumi_param('message_id', 0);
    $pinned = (int)lumi_param('pinned', 1) ? 1 : 0;
    $st = lumi_db()->prepare("SELECT id, user_id FROM messages WHERE id=?");
    $st->execute([$messageId]);
    if (!$st->fetch()) lumi_err('消息不存在', 404);
    lumi_db()->prepare("UPDATE messages SET pinned=? WHERE id=?")->execute([$pinned, $messageId]);
    lumi_audit($admin, 'message.pin', 'message', (string)$messageId, $pinned ? '设为精选回忆' : '取消精选');
    lumi_ok(['pinned' => $pinned]);
}

function lumi_action_admin_send_message(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $userId = (int)lumi_param('user_id', 0);
    $content = lumi_clean_text((string)lumi_param('content', ''), 2000);
    if ($content === '') lumi_err('消息内容不能为空');
    $st = lumi_db()->prepare("SELECT * FROM users WHERE id=? AND status!='deleted'");
    $st->execute([$userId]);
    $user = $st->fetch();
    if (!$user) lumi_err('用户不存在', 404);
    $conversationId = lumi_current_conversation_id($userId);
    $saved = lumi_save_message($userId, $conversationId, 'system', $content, 'calm', 0, false, ['admin_message' => true, 'admin_name' => $admin['display_name']]);
    lumi_audit($admin, 'message.send', 'user', (string)$userId, '向用户发送一条人工关怀消息');
    lumi_ok(['message_id' => $saved['id'], 'conversation_id' => $conversationId], '消息已送达');
}

// =====================================================================
// 管理后台 · 情绪洞察
// =====================================================================

function lumi_action_admin_mood_analytics(): void
{
    lumi_require_admin();
    $pdo = lumi_db();
    $days = [];
    for ($i = 29; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-{$i} day"));
        $days[$date] = ['date' => date('m-d', strtotime($date)), 'valence' => 0, 'anger' => 0, 'sadness' => 0, 'affection' => 0, 'count' => 0];
    }
    $start = strtotime('-29 days midnight');
    $rows = $pdo->query("SELECT strftime('%Y-%m-%d', created_at, 'unixepoch', '+8 hours') d, ROUND(AVG(valence)) v, ROUND(AVG(anger)) a, ROUND(AVG(sadness)) s, ROUND(AVG(affection)) af, COUNT(*) c FROM mood_logs WHERE created_at>=$start GROUP BY d")->fetchAll();
    foreach ($rows as $row) {
        if (isset($days[$row['d']])) {
            $days[$row['d']] = ['date' => date('m-d', strtotime($row['d'])), 'valence' => (int)$row['v'], 'anger' => (int)$row['a'], 'sadness' => (int)$row['s'], 'affection' => (int)$row['af'], 'count' => (int)$row['c']];
        }
    }
    $dist = $pdo->query("SELECT mood_label, COUNT(*) c FROM users WHERE status!='deleted' GROUP BY mood_label ORDER BY c DESC")->fetchAll();
    $highRisk = [];
    foreach ($pdo->query("SELECT * FROM users WHERE status!='deleted' AND (sadness>=50 OR anger>=45) ORDER BY sadness DESC, anger DESC LIMIT 12")->fetchAll() as $row) {
        $highRisk[] = [
            'id' => (int)$row['id'], 'username' => $row['username'], 'nickname' => $row['nickname'],
            'mood' => lumi_mood_label($row), 'sadness' => (int)$row['sadness'], 'anger' => (int)$row['anger'],
            'affection' => (int)$row['affection'], 'last_active_at' => (int)$row['last_active_at'],
        ];
    }
    $interactions = $pdo->query("SELECT type, COUNT(*) c FROM interactions GROUP BY type ORDER BY c DESC")->fetchAll();
    $totalMoodLogs = (int)$pdo->query("SELECT COUNT(*) FROM mood_logs")->fetchColumn();
    $todayMessages = (int)$pdo->query("SELECT COUNT(*) FROM messages WHERE created_at>=" . strtotime('today'))->fetchColumn();
    lumi_ok([
        'days' => array_values($days),
        'distribution' => $dist,
        'high_risk' => $highRisk,
        'interactions' => $interactions,
        'summary' => ['mood_logs' => $totalMoodLogs, 'today_messages' => $todayMessages],
    ]);
}

// =====================================================================
// 管理后台 · 设置与模型
// =====================================================================

function lumi_action_admin_settings(): void
{
    lumi_require_admin(['superadmin', 'admin']);
    $settings = lumi_settings();
    $rawKey = lumi_decrypt((string)($settings['model_key'] ?? ''));
    $settings['model_key'] = '';
    $settings['model_key_masked'] = lumi_mask_key($rawKey);
    $settings['model_key_set'] = $rawKey !== '';
    $settings['model_configured'] = lumi_model_config()['configured'];
    $settings['version'] = LUMI_VERSION;
    unset($settings['model_system_prompt_full']);
    lumi_ok(['settings' => $settings]);
}

function lumi_action_admin_save_settings(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $allowed = [
        'app_name', 'app_tagline', 'allow_register', 'default_theme', 'welcome_message',
        'proactive_enabled', 'proactive_idle_seconds', 'proactive_cooldown_seconds', 'proactive_probability',
        'max_context_messages', 'safety_enabled', 'maintenance_mode', 'support_contact',
        'register_bonus_affection', 'max_message_length', 'messages_per_minute',
    ];
    $changed = [];
    foreach ($allowed as $key) {
        if (lumi_param($key, null) !== null) {
            $value = lumi_param($key);
            if (is_bool($value)) $value = $value ? '1' : '0';
            if (is_array($value)) continue;
            $value = lumi_clean_text((string)$value, $key === 'welcome_message' || $key === 'app_tagline' ? 1000 : 200);
            if ($key === 'default_theme' && !in_array($value, lumi_theme_ids(), true)) {
                continue;
            }
            lumi_set_setting($key, $value);
            $changed[] = $key;
        }
    }
    lumi_audit($admin, 'settings.update', 'settings', '', '更新系统设置：' . implode(', ', $changed));
    lumi_ok(['changed' => $changed], '设置已保存');
}

function lumi_action_admin_model_save(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $provider = lumi_clean_text((string)lumi_param('model_provider', 'custom'), 30);
    $base = trim((string)lumi_param('model_base', ''));
    $model = lumi_clean_text((string)lumi_param('model_name', ''), 120);
    $temperature = (float)lumi_param('model_temperature', 0.9);
    $maxTokens = (int)lumi_param('model_max_tokens', 480);
    $systemPrompt = (string)lumi_param('model_system_prompt', '');
    $key = (string)lumi_param('model_key', '');
    $clearKey = (int)lumi_param('clear_key', 0);

    if ($base !== '' && !preg_match('#^https?://#i', $base)) {
        lumi_err('接口地址必须以 http:// 或 https:// 开头');
    }
    if ($model === '') {
        lumi_err('请填写模型名称');
    }
    if ($temperature < 0 || $temperature > 2) {
        lumi_err('温度需要在 0 - 2 之间');
    }
    if ($maxTokens < 64 || $maxTokens > 8192) {
        lumi_err('最大输出 token 需要在 64 - 8192 之间');
    }
    lumi_set_setting('model_provider', $provider);
    lumi_set_setting('model_base', $base);
    lumi_set_setting('model_name', $model);
    lumi_set_setting('model_temperature', (string)$temperature);
    lumi_set_setting('model_max_tokens', (string)$maxTokens);
    if ($systemPrompt !== '') {
        lumi_set_setting('model_system_prompt', mb_substr($systemPrompt, 0, 8000));
    }
    if ($clearKey) {
        lumi_set_setting('model_key', '');
    } elseif ($key !== '' && mb_strpos($key, '•') === false && mb_strpos($key, '*') === false) {
        lumi_set_setting('model_key', lumi_encrypt($key));
    }
    lumi_audit($admin, 'model.save', 'settings', '', '更新模型配置：' . $model . ' @ ' . $base . ($key !== '' ? '（更新 Key）' : ''));
    lumi_ok(['configured' => lumi_model_config()['configured'], 'model_key_masked' => lumi_mask_key(lumi_model_config()['key'])], '模型配置已保存');
}

function lumi_action_admin_model_test(): void
{
    lumi_require_admin(['superadmin', 'admin']);
    $config = lumi_model_config();
    $base = trim((string)lumi_param('model_base', $config['base']));
    $model = trim((string)lumi_param('model_name', $config['model']));
    $key = (string)lumi_param('model_key', '');
    if ($key === '' || mb_strpos($key, '•') !== false) {
        $key = $config['key'];
    }
    if ($base === '' || $key === '' || $model === '') {
        lumi_err('请先填写接口地址、API Key 和模型名称');
    }
    $result = lumi_model_request([
        ['role' => 'system', 'content' => '你是一个温柔的中文陪伴助手。只回复一句简短自然的话。'],
        ['role' => 'user', 'content' => '你好，轻轻说一句话给我听。'],
    ], [
        'base' => $base,
        'key' => $key,
        'model' => $model,
        'temperature' => 0.7,
        'max_tokens' => 80,
    ]);
    if (!$result['ok']) {
        lumi_err($result['error'] ?: '连接失败', 400, ['latency' => $result['latency'] ?? 0]);
    }
    lumi_ok([
        'message' => mb_substr($result['content'], 0, 300),
        'latency' => $result['latency'],
        'model' => $result['model'] ?? $model,
    ], '连接成功，模型正在回应');
}

function lumi_action_admin_model_list(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $config = lumi_model_config();
    $base = trim((string)lumi_param('model_base', $config['base']));
    $key = (string)lumi_param('model_key', '');
    if ($key === '' || mb_strpos($key, '•') !== false) {
        $key = $config['key'];
    }
    if ($base === '' || !preg_match('#^https?://#i', $base)) {
        lumi_err('请先填写以 http:// 或 https:// 开头的接口地址');
    }
    if ($key === '') {
        lumi_err('请先填写 API Key，或先保存 Key 后再拉取');
    }
    $result = lumi_models_request($base, $key);
    if (!$result['ok']) {
        lumi_err($result['error'] ?: '拉取失败', 400);
    }
    lumi_audit($admin, 'model.list', 'settings', '', '拉取模型列表 ' . count($result['models']) . ' 个 @ ' . ($result['endpoint'] ?? $base));
    lumi_ok([
        'models' => $result['models'],
        'count' => count($result['models']),
        'endpoint' => $result['endpoint'] ?? '',
    ]);
}

// =====================================================================
// 管理后台 · 公告、敏感词、反馈
// =====================================================================

function lumi_action_admin_announcements(): void
{
    lumi_require_admin();
    $rows = lumi_db()->query("SELECT * FROM announcements ORDER BY id DESC LIMIT 50")->fetchAll();
    lumi_ok(['items' => $rows]);
}

function lumi_action_admin_announcement_save(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $id = (int)lumi_param('id', 0);
    $title = lumi_clean_text((string)lumi_param('title', ''), 80);
    $content = lumi_clean_text((string)lumi_param('content', ''), 1000);
    $level = (string)lumi_param('level', 'info');
    $active = (int)lumi_param('active', 1) ? 1 : 0;
    $expiresAt = (int)lumi_param('expires_at', 0);
    if ($title === '' || $content === '') lumi_err('公告标题和内容不能为空');
    if (!in_array($level, ['info', 'warm', 'important'], true)) $level = 'info';
    if ($expiresAt > 0 && $expiresAt <= time()) lumi_err('过期时间需要晚于现在');
    if ($id > 0) {
        lumi_db()->prepare("UPDATE announcements SET title=?, content=?, level=?, active=?, expires_at=? WHERE id=?")
            ->execute([$title, $content, $level, $active, $expiresAt, $id]);
        lumi_audit($admin, 'announcement.update', 'announcement', (string)$id, $title);
    } else {
        lumi_db()->prepare("INSERT INTO announcements (title, content, level, active, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([$title, $content, $level, $active, $expiresAt, $admin['display_name'], time()]);
        $id = (int)lumi_db()->lastInsertId();
        lumi_audit($admin, 'announcement.create', 'announcement', (string)$id, $title);
    }
    lumi_ok(['id' => $id], '公告已保存');
}

function lumi_action_admin_announcement_delete(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $id = (int)lumi_param('id', 0);
    lumi_db()->prepare("DELETE FROM announcements WHERE id=?")->execute([$id]);
    lumi_audit($admin, 'announcement.delete', 'announcement', (string)$id, '删除公告');
    lumi_ok([], '公告已删除');
}

function lumi_action_admin_words(): void
{
    lumi_require_admin();
    $rows = lumi_db()->query("SELECT * FROM sensitive_words ORDER BY id DESC")->fetchAll();
    lumi_ok(['items' => $rows]);
}

function lumi_action_admin_word_save(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $word = lumi_clean_text((string)lumi_param('word', ''), 60);
    $action = (string)lumi_param('word_action', 'review');
    $category = lumi_clean_text((string)lumi_param('category', '通用'), 30);
    if ($word === '') lumi_err('敏感词不能为空');
    if (!in_array($action, ['block', 'review'], true)) $action = 'review';
    try {
        lumi_db()->prepare("INSERT INTO sensitive_words (word, action, category, created_at) VALUES (?, ?, ?, ?)")
            ->execute([$word, $action, $category, time()]);
    } catch (Throwable $e) {
        lumi_err('这个词已经在规则里了');
    }
    lumi_audit($admin, 'word.create', 'word', '', $word . ' / ' . $action);
    lumi_ok([], '敏感词已添加');
}

function lumi_action_admin_word_delete(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $id = (int)lumi_param('id', 0);
    lumi_db()->prepare("DELETE FROM sensitive_words WHERE id=?")->execute([$id]);
    lumi_audit($admin, 'word.delete', 'word', (string)$id, '删除敏感词规则');
    lumi_ok([], '已删除');
}

function lumi_action_admin_feedbacks(): void
{
    lumi_require_admin();
    $pdo = lumi_db();
    $status = (string)lumi_param('status', 'all');
    $page = max(1, (int)lumi_param('page', 1));
    $perPage = 15;
    $offset = ($page - 1) * $perPage;
    $where = '1=1';
    $params = [];
    if (in_array($status, ['open', 'replied', 'closed'], true)) {
        $where = 'f.status=?';
        $params[] = $status;
    }
    $countSt = $pdo->prepare("SELECT COUNT(*) FROM feedbacks f WHERE $where");
    $countSt->execute($params);
    $total = (int)$countSt->fetchColumn();
    $sql = "SELECT f.*, u.username, u.nickname, u.theme FROM feedbacks f LEFT JOIN users u ON u.id=f.user_id WHERE $where ORDER BY f.id DESC LIMIT $perPage OFFSET $offset";
    $st = $pdo->prepare($sql);
    $st->execute($params);
    lumi_ok(['items' => $st->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $perPage))]);
}

function lumi_action_admin_feedback_reply(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $id = (int)lumi_param('id', 0);
    $reply = lumi_clean_text((string)lumi_param('reply', ''), 1000);
    $status = (string)lumi_param('status', 'replied');
    if ($reply === '') lumi_err('回复内容不能为空');
    if (!in_array($status, ['open', 'replied', 'closed'], true)) $status = 'replied';
    $st = lumi_db()->prepare("SELECT id FROM feedbacks WHERE id=?");
    $st->execute([$id]);
    if (!$st->fetch()) lumi_err('反馈不存在', 404);
    lumi_db()->prepare("UPDATE feedbacks SET reply=?, status=?, replied_at=?, replied_by=? WHERE id=?")
        ->execute([$reply, $status, time(), $admin['display_name'], $id]);
    lumi_audit($admin, 'feedback.reply', 'feedback', (string)$id, $reply);
    lumi_ok([], '回复已保存');
}

// =====================================================================
// 管理后台 · 管理员、日志、工具
// =====================================================================

function lumi_action_admin_admins(): void
{
    lumi_require_admin(['superadmin']);
    $rows = lumi_db()->query("SELECT id, username, display_name, role, status, last_login_at, last_login_ip, created_at FROM admins ORDER BY id ASC")->fetchAll();
    lumi_ok(['items' => $rows]);
}

function lumi_action_admin_save_admin(): void
{
    $current = lumi_require_admin(['superadmin']);
    $id = (int)lumi_param('id', 0);
    $username = trim((string)lumi_param('username', ''));
    $display = lumi_clean_text((string)lumi_param('display_name', ''), 40);
    $role = (string)lumi_param('role', 'admin');
    $status = (string)lumi_param('status', 'active');
    $password = (string)lumi_param('password', '');
    if (!in_array($role, ['superadmin', 'admin', 'moderator'], true)) lumi_err('角色不正确');
    if (!in_array($status, ['active', 'disabled'], true)) $status = 'active';
    if ($display === '') $display = $username;
    $pdo = lumi_db();
    if ($id > 0) {
        if ($id === (int)$current['id'] && $status === 'disabled') lumi_err('不能停用当前登录的管理员');
        $st = $pdo->prepare("SELECT * FROM admins WHERE id=?");
        $st->execute([$id]);
        $existing = $st->fetch();
        if (!$existing) lumi_err('管理员不存在', 404);
        $fields = ['display_name=?', 'role=?', 'status=?'];
        $params = [$display, $role, $status];
        if ($password !== '') {
            if (mb_strlen($password) < 8) lumi_err('管理员密码至少 8 位');
            $fields[] = 'password_hash=?';
            $params[] = password_hash($password, PASSWORD_DEFAULT);
        }
        $params[] = $id;
        $pdo->prepare("UPDATE admins SET " . implode(', ', $fields) . " WHERE id=?")->execute($params);
        lumi_audit($current, 'admin.update', 'admin', (string)$id, '更新管理员 ' . $username);
    } else {
        if (!preg_match('/^[A-Za-z0-9_]{3,30}$/', $username)) lumi_err('后台用户名需为 3-30 位字母、数字或下划线');
        if (mb_strlen($password) < 8) lumi_err('管理员密码至少 8 位');
        try {
            $pdo->prepare("INSERT INTO admins (username, password_hash, display_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $display, $role, $status, time()]);
        } catch (Throwable $e) {
            lumi_err('这个后台用户名已经存在');
        }
        $id = (int)$pdo->lastInsertId();
        lumi_audit($current, 'admin.create', 'admin', (string)$id, '新增管理员 ' . $username);
    }
    lumi_ok(['id' => $id], '管理员已保存');
}

function lumi_action_admin_delete_admin(): void
{
    $current = lumi_require_admin(['superadmin']);
    $id = (int)lumi_param('id', 0);
    if ($id === (int)$current['id']) lumi_err('不能删除当前登录的管理员');
    $st = lumi_db()->prepare("SELECT * FROM admins WHERE id=?");
    $st->execute([$id]);
    $admin = $st->fetch();
    if (!$admin) lumi_err('管理员不存在', 404);
    if ($admin['role'] === 'superadmin') {
        $count = (int)lumi_db()->query("SELECT COUNT(*) FROM admins WHERE role='superadmin' AND status='active'")->fetchColumn();
        if ($count <= 1) lumi_err('至少要保留一位超级管理员');
    }
    lumi_db()->prepare("DELETE FROM admins WHERE id=?")->execute([$id]);
    lumi_db()->prepare("DELETE FROM admin_sessions WHERE admin_id=?")->execute([$id]);
    lumi_audit($current, 'admin.delete', 'admin', (string)$id, '删除管理员 ' . $admin['username']);
    lumi_ok([], '管理员已删除');
}

function lumi_action_admin_audit_logs(): void
{
    lumi_require_admin();
    $pdo = lumi_db();
    $page = max(1, (int)lumi_param('page', 1));
    $perPage = 25;
    $offset = ($page - 1) * $perPage;
    $q = trim((string)lumi_param('q', ''));
    $where = '1=1';
    $params = [];
    if ($q !== '') {
        $where = "(admin_name LIKE ? OR action LIKE ? OR detail LIKE ?)";
        $params = ['%' . $q . '%', '%' . $q . '%', '%' . $q . '%'];
    }
    $st = $pdo->prepare("SELECT COUNT(*) FROM audit_logs WHERE $where");
    $st->execute($params);
    $total = (int)$st->fetchColumn();
    $st = $pdo->prepare("SELECT * FROM audit_logs WHERE $where ORDER BY id DESC LIMIT $perPage OFFSET $offset");
    $st->execute($params);
    lumi_ok(['items' => $st->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => max(1, (int)ceil($total / $perPage))]);
}

function lumi_action_admin_broadcast(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin', 'moderator']);
    $content = lumi_clean_text((string)lumi_param('content', ''), 2000);
    if ($content === '') lumi_err('关怀消息不能为空');
    $pdo = lumi_db();
    $users = $pdo->query("SELECT id FROM users WHERE status='active' ORDER BY id ASC")->fetchAll();
    $pdo->beginTransaction();
    try {
        foreach ($users as $row) {
            $conversationId = lumi_current_conversation_id((int)$row['id']);
            lumi_save_message((int)$row['id'], $conversationId, 'proactive', $content, 'calm', 0, false, ['broadcast' => true, 'admin_name' => $admin['display_name']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    lumi_audit($admin, 'broadcast.send', 'users', '', '向 ' . count($users) . ' 位用户发送关怀消息');
    lumi_ok(['count' => count($users)], '关怀消息已送达');
}

function lumi_action_admin_backup(): void
{
    $admin = lumi_require_admin(['superadmin']);
    $pdo = lumi_db();
    $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
    $file = lumi_data_dir() . '/' . LUMI_DB_FILE;
    if (!is_file($file)) lumi_err('数据库文件不存在', 404);
    lumi_audit($admin, 'system.backup', 'system', '', '下载数据库备份');
    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="xinyu-backup-' . date('Ymd-His') . '.sqlite"');
    header('Content-Length: ' . filesize($file));
    readfile($file);
    exit;
}

function lumi_action_admin_export_users(): void
{
    $admin = lumi_require_admin(['superadmin', 'admin']);
    $rows = lumi_db()->query("SELECT id, username, nickname, email, phone, theme, status, affection, trust, mood_label, sadness, anger, energy, total_messages, register_ip, last_ip, last_active_at, created_at FROM users WHERE status!='deleted' ORDER BY id ASC")->fetchAll();
    lumi_audit($admin, 'system.export_users', 'users', '', '导出用户数据 CSV');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="xinyu-users-' . date('Ymd-His') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['ID', '用户名', '昵称', '邮箱', '手机', '主题', '状态', '亲密度', '信任', '当前情绪', '难过', '生气', '精力', '消息数', '注册IP', '最后IP', '最后活跃', '注册时间']);
    foreach ($rows as $row) {
        fputcsv($out, [
            $row['id'], $row['username'], $row['nickname'], $row['email'], $row['phone'], $row['theme'], $row['status'],
            $row['affection'], $row['trust'], $row['mood_label'], $row['sadness'], $row['anger'], $row['energy'], $row['total_messages'],
            $row['register_ip'], $row['last_ip'],
            $row['last_active_at'] ? date('Y-m-d H:i:s', (int)$row['last_active_at']) : '',
            $row['created_at'] ? date('Y-m-d H:i:s', (int)$row['created_at']) : '',
        ]);
    }
    fclose($out);
    exit;
}

function lumi_action_admin_system_info(): void
{
    lumi_require_admin(['superadmin', 'admin']);
    $pdo = lumi_db();
    $dbFile = lumi_data_dir() . '/' . LUMI_DB_FILE;
    $modelLogFile = lumi_data_dir() . '/model.log';
    $modelLog = '';
    if (is_file($modelLogFile)) {
        $lines = file($modelLogFile, FILE_IGNORE_NEW_LINES);
        $modelLog = implode("\n", array_slice($lines ?: [], -20));
    }
    lumi_ok([
        'version' => LUMI_VERSION,
        'php' => PHP_VERSION,
        'sqlite' => $pdo->query('SELECT sqlite_version()')->fetchColumn(),
        'db_size' => is_file($dbFile) ? filesize($dbFile) : 0,
        'data_dir' => lumi_data_dir(),
        'disk_free' => @disk_free_space(lumi_data_dir()) ?: 0,
        'model_log' => $modelLog,
        'model_configured' => lumi_model_config()['configured'],
        'server_time' => lumi_now_text(),
        'sessions' => (int)$pdo->query("SELECT COUNT(*) FROM user_sessions WHERE expires_at>" . time())->fetchColumn(),
        'admin_sessions' => (int)$pdo->query("SELECT COUNT(*) FROM admin_sessions WHERE expires_at>" . time())->fetchColumn(),
    ]);
}
