<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit(0); }

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register': register(); break;
    case 'login':    login(); break;
    case 'save':     saveData(); break;
    case 'load':     loadData(); break;
    default:         echo json_encode(['code' => 400, 'msg' => '无效操作']);
}

function getDataDir() {
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

function getUserFile($username) {
    return getDataDir() . '/' . $username . '.json';
}

function register() {
    $username = trim($_GET['name'] ?? '');
    $password = $_GET['pwd'] ?? '';
    if (empty($username) || empty($password)) {
        echo json_encode(['code' => 400, 'msg' => '用户名或密码不能为空']);
        return;
    }
    if (strlen($username) < 2 || strlen($username) > 20) {
        echo json_encode(['code' => 400, 'msg' => '用户名长度2-20']);
        return;
    }
    $file = getUserFile($username);
    if (file_exists($file)) {
        echo json_encode(['code' => 400, 'msg' => '用户名已被注册']);
        return;
    }
    $defaultData = [
        'name' => $username,
        'stage' => 0,
        'exp' => 0,
        'maxExp' => 1000,
        'age' => 18,
        'life' => 100,
        'grade' => 0,
        'dead' => false,
        'stones' => 1000,
        'cores' => 0,
        'pills' => 5,
        'fame' => 0,
        'skills' => ['base'],
        'herbs' => ['lingzhi' => 0, 'xueying' => 0, 'tianxin' => 0, 'hunyuan' => 0],
        'attrs' => ['str' => 10, 'int' => 10, 'vit' => 10, 'luk' => 10],
        'auto' => false,
        'clickLevel' => 0,
        'friends' => [],
        'chatHistory' => (object)[],
        'unreadMessages' => (object)[],
        'challenges' => [],
        'powerPills' => 0,
        'shopPurchased' => (object)[],
        'rebirthCount' => 0,
        'dataVerify' => ['enabled' => true, 'restricted' => false, 'restrictUntil' => null, 'banReason' => null, 'lastStoneCheck' => 0, 'lastCheckTime' => time()*1000],
        'lastChallengeTime' => 0,
        'lastLogoutTime' => null,
        'lastSaveTime' => time()*1000,
        'signInData' => null,
        'taskData' => null,
        'clanData' => ['clanId' => null, 'clanName' => null, 'contribution' => 0, 'joinTime' => 0, 'disciples' => [], 'master' => null, 'clanTasks' => (object)[], 'lastTaskReset' => time()*1000],
        'partner' => null,
        'partnerBond' => 0,
        'partnerData' => ['lastDualCultivation' => 0, 'totalDual' => 0, 'marriedTime' => null, 'marriageCooldownEnd' => null, 'lastBreakupTime' => null],
        'proposals' => [],
        'notifications' => [],
        'sadnessBuff' => null,
        'qingmingEvent' => null
    ];
    $defaultData['password'] = password_hash($password, PASSWORD_DEFAULT);
    file_put_contents($file, json_encode($defaultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['code' => 200, 'msg' => '注册成功', 'data' => ['username' => $username]]);
}

function login() {
    $username = trim($_GET['name'] ?? '');
    $password = $_GET['pwd'] ?? '';
    if (empty($username) || empty($password)) {
        echo json_encode(['code' => 400, 'msg' => '用户名或密码不能为空']);
        return;
    }
    $file = getUserFile($username);
    if (!file_exists($file)) {
        echo json_encode(['code' => 400, 'msg' => '用户不存在']);
        return;
    }
    $data = json_decode(file_get_contents($file), true);
    if (!password_verify($password, $data['password'])) {
        echo json_encode(['code' => 400, 'msg' => '密码错误']);
        return;
    }
    // 检查封禁
    if (!empty($data['dataVerify']['restricted']) && time()*1000 < ($data['dataVerify']['restrictUntil'] ?? 0)) {
        echo json_encode(['code' => 403, 'msg' => '账号已被封禁', 'until' => $data['dataVerify']['restrictUntil']]);
        return;
    } else {
        // 自动解封（如果到期）
        if (!empty($data['dataVerify']['restricted'])) {
            $data['dataVerify']['restricted'] = false;
            $data['dataVerify']['restrictUntil'] = null;
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }
    unset($data['password']);
    echo json_encode(['code' => 200, 'msg' => '登录成功', 'data' => $data]);
}

function saveData() {
    $username = trim($_GET['name'] ?? '');
    $payload = $_GET['data'] ?? '';
    if (empty($username) || empty($payload)) {
        echo json_encode(['code' => 400, 'msg' => '缺少参数']);
        return;
    }
    $file = getUserFile($username);
    if (!file_exists($file)) {
        echo json_encode(['code' => 400, 'msg' => '用户不存在']);
        return;
    }
    $existing = json_decode(file_get_contents($file), true);
    $newData = json_decode(base64_decode($payload), true);
    if (!$newData) {
        echo json_encode(['code' => 400, 'msg' => '数据格式错误']);
        return;
    }
    $newData['password'] = $existing['password'];
    $newData['lastSaveTime'] = time() * 1000;
    file_put_contents($file, json_encode($newData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['code' => 200, 'msg' => '保存成功']);
}

function loadData() {
    $username = trim($_GET['name'] ?? '');
    if (empty($username)) {
        echo json_encode(['code' => 400, 'msg' => '缺少用户名']);
        return;
    }
    $file = getUserFile($username);
    if (!file_exists($file)) {
        echo json_encode(['code' => 400, 'msg' => '用户不存在']);
        return;
    }
    $data = json_decode(file_get_contents($file), true);
    unset($data['password']);
    echo json_encode(['code' => 200, 'msg' => '加载成功', 'data' => $data]);
}
?>