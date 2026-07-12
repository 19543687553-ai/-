/**
 * ==================== 清明节活动系统 ====================
 * @namespace QingmingEvent
 * 活动时间：2026-03-31 17:38 ~ 2026-04-04 23:59:59
 * 活动主题：踏青祭祖，祈福纳祥
 */

const QingmingEvent = {
  // 活动时间配置
  CONFIG: {
    startTime: 1774949880000,  // 2026-03-31 17:38:00
    endTime: 1775836799000,    // 2026-04-10 23:59:59 (修正为周六)
    eventName: '清明踏青',
    themeColor: '#7CB342'
  },

  // 活动数据
  eventData: null,

  // 初始化活动
  init() {
    if (!this.isEventActive()) return;
    
    if (!Game.g.qingmingEvent) {
      Game.g.qingmingEvent = {
        ancestorWorship: 0,      // 祭祖次数
        springOuting: 0,         // 踏青次数
        willowBranches: 0,       // 柳枝收集
        paperMoney: 100,         // 纸钱数量
        qingtuan: 0,             // 青团数量
        totalDevotion: 0,        // 累计虔诚度
        rewardsClaimed: [],      // 已领取的奖励
        dailyTasks: {
          lastReset: Date.now(),
          worshipDone: false,
          outingDone: false,
          gatherDone: false
        }
      };
      Game.save();
    }
    
    this.eventData = Game.g.qingmingEvent;
    this.checkDailyReset();
    this.showEventEntrance();
  },

  // 检查活动是否进行中
  isEventActive() {
    const now = Date.now();
    return now >= this.CONFIG.startTime && now <= this.CONFIG.endTime;
  },

  // 获取剩余时间
  getRemainingTime() {
    const remaining = this.CONFIG.endTime - Date.now();
    if (remaining <= 0) return '已结束';
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}天${hours}小时`;
    if (hours > 0) return `${hours}小时${minutes}分`;
    return `${minutes}分钟`;
  },

  // 检查每日重置
  checkDailyReset() {
    const now = new Date();
    const lastReset = new Date(this.eventData.dailyTasks.lastReset);
    
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth()) {
      this.eventData.dailyTasks = {
        lastReset: Date.now(),
        worshipDone: false,
        outingDone: false,
        gatherDone: false
      };
      Game.save();
    }
  },

  // 显示活动入口
  showEventEntrance() {
    // 在签到提示旁边添加活动入口
    const existingHint = document.getElementById('signinHint');
    if (existingHint && !document.getElementById('qingmingHint')) {
      const eventHint = document.createElement('div');
      eventHint.id = 'qingmingHint';
      eventHint.className = 'qingming-hint';
      eventHint.innerHTML = `🌿 清明节活动进行中 <span class="countdown">${this.getRemainingTime()}</span>`;
            eventHint.setAttribute('tabindex', '0');
      eventHint.setAttribute('role', 'button');
      eventHint.style.cursor = 'pointer';
      eventHint.addEventListener('click', () => this.openEventPanel());
      // TV遥控器支持
      eventHint.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openEventPanel();
        }
      });  existingHint.parentNode.insertBefore(eventHint, existingHint.nextSibling);
      
      // 更新倒计时
      setInterval(() => {
        const countdown = eventHint.querySelector('.countdown');
        if (countdown) countdown.textContent = this.getRemainingTime();
      }, 60000);
    }
  },

  // ==================== 核心玩法 ====================

  // 1. 祭祖祈福 - 消耗纸钱，获得修为和虔诚度
  ancestorWorship() {
    if (!this.isEventActive()) {
      alert('活动已结束');
      return;
    }
    
    if (this.eventData.paperMoney < 10) {
      alert('纸钱不足！可通过踏青或购买获得');
      return;
    }
    
    if (this.eventData.dailyTasks.worshipDone) {
      alert('今日祭祖已完成，明天再来吧');
      return;
    }
    
    // 消耗10纸钱
    this.eventData.paperMoney -= 10;
    this.eventData.ancestorWorship++;
    
    // 奖励计算
    const baseExp = 500 + Game.g.stage * 100;
    const devotionGain = 10 + Math.floor(Math.random() * 5);
    const expGain = Math.floor(baseExp * (1 + this.eventData.totalDevotion / 100));
    
    Game.g.exp += expGain;
    this.eventData.totalDevotion += devotionGain;
    this.eventData.dailyTasks.worshipDone = true;
    
    // 随机获得青团
    if (Math.random() < 0.3) {
      this.eventData.qingtuan++;
      Game.log(`🍡 祭祖时获得青团×1！`, 'loot');
    }
    
    Game.save();
    UI.updateStatus();
    
    this.showEffect('ancestor', `虔诚度+${devotionGain}`, `修为+${UI.formatNumber(expGain)}`);
    Game.log(`🙏 祭祖祈福，虔诚度+${devotionGain}，修为+${UI.formatNumber(expGain)}`, 'success');
    
    // 检查里程碑奖励
    this.checkMilestone();
  },

  // 2. 踏青寻春 - 探索获得柳枝和纸钱
  springOuting() {
    if (!this.isEventActive()) {
      alert('活动已结束');
      return;
    }
    
    if (this.eventData.dailyTasks.outingDone) {
      alert('今日踏青已完成，明天再来吧');
      return;
    }
    
    this.eventData.springOuting++;
    this.eventData.dailyTasks.outingDone = true;
    
    // 奖励
    const willowGain = 3 + Math.floor(Math.random() * 3);
    const paperGain = 20 + Math.floor(Math.random() * 20);
    const expGain = 200 + Math.floor(Math.random() * 100);
    
    this.eventData.willowBranches += willowGain;
    this.eventData.paperMoney += paperGain;
    Game.g.exp += expGain;
    
    Game.save();
    UI.updateStatus();
    
    this.showEffect('outing', `柳枝+${willowGain}`, `纸钱+${paperGain}`);
    Game.log(`🌿 踏青寻春，采集柳枝×${willowGain}，获得纸钱×${paperGain}`, 'success');
  },

  // 3. 插柳辟邪 - 消耗柳枝兑换奖励
  plantWillow() {
    if (this.eventData.willowBranches < 5) {
      alert('柳枝不足！需要5根柳枝');
      return;
    }
    
    this.eventData.willowBranches -= 5;
    
    // 随机奖励
    const rewards = [
      { type: 'stones', val: 1000, msg: '灵石×1000' },
      { type: 'pills', val: 2, msg: '丹药×2' },
      { type: 'cores', val: 3, msg: '妖核×3' },
      { type: 'exp', val: 500, msg: '修为×500' },
      { type: 'paper', val: 50, msg: '纸钱×50' }
    ];
    
    const reward = rewards[Math.floor(Math.random() * rewards.length)];
    
    switch(reward.type) {
      case 'stones': Game.g.stones += reward.val; break;
      case 'pills': Game.g.pills += reward.val; break;
      case 'cores': Game.g.cores += reward.val; break;
      case 'exp': Game.g.exp += reward.val; break;
      case 'paper': this.eventData.paperMoney += reward.val; break;
    }
    
    Game.save();
    UI.updateStatus();
    
    this.showEffect('willow', '插柳成功', reward.msg);
    Game.log(`🌱 插柳辟邪，获得${reward.msg}！`, 'success');
  },

  // 4. 品尝青团 - 恢复寿元
  eatQingtuan() {
    if (this.eventData.qingtuan <= 0) {
      alert('没有青团了！祭祖时有机会获得');
      return;
    }
    
    this.eventData.qingtuan--;
    
    const lifeGain = 10 + Math.floor(Math.random() * 10);
    Game.g.life += lifeGain;
    
    Game.save();
    UI.updateStatus();
    
    this.showEffect('food', `寿元+${lifeGain}`, '清甜可口');
    Game.log(`🍡 品尝青团，寿元+${lifeGain}年！`, 'success');
  },

  // ==================== 里程碑奖励 ====================

  milestones: [
    { devotion: 50, reward: { stones: 5000, pills: 3 }, claimed: false },
    { devotion: 100, reward: { stones: 10000, cores: 5 }, claimed: false },
    { devotion: 200, reward: { stones: 20000, exp: 2000 }, claimed: false },
    { devotion: 500, reward: { stones: 50000, pills: 10, title: '孝感动天' }, claimed: false }
  ],

  checkMilestone() {
    this.milestones.forEach((m, idx) => {
      if (!m.claimed && this.eventData.totalDevotion >= m.devotion) {
        if (!this.eventData.rewardsClaimed.includes(idx)) {
          this.claimMilestone(idx);
        }
      }
    });
  },

  claimMilestone(index) {
    const m = this.milestones[index];
    this.eventData.rewardsClaimed.push(index);
    
    if (m.reward.stones) Game.g.stones += m.reward.stones;
    if (m.reward.pills) Game.g.pills += m.reward.pills;
    if (m.reward.cores) Game.g.cores += m.reward.cores;
    if (m.reward.exp) Game.g.exp += m.reward.exp;
    
    Game.save();
    UI.updateStatus();
    
    let rewardMsg = [];
    if (m.reward.stones) rewardMsg.push(`${UI.formatNumber(m.reward.stones)}灵石`);
    if (m.reward.pills) rewardMsg.push(`${m.reward.pills}丹药`);
    if (m.reward.cores) rewardMsg.push(`${m.reward.cores}妖核`);
    if (m.reward.exp) rewardMsg.push(`${m.reward.exp}修为`);
    if (m.reward.title) rewardMsg.push(`称号[${m.reward.title}]`);
    
    Game.log(`🎉 清明节里程碑达成！虔诚度${m.devotion}，获得${rewardMsg.join('、')}`, 'system');
    alert(`🎉 里程碑达成！\n获得：${rewardMsg.join('、')}`);
  },

  // ==================== UI界面 ====================

  openEventPanel() {
    if (!this.isEventActive()) {
      alert('活动已结束');
      return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'qingmingModal';
    modal.className = 'qingming-modal active';
    
    const devotion = this.eventData.totalDevotion;
    const milestonesHtml = this.milestones.map((m, idx) => {
      const claimed = this.eventData.rewardsClaimed.includes(idx);
      const canClaim = devotion >= m.devotion && !claimed;
      return `
        <div class="milestone-item ${claimed ? 'claimed' : ''} ${canClaim ? 'can-claim' : ''}">
          <div class="milestone-devotion">${m.devotion}</div>
          <div class="milestone-reward">
            ${m.reward.stones ? `💎${UI.formatNumber(m.reward.stones)} ` : ''}
            ${m.reward.pills ? `💊${m.reward.pills} ` : ''}
            ${m.reward.cores ? `🌀${m.reward.cores} ` : ''}
            ${m.reward.exp ? `⚡${m.reward.exp} ` : ''}
          </div>
          <div class="milestone-status">${claimed ? '✓' : (canClaim ? '可领' : '未达')}</div>
        </div>
      `;
    }).join('');
    
    modal.innerHTML = `
      <div class="qingming-window">
        <div class="qingming-header">
          <div class="qingming-back" onclick="QingmingEvent.closePanel()">←</div>
          <div class="qingming-title">🌿 清明节活动</div>
          <div class="qingming-timer">剩余：${this.getRemainingTime()}</div>
        </div>
        
        <div class="qingming-stats">
          <div class="stat-box">
            <div class="stat-icon">🙏</div>
            <div class="stat-val">${this.eventData.ancestorWorship}</div>
            <div class="stat-name">祭祖</div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🌿</div>
            <div class="stat-val">${this.eventData.springOuting}</div>
            <div class="stat-name">踏青</div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🌱</div>
            <div class="stat-val">${this.eventData.willowBranches}</div>
            <div class="stat-name">柳枝</div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">📜</div>
            <div class="stat-val">${this.eventData.paperMoney}</div>
            <div class="stat-name">纸钱</div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🍡</div>
            <div class="stat-val">${this.eventData.qingtuan}</div>
            <div class="stat-name">青团</div>
          </div>
          <div class="stat-box devotion">
            <div class="stat-icon">⭐</div>
            <div class="stat-val">${devotion}</div>
            <div class="stat-name">虔诚度</div>
          </div>
        </div>
        
        <div class="qingming-actions">
          <button class="qm-btn ${this.eventData.dailyTasks.worshipDone ? 'done' : ''}" 
                  onclick="QingmingEvent.ancestorWorship()" 
                  ${this.eventData.dailyTasks.worshipDone ? 'disabled' : ''}>
            <span class="btn-icon">🙏</span>
            <span class="btn-text">祭祖祈福</span>
            <span class="btn-cost">-10纸钱</span>
          </button>
          
          <button class="qm-btn ${this.eventData.dailyTasks.outingDone ? 'done' : ''}" 
                  onclick="QingmingEvent.springOuting()"
                  ${this.eventData.dailyTasks.outingDone ? 'disabled' : ''}>
            <span class="btn-icon">🌿</span>
            <span class="btn-text">踏青寻春</span>
            <span class="btn-cost">每日1次</span>
          </button>
          
          <button class="qm-btn" onclick="QingmingEvent.plantWillow()">
            <span class="btn-icon">🌱</span>
            <span class="btn-text">插柳辟邪</span>
            <span class="btn-cost">-5柳枝</span>
          </button>
          
          <button class="qm-btn ${this.eventData.qingtuan <= 0 ? 'disabled' : ''}" 
                  onclick="QingmingEvent.eatQingtuan()"
                  ${this.eventData.qingtuan <= 0 ? 'disabled' : ''}>
            <span class="btn-icon">🍡</span>
            <span class="btn-text">品尝青团</span>
            <span class="btn-cost">恢复寿元</span>
          </button>
        </div>
        
        <div class="milestones-section">
          <div class="section-title">⭐ 虔诚度里程碑</div>
          <div class="milestones-list">
            ${milestonesHtml}
          </div>
        </div>
        
        <div class="qingming-desc">
          <p>📝 活动说明：</p>
          <p>• 祭祖祈福：每日可祭祖1次，消耗纸钱获得修为和虔诚度</p>
          <p>• 踏青寻春：每日可踏青1次，采集柳枝和纸钱</p>
          <p>• 插柳辟邪：消耗柳枝兑换随机奖励</p>
          <p>• 青团：祭祖时概率获得，可恢复寿元</p>
          <p>• 虔诚度达到里程碑可获得丰厚奖励！</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  },

  closePanel() {
    const modal = document.getElementById('qingmingModal');
    if (modal) modal.remove();
  },

  // 特效显示
  showEffect(type, main, sub) {
    const effect = document.createElement('div');
    effect.className = `qingming-effect ${type}`;
    effect.innerHTML = `
      <div class="effect-main">${main}</div>
      <div class="effect-sub">${sub}</div>
    `;
    document.body.appendChild(effect);
    setTimeout(() => effect.remove(), 1500);
  }
};

