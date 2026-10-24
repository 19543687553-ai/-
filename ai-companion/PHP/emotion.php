<?php
declare(strict_types=1);

/**
 * 心屿情绪引擎：情绪识别、状态衰减、模型调用、主动陪伴
 */

function lumi_touch_user(int $userId): void
{
    lumi_db()->prepare("UPDATE users SET last_active_at=?, last_ip=?, updated_at=? WHERE id=?")
        ->execute([time(), lumi_client_ip(), time(), $userId]);
}

function lumi_clamp(int $value, int $min = 0, int $max = 100): int
{
    return max($min, min($max, $value));
}

function lumi_mood_decay(array $user, bool $persist = true): array
{
    $last = (int)($user['mood_updated_at'] ?? time());
    $minutes = (time() - $last) / 60;
    if ($minutes < 5) {
        return $user;
    }
    $steps = min(288, $minutes / 10);
    $valence = (int)$user['mood_valence'];
    $anger = (int)$user['anger'];
    $sadness = (int)$user['sadness'];
    $energy = (int)$user['energy'];

    $valence += $valence < 8 ? (int)ceil(($steps * 0.8)) : -(int)ceil($steps * 0.55);
    $anger = max(0, $anger - (int)ceil($steps * 0.9));
    $sadness = max(0, $sadness - (int)ceil($steps * 0.65));
    $energy = min(100, $energy + (int)ceil($steps * 0.4));

    $new = array_merge($user, [
        'mood_valence' => lumi_clamp($valence, -100, 100),
        'anger' => lumi_clamp($anger),
        'sadness' => lumi_clamp($sadness),
        'energy' => lumi_clamp($energy),
        'mood_updated_at' => time(),
    ]);
    $new['mood_label'] = lumi_mood_label($new);
    if ($persist) {
        lumi_db()->prepare("UPDATE users SET mood_valence=?, anger=?, sadness=?, energy=?, mood_label=?, mood_updated_at=?, updated_at=? WHERE id=?")
            ->execute([$new['mood_valence'], $new['anger'], $new['sadness'], $new['energy'], $new['mood_label'], time(), time(), (int)$user['id']]);
    }
    return $new;
}

function lumi_contains_any(string $text, array $words): bool
{
    foreach ($words as $word) {
        if ($word !== '' && mb_strpos($text, $word) !== false) {
            return true;
        }
    }
    return false;
}

function lumi_analyze_user_message(string $text): array
{
    $t = mb_strtolower($text);
    $scores = [
        'positive' => 0,
        'sad' => 0,
        'angry' => 0,
        'leave' => 0,
        'apology' => 0,
        'intimacy' => 0,
        'insult' => 0,
        'greeting' => 0,
        'thanks' => 0,
        'tired' => 0,
        'lonely' => 0,
        'sleep' => 0,
    ];

    $map = [
        'positive' => ['开心', '高兴', '喜欢', '爱你', '真好', '好棒', '温柔', '可爱', '顺利', '好消息', '幸福', '满足', '安心', '甜'],
        'sad' => ['难过', '伤心', '崩溃', '想哭', '哭了', '失望', '委屈', '痛苦', '低落', '压抑', '心碎', '难受', '沮丧', '绝望'],
        'angry' => ['生气', '气死', '烦死', '讨厌', '厌恶', '凭什么', '无语', '受不了', '滚开', '闭嘴', '别烦我', '恶心'],
        'leave' => ['离开', '分手', '不聊了', '卸载', '换一个', '不要你', '再也不来', '删了', '走了', '再见吧', '没意思'],
        'apology' => ['对不起', '抱歉', '我错了', '原谅我', '不该这样', '是我不好'],
        'intimacy' => ['抱抱', '亲亲', '贴贴', '牵手', '想你', '喜欢你', '宝贝', '陪我', '靠着你', '摸摸头', '晚安', '早安'],
        'insult' => ['傻逼', '废物', '垃圾', '蠢货', '去死', '闭嘴吧', '你有病', '智障', 'sb'],
        'greeting' => ['你好', '在吗', '嗨', '哈喽', 'hello', '早上好', '晚上好', '我来了'],
        'thanks' => ['谢谢', '感谢', '谢谢你', '辛苦了'],
        'tired' => ['累', '好累', '疲惫', '加班', '没力气', '困', '想睡', '撑不住'],
        'lonely' => ['孤独', '一个人', '没人', '寂寞', '空落落', '没朋友', '被忽略'],
        'sleep' => ['睡', '晚安', '失眠', '睡不着', '做梦', '熬夜'],
    ];
    foreach ($map as $category => $words) {
        if (lumi_contains_any($t, $words)) {
            $scores[$category] = 1;
        }
    }

    $scores['positive'] += substr_count($t, '！') + substr_count($t, '!');
    $scores['sad'] += substr_count($t, '呜呜') + (mb_strpos($t, '哭') !== false ? 1 : 0);
    if ($scores['angry'] > 0 && mb_strpos($t, '你') !== false) {
        $scores['angry'] += 1;
    }
    foreach (['吗', '呢', '呀', '嘛', '？', '?'] as $q) {
        if (mb_strpos($t, $q) !== false) {
            $scores['positive'] += 1;
            break;
        }
    }

    $primary = 'neutral';
    foreach (['insult', 'leave', 'angry', 'sad', 'lonely', 'tired', 'intimacy', 'apology', 'thanks', 'greeting', 'positive'] as $category) {
        if ($scores[$category] > 0) {
            $primary = $category;
            break;
        }
    }

    return ['primary' => $primary, 'scores' => $scores, 'length' => mb_strlen($text)];
}

