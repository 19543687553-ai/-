<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$action = (string)lumi_param('action', '');
if ($action !== '') {
    require __DIR__ . '/api.php';
    exit;
}

lumi_ok([
    'name' => lumi_setting('app_name', '心屿') . ' · PHP API',
    'version' => LUMI_VERSION,
    'status' => 'online',
    'api' => 'api.php?action=health',
    'time' => lumi_now_text(),
    'model_configured' => lumi_model_config()['configured'],
    'message' => '心屿 PHP 后端已就绪。请通过 api.php?action=... 访问接口。',
]);
