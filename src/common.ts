/* eslint-disable @typescript-eslint/no-use-before-define */
import VConsole from 'vconsole';
import './assets/bootstrap.min';
import './assets/bootstrap.min.css';
import { ZegoExpressEngine } from 'zego-express-engine-webrtc';
import { getBrowser } from './assets/utils';

// 类型定义
interface BrowserVersions {
  trident: boolean;
  presto: boolean;
  webKit: boolean;
  gecko: boolean;
  mobile: boolean;
  ios: boolean;
  android: boolean;
  iPhone: boolean;
  iPad: boolean;
  webApp: boolean;
  weixin: boolean;
  qq: boolean;
}

interface BrowserInfo {
  versions: BrowserVersions;
  language: string;
}

interface DeviceInfo {
  deviceID: string;
  deviceName: string;
}

interface EnumDevicesResult {
  microphones: DeviceInfo[];
  cameras: DeviceInfo[];
}

interface RoomStateUpdateEvent {
  roomID: string;
  state: string;
  errorCode: number;
  extendedData: any;
}

interface UserInfo {
  userID: string;
  userName?: string;
}

interface RoomLoginOptions {
  userUpdate: boolean;
}

interface PublisherStateUpdateEvent {
  streamID: string;
  state: 'PUBLISHING' | 'PUBLISH_REQUESTING' | string;
  errorCode: number;
}

interface PlayerStateUpdateEvent {
  streamID: string;
  state: 'PLAYING' | 'PLAY_REQUESTING' | string;
  errorCode: number;
}

interface StreamInfo {
  streamID: string;
  userID?: string;
  userName?: string;
}

interface SoundLevelInfo {
  type: 'push' | 'pull';
  streamID: string;
  soundLevel: number;
}

interface DeviceErrorEvent {
  errorCode: number;
  deviceName: string;
}

interface VideoDeviceStateChangedEvent {
  updateType: string;
  device: DeviceInfo;
}

interface AudioDeviceStateChangedEvent {
  updateType: string;
  deviceType: string;
  device: DeviceInfo;
}

// 全局变量
new VConsole();
const userName = 'sampleUser' + new Date().getTime();
const tokenUrl = 'https://wsliveroom-alpha.zego.im:8282/token';
let userID = 'sample' + new Date().getTime();
let publishStreamId = 'webrtc' + new Date().getTime();
let zg: ZegoExpressEngine;
let appID = 1739272706; // 请从官网控制台获取对应的appID
let server = 'wss://webliveroom-test.zego.im/ws'; // 请从官网控制台获取对应的server地址，否则可能登录失败

let cgiToken = '';
//const appSign = '';
let previewVideo: HTMLVideoElement;
let useLocalStreamList: StreamInfo[] = [];
let isPreviewed = false;
let supportScreenSharing = false;
let loginRoom = false;

let localStream: MediaStream | null = null;
let publishType: string | null = null;

let l3: boolean | undefined;
let roomList: string[] = [];

// eslint-disable-next-line prefer-const
zg = new ZegoExpressEngine(appID, server);


async function checkAnRun(checkScreen?: boolean): Promise<boolean> {
    console.log('sdk version is', zg.getVersion());
    try {
        const result = await zg.checkSystemRequirements();

        console.warn('checkSystemRequirements ', result);
        if (result.videoCodec && !result.videoCodec.H264) {
            $('#videoCodeType option:eq(1)').attr('disabled', 'disabled');
        }
        if (result.videoCodec && !result.videoCodec.VP8) {
            $('#videoCodeType option:eq(2)').attr('disabled', 'disabled');
        }

        if (!result.webRTC) {
            alert('browser is not support webrtc!!');
            return false;
        } else if (!result.videoCodec || !(result.videoCodec.H264 || result.videoCodec.VP8)) {
            alert('browser is not support H264 and VP8');
            return false;
        } else if (result.videoCodec && result.videoCodec.H264) {
            supportScreenSharing = !!result.screenSharing;
            if (checkScreen && !supportScreenSharing) alert('browser is not support screenSharing');
            previewVideo = $('#previewVideo')[0] as HTMLVideoElement;
            start();
        } else {
            alert('不支持H264，请前往混流转码测试');
        }

        return true;
    } catch (err) {
        console.error('checkSystemRequirements', err);
        return false;
    }
}

