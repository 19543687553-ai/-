/**
 * 心屿 API 配置
 * 默认同域：/PHP/api.php
 * 如前端与 PHP 后端不在同一目录，可在加载本文件前设置 window.LUMI_API_OVERRIDE
 */
(function () {
  var configured = window.LUMI_API_OVERRIDE || window.LUMI_API_BASE || '';
  window.LUMI_CONFIG = {
    apiBase: configured || '/PHP/api.php',
    apiCandidates: configured
      ? [configured]
      : ['/PHP/api.php', 'PHP/api.php', '/api.php'],
    remoteBackend: 'http://zx.2026027.xyz/PHP/api.php',
    storagePrefix: 'xinyu.'
  };
})();