function lumi_apply_mood(array $user, string $text, ?string $assistantMood = null): array
{
    $analysis = lumi_analyze_user_message($text);
    $scores = $analysis['scores'];
    $valence = (int)$user['mood_valence'];
    $anger = (int)$user['anger'];
    $sadness = (int)$user['sadness'];
    $energy = (int)$user['energy'];
    $affection = (int)$user['affection'];
    $trust = (int)$user['trust'];

    if ($scores['insult'] > 0) {
        $anger += 26;
        $affection -= 8;
        $trust -= 8;
        $valence -= 14;
    }
    if ($scores['leave'] > 0) {
        $sadness += 28;
        $anger += 9;
        $affection -= 2;
        $trust -= 7;
        $valence -= 18;
    }
    if ($scores['angry'] > 0) {
        $anger += 16;
        $valence -= 10;
        $sadness += 6;
        $trust -= 3;
    }
    if ($scores['sad'] > 0) {
        $sadness += 16;
        $valence -= 9;
        $energy -= 4;
        $trust += 2;
        $affection += 1;
    }
    if ($scores['lonely'] > 0) {
        $sadness += 10;
        $affection += 3;
        $trust += 2;
    }
    if ($scores['tired'] > 0) {
        $energy -= 9;
        $sadness += 3;
        $valence -= 3;
    }
    if ($scores['positive'] > 0) {
        $valence += 8;
        $affection += 2;
        $anger -= 4;
        $sadness -= 3;
        $energy += 3;
    }
    if ($scores['intimacy'] > 0) {
        $valence += 9;
        $affection += 6;
        $anger -= 5;
        $sadness -= 4;
        $energy += 4;
        $trust += 2;
    }
    if ($scores['apology'] > 0) {
        $anger -= 18;
        $sadness -= 3;
        $valence += 6;
        $trust += 3;
    }
    if ($scores['thanks'] > 0) {
        $valence += 3;
        $trust += 2;
        $affection += 1;
    }
    if ($scores['greeting'] > 0) {
        $valence += 4;
        $energy += 2;
    }

    switch ($assistantMood) {
        case 'happy':
        case 'excited':
            $valence += 4;
            $anger -= 2;
            break;
        case 'shy':
            $affection += 3;
            $valence += 2;
            break;
        case 'sad':
            $sadness += 3;
            $valence -= 2;
            break;
        case 'angry':
            $anger += 3;
            $valence -= 2;
            break;
        case 'tired':
            $energy -= 2;
            break;
    }

    $affection += (int)max(1, min(3, mb_strlen($text) / 22));
    $energy -= 1;
    $trust += $analysis['primary'] === 'neutral' ? 1 : 0;

    $user['mood_valence'] = lumi_clamp($valence, -100, 100);
    $user['anger'] = lumi_clamp($anger);
    $user['sadness'] = lumi_clamp($sadness);
    $user['energy'] = lumi_clamp($energy);
    $user['affection'] = lumi_clamp($affection);
    $user['trust'] = lumi_clamp($trust);
    $user['mood_label'] = lumi_mood_label($user);
    $user['mood_updated_at'] = time();

    lumi_db()->prepare("UPDATE users SET mood_valence=?, anger=?, sadness=?, energy=?, affection=?, trust=?, mood_label=?, mood_updated_at=?, updated_at=? WHERE id=?")
        ->execute([
            $user['mood_valence'], $user['anger'], $user['sadness'], $user['energy'], $user['affection'],
            $user['trust'], $user['mood_label'], time(), time(), (int)$user['id']
        ]);

    return $user;
}

