/**
 * 工具函数
 */

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'&]/g, char => {
    switch(char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      case '&': return '&amp;';
      default: return char;
    }
  }).substring(0, 200);
}

function randomGrade() {
  const total = CONFIG.gradeWeights.reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  for (let i = 0; i < CONFIG.gradeWeights.length; i++) {
    random -= CONFIG.gradeWeights[i];
    if (random <= 0) return i;
  }
  return 0;
}

/**
 * 安全验证系统
 * @namespace Security
 */
const Security = {
  // 检查数值增长是否异常
  checkGrowth(username, field, oldValue, newValue) {
    if (!Game.user || username !== Game.user) return true;
    
    const gain = newValue - oldValue;
    const MAX_GAIN = {
      stones: 10000000,   // 单次最大灵石获取
      exp: 1000000,       // 单次最大修为获取
      cores: 1000,        // 单次最大妖核获取
      pills: 100          // 单次最大丹药获取
    };
    
    const maxGain = MAX_GAIN[field];
    if (maxGain && gain > maxGain) {
      console.warn(`数值异常: ${field} 增长 ${gain} 超过限制 ${maxGain}`);
      return false;
    }
    return true;
  },
  
  // 验证数值是否在合理范围内
  validateNumbers(data) {
    if (!data) return;
    
    // 限制最大数值
    if (data.stones > 9999999999) data.stones = 9999999999;
    if (data.cores > 9999999) data.cores = 9999999;
    if (data.pills > 99999) data.pills = 99999;
    if (data.exp > 999999999) data.exp = 999999999;
    if (data.life > 999999999) data.life = 999999999;
    
    // 确保不为负数
    data.stones = Math.max(0, data.stones);
    data.cores = Math.max(0, data.cores);
    data.pills = Math.max(0, data.pills);
    data.exp = Math.max(0, data.exp);
    
    return true;
  }
};