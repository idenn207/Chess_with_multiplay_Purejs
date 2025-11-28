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
}

// 전역 게임 레지스트리 인스턴스
const gameRegistry = new GameRegistry();

// 체스 등록
gameRegistry.register({
  id: 'chess',
  name: '체스',
  icon: '♔',
  gameClass: ChessGame,
  rendererClass: ChessRenderer,
  serverColor: 'white',
  clientColor: 'black',
  serverLabel: '백 (선공)',
  clientLabel: '흑 (후공)',
  getTurnLabel: (color) => (color === 'white' ? '백' : '흑'),
});

// 오목 등록
gameRegistry.register({
  id: 'gomoku',
  name: '오목',
  icon: '⚫',
  gameClass: GomokuGame,
  rendererClass: GomokuRenderer,
  serverColor: 'black',
  clientColor: 'white',
  serverLabel: '흑 (선공)',
  clientLabel: '백 (후공)',
  getTurnLabel: (color) => (color === 'black' ? '흑' : '백'),
});