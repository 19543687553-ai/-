/**
 * 心屿 · 登录 / 注册
 */
(function () {
  'use strict';

  const PREFIX = (window.LUMI_CONFIG && window.LUMI_CONFIG.storagePrefix) || 'xinyu.';
  const REMEMBER_KEY = PREFIX + 'remember';
  const app = { config: null, ban: null, banTimer: null, maintenanceTimer: null, busy: false };

  const $ = (sel) => document.querySelector(sel);

  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    paintIcons();
    initTheme();
    initTabs();
    initPasswordToggles();
    initForms();
    initBanModal();
    initMaintenance();
    restoreRemembered();
    initServerState();
    maybeRedirect();
  }

  /* ---------------- 图标 ---------------- */
  function paintIcons() {
    const map = {
      authBrandMark: ['logo', 22],
      userIcon: ['user', 17],
      lockIcon: ['lock', 17],
      regUserIcon: ['user', 17],
      regHeartIcon: ['heart', 17],
      regLockIcon: ['lock', 17],
      regCheckIcon: ['shield', 17],
      loginArrow: ['chevronRight', 16],
      registerArrow: ['chevronRight', 16],
      demoArrow: ['chevronRight', 16],
      banIcon: ['ban', 26],
      banMailIcon: ['mail', 15]
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = UI.icon(map[id][0], map[id][1]);
    });
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.innerHTML = UI.icon('eye', 17);
    });
  }

  /* ---------------- 主题氛围 ---------------- */
  function initTheme() {
    const theme = localStorage.getItem(PREFIX + 'theme') || 'dusk';
    UI.applyTheme(theme, localStorage.getItem(PREFIX + 'accent') || '');
    syncSwatches(theme);

    document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-theme-choice');
        UI.applyTheme(name, '');
        localStorage.removeItem(PREFIX + 'accent');
        syncSwatches(name);
        UI.chime('sent');
      });
    });
  }

  function syncSwatches(name) {
    document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme-choice') === name ? 'true' : 'false');
    });
  }

  /* ---------------- Tab ---------------- */
  const COPY = {
    login: { title: '欢迎回来', subtitle: '小屿已经把窗边的灯点亮了。' },
    register: { title: '第一次见面', subtitle: '给这段关系一个名字，剩下的慢慢来。' }
  };

  function initTabs() {
    $('#tabLogin').addEventListener('click', () => switchTab('login'));
    $('#tabRegister').addEventListener('click', () => switchTab('register'));
  }

  function switchTab(name) {
    const tabs = document.querySelector('.auth-tabs');
    const login = name === 'login';
    tabs.setAttribute('data-active', name);
    $('#tabLogin').classList.toggle('active', login);
    $('#tabRegister').classList.toggle('active', !login);
    $('#tabLogin').setAttribute('aria-selected', String(login));
    $('#tabRegister').setAttribute('aria-selected', String(!login));
    $('#panelLogin').classList.toggle('active', login);
    $('#panelRegister').classList.toggle('active', !login);
    $('#authTitle').textContent = COPY[name].title;
    $('#authSubtitle').textContent = COPY[name].subtitle;
    hideAlert();
    const focus = login ? $('#loginUsername') : $('#regUsername');
    if (focus && window.innerWidth > 900) setTimeout(() => focus.focus(), 220);
  }

  /* ---------------- 密码可见 ---------------- */
  function initPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.getAttribute('data-toggle-password'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = UI.icon(show ? 'eyeOff' : 'eye', 17);
        btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
        input.focus();
      });
    });
  }

  /* ---------------- 表单 ---------------- */
  function initForms() {
    $('#loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      doLogin($('#loginUsername').value.trim(), $('#loginPassword').value, $('#loginSubmit'));
    });

    $('#registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      doRegister();
    });

    $('#demoBtn').addEventListener('click', () => {
      $('#loginUsername').value = 'demo';
      $('#loginPassword').value = 'demo123';
      doLogin('demo', 'demo123', $('#demoBtn'));
    });
  }

  async function doLogin(username, password, button) {
    if (app.busy) return;
    if (!username || !password) {
      return showAlert('先把名字和密码写好吧，小屿在门口等你。');
    }
    setBusy(button, true, '正在为你开门');
    hideAlert();
    try {
      const data = await LumiAPI.request('login', { username: username, password: password }, { auth: 'none' });
      LumiAPI.setToken('user', data.token);
      if ($('#rememberMe').checked) {
        localStorage.setItem(REMEMBER_KEY, username);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      UI.toast((data.user && data.user.nickname ? data.user.nickname + '，' : '') + '欢迎回来', 'success');
      setTimeout(() => { location.href = 'app.html'; }, 420);
    } catch (err) {
      setBusy(button, false);
      if (err && err.code === 403 && err.data && err.data.ban) {
        showBan(err.data.ban, username);
      } else if (err && err.code === 503 && err.data && err.data.maintenance) {
        showMaintenance(err.data.maintenance);
      } else {
        showAlert(err && err.message ? err.message : '暂时没能连上心屿，请稍后再试');
      }
    }
  }

  async function doRegister() {
    if (app.busy) return;
    const username = $('#regUsername').value.trim();
    const nickname = $('#regNickname').value.trim();
    const password = $('#regPassword').value;
    const password2 = $('#regPassword2').value;

    if (!/^[\p{L}\p{N}_-]{2,20}$/u.test(username)) {
      return showAlert('用户名需要 2-20 位，可以是文字、字母、数字或下划线。');
    }
    if (password.length < 6) {
      return showAlert('密码至少 6 位，给这里上一把稳一点的锁。');
    }
    if (password !== password2) {
      return showAlert('两次输入的密码不太一样，再看看？');
    }
    if (!$('#agreeTerms').checked) {
      return showAlert('需要先同意陪伴协议，才能一起走进来。');
    }
    if (app.config && app.config.allow_register === false) {
      return showAlert('当前暂未开放注册，请稍后再来。', 'warn');
    }

    setBusy($('#registerSubmit'), true, '正在布置房间');
    hideAlert();
    try {
      const data = await LumiAPI.request('register', {
        username: username,
        password: password,
        nickname: nickname,
        theme: UI.currentTheme(),
        agree: 1
      }, { auth: 'none' });
      LumiAPI.setToken('user', data.token);
      localStorage.setItem(REMEMBER_KEY, username);
      UI.toast('房间收拾好了，欢迎回家', 'success');
      setTimeout(() => { location.href = 'app.html'; }, 520);
    } catch (err) {
      setBusy($('#registerSubmit'), false);
      if (err && err.code === 503 && err.data && err.data.maintenance) {
        showMaintenance(err.data.maintenance);
      } else {
        showAlert(err && err.message ? err.message : '注册没能完成，请稍后再试');
      }
    }
  }

  function setBusy(button, busy, label) {
    app.busy = busy;
    if (!button) return;
    if (busy) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span><span>' + UI.escapeHTML(label || '请稍候') + '</span>';
    } else {
      button.disabled = false;
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  function showAlert(message, type) {
    const box = $('#authAlert');
    const kind = type === 'success' ? 'success' : type === 'warn' ? 'warn' : 'error';
    box.className = 'auth-alert show ' + kind;
    box.innerHTML = UI.icon(kind === 'success' ? 'check' : kind === 'warn' ? 'alert' : 'alert', 15) +
      '<span>' + UI.escapeHTML(message) + '</span>';
  }

  function hideAlert() {
    const box = $('#authAlert');
    box.className = 'auth-alert';
    box.innerHTML = '';
  }

  function restoreRemembered() {
    const name = localStorage.getItem(REMEMBER_KEY);
    if (name) {
      $('#loginUsername').value = name;
      $('#rememberMe').checked = true;
    }
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'register') switchTab('register');
  }

  /* ---------------- 服务状态 ---------------- */
  async function initServerState() {
    const node = $('#serverState');
    node.className = 'server-state checking';
    node.querySelector('span').textContent = '正在连接心屿';
    try {
      const config = await LumiAPI.request('appConfig', {}, { auth: 'none' });
      app.config = config || {};
      node.className = 'server-state online';
      node.querySelector('span').textContent = '后端在线 · ' + (config.app_name || '心屿');
      if (config.maintenance_mode) {
        showMaintenance({
          notice: String(config.maintenance_notice || '').trim(),
          reason: String(config.maintenance_reason || '').trim(),
          until_text: String(config.maintenance_until_text || ''),
          remaining_seconds: Math.max(0, Number(config.maintenance_until || 0) - Number(config.server_time || 0))
        });
      }
      if (config.allow_register === false) {
        const tab = $('#tabRegister');
        tab.style.opacity = '.55';
        tab.title = '当前暂未开放注册';
      }
    } catch (err) {
      node.className = 'server-state offline';
      node.querySelector('span').textContent = '后端未连接';
      node.title = err && err.message ? err.message : '无法连接 PHP 后端';
    }
  }

  /* ---------------- 已登录跳转 ---------------- */
  async function maybeRedirect() {
    if (new URLSearchParams(location.search).get('logout') === '1') {
      LumiAPI.setToken('user', '');
      return;
    }
    if (!LumiAPI.getToken('user')) return;
    try {
      await LumiAPI.request('me');
      location.replace('app.html');
    } catch (err) {
      if (err && err.code === 401) LumiAPI.setToken('user', '');
    }
  }

  /* ---------------- 封禁弹窗 ---------------- */
  function initBanModal() {
    $('#banLogout').addEventListener('click', () => {
      LumiAPI.setToken('user', '');
      closeBan();
      UI.toast('已退出这个账号');
    });

    $('#banCopyContact').addEventListener('click', async () => {
      const contact = (app.config && app.config.support_contact) || '站点管理员';
      const username = $('#loginUsername').value.trim() || '（未填写）';
      const text = [
        '心屿账号申诉',
        '用户名：' + username,
        '封禁原因：' + (app.ban ? app.ban.reason || '未填写' : '未填写'),
        '封禁时间：' + (app.ban ? app.ban.banned_at_text || '—' : '—'),
        '解封时间：' + (app.ban ? (app.ban.permanent ? '永久封禁' : app.ban.until_text) : '—'),
        '处理编号：' + (app.ban ? banCode(app.ban) : '—'),
        '联系方式：' + contact
      ].join('\n');
      try {
        await navigator.clipboard.writeText(text);
        UI.toast('申诉信息已复制，可发给主理人', 'success');
      } catch (err) {
        UI.toast('复制失败，请手动记录封禁信息');
      }
    });

    window.addEventListener('lumi:ban', (event) => {
      if (event.detail && event.detail.ban) showBan(event.detail.ban, $('#loginUsername').value.trim());
    });

    window.addEventListener('lumi:auth-expired', () => {
      LumiAPI.setToken('user', '');
    });
  }

  function banCode(ban) {
    const stamp = ban.banned_at || ban.until_at || 0;
    if (!stamp) return '—';
    return 'XY-' + Number(stamp).toString(36).toUpperCase();
  }

  function showBan(ban, username) {
    app.ban = ban || {};
    const modal = $('#banModal');
    const permanent = !!ban.permanent;

    $('#banTitle').textContent = permanent ? '这扇门暂时不再打开了' : '这里暂时为你关上了门';
    $('#banLead').textContent = permanent
      ? '由于严重违反社区与安全规则，这个账号被永久停用。若你认为存在误判，可以通过下方方式申诉。'
      : '出于社区与安全规则，你的账号被暂停使用。这不是告别，门会在约定时间重新打开。';
    $('#banReason').textContent = ban.reason || '未填写具体原因';
    $('#banStart').textContent = ban.banned_at_text || '—';
    $('#banUntil').textContent = permanent ? '永久封禁' : (ban.until_text || '—');
    $('#banCode').textContent = banCode(ban);
    $('#banUntil').style.color = permanent ? 'var(--danger)' : '';

    if (username) $('#loginUsername').value = username;

    const wrap = $('#banCountdownWrap');
    const counter = $('#banCountdown');
    clearInterval(app.banTimer);
    if (permanent) {
      wrap.style.display = 'none';
    } else {
      wrap.style.display = 'flex';
      let remaining = Number(ban.remaining_seconds) || 0;
      const tick = () => {
        counter.textContent = formatCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(app.banTimer);
          counter.textContent = '已到期';
          wrap.querySelector('span').textContent = '封禁已到期，可以重新登录了';
          UI.toast('封禁已到期，小屿在门口等你', 'success');
        }
        remaining -= 1;
      };
      tick();
      app.banTimer = setInterval(tick, 1000);
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#banLogout').focus(), 300);
  }

  function closeBan() {
    clearInterval(app.banTimer);
    $('#banModal').classList.remove('open');
    document.body.style.overflow = '';
    app.ban = null;
    hideAlert();
  }

  /* ---------------- 维护页 ---------------- */
  function initMaintenance() {
    window.addEventListener('lumi:maintenance', (event) => {
      if (event.detail) showMaintenance(event.detail);
    });
    $('#maintenanceRetry').addEventListener('click', () => location.reload());
    $('#maintenanceLogout').addEventListener('click', () => {
      LumiAPI.setToken('user', '');
      location.reload();
    });
  }

  function showMaintenance(data) {
    data = data || {};
    const modal = $('#maintenanceModal');
    if (!modal) return;
    clearInterval(app.maintenanceTimer);
    $('#maintenanceIcon').innerHTML = UI.icon('clock', 26);
    $('#maintenanceTitle').textContent = '心屿正在整理房间';
    $('#maintenanceLead').textContent = data.notice || '心屿正在做一点小小的整理，很快就回来。';
    $('#maintenanceReason').textContent = data.reason || '例行的维护与升级';
    const until = String(data.until_text || '').trim();
    $('#maintenanceUntil').textContent = until || '维护完成后刷新即可';

    const wrap = $('#maintenanceCountdownWrap');
    const counter = $('#maintenanceCountdown');
    let remaining = Math.max(0, Number(data.remaining_seconds) || 0);
    if (!until || remaining <= 0) {
      wrap.style.display = 'none';
    } else {
      wrap.style.display = 'flex';
      wrap.querySelector('span').textContent = '距离重新开门还有';
      const tick = () => {
        counter.textContent = formatCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(app.maintenanceTimer);
          counter.textContent = '已到预计时间';
          wrap.querySelector('span').textContent = '预计恢复时间已到，正在做最后检查';
        }
        remaining -= 1;
      };
      tick();
      app.maintenanceTimer = setInterval(tick, 1000);
    }

    hideAlert();
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function formatCountdown(seconds) {
    let sec = Math.max(0, Math.floor(Number(seconds) || 0));
    const d = Math.floor(sec / 86400);
    sec -= d * 86400;
    const h = Math.floor(sec / 3600);
    sec -= h * 3600;
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    const pad = (n) => String(n).padStart(2, '0');
    return (d > 0 ? d + ' 天 ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
  }
})();
