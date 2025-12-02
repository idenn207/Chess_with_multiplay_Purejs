// 메인 앱
class MultiGameApp {
  constructor() {
    this.role = null; // 'server' or 'client'
    this.gameId = null;
    this.game = null;
    this.renderer = null;

    // WebRTC 관련
    this.webrtc = new WebRTCManager();
    this.signalingUI = new SignalingUI();

    // 타이머 관련
    this.turnTimeLimit = 30; // 30초
    this.currentTurnTime = this.turnTimeLimit;
    this.timerInterval = null;

    this.elements = {
      roleSelection: document.getElementById('roleSelection'),
      gameSelection: document.getElementById('gameSelection'),
      connectionPanel: document.getElementById('connectionPanel'),
      serverInfo: document.getElementById('serverInfo'),
      gameArea: document.getElementById('gameArea'),
      boardContainer: document.getElementById('boardContainer'),
      status: document.getElementById('status'),
      pageTitle: document.getElementById('pageTitle'),
      turnTimer: document.getElementById('turnTimer'),
    };

    this.init();
  }

  init() {
    this.signalingUI.initialize();
    this.setupWebRTCCallbacks();
    this.showRoleSelection();
    this.setupEventListeners();
  }

  setupWebRTCCallbacks() {
    // 연결 성공
    this.webrtc.onConnected = () => {
      console.log('WebRTC Connected!');
      this.signalingUI.showConnected();
      this.onPeerConnected();
    };

    // 연결 끊김
    this.webrtc.onDisconnected = () => {
      console.log('WebRTC Disconnected');
      this.updateStatus('연결이 끊어졌습니다.', 'error');
    };

    // 메시지 수신
    this.webrtc.onMessage = (message) => {
      this.handleMessage(message);
    };

    // Signaling UI 콜백
    this.signalingUI.onOfferSubmit = async (offerSdp) => {
      // 클라이언트: Offer 받고 Answer 생성
      try {
        this.signalingUI.setStatus('응답 생성 중...', 'info');
        const answerSdp = await this.webrtc.createAnswer(offerSdp);
        this.signalingUI.showAnswerDisplay(answerSdp);
      } catch (e) {
        this.signalingUI.showError('응답 생성 실패: ' + e.message);
      }
    };

    this.signalingUI.onAnswerSubmit = async (answerSdp) => {
      // 호스트: Answer 받고 연결 완료
      try {
        this.signalingUI.setStatus('연결 중...', 'info');
        await this.webrtc.receiveAnswer(answerSdp);
        // 연결은 onConnected 콜백에서 처리
      } catch (e) {
        this.signalingUI.showError('연결 실패: ' + e.message);
      }
    };
  }

