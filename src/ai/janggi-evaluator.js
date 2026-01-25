// Janggi Board Evaluation Function
// 장기 보드 상태를 평가하여 점수를 반환

class JanggiEvaluator {
  constructor() {
    this.pst = new JanggiPieceSquareTables();

    // 전통 장기 기물 가치 (점 단위 x 10)
    this.pieceValues = {
      k: 0, // 궁: priceless (체크메이트로 처리)
      r: 130, // 차: 13점
      c: 70, // 포: 7점
      n: 50, // 마: 5점
      e: 30, // 상: 3점
      a: 30, // 사: 3점
      p: 20, // 졸/병: 2점
    };
  }

  /**
   * 보드 평가 함수 (AI 관점)
   * @param {JanggiGame} game - 장기 게임 인스턴스
   * @param {string} aiColor - AI 색상 ('cho' or 'han')
   * @returns {number} 평가 점수 (양수: AI 유리, 음수: 상대 유리)
   */
  evaluate(game, aiColor) {
    let score = 0;

    // 1. 기물 가치 평가
    score += this.evaluateMaterial(game, aiColor);

    // 2. 위치 가치 평가 (Piece-Square Tables)
    score += this.evaluatePosition(game, aiColor);

    // 3. 기동성 평가 (이동 가능한 수)
    score += this.evaluateMobility(game, aiColor);

    // 4. 궁 안전성 평가
    score += this.evaluateKingSafety(game, aiColor);

    // 5. 위협 평가 (기물 공격/방어)
    score += this.evaluateThreats(game, aiColor);

    return score;
  }

  /**
   * 기물 가치 평가
   */
  evaluateMaterial(game, aiColor) {
    let score = 0;

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const pieceType = piece.toLowerCase();
        const value = this.pieceValues[pieceType] || 0;
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

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const pieceType = piece.toLowerCase();
        const isCho = game.isChoPiece(piece);
        const pieceColor = game.getPieceColor(piece);
        const posValue = this.pst.getValue(pieceType, row, col, isCho);

        if (pieceColor === aiColor) {
          score += posValue;
        } else {
          score -= posValue;
        }
      }
    }

    // 위치 가치는 기물 가치의 15% 정도 가중치
    return score * 0.15;
  }

  /**
   * 기동성 평가 (이동 가능한 수)
   */
  evaluateMobility(game, aiColor) {
    let aiMoves = 0;
    let opponentMoves = 0;

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const pieceColor = game.getPieceColor(piece);
        const moves = game.getPossibleMoves(row, col);

        if (pieceColor === aiColor) {
          aiMoves += moves.length;
        } else {
          opponentMoves += moves.length;
        }
      }
    }

    // 이동 수 차이에 가중치
    return (aiMoves - opponentMoves) * 3;
  }

  /**
   * 궁 안전성 평가
   */
  evaluateKingSafety(game, aiColor) {
    let score = 0;
    const opponentColor = aiColor === 'cho' ? 'han' : 'cho';

    // AI 궁 안전성
    const aiKingPos = game.findKing(aiColor);
    if (aiKingPos) {
      // 체크 상태 페널티
      if (game.isInCheck(aiColor)) {
        score -= 50;
      }

      // 궁 주변 방어 기물 보너스
      score += this.countDefenders(game, aiKingPos, aiColor) * 10;

      // 궁성 중앙 보너스
      if (this.isKingCentered(aiKingPos, aiColor)) {
        score += 15;
      }
    }

    // 상대 궁 안전성 (역산)
    const opponentKingPos = game.findKing(opponentColor);
    if (opponentKingPos) {
      if (game.isInCheck(opponentColor)) {
        score += 50;
      }
      score -= this.countDefenders(game, opponentKingPos, opponentColor) * 10;
    }

    return score;
  }

  /**
   * 궁 주변 방어 기물 수 카운트
   */
  countDefenders(game, kingPos, color) {
    let count = 0;

    // 궁성 내 사 기물 체크
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        if (piece.toLowerCase() === 'a' && game.getPieceColor(piece) === color) {
          // 궁과 같은 궁성 내에 있으면 방어 카운트
          if (game.isInPalace(row, col, color)) {
            count++;
          }
        }
      }
    }

    return count;
  }

  /**
   * 궁이 궁성 중앙에 있는지 확인
   */
  isKingCentered(kingPos, color) {
    const [row, col] = kingPos;
    const centerRow = color === 'cho' ? 8 : 1;
    const centerCol = 4;
    return row === centerRow && col === centerCol;
  }

  /**
   * 위협 평가 (기물 공격/방어)
   */
  evaluateThreats(game, aiColor) {
    let score = 0;
    const opponentColor = aiColor === 'cho' ? 'han' : 'cho';

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        const pieceColor = game.getPieceColor(piece);
        const pieceValue = this.pieceValues[piece.toLowerCase()] || 0;

        // 상대 기물이 공격받는 경우 (AI 유리)
        if (pieceColor === opponentColor) {
          if (game.isSquareAttacked(row, col, aiColor)) {
            score += pieceValue * 0.1;
          }
        }
        // AI 기물이 공격받는 경우 (AI 불리)
        else {
          if (game.isSquareAttacked(row, col, opponentColor)) {
            score -= pieceValue * 0.1;
          }
        }
      }
    }

    return score;
  }

  /**
   * 엔드게임 판정
   * 차가 없거나 기물이 적으면 엔드게임
   */
  isEndGame(game) {
    let chariots = 0;
    let totalPieces = 0;

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;

        totalPieces++;
        if (piece.toLowerCase() === 'r') chariots++;
      }
    }

    // 차가 없거나, 기물이 10개 이하면 엔드게임
    return chariots === 0 || totalPieces <= 10;
  }
}
