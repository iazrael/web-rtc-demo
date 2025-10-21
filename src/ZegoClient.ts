import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { ZegoUser } from 'zego-express-engine-webrtc/sdk/src/common/zego.entity';
import $ from 'jquery';
import { getBrowser } from './assets/utils';

// 类型定义
export interface UserInfo {
  userID: string;
  userName?: string;
}

export interface StreamInfo {
  streamID: string;
  userID?: string;
  userName?: string;
}

export interface RoomLoginOptions {
  userUpdate: boolean;
}

export interface DeviceInfo {
  deviceID: string;
  deviceName: string;
}

export interface EnumDevicesResult {
  microphones: DeviceInfo[];
  cameras: DeviceInfo[];
}

export interface Constraints {
  camera?: {
    video?: boolean;
    audio?: boolean;
    audioInput?: string;
    videoInput?: string;
    channelCount?: 1 | 2;
  };
}

export interface PublishOption {
  extraInfo?: string;
  videoCodec?: "H264" | "VP8";
  roomID?: string;
}

export interface ZegoClientOptions {
  appID: number;
  server: string;
  tokenUrl: string;
  cgiToken?: string;
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
  private cgiToken: string;
  private isInRoom = false;
  private publishStreamId = '';
  private userID = '';
  private userName = '';
  private previewVideo: HTMLVideoElement | null = null;
  private localStream: MediaStream | null = null;
  private isPreviewed = false;
  private useLocalStreamList: StreamInfo[] = [];
  private roomList: string[] = [];
  private l3?: boolean;
  
  constructor(options: ZegoClientOptions) {
    this.appID = options.appID;
    this.server = options.server;
    this.tokenUrl = options.tokenUrl;
    this.cgiToken = options.cgiToken || '';
    this.userID = 'sample' + new Date().getTime();
    this.userName = 'sampleUser' + new Date().getTime();
    this.publishStreamId = 'webrtc' + new Date().getTime();
    
    // 从localStorage加载配置
    this.loadConfigFromStorage();
  }
  
  /**
   * 从localStorage加载配置
   */
  private loadConfigFromStorage(): void {
    try {
      const configSecret = localStorage.getItem('configSecret');
      const configTokenUrl = localStorage.getItem('configTokenUrl');
      const configServer = localStorage.getItem('configServer');
      const configCgiToken = localStorage.getItem('configCgiToken');
      const configEffectiveTime = localStorage.getItem('configEffectiveTime');
      const configPayload = localStorage.getItem('configPayload');
      const configAppId = localStorage.getItem('configAppId');
      
      if (configSecret) this.secret = configSecret;
      if (configTokenUrl) this.tokenUrl = configTokenUrl;
      if (configServer) this.server = configServer;
      if (configCgiToken) this.cgiToken = configCgiToken;
      if (configEffectiveTime) this.effectiveTimeInSeconds = parseInt(configEffectiveTime, 10) || 3600;
      if (configPayload) this.payload = configPayload;
      if (configAppId) this.appID = parseInt(configAppId, 10) || this.appID;
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    }
  }
  
  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    this.loadConfigFromStorage();
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
      const deviceInfo = await this.zg.enumDevices() as EnumDevicesResult;
      
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
    
    this.zg.on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: StreamInfo[], extendedData: any) => {
      console.warn('roomStreamUpdate roomID ', roomID, streamList, extendedData);
      
      if (updateType == 'ADD') {
        for (let i = 0; i < streamList.length; i++) {
          console.info(streamList[i].streamID + ' was added');
          let remoteStream: MediaStream | null = null;
          let playOption: any = {};

          if($("#videoCodec").val()) playOption.videoCodec = $("#videoCodec").val();
          if(this.l3 == true) playOption.resourceMode = 2 as 1 | 2;

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
  }
  
  /**
   * 登录房间
   */
  async loginToRoom(roomId: string, token?: string, userInfo?: UserInfo): Promise<boolean> {
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
      
      const loginOptions: RoomLoginOptions = { userUpdate: true };
      
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
    // 确保使用最新配置
    this.loadConfigFromStorage();
    
    // 构建请求参数，包含所有必要字段
    const requestData: any = {
      appId: this.appID,
      userId: userID,
      effectiveTimeInSeconds: this.effectiveTimeInSeconds
    };
    
    // 添加可选字段
    if (this.secret) {
      requestData.secret = this.secret;
    }
    
    if (this.cgiToken) {
      requestData.cgi_token = this.cgiToken;
    }
    
    if (this.payload) {
      try {
        // 尝试解析payload为JSON对象
        requestData.payload = JSON.parse(this.payload);
      } catch (error) {
        // 如果解析失败，直接使用原始字符串
        requestData.payload = this.payload;
        console.warn('Payload is not valid JSON, using as string:', error);
      }
    }
    
    console.log('Requesting token with data:', requestData);
    
    try {
      const response = await $.post(this.tokenUrl, requestData);
      return response;
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
  async publish(constraints?: Constraints): Promise<void> {
    if (!this.zg || !this.previewVideo) {
      throw new Error('SDK not initialized or preview video not set');
    }
    
    const video = constraints && constraints.camera && typeof constraints.camera.video === 'boolean'
      ? constraints.camera.video
      : undefined;

    const _constraints: Constraints = {
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
  private async push(constraints: Constraints, publishOption: PublishOption = {}): Promise<void> {
    if (!this.zg || !this.previewVideo) return;
    
    try {
      if(this.localStream) {
        this.zg.destroyStream(this.localStream);
      }
      this.localStream = await this.zg.createStream(constraints);
      this.previewVideo.srcObject = this.localStream;
      this.isPreviewed = true;
      $('.sound').hasClass('d-none') && $('.sound').removeClass('d-none');
      
      if($("#videoCodec").val()) publishOption.videoCodec = $("#videoCodec").val() as "H264" | "VP8";
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
    
    const disabled = $('#toggleSpeaker').hasClass('disabled');
    this.zg.mutePublishStreamAudio(this.previewVideo.srcObject as MediaStream, !disabled);
    $('#toggleSpeaker').toggleClass('disabled');
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