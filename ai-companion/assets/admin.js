/**
 * 心屿 · 管理控制台
 */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => UI.escapeHTML(v == null ? '' : v);
  const pad = (n) => String(n).padStart(2, '0');

  const ROLE_TEXT = { superadmin: '超级管理员', admin: '管理员', moderator: '审核员' };
  const STATUS_TEXT = { active: '正常', banned: '封禁中', deleted: '已注销' };
  const THEME_TEXT = { dusk: '暮色', dawn: '晨雾', sakura: '樱夜', forest: '森语' };
  const LEVEL_TEXT = { info: '通知', warm: '温柔', important: '重要' };
  const FB_TEXT = { open: '待处理', replied: '已回复', closed: '已关闭' };
  const ROLE_BADGE = { user: '用户', assistant: '陪伴者', proactive: '主动', system: '系统' };
  const WORD_ACTION = { block: '拦截', review: '复核' };
  const AUDIT_TEXT = {
    'admin.login': '后台登录', 'admin.create': '新增管理员', 'admin.update': '修改管理员', 'admin.delete': '删除管理员',
    'user.update': '修改用户资料', 'user.ban': '封禁用户', 'user.unban': '解除封禁',
    'user.reset_password': '重置用户密码', 'user.delete': '停用用户', 'user.hard_delete': '删除用户',
    'message.delete': '删除消息', 'message.pin': '精选消息', 'message.send': '发送人工消息',
    'settings.update': '更新系统设置', 'model.save': '更新模型配置',
    'announcement.create': '发布公告', 'announcement.update': '修改公告', 'announcement.delete': '删除公告',
    'word.create': '新增敏感词', 'word.delete': '删除敏感词',
    'feedback.reply': '回复反馈', 'broadcast.send': '全站关怀',
    'system.backup': '下载备份', 'system.export_users': '导出用户'
  };

  const PAGE_META = {
    dashboard: ['数据总览', '今天的陪伴正在发生'],
    users: ['用户管理', '资料、情绪、封禁与账号操作'],
    conversations: ['对话记录', '逐条查看用户与陪伴者的往来'],
    messages: ['消息检索', '跨用户搜索、精选与清理消息'],
    moods: ['情绪洞察', '30 天情绪曲线与高风险用户'],
    model: ['模型与 Key', '对话模型参数与密钥，仅后台可见'],
    settings: ['系统设置', '注册、主动说话、安全与维护开关'],
    announcements: ['公告管理', '向全站用户传达信息'],
    words: ['安全词库', '敏感词的拦截与复核规则'],
    feedbacks: ['反馈工单', '用户建议与问题处理'],
    admins: ['管理员', '后台账号与角色权限'],
    audit: ['审计日志', '后台操作的完整留痕'],
    tools: ['数据工具', '备份、导出、全站关怀与系统信息']
  };

  const state = {
    admin: null,
    view: 'dashboard',
    stats: null,
    drawer: null,
    filters: {
      users: { q: '', status: 'all', page: 1 },
      conversations: { q: '', page: 1 },
      messages: { q: '', role: '', from: '', to: '', page: 1 },
      feedbacks: { status: 'all', page: 1 },
      audit: { q: '', page: 1 }
    },
    modelSettings: null
  };

  // ---------------- 基础工具 ----------------
  function mountIcons(root) {
    $$('[data-icon]', root || document).forEach((el) => {
      if (el.dataset.iconMounted === '1') return;
      const size = el.classList.contains('brand-mark') ? 21 : Number(el.dataset.iconSize || 18);
      el.innerHTML = UI.icon(el.dataset.icon, size);
      el.dataset.iconMounted = '1';
    });
  }

  function api(action, payload, options) {
    return LumiAPI.request(action, payload || {}, Object.assign({ auth: 'admin' }, options || {}));
  }

  function duration(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    if (sec <= 0) return '已到期';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return d + ' 天 ' + pad(h) + ':' + pad(m) + ':' + pad(s);
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  function initial(name) {
    const text = String(name || '·').trim();
    return text ? text.slice(0, 1).toUpperCase() : '·';
  }

  function statusBadge(status) {
    if (status === 'banned') return '<span class="badge danger"><i></i>封禁中</span>';
    if (status === 'deleted') return '<span class="badge"><i></i>已注销</span>';
    return '<span class="badge ok"><i></i>正常</span>';
  }

  function roleBadge(role) {
    const cls = { user: 'info', assistant: 'ok', proactive: 'warn', system: 'danger' }[role] || '';
    return '<span class="badge ' + cls + '">' + esc(ROLE_BADGE[role] || role) + '</span>';
  }

  function emptyHTML(text, sub) {
    return '<div class="empty"><div class="empty-inner">' + UI.icon('sparkles', 26) +
      '<strong>' + esc(text) + '</strong>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div></div>';
  }

  function loadingHTML(text) {
    return '<div class="loading-row"><span class="spinner"></span><span>' + esc(text || '正在读取数据') + '</span></div>';
  }

  // ---------------- 登录 ----------------
  function showLogin(message) {
    $('#adminShell').hidden = true;
    $('#adminLogin').hidden = false;
    if (message) {
      const box = $('#loginAlert');
      box.textContent = message;
      box.hidden = false;
    }
    $('#adminUsername').focus();
  }

  function setLoginState(kind, text) {
    const el = $('#adminServerState');
    el.className = 'login-state ' + kind;
    $('span:last-child', el).textContent = text;
  }

  async function checkServer() {
    setLoginState('checking', '正在检测服务');
    try {
      await LumiAPI.init();
      const base = LumiAPI.getBase();
      const res = await fetch(base.replace(/\?.*$/, '') + '?action=health');
      const json = await res.json();
      if (json && json.code === 200 && json.data && json.data.db) {
        setLoginState('online', '服务正常 · 数据库已连接');
      } else {
        setLoginState('offline', '数据库尚未就绪');
      }
    } catch (err) {
      setLoginState('offline', '无法连接 PHP 后端');
    }
  }

  async function doAdminLogin(event) {
    event.preventDefault();
    const username = $('#adminUsername').value.trim();
    const password = $('#adminPassword').value;
    const alertBox = $('#loginAlert');
    alertBox.hidden = true;
    if (!username || !password) {
      alertBox.textContent = '请填写后台账号和密码';
      alertBox.hidden = false;
      return;
    }
    const button = $('#adminLoginBtn');
    setBusy(button, true, '正在验证');
    try {
      const data = await LumiAPI.request('adminLogin', { username: username, password: password }, { auth: 'none' });
      LumiAPI.setToken('admin', data.token);
      state.admin = data.admin;
      $('#adminPassword').value = '';
      await bootConsole();
      UI.toast('欢迎回来，' + data.admin.display_name, 'success');
    } catch (err) {
      alertBox.textContent = err.message || '登录失败';
      alertBox.hidden = false;
    } finally {
      setBusy(button, false);
    }
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner"></span><span>' + esc(label || '处理中') + '</span>';
    } else {
      button.disabled = false;
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  async function bootConsole() {
    $('#adminLogin').hidden = true;
    $('#adminShell').hidden = false;
    applyAdminIdentity();
    await refreshBadges();
    const hash = (location.hash || '').replace('#', '');
    const target = PAGE_META[hash] ? hash : 'dashboard';
    switchView(target, true);
  }

  function applyAdminIdentity() {
    const admin = state.admin;
    if (!admin) return;
    $('#adminName').textContent = admin.display_name || admin.username;
    $('#adminRole').textContent = ROLE_TEXT[admin.role] || admin.role;
    $('#adminAvatar').textContent = initial(admin.display_name || admin.username);
    const role = admin.role;
    $$('[data-role="superadmin"]').forEach((el) => { el.hidden = role !== 'superadmin'; });
    if (role === 'moderator') {
      $$('.nav-item[data-view="model"], .nav-item[data-view="settings"], .nav-item[data-view="tools"]').forEach((el) => { el.hidden = true; });
    }
  }

  async function refreshBadges() {
    try {
      const me = await api('adminMe');
      state.admin = me.admin;
      applyAdminIdentity();
      const feedback = $('#badgeFeedback');
      feedback.hidden = !me.pending_feedback;
      feedback.textContent = me.pending_feedback > 99 ? '99+' : String(me.pending_feedback);
      const stats = state.stats;
      const banned = $('#badgeBanned');
      if (stats && stats.stats.banned) {
        banned.hidden = false;
        banned.textContent = String(stats.stats.banned);
      }
    } catch (err) { /* 401 由全局事件处理 */ }
  }

  // ---------------- 视图切换 ----------------
  function switchView(name, immediate) {
    if (!PAGE_META[name]) name = 'dashboard';
    const nav = $('.nav-item[data-view="' + name + '"]');
    if (nav && nav.hidden) name = 'dashboard';
    state.view = name;
    $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
    $$('.admin-view').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
    const meta = PAGE_META[name];
    $('#pageTitle').textContent = meta[0];
    $('#pageSub').textContent = meta[1];
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    closeSideMobile();
    loadView(name, immediate);
  }

  function viewBox(name) {
    return $('.admin-view[data-view="' + name + '"]');
  }

  async function loadView(name, immediate) {
    const box = viewBox(name);
    if (!box) return;
    if (!box.innerHTML || immediate) box.innerHTML = loadingHTML('正在载入' + PAGE_META[name][0]);
    try {
      if (name === 'dashboard') await renderDashboard(box);
      else if (name === 'users') await renderUsers(box);
      else if (name === 'conversations') await renderConversations(box);
      else if (name === 'messages') await renderMessages(box);
      else if (name === 'moods') await renderMoods(box);
      else if (name === 'model') await renderModel(box);
      else if (name === 'settings') await renderSettings(box);
      else if (name === 'announcements') await renderAnnouncements(box);
      else if (name === 'words') await renderWords(box);
      else if (name === 'feedbacks') await renderFeedbacks(box);
      else if (name === 'admins') await renderAdmins(box);
      else if (name === 'audit') await renderAudit(box);
      else if (name === 'tools') await renderTools(box);
    } catch (err) {
      if (err.code === 401) return;
      box.innerHTML = '<div class="panel"><div class="panel-body">' +
        '<div class="notice warn">' + UI.icon('alert', 15) + '<span>' + esc(err.message || '加载失败') + '</span></div>' +
        '</div></div>';
    }
  }

  // ---------------- 图表 ----------------
  function niceMax(value) {
    if (value <= 4) return 4;
    const exp = Math.floor(Math.log10(value));
    const base = Math.pow(10, exp);
    const step = base / 2;
    return Math.ceil(value / step) * step;
  }

  function chartSVG(labels, series, opts) {
    opts = opts || {};
    const mobile = (opts.width || window.innerWidth) < 620;
    const W = mobile ? 430 : 760, H = opts.height || (mobile ? 216 : 250);
    const pl = mobile ? 26 : 38, pr = mobile ? 10 : 16, pt = 16, pb = mobile ? 24 : 28;
    const fontSize = mobile ? 11 : 9.5;
    const values = [];
    series.forEach((s) => s.values.forEach((v) => values.push(Number(v) || 0)));
    let max = opts.max != null ? opts.max : niceMax(Math.max.apply(null, values.concat([1])));
    let min = opts.min != null ? opts.min : 0;
    if (max <= min) max = min + 1;
    const innerW = W - pl - pr;
    const innerH = H - pt - pb;
    const x = (i) => pl + (labels.length <= 1 ? innerW / 2 : (innerW * i) / (labels.length - 1));
    const y = (v) => pt + innerH * (1 - (v - min) / (max - min));

    let out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="趋势图">';
    out += '<defs>';
    series.forEach((s, idx) => {
      out += '<linearGradient id="grad' + idx + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="' + s.color + '" stop-opacity=".22"/>' +
        '<stop offset="100%" stop-color="' + s.color + '" stop-opacity="0"/></linearGradient>';
    });
    out += '</defs>';

    for (let i = 0; i <= 4; i++) {
      const val = min + ((max - min) * i) / 4;
      const yy = y(val);
      out += '<line x1="' + pl + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pr) + '" y2="' + yy.toFixed(1) +
        '" stroke="var(--line)" stroke-width="1"/>';
      out += '<text x="' + (pl - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" fill="var(--faint)" font-size="' + fontSize + '">' +
        Math.round(val) + '</text>';
    }

    const stepX = Math.max(1, Math.ceil(labels.length / (mobile ? 4 : 7)));
    const draws = [];
    labels.forEach((label, i) => {
      if (i % stepX !== 0 && i !== labels.length - 1) return;
      draws.push(i);
    });
    if (draws.length > 1 && x(draws[draws.length - 1]) - x(draws[draws.length - 2]) < 34) {
      draws.splice(draws.length - 2, 1);
    }
    draws.forEach((i) => {
      out += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" fill="var(--faint)" font-size="' + fontSize + '">' +
        esc(labels[i]) + '</text>';
    });

    series.forEach((s, idx) => {
      const pts = s.values.map((v, i) => x(i).toFixed(1) + ',' + y(Number(v) || 0).toFixed(1));
      if (!pts.length) return;
      out += '<path d="M' + x(0).toFixed(1) + ',' + (H - pb) + ' L' + pts.join(' L') + ' L' + x(s.values.length - 1).toFixed(1) + ',' + (H - pb) + ' Z" fill="url(#grad' + idx + ')"/>';
      out += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color +
        '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      s.values.forEach((v, i) => {
        if (labels.length > 20 && i % 3 !== 0) return;
        out += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(Number(v) || 0).toFixed(1) +
          '" r="2.4" fill="var(--panel-strong)" stroke="' + s.color + '" stroke-width="1.6"/>';
      });
    });
    out += '</svg>';
    return out;
  }

  function barList(items, unit) {
    if (!items || !items.length) return '<div class="form-note">暂无数据</div>';
    const max = Math.max.apply(null, items.map((i) => Number(i.value) || 0)) || 1;
    return '<div class="bar-list">' + items.map((item) => {
      const width = Math.max(2, Math.round(((Number(item.value) || 0) / max) * 100));
      return '<div class="bar-item"><div class="bar-item-top"><span>' + esc(item.label) + '</span>' +
        '<b>' + esc(item.value) + (unit || '') + '</b></div>' +
        '<div class="bar-track"><i class="bar-fill" style="width:' + width + '%"></i></div></div>';
    }).join('') + '</div>';
  }

  // ---------------- 分页 ----------------
  function pagerHTML(page, pages, scope) {
    if (!pages || pages <= 1) return '<span class="pager-info">共 ' + pages + ' 页</span>';
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    let html = '<div class="pager">';
    html += '<button data-act="page" data-scope="' + scope + '" data-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>';
    if (start > 1) html += '<button data-act="page" data-scope="' + scope + '" data-page="1">1</button><span class="pager-info">…</span>';
    for (let i = start; i <= end; i++) {
      html += '<button data-act="page" data-scope="' + scope + '" data-page="' + i + '" class="' + (i === page ? 'active' : '') + '">' + i + '</button>';
    }
    if (end < pages) html += '<span class="pager-info">…</span><button data-act="page" data-scope="' + scope + '" data-page="' + pages + '">' + pages + '</button>';
    html += '<button data-act="page" data-scope="' + scope + '" data-page="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>下一页</button>';
    html += '</div>';
    return html;
  }

  // ---------------- 总览 ----------------
  async function renderDashboard(box) {
    const data = await api('adminStats');
    state.stats = data;
    const s = data.stats;
    const banned = $('#badgeBanned');
    if (banned) {
      banned.hidden = !s.banned;
      banned.textContent = String(s.banned);
    }
    const chip = $('#modelChip');
    if (chip) {
      chip.classList.toggle('ok', !!s.model_configured);
      chip.innerHTML = '<i class="status-dot"></i><span>' + (s.model_configured ? '模型已接入' : '模型未配置') + '</span>';
    }
    state.lastUsers = data.recent_users || [];
    const labels = data.series.map((d) => d.date);
    const chart = chartSVG(labels, [
      { values: data.series.map((d) => d.users), color: 'var(--chart-line)' },
      { values: data.series.map((d) => d.messages), color: 'var(--chart-line-2)' }
    ], { height: 248 });

    const moodItems = (data.mood_distribution || []).map((m) => ({ label: m.label || '未知', value: m.value }));
    const themeItems = (data.theme_distribution || []).map((t) => ({ label: THEME_TEXT[t.theme] || t.theme, value: t.value }));

    box.innerHTML = `
      <div class="section-grid">
        <div class="stat-grid">
          ${statCard('users', '用户总数', s.total_users, '今日新增 ' + s.new_today + ' 位')}
          ${statCard('activity', '今日活跃', s.active_today, '消息今日 ' + s.message_today + ' 条', true)}
          ${statCard('message', '消息总量', s.message_total, '平均亲密度 ' + s.avg_affection)}
          ${statCard('banUser', '封禁中', s.banned, '待处理反馈 ' + s.open_feedback)}
        </div>
        <div class="grid-1-2">
          <div class="panel">
            <div class="panel-head">
              <div><h2>近 14 天增长</h2><p>新增用户与消息量走势</p></div>
              <div class="panel-actions">
                <span class="chart-legend"><span><i style="background:var(--chart-line)"></i>新增用户</span><span><i style="background:var(--chart-line-2)"></i>消息量</span></span>
              </div>
            </div>
            <div class="panel-body"><div class="chart-wrap">${chart}</div></div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>情绪分布</h2><p>当前所有用户的心情标签</p></div></div>
            <div class="panel-body">
              ${barList(moodItems)}
              <div class="form-section">
                <div class="form-section-title">${UI.icon('sparkles', 14)} 主题偏好</div>
                ${barList(themeItems, ' 人')}
              </div>
            </div>
          </div>
        </div>
        <div class="grid-2-1">
          <div class="panel">
            <div class="panel-head">
              <div><h2>最近注册用户</h2><p>点击可查看完整档案</p></div>
              <div class="panel-actions"><button class="mini-btn" data-view-jump="users">全部用户 ${UI.icon('chevronRight', 13)}</button></div>
            </div>
            <div class="table-scroll">
              <table class="data-table">
                <thead><tr><th>用户</th><th>情绪</th><th>亲密度</th><th>状态</th><th>注册时间</th></tr></thead>
                <tbody>
                  ${(data.recent_users || []).map((u) => `
                    <tr data-act="user-open" data-id="${u.id}">
                      <td><div class="cell-user"><span class="cell-avatar">${esc(initial(u.nickname || u.username))}</span>
                        <div><div class="cell-main">${esc(u.nickname || u.username)}</div><div class="cell-sub">@${esc(u.username)}</div></div></div></td>
                      <td>${esc(u.mood)}</td>
                      <td class="cell-num">${u.affection}</td>
                      <td>${statusBadge(u.status)}</td>
                      <td class="cell-sub">${UI.relativeTime(u.created_at)}</td>
                    </tr>`).join('') || '<tr><td colspan="5">' + emptyHTML('还没有用户') + '</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>最近操作</h2><p>后台审计留痕</p></div></div>
            <div class="panel-body">
              <div class="timeline">
                ${(data.recent_audit || []).map((a) => `
                  <div class="timeline-item">
                    <p><b>${esc(a.admin_name || '系统')}</b> · ${esc(AUDIT_TEXT[a.action] || a.action)}</p>
                    <span>${esc(a.detail || '')} · ${UI.formatDateTime(a.created_at)}</span>
                  </div>`).join('') || '<div class="form-note">暂无操作记录</div>'}
              </div>
              <div class="form-section">
                <div class="form-section-title">${UI.icon('quote', 14)} 最新反馈</div>
                ${(data.recent_feedbacks || []).map((f) => `
                  <div class="timeline-item">
                    <p>${esc(f.nickname || '用户')}：${esc(f.content).slice(0, 60)}</p>
                    <span>${esc(f.category)} · ${UI.relativeTime(f.created_at)} · ${esc(FB_TEXT[f.status] || f.status)}</span>
                  </div>`).join('') || '<div class="form-note">暂无反馈</div>'}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    mountIcons(box);
  }

  function statCard(iconName, label, value, sub, accent) {
    return `<div class="stat-card${accent ? ' accent' : ''}">
      <div class="stat-top">${UI.icon(iconName, 15)}<span>${esc(label)}</span></div>
      <b>${esc(value)}</b><small>${esc(sub)}</small></div>`;
  }

  // ---------------- 用户管理 ----------------
  async function renderUsers(box) {
    const f = state.filters.users;
    const data = await api('adminUsers', { q: f.q, status: f.status, page: f.page, per_page: 12 });
    if (f.page > data.pages) { f.page = data.pages; return loadView('users'); }
    state.lastUsers = data.items || [];

    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <label class="search-wrap">${UI.icon('search', 15)}
            <input type="search" placeholder="搜索用户名 / 昵称 / ID" value="${esc(f.q)}" data-filter="users:q">
          </label>
          <div class="seg">
            ${['all', 'active', 'banned', 'high'].map((key) => `<button data-act="user-status" data-status="${key}" class="${f.status === key ? 'active' : ''}">${({ all: '全部', active: '正常', banned: '封禁', high: '情绪风险' })[key]}</button>`).join('')}
          </div>
          <span class="spacer"></span>
          <span class="pager-info">共 ${data.total} 位用户</span>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>用户</th><th>状态</th><th>情绪</th><th>亲密</th><th>消息</th><th>最后活跃</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.items || []).map((u) => `
                  <tr>
                    <td data-act="user-open" data-id="${u.id}" style="cursor:pointer">
                      <div class="cell-user"><span class="cell-avatar">${esc(initial(u.nickname || u.username))}</span>
                        <div><div class="cell-main">${esc(u.nickname || u.username)}</div>
                          <div class="cell-sub">@${esc(u.username)} · ID ${u.id} · ${esc(THEME_TEXT[u.theme] || u.theme)}</div></div></div>
                    </td>
                    <td>${statusBadge(u.status)}</td>
                    <td>${esc(u.mood)}</td>
                    <td class="cell-num">${u.affection}</td>
                    <td class="cell-num">${u.total_messages}</td>
                    <td class="cell-sub">${UI.relativeTime(u.last_active_at)}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn" data-act="user-open" data-id="${u.id}">${UI.icon('eye', 13)}详情</button>
                      ${u.status === 'banned'
                        ? `<button class="mini-btn accent" data-act="user-unban" data-id="${u.id}">${UI.icon('check', 13)}解封</button>`
                        : `<button class="mini-btn danger" data-act="user-ban" data-id="${u.id}">${UI.icon('ban', 13)}封禁</button>`}
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="7">' + emptyHTML('没有匹配的用户', '换个关键词或筛选条件试试') + '</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="panel-foot"><span class="panel-note">第 ${data.page} / ${data.pages} 页</span>${pagerHTML(data.page, data.pages, 'users')}</div>
        </div>
      </div>`;
    mountIcons(box);
  }

  // ---------------- 对话记录 ----------------
  async function renderConversations(box) {
    const f = state.filters.conversations;
    const data = await api('adminConversations', { q: f.q, page: f.page });
    if (f.page > data.pages) { f.page = data.pages; return loadView('conversations'); }
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <label class="search-wrap">${UI.icon('search', 15)}
            <input type="search" placeholder="搜索用户或聊天内容" value="${esc(f.q)}" data-filter="conversations:q">
          </label>
          <span class="spacer"></span>
          <span class="pager-info">共 ${data.total} 位有对话的用户</span>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>用户</th><th>最近一条</th><th>消息数</th><th>情绪</th><th>最后时间</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.items || []).map((c) => `
                  <tr>
                    <td><div class="cell-user"><span class="cell-avatar">${esc(initial(c.nickname || c.username))}</span>
                      <div><div class="cell-main">${esc(c.nickname || c.username)}</div><div class="cell-sub">@${esc(c.username)} · ID ${c.user_id}</div></div></div></td>
                    <td><div class="cell-ellipsis">${c.last_content ? esc(c.last_content) : '<span class="faint">暂无消息</span>'}</div>
                      <div class="cell-sub">${c.last_role ? esc(ROLE_BADGE[c.last_role] || c.last_role) : ''}</div></td>
                    <td class="cell-num">${c.message_count || 0}</td>
                    <td>${esc(c.mood || '平静')}</td>
                    <td class="cell-sub">${c.last_message_at ? UI.relativeTime(c.last_message_at) : '—'}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn accent" data-act="conv-open" data-id="${c.user_id}">${UI.icon('chat', 13)}查看对话</button>
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="6">' + emptyHTML('还没有对话数据') + '</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="panel-foot"><span class="panel-note">第 ${data.page} / ${data.pages} 页</span>${pagerHTML(data.page, data.pages, 'conversations')}</div>
        </div>
      </div>`;
    mountIcons(box);
  }

  // ---------------- 消息检索 ----------------
  async function renderMessages(box) {
    const f = state.filters.messages;
    const from = f.from ? Math.floor(new Date(f.from + 'T00:00:00').getTime() / 1000) : 0;
    const to = f.to ? Math.floor(new Date(f.to + 'T23:59:59').getTime() / 1000) : 0;
    const data = await api('adminMessages', { q: f.q, role: f.role, from: from, to: to, page: f.page, per_page: 30 });
    if (f.page > data.pages) { f.page = data.pages; return loadView('messages'); }
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <label class="search-wrap">${UI.icon('search', 15)}
            <input type="search" placeholder="搜索消息内容" value="${esc(f.q)}" data-filter="messages:q">
          </label>
          <select data-filter="messages:role" aria-label="角色">
            ${['', 'user', 'assistant', 'proactive', 'system'].map((r) => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${r ? ROLE_BADGE[r] : '全部角色'}</option>`).join('')}
          </select>
          <input type="date" value="${esc(f.from)}" data-filter="messages:from" aria-label="开始日期">
          <input type="date" value="${esc(f.to)}" data-filter="messages:to" aria-label="结束日期">
          <span class="spacer"></span>
          <span class="pager-info">共 ${data.total} 条</span>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>用户</th><th>角色</th><th>消息内容</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.items || []).map((m) => `
                  <tr>
                    <td><div class="cell-main">${esc(m.nickname || m.username || '用户')}</div>
                      <div class="cell-sub">@${esc(m.username || '')} · ID ${m.user_id}</div></td>
                    <td>${roleBadge(m.role)}</td>
                    <td><div class="cell-ellipsis" title="${esc(m.content)}">${esc(m.content)}</div>
                      ${m.pinned ? '<span class="pinned-mark">★ 已精选</span>' : ''}</td>
                    <td class="cell-sub">${UI.formatDateTime(m.created_at)}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn" data-act="msg-pin" data-id="${m.id}" data-pinned="${m.pinned ? 0 : 1}">${UI.icon('pin', 13)}${m.pinned ? '取消精选' : '精选'}</button>
                      <button class="mini-btn danger" data-act="msg-del" data-id="${m.id}">${UI.icon('trash', 13)}删除</button>
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="5">' + emptyHTML('没有匹配的消息') + '</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="panel-foot"><span class="panel-note">第 ${data.page} / ${data.pages} 页</span>${pagerHTML(data.page, data.pages, 'messages')}</div>
        </div>
      </div>`;
    mountIcons(box);
  }

  // ---------------- 情绪洞察 ----------------
  async function renderMoods(box) {
    const data = await api('adminMoodAnalytics');
    const days = data.days || [];
    const chart = chartSVG(days.map((d) => d.date), [
      { values: days.map((d) => d.valence), color: 'var(--chart-line)' },
      { values: days.map((d) => d.anger), color: 'var(--danger)' },
      { values: days.map((d) => d.sadness), color: 'var(--accent-2)' }
    ], { min: -100, max: 100, height: 260 });

    const dist = (data.distribution || []).map((d) => ({ label: d.mood_label || '未知', value: d.c }));
    const acts = (data.interactions || []).map((i) => ({ label: ({ hug: '抱抱', headpat: '摸头', flower: '送花', hand: '牵手', warm: '披外套' })[i.type] || i.type, value: i.c }));

    box.innerHTML = `
      <div class="section-grid">
        <div class="stat-grid">
          ${statCard('pulse', '情绪采样', data.summary.mood_logs, '来自每次对话与互动')}
          ${statCard('message', '今日消息', data.summary.today_messages, '实时统计')}
          ${statCard('alert', '高风险用户', (data.high_risk || []).length, '难过 / 生气值偏高')}
          ${statCard('hand', '互动次数', (data.interactions || []).reduce((a, b) => a + Number(b.c), 0), '抱抱、摸头、牵手等')}
        </div>
        <div class="panel">
          <div class="panel-head">
            <div><h2>近 30 天集体情绪</h2><p>心情值、生气值、难过值的日均变化</p></div>
            <div class="panel-actions"><span class="chart-legend">
              <span><i style="background:var(--chart-line)"></i>心情</span>
              <span><i style="background:var(--danger)"></i>生气</span>
              <span><i style="background:var(--accent-2)"></i>难过</span></span></div>
          </div>
          <div class="panel-body"><div class="chart-wrap">${chart}</div></div>
        </div>
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div><h2>情绪标签分布</h2><p>当前用户所处的情绪</p></div></div>
            <div class="panel-body">${barList(dist, ' 人')}</div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>肢体互动偏好</h2><p>用户最常用的陪伴动作</p></div></div>
            <div class="panel-body">${barList(acts, ' 次')}</div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>需要关注的用户</h2><p>难过值 ≥ 50 或生气值 ≥ 45，建议主动关怀</p></div></div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>用户</th><th>情绪</th><th>难过</th><th>生气</th><th>亲密</th><th>最后活跃</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.high_risk || []).map((u) => `
                  <tr>
                    <td><div class="cell-main">${esc(u.nickname || u.username)}</div><div class="cell-sub">@${esc(u.username)}</div></td>
                    <td>${esc(u.mood)}</td>
                    <td class="cell-num">${u.sadness}</td>
                    <td class="cell-num">${u.anger}</td>
                    <td class="cell-num">${u.affection}</td>
                    <td class="cell-sub">${UI.relativeTime(u.last_active_at)}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn accent" data-act="care-send" data-id="${u.id}" data-name="${esc(u.nickname || u.username)}">${UI.icon('heart', 13)}人工关怀</button>
                      <button class="mini-btn" data-act="user-open" data-id="${u.id}">${UI.icon('eye', 13)}详情</button>
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="7">' + emptyHTML('目前没有高风险用户', '大家的情绪都很平稳') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    mountIcons(box);
  }

  // ---------------- 模型配置 ----------------
  async function renderModel(box) {
    const data = await api('adminSettings');
    const s = data.settings;
    state.modelSettings = s;
    const provider = s.model_provider || 'custom';
    if (s.model_configured) {
      $('#modelDot').classList.add('ok');
      $('#modelChip').classList.add('ok');
      $('#modelChip').innerHTML = '<i class="status-dot"></i><span>模型已接入</span>';
    } else {
      $('#modelDot').classList.remove('ok');
      $('#modelChip').classList.remove('ok');
      $('#modelChip').innerHTML = '<i class="status-dot"></i><span>模型未配置</span>';
    }

    box.innerHTML = `
      <div class="section-grid">
        <div class="notice">${UI.icon('key', 15)}<span>API Key 使用 AES-256-GCM 加密后存入数据库，后台只显示掩码，前端与普通接口都无法读取。保存时留空表示不修改。</span></div>
        <div class="grid-1-2">
          <div class="panel">
            <div class="panel-head"><div><h2>对话模型</h2><p>兼容 OpenAI 协议的 chat/completions 接口</p></div>
              <div class="panel-actions"><span class="badge ${s.model_configured ? 'ok' : 'warn'}"><i></i>${s.model_configured ? '已配置' : '未配置'}</span></div>
            </div>
            <div class="panel-body">
              <form id="modelForm" class="form-grid" autocomplete="off">
                <div class="field span-2">
                  <span class="field-label">服务商预设</span>
                  <div class="seg" id="providerSeg">
                    ${[['deepseek', 'DeepSeek'], ['openai', 'OpenAI'], ['moonshot', 'Moonshot'], ['custom', '自定义']].map((p) => `<button type="button" data-act="provider" data-provider="${p[0]}" class="${provider === p[0] ? 'active' : ''}">${p[1]}</button>`).join('')}
                  </div>
                </div>
                <label class="field span-2"><span class="field-label">接口地址 Base URL</span>
                  <input class="input" id="modelBase" type="text" placeholder="https://api.deepseek.com/v1" value="${esc(s.model_base || '')}">
                  <span class="field-hint">不含 /chat/completions，系统会自动补全</span>
                </label>
                <div class="field">
                  <span class="field-label">模型名称</span>
                  <div class="input-row">
                    <input class="input" id="modelName" type="text" placeholder="deepseek-chat" value="${esc(s.model_name || '')}" autocomplete="off">
                    <button class="btn btn-ghost btn-sm" type="button" id="modelListBtn">${UI.icon('refresh', 14)}拉取模型</button>
                  </div>
                  <span class="field-hint">无需手输模型 ID，点击「拉取模型」从服务商获取并选择</span>
                </div>
                <label class="field"><span class="field-label">API Key <span class="field-hint">${s.model_key_set ? '已保存 ' + esc(s.model_key_masked) : '尚未设置'}</span></span>
                  <input class="input" id="modelKey" type="password" placeholder="${s.model_key_set ? '留空表示不修改' : 'sk-...'}" autocomplete="off">
                </label>
                <label class="field"><span class="field-label">温度 temperature <b id="tempValue">${esc(s.model_temperature)}</b></span>
                  <input type="range" id="modelTemp" min="0" max="2" step="0.05" value="${esc(s.model_temperature)}" class="range">
                </label>
                <label class="field"><span class="field-label">最大输出 token</span>
                  <input class="input" id="modelTokens" type="number" min="64" max="8192" step="1" value="${esc(s.model_max_tokens)}">
                </label>
                <label class="field span-2"><span class="field-label">系统提示词 <span class="field-hint">支持 {{companion_name}} / {{nickname}} / {{mood_label}} 等变量</span></span>
                  <textarea id="modelPrompt" rows="8" style="min-height:170px">${esc(s.model_system_prompt || '')}</textarea>
                </label>
                <div class="form-actions span-2">
                  <span class="form-note" id="modelSaveNote">修改后请点击保存</span>
                  <button class="btn btn-ghost" type="button" id="modelTestBtn">${UI.icon('zap', 15)}测试连接</button>
                  <button class="btn btn-primary" type="submit">${UI.icon('check', 15)}保存配置</button>
                </div>
              </form>
            </div>
          </div>
          <div class="section-grid">
            <div class="panel">
              <div class="panel-head"><div><h2>连接测试</h2><p>用当前表单参数发一条真实请求</p></div></div>
              <div class="panel-body" id="modelTestResult">
                <div class="form-note">点击「测试连接」后会显示模型的真实回复、耗时与错误信息。</div>
              </div>
            </div>
            <div class="panel">
              <div class="panel-head"><div><h2>安全说明</h2><p>密钥存放与调用路径</p></div></div>
              <div class="panel-body">
                <div class="kv-list">
                  <div class="kv-row"><span>存储方式</span><b>AES-256-GCM 加密</b></div>
                  <div class="kv-row"><span>密钥派生</span><b>data/.app_secret</b></div>
                  <div class="kv-row"><span>后端可见</span><b>仅掩码</b></div>
                  <div class="kv-row"><span>前端可见</span><b>完全不可见</b></div>
                  <div class="kv-row"><span>调用方</span><b>PHP 服务端直连</b></div>
                </div>
                <div class="form-section">
                  <button class="mini-btn danger" type="button" data-act="clear-key">${UI.icon('trash', 13)}清除已保存的 Key</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    mountIcons(box);

    const temp = $('#modelTemp');
    temp.addEventListener('input', () => { $('#tempValue').textContent = Number(temp.value).toFixed(2); });
    $('#modelForm').addEventListener('submit', saveModel);
    $('#modelTestBtn').addEventListener('click', testModel);
    $('#modelListBtn').addEventListener('click', fetchModels);
  }

  async function fetchModels() {
    const base = $('#modelBase').value.trim();
    const key = $('#modelKey').value.trim();
    if (!base) { UI.toast('请先填写接口地址 Base URL'); return; }
    const button = $('#modelListBtn');
    setBusy(button, true, '拉取中');
    try {
      const res = await api('adminModelList', { model_base: base, model_key: key }, { timeout: 40000 });
      if (!res.models || !res.models.length) {
        UI.toast('服务商没有返回可用模型，请检查接口地址或权限');
        return;
      }
      showModelPicker(res.models);
    } catch (err) {
      UI.toast(err.message || '拉取模型失败', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  function showModelPicker(models) {
    const rows = models.map((m) => `<button class="model-pick" type="button" data-model="${esc(m.id)}">
        <span class="model-pick-id">${esc(m.id)}</span>
        <small>${esc(m.owned_by || '可用')}</small>
      </button>`).join('');
    openModal({
      title: '选择模型',
      sub: `已拉取 ${models.length} 个模型，点击任意一项即可填入`,
      width: 560,
      html: `<div class="input-wrap model-search">${UI.icon('search', 15)}<input class="input" id="modelSearch" type="text" placeholder="搜索模型 ID" autocomplete="off"></div>
        <div class="model-pick-list" id="modelPickList">${rows}</div>
        <div class="form-note" id="modelPickEmpty" hidden>没有匹配的模型</div>`,
      buttons: [{ label: '关闭', cls: 'btn-ghost' }]
    });
    const list = $('#modelPickList');
    $('#modelSearch').addEventListener('input', (event) => {
      const q = event.target.value.trim().toLowerCase();
      let shown = 0;
      list.querySelectorAll('.model-pick').forEach((el) => {
        const hit = !q || el.dataset.model.toLowerCase().indexOf(q) !== -1;
        el.hidden = !hit;
        if (hit) shown++;
      });
      $('#modelPickEmpty').hidden = shown > 0;
    });
    list.addEventListener('click', (event) => {
      const item = event.target.closest('.model-pick');
      if (!item) return;
      $('#modelName').value = item.dataset.model;
      closeModal();
      UI.toast('已填入模型：' + item.dataset.model, 'success');
    });
    setTimeout(() => { const input = $('#modelSearch'); if (input) input.focus(); }, 60);
  }

  function modelPayload() {
    const active = $('#providerSeg .active');
    return {
      model_provider: active ? active.dataset.provider : 'custom',
      model_base: $('#modelBase').value.trim(),
      model_name: $('#modelName').value.trim(),
      model_key: $('#modelKey').value.trim(),
      model_temperature: Number($('#modelTemp').value),
      model_max_tokens: Number($('#modelTokens').value),
      model_system_prompt: $('#modelPrompt').value
    };
  }

  async function saveModel(event) {
    event.preventDefault();
    const payload = modelPayload();
    if (!payload.model_name) { UI.toast('请填写模型名称'); return; }
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, '保存中');
    try {
      const res = await api('adminModelSave', payload);
      UI.toast('模型配置已保存，当前状态：' + (res.configured ? '已接入' : '未完成'), 'success');
      $('#modelKey').value = '';
      await renderModel(viewBox('model'));
    } catch (err) {
      UI.toast(err.message || '保存失败', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  async function testModel() {
    const button = $('#modelTestBtn');
    const box = $('#modelTestResult');
    const payload = modelPayload();
    setBusy(button, true, '测试中');
    box.innerHTML = loadingHTML('正在请求模型');
    try {
      const res = await api('adminModelTest', {
        model_base: payload.model_base,
        model_name: payload.model_name,
        model_key: payload.model_key
      }, { timeout: 70000 });
      box.innerHTML = `
        <div class="notice">${UI.icon('check', 15)}<span>连接成功 · 耗时 ${esc(res.latency)} ms</span></div>
        <div class="chat-bubble" style="margin-top:12px">${esc(res.message)}</div>
        <div class="form-note" style="margin-top:10px">模型：${esc(res.model)}</div>`;
    } catch (err) {
      box.innerHTML = `<div class="notice warn">${UI.icon('alert', 15)}<span>${esc(err.message || '连接失败')}</span></div>`;
    } finally {
      setBusy(button, false);
    }
  }

  function applyProvider(provider) {
    const presets = {
      deepseek: ['https://api.deepseek.com/v1', 'deepseek-chat'],
      openai: ['https://api.openai.com/v1', 'gpt-4o-mini'],
      moonshot: ['https://api.moonshot.cn/v1', 'moonshot-v1-8k']
    };
    $$('#providerSeg button').forEach((b) => b.classList.toggle('active', b.dataset.provider === provider));
    if (presets[provider]) {
      $('#modelBase').value = presets[provider][0];
      $('#modelName').value = presets[provider][1];
      UI.toast('已填入 ' + provider + ' 的默认地址与模型');
    }
  }

  // ---------------- 系统设置 ----------------
  async function renderSettings(box) {
    const data = await api('adminSettings');
    const s = data.settings;
    box.innerHTML = `
      <form id="settingsForm" class="section-grid">
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><div><h2>基础信息</h2><p>展示在前台的名称与文案</p></div></div>
            <div class="panel-body">
              <div class="form-grid">
                <label class="field"><span class="field-label">产品名称</span>
                  <input class="input" id="setAppName" value="${esc(s.app_name)}"></label>
                <label class="field"><span class="field-label">默认主题</span>
                  <select id="setDefaultTheme">
                    ${['dusk', 'dawn', 'sakura', 'forest'].map((t) => `<option value="${t}" ${s.default_theme === t ? 'selected' : ''}>${THEME_TEXT[t]}</option>`).join('')}
                  </select></label>
                <label class="field span-2"><span class="field-label">一句话标语</span>
                  <input class="input" id="setTagline" value="${esc(s.app_tagline)}"></label>
                <label class="field span-2"><span class="field-label">欢迎语</span>
                  <textarea id="setWelcome" style="min-height:80px">${esc(s.welcome_message)}</textarea></label>
                <label class="field"><span class="field-label">客服邮箱</span>
                  <input class="input" id="setSupport" value="${esc(s.support_contact)}"></label>
                <label class="field"><span class="field-label">注册赠送亲密度</span>
                  <input class="input" id="setBonus" type="number" min="0" max="100" value="${esc(s.register_bonus_affection)}"></label>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>开关与限制</h2><p>注册、安全与维护状态</p></div></div>
            <div class="panel-body">
              <div class="section-grid">
                ${switchRow('allowRegister', '开放注册', '关闭后新用户无法注册', s.allow_register === '1')}
                ${switchRow('safetyEnabled', '安全过滤', '启用敏感词拦截与复核', s.safety_enabled === '1')}
                ${switchRow('maintenanceMode', '维护模式', '前台显示维护提示，仅管理员可登录', s.maintenance_mode === '1')}
                <div class="form-grid">
                  <label class="field"><span class="field-label">单条消息最大长度</span>
                    <input class="input" id="setMaxLen" type="number" min="100" max="5000" value="${esc(s.max_message_length)}"></label>
                  <label class="field"><span class="field-label">每分钟消息上限</span>
                    <input class="input" id="setPerMin" type="number" min="1" max="120" value="${esc(s.messages_per_minute)}"></label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>主动说话</h2><p>用户安静一段时间后，她会不会先开口</p></div></div>
          <div class="panel-body">
            <div class="form-grid">
              <div class="span-2">${switchRow('proactiveEnabled', '启用主动说话', '根据空闲时间与概率主动发消息', s.proactive_enabled === '1')}</div>
              <label class="field"><span class="field-label">空闲多少秒后触发</span>
                <input class="input" id="setIdle" type="number" min="20" max="3600" value="${esc(s.proactive_idle_seconds)}"></label>
              <label class="field"><span class="field-label">冷却时间（秒）</span>
                <input class="input" id="setCooldown" type="number" min="30" max="7200" value="${esc(s.proactive_cooldown_seconds)}"></label>
              <label class="field"><span class="field-label">触发概率 0 - 1</span>
                <input class="input" id="setProbability" type="number" min="0" max="1" step="0.05" value="${esc(s.proactive_probability)}"></label>
              <label class="field"><span class="field-label">上下文消息条数</span>
                <input class="input" id="setContext" type="number" min="4" max="60" value="${esc(s.max_context_messages)}"></label>
            </div>
            <div class="form-actions">
              <span class="form-note">保存后立即生效，无需重启服务</span>
              <button class="btn btn-primary" type="submit">${UI.icon('check', 15)}保存设置</button>
            </div>
          </div>
        </div>
      </form>`;
    mountIcons(box);
    $('#settingsForm').addEventListener('submit', saveSettings);
  }

  function switchRow(id, title, sub, checked) {
    return `<div class="inline-switch"><div><p>${esc(title)}</p><small>${esc(sub)}</small></div>
      <button type="button" class="switch" id="${id}" aria-checked="${checked ? 'true' : 'false'}" aria-label="${esc(title)}"></button></div>`;
  }

  async function saveSettings(event) {
    event.preventDefault();
    const payload = {
      app_name: $('#setAppName').value.trim(),
      app_tagline: $('#setTagline').value.trim(),
      default_theme: $('#setDefaultTheme').value,
      welcome_message: $('#setWelcome').value,
      support_contact: $('#setSupport').value.trim(),
      register_bonus_affection: $('#setBonus').value,
      max_message_length: $('#setMaxLen').value,
      messages_per_minute: $('#setPerMin').value,
      allow_register: $('#allowRegister').getAttribute('aria-checked') === 'true' ? 1 : 0,
      safety_enabled: $('#safetyEnabled').getAttribute('aria-checked') === 'true' ? 1 : 0,
      maintenance_mode: $('#maintenanceMode').getAttribute('aria-checked') === 'true' ? 1 : 0,
      proactive_enabled: $('#proactiveEnabled').getAttribute('aria-checked') === 'true' ? 1 : 0,
      proactive_idle_seconds: $('#setIdle').value,
      proactive_cooldown_seconds: $('#setCooldown').value,
      proactive_probability: $('#setProbability').value,
      max_context_messages: $('#setContext').value
    };
    const button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true, '保存中');
    try {
      await api('adminSaveSettings', payload);
      UI.toast('系统设置已保存', 'success');
    } catch (err) {
      UI.toast(err.message || '保存失败', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  // ---------------- 公告 ----------------
  async function renderAnnouncements(box) {
    const data = await api('adminAnnouncements');
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <span class="pager-info">共 ${(data.items || []).length} 条公告</span>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" data-act="ann-new">${UI.icon('plus', 14)}新建公告</button>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>标题</th><th>级别</th><th>状态</th><th>过期时间</th><th>发布人</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.items || []).map((a) => `
                  <tr>
                    <td><div class="cell-main">${esc(a.title)}</div><div class="cell-sub cell-ellipsis">${esc(a.content)}</div></td>
                    <td><span class="badge ${a.level === 'important' ? 'danger' : a.level === 'warm' ? 'info' : ''}">${esc(LEVEL_TEXT[a.level] || a.level)}</span></td>
                    <td><span class="badge ${a.active ? 'ok' : ''}"><i></i>${a.active ? '展示中' : '已下线'}</span></td>
                    <td class="cell-sub">${a.expires_at ? UI.formatDateTime(a.expires_at) : '永久有效'}</td>
                    <td class="cell-sub">${esc(a.created_by || '—')}<br>${UI.formatDateTime(a.created_at)}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn" data-act="ann-edit" data-id="${a.id}">${UI.icon('edit', 13)}编辑</button>
                      <button class="mini-btn danger" data-act="ann-del" data-id="${a.id}">${UI.icon('trash', 13)}删除</button>
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="6">' + emptyHTML('还没有公告', '新建一条，让用户知道发生了什么') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    mountIcons(box);
    state.announcements = data.items || [];
  }

  function announcementModal(item) {
    const a = item || { title: '', content: '', level: 'info', active: 1, expires_at: 0 };
    openModal({
      title: item ? '编辑公告' : '新建公告',
      sub: '公告会展示在前台侧栏',
      width: 560,
      html: `
        <div class="form-grid">
          <label class="field span-2"><span class="field-label">标题</span>
            <input class="input" id="annTitle" maxlength="80" value="${esc(a.title)}"></label>
          <label class="field span-2"><span class="field-label">内容</span>
            <textarea id="annContent" maxlength="1000" style="min-height:110px">${esc(a.content)}</textarea></label>
          <label class="field"><span class="field-label">级别</span>
            <select id="annLevel">
              ${['info', 'warm', 'important'].map((l) => `<option value="${l}" ${a.level === l ? 'selected' : ''}>${LEVEL_TEXT[l]}</option>`).join('')}
            </select></label>
          <label class="field"><span class="field-label">过期时间（留空为永久）</span>
            <input class="input" type="datetime-local" step="1" id="annExpires" value="${a.expires_at ? toLocalInput(a.expires_at) : ''}"></label>
          <div class="span-2 inline-switch"><div><p>立即展示</p><small>关闭后保存为草稿</small></div>
            <button type="button" class="switch" id="annActive" aria-checked="${a.active ? 'true' : 'false'}"></button></div>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '保存公告', cls: 'btn-primary', onClick: async (ctx) => {
            const title = $('#annTitle').value.trim();
            const content = $('#annContent').value.trim();
            if (!title || !content) { UI.toast('标题和内容都不能为空'); return; }
            const expires = $('#annExpires').value ? Math.floor(new Date($('#annExpires').value).getTime() / 1000) : 0;
            setBusy(ctx.button, true, '保存中');
            try {
              await api('adminAnnouncementSave', {
                id: a.id || 0, title: title, content: content, level: $('#annLevel').value,
                active: $('#annActive').getAttribute('aria-checked') === 'true' ? 1 : 0,
                expires_at: expires
              });
              UI.toast('公告已保存', 'success');
              closeModal();
              loadView('announcements');
            } catch (err) {
              UI.toast(err.message || '保存失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  // ---------------- 敏感词 ----------------
  async function renderWords(box) {
    const data = await api('adminWords');
    const items = data.items || [];
    box.innerHTML = `
      <div class="section-grid">
        <div class="panel">
          <div class="panel-head"><div><h2>新增规则</h2><p>支持整词包含匹配，立即生效</p></div></div>
          <div class="panel-body">
            <form id="wordForm" class="form-grid" autocomplete="off">
              <label class="field"><span class="field-label">敏感词</span>
                <input class="input" id="wordText" maxlength="60" placeholder="输入需要拦截或复核的词"></label>
              <label class="field"><span class="field-label">处理方式</span>
                <select id="wordAction">
                  <option value="block">直接拦截</option>
                  <option value="review">标记复核</option>
                </select></label>
              <label class="field"><span class="field-label">分类</span>
                <input class="input" id="wordCategory" maxlength="30" value="通用"></label>
              <div class="field" style="justify-content:flex-end"><span class="field-label">　</span>
                <button class="btn btn-primary" type="submit" style="min-height:48px">${UI.icon('plus', 15)}添加规则</button></div>
            </form>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><div><h2>规则列表</h2><p>共 ${items.length} 条</p></div>
            <div class="panel-actions"><span class="badge danger">拦截 ${items.filter((w) => w.action === 'block').length}</span><span class="badge warn">复核 ${items.filter((w) => w.action === 'review').length}</span></div>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>词条</th><th>处理</th><th>分类</th><th>添加时间</th><th>操作</th></tr></thead>
              <tbody>
                ${items.map((w) => `
                  <tr>
                    <td class="cell-main">${esc(w.word)}</td>
                    <td><span class="badge ${w.action === 'block' ? 'danger' : 'warn'}">${esc(WORD_ACTION[w.action] || w.action)}</span></td>
                    <td>${esc(w.category || '通用')}</td>
                    <td class="cell-sub">${UI.formatDateTime(w.created_at)}</td>
                    <td><button class="mini-btn danger" data-act="word-del" data-id="${w.id}">${UI.icon('trash', 13)}删除</button></td>
                  </tr>`).join('') || '<tr><td colspan="5">' + emptyHTML('词库还是空的', '添加需要拦截的词，保护对话边界') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    mountIcons(box);
    $('#wordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const word = $('#wordText').value.trim();
      if (!word) { UI.toast('请输入敏感词'); return; }
      try {
        await api('adminWordSave', { word: word, word_action: $('#wordAction').value, category: $('#wordCategory').value.trim() || '通用' });
        UI.toast('敏感词已添加', 'success');
        loadView('words');
      } catch (err) {
        UI.toast(err.message || '添加失败', 'error');
      }
    });
  }

  // ---------------- 反馈 ----------------
  async function renderFeedbacks(box) {
    const f = state.filters.feedbacks;
    const data = await api('adminFeedbacks', { status: f.status, page: f.page });
    if (f.page > data.pages) { f.page = data.pages; return loadView('feedbacks'); }
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <div class="seg">
            ${['all', 'open', 'replied', 'closed'].map((k) => `<button data-act="fb-status" data-status="${k}" class="${f.status === k ? 'active' : ''}">${k === 'all' ? '全部' : FB_TEXT[k]}</button>`).join('')}
          </div>
          <span class="spacer"></span>
          <span class="pager-info">共 ${data.total} 条</span>
        </div>
        <div class="feedback-list">
          ${(data.items || []).map((fb) => `
            <div class="feedback-card">
              <div class="feedback-top">
                <strong>${esc(fb.nickname || fb.username || '匿名用户')}</strong>
                <span class="badge">${esc(fb.category || '建议')}</span>
                <span class="badge ${fb.status === 'open' ? 'warn' : fb.status === 'replied' ? 'ok' : ''}">${esc(FB_TEXT[fb.status] || fb.status)}</span>
                <span class="spacer"></span>
                <span class="cell-sub">${UI.formatDateTime(fb.created_at)}</span>
              </div>
              <p class="feedback-content">${esc(fb.content)}</p>
              ${fb.contact ? '<div class="feedback-foot">联系方式：' + esc(fb.contact) + '</div>' : ''}
              ${fb.reply ? `<div class="feedback-reply"><b>${esc(fb.replied_by || '运营')} 回复：</b>${esc(fb.reply)}</div>` : ''}
              <div class="feedback-foot">
                <span>@${esc(fb.username || '—')}</span>
                ${fb.replied_at ? '<span>· ' + UI.formatDateTime(fb.replied_at) + '</span>' : ''}
                <span class="spacer"></span>
                <button class="mini-btn accent" data-act="fb-reply" data-id="${fb.id}">${UI.icon('message', 13)}${fb.reply ? '修改回复' : '回复'}</button>
              </div>
            </div>`).join('') || emptyHTML('没有反馈', '用户的建议会出现在这里')}
        </div>
        <div class="panel-foot">${pagerHTML(data.page, data.pages, 'feedbacks')}</div>
      </div>`;
    mountIcons(box);
    state.feedbackItems = data.items || [];
  }

  function feedbackModal(id) {
    const fb = (state.feedbackItems || []).find((item) => item.id === id);
    if (!fb) return;
    openModal({
      title: '回复反馈',
      sub: (fb.nickname || fb.username || '用户') + ' · ' + (fb.category || '建议'),
      width: 540,
      html: `
        <div class="feedback-content" style="padding:12px 14px;border-radius:12px;background:var(--panel-soft);border:1px solid var(--line)">${esc(fb.content)}</div>
        <div class="field" style="margin-top:16px">
          <span class="field-label">回复内容</span>
          <textarea id="fbReply" style="min-height:120px" maxlength="1000">${esc(fb.reply || '')}</textarea>
        </div>
        <div class="field" style="margin-top:14px">
          <span class="field-label">工单状态</span>
          <select id="fbStatus">
            ${['open', 'replied', 'closed'].map((k) => `<option value="${k}" ${fb.status === k ? 'selected' : ''}>${FB_TEXT[k]}</option>`).join('')}
          </select>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '保存回复', cls: 'btn-primary', onClick: async (ctx) => {
            const reply = $('#fbReply').value.trim();
            if (!reply) { UI.toast('回复内容不能为空'); return; }
            setBusy(ctx.button, true, '保存中');
            try {
              await api('adminFeedbackReply', { id: fb.id, reply: reply, status: $('#fbStatus').value });
              UI.toast('回复已保存', 'success');
              closeModal();
              loadView('feedbacks');
              refreshBadges();
            } catch (err) {
              UI.toast(err.message || '保存失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  // ---------------- 管理员 ----------------
  async function renderAdmins(box) {
    const data = await api('adminAdmins');
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <span class="pager-info">共 ${(data.items || []).length} 位管理员</span>
          <span class="spacer"></span>
          <button class="btn btn-primary btn-sm" data-act="admin-new">${UI.icon('plus', 14)}新增管理员</button>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>账号</th><th>显示名</th><th>角色</th><th>状态</th><th>最后登录</th><th>操作</th></tr></thead>
              <tbody>
                ${(data.items || []).map((a) => `
                  <tr>
                    <td><div class="cell-main">${esc(a.username)}</div><div class="cell-sub">ID ${a.id}</div></td>
                    <td>${esc(a.display_name)}</td>
                    <td><span class="badge ${a.role === 'superadmin' ? 'info' : ''}">${esc(ROLE_TEXT[a.role] || a.role)}</span></td>
                    <td><span class="badge ${a.status === 'active' ? 'ok' : 'danger'}"><i></i>${a.status === 'active' ? '启用' : '停用'}</span></td>
                    <td class="cell-sub">${a.last_login_at ? UI.formatDateTime(a.last_login_at) + '<br>' + esc(a.last_login_ip || '') : '从未登录'}</td>
                    <td><div class="cell-actions">
                      <button class="mini-btn" data-act="admin-edit" data-id="${a.id}">${UI.icon('edit', 13)}编辑</button>
                      <button class="mini-btn danger" data-act="admin-del" data-id="${a.id}">${UI.icon('trash', 13)}删除</button>
                    </div></td>
                  </tr>`).join('') || '<tr><td colspan="6">' + emptyHTML('没有管理员') + '</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    mountIcons(box);
    state.adminItems = data.items || [];
  }

  function adminModal(item) {
    const a = item || { username: '', display_name: '', role: 'admin', status: 'active' };
    openModal({
      title: item ? '编辑管理员' : '新增管理员',
      sub: '仅超级管理员可管理后台账号',
      width: 520,
      html: `
        <div class="form-grid">
          <label class="field"><span class="field-label">后台账号</span>
            <input class="input" id="admUsername" value="${esc(a.username)}" ${item ? 'disabled' : ''} placeholder="3-30 位字母数字下划线"></label>
          <label class="field"><span class="field-label">显示名</span>
            <input class="input" id="admDisplay" value="${esc(a.display_name)}" placeholder="留空则同账号"></label>
          <label class="field"><span class="field-label">角色</span>
            <select id="admRole">
              ${['superadmin', 'admin', 'moderator'].map((r) => `<option value="${r}" ${a.role === r ? 'selected' : ''}>${ROLE_TEXT[r]}</option>`).join('')}
            </select></label>
          <label class="field"><span class="field-label">状态</span>
            <select id="admStatus">
              <option value="active" ${a.status === 'active' ? 'selected' : ''}>启用</option>
              <option value="disabled" ${a.status === 'disabled' ? 'selected' : ''}>停用</option>
            </select></label>
          <label class="field span-2"><span class="field-label">密码 <span class="field-hint">${item ? '留空表示不修改，至少 8 位' : '至少 8 位'}</span></span>
            <input class="input" id="admPassword" type="password" autocomplete="new-password" placeholder="${item ? '留空则不修改' : '设置登录密码'}"></label>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '保存', cls: 'btn-primary', onClick: async (ctx) => {
            const password = $('#admPassword').value;
            if (!item && password.length < 8) { UI.toast('密码至少 8 位'); return; }
            if (item && password && password.length < 8) { UI.toast('密码至少 8 位'); return; }
            setBusy(ctx.button, true, '保存中');
            try {
              await api('adminAdminSave', {
                id: item ? item.id : 0,
                username: item ? item.username : $('#admUsername').value.trim(),
                display_name: $('#admDisplay').value.trim(),
                role: $('#admRole').value,
                status: $('#admStatus').value,
                password: password
              });
              UI.toast('管理员已保存', 'success');
              closeModal();
              loadView('admins');
            } catch (err) {
              UI.toast(err.message || '保存失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  // ---------------- 审计日志 ----------------
  async function renderAudit(box) {
    const f = state.filters.audit;
    const data = await api('adminAuditLogs', { q: f.q, page: f.page });
    if (f.page > data.pages) { f.page = data.pages; return loadView('audit'); }
    box.innerHTML = `
      <div class="section-grid">
        <div class="toolbar">
          <label class="search-wrap">${UI.icon('search', 15)}
            <input type="search" placeholder="搜索管理员 / 动作 / 详情" value="${esc(f.q)}" data-filter="audit:q">
          </label>
          <span class="spacer"></span>
          <span class="pager-info">共 ${data.total} 条记录</span>
        </div>
        <div class="panel">
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>时间</th><th>管理员</th><th>动作</th><th>详情</th><th>IP</th></tr></thead>
              <tbody>
                ${(data.items || []).map((a) => `
                  <tr>
                    <td class="cell-sub">${UI.formatDateTime(a.created_at)}</td>
                    <td class="cell-main">${esc(a.admin_name || '系统')}</td>
                    <td><span class="badge">${esc(AUDIT_TEXT[a.action] || a.action)}</span></td>
                    <td><div class="cell-ellipsis" title="${esc(a.detail)}">${esc(a.detail || '—')}</div></td>
                    <td class="cell-sub">${esc(a.ip || '—')}</td>
                  </tr>`).join('') || '<tr><td colspan="5">' + emptyHTML('还没有操作记录') + '</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="panel-foot"><span class="panel-note">第 ${data.page} / ${data.pages} 页</span>${pagerHTML(data.page, data.pages, 'audit')}</div>
        </div>
      </div>`;
    mountIcons(box);
  }

  // ---------------- 数据工具 ----------------
  async function renderTools(box) {
    box.innerHTML = `
      <div class="section-grid">
        <div class="tool-grid">
          <div class="tool-card">
            <span class="tool-icon">${UI.icon('download', 19)}</span>
            <h3>数据库备份</h3>
            <p>导出完整 SQLite 数据库文件，包含用户、消息、情绪与审计记录。</p>
            <button class="btn btn-ghost btn-block btn-sm" data-act="backup">${UI.icon('database', 14)}下载备份</button>
          </div>
          <div class="tool-card">
            <span class="tool-icon">${UI.icon('upload', 19)}</span>
            <h3>用户数据导出</h3>
            <p>导出用户资料、情绪状态与活跃数据的 CSV 表格，可用 Excel 打开。</p>
            <button class="btn btn-ghost btn-block btn-sm" data-act="export-users">${UI.icon('external', 14)}导出 CSV</button>
          </div>
          <div class="tool-card">
            <span class="tool-icon">${UI.icon('megaphone', 19)}</span>
            <h3>全站关怀消息</h3>
            <p>以陪伴者身份向所有正常用户发送一条主动消息，会写入各自的聊天记录。</p>
            <button class="btn btn-ghost btn-block btn-sm" data-act="broadcast">${UI.icon('heart', 14)}发送关怀</button>
          </div>
        </div>
        <div class="grid-2-1">
          <div class="panel">
            <div class="panel-head"><div><h2>系统信息</h2><p>运行环境与资源占用</p></div>
              <div class="panel-actions"><button class="mini-btn" data-act="sysinfo">${UI.icon('refresh', 13)}刷新</button></div></div>
            <div class="panel-body" id="sysInfoBox">${loadingHTML('正在读取系统信息')}</div>
          </div>
          <div class="panel">
            <div class="panel-head"><div><h2>模型调用日志</h2><p>最近 20 条错误记录</p></div></div>
            <div class="panel-body" id="modelLogBox">${loadingHTML('正在读取日志')}</div>
          </div>
        </div>
      </div>`;
    mountIcons(box);
    loadSystemInfo();
  }

  async function loadSystemInfo() {
    try {
      const info = await api('adminSystemInfo');
      const box = $('#sysInfoBox');
      if (box) {
        box.innerHTML = `<div class="kv-list">
          <div class="kv-row"><span>产品版本</span><b>v${esc(info.version)}</b></div>
          <div class="kv-row"><span>PHP</span><b>${esc(info.php)}</b></div>
          <div class="kv-row"><span>SQLite</span><b>${esc(info.sqlite)}</b></div>
          <div class="kv-row"><span>数据库大小</span><b>${formatBytes(info.db_size)}</b></div>
          <div class="kv-row"><span>磁盘剩余</span><b>${formatBytes(info.disk_free)}</b></div>
          <div class="kv-row"><span>数据目录</span><b>${esc(info.data_dir)}</b></div>
          <div class="kv-row"><span>在线用户会话</span><b>${esc(info.sessions)}</b></div>
          <div class="kv-row"><span>后台会话</span><b>${esc(info.admin_sessions)}</b></div>
          <div class="kv-row"><span>模型状态</span><b>${info.model_configured ? '已接入' : '未配置'}</b></div>
          <div class="kv-row"><span>服务器时间</span><b>${esc(info.server_time)}</b></div>
        </div>`;
      }
      const logBox = $('#modelLogBox');
      if (logBox) {
        logBox.innerHTML = info.model_log
          ? '<pre class="log-box">' + esc(info.model_log) + '</pre>'
          : '<div class="form-note">暂无模型错误日志，调用一切正常。</div>';
      }
    } catch (err) {
      const box = $('#sysInfoBox');
      if (box) box.innerHTML = '<div class="notice warn">' + UI.icon('alert', 15) + '<span>' + esc(err.message) + '</span></div>';
    }
  }

  function formatBytes(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }

  // ---------------- 通用弹窗 ----------------
  function openModal(opts) {
    $('#modalTitle').textContent = opts.title || '';
    $('#modalSub').textContent = opts.sub || '';
    $('#modalBody').innerHTML = opts.html || '';
    const panel = $('.admin-modal-panel');
    panel.style.width = opts.width ? 'min(' + opts.width + 'px, 100%)' : '';
    const actions = $('#modalActions');
    actions.innerHTML = '';
    (opts.buttons || [{ label: '关闭', cls: 'btn-ghost' }]).forEach((cfg) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (cfg.cls || 'btn-ghost');
      btn.innerHTML = cfg.label;
      btn.addEventListener('click', () => {
        if (cfg.onClick) cfg.onClick({ close: closeModal, button: btn });
        else closeModal();
      });
      actions.appendChild(btn);
    });
    const modal = $('#adminModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    mountIcons(modal);
  }

  function closeModal() {
    const modal = $('#adminModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const html = `<p class="form-note" style="font-size:12.5px;color:var(--text-soft);line-height:1.85">${esc(opts.message)}</p>` +
        (opts.requireInput ? `<label class="field" style="margin-top:14px"><span class="field-label">${esc(opts.inputLabel || '请输入内容')}</span>
          <input class="input" id="confirmInput" type="${opts.inputType || 'text'}" placeholder="${esc(opts.placeholder || '')}" autocomplete="off"></label>` : '');
      openModal({
        title: opts.title || '请确认',
        sub: opts.sub || '',
        width: 460,
        html: html,
        buttons: [
          { label: '取消', cls: 'btn-ghost', onClick: () => { closeModal(); resolve(false); } },
          {
            label: opts.confirmText || '确认', cls: opts.danger ? 'btn-danger' : 'btn-primary',
            onClick: () => {
              if (opts.requireInput) {
                const value = $('#confirmInput').value.trim();
                if (!value) { UI.toast('请先填写内容'); return; }
                closeModal();
                resolve(value);
                return;
              }
              closeModal();
              resolve(true);
            }
          }
        ]
      });
      mountIcons($('#adminModal'));
    });
  }

  function toLocalInput(ts) {
    const d = new Date(Number(ts) * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // ---------------- 封禁弹窗 ----------------
  function openBanModal(user) {
    const now = Math.floor(Date.now() / 1000);
    const defaultUntil = now + 86400;
    openModal({
      title: '封禁用户',
      sub: (user.nickname || user.username) + ' · @' + user.username + ' · ID ' + user.id,
      width: 580,
      html: `
        <div class="notice warn">${UI.icon('alert', 15)}<span>封禁后该用户登录会看到弹窗，弹窗内会原样展示封禁原因、封禁时间与解封时间。时间可精确到秒。</span></div>
        <div class="form-grid" style="margin-top:16px">
          <label class="field span-2"><span class="field-label">封禁原因</span>
            <textarea id="banReason" maxlength="500" style="min-height:92px" placeholder="例如：多次发送攻击性内容，违反社区约定">${esc('')}</textarea></label>
          <div class="span-2">
            <span class="field-label" style="margin-bottom:8px">快捷时长</span>
            <div class="preset-row" id="banPresets">
              ${[['10 分钟', 600], ['1 小时', 3600], ['6 小时', 21600], ['1 天', 86400], ['3 天', 259200], ['7 天', 604800], ['30 天', 2592000]].map((p) => `<button type="button" class="mini-btn" data-preset="${p[1]}">${p[0]}</button>`).join('')}
              <button type="button" class="mini-btn danger" data-preset="forever">永久封禁</button>
            </div>
          </div>
          <label class="field span-2"><span class="field-label">解封时间（精确到秒）</span>
            <input class="input" type="datetime-local" step="1" id="banUntil" value="${toLocalInput(defaultUntil)}"></label>
          <div class="span-2" id="banPreview"></div>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '确认封禁', cls: 'btn-danger', onClick: async (ctx) => {
            const reason = $('#banReason').value.trim();
            const permanent = $('#banUntil').dataset.permanent === '1';
            if (reason.length < 2) { UI.toast('请填写封禁原因，至少 2 个字'); $('#banReason').focus(); return; }
            const untilAt = permanent ? 0 : Math.floor(new Date($('#banUntil').value).getTime() / 1000);
            if (!permanent && (!untilAt || untilAt <= Math.floor(Date.now() / 1000))) {
              UI.toast('解封时间必须晚于现在');
              return;
            }
            setBusy(ctx.button, true, '封禁中');
            try {
              await api('adminBanUser', { user_id: user.id, reason: reason, until_at: untilAt, permanent: permanent ? 1 : 0 });
              UI.toast('用户已封禁', 'success');
              closeModal();
              loadView(state.view);
              if (state.drawer && state.drawer.userId === user.id) refreshDrawer();
            } catch (err) {
              UI.toast(err.message || '封禁失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
    bindBanPresets();
    updateBanPreview();
  }

  function bindBanPresets() {
    $('#banPresets').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-preset]');
      if (!btn) return;
      $$('#banPresets .mini-btn').forEach((b) => b.classList.remove('accent'));
      btn.classList.add('accent');
      const input = $('#banUntil');
      if (btn.dataset.preset === 'forever') {
        input.dataset.permanent = '1';
        input.disabled = true;
      } else {
        input.dataset.permanent = '0';
        input.disabled = false;
        input.value = toLocalInput(Math.floor(Date.now() / 1000) + Number(btn.dataset.preset));
      }
      updateBanPreview();
    });
    $('#banUntil').addEventListener('input', () => {
      $('#banUntil').dataset.permanent = '0';
      $$('#banPresets .mini-btn').forEach((b) => b.classList.remove('accent'));
      updateBanPreview();
    });
    $('#banReason').addEventListener('input', updateBanPreview);
  }

  function updateBanPreview() {
    const box = $('#banPreview');
    if (!box) return;
    const permanent = $('#banUntil').dataset.permanent === '1';
    const reason = $('#banReason').value.trim();
    const until = permanent ? 0 : Math.floor(new Date($('#banUntil').value).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const remain = permanent ? 0 : Math.max(0, until - now);
    box.innerHTML = `<div class="ban-preview">
      <b>用户端弹窗预览</b><br>
      原因：${reason ? esc(reason) : '<span style="opacity:.6">（尚未填写）</span>'}<br>
      封禁时间：${UI.formatDateTime(now)}<br>
      解封时间：${permanent ? '永久封禁' : until ? UI.formatDateTime(until) : '—'}<br>
      剩余时长：${permanent ? '永久' : duration(remain)}
    </div>`;
  }

  // ---------------- 用户详情抽屉 ----------------
  async function openDrawer(userId, tab) {
    const drawer = $('#adminDrawer');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    $('#drawerMask').classList.add('open');
    state.drawer = { userId: userId, tab: tab || 'overview', detail: null };
    $('#drawerBody').innerHTML = loadingHTML('正在读取用户档案');
    $('#drawerFoot').innerHTML = '';
    try {
      state.drawer.detail = await api('adminUserDetail', { user_id: userId });
      renderDrawer();
    } catch (err) {
      $('#drawerBody').innerHTML = '<div class="notice warn">' + UI.icon('alert', 15) + '<span>' + esc(err.message) + '</span></div>';
    }
  }

  async function refreshDrawer() {
    if (!state.drawer) return;
    try {
      state.drawer.detail = await api('adminUserDetail', { user_id: state.drawer.userId });
      renderDrawer();
    } catch (err) {
      UI.toast(err.message || '刷新失败', 'error');
    }
  }

  function closeDrawer() {
    $('#adminDrawer').classList.remove('open');
    $('#adminDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerMask').classList.remove('open');
    state.drawer = null;
  }

  function renderDrawer() {
    const d = state.drawer;
    if (!d || !d.detail) return;
    const { user, state: moodState, ban, stats } = d.detail;
    $('#drawerAvatar').textContent = initial(user.nickname || user.username);
    $('#drawerName').textContent = user.nickname || user.username;
    $('#drawerMeta').innerHTML = `@${esc(user.username)} · ID ${user.id} ${statusBadge(user.status)} <span class="badge">${esc(moodState.mood)}</span> <span class="badge">${esc(THEME_TEXT[user.theme] || user.theme)}</span>`;
    const tabs = [['overview', '概览'], ['messages', '对话'], ['mood', '情绪'], ['ban', '封禁'], ['feedback', '反馈'], ['profile', '资料']];
    $('#drawerTabs').innerHTML = tabs.map((t) => `<button class="drawer-tab ${d.tab === t[0] ? 'active' : ''}" data-drawer-tab="${t[0]}">${t[1]}</button>`).join('');
    $('#drawerFoot').innerHTML = `
      <button class="btn btn-ghost btn-sm" data-drawer-act="edit">${UI.icon('edit', 14)}编辑资料</button>
      <button class="btn btn-ghost btn-sm" data-drawer-act="care">${UI.icon('heart', 14)}人工关怀</button>
      <button class="btn btn-ghost btn-sm" data-drawer-act="reset">${UI.icon('key', 14)}重置密码</button>
      ${user.status === 'banned'
        ? `<button class="btn btn-primary btn-sm" data-drawer-act="unban">${UI.icon('check', 14)}解除封禁</button>`
        : `<button class="btn btn-danger btn-sm" data-drawer-act="ban">${UI.icon('ban', 14)}封禁用户</button>`}
      <span class="spacer"></span>
      <button class="btn btn-danger btn-sm" data-drawer-act="delete">${UI.icon('trash', 14)}删除</button>`;

    let body = '';
    if (d.tab === 'overview') body = drawerOverview(user, moodState, ban, stats);
    else if (d.tab === 'messages') body = drawerMessages(d.detail.messages || []);
    else if (d.tab === 'mood') body = drawerMood(d.detail);
    else if (d.tab === 'ban') body = drawerBan(d.detail);
    else if (d.tab === 'feedback') body = drawerFeedback(d.detail.feedbacks || []);
    else body = drawerProfile(d.detail);
    $('#drawerBody').innerHTML = body;
    mountIcons($('#adminDrawer'));
  }

  function drawerOverview(user, moodState, ban, stats) {
    return `
      <div class="quick-actions">
        <button class="mini-btn" data-drawer-act="refresh">${UI.icon('refresh', 13)}刷新档案</button>
        <button class="mini-btn" data-drawer-act="care">${UI.icon('heart', 13)}发送关怀</button>
      </div>
      ${ban ? `<div class="notice warn" style="margin-bottom:16px">${UI.icon('ban', 15)}<span><b>封禁中</b> · 原因：${esc(ban.reason)} · ${ban.permanent ? '永久' : '解封于 ' + esc(ban.until_text)} · 剩余 ${duration(ban.remaining_seconds)}</span></div>` : ''}
      <div class="detail-grid">
        <div class="detail-item"><span>当前情绪</span><b>${esc(moodState.mood)} · 心情值 ${moodState.mood_valence}</b></div>
        <div class="detail-item"><span>关系阶段</span><b>${esc(moodState.relationship)} Lv.${esc(moodState.relationship_level)}</b></div>
        <div class="detail-item"><span>亲密度</span><b>${moodState.affection} / 100</b></div>
        <div class="detail-item"><span>信任度</span><b>${moodState.trust} / 100</b></div>
        <div class="detail-item"><span>生气值</span><b>${moodState.anger} / 100</b></div>
        <div class="detail-item"><span>难过值</span><b>${moodState.sadness} / 100</b></div>
        <div class="detail-item"><span>精力</span><b>${moodState.energy} / 100</b></div>
        <div class="detail-item"><span>连续陪伴</span><b>${esc(stats.streak_days)} 天</b></div>
        <div class="detail-item"><span>消息总数</span><b>${esc(stats.total_messages)} 条</b></div>
        <div class="detail-item"><span>用户 / 陪伴者</span><b>${esc(stats.user_messages)} / ${esc(stats.assistant_messages)}</b></div>
        <div class="detail-item"><span>会话数</span><b>${esc(stats.conversations)}</b></div>
        <div class="detail-item"><span>最后活跃</span><b>${UI.relativeTime(user.last_active_at)}</b></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>情绪刻度</h2><p>实时数值</p></div></div>
        <div class="panel-body">
          ${meterRow('心情值', moodState.mood_valence, 100, -100)}
          ${meterRow('亲密度', moodState.affection, 100)}
          ${meterRow('信任度', moodState.trust, 100)}
          ${meterRow('生气值', moodState.anger, 100)}
          ${meterRow('难过值', moodState.sadness, 100)}
          ${meterRow('精力', moodState.energy, 100)}
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>最近对话</h2><p>最后 6 条</p></div>
          <div class="panel-actions"><button class="mini-btn" data-drawer-tab="messages">查看全部</button></div></div>
        <div class="panel-body">${drawerMessages((state.drawer.detail.messages || []).slice(-6), true)}</div>
      </div>`;
  }

  function meterRow(label, value, max, min) {
    const lo = min != null ? min : 0;
    const pct = Math.max(0, Math.min(100, ((Number(value) - lo) / (max - lo)) * 100));
    return `<div class="meter-row"><div class="meter-top"><span>${esc(label)}</span><b>${esc(value)}</b></div>
      <div class="meter-track"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
  }

  function drawerMessages(messages, compact) {
    if (!messages.length) return emptyHTML('还没有聊天记录', '她还在等第一句话');
    const list = messages.slice().reverse();
    return `<div class="chat-log">${list.map((m) => `
      <div class="chat-line ${esc(m.role)}">
        <span class="chat-who">${m.role === 'user' ? 'U' : m.role === 'system' ? 'S' : '屿'}</span>
        <div class="chat-bubble">
          ${esc(m.content)}
          <div class="chat-time">
            <span>${UI.formatDateTime(m.created_at)}</span>
            ${m.pinned ? '<span class="pinned-mark">★ 已精选</span>' : ''}
            ${compact ? '' : `<button class="mini-btn" data-act="msg-pin" data-id="${m.id}" data-pinned="${m.pinned ? 0 : 1}">${m.pinned ? '取消精选' : '精选'}</button>
            <button class="mini-btn danger" data-act="msg-del" data-id="${m.id}">删除</button>`}
          </div>
        </div>
      </div>`).join('')}</div>
      ${compact ? '' : `<div class="panel" style="margin-top:18px;border-radius:14px">
        <div class="panel-head"><div><h2>人工关怀</h2><p>以系统身份插入一条消息，用户会立即看到</p></div></div>
        <div class="panel-body">
          <div class="field"><textarea id="drawerComposer" style="min-height:86px" maxlength="1000" placeholder="写一句真诚的关心，比如：最近降温了，记得加件外套。"></textarea></div>
          <div class="form-actions" style="margin-top:14px;padding-top:12px">
            <button class="btn btn-primary btn-sm" data-drawer-act="send">${UI.icon('send', 14)}发送关怀</button>
          </div>
        </div></div>`}`;
  }

  function drawerMood(detail) {
    const series = detail.mood_series || [];
    const chart = series.length
      ? chartSVG(series.map((s) => String(s.d).slice(5)), [{ values: series.map((s) => s.v), color: 'var(--chart-line)' }], { min: -100, max: 100, height: 200 })
      : '<div class="chart-empty">近 14 天还没有情绪采样</div>';
    return `
      <div class="panel"><div class="panel-head"><div><h2>近 14 天心情曲线</h2><p>每日平均心情值</p></div></div>
        <div class="panel-body"><div class="chart-wrap">${chart}</div></div></div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>肢体互动</h2><p>用户主动使用过的动作</p></div></div>
        <div class="panel-body">${barList((detail.interactions || []).map((i) => ({ label: ({ hug: '抱抱', headpat: '摸头', flower: '送花', hand: '牵手', warm: '披外套' })[i.type] || i.type, value: i.c })), ' 次')}</div>
      </div>`;
  }

  function drawerBan(detail) {
    const items = detail.ban_history || [];
    return `
      ${detail.ban ? `<div class="notice warn">${UI.icon('ban', 15)}<span><b>当前封禁中</b> · ${esc(detail.ban.reason)} · ${detail.ban.permanent ? '永久封禁' : '解封于 ' + esc(detail.ban.until_text)} · 剩余 ${duration(detail.ban.remaining_seconds)}</span></div>` : '<div class="notice">' + UI.icon('check', 15) + '<span>该用户当前未被封禁。</span></div>'}
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>封禁历史</h2><p>共 ${items.length} 次</p></div></div>
        <div class="table-scroll"><table class="data-table">
          <thead><tr><th>原因</th><th>开始</th><th>结束</th><th>操作人</th><th>解除</th></tr></thead>
          <tbody>
            ${items.map((b) => `
              <tr>
                <td>${esc(b.reason)}</td>
                <td class="cell-sub">${UI.formatDateTime(b.banned_at)}</td>
                <td class="cell-sub">${b.until_at ? UI.formatDateTime(b.until_at) : '永久'}</td>
                <td class="cell-sub">${esc(b.created_by_name || '—')}</td>
                <td class="cell-sub">${b.lifted_at ? UI.formatDateTime(b.lifted_at) + ' · ' + esc(b.lifted_by || '') : '—'}</td>
              </tr>`).join('') || '<tr><td colspan="5">' + emptyHTML('没有封禁记录') + '</td></tr>'}
          </tbody></table></div>
      </div>`;
  }

  function drawerFeedback(items) {
    if (!items.length) return emptyHTML('还没有反馈', '用户的想法会出现在这里');
    return `<div class="feedback-list">${items.map((fb) => `
      <div class="feedback-card">
        <div class="feedback-top"><strong>${esc(fb.category || '建议')}</strong>
          <span class="badge ${fb.status === 'open' ? 'warn' : fb.status === 'replied' ? 'ok' : ''}">${esc(FB_TEXT[fb.status] || fb.status)}</span>
          <span class="spacer"></span><span class="cell-sub">${UI.formatDateTime(fb.created_at)}</span></div>
        <p class="feedback-content">${esc(fb.content)}</p>
        ${fb.reply ? '<div class="feedback-reply"><b>' + esc(fb.replied_by || '运营') + '：</b>' + esc(fb.reply) + '</div>' : ''}
      </div>`).join('')}</div>`;
  }

  function drawerProfile(detail) {
    const user = detail.user;
    const session = detail.last_session;
    return `
      <div class="detail-grid">
        <div class="detail-item"><span>用户 ID</span><b>${user.id}</b></div>
        <div class="detail-item"><span>用户名</span><b>${esc(user.username)}</b></div>
        <div class="detail-item"><span>昵称</span><b>${esc(user.nickname)}</b></div>
        <div class="detail-item"><span>陪伴者名字</span><b>${esc(user.companion_name)}</b></div>
        <div class="detail-item"><span>邮箱</span><b>${esc(user.email || '未填写')}</b></div>
        <div class="detail-item"><span>手机</span><b>${esc(user.phone || '未填写')}</b></div>
        <div class="detail-item"><span>性别</span><b>${esc(user.gender || '未填写')}</b></div>
        <div class="detail-item"><span>生日</span><b>${esc(user.birthday || '未填写')}</b></div>
        <div class="detail-item"><span>注册 IP</span><b class="mono">${esc(user.register_ip || '—')}</b></div>
        <div class="detail-item"><span>最后 IP</span><b class="mono">${esc(user.last_ip || '—')}</b></div>
        <div class="detail-item"><span>注册时间</span><b>${UI.formatDateTime(user.created_at)}</b></div>
        <div class="detail-item"><span>最后登录</span><b>${UI.formatDateTime(user.last_login_at)}</b></div>
        <div class="detail-item"><span>偏好主动说话</span><b>${user.preferences.proactive ? '开启' : '关闭'}</b></div>
        <div class="detail-item"><span>气泡样式</span><b>${esc(user.bubble_style || 'soft')}</b></div>
        <div class="detail-item"><span>字号</span><b>${esc(user.font_size)} px</b></div>
        <div class="detail-item"><span>当前主题</span><b>${esc(THEME_TEXT[user.theme] || user.theme)}</b></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>陪伴设定</h2><p>用户为 AI 设定的人设</p></div></div>
        <div class="panel-body"><p class="feedback-content">${esc(user.companion_persona || '未设置')}</p>
          <div class="form-section"><div class="form-section-title">${UI.icon('user', 14)} 个人简介</div>
            <p class="feedback-content">${esc(user.bio || '未填写')}</p></div>
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>运营备注</h2><p>仅后台可见</p></div></div>
        <div class="panel-body"><p class="feedback-content">${esc(user.admin_note || '暂无备注，可通过「编辑资料」写入。')}</p></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><div><h2>最近会话</h2><p>设备与网络环境</p></div></div>
        <div class="panel-body">
          ${session ? `<div class="kv-list">
            <div class="kv-row"><span>IP</span><b class="mono">${esc(session.ip || '—')}</b></div>
            <div class="kv-row"><span>登录时间</span><b>${UI.formatDateTime(session.created_at)}</b></div>
            <div class="kv-row"><span>最后在线</span><b>${UI.formatDateTime(session.last_seen_at)}</b></div>
            <div class="kv-row"><span>设备</span><b style="max-width:280px">${esc(session.user_agent || '—')}</b></div>
          </div>` : '<div class="form-note">没有有效的登录会话</div>'}
        </div>
      </div>`;
  }

  // ---------------- 用户操作 ----------------
  function userEditModal(detail) {
    const u = detail.user;
    const st = detail.state;
    openModal({
      title: '编辑用户资料',
      sub: '@' + u.username + ' · 修改会立即写入数据库',
      width: 620,
      html: `
        <div class="form-grid">
          <label class="field"><span class="field-label">昵称</span><input class="input" id="euNickname" maxlength="20" value="${esc(u.nickname)}"></label>
          <label class="field"><span class="field-label">陪伴者名字</span><input class="input" id="euCompanion" maxlength="12" value="${esc(u.companion_name)}"></label>
          <label class="field"><span class="field-label">亲密度 0-100</span><input class="input" id="euAffection" type="number" min="0" max="100" value="${esc(st.affection)}"></label>
          <label class="field"><span class="field-label">信任度 0-100</span><input class="input" id="euTrust" type="number" min="0" max="100" value="${esc(st.trust)}"></label>
          <label class="field"><span class="field-label">心情值 -100-100</span><input class="input" id="euValence" type="number" min="-100" max="100" value="${esc(st.mood_valence)}"></label>
          <label class="field"><span class="field-label">生气值 0-100</span><input class="input" id="euAnger" type="number" min="0" max="100" value="${esc(st.anger)}"></label>
          <label class="field"><span class="field-label">难过值 0-100</span><input class="input" id="euSadness" type="number" min="0" max="100" value="${esc(st.sadness)}"></label>
          <label class="field"><span class="field-label">精力 0-100</span><input class="input" id="euEnergy" type="number" min="0" max="100" value="${esc(st.energy)}"></label>
          <label class="field"><span class="field-label">主题</span>
            <select id="euTheme">${['dusk', 'dawn', 'sakura', 'forest'].map((t) => `<option value="${t}" ${u.theme === t ? 'selected' : ''}>${THEME_TEXT[t]}</option>`).join('')}</select></label>
          <label class="field"><span class="field-label">账号状态</span>
            <select id="euStatus">
              <option value="active" ${u.status === 'active' ? 'selected' : ''}>正常</option>
              <option value="banned" ${u.status === 'banned' ? 'selected' : ''}>封禁</option>
            </select></label>
          <label class="field span-2"><span class="field-label">陪伴者人设</span>
            <textarea id="euPersona" maxlength="200" style="min-height:70px">${esc(u.companion_persona)}</textarea></label>
          <label class="field span-2"><span class="field-label">运营备注</span>
            <textarea id="euNote" maxlength="1000" style="min-height:76px" placeholder="仅后台可见">${esc(u.admin_note || '')}</textarea></label>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '保存修改', cls: 'btn-primary', onClick: async (ctx) => {
            setBusy(ctx.button, true, '保存中');
            try {
              await api('adminUpdateUser', {
                user_id: u.id,
                nickname: $('#euNickname').value.trim(),
                companion_name: $('#euCompanion').value.trim(),
                affection: $('#euAffection').value,
                trust: $('#euTrust').value,
                mood_valence: $('#euValence').value,
                anger: $('#euAnger').value,
                sadness: $('#euSadness').value,
                energy: $('#euEnergy').value,
                theme: $('#euTheme').value,
                status: $('#euStatus').value,
                companion_persona: $('#euPersona').value,
                admin_note: $('#euNote').value
              });
              UI.toast('用户资料已更新', 'success');
              closeModal();
              refreshDrawer();
              loadView(state.view);
            } catch (err) {
              UI.toast(err.message || '保存失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  async function handleUnban(userId) {
    const ok = await confirmDialog({ title: '解除封禁', message: '确认解除该用户的封禁？解除后用户可以立即登录。', confirmText: '解除封禁' });
    if (!ok) return;
    try {
      await api('adminUnbanUser', { user_id: userId });
      UI.toast('已解除封禁', 'success');
      if (state.drawer && state.drawer.userId === userId) refreshDrawer();
      loadView(state.view);
    } catch (err) {
      UI.toast(err.message || '操作失败', 'error');
    }
  }

  async function handleResetPassword(userId) {
    const password = await confirmDialog({
      title: '重置密码', message: '重置后该用户所有登录会话会被清除，需要用新密码重新登录。', confirmText: '重置密码',
      requireInput: true, inputLabel: '新密码（至少 6 位）', inputType: 'text', placeholder: '输入新的登录密码'
    });
    if (!password) return;
    if (String(password).length < 6) { UI.toast('新密码至少 6 位', 'error'); return; }
    try {
      await api('adminResetPassword', { user_id: userId, new_password: password });
      UI.toast('密码已重置', 'success');
    } catch (err) {
      UI.toast(err.message || '重置失败', 'error');
    }
  }

  function handleDeleteUser(user) {
    openModal({
      title: '删除用户',
      sub: '@' + user.username + ' · 此操作不可撤销',
      width: 500,
      html: `<div class="notice warn">${UI.icon('alert', 15)}<span>停用会保留全部数据但用户无法登录；彻底删除会同时清除该用户的聊天记录、情绪日志、互动与反馈。</span></div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '停用账号', cls: 'btn-ghost', onClick: async (ctx) => {
            setBusy(ctx.button, true, '处理中');
            try {
              await api('adminDeleteUser', { user_id: user.id, hard: 0 });
              UI.toast('用户已停用', 'success');
              closeModal(); closeDrawer(); loadView(state.view);
            } catch (err) { UI.toast(err.message, 'error'); setBusy(ctx.button, false); }
          }
        },
        {
          label: '彻底删除', cls: 'btn-danger', onClick: async (ctx) => {
            setBusy(ctx.button, true, '删除中');
            try {
              await api('adminDeleteUser', { user_id: user.id, hard: 1 });
              UI.toast('用户及关联数据已删除', 'success');
              closeModal(); closeDrawer(); loadView(state.view);
            } catch (err) { UI.toast(err.message, 'error'); setBusy(ctx.button, false); }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  function careModal(user, onDone) {
    openModal({
      title: '发送人工关怀',
      sub: '发送给 ' + (user.nickname || user.username),
      width: 520,
      html: `<div class="form-grid">
        <label class="field span-2"><span class="field-label">消息内容</span>
          <textarea id="careContent" maxlength="2000" style="min-height:120px" placeholder="以陪伴者身份说一句真诚的话，会直接写入对方的聊天记录。"></textarea></label>
      </div>
      <div class="form-note" style="margin-top:10px">该消息会以系统关怀的形式送达，用户下次轮询或进入前台时即可看到。</div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '发送', cls: 'btn-primary', onClick: async (ctx) => {
            const content = $('#careContent').value.trim();
            if (!content) { UI.toast('消息内容不能为空'); return; }
            setBusy(ctx.button, true, '发送中');
            try {
              await api('adminSendMessage', { user_id: user.id, content: content });
              UI.toast('关怀消息已送达', 'success');
              closeModal();
              if (typeof onDone === 'function') onDone();
              if (state.drawer && state.drawer.userId === user.id) refreshDrawer();
            } catch (err) {
              UI.toast(err.message || '发送失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  // ---------------- 事件 ----------------
  function onContentClick(event) {
    const pageBtn = event.target.closest('[data-act="page"]');
    if (pageBtn) {
      const scope = pageBtn.dataset.scope;
      const page = Number(pageBtn.dataset.page);
      if (!state.filters[scope] || pageBtn.disabled) return;
      state.filters[scope].page = page;
      loadView(scope);
      return;
    }
    const statusBtn = event.target.closest('[data-act="user-status"]');
    if (statusBtn) {
      state.filters.users.status = statusBtn.dataset.status;
      state.filters.users.page = 1;
      loadView('users');
      return;
    }
    const fbStatus = event.target.closest('[data-act="fb-status"]');
    if (fbStatus) {
      state.filters.feedbacks.status = fbStatus.dataset.status;
      state.filters.feedbacks.page = 1;
      loadView('feedbacks');
      return;
    }
    const providerBtn = event.target.closest('[data-act="provider"]');
    if (providerBtn) { applyProvider(providerBtn.dataset.provider); return; }

    const actionEl = event.target.closest('[data-act]');
    if (!actionEl) {
      const jump = event.target.closest('[data-view-jump]');
      if (jump) switchView(jump.dataset.viewJump);
      return;
    }
    const act = actionEl.dataset.act;
    const id = Number(actionEl.dataset.id);

    switch (act) {
      case 'user-open': openDrawer(id); break;
      case 'user-ban': {
        const user = findUser(id);
        if (user) openBanModal(user);
        break;
      }
      case 'user-unban': handleUnban(id); break;
      case 'conv-open': openDrawer(id, 'messages'); break;
      case 'msg-pin': togglePin(id, actionEl.dataset.pinned === '1'); break;
      case 'msg-del': deleteMessage(id); break;
      case 'ann-new': announcementModal(null); break;
      case 'ann-edit': {
        const item = (state.announcements || []).find((a) => a.id === id);
        if (item) announcementModal(item);
        break;
      }
      case 'ann-del': deleteAnnouncement(id); break;
      case 'word-del': deleteWord(id); break;
      case 'fb-reply': feedbackModal(id); break;
      case 'admin-new': adminModal(null); break;
      case 'admin-edit': {
        const item = (state.adminItems || []).find((a) => a.id === id);
        if (item) adminModal(item);
        break;
      }
      case 'admin-del': deleteAdmin(id); break;
      case 'care-send': {
        const user = findUser(id) || { id: id, nickname: actionEl.dataset.name || '', username: '' };
        careModal(user);
        break;
      }
      case 'backup': window.location.href = LumiAPI.downloadUrl('adminBackup', 'admin'); break;
      case 'export-users': window.location.href = LumiAPI.downloadUrl('adminExportUsers', 'admin'); break;
      case 'broadcast': broadcastModal(); break;
      case 'sysinfo': loadSystemInfo(); break;
      case 'clear-key': clearModelKey(); break;
      default: break;
    }
  }

  function findUser(id) {
    if (state.drawer && state.drawer.detail && state.drawer.detail.user.id === id) return state.drawer.detail.user;
    const lastStats = state.lastUsers || [];
    return lastStats.find((u) => u.id === id) || null;
  }

  async function togglePin(messageId, pinned) {
    try {
      await api('adminPinMessage', { message_id: messageId, pinned: pinned ? 1 : 0 });
      UI.toast(pinned ? '已设为精选回忆' : '已取消精选', 'success');
      loadView(state.view);
      if (state.drawer) refreshDrawer();
    } catch (err) {
      UI.toast(err.message || '操作失败', 'error');
    }
  }

  async function deleteMessage(messageId) {
    const ok = await confirmDialog({ title: '删除消息', message: '删除后这条消息会从用户聊天记录中移除，且不可恢复。', confirmText: '删除', danger: true });
    if (!ok) return;
    try {
      await api('adminDeleteMessage', { message_id: messageId });
      UI.toast('消息已删除', 'success');
      loadView(state.view);
      if (state.drawer) refreshDrawer();
    } catch (err) {
      UI.toast(err.message || '删除失败', 'error');
    }
  }

  async function deleteAnnouncement(id) {
    const ok = await confirmDialog({ title: '删除公告', message: '删除后前台将不再展示这条公告。', confirmText: '删除', danger: true });
    if (!ok) return;
    try {
      await api('adminAnnouncementDelete', { id: id });
      UI.toast('公告已删除', 'success');
      loadView('announcements');
    } catch (err) {
      UI.toast(err.message || '删除失败', 'error');
    }
  }

  async function deleteWord(id) {
    try {
      await api('adminWordDelete', { id: id });
      UI.toast('规则已删除', 'success');
      loadView('words');
    } catch (err) {
      UI.toast(err.message || '删除失败', 'error');
    }
  }

  async function deleteAdmin(id) {
    const ok = await confirmDialog({ title: '删除管理员', message: '删除后该账号会立即失去后台访问权限，操作会写入审计日志。', confirmText: '删除', danger: true });
    if (!ok) return;
    try {
      await api('adminAdminDelete', { id: id });
      UI.toast('管理员已删除', 'success');
      loadView('admins');
    } catch (err) {
      UI.toast(err.message || '删除失败', 'error');
    }
  }

  async function clearModelKey() {
    const ok = await confirmDialog({ title: '清除模型 Key', message: '清除后模型调用会暂停，前端将使用本地规则回复，直到重新配置 Key。', confirmText: '清除 Key', danger: true });
    if (!ok) return;
    const payload = modelPayload();
    payload.model_key = '';
    payload.clear_key = 1;
    try {
      await api('adminModelSave', payload);
      UI.toast('模型 Key 已清除', 'success');
      renderModel(viewBox('model'));
    } catch (err) {
      UI.toast(err.message || '操作失败', 'error');
    }
  }

  function broadcastModal() {
    openModal({
      title: '全站关怀消息',
      sub: '发送给所有状态正常的用户',
      width: 540,
      html: `<div class="notice warn">${UI.icon('megaphone', 15)}<span>这条消息会以陪伴者的身份写入每位用户的聊天记录，请谨慎使用，避免打扰。</span></div>
        <div class="form-grid" style="margin-top:16px">
          <label class="field span-2"><span class="field-label">消息内容</span>
            <textarea id="broadcastContent" maxlength="2000" style="min-height:120px" placeholder="例如：今晚降温了，记得早点睡。">${esc('')}</textarea></label>
        </div>`,
      buttons: [
        { label: '取消', cls: 'btn-ghost' },
        {
          label: '发送给全站', cls: 'btn-primary', onClick: async (ctx) => {
            const content = $('#broadcastContent').value.trim();
            if (!content) { UI.toast('消息内容不能为空'); return; }
            const ok = await confirmDialog({ title: '再次确认', message: '确认将这条消息发送给所有正常用户？', confirmText: '确认发送', danger: true });
            if (!ok) return;
            setBusy(ctx.button, true, '发送中');
            try {
              const res = await api('adminBroadcast', { content: content });
              UI.toast('关怀消息已送达 ' + res.count + ' 位用户', 'success');
              closeModal();
            } catch (err) {
              UI.toast(err.message || '发送失败', 'error');
              setBusy(ctx.button, false);
            }
          }
        }
      ]
    });
    mountIcons($('#adminModal'));
  }

  function onContentInput(event) {
    const target = event.target.closest('[data-filter]');
    if (!target) return;
    if (target.tagName === 'SELECT' || target.type === 'date') return;
    const parts = target.dataset.filter.split(':');
    const scope = parts[0];
    const key = parts[1];
    if (!state.filters[scope]) return;
    state.filters[scope][key] = target.value;
    state.filters[scope].page = 1;
    debouncedReload(scope);
  }

  function onContentChange(event) {
    const target = event.target.closest('[data-filter]');
    if (!target) return;
    const parts = target.dataset.filter.split(':');
    const scope = parts[0];
    const key = parts[1];
    if (!state.filters[scope]) return;
    state.filters[scope][key] = target.value;
    state.filters[scope].page = 1;
    loadView(scope);
  }

  const debouncedReload = UI.debounce((scope) => loadView(scope), 420);

  function onDrawerClick(event) {
    const tab = event.target.closest('[data-drawer-tab]');
    if (tab) {
      state.drawer.tab = tab.dataset.drawerTab;
      renderDrawer();
      return;
    }
    const inner = event.target.closest('[data-act]');
    if (inner && state.drawer) {
      const innerAct = inner.dataset.act;
      if (innerAct === 'msg-pin') { togglePin(Number(inner.dataset.id), inner.dataset.pinned === '1'); return; }
      if (innerAct === 'msg-del') { deleteMessage(Number(inner.dataset.id)); return; }
    }
    const actionEl = event.target.closest('[data-drawer-act]');
    if (!actionEl) return;
    const act = actionEl.dataset.drawerAct;
    const detail = state.drawer && state.drawer.detail;
    if (!detail) return;
    if (act === 'refresh') refreshDrawer();
    else if (act === 'edit') userEditModal(detail);
    else if (act === 'care') careModal(detail.user);
    else if (act === 'reset') handleResetPassword(detail.user.id);
    else if (act === 'ban') openBanModal(detail.user);
    else if (act === 'unban') handleUnban(detail.user.id);
    else if (act === 'delete') handleDeleteUser(detail.user);
    else if (act === 'send') sendDrawerMessage();
  }

  async function sendDrawerMessage() {
    const input = $('#drawerComposer');
    if (!input) return;
    const content = input.value.trim();
    if (!content) { UI.toast('消息内容不能为空'); return; }
    const button = $('[data-drawer-act="send"]');
    setBusy(button, true, '发送中');
    try {
      await api('adminSendMessage', { user_id: state.drawer.userId, content: content });
      UI.toast('关怀消息已送达', 'success');
      input.value = '';
      refreshDrawer();
    } catch (err) {
      UI.toast(err.message || '发送失败', 'error');
      setBusy(button, false);
    }
  }

  // ---------------- 初始化 ----------------
  function bindUI() {
    mountIcons();
    $('#adminLoginForm').addEventListener('submit', doAdminLogin);
    $$('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = UI.icon(show ? 'eyeOff' : 'eye', 18);
      });
    });

    $('#sideNav').addEventListener('click', (event) => {
      const item = event.target.closest('.nav-item');
      if (item && !item.hidden) switchView(item.dataset.view);
    });

    $('#sideCollapse').addEventListener('click', () => {
      $('#adminSide').classList.toggle('collapsed');
      $('#adminShell').classList.toggle('collapsed');
    });

    $('#adminContent').addEventListener('click', onContentClick);
    $('#adminContent').addEventListener('input', onContentInput);
    $('#adminContent').addEventListener('change', onContentChange);
    $('#adminContent').addEventListener('click', (event) => {
      const sw = event.target.closest('.switch');
      if (sw) sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
    });

    $('#btnRefresh').addEventListener('click', () => {
      UI.toast('正在刷新');
      loadView(state.view, true);
      refreshBadges();
    });

    $('#adminLogout').addEventListener('click', async () => {
      const ok = await confirmDialog({ title: '退出后台', message: '确认退出当前管理员账号？', confirmText: '退出' });
      if (!ok) return;
      try { await api('adminLogout'); } catch (err) { /* 忽略 */ }
      LumiAPI.setToken('admin', '');
      state.admin = null;
      state.stats = null;
      showLogin('已安全退出');
      setLoginState('online', '服务正常 · 数据库已连接');
    });

    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#drawerMask').addEventListener('click', closeDrawer);
    $('#adminDrawer').addEventListener('click', onDrawerClick);

    $('#modalClose').addEventListener('click', closeModal);
    $('#adminModal').addEventListener('click', (event) => {
      if (event.target === $('#adminModal')) closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = $('#adminModal');
      if (modal.classList.contains('open')) { closeModal(); return; }
      if ($('#adminDrawer').classList.contains('open')) closeDrawer();
    });

    window.addEventListener('hashchange', () => {
      const name = (location.hash || '').replace('#', '');
      if (PAGE_META[name] && name !== state.view) switchView(name);
    });

    window.addEventListener('lumi:auth-expired', (event) => {
      if (!event.detail || event.detail.kind !== 'admin') return;
      LumiAPI.setToken('admin', '');
      state.admin = null;
      showLogin(event.detail.message || '登录状态已过期，请重新登录');
    });

    $('#topMenu').addEventListener('click', openSideMobile);
    $('#sideMask').addEventListener('click', closeSideMobile);
    $('#sideNav').addEventListener('click', () => {
      if (window.innerWidth <= 1180) closeSideMobile();
    });
  }

  function openSideMobile() {
    $('#adminSide').classList.add('mobile-open');
    $('#sideMask').classList.add('open');
  }

  function closeSideMobile() {
    $('#adminSide').classList.remove('mobile-open');
    $('#sideMask').classList.remove('open');
  }

  async function boot() {
    bindUI();
    checkServer();
    UI.applyTheme(localStorage.getItem('xinyu.theme') || 'dusk');
    const token = LumiAPI.getToken('admin');
    if (!token) { showLogin(); return; }
    try {
      const me = await api('adminMe');
      state.admin = me.admin;
      bootConsole();
    } catch (err) {
      LumiAPI.setToken('admin', '');
      showLogin(err.code === 401 ? '登录状态已过期，请重新登录' : (err.message || '无法连接后台'));
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
