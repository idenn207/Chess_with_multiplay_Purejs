/**
 * 테트리스 렌더러
 * - Canvas 기반 렌더링
 * - 실시간 게임 루프
 * - 키보드 입력 처리
 * - 두 플레이어 보드 표시
 */

class TetrisRenderer {
  constructor(game, container, onMove) {
    this.game = game;
    this.container = container;
    this.onMove = onMove;
    this.onMoveStart = null;

    // 캔버스
    this.myCanvas = null;
    this.myCtx = null;
    this.opponentCanvas = null;
    this.opponentCtx = null;

    // UI 요소
    this.wrapper = null;
    this.myPanel = null;
    this.opponentPanel = null;
    this.startModal = null;
    this.modeModal = null;

    // 게임 루프
    this.animationId = null;
    this.lastTime = 0;
    this.dropAccumulator = 0;
    this.isRunning = false;

    // DAS/ARR (지연 자동 반복)
    this.das = 133; // ms
    this.arr = 10;  // ms
    this.keyState = {};
    this.keyTimers = {};

    // 렌더링 설정
    this.cellSize = 28;
    this.miniCellSize = 18;

    // 상태 동기화 간격
    this.syncInterval = null;
    this.lastSyncTime = 0;
    this.syncRate = 500; // ms

    // 준비 상태
    this.isReady = false;
    this.opponentReady = false;
    this.gameStarted = false;

    // 싱글플레이어 모드
    this.singlePlayerMode = null; // 'record' or 'ai'
    this.ai = null; // TetrisAI 인스턴스
    this.aiSyncInterval = null;

    // 바운드 메서드
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
  }
  
  initialize() {
    this.createUI();
    this.setupEventListeners();
    this.render();

    // 턴 기반 UI 요소 숨기기 및 풀스크린 모드 활성화
    document.querySelector('.container').classList.add('tetris-active');
    document.querySelector('.container').classList.add('tetris-fullscreen');
    document.body.classList.add('tetris-mode');
  }
  
  createUI() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'tetris-wrapper';
    
    // 내 게임 패널
    this.myPanel = document.createElement('div');
    this.myPanel.className = 'tetris-panel my-panel';
    this.myPanel.innerHTML = `
      <div class="tetris-header">
        <span class="player-label">ME</span>
      </div>
      <div class="tetris-main">
        <div class="tetris-side left">
          <div class="tetris-hold">
            <div class="side-label">HOLD</div>
            <canvas class="hold-canvas" width="100" height="80"></canvas>
          </div>
        </div>
        <canvas class="tetris-board-canvas"></canvas>
        <div class="tetris-side right">
          <div class="tetris-next">
            <div class="side-label">NEXT</div>
            <canvas class="next-canvas" width="100" height="320"></canvas>
          </div>
        </div>
      </div>
      <div class="tetris-stats">
        <div class="stat"><span class="stat-label">SCORE</span><span class="stat-value my-score">0</span></div>
        <div class="stat"><span class="stat-label">LEVEL</span><span class="stat-value my-level">1</span></div>
        <div class="stat"><span class="stat-label">LINES</span><span class="stat-value my-lines">0</span></div>
      </div>
      <div class="tetris-garbage">
        <div class="garbage-label">INCOMING GARBAGE</div>
        <div class="garbage-bar"><div class="garbage-fill my-garbage"></div></div>
      </div>
    `;
    
    // 상대방 패널
    this.opponentPanel = document.createElement('div');
    this.opponentPanel.className = 'tetris-panel opponent-panel';
    this.opponentPanel.innerHTML = `
      <div class="tetris-header">
        <span class="player-label">OPPONENT</span>
      </div>
      <div class="tetris-main mini">
        <canvas class="tetris-board-canvas mini"></canvas>
      </div>
      <div class="tetris-stats">
        <div class="stat"><span class="stat-label">SCORE</span><span class="stat-value opp-score">0</span></div>
        <div class="stat"><span class="stat-label">LEVEL</span><span class="stat-value opp-level">1</span></div>
        <div class="stat"><span class="stat-label">LINES</span><span class="stat-value opp-lines">0</span></div>
      </div>
    `;
    
    this.wrapper.appendChild(this.myPanel);
    this.wrapper.appendChild(this.opponentPanel);
    
