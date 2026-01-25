// 체스 게임 로직
class ChessGame {
  constructor() {
    this.board = this.getInitialBoard();
    this.selectedSquare = null;
    this.validMoves = [];
    this.currentTurn = 'white';
    this.myColor = null;
    this.gameOver = false;

    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    };
    this.enPassantTarget = null;
    this.kingPositions = { white: [7, 4], black: [0, 4] };
    this.moveHistory = [];
    this.lastMove = null;
  }

  getInitialBoard() {
    return [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
    ];
  }

  reset() {
    this.board = this.getInitialBoard();
    this.selectedSquare = null;
    this.validMoves = [];
    this.currentTurn = 'white';
    this.gameOver = false;
    this.castlingRights = {
      white: { kingSide: true, queenSide: true },
      black: { kingSide: true, queenSide: true },
    };
    this.enPassantTarget = null;
    this.kingPositions = { white: [7, 4], black: [0, 4] };
    this.moveHistory = [];
    this.lastMove = null;
    // myColor는 유지
  }

  isWhitePiece(piece) {
    return piece && piece === piece.toUpperCase();
  }

  getPieceColor(piece) {
    if (!piece) return null;
    return this.isWhitePiece(piece) ? 'white' : 'black';
  }

  getPieceAt(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return undefined;
    return this.board[row][col];
  }

  isValidPosition(row, col) {
    return row >= 0 && row <= 7 && col >= 0 && col <= 7;
  }

  getPossibleMoves(row, col) {
    const piece = this.getPieceAt(row, col);
    if (!piece) return [];

    const pieceType = piece.toLowerCase();
    const moves = [];

    switch (pieceType) {
      case 'p':
        moves.push(...this.getPawnMoves(row, col, piece));
        break;
      case 'n':
        moves.push(...this.getKnightMoves(row, col, piece));
        break;
      case 'b':
        moves.push(...this.getBishopMoves(row, col, piece));
        break;
      case 'r':
        moves.push(...this.getRookMoves(row, col, piece));
        break;
      case 'q':
        moves.push(...this.getQueenMoves(row, col, piece));
        break;
      case 'k':
        moves.push(...this.getKingMoves(row, col, piece));
        break;
    }

    return moves.filter((move) => !this.wouldBeInCheck(row, col, move[0], move[1], piece));
  }

  getPawnMoves(row, col, piece) {
    const moves = [];
    const direction = this.isWhitePiece(piece) ? -1 : 1;
    const startRow = this.isWhitePiece(piece) ? 6 : 1;

    if (!this.getPieceAt(row + direction, col)) {
      moves.push([row + direction, col]);
      if (row === startRow && !this.getPieceAt(row + 2 * direction, col)) {
        moves.push([row + 2 * direction, col]);
      }
    }

    for (const dcol of [-1, 1]) {
      const newRow = row + direction;
      const newCol = col + dcol;
      const target = this.getPieceAt(newRow, newCol);

      if (target && this.getPieceColor(target) !== this.getPieceColor(piece)) {
        moves.push([newRow, newCol]);
      }

      if (this.enPassantTarget && this.enPassantTarget[0] === newRow && this.enPassantTarget[1] === newCol) {
        moves.push([newRow, newCol]);
      }
    }

    return moves;
  }

  getKnightMoves(row, col, piece) {
    const moves = [];
    const offsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== this.getPieceColor(piece)) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  getBishopMoves(row, col, piece) {
    return this.getSlidingMoves(row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]);
  }

  getRookMoves(row, col, piece) {
    return this.getSlidingMoves(row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]);
  }

  getQueenMoves(row, col, piece) {
    return this.getSlidingMoves(row, col, piece, [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]);
  }

  getSlidingMoves(row, col, piece, directions) {
    const moves = [];

    for (const [drow, dcol] of directions) {
      let newRow = row + drow;
      let newCol = col + dcol;

      while (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);

        if (!target) {
          moves.push([newRow, newCol]);
        } else {
          if (this.getPieceColor(target) !== this.getPieceColor(piece)) {
            moves.push([newRow, newCol]);
          }
          break;
        }

        newRow += drow;
        newCol += dcol;
      }
    }

    return moves;
  }

  getKingMoves(row, col, piece) {
    const moves = [];
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== this.getPieceColor(piece)) {
          moves.push([newRow, newCol]);
        }
      }
    }

    const color = this.getPieceColor(piece);
    if (this.castlingRights[color]) {
      if (
        this.castlingRights[color].kingSide &&
        !this.getPieceAt(row, 5) &&
        !this.getPieceAt(row, 6) &&
        this.getPieceAt(row, 7) &&
        this.getPieceAt(row, 7).toLowerCase() === 'r' &&
        !this.isSquareAttacked(row, 4, color) &&
        !this.isSquareAttacked(row, 5, color) &&
        !this.isSquareAttacked(row, 6, color)
      ) {
        moves.push([row, 6]);
      }

      if (
        this.castlingRights[color].queenSide &&
        !this.getPieceAt(row, 3) &&
        !this.getPieceAt(row, 2) &&
        !this.getPieceAt(row, 1) &&
        this.getPieceAt(row, 0) &&
        this.getPieceAt(row, 0).toLowerCase() === 'r' &&
        !this.isSquareAttacked(row, 4, color) &&
        !this.isSquareAttacked(row, 3, color) &&
        !this.isSquareAttacked(row, 2, color)
      ) {
        moves.push([row, 2]);
      }
    }

    return moves;
  }

  isSquareAttacked(row, col, byColor) {
    const attackerColor = byColor === 'white' ? 'black' : 'white';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPieceAt(r, c);
        if (piece && this.getPieceColor(piece) === attackerColor) {
          const moves = this.getPieceMoves(r, c, piece);
          if (moves.some(([mr, mc]) => mr === row && mc === col)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  getPieceMoves(row, col, piece) {
    const pieceType = piece.toLowerCase();

    switch (pieceType) {
      case 'p':
        return this.getPawnAttackMoves(row, col, piece);
      case 'n':
        return this.getKnightMoves(row, col, piece);
      case 'b':
        return this.getBishopMoves(row, col, piece);
      case 'r':
        return this.getRookMoves(row, col, piece);
      case 'q':
        return this.getQueenMoves(row, col, piece);
      case 'k':
        return this.getKingBasicMoves(row, col, piece);
      default:
        return [];
    }
  }

  getPawnAttackMoves(row, col, piece) {
    const moves = [];
    const direction = this.isWhitePiece(piece) ? -1 : 1;

    for (const dcol of [-1, 1]) {
      const newRow = row + direction;
      const newCol = col + dcol;
      if (this.isValidPosition(newRow, newCol)) {
        moves.push([newRow, newCol]);
      }
    }

    return moves;
  }

  getKingBasicMoves(row, col, piece) {
    const moves = [];
    const offsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (const [drow, dcol] of offsets) {
      const newRow = row + drow;
      const newCol = col + dcol;
      if (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== this.getPieceColor(piece)) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece) {
    const tempPiece = this.board[toRow][toCol];

    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    const color = this.getPieceColor(piece);
    let kingPos = [...this.kingPositions[color]];

    if (piece.toLowerCase() === 'k') {
      kingPos = [toRow, toCol];
    }

    const inCheck = this.isSquareAttacked(kingPos[0], kingPos[1], color);

    this.board[fromRow][fromCol] = piece;
    this.board[toRow][toCol] = tempPiece;

    return inCheck;
  }

  isInCheck(color) {
    const kingPos = this.kingPositions[color];
    return this.isSquareAttacked(kingPos[0], kingPos[1], color);
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPieceAt(r, c);
        if (piece && this.getPieceColor(piece) === color) {
          const moves = this.getPossibleMoves(r, c);
          if (moves.length > 0) return false;
        }
      }
    }

    return true;
  }

  isStalemate(color) {
    if (this.isInCheck(color)) return false;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPieceAt(r, c);
        if (piece && this.getPieceColor(piece) === color) {
          const moves = this.getPossibleMoves(r, c);
          if (moves.length > 0) return false;
        }
      }
    }

    return true;
  }

  movePiece(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
    const piece = this.getPieceAt(fromRow, fromCol);
    if (!piece) return false;

    const pieceType = piece.toLowerCase();
    const color = this.getPieceColor(piece);

    if (pieceType === 'p' && this.enPassantTarget && toRow === this.enPassantTarget[0] && toCol === this.enPassantTarget[1]) {
      const captureRow = this.isWhitePiece(piece) ? toRow + 1 : toRow - 1;
      this.board[captureRow][toCol] = null;
    }

    if (pieceType === 'k' && Math.abs(toCol - fromCol) === 2) {
      if (toCol === 6) {
        this.board[fromRow][5] = this.board[fromRow][7];
        this.board[fromRow][7] = null;
      } else if (toCol === 2) {
        this.board[fromRow][3] = this.board[fromRow][0];
        this.board[fromRow][0] = null;
      }
    }

    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
      if (promotionPiece) {
        this.board[toRow][toCol] = promotionPiece;
      }
    }

    this.enPassantTarget = null;
    if (pieceType === 'p' && Math.abs(toRow - fromRow) === 2) {
      this.enPassantTarget = [(fromRow + toRow) / 2, toCol];
    }

    if (pieceType === 'k') {
      this.castlingRights[color].kingSide = false;
      this.castlingRights[color].queenSide = false;
      this.kingPositions[color] = [toRow, toCol];
    } else if (pieceType === 'r') {
      if (fromCol === 0) this.castlingRights[color].queenSide = false;
      if (fromCol === 7) this.castlingRights[color].kingSide = false;
    }

    this.moveHistory.push({
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece: piece,
    });

    this.lastMove = {
      from: [fromRow, fromCol],
      to: [toRow, toCol],
    };

    return true;
  }

  applyMove(moveData) {
    this.board = moveData.board;
    this.currentTurn = moveData.currentTurn;
    this.castlingRights = moveData.castlingRights;
    this.enPassantTarget = moveData.enPassantTarget;
    this.kingPositions = moveData.kingPositions;
    this.lastMove = moveData.lastMove || null;
  }

  getGameState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      castlingRights: this.castlingRights,
      enPassantTarget: this.enPassantTarget,
      kingPositions: this.kingPositions,
      lastMove: this.lastMove,
    };
  }

  // AI 헬퍼 메서드

  /**
   * 특정 색상의 모든 합법적인 수 반환
   * @param {string} color - 'white' 또는 'black'
   * @returns {Array} [{from: [r, c], to: [r, c], piece: string, capturedPiece: string|null}]
   */
  getAllLegalMoves(color) {
    const moves = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece && this.getPieceColor(piece) === color) {
          const possibleMoves = this.getPossibleMoves(row, col);
          possibleMoves.forEach(([toRow, toCol]) => {
            moves.push({
              from: [row, col],
              to: [toRow, toCol],
              piece: piece,
              capturedPiece: this.board[toRow][toCol],
            });
          });
        }
      }
    }

    return moves;
  }

  /**
   * 게임 상태 깊은 복사
   * @returns {ChessGame} 복사된 게임 인스턴스
   */
  cloneGame() {
    const clone = new ChessGame();
    clone.board = this.board.map((row) => [...row]);
    clone.currentTurn = this.currentTurn;
    clone.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    clone.enPassantTarget = this.enPassantTarget ? [...this.enPassantTarget] : null;
    clone.kingPositions = {
      white: [...this.kingPositions.white],
      black: [...this.kingPositions.black],
    };
    clone.gameOver = this.gameOver;
    clone.myColor = this.myColor;
    return clone;
  }

  /**
   * 기물 가치 반환
   * @param {string} piece - 기물 문자
   * @returns {number} 기물 가치 (센티폰 단위)
   */
  getPieceValue(piece) {
    const values = {
      p: 100, // 폰
      n: 320, // 나이트
      b: 330, // 비숍
      r: 500, // 룩
      q: 900, // 퀸
      k: 20000, // 킹
    };
    return values[piece.toLowerCase()] || 0;
  }
}
