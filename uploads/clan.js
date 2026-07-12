/**
 * ==================== 宗门系统 ====================
 * @namespace ClanSystem
 * 包含：创建宗门、宗门任务、收徒系统、AI宗门
 */

const ClanSystem = {
  // 配置
  CONFIG: {
    CREATE_COST: 1000000,          // 创建宗门所需灵石
    RENAME_CARD_PRICE: 500000,     // 改名卡价格（灵石）
    MAX_MEMBERS: 50,               // 最大宗门成员数
    MAX_DISCIPLES: 10,             // 个人最大徒弟数
    CLAN_TASK_REFRESH: 24 * 60 * 60 * 1000, // 宗门任务刷新时间（24小时）
    CLAN_LEVEL_UP_EXP: [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000],
    // 宗门等级对应加成
    CLAN_BONUS: {
      1: { exp: 0.05, stones: 0.05, battle: 0.02 },
      2: { exp: 0.10, stones: 0.10, battle: 0.05 },
      3: { exp: 0.15, stones: 0.15, battle: 0.08 },
      4: { exp: 0.20, stones: 0.20, battle: 0.12 },
      5: { exp: 0.25, stones: 0.25, battle: 0.15 },
      6: { exp: 0.30, stones: 0.30, battle: 0.18 },
      7: { exp: 0.35, stones: 0.35, battle: 0.22 },
      8: { exp: 0.40, stones: 0.40, battle: 0.26 },
      9: { exp: 0.45, stones: 0.45, battle: 0.30 },
      10: { exp: 0.50, stones: 0.50, battle: 0.35 }
    }
  },

  // 宗门任务模板
  CLAN_TASKS: [
    { id: 'clan_contribute', name: '宗门贡献', desc: '向宗门捐献灵石', target: 10000, rewardExp: 500, rewardContribution: 100, type: 'donate' },
    { id: 'clan_battle', name: '宗门降妖', desc: '斩妖10次', target: 10, rewardExp: 1000, rewardContribution: 200, type: 'battle' },
    { id: 'clan_xiulian', name: '集体修炼', desc: '修炼50次', target: 50, rewardExp: 800, rewardContribution: 150, type: 'xiulian' },
    { id: 'clan_explore', name: '秘境探索', desc: '探索20次', target: 20, rewardExp: 600, rewardContribution: 120, type: 'explore' },
    { id: 'clan_rebirth', name: '轮回感悟', desc: '轮回1次', target: 1, rewardExp: 5000, rewardContribution: 500, type: 'rebirth' }
  ],

  // AI宗门名称池
  AI_CLAN_NAMES: [
    '天道宗', '万法门', '剑神阁', '药王谷', '玄冰宫', '作者宗', '幽冥殿', '太虚观',
    '星辰海', '焚天教', '青莲剑宗', '天机楼', '百花谷', '无极宗', '乾坤派', '苍穹殿'
  ],

  // 初始化
  init() {
    if (!Game.g.clanData) {
      Game.g.clanData = {
        clanId: null,           // 所属宗门ID
        clanName: null,         // 宗门名称
        contribution: 0,        // 个人贡献值
        joinTime: 0,            // 加入时间
        disciples: [],          // 徒弟列表 { name, joinTime, level }
        master: null,           // 师父名称
        clanTasks: {},          // 个人宗门任务进度
        lastTaskReset: Date.now()
      };
      Game.save();
    }

    // 初始化全球宗门数据
    if (!window.clansData) {
      window.clansData = {
        nextId: 1,
        clans: {}
      };
      this.initAIClans();
    }

    this.checkTaskReset();
  },

  // 初始化AI宗门
  initAIClans() {
    // 随机创建3-6个AI宗门
    const aiCount = Math.floor(Math.random() * 4) + 3;
    for (let i = 0; i < aiCount; i++) {
      const name = this.AI_CLAN_NAMES[Math.floor(Math.random() * this.AI_CLAN_NAMES.length)] + (Math.floor(Math.random() * 100) + 1);
      const clanId = window.clansData.nextId++;
      window.clansData.clans[clanId] = {
        id: clanId,
        name: name,
        level: Math.floor(Math.random() * 5) + 1,
        exp: 0,
        master: 'AI宗主',
        members: [],
        createTime: Date.now(),
        isAI: true,
        announcement: '欢迎加入，一起修仙！'
      };
    }
    this.saveClansData();
  },

  // 保存宗门数据
  saveClansData() {
    try {
      localStorage.setItem('xiuxian_clans', JSON.stringify(window.clansData));
    } catch (e) {
      console.error('保存宗门数据失败', e);
    }
  },

  // 加载宗门数据
  loadClansData() {
    try {
      const saved = localStorage.getItem('xiuxian_clans');
      if (saved) {
        window.clansData = JSON.parse(saved);
      }
    } catch (e) {
      console.error('加载宗门数据失败', e);
    }
  },

  // 检查任务重置
  checkTaskReset() {
    const now = Date.now();
    const lastReset = Game.g.clanData.lastTaskReset || 0;
    if (now - lastReset >= this.CONFIG.CLAN_TASK_REFRESH) {
      // 重置宗门任务进度
      Game.g.clanData.clanTasks = {};
      this.CLAN_TASKS.forEach(task => {
        Game.g.clanData.clanTasks[task.id] = { progress: 0, claimed: false };
      });
      Game.g.clanData.lastTaskReset = now;
      Game.save();
    } else if (!Game.g.clanData.clanTasks || Object.keys(Game.g.clanData.clanTasks).length === 0) {
      // 初始化任务
      this.CLAN_TASKS.forEach(task => {
        Game.g.clanData.clanTasks[task.id] = { progress: 0, claimed: false };
      });
      Game.save();
    }
  },

  // 获取玩家所属宗门
  getPlayerClan() {
    if (!Game.g.clanData.clanId) return null;
    return window.clansData.clans[Game.g.clanData.clanId];
  },

  // 获取宗门等级加成
  getClanBonus() {
    const clan = this.getPlayerClan();
    if (!clan) return { exp: 1, stones: 1, battle: 1 };
    const level = Math.min(clan.level, 10);
    const bonus = this.CONFIG.CLAN_BONUS[level] || this.CONFIG.CLAN_BONUS[1];
    return {
      exp: 1 + bonus.exp,
      stones: 1 + bonus.stones,
      battle: 1 + bonus.battle
    };
  },

  // 创建宗门
  createClan(name) {
    // 检查是否已有宗门
    if (Game.g.clanData.clanId) {
      UI.log('你已有宗门，无法创建新宗门！', 'fail');
      return false;
    }

    name = name.trim();
    if (name.length < 2 || name.length > 12) {
      UI.log('宗门名称长度为2-12个字符', 'fail');
      return false;
    }

    // 检查灵石
    if (Game.g.stones < this.CONFIG.CREATE_COST) {
      UI.log(`灵石不足！创建宗门需要 ${UI.formatNumber(this.CONFIG.CREATE_COST)} 灵石`, 'fail');
      return false;
    }

    // 检查名称是否被AI宗门占用
    const existingClans = Object.values(window.clansData.clans);
    if (existingClans.some(c => c.name === name)) {
      UI.log('宗门名称已存在！', 'fail');
      return false;
    }

    // 扣除灵石
    Game.g.stones -= this.CONFIG.CREATE_COST;

    // 创建新宗门
    const clanId = window.clansData.nextId++;
    const newClan = {
      id: clanId,
      name: name,
      level: 1,
      exp: 0,
      master: Game.user,
      members: [{ name: Game.user, joinTime: Date.now(), contribution: 0 }],
      createTime: Date.now(),
      isAI: false,
      announcement: `欢迎加入${name}，共创辉煌！`
    };

    window.clansData.clans[clanId] = newClan;
    
    // 更新玩家宗门数据
    Game.g.clanData.clanId = clanId;
    Game.g.clanData.clanName = name;
    Game.g.clanData.contribution = 0;
    Game.g.clanData.joinTime = Date.now();
    Game.g.clanData.master = null;
    Game.g.clanData.disciples = [];

    this.saveClansData();
    Game.save();
    UI.log(`✨ 成功创建宗门【${name}】！消耗 ${UI.formatNumber(this.CONFIG.CREATE_COST)} 灵石`, 'success');
    UI.updateStatus();
    return true;
  },

  // 加入宗门
  joinClan(clanId) {
    if (Game.g.clanData.clanId) {
      UI.log('你已有宗门！', 'fail');
      return false;
    }

    const clan = window.clansData.clans[clanId];
    if (!clan) {
      UI.log('宗门不存在', 'fail');
      return false;
    }

    if (clan.members.length >= this.CONFIG.MAX_MEMBERS) {
      UI.log('宗门已满员', 'fail');
      return false;
    }

    clan.members.push({ name: Game.user, joinTime: Date.now(), contribution: 0 });
    
    Game.g.clanData.clanId = clanId;
    Game.g.clanData.clanName = clan.name;
    Game.g.clanData.contribution = 0;
    Game.g.clanData.joinTime = Date.now();

    this.saveClansData();
    Game.save();
    UI.log(`🎉 加入宗门【${clan.name}】！`, 'success');
    return true;
  },

  // 退出宗门
  leaveClan() {
    const clan = this.getPlayerClan();
    if (!clan) return false;

    if (!confirm(`确定要退出宗门【${clan.name}】吗？退出后贡献值将清零！`)) return false;

    // 移除成员
    clan.members = clan.members.filter(m => m.name !== Game.user);
    
    // 如果是宗主，转移宗主或解散
    if (clan.master === Game.user && clan.members.length > 0) {
      const newMaster = clan.members[0];
      clan.master = newMaster.name;
      UI.log(`宗主 ${Game.user} 离开宗门，宗主之位传给 ${newMaster.name}`, 'system');
    }

    // 清理玩家宗门数据
    Game.g.clanData = {
      clanId: null,
      clanName: null,
      contribution: 0,
      joinTime: 0,
      disciples: [],
      master: null,
      clanTasks: {},
      lastTaskReset: Date.now()
    };

    this.saveClansData();
    Game.save();
    UI.log(`👋 退出宗门【${clan.name}】`, 'system');
    return true;
  },

  // 宗门捐献
  donate(amount) {
    const clan = this.getPlayerClan();
    if (!clan) {
      UI.log('未加入宗门', 'fail');
      return;
    }

    if (amount <= 0) return;
    if (Game.g.stones < amount) {
      UI.log('灵石不足', 'fail');
      return;
    }

    Game.g.stones -= amount;
    
    // 增加个人贡献
    const contributionGain = Math.floor(amount / 100);
    Game.g.clanData.contribution += contributionGain;
    
    // 增加宗门经验
    const clanExpGain = Math.floor(amount / 500);
    clan.exp += clanExpGain;
    
    // 检查宗门升级
    this.checkClanLevelUp(clan);
    
    // 更新成员贡献记录
    const member = clan.members.find(m => m.name === Game.user);
    if (member) {
      member.contribution = (member.contribution || 0) + contributionGain;
    }

    // 更新宗门任务进度
    this.updateTaskProgress('clan_contribute', amount);

    this.saveClansData();
    Game.save();
    UI.updateStatus();
    UI.log(`💰 捐献 ${UI.formatNumber(amount)} 灵石，获得 ${contributionGain} 贡献值`, 'success');
  },

  // 检查宗门升级
  checkClanLevelUp(clan) {
    const nextExp = this.CONFIG.CLAN_LEVEL_UP_EXP[clan.level];
    if (nextExp && clan.exp >= nextExp && clan.level < 10) {
      clan.exp -= nextExp;
      clan.level++;
      UI.log(`🎉 宗门【${clan.name}】升级至 ${clan.level} 级！全体成员获得加成！`, 'system');
      this.saveClansData();
      // 广播给所有在线成员
      clan.members.forEach(m => {
        if (OnlineTracker.isPlayerOnline(m.name)) {
          if (Auth.users[m.name]) {
            if (!Auth.users[m.name].data.notifications) Auth.users[m.name].data.notifications = [];
            Auth.users[m.name].data.notifications.push({
              type: 'clan_upgrade',
              message: `宗门【${clan.name}】升级至 ${clan.level} 级！`,
              time: Date.now()
            });
          }
        }
      });
    }
  },

  // 更新宗门任务进度
  updateTaskProgress(taskId, amount = 1) {
    this.checkTaskReset();
    const task = Game.g.clanData.clanTasks[taskId];
    if (task && !task.claimed) {
      task.progress += amount;
      Game.save();
    }
  },

  // 领取宗门任务奖励
  claimTaskReward(taskId) {
    this.checkTaskReset();
    const task = this.CLAN_TASKS.find(t => t.id === taskId);
    const taskData = Game.g.clanData.clanTasks[taskId];
    
    if (!task || !taskData || taskData.claimed) {
      UI.log('任务已完成或已领取', 'fail');
      return false;
    }
    
    if (taskData.progress < task.target) {
      UI.log(`任务未完成！进度: ${taskData.progress}/${task.target}`, 'fail');
      return false;
    }
    
    // 发放奖励
    Game.g.exp += task.rewardExp;
    Game.g.clanData.contribution += task.rewardContribution;
    
    taskData.claimed = true;
    Game.save();
    UI.updateStatus();
    UI.log(`✅ 完成宗门任务【${task.name}】，获得 ${task.rewardExp} 修为、${task.rewardContribution} 贡献`, 'success');
    return true;
  },

  // 收徒
  takeDisciple(studentName) {
    const clan = this.getPlayerClan();
    if (!clan) {
      UI.log('未加入宗门，无法收徒', 'fail');
      return false;
    }

    if (Game.g.clanData.disciples.length >= this.CONFIG.MAX_DISCIPLES) {
      UI.log(`最多可收 ${this.CONFIG.MAX_DISCIPLES} 名徒弟`, 'fail');
      return false;
    }

    if (!Auth.users[studentName]) {
      UI.log('玩家不存在', 'fail');
      return false;
    }

    const studentData = Auth.users[studentName].data;
    if (studentData.clanData?.master) {
      UI.log('该玩家已有师父', 'fail');
      return false;
    }

    if (studentData.clanData?.clanId !== clan.id) {
      UI.log('徒弟必须加入同一宗门', 'fail');
      return false;
    }

    // 检查境界差距（师父需要比徒弟高至少3个境界）
    if (Game.g.stage < studentData.stage + 3) {
      UI.log(`境界不足！需要比徒弟高至少3个境界（当前境界: ${Game.g.stage}，徒弟境界: ${studentData.stage}）`, 'fail');
      return false;
    }

    if (!confirm(`确定要收 ${studentName} 为徒吗？`)) return false;

    // 收徒
    Game.g.clanData.disciples.push({
      name: studentName,
      joinTime: Date.now(),
      level: 0
    });

    // 设置徒弟的师父
    if (!studentData.clanData) studentData.clanData = { master: null, disciples: [] };
    studentData.clanData.master = Game.user;
    Auth.save();

    UI.log(`🎓 成功收 ${studentName} 为徒！`, 'success');
    this.saveClansData();
    return true;
  },

  // 拜师
  becomeDisciple(masterName) {
    const clan = this.getPlayerClan();
    if (!clan) {
      UI.log('未加入宗门，无法拜师', 'fail');
      return false;
    }

    if (Game.g.clanData.master) {
      UI.log('你已有师父', 'fail');
      return false;
    }

    if (!Auth.users[masterName]) {
      UI.log('玩家不存在', 'fail');
      return false;
    }

    const masterData = Auth.users[masterName].data;
    if (masterData.clanData?.clanId !== clan.id) {
      UI.log('师父必须与你同宗门', 'fail');
      return false;
    }

    // 检查境界差距
    if (masterData.stage < Game.g.stage + 3) {
      UI.log(`师父境界不足！需要比你高至少3个境界`, 'fail');
      return false;
    }

    if (!confirm(`确定要拜 ${masterName} 为师吗？`)) return false;

    // 设置师父
    Game.g.clanData.master = masterName;
    
    // 给师父添加徒弟
    if (!masterData.clanData) masterData.clanData = { master: null, disciples: [] };
    if (!masterData.clanData.disciples.some(d => d.name === Game.user)) {
      masterData.clanData.disciples.push({
        name: Game.user,
        joinTime: Date.now(),
        level: 0
      });
    }
    
    Auth.save();
    Game.save();
    UI.log(`🙏 成功拜 ${masterName} 为师！`, 'success');
    return true;
  },

  // 师徒修炼加成（徒弟修炼时师父获得收益）
  onDiscipleCultivate() {
    const master = Game.g.clanData.master;
    if (!master) return;
    
    const masterData = Auth.users[master]?.data;
    if (!masterData) return;
    
    // 徒弟修炼时师父获得10%修为
    const gain = Math.floor(1 + (Game.g.clickLevel || 0) * 0.1);
    if (masterData.exp !== undefined) {
      masterData.exp += gain;
      Auth.save();
    }
  },

  // 渲染宗门面板
  renderClanPanel() {
    const modal = document.getElementById('clanModal');
    if (!modal) return;
    
    const clan = this.getPlayerClan();
    const hasClan = !!clan;
    
    // 先显示面板，再填充内容
    modal.classList.add('active');
    
    if (!hasClan) {
      // 无宗门时显示可加入的宗门列表和创建按钮
      this.renderClanList();
      return;
    }
    
    // 有宗门时显示宗门详情
    this.renderClanDetail(clan);
  },
  
  // 渲染宗门详情
  renderClanDetail(clan) {
    const detailContainer = document.getElementById('clanDetailContainer');
    const listContainer = document.getElementById('clanListContainer');
    
    if (detailContainer) detailContainer.style.display = 'block';
    if (listContainer) listContainer.style.display = 'none';
    
    const bonus = this.getClanBonus();
    const members = clan.members || [];
    
    // 更新宗门基本信息
    const clanNameEl = document.getElementById('clanName');
    const clanLevelEl = document.getElementById('clanLevel');
    const clanMasterEl = document.getElementById('clanMaster');
    const clanMembersEl = document.getElementById('clanMembers');
    const clanExpEl = document.getElementById('clanExp');
    const clanContributionEl = document.getElementById('clanContribution');
    const clanBonusEl = document.getElementById('clanBonus');
    
    if (clanNameEl) clanNameEl.textContent = clan.name;
    if (clanLevelEl) clanLevelEl.textContent = clan.level;
    if (clanMasterEl) clanMasterEl.textContent = clan.master;
    if (clanMembersEl) clanMembersEl.textContent = `${members.length}/${this.CONFIG.MAX_MEMBERS}`;
    if (clanExpEl) clanExpEl.textContent = `${UI.formatNumber(clan.exp)}/${UI.formatNumber(this.CONFIG.CLAN_LEVEL_UP_EXP[clan.level] || 'MAX')}`;
    if (clanContributionEl) clanContributionEl.textContent = UI.formatNumber(Game.g.clanData.contribution);
    if (clanBonusEl) clanBonusEl.innerHTML = `
      修炼加成: +${(bonus.exp - 1) * 100}%<br>
      灵石加成: +${(bonus.stones - 1) * 100}%<br>
      战斗加成: +${(bonus.battle - 1) * 100}%
    `;
    
    // 渲染成员列表
    const memberList = document.getElementById('clanMemberList');
    if (memberList) {
      memberList.innerHTML = members.map(m => `
        <div class="clan-member-item">
          <span class="clan-member-name">${m.name}${m.name === clan.master ? ' (宗主)' : ''}</span>
          <span class="clan-member-contribution">贡献: ${UI.formatNumber(m.contribution || 0)}</span>
        </div>
      `).join('');
    }
    
    // 渲染师徒信息
    this.renderDiscipleInfo();
    
    // 渲染宗门任务
    this.renderClanTasks();
  },

  // 渲染可加入的宗门列表
  renderClanList() {
    const detailContainer = document.getElementById('clanDetailContainer');
    const listContainer = document.getElementById('clanListContainer');
    
    if (detailContainer) detailContainer.style.display = 'none';
    if (listContainer) listContainer.style.display = 'block';
    
    const clans = Object.values(window.clansData.clans);
    
    let html = `
      <div style="margin-bottom: 15px;">
        <button class="clan-create-btn" onclick="ClanSystem.openCreateClan()" style="width:100%; padding:12px; background:linear-gradient(135deg,#ffd700,#ff8c00); border:none; border-radius:10px; color:#000; font-weight:bold; font-size:16px; cursor:pointer;">
          ✨ 创建新宗门 (${UI.formatNumber(this.CONFIG.CREATE_COST)}灵石)
        </button>
      </div>
    `;
    
    if (clans.length === 0) {
      html += '<div style="text-align:center;color:#888;padding:20px;">暂无宗门，快去创建一个吧！</div>';
    } else {
      html += '<div style="margin-bottom:10px; color:#888; font-size:12px;">📋 现有宗门列表</div>';
      html += clans.map(clan => `
        <div class="clan-list-item">
          <div class="clan-list-name">${clan.name}</div>
          <div class="clan-list-info">等级:${clan.level} | 成员:${clan.members.length}/${this.CONFIG.MAX_MEMBERS} | 宗主:${clan.master}</div>
          <button class="clan-join-btn" onclick="ClanSystem.joinClan(${clan.id})">加入宗门</button>
        </div>
      `).join('');
    }
    
    if (listContainer) listContainer.innerHTML = html;
  },

  // 渲染师徒信息
  renderDiscipleInfo() {
    const masterName = Game.g.clanData.master;
    const disciples = Game.g.clanData.disciples || [];
    
    const masterDiv = document.getElementById('clanMasterInfo');
    const discipleList = document.getElementById('clanDiscipleList');
    
    if (masterDiv) {
      if (masterName) {
        masterDiv.innerHTML = `<span>师父: ${masterName}</span>`;
      } else {
        masterDiv.innerHTML = `<span>暂无师父</span><button class="clan-find-master" onclick="ClanSystem.showFindMaster()">寻找师父</button>`;
      }
    }
    
    if (discipleList) {
      if (disciples.length === 0) {
        discipleList.innerHTML = '<div style="color:#888;text-align:center;">暂无徒弟</div>';
      } else {
        discipleList.innerHTML = disciples.map(d => `
          <div class="clan-disciple-item">
            <span>${d.name}</span>
            <span class="clan-disciple-time">入门: ${new Date(d.joinTime).toLocaleDateString()}</span>
          </div>
        `).join('');
      }
    }
  },

  // 渲染宗门任务
  renderClanTasks() {
    const container = document.getElementById('clanTasksContainer');
    if (!container) return;
    
    this.checkTaskReset();
    let html = '';
    
    this.CLAN_TASKS.forEach(task => {
      const taskData = Game.g.clanData.clanTasks[task.id];
      if (!taskData) return;
      
      const progressPercent = Math.min(100, (taskData.progress / task.target) * 100);
      const isCompleted = taskData.progress >= task.target;
      
      html += `
        <div class="clan-task-card">
          <div class="clan-task-name">${task.name}</div>
          <div class="clan-task-desc">${task.desc}</div>
          <div class="clan-task-progress">
            <div class="clan-task-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
          <div class="clan-task-info">
            <span>进度: ${taskData.progress}/${task.target}</span>
            <span>奖励: ${task.rewardExp}修为 + ${task.rewardContribution}贡献</span>
          </div>
          <button class="clan-task-claim" onclick="ClanSystem.claimTaskReward('${task.id}')" ${taskData.claimed ? 'disabled' : (!isCompleted ? 'disabled' : '')}>
            ${taskData.claimed ? '已领取' : (isCompleted ? '领取奖励' : '进行中')}
          </button>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },

  // 显示寻找师父的界面
  showFindMaster() {
    const clan = this.getPlayerClan();
    if (!clan) {
      UI.log('未加入宗门', 'fail');
      return;
    }
    
    const candidates = clan.members
      .filter(m => m.name !== Game.user && (!Auth.users[m.name]?.data?.clanData?.disciples || Auth.users[m.name].data.clanData.disciples.length < this.CONFIG.MAX_DISCIPLES))
      .map(m => m.name);
    
    if (candidates.length === 0) {
      UI.log('当前宗门暂无适合的师父', 'fail');
      return;
    }
    
    // 简单选择框
    const masterName = prompt(`可选择师父:\n${candidates.join('\n')}\n\n请输入师父名字:`);
    if (masterName && candidates.includes(masterName)) {
      this.becomeDisciple(masterName);
    } else if (masterName) {
      UI.log('师父不在可选列表中', 'fail');
    }
  },

  // 打开宗门面板
  openClanPanel() {
    // 确保宗门数据已加载
    this.loadClansData();
    this.init();
    this.renderClanPanel();
  },

  // 关闭宗门面板
  closeClanPanel() {
    const modal = document.getElementById('clanModal');
    if (modal) modal.classList.remove('active');
  },

  // 打开创建宗门弹窗
  openCreateClan() {
    const name = prompt('请输入宗门名称（2-12个字符）:', '');
    if (name && name.trim()) {
      this.createClan(name.trim());
      // 刷新面板
      setTimeout(() => this.renderClanPanel(), 500);
    }
  },

  // 购买改名卡
  buyRenameCard() {
    if (Game.g.stones < this.CONFIG.RENAME_CARD_PRICE) {
      UI.log(`灵石不足！改名卡需要 ${UI.formatNumber(this.CONFIG.RENAME_CARD_PRICE)} 灵石`, 'fail');
      return false;
    }
    
    if (!confirm(`确定花费 ${UI.formatNumber(this.CONFIG.RENAME_CARD_PRICE)} 灵石购买【宗门改名卡】吗？`)) return false;
    
    Game.g.stones -= this.CONFIG.RENAME_CARD_PRICE;
    Game.save();
    UI.updateStatus();
    
    // 打开改名界面
    const newName = prompt('请输入新的宗门名称（2-12个字符）:', '');
    if (newName && newName.trim().length >= 2 && newName.trim().length <= 12) {
      this.renameClan(newName.trim());
    } else {
      UI.log('宗门名称无效', 'fail');
    }
    return true;
  },

  // 重命名宗门
  renameClan(newName) {
    const clan = this.getPlayerClan();
    if (!clan) {
      UI.log('未加入宗门', 'fail');
      return;
    }
    
    // 检查名称是否被占用
    const existingClans = Object.values(window.clansData.clans);
    if (existingClans.some(c => c.name === newName && c.id !== clan.id)) {
      UI.log('宗门名称已存在！', 'fail');
      return;
    }
    
    const oldName = clan.name;
    clan.name = newName;
    Game.g.clanData.clanName = newName;
    
    this.saveClansData();
    Game.save();
    UI.log(`📛 宗门【${oldName}】更名为【${newName}】`, 'success');
  }
};

// 导出到全局
if (typeof window !== 'undefined') {
  window.ClanSystem = ClanSystem;
}