// ==================== CSS样式 ====================

const qingmingCSS = `
.qingming-hint {
  position: fixed;
  top: 120px;
  right: 10px;
  background: linear-gradient(135deg, #7CB342, #558B2F);
  color: #fff;
  padding: 10px 15px;
  border-radius: 25px;
  font-size: 13px;
  font-weight: bold;
  z-index: 100;
  animation: qingmingPulse 2s infinite;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(124, 179, 66, 0.4);
}

@keyframes qingmingPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(124, 179, 66, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 6px 25px rgba(124, 179, 66, 0.6); }
}

.qingming-hint .countdown {
  background: rgba(0,0,0,0.3);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
  font-size: 11px;
}

.qingming-modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.95);
  z-index: 3000;
  display: none;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.qingming-modal.active { display: flex; }

.qingming-window {
  background: linear-gradient(135deg, #1a2f1a, #0d1a0d);
  border: 2px solid #7CB342;
  border-radius: 20px;
  width: 100%;
  max-width: 450px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 0 50px rgba(124, 179, 66, 0.3);
}

.qingming-header {
  display: flex;
  align-items: center;
  padding: 15px;
  background: linear-gradient(135deg, #7CB342, #558B2F);
  border-radius: 18px 18px 0 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.qingming-back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
}

.qingming-title {
  flex: 1;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}

.qingming-timer {
  background: rgba(0,0,0,0.3);
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  color: #fff;
}

.qingming-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  padding: 15px;
  background: rgba(124, 179, 66, 0.1);
}

.stat-box {
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  padding: 12px;
  text-align: center;
  border: 1px solid rgba(124, 179, 66, 0.3);
}

.stat-box.devotion {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, rgba(124, 179, 66, 0.2), rgba(85, 139, 47, 0.2));
  border-color: #7CB342;
}

.stat-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.stat-val {
  color: #7CB342;
  font-size: 20px;
  font-weight: bold;
}

.stat-name {
  color: #888;
  font-size: 11px;
}

.qingming-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 15px;
}

.qm-btn {
  background: linear-gradient(135deg, #7CB342, #558B2F);
  border: none;
  border-radius: 12px;
  padding: 15px;
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.qm-btn:active { transform: scale(0.96); }

.qm-btn.done {
  background: #444;
  opacity: 0.6;
  cursor: not-allowed;
}

.qm-btn.disabled {
  background: #333;
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon { font-size: 28px; }

.btn-text {
  font-size: 14px;
  font-weight: bold;
}

.btn-cost {
  font-size: 10px;
  opacity: 0.8;
  background: rgba(0,0,0,0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.milestones-section {
  padding: 15px;
  border-top: 1px solid rgba(124, 179, 66, 0.2);
}

.section-title {
  color: #7CB342;
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 14px;
}

.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.milestone-item {
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.3);
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(124, 179, 66, 0.2);
}

.milestone-item.claimed {
  opacity: 0.5;
  border-color: rgba(124, 179, 66, 0.5);
}

.milestone-item.can-claim {
  border-color: #7CB342;
  background: rgba(124, 179, 66, 0.1);
  animation: milestoneGlow 2s infinite;
}

@keyframes milestoneGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(124, 179, 66, 0.3); }
  50% { box-shadow: 0 0 15px rgba(124, 179, 66, 0.6); }
}

.milestone-devotion {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7CB342, #558B2F);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  margin-right: 10px;
}

.milestone-reward {
  flex: 1;
  color: #ffd700;
  font-size: 12px;
}

.milestone-status {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 10px;
  background: rgba(124, 179, 66, 0.2);
  color: #7CB342;
}

.milestone-item.claimed .milestone-status {
  background: #7CB342;
  color: #fff;
}

.qingming-desc {
  padding: 15px;
  font-size: 11px;
  color: #888;
  line-height: 1.8;
  border-top: 1px solid rgba(124, 179, 66, 0.2);
}

.qingming-desc p:first-child {
  color: #7CB342;
  font-weight: bold;
  margin-bottom: 8px;
}

/* 特效 */
.qingming-effect {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.9);
  border: 2px solid #7CB342;
  border-radius: 20px;
  padding: 30px 50px;
  text-align: center;
  z-index: 10000;
  animation: qingmingPop 1.5s ease-out forwards;
}

.qingming-effect.ancestor { border-color: #FFD700; }
.qingming-effect.outing { border-color: #7CB342; }
.qingming-effect.willow { border-color: #4CAF50; }
.qingming-effect.food { border-color: #FF9800; }

.effect-main {
  font-size: 28px;
  color: #7CB342;
  font-weight: bold;
  margin-bottom: 10px;
}

.effect-sub {
  font-size: 16px;
  color: #fff;
}

@keyframes qingmingPop {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
}
`;

// 注入CSS
const style = document.createElement('style');
style.textContent = qingmingCSS;
document.head.appendChild(style);

// 初始化
if (typeof window !== 'undefined') {
  window.QingmingEvent = QingmingEvent;
  
  // 游戏加载后初始化
  const originalLogin = Game.login;
  Game.login = function(username) {
    originalLogin.call(this, username);
    setTimeout(() => QingmingEvent.init(), 1000);
  };
}
