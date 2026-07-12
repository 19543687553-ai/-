/**
 * ==================== 签到系统 ====================
 * @namespace SignInSystem
 */
const SignInSystem = {
  REWARDS: [
    { day: 1, stones: 500, pills: 1 },
    { day: 2, stones: 800, pills: 1 },
    { day: 3, stones: 1200, pills: 2 },
    { day: 4, stones: 1500, pills: 2 },
    { day: 5, stones: 2000, pills: 3 },
    { day: 6, stones: 2500, pills: 3 },
    { day: 7, stones: 5000, pills: 5, cores: 10 }
  ],
  
  init() {
    // 如果 signInData 不存在，创建新的
    if (!Game.g.signInData) {
      Game.g.signInData = {
        lastSignIn: null,
        streak: 0,
        totalDays: 0
      };
      Game.save();
    }
    this.updateHint();
  },
  
  canSignIn() {
    if (!Game.g.signInData) return true;
    const lastSignIn = Game.g.signInData.lastSignIn;
    if (!lastSignIn) return true;
    
    const lastDate = new Date(lastSignIn);
    const now = new Date();
    
    return lastDate.getDate() !== now.getDate() || 
           lastDate.getMonth() !== now.getMonth() ||
           lastDate.getFullYear() !== now.getFullYear();
  },
  
  isStreakBroken() {
    if (!Game.g.signInData?.lastSignIn) return false;
    const lastSignIn = new Date(Game.g.signInData.lastSignIn);
    const now = new Date();
    const diffDays = Math.floor((now - lastSignIn) / (1000 * 60 * 60 * 24));
    return diffDays > 1;
  },
  
  doSignIn() {
    if (!this.canSignIn()) {
      alert('今日已签到！');
      return;
    }
    
    if (!Game.g.signInData) {
      Game.g.signInData = {
        lastSignIn: null,
        streak: 0,
        totalDays: 0
      };
    }
    
    if (this.isStreakBroken()) {
      Game.g.signInData.streak = 0;
    }
    
    Game.g.signInData.streak++;
    Game.g.signInData.totalDays++;
    Game.g.signInData.lastSignIn = Date.now();
    
    const dayIndex = ((Game.g.signInData.streak - 1) % 7);
    const reward = this.REWARDS[dayIndex];
    
    Game.g.stones += reward.stones;
    Game.g.pills += reward.pills;
    if (reward.cores) {
      Game.g.cores += reward.cores;
    }
    
    Game.save();
    UI.updateStatus();
    
    let rewardMsg = `签到成功！获得 ${UI.formatNumber(reward.stones)} 灵石、${reward.pills} 颗丹药`;
    if (reward.cores) {
      rewardMsg += `、${reward.cores} 个妖核`;
    }
    Game.log(rewardMsg, 'success');
    
    this.renderCalendar();
    this.updateButton();
    this.updateHint();
  },
  
  openModal() {
    this.renderCalendar();
    this.updateButton();
    document.getElementById('signinModal').classList.add('active');
  },
  
  closeModal() {
    document.getElementById('signinModal').classList.remove('active');
  },
  
  renderCalendar() {
    const calendar = document.getElementById('signinCalendar');
    const streak = Game.g.signInData?.streak || 0;
    
    document.getElementById('signinStreak').textContent = `连续签到 ${streak} 天`;
    
    let html = '';
    for (let i = 0; i < 7; i++) {
      const dayNum = i + 1;
      const reward = this.REWARDS[i];
      const isSigned = i < (streak % 7 || (streak > 0 ? 7 : 0));
      const isToday = i === (streak % 7) && this.canSignIn();
      
      let dayClass = 'signin-day';
      if (isSigned) dayClass += ' signed';
      if (isToday) dayClass += ' today';
      
      html += `
        <div class="${dayClass}">
          <span class="day-num">${dayNum}天</span>
          <span class="day-reward">💎</span>
        </div>
      `;
    }
    calendar.innerHTML = html;
  },
  
  updateButton() {
    const btn = document.getElementById('signinBtn');
    if (this.canSignIn()) {
      btn.textContent = I18n.t('signIn') || '立即签到';
      btn.disabled = false;
    } else {
      btn.textContent = '今日已签到';
      btn.disabled = true;
    }
  },
  
  updateHint() {
    const hint = document.getElementById('signinHint');
    if (this.canSignIn()) {
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  }
};