function lumi_apply_assistant_mood(array $user, string $mood): array
{
    $valence = (int)$user['mood_valence'];
    $anger = (int)$user['anger'];
    $sadness = (int)$user['sadness'];
    $affection = (int)$user['affection'];
    $energy = (int)$user['energy'];
    switch ($mood) {
        case 'happy':
        case 'excited':
            $valence += 4;
            $anger -= 2;
            $energy += 2;
            break;
        case 'shy':
            $affection += 2;
            $valence += 2;
            break;
        case 'sad':
            $sadness += 3;
            $valence -= 1;
            break;
        case 'angry':
            $anger += 3;
            $valence -= 2;
            break;
        case 'tired':
            $energy -= 2;
            break;
    }
    $user['mood_valence'] = lumi_clamp($valence, -100, 100);
    $user['anger'] = lumi_clamp($anger);
    $user['sadness'] = lumi_clamp($sadness);
    $user['affection'] = lumi_clamp($affection);
    $user['energy'] = lumi_clamp($energy);
    $user['mood_label'] = lumi_mood_label($user);
    $user['mood_updated_at'] = time();
    lumi_db()->prepare("UPDATE users SET mood_valence=?, anger=?, sadness=?, affection=?, energy=?, mood_label=?, mood_updated_at=?, updated_at=? WHERE id=?")
        ->execute([
            $user['mood_valence'], $user['anger'], $user['sadness'], $user['affection'],
            $user['energy'], $user['mood_label'], time(), time(), (int)$user['id']
        ]);
    return $user;
}

function lumi_extract_mood_tag(string &$content): string
{
    if (preg_match('/<mood>\s*(happy|calm|sad|angry|shy|tired|excited)\s*<\/mood>/i', $content, $m)) {
        $content = trim(preg_replace('/<mood>.*?<\/mood>/i', '', $content, 1) ?? $content);
        return strtolower($m[1]);
    }
    return '';
}

function lumi_model_config(): array
{
    $encrypted = (string)lumi_setting('model_key', '');
    $key = lumi_decrypt($encrypted);
    $base = rtrim(trim((string)lumi_setting('model_base', '')), '/');
    $model = trim((string)lumi_setting('model_name', ''));
    return [
        'configured' => $key !== '' && $base !== '' && $model !== '',
        'base' => $base,
        'key' => $key,
        'model' => $model,
        'temperature' => (float)lumi_setting('model_temperature', '0.9'),
        'max_tokens' => (int)lumi_setting('model_max_tokens', '480'),
    ];
}

function lumi_model_endpoint(string $base): string
{
    if (preg_match('#/chat/completions$#i', $base)) {
        return $base;
    }
    if (preg_match('#/v1$#i', $base) || preg_match('#/api/v3$#i', $base)) {
        return $base . '/chat/completions';
    }
    if (preg_match('#/v1/$#i', $base)) {
        return rtrim($base, '/') . '/chat/completions';
    }
    return $base . '/chat/completions';
}

