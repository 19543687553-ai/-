/**
 * ==================== 任务系统 ====================
 * @namespace TaskSystem
 */
const TaskSystem = {
  DAILY_TASKS: [
    { id: 'xiulian', name: '勤修苦练', desc: '修炼10次', target: 10, reward: { stones: 500, exp: 100 } },
    { id: 'battle', name: '斩妖除魔', desc: '斩妖3次', target: 3, reward: { stones: 800, cores: 2 } },
    { id: 'alchemy', name: '炼丹大师', desc: '炼丹2次', target: 2, reward: { stones: 300, pills: 1 } },
    { id: 'explore', name: '探索秘境', desc: '探索5次', target: 5, reward: { stones: 600, exp: 200 } }
  ],
  
  WEEKLY_TASKS: [
    { id: 'week_xiulian', name: '百日筑基', desc: '累计修炼100次', target: 100, reward: { stones: 5000, pills: 5 } },
    { id: 'week_battle', name: '妖魔克星', desc: '累计斩妖20次', target: 20, reward: { stones: 3000, cores: 10 } },
    { id: 'week_break', name: '突破自我', desc: '突破境界1次', target: 1, reward: { stones: 10000, exp: 1000 } }
  ],
  
  init() {
    // 如果 taskData 不存在，创建新的
    if (!Game.g.taskData) {
      Game.g.taskData = {
        daily: {},
        weekly: {},
        lastReset: Date.now()
      };
      this.resetDailyTasks();
      this.resetWeeklyTasks();
      Game.save();
    }
    this.checkReset();
  },
  
  checkReset() {
    const now = new Date();
    const lastReset = new Date(Game.g.taskData.lastReset);
    
    // 检查是否需要重置每日任务
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() ||
        now.getFullYear() !== lastReset.getFullYear()) {
      this.resetDailyTasks();
    }
    
    // 检查是否需要重置每周任务
    const weekDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24 * 7));
    if (weekDiff >= 1) {
      this.resetWeeklyTasks();
    }
  },
  
  resetDailyTasks() {
    if (!Game.g.taskData.daily) Game.g.taskData.daily = {};
    this.DAILY_TASKS.forEach(task => {
      Game.g.taskData.daily[task.id] = { progress: 0, claimed: false };
    });
    Game.g.taskData.lastReset = Date.now();
    Game.save();
  },
  
  resetWeeklyTasks() {
    if (!Game.g.taskData.weekly) Game.g.taskData.weekly = {};
    this.WEEKLY_TASKS.forEach(task => {
      Game.g.taskData.weekly[task.id] = { progress: 0, claimed: false };
    });
    Game.save();
  },
  
  updateProgress(taskId, amount = 1) {
    this.checkReset();
    
    if (Game.g.taskData.daily[taskId] && !Game.g.taskData.daily[taskId].claimed) {
      Game.g.taskData.daily[taskId].progress += amount;
      Game.save();
    }
    
    if (Game.g.taskData.weekly[taskId] && !Game.g.taskData.weekly[taskId].claimed) {
      Game.g.taskData.weekly[taskId].progress += amount;
      Game.save();
    }
  },
  
  claimReward(taskId, isWeekly = false) {
    this.checkReset();
    
    const taskList = isWeekly ? this.WEEKLY_TASKS : this.DAILY_TASKS;
    const taskData = isWeekly ? Game.g.taskData.weekly : Game.g.taskData.daily;
    const task = taskList.find(t => t.id === taskId);
    
    if (!task || !taskData[taskId] || taskData[taskId].claimed) return false;
    if (taskData[taskId].progress < task.target) return false;
    
    if (task.reward.stones) Game.g.stones += task.reward.stones;
    if (task.reward.exp) Game.g.exp += task.reward.exp;
    if (task.reward.pills) Game.g.pills += task.reward.pills;
    if (task.reward.cores) Game.g.cores += task.reward.cores;
    
    taskData[taskId].claimed = true;
    Game.save();
    UI.updateStatus();
    
    const rewardMsg = [];
    if (task.reward.stones) rewardMsg.push(`${task.reward.stones}灵石`);
    if (task.reward.exp) rewardMsg.push(`${task.reward.exp}修为`);
    if (task.reward.pills) rewardMsg.push(`${task.reward.pills}丹药`);
    if (task.reward.cores) rewardMsg.push(`${task.reward.cores}妖核`);
    
    Game.log(`完成任务[${task.name}]，获得 ${rewardMsg.join('、')}`, 'success');
    return true;
  },
  
  render() {
    this.checkReset();
    const container = document.getElementById('taskPage');
    
    let html = '';
    
    html += '<div class="task-section">';
    html += '<div class="task-section-title">📅 每日任务</div>';
    this.DAILY_TASKS.forEach(task => {
      const data = Game.g.taskData.daily[task.id] || { progress: 0, claimed: false };
      const isCompleted = data.progress >= task.target;
      html += this.renderTaskCard(task, data, isCompleted, false);
    });
    html += '</div>';
    
    html += '<div class="task-section">';
    html += '<div class="task-section-title">📆 每周任务</div>';
    this.WEEKLY_TASKS.forEach(task => {
      const data = Game.g.taskData.weekly[task.id] || { progress: 0, claimed: false };
      const isCompleted = data.progress >= task.target;
      html += this.renderTaskCard(task, data, isCompleted, true);
    });
    html += '</div>';
    
    container.innerHTML = html;
  },
  
  renderTaskCard(task, data, isCompleted, isWeekly) {
    const progressPercent = Math.min(100, (data.progress / task.target) * 100);
    const rewardText = [];
    if (task.reward.stones) rewardText.push(`💎${task.reward.stones}`);
    if (task.reward.exp) rewardText.push(`⚡${task.reward.exp}`);
    if (task.reward.pills) rewardText.push(`💊${task.reward.pills}`);
    if (task.reward.cores) rewardText.push(`🌀${task.reward.cores}`);
    
    return `
      <div class="task-card ${data.claimed ? 'completed' : ''}">
        <div class="task-header">
          <span class="task-name">${task.name}</span>
          <span class="task-status ${data.claimed ? 'completed' : ''}">${data.claimed ? '已完成' : `${data.progress}/${task.target}`}</span>
        </div>
        <div class="task-desc">${task.desc}</div>
        <div class="task-progress">
          <div class="task-progress-bar ${isCompleted ? 'completed' : ''}" style="width: ${progressPercent}%"></div>
        </div>
        <div class="task-reward">
          <span class="task-reward-text">${rewardText.join(' ')}</span>
          <button class="task-claim-btn" 
                  onclick="TaskSystem.claimReward('${task.id}', ${isWeekly}); UI.switchTab('task')"
                  ${!isCompleted || data.claimed ? 'disabled' : ''}>
            ${data.claimed ? '已领取' : '领取'}
          </button>
        </div>
      </div>
    `;
  }
};