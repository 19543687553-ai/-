/**
 * ==================== 轮回系统 ====================
 * @namespace RebirthSystem
 */
const RebirthSystem = {
  getRequiredStage() {
    if (!Game.g) return CONFIG.rebirth.BASE_MIN_STAGE;
    const rebirthCount = Game.g.rebirthCount || 0;
    return CONFIG.rebirth.BASE_MIN_STAGE + (rebirthCount * CONFIG.rebirth.STAGE_INCREMENT);
  },
  
  canRebirth() {
    if (!Game.g) return false;
    const requiredStage = this.getRequiredStage();
    return Game.g.stage >= requiredStage && !Game.g.dead;
  },
  
  getRebirthInfo() {
    if (!Game.g) return { count: 0, bonus: 0, requiredStage: CONFIG.rebirth.BASE_MIN_STAGE };
    return {
      count: Game.g.rebirthCount || 0,
      bonus: Math.min((Game.g.rebirthCount || 0) * CONFIG.rebirth.ATTR_BONUS_PER_REBIRTH, CONFIG.rebirth.MAX_ATTR_BONUS),
      requiredStage: this.getRequiredStage()
    };
  },
  
  applyAttrBonus(baseValue) {
    const info = this.getRebirthInfo();
    return Math.floor(baseValue * (1 + info.bonus));
  },
  
  openModal() {
    const info = this.getRebirthInfo();
    const requiredStage = this.getRequiredStage();
    const canRebirth = this.canRebirth();
    
    document.getElementById('rebirthCount').textContent = info.count;
    document.getElementById('rebirthBonus').textContent = `+${(info.bonus * 100).toFixed(0)}%`;
    
    const conditionEl = document.getElementById('rebirthCondition');
    const nextReqEl = document.getElementById('nextRebirthReq');
    const btn = document.getElementById('rebirthBtn');
    
    if (info.count === 0) {
      conditionEl.innerHTML = `<strong>开启条件：</strong>达到${CONFIG.realms[CONFIG.rebirth.BASE_MIN_STAGE]}（第${CONFIG.rebirth.BASE_MIN_STAGE}境界）`;
    } else {
      conditionEl.innerHTML = `<strong>开启条件：</strong>达到${CONFIG.realms[requiredStage]}（第${requiredStage}境界）`;
    }
    
    if (canRebirth) {
      nextReqEl.textContent = `✅ 已满足轮回条件！`;
      nextReqEl.style.color = '#00c853';
      btn.disabled = false;
      btn.textContent = '确认轮回';
    } else {
      nextReqEl.textContent = `❌ 还需达到 ${CONFIG.realms[requiredStage]}（当前: ${CONFIG.realms[Game.g.stage]}）`;
      nextReqEl.style.color = '#ff6b6b';
      btn.disabled = true;
      btn.textContent = '条件不足';
    }
    
    document.getElementById('rebirthModal').classList.add('active');
  },
  
  closeModal() {
    document.getElementById('rebirthModal').classList.remove('active');
  },
  
  confirmRebirth() {
    if (!this.canRebirth()) {
      UI.log('未达到轮回条件！', 'fail');
      this.closeModal();
      return;
    }
    
    // 播放闪电音效（会暂停当前音乐，播放完后再恢复）
    if (Music && Music.playThunderWithPause) {
      Music.playThunderWithPause();
    }
    
    // 添加屏幕闪光效果
    this.addFlashEffect();
    
    const oldRebirthCount = Game.g.rebirthCount || 0;
    const oldCores = Game.g.cores || 0;
    const oldStones = Game.g.stones;
    const oldSkills = [...(Game.g.skills || [])];
    const oldName = Game.g.name;
    const oldFriends = Game.g.friends || [];
    const oldChatHistory = Game.g.chatHistory || {};
    
    // 保留签到和任务数据（不重置）
    const oldSignInData = Game.g.signInData ? JSON.parse(JSON.stringify(Game.g.signInData)) : null;
    const oldTaskData = Game.g.taskData ? JSON.parse(JSON.stringify(Game.g.taskData)) : null;
    
    // 保留传说及以上品质功法
    const keepSkills = oldSkills.filter(sid => {
      const skill = CONFIG.skills.find(s => s.id === sid);
      return skill && ['legendary', 'mythic', 'god'].includes(skill.rank);
    });
    
    // 保留50%灵石
    const keepStones = Math.floor(oldStones * CONFIG.rebirth.KEEP_STONES_RATIO);
    
    // 创建新角色
    const newSave = Game.newSave();
    
    // 继承数据
    newSave.name = oldName;
    newSave.stones = keepStones;
    newSave.cores = oldCores;
    newSave.skills = keepSkills.length > 0 ? keepSkills : ['base'];
    newSave.rebirthCount = oldRebirthCount + 1;
    newSave.friends = oldFriends;
    newSave.chatHistory = oldChatHistory;
    
    // 保留签到和任务数据（不重置）
    newSave.signInData = oldSignInData;
    newSave.taskData = oldTaskData;
    
    // 保留数据验证状态
    if (Game.g.dataVerify) {
      newSave.dataVerify = Game.g.dataVerify;
      newSave.dataVerify.restricted = false;
      newSave.dataVerify.restrictUntil = null;
    }
    
    // 轮回属性加成
    const bonus = Math.min(newSave.rebirthCount * CONFIG.rebirth.ATTR_BONUS_PER_REBIRTH, CONFIG.rebirth.MAX_ATTR_BONUS);
    newSave.attrs.str = this.applyAttrBonus(newSave.attrs.str);
    newSave.attrs.int = this.applyAttrBonus(newSave.attrs.int);
    newSave.attrs.vit = this.applyAttrBonus(newSave.attrs.vit);
    newSave.attrs.luk = this.applyAttrBonus(newSave.attrs.luk);
    
    Game.g = newSave;
    
    if (Game.autoTimer) {
      clearInterval(Game.autoTimer);
      Game.autoTimer = null;
    }
    Game.g.auto = false;
    
    Game.save();
    
    // 重新初始化（但数据已保留）
    SignInSystem.init();
    TaskSystem.init();
    
    const nextRequiredStage = this.getRequiredStage();
    
    // 延迟显示日志，让音效先播放
    setTimeout(() => {
      UI.log(`🌀 轮回成功！第${newSave.rebirthCount}次轮回，属性加成+${(bonus * 100).toFixed(0)}%`, 'system');
      UI.log(`⚡ 天雷滚滚，轮回转世！`, 'system');
      UI.log(`保留了 ${UI.formatNumber(keepStones)} 灵石、${oldCores} 妖核、${keepSkills.length} 个高级功法`, 'success');
      UI.log(`下次轮回需要达到: ${CONFIG.realms[nextRequiredStage]}`, 'system');
      UI.log(`📅 签到和任务进度已保留！`, 'system');
    }, 100);
    
    this.closeModal();
    UI.updateStatus();
    UI.renderSkills();
    UI.updateClickPowerDisplay();
    
    // 重置离线收益标记
    Game.g.lastLogoutTime = null;
    Game.g._lastOfflineClaim = null;
    
    // 移除闪光效果
    setTimeout(() => {
      this.removeFlashEffect();
    }, 500);
  },
  
  addFlashEffect() {
    const flashDiv = document.createElement('div');
    flashDiv.id = 'thunderFlash';
    flashDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      opacity: 0;
      pointer-events: none;
      z-index: 10000;
      transition: opacity 0.1s ease;
    `;
    document.body.appendChild(flashDiv);
    
    setTimeout(() => {
      flashDiv.style.opacity = '0.8';
      setTimeout(() => {
        flashDiv.style.opacity = '0';
        setTimeout(() => {
          if (flashDiv && flashDiv.remove) {
            flashDiv.remove();
          }
        }, 300);
      }, 100);
    }, 10);
  },
  
  removeFlashEffect() {
    const flash = document.getElementById('thunderFlash');
    if (flash && flash.remove) {
      flash.remove();
    }
  }
};