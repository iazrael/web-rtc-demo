import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import type ZegoLocalStream from "zego-express-engine-webrtc/sdk/code/zh/ZegoLocalStream.web";
import type { ZegoEvent, ZegoLocalStreamConfig, ZegoStreamList, ZegoWebPublishOption } from "zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.web";
import type { ZegoRoomConfig, ZegoUser } from 'zego-express-engine-webrtc/sdk/code/zh/ZegoExpressEntity.rtm';
import ConfigManager from './assets/ConfigManager';
import $ from 'jquery';
import { getBrowser } from './assets/utils';

// 消息数据模型
export interface MessageModel {
  id: string;
  timestamp: string;
  content: string;
  showTimestamp: boolean;
  cmd?: string;
  seqId?: string | number;
  round?: string | number;
  data?: any;
}

// 消息视图模型
export class MessageViewModel {
  private messages: MessageModel[] = [];
  private filterKeyword: string = '';
  private observers: Array<() => void> = [];

  // 添加消息
  addMessage(content: string, showTimestamp: boolean = true, cmd?: string, seqId?: string | number, round?: string | number, data?: any): void {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const message: MessageModel = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      content,
      showTimestamp,
      cmd,
      seqId,
      round,
      data
    };

    this.messages.push(message);
    this.notifyObservers();
  }

  // 设置过滤关键字
  setFilterKeyword(keyword: string): void {
    this.filterKeyword = keyword.toLowerCase().trim();
    this.notifyObservers();
  }

  // 获取过滤后的消息
  getFilteredMessages(): MessageModel[] {
    if (!this.filterKeyword) {
      return this.messages;
    }

    return this.messages.filter(message => {
      const searchContent = `${message.content} ${message.cmd || ''} ${message.seqId || ''} ${message.round || ''} ${JSON.stringify(message.data || '')}`.toLowerCase();
      return searchContent.includes(this.filterKeyword);
    });
  }

  // 添加观察者
  addObserver(observer: () => void): void {
    this.observers.push(observer);
  }

  // 移除观察者
  removeObserver(observer: () => void): void {
    this.observers = this.observers.filter(obs => obs !== observer);
  }

  // 通知所有观察者
  private notifyObservers(): void {
    this.observers.forEach(observer => observer());
  }

  // 清空消息
  clearMessages(): void {
    this.messages = [];
    this.notifyObservers();
  }
}

export interface ZegoClientOptions {
  appID: number;
  server: string;
  secret: string;
  tokenUrl: string;
  userId: string;
  userName?: string;
  roomId: string;
  streamId: string;
  effectiveTime: number;
  payload?: string;
  debug?: boolean;
}

export class ZegoClient {
  private zg: ZegoExpressEngine | null = null;
  private appID: number;
  private server: string;
  private tokenUrl: string;
  private secret: string = '';
  private effectiveTimeInSeconds: number = 3600;
  private payload: string = '';
  private isInRoom = false;
  private publishStreamId = '';
  private userID = '';
  private userName = '';
  private previewVideo: HTMLVideoElement | null = null;
  private localStream: MediaStream | null = null;
  private isPreviewed = false;
  private isMicrophoneMuted = false;
  private useLocalStreamList: ZegoStreamList[] = [];
  private roomList: string[] = [];
  private l3?: boolean;
  // 消息视图模型
  private messageViewModel: MessageViewModel = new MessageViewModel();

  constructor(options: ZegoClientOptions) {
    this.appID = options.appID;
    this.server = options.server;
    this.secret = options.secret;
    this.tokenUrl = options.tokenUrl;
    this.userID = options.userId;
    // 优先使用options中的userName，如果没有则默认使用userId
    this.userName = options.userName || options.userId;
    this.publishStreamId = options.streamId;
    if (options.effectiveTime) {
      this.effectiveTimeInSeconds = options.effectiveTime || 3600;
    }
    this.payload = options.payload || '';
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    // this.loadConfigFromStorage();
  }

