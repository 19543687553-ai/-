/**
 * 心屿前端 API 与通用 UI 工具
 */
(function () {
  'use strict';

  const CONFIG = window.LUMI_CONFIG || { apiBase: '/PHP/api.php', apiCandidates: ['/PHP/api.php'] };
  const PREFIX = CONFIG.storagePrefix || 'xinyu.';
  const TOKEN_KEY = PREFIX + 'token';
  const ADMIN_TOKEN_KEY = PREFIX + 'admin.token';
  const THEME_KEY = PREFIX + 'theme';
  const ACCENT_KEY = PREFIX + 'accent';
  const API_KEY = PREFIX + 'apiBase';

  class ApiError extends Error {
    constructor(message, code, data) {
      super(message || '请求失败');
      this.name = 'ApiError';
      this.code = code || 0;
      this.data = data || null;
    }
  }

  function getToken(kind) {
    return localStorage.getItem(kind === 'admin' ? ADMIN_TOKEN_KEY : TOKEN_KEY) || '';
  }

  function setToken(kind, token) {
    if (token) localStorage.setItem(kind === 'admin' ? ADMIN_TOKEN_KEY : TOKEN_KEY, token);
    else localStorage.removeItem(kind === 'admin' ? ADMIN_TOKEN_KEY : TOKEN_KEY);
  }

  let apiBase = localStorage.getItem(API_KEY) || CONFIG.apiBase;
  let initPromise = null;

  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout || 15000);
    try {
      return await fetch(url, Object.assign({}, options, { signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const candidates = Array.from(new Set([apiBase].concat(CONFIG.apiCandidates || []).filter(Boolean)));
      for (const candidate of candidates) {
        try {
          const res = await fetchWithTimeout(candidate.replace(/\?.*$/, '') + '?action=health', { method: 'GET' }, 5000);
          const json = await res.json();
          if (json && json.code === 200 && json.data && json.data.db) {
            apiBase = candidate;
            localStorage.setItem(API_KEY, apiBase);
            return apiBase;
          }
        } catch (err) {
          // 继续尝试下一个地址
        }
      }
      return apiBase;
    })();
    return initPromise;
  }

  async function request(action, payload, options) {
    options = options || {};
    await init();
    const kind = options.auth === 'admin' ? 'admin' : 'user';
    const token = options.auth === 'none' ? '' : getToken(kind);
    const url = apiBase + '?action=' + encodeURIComponent(action);
    let res;
    try {
      res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}
        ),
        body: JSON.stringify(payload || {})
      }, options.timeout || 55000);
    } catch (err) {
      throw new ApiError(err.name === 'AbortError' ? '回应得有点慢，再试一次好吗' : '网络连接失败，请检查后端是否在线', 0);
    }
    let json;
    try {
      json = await res.json();
    } catch (err) {
      throw new ApiError('后端返回了无法识别的内容', res.status);
    }
    if (json.code !== 200) {
      if (json.code === 401) {
        window.dispatchEvent(new CustomEvent('lumi:auth-expired', { detail: { kind: kind, message: json.msg } }));
      }
      if (json.code === 403 && json.data && json.data.ban) {
        window.dispatchEvent(new CustomEvent('lumi:ban', { detail: { ban: json.data.ban, source: kind } }));
      }
      if (json.code === 503 && json.data && json.data.maintenance) {
        window.dispatchEvent(new CustomEvent('lumi:maintenance', { detail: json.data.maintenance }));
      }
      throw new ApiError(json.msg || '请求失败', json.code, json.data);
    }
    return json.data;
  }

  function downloadUrl(action, kind) {
    const token = getToken(kind || 'admin');
    return apiBase + '?action=' + encodeURIComponent(action) + '&token=' + encodeURIComponent(token);
  }

  function raiseApiError(json, status) {
    const message = (json && json.msg) || '请求失败';
    const code = (json && json.code) || status || 0;
    const data = json && json.data;
    if (code === 401) {
      window.dispatchEvent(new CustomEvent('lumi:auth-expired', { detail: { kind: 'user', message: message } }));
    }
    if (code === 403 && data && data.ban) {
      window.dispatchEvent(new CustomEvent('lumi:ban', { detail: { ban: data.ban, source: 'user' } }));
    }
    if (code === 503 && data && data.maintenance) {
      window.dispatchEvent(new CustomEvent('lumi:maintenance', { detail: data.maintenance }));
    }
    throw new ApiError(message, code, data);
  }

  /**
   * 流式请求：服务端返回 text/event-stream 时逐条回调；
   * 若服务端退回普通 JSON，则返回 { fallback: data } 交给调用方按旧逻辑处理。
   */
  async function stream(action, payload, onEvent, options) {
    options = options || {};
    await init();
    const token = options.auth === 'none' ? '' : getToken('user');
    const url = apiBase + '?action=' + encodeURIComponent(action);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: Object.assign(
          { 'Content-Type': 'application/json', 'Accept': 'text/event-stream, application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}
        ),
        body: JSON.stringify(payload || {})
      });
    } catch (err) {
      throw new ApiError('网络连接失败，请检查后端是否在线', 0);
    }
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type.indexOf('text/event-stream') === -1) {
      let json = null;
      try {
        json = await res.json();
      } catch (err) {
        throw new ApiError('后端返回了无法识别的内容', res.status);
      }
      if (!json || json.code !== 200) raiseApiError(json, res.status);
      return { fallback: json.data };
    }
    if (!res.body || typeof res.body.getReader !== 'function') {
      throw new ApiError('当前浏览器不支持流式回复', 0);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let doneEvent = null;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          block.split('\n').forEach((line) => {
            if (line.indexOf('data:') !== 0) return;
            const raw = line.slice(5).trim();
            if (!raw) return;
            let evt;
            try {
              evt = JSON.parse(raw);
            } catch (err) {
              return;
            }
            if (evt.type === 'error') throw new ApiError(evt.msg || '回应中断了，再试一次好吗', 500);
            if (evt.type === 'done') {
              doneEvent = evt;
              return;
            }
            if (typeof onEvent === 'function') onEvent(evt);
          });
        }
      }
    } catch (err) {
      try { reader.cancel(); } catch (e) {}
      if (err instanceof ApiError) {
        if (err.code === 401) window.dispatchEvent(new CustomEvent('lumi:auth-expired', { detail: { kind: 'user', message: err.message } }));
        if (err.code === 403 && err.data && err.data.ban) window.dispatchEvent(new CustomEvent('lumi:ban', { detail: { ban: err.data.ban, source: 'user' } }));
      }
      throw err;
    }
    if (!doneEvent) throw new ApiError('回复没有完整送达，再试一次好吗', 0);
    return { done: doneEvent };
  }

  // ---------------- 图标 ----------------
  const ICONS = {
    logo: '<path d="M12 3.2c3.7 0 6.7 2.8 6.7 6.3 0 4.2-3.7 7.2-6.7 10.2-3-3-6.7-6-6.7-10.2 0-3.5 3-6.3 6.7-6.3Z" fill="currentColor" opacity=".92"/><path d="M8.9 9.5c.5-1.4 1.7-2.4 3.1-2.4 1.7 0 3.1 1.3 3.1 2.9 0 1.6-1.4 2.9-3.1 2.9" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".55"/><circle cx="17.7" cy="6.1" r="1.4" fill="currentColor" opacity=".7"/>',
    chat: '<path d="M20.5 11.3a7.9 7.9 0 0 1-8.2 7.8 8.8 8.8 0 0 1-3.3-.6L4.3 20l1.5-4.2a7.5 7.5 0 0 1-1.1-4A7.9 7.9 0 0 1 12.2 4a7.8 7.8 0 0 1 8.3 7.3Z"/>',
    activity: '<path d="M3 12h4l2.2-5.2 4 10.5 2.3-5.3H21"/>',
    bookmark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.7L6 21V4.5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.7 13.3A8.7 8.7 0 1 1 10.7 3a7 7 0 0 0 10 10.3Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    bot: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M12 3v4"/><circle cx="8.5" cy="13" r="1"/><circle cx="15.5" cy="13" r="1"/><path d="M9 17h6"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5"/><path d="M12 3v12"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.7A3 3 0 0 0 13.3 13.4"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.9"/><path d="M6.6 6.7A18.5 18.5 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.1-.9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/>',
    sparkles: '<path d="m12 3 1.3 3.9L17 8l-3.7 1.2L12 13l-1.3-3.8L7 8l3.7-1.1L12 3Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/><path d="m5 14 .6 1.7 1.7.6-1.7.6L5 19l-.6-1.7-1.7-.6 1.7-.6L5 14Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    pulse: '<path d="M3 12h3l2-5 3.4 10 2.6-6 1.7 3H21"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V13"/><path d="M17 10.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.4l-3-4.8a1.6 1.6 0 0 1 2.7-1.7L8 15"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.8-4M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.8 4M20 20v-5h-5"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="18" r=".8" fill="currentColor" stroke="none"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 12H5L3 7Z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    frown: '<circle cx="12" cy="12" r="9"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01M15 9h.01"/>',
    angry: '<circle cx="12" cy="12" r="9"/><path d="M8 15s1.5-1.5 4-1.5 4 1.5 4 1.5"/><path d="m8 8 3 2M16 8l-3 2"/>',
    sleepy: '<path d="M21 16.5A8.5 8.5 0 1 1 7.5 3 7 7 0 0 0 21 16.5Z"/><path d="M16 17h4M17.5 14h3"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    pin: '<path d="M12 17v5"/><path d="M5 9.5 9 5h6l4 4.5-4.5 2.2V15h-5v-3.3L5 9.5Z"/>',
    quote: '<path d="M9 11H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6c0 4-2 6-5 6"/><path d="M21 11h-5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6c0 4-2 6-5 6"/>',
    flower: '<circle cx="12" cy="9" r="3"/><path d="M12 6c0-2 1-4 3-4s3 2 3 4-1 3-3 3M12 6C12 4 11 2 9 2S6 4 6 6s1 3 3 3M12 12c0 2 1 3 3 3s3-1 3-3-1-4-3-4M12 12c0 2-1 3-3 3s-3-1-3-3 1-4 3-4"/><path d="M12 15v6"/>',
    tea: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2"/><path d="M7 3v2M11 3v2"/>',
    kiss: '<path d="M3 12c3-3 6-4 9-4s6 1 9 4c-3 3-6 4-9 4s-6-1-9-4Z"/><path d="M7 13.6c2.6-1.5 7.4-1.5 10 0"/>',
    paw: '<circle cx="6.5" cy="10" r="2"/><circle cx="10" cy="6.5" r="2"/><circle cx="14" cy="6.5" r="2"/><circle cx="17.5" cy="10" r="2"/><path d="M12 21c-3.5 0-6-2-6-4.4 0-2.4 2-4.1 3.5-4.1 1 0 1.6.4 2.5 1 .9-.6 1.5-1 2.5-1 1.5 0 3.5 1.7 3.5 4.1C18 19 15.5 21 12 21Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    banUser: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 12.2-4.7"/><path d="m16 19 5-5"/><path d="m16 14 5 5"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h5a4 4 0 0 0 4-4V7"/>',
    volume: '<path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6"/><path d="M17.8 6.6a7.5 7.5 0 0 1 0 10.8"/>'
  };

  function icon(name, size, cls) {
    const path = ICONS[name] || ICONS.sparkles;
    return '<svg class="icon ' + (cls || '') + '" width="' + (size || 18) + '" height="' + (size || 18) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }

  // ---------------- 主题 ----------------
  const THEMES = {
    dusk: { name: '暮色', sub: '傍晚最后一盏灯', accent: '#ffaf9b' },
    dawn: { name: '晨雾', sub: '刚醒来的房间', accent: '#e88566' },
    sakura: { name: '樱夜', sub: '没说完的梦', accent: '#ffb3c7' },
    forest: { name: '森语', sub: '雨后森林的呼吸', accent: '#a9d8ba' },
    midnight: { name: '星夜', sub: '把心事放得很轻', accent: '#8fb8ff' },
    ocean: { name: '潮汐', sub: '海面下的一点安静', accent: '#7fd8c8' },
    cream: { name: '奶油', sub: '被阳光晒暖的午后', accent: '#d99a6c' }
  };

  function applyTheme(name, accent) {
    if (!THEMES[name]) name = 'dusk';
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem(THEME_KEY, name);
    if (accent && /^#[0-9a-fA-F]{6}$/.test(accent)) {
      document.documentElement.style.setProperty('--accent', accent);
      localStorage.setItem(ACCENT_KEY, accent);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const map = { dusk: '#100d16', dawn: '#f4eee8', sakura: '#1a0f16', forest: '#0b1512', midnight: '#0a1020', ocean: '#061318', cream: '#fbf4e6' };
      meta.setAttribute('content', map[name] || '#100d16');
    }
    window.dispatchEvent(new CustomEvent('lumi:theme', { detail: { theme: name, accent: accent } }));
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem(THEME_KEY) || 'dusk';
  }

  // ---------------- 通用 UI ----------------
  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function formatTime(ts, withSeconds) {
    if (!ts) return '';
    const d = new Date(Number(ts) * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + (withSeconds ? ':' + pad(d.getSeconds()) : '');
  }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(Number(ts) * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatDateTime(ts, withSeconds) {
    if (!ts) return '';
    return formatDate(ts) + ' ' + formatTime(ts, withSeconds !== false);
  }

  function relativeTime(ts) {
    if (!ts) return '还没来过';
    const diff = Math.floor(Date.now() / 1000) - Number(ts);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return formatDate(ts);
  }

  function dayLabel(ts) {
    const d = new Date(Number(ts) * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const then = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((today - then) / 86400000);
    if (diff <= 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff < 7) return diff + ' 天前';
    return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  let toastTimer = null;
  function toast(message, type) {
    let el = document.getElementById('globalToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalToast';
      el.className = 'global-toast';
      document.body.appendChild(el);
    }
    clearTimeout(toastTimer);
    el.className = 'global-toast show ' + (type || '');
    el.innerHTML = '<span class="toast-dot"></span><span>' + escapeHTML(message) + '</span>';
    toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3200);
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait || 300);
    };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // 轻量音效：由用户主动操作后才会初始化，不依赖音频文件
  let audioContext = null;
  function chime(kind) {
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      const base = kind === 'sent' ? 540 : 660;
      osc.frequency.setValueAtTime(base, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base + 120, audioContext.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.55);
    } catch (err) {}
  }

  window.LumiAPI = {
    request: request,
    stream: stream,
    init: init,
    getToken: getToken,
    setToken: setToken,
    downloadUrl: downloadUrl,
    getBase: () => apiBase,
    ApiError: ApiError,
    TOKEN_KEY: TOKEN_KEY,
    ADMIN_TOKEN_KEY: ADMIN_TOKEN_KEY
  };

  window.UI = {
    icon: icon,
    THEMES: THEMES,
    applyTheme: applyTheme,
    currentTheme: currentTheme,
    escapeHTML: escapeHTML,
    formatTime: formatTime,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    relativeTime: relativeTime,
    dayLabel: dayLabel,
    toast: toast,
    debounce: debounce,
    clamp: clamp,
    chime: chime,
    cssVar: cssVar
  };
})();