    this.container.innerHTML = '';
    this.container.appendChild(this.wrapper);
    
    // 캔버스 설정
    this.myCanvas = this.myPanel.querySelector('.tetris-board-canvas');
    this.myCanvas.width = TETRIS_BOARD_WIDTH * this.cellSize;
    this.myCanvas.height = TETRIS_BOARD_HEIGHT * this.cellSize;
    this.myCtx = this.myCanvas.getContext('2d');
    
    this.opponentCanvas = this.opponentPanel.querySelector('.tetris-board-canvas');
    this.opponentCanvas.width = TETRIS_BOARD_WIDTH * this.miniCellSize;
    this.opponentCanvas.height = TETRIS_BOARD_HEIGHT * this.miniCellSize;
    this.opponentCtx = this.opponentCanvas.getContext('2d');
    
    this.holdCanvas = this.myPanel.querySelector('.hold-canvas');
    this.holdCtx = this.holdCanvas.getContext('2d');

    this.nextCanvas = this.myPanel.querySelector('.next-canvas');
    this.nextCtx = this.nextCanvas.getContext('2d');

    // 가비지 바 초기화
    const garbageFill = this.myPanel.querySelector('.my-garbage');
    if (garbageFill) {
      garbageFill.style.width = '0%';
    }

    // 시작 모달 생성
    this.createStartModal();
  }
  
  createStartModal() {
    // Early return: 이미 모달이 있으면 재생성하지 않음
    if (this.startModal) return;
    this.startModal = document.createElement('div');
    this.startModal.className = 'tetris-start-modal';
    this.startModal.innerHTML = `
      <div class="start-content">
        <h2>🎮 TETRIS</h2>
        <p class="start-message">조작법을 확인하고 준비 버튼을 누르세요</p>
        <div class="ready-status">
          <span class="ready-indicator">나: <span id="myReadyStatus">❌</span></span>
          <span class="ready-indicator">상대: <span id="opponentReadyStatus">❌</span></span>
        </div>
        <button class="ready-btn">준비완료</button>
        <div class="controls-info">
          <div class="control-row"><span class="key">←→</span> 이동</div>
          <div class="control-row"><span class="key">↑</span> 시계방향 회전</div>
          <div class="control-row"><span class="key">Z</span> 반시계방향 회전</div>
          <div class="control-row"><span class="key">↓</span> 소프트 드롭</div>
          <div class="control-row"><span class="key">Space</span> 하드 드롭</div>
          <div class="control-row"><span class="key">C</span> 홀드</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.startModal);

    this.startModal.querySelector('.ready-btn').addEventListener('click', () => {
      this.handleReadyClick();
    });
  }
  
  onConnectionEstablished() {
    // WebRTC 연결 완료 시 호출됨
    // 준비 모달 표시
    this.showStartModal();
  }

  handleReadyClick() {
    // Early return: 이미 준비된 경우
    if (this.isReady) return;

    this.isReady = true;
    this.updateReadyStatus();

    // 상대에게 준비 메시지 전송
    this.onMove({
      tetrisType: 'ready',
      ready: true
    });

    // 양쪽 모두 준비되었는지 확인
    this.checkBothReady();
  }

  updateReadyStatus() {
    if (!this.startModal) return;

    const myStatus = this.startModal.querySelector('#myReadyStatus');
    const opponentStatus = this.startModal.querySelector('#opponentReadyStatus');

    if (myStatus) myStatus.textContent = this.isReady ? '✅' : '❌';
    if (opponentStatus) opponentStatus.textContent = this.opponentReady ? '✅' : '❌';

    // 버튼 업데이트
    const readyBtn = this.startModal.querySelector('.ready-btn');
    if (readyBtn) {
      readyBtn.disabled = this.isReady;
      readyBtn.textContent = this.isReady ? '준비 완료!' : '준비완료';
    }
  }

  checkBothReady() {
    // 조건을 변수로 추출하여 가독성 향상
    const bothPlayersReady = this.isReady && this.opponentReady;
    const canStartGame = bothPlayersReady && !this.gameStarted;
    const isHost = this.game.myColor === 'player1';

    // Early return: 게임 시작 조건 불충족
    if (!canStartGame) return;

    // Host만 게임 시작 트리거 (Client는 start 메시지를 기다림)
    if (isHost) {
      setTimeout(() => {
        this.startGame();
      }, 500); // 시각적 피드백을 위한 약간의 지연
    }
  }

  startGame() {
    // Early return: 중복 호출 방지
    if (this.gameStarted) return;

    this.gameStarted = true;
    const seed = Date.now();

    this.game.initialize(seed);

    // Client에게 시작 메시지 전송
    this.onMove({
      tetrisType: 'start',
      seed: seed,
      gameOver: false
    });

    this.hideStartModal();
    this.startGameLoop();
  }
  
  showStartModal() {
    if (this.startModal) {
      this.startModal.classList.add('active');
      this.startModal.style.display = 'flex';
    }
  }

  hideStartModal() {
    if (this.startModal) {
      this.startModal.classList.remove('active');
      // 확실하게 숨기기 위해 display도 직접 설정
      this.startModal.style.display = 'none';
    }
  }
  
  setupEventListeners() {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }
  
  handleKeyDown(e) {
    // Early return: 게임이 시작되지 않았거나 게임 오버 상태
    if (!this.game.isStarted || this.game.gameOver) return;

    // Early return: 중복 키 방지
    if (this.keyState[e.code]) return;

    this.keyState[e.code] = true;
    
    switch (e.code) {
      case 'ArrowLeft':
        this.game.move(-1, 0);
        this.startKeyRepeat('ArrowLeft', () => this.game.move(-1, 0));
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.game.move(1, 0);
        this.startKeyRepeat('ArrowRight', () => this.game.move(1, 0));
        e.preventDefault();
        break;
      case 'ArrowDown':
        this.game.softDrop();
        this.startKeyRepeat('ArrowDown', () => this.game.softDrop(), 50);
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.game.rotate(1);
        e.preventDefault();
        break;
      case 'KeyZ':
        this.game.rotate(-1);
        e.preventDefault();
        break;
      case 'KeyX':
        this.game.rotate(1);
        e.preventDefault();
        break;
      case 'Space':
        this.handleHardDrop();
        e.preventDefault();
        break;
      case 'KeyC':
      case 'ShiftLeft':
        this.game.hold();
        e.preventDefault();
        break;
    }
  }
  
  handleKeyUp(e) {
    this.keyState[e.code] = false;
    this.stopKeyRepeat(e.code);
  }
  
  startKeyRepeat(key, action, delay = null) {
    this.stopKeyRepeat(key);
    
    const dasDelay = delay || this.das;
    const arrDelay = delay || this.arr;
    
    this.keyTimers[key] = setTimeout(() => {
      this.keyTimers[key + '_interval'] = setInterval(() => {
        if (this.keyState[key]) {
          action();
        }
      }, arrDelay);
    }, dasDelay);
  }
  
  stopKeyRepeat(key) {
    if (this.keyTimers[key]) {
      clearTimeout(this.keyTimers[key]);
      delete this.keyTimers[key];
    }
    if (this.keyTimers[key + '_interval']) {
      clearInterval(this.keyTimers[key + '_interval']);
      delete this.keyTimers[key + '_interval'];
    }
  }
  
  handleHardDrop() {
    const result = this.game.hardDrop();

    // Early return: 결과가 없으면 종료
    if (!result) return;

    if (result.type === 'gameOver') {
      this.handleGameOver();
      return;
    }

    if (result.attack > 0) {
      this.sendAttack(result.attack);
    }
  }
  
  sendAttack(lines) {
    this.onMove({
      tetrisType: 'attack',
      attack: lines,
      gameOver: false
    });
  }
  
  sendState() {
    this.onMove({
      tetrisType: 'state',
      opponentState: this.game.getStateForOpponent(),
      gameOver: this.game.gameOver
    });
  }
  
  handleGameOver() {
    this.stopGameLoop();
    this.onMove({
      tetrisType: 'gameOver',
      gameOver: true,
      winner: this.game.myColor === 'player1' ? 'player2' : 'player1',
      reason: 'block_out'
    });
  }
  
  stopGameLoop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  gameLoop(currentTime) {
    if (!this.isRunning) return;
    
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // 자동 낙하
    if (this.game.isStarted && !this.game.gameOver) {
      this.dropAccumulator += deltaTime;
      const gravity = this.game.getGravity();
      
      while (this.dropAccumulator >= gravity) {
        this.dropAccumulator -= gravity;
        if (!this.game.softDrop()) {
          // 바닥에 닿음 - 락 딜레이 후 고정
          this.dropAccumulator = 0;
          const result = this.game.lockPiece();
          if (result) {
            if (result.type === 'gameOver') {
              this.handleGameOver();
              return;
            } else if (result.attack > 0) {
              this.sendAttack(result.attack);
            }
          }
        }
      }
    }
    
    this.render();
    this.animationId = requestAnimationFrame(this.gameLoop);
  }
  
  render() {
    this.renderMyBoard();
    this.renderOpponentBoard();
    this.renderHold();
    this.renderNext();
    this.updateStats();
  }
  
  renderMyBoard() {
    const ctx = this.myCtx;
    const cellSize = this.cellSize;
    
    // 배경
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.myCanvas.width, this.myCanvas.height);
    
    // 격자
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 1;
    for (let x = 0; x <= TETRIS_BOARD_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, this.myCanvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= TETRIS_BOARD_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(this.myCanvas.width, y * cellSize);
      ctx.stroke();
    }
    
    // 보드 블록
    for (let y = TETRIS_BUFFER_HEIGHT; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT; y++) {
      for (let x = 0; x < TETRIS_BOARD_WIDTH; x++) {
        const cell = this.game.board[y][x];
        if (cell) {
          this.drawBlock(ctx, x, y - TETRIS_BUFFER_HEIGHT, cell, cellSize);
        }
      }
    }
    
    // 고스트 피스 + 현재 피스 (조건 통합)
    if (this.game.currentType && !this.game.gameOver) {
      const shape = this.game.getShape();
      const color = TETROMINOS[this.game.currentType].color;
      const ghostY = this.game.getGhostY();

      // 고스트 피스 렌더링
      ctx.globalAlpha = 0.3;
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            const bx = this.game.position.x + px;
            const by = ghostY + py - TETRIS_BUFFER_HEIGHT;
            if (by >= 0) this.drawBlock(ctx, bx, by, color, cellSize);
          }
        }
      }

      // 현재 피스 렌더링
      ctx.globalAlpha = 1;
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            const bx = this.game.position.x + px;
            const by = this.game.position.y + py - TETRIS_BUFFER_HEIGHT;
            if (by >= 0) this.drawBlock(ctx, bx, by, color, cellSize);
          }
        }
      }
    }
    
    // 가비지 경고 바
    if (this.game.pendingGarbage > 0) {
      ctx.fillStyle = '#ff4444';
      const garbageHeight = (this.game.pendingGarbage / 20) * this.myCanvas.height;
      ctx.fillRect(this.myCanvas.width - 6, this.myCanvas.height - garbageHeight, 4, garbageHeight);
    }
  }
  
  renderOpponentBoard() {
    const ctx = this.opponentCtx;
    const cellSize = this.miniCellSize;
    
    // 배경
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, this.opponentCanvas.width, this.opponentCanvas.height);
    
    // 상대방 상태가 없으면 빈 보드
    if (!this.game.opponentState) return;
    
    const board = this.game.opponentState.board;
    if (!board) return;
    
    // 보드 블록
    for (let y = TETRIS_BUFFER_HEIGHT; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT; y++) {
      for (let x = 0; x < TETRIS_BOARD_WIDTH; x++) {
        const cell = board[y]?.[x];
        if (cell) {
          this.drawBlock(ctx, x, y - TETRIS_BUFFER_HEIGHT, cell, cellSize);
        }
      }
    }
    
    // 게임 오버 표시
    if (this.game.opponentState.gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, this.opponentCanvas.width, this.opponentCanvas.height);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.opponentCanvas.width / 2, this.opponentCanvas.height / 2);
    }
  }
  
  renderHold() {
    const ctx = this.holdCtx;
    ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
    
    if (!this.game.holdPiece) return;
    
    const shape = TETROMINOS[this.game.holdPiece].shapes[0];
    const color = this.game.canHold ? TETROMINOS[this.game.holdPiece].color : '#555';
    const miniSize = 18;
    
    const offsetX = (this.holdCanvas.width - shape[0].length * miniSize) / 2;
    const offsetY = (this.holdCanvas.height - shape.length * miniSize) / 2;
    
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          ctx.fillStyle = color;
          ctx.fillRect(offsetX + px * miniSize, offsetY + py * miniSize, miniSize - 1, miniSize - 1);
        }
      }
    }
  }
  
  renderNext() {
    const ctx = this.nextCtx;
    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
    
    const nextPieces = this.game.getNextPieces(5);
    const miniSize = 16;
    let yOffset = 10;
    
    for (const pieceType of nextPieces) {
      const shape = TETROMINOS[pieceType].shapes[0];
      const color = TETROMINOS[pieceType].color;
      const offsetX = (this.nextCanvas.width - shape[0].length * miniSize) / 2;
      
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            ctx.fillStyle = color;
            ctx.fillRect(offsetX + px * miniSize, yOffset + py * miniSize, miniSize - 1, miniSize - 1);
          }
        }
      }
      
      yOffset += shape.length * miniSize + 10;
    }
  }
  
  drawBlock(ctx, x, y, color, size) {
    // 메인 색상
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    
    // 하이라이트 (위, 왼쪽)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 2);
    ctx.fillRect(x * size + 1, y * size + 1, 2, size - 2);
    
    // 그림자 (아래, 오른쪽)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x * size + 1, y * size + size - 3, size - 2, 2);
    ctx.fillRect(x * size + size - 3, y * size + 1, 2, size - 2);
  }
  
  updateStats() {
    // 내 통계
    this.myPanel.querySelector('.my-score').textContent = this.game.score.toLocaleString();
    this.myPanel.querySelector('.my-level').textContent = this.game.level;
    this.myPanel.querySelector('.my-lines').textContent = this.game.lines;

    // 가비지 바 (왼쪽에서 오른쪽으로 채움)
    const garbageFill = this.myPanel.querySelector('.my-garbage');
    const garbagePercent = (this.game.pendingGarbage / 20) * 100;
    garbageFill.style.width = garbagePercent + '%';

    // 상대방 통계
    if (this.game.opponentState) {
      this.opponentPanel.querySelector('.opp-score').textContent = (this.game.opponentState.score || 0).toLocaleString();
      this.opponentPanel.querySelector('.opp-level').textContent = this.game.opponentState.level || 1;
      this.opponentPanel.querySelector('.opp-lines').textContent = this.game.opponentState.lines || 0;
    }
  }
  
  updateFromMove(moveData) {
    // 준비 상태 메시지
    if (moveData.tetrisType === 'ready') {
      this.opponentReady = moveData.ready;
      this.updateReadyStatus();
      this.checkBothReady();
      return;
    }

    // 게임 시작 메시지 (client가 host로부터 받음)
    if (moveData.tetrisType === 'start') {
      // gameStarted 체크 제거 - 항상 처리
      this.gameStarted = true;
      this.game.initialize(moveData.seed);
      this.hideStartModal();
      this.startGameLoop();
      return;
    }

    // 일반 상태 업데이트
    this.game.applyMove(moveData);
    
    // 상대방 게임 오버 시 내가 승리
    if (moveData.tetrisType === 'gameOver' || moveData.gameOver) {
      if (!this.game.gameOver) {
        // 나는 아직 살아있음 = 승리
        this.stopGameLoop();
        this.onMove({
          gameOver: true,
          winner: this.game.myColor,
          reason: 'opponent_out'
        });
      }
    }
    
    this.render();
  }
  
  /**
   * 준비 상태 초기화 (새게임용)
   */
  resetReadyState() {
    this.isReady = false;
    this.opponentReady = false;
    this.gameStarted = false;
    if (this.startModal) {
      this.startModal.remove();
      this.startModal = null;
    }
  }

  cleanup() {
    this.stopGameLoop();
    this.resetReadyState();
    this.stopAI();
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);

    // 턴 기반 UI 요소 복원 및 풀스크린 모드 해제 (다른 게임으로 전환 시)
    document.querySelector('.container').classList.remove('tetris-active');
    document.querySelector('.container').classList.remove('tetris-fullscreen');
    document.body.classList.remove('tetris-mode');

    // 모든 키 타이머 정리
    for (const key in this.keyTimers) {
      if (key.endsWith('_interval')) {
        clearInterval(this.keyTimers[key]);
      } else {
        clearTimeout(this.keyTimers[key]);
      }
    }

    if (this.modeModal) {
      this.modeModal.remove();
      this.modeModal = null;
    }

    if (this.wrapper) {
      this.wrapper.remove();
    }
  }

  // ============== 싱글플레이어 모드 관련 메서드 ==============

  /**
   * 모드 선택 화면 표시 (싱글플레이어 전용)
   * @param {Function} onModeSelected - 모드 선택 콜백 (mode: 'record' | 'ai')
   */
  showModeSelection(onModeSelected) {
    this.createModeModal(onModeSelected);
  }

  /**
   * 모드 선택 모달 생성
   */
  createModeModal(onModeSelected) {
    if (this.modeModal) {
      this.modeModal.remove();
    }

    const highScore = TetrisGame.loadHighScore();

    this.modeModal = document.createElement('div');
    this.modeModal.className = 'tetris-mode-modal active';
    this.modeModal.innerHTML = `
      <div class="mode-content">
        <h2>🧱 TETRIS</h2>
        <p class="mode-message">플레이 모드를 선택하세요</p>
        <div class="tetris-mode-buttons">
          <button class="tetris-mode-btn" data-mode="record">
            <span class="mode-icon">🏆</span>
            <span class="mode-title">기록 모드</span>
            <span class="mode-desc">최고 기록에 도전하세요</span>
            <span class="mode-highscore">최고: ${highScore.score.toLocaleString()}점</span>
          </button>
          <button class="tetris-mode-btn" data-mode="ai">
            <span class="mode-icon">🤖</span>
            <span class="mode-title">AI 대전</span>
            <span class="mode-desc">AI와 1:1 대결</span>
          </button>
        </div>
        <div class="controls-info">
          <div class="control-row"><span class="key">←→</span> 이동</div>
          <div class="control-row"><span class="key">↑</span> 시계방향 회전</div>
          <div class="control-row"><span class="key">Z</span> 반시계방향 회전</div>
          <div class="control-row"><span class="key">↓</span> 소프트 드롭</div>
          <div class="control-row"><span class="key">Space</span> 하드 드롭</div>
          <div class="control-row"><span class="key">C</span> 홀드</div>
        </div>
      </div>
    `;
    document.body.appendChild(this.modeModal);

    // 모드 버튼 클릭 이벤트
    this.modeModal.querySelectorAll('.tetris-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.hideModeModal();
        onModeSelected(mode);
      });
    });
  }

  /**
   * 모드 선택 모달 숨기기
   */
  hideModeModal() {
    if (this.modeModal) {
      this.modeModal.classList.remove('active');
      this.modeModal.style.display = 'none';
    }
  }

  /**
   * 기록 모드 시작
   */
  startRecordMode() {
    this.singlePlayerMode = 'record';

    // UI 재구성 (상대 패널 숨김)
    this.wrapper.classList.add('record-mode');
    if (this.opponentPanel) {
      this.opponentPanel.style.display = 'none';
    }

    // 가비지 바 숨기기 (솔로 플레이에서는 불필요)
    const garbageSection = this.myPanel.querySelector('.tetris-garbage');
    if (garbageSection) {
      garbageSection.style.display = 'none';
    }

    // 최고 기록 표시 추가
    this.addHighScoreDisplay();

    // 게임 시작
    const seed = Date.now();
    this.game.initialize(seed);
    this.gameStarted = true;
    this.startGameLoop();
  }

  /**
   * 최고 기록 표시 추가
   */
  addHighScoreDisplay() {
    const highScore = TetrisGame.loadHighScore();
    const statsSection = this.myPanel.querySelector('.tetris-stats');

    // 이미 있으면 제거
    const existing = statsSection.querySelector('.best-stat');
    if (existing) existing.remove();

    const bestStat = document.createElement('div');
    bestStat.className = 'stat best-stat';
    bestStat.innerHTML = `
      <span class="stat-label">BEST</span>
      <span class="stat-value best-score">${highScore.score.toLocaleString()}</span>
    `;
    statsSection.appendChild(bestStat);
  }

  /**
   * AI 대전 모드 시작
   * @param {TetrisAI} ai - TetrisAI 인스턴스
   */
  startAIMode(ai) {
    this.singlePlayerMode = 'ai';
    this.ai = ai;

    // 상대 패널 라벨 변경
    const opponentLabel = this.opponentPanel.querySelector('.player-label');
    if (opponentLabel) {
      opponentLabel.textContent = 'AI';
    }

    // 동일 시드로 양쪽 게임 시작
    const seed = Date.now();

    // 플레이어 게임 초기화
    this.game.initialize(seed);

    // AI 게임 초기화 및 콜백 설정
    this.ai.onAttack = (lines) => {
      // AI가 공격하면 플레이어가 가비지 수신
      this.game.receiveGarbage(lines);
    };

    this.ai.onStateUpdate = (state) => {
      // AI 상태를 상대방 상태로 설정
      this.game.opponentState = state;
    };

    this.ai.onGameOver = () => {
      // AI 게임 오버 = 플레이어 승리
      this.game.opponentState = { ...this.game.opponentState, gameOver: true };
      this.handleSinglePlayerGameOver(true);
    };

    this.ai.initialize(seed);

    // AI 상태 동기화 시작
    this.startAISyncLoop();

    this.gameStarted = true;
    this.startGameLoop();
  }

  /**
   * AI 상태 동기화 루프
   */
  startAISyncLoop() {
    this.aiSyncInterval = setInterval(() => {
      if (this.ai && !this.ai.game.gameOver) {
        this.game.opponentState = this.ai.getStateForPlayer();
      }
    }, 100);
  }

  /**
   * AI 중지
   */
  stopAI() {
    if (this.ai) {
      this.ai.stop();
      this.ai = null;
    }
    if (this.aiSyncInterval) {
      clearInterval(this.aiSyncInterval);
      this.aiSyncInterval = null;
    }
  }

  /**
   * 싱글플레이어 하드 드롭 처리 (오버라이드)
   */
  handleHardDropSinglePlayer() {
    const result = this.game.hardDrop();
    if (!result) return;

    if (result.type === 'gameOver') {
      this.handleSinglePlayerGameOver(false);
      return;
    }

    // AI 모드에서 공격 처리
    if (this.singlePlayerMode === 'ai' && result.attack > 0 && this.ai) {
      this.ai.receiveGarbage(result.attack);
    }
  }

  /**
   * 싱글플레이어 게임 오버 처리
   * @param {boolean} isWin - 승리 여부
   */
  handleSinglePlayerGameOver(isWin) {
    this.stopGameLoop();
    this.stopAI();

    // 기록 모드: 최고 기록 저장
    if (this.singlePlayerMode === 'record') {
      const isNewRecord = this.game.saveHighScore();

      // 신기록 달성 시 BEST 표시 업데이트
      if (isNewRecord) {
        this.updateHighScoreDisplay();
      }

      this.onMove({
        gameOver: true,
        winner: 'none',
        reason: isNewRecord ? 'new_record' : 'block_out',
        isNewRecord: isNewRecord,
        score: this.game.score
      });
    } else {
      // AI 모드
      this.onMove({
        gameOver: true,
        winner: isWin ? this.game.myColor : 'ai',
        reason: isWin ? 'opponent_out' : 'block_out'
      });
    }
  }

  /**
   * 최고 기록 표시 업데이트
   */
  updateHighScoreDisplay() {
    const highScore = TetrisGame.loadHighScore();
    const bestScoreEl = this.myPanel.querySelector('.best-score');
    if (bestScoreEl) {
      bestScoreEl.textContent = highScore.score.toLocaleString();
      bestScoreEl.classList.add('new-record');
    }
  }

  /**
   * 싱글플레이어 게임 재시작
   * @param {TetrisAI} [ai] - AI 대전 모드일 경우 AI 인스턴스
   */
  restartSinglePlayer(ai = null) {
    // 기존 게임 루프 및 AI 정지
    this.stopGameLoop();
    this.stopAI();

    // 게임 상태 리셋
    this.game.gameOver = false;
    this.gameStarted = false;

    // new-record 클래스 제거
    const bestScoreEl = this.myPanel.querySelector('.best-score');
    if (bestScoreEl) {
      bestScoreEl.classList.remove('new-record');
    }

    // 키 상태 초기화
    this.keyState = {};

    if (this.singlePlayerMode === 'record') {
      // 기록 모드: 최고 기록 표시 업데이트
      this.addHighScoreDisplay();

      // 게임 재시작
      const seed = Date.now();
      this.game.initialize(seed);
      this.gameStarted = true;
      this.startGameLoop();
    } else if (this.singlePlayerMode === 'ai' && ai) {
      // AI 대전 모드
      this.ai = ai;

      const seed = Date.now();
      this.game.initialize(seed);

      // AI 콜백 재설정
      this.ai.onAttack = (lines) => {
        this.game.receiveGarbage(lines);
      };

      this.ai.onStateUpdate = (state) => {
        this.game.opponentState = state;
      };

      this.ai.onGameOver = () => {
        this.game.opponentState = { ...this.game.opponentState, gameOver: true };
        this.handleSinglePlayerGameOver(true);
      };

      this.ai.initialize(seed);
      this.startAISyncLoop();

      this.gameStarted = true;
      this.startGameLoop();
    }
  }

  /**
   * 싱글플레이어 게임 루프 (락 피스 처리 수정)
   */
  singlePlayerGameLoop(currentTime) {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // 자동 낙하
    if (this.game.isStarted && !this.game.gameOver) {
      this.dropAccumulator += deltaTime;
      const gravity = this.game.getGravity();

      while (this.dropAccumulator >= gravity) {
        this.dropAccumulator -= gravity;
        if (!this.game.softDrop()) {
          // 바닥에 닿음 - 락 딜레이 후 고정
          this.dropAccumulator = 0;
          const result = this.game.lockPiece();
          if (result) {
            if (result.type === 'gameOver') {
              this.handleSinglePlayerGameOver(false);
              return;
            } else if (result.attack > 0 && this.singlePlayerMode === 'ai' && this.ai) {
              this.ai.receiveGarbage(result.attack);
            }
          }
        }
      }
    }

    this.render();
    this.animationId = requestAnimationFrame(this.singlePlayerMode ? this.singlePlayerGameLoop.bind(this) : this.gameLoop);
  }

  /**
   * 싱글플레이어용 게임 루프 시작
   */
  startGameLoopSinglePlayer() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.dropAccumulator = 0;
    this.animationId = requestAnimationFrame(this.singlePlayerGameLoop.bind(this));
  }

  /**
   * 싱글플레이어 키 다운 핸들러 (오버라이드)
   */
  handleKeyDownSinglePlayer(e) {
    if (!this.game.isStarted || this.game.gameOver) return;
    if (this.keyState[e.code]) return;

    this.keyState[e.code] = true;

    switch (e.code) {
      case 'ArrowLeft':
        this.game.move(-1, 0);
        this.startKeyRepeat('ArrowLeft', () => this.game.move(-1, 0));
        e.preventDefault();
        break;
      case 'ArrowRight':
        this.game.move(1, 0);
        this.startKeyRepeat('ArrowRight', () => this.game.move(1, 0));
        e.preventDefault();
        break;
      case 'ArrowDown':
        this.game.softDrop();
        this.startKeyRepeat('ArrowDown', () => this.game.softDrop(), 50);
        e.preventDefault();
        break;
      case 'ArrowUp':
        this.game.rotate(1);
        e.preventDefault();
        break;
      case 'KeyZ':
        this.game.rotate(-1);
        e.preventDefault();
        break;
      case 'KeyX':
        this.game.rotate(1);
        e.preventDefault();
        break;
      case 'Space':
        this.handleHardDropSinglePlayer();
        e.preventDefault();
        break;
      case 'KeyC':
      case 'ShiftLeft':
        this.game.hold();
        e.preventDefault();
        break;
    }
  }

  /**
   * 싱글플레이어 이벤트 리스너 설정
   */
  setupSinglePlayerEventListeners() {
    // 기존 리스너 제거 (initialize()에서 설정된 멀티플레이 리스너)
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);

    // 싱글플레이어용 핸들러로 교체
    this.handleKeyDown = this.handleKeyDownSinglePlayer.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * 싱글플레이어 게임 루프 시작 (startGameLoop 대체)
   */
  startGameLoop() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.dropAccumulator = 0;

    if (this.singlePlayerMode) {
      this.animationId = requestAnimationFrame(this.singlePlayerGameLoop.bind(this));
    } else {
      this.animationId = requestAnimationFrame(this.gameLoop);
      // 멀티플레이어용 상태 동기화
      this.syncInterval = setInterval(() => {
        this.sendState();
      }, this.syncRate);
    }
  }
}

window.TetrisRenderer = TetrisRenderer;