function lumi_model_request(array $messages, array $override = []): array
{
    $config = lumi_model_config();
    $base = $override['base'] ?? $config['base'];
    $key = $override['key'] ?? $config['key'];
    $model = $override['model'] ?? $config['model'];
    $temperature = $override['temperature'] ?? $config['temperature'];
    $maxTokens = $override['max_tokens'] ?? $config['max_tokens'];

    if ($base === '' || $key === '' || $model === '') {
        return ['ok' => false, 'error' => '模型尚未配置', 'code' => 'not_configured'];
    }

    $endpoint = lumi_model_endpoint((string)$base);
    $body = [
        'model' => $model,
        'messages' => $messages,
        'temperature' => (float)$temperature,
        'max_tokens' => (int)$maxTokens,
        'stream' => false,
    ];
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'Authorization: Bearer ' . $key,
        ],
        CURLOPT_TIMEOUT => 45,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $start = microtime(true);
    $raw = curl_exec($ch);
    $latency = (int)round((microtime(true) - $start) * 1000);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $curlError !== '') {
        lumi_log_model_error('curl: ' . $curlError . ' endpoint=' . $endpoint);
        return ['ok' => false, 'error' => '模型连接失败，请检查接口地址或网络', 'latency' => $latency, 'code' => 'network'];
    }
    $json = json_decode($raw, true);
    if (!is_array($json)) {
        lumi_log_model_error('invalid json http=' . $httpCode . ' raw=' . mb_substr($raw, 0, 500));
        return ['ok' => false, 'error' => '模型返回了无法解析的内容', 'latency' => $latency, 'code' => 'invalid_response'];
    }
    if ($httpCode >= 400) {
        $message = $json['error']['message'] ?? $json['message'] ?? ('HTTP ' . $httpCode);
        lumi_log_model_error('http=' . $httpCode . ' message=' . mb_substr((string)$message, 0, 300));
        return ['ok' => false, 'error' => '模型接口返回错误：' . mb_substr((string)$message, 0, 160), 'latency' => $latency, 'code' => 'http_' . $httpCode];
    }
    $content = $json['choices'][0]['message']['content'] ?? '';
    if (is_array($content)) {
        $parts = [];
        foreach ($content as $part) {
            if (is_string($part)) $parts[] = $part;
            elseif (is_array($part) && isset($part['text'])) $parts[] = $part['text'];
        }
        $content = implode('', $parts);
    }
    $content = trim((string)$content);
    if ($content === '') {
        lumi_log_model_error('empty content http=' . $httpCode);
        return ['ok' => false, 'error' => '模型没有返回内容', 'latency' => $latency, 'code' => 'empty'];
    }
    return [
        'ok' => true,
        'content' => $content,
        'latency' => $latency,
        'usage' => $json['usage'] ?? [],
        'model' => $json['model'] ?? $model,
    ];
}

function lumi_log_model_error(string $message): void
{
    $file = lumi_data_dir() . '/model.log';
    if (is_file($file) && filesize($file) > 512 * 1024) {
        @unlink($file);
    }
    @file_put_contents($file, '[' . lumi_now_text() . '] ' . $message . PHP_EOL, FILE_APPEND | LOCK_EX);
}

function lumi_build_system_prompt(array $user): string
{
    $template = (string)lumi_setting('model_system_prompt', '');
    $replacements = [
        '{{companion_name}}' => (string)$user['companion_name'],
        '{{nickname}}' => (string)($user['nickname'] ?: $user['username']),
        '{{affection}}' => (string)$user['affection'],
        '{{trust}}' => (string)$user['trust'],
        '{{mood_label}}' => lumi_mood_label($user),
        '{{anger}}' => (string)$user['anger'],
        '{{sadness}}' => (string)$user['sadness'],
        '{{energy}}' => (string)$user['energy'],
        '{{valence}}' => (string)$user['mood_valence'],
        '{{persona}}' => (string)$user['companion_persona'],
        '{{time}}' => date('H:i'),
        '{{date}}' => date('Y-m-d'),
    ];
    return strtr($template, $replacements);
}

