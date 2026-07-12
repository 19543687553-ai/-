/**
 * PVP系统
 * @namespace PVPSystem
 */
const PVPSystem = {
  currentChallengeTarget: null,
  currentBet: 0,
  pendingChallenge: null,
  
  openChallenge(targetName) {
    const now = Date.now();
    const lastChallenge = Game.g.lastChallengeTime || 0;
    if (now - lastChallenge < CONFIG.CHALLENGE_COOLDOWN) {
      const remaining = Math.ceil((CONFIG.CHALLENGE_COOLDOWN - (now - lastChallenge)) / 1000);
      alert(`挑战冷却中，还需等待${remaining}秒`);
      return;
    }
    
    this.currentChallengeTarget = targetName;
    const myPower = PowerSystem.getPowerDetails(Game.user);
    const enemyPower = PowerSystem.getPowerDetails(targetName);
    
    document.getElementById('challengeMeName').textContent = Game.user;
    document.getElementById('challengeMeRealm').textContent = CONFIG.realms[Game.g.stage];
    document.getElementById('challengeMePower').textContent = `战力: ${UI.formatNumber(myPower.total)}`;
    
    document.getElementById('challengeEnemyName').textContent = targetName;
    document.getElementById('challengeEnemyRealm').textContent = CONFIG.realms[Auth.users[targetName].data.stage];
    document.getElementById('challengeEnemyPower').textContent = `战力: ${UI.formatNumber(enemyPower.total)}`;
    
    const meAvatar = document.getElementById('challengeMeAvatar');
    const enemyAvatar = document.getElementById('challengeEnemyAvatar');
    
    meAvatar.classList.toggle('powerful', myPower.total > enemyPower.total * 1.5);
    enemyAvatar.classList.toggle('powerful', enemyPower.total > myPower.total * 1.5);
    
    document.getElementById('challengeModal').classList.add('active');
    this.selectBet(0);
  },
  
  closeChallenge() {
    document.getElementById('challengeModal').classList.remove('active');
    this.currentChallengeTarget = null;
  },
  
  selectBet(amount) {
    this.currentBet = amount;
    document.querySelectorAll('.challenge-bet-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.amount) === amount);
    });
  },
  
  sendChallenge() {
    if (!this.currentChallengeTarget) return;
    
    const now = Date.now();
    const lastChallenge = Game.g.lastChallengeTime || 0;
    if (now - lastChallenge < CONFIG.CHALLENGE_COOLDOWN) {
      alert('挑战冷却中');
      return;
    }
    
    if (this.currentBet > 0 && Game.g.stones < this.currentBet) {
      alert('灵石不足以支付赌注');
      return;
    }
    
    if (this.currentBet > 0) {
      Game.g.stones -= this.currentBet;
      UI.updateStatus();
    }
    
    Game.g.lastChallengeTime = now;
    
    this.startPVPBattle(Game.user, this.currentChallengeTarget, this.currentBet);
    this.closeChallenge();
  },
  
  startPVPBattle(player1, player2, bet) {
    const modal = document.getElementById('pvpBattleModal');
    modal.classList.add('active');
    
    const p1Data = player1 === Game.user ? Game.g : Auth.users[player1].data;
    const p2Data = player2 === Game.user ? Game.g : Auth.users[player2].data;
    
    document.getElementById('pvpMeName').textContent = player1;
    document.getElementById('pvpMeRealm').textContent = CONFIG.realms[p1Data.stage];
    document.getElementById('pvpMePower').textContent = UI.formatNumber(PowerSystem.getPowerDetails(player1).total);
    
    document.getElementById('pvpEnemyName').textContent = player2;
    document.getElementById('pvpEnemyRealm').textContent = CONFIG.realms[p2Data.stage];
    document.getElementById('pvpEnemyPower').textContent = UI.formatNumber(PowerSystem.getPowerDetails(player2).total);
    
    const log = document.getElementById('pvpBattleLog');
    log.innerHTML = '';
    
    let p1Hp = 100, p2Hp = 100;
    let turn = 0;
    const maxTurn = 20;
    
    const battleInterval = setInterval(() => {
      turn++;
      if (turn > maxTurn || p1Hp <= 0 || p2Hp <= 0) {
        clearInterval(battleInterval);
        const p1Wins = p1Hp > p2Hp;
        this.showPVPResult(p1Wins, bet, player2);
        return;
      }
      
      if (turn % 2 === 1) {
        const dmg = Math.floor(Math.random() * 20) + 10;
        p2Hp = Math.max(0, p2Hp - dmg);
        document.getElementById('pvpEnemyHp').style.width = p2Hp + '%';
        if (p2Hp < 30) document.getElementById('pvpEnemyHp').classList.add('low');
        
        const attackTexts = ['发起了猛烈的攻击', '使出绝技', '轰出一拳', '祭出法宝'];
        const text = attackTexts[Math.floor(Math.random() * attackTexts.length)];
        log.innerHTML += `<div class="pvp-log-item attack">${player1}${text}，造成${dmg}点伤害</div>`;
      } else {
        const dmg = Math.floor(Math.random() * 20) + 10;
        p1Hp = Math.max(0, p1Hp - dmg);
        document.getElementById('pvpMeHp').style.width = p1Hp + '%';
        if (p1Hp < 30) document.getElementById('pvpMeHp').classList.add('low');
        
        const attackTexts = ['发起了猛烈的攻击', '使出绝技', '轰出一拳', '祭出法宝'];
        const text = attackTexts[Math.floor(Math.random() * attackTexts.length)];
        log.innerHTML += `<div class="pvp-log-item skill">${player2}${text}，造成${dmg}点伤害</div>`;
      }
      
      log.scrollTop = log.scrollHeight;
    }, 800);
  },
  
  showPVPResult(isWin, bet, opponent) {
    document.getElementById('pvpResultArea').style.display = 'block';
    const resultText = document.getElementById('pvpResultText');
    const rewardText = document.getElementById('pvpRewardText');
    
    if (isWin) {
      const reward = 500 + bet * 2;
      Game.g.stones += reward;
      Game.g.fame = (Game.g.fame || 0) + 10;
      rewardText.textContent = `获得 ${reward} 灵石， Fame +10`;
      Game.log(`切磋战胜 ${opponent}，获得${reward}灵石`, 'success');
    } else {
      resultText.textContent = '失败...';
      resultText.className = 'pvp-result lose';
      rewardText.textContent = bet > 0 ? `失去 ${bet} 灵石赌注` : '再接再厉';
      if (bet > 0) Game.log(`切磋败给 ${opponent}，失去赌注${bet}灵石`, 'fail');
      else Game.log(`切磋败给 ${opponent}`, 'fail');
    }
    
    Game.save();
    UI.updateStatus();
  },
  
  closeBattle() {
    document.getElementById('pvpBattleModal').classList.remove('active');
    document.getElementById('pvpResultArea').style.display = 'none';
    document.getElementById('pvpMeHp').style.width = '100%';
    document.getElementById('pvpEnemyHp').style.width = '100%';
    document.getElementById('pvpMeHp').classList.remove('low');
    document.getElementById('pvpEnemyHp').classList.remove('low');
    this.currentChallengeTarget = null;
  }
};