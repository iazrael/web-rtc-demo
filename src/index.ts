import ZegoClient from './ZegoClient';
import ConfigManager, { AppConfig } from './assets/ConfigManager';
// import VConsole from 'vconsole';
import $ from 'jquery';
import './assets/bootstrap.min';
import './assets/bootstrap.min.css';

// // 初始化VConsole
const debug = false;
// if (debug) {
//   new VConsole();
// }

// 全局变量
let zegoClient: ZegoClient | null = null;
let previewVideo: HTMLVideoElement;
let isLogin = false;

// 默认配置
let server = 'wss://accesshub-wss.zego.im/accesshub';
let tokenUrl = '/api/token';

// 从ConfigManager加载配置并设置到表单中
function initializeWithStoredConfig(): void {
  try {
    // 从ConfigManager获取配置
    let config = ConfigManager.loadConfigFromStorage();

    // 如果没有配置或者配置不完整，生成默认配置并保存
    const validation = ConfigManager.validateConfig(config);
    if (!validation.isValid) {
      const defaultConfig = ConfigManager.generateDefaultConfig();
      // 合并默认配置到现有配置
      config = { ...defaultConfig, ...config };
      ConfigManager.saveConfigToStorage(config);
    }

  } catch (error) {
    console.error('Failed to initialize with stored config:', error);
  }
}

// 初始化页面
$(async () => {
  previewVideo = $('#previewVideo')[0] as HTMLVideoElement;

  // 初始化时从localStorage加载配置
  initializeWithStoredConfig();

  // 监听配置参数应用事件
  window.addEventListener('configApplied', () => {
    // 如果ZegoClient已经初始化，重新加载配置
    if (zegoClient) {
      zegoClient.reloadConfig();
    }
  });

  // 注册事件监听器
  registerEventListeners();
});


/**
 * 注册事件监听器
 */
function registerEventListeners(): void {
  // 发布按钮点击事件
  $('#publish').click(async () => {
    if (!isLogin) {
      alert('Please log in room first');
      return;
    }

    try {
      await zegoClient!.publish({
        camera: {
          video: false,
          audio: true
        }
      });
      alert('Publish success!');
    } catch (error) {
      console.error('Publish error:', error);
      alert('Publish failed: ' + (error as Error).message);
    }
  });

  // 停止发布按钮点击事件
  $('#stopPublish').click(() => {
    if (zegoClient) {
      zegoClient.stopPublish();
    }
  });
  
  // 麦克风切换按钮点击事件
  $('#toggleMicrophone').click(() => {
    if (zegoClient) {
      zegoClient.toggleMicrophone();
    }
  });

  // 退出房间按钮点击事件
  $('#leaveRoom').click(async () => {
    if (!isLogin || !zegoClient) return;
    const config = ConfigManager.loadConfigFromStorage();
    const roomId = config.roomId || '';
    try {
      await zegoClient.logoutFromRoom(roomId);
      isLogin = false;
      alert('Logout success!');
    } catch (error) {
      console.error('Logout error:', error);
    }
  });

  // 打开房间按钮点击事件
  $('#openRoom').click(async () => {
    const config = ConfigManager.loadConfigFromStorage();
    const currentId = config.appId
    if (!currentId) {
      alert('AppID is empty');
      return;
    } else if (isNaN(Number(currentId))) {
      alert('AppID must be number');
      return;
    }

    if (isLogin) {
      alert('Already login. please login after logout current room.');
      return;
    }

    try {
      const appID = Number(currentId);
      const roomId = config.roomId || '';
      const userID = config.userId || '';
      const userName =config.userName || userID;

      // 重新初始化SDK如果appID有变化
      if (!zegoClient || zegoClient.getUserInfo().userID !== userID) {
        // 清理之前的实例
        if (zegoClient) {
          zegoClient.cleanup();
        }

        // 创建新实例
        zegoClient = new ZegoClient({
          appID,
          server,
          tokenUrl,
          secret: config.secret || '',
          userId: userID,
          userName,
          roomId,
          streamId: config.streamId || '',
          effectiveTime: parseInt(config.effectiveTime || '3600', 10),
          payload: config.payload || '',
          debug
        });

        // 设置预览视频元素和用户信息
        zegoClient.setPreviewVideo(previewVideo);
        zegoClient.setUserInfo(userID, userName);

        // 初始化SDK
        await zegoClient.initialize();

        // 检查系统兼容性
        const isCompatible = await zegoClient.checkSystemRequirements();
        if (!isCompatible) {
          console.error('System not compatible with WebRTC');
          alert('System not compatible with WebRTC');
          return;
        }
      }

      // 登录房间
      isLogin = await zegoClient.loginToRoom(roomId, '', { userID, userName });

      if (isLogin) {
        alert('Login Success!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if ([1102016].includes(error.code)) {
        alert("Token 错误，请查看您在页面中填写的 UserID、AppID是否与生成 Token 时所用到的一致。\n Token error, please check whether the userid and appid you filled in the page are consistent with those used in generating token.");
      } else if (error.code === 1102018) {
        alert("Token 过期。 \n Token expire.");
      } else {
        alert("Login failed! " + JSON.stringify(error));
      }
    }
  });

  // 切换摄像头按钮点击事件
  $('#toggleCamera').click(function () {
    if (zegoClient) {
      zegoClient.toggleCamera();
    }
  });

  // 切换麦克风按钮点击事件
  $('#toggleSpeaker').click(function () {
    if (zegoClient) {
      zegoClient.toggleMicrophone();
    }
  });

  // 创建房间按钮点击事件
  $('#createRoom').click(async () => {
    if (!isLogin && $('#openRoom')) {
      // 触发打开房间按钮的点击事件
      $('#openRoom').trigger('click');
    }

    // 登录成功后开始推流
    setTimeout(async () => {
      if (isLogin && $('#publish')) {
        $('#publish').trigger('click');
      }
    }, 1000);
  });

  // 进入房间按钮点击事件
  $('#enterRoom').click(async () => {
    if ($('#openRoom')) {
      // 触发打开房间按钮的点击事件
      $('#openRoom').trigger('click');
    }
  });
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (zegoClient) {
    zegoClient.cleanup();
  }
});

