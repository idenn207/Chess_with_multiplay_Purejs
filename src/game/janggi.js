// 장기 게임 로직
class JanggiGame {
  constructor() {
    this.board = this.getInitialBoard();
    this.selectedSquare = null;
    this.validMoves = [];
    this.currentTurn = 'cho'; // 초(빨강)가 선공
    this.myColor = null;
    this.gameOver = false;
    this.lastMove = null;
    this.moveHistory = [];
  }

  // 초기 보드 설정 (9x10)
  // 한(파랑): 위쪽 (row 0~2)
  // 초(빨강): 아래쪽 (row 7~9)
  getInitialBoard() {
    // 소문자: 한(파랑), 대문자: 초(빨강)
    // k: 궁(장), a: 사, r: 차, c: 포, n: 마, e: 상, p: 졸/병
    return [
      ['r', 'e', 'n', 'a', null, 'a', 'e', 'n', 'r'], // row 0: 한
      [null, null, null, null, 'k', null, null, null, null], // row 1: 한 궁
      [null, 'c', null, null, null, null, null, 'c', null], // row 2: 한 포
      ['p', null, 'p', null, 'p', null, 'p', null, 'p'], // row 3: 한 졸
      [null, null, null, null, null, null, null, null, null], // row 4
      [null, null, null, null, null, null, null, null, null], // row 5
      ['P', null, 'P', null, 'P', null, 'P', null, 'P'], // row 6: 초 병
      [null, 'C', null, null, null, null, null, 'C', null], // row 7: 초 포
      [null, null, null, null, 'K', null, null, null, null], // row 8: 초 궁
      ['R', 'E', 'N', 'A', null, 'A', 'N', 'E', 'R'], // row 9: 초
    ];
  }

  isChoPiece(piece) {
    return piece && piece === piece.toUpperCase();
  }

  getPieceColor(piece) {
    if (!piece) return null;
    return this.isChoPiece(piece) ? 'cho' : 'han';
  }

  getPieceAt(row, col) {
    if (!this.isValidPosition(row, col)) return undefined;
    return this.board[row][col];
  }

  isValidPosition(row, col) {
    return row >= 0 && row <= 9 && col >= 0 && col <= 8;
  }

  // 궁성 내부인지 확인
  isInPalace(row, col, color) {
    if (color === 'han') {
      return row >= 0 && row <= 2 && col >= 3 && col <= 5;
    } else {
      return row >= 7 && row <= 9 && col >= 3 && col <= 5;
    }
  }

  // 궁성 대각선 위치인지 확인
  isPalaceDiagonalPosition(row, col) {
    // 한 궁성 대각선 위치
    const hanDiagonals = [
      [0, 3],
      [0, 5],
      [1, 4],
      [2, 3],
      [2, 5],
    ];
    // 초 궁성 대각선 위치
    const choDiagonals = [
      [7, 3],
      [7, 5],
      [8, 4],
      [9, 3],
      [9, 5],
    ];

    return hanDiagonals.some(([r, c]) => r === row && c === col) || choDiagonals.some(([r, c]) => r === row && c === col);
  }

  getPossibleMoves(row, col) {
    const piece = this.getPieceAt(row, col);
    if (!piece) return [];

    const pieceType = piece.toLowerCase();
    let moves = [];

    switch (pieceType) {
      case 'k': // 궁(장)
        moves = this.getKingMoves(row, col, piece);
        break;
      case 'a': // 사
        moves = this.getAdvisorMoves(row, col, piece);
        break;
      case 'r': // 차
        moves = this.getChariotMoves(row, col, piece);
        break;
      case 'c': // 포
        moves = this.getCannonMoves(row, col, piece);
        break;
      case 'n': // 마
        moves = this.getHorseMoves(row, col, piece);
        break;
      case 'e': // 상
        moves = this.getElephantMoves(row, col, piece);
        break;
      case 'p': // 졸/병
        moves = this.getSoldierMoves(row, col, piece);
        break;
    }

    // 자살수 필터링 (왕이 잡히는 수 제외)
    return moves.filter(([toRow, toCol]) => !this.wouldBeInCheck(row, col, toRow, toCol, piece));
  }

