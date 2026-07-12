/**
 * UI系统
 * @namespace UI
 */
const UI = {
  init() {
    const hBox = document.getElementById('hBox');
    const buttons = [
      { text: '☯ 修炼', onclick: 'Game.xiulian()', className: 'btn-main' },
      { text: '⚡ 突破', onclick: 'Game.breakthrough()', className: 'btn-warn' },
      { text: '▶ 自动', onclick: 'Game.toggleAuto()', id: 'btnAuto', className: 'btn-auto' },
      { text: '🏔️ 探索', onclick: 'Game.explore()' },
      { text: '⚔️ 斩妖', onclick: 'Game.handleBattleButton()', id: 'btnBattle' },
      { text: '🔮 服丹', onclick: 'Game.takePill()', id: 'btnPill' },
      { text: '🌀 轮回', onclick: 'RebirthSystem.openModal()', id: 'btnRebirth' },
      { text: '💕 道侣', onclick: 'DaoistCouple.openPartnerPanel()', className: 'btn-love' },
      { text: '🏯 宗门', onclick: 'ClanSystem.openClanPanel()', className: 'btn-clan' },
      { text: '🏪 商店', onclick: "UI.switchTab('shop')" },
      { text: '🍶 炼药', onclick: "UI.switchTab('alchemy')" },
      { text: '📚 功法', onclick: "UI.switchTab('skill')" },
      { text: '🔄 转世', onclick: 'Game.deathRebirth()', id: 'rebirthBtn', style: 'display:none' }
    ];
    
    const fragment = document.createDocumentFragment();
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `scroll-item ${btn.className || ''}`;
      if (btn.id) button.id = btn.id;
      button.textContent = btn.text;
      button.onclick = () => eval(btn.onclick);
      if (btn.style) button.style.cssText = btn.style;
      fragment.appendChild(button);
    });
    
    hBox.innerHTML = '';
    hBox.appendChild(fragment);
    this.updateAutoButton();
  },
  
  updateClickPowerDisplay() {
    const display = document.getElementById('clickPowerDisplay');
    if (display && Game.g) {
      const power = 1 + (Game.g.clickLevel || 0);
      display.textContent = `👆+${power}`;
    }
  },
  
  updateAutoButton() {
    const btn = document.getElementById('btnAuto');
    if (!btn) return;
    
    if (Game.g && Game.g.auto) {
      btn.textContent = '⏹ 停止';
      btn.classList.add('auto-on');
      btn.classList.remove('btn-auto');
    } else {
      btn.textContent = '▶ 自动';
      btn.classList.remove('auto-on');
      btn.classList.add('btn-auto');
    }
  },
  
  updateBattleButton(battling) {
    const btn = document.getElementById('btnBattle');
    if (!btn) return;
    
    if (battling) {
      btn.innerHTML = '⚔️ 斩妖<span style="font-size:10px">（中）</span>';
      btn.classList.add('battling');
    } else {
      btn.innerHTML = '⚔️ 斩妖';
      btn.classList.remove('battling');
    }
  },
  
  showBattleModal(show, monsterName = '', powerRatio = 1, duration = 0) {
    const modal = document.getElementById('battleModal');
    if (show) {
      modal.classList.add('active');
      if (monsterName) {
        document.getElementById('battleMonster').textContent = `遭遇 ${monsterName}`;
        document.getElementById('battleTimer').textContent = '00:00';
        document.getElementById('battleFill').style.width = '0%';
        document.getElementById('battleHint').textContent = `预计战斗时长: ${(duration / 1000).toFixed(1)}秒`;
      }
    } else {
      modal.classList.remove('active');
    }
  },
  
  switchTab(p) {
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
    document.getElementById(p + 'Page').classList.add('active');
    document.querySelector(`[data-page="${p}"]`)?.classList.add('active');
    
    switch(p) {
      case 'shop': this.renderShop(); break;
      case 'alchemy': this.renderAlchemy(); break;
      case 'attr': this.renderAttr(); break;
      case 'skill': this.renderSkills(); break;
      case 'bag': this.renderBag(); break;
      case 'friend': FriendSystem.renderFriendList(); break;
      case 'task': TaskSystem.render(); break;
    }
  },
  
  renderShop() {
    const d = document.getElementById('shopPage');
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'shop-scroll-container';
    
    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    
    CONFIG.shopItems.forEach(item => {
      const purchased = Game.g.shopPurchased[item.id] || 0;
      const remaining = item.limit ? (item.limit - purchased) : 999;
      const isLimited = item.limit && remaining <= 0;
      
      let currentPrice = item.price;
      if (item.type === 'click_power') {
        currentPrice = 500 * ((Game.g.clickLevel || 0) + 1);
      }
      
      const canAfford = Game.g.stones >= currentPrice;
      const btnText = isLimited ? '售' : (canAfford ? '购' : '缺');
      const disabled = isLimited || !canAfford || Game.g.dead || Game.isBattling;
      
      const card = document.createElement('div');
      card.className = `shop-card ${isLimited ? 'sold-out' : ''}`;
      card.setAttribute('data-shop-id', item.id);
      
      card.addEventListener('mouseenter', (e) => {
        this.showShopTooltip(e, item, currentPrice);
      });
      card.addEventListener('mouseleave', () => {
        this.hideShopTooltip();
      });
      
      if ('ontouchstart' in window) {
        let touchTimer = null;
        let isLongPress = false;
        
        card.addEventListener('touchstart', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('.shop-buy-btn')) {
            return;
          }
          touchTimer = setTimeout(() => {
            isLongPress = true;
            this.showShopTooltip(e, item, currentPrice);
          }, 500);
        });
        
        card.addEventListener('touchend', (e) => {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
          if (!isLongPress) {
            const btn = card.querySelector('.shop-buy-btn');
            if (btn && !btn.disabled) {
              btn.click();
            }
          }
          isLongPress = false;
          setTimeout(() => this.hideShopTooltip(), 100);
        });
        
        card.addEventListener('touchmove', () => {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
          isLongPress = false;
        });
      }
      
      let limitBadge = '';
      if (item.limit) {
        limitBadge = `<span class="shop-badge limit">${remaining}</span>`;
      } else if (item.type === 'click_power') {
        limitBadge = `<span class="shop-badge click-level">${Game.g.clickLevel || 0}</span>`;
      }
      
      card.innerHTML = `
        ${limitBadge}
        <span class="shop-icon">${item.icon}</span>
        <div class="shop-name">${item.name}</div>
        <div class="shop-price">
          <span class="price-icon">💎</span>
          <span class="price-value">${this.formatNumber(currentPrice)}</span>
        </div>
        <button class="shop-buy-btn ${disabled ? 'disabled' : ''}" 
                onclick="Shop.buy('${item.id}')" 
                ${disabled ? 'disabled' : ''}>
          ${btnText}
        </button>
      `;
      grid.appendChild(card);
    });
    
    scrollContainer.appendChild(grid);
    d.innerHTML = '';
    d.appendChild(scrollContainer);
  },
  
  showShopTooltip(event, item, currentPrice) {
    if (this.shopTooltipTimer) {
      clearTimeout(this.shopTooltipTimer);
      this.shopTooltipTimer = null;
    }
    
    let tooltip = document.getElementById('shopTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'shopTooltip';
      tooltip.className = 'shop-tooltip';
      document.body.appendChild(tooltip);
    }
    
    let detailDesc = item.desc;
    if (item.type === 'click_power') {
      const currentPower = 1 + (Game.g.clickLevel || 0);
      const nextPower = currentPower + 1;
      detailDesc = `每次修炼 +${currentPower} 修为 → 购买后 +${nextPower} 修为`;
    } else if (item.type === 'power') {
      detailDesc = `永久提升 ${item.value} 点基础战力 (可叠加)`;
    } else if (item.type === 'herb_pack') {
      detailDesc = item.tier === 'small' ? '随机获得3-5份基础草药' : '随机获得10-15份高级草药，含混元果';
    } else if (item.type === 'root_random') {
      detailDesc = '随机重置灵根品质 (高风险高回报)';
    } else if (item.type === 'root_custom') {
      detailDesc = '自选想要的灵根品质 (需要1亿灵石)';
    } else if (item.type === 'life') {
      detailDesc = `增加 ${item.value} 年寿元上限`;
    } else if (item.type === 'exp') {
      detailDesc = `增加当前境界 ${item.percent * 100}% 修为`;
    }
    
    tooltip.innerHTML = `
      <div class="tooltip-name">${item.name}</div>
      <div class="tooltip-desc">${detailDesc}</div>
      <div class="tooltip-price">💰 ${this.formatNumber(currentPrice)} 灵石</div>
      ${item.limit ? `<div class="tooltip-limit">剩余: ${item.limit - (Game.g.shopPurchased[item.id] || 0)}/${item.limit}</div>` : ''}
    `;
    
    const rect = event.target.getBoundingClientRect();
    let top = rect.top - 10;
    let left = rect.left + rect.width / 2;
    
    if (top < 60) {
      top = rect.bottom + 10;
      tooltip.style.transform = 'translateX(-50%) translateY(0)';
    } else {
      tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
    }
    
    const tooltipWidth = 220;
    if (left - tooltipWidth / 2 < 10) {
      left = tooltipWidth / 2 + 10;
      tooltip.style.transform = 'translateX(0)';
    } else if (left + tooltipWidth / 2 > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth / 2 - 10;
      tooltip.style.transform = 'translateX(0)';
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('show');
    
    this.shopTooltipTimer = setTimeout(() => {
      this.hideShopTooltip();
    }, 3000);
  },
  
  hideShopTooltip() {
    const tooltip = document.getElementById('shopTooltip');
    if (tooltip) {
      tooltip.classList.remove('show');
    }
    if (this.shopTooltipTimer) {
      clearTimeout(this.shopTooltipTimer);
      this.shopTooltipTimer = null;
    }
  },
  
  renderAlchemy() {
    const d = document.getElementById('alchemyPage');
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'alchemy-scroll-container';
    
    const grid = document.createElement('div');
    grid.className = 'alchemy-grid';
    
    CONFIG.recipes.forEach(r => {
      const cost = Object.entries(r.need).map(([h, n]) => {
        const herb = CONFIG.herbs.find(x => x.id === h);
        return `${herb?.n || h}×${n}`;
      }).join(' ');
      const canMake = Object.entries(r.need).every(([h, n]) => (Game.g.herbs[h] || 0) >= n) && !Game.g.dead && !Game.isBattling;
      
      const card = document.createElement('div');
      card.className = 'alchemy-card';
      card.innerHTML = `
        <div class="name">${r.n}</div>
        <div class="desc">${r.desc || ''}</div>
        <div class="cost">${cost}</div>
        <button onclick="Game.alchemy('${r.id}')" ${canMake ? '' : 'disabled'}>炼</button>
      `;
      grid.appendChild(card);
    });
    
    scrollContainer.appendChild(grid);
    d.innerHTML = '';
    d.appendChild(scrollContainer);
  },
  
  renderAttr() {
    const d = document.getElementById('attrPage');
    const g = Game.g;
    const grade = CONFIG.grades[g.grade];
    const power = PowerSystem.getPowerDetails(Game.user);
    const rebirthInfo = RebirthSystem.getRebirthInfo();
    const nextRebirthReq = RebirthSystem.getRequiredStage();
    
    let clanBonusHtml = '';
    if (ClanSystem && Game.g.clanData && Game.g.clanData.clanId) {
      const clan = ClanSystem.getPlayerClan();
      const bonus = ClanSystem.getClanBonus();
      if (clan) {
        clanBonusHtml = `
          <div class="attr-row">
            <span>宗门加成</span>
            <span style="color:#00c853">${clan.name} Lv.${clan.level} | 修炼+${(bonus.exp - 1) * 100}% 灵石+${(bonus.stones - 1) * 100}%</span>
          </div>
        `;
      }
    }
    
    let partnerBonusHtml = '';
    if (DaoistCouple && Game.g.partner) {
      const bonus = DaoistCouple.getAttrBonus();
      if (bonus) {
        partnerBonusHtml = `
          <div class="attr-row">
            <span>道侣加成</span>
            <span style="color:#ff1493">+${bonus.str}/+${bonus.int}/+${bonus.vit}/+${bonus.luk}</span>
          </div>
        `;
      }
    }
    
    d.innerHTML = `
      <div style="background:rgba(255,107,107,.1); border:1px solid rgba(255,107,107,.3); border-radius:10px; padding:15px; margin-bottom:15px; text-align:center">
        <div style="color:#ff6b6b; font-size:12px; margin-bottom:5px">当前战力</div>
        <div style="color:#ff6b6b; font-size:32px; font-weight:bold; text-shadow:0 0 20px rgba(255,107,107,.3)">${this.formatNumber(power.total)}</div>
        <div style="color:#888; font-size:11px; margin-top:5px">构成: ${this.formatNumber(power.breakdown.base)}(境界) × ${power.breakdown.root}(灵根) + 功法加成</div>
      </div>
      
      <div class="attr-grid">
        ${CONFIG.attrs.map(a => `
          <div class="attr-row">
            <span>${CONFIG.attrName[a]}</span>
            <span style="color:${a === 'str' ? '#ff6b6b' : a === 'int' ? '#5fa8ff' : a === 'vit' ? '#00c853' : '#ffd700'}">${g.attrs[a]}</span>
          </div>
        `).join('')}
        <div class="attr-row"><span>灵根品阶</span><span style="color:${grade.c}">${grade.n}</span></div>
        ${g.powerPills ? `<div class="attr-row"><span>战力丹</span><span style="color:#ff1493">已服${g.powerPills}颗</span></div>` : ''}
        <div class="attr-row"><span>点击修为</span><span style="color:#5fa8ff">+${1 + (g.clickLevel || 0)}/次</span></div>
        ${rebirthInfo.count > 0 ? `<div class="attr-row"><span>轮回次数</span><span style="color:#9400d3">${rebirthInfo.count}次 (+${(rebirthInfo.bonus * 100).toFixed(0)}%)</span></div>` : ''}
        ${Game.g.partner ? `<div class="attr-row"><span>道侣</span><span style="color:#ff1493">${Game.g.partner}</span></div>` : ''}
        ${partnerBonusHtml}
        ${clanBonusHtml}
        <div class="attr-row"><span>下次轮回</span><span style="color:#ff6b6b">${CONFIG.realms[nextRebirthReq]}</span></div>
        <div class="row"><span class="lbl">突破率</span><span class="val">${g.stage >= CONFIG.realms.length - 1 ? '--' : Math.floor(Game.getBreakRate() * 100) + '%'}</span></div>
      </div>
      
      <div class="attr-full" style="margin-top:15px">
        <div style="color:#ffd700; font-weight:bold; margin-bottom:10px">⚔️ 战力构成详情</div>
        <div style="font-size:12px; line-height:1.8; color:#ccc">
          <div>境界基础: ${this.formatNumber(power.breakdown.base)} ${g.powerPills ? `(含战力丹+${g.powerPills * 1000})` : ''}</div>
          <div>力量加成: +${this.formatNumber(power.breakdown.attr)}</div>
          <div>灵根倍率: ×${power.breakdown.root}</div>
          <div>功法倍率: ×${power.breakdown.skillMult.toFixed(2)}</div>
          <div>功法加成: +${this.formatNumber(power.breakdown.skillBonus)}</div>
          ${rebirthInfo.count > 0 ? `<div>轮回加成: +${(rebirthInfo.bonus * 100).toFixed(0)}%</div>` : ''}
          ${Game.g.partner && DaoistCouple ? `<div>道侣加成: 全属性+${Math.floor((DaoistCouple.getAttrBonus()?.str || 0))}</div>` : ''}
        </div>
      </div>
    `;
  },
  
  renderSkills() {
    const d = document.getElementById('skillPage');
    
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'skill-scroll-container';
    
    const grid = document.createElement('div');
    grid.className = 'skill-grid';
    
    const currentStage = Game.g.stage;
    
    CONFIG.skills.forEach(s => {
      const owned = Game.g.skills.includes(s.id);
      const affordable = Game.g.stones >= s.c && !Game.g.dead && !Game.isBattling;
      const canLearn = currentStage >= s.tier;
      const rankColor = CONFIG.rankColors[s.rank] || '#aaa';
      
      let btnText = '';
      let disabled = !affordable || owned || !canLearn;
      
      if (owned) {
        btnText = '✓';
      } else if (!canLearn) {
        btnText = '🔒';
      } else if (!affordable) {
        btnText = '缺';
      } else {
        btnText = this.formatNumber(s.c);
      }
      
      const powerText = s.e.pm ? `+${(s.e.pm * 100).toFixed(0)}%` : '';
      
      const card = document.createElement('div');
      card.className = `skill-card ${owned ? 'owned' : ''} ${!canLearn ? 'locked' : ''}`;
      card.setAttribute('data-skill-id', s.id);
      
      card.addEventListener('mouseenter', (e) => {
        this.showSkillTooltip(e, s);
      });
      card.addEventListener('mouseleave', () => {
        this.hideSkillTooltip();
      });
      
      if ('ontouchstart' in window) {
        let touchTimer = null;
        let isLongPress = false;
        
        card.addEventListener('touchstart', (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('.skill-buy-btn')) {
            return;
          }
          touchTimer = setTimeout(() => {
            isLongPress = true;
            this.showSkillTooltip(e, s);
          }, 500);
        });
        
        card.addEventListener('touchend', (e) => {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
          if (!isLongPress) {
            const btn = card.querySelector('.skill-buy-btn');
            if (btn && !btn.disabled) {
              btn.click();
            }
          }
          isLongPress = false;
          setTimeout(() => this.hideSkillTooltip(), 100);
        });
        
        card.addEventListener('touchmove', () => {
          if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
          }
          isLongPress = false;
        });
      }
      
      card.innerHTML = `
        <div class="skill-name" style="color:${rankColor}">${s.n}</div>
        <div class="skill-power">${powerText}</div>
        <button class="skill-buy-btn ${owned ? 'owned' : ''}" 
                onclick="Game.buySkill('${s.id}')" 
                ${disabled ? 'disabled' : ''}>
          ${btnText}
        </button>
      `;
      grid.appendChild(card);
    });
    
    scrollContainer.appendChild(grid);
    d.innerHTML = '';
    d.appendChild(scrollContainer);
  },
  
  showSkillTooltip(event, skill) {
    if (this.skillTooltipTimer) {
      clearTimeout(this.skillTooltipTimer);
      this.skillTooltipTimer = null;
    }
    
    let tooltip = document.getElementById('skillTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'skillTooltip';
      tooltip.className = 'skill-tooltip';
      document.body.appendChild(tooltip);
    }
    
    const rankNames = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说', mythic: '神话', god: '天道' };
    
    tooltip.innerHTML = `
      <div class="skill-tooltip-name" style="color:${CONFIG.rankColors[skill.rank]}">《${skill.n}》</div>
      <div class="skill-tooltip-desc">${skill.d}</div>
      <div class="skill-tooltip-meta">
        <span>品质: ${rankNames[skill.rank] || skill.rank}</span>
        <span>需求: ${CONFIG.realms[skill.tier]}</span>
        <span>价格: ${this.formatNumber(skill.c)}灵石</span>
      </div>
    `;
    
    const rect = event.target.getBoundingClientRect();
    let top = rect.top - 10;
    let left = rect.left + rect.width / 2;
    
    if (top < 60) {
      top = rect.bottom + 10;
      tooltip.style.transform = 'translateX(-50%) translateY(0)';
    } else {
      tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
    }
    
    const tooltipWidth = 220;
    if (left - tooltipWidth / 2 < 10) {
      left = tooltipWidth / 2 + 10;
      tooltip.style.transform = 'translateX(0)';
    } else if (left + tooltipWidth / 2 > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth / 2 - 10;
      tooltip.style.transform = 'translateX(0)';
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add('show');
    
    this.skillTooltipTimer = setTimeout(() => {
      this.hideSkillTooltip();
    }, 3000);
  },
  
  hideSkillTooltip() {
    const tooltip = document.getElementById('skillTooltip');
    if (tooltip) {
      tooltip.classList.remove('show');
    }
    if (this.skillTooltipTimer) {
      clearTimeout(this.skillTooltipTimer);
      this.skillTooltipTimer = null;
    }
  },
  
  renderBag() {
    const d = document.getElementById('bagPage');
    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    
    const items = [
      { i: '🌿', n: '灵芝', c: Game.g.herbs.lingzhi },
      { i: '🩸', n: '血灵草', c: Game.g.herbs.xueying },
      { i: '🌸', n: '天心花', c: Game.g.herbs.tianxin },
      { i: '🍎', n: '混元果', c: Game.g.herbs.hunyuan },
      { i: '💊', n: '丹药', c: Game.g.pills },
      { i: '💎', n: '灵石', c: Game.g.stones },
      { i: '🌀', n: '妖核', c: Game.g.cores || 0 }
    ];
    
    items.forEach(it => {
      const item = document.createElement('div');
      item.className = `inv-item ${it.c ? '' : 'inv-empty'}`;
      item.innerHTML = `
        <div class="inv-icon">${it.i}</div>
        <div class="inv-name">${it.n}</div>
        ${it.c ? '<div class="inv-count">' + this.formatNumber(it.c) + '</div>' : ''}
      `;
      grid.appendChild(item);
    });
    
    d.innerHTML = '';
    d.appendChild(grid);
  },
  
  formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1e12) return (num / 1e12).toFixed(1) + '兆';
    if (num >= 1e8) return (num / 1e8).toFixed(1) + '亿';
    if (num >= 1e4) return (num / 1e4).toFixed(1) + '万';
    return Math.floor(num).toString();
  },
  
  updateStatus() {
    const g = Game.g;
    document.getElementById('dispStone').textContent = this.formatNumber(g.stones);
    document.getElementById('dispCores').textContent = this.formatNumber(g.cores || 0);
    const realm = CONFIG.realms[g.stage] || '未知';
    const maxExp = Game.getMaxExp();
    const grade = CONFIG.grades[g.grade];
    const power = PowerSystem.getPowerDetails(Game.user);
    const rebirthInfo = RebirthSystem.getRebirthInfo();
    const nextRebirthReq = RebirthSystem.getRequiredStage();
    
    let expDisplay, maxExpDisplay;
    if (g.stage >= CONFIG.realms.length - 1) {
      expDisplay = '∞';
      maxExpDisplay = '∞';
    } else {
      expDisplay = this.formatNumber(Math.floor(g.exp));
      maxExpDisplay = this.formatNumber(maxExp);
    }
    
    const partnerDisplay = g.partner ? 
      `<div class="row"><span class="lbl">道侣</span><span class="val" style="color:#ff1493">${g.partner}</span></div>` : '';
    
    let clanDisplay = '';
    if (ClanSystem && g.clanData && g.clanData.clanId) {
      const clan = ClanSystem.getPlayerClan();
      if (clan) {
        clanDisplay = `<div class="row"><span class="lbl">宗门</span><span class="val" style="color:#00c853">${clan.name} Lv.${clan.level}</span></div>`;
      }
    }
    
    document.getElementById('status').innerHTML = `
      <div class="row"><span class="lbl">道号</span><span class="val gold">${g.name}</span></div>
      <div class="row"><span class="lbl">境界</span><span class="val" style="color:${grade.c}">${realm}</span></div>
      <div class="row"><span class="lbl">修为</span><span class="val">${expDisplay}/${maxExpDisplay}</span></div>
      <div class="row"><span class="lbl">寿元</span><span class="val ${g.age >= g.life ? 'dead' : ''}">${Math.floor(g.age)}/${this.formatNumber(Math.floor(g.life))}</span></div>
      <div class="row"><span class="lbl">战力</span><span class="val" style="color:#ff6b6b; font-weight:bold">${this.formatNumber(power.total)}</span></div>
      <div class="row"><span class="lbl">灵根</span><span class="val" style="color:${grade.c}; text-shadow:0 0 5px ${grade.c}40">${grade.n}</span></div>
      <div class="row"><span class="lbl">妖核</span><span class="val" style="color:#9400d3">${this.formatNumber(g.cores || 0)}</span></div>
      ${rebirthInfo.count > 0 ? `<div class="row"><span class="lbl">轮回</span><span class="val" style="color:#9400d3">${rebirthInfo.count}次</span></div>` : ''}
      ${partnerDisplay}
      ${clanDisplay}
      <div class="row"><span class="lbl">下次轮回</span><span class="val" style="color:${g.stage >= nextRebirthReq ? '#00c853' : '#ff6b6b'}">${CONFIG.realms[nextRebirthReq]}</span></div>
      <div class="row"><span class="lbl">点击修为</span><span class="val" style="color:#5fa8ff">+${1 + (g.clickLevel || 0)}</span></div>
      <div class="row"><span class="lbl">突破率</span><span class="val">${g.stage >= CONFIG.realms.length - 1 ? '--' : Math.floor(Game.getBreakRate() * 100) + '%'}</span></div>
      <div class="exp-bar"><div class="exp-fill" style="width:${g.stage >= CONFIG.realms.length - 1 ? 100 : Math.min(100, g.exp / maxExp * 100)}%"></div></div>
    `;
    
    this.updateAutoButton();
    this.updateClickPowerDisplay();
  },
  
  log(msg, type) {
    const box = document.getElementById('logPage');
    const div = document.createElement('div');
    div.className = 'log-item log-' + type;
    const tm = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="time">[${tm}]</span>${sanitizeInput(msg)}`;
    
    if (box.children.length > 50) {
      box.removeChild(box.lastChild);
    }
    box.insertBefore(div, box.firstChild);
  },
  
  showRebirth(show) {
    const btn = document.getElementById('rebirthBtn');
    if (btn) btn.style.display = show ? 'inline-flex' : 'none';
    if (show && Game.g && Game.g.auto) {
      Game.toggleAuto();
    }
  }
};

/**
 * 商店系统
 * @namespace Shop
 */
const Shop = {
  buy(itemId) {
    if (Game.g.dead || Game.isBattling) {
      UI.log('当前状态不可购买物品', 'fail');
      return;
    }
    
    const item = CONFIG.shopItems.find(i => i.id === itemId);
    if (!item) {
      UI.log('商品不存在', 'fail');
      return;
    }
    
    if (item.type === 'click_power') {
      const currentPrice = 500 * ((Game.g.clickLevel || 0) + 1);
      if (Game.g.stones < currentPrice) {
        UI.log(`灵石不足！需要 ${UI.formatNumber(currentPrice)} 灵石`, 'fail');
        return;
      }
      
      Game.g.stones -= currentPrice;
      Game.g.clickLevel = (Game.g.clickLevel || 0) + 1;
      UI.log(`🎉 购买点击修为卡！当前每次点击修为 +${1 + Game.g.clickLevel}`, 'success');
      Game.save();
      UI.updateStatus();
      UI.renderShop();
      UI.updateClickPowerDisplay();
      return;
    }
    
    if (item.limit) {
      const purchased = Game.g.shopPurchased[item.id] || 0;
      if (purchased >= item.limit) {
        UI.log(`${item.name} 已达购买上限 (${item.limit}个)`, 'fail');
        return;
      }
    }
    
    if (Game.g.stones < item.price) {
      UI.log(`灵石不足！需要 ${UI.formatNumber(item.price)} 灵石`, 'fail');
      return;
    }
    
    Game.g.stones -= item.price;
    
    if (item.limit) {
      if (!Game.g.shopPurchased[itemId]) Game.g.shopPurchased[itemId] = 0;
      Game.g.shopPurchased[itemId]++;
    }
    
    switch (item.type) {
      case 'power':
        Game.g.powerPills += item.value / 1000;
        UI.log(`🎉 购买并服用战力丹！战力永久+${item.value}`, 'success');
        break;
        
      case 'herb_pack':
        if (item.tier === 'small') {
          const herbs = ['lingzhi', 'xueying', 'tianxin'];
          let total = 0;
          for (let i = 0; i < 5; i++) {
            const h = herbs[Math.floor(Math.random() * herbs.length)];
            Game.g.herbs[h] += Math.floor(Math.random() * 2) + 1;
            total++;
          }
          UI.log(`🌿 打开草药小包，获得${total}份草药`, 'success');
        } else {
          const herbs = ['lingzhi', 'xueying', 'tianxin', 'hunyuan'];
          let total = 0;
          for (let i = 0; i < 15; i++) {
            const h = herbs[Math.floor(Math.random() * herbs.length)];
            Game.g.herbs[h] += Math.floor(Math.random() * 3) + 1;
            total++;
          }
          UI.log(`🎁 打开草药大礼包，获得${total}份高级草药`, 'success');
        }
        break;
        
      case 'root_random':
        const oldGrade = Game.g.grade;
        const newGrade = randomGrade();
        Game.g.grade = newGrade;
        const gradeInfo = CONFIG.grades[newGrade];
        if (newGrade > oldGrade) {
          UI.log(`🎉 灵根重塑成功！获得 [${gradeInfo.n}]，资质大幅提升！`, 'success');
        } else if (newGrade < oldGrade) {
          UI.log(`💔 灵根重塑失败...变为 [${gradeInfo.n}]，资质下降`, 'fail');
        } else {
          UI.log(`☯️ 灵根重塑，资质未变 [${gradeInfo.n}]`, 'system');
        }
        break;
        
      case 'root_custom':
        this.openRootSelect();
        return;
        
      case 'pill':
        if (item.pillId === 'p2') {
          Game.g.pills++;
          UI.log(`购买破境丹 x1，当前拥有:${Game.g.pills}颗`, 'success');
        }
        break;
        
      case 'life':
        Game.g.life += item.value;
        UI.log(`服用寿元丹，寿元+${item.value}年！`, 'success');
        break;
        
      case 'exp':
        const expGain = Math.floor(Game.getMaxExp() * item.percent);
        Game.g.exp += expGain;
        UI.log(`服用修为丹，修为+${UI.formatNumber(expGain)}！`, 'success');
        break;
    }
    
    Game.save();
    UI.updateStatus();
    UI.renderShop();
  },
  
  openRootSelect() {
    const modal = document.getElementById('rootSelectModal');
    const list = document.getElementById('rootList');
    
    const fragment = document.createDocumentFragment();
    CONFIG.grades.forEach((grade, idx) => {
      const item = document.createElement('div');
      item.className = 'root-item';
      item.onclick = () => this.selectRoot(idx);
      item.innerHTML = `
        <div class="root-color" style="background:${grade.c}; color:${grade.c}"></div>
        <div class="root-info">
          <div class="root-name" style="color:${grade.c}">${grade.n}</div>
          <div class="root-mul">修炼倍率: ${grade.m}x</div>
        </div>
      `;
      fragment.appendChild(item);
    });
    
    list.innerHTML = '';
    list.appendChild(fragment);
    modal.classList.add('active');
  },
  
  closeRootSelect() {
    document.getElementById('rootSelectModal').classList.remove('active');
  },
  
  selectRoot(gradeIdx) {
    if (Game.g.stones < 100000000) {
      UI.log('灵石不足！需要1亿灵石', 'fail');
      this.closeRootSelect();
      return;
    }
    
    Game.g.grade = gradeIdx;
    const grade = CONFIG.grades[gradeIdx];
    UI.log(`✨ 自主选择灵根成功！获得 [${grade.n}]，修炼倍率${grade.m}x`, 'success');
    Game.save();
    UI.updateStatus();
    this.closeRootSelect();
    UI.renderShop();
  }
};

/**
 * 战力系统
 * @namespace PowerSystem
 */
const PowerSystem = {
  calculateBasePower(stage) {
    if (stage <= 0) return 10;
    let base = 10 * Math.pow(5, stage) * (1 + stage * 0.5);
    if (Game.g && Game.g.powerPills) {
      base += Game.g.powerPills * 1000;
    }
    return Math.floor(base);
  },
  
  getPowerDetails(username) {
    const user = username === Game.user ? Game.g : Auth.users[username]?.data;
    if (!user) return { total: 0, breakdown: {} };
    
    let base = this.calculateBasePower(user.stage);
    let attrBonus = (user.attrs?.str || 0) * 10;
    
    const grade = CONFIG.grades[user.grade] || CONFIG.grades[0];
    let rootMult = grade.m;
    
    let skillBonus = 0;
    let skillMult = 1;
    const skills = user.skills || [];
    
    skills.forEach(sid => {
      const skill = CONFIG.skills.find(s => s.id === sid);
      if (skill?.e?.pm) {
        if (skill.e.pm > 1) {
          skillMult += (skill.e.pm - 1);
        } else {
          skillBonus += skill.e.pm * base;
        }
      }
    });
    
    const rebirthInfo = RebirthSystem.getRebirthInfo();
    const rebirthBonus = 1 + rebirthInfo.bonus;
    
    let total = ((base + attrBonus + skillBonus) * rootMult * skillMult) * rebirthBonus;
    
    if (ClanSystem && username === Game.user && Game.g.clanData && Game.g.clanData.clanId) {
      const bonus = ClanSystem.getClanBonus();
      total *= bonus.battle;
    }
    
    return {
      total: Math.floor(total),
      min: Math.floor(total * 0.9),
      max: Math.floor(total * 1.1),
      breakdown: {
        base: base,
        attr: attrBonus,
        root: rootMult,
        skillBonus: skillBonus,
        skillMult: skillMult,
        realm: CONFIG.realms[user.stage],
        powerPills: user.powerPills || 0,
        rebirthBonus: rebirthBonus
      }
    };
  },
  
  getMaxHp(username) {
    const user = username === Game.user ? Game.g : Auth.users[username]?.data;
    if (!user) return 100;
    const baseHp = 100 + (user.stage * 50);
    const vitBonus = (user.attrs?.vit || 0) * 20;
    return baseHp + vitBonus;
  },
  
  getBattleStats(username) {
    const power = this.getPowerDetails(username);
    const user = username === Game.user ? Game.g : Auth.users[username]?.data;
    const skills = user.skills || [];
    
    let crit = 0.05;
    let dodge = 0;
    let lifeSteal = 0;
    let def = 0;
    
    skills.forEach(sid => {
      const skill = CONFIG.skills.find(s => s.id === sid);
      if (!skill) return;
      if (skill.e.crit) crit += skill.e.crit;
      if (skill.e.dodge) dodge += skill.e.dodge;
      if (skill.e.lifeSteal) lifeSteal += skill.e.lifeSteal;
      if (skill.e.def) def += skill.e.def;
    });
    
    return {
      power: power,
      hp: this.getMaxHp(username),
      crit: Math.min(crit, 0.8),
      dodge: Math.min(dodge, 0.6),
      lifeSteal: lifeSteal,
      def: def
    };
  }
};

/**
 * 页面初始化
 */
window.addEventListener('load', () => {
  DeviceDetector.applyDeviceClasses();
  I18n.init();
  Auth.load();
  
  if (typeof ClanSystem !== 'undefined') {
    ClanSystem.loadClansData();
  }
  
  Object.keys(Auth.users).forEach(username => {
    const userData = Auth.users[username].data;
    if (userData && userData.dataVerify?.restricted && userData.dataVerify.restrictUntil) {
      if (Date.now() >= userData.dataVerify.restrictUntil) {
        userData.dataVerify.restricted = false;
        userData.dataVerify.restrictUntil = null;
      }
    }
  });
  
  Auth.save();
  const autoLoginUser = AutoLoginManager.tryAutoLogin();
  
  const authBox = document.getElementById('authBox');
  const main = document.getElementById('main');
  if (authBox && main) {
    authBox.style.display = 'flex';
    main.style.display = 'none';
  }

  // ========== 登录表单事件绑定 ==========
  document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) {
      UI.log('请输入用户名和密码', 'fail');
      return;
    }
    const result = await Auth.login(username, password);
    if (result.success) {
      UI.log('登录成功！', 'success');
      Game.login(username);
      AutoLoginManager.setAutoLogin(username);
    } else {
      UI.log('登录失败：' + result.msg, 'fail');
    }
  });

  // ========== 注册表单事件绑定 ==========
  document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    if (!username || !password) {
      UI.log('请填写用户名和密码', 'fail');
      return;
    }
    const result = await Auth.register(username, password);
    if (result.code === 200) {
      UI.log('注册成功！请登录', 'success');
      document.getElementById('loginUsername').value = username;
      document.getElementById('loginPassword').value = '';
      // 切换到登录标签
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form-section').forEach(s => s.classList.remove('active'));
      document.querySelector('.auth-tab[data-tab="login"]')?.classList.add('active');
      document.getElementById('loginSection').classList.add('active');
    } else {
      UI.log('注册失败：' + result.msg, 'fail');
    }
  });
});

window.addEventListener('beforeunload', () => {
  if (Game && Game.cleanup) {
    Game.cleanup();
  }
});

window.addEventListener('resize', () => {
  if (DeviceDetector) {
    DeviceDetector.cachedDeviceType = null;
    DeviceDetector.applyDeviceClasses();
  }
});

window.APIAuth = { switchTab: function(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form-section').forEach(s => s.classList.remove('active'));
  if (tab === 'login') {
    document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
    document.getElementById('loginSection').classList.add('active');
  } else {
    document.querySelector('.auth-tab[data-tab="register"]').classList.add('active');
    document.getElementById('registerSection').classList.add('active');
  }
}};
window.Auth = Auth;
window.AutoLoginManager = AutoLoginManager;
window.UI = UI;
window.Shop = Shop;
window.PowerSystem = PowerSystem;

/**
 * 网易云音乐播放器模块（完整实现）
 * @namespace NetEaseMusic
 */
const NetEaseMusic = {
    songs: [],
    currentIndex: -1,
    currentQuality: 'hires',
    isPlaying: false,
    qualityNames: {
        'standard': '标准音质',
        'higher': '较高音质',
        'exhigh': '极高音质',
        'lossless': '无损音质',
        'hires': '高清音质'
    },
    
    init() {
        this.bindEvents();
        this.loadSavedState();
        this.addMusicButton();
    },
    
    addMusicButton() {
        const barInfo = document.querySelector('.bar-info');
        if (barInfo && !document.getElementById('neteaseMusicBtn')) {
            const musicBtn = document.createElement('span');
            musicBtn.id = 'neteaseMusicBtn';
            musicBtn.style.cssText = 'cursor:pointer; color:#6e8efb; margin-left:10px;';
            musicBtn.innerHTML = '🎵 音乐';
            musicBtn.setAttribute('tabindex', '0');
            musicBtn.setAttribute('role', 'button');
            musicBtn.style.cursor = 'pointer';
            musicBtn.addEventListener('click', () => this.open());
            musicBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.open();
                }
            });
            barInfo.appendChild(musicBtn);
        }
    },
    
    bindEvents() {
        const audio = document.getElementById('neteaseAudio');
        if (!audio) return;
        
        audio.addEventListener('loadedmetadata', () => this.updateDuration());
        audio.addEventListener('timeupdate', () => this.updateProgress());
        audio.addEventListener('ended', () => this.playNext());
        audio.addEventListener('error', () => this.handleAudioError());
        
        document.querySelectorAll('.netease-quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.netease-quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentQuality = btn.dataset.quality;
                if (this.currentIndex !== -1) {
                    this.playSong(this.songs[this.currentIndex], this.currentIndex);
                }
            });
        });
        
        const prevBtn = document.getElementById('neteasePrevBtn');
        const nextBtn = document.getElementById('neteaseNextBtn');
        const playPauseBtn = document.getElementById('neteasePlayPauseBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.playPrev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.playNext());
        if (playPauseBtn) playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        
        const progressBar = document.querySelector('.netease-progress-bar');
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                const audio = document.getElementById('neteaseAudio');
                const rect = progressBar.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                if (audio && audio.duration) {
                    audio.currentTime = percent * audio.duration;
                }
            });
        }
        
        window.addEventListener('beforeunload', () => this.saveState());
    },
    
    saveState() {
        const audio = document.getElementById('neteaseAudio');
        if (this.currentIndex !== -1 && this.songs[this.currentIndex]) {
            localStorage.setItem('netease_last_song', JSON.stringify({
                song: this.songs[this.currentIndex],
                quality: this.currentQuality,
                currentTime: audio ? audio.currentTime : 0
            }));
        }
    },
    
    loadSavedState() {
        try {
            const saved = localStorage.getItem('netease_last_song');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.song && data.quality) {
                    this.currentQuality = data.quality;
                    document.querySelectorAll('.netease-quality-btn').forEach(btn => {
                        if (btn.dataset.quality === this.currentQuality) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                    setTimeout(() => {
                        this.playSong(data.song, 0);
                        const audio = document.getElementById('neteaseAudio');
                        if (audio && data.currentTime) {
                            audio.currentTime = data.currentTime;
                        }
                    }, 1000);
                }
            }
        } catch (e) {
            console.log('加载音乐状态失败');
        }
    },
    
    open() {
        const modal = document.getElementById('neteaseMusicModal');
        if (modal) {
            modal.classList.add('active');
            this.updateMiniPlayerDisplay(false);
        }
    },
    
    close() {
        const modal = document.getElementById('neteaseMusicModal');
        if (modal) {
            modal.classList.remove('active');
        }
        if (this.currentIndex !== -1) {
            this.updateMiniPlayerDisplay(true);
        }
    },
    
    updateMiniPlayerDisplay(show) {
        const miniPlayer = document.getElementById('neteaseMiniPlayer');
        if (miniPlayer) {
            if (show && this.currentIndex !== -1) {
                miniPlayer.style.display = 'flex';
            } else {
                miniPlayer.style.display = 'none';
            }
        }
    },
    
    async search() {
        const input = document.getElementById('neteaseSearchInput');
        const query = input ? input.value.trim() : '';
        if (!query) {
            this.showError('请输入搜索关键词');
            return;
        }
        this.showLoading();
        try {
            const response = await fetch(`https://node.api.xfabe.com/api/wangyi/search?search=${encodeURIComponent(query)}&limit=20`);
            if (!response.ok) throw new Error('搜索失败');
            const data = await response.json();
            if (data.code !== 200 || !data.data || !data.data.songs) {
                throw new Error('未找到相关歌曲');
            }
            this.songs = data.data.songs;
            this.displayResults(this.songs);
            this.hideError();
        } catch (error) {
            this.showError(error.message);
            this.displayEmptyResults();
        }
    },
    
    showLoading() {
        const resultsList = document.getElementById('neteaseResultsList');
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="netease-empty-state">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>搜索中...</p>
                </div>
            `;
        }
        const countSpan = document.getElementById('neteaseResultsCount');
        if (countSpan) countSpan.textContent = '搜索中...';
    },
    
    displayResults(songs) {
        if (!songs || songs.length === 0) {
            this.displayEmptyResults();
            return;
        }
        let html = '';
        songs.forEach((song, index) => {
            const minutes = Math.floor(song.duration / 60000);
            const seconds = Math.floor((song.duration % 60000) / 1000).toString().padStart(2, '0');
            const isActive = index === this.currentIndex;
            html += `
                <div class="netease-song-item ${isActive ? 'active' : ''}" data-index="${index}">
                    <div class="netease-song-cover">
                        <i class="fas fa-music"></i>
                    </div>
                    <div class="netease-song-info">
                        <div class="netease-song-name">${this.escapeHtml(song.name)}</div>
                        <div class="netease-song-artist">${this.escapeHtml(song.artistsname)} · ${this.escapeHtml(song.album || '未知专辑')} · ${minutes}:${seconds}</div>
                    </div>
                    <div class="netease-song-actions">
                        <button class="netease-play-song" data-index="${index}">
                            <i class="fas fa-play"></i>
                        </button>
                        <button class="netease-download-song" data-index="${index}">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        const resultsList = document.getElementById('neteaseResultsList');
        const countSpan = document.getElementById('neteaseResultsCount');
        if (resultsList) resultsList.innerHTML = html;
        if (countSpan) countSpan.textContent = `${songs.length} 首歌曲`;
        
        document.querySelectorAll('.netease-play-song').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.playSong(this.songs[index], index);
            });
        });
        document.querySelectorAll('.netease-download-song').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.downloadSong(this.songs[index]);
            });
        });
        document.querySelectorAll('.netease-song-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.netease-song-actions')) {
                    const index = parseInt(item.dataset.index);
                    this.playSong(this.songs[index], index);
                }
            });
        });
    },
    
    displayEmptyResults() {
        const resultsList = document.getElementById('neteaseResultsList');
        const countSpan = document.getElementById('neteaseResultsCount');
        if (resultsList) {
            resultsList.innerHTML = `
                <div class="netease-empty-state">
                    <i class="fas fa-search"></i>
                    <p>未找到相关歌曲，请尝试其他关键词</p>
                </div>
            `;
        }
        if (countSpan) countSpan.textContent = '0 首歌曲';
    },
    
    async playSong(song, index) {
        try {
            this.currentIndex = index;
            this.updatePlayingUI(song, index);
            const audioUrl = await this.getAudioUrl(song.id, this.currentQuality);
            const audio = document.getElementById('neteaseAudio');
            if (!audio) return;
            audio.src = audioUrl;
            await audio.play();
            this.isPlaying = true;
            this.updatePlayButton(true);
            this.updateMiniPlayer(song);
            this.updateMiniPlayerDisplay(true);
        } catch (error) {
            this.showError('无法播放此歌曲，请尝试其他音质');
            console.error('播放错误:', error);
        }
    },
    
    async getAudioUrl(songId, quality) {
        try {
            const response = await fetch(`https://api.byfuns.top/1/?id=${songId}&level=${quality}`);
            if (!response.ok) throw new Error('获取链接失败');
            const audioUrl = await response.text();
            if (!audioUrl || !audioUrl.startsWith('http')) {
                throw new Error('无效链接');
            }
            return audioUrl;
        } catch (error) {
            const qualityOrder = ['hires', 'lossless', 'exhigh', 'higher', 'standard'];
            const currentIdx = qualityOrder.indexOf(quality);
            if (currentIdx < qualityOrder.length - 1) {
                const nextQuality = qualityOrder[currentIdx + 1];
                this.showError(`${this.qualityNames[quality]}失败，尝试${this.qualityNames[nextQuality]}...`);
                return await this.getAudioUrl(songId, nextQuality);
            }
            throw error;
        }
    },
    
    async downloadSong(song) {
        try {
            this.showError('正在获取下载链接...');
            const audioUrl = await this.getAudioUrl(song.id, this.currentQuality);
            const a = document.createElement('a');
            a.href = audioUrl;
            const ext = (this.currentQuality === 'hires' || this.currentQuality === 'lossless') ? 'flac' : 'mp3';
            a.download = `${song.name} - ${song.artistsname}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            this.showError(`下载已开始 (${this.qualityNames[this.currentQuality]})`);
            setTimeout(() => this.hideError(), 2000);
        } catch (error) {
            this.showError('下载失败，请稍后再试');
        }
    },
    
    updatePlayingUI(song, index) {
        document.querySelectorAll('.netease-song-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`.netease-song-item[data-index="${index}"]`);
        if (activeItem) activeItem.classList.add('active');
        
        const titleEl = document.getElementById('neteaseTitle');
        const artistEl = document.getElementById('neteaseArtist');
        if (titleEl) titleEl.textContent = song.name;
        if (artistEl) artistEl.textContent = `${song.artistsname} · ${song.album || '未知专辑'}`;
        this.updateMiniPlayer(song);
        const playerEl = document.getElementById('neteasePlayer');
        if (playerEl) playerEl.style.display = 'block';
    },
    
    updateMiniPlayer(song) {
        const miniTitle = document.getElementById('miniTitle');
        const miniArtist = document.getElementById('miniArtist');
        if (miniTitle) miniTitle.textContent = song.name;
        if (miniArtist) miniArtist.textContent = song.artistsname;
    },
    
    togglePlayPause() {
        const audio = document.getElementById('neteaseAudio');
        if (!audio || !audio.src) return;
        if (this.isPlaying) {
            audio.pause();
            this.isPlaying = false;
        } else {
            audio.play();
            this.isPlaying = true;
        }
        this.updatePlayButton(this.isPlaying);
    },
    
    updatePlayButton(isPlaying) {
        const playIcon = document.getElementById('neteasePlayIcon');
        const miniPlayIcon = document.getElementById('miniPlayIcon');
        const cover = document.getElementById('neteaseCover');
        const miniCover = document.getElementById('miniCover');
        if (playIcon) {
            playIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
        if (miniPlayIcon) {
            miniPlayIcon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
        if (cover) {
            cover.classList.toggle('playing', isPlaying);
        }
        if (miniCover) {
            miniCover.classList.toggle('playing', isPlaying);
        }
    },
    
    playPrev() {
        if (this.songs.length === 0) return;
        let newIndex = this.currentIndex - 1;
        if (newIndex < 0) newIndex = this.songs.length - 1;
        this.playSong(this.songs[newIndex], newIndex);
    },
    
    playNext() {
        if (this.songs.length === 0) return;
        let newIndex = this.currentIndex + 1;
        if (newIndex >= this.songs.length) newIndex = 0;
        this.playSong(this.songs[newIndex], newIndex);
    },
    
    updateProgress() {
        const audio = document.getElementById('neteaseAudio');
        if (!audio || !audio.duration) return;
        const percent = (audio.currentTime / audio.duration) * 100;
        const progressFill = document.getElementById('neteaseProgress');
        if (progressFill) progressFill.style.width = `${percent}%`;
        const currentTimeEl = document.getElementById('neteaseCurrentTime');
        if (currentTimeEl) currentTimeEl.textContent = this.formatTime(audio.currentTime);
    },
    
    updateDuration() {
        const audio = document.getElementById('neteaseAudio');
        const durationEl = document.getElementById('neteaseDuration');
        if (durationEl && audio) {
            durationEl.textContent = this.formatTime(audio.duration);
        }
    },
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    },
    
    handleAudioError() {
        this.showError('播放失败，请尝试其他音质');
        this.isPlaying = false;
        this.updatePlayButton(false);
    },
    
    showError(message) {
        let errorDiv = document.getElementById('neteaseErrorMsg');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'neteaseErrorMsg';
            errorDiv.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(255,107,107,0.9); color:#fff; padding:8px 16px; border-radius:20px; font-size:12px; z-index:3500; white-space:nowrap;';
            document.body.appendChild(errorDiv);
        }
        errorDiv.textContent = message;
        setTimeout(() => {
            if (errorDiv && errorDiv.remove) errorDiv.remove();
        }, 3000);
    },
    
    hideError() {
        const errorDiv = document.getElementById('neteaseErrorMsg');
        if (errorDiv) errorDiv.remove();
    },
    
    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
};

// 初始化音乐播放器（延迟，等待游戏加载）
setTimeout(() => {
    if (Game && Game.user) {
        NetEaseMusic.init();
    } else {
        const checkInterval = setInterval(() => {
            if (Game && Game.user) {
                clearInterval(checkInterval);
                NetEaseMusic.init();
            }
        }, 1000);
    }
}, 2000);

window.NetEaseMusic = NetEaseMusic;