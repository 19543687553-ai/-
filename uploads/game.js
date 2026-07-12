/**
 * 游戏主逻辑
 * @namespace Game
 */
const Game = {
  user: null,
  g: null,
  autoTimer: null,
  battleTimer: null,
  isBattling: false,
  battleWindowVisible: false,
  currentMonster: null,
  battleWin: false,
  battleStartTime: 0,
  messageInterval: null,
  autoSaveInterval: null,
  challengeCooldowns: {},
  
  newSave() {
    const grade = randomGrade();
    return {
      name: "道友",
      stage: 0,
      exp: 0,
      maxExp: CONFIG.expRequirements[0],
      age: 18,
      life: CONFIG.lifeByStage[0],
      grade: grade,
      dead: false,
      stones: 1000,
      cores: 0,
      pills: 5,
      fame: 0,
      skills: ["base"],
      herbs: { lingzhi: 0, xueying: 0, tianxin: 0, hunyuan: 0 },
      attrs: { str: 10, int: 10, vit: 10, luk: 10 },
      auto: false,
      clickLevel: 0,
      friends: [],
      chatHistory: {},
      unreadMessages: {},
      challenges: [],
      powerPills: 0,
      shopPurchased: {},
      rebirthCount: 0,
      dataVerify: {
        enabled: true,
        restricted: false,
        restrictUntil: null,
        banReason: null,
        lastStoneCheck: 0,
        lastCheckTime: Date.now()
      },
      lastChallengeTime: 0,
      lastLogoutTime: null,
      lastSaveTime: Date.now(),
      signInData: null,
      taskData: null,
      clanData: {
        clanId: null,
        clanName: null,
        contribution: 0,
        joinTime: 0,
        disciples: [],
        master: null,
        clanTasks: {},
        lastTaskReset: Date.now()
      },
      partner: null,
      partnerBond: 0,
      partnerData: {
        lastDualCultivation: 0,
        totalDual: 0,
        marriedTime: null,
        marriageCooldownEnd: null,
        lastBreakupTime: null
      },
      proposals: [],
      notifications: [],
      sadnessBuff: null,
      qingmingEvent: null
    };
  },

  // ========== 修改后的 login 方法 ==========
  login(username) {
    if (this.user) this.save();

    this.user = username;
    // 从后端加载最新数据
    Auth.loadFromServer(username).then(data => {
      if (data) {
        Auth.updateCache(username, data);
        this.g = data;
      } else {
        const cached = Auth.getUserData(username);
        if (cached) {
          this.g = cached;
        } else {
          // 极端情况：新建（通常注册已创建）
          this.g = this.newSave();
          Auth.updateCache(username, this.g);
        }
      }
      this._finishLogin(username);
    }).catch(() => {
      // 网络错误时使用缓存
      const cached = Auth.getUserData(username);
      if (cached) {
        this.g = cached;
        this._finishLogin(username);
        this.log('离线模式，数据可能不是最新', 'fail');
      } else {
        alert('无法加载数据，请检查网络');
      }
    });
  },

  // ========== 新增 _finishLogin 方法 ==========
  _finishLogin(username) {
    // 确保数据完整
    this.ensureDataStructure();

    document.getElementById('authBox').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
    document.getElementById('dispUser').textContent = username;

    UI.init();
    UI.updateStatus();
    UI.updateClickPowerDisplay();
    FriendSystem.init();
    DaoistCouple.init();
    SignInSystem.init();
    TaskSystem.init();
    if (typeof ClanSystem !== 'undefined') ClanSystem.init();
    OnlineTracker.startHeartbeat();
    AIPatrol.start();

    setTimeout(() => OfflineReward.showModal(), 500);

    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => this.save(), CONFIG.AUTO_SAVE_INTERVAL);

    if (this.g.auto && !this.g.dead) setTimeout(() => this.toggleAuto(), 1000);
    Music.init();
    this.log(`欢迎回来，${username} [${CONFIG.grades[this.g.grade].n}]`, 'system');
  },

  // ========== 新增 ensureDataStructure 方法 ==========
  ensureDataStructure() {
    const g = this.g;
    if (!g.attrs) g.attrs = { str: 10, int: 10, vit: 10, luk: 10 };
    if (g.clickLevel === undefined) g.clickLevel = 0;
    if (!Array.isArray(g.skills)) g.skills = ['base'];
    if (!g.friends) g.friends = [];
    if (!g.chatHistory) g.chatHistory = {};
    if (!g.unreadMessages) g.unreadMessages = {};
    if (!g.challenges) g.challenges = [];
    if (g.powerPills === undefined) g.powerPills = 0;
    if (!g.shopPurchased) g.shopPurchased = {};
    if (g.lastChallengeTime === undefined) g.lastChallengeTime = 0;
    if (g.cores === undefined) g.cores = 0;
    if (g.rebirthCount === undefined) g.rebirthCount = 0;
    if (g.lastLogoutTime === undefined) g.lastLogoutTime = null;
    if (g.lastSaveTime === undefined) g.lastSaveTime = Date.now();
    if (!g.dataVerify) {
      g.dataVerify = {
        enabled: true,
        restricted: false,
        restrictUntil: null,
        banReason: null,
        lastStoneCheck: g.stones || 0,
        lastCheckTime: Date.now()
      };
    }
    if (!g.clanData) {
      g.clanData = {
        clanId: null,
        clanName: null,
        contribution: 0,
        joinTime: 0,
        disciples: [],
        master: null,
        clanTasks: {},
        lastTaskReset: Date.now()
      };
    }
    if (!g.signInData) g.signInData = null;
    if (!g.taskData) g.taskData = null;
    if (!g.partner) g.partner = null;
    if (!g.partnerBond) g.partnerBond = 0;
    if (!g.partnerData) g.partnerData = { lastDualCultivation: 0, totalDual: 0, marriedTime: null, marriageCooldownEnd: null, lastBreakupTime: null };
    if (!g.proposals) g.proposals = [];
    if (!g.notifications) g.notifications = [];
    if (!g.sadnessBuff) g.sadnessBuff = null;
    if (!g.qingmingEvent) g.qingmingEvent = null;
    g.lastSaveTime = Date.now();
  },

  // ========== 修改后的 save 方法 ==========
  save() {
    if (this.user && Auth.users[this.user]) {
      try {
        this.g.lastSaveTime = Date.now();
        Auth.users[this.user].data = JSON.parse(JSON.stringify(this.g));
        Auth.save();
        // 异步保存到后端
        Auth.saveToServer(this.user, this.g).catch(e => console.log('后端保存失败:', e));
      } catch (e) {
        console.error('保存失败:', e);
      }
    }
  },

  // ========== 以下为原有方法（未改动）==========
  getMaxLife() {
    return CONFIG.lifeByStage[this.g.stage] || 999999999;
  },

  getMaxExp() {
    return CONFIG.expRequirements[this.g.stage] || Infinity;
  },

  getBreakRate() {
    if (this.g.stage >= CONFIG.realms.length - 1) return 0;
    const idx = Math.floor(this.g.stage / 3);
    let base = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25, 0.2][idx] || 0.1;
    this.g.skills.forEach(s => {
      const sk = CONFIG.skills.find(x => x.id === s);
      if (sk?.e?.bm) base += sk.e.bm;
    });
    base += (this.g.tempBreakBoost || 0);
    return Math.min(0.98, Math.max(0.01, base + (this.g.exp / this.getMaxExp()) * 0.3 * CONFIG.grades[this.g.grade].m));
  },

  xiulian() {
    if (this.g.dead || this.isBattling) return;
    if (this.g.stage < CONFIG.realms.length - 1 && this.g.exp >= this.getMaxExp()) {
      UI.log('修为已满，请突破境界！', 'fail');
      return;
    }
    
    let gain = 1;
    const clickLevel = this.g.clickLevel || 0;
    gain += clickLevel;
    
    if (typeof ClanSystem !== 'undefined' && this.g.clanData && this.g.clanData.clanId) {
      const bonus = ClanSystem.getClanBonus();
      gain = Math.floor(gain * bonus.exp);
    }
    
    this.g.exp += gain;
    
    if (typeof ClanSystem !== 'undefined') {
      ClanSystem.onDiscipleCultivate();
    }
    
    if (typeof ClanSystem !== 'undefined') {
      ClanSystem.updateTaskProgress('clan_xiulian', 1);
    }
    
    const ageCost = 0.01 + (clickLevel * 0.01);
    this.g.age += ageCost;
    
    TaskSystem.updateProgress('xiulian');
    
    if (this.g.stage === CONFIG.realms.length - 1) this.g.exp = 0;
    this.check();
    UI.updateStatus();
    this.save();
  },

  breakthrough() {
    if (this.g.dead || this.isBattling || this.g.stage >= CONFIG.realms.length - 1) return;
    if (this.g.exp < this.getMaxExp()) {
      UI.log('修为不足，无法突破！', 'fail');
      return;
    }
    
    const rate = this.getBreakRate();
    if (Math.random() < rate) {
      this.g.stage++;
      this.g.exp = 0;
      this.g.maxExp = this.getMaxExp();
      const newLife = this.getMaxLife();
      this.g.life = newLife;
      
      const realmName = CONFIG.realms[this.g.stage];
      let msg = `🎉 突破到 ${realmName}！`;
      let type = 'success';
      
      if (this.g.stage >= 10) { msg += " 你已位列仙班！"; type = 'loot'; }
      if (this.g.stage >= 16) { msg += " 超脱作者掌控！"; type = 'system'; }
      if (this.g.stage >= 20) { msg += " 进入现实世界！"; type = 'system'; }
      if (this.g.stage === 27) { msg += " 你已掌控宇宙！"; type = 'system'; }
      
      this.log(msg, type);
      
      TaskSystem.updateProgress('break', 1);
      
      const nextRebirthReq = RebirthSystem.getRequiredStage();
      if (this.g.stage === nextRebirthReq) {
        this.log(`🌀 已达到轮回条件！可以开启第${(this.g.rebirthCount || 0) + 1}次轮回`, 'system');
      }
      
      if (this.g.stage === CONFIG.realms.length - 1) {
        this.g.auto = false;
        clearInterval(this.autoTimer);
        this.log('🏆 恭喜达到最高境界！', 'system');
      }
    } else {
      const lose = Math.ceil(this.getMaxExp() * 0.05);
      this.g.exp -= lose;
      this.g.age += 1;
      this.log(`❌ 突破失败，修为-${lose}`, 'fail');
      
      if (this.g.exp < 0 && this.g.stage > 0) {
        this.g.exp = 0;
        this.g.stage--;
        this.g.maxExp = this.getMaxExp();
        this.g.life = this.getMaxLife();
        this.log('💔 境界跌落！', 'fail');
      }
    }
    
    this.g.tempBreakBoost = 0;
    
    this.check();
    UI.updateStatus();
    this.save();
  },

  generateMonster() {
    const playerStage = this.g.stage;
    let baseTier = Math.floor(playerStage * 2.5);
    baseTier = Math.max(0, Math.min(baseTier, 70));
    
    const minTier = Math.max(0, baseTier - 4);
    const maxTier = Math.min(CONFIG.beastRealms.length - 1, baseTier + 4);
    
    let tier = Math.floor(Math.random() * (maxTier - minTier + 1)) + minTier;
    const monster = CONFIG.beastRealms[tier];
    
    const myPower = PowerSystem.getPowerDetails(this.user).total;
    const monsterPower = PowerSystem.calculateBasePower(Math.floor(tier / 2.5)) * (0.8 + Math.random() * 0.4);
    const powerRatio = myPower / monsterPower;
    
    let baseDuration = Math.max(10000, 60000 - (playerStage * 1500));
    
    let durationMultiplier = 1;
    if (powerRatio < 0.3) durationMultiplier = 2.5;
    else if (powerRatio < 0.6) durationMultiplier = 1.8;
    else if (powerRatio < 0.9) durationMultiplier = 1.3;
    else if (powerRatio < 1.2) durationMultiplier = 1.0;
    else if (powerRatio < 2.0) durationMultiplier = 0.7;
    else if (powerRatio < 5.0) durationMultiplier = 0.4;
    else durationMultiplier = 0.2;
    
    let duration = Math.floor(baseDuration * durationMultiplier);
    duration = Math.max(5000, Math.min(CONFIG.BATTLE_TIMEOUT, duration));
    
    return { monster, tier, duration, powerRatio, myPower, monsterPower };
  },

  handleBattleButton() {
    if (this.g.dead) return;
    if (this.isBattling) {
      UI.showBattleModal(true);
      return;
    }
    this.startBattle();
  },

  startBattle() {
    if (this.g.dead || this.isBattling) return;
    
    const mob = this.generateMonster();
    this.isBattling = true;
    this.battleWindowVisible = true;
    this.currentMonster = mob;
    
    let winChance = 0.5;
    if (mob.powerRatio > 2) winChance = 0.95;
    else if (mob.powerRatio > 1.5) winChance = 0.85;
    else if (mob.powerRatio > 1.2) winChance = 0.75;
    else if (mob.powerRatio > 0.9) winChance = 0.55;
    else if (mob.powerRatio > 0.7) winChance = 0.4;
    else if (mob.powerRatio > 0.5) winChance = 0.25;
    else winChance = 0.1;
    
    winChance += (Math.random() * 0.1 - 0.05);
    winChance = Math.max(0.05, Math.min(0.95, winChance));
    
    this.battleWin = Math.random() < winChance;
    
    UI.showBattleModal(true, mob.monster.name, mob.powerRatio, mob.duration);
    UI.updateBattleButton(true);
    Music.playBattle();
    
    this.battleStartTime = Date.now();
    
    let diffText, diffColor;
    if (mob.powerRatio > 1.5) { diffText = '☀️ 实力碾压'; diffColor = '#00c853'; }
    else if (mob.powerRatio > 1.0) { diffText = '⬆️ 略占优势'; diffColor = '#64dd17'; }
    else if (mob.powerRatio > 0.7) { diffText = '⚠️ 势均力敌'; diffColor = '#ffd700'; }
    else if (mob.powerRatio > 0.4) { diffText = '⬇️ 处于劣势'; diffColor = '#ff8c00'; }
    else { diffText = '💀 极度危险'; diffColor = '#ff416c'; }
    
    document.getElementById('battlePowerDiff').textContent = diffText;
    document.getElementById('battlePowerDiff').style.color = diffColor;
    document.getElementById('battlePowerDiff').style.background = diffColor + '20';
    
    const timeoutTimer = setTimeout(() => {
      if (this.isBattling) {
        this.log('战斗超时，强制结束', 'system');
        this.endBattle();
      }
    }, CONFIG.BATTLE_TIMEOUT);
    
    this.battleTimer = setInterval(() => {
      const elapsed = Date.now() - this.battleStartTime;
      const left = Math.max(0, mob.duration - elapsed);
      
      const sec = Math.floor(left / 1000);
      const ms = Math.floor((left % 1000) / 10);
      document.getElementById('battleTimer').textContent = `${sec.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
      document.getElementById('battleFill').style.width = `${(elapsed / mob.duration) * 100}%`;
      
      if (left <= 0) {
        clearInterval(this.battleTimer);
        clearTimeout(timeoutTimer);
        this.endBattle();
      }
    }, 50);
  },

  closeBattleWindow() {
    this.battleWindowVisible = false;
    UI.showBattleModal(false);
    this.log('战斗收至后台...', 'system');
  },

  endBattle() {
    setTimeout(() => {
      this.isBattling = false;
      UI.showBattleModal(false);
      UI.updateBattleButton(false);
      Music.stopBattle();
      
      const mob = this.currentMonster;
      if (this.battleWin) {
        let cores = Math.floor(Math.random() * (CONFIG.battle.BASE_CORES_MAX - CONFIG.battle.BASE_CORES_MIN + 1)) + CONFIG.battle.BASE_CORES_MIN;
        
        if (mob.tier > 15) {
          cores += CONFIG.battle.HIGH_TIER_BONUS;
        }
        
        if (Math.random() < CONFIG.battle.EXTRA_CHANCE) {
          cores += Math.floor(Math.random() * 3) + 1;
        }
        
        this.g.cores += cores;
        
        let extra = '';
        if (Math.random() < 0.3) {
          this.g.pills++;
          extra += '，丹药×1';
        }
        if (mob.tier > 15) {
          this.g.herbs.hunyuan++;
          extra += '，混元果×1';
        }
        
        this.log(`战胜 ${mob.monster.name} 获得${cores}个妖核${extra}`, 'loot');
        
        if (typeof ClanSystem !== 'undefined') {
          ClanSystem.updateTaskProgress('clan_battle', 1);
        }
        
        TaskSystem.updateProgress('battle');
      } else {
        const dmg = Math.max(1, Math.floor(this.g.life * 0.05));
        this.g.life -= dmg;
        this.log(`战败于 ${mob.monster.name} 寿元-${dmg}`, 'fail');
        Game.check();
      }
      
      this.g.age += 0.5;
      this.currentMonster = null;
      UI.updateStatus();
      this.save();
    }, 500);
  },

  toggleAuto() {
    if (this.g.dead) return false;
    this.g.auto = !this.g.auto;
    
    if (this.g.auto) {
      this.xiulian();
      this.autoTimer = setInterval(() => {
        if (Game.g.auto && !Game.g.dead && !Game.isBattling) {
          Game.xiulian();
        }
      }, 1000);
      UI.log('开始自动修炼...', 'success');
    } else {
      if (this.autoTimer) {
        clearInterval(this.autoTimer);
        this.autoTimer = null;
      }
      UI.log('停止自动修炼', 'system');
    }
    
    UI.updateAutoButton();
    this.save();
    return this.g.auto;
  },

  alchemy(recipeId) {
    if (this.g.dead || this.isBattling) return;
    const r = CONFIG.recipes.find(x => x.id === recipeId);
    if (!r) return;
    
    for (let h in r.need) {
      if ((this.g.herbs[h] || 0) < r.need[h]) {
        this.log('草药不足', 'fail');
        return;
      }
    }
    
    for (let h in r.need) this.g.herbs[h] -= r.need[h];
    
    if (r.eff.pills) {
      this.g.pills += r.eff.pills;
      this.log(`炼成 ${r.n} +${r.eff.pills}`, 'success');
    }
    if (r.eff.breakRate) {
      this.g.tempBreakBoost = (this.g.tempBreakBoost || 0) + r.eff.breakRate;
      this.log(`${r.n} 突破概率+${Math.floor(r.eff.breakRate * 100)}%`, 'success');
    }
    if (r.eff.attr) {
      this.g.attrs[r.eff.attr] += r.eff.val;
      this.log(`属性提升 ${CONFIG.attrName[r.eff.attr]}+${r.eff.val}`, 'success');
    }
    
    TaskSystem.updateProgress('alchemy');
    
    UI.renderAlchemy();
    UI.renderBag();
    this.save();
  },

  explore() {
    if (this.g.dead || this.isBattling) return;
    this.g.age += 0.5;
    
    const r = Math.random();
    const luck = Math.min(this.g.attrs.luk / 100, CONFIG.explore.MAX_LUCK_BONUS);
    
    if (r < CONFIG.explore.HERB_CHANCE + luck) {
      const herbs = ['lingzhi', 'xueying', 'tianxin', 'hunyuan'];
      const h = herbs[Math.floor(Math.random() * herbs.length)];
      this.g.herbs[h]++;
      this.log(`发现${CONFIG.herbs.find(x => x.id === h).n}`, 'loot');
    } else if (r < CONFIG.explore.HERB_CHANCE + CONFIG.explore.BEAST_CHANCE + luck) {
      this.log('遭遇妖兽！', 'battle');
      this.startBattle();
    } else {
      const baseReward = CONFIG.explore.STONES_MIN + Math.random() * (CONFIG.explore.STONES_MAX - CONFIG.explore.STONES_MIN);
      const multiplier = 1 + luck;
      let reward = Math.floor(baseReward * multiplier);
      
      if (typeof ClanSystem !== 'undefined' && this.g.clanData && this.g.clanData.clanId) {
        const bonus = ClanSystem.getClanBonus();
        reward = Math.floor(reward * bonus.stones);
      }
      
      const oldStones = this.g.stones;
      this.g.stones += reward;
      
      if (DataSecurity.checkStoneAbnormal(oldStones, this.g.stones)) {
        return;
      }
      
      this.log(`探索获得 ${UI.formatNumber(reward)} 灵石 (气运加成 ${Math.floor(luck * 100)}%)`, 'loot');
    }
    
    if (typeof ClanSystem !== 'undefined') {
      ClanSystem.updateTaskProgress('clan_explore', 1);
    }
    
    TaskSystem.updateProgress('explore');
    
    this.check();
    UI.updateStatus();
    this.save();
  },

  checkStoneAbnormal(oldStones, newStones) {
    return DataSecurity.checkStoneAbnormal(oldStones, newStones);
  },

  buySkill(id) {
    if (this.g.dead || this.isBattling) {
      UI.log('当前状态不可学习功法', 'fail');
      return;
    }
    if (this.g.skills.includes(id)) {
      UI.log('已学会此功法', 'fail');
      return;
    }
    
    const skill = CONFIG.skills.find(s => s.id === id);
    if (!skill) {
      UI.log('功法不存在', 'fail');
      return;
    }
    
    if (this.g.stage < skill.tier) {
      UI.log(`境界不足！需要${CONFIG.realms[skill.tier]}期`, 'fail');
      return;
    }
    
    if (this.g.stones < skill.c) {
      UI.log(`灵石不足！需要${UI.formatNumber(skill.c)}灵石`, 'fail');
      return;
    }
    
    const successRate = CONFIG.skill.BASE_SUCCESS_RATE + (this.g.attrs.int - 10) * CONFIG.skill.INT_BONUS_PER_POINT;
    const actualRate = Math.max(0.1, Math.min(0.95, successRate));
    
    if (Math.random() > actualRate) {
      const penalty = Math.floor(skill.c * 0.3);
      this.g.stones -= penalty;
      UI.log(`🤔 领悟《${skill.n}》失败，悟性不足！消耗${UI.formatNumber(penalty)}灵石`, 'fail');
      UI.log(`成功率: ${Math.floor(actualRate * 100)}% (悟性:${this.g.attrs.int})`, 'system');
      this.save();
      return;
    }
    
    this.g.stones -= skill.c;
    this.g.skills.push(id);
    
    UI.log(`🎉 领悟《${skill.n}》成功！`, 'success');
    UI.log(`成功率: ${Math.floor(actualRate * 100)}% (悟性:${this.g.attrs.int})`, 'system');
    UI.renderSkills();
    UI.updateStatus();
    this.save();
  },

  takePill() {
    if (this.g.dead || this.isBattling) {
      UI.log('当前状态不可服用丹药', 'fail');
      return;
    }
    if (this.g.pills <= 0) {
      UI.log('没有丹药了！', 'fail');
      return;
    }
    
    this.g.pills--;
    const heal = 50 + Math.floor(Math.random() * 51) + (this.g.stage * 10);
    const maxLife = this.getMaxLife();
    const oldLife = this.g.life;
    this.g.life = Math.min(maxLife, this.g.life + heal);
    const actualHeal = Math.floor(this.g.life - oldLife);
    
    UI.log(`服用丹药恢复 ${actualHeal} 年寿元！剩余:${this.g.pills}颗`, 'success');
    UI.updateStatus();
    this.save();
  },

  check() {
    if (this.g.age >= this.g.life || this.g.life <= 0) {
      this.g.dead = true;
      this.g.auto = false;
      if (this.autoTimer) {
        clearInterval(this.autoTimer);
        this.autoTimer = null;
      }
      if (this.battleTimer) clearInterval(this.battleTimer);
      this.isBattling = false;
      UI.showBattleModal(false);
      UI.updateBattleButton(false);
      UI.updateAutoButton();
      Music.stopBattle();
      this.log('☠️ 寿元耗尽，身死道消', 'fail');
      
      this.deathRebirth();
    }
  },

  deathRebirth() {
    const oldName = this.g.name;
    
    const newSave = this.newSave();
    newSave.name = oldName;
    
    this.g = newSave;
    this.save();
    
    this.log(`🌀 重生！一切从头开始`, 'system');
    this.log(`前世的记忆已消散...`, 'system');
    
    UI.updateStatus();
    UI.renderSkills();
    UI.showRebirth(false);
    
    SignInSystem.init();
    TaskSystem.init();
    if (typeof ClanSystem !== 'undefined') {
      ClanSystem.init();
    }
    
    this.g.lastLogoutTime = null;
    this.g._lastOfflineClaim = null;
  },

  logout() {
    if (confirm('确定退出？')) {
      if (this.g) {
        this.g.lastLogoutTime = Date.now();
        this.save();
      }
      if (this.messageInterval) clearInterval(this.messageInterval);
      if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
      if (this.autoTimer) clearInterval(this.autoTimer);
      if (this.battleTimer) clearInterval(this.battleTimer);
      AIPatrol.stop();
      OnlineTracker.stopHeartbeat();
      AutoLoginManager.clearAutoLogin();
      location.reload();
    }
  },

  // 保留旧版 cleanup 用于退出
  cleanup() {
    if (this.g) {
      this.g.lastLogoutTime = Date.now();
      this.save();
    }
    if (this.messageInterval) clearInterval(this.messageInterval);
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    if (this.autoTimer) clearInterval(this.autoTimer);
    if (this.battleTimer) clearInterval(this.battleTimer);
    AIPatrol.stop();
    OnlineTracker.stopHeartbeat();
  },

  log(msg, type) {
    UI.log(msg, type);
  }
};