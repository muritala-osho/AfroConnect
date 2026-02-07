import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, ICameraVideoTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { Platform } from 'react-native';

AgoraRTC.setLogLevel(3);

class AgoraService {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private localVideoTrack: ICameraVideoTrack | null = null;
  private onRemoteUserJoined: ((user: IAgoraRTCRemoteUser) => void) | null = null;
  private onRemoteUserLeft: ((user: IAgoraRTCRemoteUser) => void) | null = null;

  isSupported(): boolean {
    return Platform.OS === 'web';
  }

  async joinVoiceCall(appId: string, channel: string, token: string, uid: number): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      this.setupRemoteHandlers();
      await this.client.join(appId, channel, token, uid);
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      await this.client.publish([this.localAudioTrack]);
      return true;
    } catch (error) {
      console.error('Agora voice join error:', error);
      return false;
    }
  }

  async joinVideoCall(appId: string, channel: string, token: string, uid: number): Promise<{ audioTrack: IMicrophoneAudioTrack | null; videoTrack: ICameraVideoTrack | null }> {
    if (!this.isSupported()) return { audioTrack: null, videoTrack: null };
    try {
      this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      this.setupRemoteHandlers();
      await this.client.join(appId, channel, token, uid);
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
      await this.client.publish([this.localAudioTrack, this.localVideoTrack]);
      return { audioTrack: this.localAudioTrack, videoTrack: this.localVideoTrack };
    } catch (error) {
      console.error('Agora video join error:', error);
      return { audioTrack: null, videoTrack: null };
    }
  }

  private setupRemoteHandlers() {
    if (!this.client) return;
    this.client.on('user-published', async (user, mediaType) => {
      await this.client!.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
      if (mediaType === 'video') {
        this.onRemoteUserJoined?.(user);
      }
    });
    this.client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video') {
        this.onRemoteUserLeft?.(user);
      }
    });
    this.client.on('user-left', (user) => {
      this.onRemoteUserLeft?.(user);
    });
  }

  setRemoteUserHandlers(onJoined: (user: IAgoraRTCRemoteUser) => void, onLeft: (user: IAgoraRTCRemoteUser) => void) {
    this.onRemoteUserJoined = onJoined;
    this.onRemoteUserLeft = onLeft;
  }

  async toggleMute(muted: boolean): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(!muted);
    }
  }

  async toggleCamera(off: boolean): Promise<void> {
    if (this.localVideoTrack) {
      await this.localVideoTrack.setEnabled(!off);
    }
  }

  async switchCamera(): Promise<void> {
    if (this.localVideoTrack) {
      try {
        const devices = await AgoraRTC.getCameras();
        if (devices.length > 1) {
          const currentLabel = this.localVideoTrack.getTrackLabel();
          const currentIndex = devices.findIndex(d => d.label === currentLabel);
          const nextDevice = devices[(currentIndex + 1) % devices.length];
          await this.localVideoTrack.setDevice(nextDevice.deviceId);
        }
      } catch (e) {
        console.log('Camera switch not supported:', e);
      }
    }
  }

  async leave(): Promise<void> {
    try {
      if (this.localAudioTrack) {
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
      }
      if (this.localVideoTrack) {
        this.localVideoTrack.stop();
        this.localVideoTrack.close();
        this.localVideoTrack = null;
      }
      if (this.client) {
        await this.client.leave();
        this.client = null;
      }
    } catch (error) {
      console.error('Agora leave error:', error);
    }
    this.onRemoteUserJoined = null;
    this.onRemoteUserLeft = null;
  }

  getLocalVideoTrack(): ICameraVideoTrack | null {
    return this.localVideoTrack;
  }
}

export default new AgoraService();
