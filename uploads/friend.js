/**
 * 好友系统
 * @namespace FriendSystem
 */
const FriendSystem = {
  currentChatFriend: null,
  currentGiftType: 'stones',
  currentGiftTarget: null,
  
  init() {
    if (!Game.g.friends) Game.g.friends = [];
    if (!Game.g.chatHistory) Game.g.chatHistory = {};
    if (!Game.g.unreadMessages) Game.g.unreadMessages = {};
    if (!Game.g.challenges) Game.g.challenges = [];
    this.updateBadge();
  },
  
  renderFriendList() {
    const d = document.getElementById('friendPage');
    const fragment = document.createDocumentFragment();
    
    const header = document.createElement('div');
    header.className = 'friend-header';
    header.innerHTML = `
      <span class="friend-title">好友列表 (${Game.g.friends.length})</span>
      <button class="friend-add-btn" onclick="FriendSystem.openAddFriend()">+ 添加好友</button>
    `;
    fragment.appendChild(header);
    
    const list = document.createElement('div');
    list.className = 'friend-list';
    
    if (Game.g.friends.length === 0) {
      list.innerHTML = '<div style="text-align:center; color:#888; padding:20px;">暂无好友，点击右上角添加</div>';
    } else {
      Game.g.friends.forEach(friendName => {
        const friendData = Auth.users[friendName];
        if (!friendData) return;
        
        const card = document.createElement('div');
        card.className = 'friend-card';
        
        // 获取求婚按钮HTML
        const proposeBtn = DaoistCouple ? DaoistCouple.renderProposeButton(friendName) : '';
        
        card.innerHTML = `
          <div class="friend-avatar online">${friendName.charAt(0)}</div>
          <div class="friend-info">
            <div class="friend-name">${friendName}</div>
            <div class="friend-status">${CONFIG.realms[friendData.data.stage]}期 · 战力${UI.formatNumber(PowerSystem.getPowerDetails(friendName).total)}</div>
          </div>
          <div class="friend-actions">
            <button class="friend-btn chat" onclick="FriendSystem.openChat('${friendName}')">私聊</button>
            ${proposeBtn}
            <button class="friend-btn gift" onclick="FriendSystem.openGift('${friendName}')">送礼</button>
            <button class="friend-btn challenge" onclick="PVPSystem.openChallenge('${friendName}')">切磋</button>
            <button class="friend-btn delete" onclick="FriendSystem.deleteFriend('${friendName}')">删除</button>
          </div>
        `;
        list.appendChild(card);
      });
    }
    
    fragment.appendChild(list);
    d.innerHTML = '';
    d.appendChild(fragment);
  },
  
  updateBadge() {
    const badge = document.getElementById('friendBadge');
    if (!badge) return;
    const count = Object.keys(Game.g.unreadMessages || {}).length;
    badge.textContent = count > 0 ? `(${count})` : '';
    badge.style.color = '#ff416c';
  },
  
  checkNewMessages() {
    this.updateBadge();
  },
  
  openAddFriend() {
    document.getElementById('addFriendModal').classList.add('active');
    document.getElementById('searchUser').value = '';
    document.getElementById('searchUser').focus();
    document.getElementById('searchResults').innerHTML = '';
  },
  
  closeAddFriend() {
    document.getElementById('addFriendModal').classList.remove('active');
  },
  
  searchUsers() {
    const search = sanitizeInput(document.getElementById('searchUser').value.trim().toLowerCase());
    const results = document.getElementById('searchResults');
    if (!search) {
      results.innerHTML = '';
      return;
    }
    
    const found = Object.keys(Auth.users).filter(u =>
      u.toLowerCase().includes(search) && u !== Game.user && !Game.g.friends.includes(u)
    );
    
    if (found.length === 0) {
      results.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">未找到匹配的用户</div>';
    } else {
      results.innerHTML = found.map(u => `
        <div class="add-friend-item">
          <span class="add-friend-name">${u}</span>
          <button class="add-friend-btn" onclick="FriendSystem.sendFriendRequest('${u}')">添加</button>
        </div>
      `).join('');
    }
  },
  
  sendFriendRequest(target) {
    if (!Auth.users[target]) {
      alert('用户不存在');
      return;
    }
    if (Game.g.friends.includes(target)) {
      alert('已经是好友了');
      return;
    }
    if (target === Game.user) {
      alert('不能添加自己');
      return;
    }
    
    Game.g.friends.push(target);
    if (!Auth.users[target].data.friends) Auth.users[target].data.friends = [];
    if (!Auth.users[target].data.friends.includes(Game.user)) {
      Auth.users[target].data.friends.push(Game.user);
    }
    
    Game.save();
    Auth.save();
    alert(`已向 ${target} 发送好友请求（已自动成为好友）`);
    this.closeAddFriend();
    this.renderFriendList();
  },
  
  deleteFriend(name) {
    if (!confirm(`确定删除好友 ${name} 吗？`)) return;
    Game.g.friends = Game.g.friends.filter(f => f !== name);
    const targetData = Auth.users[name];
    if (targetData && targetData.data.friends) {
      targetData.data.friends = targetData.data.friends.filter(f => f !== Game.user);
    }
    Game.save();
    Auth.save();
    this.renderFriendList();
  },
  
  openChat(friendName) {
    this.currentChatFriend = friendName;
    document.getElementById('chatModal').classList.add('active');
    document.getElementById('chatTitle').textContent = `与 ${friendName} 聊天`;
    this.renderChatMessages();
    document.getElementById('chatInput').focus();
    
    if (Game.g.unreadMessages[friendName]) {
      delete Game.g.unreadMessages[friendName];
      Game.save();
      this.updateBadge();
    }
  },
  
  closeChat() {
    document.getElementById('chatModal').classList.remove('active');
    this.currentChatFriend = null;
  },
  
  renderChatMessages() {
    const container = document.getElementById('chatMessages');
    const key = [Game.user, this.currentChatFriend].sort().join('-');
    const messages = Game.g.chatHistory[key] || [];
    
    container.innerHTML = messages.map(m => `
      <div class="chat-message ${m.from === Game.user ? 'mine' : 'other'}">
        ${sanitizeInput(m.content)}
        <div class="chat-time">${m.time}</div>
      </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
  },
  
  sendMessage() {
    const input = document.getElementById('chatInput');
    const content = sanitizeInput(input.value.trim());
    if (!content) return;
    
    const key = [Game.user, this.currentChatFriend].sort().join('-');
    if (!Game.g.chatHistory[key]) Game.g.chatHistory[key] = [];
    if (!Auth.users[this.currentChatFriend].data.chatHistory[key])
      Auth.users[this.currentChatFriend].data.chatHistory[key] = [];
    
    const msg = {
      from: Game.user,
      content: content,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
    
    Game.g.chatHistory[key].push(msg);
    Auth.users[this.currentChatFriend].data.chatHistory[key].push(msg);
    
    if (!Auth.users[this.currentChatFriend].data.unreadMessages)
      Auth.users[this.currentChatFriend].data.unreadMessages = {};
    Auth.users[this.currentChatFriend].data.unreadMessages[Game.user] = true;
    
    input.value = '';
    this.renderChatMessages();
    Game.save();
    Auth.save();
  },
  
  openGift(target) {
    this.currentGiftTarget = target;
    document.getElementById('giftModal').classList.add('active');
    document.getElementById('giftTargetName').textContent = target;
    document.getElementById('giftAmount').value = '100';
    this.selectGiftType('stones');
  },
  
  closeGift() {
    document.getElementById('giftModal').classList.remove('active');
    this.currentGiftTarget = null;
  },
  
  selectGiftType(type) {
    this.currentGiftType = type;
    document.querySelectorAll('.gift-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  },
  
  confirmGift() {
    const amount = parseInt(document.getElementById('giftAmount').value) || 0;
    if (amount <= 0) {
      alert('请输入有效的数量');
      return;
    }
    
    if (this.currentGiftType === 'stones') {
      if (Game.g.stones < amount) {
        alert('灵石不足');
        return;
      }
      Game.g.stones -= amount;
      if (!Auth.users[this.currentGiftTarget].data.stones)
        Auth.users[this.currentGiftTarget].data.stones = 0;
      Auth.users[this.currentGiftTarget].data.stones += amount;
      Game.log(`赠送 ${this.currentGiftTarget} ${amount} 灵石`, 'system');
    } else {
      if (Game.g.pills < amount) {
        alert('丹药不足');
        return;
      }
      Game.g.pills -= amount;
      if (!Auth.users[this.currentGiftTarget].data.pills)
        Auth.users[this.currentGiftTarget].data.pills = 0;
      Auth.users[this.currentGiftTarget].data.pills += amount;
      Game.log(`赠送 ${this.currentGiftTarget} ${amount} 颗丹药`, 'system');
    }
    
    Game.save();
    Auth.save();
    this.closeGift();
    UI.updateStatus();
  }
};
