/**
 * ==================== 数据导入导出系统 ====================
 * @namespace DataManager
 */
const DataManager = {
  openModal() {
    document.getElementById('dataModal').classList.add('active');
    document.getElementById('exportData').textContent = '点击导出按钮生成存档代码...';
    document.getElementById('importData').value = '';
  },
  
  closeModal() {
    document.getElementById('dataModal').classList.remove('active');
  },
  
  exportData() {
    // 导出所有用户数据
    const exportData = {
      version: '2.0',
      exportTime: Date.now(),
      users: Auth.users
    };
    
    // 压缩并编码
    const jsonStr = JSON.stringify(exportData);
    const encoded = btoa(encodeURIComponent(jsonStr));
    
    document.getElementById('exportData').textContent = encoded;
    return encoded;
  },
  
  importData() {
    const input = document.getElementById('importData').value.trim();
    if (!input) {
      alert('请输入存档代码！');
      return;
    }
    
    try {
      // 解码
      const jsonStr = decodeURIComponent(atob(input));
      const data = JSON.parse(jsonStr);
      
      if (!data.users) {
        alert('无效的存档数据！');
        return;
      }
      
      if (!confirm('⚠️ 导入将覆盖当前设备的所有数据，确定继续吗？')) {
        return;
      }
      
      // 合并数据（保留较新的数据）
      Object.keys(data.users).forEach(username => {
        const importedUser = data.users[username];
        const existingUser = Auth.users[username];
        
        if (!existingUser) {
          // 新用户，直接添加
          Auth.users[username] = importedUser;
        } else {
          // 已有用户，比较数据版本
          const importedTime = importedUser.data?.lastSaveTime || 0;
          const existingTime = existingUser.data?.lastSaveTime || 0;
          
          if (importedTime > existingTime) {
            Auth.users[username] = importedUser;
          }
        }
      });
      
      Auth.save();
      alert('✅ 数据导入成功！请重新登录。');
      this.closeModal();
      location.reload();
    } catch (e) {
      console.error('导入失败:', e);
      alert('❌ 存档代码无效或已损坏！');
    }
  },
  
  copyToClipboard() {
    const text = document.getElementById('exportData').textContent;
    if (text === '点击导出按钮生成存档代码...') {
      alert('请先点击导出按钮！');
      return;
    }
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('✅ 已复制到剪贴板！');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  },
  
  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('✅ 已复制到剪贴板！');
  }
};