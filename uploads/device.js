/**
 * ==================== 设备检测系统 ====================
 * @namespace DeviceDetector
 */
const DeviceDetector = {
  cachedDeviceType: null,
  
  detectDevice() {
    if (this.cachedDeviceType) {
      return this.cachedDeviceType;
    }
    
    const ua = navigator.userAgent.toLowerCase();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    const hasTouch = 'ontouchend' in window || maxTouchPoints > 0;
    
    // 检测智能电视
    const tvPatterns = [
      /smart[-]?tv/i, /android.*tv/i, /webos/i, /tv\.samsung/i,
      /crkey/i, /roku/i, /appletv/i, /tv\.sony/i, /bravia/i,
      /viera/i, /netcast/i
    ];
    
    for (const pattern of tvPatterns) {
      if (pattern.test(ua)) {
        this.cachedDeviceType = 'tv';
        return 'tv';
      }
    }
    
    // 检测平板
    const isiPad = /ipad/i.test(ua);
    const isAndroidTablet = /android/i.test(ua) && !/mobile/i.test(ua);
    const isWindowsTablet = /tablet/i.test(ua) || (hasTouch && width >= 768);
    const isTabletBySize = hasTouch && (
      (width >= 768 && width <= 1024) || 
      (width >= 1024 && height >= 768 && width <= height * 1.5)
    );
    
    if (isiPad || isAndroidTablet || isWindowsTablet || isTabletBySize) {
      this.cachedDeviceType = 'tablet';
      return 'tablet';
    }
    
    // 检测手机
    const isMobile = /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|bb10|opera mini/i.test(ua);
    const isSmallScreen = width < 768 && hasTouch;
    
    if (isMobile || isSmallScreen) {
      this.cachedDeviceType = 'phone';
      return 'phone';
    }
    
    this.cachedDeviceType = 'pc';
    return 'pc';
  },
  
  isTouchDevice() {
    return 'ontouchend' in window || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
  },
  
  applyDeviceClasses() {
    const deviceType = this.detectDevice();
    const isTouch = this.isTouchDevice();
    
    document.body.classList.remove('device-phone', 'device-tablet', 'device-tv', 'device-pc', 'touch-device', 'mobile-device');
    document.body.classList.add(`device-${deviceType}`);
    
    if (isTouch) {
      document.body.classList.add('touch-device');
    }
    
    if (deviceType === 'phone' || deviceType === 'tablet') {
      document.body.classList.add('mobile-device');
    }
    
    this.showDeviceInfo(deviceType, isTouch);
  },
  
  showDeviceInfo(deviceType, isTouch) {
    const deviceInfo = document.getElementById('deviceInfo');
    if (deviceInfo) {
      const info = {
        类型: deviceType === 'phone' ? '手机' : 
               deviceType === 'tablet' ? '平板' : 
               deviceType === 'tv' ? '智能电视' : '电脑',
        触摸: isTouch ? '是' : '否',
        屏幕: `${window.innerWidth}×${window.innerHeight}`,
        UA: navigator.userAgent.substring(0, 30) + '...'
      };
      
      deviceInfo.innerHTML = `📱 ${info.类型} | 触摸:${info.触摸} | ${info.屏幕}`;
      deviceInfo.classList.add('show');
      
      setTimeout(() => {
        deviceInfo.classList.remove('show');
      }, 5000);
    }
  }
};