async function start(): Promise<void> {
    initSDK();

    zg.setLogConfig({
        logLevel: 'debug',
        remoteLogLevel: 'info',
        logURL: '',
    });

    zg.setDebugVerbose(false);
    zg.setSoundLevelDelegate(true, 3000);

    $('#createRoom').click(async () => {
        let loginSuc = false;
        try {
            loginSuc = await enterRoom();
            loginSuc && (await publish());
        } catch (error) {
            console.error(error);
        }
    });

    $('#openRoom').click(async () => {
        await enterRoom();
    });

    $('#leaveRoom').click(function () {
        logout();
    });

    $('#stopPlaySound').click(() => {
        zg.setSoundLevelDelegate(false);
    });

    $('#resumePlaySound').click(() => {
        zg.setSoundLevelDelegate(false);
        zg.setSoundLevelDelegate(true);
    });
}

async function enumDevices(): Promise<void> {
    const audioInputList: string[] = [];
    const videoInputList: string[] = [];
    const deviceInfo = await zg.enumDevices() as EnumDevicesResult;

    deviceInfo &&
        deviceInfo.microphones.map((item, index) => {
            if (!item.deviceName) {
                item.deviceName = 'microphone' + index;
            }
            audioInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
            console.log('microphone: ' + item.deviceName);
            return item;
        });

    deviceInfo &&
        deviceInfo.cameras.map((item, index) => {
            if (!item.deviceName) {
                item.deviceName = 'camera' + index;
            }
            videoInputList.push(' <option value="' + item.deviceID + '">' + item.deviceName + '</option>');
            console.log('camera: ' + item.deviceName);
            return item;
        });

    audioInputList.push('<option value="0">禁止</option>');
    videoInputList.push('<option value="0">禁止</option>');

    $('#audioList').html(audioInputList.join(''));
    $('#videoList').html(videoInputList.join(''));
}

