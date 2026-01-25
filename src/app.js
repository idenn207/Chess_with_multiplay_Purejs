// 메인 앱
class MultiGameApp {
  constructor() {
    this.role = null; // 'server' or 'client'
    this.gameId = null;
    this.game = null;
    this.renderer = null;
    this.peerConnected = false; // 중복 연결 처리 방지

    // 게임 모드 관련 (싱글플레이 / 멀티플레이)
    this.gameMode = null; // 'singleplayer' or 'multiplayer'
    this.difficulty = null; // 'easy', 'medium', 'hard'
    this.ai = null; // AI 인스턴스
    this.aiThinkingDelay = 800; // AI 응답 딜레이 (ms)
    this.isAIMoving = false; // AI 이동 중 플래그

    // WebRTC 관련
    this.webrtc = new WebRTCManager();
    this.signalingUI = new SignalingUI();

    // 타이머 관련
    this.turnTimeLimit = 30; // 30초
    this.myTime = this.turnTimeLimit;
    this.opponentTime = this.turnTimeLimit;
    this.timerInterval = null;
    this.movePending = false; // 이동 처리 중 플래그 (타임아웃 race condition 방지)

    this.elements = {
      container: document.querySelector('.container'),
      roleSelection: document.getElementById('roleSelection'),
      gameSelection: document.getElementById('gameSelection'),
      connectionPanel: document.getElementById('connectionPanel'),
      serverInfo: document.getElementById('serverInfo'),
      gameArea: document.getElementById('gameArea'),
      boardContainer: document.getElementById('boardContainer'),
      pageTitle: document.getElementById('pageTitle'),
      gameOverlay: document.getElementById('gameOverlay'),
      overlayMessage: document.getElementById('overlayMessage'),
      turnIndicatorLeft: document.getElementById('turnIndicatorLeft'),
      turnIndicatorRight: document.getElementById('turnIndicatorRight'),
      myTimerBar: document.getElementById('myTimerBar'),
      opponentTimerBar: document.getElementById('opponentTimerBar'),
      myTimerText: document.getElementById('myTimerText'),
      opponentTimerText: document.getElementById('opponentTimerText'),
    };

    this.init();
  }

  init() {
    this.signalingUI.initialize();
    this.setupWebRTCCallbacks();
    this.showModeSelection(); // 모드 선택부터 시작
    this.setupEventListeners();
  }