  /**
   * 设置预览视频元素
   */
  setPreviewVideo(videoElement: HTMLVideoElement): void {
    this.previewVideo = videoElement;
  }

  /**
   * 初始化SDK
   */
  async initialize(): Promise<void> {
    if (!this.zg) {
      this.zg = new ZegoExpressEngine(this.appID, this.server);
      this.setupEventListeners();
    }
    await this.enumDevices();
  }

  /**
   * 检查系统兼容性
   */
  async checkSystemRequirements(): Promise<boolean> {
    if (!this.zg) {
      throw new Error('SDK not initialized');
    }

    try {
      const result = await this.zg.checkSystemRequirements();
      console.warn('checkSystemRequirements', result);

      if (!result.webRTC) {
        alert('browser is not support webrtc!!');
        return false;
      } else if (!result.videoCodec || !(result.videoCodec.H264 || result.videoCodec.VP8)) {
        alert('browser is not support H264 and VP8');
        return false;
      } else if (result.videoCodec && !result.videoCodec.H264) {
        alert('不支持H264，请前往混流转码测试');
        return false;
      }

      return true;
    } catch (err) {
      console.error('checkSystemRequirements error', err);
      return false;
    }
  }

  /**
   * 枚举设备
   */
  async enumDevices(): Promise<void> {
    if (!this.zg) {
      throw new Error('SDK not initialized');
    }

    const audioInputList: string[] = [];
    const videoInputList: string[] = [];

    try {
      const deviceInfo = await this.zg.enumDevices();

      deviceInfo && deviceInfo.microphones.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'microphone' + index;
        }
        audioInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
        return item;
      });

      deviceInfo && deviceInfo.cameras.map((item, index) => {
        if (!item.deviceName) {
          item.deviceName = 'camera' + index;
        }
        videoInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
        return item;
      });

      audioInputList.push('<option value="0">禁止</option>');
      videoInputList.push('<option value="0">禁止</option>');

      $('#audioList').html(audioInputList.join(''));
      $('#videoList').html(videoInputList.join(''));
    } catch (err) {
      console.error('enumDevices error', err);
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.zg) return;

    this.zg.on('roomStateUpdate', (roomID: string, state: string, errorCode: number, extendedData: any) => {
      console.warn('roomStateUpdate: ', roomID, state, errorCode, extendedData);
    });

    this.zg.on('roomUserUpdate', (roomID: string, updateType: 'ADD' | 'DELETE', userList: ZegoUser[]) => {
      console.warn(
        `roomUserUpdate: room ${roomID}, user ${updateType === 'ADD' ? 'added' : 'left'} `,
        JSON.stringify(userList),
      );
    });

    this.zg.on('publisherStateUpdate', (result: { streamID: string; state: string; errorCode: number }) => {
      console.log('publisherStateUpdate: ', result.streamID, result.state);
      if (result.state == 'PUBLISHING') {
        console.info(' publish  success ' + result.streamID);
      } else if (result.state == 'PUBLISH_REQUESTING') {
        console.info(' publish  retry');
      } else {
        if (result.errorCode == 0) {
          console.warn('publish stop ' + result.errorCode);
        } else {
          console.error('publish error ' + result.errorCode);
        }
      }
    });

    this.zg.on('playerStateUpdate', (result: { streamID: string; state: string; errorCode: number }) => {
      console.log('playerStateUpdate', result.streamID, result.state);
      if (result.state == 'PLAYING') {
        console.info(' play  success ' + result.streamID);
        const browser = getBrowser();
        if (browser === 'Safari') {
          const videos = $('.remoteVideo video');
          for (let i = 0; i < videos.length; i++) {
            const videoEl = videos[i] as HTMLVideoElement;
            videoEl.srcObject = videoEl.srcObject;
          }
        }
      }
    });

    this.zg.on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: ZegoStreamList[], extendedData: any) => {
      console.warn('roomStreamUpdate roomID ', roomID, streamList, extendedData);

      if (updateType == 'ADD') {
        for (let i = 0; i < streamList.length; i++) {
          console.info(streamList[i].streamID + ' was added');
          let remoteStream: MediaStream | null = null;
          let playOption: any = {};

          if ($("#videoCodec").val()) playOption.videoCodec = $("#videoCodec").val();
          if (this.l3 == true) playOption.resourceMode = 2 as 1 | 2;

          try {
            const stream = await this.zg!.startPlayingStream(streamList[i].streamID, playOption);
            remoteStream = stream;
            this.useLocalStreamList.push(streamList[i]);
            const videoTemp = $(`<video id=${streamList[i].streamID} autoplay muted playsinline controls></video>`);
            $('.remoteVideo').append(videoTemp);
            const video = $('.remoteVideo video:last')[0] as HTMLVideoElement;
            if (remoteStream && video) {
              video.srcObject = remoteStream;
              video.muted = false;
            }
          } catch (err) {
            console.error('startPlayingStream error', err);
          }
        }
      } else if (updateType == 'DELETE') {
        for (let k = 0; k < this.useLocalStreamList.length; k++) {
          for (let j = 0; j < streamList.length; j++) {
            if (this.useLocalStreamList[k].streamID === streamList[j].streamID) {
              try {
                this.zg!.stopPlayingStream(this.useLocalStreamList[k].streamID);
              } catch (error) {
                console.error('stopPlayingStream error', error);
              }

              $('.remoteVideo video:eq(' + k + ')').remove();
              this.useLocalStreamList.splice(k--, 1);
              break;
            }
          }
        }
      }
    });

    this.zg.on('soundLevelUpdate', (streamList: { type: string; streamID: string; soundLevel: number }[]) => {
      streamList.forEach(stream => {
        stream.type == 'push' && $('#soundLevel').html(Math.round(stream.soundLevel) + '');
      });
    });

    this.zg.setSoundLevelDelegate(true, 800);

    this.zg.on("IMRecvCustomCommand", (roomID: string, fromUser: ZegoUser, command: string) => {
      try {
        // 解析消息
        let recvMsg = JSON.parse(command);
        console.log('recvMsg', recvMsg);
        // 把 object 的key都转成小写, 只要第一级就行
        recvMsg = this.toLowerCaseKeys(recvMsg);
        this.appendMessage(recvMsg);
      } catch (error) {
        console.error("解析消息失败:", error);
      }
    })

    // 注意！！！：通过房间自定义消息收到的数据可能会乱序，需要根据 SeqId 字段进行排序。
    this.zg.on("recvExperimentalAPI", (result) => {
      const { method, content } = result;
      // !mark
      if (method === "onRecvRoomChannelMessage") {
        try {
          // 解析消息
          let recvMsg = JSON.parse(content.msgContent);
          console.log('recvMsg', recvMsg);
          // 把 object 的key都转成小写, 只要第一级就行
          recvMsg = this.toLowerCaseKeys(recvMsg);
          this.appendMessage(recvMsg);
        } catch (error) {
          console.error("解析消息失败:", error);
        }
      }
    });

    // 启用 onRecvRoomChannelMessage 实验性 API
    this.zg.callExperimentalAPI({ method: "onRecvRoomChannelMessage", params: {} });

    // 初始化消息视图
    this.initializeMessageView();
  }

  // 把 object 的key都转成小写, 只要第一级就行
  private toLowerCaseKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(this.toLowerCaseKeys.bind(this));
    }
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key.toLowerCase()] = this.toLowerCaseKeys(obj[key]);
      }
    }
    return result;
  }

  private appendMessage(recvMsg: any) {
    const { cmd, seq_id, round, data } = recvMsg;
    console.log('recvMsg', recvMsg);

    // 添加消息到视图模型
    const messageContent = `命令: ${cmd}, 序列号: ${seq_id || '-'}, 轮次: ${round || '-'}`;
    this.messageViewModel.addMessage(messageContent, true, cmd, seq_id, round);

    if (data) {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        this.messageViewModel.addMessage(`Data: ${dataStr}`, false, cmd, seq_id, round, data);
      } catch (error) {
        this.messageViewModel.addMessage(`数据内容解析失败: ${String(data)}`, false, cmd, seq_id, round);
      }
    }
  }

  /**
   * 初始化消息视图
   */
  public initializeMessageView(): void {
    // 确保在浏览器环境中运行
    if (typeof document !== 'undefined') {
      // 初始化消息过滤输入框
      const filterInput = document.getElementById('messageFilterInput') as HTMLInputElement;
      if (filterInput) {
        filterInput.addEventListener('input', (event) => {
          const target = event.target as HTMLInputElement;
          this.messageViewModel.setFilterKeyword(target.value);
        });
      }

      // 添加消息视图模型的观察者
      this.messageViewModel.addObserver(() => {
        this.renderMessages();
      });

      // 添加系统初始化消息
      this.messageViewModel.addMessage('消息展示区域已初始化', true);
    }
  }

  /**
   * 渲染过滤后的消息到视图
   */
  private renderMessages(): void {
    // 确保在浏览器环境中运行
    if (typeof document !== 'undefined') {
      const messageDisplay = document.getElementById('messageDisplay');
      if (messageDisplay) {
        // 清空消息区域
        messageDisplay.innerHTML = '';

        // 获取过滤后的消息和当前过滤关键字
        const filteredMessages = this.messageViewModel.getFilteredMessages();
        // 注意：由于MessageViewModel中filterKeyword是私有属性，我们需要获取过滤输入框的值
        const filterKeyword = document.getElementById('messageFilterInput') as HTMLInputElement;
        const keyword = filterKeyword ? filterKeyword.value.toLowerCase().trim() : '';

        // 渲染消息
        filteredMessages.forEach(message => {
          const messageItem = document.createElement('div');
          messageItem.className = message.content.includes('消息展示区域已初始化') ? 'message-item system-message' : 'message-item';

          // 高亮显示匹配的字符
          let formattedContent = message.content;
          if (keyword) {
            try {
              // 创建一个正则表达式，使用全局匹配和不区分大小写
              const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
              // 使用高亮标签替换匹配的文本
              formattedContent = message.content.replace(regex, '<span class="highlight">$1</span>');
            } catch (error) {
              console.error('创建正则表达式失败:', error);
            }
          }

          // 设置消息内容
          if (message.showTimestamp) {
            messageItem.innerHTML = `
              <span class="timestamp">${message.timestamp}</span>
              <span class="content">${formattedContent}</span>
            `;
          } else {
            // 为数据内容设置缩进，使其在视觉上更易读
            messageItem.innerHTML = `
              <span class="timestamp"></span>
              <span class="content" style="margin-left: 20px;">${formattedContent}</span>
            `;
          }

          // 添加消息到展示区域
          messageDisplay.appendChild(messageItem);
        });

        // 自动滚动到最新消息
        messageDisplay.scrollTop = messageDisplay.scrollHeight;
      }
    }
  }

  /**
   * 设置消息过滤关键字
   * @param keyword 过滤关键字
   */
  public setMessageFilter(keyword: string): void {
    this.messageViewModel.setFilterKeyword(keyword);
  }

  /**
   * 清空所有消息
   */
  public clearMessages(): void {
    this.messageViewModel.clearMessages();
  }

  /**
   * 登录房间
   */
  async loginToRoom(roomId: string, token?: string, userInfo?: ZegoUser): Promise<boolean> {
    if (!this.zg) {
      throw new Error('SDK not initialized');
    }

    if (!roomId) {
      alert('roomId is empty');
      return false;
    }

    try {
      // 如果没有提供token，则自动从服务器获取
      const finalToken = token || await this.getTokenFromServer(userInfo?.userID || this.userID);

      const finalUserInfo: ZegoUser = {
        userID: userInfo?.userID || this.userID,
        userName: userInfo?.userName || this.userName
      };

      const loginOptions: ZegoRoomConfig = { userUpdate: true };

      await this.zg.loginRoom(roomId, finalToken, finalUserInfo, loginOptions);
      this.roomList.push(roomId);
      this.isInRoom = true;

      return true;
    } catch (error) {
      console.error('loginRoom error', error);
      throw error;
    }
  }

  /**
   * 从服务器获取token
   */
  private async getTokenFromServer(userID: string): Promise<string> {

    // 构建请求参数，包含所有必要字段
    const requestData: any = {
      appId: this.appID,
      userId: userID,
      secret: this.secret,
      effectiveTimeInSeconds: this.effectiveTimeInSeconds
    };

    // 添加可选字段
    if (this.payload && this.payload.trim() !== '') {
      try {
        // 尝试解析payload为JSON对象
        requestData.payload = JSON.parse(this.payload);
      } catch (error) {
        console.error('Invalid payload JSON:', error);
      }
    }

    // 构建请求选项
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    };

    console.log('Requesting token with data:', requestData);

    try {
      // 使用默认的token服务器地址
      const response = await fetch(this.tokenUrl, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Received token:', data.data.token);
      return data.data.token;
    } catch (error) {
      console.error('Failed to get token from server:', error);
      throw error;
    }
  }

  /**
   * 退出房间
   */
  async logoutFromRoom(roomId: string): Promise<void> {
    if (!this.zg) return;

    console.info('leave room and close stream');

    // 停止拉流
    for (let i = 0; i < this.useLocalStreamList.length; i++) {
      this.useLocalStreamList[i].streamID && this.zg!.stopPlayingStream(this.useLocalStreamList[i].streamID);
    }

    // 清空页面
    this.useLocalStreamList = [];

    this.roomList.splice(this.roomList.findIndex(room => room == roomId), 1);

    if (this.previewVideo?.srcObject && this.isPreviewed && (!roomId || this.roomList.length == 0)) {
      this.previewVideo.srcObject = null;
      this.zg.stopPublishingStream(this.publishStreamId);
      if (this.localStream) {
        this.zg.destroyStream(this.localStream);
      }
      this.isPreviewed = false;
      !$('.sound').hasClass('d-none') && $('.sound').addClass('d-none');
    }

    if (!roomId || this.roomList.length == 0) {
      $('.remoteVideo').html('');
      $('#memberList').html('');
    }

    //退出登录
    this.zg.logoutRoom(roomId);
    this.isInRoom = false;
  }

  /**
   * 发布流
   */
  async publish(constraints?: ZegoLocalStreamConfig): Promise<void> {
    if (!this.zg || !this.previewVideo) {
      throw new Error('SDK not initialized or preview video not set');
    }

    const video = constraints && constraints.camera && typeof constraints.camera.video === 'boolean'
      ? constraints.camera.video
      : undefined;

    const _constraints: ZegoLocalStreamConfig = {
      camera: {
        audioInput: $('#audioList').val() as string,
        videoInput: $('#videoList').val() as string,
        video: video !== undefined ? video : $('#videoList').val() === '0' ? false : true,
        audio: $('#audioList').val() === '0' ? false : true,
      },
    };

    if (constraints && constraints.camera) {
      Object.assign(_constraints.camera!, constraints.camera);
    }

    !_constraints.camera?.video && (this.previewVideo.controls = true);
    await this.push(_constraints, {});
  }

  /**
   * 推流
   */
  private async push(constraints: ZegoLocalStreamConfig, publishOption: ZegoWebPublishOption = {}): Promise<void> {
    if (!this.zg || !this.previewVideo) return;

    try {
      if (this.localStream) {
        this.zg.destroyStream(this.localStream);
      }
      this.localStream = await this.zg.createStream(constraints);
      this.previewVideo.srcObject = this.localStream;
      this.isPreviewed = true;
      $('.sound').hasClass('d-none') && $('.sound').removeClass('d-none');

      if ($("#videoCodec").val()) publishOption.videoCodec = $("#videoCodec").val() as "H264" | "VP8";
      if ($('#roomId').val()) publishOption.roomID = $('#roomId').val() as string;

      const result = this.zg.startPublishingStream(this.publishStreamId, this.localStream, publishOption);
      console.log('publish stream' + this.publishStreamId, result);
    } catch (err) {
      console.error('createStream error', err);
    }
  }

  /**
   * 停止发布
   */
  stopPublish(): void {
    if (!this.zg || !this.previewVideo) return;

    if (this.isPreviewed && this.localStream) {
      this.zg.destroyStream(this.localStream);
      this.isPreviewed = false;
      this.previewVideo.srcObject = null;
      !$('.sound').hasClass('d-none') && $('.sound').addClass('d-none');
    }

    if (this.isPreviewed) {
      this.zg.stopPublishingStream(this.publishStreamId);
    }
  }

  /**
   * 切换摄像头
   */
  toggleCamera(): void {
    if (!this.zg || !this.previewVideo?.srcObject) return;

    const disabled = $('#toggleCamera').hasClass('disabled');
    this.zg.mutePublishStreamVideo(this.previewVideo.srcObject as MediaStream, !disabled);
    $('#toggleCamera').toggleClass('disabled');
  }

  /**
   * 切换麦克风
   */
  toggleMicrophone(): void {
    if (!this.zg || !this.previewVideo?.srcObject) return;

    // 切换麦克风静音状态
    this.isMicrophoneMuted = !this.isMicrophoneMuted;

    try {
      // 静音/取消静音发布的音频流
      this.zg.mutePublishStreamAudio(this.previewVideo.srcObject as MediaStream, this.isMicrophoneMuted);

      // 更新UI状态
      const toggleMicBtn = document.getElementById('toggleMicrophone');
      if (toggleMicBtn) {
        toggleMicBtn.classList.toggle('disabled', this.isMicrophoneMuted);

        // 更新图标
        const icon = toggleMicBtn.querySelector('i');
        if (icon) {
          icon.className = this.isMicrophoneMuted ? 'fa fa-microphone-slash' : 'fa fa-microphone';
        }
      }

      // 添加消息通知
      this.messageViewModel.addMessage(
        `麦克风已${this.isMicrophoneMuted ? '关闭' : '开启'}`,
        true
      );
    } catch (error) {
      console.error('切换麦克风状态失败:', error);
      // 恢复状态
      this.isMicrophoneMuted = !this.isMicrophoneMuted;
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (!this.zg) return;

    // 停止所有拉流
    this.useLocalStreamList.forEach(stream => {
      try {
        this.zg!.stopPlayingStream(stream.streamID);
      } catch (error) {
        console.error('stopPlayingStream error during cleanup', error);
      }
    });

    // 停止发布
    if (this.isPreviewed && this.localStream) {
      try {
        this.zg.stopPublishingStream(this.publishStreamId);
        this.zg.destroyStream(this.localStream);
      } catch (error) {
        console.error('stopPublishStream error during cleanup', error);
      }
    }

    // 退出所有房间
    this.roomList.forEach(roomId => {
      try {
        this.zg!.logoutRoom(roomId);
      } catch (error) {
        console.error('logoutRoom error during cleanup', error);
      }
    });

    // 清空状态
    this.isInRoom = false;
    this.isPreviewed = false;
    this.localStream = null;
    this.previewVideo = null;
    this.useLocalStreamList = [];
    this.roomList = [];
  }

  /**
   * 获取是否在房间内
   */
  getIsInRoom(): boolean {
    return this.isInRoom;
  }

  /**
   * 获取当前用户信息
   */
  getUserInfo(): { userID: string; userName: string } {
    return { userID: this.userID, userName: this.userName };
  }

  /**
   * 设置用户信息
   */
  setUserInfo(userID: string, userName: string): void {
    this.userID = userID;
    this.userName = userName;
  }
}

export default ZegoClient;