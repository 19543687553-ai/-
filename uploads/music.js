/**
 * 音乐系统
 * @namespace Music
 */
const Music = {
  calm: document.getElementById('bgmCalm'),
  battle: document.getElementById('bgmBattle'),
  thunder: document.getElementById('soundThunder'),
  enabled: false,
  isBattling: false,
  soundEnabled: true,
  playlist: {
    calm: [
      "mmexport1769642349271.mp3",
      "mmexport1769732529076.mp3",
      "mmexport1769733331809.mp3",
      "mmexport1769907312982.mp3"
    ],
    battle: "mmexport1769642617185.mp3",
    thunder: "thunder.mp3"
  },
  currentCalmIndex: -1,
  beforeThunderMusic: null,
  beforeThunderSrc: null,
  beforeThunderTime: 0,
  
  init() {
    this.calm.volume = 0.4;
    this.battle.volume = 0.6;
    this.thunder.volume = 0.8;
    this.calm.loop = true;
    this.battle.loop = true;
    this.thunder.loop = false;
    
    document.getElementById('musicBtn').onclick = () => this.toggle();
    
    this.thunder.onended = () => {
      this.resumeMusic();
    };
    
    this.calm.onended = () => {
      if (this.enabled && !this.isBattling) {
        this.playRandomCalm();
      }
    };
    
    const firstClick = () => {
      if (!this.enabled) {
        this.toggle();
      }
    };
    document.body.addEventListener('click', firstClick, { once: true });
  },
  
  playRandomCalm() {
    if (!this.enabled || this.isBattling) return;
    
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * this.playlist.calm.length);
    } while (newIndex === this.currentCalmIndex && this.playlist.calm.length > 1);
    
    this.currentCalmIndex = newIndex;
    this.calm.src = this.playlist.calm[newIndex];
    this.calm.play().catch(e => {
      console.log('背景音乐播放失败:', e);
    });
  },
  
  toggle() {
    this.enabled = !this.enabled;
    const btn = document.getElementById('musicBtn');
    btn.textContent = this.enabled ? '🎵' : '🔇';
    btn.style.opacity = this.enabled ? '1' : '0.5';
    
    if (this.enabled) {
      if (this.isBattling) {
        if (!this.battle.src) {
          this.battle.src = this.playlist.battle;
        }
        this.battle.play().catch(e => { });
      } else {
        this.playRandomCalm();
      }
    } else {
      this.calm.pause();
      this.battle.pause();
    }
  },
  
  playBattle() {
    if (this.isBattling) return;
    this.isBattling = true;
    
    if (this.enabled) {
      this.calm.pause();
      this.battle.src = this.playlist.battle;
      this.battle.currentTime = 0;
      this.battle.play().catch(e => {
        console.log('战斗音乐播放失败:', e);
      });
    }
  },
  
  stopBattle() {
    if (!this.isBattling) return;
    this.isBattling = false;
    
    if (this.enabled) {
      this.battle.pause();
      this.playRandomCalm();
    }
  },
  
  playThunderWithPause() {
    if (!this.enabled) return;
    
    if (!this.battle.paused) {
      this.beforeThunderMusic = 'battle';
      this.beforeThunderSrc = this.battle.src;
      this.beforeThunderTime = this.battle.currentTime;
      this.battle.pause();
    } else if (!this.calm.paused) {
      this.beforeThunderMusic = 'calm';
      this.beforeThunderSrc = this.calm.src;
      this.beforeThunderTime = this.calm.currentTime;
      this.calm.pause();
    } else {
      this.beforeThunderMusic = null;
    }
    
    if (this.thunder.src !== this.playlist.thunder) {
      this.thunder.src = this.playlist.thunder;
    }
    this.thunder.currentTime = 0;
    this.thunder.play().catch(e => {
      console.log('闪电音效播放失败:', e);
      this.resumeMusic();
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    });
  },
  
  resumeMusic() {
    if (!this.enabled) return;
    
    if (this.beforeThunderMusic === 'battle') {
      this.battle.src = this.beforeThunderSrc;
      this.battle.currentTime = this.beforeThunderTime;
      this.battle.play().catch(e => console.log('恢复战斗音乐失败:', e));
    } else if (this.beforeThunderMusic === 'calm') {
      this.calm.src = this.beforeThunderSrc;
      this.calm.currentTime = this.beforeThunderTime;
      this.calm.play().catch(e => console.log('恢复背景音乐失败:', e));
    } else {
      this.playRandomCalm();
    }
    
    this.beforeThunderMusic = null;
    this.beforeThunderSrc = null;
    this.beforeThunderTime = 0;
  },
  
  playThunder() {
    if (!this.enabled) return;
    
    this.thunder.currentTime = 0;
    this.thunder.play().catch(e => {
      console.log('闪电音效播放失败:', e);
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    });
  }
};