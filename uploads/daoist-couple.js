/**
 * ==================== 道侣系统（增强版） ====================
 * @namespace DaoistCouple
 * 结为道侣，双修共进，获得属性加成
 */
const DaoistCouple = {
  // 双修配置
  DUAL_CULTIVATION: {
    cooldown: 24 * 60 * 60 * 1000,  // 24小时冷却（现实中的一天）
    baseExp: 1000,                   // 基础修为
    bondBonus: 0.01,                // 每点羁绊值加成1%
    maxBond: 10000,                // 最大羁绊值提升到10000
    ageCost: 0.5,                   // 消耗寿元
    minBondForDual: 6000,          // 相爱等级最低羁绊值
    maxPowerDiff: 50000            // 最大实力差5万
  },
  
  // 羁绊等级
  BOND_LEVELS: [
    { name: '初识', min: 100, color: '#888' },
    { name: '相识', min: 1000, color: '#5fa8ff' },
    { name: '相知', min: 3000, color: '#9400d3' },
    { name: '相爱', min: 6000, color: '#ff1493' },
    { name: '至死不渝', min: 9000, color: '#ffd700' }
  ],
  
  // 羁绊道具配置
  BOND_ITEMS: [
    { id: 'flower', name: '玫瑰花', icon: '🌹', price: 1000, bond: 20, desc: '赠送玫瑰，表达爱意' },
    { id: 'jade', name: '定情玉佩', icon: '🏮', price: 5000, bond: 50, desc: '定情信物，情谊绵绵' },
    { id: 'chocolate', name: '仙界巧克力', icon: '🍫', price: 3000, bond: 30, desc: '甜蜜滋味，增进感情' },
    { id: 'perfume', name: '凝香露', icon: '🧴', price: 8000, bond: 80, desc: '芳香四溢，沁人心脾' },
    { id: 'ring', name: '同心戒指', icon: '💍', price: 20000, bond: 200, desc: '永结同心，白头偕老' },
    { id: 'necklace', name: '相思项链', icon: '📿', price: 15000, bond: 150, desc: '相思入骨，魂牵梦萦' },
    { id: 'wine', name: '合卺酒', icon: '🍷', price: 10000, bond: 100, desc: '交杯共饮，情定三生' },
    { id: 'fan', name: '定情折扇', icon: '🪭', price: 6000, bond: 60, desc: '轻摇折扇，情意绵绵' }
  ],
  
  // 冷却期配置（毫秒）
  COOLDOWN: {
    afterMarriage: 3 * 24 * 60 * 60 * 1000,  // 结婚后3天冷却
    afterBreakup: 3 * 24 * 60 * 60 * 1000    // 解除后3天冷却
  },
  
  // 伤感buff配置
  SADNESS_BUFF: {
    chance: 0.05,              // 5%概率获得
    duration: 3 * 24 * 60 * 60 * 1000,  // 3天有效期
    attrBonus: 0.6           // 60%属性加成
  },
  
  pendingProposal: null,
  
  init() {
    if (!Game.g.partner) Game.g.partner = null;
    if (!Game.g.partnerBond) Game.g.partnerBond = 0;
    if (!Game.g.partnerData) {
      Game.g.partnerData = {
        lastDualCultivation: 0,
        totalDual: 0,
        marriedTime: null,
        marriageCooldownEnd: null,  // 结婚冷却结束时间
        lastBreakupTime: null        // 上次解除时间
      };
    }
    if (!Game.g.proposals) Game.g.proposals = [];
    if (!Game.g.notifications) Game.g.notifications = [];
    if (!Game.g.sadnessBuff) Game.g.sadnessBuff = null;  // 伤感buff
    this.checkProposal();
    this.checkNotifications();
    this.checkSadnessBuffExpiry();  // 检查伤感buff是否过期
  },
  
  // 检查伤感buff是否过期
  checkSadnessBuffExpiry() {
    if (Game.g.sadnessBuff && Game.g.sadnessBuff.expiryTime) {
      if (Date.now() >= Game.g.sadnessBuff.expiryTime) {
        Game.g.sadnessBuff = null;
        Game.save();
        Game.log('💔 伤感buff已失效，你走出了失恋的阴影', 'system');
      }
    }
  },
  
  // 获取伤感buff加成
  getSadnessBuffBonus() {
    this.checkSadnessBuffExpiry();
    if (!Game.g.sadnessBuff || !Game.g.sadnessBuff.active) return null;
    return {
      str: this.SADNESS_BUFF.attrBonus,
      int: this.SADNESS_BUFF.attrBonus,
      vit: this.SADNESS_BUFF.attrBonus,
      luk: 0  // 运气不加成
    };
  },
  
  // 检查是否在结婚冷却期
  isInMarriageCooldown() {
    if (!Game.g.partnerData || !Game.g.partnerData.marriageCooldownEnd) return false;
    return Date.now() < Game.g.partnerData.marriageCooldownEnd;
  },
  
  // 检查是否在解除冷却期
  isInBreakupCooldown() {
    if (!Game.g.partnerData || !Game.g.partnerData.lastBreakupTime) return false;
    const cooldownEnd = Game.g.partnerData.lastBreakupTime + this.COOLDOWN.afterBreakup;
    return Date.now() < cooldownEnd;
  },
  
  // 获取结婚冷却剩余时间
  getMarriageCooldownRemaining() {
    if (!this.isInMarriageCooldown()) return 0;
    return Game.g.partnerData.marriageCooldownEnd - Date.now();
  },
  
  // 获取解除冷却剩余时间
  getBreakupCooldownRemaining() {
    if (!this.isInBreakupCooldown()) return 0;
    const cooldownEnd = Game.g.partnerData.lastBreakupTime + this.COOLDOWN.afterBreakup;
    return cooldownEnd - Date.now();
  },
  
  // 格式化时间
  formatTime(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (days > 0) return `${days}天${hours}小时`;
    if (hours > 0) return `${hours}小时${minutes}分`;
    return `${minutes}分钟`;
  },
  
  getBondLevel(bond) {
    for (let i = this.BOND_LEVELS.length - 1; i >= 0; i--) {
      if (bond >= this.BOND_LEVELS[i].min) return this.BOND_LEVELS[i];
    }
    return this.BOND_LEVELS[0];
  },
  
  getAttrBonus() {
    if (!Game.g.partner) return null;
    const bond = Game.g.partnerBond || 0;
    const multiplier = 1 + (bond / 1000) * 0.5;
    return {
      str: Math.floor(10 * multiplier),
      int: Math.floor(10 * multiplier),
      vit: Math.floor(10 * multiplier),
      luk: Math.floor(10 * multiplier)
    };
  },
  
  async propose(targetName) {
    // 检查解除冷却期
    if (this.isInBreakupCooldown()) {
      const remaining = this.getBreakupCooldownRemaining();
      alert(`解除道侣关系后需要等待3天冷却期\n剩余时间: ${this.formatTime(remaining)}`);
      return;
    }
    
    if (Game.g.partner) {
      alert('你已有道侣！请先解除关系');
      return;
    }
    if (!Auth.users[targetName]) {
      alert('对方不存在');
      return;
    }
    if (!Game.g.friends.includes(targetName)) {
      alert('只能向好友求婚');
      return;
    }
    if (Auth.users[targetName].data.partner) {
      alert('对方已有道侣');
      return;
    }
    
    const cost = 10000;
    if (Game.g.stones < cost) {
      alert(`求婚需要${cost}灵石作为聘礼`);
      return;
    }
    
    if (!confirm(`确定要向 ${targetName} 求婚吗？\n需要消耗 ${cost} 灵石作为聘礼`)) return;
    
    Game.g.stones -= cost;
    
    if (!Auth.users[targetName].data.proposals) {
      Auth.users[targetName].data.proposals = [];
    }
    
    Auth.users[targetName].data.proposals.push({
      from: Game.user,
      time: Date.now(),
      message: `${Game.user} 向你求婚，是否接受？`
    });
    
    Auth.save();
    Game.save();
    UI.updateStatus();
    alert(`求婚请求已发送给 ${targetName}`);
    Game.log(`向 ${targetName} 求婚，等待对方回应...`, 'system');
  },
  
  checkProposal() {
    if (!Game.g.proposals) return;
    const validProposals = Game.g.proposals.filter(p => 
      Date.now() - p.time < 24 * 60 * 60 * 1000
    );
    
    if (validProposals.length > 0) {
      this.pendingProposal = validProposals[0];
      this.showProposalModal();
    }
    Game.g.proposals = validProposals;
  },
  
  showProposalModal() {
    document.getElementById('proposalText').textContent = this.pendingProposal.message;
    document.getElementById('proposalModal').classList.add('active');
  },
  
  closeProposalModal() {
    document.getElementById('proposalModal').classList.remove('active');
  },
  
  acceptProposal() {
    if (!this.pendingProposal) return;
    const partnerName = this.pendingProposal.from;
    
    Game.g.partner = partnerName;
    Game.g.partnerBond = 100;
    Game.g.partnerData = {
      lastDualCultivation: 0,
      totalDual: 0,
      marriedTime: Date.now(),
      marriageCooldownEnd: Date.now() + this.COOLDOWN.afterMarriage,  // 设置结婚冷却期
      lastBreakupTime: null
    };
    
    Auth.users[partnerName].data.partner = Game.user;
    Auth.users[partnerName].data.partnerBond = 100;
    Auth.users[partnerName].data.partnerData = {
      lastDualCultivation: 0,
      totalDual: 0,
      marriedTime: Date.now(),
      marriageCooldownEnd: Date.now() + this.COOLDOWN.afterMarriage,
      lastBreakupTime: null
    };
    
    if (!Auth.users[partnerName].data.notifications) {
      Auth.users[partnerName].data.notifications = [];
    }
    Auth.users[partnerName].data.notifications.push({
      type: 'partner_accepted',
      message: `${Game.user} 接受了你的求婚，你们已成为道侣！\n⚠️ 注意：结为道侣后3天内无法双修`,
      time: Date.now()
    });
    
    Game.g.proposals = Game.g.proposals.filter(p => p.from !== partnerName);
    this.pendingProposal = null;
    
    Auth.save();
    Game.save();
    this.closeProposalModal();
    alert('恭喜！你们已成为道侣，从此仙路相伴！\n\n⚠️ 结为道侣后3天内无法双修');
    Game.log(`与 ${partnerName} 结为道侣，获得属性加成！`, 'success');
    Game.log(`⚠️ 3天冷却期内无法双修`, 'system');
  },
  
  rejectProposal() {
    if (!this.pendingProposal) return;
    const partnerName = this.pendingProposal.from;
    
    if (Auth.users[partnerName]) {
      Auth.users[partnerName].data.stones += 5000;
      if (!Auth.users[partnerName].data.notifications) {
        Auth.users[partnerName].data.notifications = [];
      }
      Auth.users[partnerName].data.notifications.push({
        type: 'partner_rejected',
        message: `${Game.user} 拒绝了你的求婚`,
        time: Date.now()
      });
    }
    
    Game.g.proposals = Game.g.proposals.filter(p => p.from !== partnerName);
    this.pendingProposal = null;
    Auth.save();
    Game.save();
    this.closeProposalModal();
    alert('已拒绝求婚');
  },
  
  dualCultivation() {
    if (!Game.g.partner) {
      alert('你还没有道侣');
      return;
    }
    
    // 检查结婚冷却期
    if (this.isInMarriageCooldown()) {
      const remaining = this.getMarriageCooldownRemaining();
      alert(`结为道侣后需要等待3天冷却期才能双修\n剩余时间: ${this.formatTime(remaining)}`);
      return;
    }
    
    // 检查羁绊等级是否达到相爱（6000+）
    if (Game.g.partnerBond < this.DUAL_CULTIVATION.minBondForDual) {
      const needBond = this.DUAL_CULTIVATION.minBondForDual - Game.g.partnerBond;
      alert(`羁绊值不足！需要达到「相爱」等级（${this.DUAL_CULTIVATION.minBondForDual}羁绊）才能双修\n当前: ${Game.g.partnerBond}，还差 ${needBond} 点`);
      return;
    }
    
    const now = Date.now();
    const lastTime = Game.g.partnerData.lastDualCultivation || 0;
    const cooldown = this.DUAL_CULTIVATION.cooldown;
    
    // 检查每天一次的限制
    if (now - lastTime < cooldown) {
      const remaining = cooldown - (now - lastTime);
      const nextTime = new Date(lastTime + cooldown);
      alert(`今天已经双修过了！\n下次可双修时间: ${nextTime.toLocaleString('zh-CN')}\n剩余: ${this.formatTime(remaining)}`);
      return;
    }
    
    // 获取双方实力
    const myPower = PowerSystem.getPowerDetails(Game.user).total;
    const partnerPower = PowerSystem.getPowerDetails(Game.g.partner).total;
    const powerDiff = Math.abs(myPower - partnerPower);
    
    // 检查实力差
    if (powerDiff > this.DUAL_CULTIVATION.maxPowerDiff) {
      alert(`双方实力差距过大！\n你的战力: ${UI.formatNumber(myPower)}\n道侣战力: ${UI.formatNumber(partnerPower)}\n差距: ${UI.formatNumber(powerDiff)}（超过限制${UI.formatNumber(this.DUAL_CULTIVATION.maxPowerDiff)}）`);
      return;
    }
    
    // 计算修为收益（基于双方实力平均值）
    const avgPower = (myPower + partnerPower) / 2;
    const baseExp = this.DUAL_CULTIVATION.baseExp;
    const powerMultiplier = 1 + (avgPower / 100000);  // 每10万战力增加100%收益
    const bond = Game.g.partnerBond || 0;
    const bondMultiplier = 1 + (bond / 1000) * 0.5;
    const stageMultiplier = 1 + Game.g.stage * 0.1;
    
    const expGain = Math.floor(baseExp * powerMultiplier * bondMultiplier * stageMultiplier);
    
    Game.g.exp += expGain;
    Game.g.age += this.DUAL_CULTIVATION.ageCost;
    this.addBond(10);
    
    Game.g.partnerData.lastDualCultivation = now;
    Game.g.partnerData.totalDual = (Game.g.partnerData.totalDual || 0) + 1;
    
    // 给道侣也增加修为（80%）
    const partnerData = Auth.users[Game.g.partner]?.data;
    if (partnerData) {
      const partnerExpGain = Math.floor(expGain * 0.8);
      partnerData.exp = (partnerData.exp || 0) + partnerExpGain;
      if (!partnerData.partnerData) partnerData.partnerData = {};
      partnerData.partnerData.lastDualCultivation = now;
      partnerData.partnerBond = Math.min(this.DUAL_CULTIVATION.maxBond, 
        (partnerData.partnerBond || 0) + 10);
      
      // 通知道侣
      if (!partnerData.notifications) partnerData.notifications = [];
      partnerData.notifications.push({
        type: 'dual_cultivation',
        message: `与 ${Game.user} 双修，获得修为 ${UI.formatNumber(partnerExpGain)}`,
        time: Date.now()
      });
    }
    
    Game.save();
    Auth.save();
    this.showDualEffect(expGain);
    Game.log(`与道侣 ${Game.g.partner} 双修，获得修为 ${UI.formatNumber(expGain)}，羁绊+10`, 'success');
    Game.log(`⚠️ 今日已双修，明天同一时间后可再次双修`, 'system');
    UI.updateStatus();
    this.openPartnerPanel(); // 刷新面板
  },
  
  showDualEffect(expGain) {
    const effect = document.createElement('div');
    effect.className = 'dual-cultivation-effect';
    effect.innerHTML = `
      <div class="dual-heart">💕</div>
      <div class="dual-text">双修成功</div>
      <div class="dual-exp">+${UI.formatNumber(expGain)} 修为</div>
      <div style="font-size:12px;color:#888;margin-top:5px">今日次数已用完</div>
    `;
    document.body.appendChild(effect);
    setTimeout(() => effect.remove(), 2000);
  },
  
  addBond(amount) {
    Game.g.partnerBond = Math.min(this.DUAL_CULTIVATION.maxBond, 
      (Game.g.partnerBond || 0) + amount);
    const partnerData = Auth.users[Game.g.partner]?.data;
    if (partnerData) partnerData.partnerBond = Game.g.partnerBond;
  },
  
  // 购买并赠送羁绊道具
  buyBondItem(itemId) {
    if (!Game.g.partner) {
      alert('你还没有道侣');
      return;
    }
    
    const item = this.BOND_ITEMS.find(i => i.id === itemId);
    if (!item) {
      alert('道具不存在');
      return;
    }
    
    if (Game.g.stones < item.price) {
      alert(`灵石不足！需要 ${UI.formatNumber(item.price)} 灵石`);
      return;
    }
    
    if (!confirm(`确定要花费 ${UI.formatNumber(item.price)} 灵石购买【${item.name}】送给道侣吗？\n可增加 ${item.bond} 点羁绊值`)) {
      return;
    }
    
    Game.g.stones -= item.price;
    this.addBond(item.bond);
    
    const partnerData = Auth.users[Game.g.partner]?.data;
    if (partnerData) {
      if (!partnerData.notifications) partnerData.notifications = [];
      partnerData.notifications.push({
        type: 'bond_item',
        message: `${Game.user} 送给你【${item.name}】，羁绊+${item.bond}\n${item.desc}`,
        time: Date.now()
      });
    }
    
    Game.save();
    Auth.save();
    UI.updateStatus();
    alert(`赠送成功！羁绊值+${item.bond}\n${item.desc}`);
    Game.log(`送给道侣 ${Game.g.partner} 【${item.name}】，羁绊+${item.bond}`, 'success');
    this.openPartnerPanel(); // 刷新面板
  },
  
  // 渲染羁绊道具商店
  renderBondShop() {
    const container = document.getElementById('bondShopItems');
    if (!container) return;
    
    let html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:10px;">';
    
    this.BOND_ITEMS.forEach(item => {
      const canAfford = Game.g.stones >= item.price;
      html += `
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;text-align:center;${canAfford ? 'cursor:pointer;' : 'opacity:0.6;'}" 
             onclick="${canAfford ? `DaoistCouple.buyBondItem('${item.id}')` : ''}">
          <div style="font-size:24px;margin-bottom:4px">${item.icon}</div>
          <div style="font-size:11px;color:#ffd700;font-weight:bold;margin-bottom:2px">${item.name}</div>
          <div style="font-size:9px;color:#888;margin-bottom:4px">${item.desc}</div>
          <div style="font-size:10px;color:${canAfford ? '#ff6b6b' : '#666'};margin-bottom:4px">💎${UI.formatNumber(item.price)}</div>
          <div style="font-size:10px;color:#ff1493;font-weight:bold">+${item.bond}羁绊</div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  },
  
  breakUp() {
    if (!Game.g.partner) {
      alert('你没有道侣');
      return;
    }
    
    const partnerName = Game.g.partner;
    let buffMsg = '';
    
    // 极低概率获得伤感buff（5%）
    if (Math.random() < this.SADNESS_BUFF.chance) {
      Game.g.sadnessBuff = {
        active: true,
        expiryTime: Date.now() + this.SADNESS_BUFF.duration,
        source: partnerName
      };
      buffMsg = `\n\n💔 你陷入了深深的伤感之中...\n获得【伤感】buff：力量、悟性、体质+60%（运气除外）\n持续3天`;
    }
    
    if (!confirm(`确定要与 ${partnerName} 解除道侣关系吗？\n\n⚠️ 解除后3天内无法与其他玩家结为道侣${buffMsg}`)) return;
    
    if (Auth.users[partnerName]) {
      if (!Auth.users[partnerName].data.notifications) {
        Auth.users[partnerName].data.notifications = [];
      }
      Auth.users[partnerName].data.notifications.push({
        type: 'breakup',
        message: `${Game.user} 与你解除了道侣关系`,
        time: Date.now()
      });
      Auth.users[partnerName].data.partner = null;
      Auth.users[partnerName].data.partnerBond = 0;
      Auth.users[partnerName].data.partnerData = null;
    }
    
    Game.log(`与 ${partnerName} 解除道侣关系`, 'fail');
    
    // 记录解除时间和设置冷却期
    const breakupTime = Date.now();
    Game.g.lastBreakupTime = breakupTime;
    Game.g.partnerData.lastBreakupTime = breakupTime;
    
    // 清除道侣数据但保留解除时间
    Game.g.partner = null;
    Game.g.partnerBond = 0;
    Game.g.partnerData = {
      lastDualCultivation: 0,
      totalDual: 0,
      marriedTime: null,
      marriageCooldownEnd: null,
      lastBreakupTime: breakupTime  // 记录解除时间用于冷却期
    };
    
    Auth.save();
    Game.save();
    
    let alertMsg = '已解除道侣关系\n\n⚠️ 3天内无法与其他玩家结为道侣';
    if (Game.g.sadnessBuff && Game.g.sadnessBuff.active) {
      alertMsg += `\n\n💔 你获得了【伤感】buff！\n全属性+60%（除运气），持续3天`;
    }
    alert(alertMsg);
    
    this.closePartnerPanel();
  },
  
  openPartnerPanel() {
    if (!Game.g.partner) {
      // 检查是否在解除冷却期
      if (this.isInBreakupCooldown()) {
        const remaining = this.getBreakupCooldownRemaining();
        alert(`解除道侣关系后需要等待3天才能结交新道侣\n剩余时间: ${this.formatTime(remaining)}`);
        return;
      }
      alert('你还没有道侣，快去好友列表求婚吧！');
      return;
    }
    
    const modal = document.getElementById('partnerModal');
    const partnerData = Auth.users[Game.g.partner]?.data;
    if (!partnerData) {
      alert('道侣数据异常');
      return;
    }
    
    document.getElementById('partnerName').textContent = Game.g.partner;
    document.getElementById('partnerRealm').textContent = CONFIG.realms[partnerData.stage];
    document.getElementById('partnerPower').textContent = UI.formatNumber(
      PowerSystem.getPowerDetails(Game.g.partner).total
    );
    
    const bond = Game.g.partnerBond || 0;
    const level = this.getBondLevel(bond);
    document.getElementById('partnerBond').textContent = bond;
    document.getElementById('partnerBondLevel').textContent = level.name;
    document.getElementById('partnerBondLevel').style.color = level.color;
    document.getElementById('bondBar').style.width = (bond / 100) + '%';
    
    // 显示羁绊等级提示
    const bondHint = document.getElementById('bondHint');
    if (bondHint) {
      if (bond < this.DUAL_CULTIVATION.minBondForDual) {
        const need = this.DUAL_CULTIVATION.minBondForDual - bond;
        bondHint.innerHTML = `<span style="color:#ff6b6b">⚠️ 还需 ${need} 羁绊值达到「相爱」才能双修</span>`;
      } else {
        bondHint.innerHTML = `<span style="color:#00c853">✅ 已达到「相爱」等级，可以双修</span>`;
      }
    }
    
    if (Game.g.partnerData.marriedTime) {
      const days = Math.floor((Date.now() - Game.g.partnerData.marriedTime) / (1000 * 60 * 60 * 24));
      document.getElementById('partnerDays').textContent = days;
    } else {
      document.getElementById('partnerDays').textContent = 0;
    }
    
    document.getElementById('dualCount').textContent = Game.g.partnerData.totalDual || 0;
    
    const bonus = this.getAttrBonus();
    document.getElementById('partnerBonus').innerHTML = `
      力量+${bonus.str} 悟性+${bonus.int}<br>
      体质+${bonus.vit} 气运+${bonus.luk}
    `;
    
    const now = Date.now();
    const lastDual = Game.g.partnerData.lastDualCultivation || 0;
    const cooldown = this.DUAL_CULTIVATION.cooldown;
    const remaining = Math.max(0, cooldown - (now - lastDual));
    
    // 检查是否在结婚冷却期
    const inMarriageCooldown = this.isInMarriageCooldown();
    const marriageCooldownRemaining = this.getMarriageCooldownRemaining();
    
    const dualBtn = document.getElementById('btnDualCultivation');
    if (inMarriageCooldown) {
      dualBtn.textContent = `结婚冷却(${this.formatTime(marriageCooldownRemaining)})`;
      dualBtn.disabled = true;
      dualBtn.style.background = 'linear-gradient(135deg, #666, #888)';
    } else if (bond < this.DUAL_CULTIVATION.minBondForDual) {
      dualBtn.textContent = '羁绊不足';
      dualBtn.disabled = true;
      dualBtn.style.background = 'linear-gradient(135deg, #666, #888)';
    } else if (remaining > 0) {
      const nextTime = new Date(lastDual + cooldown);
      dualBtn.textContent = `明日${nextTime.getHours()}:${String(nextTime.getMinutes()).padStart(2, '0')}`;
      dualBtn.disabled = true;
      dualBtn.style.background = 'linear-gradient(135deg, #666, #888)';
    } else {
      dualBtn.textContent = '💕 双修';
      dualBtn.disabled = false;
      dualBtn.style.background = 'linear-gradient(135deg, #ff1493, #ff69b4)';
    }
    
    // 渲染羁绊道具商店
    this.renderBondShop();
    
    // 显示伤感buff状态
    const sadnessBuffDiv = document.getElementById('sadnessBuffStatus');
    if (sadnessBuffDiv) {
      this.checkSadnessBuffExpiry();
      if (Game.g.sadnessBuff && Game.g.sadnessBuff.active) {
        const remaining = Game.g.sadnessBuff.expiryTime - Date.now();
        sadnessBuffDiv.innerHTML = `
          <div style="background:rgba(255,65,108,0.2);border:1px solid rgba(255,65,108,0.5);border-radius:8px;padding:10px;margin-top:10px;">
            <div style="color:#ff416c;font-weight:bold;margin-bottom:5px">💔 伤感buff生效中</div>
            <div style="font-size:11px;color:#ccc">力量、悟性、体质+60%（运气除外）</div>
            <div style="font-size:10px;color:#888;margin-top:3px">剩余: ${this.formatTime(remaining)}</div>
          </div>
        `;
        sadnessBuffDiv.style.display = 'block';
      } else {
        sadnessBuffDiv.style.display = 'none';
      }
    }
    
    modal.classList.add('active');
  },
  
  closePartnerPanel() {
    document.getElementById('partnerModal').classList.remove('active');
  },
  
  checkNotifications() {
    if (!Game.g.notifications || Game.g.notifications.length === 0) return;
    
    const validNotifications = Game.g.notifications.filter(n => 
      Date.now() - n.time < 24 * 60 * 60 * 1000
    );
    
    validNotifications.forEach(n => {
      setTimeout(() => {
        Game.log(`📢 ${n.message}`, 'system');
      }, 1000);
    });
    
    Game.g.notifications = [];
    Game.save();
  },
  
  renderProposeButton(friendName) {
    // 检查是否在解除冷却期
    if (this.isInBreakupCooldown()) {
      return `<span style="color:#888;font-size:10px">冷却中</span>`;
    }
    if (Game.g.partner || Auth.users[friendName]?.data?.partner) return '';
    return `<button class="friend-btn propose" onclick="DaoistCouple.propose('${friendName}')">💍 求婚</button>`;
  }
};

if (typeof window !== 'undefined') window.DaoistCouple = DaoistCouple;