function initSDK(): void {
    enumDevices();

    zg.on('roomStateUpdate', (roomID: string, state: string, errorCode: number, extendedData: any) => {
        console.warn('roomStateUpdate: ', roomID, state, errorCode, extendedData);
    });
    
    zg.on('roomUserUpdate', (roomID: string, updateType: 'ADD' | 'DELETE', userList: any[]) => {
        console.warn(
            `roomUserUpdate: room ${roomID}, user ${updateType === 'ADD' ? 'added' : 'left'} `,
            JSON.stringify(userList),
        );
    });
    
    zg.on('publisherStateUpdate', (result: PublisherStateUpdateEvent) => {
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
    
    zg.on('playerStateUpdate', (result: PlayerStateUpdateEvent) => {
        console.log('playerStateUpdate', result.streamID, result.state);
        if (result.state == 'PLAYING') {
            console.info(' play  success ' + result.streamID);
            const browser = getBrowser();
            console.warn('browser', browser);
            if (browser === 'Safari') {
                const videos = $('.remoteVideo video');
                for (let i = 0; i < videos.length; i++) {
                    const videoEl = videos[i] as HTMLVideoElement;
                    videoEl.srcObject = videoEl.srcObject;
                }
            }
        } else if (result.state == 'PLAY_REQUESTING') {
            console.info(' play  retry');
        } else {
            if (result.errorCode == 0) {
                console.warn('play stop ' + result.errorCode);
            } else {
                console.error('play error ' + result.errorCode);
            }
        }
    });
    
    zg.on('streamExtraInfoUpdate', (roomID: string, streamList: any[]) => {
        console.warn(`streamExtraInfoUpdate: room ${roomID},  `, JSON.stringify(streamList));
    });
    
    zg.on('roomStreamUpdate', async (roomID: string, updateType: 'ADD' | 'DELETE', streamList: StreamInfo[], extendedData: any) => {
        console.warn('roomStreamUpdate 1 roomID ', roomID, streamList, extendedData);
        if (updateType == 'ADD') {
            for (let i = 0; i < streamList.length; i++) {
                console.info(streamList[i].streamID + ' was added');
                let remoteStream: MediaStream | null = null;
                let playOption: any = {};

                if($("#videoCodec").val()) playOption.videoCodec = $("#videoCodec").val();
                if(l3 == true) playOption.resourceMode = 2 as 1 | 2;

                try {
                    const stream = await zg.startPlayingStream(streamList[i].streamID, playOption);
                    remoteStream = stream;
                    useLocalStreamList.push(streamList[i]);
                    const videoTemp = $(`<video id=${streamList[i].streamID} autoplay muted playsinline controls></video>`);
                    $('.remoteVideo').append(videoTemp);
                    const video = $('.remoteVideo video:last')[0] as HTMLVideoElement;
                    console.warn('video', video, remoteStream);
                    if (remoteStream && video) {
                        video.srcObject = remoteStream;
                        video.muted = false;
                    }
                } catch (err) {
                    console.error('err', err);
                }
            }
        } else if (updateType == 'DELETE') {
            for (let k = 0; k < useLocalStreamList.length; k++) {
                for (let j = 0; j < streamList.length; j++) {
                    if (useLocalStreamList[k].streamID === streamList[j].streamID) {
                        try {
                            zg.stopPlayingStream(useLocalStreamList[k].streamID);
                        } catch (error) {
                            console.error(error);
                        }

                        console.info(useLocalStreamList[k].streamID + 'was devared');

                        $('.remoteVideo video:eq(' + k + ')').remove();
                        useLocalStreamList.splice(k--, 1);
                        break;
                    }
                }
            }
        }
    });

    zg.on('playQualityUpdate', async (streamID: string, streamQuality: any) => {
        console.log(
            `play#${streamID} videoFPS: ${streamQuality.video.videoFPS} videoBitrate: ${streamQuality.video.videoBitrate} audioBitrate: ${streamQuality.audio.audioBitrate} audioFPS: ${streamQuality.audio.audioFPS}`,
        );
        console.log(`play#${streamID}`, streamQuality);
    });

    zg.on('publishQualityUpdate', async (streamID: string, streamQuality: any) => {
        console.log(
            `publish#${streamID} videoFPS: ${streamQuality.video.videoFPS} videoBitrate: ${streamQuality.video.videoBitrate} audioBitrate: ${streamQuality.audio.audioBitrate} audioFPS: ${streamQuality.audio.audioFPS}`,
        );
        console.log(`publish#${streamID}`, streamQuality);
    });

    zg.on('remoteCameraStatusUpdate', (streamID: string, status: 'OPEN' | 'MUTE') => {
        console.warn(`remoteCameraStatusUpdate ${streamID} camera status ${status == 'OPEN' ? 'open' : 'mute'}`);
    });
    
    zg.on('remoteMicStatusUpdate', (streamID: string, status: 'OPEN' | 'MUTE') => {
        console.warn(`remoteMicStatusUpdate ${streamID} micro status ${status == 'OPEN' ? 'open' : 'mute'}`);
    });

    zg.on('soundLevelUpdate', (streamList: SoundLevelInfo[]) => {
        streamList.forEach(stream => {
            stream.type == 'push' && $('#soundLevel').html(Math.round(stream.soundLevel) + '');
            console.warn(`${stream.type} ${stream.streamID}, soundLevel: ${stream.soundLevel}`);
        });
    });
    
    zg.on('deviceError', (errorCode: number, deviceName: string) => {
        console.warn(`deviceError`, errorCode, deviceName);
    });
    
    zg.on('videoDeviceStateChanged', (updateType: string, device: DeviceInfo) => {
        console.warn(`videoDeviceStateChanged`, device, updateType);
    });
    
    zg.on('audioDeviceStateChanged', (updateType: string, deviceType: string, device: DeviceInfo) => {
        console.warn(`audioDeviceStateChanged`, device, updateType, deviceType);
    });
    
    zg.on('roomOnlineUserCountUpdate', (roomID: string, count: number) => {
        console.warn(`roomOnlineUserCountUpdate ${roomID} ${count}`);
    });
}

async function login(roomId: string): Promise<boolean> {
    // 获取token需要客户自己实现，token是对登录房间的唯一验证
    // Obtaining a token needs to be implemented by the customer. The token is the only verification for the login room.
    let token = '';
    //测试用，开发者请忽略
    //Test code, developers please ignore
    if (cgiToken) {
        token = await $.get(tokenUrl, {
            app_id: appID,
            id_name: userID,
            cgi_token: cgiToken,
        });
        //测试用结束
        //Test code end
    } else {
        token = await $.get('https://wsliveroom-alpha.zego.im:8282/token', {
            app_id: appID,
            id_name: userID,
        });
    }
    
    const userInfo: UserInfo = { userID, userName };
    const loginOptions: RoomLoginOptions = { userUpdate: true };
    
    await zg.loginRoom(roomId, token, userInfo, loginOptions);
    roomList.push(roomId);

    return true;
}

async function enterRoom(): Promise<boolean> {
    const roomId = $('#roomId').val() as string;
    if (!roomId) {
        alert('roomId is empty');
        return false;
    }

    await login(roomId);
    loginRoom = true;

    return true;
}

async function logout(): Promise<void> {
    console.info('leave room and close stream');
    const roomId = $('#roomId').val() as string;
    // 停止拉流
    // stop playing
    for (let i = 0; i < useLocalStreamList.length; i++) {
        useLocalStreamList[i].streamID && zg.stopPlayingStream(useLocalStreamList[i].streamID);
    }

    // 清空页面
    // Clear page
    useLocalStreamList = [];

    roomList.splice(roomList.findIndex(room => room == roomId), 1);

    if (previewVideo.srcObject && isPreviewed && (!roomId || roomList.length == 0)) {
      previewVideo.srcObject = null;
      zg.stopPublishingStream(publishStreamId);
      if (localStream) {
          zg.destroyStream(localStream);
      }
      isPreviewed = false;
      !$('.sound').hasClass('d-none') && $('.sound').addClass('d-none');
    }

    if (!roomId || roomList.length == 0) {
      $('.remoteVideo').html('');
      $('#memberList').html('');
    }

    //退出登录
    //logout
    zg.logoutRoom(roomId);
    loginRoom = false;
}

interface Constraints {
    camera?: {
        video?: boolean;
        audio?: boolean;
        audioInput?: string;
        videoInput?: string;
        channelCount?: 1 | 2;
    };
}

interface PublishOption {
    extraInfo?: string;
    videoCodec?: "H264" | "VP8";
    roomID?: string;
}

async function publish(constraints?: Constraints, isNew?: boolean): Promise<void> {
    console.warn('createStream', $('#audioList').val(), $('#videoList').val());
    console.warn('constraints', constraints);
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
    
    !_constraints.camera?.video && (previewVideo.controls = true);
    const playType = _constraints.camera?.audio === false ? 'Video' : _constraints.camera?.video === false ? 'Audio' : 'all';
    publishType = playType;
    push(_constraints, { extraInfo: JSON.stringify({ playType }) }, isNew);
}

async function push(constraints: Constraints, publishOption: PublishOption = {}, isNew?: boolean): Promise<void> {
    try {
        if(localStream) {
            zg.destroyStream(localStream);
        }
        localStream = await zg.createStream(constraints);
        previewVideo.srcObject = localStream;
        isPreviewed = true;
        $('.sound').hasClass('d-none') && $('.sound').removeClass('d-none');
        isNew && (publishStreamId = 'webrtc' + new Date().getTime());
        
        if($("#videoCodec").val()) publishOption.videoCodec = $("#videoCodec").val() as "H264" | "VP8";
        if ($('#roomId').val()) publishOption.roomID = $('#roomId').val() as string;
        
        const result = zg.startPublishingStream(publishStreamId, localStream, publishOption);
        console.log('publish stream' + publishStreamId, result);
    } catch (err) {
        if (err instanceof Error) {
            console.error('createStream', err.name, err.message);
        } else {
            console.error('createStream error', err);
        }
    }
}

$('#toggleCamera').click(function () {
    zg.mutePublishStreamVideo(previewVideo.srcObject as MediaStream, !$(this).hasClass('disabled'));
    $(this).toggleClass('disabled');
});

$('#toggleSpeaker').click(function () {
    zg.mutePublishStreamAudio(previewVideo.srcObject as MediaStream, !$(this).hasClass('disabled'));
    $(this).toggleClass('disabled');
});

$('#enterRoom').click(async () => {
  let loginSuc = false;
  try {
      loginSuc = await enterRoom();
      if (loginSuc) {
          if(localStream) {
              zg.destroyStream(localStream);
          }
          localStream = await zg.createStream({
              camera: {
                  audioInput: $('#audioList').val() as string,
                  videoInput: $('#videoList').val() as string,
                  video: $('#videoList').val() === '0' ? false : true,
                  audio: $('#audioList').val() === '0' ? false : true,
              },
          });
          previewVideo.srcObject = localStream;
          isPreviewed = true;
          $('#videoList').val() === '0' && (previewVideo.controls = true);
      }
  } catch (error) {
      console.error(error);
  }
});

export {
    zg,
    appID,
    publishStreamId,
    checkAnRun,
    supportScreenSharing,
    userID,
    useLocalStreamList,
    logout,
    enterRoom,
    push,
    publish,
    previewVideo,
    isPreviewed,
    loginRoom,
    publishType,
    l3,
};