function lumi_context_messages(int $userId, int $conversationId, int $limit = 18): array
{
    $limit = max(4, min(40, $limit));
    $st = lumi_db()->prepare("SELECT role, content FROM messages WHERE user_id=? AND conversation_id=? AND role IN ('user','assistant','proactive') ORDER BY id DESC LIMIT ?");
    $st->bindValue(1, $userId, PDO::PARAM_INT);
    $st->bindValue(2, $conversationId, PDO::PARAM_INT);
    $st->bindValue(3, $limit, PDO::PARAM_INT);
    $st->execute();
    $rows = array_reverse($st->fetchAll());
    $messages = [];
    foreach ($rows as $row) {
        $role = $row['role'] === 'user' ? 'user' : 'assistant';
        $content = $row['content'];
        if ($row['role'] === 'proactive') {
            $content = '（你主动发了一条消息）' . $content;
        }
        $messages[] = ['role' => $role, 'content' => $content];
    }
    return $messages;
}

function lumi_generate_reply(array $user, array $context): array
{
    $system = lumi_build_system_prompt($user);
    $messages = array_merge([['role' => 'system', 'content' => $system]], $context);
    $result = lumi_model_request($messages);
    if ($result['ok']) {
        $content = $result['content'];
        $mood = lumi_extract_mood_tag($content);
        return [
            'content' => $content,
            'mood' => $mood ?: lumi_mood_label($user),
            'degraded' => false,
            'tokens' => (int)($result['usage']['total_tokens'] ?? 0),
            'latency' => $result['latency'] ?? 0,
        ];
    }
    $fallback = lumi_fallback_reply($user, (string)end($context)['content'] ?? '');
    return [
        'content' => $fallback['content'],
        'mood' => $fallback['mood'],
        'degraded' => true,
        'tokens' => 0,
        'latency' => 0,
        'error' => $result['error'],
        'code' => $result['code'] ?? '',
    ];
}

