/**
 * 开发者工具系统
 * @namespace DevTools
 */
const DevTools = {
  currentTargetUser: null,
  
  openPassword() {
    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('devPassword').value = '';
    document.getElementById('devPassword').focus();
  },
  
  closePassword() {
    document.getElementById('passwordModal').classList.remove('active');
  },
  
  checkPassword() {
    const pwd = document.getElementById('devPassword').value;
    if (btoa(pwd) === CONFIG.DEV_PASSWORD) {
      this.closePassword();
      this.openPanel();
      UI.log('🔧 开发者工具已启动', 'system');
    } else {
      alert('密码错误！');
      this.closePassword();
    }
  },
  
  openPanel() {
    document.getElementById('devModal').classList.add('active');
    this.renderPlayerList();
    
    const toggle = document.getElementById('dataVerifyToggle');
    if (Game.g.dataVerify.enabled) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  },
  
  close() {
    document.getElementById('devModal').classList.remove('active');
  },
  
  renderPlayerList() {
    const list = document.getElementById('devPlayerList');
    const players = Object.keys(Auth.users).filter(u => u !== Game.user);
    
    if (players.length === 0) {
      list.innerHTML = '<div style="color:#888; padding:10px; text-align:center;">暂无其他玩家</div>';
      return;
    }
    
    list.innerHTML = players.map(u => `
      <div class="dev-player-item" onclick="DevTools.selectPlayer('${u}')">
        <span>${u}</span>
        <span style="color:#888; font-size:11px">${CONFIG.realms[Auth.users[u].data.stage]}</span>
      </div>
    `).join('');
  },
  
  selectPlayer(username) {
    this.currentTargetUser = username;
    document.getElementById('devTargetUser').value = username;
    document.querySelectorAll('.dev-player-item').forEach(item => item.classList.remove('selected'));
    event.target.closest('.dev-player-item')?.classList.add('selected');
  },
  
  onUsernameInput(value) {
    this.currentTargetUser = value.trim() || null;
  },
  
  getTarget() {
    return this.currentTargetUser || Game.user;
  },
  
  getTargetData() {
    const target = this.getTarget();
    return target === Game.user ? Game.g : Auth.users[target]?.data;
  },
  
  addStones() {
    const amount = parseInt(document.getElementById('devStones').value) || 0;
    if (amount <= 0) return;
    const data = this.getTargetData();
    if (data) {
      data.stones += amount;
      Game.save();
      Auth.save();
      alert(`已为 ${this.getTarget()} 增加 ${amount} 灵石`);
      UI.updateStatus();
    }
  },
  
  setStones() {
    const amount = parseInt(document.getElementById('devStones').value) || 0;
    const data = this.getTargetData();
    if (data) {
      data.stones = amount;
      Game.save();
      Auth.save();
      alert(`已设置 ${this.getTarget()} 灵石为 ${amount}`);
      UI.updateStatus();
    }
  },
  
  addExp() {
    const amount = parseInt(document.getElementById('devExp').value) || 0;
    if (amount <= 0) return;
    const data = this.getTargetData();
    if (data) {
      data.exp += amount;
      Game.save();
      Auth.save();
      alert(`已为 ${this.getTarget()} 增加 ${amount} 修为`);
      UI.updateStatus();
    }
  },
  
  setExp() {
    const amount = parseInt(document.getElementById('devExp').value) || 0;
    const data = this.getTargetData();
    if (data) {
      data.exp = amount;
      Game.save();
      Auth.save();
      alert(`已设置 ${this.getTarget()} 修为为 ${amount}`);
      UI.updateStatus();
    }
  },
  
  setLife() {
    const amount = parseInt(document.getElementById('devLife').value) || 0;
    if (amount <= 0) return;
    const data = this.getTargetData();
    if (data) {
      data.life = amount;
      Game.save();
      Auth.save();
      alert(`已设置 ${this.getTarget()} 寿元为 ${amount}`);
      UI.updateStatus();
    }
  },
  
  setPills() {
    const amount = parseInt(document.getElementById('devPills').value) || 0;
    if (amount < 0) return;
    const data = this.getTargetData();
    if (data) {
      data.pills = amount;
      Game.save();
      Auth.save();
      alert(`已设置 ${this.getTarget()} 丹药为 ${amount}`);
      UI.updateStatus();
    }
  },
  
  setStage() {
    const stage = parseInt(document.getElementById('devStage').value) || 0;
    if (stage < 0 || stage >= CONFIG.realms.length) {
      alert(`境界范围: 0-${CONFIG.realms.length - 1}`);
      return;
    }
    const data = this.getTargetData();
    if (data) {
      data.stage = stage;
      data.exp = 0;
      data.maxExp = CONFIG.expRequirements[stage];
      data.life = CONFIG.lifeByStage[stage];
      Game.save();
      Auth.save();
      alert(`已将 ${this.getTarget()} 境界设置为 ${CONFIG.realms[stage]}`);
      UI.updateStatus();
    }
  },
  
  maxAll() {
    if (!confirm('确定要一键满级吗？')) return;
    const data = this.getTargetData();
    if (data) {
      data.stage = 27;
      data.exp = 0;
      data.maxExp = Infinity;
      data.life = 1000000000;
      data.stones += 999999999;
      data.pills += 999;
      data.cores += 9999;
      data.skills = CONFIG.skills.map(s => s.id);
      Game.save();
      Auth.save();
      alert(`${this.getTarget()} 已一键满级！`);
      UI.updateStatus();
    }
  },
  
  resetAll() {
    if (!confirm('确定要重置角色吗？所有数据将清空！')) return;
    const target = this.getTarget();
    if (target === Game.user) {
      Game.cleanup();
      Game.g = Game.newSave();
    } else if (Auth.users[target]) {
      Auth.users[target].data = Game.newSave();
    }
    Game.save();
    Auth.save();
    alert(`${target} 已重置`);
    UI.updateStatus();
  },
  
  sendBroadcast() {
    const msg = sanitizeInput(document.getElementById('devBroadcast').value.trim());
    if (!msg) return;
    
    Game.log(`【全服公告】${msg}`, 'system');
    document.getElementById('devBroadcast').value = '';
    alert('公告已发送');
  },
  
  toggleDataVerify() {
    Game.g.dataVerify.enabled = !Game.g.dataVerify.enabled;
    const toggle = document.getElementById('dataVerifyToggle');
    toggle.classList.toggle('active', Game.g.dataVerify.enabled);
    alert(`数据验证已${Game.g.dataVerify.enabled ? '开启' : '关闭'}`);
    Game.save();
  },
  
  restrictPlayerAction() {
    const target = this.getTarget();
    const days = prompt(`限制 ${target} 的天数 (1-30天):`, '3');
    if (days && !isNaN(days)) {
      const d = Math.max(1, Math.min(30, parseInt(days)));
      AdminSystem.selectedPlayer = target;
      AdminSystem.restrictPlayer(d);
    }
  },
  
  unrestrictPlayer() {
    const target = this.getTarget();
    const targetData = this.getTargetData();
    if (targetData?.dataVerify?.restricted) {
      targetData.dataVerify.restricted = false;
      targetData.dataVerify.restrictUntil = null;
      Auth.save();
      alert(`${target} 已解除限制`);
      Game.log(`开发者操作: 解除了 ${target} 的限制`, 'system');
    } else {
      alert(`${target} 当前未被限制`);
    }
  }
};