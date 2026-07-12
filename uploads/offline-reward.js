/**
 * ==================== 离线收益系统 ====================
 * @namespace OfflineReward
 */
const OfflineReward = {
  MAX_OFFLINE_HOURS: 12,
  EXP_PER_HOUR: 100,
  STONES_PER_HOUR: 50,
  AGE_PER_HOUR: 2,
  
  pendingReward: null,
  
  /**
   * 计算离线收益
   * @returns {object|null} 收益对象或null
   */
  calculateOfflineReward() {
    if (!Game.g || !Game.g.lastLogoutTime) return null;
    
    const now = Date.now();
    const offlineTime = now - Game.g.lastLogoutTime;
    const offlineHours = Math.min(this.MAX_OFFLINE_HOURS, offlineTime / (1000 * 60 * 60));
    
    // 少于5分钟不计算
    if (offlineHours < 0.083) return null;
    
    // 计算收益
    const stageBonus = 1 + Game.g.stage * 0.1;
    const gradeBonus = CONFIG.grades[Game.g.grade].m;
    const expGain = Math.floor(offlineHours * this.EXP_PER_HOUR * stageBonus * gradeBonus);
    
    const luckBonus = 1 + Game.g.attrs.luk * 0.01;
    const stonesGain = Math.floor(offlineHours * this.STONES_PER_HOUR * luckBonus);
    
    const ageCost = Math.floor(offlineHours * this.AGE_PER_HOUR);
    
    // 上限保护
    const MAX_EXP_GAIN = 1000000;
    const MAX_STONES_GAIN = 100000;
    const MAX_AGE_COST = 500;
    
    return {
      offlineHours: offlineHours,
      offlineTimeStr: this.formatOfflineTime(offlineTime),
      exp: Math.min(expGain, MAX_EXP_GAIN),
      stones: Math.min(stonesGain, MAX_STONES_GAIN),
      age: Math.min(ageCost, MAX_AGE_COST)
    };
  },
  
  /**
   * 格式化离线时间
   * @param {number} ms - 毫秒数
   * @returns {string}
   */
  formatOfflineTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}小时${minutes}分`;
    }
    return `${minutes}分钟`;
  },
  
  /**
   * 显示离线收益弹窗
   */
  showModal() {
    const reward = this.calculateOfflineReward();
    if (!reward) return;
    
    // 关键修复：检查是否已经领取过本次离线收益
    const lastClaimed = Game.g._lastOfflineClaim || 0;
    if (Date.now() - lastClaimed < 5000) {
      console.log('离线收益已在本次会话领取过，跳过');
      return;
    }
    
    this.pendingReward = reward;
    
    document.getElementById('offlineTime').textContent = `离线时长：${reward.offlineTimeStr}`;
    document.getElementById('offlineExp').textContent = `+${UI.formatNumber(reward.exp)}`;
    document.getElementById('offlineStones').textContent = `+${UI.formatNumber(reward.stones)}`;
    document.getElementById('offlineAge').textContent = `-${reward.age}年`;
    
    document.getElementById('offlineRewardModal').classList.add('active');
  },
  
  /**
   * 领取收益
   */
  claim() {
    if (!this.pendingReward) return;
    
    const r = this.pendingReward;
    
    // 添加安全检查
    if (typeof Security !== 'undefined' && Security.checkGrowth) {
      if (!Security.checkGrowth(Game.user, 'exp', Game.g.exp, Game.g.exp + r.exp)) {
        Game.log('离线收益数值异常，已取消', 'fail');
        this.closeModal();
        this.pendingReward = null;
        return;
      }
      if (!Security.checkGrowth(Game.user, 'stones', Game.g.stones, Game.g.stones + r.stones)) {
        Game.log('离线收益数值异常，已取消', 'fail');
        this.closeModal();
        this.pendingReward = null;
        return;
      }
    }
    
    // 应用收益
    Game.g.exp += r.exp;
    Game.g.stones += r.stones;
    Game.g.age += r.age;
    
    // 数值验证
    if (typeof Security !== 'undefined' && Security.validateNumbers) {
      Security.validateNumbers(Game.g);
    }
    
    // 关键修复：标记已领取，防止重复
    Game.g._lastOfflineClaim = Date.now();
    
    // 关键修复：清除上次登出时间，防止重复领取
    Game.g.lastLogoutTime = null;
    
    // 检查突破
    let breakCount = 0;
    while (Game.g.exp >= Game.getMaxExp() && Game.g.stage < CONFIG.realms.length - 1 && breakCount < 10) {
      Game.g.exp -= Game.getMaxExp();
      Game.g.stage++;
      Game.g.maxExp = Game.getMaxExp();
      Game.g.life = Game.getMaxLife();
      Game.log(`离线突破到 ${CONFIG.realms[Game.g.stage]}！`, 'success');
      breakCount++;
    }
    
    // 数值校验
    if (typeof Security !== 'undefined' && Security.validateNumbers) {
      Security.validateNumbers(Game.g);
    }
    
    Game.check();
    Game.save();
    UI.updateStatus();
    
    Game.log(`领取离线收益：修为+${UI.formatNumber(r.exp)}，灵石+${UI.formatNumber(r.stones)}，寿元-${r.age}年`, 'success');
    
    this.closeModal();
    this.pendingReward = null;
  },
  
  /**
   * 关闭弹窗
   */
  closeModal() {
    document.getElementById('offlineRewardModal').classList.remove('active');
  },
  
  /**
   * 重置离线收益状态（用于调试）
   */
  reset() {
    if (Game.g) {
      Game.g.lastLogoutTime = null;
      Game.g._lastOfflineClaim = null;
      Game.save();
    }
  }
};

// 导出
if (typeof window !== 'undefined') {
  window.OfflineReward = OfflineReward;
}