/**
 * 心屿 · 陪伴主界面
 */
(function () {
  'use strict';

  const PREFIX = (window.LUMI_CONFIG && window.LUMI_CONFIG.storagePrefix) || 'xinyu.';
  const AVATAR = 'assets/companion.jpg';
  const THEME_ORDER = ['dusk', 'dawn', 'sakura', 'forest', 'midnight', 'ocean', 'cream'];
  const GESTURE_ICON = { hug: 'heart', headpat: 'hand', flower: 'flower', hand: 'hand', warm: 'layers', kiss: 'kiss', tea: 'tea', sing: 'volume', star: 'sparkles' };
  const GESTURE_NAME = { hug: '拥抱', headpat: '摸摸头', flower: '送花', hand: '牵手', warm: '披外套', kiss: '亲亲', tea: '递热茶', sing: '唱歌', star: '看星星' };
  const INTERACTION_NAME = { hug: '拥抱', headpat: '摸摸头', flower: '送花', hand: '牵手', warm: '披外套', kiss: '亲亲', tea: '递热茶', sing: '唱歌', star: '看星星' };
  const PERSONA_CATEGORIES = ['全部', '温柔', '活泼', '沉稳', '理性', '文艺'];

  const MOOD = {
    '开心': { icon: 'smile', a: '#ffd27d', b: '#ffb37a', desc: '眼睛弯弯的，连语气都轻快了一点。' },
    '温柔': { icon: 'heart', a: '#ffaf9b', b: '#f5c6d6', desc: '她把声音放得很轻，怕惊到你的心事。' },
    '平静': { icon: 'tea', a: '#8de0d1', b: '#a9c7e8', desc: '像坐在窗边，各做各的事，也不觉得冷清。' },
    '依恋': { icon: 'heart', a: '#ff9fae', b: '#c3abff', desc: '她比平时更黏人一点，想离你近一些。' },
    '闹别扭': { icon: 'angry', a: '#f2c77d', b: '#ff9d8f', desc: '嘴上说着没事，其实在等你多问一句。' },
    '生气': { icon: 'angry', a: '#ff7f92', b: '#ff9f7a', desc: '她现在有点生气，需要你先靠近，而不是讲道理。' },
    '难过': { icon: 'frown', a: '#8fa8d8', b: '#a9b8e8', desc: '情绪有点重，她更想被抱住，而不是被劝好。' },
    '低落': { icon: 'frown', a: '#9fb4c8', b: '#b7a8d8', desc: '话变少了，但还在认真听你说。' },
    '困倦': { icon: 'sleepy', a: '#b8a8d8', b: '#9fb4c8', desc: '她有点累了，反应会慢半拍，别怪她。' }
  };

  const state = {
    user: null,
    mood: null,
    messages: [],
    conversationId: 0,
    hasMore: false,
    announcement: null,
    insights: null,
    insightsLoaded: false,
    sending: false,
    gestureBusy: false,
    degradedNotified: false,
    typingTimer: null,
    pollTimer: null,
    banTimer: null,
    maintenanceTimer: null,
    maintenance: null,
    view: 'chat',
    currentTheme: 'dusk',
    personas: [],
    personaFilter: '全部',
    checkin: null,
    checkinMoods: [],
    checkinPick: '',
    journal: null,
    journalToday: null,
    thinkingTimer: null,
    searchTimer: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  document.addEventListener('DOMContentLoaded', init);

  /* =========================================================
     启动
     ========================================================= */
  async function init() {
    mountIcons();
    applyLocalStyle();
    bindUI();
    buildThemeGrid();

    if (!LumiAPI.getToken('user')) {
      location.replace('index.html');
      return;
    }

    state.currentTheme = localStorage.getItem(PREFIX + 'theme') || 'dusk';
    UI.applyTheme(state.currentTheme, localStorage.getItem(PREFIX + 'accent') || '');
    syncThemeUI();

    try {
      const data = await LumiAPI.request('me');
      applyMe(data);
      await loadHistory();
      startPolling();
      loadInsights();
      fillFeedbackHistory();
    } catch (err) {
      handleFatal(err);
    }
  }

  function handleFatal(err) {
    if (err && err.code === 401) {
      LumiAPI.setToken('user', '');
      location.replace('index.html');
      return;
    }
    if (err && err.code === 403 && err.data && err.data.ban) {
      showBan(err.data.ban);
      return;
    }
    if (err && err.code === 503 && err.data && err.data.maintenance) {
      showMaintenance(err.data.maintenance);
      return;
    }
    $('#personSub').textContent = '暂时连不上心屿，稍后再试试';
    UI.toast(err && err.message ? err.message : '网络连接失败', 'error');
    $('#msgInput').disabled = true;
    $('#sendBtn').disabled = true;
  }

  async function applyMe(data) {
    state.user = data.user || state.user;
    state.announcement = data.announcement || null;
    state.personas = Array.isArray(data.personas) ? data.personas : [];
    state.checkinMoods = Array.isArray(data.checkin_moods) ? data.checkin_moods : [];
    state.checkin = data.checkin || null;
    state.journalToday = data.journal_today || null;
    $('#companionName').textContent = state.user.companion_name || '小屿';
    document.title = '心屿 · ' + (state.user.companion_name || '小屿') + '在等你';
    buildPersonaFilters();
    buildPersonaGrid();
    renderPersona();
    renderCheckin();
    if (state.user.theme && THEME_ORDER.indexOf(state.user.theme) >= 0) {
      state.currentTheme = state.user.theme;
      UI.applyTheme(state.currentTheme, '');
      syncThemeUI();
    }
    applyUserStyle();
    if (data.state) setMood(data.state);
    updateAnnouncement();
    fillSettings();
    if (data.model_configured === false) {
      setTimeout(() => UI.toast('后台还没有配置模型，先用离线陪伴模式陪你', 'warn'), 1600);
    }
  }

  /* =========================================================
     图标
     ========================================================= */
  function mountIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconMounted === '1') return;
      el.innerHTML = UI.icon(el.dataset.icon, Number(el.dataset.size) || 18);
      el.dataset.iconMounted = '1';
    });
  }

  /* =========================================================
     主题与外观
     ========================================================= */
  function applyLocalStyle() {
    const theme = localStorage.getItem(PREFIX + 'theme') || 'dusk';
    const accent = localStorage.getItem(PREFIX + 'accent') || '';
    UI.applyTheme(theme, accent);
    state.currentTheme = theme;
    document.body.dataset.bubble = localStorage.getItem(PREFIX + 'bubble') || 'soft';
    const size = Number(localStorage.getItem(PREFIX + 'fontSize')) || 15;
    document.body.style.setProperty('--chat-size', size + 'px');
    if (localStorage.getItem(PREFIX + 'reduceMotion') === '1') document.body.classList.add('reduce-motion');
  }

  function applyUserStyle() {
    const u = state.user;
    if (!u) return;
    const prefs = u.preferences || {};
    if (u.bubble_style) {
      document.body.dataset.bubble = u.bubble_style;
      localStorage.setItem(PREFIX + 'bubble', u.bubble_style);
    }
    const size = Number(u.font_size) || 15;
    document.body.style.setProperty('--chat-size', size + 'px');
    localStorage.setItem(PREFIX + 'fontSize', String(size));
    document.body.classList.toggle('reduce-motion', !!prefs.reduce_motion);
    localStorage.setItem(PREFIX + 'reduceMotion', prefs.reduce_motion ? '1' : '0');
  }

  function nextTheme() {
    const index = THEME_ORDER.indexOf(state.currentTheme);
    const name = THEME_ORDER[(index + 1) % THEME_ORDER.length];
    chooseTheme(name);
    UI.toast('换成了「' + UI.THEMES[name].name + '」氛围');
  }

  function chooseTheme(name) {
    state.currentTheme = name;
    document.documentElement.style.removeProperty('--accent');
    UI.applyTheme(name, '');
    localStorage.setItem(PREFIX + 'theme', name);
    localStorage.removeItem(PREFIX + 'accent');
    syncThemeUI();
    if (state.user && state.user.theme !== name) {
      state.user.theme = name;
      LumiAPI.request('updateProfile', { theme: name, accent: UI.THEMES[name].accent })
        .then((data) => { if (data.user) state.user = data.user; })
        .catch(() => {});
    }
  }

  function syncThemeUI() {
    $$('.theme-option').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.themeChoice === state.currentTheme ? 'true' : 'false');
    });
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    $$('.accent-dot').forEach((dot) => {
      dot.setAttribute('aria-pressed', dot.dataset.accent.toLowerCase() === accent.toLowerCase() ? 'true' : 'false');
    });
    const bubble = document.body.dataset.bubble || 'soft';
    $$('#bubbleStyle button').forEach((b) => b.classList.toggle('active', b.dataset.value === bubble));
    const size = parseInt(getComputedStyle(document.body).getPropertyValue('--chat-size'), 10) || 15;
    const label = $('#fontSizeValue');
    if (label) label.textContent = size;
    let toggleIcon = $('#btnTheme [data-icon]');
    if (toggleIcon) toggleIcon.innerHTML = UI.icon(state.currentTheme === 'dawn' ? 'moon' : 'sun', 18);
  }

  function buildThemeGrid() {
    const box = $('#settingThemes');
    if (!box || box.dataset.built === '1') return;
    box.dataset.built = '1';
    box.innerHTML = Object.keys(UI.THEMES).map((key) => {
      const t = UI.THEMES[key];
      return '<button class="theme-option" data-theme-choice="' + key + '" aria-pressed="false" type="button">' +
        '<span class="theme-preview"></span>' +
        '<strong>' + UI.escapeHTML(t.name) + '<small>' + UI.escapeHTML(t.sub) + '</small></strong>' +
        '</button>';
    }).join('');
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme-choice]');
      if (btn) chooseTheme(btn.dataset.themeChoice);
    });
  }

  /* =========================================================
     人格
     ========================================================= */
  function buildPersonaFilters() {
    const box = $('#personaFilters');
    if (!box) return;
    if (box.dataset.built !== '1') {
      box.dataset.built = '1';
      box.innerHTML = PERSONA_CATEGORIES.map((cat) =>
        '<button class="persona-filter" type="button" data-cat="' + UI.escapeHTML(cat) + '" aria-pressed="' + (cat === state.personaFilter ? 'true' : 'false') + '">' +
          UI.escapeHTML(cat) +
        '</button>'
      ).join('');
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-cat]');
        if (!btn) return;
        state.personaFilter = btn.dataset.cat;
        $$('.persona-filter').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === state.personaFilter ? 'true' : 'false'));
        renderPersonaCards();
      });
    }
    $$('.persona-filter').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cat === state.personaFilter ? 'true' : 'false'));
  }

  function personaCardHTML(p) {
    return '<button class="persona-card" type="button" data-persona="' + UI.escapeHTML(p.id) + '" aria-pressed="false" style="--p-accent:' + (p.accent || 'var(--accent)') + '">' +
      '<span class="persona-icon">' + UI.icon(p.icon, 18) + '</span>' +
      '<strong>' + UI.escapeHTML(p.name) + '</strong>' +
      '<small>' + UI.escapeHTML(p.tagline) + '</small>' +
      '<em>' + UI.escapeHTML(p.desc) + '</em>' +
    '</button>';
  }

  function buildPersonaGrid() {
    const box = $('#personaGrid');
    if (!box || !state.personas.length) return;
    if (box.dataset.built !== '1') {
      box.dataset.built = '1';
      box.addEventListener('click', (e) => {
        const card = e.target.closest('[data-persona]');
        if (card) choosePersona(card.dataset.persona);
      });
    }
    renderPersonaCards();
  }

  function renderPersonaCards() {
    const box = $('#personaGrid');
    if (!box) return;
    const list = state.personas.filter((p) => state.personaFilter === '全部' || (p.category || '温柔') === state.personaFilter);
    box.innerHTML = list.map(personaCardHTML).join('');
    renderPersona();
  }

  function currentPersona() {
    const id = (state.user && state.user.persona_id) || 'gentle';
    return state.personas.find((p) => p.id === id) || null;
  }

  function renderPersona() {
    const p = currentPersona();
    $$('.persona-card').forEach((card) => {
      card.setAttribute('aria-pressed', p && card.dataset.persona === p.id ? 'true' : 'false');
    });
    const chip = $('#personaChip');
    if (chip) {
      if (p) {
        chip.hidden = false;
        chip.innerHTML = UI.icon(p.icon, 13) + '<span>' + UI.escapeHTML(p.name) + '</span>';
      } else {
        chip.hidden = true;
      }
    }
    const note = $('#personaNote');
    if (note) {
      note.textContent = p
        ? '当前人格：' + p.name + ' · ' + p.tagline + '。她大概会这样开口：' + p.greeting + ' 下方描述可以再微调。'
        : '也可以直接写下你希望的性格底色。';
    }
  }

  function choosePersona(id) {
    const p = state.personas.find((x) => x.id === id);
    if (!p || !state.user) return;
    state.user.persona_id = id;
    const area = $('#setPersona');
    if (area) area.value = p.prompt;
    renderPersona();
    const payload = Object.assign(profilePayload(), { persona_id: id, companion_persona: p.prompt });
    LumiAPI.request('updateProfile', payload).then((data) => {
      if (data.user) state.user = data.user;
      renderPersona();
      UI.toast('已换成「' + p.name + '」的人格', 'success');
    }).catch((err) => {
      UI.toast(err.message || '人格没有保存上', 'error');
    });
  }

  /* =========================================================
     导航
     ========================================================= */
  function bindUI() {
    $$('.rail-btn[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    $('#railLogout').addEventListener('click', logout);
    $('#btnTheme').addEventListener('click', nextTheme);
    $('#btnBell').addEventListener('click', showAnnouncement);
    $('#btnSearch').addEventListener('click', openSearch);
    $('#searchClose').addEventListener('click', closeSearch);
    $('#searchModal').addEventListener('click', (e) => { if (e.target === $('#searchModal')) closeSearch(); });
    $('#searchGo').addEventListener('click', runSearch);
    $('#searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runSearch(); }
    });
    $('#exportChat').addEventListener('click', exportChat);
    $('#weeklyReport').addEventListener('click', openWeeklyReport);
    $('#reportClose').addEventListener('click', closeWeeklyReport);
    $('#reportDone').addEventListener('click', closeWeeklyReport);
    $('#reportModal').addEventListener('click', (e) => { if (e.target === $('#reportModal')) closeWeeklyReport(); });
    $('#checkinSubmit').addEventListener('click', submitCheckin);
    $('#checkinMoods').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-checkin-mood]');
      if (!btn) return;
      state.checkinPick = btn.dataset.checkinMood;
      $$('#checkinMoods [data-checkin-mood]').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
    });
    $('#btnSide').addEventListener('click', openSide);
    $('#sideClose').addEventListener('click', closeSide);
    $('#sideBackdrop').addEventListener('click', closeSide);
    $('#personAvatar').addEventListener('click', openSide);

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage($('#msgInput').value);
    });

    const input = $('#msgInput');
    input.addEventListener('input', () => {
      resizeInput();
      $('#charCount').textContent = input.value.length;
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
        e.preventDefault();
        sendMessage(input.value);
      }
    });

    $$('.gesture-btn').forEach((btn) => {
      btn.addEventListener('click', () => doGesture(btn.dataset.gesture, btn));
    });

    $('#suggestionRow').addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip) sendMessage(chip.textContent);
    });

    $('#loadMore').addEventListener('click', loadMore);
    $('#refreshInsights').addEventListener('click', () => loadInsights(true));
    $('#messageList').addEventListener('click', onMessageAction);

    $('#saveProfile').addEventListener('click', saveProfile);
    $('#savePreferences').addEventListener('click', savePreferences);
    $('#journalWrite').addEventListener('click', writeJournalToday);
    $('#prefNotify').addEventListener('click', () => {
      const on = $('#prefNotify').getAttribute('aria-checked') !== 'true';
      $('#prefNotify').setAttribute('aria-checked', String(on));
      if (on) requestNotifyPermission(false);
    });
    $('#changePassword').addEventListener('click', changePassword);
    $('#deleteAccount').addEventListener('click', deleteAccount);
    $('#submitFeedback').addEventListener('click', submitFeedback);

    $$('#bubbleStyle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.body.dataset.bubble = btn.dataset.value;
        localStorage.setItem(PREFIX + 'bubble', btn.dataset.value);
        $$('#bubbleStyle button').forEach((b) => b.classList.toggle('active', b === btn));
        saveProfileField({ bubble_style: btn.dataset.value }, '气泡质感已换好');
      });
    });

    $$('[data-font]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const current = parseInt(getComputedStyle(document.body).getPropertyValue('--chat-size'), 10) || 15;
        const next = Math.max(13, Math.min(18, current + Number(btn.dataset.font)));
        document.body.style.setProperty('--chat-size', next + 'px');
        localStorage.setItem(PREFIX + 'fontSize', String(next));
        $('#fontSizeValue').textContent = next;
        saveProfileField({ font_size: next }, '字号调好了');
      });
    });

    $$('#replyStyle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('#replyStyle button').forEach((b) => b.classList.toggle('active', b === btn));
        if (state.user) {
          state.user.preferences = Object.assign({}, state.user.preferences, { reply_style: btn.dataset.value });
        }
        saveProfileField({ reply_style: btn.dataset.value }, '她说话的节奏已经调好');
      });
    });

    $$('.accent-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const color = dot.dataset.accent;
        document.documentElement.style.setProperty('--accent', color);
        localStorage.setItem(PREFIX + 'accent', color);
        syncThemeUI();
        saveProfileField({ accent: color }, '点缀色已换好');
      });
    });

    $('#accentRow').addEventListener('click', (e) => {
      const dot = e.target.closest('.accent-dot');
      if (dot) syncThemeUI();
    });

    ['prefProactive', 'prefSound', 'prefTts', 'prefMotion'].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => {
        const on = el.getAttribute('aria-checked') !== 'true';
        el.setAttribute('aria-checked', String(on));
        if (id === 'prefMotion') document.body.classList.toggle('reduce-motion', on);
      });
    });

    window.addEventListener('lumi:auth-expired', () => {
      LumiAPI.setToken('user', '');
      location.replace('index.html');
    });
    window.addEventListener('lumi:ban', (e) => {
      if (e.detail && e.detail.ban) showBan(e.detail.ban);
    });
    window.addEventListener('lumi:maintenance', (e) => {
      if (e.detail) showMaintenance(e.detail);
    });
    $('#maintenanceRetry').addEventListener('click', () => location.reload());
    $('#maintenanceLogout').addEventListener('click', () => {
      LumiAPI.setToken('user', '');
      location.replace('index.html?logout=1');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSide();
        closeSearch();
        closeWeeklyReport();
      }
    });
  }

  function switchView(name) {
    if (!['chat', 'insights', 'memories', 'journal', 'settings'].includes(name)) return;
    state.view = name;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view' + name.charAt(0).toUpperCase() + name.slice(1)));
    $$('.rail-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    closeSide();
    if (name === 'chat') scrollBottom();
    if (name === 'insights' || name === 'memories') loadInsights();
    if (name === 'journal') loadJournals();
  }

  function openSide() {
    if (window.innerWidth > 1180) return;
    document.body.classList.add('side-open');
  }

  function closeSide() {
    document.body.classList.remove('side-open');
  }

  /* =========================================================
     情绪
     ========================================================= */
  function setMood(mood) {
    if (!mood) return;
    state.mood = mood;
    const info = MOOD[mood.mood] || MOOD['平静'];
    document.body.style.setProperty('--mood-a', info.a);
    document.body.style.setProperty('--mood-b', info.b);

    $('#moodChip').textContent = mood.mood;
    $('#moodIcon').innerHTML = UI.icon(info.icon, 28);
    $('#moodTitle').textContent = mood.mood;
    $('#moodDesc').textContent = info.desc;
    $('#moodTime').textContent = UI.relativeTime(mood.updated_at) + '更新';
    $('#moodTitle').style.color = info.a;

    const days = state.user ? Math.max(1, Math.floor((Date.now() / 1000 - state.user.created_at) / 86400) + 1) : 0;
    $('#personSub').textContent = mood.mood + ' · ' + mood.relationship + (days ? ' · 第 ' + days + ' 天' : '');

    const meters = [
      { label: '亲密', value: mood.affection, raw: mood.affection, tone: 'success' },
      { label: '信任', value: mood.trust, raw: mood.trust },
      { label: '心情', value: Math.round((mood.mood_valence + 100) / 2), raw: mood.mood_valence },
      { label: '精力', value: mood.energy, raw: mood.energy },
      { label: '生气', value: mood.anger, raw: mood.anger, tone: 'danger' },
      { label: '难过', value: mood.sadness, raw: mood.sadness, tone: 'danger' }
    ];
    $('#meterList').innerHTML = meters.map((m) =>
      '<div class="meter" data-tone="' + (m.tone || '') + '">' +
        '<div class="meter-top"><span>' + m.label + '</span><b>' + m.raw + '</b></div>' +
        '<div class="meter-bar"><div class="meter-fill" style="width:' + Math.max(0, Math.min(100, m.value)) + '%"></div></div>' +
      '</div>'
    ).join('');

    renderSideStats();
  }

  function renderSideStats() {
    const u = state.user || {};
    const mood = state.mood || {};
    $('#sideStats').innerHTML = [
      { value: mood.relationship || '初识', label: '关系阶段' },
      { value: (u.streak_days || 0) + ' 天', label: '连续陪伴' },
      { value: u.total_messages || 0, label: '说过的话' }
    ].map((s) => '<div class="side-stat"><strong>' + UI.escapeHTML(String(s.value)) + '</strong><span>' + s.label + '</span></div>').join('');
    if (u.streak_days) {
      $('#streakPill').hidden = false;
      $('#streakPill').innerHTML = UI.icon('zap', 13) + '<b>' + u.streak_days + '</b> 天';
    }
  }

  /* =========================================================
     消息与历史
     ========================================================= */
  async function loadHistory() {
    const data = await LumiAPI.request('history', { limit: 30 });
    state.messages = data.messages || [];
    state.hasMore = !!data.has_more;
    $('#loadMore').hidden = !state.hasMore;
    $('#chatDay').hidden = true;
    renderMessages();
    requestAnimationFrame(() => scrollBottom(false));
    if (data.state) setMood(data.state);
    markRead();
  }

  async function loadMore() {
    if (!state.messages.length) return;
    const first = state.messages[0];
    const scroll = $('#chatScroll');
    const beforeHeight = scroll.scrollHeight;
    const beforeTop = scroll.scrollTop;
    $('#loadMore').disabled = true;
    try {
      const data = await LumiAPI.request('history', { before_id: first.id, limit: 30 });
      const incoming = data.messages || [];
      if (incoming.length) {
        state.messages = incoming.concat(state.messages);
        renderMessages();
        scroll.scrollTop = scroll.scrollHeight - beforeHeight + beforeTop;
      }
      state.hasMore = !!data.has_more;
      $('#loadMore').hidden = !state.hasMore;
      if (data.state) setMood(data.state);
    } catch (err) {
      UI.toast(err.message || '更早的对话没有加载出来', 'error');
    } finally {
      $('#loadMore').disabled = false;
    }
  }

  function renderMessages() {
    const list = $('#messageList');
    if (!state.messages.length) {
      list.innerHTML = welcomeHTML();
      return;
    }
    let html = '';
    let lastDay = '';
    state.messages.forEach((m) => {
      const day = UI.dayLabel(m.created_at);
      if (day !== lastDay) {
        html += '<div class="day-sep">' + UI.escapeHTML(day) + '</div>';
        lastDay = day;
      }
      html += messageHTML(m);
    });
    list.innerHTML = html;
    mountIcons(list);
  }

  function messageHTML(m) {
    const isUser = m.role === 'user';
    const proactive = m.role === 'proactive';
    const gesture = m.meta && (m.meta.gesture || m.meta.gesture_label);
    const checkinMood = m.meta && m.meta.checkin;
    const gestureIcon = GESTURE_ICON[m.meta && m.meta.gesture] || 'hand';
    const gestureName = (m.meta && m.meta.gesture_label) || GESTURE_NAME[m.meta && m.meta.gesture] || '';
    const time = UI.formatTime(m.created_at);
    return '<article class="msg-row ' + (isUser ? 'user' : '') + (proactive ? ' proactive' : '') + (m.streaming ? ' streaming' : '') + '" data-id="' + m.id + '">' +
      (isUser ? '' : '<span class="msg-avatar"><img src="' + AVATAR + '" alt=""></span>') +
      '<div class="msg-col">' +
        (proactive ? '<span class="proactive-tag">' + UI.icon('sparkles', 12) + '她主动来找你</span>' : '') +
        (checkinMood ? '<span class="msg-gesture-tag checkin-tag">' + UI.icon('calendar', 12) + '心情签到 · ' + UI.escapeHTML(checkinMood) + '</span>' : '') +
        (gesture ? '<span class="msg-gesture-tag">' + UI.icon(gestureIcon, 12) + UI.escapeHTML(gestureName || '动作') + '</span>' : '') +
        '<div class="msg-bubble">' + UI.escapeHTML(m.content) + '</div>' +
        '<div class="msg-meta">' +
          '<span>' + time + '</span>' +
          (isUser ? '' : '<span>' + UI.escapeHTML(m.mood_after || m.emotion || '') + '</span>') +
          '<span class="msg-actions">' +
            '<button class="msg-act' + (m.pinned ? ' on' : '') + '" data-act="pin" type="button" title="收藏这句话">' + UI.icon('bookmark', 12) + '</button>' +
            '<button class="msg-act" data-act="copy" type="button" title="复制">' + UI.icon('copy', 12) + '</button>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function welcomeHTML() {
    const name = state.user ? (state.user.companion_name || '小屿') : '小屿';
    const nick = state.user ? (state.user.nickname || '') : '';
    return '<div class="welcome"><div class="welcome-card">' +
      '<h3>' + UI.escapeHTML(nick ? nick + '，' : '') + '我在。<br>不急，先待一会儿。</h3>' +
      '<p>' + UI.escapeHTML(name) + '会记得你说过的话，也会有自己的情绪。你可以说话，也可以什么都不说，只是坐一会儿。</p>' +
      '<div class="welcome-tags">' +
        '<span class="pill">' + UI.icon('heart', 12) + '情绪记忆</span>' +
        '<span class="pill">' + UI.icon('sparkles', 12) + '会主动开口</span>' +
        '<span class="pill">' + UI.icon('hand', 12) + '可以抱抱</span>' +
      '</div>' +
    '</div></div>';
  }

  function onMessageAction(e) {
    const btn = e.target.closest('.msg-act');
    if (!btn) return;
    const row = btn.closest('.msg-row');
    const id = Number(row.dataset.id);
    const message = state.messages.find((m) => Number(m.id) === id);
    if (!message) return;
    if (btn.dataset.act === 'copy') {
      navigator.clipboard.writeText(message.content).then(() => UI.toast('这句话已经复制好了')).catch(() => UI.toast('复制失败'));
      return;
    }
    if (btn.dataset.act === 'pin') {
      const pinned = message.pinned ? 0 : 1;
      LumiAPI.request('pinMessage', { message_id: id, pinned: pinned }).then(() => {
        message.pinned = pinned;
        btn.classList.toggle('on', !!pinned);
        UI.toast(pinned ? '已经收进回忆里了' : '已取消收藏');
        if (state.insights) loadInsights(true);
        else loadInsights();
      }).catch((err) => UI.toast(err.message || '操作失败', 'error'));
    }
  }

  /* =========================================================
     发送 / 动作 / 轮询
     ========================================================= */
  async function sendMessage(raw) {
    const text = String(raw || '').trim();
    if (!text || state.sending) return;
    if (text.length > 2000) return UI.toast('说得有点长，分几次告诉我好吗', 'warn');

    const input = $('#msgInput');
    const tempId = 'tmp-' + Date.now();
    const streamId = 'stream-' + Date.now();
    let reply = null;
    state.messages.push({
      id: tempId,
      role: 'user',
      content: text,
      created_at: Math.floor(Date.now() / 1000),
      pinned: 0,
      meta: {}
    });
    renderMessages();
    scrollBottom();
    input.value = '';
    resizeInput();
    $('#charCount').textContent = '0';
    $('#suggestionRow').innerHTML = '';
    state.sending = true;
    $('#sendBtn').disabled = true;
    showThinking();

    try {
      const result = await LumiAPI.stream('chat', {
        message: text,
        conversation_id: state.conversationId || 0,
        stream: 1
      }, (evt) => {
        if (evt.type === 'start') {
          hideThinking();
          state.conversationId = evt.conversation_id || state.conversationId;
          reply = {
            id: streamId,
            role: 'assistant',
            content: '',
            created_at: Math.floor(Date.now() / 1000),
            pinned: 0,
            meta: {},
            streaming: true
          };
          state.messages.push(reply);
          renderMessages();
          scrollBottom();
          return;
        }
        if (evt.type === 'delta' && reply) {
          reply.content += evt.text || '';
          updateStreamingBubble(streamId, reply.content);
        }
      });

      clearTimeout(state.typingTimer);
      clearInterval(state.thinkingTimer);
      $('#typingRow').hidden = true;

      if (result && result.fallback) {
        // 后端未开启流式（或中间层缓冲），退回一次性结果
        if (reply) {
          state.messages = state.messages.filter((m) => m.id !== streamId);
          reply = null;
        }
        applyChatResult(result.fallback);
      } else {
        const done = (result && result.done) || {};
        if (reply) {
          const msg = done.message || {};
          reply.id = msg.id || reply.id;
          reply.content = msg.content || reply.content;
          reply.emotion = msg.emotion || '';
          reply.mood_after = msg.mood_after || '';
          reply.created_at = msg.created_at || reply.created_at;
          reply.tokens = msg.tokens || 0;
          reply.meta = msg.meta || {};
          reply.streaming = false;
        }
        applyChatResult(done, true);
        speakReply(reply ? reply.content : '');
      }
      renderMessages();
      scrollBottom();
      if (prefs().sound !== false) UI.chime('sent');
    } catch (err) {
      hideThinking();
      state.messages = state.messages.filter((m) => m.id !== tempId && m.id !== streamId);
      renderMessages();
      if (err && err.code === 403 && err.data && err.data.ban) {
        showBan(err.data.ban);
      } else if (err && err.code === 503 && err.data && err.data.maintenance) {
        showMaintenance(err.data.maintenance);
      } else {
        input.value = text;
        resizeInput();
        $('#charCount').textContent = text.length;
        UI.toast(err && err.message ? err.message : '这句话没能送出去', 'error');
      }
    } finally {
      state.sending = false;
      $('#sendBtn').disabled = false;
      input.focus();
    }
  }

  function applyChatResult(data, skipMessage) {
    if (!data) return;
    state.conversationId = data.conversation_id || state.conversationId;
    if (!skipMessage && data.message) state.messages.push(data.message);
    if (state.user) state.user.total_messages = (state.user.total_messages || 0) + 2;
    if (data.state) setMood(data.state);
    if (data.suggestions && data.suggestions.length) renderSuggestions(data.suggestions);
    if (data.degraded && !state.degradedNotified) {
      state.degradedNotified = true;
      UI.toast('模型暂时没有回应，先用离线陪伴接着你', 'warn');
    }
    if (state.insightsLoaded) state.insightsLoaded = false;
    if (!skipMessage && data.message) speakReply(data.message.content);
  }

  function updateStreamingBubble(id, text) {
    const row = document.querySelector('.msg-row[data-id="' + id + '"]');
    if (!row) return;
    const bubble = row.querySelector('.msg-bubble');
    if (bubble) bubble.textContent = text;
    if (isNearBottom()) scrollBottom();
  }

  function speakReply(text) {
    if (!prefs().tts) return;
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return;
    const clean = String(text || '').replace(/<[^>]*>/g, '').trim();
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'zh-CN';
      utter.rate = 0.92;
      utter.pitch = 1.06;
      const voices = window.speechSynthesis.getVoices();
      const zh = voices.find((v) => /zh[-_]?cn/i.test(v.lang)) || voices.find((v) => /^zh/i.test(v.lang));
      if (zh) utter.voice = zh;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      // 浏览器不支持朗读时静默跳过
    }
  }

  async function doGesture(type, button) {
    if (state.gestureBusy) return;
    state.gestureBusy = true;
    $$('.gesture-btn').forEach((b) => { b.disabled = true; });
    spawnHearts(button);
    try {
      const data = await LumiAPI.request('gesture', { type: type });
      if (data.message) state.messages.push(data.message);
      if (state.user) state.user.total_messages = (state.user.total_messages || 0) + 1;
      if (data.state) setMood(data.state);
      state.conversationId = data.conversation_id || state.conversationId;
      renderMessages();
      scrollBottom();
      if (data.effect) {
        const delta = Number(data.effect.affection_delta) || 0;
        UI.toast((data.effect.label || GESTURE_NAME[type] || '动作') + ' · 亲密 ' + (delta >= 0 ? '+' : '') + delta, 'success');
      }
      if (prefs().sound !== false) UI.chime('received');
    } catch (err) {
      if (err && err.code === 403 && err.data && err.data.ban) showBan(err.data.ban);
      else UI.toast(err.message || '这个动作没能做出来', 'error');
    } finally {
      state.gestureBusy = false;
      $$('.gesture-btn').forEach((b) => { b.disabled = false; });
    }
  }

  function spawnHearts(button) {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const colors = ['var(--accent)', 'var(--accent-2)', 'var(--mood-a)'];
    for (let i = 0; i < 6; i++) {
      const heart = document.createElement('span');
      heart.className = 'float-heart';
      heart.style.left = (rect.left + rect.width / 2 + (Math.random() * 44 - 22)) + 'px';
      heart.style.top = (rect.top - 6) + 'px';
      heart.style.color = colors[i % colors.length];
      heart.style.animationDelay = (i * 0.055) + 's';
      heart.innerHTML = UI.icon(i % 2 === 0 ? 'heart' : 'sparkles', 13 + Math.round(Math.random() * 6));
      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 1700);
    }
  }

  function renderSuggestions(list) {
    const row = $('#suggestionRow');
    if (!list || !list.length) {
      row.innerHTML = '';
      return;
    }
    row.innerHTML = list.slice(0, 3).map((s) =>
      '<button class="suggestion-chip" type="button">' + UI.escapeHTML(s) + '</button>'
    ).join('');
  }

  function startPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(poll, 22000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) poll();
    });
    setTimeout(poll, 4000);
  }

  async function poll() {
    if (state.sending) return;
    try {
      const data = await LumiAPI.request('poll', {}, { timeout: 25000 });
      if (data.state) setMood(data.state);
      if (data.announcement) {
        state.announcement = data.announcement;
        updateAnnouncement();
      }
      if (data.messages && data.messages.length) {
        const near = isNearBottom();
        const incoming = data.messages.filter((m) => !state.messages.some((x) => String(x.id) === String(m.id)));
        if (incoming.length) {
          state.messages = state.messages.concat(incoming);
          renderMessages();
          if (near || data.proactive) scrollBottom(true);
          markRead(incoming.map((m) => m.id));
          incoming.forEach((m) => notifyMessage(m, m.role === 'proactive'));
        }
        if (data.proactive) {
          UI.toast('她主动来找你了', 'success');
          if (prefs().sound !== false) UI.chime('received');
        }
      }
      if (data.journal && (!state.journalToday || state.journalToday.id !== data.journal.id)) {
        state.journalToday = data.journal;
        if (state.view === 'journal') {
          state.journal = null;
          loadJournals(true);
        } else {
          UI.toast('她把今天的日记写好了', 'success');
        }
      }
    } catch (err) {
      if (err && err.code === 401) {
        LumiAPI.setToken('user', '');
        location.replace('index.html');
      } else if (err && err.code === 403 && err.data && err.data.ban) {
        showBan(err.data.ban);
      }
    }
  }

  function markRead(ids) {
    const payload = ids && ids.length ? { ids: ids } : {};
    LumiAPI.request('markRead', payload).catch(() => {});
  }

  function isNearBottom() {
    const el = $('#chatScroll');
    return el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  }

  function scrollBottom(smooth) {
    const el = $('#chatScroll');
    setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth === false ? 'auto' : 'smooth' });
    }, 40);
  }

  function resizeInput() {
    const input = $('#msgInput');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  }

  function prefs() {
    return (state.user && state.user.preferences) || {};
  }

  /* =========================================================
     情绪轨迹 / 回忆
     ========================================================= */
  async function loadInsights(force) {
    if (state.insightsLoaded && !force) {
      if (state.view === 'insights') renderInsights(state.insights);
      return;
    }
    try {
      const data = await LumiAPI.request('insights');
      state.insights = data;
      state.insightsLoaded = true;
      if (data.state) setMood(data.state);
      renderInsights(data);
      renderMemories(data.pinned || []);
      renderSidePinned(data.pinned || []);
    } catch (err) {
      if (err && err.code === 401) {
        LumiAPI.setToken('user', '');
        location.replace('index.html');
      }
    }
  }

  function renderInsights(data) {
    if (!data) return;
    const stats = data.stats || {};
    const days = Math.max(1, Math.floor((Date.now() / 1000 - (state.user ? state.user.created_at : Date.now() / 1000)) / 86400) + 1);
    const cards = [
      { icon: 'message', value: stats.total_messages || 0, label: '你们说过的话' },
      { icon: 'sparkles', value: stats.today_messages || 0, label: '今天说的话' },
      { icon: 'zap', value: (stats.streak_days || 0) + ' 天', label: '连续陪伴' },
      { icon: 'calendar', value: days + ' 天', label: '相遇至今' }
    ];
    $('#insightStats').innerHTML = cards.map((c) =>
      '<div class="stat-card"><span class="stat-icon">' + UI.icon(c.icon, 16) + '</span>' +
      '<strong>' + UI.escapeHTML(String(c.value)) + '</strong><span>' + c.label + '</span></div>'
    ).join('');

    if (data.checkin) {
      state.checkin = data.checkin;
      renderCheckin();
    }
    renderBadges(data.achievements || []);

    $('#valenceChart').innerHTML = chartSVG(data.days || []);
    renderBars('#moodDist', (data.distribution || []).map((d) => ({ label: d.label, value: d.value })));
    renderBars('#interactionList', (data.interactions || []).map((d) => ({
      label: INTERACTION_NAME[d.type] || d.type,
      value: d.count
    })));

    const milestones = data.milestones || [];
    $('#milestones').innerHTML = milestones.length ? milestones.map((m) =>
      '<div class="timeline-item"><span class="timeline-dot">' + UI.icon(m.icon === 'spark' ? 'sparkles' : m.icon === 'hand' ? 'hand' : 'heart', 15) + '</span>' +
      '<div class="timeline-body"><strong>' + UI.escapeHTML(m.title) + '</strong>' +
      '<p>' + UI.escapeHTML(m.content) + '</p>' +
      '<time>' + UI.formatDateTime(m.created_at) + '</time></div></div>'
    ).join('') : '<div class="chart-empty">故事才刚开始，再一起走一段吧。</div>';

    renderSidePinned(data.pinned || []);
    renderMemories(data.pinned || []);
  }

  function chartSVG(days) {
    if (!days || !days.length) return '<div class="chart-empty">还没有足够的情绪记录</div>';
    const hasData = days.some((d) => d.valence !== null || d.affection !== null);
    if (!hasData) return '<div class="chart-empty">再多聊几句，这里就会长出曲线</div>';

    const W = 760;
    const H = 236;
    const L = 34;
    const R = 14;
    const T = 16;
    const B = 30;
    const innerW = W - L - R;
    const innerH = H - T - B;
    const n = days.length;
    const x = (i) => L + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const yV = (v) => T + innerH / 2 - (Math.max(-100, Math.min(100, v)) / 100) * (innerH / 2);
    const yA = (v) => T + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

    let grid = '';
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      const y = T + innerH * p;
      grid += '<line x1="' + L + '" y1="' + y + '" x2="' + (W - R) + '" y2="' + y + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 6"/>';
    });

    let labels = '';
    days.forEach((d, i) => {
      if (i % 3 === 0 || i === n - 1) {
        labels += '<text x="' + x(i) + '" y="' + (H - 8) + '" fill="var(--faint)" font-size="9" text-anchor="middle">' + UI.escapeHTML(d.day) + '</text>';
      }
    });

    let vPoints = '';
    let vDots = '';
    days.forEach((d, i) => {
      if (d.valence === null || d.valence === undefined) return;
      const px = x(i);
      const py = yV(d.valence);
      vPoints += (vPoints ? ' ' : '') + px + ',' + py;
      vDots += '<circle cx="' + px + '" cy="' + py + '" r="2.6" fill="var(--chart-line)" opacity=".9"/>';
    });

    let aPoints = '';
    days.forEach((d, i) => {
      if (d.affection === null || d.affection === undefined) return;
      aPoints += (aPoints ? ' ' : '') + x(i) + ',' + yA(d.affection);
    });

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="最近 14 天情绪曲线">' +
      '<defs><linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--chart-line)" stop-opacity=".16"/>' +
        '<stop offset="100%" stop-color="var(--chart-line)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      grid +
      '<line x1="' + L + '" y1="' + yV(0) + '" x2="' + (W - R) + '" y2="' + yV(0) + '" stroke="var(--line-strong)" stroke-width="1"/>' +
      (aPoints ? '<polyline points="' + aPoints + '" fill="none" stroke="var(--chart-line-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>' : '') +
      (vPoints ? '<polyline points="' + vPoints + '" fill="none" stroke="var(--chart-line)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' : '') +
      vDots +
      labels +
    '</svg>';
  }

  function renderBars(selector, items) {
    const box = $(selector);
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<div class="chart-empty">还没有留下痕迹</div>';
      return;
    }
    const max = Math.max.apply(null, items.map((i) => Number(i.value) || 1)) || 1;
    box.innerHTML = items.map((item, index) =>
      '<div class="bar-item">' +
        '<div class="bar-item-top"><span>' + UI.escapeHTML(String(item.label)) + '</span><b>' + item.value + '</b></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(6, (Number(item.value) / max) * 100) + '%;opacity:' + (1 - index * 0.09) + '"></div></div>' +
      '</div>'
    ).join('');
  }

  function renderMemories(pinned) {
    const box = $('#memoryGrid');
    if (!box) return;
    if (!pinned.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-inner">' + UI.icon('bookmark', 26) +
        '<strong>还没有收藏的句子</strong><span>在聊天里hover一条消息，点书签，把想留住的句子收进来。</span></div></div>';
      return;
    }
    box.innerHTML = pinned.map((m) =>
      '<div class="memory-card">' +
        '<span class="memory-quote">' + UI.icon('quote', 20) + '</span>' +
        '<p>' + UI.escapeHTML(m.content) + '</p>' +
        '<div class="memory-foot"><span>' + UI.formatDateTime(m.created_at) + '</span>' +
        '<button class="btn btn-text btn-sm" data-unpin="' + m.id + '" type="button">' + UI.icon('bookmark', 13) + '取消收藏</button></div>' +
      '</div>'
    ).join('');
    box.querySelectorAll('[data-unpin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.unpin);
        LumiAPI.request('pinMessage', { message_id: id, pinned: 0 }).then(() => {
          const message = state.messages.find((m) => Number(m.id) === id);
          if (message) message.pinned = 0;
          state.insightsLoaded = false;
          loadInsights(true);
          renderMessages();
          UI.toast('已取消收藏');
        }).catch((err) => UI.toast(err.message || '操作失败', 'error'));
      });
    });
  }

  function renderSidePinned(pinned) {
    const box = $('#sidePinned');
    if (!box) return;
    if (!pinned.length) {
      box.innerHTML = '<div class="side-empty">还没有收藏。点开一条消息，把想留住的句子交给她。</div>';
      return;
    }
    box.innerHTML = pinned.slice(0, 4).map((m) =>
      '<button class="pinned-item" data-jump="' + m.id + '" type="button">' +
        '<p>' + UI.escapeHTML(m.content) + '</p>' +
        '<span>' + UI.formatDate(m.created_at) + '</span>' +
      '</button>'
    ).join('');
    box.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => focusMessage(Number(btn.dataset.jump)));
    });
  }

  async function loadJournals(force) {
    if (state.journal && !force) {
      renderJournals(state.journal);
      return;
    }
    try {
      const data = await LumiAPI.request('journals', { limit: 30 });
      state.journal = data;
      if (data.today) state.journalToday = data.today;
      renderJournals(data);
    } catch (err) {
      const box = $('#journalList');
      if (box) box.innerHTML = '<div class="empty"><div class="empty-inner">' + UI.icon('edit', 26) +
        '<strong>日记暂时没有翻出来</strong><span>' + UI.escapeHTML(err.message || '稍后再试') + '</span></div></div>';
    }
  }

  function renderJournals(data) {
    const box = $('#journalList');
    if (!box) return;
    const items = (data && data.items) || [];
    const today = localDay();
    if (!items.length) {
      box.innerHTML = '<div class="empty"><div class="empty-inner">' + UI.icon('edit', 26) +
        '<strong>她还没有写下第一篇</strong><span>今天聊过之后，点右上角「写今天的」，她会把这一天收进日记里。</span></div></div>';
      return;
    }
    box.innerHTML = items.map((j) => {
      const date = j.day ? new Date(j.day + 'T12:00:00') : new Date();
      const dayText = (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
      const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      const isToday = j.day === today;
      const counts = j.meta || {};
      return '<article class="journal-card' + (isToday ? ' today' : '') + '">' +
        '<div class="journal-head">' +
          '<div class="journal-date-wrap"><b>' + dayText + '</b><span>' + week + (isToday ? ' · 今天' : '') + '</span></div>' +
          '<div class="journal-tags">' +
            (j.mood ? '<span class="journal-tag">' + UI.icon('heart', 12) + UI.escapeHTML(j.mood) + '</span>' : '') +
            (counts.user_messages ? '<span class="journal-tag">' + UI.icon('message', 12) + counts.user_messages + ' 句' + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<p class="journal-text">' + UI.escapeHTML(j.content) + '</p>' +
        '<div class="journal-foot"><span>写于 ' + UI.formatDateTime(j.updated_at || j.created_at) + '</span></div>' +
      '</article>';
    }).join('');
  }

  function localDay(ts) {
    const d = ts ? new Date(Number(ts) * 1000) : new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  async function writeJournalToday() {
    const btn = $('#journalWrite');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const data = await LumiAPI.request('journalToday', {});
      if (data.journal) {
        state.journalToday = data.journal;
        state.journal = null;
        await loadJournals(true);
        UI.toast('她把今天轻轻收进了日记', 'success');
      }
    } catch (err) {
      UI.toast(err.message || '日记还没有写好', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  /* =========================================================
     通知 / 思考中
     ========================================================= */
  function notificationSupported() {
    return typeof window.Notification === 'function';
  }

  function requestNotifyPermission(silent) {
    if (!notificationSupported()) {
      if (!silent) UI.toast('这个浏览器暂时不支持通知', 'warn');
      return;
    }
    if (Notification.permission === 'granted') {
      if (!silent) UI.toast('通知已经打开了，她会在后台轻轻叫你', 'success');
      return;
    }
    if (Notification.permission === 'denied') {
      if (!silent) UI.toast('通知被浏览器拦截了，可以在站点设置里允许', 'warn');
      return;
    }
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') UI.toast('通知已经打开，她去后台也会提醒你', 'success');
      else if (!silent) UI.toast('没有打开通知也没关系', 'warn');
    });
  }

  function notifyMessage(message, proactive) {
    if (!prefs().notify || !notificationSupported()) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden && !proactive) return;
    const name = (state.user && state.user.companion_name) || '小屿';
    const body = String(message.content || '').replace(/<[^>]*>/g, '').slice(0, 90);
    try {
      const note = new Notification(proactive ? name + ' 主动来找你了' : name + ' 回了你一句', {
        body: body,
        tag: 'lumi-msg-' + message.id,
        icon: AVATAR
      });
      note.onclick = () => {
        window.focus();
        note.close();
      };
    } catch (err) {
      // 移动端部分浏览器不支持构造 Notification，静默跳过
    }
  }

  const THINKING_LINES = ['她在读你的话…', '她把语气放轻了一点…', '她在想你刚才说的那句…', '她正在把心事组织成一句话…'];

  function showThinking() {
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      $('#typingRow').hidden = false;
      let index = 0;
      const copy = $('#typingCopy');
      if (copy) copy.textContent = THINKING_LINES[0];
      clearInterval(state.thinkingTimer);
      state.thinkingTimer = setInterval(() => {
        index = (index + 1) % THINKING_LINES.length;
        const node = $('#typingCopy');
        if (node) node.textContent = THINKING_LINES[index];
      }, 2400);
      scrollBottom();
    }, 380);
  }

  function hideThinking() {
    clearTimeout(state.typingTimer);
    clearInterval(state.thinkingTimer);
    $('#typingRow').hidden = true;
  }

  async function focusMessage(id) {
    switchView('chat');
    let row = findRow(id);
    let guard = 0;
    while (!row && state.hasMore && guard < 8) {
      await loadMore();
      row = findRow(id);
      guard++;
    }
    if (!row) {
      UI.toast('这条回忆还在更早的地方，往上翻翻看');
      return;
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 2200);
  }

  function findRow(id) {
    return document.querySelector('.msg-row[data-id="' + id + '"]');
  }

  /* =========================================================
     每日签到 / 搜索 / 导出 / 徽章
     ========================================================= */
  function renderCheckin() {
    const data = state.checkin || {};
    const moods = state.checkinMoods || [];
    const todayMood = data.today ? data.today.mood : '';
    if (!state.checkinPick) state.checkinPick = todayMood || '';
    const box = $('#checkinMoods');
    if (box && moods.length) {
      box.innerHTML = moods.map((m) =>
        '<button class="checkin-mood" type="button" data-checkin-mood="' + UI.escapeHTML(m.mood) + '" aria-pressed="' + (state.checkinPick === m.mood ? 'true' : 'false') + '">' +
          '<span class="checkin-mood-icon">' + UI.icon(m.icon, 16) + '</span>' +
          '<span>' + UI.escapeHTML(m.mood) + '</span>' +
        '</button>'
      ).join('');
    }
    const note = $('#checkinNote');
    if (note && data.today && data.today.note && !note.value) note.value = data.today.note;
    const streak = $('#checkinStreak');
    if (streak) {
      if (data.streak > 0) {
        streak.hidden = false;
        streak.innerHTML = UI.icon('zap', 12) + '<b>' + data.streak + '</b> 天';
      } else {
        streak.hidden = true;
      }
    }
    const week = $('#checkinWeek');
    if (week) {
      const recent = data.recent || [];
      week.innerHTML = recent.map((d) => {
        const m = moods.find((x) => x.mood === d.mood);
        return '<div class="checkin-day' + (d.mood ? ' filled' : '') + '" title="' + UI.escapeHTML(d.day + (d.mood ? ' · ' + d.mood : ' · 未记录')) + '">' +
          '<span class="checkin-dot">' + (m ? UI.icon(m.icon, 12) : '<i></i>') + '</span>' +
          '<small>' + UI.escapeHTML(d.day) + '</small>' +
        '</div>';
      }).join('');
    }
  }

  async function submitCheckin() {
    if (!state.checkinPick) return UI.toast('先选一个今天的心情吧', 'warn');
    const btn = $('#checkinSubmit');
    btn.disabled = true;
    try {
      const note = $('#checkinNote').value.trim();
      const data = await LumiAPI.request('checkin', { mood: state.checkinPick, note: note });
      state.checkin = data.checkin || state.checkin;
      if (data.state) setMood(data.state);
      if (data.message) {
        if (!state.messages.some((m) => Number(m.id) === Number(data.message.id))) state.messages.push(data.message);
        renderMessages();
        scrollBottom();
      }
      renderCheckin();
      UI.toast(data.reply || '今天的心情，我收好了', 'success');
      if (prefs().sound !== false) UI.chime('received');
    } catch (err) {
      UI.toast(err.message || '没能记下来', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function openSearch() {
    const modal = $('#searchModal');
    if (!modal) return;
    modal.classList.add('open');
    const box = $('#searchResults');
    if (box && !box.dataset.touched) {
      box.innerHTML = '<div class="search-empty">输入关键词，把你们说过的话翻出来。</div>';
    }
    setTimeout(() => {
      const input = $('#searchInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 180);
  }

  function closeSearch() {
    const modal = $('#searchModal');
    if (modal) modal.classList.remove('open');
  }

  async function openWeeklyReport() {
    const modal = $('#reportModal');
    if (!modal) return;
    const body = $('#reportBody');
    const btn = $('#weeklyReport');
    modal.classList.add('open');
    body.innerHTML = '<div class="search-empty">正在把这一周翻出来…</div>';
    btn.disabled = true;
    try {
      const data = await LumiAPI.request('weeklyReport');
      renderWeeklyReport(data);
    } catch (err) {
      body.innerHTML = '<div class="search-empty">' + UI.escapeHTML(err.message || '这一页暂时翻不开') + '</div>';
    } finally {
      btn.disabled = false;
    }
  }

  function closeWeeklyReport() {
    const modal = $('#reportModal');
    if (modal) modal.classList.remove('open');
  }

  function renderWeeklyReport(data) {
    const range = data.range || {};
    $('#reportRange').textContent = (range.from || '') + ' — ' + (range.to || '') + ' · 近 7 天';
    const stats = [
      { label: '说过的话', value: data.messages || 0, sub: '你先开口 ' + (data.mine || 0) + ' 句' },
      { label: '见面天数', value: data.active_days || 0, sub: '这一周里的 ' + (range.days || 7) + ' 天' },
      { label: '心情签到', value: data.checkin_count || 0, sub: data.top_checkin ? '最多「' + data.top_checkin + '」' : '还没有签到' },
      { label: '靠近动作', value: data.gesture_count || 0, sub: data.gesture_label ? '最多「' + data.gesture_label + '」' : '还没有互动' }
    ];
    const statHTML = stats.map((s) =>
      '<div class="report-stat"><span>' + UI.escapeHTML(s.label) + '</span><b>' + UI.escapeHTML(String(s.value)) + '</b><small>' + UI.escapeHTML(s.sub) + '</small></div>'
    ).join('');
    const linesHTML = (data.lines || []).map((line) =>
      '<p class="report-line">' + UI.icon('sparkles', 12) + '<span>' + UI.escapeHTML(line) + '</span></p>'
    ).join('');
    const moodBlock = data.valence === null || data.valence === undefined
      ? ''
      : '<div class="report-quote">' + UI.icon('heart', 13) + '<span>情绪底色 ' + UI.escapeHTML(String(data.valence)) + ' · 亲密度 ' + UI.escapeHTML(String(data.affection === null || data.affection === undefined ? '—' : data.affection)) + ' · 此刻「' + UI.escapeHTML(data.mood_label || '平静') + '」</span></div>';
    $('#reportBody').innerHTML =
      '<div class="report-stats">' + statHTML + '</div>' +
      '<div class="report-lines">' + linesHTML + '</div>' +
      moodBlock;
  }

  async function runSearch() {
    const q = $('#searchInput').value.trim();
    if (!q) return UI.toast('输入几个字再找吧', 'warn');
    const box = $('#searchResults');
    box.dataset.touched = '1';
    box.innerHTML = '<div class="search-empty">正在翻…</div>';
    try {
      const data = await LumiAPI.request('searchMessages', { q: q });
      renderSearchResults(data.items || [], q);
    } catch (err) {
      box.innerHTML = '<div class="search-empty">' + UI.escapeHTML(err.message || '搜索没能完成') + '</div>';
    }
  }

  function renderSearchResults(items, q) {
    const box = $('#searchResults');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<div class="search-empty">没有找到「' + UI.escapeHTML(q) + '」。换一个词试试。</div>';
      return;
    }
    box.innerHTML = items.map((m) =>
      '<button class="search-item" type="button" data-jump="' + m.id + '">' +
        '<span class="search-who ' + (m.role === 'user' ? 'me' : 'her') + '">' + (m.role === 'user' ? '我' : '她') + '</span>' +
        '<p>' + UI.escapeHTML(m.content) + '</p>' +
        '<time>' + UI.formatDateTime(m.created_at) + '</time>' +
      '</button>'
    ).join('');
    box.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.jump);
        closeSearch();
        focusMessage(id);
      });
    });
  }

  async function exportChat() {
    const btn = $('#exportChat');
    btn.disabled = true;
    try {
      const data = await LumiAPI.request('exportChat', {}, { timeout: 30000 });
      const blob = new Blob([data.content || ''], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || '心屿对话.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      UI.toast('已导出 ' + (data.count || 0) + ' 条对话', 'success');
    } catch (err) {
      UI.toast(err.message || '导出没能完成', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function renderBadges(list) {
    const box = $('#badgeGrid');
    if (!box) return;
    if (!list || !list.length) {
      box.innerHTML = '<div class="chart-empty">徽章会在你们走过之后出现</div>';
      return;
    }
    box.innerHTML = list.map((b) =>
      '<div class="badge' + (b.unlocked ? ' unlocked' : '') + '">' +
        '<span class="badge-icon">' + UI.icon(b.icon || 'sparkles', 18) + '</span>' +
        '<div class="badge-copy"><strong>' + UI.escapeHTML(b.label) + '</strong><small>' + UI.escapeHTML(b.desc) + '</small></div>' +
        (b.unlocked
          ? '<span class="badge-mark">' + UI.icon('check', 12) + '</span>'
          : '<span class="badge-mark locked">' + UI.icon('lock', 12) + '</span>') +
      '</div>'
    ).join('');
  }

  /* =========================================================
     公告 / 封禁
     ========================================================= */
  function updateAnnouncement() {
    const block = $('#announceBlock');
    if (state.announcement) {
      block.hidden = false;
      $('#announceText').textContent = (state.announcement.title ? state.announcement.title + '：' : '') + state.announcement.content;
    } else {
      block.hidden = true;
    }
  }

  function showAnnouncement() {
    if (!state.announcement) {
      UI.toast('现在没有新的公告，她只想陪你待着');
      return;
    }
    UI.toast((state.announcement.title || '心屿公告') + '：' + state.announcement.content);
  }

  function banCode(ban) {
    const stamp = ban.banned_at || ban.until_at || 0;
    if (!stamp) return '—';
    return 'XY-' + Number(stamp).toString(36).toUpperCase();
  }

  function showMaintenance(data) {
    data = data || {};
    state.maintenance = data;
    const modal = $('#maintenanceModal');
    if (!modal) return;
    clearInterval(state.maintenanceTimer);
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
      wrap.hidden = true;
    } else {
      wrap.hidden = false;
      wrap.querySelector('span').textContent = '距离重新开门还有';
      const tick = () => {
        counter.textContent = formatCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(state.maintenanceTimer);
          counter.textContent = '已到预计时间';
          wrap.querySelector('span').textContent = '预计恢复时间已到，正在做最后检查';
        }
        remaining -= 1;
      };
      tick();
      state.maintenanceTimer = setInterval(tick, 1000);
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    state.pollTimer && clearInterval(state.pollTimer);
  }

  function showBan(ban) {
    ban = ban || {};
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
    $('#banIcon').innerHTML = UI.icon('ban', 26);
    $('#banMailIcon').innerHTML = UI.icon('mail', 15);

    const wrap = $('#banCountdownWrap');
    const counter = $('#banCountdown');
    clearInterval(state.banTimer);
    if (permanent) {
      wrap.hidden = true;
    } else {
      wrap.hidden = false;
      let remaining = Number(ban.remaining_seconds) || 0;
      const tick = () => {
        counter.textContent = formatCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(state.banTimer);
          wrap.querySelector('span').textContent = '封禁已到期，重新登录就好';
          counter.textContent = '已到期';
        }
        remaining -= 1;
      };
      tick();
      state.banTimer = setInterval(tick, 1000);
    }

    $('#banLogout').onclick = () => {
      LumiAPI.setToken('user', '');
      location.replace('index.html?logout=1');
    };
    $('#banCopyContact').onclick = copyBanInfo;
    modal.classList.add('open');
    state.pollTimer && clearInterval(state.pollTimer);
  }

  async function copyBanInfo() {
    const username = state.user ? state.user.username : '';
    const text = [
      '心屿账号申诉',
      '用户名：' + (username || '（未知）'),
      '封禁原因：' + ($('#banReason').textContent || '—'),
      '封禁时间：' + ($('#banStart').textContent || '—'),
      '解封时间：' + ($('#banUntil').textContent || '—'),
      '处理编号：' + ($('#banCode').textContent || '—')
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      UI.toast('申诉信息已复制', 'success');
    } catch (err) {
      UI.toast('复制失败，请手动记录');
    }
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

  /* =========================================================
     设置
     ========================================================= */
  function fillSettings() {
    const u = state.user;
    if (!u) return;
    $('#setNickname').value = u.nickname || '';
    $('#setCompanionName').value = u.companion_name || '';
    $('#setPersona').value = u.companion_persona || '';
    renderPersona();
    $('#setBio').value = u.bio || '';
    $('#setEmail').value = u.email || '';
    $('#setPhone').value = u.phone || '';
    $('#setGender').value = u.gender || 'secret';
    $('#setBirthday').value = u.birthday || '';
    const prefs = u.preferences || {};
    $('#prefProactive').setAttribute('aria-checked', String(prefs.proactive !== false));
    $('#prefSound').setAttribute('aria-checked', String(prefs.sound !== false));
    $('#prefTts').setAttribute('aria-checked', String(!!prefs.tts));
    $('#prefNotify').setAttribute('aria-checked', String(!!prefs.notify));
    $('#prefMotion').setAttribute('aria-checked', String(!!prefs.reduce_motion));
    document.body.classList.toggle('reduce-motion', !!prefs.reduce_motion);
    $('#fontSizeValue').textContent = u.font_size || 15;
    $$('#bubbleStyle button').forEach((b) => b.classList.toggle('active', b.dataset.value === (u.bubble_style || 'soft')));
    $$('#replyStyle button').forEach((b) => b.classList.toggle('active', b.dataset.value === (prefs.reply_style || 'balanced')));
    syncThemeUI();
  }

  function profilePayload() {
    return {
      nickname: $('#setNickname').value.trim(),
      companion_name: $('#setCompanionName').value.trim(),
      companion_persona: $('#setPersona').value.trim(),
      persona_id: (state.user && state.user.persona_id) || 'gentle',
      bio: $('#setBio').value.trim(),
      email: $('#setEmail').value.trim(),
      phone: $('#setPhone').value.trim(),
      gender: $('#setGender').value,
      birthday: $('#setBirthday').value,
      theme: state.currentTheme,
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      bubble_style: document.body.dataset.bubble || 'soft',
      font_size: parseInt(getComputedStyle(document.body).getPropertyValue('--chat-size'), 10) || 15,
      reply_style: (state.user && state.user.preferences && state.user.preferences.reply_style) || 'balanced'
    };
  }

  async function saveProfile() {
    const payload = profilePayload();
    if (!payload.nickname) return UI.toast('先告诉她怎么称呼你吧', 'warn');
    if (!payload.companion_name) return UI.toast('她也需要一个名字', 'warn');
    const btn = $('#saveProfile');
    btn.disabled = true;
    try {
      const data = await LumiAPI.request('updateProfile', payload);
      if (data.user) state.user = data.user;
      if (data.state) setMood(data.state);
      $('#companionName').textContent = state.user.companion_name || '小屿';
      document.title = '心屿 · ' + (state.user.companion_name || '小屿') + '在等你';
      renderPersona();
      UI.toast('已经悄悄记下你的偏好了', 'success');
    } catch (err) {
      UI.toast(err.message || '保存失败', 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function saveProfileField(fields, message) {
    if (!state.user) return;
    const payload = Object.assign(profilePayload(), fields);
    LumiAPI.request('updateProfile', payload).then((data) => {
      if (data.user) state.user = data.user;
      if (message) UI.toast(message);
    }).catch(() => {});
  }

  async function savePreferences() {
    const preferences = {
      proactive: $('#prefProactive').getAttribute('aria-checked') === 'true',
      sound: $('#prefSound').getAttribute('aria-checked') === 'true',
      reduce_motion: $('#prefMotion').getAttribute('aria-checked') === 'true',
      tts: $('#prefTts').getAttribute('aria-checked') === 'true',
      notify: $('#prefNotify').getAttribute('aria-checked') === 'true'
    };
    try {
      const data = await LumiAPI.request('updateProfile', Object.assign(profilePayload(), { preferences: preferences }));
      if (data.user) state.user = data.user;
      if (data.state) setMood(data.state);
      UI.toast('偏好已经保存', 'success');
    } catch (err) {
      UI.toast(err.message || '保存失败', 'error');
    }
  }

  async function changePassword() {
    const oldPassword = $('#oldPassword').value;
    const newPassword = $('#newPassword').value;
    if (!oldPassword || !newPassword) return UI.toast('把两个密码都填一下吧', 'warn');
    if (newPassword.length < 6) return UI.toast('新密码至少 6 位', 'warn');
    try {
      await LumiAPI.request('changePassword', { old_password: oldPassword, new_password: newPassword });
      $('#oldPassword').value = '';
      $('#newPassword').value = '';
      UI.toast('密码已更新', 'success');
    } catch (err) {
      UI.toast(err.message || '密码没能更新', 'error');
    }
  }

  async function deleteAccount() {
    const password = await openConfirm({
      title: '真的要离开吗',
      desc: '注销后，你们的对话、收藏和情绪记录都会一起消失，且无法找回。如果只是想暂时离开，退出登录就好。',
      confirmText: '注销账号',
      danger: true,
      input: { type: 'password', placeholder: '输入密码确认' }
    });
    if (password === null) return;
    if (!password) return UI.toast('需要输入密码才能注销', 'warn');
    try {
      await LumiAPI.request('deleteAccount', { password: password });
      LumiAPI.setToken('user', '');
      UI.toast('账号已注销。愿你往后被好好接住。', 'success');
      setTimeout(() => location.replace('index.html'), 900);
    } catch (err) {
      UI.toast(err.message || '注销失败', 'error');
    }
  }

  async function submitFeedback() {
    const content = $('#feedbackContent').value.trim();
    if (content.length < 5) return UI.toast('再多写一点吧，至少 5 个字', 'warn');
    try {
      await LumiAPI.request('feedbackCreate', {
        content: content,
        category: $('#feedbackCategory').value,
        contact: $('#feedbackContact').value.trim()
      });
      $('#feedbackContent').value = '';
      UI.toast('收到啦，我会认真看的', 'success');
      fillFeedbackHistory();
    } catch (err) {
      UI.toast(err.message || '没能寄出去', 'error');
    }
  }

  async function fillFeedbackHistory() {
    try {
      const data = await LumiAPI.request('feedbackList');
      const items = data.items || [];
      const box = $('#feedbackHistory');
      if (!items.length) {
        box.innerHTML = '';
        return;
      }
      box.innerHTML = items.slice(0, 4).map((f) =>
        '<div class="feedback-item">' +
          '<div class="feedback-item-top"><span>' + UI.escapeHTML(f.category) + ' · ' + UI.formatDate(f.created_at) + '</span>' +
          '<span>' + (f.status === 'replied' ? '已回复' : '等待中') + '</span></div>' +
          '<p>' + UI.escapeHTML(f.content) + '</p>' +
          (f.reply ? '<div class="feedback-reply">' + UI.icon('mail', 12) + ' ' + UI.escapeHTML(f.reply) + '</div>' : '') +
        '</div>'
      ).join('');
    } catch (err) {
      // 静默失败，不打扰用户
    }
  }

  async function logout() {
    try {
      await LumiAPI.request('logout');
    } catch (err) {
      // 即使网络失败也清理本地 token
    }
    LumiAPI.setToken('user', '');
    location.replace('index.html?logout=1');
  }

  /* =========================================================
     通用确认弹窗
     ========================================================= */
  function openConfirm(opts) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML =
        '<div class="modal-panel" role="dialog" aria-modal="true">' +
          '<div class="modal-head"><div><h3>' + UI.escapeHTML(opts.title) + '</h3><p>' + UI.escapeHTML(opts.desc || '') + '</p></div>' +
          '<button class="modal-close" type="button" data-act="cancel" aria-label="关闭">' + UI.icon('x', 17) + '</button></div>' +
          (opts.input ? '<div class="field"><input class="input" type="' + (opts.input.type || 'text') + '" placeholder="' +
            UI.escapeHTML(opts.input.placeholder || '') + '" autocomplete="off"></div>' : '') +
          '<div class="modal-actions">' +
            '<button class="btn btn-ghost" type="button" data-act="cancel">取消</button>' +
            '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" type="button" data-act="ok">' +
              UI.escapeHTML(opts.confirmText || '确认') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      const input = wrap.querySelector('input');
      const done = (value) => {
        wrap.classList.remove('open');
        setTimeout(() => wrap.remove(), 300);
        resolve(value);
      };
      wrap.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (e.target === wrap) return done(null);
        if (!act) return;
        if (act.dataset.act === 'cancel') return done(null);
        done(input ? input.value : true);
      });
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input) done(input.value);
      });
      requestAnimationFrame(() => {
        wrap.classList.add('open');
        if (input) setTimeout(() => input.focus(), 220);
      });
    });
  }
})();