// 为HTML中的applyConfig按钮添加额外的事件监听，确保触发配置应用事件
$(document).on('click', '#applyConfig', () => {
  // 从表单收集配置并保存到ConfigManager
  const config: AppConfig = {
    appId: (document.getElementById('configAppId') as HTMLInputElement)?.value || '',
    secret: (document.getElementById('configSecret') as HTMLInputElement)?.value || '',
    userId: (document.getElementById('configUserId') as HTMLInputElement)?.value || '',
    userName: (document.getElementById('configUserName') as HTMLInputElement)?.value || '',
    roomId: (document.getElementById('configRoomId') as HTMLInputElement)?.value || '',
    streamId: (document.getElementById('configStreamId') as HTMLInputElement)?.value || '',
    effectiveTime: (document.getElementById('configEffectiveTime') as HTMLInputElement)?.value || '',
    payload: (document.getElementById('configPayload') as HTMLTextAreaElement)?.value || ''
  };

  // 保存配置
  ConfigManager.saveConfigToStorage(config);

  // 显示保存成功提示
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    saveStatus.style.display = 'inline';
    setTimeout(() => {
      saveStatus.style.display = 'none';
    }, 2000);
  }

  // 隐藏弹窗
  const hideConfigModal = (window as any).hideConfigModal;
  if (typeof hideConfigModal === 'function') {
    hideConfigModal();
  }

  // 触发配置应用事件
  window.dispatchEvent(new CustomEvent('configApplied'));
});

// 配置表单定时保存
let saveTimer: NodeJS.Timeout;
const configForm = document.getElementById('configForm');
if (configForm) {
  configForm.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      // 收集并保存当前配置
      const config: AppConfig = {
        appId: (document.getElementById('configAppId') as HTMLInputElement)?.value || '',
        secret: (document.getElementById('configSecret') as HTMLInputElement)?.value || '',
        userId: (document.getElementById('configUserId') as HTMLInputElement)?.value || '',
        userName: (document.getElementById('configUserName') as HTMLInputElement)?.value || '',
        roomId: (document.getElementById('configRoomId') as HTMLInputElement)?.value || '',
        streamId: (document.getElementById('configStreamId') as HTMLInputElement)?.value || '',
        effectiveTime: (document.getElementById('configEffectiveTime') as HTMLInputElement)?.value || '',
        payload: (document.getElementById('configPayload') as HTMLTextAreaElement)?.value || ''
      };
      ConfigManager.saveConfigToStorage(config);
    }, 1000); // 1秒后自动保存
  });
}

// 打开配置弹窗时，加载当前配置到表单
const configToggle = document.getElementById('configToggle');
if (configToggle) {
  configToggle.addEventListener('click', () => {
    const config = ConfigManager.loadConfigFromStorage();
    if (config.appId) (document.getElementById('configAppId') as HTMLInputElement).value = config.appId;
    if (config.secret) (document.getElementById('configSecret') as HTMLInputElement).value = config.secret;
    if (config.userId) (document.getElementById('configUserId') as HTMLInputElement).value = config.userId;
    if (config.userName) (document.getElementById('configUserName') as HTMLInputElement).value = config.userName;
    if (config.roomId) (document.getElementById('configRoomId') as HTMLInputElement).value = config.roomId;
    if (config.streamId) (document.getElementById('configStreamId') as HTMLInputElement).value = config.streamId;
    if (config.effectiveTime) (document.getElementById('configEffectiveTime') as HTMLInputElement).value = config.effectiveTime;
    if (config.payload) (document.getElementById('configPayload') as HTMLTextAreaElement).value = config.payload;

    // 显示弹窗
    const showConfigModal = (window as any).showConfigModal;
    if (typeof showConfigModal === 'function') {
      showConfigModal();
    }
  });
}