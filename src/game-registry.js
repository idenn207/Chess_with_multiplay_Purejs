// 게임 레지스트리
class GameRegistry {
  constructor() {
    this.games = new Map();
  }

  register(gameConfig) {
    this.games.set(gameConfig.id, gameConfig);
  }

  get(gameId) {
    return this.games.get(gameId);
  }

  getAll() {
    return Array.from(this.games.values());
  }

  createGame(gameId, role) {
    const config = this.get(gameId);
    if (!config) {
      throw new Error(`Unknown game: ${gameId}`);
    }

    const game = new config.gameClass();
    game.myColor = role === 'server' ? config.serverColor : config.clientColor;

    return game;
  }

  createRenderer(gameId, game, container, onMove) {
    const config = this.get(gameId);
    if (!config) {
      throw new Error(`Unknown game: ${gameId}`);
    }

    return new config.rendererClass(game, container, onMove);
  }

  /**
   * 싱글플레이 지원 여부 확인
   * @param {string} gameId - 게임 ID
   * @returns {boolean} 싱글플레이 지원 여부
   */
  supportsSinglePlayer(gameId) {
    const config = this.get(gameId);
    return config && config.singlePlayer && config.singlePlayer.aiClass;
  }

  /**
   * AI 인스턴스 생성
   * @param {string} gameId - 게임 ID
   * @param {string} difficulty - 난이도 ('easy', 'medium', 'hard')
   * @returns {Object} AI 인스턴스
   */
  createAI(gameId, difficulty) {
    const config = this.get(gameId);
    if (!config || !config.singlePlayer || !config.singlePlayer.aiClass) {
      throw new Error(`Game ${gameId} does not support single player mode`);
    }
    return new config.singlePlayer.aiClass(difficulty);
  }

  /**
   * 싱글플레이 설정 가져오기
   * @param {string} gameId - 게임 ID
   * @returns {Object|null} 싱글플레이 설정
   */
  getSinglePlayerConfig(gameId) {
    const config = this.get(gameId);
    return config ? config.singlePlayer : null;
  }
}

// 전역 게임 레지스트리 인스턴스
const gameRegistry = new GameRegistry();

// 체스 등록
gameRegistry.register({
  id: 'chess',
  name: '체스',
  icon: '&#x2654',
  gameClass: ChessGame,
  rendererClass: ChessRenderer,
  serverColor: 'white',
  clientColor: 'black',
  serverLabel: '백 (선공)',
  clientLabel: '흑 (후공)',
  getTurnLabel: (color) => (color === 'white' ? '백' : '흑'),

  // 싱글플레이 설정
  singlePlayer: {
    aiClass: ChessAI,
    playerColor: 'white',
    playerLabel: '백 (플레이어)',

    // AI 이동 실행 콜백
    executeAIMove: (renderer, move) => {
      const [fromRow, fromCol] = move.from;
      const [toRow, toCol] = move.to;
      renderer.animateMove(fromRow, fromCol, toRow, toCol);
    },

    // AI 이동 후 게임 오버 체크
    checkGameOverAfterAI: (game, myColor) => {
      if (game.isCheckmate(myColor)) {
        return { gameOver: true, winner: 'black', reason: 'checkmate' };
      } else if (game.isStalemate(myColor)) {
        return { gameOver: true, winner: 'draw', reason: 'stalemate' };
      }
      return null;
    },
  },
});

// 오목 등록
gameRegistry.register({
  id: 'gomoku',
  name: '오목',
  icon: '&#x26AB',
  gameClass: GomokuGame,
  rendererClass: GomokuRenderer,
  serverColor: 'black',
  clientColor: 'white',
  serverLabel: '흑 (선공)',
  clientLabel: '백 (후공)',
  getTurnLabel: (color) => (color === 'black' ? '흑' : '백'),

  // 싱글플레이 설정
  singlePlayer: {
    aiClass: GomokuAI,
    playerColor: 'black',
    playerLabel: '흑 (플레이어)',

    // AI 이동 실행 콜백
    executeAIMove: (renderer, move) => {
      renderer.animateAIMove(move.row, move.col);
    },

    // 오목은 executeMove에서 게임 오버 처리 (추가 체크 불필요)
    checkGameOverAfterAI: null,
  },
});

// 장기 등록
gameRegistry.register({
  id: 'janggi',
  name: '장기',
  icon: '&#x1F3EF',
  gameClass: JanggiGame,
  rendererClass: JanggiRenderer,
  serverColor: 'cho',
  clientColor: 'han',
  serverLabel: '초 (선공)',
  clientLabel: '한 (후공)',
  getTurnLabel: (color) => (color === 'cho' ? '초' : '한'),

  // 싱글플레이 설정
  singlePlayer: {
    aiClass: JanggiAI,
    playerColor: 'cho',
    playerLabel: '초 (플레이어)',

    // AI 이동 실행 콜백
    executeAIMove: (renderer, move) => {
      const [fromRow, fromCol] = move.from;
      const [toRow, toCol] = move.to;
      renderer.animateMove(fromRow, fromCol, toRow, toCol);
    },

    // AI 이동 후 게임 오버 체크
    checkGameOverAfterAI: (game, myColor) => {
      if (game.isCheckmate(myColor)) {
        return { gameOver: true, winner: 'han', reason: 'checkmate' };
      } else if (game.isStalemate(myColor)) {
        return { gameOver: true, winner: 'draw', reason: 'stalemate' };
      }
      return null;
    },
  },
});

gameRegistry.register({
  id: 'tetris',
  name: '테트리스',
  icon: '🧱',
  gameClass: TetrisGame,
  rendererClass: TetrisRenderer,
  serverColor: 'player1',
  clientColor: 'player2',
  serverLabel: 'Player 1',
  clientLabel: 'Player 2',
  getTurnLabel: (color) => color === 'player1' ? 'P1' : 'P2',
  isRealtime: true
});