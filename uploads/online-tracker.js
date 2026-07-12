/**
 * ==================== 在线状态追踪系统 ====================
 * @namespace OnlineTracker
 */
const OnlineTracker = {
  heartbeatTimer: null,
  
  updateOnlineStatus(username, isOnline) {
    if (!Auth.users[username]) return;
    
    if (!Auth.users[username].onlineStatus) {
      Auth.users[username].onlineStatus = {
        isOnline: false,
        lastActive: 0,
        lastLogin: 0,
        loginCount: 0
      };
    }
    
    const status = Auth.users[username].onlineStatus;
    
    if (isOnline) {
      status.isOnline = true;
      status.lastActive = Date.now();
      if (status.lastLogin === 0) {
        status.lastLogin = Date.now();
        status.loginCount++;
      }
    } else {
      status.isOnline = false;
      status.lastActive = Date.now();
    }
    
    Auth.save();
  },
  
  startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    
    if (Game.user) {
      this.updateOnlineStatus(Game.user, true);
    }
    
    this.heartbeatTimer = setInterval(() => {
      if (Game.user) {
        this.updateOnlineStatus(Game.user, true);
      }
    }, CONFIG.ONLINE_HEARTBEAT);
  },
  
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (Game.user) {
      this.updateOnlineStatus(Game.user, false);
    }
  },
  
  isPlayerOnline(username) {
    if (!Auth.users[username]?.onlineStatus) return false;
    
    const status = Auth.users[username].onlineStatus;
    const timeSinceLastActive = Date.now() - status.lastActive;
    
    return status.isOnline && timeSinceLastActive < CONFIG.ONLINE_HEARTBEAT * 2;
  },
  
  getLastActiveTime(username) {
    if (!Auth.users[username]?.onlineStatus) return null;
    return Auth.users[username].onlineStatus.lastActive;
  },
  
  getRegisterTime(username) {
    if (!Auth.users[username]?.onlineStatus) return null;
    return Auth.users[username].onlineStatus.lastLogin;
  }
};