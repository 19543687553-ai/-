/**
 * 数据安全系统
 * @namespace DataSecurity
 */
const DataSecurity = {
  checkStoneAbnormal(oldStones, newStones) {
    const result = DataMonitor.checkStoneAbnormal(Game.user, oldStones, newStones);
    if (result && result.type === 'violation') {
      const days = Math.floor(Math.random() * (CONFIG.dataVerify.RESTRICT_MAX_DAYS - CONFIG.dataVerify.RESTRICT_MIN_DAYS + 1)) + CONFIG.dataVerify.RESTRICT_MIN_DAYS;
      this.restrictPlayer(days);
      return true;
    }
    return false;
  },
  
  restrictPlayer(days = 3) {
    if (!Game.g.dataVerify) {
      Game.g.dataVerify = {
        enabled: true,
        restricted: false,
        restrictUntil: null,
        banReason: null,
        lastStoneCheck: 0,
        lastCheckTime: Date.now()
      };
    }
    
    Game.g.dataVerify.restricted = true;
    Game.g.dataVerify.restrictUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
    Game.g.dataVerify.banReason = '数据异常';
    
    const originalName = Game.g.name;
    const restrictUntil = Game.g.dataVerify.restrictUntil;
    const isRestricted = true;
    
    Game.g = Game.newSave();
    Game.g.name = originalName;
    Game.g.dataVerify = {
      enabled: true,
      restricted: isRestricted,
      restrictUntil: restrictUntil,
      banReason: '数据异常',
      lastStoneCheck: 0,
      lastCheckTime: Date.now()
    };
    
    if (Game.autoTimer) clearInterval(Game.autoTimer);
    if (Game.battleTimer) clearInterval(Game.battleTimer);
    if (Game.messageInterval) clearInterval(Game.messageInterval);
    if (Game.autoSaveInterval) clearInterval(Game.autoSaveInterval);
    
    OnlineTracker.stopHeartbeat();
    
    Game.autoTimer = null;
    Game.isBattling = false;
    
    Game.save();
    Auth.save();
    
    this.showRestrictNotice(days);
    
    setTimeout(() => {
      this.forceLogout(days);
    }, 1500);
  },
  
  showRestrictNotice(days) {
    const notice = document.getElementById('restrictNotice');
    const untilSpan = document.getElementById('restrictNoticeUntil');
    const daysSpan = document.getElementById('restrictNoticeDays');
    
    const releaseTime = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
    untilSpan.textContent = `解除时间：${releaseTime.toLocaleString('zh-CN')}`;
    daysSpan.textContent = days >= 99999 ? '限制时长：永久' : `限制时长：${days}天`;
    
    notice.classList.add('active');
    
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }
  },
  
  forceLogout(days) {
    Game.cleanup();
    
    sessionStorage.setItem('justRestricted', 'true');
    sessionStorage.setItem('restrictUser', Game.user);
    sessionStorage.setItem('restrictDays', days.toString());
    sessionStorage.setItem('restrictUntil', Game.g.dataVerify.restrictUntil.toString());
    
    location.reload();
  },
  
  isPlayerRestricted() {
    if (!Game.g.dataVerify?.restricted) return false;
    
    if (Date.now() < Game.g.dataVerify.restrictUntil) {
      return true;
    } else {
      Game.g.dataVerify.restricted = false;
      Game.g.dataVerify.restrictUntil = null;
      Game.save();
      return false;
    }
  },
  
  checkJustRestricted() {
    if (sessionStorage.getItem('justRestricted') === 'true') {
      const user = sessionStorage.getItem('restrictUser');
      const days = sessionStorage.getItem('restrictDays');
      const until = parseInt(sessionStorage.getItem('restrictUntil'));
      
      if (Date.now() < until) {
        alert(`🚫 账号 ${user} 已被限制 ${days >= 99999 ? '永久' : days + '天'}！\n\n解除时间：${new Date(until).toLocaleString('zh-CN')}\n\n所有游戏数据已重置。`);
        
        setTimeout(() => {
          sessionStorage.removeItem('justRestricted');
          sessionStorage.removeItem('restrictUser');
          sessionStorage.removeItem('restrictDays');
          sessionStorage.removeItem('restrictUntil');
        }, 100);
        
        return true;
      } else {
        sessionStorage.removeItem('justRestricted');
        sessionStorage.removeItem('restrictUser');
        sessionStorage.removeItem('restrictDays');
        sessionStorage.removeItem('restrictUntil');
      }
    }
    return false;
  },
  
  showRestrictMessage(days) {
    const banner = document.getElementById('bannedBanner');
    const untilSpan = document.getElementById('banUntil');
    const releaseTime = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
    untilSpan.textContent = releaseTime.toLocaleString('zh-CN');
    banner.classList.add('active');
  },
  
  hideRestrictMessage() {
    document.getElementById('bannedBanner').classList.remove('active');
  }
};