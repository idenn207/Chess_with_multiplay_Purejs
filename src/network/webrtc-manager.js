// WebRTC 연결 관리자
class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.dataChannel = null;
    this.isHost = false;
    this.connected = false;

    this.onConnected = null;
    this.onDisconnected = null;
    this.onMessage = null;

    // STUN 서버 (LAN에서는 필요 없지만, 호환성을 위해 포함)
    this.config = {
      iceServers: [
        // LAN 환경에서는 STUN 서버 없이도 동작
        // 필요시 로컬 STUN 추가 가능
      ],
    };
  }

  // 호스트: Offer 생성
  async createOffer() {
    this.isHost = true;
    this.peerConnection = new RTCPeerConnection(this.config);

    this.setupConnectionHandlers();

    // 데이터 채널 생성 (호스트가 생성)
    this.dataChannel = this.peerConnection.createDataChannel('gameData', {
      ordered: true,
    });
    this.setupDataChannelHandlers();

    // Offer 생성
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // ICE Candidate 수집 완료 대기
    await this.waitForIceGathering();

    // 최종 SDP 반환 (ICE Candidate 포함)
    return this.peerConnection.localDescription.sdp;
  }

  // 클라이언트: Offer 받고 Answer 생성
  async createAnswer(offerSdp) {
    this.isHost = false;
    this.peerConnection = new RTCPeerConnection(this.config);

    this.setupConnectionHandlers();

    // 데이터 채널 수신 대기 (클라이언트는 수신)
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    // Offer 설정
    const offer = new RTCSessionDescription({
      type: 'offer',
      sdp: offerSdp,
    });
    await this.peerConnection.setRemoteDescription(offer);

    // Answer 생성
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // ICE Candidate 수집 완료 대기
    await this.waitForIceGathering();

    return this.peerConnection.localDescription.sdp;
  }

  // 호스트: Answer 받기
  async receiveAnswer(answerSdp) {
    const answer = new RTCSessionDescription({
      type: 'answer',
      sdp: answerSdp,
    });
    await this.peerConnection.setRemoteDescription(answer);
  }

  // ICE Gathering 완료 대기
  waitForIceGathering() {
    return new Promise((resolve) => {
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.peerConnection.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      this.peerConnection.addEventListener('icegatheringstatechange', checkState);

      // 타임아웃 (5초)
      setTimeout(() => {
        this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 5000);
    });
  }

  // 연결 상태 핸들러 설정
  setupConnectionHandlers() {
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;

      if (state === 'connected') {
        this.connected = true;
        if (this.onConnected) this.onConnected();
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.connected = false;
        if (this.onDisconnected) this.onDisconnected();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
    };
  }

  // 데이터 채널 핸들러 설정
  setupDataChannelHandlers() {
    this.dataChannel.onopen = () => {
      this.connected = true;
      if (this.onConnected) this.onConnected();
    };

    this.dataChannel.onclose = () => {
      this.connected = false;
      if (this.onDisconnected) this.onDisconnected();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onMessage) this.onMessage(data);
      } catch (e) {
      }
    };

    this.dataChannel.onerror = (error) => {
    };
  }

  // 메시지 전송
  send(message) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // 연결 종료
  disconnect() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.connected = false;
  }

  // 연결 상태 확인
  isConnected() {
    return this.connected && this.dataChannel && this.dataChannel.readyState === 'open';
  }
}