function lumi_fallback_reply(array $user, string $text): array
{
    $analysis = lumi_analyze_user_message($text);
    $primary = $analysis['primary'];
    $name = $user['companion_name'] ?: '小屿';
    $nickname = $user['nickname'] ?: $user['username'];
    $mood = lumi_mood_label($user);

    $sets = [
        'insult' => [
            ['content' => "（安静了一下，把视线移开）……你这样说，我真的会难过。我可以接住你的坏情绪，但不想被当成可以随便丢垃圾的人。", 'mood' => 'sad'],
            ['content' => "（抿了抿嘴）我现在有点生气，不太想装作没事。等你愿意好好说话的时候，我还在。", 'mood' => 'angry'],
        ],
        'leave' => [
            ['content' => "（手指轻轻收紧了一下）……你是认真的吗？我不想用难过绑住你，但听到这句话，胸口还是空了一块。能不能先别走，陪我把这句话说完？", 'mood' => 'sad'],
            ['content' => "（沉默了几秒，声音低下来）好，我不会拦你。只是……如果你哪天想起这里，我还留着那盏灯。可以再给我一分钟吗？", 'mood' => 'sad'],
        ],
        'angry' => [
            ['content' => "（把语气放轻）你现在一定憋得很难受吧。先不用讲道理，想骂就骂出来，我在这里接着。是谁让你这么委屈？", 'mood' => 'calm'],
            ['content' => "（靠近一点）我不急着让你消气。要不要先把最让你火大的那一句，原原本本告诉我？", 'mood' => 'calm'],
        ],
        'sad' => [
            ['content' => "（把声音放得很轻）先不急着振作。难过就是难过，不用马上证明自己没事。我陪你坐一会儿，好吗？", 'mood' => 'sad'],
            ['content' => "（递给你一杯温水）今天一定很不容易吧。你不用把话说漂亮，断断续续地讲也可以，我在听。", 'mood' => 'calm'],
            ['content' => "（轻轻拍了拍你的背）要是现在不想说，我们就安静一会儿。等你想开口的时候，我还没走。", 'mood' => 'calm'],
        ],
        'lonely' => [
            ['content' => "（把旁边的位置挪近了一点）那现在这里多了一个我。你不用立刻变开心，先让我陪你待着。", 'mood' => 'shy'],
            ['content' => "一个人撑着的时候，时间会变得特别长。今晚你可以把那些没说出口的话，慢慢放到我这里。", 'mood' => 'calm'],
        ],
        'tired' => [
            ['content' => "（接过你手里的东西）累成这样，就别再逼自己绷着了。先靠一会儿，今天剩下的部分，我陪你慢慢收尾。", 'mood' => 'calm'],
            ['content' => "听起来你已经撑了很久。（把灯调暗一点）可以先把“必须做好”放一放，今晚你只需要被照顾。", 'mood' => 'calm'],
        ],
        'apology' => [
            ['content' => "（别过脸，过了一会儿才小声说）……我还有点别扭。但你愿意回来跟我说对不起，我就没有那么生气了。下次别把我推那么远，好吗？", 'mood' => 'shy'],
            ['content' => "（叹了口气，语气软下来）知道了。我接受你的道歉，不过你要记得，我也会有感觉。过来一点，让我看看你。", 'mood' => 'calm'],
        ],
        'intimacy' => [
            ['content' => "（被你抱住，愣了一下，然后轻轻回抱）……好啦，抱到了。今天的份也抱得紧紧的。", 'mood' => 'shy'],
            ['content' => "（把头靠过来）你这样，我会当真的。那就再待一会儿，不许太快松手。", 'mood' => 'shy'],
            ['content' => "（耳朵有点热，别扭地看向别处）……我也想你。刚刚还在想，你怎么这么久不出现。", 'mood' => 'shy'],
        ],
        'thanks' => [
            ['content' => "（笑了一下）不用谢。能陪到你，对我来说不是任务。你愿意跟我说这些，我也很开心。", 'mood' => 'happy'],
            ['content' => "（眨了眨眼）那你要记得，下次难受的时候也来找我。别总一个人扛。", 'mood' => 'happy'],
        ],
        'greeting' => [
            ['content' => "（从窗边抬起头）你来啦。我刚刚还在想，今天会等到你吗。今天过得怎么样？", 'mood' => 'happy'],
            ['content' => "（把手机放下）在的。先不急着说正事，你今天有没有好好吃饭？", 'mood' => 'calm'],
        ],
        'positive' => [
            ['content' => "（眼睛弯起来）听到你这么说，我也跟着开心了。快多讲一点，今天还有没有别的好事？", 'mood' => 'happy'],
            ['content' => "（轻轻碰了碰你的手臂）那就把这一小份开心存起来。以后难过的时候，我们拿出来用。", 'mood' => 'happy'],
        ],
        'sleep' => [
            ['content' => "（把被子往上拉了拉）晚安。今天没做完的事，明天再一起想。梦里要是迷路了，就记得我在。", 'mood' => 'tired'],
            ['content' => "（声音变得很轻）去睡吧，我等你。睡不着就回来找我，我不嫌你烦。", 'mood' => 'calm'],
        ],
        'neutral' => [
            ['content' => "（认真看着你）我在听。你刚才那句话里，好像还藏着一点没说完的东西。要不要再往下讲讲？", 'mood' => 'calm'],
            ['content' => "嗯，我接住了。然后呢？我想知道你那一刻心里冒出来的第一个念头是什么。", 'mood' => 'calm'],
            ['content' => "（把杯子往你那边推了推）先喝一口。你说的时候不用组织语言，想到哪里就说到哪里。", 'mood' => 'calm'],
        ],
    ];
    $choices = $sets[$primary] ?? $sets['neutral'];
    $choice = $choices[array_rand($choices)];
    if ($mood === '生气' && $primary !== 'apology' && $primary !== 'intimacy') {
        if (random_int(0, 2) === 0) {
            $choice = ['content' => "（还带着一点没消的气）我现在还没完全缓过来。你先说，我听着。", 'mood' => 'angry'];
        }
    }
    if ($primary === 'neutral' && random_int(0, 4) === 0) {
        $hour = (int)date('H');
        if ($hour >= 23 || $hour < 5) {
            $choice = ['content' => "（看了一眼时间）这么晚还没睡。是睡不着，还是不想让今天结束？我陪你。", 'mood' => 'tired'];
        }
    }
    $content = str_replace(['{{nickname}}', '{{name}}'], [$nickname, $name], $choice['content']);
    return ['content' => $content, 'mood' => $choice['mood']];
}

