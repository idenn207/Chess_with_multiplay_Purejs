// Chess Board Evaluation Function
// 보드 상태를 평가하여 점수를 반환

class ChessEvaluator {
  constructor() {
    this.pst = new PieceSquareTables();
  }

  /**
   * 보드 평가 함수 (AI 관점)
   * @param {ChessGame} game - 체스 게임 인스턴스
   * @param {string} aiColor - AI 색상 ('white' or 'black')
   * @returns {number} 평가 점수 (양수: AI 유리, 음수: 상대 유리)
   */
  evaluate(game, aiColor) {
    let score = 0;

    // 1. 기물 가치 평가
    score += this.evaluateMaterial(game, aiColor);

    // 2. 위치 가치 평가 (Piece-Square Tables)
    score += this.evaluatePosition(game, aiColor);

    // 3. 기동성 평가 (가능한 이동 수)
    score += this.evaluateMobility(game, aiColor);

    // 4. 킹 안전성 평가
    score += this.evaluateKingSafety(game, aiColor);

    // 5. 폰 구조 평가
    score += this.evaluatePawnStructure(game, aiColor);

    return score;
  }

  /**
   * 기물 가치 평가
   */
  evaluateMaterial(game, aiColor) {
    let score = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const value = game.getPieceValue(piece);
        const pieceColor = game.getPieceColor(piece);

        if (pieceColor === aiColor) {
          score += value;
        } else {
          score -= value;
        }
      }
    }

    return score;
  }

  /**
   * 위치 가치 평가 (Piece-Square Tables)
   */
  evaluatePosition(game, aiColor) {
    let score = 0;
    const isEndGame = this.isEndGame(game);

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const pieceType = piece.toLowerCase();
        const isWhite = game.isWhitePiece(piece);
        const pieceColor = game.getPieceColor(piece);
        const posValue = this.pst.getValue(pieceType, row, col, isWhite, isEndGame);

        if (pieceColor === aiColor) {
          score += posValue;
        } else {
          score -= posValue;
        }
      }
    }

    // 위치 가치는 기물 가치의 10% 정도 가중치
    return score * 0.1;
  }

  /**
   * 기동성 평가 (이동 가능한 수)
   */
  evaluateMobility(game, aiColor) {
    const opponentColor = aiColor === 'white' ? 'black' : 'white';

    // AI 이동 가능 수
    const aiMoves = game.getAllLegalMoves(aiColor).length;

    // 상대 이동 가능 수 (턴을 임시로 변경)
    const originalTurn = game.currentTurn;
    game.currentTurn = opponentColor;
    const opponentMoves = game.getAllLegalMoves(opponentColor).length;
    game.currentTurn = originalTurn;

    // 이동 수 차이에 가중치
    return (aiMoves - opponentMoves) * 5;
  }

  /**
   * 킹 안전성 평가
   */
  evaluateKingSafety(game, aiColor) {
    let score = 0;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';

    // AI 킹 안전성
    const aiKingPos = game.kingPositions[aiColor];
    if (game.castlingRights[aiColor].kingSide || game.castlingRights[aiColor].queenSide) {
      score += 30; // 캐슬링 가능 보너스
    }
    score += this.countPawnShield(game, aiKingPos, aiColor) * 10;

    // 상대 킹 안전성 (차감)
    const opponentKingPos = game.kingPositions[opponentColor];
    if (
      game.castlingRights[opponentColor].kingSide ||
      game.castlingRights[opponentColor].queenSide
    ) {
      score -= 30;
    }
    score -= this.countPawnShield(game, opponentKingPos, opponentColor) * 10;

    return score;
  }

  /**
   * 킹 주변 폰 실드 개수 카운트
   */
  countPawnShield(game, kingPos, color) {
    const [row, col] = kingPos;
    const direction = color === 'white' ? -1 : 1;
    let count = 0;

    // 킹 앞 3칸 확인
    for (let dc = -1; dc <= 1; dc++) {
      const checkRow = row + direction;
      const checkCol = col + dc;

      if (checkRow >= 0 && checkRow < 8 && checkCol >= 0 && checkCol < 8) {
        const piece = game.board[checkRow][checkCol];
        if (piece && piece.toLowerCase() === 'p' && game.getPieceColor(piece) === color) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 폰 구조 평가
   */
  evaluatePawnStructure(game, aiColor) {
    let score = 0;
    const opponentColor = aiColor === 'white' ? 'black' : 'white';

    // 각 열(col)별로 폰 분석
    for (let col = 0; col < 8; col++) {
      let aiPawns = 0;
      let opponentPawns = 0;

      for (let row = 0; row < 8; row++) {
        const piece = game.board[row][col];
        if (piece && piece.toLowerCase() === 'p') {
          if (game.getPieceColor(piece) === aiColor) {
            aiPawns++;
          } else {
            opponentPawns++;
          }
        }
      }

      // 더블 폰 페널티 (같은 열에 2개 이상)
      if (aiPawns > 1) {
        score -= 15 * (aiPawns - 1);
      }
      if (opponentPawns > 1) {
        score += 15 * (opponentPawns - 1);
      }
    }

    // 고립 폰 페널티 (양옆 열에 아군 폰 없음)
    for (let col = 0; col < 8; col++) {
      let hasAiPawn = false;
      for (let row = 0; row < 8; row++) {
        const piece = game.board[row][col];
        if (piece && piece.toLowerCase() === 'p' && game.getPieceColor(piece) === aiColor) {
          hasAiPawn = true;
          break;
        }
      }

      if (hasAiPawn) {
        const hasNeighbor = this.hasAdjacentPawns(game, col, aiColor);
        if (!hasNeighbor) {
          score -= 20; // 고립 폰 페널티
        }
      }
    }

    return score;
  }

  /**
   * 인접한 열에 같은 색 폰이 있는지 확인
   */
  hasAdjacentPawns(game, col, color) {
    for (const dc of [-1, 1]) {
      const checkCol = col + dc;
      if (checkCol >= 0 && checkCol < 8) {
        for (let row = 0; row < 8; row++) {
          const piece = game.board[row][checkCol];
          if (piece && piece.toLowerCase() === 'p' && game.getPieceColor(piece) === color) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 엔드게임 판정
   * 퀸이 없거나 기물이 적으면 엔드게임
   */
  isEndGame(game) {
    let queens = 0;
    let minorPieces = 0; // 나이트, 비숍

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const type = piece.toLowerCase();
        if (type === 'q') queens++;
        if (type === 'n' || type === 'b') minorPieces++;
      }
    }

    // 퀸이 없거나, 퀸 1-2개 + 마이너 피스 2개 이하
    return queens === 0 || (queens <= 2 && minorPieces <= 2);
  }
}
