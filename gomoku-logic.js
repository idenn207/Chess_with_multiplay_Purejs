// 오목 게임 로직
class GomokuGame {
  constructor() {
    this.board = Array(15)
      .fill(null)
      .map(() => Array(15).fill(null));
    this.currentTurn = 'black'; // 흑돌이 선공
    this.myColor = null;
    this.gameOver = false;
    this.moveHistory = [];
    this.winningLine = [];
  }

  resetBoard() {
    this.board = Array(15)
      .fill(null)
      .map(() => Array(15).fill(null));
    this.currentTurn = 'black';
    this.gameOver = false;
    this.moveHistory = [];
    this.winningLine = [];
  }

  isValidMove(row, col) {
    if (row < 0 || row >= 15 || col < 0 || col >= 15) return false;
    return this.board[row][col] === null;
  }

  placeStone(row, col, color) {
    if (!this.isValidMove(row, col)) return false;

    this.board[row][col] = color;
    this.moveHistory.push({ row, col, color });

    return true;
  }

  checkWin(row, col, color) {
    const directions = [
      { dr: 0, dc: 1 }, // 가로
      { dr: 1, dc: 0 }, // 세로
      { dr: 1, dc: 1 }, // 대각선 \
      { dr: 1, dc: -1 }, // 대각선 /
    ];

    for (const { dr, dc } of directions) {
      const line = this.getLine(row, col, dr, dc, color);
      if (line.length >= 5) {
        // 정확히 5개인지 확인 (6목 금지)
        const extendedLine = this.getExtendedLine(row, col, dr, dc, color);
        if (extendedLine.length === 5) {
          this.winningLine = extendedLine;
          return true;
        }
      }
    }

    return false;
  }

  getLine(row, col, dr, dc, color) {
    const line = [{ row, col }];

    // 양방향 탐색
    for (let direction of [-1, 1]) {
      let r = row + dr * direction;
      let c = col + dc * direction;

      while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
        line.push({ row: r, col: c });
        r += dr * direction;
        c += dc * direction;
      }
    }

    return line;
  }

  getExtendedLine(row, col, dr, dc, color) {
    const line = [];

    // 한 방향으로 끝까지
    let r = row - dr * 10;
    let c = col - dc * 10;

    // 시작점 찾기
    while (r < 0 || r >= 15 || c < 0 || c >= 15 || this.board[r][c] !== color) {
      r += dr;
      c += dc;
    }

    // 연속된 돌 세기
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }

    return line;
  }

  isBoardFull() {
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (this.board[row][col] === null) {
          return false;
        }
      }
    }
    return true;
  }

  getGameState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      gameOver: this.gameOver,
      winningLine: this.winningLine,
    };
  }

  applyMove(moveData) {
    this.board = moveData.board;
    this.currentTurn = moveData.currentTurn;
    this.gameOver = moveData.gameOver;
    this.winningLine = moveData.winningLine || [];
  }
}
