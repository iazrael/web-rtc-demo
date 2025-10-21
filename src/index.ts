import ZegoClient from './ZegoClient';
import VConsole from 'vconsole';
import $ from 'jquery';
import './assets/bootstrap.min';
import './assets/bootstrap.min.css';

// 初始化VConsole
const debug = true;
if (debug) {
  new VConsole();
}

// 全局变量
let zegoClient: ZegoClient | null = null;
let previewVideo: HTMLVideoElement;
let isLogin = false;

// 默认配置
let server = 'wss://accesshub-wss.zego.im/accesshub';
let tokenUrl = '/api/token';

// 从localStorage加载配置并设置到表单中
function initializeWithStoredConfig(): void {
  try {
    // 尝试从localStorage获取配置
    const storedAppId = localStorage.getItem('configAppId');
    const storedUserId = localStorage.getItem('configUserId');
    const storedRoomId = localStorage.getItem('configRoomId');
    const storedStreamId = localStorage.getItem('configStreamId');
    const storedServer = localStorage.getItem('configServer');
    const storedTokenUrl = localStorage.getItem('configTokenUrl');
    
    // 设置默认值（如果localStorage中有则使用localStorage的值）
    $('#userId').val(storedUserId || 'sample' + new Date().getTime());
    $('#streamId').val(storedStreamId || 'web-' + new Date().getTime());
    
    if (storedAppId) {
      $('#appId').val(storedAppId);
    }
    
    if (storedRoomId) {
      $('#roomId').val(storedRoomId);
    }
    
    if (storedServer) {
      server = storedServer;
    }
    
    if (storedTokenUrl) {
      tokenUrl = storedTokenUrl;
    }
  } catch (error) {
    console.error('Failed to initialize with stored config:', error);
    // 如果出错，使用默认值
    $('#userId').val('sample' + new Date().getTime());
    $('#streamId').val('web-' + new Date().getTime());
  }
}

// 初始化页面
$(async () => {
  previewVideo = $('#previewVideo')[0] as HTMLVideoElement;

  // 初始化时从localStorage加载配置
  initializeWithStoredConfig();
  
  // 监听配置参数应用事件
  window.addEventListener('configApplied', () => {
    initializeWithStoredConfig();
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
          video: true,
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

  // 退出房间按钮点击事件
  $('#leaveRoom').click(async () => {
    if (!isLogin || !zegoClient) return;

    const roomId = $('#roomId').val() as string;
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
    const currentId = $('#appId').val() as string;
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
      const roomId = $('#roomId').val() as string;
      const userID = $('#userId').val() as string;
      const userName = 'sampleUser' + new Date().getTime();
      const token = ($("#token").val() || "") as string;

      // 重新初始化SDK如果appID有变化
      if (!zegoClient || zegoClient.getUserInfo().userID !== userID) {
        // 清理之前的实例
        if (zegoClient) {
          zegoClient.cleanup();
        }

        // 从localStorage获取最新配置
        const storedCgiToken = localStorage.getItem('configCgiToken') || '';
        const storedServer = localStorage.getItem('configServer') || server;
        const storedTokenUrl = localStorage.getItem('configTokenUrl') || tokenUrl;
        
        // 创建新实例
        zegoClient = new ZegoClient({
          appID,
          server: storedServer,
          tokenUrl: storedTokenUrl,
          cgiToken: storedCgiToken,
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
      isLogin = await zegoClient.loginToRoom(roomId, token, { userID, userName });

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
  // 触发配置应用事件
  window.dispatchEvent(new CustomEvent('configApplied'));
});