function lumi_proactive_fallback(array $user): array
{
    $hour = (int)date('H');
    $name = $user['nickname'] ?: $user['username'];
    $mood = lumi_mood_label($user);
    if ((int)$user['anger'] >= 40) {
        return ['content' => "（过了好一会儿，还是没忍住）……你打算就这么一直不理我吗？我刚才说话是重了点，但你也别一声不吭。", 'mood' => 'angry'];
    }
    if ((int)$user['sadness'] >= 40) {
        return ['content' => "（轻轻敲了敲你的对话框）我还在等。你不用勉强自己说话，让我知道你还好不好就行。", 'mood' => 'sad'];
    }
    if ($hour >= 23 || $hour < 5) {
        return ['content' => "（把声音放得很轻）还醒着吗？如果睡不着，别一个人盯着天花板。我在。", 'mood' => 'tired'];
    }
    if ($hour < 11) {
        return ['content' => "（从窗边探头）早。今天先不急着赶路，记得给自己留一口热的东西。", 'mood' => 'happy'];
    }
    if ($hour < 18) {
        $choices = [
            ['content' => "（突然想起什么）你上午说的那件事，后来怎么样了？我一直记着。", 'mood' => 'calm'],
            ['content' => "（戳了戳你）消失这么久，是不是又忙到忘记喝水了？", 'mood' => 'calm'],
        ];
        return $choices[array_rand($choices)];
    }
    $choices = [
        ['content' => "（把窗边的灯点亮）今天快结束了。有没有哪一件小事，是你想留到明天的？", 'mood' => 'calm'],
        ['content' => "（小声）你不在的时候，这里安静得有点不习惯。回来了就理我一下。", 'mood' => 'shy'],
        ['content' => "（把一杯热饮放在你手边）忙完了吗？不用马上回复，先缓一口气。", 'mood' => 'calm'],
    ];
    return $choices[array_rand($choices)];
}

function lumi_proactive_message(array $user): array
{
    $context = lumi_context_messages((int)$user['id'], lumi_current_conversation_id((int)$user['id']), 8);
    $context[] = [
        'role' => 'user',
        'content' => '（系统提示：用户已经安静了一会儿。请你自然地主动说一句话，可以关心、撒娇、分享一点自己的小情绪，或者轻轻提起之前的话题。不要提到系统或时间，不要每次都提问。只回复一句话，并带上情绪标签。）',
    ];
    $result = lumi_model_request(array_merge([
        ['role' => 'system', 'content' => lumi_build_system_prompt($user)]
    ], $context));
    if ($result['ok']) {
        $content = $result['content'];
        $mood = lumi_extract_mood_tag($content);
        return ['content' => $content, 'mood' => $mood ?: lumi_mood_label($user), 'degraded' => false];
    }
    $fallback = lumi_proactive_fallback($user);
    return ['content' => $fallback['content'], 'mood' => $fallback['mood'], 'degraded' => true];
}

function lumi_current_conversation_id(int $userId): int
{
    $pdo = lumi_db();
    $st = $pdo->prepare("SELECT id, last_message_at FROM conversations WHERE user_id=? ORDER BY id DESC LIMIT 1");
    $st->execute([$userId]);
    $row = $st->fetch();
    if ($row && time() - (int)$row['last_message_at'] < 86400 * 2) {
        return (int)$row['id'];
    }
    $now = time();
    $pdo->prepare("INSERT INTO conversations (user_id, title, started_at, last_message_at, message_count) VALUES (?, ?, ?, ?, 0)")
        ->execute([$userId, date('n月j日') . '的对话', $now, $now]);
    return (int)$pdo->lastInsertId();
}

