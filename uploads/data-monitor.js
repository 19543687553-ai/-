/**
 * ==================== 数据异常检测系统 ====================
 * @namespace DataMonitor
 */
const DataMonitor = {
  suspiciousPlayers: new Map(),
  
  checkStoneAbnormal(username, oldStones, newStones) {
    const data = Auth.users[username]?.data;
    if (!data) return false;
    
    const gain = newStones - oldStones;
    const timeDiff = Date.now() - (data.dataVerify?.lastCheckTime || 0);
    
    if (newStones > CONFIG.dataVerify.VIOLATION_THRESHOLD) {
      return { type: 'violation', reason: '灵石超过10亿' };
    }
    
    if (newStones > CONFIG.dataVerify.SUSPICIOUS_THRESHOLD && oldStones <= CONFIG.dataVerify.SUSPICIOUS_THRESHOLD) {
      this.addSuspicious(username, '灵石超过1亿');
    }
    
    if (timeDiff < CONFIG.dataVerify.MAX_TIME_DIFF && gain > CONFIG.dataVerify.MAX_SINGLE_GAIN) {
      return { type: 'violation', reason: `短时间内获得${gain}灵石` };
    }
    
    if (newStones < 0 || isNaN(newStones)) {
      return { type: 'violation', reason: '灵石数据异常' };
    }
    
    return false;
  },
  
  checkAttrAbnormal(username) {
    const data = Auth.users[username]?.data;
    if (!data) return false;
    
    const expectedMaxAttr = 10 + data.stage * 5 + (data.rebirthCount || 0) * 10;
    const maxAttr = Math.max(data.attrs.str, data.attrs.int, data.attrs.vit, data.attrs.luk);
    
    if (maxAttr > expectedMaxAttr * 3) {
      return { type: 'violation', reason: `属性异常: ${maxAttr} > ${expectedMaxAttr * 3}` };
    }
    
    return false;
  },
  
  checkStageExpMismatch(username) {
    const data = Auth.users[username]?.data;
    if (!data) return false;
    
    if (data.stage > 10 && data.exp < data.maxExp * 0.1) {
      return { type: 'suspicious', reason: '境界与修为不匹配' };
    }
    
    return false;
  },
  
  addSuspicious(username, reason) {
    if (!this.suspiciousPlayers.has(username)) {
      this.suspiciousPlayers.set(username, { count: 0, reasons: [] });
    }
    
    const record = this.suspiciousPlayers.get(username);
    record.count++;
    record.reasons.push({ time: Date.now(), reason });
    
    if (record.count >= CONFIG.dataVerify.MAX_SUSPICIOUS_COUNT) {
      return { type: 'violation', reason: `3次怀疑: ${reason}` };
    }
    
    return { type: 'suspicious', reason };
  },
  
  fullCheck(username) {
    const data = Auth.users[username]?.data;
    if (!data) return false;
    
    const stoneCheck = this.checkStoneAbnormal(username, data.dataVerify?.lastStoneCheck || 0, data.stones);
    if (stoneCheck) return stoneCheck;
    
    const attrCheck = this.checkAttrAbnormal(username);
    if (attrCheck) return attrCheck;
    
    const stageCheck = this.checkStageExpMismatch(username);
    if (stageCheck) return stageCheck;
    
    return false;
  }
};