  setupEventListeners() {
    // 역할 선택
    document.querySelectorAll('.role-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectRole(btn.dataset.role);
      });
    });

    // 서버 연결 (클라이언트용)
    document.getElementById('connectBtn').addEventListener('click', () => {
      this.connectToServer();
    });

    // 게임 컨트롤
    document.getElementById('resignBtn').addEventListener('click', () => {
      this.resign();
    });

    document.getElementById('newGameBtn').addEventListener('click', () => {
      this.newGame();
    });
  }

  showRoleSelection() {
    this.elements.roleSelection.classList.add('active');
    this.elements.gameSelection.classList.remove('active');
    this.elements.connectionPanel.classList.remove('active');
    this.elements.serverInfo.classList.remove('active');
    this.elements.gameArea.classList.remove('active');
  }

  selectRole(role) {
    this.role = role;
    this.elements.roleSelection.classList.remove('active');

    if (role === 'server') {
      this.setupServer();
    } else {
      this.setupClient();
    }
  }

  setupServer() {
    this.elements.pageTitle.textContent = '🎮 LAN Multi Game (Host)';
    this.renderGameSelection();
    this.elements.gameSelection.classList.add('active');
  }

  renderGameSelection() {
    const container = document.getElementById('gameButtons');
    container.innerHTML = '';

    gameRegistry.getAll().forEach((config) => {
      const btn = document.createElement('button');
      btn.className = 'game-btn';
      btn.dataset.gameId = config.id;
      btn.innerHTML = `
        <span class="icon">${config.icon}</span>
        <span>${config.name}</span>
      `;
      btn.addEventListener('click', () => this.selectGame(config.id));
      container.appendChild(btn);
    });
  }

  async selectGame(gameId) {
    this.gameId = gameId;
    const config = gameRegistry.get(gameId);

    // 버튼 활성화
    document.querySelectorAll('.game-btn').forEach((btn) => {
      btn.classList.remove('selected');
    });
    document.querySelector(`[data-game-id="${gameId}"]`).classList.add('selected');

    // 게임 초기화
    this.game = gameRegistry.createGame(gameId, 'server');
    this.renderer = gameRegistry.createRenderer(gameId, this.game, this.elements.boardContainer, (moveData) => this.handleLocalMove(moveData));
    this.renderer.initialize();

    // UI 업데이트
    document.getElementById('selectedGameName').textContent = config.name;
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent = config.serverLabel;

    this.elements.gameSelection.classList.remove('active');
    this.elements.serverInfo.classList.add('active');
    this.elements.gameArea.classList.add('active');

    document.getElementById('newGameBtn').style.display = 'none';

    this.updateStatus('연결 코드를 생성하고 있습니다...', '');

    // WebRTC Offer 생성
    await this.startServer();
  }

  async startServer() {
    try {
      const statusIndicator = document.getElementById('statusIndicator');
      const serverStatus = document.getElementById('serverStatus');

      statusIndicator.classList.add('waiting');
      serverStatus.textContent = '연결 코드 생성 중...';

      // Offer 생성
      const offerSdp = await this.webrtc.createOffer();

      serverStatus.textContent = '상대방 대기 중...';
      this.updateStatus('연결 코드를 상대방에게 전달하세요.', '');

      // Signaling UI 표시
      this.signalingUI.showHostMode(offerSdp);
    } catch (e) {
      console.error('Failed to create offer:', e);
      this.updateStatus('연결 코드 생성 실패: ' + e.message, 'error');
    }
  }

  setupClient() {
    this.elements.pageTitle.textContent = '🎮 LAN Multi Game (Client)';
    this.elements.connectionPanel.classList.add('active');
  }

  connectToServer() {
    // Signaling UI 표시 (Offer 입력 모드)
    this.signalingUI.showClientMode();
  }

  // 연결 성공 시 호출
  onPeerConnected() {
    const statusIndicator = document.getElementById('statusIndicator');
    const serverStatus = document.getElementById('serverStatus');

    if (this.role === 'server') {
      statusIndicator.classList.remove('waiting');
      statusIndicator.classList.add('ready');
      serverStatus.textContent = '상대방 연결됨!';

      const config = gameRegistry.get(this.gameId);
      this.updateStatus(`게임 시작! 내 차례입니다 (${config.serverLabel})`, 'turn');
      document.getElementById('resignBtn').disabled = false;
      this.updateCurrentTurn();

      // 타이머 시작 (서버가 선공)
      this.startTimer();

      // 클라이언트에게 게임 정보 전송
      this.webrtc.send({
        type: 'gameInfo',
        data: {
          gameId: this.gameId,
          gameState: this.game.getGameState(),
        },
      });
    } else {
      // 클라이언트는 gameInfo 메시지 대기
      this.elements.connectionPanel.classList.remove('active');
      this.updateStatus('게임 정보를 받는 중...', '');
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'gameInfo':
        // 클라이언트: 게임 정보 수신
        this.initClientGame(data);
        break;

      case 'move':
        this.stopTimer();
        this.renderer.updateFromMove(data);
        this.updateCurrentTurn();

        if (data.gameOver) {
          this.handleGameOver(data.winner, data.reason);
        } else {
          this.updateStatus('내 차례입니다', 'turn');
          this.startTimer();
        }
        break;

      case 'resign':
        this.stopTimer();
        const winner = this.game.myColor;
        this.handleGameOver(winner, 'resignation');
        break;

      case 'timeout':
        // 상대방 타임아웃
        this.stopTimer();
        this.updateStatus('상대방이 시간 초과했습니다. 내 차례입니다', 'turn');
        this.game.currentTurn = this.game.myColor;
        this.updateCurrentTurn();
        this.startTimer();
        break;
    }
  }

  // 클라이언트: 게임 초기화
  initClientGame(data) {
    const { gameId, gameState } = data;
    this.gameId = gameId;
    const config = gameRegistry.get(gameId);

    // 게임 초기화
    this.game = gameRegistry.createGame(gameId, 'client');
    this.game.applyMove(gameState);

    this.renderer = gameRegistry.createRenderer(gameId, this.game, this.elements.boardContainer, (moveData) => this.handleLocalMove(moveData));
    this.renderer.initialize();

    // UI 업데이트
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent = config.clientLabel;

    this.elements.gameArea.classList.add('active');
    document.getElementById('resignBtn').disabled = false;

    document.getElementById('newGameBtn').style.display = 'none';

    this.updateStatus('상대방 차례입니다', '');
    this.updateCurrentTurn();
  }

  handleLocalMove(moveData) {
    this.stopTimer();
    this.webrtc.send({ type: 'move', data: moveData });
    this.updateCurrentTurn();

    if (moveData.gameOver) {
      this.handleGameOver(moveData.winner, moveData.reason);
    } else {
      this.updateStatus('상대방 차례입니다', '');
    }
  }

  resign() {
    if (!confirm('정말 기권하시겠습니까?')) return;

    this.webrtc.send({ type: 'resign' });

    const config = gameRegistry.get(this.gameId);
    const opponentColor = this.game.myColor === config.serverColor ? config.clientColor : config.serverColor;

    this.handleGameOver(opponentColor, 'resignation');
  }

  handleGameOver(winner, reason) {
    this.stopTimer();
    this.game.gameOver = true;
    document.getElementById('resignBtn').disabled = true;
    document.getElementById('newGameBtn').style.display = '';

    let message = '';

    if (winner === 'draw') {
      message = '무승부';
      if (reason === 'stalemate') message += ' (스테일메이트)';
      if (reason === 'board_full') message += ' (판이 가득 함)';
    } else if (winner === this.game.myColor) {
      message = '승리했습니다! 🎉';
    } else {
      message = '패배했습니다';
    }

    if (reason === 'checkmate') message += ' (체크메이트)';
    if (reason === 'resignation') message += ' (기권)';
    if (reason === 'five_in_a_row') message += ' (오목 완성)';

    this.updateStatus(message, 'gameover');
  }

  updateStatus(message, type = '') {
    this.elements.status.textContent = message;
    this.elements.status.className = type;
  }

  updateCurrentTurn() {
    const config = gameRegistry.get(this.gameId);
    const turnText = config.getTurnLabel(this.game.currentTurn);
    document.getElementById('currentTurn').textContent = turnText;
  }

  newGame() {
    this.cleanup();
    location.reload();
  }

  cleanup() {
    if (this.renderer) this.renderer.cleanup();
    if (this.webrtc) this.webrtc.disconnect();
    if (this.signalingUI) this.signalingUI.cleanup();
    this.stopTimer();
  }

  // 타이머 시작
  startTimer() {
    this.stopTimer();
    this.currentTurnTime = this.turnTimeLimit;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.currentTurnTime--;
      this.updateTimerDisplay();

      if (this.currentTurnTime <= 0) {
        this.handleTimerExpired();
      }
    }, 1000);
  }

  // 타이머 정지
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // 타이머 디스플레이 업데이트
  updateTimerDisplay() {
    this.elements.turnTimer.textContent = this.currentTurnTime;

    // 시간에 따라 색상 변경
    this.elements.turnTimer.classList.remove('warning', 'danger');
    if (this.currentTurnTime <= 5) {
      this.elements.turnTimer.classList.add('danger');
    } else if (this.currentTurnTime <= 10) {
      this.elements.turnTimer.classList.add('warning');
    }
  }

  // 타이머 만료 처리
  handleTimerExpired() {
    this.stopTimer();

    if (this.game.gameOver || this.game.currentTurn !== this.game.myColor) {
      return;
    }

    // 타임아웃 메시지 전송
    this.webrtc.send({ type: 'timeout' });

    // 상대방에게 턴 넘김
    this.updateStatus('시간 초과! 상대방 차례입니다', 'error');

    // 턴 변경
    const config = gameRegistry.get(this.gameId);
    const opponentColor = this.game.myColor === config.serverColor ? config.clientColor : config.serverColor;
    this.game.currentTurn = opponentColor;
    this.updateCurrentTurn();
  }
}

// 앱 초기화
const app = new MultiGameApp();

