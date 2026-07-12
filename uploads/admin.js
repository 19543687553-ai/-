/**
 * ==================== 数据管理系统（增强版） ====================
 * @namespace AdminSystem
 */
const AdminSystem = {
  isAuthenticated: false,
  selectedPlayer: null,
  currentFilter: 'all',
  searchQuery: '',
  editingPlayer: null,
  
  open() {
    const modal = document.getElementById('adminModal');
    modal.classList.add('active');
    document.getElementById('adminAuth').style.display = 'flex';
    this.isAuthenticated = false;
    document.getElementById('adminPassword').value = '';
  },
  
  close() {
    document.getElementById('adminModal').classList.remove('active');
    this.closeActionPanel();
    this.closeDetailModal();
    this.closeEditModal();
    this.isAuthenticated = false;
  },
  
  checkPassword() {
    const pwd = document.getElementById('adminPassword').value;
    if (btoa(pwd) === CONFIG.ADMIN_PASSWORD) {
      document.getElementById('adminAuth').style.display = 'none';
      this.isAuthenticated = true;
      this.refreshData();
    } else {
      alert('密码错误！');
      document.getElementById('adminPassword').value = '';
    }
  },
  
  refreshData() {
    this.updateStats();
    this.renderPlayerList();
  },
  
  updateStats() {
    const users = Auth.users;
    const total = Object.keys(users).length;
    let restricted = 0;
    let abnormal = 0;
    let online = 0;
    
    Object.keys(users).forEach(username => {
      const data = users[username].data;
      if (data.dataVerify?.restricted) restricted++;
      if (this.isAbnormal(data)) abnormal++;
      if (OnlineTracker.isPlayerOnline(username)) online++;
    });
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statRestricted').textContent = restricted;
    document.getElementById('statOnline').textContent = online;
    document.getElementById('statAbnormal').textContent = abnormal;
  },
  
  isAbnormal(data) {
    if (!data) return false;
    if (data.stones > 100000000) return true;
    if (data.stage > 20 && data.exp < 1000) return true;
    if (data.attrs && (data.attrs.str > 1000 || data.attrs.int > 1000)) return true;
    return false;
  },
  
  filter(type) {
    this.currentFilter = type;
    document.querySelectorAll('.category-tag').forEach(tag => {
      tag.classList.remove('active');
      if (tag.textContent.includes(this.getFilterText(type))) {
        tag.classList.add('active');
      }
    });
    this.renderPlayerList();
  },
  
  getFilterText(type) {
    const map = { all: '全部', normal: '正常', abnormal: '异常', restricted: '已封号', online: '在线' };
    return map[type] || '全部';
  },
  
  search() {
    this.searchQuery = document.getElementById('adminSearch').value.toLowerCase();
    this.renderPlayerList();
  },
  
  renderPlayerList() {
    const list = document.getElementById('playerList');
    const users = Auth.users;
    let html = '';
    
    Object.keys(users).forEach(username => {
      const userData = users[username];
      const data = userData.data;
      
      if (this.currentFilter !== 'all') {
        if (this.currentFilter === 'restricted' && !data.dataVerify?.restricted) return;
        if (this.currentFilter === 'normal' && (data.dataVerify?.restricted || this.isAbnormal(data))) return;
        if (this.currentFilter === 'abnormal' && !this.isAbnormal(data)) return;
        if (this.currentFilter === 'online' && !OnlineTracker.isPlayerOnline(username)) return;
      }
      
      if (this.searchQuery && !username.toLowerCase().includes(this.searchQuery)) return;
      
      const isRestricted = data.dataVerify?.restricted;
      const isAbnormal = this.isAbnormal(data);
      const isOnline = OnlineTracker.isPlayerOnline(username);
      const isSelected = this.selectedPlayer === username;
      
      let cardClass = 'player-card';
      if (isRestricted) cardClass += ' restricted';
      else if (isAbnormal) cardClass += ' abnormal';
      if (isSelected) cardClass += ' selected';
      
      const statusBadge = isRestricted ? '<span class="player-badge">已封号</span>' : 
                         isAbnormal ? '<span class="player-badge" style="background:rgba(255,193,7,0.8);color:#000">异常</span>' : 
                         isOnline ? '<span class="player-badge online">在线</span>' :
                         '<span class="player-badge normal">离线</span>';
      
      const onlineIndicator = isOnline ? '<span class="online-indicator"></span>' : '<span class="offline-indicator"></span>';
      
      const lastLogin = userData.onlineStatus?.lastLogin ? 
        new Date(userData.onlineStatus.lastLogin).toLocaleDateString('zh-CN') : '未知';
      
      html += `
        <div class="${cardClass}" onclick="AdminSystem.selectPlayer('${username}')" ondblclick="AdminSystem.openDetailModal('${username}')">
          <div class="player-header">
            <div class="player-name">${onlineIndicator}${username} ${statusBadge}</div>
            <div style="color:#888; font-size:11px;">${CONFIG.realms[data.stage]}</div>
          </div>
          <div class="player-info-grid">
            <div class="player-info-item">
              <span class="player-info-label">灵石</span>
              <span class="player-info-value" style="color:${data.stones > 1000000 ? '#ff6b6b' : '#ffd700'}">${UI.formatNumber(data.stones)}</span>
            </div>
            <div class="player-info-item">
              <span class="player-info-label">战力</span>
              <span class="player-info-value">${UI.formatNumber(PowerSystem.getPowerDetails(username).total)}</span>
            </div>
            <div class="player-info-item">
              <span class="player-info-label">寿元</span>
              <span class="player-info-value">${Math.floor(data.age)}/${Math.floor(data.life)}</span>
            </div>
            <div class="player-info-item">
              <span class="player-info-label">灵根</span>
              <span class="player-info-value" style="color:${CONFIG.grades[data.grade].c}">${CONFIG.grades[data.grade].n}</span>
            </div>
          </div>
          <div class="last-login">注册时间: ${lastLogin} | 轮回: ${data.rebirthCount || 0}次</div>
        </div>
      `;
    });
    
    if (html === '') {
      html = '<div style="text-align:center; color:#666; padding:40px;">暂无符合条件的玩家</div>';
    }
    
    list.innerHTML = html;
  },
  
  selectPlayer(username) {
    this.selectedPlayer = username;
    const userData = Auth.users[username];
    const data = userData.data;
    
    this.renderPlayerList();
    
    const panel = document.getElementById('actionPanel');
    panel.classList.add('active');
    
    document.getElementById('actionTarget').textContent = `操作对象: ${username}`;
    document.getElementById('actionCredentials').innerHTML = `
      <div style="margin-bottom:5px;"><strong>用户名:</strong> ${username}</div>
      <div><strong>状态:</strong> ${data.dataVerify?.restricted ? '已封号' : '正常'}</div>
      <div><strong>在线:</strong> ${OnlineTracker.isPlayerOnline(username) ? '是' : '否'}</div>
    `;
    
    document.getElementById('playerDetailInfo').innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div>境界: ${CONFIG.realms[data.stage]}</div>
        <div>灵石: ${UI.formatNumber(data.stones)}</div>
        <div>修为: ${UI.formatNumber(data.exp)}/${UI.formatNumber(data.maxExp)}</div>
        <div>寿元: ${Math.floor(data.life)}</div>
        <div>战力: ${UI.formatNumber(PowerSystem.getPowerDetails(username).total)}</div>
        <div>丹药: ${data.pills}颗</div>
        <div>妖核: ${data.cores || 0}个</div>
        <div>轮回: ${data.rebirthCount || 0}次</div>
        <div style="grid-column:1/-1; margin-top:5px; padding-top:5px; border-top:1px solid rgba(255,255,255,0.1);">
          属性: 力${data.attrs.str} 悟${data.attrs.int} 体${data.attrs.vit} 运${data.attrs.luk}
        </div>
      </div>
    `;
    
    document.getElementById('adjustStones').value = data.stones;
    document.getElementById('adjustStage').value = data.stage;
    document.getElementById('adjustExp').value = data.exp;
    document.getElementById('adjustLife').value = data.life;
    document.getElementById('adjustPills').value = data.pills;
    document.getElementById('adjustCores').value = data.cores || 0;
  },
  
  closeActionPanel() {
    document.getElementById('actionPanel').classList.remove('active');
    this.selectedPlayer = null;
    this.renderPlayerList();
  },
  
  openDetailModal(username) {
    this.editingPlayer = username;
    const userData = Auth.users[username];
    const data = userData.data;
    
    document.getElementById('detailTitle').textContent = `玩家详情 - ${username}`;
    
    const isOnline = OnlineTracker.isPlayerOnline(username);
    const lastActive = OnlineTracker.getLastActiveTime(username);
    const registerTime = OnlineTracker.getRegisterTime(username);
    
    let html = `
      <div class="detail-section">
        <div class="detail-section-title">📋 基本信息</div>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">用户名</div>
            <div class="detail-value">${username}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">在线状态</div>
            <div class="detail-value" style="color:${isOnline ? '#00c853' : '#888'}">${isOnline ? '在线' : '离线'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">注册时间</div>
            <div class="detail-value">${registerTime ? new Date(registerTime).toLocaleString('zh-CN') : '未知'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">最后活跃</div>
            <div class="detail-value">${lastActive ? new Date(lastActive).toLocaleString('zh-CN') : '未知'}</div>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <div class="detail-section-title">🎮 游戏数据</div>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">境界</div>
            <div class="detail-value">${CONFIG.realms[data.stage]} (第${data.stage}境界)</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">修为</div>
            <div class="detail-value">${UI.formatNumber(data.exp)}/${UI.formatNumber(data.maxExp)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">灵石</div>
            <div class="detail-value" style="color:#ffd700">${UI.formatNumber(data.stones)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">妖核</div>
            <div class="detail-value" style="color:#9400d3">${UI.formatNumber(data.cores || 0)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">丹药</div>
            <div class="detail-value">${data.pills}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">寿元</div>
            <div class="detail-value">${Math.floor(data.age)}/${Math.floor(data.life)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">灵根</div>
            <div class="detail-value" style="color:${CONFIG.grades[data.grade].c}">${CONFIG.grades[data.grade].n}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">轮回次数</div>
            <div class="detail-value" style="color:#9400d3">${data.rebirthCount || 0}次</div>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <div class="detail-section-title">⚔️ 战斗属性</div>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">总战力</div>
            <div class="detail-value" style="color:#ff6b6b">${UI.formatNumber(PowerSystem.getPowerDetails(username).total)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">力量</div>
            <div class="detail-value">${data.attrs.str}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">悟性</div>
            <div class="detail-value">${data.attrs.int}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">体质</div>
            <div class="detail-value">${data.attrs.vit}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">气运</div>
            <div class="detail-value">${data.attrs.luk}</div>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <div class="detail-section-title">📚 已学功法 (${data.skills.length}个)</div>
        <div style="font-size:12px; color:#aaa; line-height:1.8;">
          ${data.skills.map(sid => {
            const skill = CONFIG.skills.find(s => s.id === sid);
            return skill ? `<span style="color:${CONFIG.rankColors[skill.rank] || '#aaa'}">《${skill.n}》</span>` : sid;
          }).join('、')}
        </div>
      </div>
      
      <div class="detail-actions">
        <button class="detail-btn detail-btn-ban" onclick="AdminSystem.quickBan('${username}')">🚫 封号</button>
        <button class="detail-btn detail-btn-edit" onclick="AdminSystem.openEditModal('${username}')">✏️ 编辑</button>
        <button class="detail-btn detail-btn-reset" onclick="AdminSystem.quickReset('${username}')">🔄 重置</button>
        <button class="detail-btn detail-btn-delete" onclick="AdminSystem.deletePlayer('${username}')">🗑️ 删除</button>
      </div>
    `;
    
    document.getElementById('detailContent').innerHTML = html;
    document.getElementById('adminDetailModal').classList.add('active');
  },
  
  closeDetailModal() {
    document.getElementById('adminDetailModal').classList.remove('active');
    this.editingPlayer = null;
  },
  
  openEditModal(username) {
    this.editingPlayer = username;
    const data = Auth.users[username].data;
    
    document.getElementById('editFields').innerHTML = `
      <div class="edit-field">
        <label class="edit-label">灵石</label>
        <input type="number" id="editStones" class="edit-input" value="${data.stones}">
      </div>
      <div class="edit-field">
        <label class="edit-label">境界 (0-27)</label>
        <input type="number" id="editStage" class="edit-input" value="${data.stage}" min="0" max="27">
      </div>
      <div class="edit-field">
        <label class="edit-label">修为</label>
        <input type="number" id="editExp" class="edit-input" value="${data.exp}">
      </div>
      <div class="edit-field">
        <label class="edit-label">寿元</label>
        <input type="number" id="editLife" class="edit-input" value="${data.life}">
      </div>
      <div class="edit-field">
        <label class="edit-label">丹药</label>
        <input type="number" id="editPills" class="edit-input" value="${data.pills}">
      </div>
      <div class="edit-field">
        <label class="edit-label">妖核</label>
        <input type="number" id="editCores" class="edit-input" value="${data.cores || 0}">
      </div>
      <div class="edit-field">
        <label class="edit-label">轮回次数</label>
        <input type="number" id="editRebirth" class="edit-input" value="${data.rebirthCount || 0}">
      </div>
      <div class="edit-field">
        <label class="edit-label">力量</label>
        <input type="number" id="editStr" class="edit-input" value="${data.attrs.str}">
      </div>
      <div class="edit-field">
        <label class="edit-label">悟性</label>
        <input type="number" id="editInt" class="edit-input" value="${data.attrs.int}">
      </div>
      <div class="edit-field">
        <label class="edit-label">体质</label>
        <input type="number" id="editVit" class="edit-input" value="${data.attrs.vit}">
      </div>
      <div class="edit-field">
        <label class="edit-label">气运</label>
        <input type="number" id="editLuk" class="edit-input" value="${data.attrs.luk}">
      </div>
    `;
    
    document.getElementById('editPlayerModal').classList.add('active');
  },
  
  closeEditModal() {
    document.getElementById('editPlayerModal').classList.remove('active');
    this.editingPlayer = null;
  },
  
  saveEdit() {
    if (!this.editingPlayer) return;
    
    const data = Auth.users[this.editingPlayer].data;
    
    data.stones = parseInt(document.getElementById('editStones').value) || 0;
    data.stage = Math.min(27, Math.max(0, parseInt(document.getElementById('editStage').value) || 0));
    data.exp = parseInt(document.getElementById('editExp').value) || 0;
    data.life = parseInt(document.getElementById('editLife').value) || 100;
    data.pills = parseInt(document.getElementById('editPills').value) || 0;
    data.cores = parseInt(document.getElementById('editCores').value) || 0;
    data.rebirthCount = parseInt(document.getElementById('editRebirth').value) || 0;
    data.attrs.str = parseInt(document.getElementById('editStr').value) || 10;
    data.attrs.int = parseInt(document.getElementById('editInt').value) || 10;
    data.attrs.vit = parseInt(document.getElementById('editVit').value) || 10;
    data.attrs.luk = parseInt(document.getElementById('editLuk').value) || 10;
    
    data.maxExp = CONFIG.expRequirements[data.stage] || Infinity;
    
    Auth.save();
    alert(`✅ 已保存 ${this.editingPlayer} 的修改`);
    
    this.closeEditModal();
    this.closeDetailModal();
    this.refreshData();
  },
  
  quickBan(username) {
    this.selectedPlayer = username;
    this.restrictPlayer(7);
    this.closeDetailModal();
  },
  
  quickReset(username) {
    if (!confirm(`确定要重置 ${username} 的所有数据吗？`)) return;
    
    const originalName = Auth.users[username].data.name;
    Auth.users[username].data = Game.newSave();
    Auth.users[username].data.name = originalName;
    
    Auth.save();
    alert(`✅ 已重置 ${username}`);
    this.closeDetailModal();
    this.refreshData();
  },
  
  deletePlayer(username) {
    if (!confirm(`⚠️ 确定要永久删除玩家 ${username} 吗？此操作不可恢复！`)) return;
    
    delete Auth.users[username];
    Auth.save();
    alert(`✅ 已删除 ${username}`);
    this.closeDetailModal();
    this.refreshData();
  },
  
  restrictPlayer(days) {
    if (!this.selectedPlayer) return;
    if (!confirm(`确定要限制 ${this.selectedPlayer} ${days >= 99999 ? '永久' : days + '天'}吗？这将立即重置该玩家所有数据并强制下线！`)) return;
    
    const targetUser = this.selectedPlayer;
    const userData = Auth.users[targetUser];
    const data = userData.data;
    
    if (!data.dataVerify) {
      data.dataVerify = {
        enabled: true,
        restricted: false,
        restrictUntil: null,
        lastStoneCheck: 0,
        lastCheckTime: Date.now()
      };
    }
    
    const restrictUntil = days >= 99999 ? Date.now() + (100 * 365 * 24 * 60 * 60 * 1000) : Date.now() + (days * 24 * 60 * 60 * 1000);
    data.dataVerify.restricted = true;
    data.dataVerify.restrictUntil = restrictUntil;
    data.dataVerify.banReason = '管理员封号';
    
    const originalName = data.name;
    Auth.users[targetUser].data = Game.newSave();
    Auth.users[targetUser].data.name = originalName;
    Auth.users[targetUser].data.dataVerify = {
      enabled: true,
      restricted: true,
      restrictUntil: restrictUntil,
      banReason: '管理员封号',
      lastStoneCheck: 0,
      lastCheckTime: Date.now()
    };
    
    Auth.save();
    
    if (targetUser === Game.user && Game.user) {
      Game.cleanup();
      
      DataSecurity.showRestrictNotice(days);
      
      setTimeout(() => {
        DataSecurity.forceLogout(days);
      }, 2000);
      
      alert(`✅ 已限制 ${targetUser} ${days >= 99999 ? '永久' : days + '天'}，数据已清空！\n\n注意：由于你限制了当前登录的账号，系统将立即退出。`);
    } else {
      alert(`✅ 已限制 ${targetUser} ${days >= 99999 ? '永久' : days + '天'}，数据已清空！\n\n该玩家下次登录时将无法进入游戏。`);
    }
    
    this.refreshData();
    this.closeActionPanel();
  },
  
  unrestrictPlayer() {
    if (!this.selectedPlayer) return;
    const userData = Auth.users[this.selectedPlayer]?.data;
    if (!userData?.dataVerify?.restricted) {
      alert('该玩家未被限制！');
      return;
    }
    
    userData.dataVerify.restricted = false;
    userData.dataVerify.restrictUntil = null;
    userData.dataVerify.banReason = null;
    Auth.save();
    
    if (this.selectedPlayer === sessionStorage.getItem('restrictUser')) {
      sessionStorage.removeItem('justRestricted');
      sessionStorage.removeItem('restrictUser');
      sessionStorage.removeItem('restrictDays');
      sessionStorage.removeItem('restrictUntil');
    }
    
    alert(`✅ 已解除 ${this.selectedPlayer} 的限制`);
    this.refreshData();
  },
  
  setStones() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustStones').value) || 0;
    
    Auth.users[this.selectedPlayer].data.stones = val;
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 的灵石改为 ${val} 颗！`);
  },
  
  setStage() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustStage').value) || 0;
    
    const data = Auth.users[this.selectedPlayer].data;
    data.stage = val;
    data.exp = 0;
    data.maxExp = CONFIG.expRequirements[val];
    data.life = CONFIG.lifeByStage[val];
    
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 调整为${CONFIG.realms[val]}！`);
  },
  
  setExp() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustExp').value) || 0;
    
    Auth.users[this.selectedPlayer].data.exp = val;
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 的修为改为 ${val}！`);
  },
  
  setLife() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustLife').value) || 0;
    
    Auth.users[this.selectedPlayer].data.life = val;
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 的寿元改为 ${val}！`);
  },
  
  setPills() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustPills').value) || 0;
    
    Auth.users[this.selectedPlayer].data.pills = val;
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 的丹药改为 ${val} 颗！`);
  },
  
  setCores() {
    if (!this.selectedPlayer) return;
    const val = parseInt(document.getElementById('adjustCores').value) || 0;
    
    Auth.users[this.selectedPlayer].data.cores = val;
    Auth.save();
    this.refreshData();
    this.selectPlayer(this.selectedPlayer);
    alert(`✅ 已将 ${this.selectedPlayer} 的妖核改为 ${val} 个！`);
  },
  
  resetPlayer() {
    if (!this.selectedPlayer) return;
    if (!confirm(`⚠️ 确定要彻底重置 ${this.selectedPlayer} 的所有数据吗？此操作不可恢复！`)) return;
    
    const originalName = Auth.users[this.selectedPlayer].data.name;
    Auth.users[this.selectedPlayer].data = Game.newSave();
    Auth.users[this.selectedPlayer].data.name = originalName;
    
    Auth.save();
    
    if (this.selectedPlayer === Game.user) {
      alert(`✅ 已重置 ${this.selectedPlayer} 的所有数据！\n\n请重新登录。`);
      location.reload();
    } else {
      alert(`✅ 已重置 ${this.selectedPlayer} 的所有数据！`);
    }
    
    this.refreshData();
    this.closeActionPanel();
  }
};