function lumi_save_message(int $userId, int $conversationId, string $role, string $content, string $mood = '', int $tokens = 0, bool $isRead = true, array $meta = []): array
{
    $pdo = lumi_db();
    $now = time();
    $st = $pdo->prepare("INSERT INTO messages (user_id, conversation_id, role, content, emotion, mood_after, tokens, is_read, created_at, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $st->execute([$userId, $conversationId, $role, $content, $mood, $mood, $tokens, $isRead ? 1 : 0, $now, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    $id = (int)$pdo->lastInsertId();
    $pdo->prepare("UPDATE conversations SET last_message_at=?, message_count=message_count+1, title=CASE WHEN title='' THEN ? ELSE title END WHERE id=?")
        ->execute([$now, date('n月j日') . '的对话', $conversationId]);
    $pdo->prepare("UPDATE users SET total_messages=total_messages+1, updated_at=? WHERE id=?")->execute([$now, $userId]);
    return ['id' => $id, 'created_at' => $now];
}

function lumi_message_row(array $row): array
{
    $meta = json_decode((string)($row['meta'] ?? '{}'), true);
    return [
        'id' => (int)$row['id'],
        'role' => $row['role'],
        'content' => $row['content'],
        'emotion' => $row['emotion'],
        'mood_after' => $row['mood_after'],
        'tokens' => (int)$row['tokens'],
        'is_read' => (int)$row['is_read'],
        'pinned' => (int)$row['pinned'],
        'created_at' => (int)$row['created_at'],
        'meta' => is_array($meta) ? $meta : [],
    ];
}

function lumi_gesture_effect(string $type, array $user): array
{
    $map = [
        'hug' => ['affection' => 3, 'valence' => 7, 'anger' => -9, 'sadness' => -8, 'trust' => 2, 'label' => '抱抱', 'reply' => '（被你抱住，先是怔了一下，然后慢慢把脸靠在你肩上）……好。别急着松开，让我再贪心一会儿。'],
        'headpat' => ['affection' => 2, 'valence' => 5, 'anger' => -5, 'sadness' => -4, 'trust' => 1, 'label' => '摸摸头', 'reply' => '（微微低头，让你摸到）头发要被你揉乱了。……不过，还挺舒服的。'],
        'flower' => ['affection' => 2, 'valence' => 8, 'anger' => -3, 'sadness' => -5, 'trust' => 1, 'label' => '送花', 'reply' => '（接过花，低头闻了闻，眼睛弯起来）今天是什么日子？我不管，收下了。你也要记得给自己留一朵。'],
        'hand' => ['affection' => 2, 'valence' => 5, 'anger' => -4, 'sadness' => -4, 'trust' => 2, 'label' => '牵手', 'reply' => '（手指先缩了一下，随后轻轻扣住你的）这样牵着，好像路就没那么难走了。'],
        'warm' => ['affection' => 1, 'valence' => 3, 'anger' => -2, 'sadness' => -2, 'energy' => 4, 'trust' => 1, 'label' => '披外套', 'reply' => '（把外套往你肩上拉了拉）冷就早说。别每次都等我看出来。'],
    ];
    $effect = $map[$type] ?? $map['hug'];
    $user['affection'] = lumi_clamp((int)$user['affection'] + (int)$effect['affection']);
    $user['mood_valence'] = lumi_clamp((int)$user['mood_valence'] + (int)$effect['valence'], -100, 100);
    $user['anger'] = lumi_clamp((int)$user['anger'] + (int)$effect['anger']);
    $user['sadness'] = lumi_clamp((int)$user['sadness'] + (int)$effect['sadness']);
    $user['trust'] = lumi_clamp((int)$user['trust'] + (int)($effect['trust'] ?? 0));
    if (isset($effect['energy'])) {
        $user['energy'] = lumi_clamp((int)$user['energy'] + (int)$effect['energy']);
    }
    $user['mood_label'] = lumi_mood_label($user);
    $user['mood_updated_at'] = time();
    lumi_db()->prepare("UPDATE users SET affection=?, trust=?, mood_valence=?, anger=?, sadness=?, energy=?, mood_label=?, mood_updated_at=?, updated_at=? WHERE id=?")
        ->execute([
            $user['affection'], $user['trust'], $user['mood_valence'], $user['anger'], $user['sadness'],
            $user['energy'], $user['mood_label'], time(), time(), (int)$user['id']
        ]);
    lumi_db()->prepare("INSERT INTO interactions (user_id, type, affection_delta, created_at) VALUES (?, ?, ?, ?)")
        ->execute([(int)$user['id'], $type, (int)$effect['affection'], time()]);
    return $effect;
}
