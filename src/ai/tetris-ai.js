/**
 * Tetris AI - 실시간 테트리스 AI (개선판)
 *
 * 주요 기능:
 * - Hold 피스 활용
 * - 다중 라인 클리어 빌드업
 * - Tetris (4줄) 셋업
 * - T-Spin 인식 (Hard 난이도)
 */

class TetrisAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.game = new TetrisGame();
    this.moveInterval = null;
    this.gravityInterval = null;
    this.isRunning = false;

    // 현재 목표 배치
    this.targetPlacement = null;

    // 난이도별 설정
    this.settings = {
      easy: { moveDelay: 400, gravityMultiplier: 1.5, errorRate: 0.2, useHold: false },
      medium: { moveDelay: 200, gravityMultiplier: 1.0, errorRate: 0.08, useHold: true },
      hard: { moveDelay: 100, gravityMultiplier: 0.7, errorRate: 0.02, useHold: true }
    };

    // 평가 가중치 (난이도별) - 개선된 버전
    this.weights = {
      easy: {
        height: -3,
        holes: -6,
        bumpiness: -1,
        linesCleared: [0, 50, 80, 100, 150],
        wellColumn: 9,
        wellBonus: 0,
        tetrisReady: 0,
        tSpinSetup: 0,
        tSpinClear: [0, 0, 0, 0]
      },
      medium: {
        height: -4,
        holes: -10,
        bumpiness: -2,
        linesCleared: [0, 40, 120, 250, 500],
        wellColumn: 9,
        wellBonus: 20,
        tetrisReady: 50,
        tSpinSetup: 0,
        tSpinClear: [0, 0, 0, 0]
      },
      hard: {
        height: -5,
        holes: -15,
        bumpiness: -2,
        linesCleared: [0, 30, 150, 350, 800],
        wellColumn: 9,
        wellBonus: 40,
        tetrisReady: 120,
        tSpinSetup: 80,
        tSpinClear: [0, 200, 400, 600]
      }
    };

    // 콜백 함수
    this.onAttack = null;
    this.onStateUpdate = null;
    this.onGameOver = null;
  }

  /**
   * AI 게임 초기화
   */
  initialize(seed) {
    this.game.initialize(seed);
    this.isRunning = true;
    this.targetPlacement = null;
    this.startAILoop();
    this.startGravityLoop();
  }

  /**
   * AI 게임 루프 시작 (의사결정)
   */
  startAILoop() {
    const { moveDelay } = this.settings[this.difficulty];

    this.moveInterval = setInterval(() => {
      if (!this.isRunning || this.game.gameOver) {
        this.stop();
        return;
      }

      this.makeMove();
    }, moveDelay);
  }

  /**
   * 중력 루프 (블록 자동 낙하)
   */
  startGravityLoop() {
    const { gravityMultiplier } = this.settings[this.difficulty];

    const gravityLoop = () => {
      if (!this.isRunning || this.game.gameOver) {
        this.stop();
        return;
      }

      const baseGravity = this.game.getGravity();
      const adjustedGravity = baseGravity * gravityMultiplier;

      // 자동 낙하
      if (!this.game.softDrop()) {
        // 바닥에 도달 - 블록 고정
        const result = this.game.lockPiece();
        if (result) {
          if (result.type === 'gameOver') {
            this.handleGameOver();
            return;
          }
          if (result.attack > 0 && this.onAttack) {
            this.onAttack(result.attack);
          }
        }
        // 새 피스 스폰 후 목표 재계산
        this.targetPlacement = null;
      }

      // 상태 업데이트
      if (this.onStateUpdate) {
        this.onStateUpdate(this.getStateForPlayer());
      }

      if (this.isRunning) {
        this.gravityTimeout = setTimeout(gravityLoop, adjustedGravity);
      }
    };

    const baseGravity = this.game.getGravity();
    this.gravityTimeout = setTimeout(gravityLoop, baseGravity * this.settings[this.difficulty].gravityMultiplier);
  }

  /**
   * AI 이동 결정 및 실행
   */
  makeMove() {
    if (!this.game.currentType || this.game.gameOver) return;

    // 에러율 적용 (난이도별 실수)
    const { errorRate } = this.settings[this.difficulty];
    if (Math.random() < errorRate) {
      this.makeRandomMove();
      return;
    }

    // 목표 배치가 없으면 새로 계산
    if (!this.targetPlacement) {
      this.targetPlacement = this.findBestPlacement();
    }

    if (!this.targetPlacement) return;

    // 배치 실행
    this.executeStep(this.targetPlacement);
  }

  /**
   * 랜덤 이동 (AI 실수 시뮬레이션)
   */
  makeRandomMove() {
    const actions = ['left', 'right', 'rotate', 'nothing'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    switch (action) {
      case 'left':
        this.game.move(-1, 0);
        break;
      case 'right':
        this.game.move(1, 0);
        break;
      case 'rotate':
        this.game.rotate(1);
        break;
    }
  }

  /**
   * 최적 배치 찾기 (Hold 포함)
   */
  findBestPlacement() {
    const currentType = this.game.currentType;
    if (!currentType) return null;

    const { useHold } = this.settings[this.difficulty];
    let bestPlacement = null;
    let bestScore = -Infinity;

    // 1. 현재 피스로 가능한 배치들 평가
    const currentPlacements = this.findPlacementsForPiece(currentType, false);
    for (const p of currentPlacements) {
      if (p.score > bestScore) {
        bestScore = p.score;
        bestPlacement = p;
      }
    }

    // 2. Hold 피스로 가능한 배치들 평가 (Medium, Hard만)
    if (useHold && this.game.canHold) {
      const holdPiece = this.game.holdPiece || this.game.randomizer.peek(1)[0];
      const holdPlacements = this.findPlacementsForPiece(holdPiece, true);

      for (const p of holdPlacements) {
        if (p.score > bestScore) {
          bestScore = p.score;
          bestPlacement = p;
        }
      }
    }

    return bestPlacement;
  }

  /**
   * 특정 피스로 가능한 모든 배치 찾기
   */
  findPlacementsForPiece(pieceType, needsHold) {
    const placements = [];

    // 모든 회전 상태에 대해
    for (let rotation = 0; rotation < 4; rotation++) {
      // 모든 x 위치에 대해
      for (let x = -2; x < TETRIS_BOARD_WIDTH + 2; x++) {
        const result = this.simulatePlacement(pieceType, rotation, x);
        if (!result) continue;

        const score = this.evaluatePlacement(
          result.board,
          result.linesCleared,
          pieceType,
          result.isTSpin
        );

        placements.push({
          rotation,
          x: result.finalX,
          y: result.finalY,
          score,
          needsHold,
          pieceType,
          linesCleared: result.linesCleared,
          isTSpin: result.isTSpin
        });
      }
    }

    return placements;
  }

  /**
   * 배치 시뮬레이션
   */
  simulatePlacement(pieceType, targetRotation, targetX) {
    // 보드 복사
    const boardCopy = this.game.board.map(row => [...row]);
    const shape = TETROMINOS[pieceType].shapes[targetRotation];

    // Y 위치 계산 (하드 드롭)
    let finalY = TETRIS_BUFFER_HEIGHT - 2;

    // 해당 위치에 배치 가능한지 확인
    const canPlace = (board, shape, x, y) => {
      for (let py = 0; py < shape.length; py++) {
        for (let px = 0; px < shape[py].length; px++) {
          if (shape[py][px]) {
            const bx = x + px;
            const by = y + py;
            if (bx < 0 || bx >= TETRIS_BOARD_WIDTH || by >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) {
              return false;
            }
            if (by >= 0 && board[by][bx]) {
              return false;
            }
          }
        }
      }
      return true;
    };

    // 초기 위치 체크
    if (!canPlace(boardCopy, shape, targetX, finalY)) {
      return null;
    }

    // 하드 드롭 시뮬레이션
    while (canPlace(boardCopy, shape, targetX, finalY + 1)) {
      finalY++;
    }

    // 블록 배치
    const color = TETROMINOS[pieceType].color;
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const bx = targetX + px;
          const by = finalY + py;
          if (by >= 0 && by < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) {
            boardCopy[by][bx] = color;
          }
        }
      }
    }

    // T-Spin 감지 (T 피스만)
    let isTSpin = false;
    if (pieceType === 'T') {
      isTSpin = this.detectTSpinInSimulation(boardCopy, targetX, finalY);
    }

    // 라인 클리어 시뮬레이션
    let linesCleared = 0;
    for (let y = TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT - 1; y >= 0; y--) {
      if (boardCopy[y].every(cell => cell !== null)) {
        boardCopy.splice(y, 1);
        boardCopy.unshift(Array(TETRIS_BOARD_WIDTH).fill(null));
        linesCleared++;
        y++;
      }
    }

    return { board: boardCopy, finalX: targetX, finalY, linesCleared, isTSpin };
  }

  /**
   * 시뮬레이션에서 T-Spin 감지
   */
  detectTSpinInSimulation(board, x, y) {
    // T 피스의 4 코너 확인
    const corners = [
      [y, x],
      [y, x + 2],
      [y + 2, x],
      [y + 2, x + 2]
    ];

    let filledCorners = 0;
    for (const [cy, cx] of corners) {
      if (cy < 0 || cy >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT ||
          cx < 0 || cx >= TETRIS_BOARD_WIDTH) {
        filledCorners++;
      } else {
        // T 피스 자체는 제외하고 확인
        const isTPiecePart = this.isTSpinCornerOccupiedByTPiece();
        if (!isTPiecePart && board[cy] && board[cy][cx]) {
          filledCorners++;
        }
      }
    }

    return filledCorners >= 3;
  }

  /**
   * T-Spin 코너가 T 피스 자체인지 확인
   */
  isTSpinCornerOccupiedByTPiece() {
    // T 피스는 3x3이고 4개의 회전 상태가 있음
    // 코너는 (0,0), (2,0), (0,2), (2,2)
    // T 피스 자체가 차지하는 위치는 회전에 따라 다름
    return false; // 간단히 처리: 코너는 T 피스 자체가 차지하지 않음
  }

  /**
   * 배치 평가 (개선판)
   */
  evaluatePlacement(board, linesCleared, _pieceType, isTSpin) {
    const w = this.weights[this.difficulty];

    let score = 0;

    // 1. 기본 평가
    const maxHeight = this.getMaxHeight(board);
    const holes = this.countHoles(board);
    const bumpiness = this.getBumpiness(board);

    score += w.height * maxHeight;
    score += w.holes * holes;
    score += w.bumpiness * bumpiness;

    // 2. 라인 클리어 보너스 (줄 수별 차등)
    score += w.linesCleared[linesCleared] || 0;

    // 3. 우물 평가 (Tetris 준비)
    const wellInfo = this.evaluateWell(board, w.wellColumn);
    if (wellInfo.isGood) {
      score += w.wellBonus;
    } else if (wellInfo.isBad) {
      score -= w.wellBonus * 0.5; // 나쁜 우물은 페널티
    }

    // 4. Tetris 준비 상태 보너스
    if (this.difficulty !== 'easy') {
      const tetrisBonus = this.evaluateTetrisReady(board, w.wellColumn);
      score += tetrisBonus * (w.tetrisReady / 100);
    }

    // 5. Hard 난이도: T-Spin 관련 평가
    if (this.difficulty === 'hard') {
      // T-Spin 실행 보너스
      if (isTSpin && linesCleared > 0) {
        score += w.tSpinClear[linesCleared] || 0;
      }

      // T-Spin 셋업 보너스 (T 피스가 곧 올 경우)
      if (linesCleared === 0) { // 라인 클리어 없이 쌓을 때만
        const tSpinSetupScore = this.evaluateTSpinSetup(board);
        if (tSpinSetupScore > 0) {
          const nextPieces = this.game.randomizer.peek(5);
          const hasTInQueue = nextPieces.includes('T');
          const tInHold = this.game.holdPiece === 'T';
          if (hasTInQueue || tInHold) {
            score += w.tSpinSetup * (tSpinSetupScore / 100);
          }
        }
      }
    }

    // 6. 높이 위험 페널티
    if (maxHeight > 15) {
      score -= (maxHeight - 15) * 20; // 위험 높이 추가 페널티
    }

    return score;
  }

  /**
   * 우물 평가
   */
  evaluateWell(board, wellColumn) {
    const heights = this.getColumnHeights(board);
    const wellHeight = heights[wellColumn];
    const otherHeights = heights.filter((_, i) => i !== wellColumn);
    const minOtherHeight = Math.min(...otherHeights);

    // 좋은 우물: 한 열만 낮고 나머지가 비교적 평탄
    const isGood = wellHeight < minOtherHeight && (minOtherHeight - wellHeight) <= 4;

    // 나쁜 우물: 너무 깊거나 여러 열이 울퉁불퉁
    const isBad = (minOtherHeight - wellHeight) > 6 || this.hasMultipleWells(heights);

    return { isGood, isBad, depth: minOtherHeight - wellHeight };
  }

  /**
   * 여러 개의 우물이 있는지 확인
   */
  hasMultipleWells(heights) {
    let wells = 0;
    for (let i = 0; i < heights.length; i++) {
      const left = i > 0 ? heights[i - 1] : 20;
      const right = i < heights.length - 1 ? heights[i + 1] : 20;
      const minNeighbor = Math.min(left, right);
      if (minNeighbor - heights[i] >= 3) {
        wells++;
      }
    }
    return wells > 1;
  }

  /**
   * Tetris 준비 상태 평가
   */
  evaluateTetrisReady(board, wellColumn) {
    const heights = this.getColumnHeights(board);
    const wellHeight = heights[wellColumn];
    const otherHeights = heights.filter((_, i) => i !== wellColumn);
    const minOtherHeight = Math.min(...otherHeights);

    // 우물이 깊고 나머지가 4줄 이상 채워져 있으면 Tetris 준비 완료
    if (wellHeight === 0 && minOtherHeight >= 4) {
      // I-피스가 다음에 올 경우 추가 보너스
      const nextPieces = this.game.randomizer.peek(5);
      const hasIPiece = nextPieces.includes('I');
      const iInHold = this.game.holdPiece === 'I';

      if (hasIPiece || iInHold) {
        return 100;
      }
      return 60;
    }

    // 우물이 적절히 깊으면 부분 보너스
    if (wellHeight <= 2 && minOtherHeight >= 3) {
      return 30;
    }

    return 0;
  }

  /**
   * T-Spin 셋업 평가
   */
  evaluateTSpinSetup(board) {
    // T-Spin Double 슬롯 패턴 탐지
    // 패턴: □ ■ □
    //       ■ □ ■
    //       ■ ■ □ 또는 □ ■ ■

    let bestScore = 0;

    for (let y = TETRIS_BUFFER_HEIGHT; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT - 2; y++) {
      for (let x = 0; x < TETRIS_BOARD_WIDTH - 2; x++) {
        const score = this.checkTSpinSlot(board, x, y);
        if (score > bestScore) {
          bestScore = score;
        }
      }
    }

    return bestScore;
  }

  /**
   * T-Spin 슬롯 체크
   */
  checkTSpinSlot(board, x, y) {
    // 기본 T-Spin Double 패턴
    // row 0: □ ■ □ (빈-채움-빈)
    // row 1: ■ □ ■ (채움-빈-채움)
    // row 2: ■ ■ □ 또는 □ ■ ■

    const isEmpty = (bx, by) => {
      if (by < 0 || by >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) return false;
      if (bx < 0 || bx >= TETRIS_BOARD_WIDTH) return false;
      return board[by][bx] === null;
    };

    const isFilled = (bx, by) => {
      if (by < 0) return true;
      if (by >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) return false;
      if (bx < 0 || bx >= TETRIS_BOARD_WIDTH) return true;
      return board[by][bx] !== null;
    };

    // T-Spin Double 왼쪽 열림 패턴
    if (isEmpty(x, y) && isFilled(x + 1, y) && isEmpty(x + 2, y) &&
        isFilled(x, y + 1) && isEmpty(x + 1, y + 1) && isFilled(x + 2, y + 1) &&
        isEmpty(x, y + 2) && isFilled(x + 1, y + 2) && isFilled(x + 2, y + 2)) {
      return 100;
    }

    // T-Spin Double 오른쪽 열림 패턴
    if (isEmpty(x, y) && isFilled(x + 1, y) && isEmpty(x + 2, y) &&
        isFilled(x, y + 1) && isEmpty(x + 1, y + 1) && isFilled(x + 2, y + 1) &&
        isFilled(x, y + 2) && isFilled(x + 1, y + 2) && isEmpty(x + 2, y + 2)) {
      return 100;
    }

    // 부분적 T-Spin 셋업 (낮은 점수)
    if (isEmpty(x + 1, y) && isEmpty(x + 1, y + 1) &&
        isFilled(x, y + 1) && isFilled(x + 2, y + 1)) {
      return 30;
    }

    return 0;
  }

  /**
   * 최대 높이 계산
   */
  getMaxHeight(board) {
    for (let y = 0; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT; y++) {
      if (board[y].some(cell => cell !== null)) {
        return TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT - y;
      }
    }
    return 0;
  }

  /**
   * 각 열의 높이 계산
   */
  getColumnHeights(board) {
    const heights = [];
    for (let x = 0; x < TETRIS_BOARD_WIDTH; x++) {
      let height = 0;
      for (let y = 0; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT; y++) {
        if (board[y][x] !== null) {
          height = TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT - y;
          break;
        }
      }
      heights.push(height);
    }
    return heights;
  }

  /**
   * 구멍 수 계산
   */
  countHoles(board) {
    let holes = 0;

    for (let x = 0; x < TETRIS_BOARD_WIDTH; x++) {
      let foundBlock = false;
      for (let y = 0; y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT; y++) {
        if (board[y][x] !== null) {
          foundBlock = true;
        } else if (foundBlock) {
          holes++;
        }
      }
    }

    return holes;
  }

  /**
   * 울퉁불퉁함 계산 (인접 열 높이 차이 합)
   */
  getBumpiness(board) {
    const heights = this.getColumnHeights(board);
    let bumpiness = 0;

    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }

    return bumpiness;
  }

  /**
   * 배치 단계별 실행
   */
  executeStep(target) {
    if (!this.game.currentType) return;

    // Hold가 필요한 경우
    if (target.needsHold && this.game.canHold) {
      this.game.hold();
      this.targetPlacement = null; // 목표 재계산 필요
      return;
    }

    // 현재 상태
    const currentRotation = this.game.rotation;
    const currentX = this.game.position.x;

    // 1. 회전 필요 시
    if (currentRotation !== target.rotation) {
      const rotationDiff = (target.rotation - currentRotation + 4) % 4;
      if (rotationDiff === 1 || rotationDiff === 2) {
        this.game.rotate(1);
      } else if (rotationDiff === 3) {
        this.game.rotate(-1);
      }
      return;
    }

    // 2. 좌우 이동 필요 시
    if (currentX !== target.x) {
      if (currentX < target.x) {
        this.game.move(1, 0);
      } else {
        this.game.move(-1, 0);
      }
      return;
    }

    // 3. 목표 위치 도달 - 하드 드롭
    const result = this.game.hardDrop();
    if (result) {
      if (result.type === 'gameOver') {
        this.handleGameOver();
        return;
      }
      if (result.attack > 0 && this.onAttack) {
        this.onAttack(result.attack);
      }
    }

    // 목표 초기화 (새 피스용)
    this.targetPlacement = null;

    // 상태 업데이트
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getStateForPlayer());
    }
  }

  /**
   * 게임 오버 처리
   */
  handleGameOver() {
    this.stop();
    if (this.onGameOver) {
      this.onGameOver();
    }
  }

  /**
   * 플레이어에게 전달할 상태 반환
   */
  getStateForPlayer() {
    return {
      board: this.game.board,
      score: this.game.score,
      level: this.game.level,
      lines: this.game.lines,
      pendingGarbage: this.game.pendingGarbage,
      gameOver: this.game.gameOver
    };
  }

  /**
   * 가비지 수신
   */
  receiveGarbage(lines) {
    this.game.receiveGarbage(lines);
  }

  /**
   * AI 중지
   */
  stop() {
    this.isRunning = false;
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }
    if (this.gravityTimeout) {
      clearTimeout(this.gravityTimeout);
      this.gravityTimeout = null;
    }
  }

  /**
   * AI 재시작
   */
  restart(seed) {
    this.stop();
    this.game.reset();
    this.targetPlacement = null;
    this.initialize(seed);
  }
}

window.TetrisAI = TetrisAI;
