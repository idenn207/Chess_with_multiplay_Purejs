/**
 * 테트리스 게임 로직
 * LAN Multi Game 프로젝트 통합용
 * 
 * 특징:
 * - 실시간 멀티플레이어 (턴제 아님)
 * - 공격 시스템 (가비지 라인)
 * - 시드 기반 블록 동기화
 */

// ============== 상수 정의 ==============
const TETRIS_BOARD_WIDTH = 10;
const TETRIS_BOARD_HEIGHT = 20;
const TETRIS_BUFFER_HEIGHT = 4;

const TETROMINOS = {
  I: {
    shapes: [
      [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
      [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
      [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]
    ],
    color: '#00F0F0',
    spawn: { x: 3, y: 0 }
  },
  O: {
    shapes: [[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
    color: '#F0F000',
    spawn: { x: 4, y: 0 }
  },
  T: {
    shapes: [
      [[0,1,0],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,1],[0,1,0]],
      [[0,1,0],[1,1,0],[0,1,0]]
    ],
    color: '#A000F0',
    spawn: { x: 3, y: 0 }
  },
  S: {
    shapes: [
      [[0,1,1],[1,1,0],[0,0,0]],
      [[0,1,0],[0,1,1],[0,0,1]],
      [[0,0,0],[0,1,1],[1,1,0]],
      [[1,0,0],[1,1,0],[0,1,0]]
    ],
    color: '#00F000',
    spawn: { x: 3, y: 0 }
  },
  Z: {
    shapes: [
      [[1,1,0],[0,1,1],[0,0,0]],
      [[0,0,1],[0,1,1],[0,1,0]],
      [[0,0,0],[1,1,0],[0,1,1]],
      [[0,1,0],[1,1,0],[1,0,0]]
    ],
    color: '#F00000',
    spawn: { x: 3, y: 0 }
  },
  J: {
    shapes: [
      [[1,0,0],[1,1,1],[0,0,0]],
      [[0,1,1],[0,1,0],[0,1,0]],
      [[0,0,0],[1,1,1],[0,0,1]],
      [[0,1,0],[0,1,0],[1,1,0]]
    ],
    color: '#0000F0',
    spawn: { x: 3, y: 0 }
  },
  L: {
    shapes: [
      [[0,0,1],[1,1,1],[0,0,0]],
      [[0,1,0],[0,1,0],[0,1,1]],
      [[0,0,0],[1,1,1],[1,0,0]],
      [[1,1,0],[0,1,0],[0,1,0]]
    ],
    color: '#F0A000',
    spawn: { x: 3, y: 0 }
  }
};

// SRS Wall Kick 데이터
const WALL_KICKS = {
  normal: {
    '0->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1->0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1->2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3->2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3->0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]]
  },
  I: {
    '0->1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '1->0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '1->2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
    '2->1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '2->3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
    '3->2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
    '3->0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
    '0->3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
  }
};

const GRAVITY_TABLE = [1000, 793, 618, 473, 355, 262, 190, 135, 94, 64, 43, 28, 18, 11, 7];

const ATTACK_TABLE = {
  lines: { 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 },
  tSpin: { 0: 0, 1: 2, 2: 4, 3: 6 },
  tSpinMini: { 0: 0, 1: 0, 2: 1 },
  combo: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
  perfectClear: 10,
  b2bBonus: 1
};

// 시드 기반 랜덤
class SeededRandom {
  constructor(seed) { this.seed = seed; }
  next() {
    this.seed |= 0;
    this.seed = this.seed + 0x6D2B79F5 | 0;
    let t = Math.imul(this.seed ^ this.seed >>> 15, 1 | this.seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Bag Randomizer
class TetrisBagRandomizer {
  constructor(seed = null) {
    this.seed = seed || Date.now();
    this.random = new SeededRandom(this.seed);
    this.bag = [];
    this.pieceTypes = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  }
  fillBag() {
    const newBag = [...this.pieceTypes];
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }
    this.bag.push(...newBag);
  }
  next() {
    if (this.bag.length < 7) this.fillBag();
    return this.bag.shift();
  }
  peek(count = 5) {
    while (this.bag.length < count + 7) this.fillBag();
    return this.bag.slice(0, count);
  }
}

// 테트리스 게임 클래스
class TetrisGame {
  constructor() {
    this.board = this.createBoard();
    this.currentType = null;
    this.position = { x: 0, y: 0 };
    this.rotation = 0;
    this.holdPiece = null;
    this.canHold = true;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;
    this.b2b = 0;
    this.currentTurn = 'player1';
    this.myColor = null;
    this.gameOver = false;
    this.randomizer = null;
    this.sharedSeed = null;
    this.pendingGarbage = 0;
    this.lastAction = null;
    this.lockMoves = 0;
    this.maxLockMoves = 15;
    this.opponentState = null;
    this.isStarted = false;
  }
  
  createBoard() {
    return Array(TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT).fill(null).map(() => Array(TETRIS_BOARD_WIDTH).fill(null));
  }

  reset() {
    this.board = this.createBoard();
    this.currentType = null;
    this.position = { x: 0, y: 0 };
    this.rotation = 0;
    this.holdPiece = null;
    this.canHold = true;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;
    this.b2b = 0;
    this.gameOver = false;
    this.pendingGarbage = 0;
    this.lastAction = null;
    this.lockMoves = 0;
    this.opponentState = null;
    this.isStarted = false;
    this.randomizer = null;
    this.sharedSeed = null;
    // myColor와 currentTurn은 유지
  }

  initialize(seed) {
    this.sharedSeed = seed;
    this.randomizer = new TetrisBagRandomizer(seed);
    this.board = this.createBoard();
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;
    this.b2b = 0;
    this.holdPiece = null;
    this.canHold = true;
    this.pendingGarbage = 0;
    this.gameOver = false;
    this.isStarted = true;
    this.spawnPiece();
  }
  
  spawnPiece() {
    this.currentType = this.randomizer.next();
    const spawn = TETROMINOS[this.currentType].spawn;
    this.position = { x: spawn.x, y: TETRIS_BUFFER_HEIGHT - 2 };
    this.rotation = 0;
    this.canHold = true;
    this.lockMoves = 0;
    this.lastAction = null;
    if (!this.canPlace(this.getShape(), this.position.x, this.position.y)) {
      this.gameOver = true;
      return false;
    }
    return true;
  }
  
  getShape() {
    if (!this.currentType) return null;
    return TETROMINOS[this.currentType].shapes[this.rotation];
  }
  
  canPlace(shape, x, y) {
    if (!shape) return false;
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const bx = x + px, by = y + py;
          if (bx < 0 || bx >= TETRIS_BOARD_WIDTH || by >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) return false;
          if (by >= 0 && this.board[by][bx]) return false;
        }
      }
    }
    return true;
  }
  
  move(dx, dy) {
    if (!this.currentType || this.gameOver) return false;
    const newX = this.position.x + dx, newY = this.position.y + dy;
    if (this.canPlace(this.getShape(), newX, newY)) {
      this.position.x = newX;
      this.position.y = newY;
      if (dy === 0) { this.lastAction = 'move'; this.lockMoves++; }
      return true;
    }
    return false;
  }
  
  rotate(dir) {
    if (!this.currentType || this.gameOver || this.currentType === 'O') return false;
    const fromRot = this.rotation;
    const toRot = (this.rotation + dir + 4) % 4;
    const newShape = TETROMINOS[this.currentType].shapes[toRot];
    const kicks = (this.currentType === 'I' ? WALL_KICKS.I : WALL_KICKS.normal)[`${fromRot}->${toRot}`];
    for (const [dx, dy] of kicks) {
      if (this.canPlace(newShape, this.position.x + dx, this.position.y - dy)) {
        this.position.x += dx;
        this.position.y -= dy;
        this.rotation = toRot;
        this.lastAction = 'rotate';
        this.lockMoves++;
        return true;
      }
    }
    return false;
  }
  
  getGhostY() {
    let ghostY = this.position.y;
    while (this.canPlace(this.getShape(), this.position.x, ghostY + 1)) ghostY++;
    return ghostY;
  }
  
  hardDrop() {
    if (!this.currentType || this.gameOver) return null;
    const ghostY = this.getGhostY();
    this.score += (ghostY - this.position.y) * 2;
    this.position.y = ghostY;
    return this.lockPiece();
  }
  
  softDrop() {
    if (this.move(0, 1)) { this.score += 1; return true; }
    return false;
  }
  
  hold() {
    if (!this.currentType || !this.canHold || this.gameOver) return false;
    const held = this.holdPiece;
    this.holdPiece = this.currentType;
    this.canHold = false;
    if (held) {
      this.currentType = held;
      const spawn = TETROMINOS[this.currentType].spawn;
      this.position = { x: spawn.x, y: TETRIS_BUFFER_HEIGHT - 2 };
      this.rotation = 0;
    } else {
      this.spawnPiece();
    }
    return true;
  }
  
  lockPiece() {
    const shape = this.getShape();
    const color = TETROMINOS[this.currentType].color;
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const bx = this.position.x + px, by = this.position.y + py;
          if (by >= 0 && by < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) {
            this.board[by][bx] = color;
          }
        }
      }
    }
    const isTSpin = this.detectTSpin();
    const isMini = isTSpin && this.detectTSpinMini();
    const { cleared } = this.clearLines();
    const attackResult = this.processLineClear(cleared, isTSpin, isMini);
    this.applyPendingGarbage();
    if (!this.spawnPiece()) {
      return { type: 'gameOver', score: this.score, lines: this.lines };
    }
    return { type: 'lock', cleared, isTSpin, isMini, attack: attackResult.attack, score: this.score, combo: this.combo };
  }
  
  detectTSpin() {
    if (this.currentType !== 'T' || this.lastAction !== 'rotate') return false;
    const corners = [[this.position.y, this.position.x], [this.position.y, this.position.x + 2], [this.position.y + 2, this.position.x], [this.position.y + 2, this.position.x + 2]];
    let filled = 0;
    for (const [y, x] of corners) {
      if (y < 0 || y >= TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT || x < 0 || x >= TETRIS_BOARD_WIDTH || this.board[y]?.[x]) filled++;
    }
    return filled >= 3;
  }
  
  detectTSpinMini() {
    const frontCorners = {
      0: [[this.position.y, this.position.x], [this.position.y, this.position.x + 2]],
      1: [[this.position.y, this.position.x + 2], [this.position.y + 2, this.position.x + 2]],
      2: [[this.position.y + 2, this.position.x], [this.position.y + 2, this.position.x + 2]],
      3: [[this.position.y, this.position.x], [this.position.y + 2, this.position.x]]
    };
    let empty = 0;
    for (const [y, x] of frontCorners[this.rotation]) {
      if (y >= 0 && y < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT && x >= 0 && x < TETRIS_BOARD_WIDTH && !this.board[y]?.[x]) empty++;
    }
    return empty > 0;
  }
  
  clearLines() {
    // 완성된 라인 찾기
    const clearedLines = [];
    for (let y = TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT - 1; y >= 0; y--) {
      if (this.board[y].every(cell => cell !== null)) {
        clearedLines.push(y);
      }
    }

    if (clearedLines.length === 0) {
      return { cleared: 0, clearedLines: [] };
    }

    // Single-pass 알고리즘: 완성되지 않은 줄만 수집
    const completeSet = new Set(clearedLines);
    const newBoard = this.board.filter((_, y) => !completeSet.has(y));

    // 위에 빈 줄 추가
    while (newBoard.length < TETRIS_BOARD_HEIGHT + TETRIS_BUFFER_HEIGHT) {
      newBoard.unshift(Array(TETRIS_BOARD_WIDTH).fill(null));
    }

    this.board = newBoard;
    return { cleared: clearedLines.length, clearedLines };
  }
  
  processLineClear(lines, isTSpin, isMini) {
    if (lines === 0) { this.combo = -1; return { attack: 0 }; }
    this.lines += lines;
    this.level = Math.floor(this.lines / 10) + 1;
    let points = isTSpin ? (isMini ? [0, 100, 200][lines] : [400, 800, 1200, 1600][lines]) : [0, 100, 300, 500, 800][lines];
    points = (points || 0) * this.level;
    let attack = isTSpin ? (isMini ? ATTACK_TABLE.tSpinMini[lines] : ATTACK_TABLE.tSpin[lines]) : ATTACK_TABLE.lines[lines];
    attack = attack || 0;
    this.combo++;
    attack += ATTACK_TABLE.combo[Math.min(this.combo, ATTACK_TABLE.combo.length - 1)];
    points += 50 * this.combo * this.level;
    const isB2B = lines === 4 || (isTSpin && lines > 0);
    if (isB2B) {
      if (this.b2b > 0) { attack += ATTACK_TABLE.b2bBonus; points = Math.floor(points * 1.5); }
      this.b2b++;
    } else { this.b2b = 0; }
    if (this.isPerfectClear()) { attack += ATTACK_TABLE.perfectClear; points += 3000 * this.level; }
    this.score += points;
    return { attack: this.cancelGarbage(attack) };
  }
  
  isPerfectClear() {
    return !this.board.slice(TETRIS_BUFFER_HEIGHT).some(row => row.some(cell => cell !== null));
  }
  
  receiveGarbage(lines) {
    const before = this.pendingGarbage;
    this.pendingGarbage = Math.min(this.pendingGarbage + lines, 20);
  }
  cancelGarbage(attack) {
    const c = Math.min(this.pendingGarbage, attack);
    this.pendingGarbage -= c;
    return attack - c;
  }
  
  applyPendingGarbage() {
    if (this.pendingGarbage === 0) return;
    const holeX = Math.floor(Math.random() * TETRIS_BOARD_WIDTH);
    for (let i = 0; i < this.pendingGarbage; i++) {
      this.board.shift();
      const garbageLine = Array(TETRIS_BOARD_WIDTH).fill('#808080');
      garbageLine[holeX] = null;
      this.board.push(garbageLine);
    }
    this.pendingGarbage = 0;
  }
  
  getGravity() { return GRAVITY_TABLE[Math.min(this.level - 1, GRAVITY_TABLE.length - 1)]; }
  getNextPieces(count = 5) { return this.randomizer ? this.randomizer.peek(count) : []; }

  /**
   * 최고 기록 저장 (localStorage)
   * @returns {boolean} 신기록 여부
   */
  saveHighScore() {
    const current = { score: this.score, lines: this.lines, level: this.level };
    const saved = localStorage.getItem('tetris_highscore');
    const best = saved ? JSON.parse(saved) : { score: 0, lines: 0, level: 1 };

    if (current.score > best.score) {
      localStorage.setItem('tetris_highscore', JSON.stringify(current));
      return true; // 신기록!
    }
    return false;
  }

  /**
   * 최고 기록 로드 (localStorage)
   * @returns {Object} { score, lines, level }
   */
  static loadHighScore() {
    const saved = localStorage.getItem('tetris_highscore');
    return saved ? JSON.parse(saved) : { score: 0, lines: 0, level: 1 };
  }

  getGameState() {
    return {
      board: this.board, currentType: this.currentType, position: this.position, rotation: this.rotation,
      holdPiece: this.holdPiece, score: this.score, level: this.level, lines: this.lines, combo: this.combo,
      b2b: this.b2b, pendingGarbage: this.pendingGarbage, gameOver: this.gameOver, currentTurn: this.currentTurn, isStarted: this.isStarted
    };
  }
  
  applyMove(moveData) {
    if (moveData.tetrisType) {
      switch (moveData.tetrisType) {
        case 'start': this.initialize(moveData.seed); break;
        case 'attack': if (moveData.attack > 0) this.receiveGarbage(moveData.attack); break;
        case 'state': this.opponentState = moveData.opponentState; break;
        case 'gameOver': this.opponentState = { ...this.opponentState, gameOver: true }; break;
      }
    }
    if (moveData.board && !moveData.tetrisType) {
      this.opponentState = { board: moveData.board, score: moveData.score, level: moveData.level, lines: moveData.lines, gameOver: moveData.gameOver };
    }
  }
  
  getStateForOpponent() {
    return { board: this.board, score: this.score, level: this.level, lines: this.lines, pendingGarbage: this.pendingGarbage, gameOver: this.gameOver };
  }
}

window.TetrisGame = TetrisGame;
window.TETROMINOS = TETROMINOS;
window.TETRIS_BOARD_WIDTH = TETRIS_BOARD_WIDTH;
window.TETRIS_BOARD_HEIGHT = TETRIS_BOARD_HEIGHT;
window.TETRIS_BUFFER_HEIGHT = TETRIS_BUFFER_HEIGHT;
