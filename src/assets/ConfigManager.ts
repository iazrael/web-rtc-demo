/**
 * 配置管理器 - 负责管理应用配置的存储和获取
 * 与UI无关，可以被任何模块导入使用
 */

// 配置映射关系，用于处理大小写不同的字段
type ConfigFieldMap = {
  [key: string]: keyof AppConfig;
};
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
  
  /**
   * 从JSON字符串导入配置
   * @param jsonStr JSON字符串
   * @returns 是否导入成功
   */
  static importConfigFromJson(jsonStr: string): boolean {
    try {
      // 解析JSON字符串
      const parsedConfig = JSON.parse(jsonStr);
      
      // 配置字段映射，忽略大小写
      const fieldMap: ConfigFieldMap = {
        'appid': 'appId',
        'secret': 'secret',
        'userid': 'userId',
        'roomid': 'roomId',
        'streamid': 'streamId',
        'effectivetime': 'effectiveTime',
        'payload': 'payload'
      };
      
      // 创建标准配置对象
      const standardConfig: AppConfig = {};
      
      // 遍历解析后的配置，转换为标准格式
      Object.keys(parsedConfig).forEach(key => {
        const lowerKey = key.toLowerCase();
        const standardKey = fieldMap[lowerKey];
        
        if (standardKey) {
          // 对于appId，确保转换为字符串
          if (standardKey === 'appId') {
            standardConfig[standardKey] = String(parsedConfig[key]);
          } else {
            standardConfig[standardKey] = String(parsedConfig[key]);
          }
        } else if (lowerKey === 'serversecret') {
          // 使用ServerSecret作为secret的值
          standardConfig.secret = String(parsedConfig[key]);
        }else if (lowerKey === 'userstreamid') {
          // 使用userStreamId作为streamId的值
          standardConfig.streamId = String(parsedConfig[key]);
        }
      });
      
      // 保存配置到localStorage
      this.saveConfigToStorage(standardConfig);
      
      console.log('配置导入成功:', standardConfig);
      return true;
    } catch (error) {
      console.error('导入配置失败:', error);
      return false;
    }
  }
  
  /**
   * 刷新配置表单
   */
  static refreshConfigForm(): void {
    try {
      const config = this.loadConfigFromStorage();
      
      // 更新表单字段值
      if (typeof document !== 'undefined') {
        const setFormValue = (id: string, value: string | undefined) => {
          const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
          if (element) {
            element.value = value || '';
          }
        };
        
        setFormValue('configAppId', config.appId);
        setFormValue('configSecret', config.secret);
        setFormValue('configUserId', config.userId);
        setFormValue('configRoomId', config.roomId);
        setFormValue('configStreamId', config.streamId);
        setFormValue('configEffectiveTime', config.effectiveTime || '3600');
        setFormValue('configPayload', config.payload || '{}');
      }
    } catch (error) {
      console.error('刷新配置表单失败:', error);
    }
  }
}

// 将方法暴露到window对象上，供HTML调用
declare global {
  interface Window {
    importConfigFromJson: (jsonStr: string) => boolean;
    refreshConfigForm: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.importConfigFromJson = (jsonStr: string) => ConfigManager.importConfigFromJson(jsonStr);
  window.refreshConfigForm = () => ConfigManager.refreshConfigForm();
}

export default ConfigManager;