  setupWebRTCCallbacks() {
    // 연결 성공
    this.webrtc.onConnected = () => {
      this.signalingUI.showConnected();
      this.onPeerConnected();
    };

    // 연결 끊김
    this.webrtc.onDisconnected = () => {
      this.showOverlay('연결이 끊어졌습니다');
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
    // 모드 선택
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectMode(btn.dataset.mode);
      });
    });

    // 난이도 선택
    document.querySelectorAll('.difficulty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectDifficulty(btn.dataset.difficulty);
      });
    });

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

  // 게임 모드 선택
  showModeSelection() {
    document.getElementById('modeSelection').classList.add('active');
    document.getElementById('difficultySelection').classList.remove('active');
    this.elements.roleSelection.classList.remove('active');
    this.elements.gameSelection.classList.remove('active');
    this.elements.connectionPanel.classList.remove('active');
    this.elements.serverInfo.classList.remove('active');
    this.elements.gameArea.classList.remove('active');
  }

  selectMode(mode) {
    this.gameMode = mode;
    document.getElementById('modeSelection').classList.remove('active');

    if (mode === 'singleplayer') {
      this.showDifficultySelection();
    } else {
      this.showRoleSelection();
    }
  }

  showDifficultySelection() {
    document.getElementById('difficultySelection').classList.add('active');
  }

  selectDifficulty(difficulty) {
    this.difficulty = difficulty;
    document.getElementById('difficultySelection').classList.remove('active');
    this.setupSinglePlayer();
  }

  setupSinglePlayer() {
    this.elements.pageTitle.textContent = '🎮 체스 AI 대전';
    this.renderGameSelection();
    this.elements.gameSelection.classList.add('active');
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

    if (this.gameMode === 'singleplayer') {
      // 싱글플레이 모드
      this.startSinglePlayerGame(gameId);
    } else {
      // 멀티플레이 모드 (기존 로직)
      const { game, renderer } = this.initializeRenderer(gameId, 'server');
      this.game = game;
      this.renderer = renderer;

      document.getElementById('selectedGameName').textContent = config.name;
      document.getElementById('currentGameName').textContent = config.name;
      document.getElementById('myColor').textContent = config.serverLabel;

      this.elements.gameSelection.classList.remove('active');
      this.elements.serverInfo.classList.add('active');
      this.elements.gameArea.classList.add('active');

      document.getElementById('newGameBtn').style.display = 'none';

      await this.startServer();
    }
  }

  startSinglePlayerGame(gameId) {
    const config = gameRegistry.get(gameId);

    // 게임 및 렌더러 초기화
    const { game, renderer } = this.initializeRenderer(gameId, 'server');
    this.game = game;
    this.renderer = renderer;

    // 게임별 설정
    if (gameId === 'chess') {
      this.game.myColor = 'white'; // 플레이어는 백
      this.ai = new ChessAI(this.difficulty);
    } else if (gameId === 'gomoku') {
      this.game.myColor = 'black'; // 플레이어는 흑 (선공)
      this.ai = new GomokuAI(this.difficulty);
    }

    // UI 업데이트
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent =
      gameId === 'chess' ? '백 (플레이어)' : '흑 (플레이어)';
    this.elements.gameSelection.classList.remove('active');
    this.elements.gameArea.classList.add('active');
    document.getElementById('resignBtn').disabled = false;
    document.getElementById('newGameBtn').style.display = 'none';

    this.updateCurrentTurn();
    this.updateTurnIndicators();

    // 집중 모드 활성화
    this.elements.container.classList.add('game-focused');
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

      // Signaling UI 표시
      this.signalingUI.showHostMode(offerSdp);
    } catch (e) {
      alert('연결 코드 생성 실패: ' + e.message);
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

  // 헬퍼: Renderer 초기화
  initializeRenderer(gameId, role) {
    const game = gameRegistry.createGame(gameId, role);
    const renderer = gameRegistry.createRenderer(
      gameId,
      game,
      this.elements.boardContainer,
      (moveData) => this.handleLocalMove(moveData)
    );
    renderer.onMoveStart = () => this.handleMoveStart();
    renderer.initialize();
    return { game, renderer };
  }

  // 헬퍼: 타이머 초기화 및 시작
  initializeAndStartTimer() {
    this.myTime = this.turnTimeLimit;
    this.opponentTime = this.turnTimeLimit;
    this.updateMyTimerDisplay();
    this.updateOpponentTimerDisplay();
    this.updateCurrentTurn();
    this.updateTurnIndicators();
    this.startTimer();
  }

  // 헬퍼: 연결 상태 업데이트
  updateConnectionStatus() {
    const statusIndicator = document.getElementById('statusIndicator');
    const serverStatus = document.getElementById('serverStatus');
    statusIndicator.classList.remove('waiting');
    statusIndicator.classList.add('ready');
    serverStatus.textContent = '상대방 연결됨!';
  }

  // 헬퍼: 게임 정보 전송
  sendGameInfo() {
    this.webrtc.send({
      type: 'gameInfo',
      data: {
        gameId: this.gameId,
        gameState: this.game.getGameState(),
      },
    });
  }

  // 연결 성공 시 호출
  onPeerConnected() {
    // Data channel이 준비되지 않았으면 대기
    if (!this.webrtc.dataChannel || this.webrtc.dataChannel.readyState !== 'open') {
      return;
    }

    // 중복 호출 방지
    if (this.peerConnected) {
      return;
    }
    this.peerConnected = true;

    // 게임 집중 모드 활성화
    setTimeout(() => {
      this.elements.container.classList.add('game-focused');
    }, 500);

    // 실시간 게임 (테트리스)
    if (this.gameId) {
      const config = gameRegistry.get(this.gameId);
      if (config && config.isRealtime) {
        this.updateConnectionStatus();
        this.sendGameInfo();

        // 준비 모달 표시
        if (this.renderer && typeof this.renderer.onConnectionEstablished === 'function') {
          this.renderer.onConnectionEstablished();
        }
        return;
      }
    }

    // 턴 기반 게임 (체스, 오목 등)
    if (this.role === 'server') {
      this.updateConnectionStatus();
      document.getElementById('resignBtn').disabled = false;
      this.initializeAndStartTimer();
      this.sendGameInfo();
    } else {
      this.elements.connectionPanel.classList.remove('active');
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
        // 실시간 게임(Tetris)인지 확인
        const config = gameRegistry.get(this.gameId);
        const isRealtime = config && config.isRealtime;

        // 턴 기반 게임만 타이머 처리
        if (!isRealtime) {
          this.stopTimer();
          // 상대방이 움직였으므로 상대방 타이머 리셋
          this.opponentTime = this.turnTimeLimit;
          this.updateOpponentTimerDisplay();
        }

        this.renderer.updateFromMove(data);

        // 턴 기반 게임만 턴 업데이트
        if (!isRealtime) {
          this.updateCurrentTurn();
          this.updateTurnIndicators();
        }

        // 턴 기반 게임만 여기서 게임 오버 처리
        // 실시간 게임(Tetris)은 updateFromMove()에서 onMove() 콜백을 통해 처리함
        if (data.gameOver && !isRealtime) {
          this.handleGameOver(data.winner, data.reason);
        } else if (!isRealtime) {
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
        // 상대방 타이머를 0으로 설정
        this.opponentTime = 0;
        this.updateOpponentTimerDisplay();

        this.game.currentTurn = this.game.myColor;
        this.updateCurrentTurn();
        this.updateTurnIndicators();
        this.startTimer();
        break;

      case 'timerSync':
        // 상대방 타이머 동기화
        this.opponentTime = data.timeRemaining;
        this.updateOpponentTimerDisplay();
        break;
    }
  }

  // 클라이언트: 게임 초기화
  initClientGame(data) {
    // 중복 초기화 방지
    if (this.renderer) {
      return;
    }

    const { gameId, gameState } = data;
    this.gameId = gameId;
    const config = gameRegistry.get(gameId);

    // 게임 및 렌더러 초기화
    const { game, renderer } = this.initializeRenderer(gameId, 'client');
    this.game = game;
    this.renderer = renderer;
    this.game.applyMove(gameState);

    // UI 업데이트
    document.getElementById('currentGameName').textContent = config.name;
    document.getElementById('myColor').textContent = config.clientLabel;
    this.elements.gameArea.classList.add('active');
    document.getElementById('newGameBtn').style.display = 'none';

    // 게임 집중 모드 활성화
    setTimeout(() => {
      this.elements.container.classList.add('game-focused');
    }, 300);

    // 실시간 게임 (테트리스)
    if (config.isRealtime) {
      if (this.renderer && typeof this.renderer.onConnectionEstablished === 'function') {
        this.renderer.onConnectionEstablished();
      }
      return;
    }

    // 턴 기반 게임 (체스, 오목 등)
    document.getElementById('resignBtn').disabled = false;
    this.initializeAndStartTimer();
  }

  // 이동 시작 시 호출 (애니메이션 시작 전)
  handleMoveStart() {
    this.movePending = true;
    this.stopTimer();
  }

  handleLocalMove(moveData) {
    this.movePending = false;

    if (this.gameMode === 'singleplayer') {
      // 싱글플레이 모드
      this.handleLocalMoveSinglePlayer(moveData);
    } else {
      // 멀티플레이 모드
      this.handleLocalMoveMultiplayer(moveData);
    }
  }

  handleLocalMoveMultiplayer(moveData) {
    this.webrtc.send({ type: 'move', data: moveData });

    // 실시간 게임(Tetris)인지 확인
    const config = gameRegistry.get(this.gameId);
    const isRealtime = config && config.isRealtime;

    // 턴 기반 게임만 턴 업데이트
    if (!isRealtime) {
      this.updateCurrentTurn();
      this.updateTurnIndicators();
    }

    if (moveData.gameOver) {
      this.handleGameOver(moveData.winner, moveData.reason);
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
    // 실시간 게임(Tetris)인지 확인
    const config = gameRegistry.get(this.gameId);
    const isRealtime = config && config.isRealtime;

    // 턴 기반 게임만 타이머 정지
    if (!isRealtime) {
      this.stopTimer();
    }

    this.game.gameOver = true;
    document.getElementById('resignBtn').disabled = true;
    document.getElementById('newGameBtn').style.display = '';

    // 턴 표시기 비활성화
    this.elements.turnIndicatorLeft.classList.remove('active');
    this.elements.turnIndicatorRight.classList.remove('active');

    let message = '';

    if (winner === 'draw') {
      message = 'DRAW';
      if (reason === 'stalemate') message = 'STALEMATE';
      if (reason === 'board_full') message = 'DRAW';
    } else if (winner === this.game.myColor) {
      message = 'WINNER!';
    } else {
      message = 'DEFEAT';
    }

    // 게임별 특수 메시지
    if (reason === 'checkmate') message = 'CHECKMATE!';
    if (reason === 'five_in_a_row') message = winner === this.game.myColor ? 'WINNER!' : 'DEFEAT';
    if (reason === 'block_out') message = winner === this.game.myColor ? 'WINNER!' : 'GAME OVER';
    if (reason === 'opponent_out') message = 'WINNER!';

    this.showOverlay(message);
  }

  showOverlay(message) {
    this.elements.overlayMessage.textContent = message;
    this.elements.gameOverlay.classList.add('active');

    // 오버레이 클릭 시 닫기
    const closeOverlay = () => {
      this.elements.gameOverlay.classList.remove('active');
      this.elements.gameOverlay.removeEventListener('click', closeOverlay);
    };
    this.elements.gameOverlay.addEventListener('click', closeOverlay);
  }

  updateCurrentTurn() {
    const config = gameRegistry.get(this.gameId);
    const turnText = config.getTurnLabel(this.game.currentTurn);
    document.getElementById('currentTurn').textContent = turnText;
  }

  updateTurnIndicators() {
    if (!this.game || this.game.gameOver) {
      this.elements.turnIndicatorLeft.classList.remove('active');
      this.elements.turnIndicatorRight.classList.remove('active');
      return;
    }

    // 내 차례인지 확인
    const isMyTurn = this.game.currentTurn === this.game.myColor;
    this.elements.turnIndicatorLeft.classList.toggle('active', isMyTurn);
    this.elements.turnIndicatorRight.classList.toggle('active', !isMyTurn);
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

    // 게임 집중 모드 해제
    this.elements.container.classList.remove('game-focused');
  }

  // 타이머 시작
  startTimer() {
    this.stopTimer();
    this.myTime = this.turnTimeLimit;
    this.updateMyTimerDisplay();
    this.updateOpponentTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.myTime--;
      this.updateMyTimerDisplay();
      this.updateTurnIndicators();

      // 상대방에게 타이머 동기화
      this.webrtc.send({
        type: 'timerSync',
        data: { timeRemaining: this.myTime },
      });

      if (this.myTime < 0) {
        this.myTime = 0;
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

  // 내 타이머 디스플레이 업데이트
  updateMyTimerDisplay() {
    this.elements.myTimerText.textContent = this.myTime;

    // 타이머 바 높이 업데이트 (퍼센트)
    const percentage = (this.myTime / this.turnTimeLimit) * 100;
    this.elements.myTimerBar.style.height = percentage + '%';

    // 시간에 따라 색상 변경
    this.elements.myTimerBar.classList.remove('warning', 'danger');
    if (this.myTime <= 5) {
      this.elements.myTimerBar.classList.add('danger');
    } else if (this.myTime <= 10) {
      this.elements.myTimerBar.classList.add('warning');
    }
  }

  // 상대방 타이머 디스플레이 업데이트
  updateOpponentTimerDisplay() {
    this.elements.opponentTimerText.textContent = this.opponentTime;

    // 타이머 바 높이 업데이트 (퍼센트)
    const percentage = (this.opponentTime / this.turnTimeLimit) * 100;
    this.elements.opponentTimerBar.style.height = percentage + '%';

    // 시간에 따라 색상 변경
    this.elements.opponentTimerBar.classList.remove('warning', 'danger');
    if (this.opponentTime <= 5) {
      this.elements.opponentTimerBar.classList.add('danger');
    } else if (this.opponentTime <= 10) {
      this.elements.opponentTimerBar.classList.add('warning');
    }
  }

  // 타이머 만료 처리
  handleTimerExpired() {
    this.stopTimer();

    // 이동 처리 중이면 타임아웃 무시 (race condition 방지)
    if (this.movePending) {
      return;
    }

    if (this.game.gameOver || this.game.currentTurn !== this.game.myColor) {
      return;
    }

    // 선택 상태 초기화
    this.clearBoardSelection();

    // 타임아웃 메시지 전송
    this.webrtc.send({ type: 'timeout' });

    // 턴 변경
    const config = gameRegistry.get(this.gameId);
    const opponentColor = this.game.myColor === config.serverColor ? config.clientColor : config.serverColor;
    this.game.currentTurn = opponentColor;
    this.updateCurrentTurn();
    this.updateTurnIndicators();
  }

  // 보드 선택 상태 초기화
  clearBoardSelection() {
    this.game.selectedSquare = null;
    this.game.validMoves = [];
    if (this.renderer && this.renderer.render) {
      this.renderer.render();
    }
  }

  // 싱글플레이 모드: 로컬 이동 처리
  handleLocalMoveSinglePlayer(moveData) {
    this.updateCurrentTurn();
    this.updateTurnIndicators();

    if (moveData.gameOver) {
      this.handleGameOver(moveData.winner, moveData.reason);
      return;
    }

    // AI 이동 완료 후 플레이어 턴으로 복귀
    if (this.isAIMoving) {
      this.isAIMoving = false;

      // 체스 전용: 플레이어가 체크메이트/스테일메이트 상태인지 확인
      if (this.gameId === 'chess') {
        if (this.game.isCheckmate(this.game.myColor)) {
          this.handleGameOver('black', 'checkmate');
        } else if (this.game.isStalemate(this.game.myColor)) {
          this.handleGameOver('draw', 'stalemate');
        }
      }
      // 오목은 executeMove에서 이미 게임 종료 처리
      return;
    }

    // 플레이어 이동 후 AI 턴
    if (this.game.currentTurn !== this.game.myColor) {
      this.executeAIMove();
    }
  }

  // AI 이동 실행
  executeAIMove() {
    this.showAIThinking();

    setTimeout(() => {
      const bestMove = this.ai.findBestMove(this.game, this.game.currentTurn);

      if (!bestMove) {
        this.hideAIThinking();
        return;
      }

      // AI 이동 플래그 설정
      this.isAIMoving = true;

      this.hideAIThinking();

      // 게임별 이동 형식 처리
      if (this.gameId === 'chess') {
        // 체스: {from: [r,c], to: [r,c]} 형식
        const [fromRow, fromCol] = bestMove.from;
        const [toRow, toCol] = bestMove.to;
        this.renderer.animateMove(fromRow, fromCol, toRow, toCol);
      } else if (this.gameId === 'gomoku') {
        // 오목: {row, col} 형식 - AI 전용 메서드 사용
        this.renderer.animateAIMove(bestMove.row, bestMove.col);
      }
    }, this.aiThinkingDelay);
  }

  // AI 생각 중 오버레이 표시
  showAIThinking() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-thinking';
    overlay.id = 'aiThinkingOverlay';
    overlay.textContent = 'AI 생각 중';
    this.elements.boardContainer.appendChild(overlay);
  }

  // AI 생각 중 오버레이 숨김
  hideAIThinking() {
    const overlay = document.getElementById('aiThinkingOverlay');
    if (overlay) overlay.remove();
  }
}

// 앱 초기화
const app = new MultiGameApp();

