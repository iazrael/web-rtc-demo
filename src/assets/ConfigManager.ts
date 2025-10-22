/**
 * 配置管理器 - 负责管理应用配置的存储和获取
 * 与UI无关，可以被任何模块导入使用
 */
export interface AppConfig {
  appId?: string;
  secret?: string;
  userId?: string;
  roomId?: string;
  streamId?: string;
  effectiveTime?: string;
  payload?: string;
}

class ConfigManager {
  // 配置项名称
  private static readonly CONFIG_FIELDS = [
    'configAppId', 'configSecret', 'configUserId', 'configRoomId', 
    'configStreamId', 'configEffectiveTime', 'configPayload'
  ];

  /**
   * 从localStorage加载所有配置
   */
  static loadConfigFromStorage(): AppConfig {
    const config: AppConfig = {};
    
    try {
      // 确保将null转换为undefined，符合AppConfig接口的类型定义
      const getItem = (key: string): string | undefined => {
        const value = localStorage.getItem(key);
        return value === null ? undefined : value;
      };
      
      config.appId = getItem('configAppId');
      config.secret = getItem('configSecret');
      config.userId = getItem('configUserId');
      config.roomId = getItem('configRoomId');
      config.streamId = getItem('configStreamId');
      config.effectiveTime = getItem('configEffectiveTime');
      config.payload = getItem('configPayload');
    } catch (error) {
      console.error('加载配置失败:', error);
    }
    // console.log('加载配置:', config);
    return config;
  }

  /**
   * 保存配置到localStorage
   * @param config 要保存的配置对象
   */
  static saveConfigToStorage(config: AppConfig): void {
    try {
      if (config.appId !== undefined) {
        localStorage.setItem('configAppId', config.appId);
      }
      if (config.secret !== undefined) {
        localStorage.setItem('configSecret', config.secret);
      }
      if (config.userId !== undefined) {
        localStorage.setItem('configUserId', config.userId);
      }
      if (config.roomId !== undefined) {
        localStorage.setItem('configRoomId', config.roomId);
      }
      if (config.streamId !== undefined) {
        localStorage.setItem('configStreamId', config.streamId);
      }
      if (config.effectiveTime !== undefined) {
        localStorage.setItem('configEffectiveTime', config.effectiveTime);
      }
      if (config.payload !== undefined) {
        localStorage.setItem('configPayload', config.payload);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  /**
   * 获取单个配置项
   * @param key 配置项名称
   */
  static getConfigItem(key: keyof AppConfig): string | null {
    try {
      const storageKey = `config${key.charAt(0).toUpperCase() + key.slice(1)}`;
      return localStorage.getItem(storageKey);
    } catch (error) {
      console.error(`获取配置项 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 设置单个配置项
   * @param key 配置项名称
   * @param value 配置项值
   */
  static setConfigItem(key: keyof AppConfig, value: string | null): void {
    try {
      const storageKey = `config${key.charAt(0).toUpperCase() + key.slice(1)}`;
      if (value === null) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, value);
      }
    } catch (error) {
      console.error(`设置配置项 ${key} 失败:`, error);
    }
  }

  /**
   * 清除所有配置
   */
  static clearAllConfig(): void {
    try {
      this.CONFIG_FIELDS.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('清除配置失败:', error);
    }
  }

  /**
   * 生成默认配置
   */
  static generateDefaultConfig(): AppConfig {
    const timestamp = new Date().getTime();
    return {
      userId: `sample${timestamp}`,
      roomId: '0001',
      streamId: `web-${timestamp}`,
      effectiveTime: '3600',
      payload: '{}'
    };
  }

  /**
   * 验证配置是否完整
   * @param config 要验证的配置
   */
  static validateConfig(config: AppConfig): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    if (!config.appId) missingFields.push('appId');
    if (!config.userId) missingFields.push('userId');
    if (!config.roomId) missingFields.push('roomId');
    if (!config.streamId) missingFields.push('streamId');
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }
}

export default ConfigManager;