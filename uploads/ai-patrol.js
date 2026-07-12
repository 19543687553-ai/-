/**
 * ==================== AI巡查系统 ====================
 * @namespace AIPatrol
 */
const AIPatrol = {
  patrolTimer: null,
  isRunning: false,
  
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.patrolAll();
    
    this.patrolTimer = setInterval(() => {
      this.patrolAll();
    }, CONFIG.dataVerify.CHECK_INTERVAL);
  },
  
  stop() {
    if (this.patrolTimer) {
      clearInterval(this.patrolTimer);
      this.patrolTimer = null;
    }
    this.isRunning = false;
  },
  
  patrolAll() {
    const users = Object.keys(Auth.users);
    let violationCount = 0;
    let suspiciousCount = 0;
    
    users.forEach(username => {
      const result = DataMonitor.fullCheck(username);
      
      if (result) {
        if (result.type === 'violation') {
          violationCount++;
          this.handleViolation(username, result.reason);
        } else if (result.type === 'suspicious') {
          suspiciousCount++;
        }
      }
    });
  },
  
  handleViolation(username, reason) {
    const days = Math.floor(Math.random() * (CONFIG.dataVerify.RESTRICT_MAX_DAYS - CONFIG.dataVerify.RESTRICT_MIN_DAYS + 1)) + CONFIG.dataVerify.RESTRICT_MIN_DAYS;
    
    if (username === Game.user) {
      DataSecurity.restrictPlayer(days);
    } else {
      const userData = Auth.users[username].data;
      if (!userData.dataVerify) {
        userData.dataVerify = {
          enabled: true,
          restricted: false,
          restrictUntil: null,
          lastStoneCheck: 0,
          lastCheckTime: Date.now()
        };
      }
      
      userData.dataVerify.restricted = true;
      userData.dataVerify.restrictUntil = Date.now() + (days * 24 * 60 * 60 * 1000);
      
      const originalName = userData.name;
      Auth.users[username].data = Game.newSave();
      Auth.users[username].data.name = originalName;
      Auth.users[username].data.dataVerify = {
        enabled: true,
        restricted: true,
        restrictUntil: userData.dataVerify.restrictUntil,
        lastStoneCheck: 0,
        lastCheckTime: Date.now()
      };
      
      Auth.save();
    }
  }
};