  // 궁(장) 이동: 궁성 내에서 선을 따라 1칸
  getKingMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);

    // 기본 4방향
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    // 궁성 중앙이나 모서리에서는 대각선도 가능
    if (this.isPalaceDiagonalPosition(row, col)) {
      directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      if (this.isInPalace(newRow, newCol, color)) {
        // 대각선 이동은 대각선 위치에서만 가능
        if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
          if (!this.isPalaceDiagonalPosition(newRow, newCol)) continue;
        }

        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== color) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  // 사 이동: 궁성 내에서 선을 따라 1칸
  getAdvisorMoves(row, col, piece) {
    // 궁과 동일한 이동
    return this.getKingMoves(row, col, piece);
  }

  // 차 이동: 직선으로 무제한
  getChariotMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dr, dc] of directions) {
      let newRow = row + dr;
      let newCol = col + dc;

      while (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);

        if (!target) {
          moves.push([newRow, newCol]);
        } else {
          if (this.getPieceColor(target) !== color) {
            moves.push([newRow, newCol]);
          }
          break;
        }

        newRow += dr;
        newCol += dc;
      }
    }

    // 궁성 내 대각선 이동
    moves.push(...this.getChariotPalaceDiagonalMoves(row, col, piece));

    return moves;
  }

  // 차의 궁성 대각선 이동
  getChariotPalaceDiagonalMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);

    // 현재 위치가 궁성 대각선 위치인 경우에만
    if (!this.isPalaceDiagonalPosition(row, col)) return moves;

    const diagonals = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    for (const [dr, dc] of diagonals) {
      let newRow = row + dr;
      let newCol = col + dc;

      while (this.isPalaceDiagonalPosition(newRow, newCol) || (newRow === 1 && newCol === 4) || (newRow === 8 && newCol === 4)) {
        const target = this.getPieceAt(newRow, newCol);

        if (!target) {
          moves.push([newRow, newCol]);
        } else {
          if (this.getPieceColor(target) !== color) {
            moves.push([newRow, newCol]);
          }
          break;
        }

        // 궁성 대각선 범위 내에서만 계속
        if (!this.isPalaceDiagonalPosition(newRow, newCol)) break;

        newRow += dr;
        newCol += dc;
      }
    }

    return moves;
  }

  // 포 이동: 하나의 기물을 넘어서 이동/잡기 (포는 넘을 수 없음)
  getCannonMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);
    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const [dr, dc] of directions) {
      let newRow = row + dr;
      let newCol = col + dc;
      let jumped = false;
      let jumpedPiece = null;

      while (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);

        if (!jumped) {
          // 아직 넘지 않음
          if (target) {
            // 포는 포를 넘을 수 없음
            if (target.toLowerCase() === 'c') break;
            jumped = true;
            jumpedPiece = target;
          }
        } else {
          // 이미 넘음
          if (target) {
            // 포는 포를 잡을 수 없음
            if (target.toLowerCase() === 'c') break;
            if (this.getPieceColor(target) !== color) {
              moves.push([newRow, newCol]);
            }
            break;
          } else {
            moves.push([newRow, newCol]);
          }
        }

        newRow += dr;
        newCol += dc;
      }
    }

    // 궁성 내 대각선 이동
    moves.push(...this.getCannonPalaceDiagonalMoves(row, col, piece));

    return moves;
  }

  // 포의 궁성 대각선 이동
  getCannonPalaceDiagonalMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);

    if (!this.isPalaceDiagonalPosition(row, col)) return moves;

    const diagonals = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    for (const [dr, dc] of diagonals) {
      let newRow = row + dr;
      let newCol = col + dc;
      let jumped = false;

      while (this.isPalaceDiagonalPosition(newRow, newCol) || (newRow === 1 && newCol === 4) || (newRow === 8 && newCol === 4)) {
        const target = this.getPieceAt(newRow, newCol);

        if (!jumped) {
          if (target) {
            if (target.toLowerCase() === 'c') break;
            jumped = true;
          }
        } else {
          if (target) {
            if (target.toLowerCase() === 'c') break;
            if (this.getPieceColor(target) !== color) {
              moves.push([newRow, newCol]);
            }
            break;
          } else {
            moves.push([newRow, newCol]);
          }
        }

        if (!this.isPalaceDiagonalPosition(newRow, newCol)) break;

        newRow += dr;
        newCol += dc;
      }
    }

    return moves;
  }

  // 마 이동: 일(日)자, 경로 막힘 체크
  getHorseMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);

    // [이동 방향, 경로 체크 위치]
    const patterns = [
      { move: [-2, -1], block: [-1, 0] },
      { move: [-2, 1], block: [-1, 0] },
      { move: [2, -1], block: [1, 0] },
      { move: [2, 1], block: [1, 0] },
      { move: [-1, -2], block: [0, -1] },
      { move: [-1, 2], block: [0, 1] },
      { move: [1, -2], block: [0, -1] },
      { move: [1, 2], block: [0, 1] },
    ];

    for (const { move, block } of patterns) {
      const blockRow = row + block[0];
      const blockCol = col + block[1];

      // 경로에 기물이 있으면 막힘
      if (this.getPieceAt(blockRow, blockCol)) continue;

      const newRow = row + move[0];
      const newCol = col + move[1];

      if (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== color) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  // 상 이동: 전진 1칸 + 대각선 2칸, 경로 막힘 체크
  getElephantMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);

    // [최종 이동, 첫 번째 경로, 두 번째 경로]
    const patterns = [
      {
        move: [-3, -2],
        blocks: [
          [-1, 0],
          [-2, -1],
        ],
      },
      {
        move: [-3, 2],
        blocks: [
          [-1, 0],
          [-2, 1],
        ],
      },
      {
        move: [3, -2],
        blocks: [
          [1, 0],
          [2, -1],
        ],
      },
      {
        move: [3, 2],
        blocks: [
          [1, 0],
          [2, 1],
        ],
      },
      {
        move: [-2, -3],
        blocks: [
          [0, -1],
          [-1, -2],
        ],
      },
      {
        move: [-2, 3],
        blocks: [
          [0, 1],
          [-1, 2],
        ],
      },
      {
        move: [2, -3],
        blocks: [
          [0, -1],
          [1, -2],
        ],
      },
      {
        move: [2, 3],
        blocks: [
          [0, 1],
          [1, 2],
        ],
      },
    ];

    for (const { move, blocks } of patterns) {
      // 경로 체크
      let blocked = false;
      for (const [br, bc] of blocks) {
        if (this.getPieceAt(row + br, col + bc)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const newRow = row + move[0];
      const newCol = col + move[1];

      if (this.isValidPosition(newRow, newCol)) {
        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== color) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  // 졸/병 이동: 앞 또는 옆으로 1칸 (뒤로 못 감)
  getSoldierMoves(row, col, piece) {
    const moves = [];
    const color = this.getPieceColor(piece);
    const forward = color === 'cho' ? -1 : 1;

    // 앞, 좌, 우
    const directions = [
      [forward, 0],
      [0, -1],
      [0, 1],
    ];

    // 궁성 내 대각선
    if (this.isPalaceDiagonalPosition(row, col)) {
      directions.push([forward, -1], [forward, 1]);
    }

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      if (this.isValidPosition(newRow, newCol)) {
        // 대각선 이동은 궁성 대각선 위치에서만
        if (Math.abs(dc) === 1 && dr !== 0) {
          const inAnyPalace = this.isInPalace(newRow, newCol, 'cho') || this.isInPalace(newRow, newCol, 'han');
          if (!inAnyPalace) continue;
        }

        const target = this.getPieceAt(newRow, newCol);
        if (!target || this.getPieceColor(target) !== color) {
          moves.push([newRow, newCol]);
        }
      }
    }

    return moves;
  }

  // 해당 색의 궁 위치 찾기
  findKing(color) {
    const kingChar = color === 'cho' ? 'K' : 'k';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.board[row][col] === kingChar) {
          return [row, col];
        }
      }
    }
    return null;
  }

  // 특정 위치가 공격받는지 확인
  isSquareAttacked(row, col, byColor) {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const piece = this.board[r][c];
        if (piece && this.getPieceColor(piece) === byColor) {
          const moves = this.getRawMoves(r, c, piece);
          if (moves.some(([mr, mc]) => mr === row && mc === col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 자살수 체크 없이 이동 가능한 곳 반환
  getRawMoves(row, col, piece) {
    const pieceType = piece.toLowerCase();

    switch (pieceType) {
      case 'k':
        return this.getKingMoves(row, col, piece);
      case 'a':
        return this.getAdvisorMoves(row, col, piece);
      case 'r':
        return this.getChariotMoves(row, col, piece);
      case 'c':
        return this.getCannonMoves(row, col, piece);
      case 'n':
        return this.getHorseMoves(row, col, piece);
      case 'e':
        return this.getElephantMoves(row, col, piece);
      case 'p':
        return this.getSoldierMoves(row, col, piece);
      default:
        return [];
    }
  }

  // 이동 후 체크 상태인지 확인
  wouldBeInCheck(fromRow, fromCol, toRow, toCol, piece) {
    const color = this.getPieceColor(piece);
    const tempPiece = this.board[toRow][toCol];

    // 임시 이동
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    const kingPos = piece.toLowerCase() === 'k' ? [toRow, toCol] : this.findKing(color);

    const opponentColor = color === 'cho' ? 'han' : 'cho';
    const inCheck = kingPos && this.isSquareAttacked(kingPos[0], kingPos[1], opponentColor);

    // 원복
    this.board[fromRow][fromCol] = piece;
    this.board[toRow][toCol] = tempPiece;

    return inCheck;
  }

  // 체크 상태인지 확인
  isInCheck(color) {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;

    const opponentColor = color === 'cho' ? 'han' : 'cho';
    return this.isSquareAttacked(kingPos[0], kingPos[1], opponentColor);
  }

  // 체크메이트 확인
  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;
    return !this.hasLegalMoves(color);
  }

  // 스테일메이트 확인 (움직일 수 없는 상태)
  isStalemate(color) {
    if (this.isInCheck(color)) return false;
    return !this.hasLegalMoves(color);
  }

  // 합법적인 수가 있는지 확인
  hasLegalMoves(color) {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = this.board[row][col];
        if (piece && this.getPieceColor(piece) === color) {
          const moves = this.getPossibleMoves(row, col);
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  }

  // 기물 이동
  movePiece(fromRow, fromCol, toRow, toCol) {
    const piece = this.getPieceAt(fromRow, fromCol);
    if (!piece) return false;

    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

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

  getGameState() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      lastMove: this.lastMove,
      gameOver: this.gameOver,
    };
  }

  applyMove(moveData) {
    this.board = moveData.board;
    this.currentTurn = moveData.currentTurn;
    this.lastMove = moveData.lastMove || null;
    this.gameOver = moveData.gameOver || false;
  }
}
