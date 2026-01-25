// Janggi AI using Minimax with Alpha-Beta Pruning
// Pure JavaScript 장기 AI 엔진

class JanggiAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.depth = this.getDepthByDifficulty(difficulty);
    this.evaluator = new JanggiEvaluator();
    this.nodesSearched = 0;

    // 4가지 포진 옵션
    this.formations = ['masang', 'sangma', 'gwima-left', 'gwima-right'];
  }

  /**
   * 난이도에 따른 탐색 깊이 반환
   */
  getDepthByDifficulty(difficulty) {
    const depths = {
      easy: 2, // ~0.5초, 초급
      medium: 3, // ~2-3초, 중급
      hard: 4, // ~5-10초, 고급
    };
    return depths[difficulty] || 3;
  }

  /**
   * AI 포진 선택 (랜덤)
   * @returns {string} 포진 ID
   */
  selectFormation() {
    const index = Math.floor(Math.random() * this.formations.length);
    return this.formations[index];
  }

  /**
   * 최선의 수 찾기
   * @param {JanggiGame} game - 장기 게임 인스턴스
   * @param {string} color - AI 색상 ('cho' or 'han')
   * @returns {Object|null} {from: [r,c], to: [r,c], piece: string, capturedPiece: string|null}
   */
  findBestMove(game, color) {
    this.nodesSearched = 0;
    const startTime = Date.now();

    const moves = this.getAllLegalMoves(game, color);
    if (moves.length === 0) return null;

    // 이동 순서 정렬 (MVV-LVA + 전략적 우선순위)
    this.sortMoves(moves, game, color);

    let bestMove = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of moves) {
      // 게임 상태 복사 및 이동 실행
      const gameClone = this.cloneGame(game);
      gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);

      // 턴 변경
      gameClone.currentTurn = color === 'cho' ? 'han' : 'cho';

      // Minimax with Alpha-Beta Pruning
      const value = this.minimax(gameClone, this.depth - 1, alpha, beta, false, color);

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }

      alpha = Math.max(alpha, value);
    }

    const elapsed = Date.now() - startTime;
    console.log(`장기 AI 탐색 완료: ${this.nodesSearched}개 노드, ${elapsed}ms`);

    return bestMove;
  }

  /**
   * Minimax 알고리즘 (Alpha-Beta Pruning)
   * @param {JanggiGame} game - 게임 상태
   * @param {number} depth - 남은 탐색 깊이
   * @param {number} alpha - 알파 값 (최대화 플레이어 하한)
   * @param {number} beta - 베타 값 (최소화 플레이어 상한)
   * @param {boolean} isMaximizing - 최대화 노드 여부
   * @param {string} aiColor - AI 색상
   * @returns {number} 평가 점수
   */
  minimax(game, depth, alpha, beta, isMaximizing, aiColor) {
    this.nodesSearched++;

    // 터미널 노드: 깊이 0 도달
    if (depth === 0) {
      return this.evaluator.evaluate(game, aiColor);
    }

    const currentColor = game.currentTurn;

    // 체크메이트 확인
    if (game.isCheckmate(currentColor)) {
      // 체크메이트: 매우 큰 점수 (depth 반영하여 빠른 메이트 선호)
      return isMaximizing ? -100000 + (this.depth - depth) : 100000 - (this.depth - depth);
    }

    // 스테일메이트 확인
    if (game.isStalemate(currentColor)) {
      return 0; // 무승부
    }

    const moves = this.getAllLegalMoves(game, currentColor);
    if (moves.length === 0) {
      return 0; // 이동 불가 (무승부)
    }

    // 이동 순서 정렬
    this.sortMoves(moves, game, currentColor);

    if (isMaximizing) {
      // Max 노드: AI 턴
      let maxEval = -Infinity;

      for (const move of moves) {
        const gameClone = this.cloneGame(game);
        gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);
        gameClone.currentTurn = currentColor === 'cho' ? 'han' : 'cho';

        const evaluation = this.minimax(gameClone, depth - 1, alpha, beta, false, aiColor);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);

        // Beta 컷오프 (가지치기)
        if (beta <= alpha) {
          break;
        }
      }

      return maxEval;
    } else {
      // Min 노드: 상대 턴
      let minEval = Infinity;

      for (const move of moves) {
        const gameClone = this.cloneGame(game);
        gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);
        gameClone.currentTurn = currentColor === 'cho' ? 'han' : 'cho';

        const evaluation = this.minimax(gameClone, depth - 1, alpha, beta, true, aiColor);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);

        // Alpha 컷오프 (가지치기)
        if (beta <= alpha) {
          break;
        }
      }

      return minEval;
    }
  }

  /**
   * 특정 색상의 모든 합법 이동 반환
   */
  getAllLegalMoves(game, color) {
    const moves = [];

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = game.board[row][col];
        if (!piece) continue;
        if (game.getPieceColor(piece) !== color) continue;

        const possibleMoves = game.getPossibleMoves(row, col);
        for (const [toRow, toCol] of possibleMoves) {
          moves.push({
            from: [row, col],
            to: [toRow, toCol],
            piece: piece,
            capturedPiece: game.board[toRow][toCol],
          });
        }
      }
    }

    return moves;
  }

  /**
   * 이동 순서 정렬 (장기 특화 MVV-LVA + 전략적 우선순위)
   */
  sortMoves(moves, game, color) {
    const pieceValues = {
      k: 10000, // 궁 (실제로는 잡을 수 없음)
      r: 130, // 차
      c: 70, // 포
      n: 50, // 마
      e: 30, // 상
      a: 30, // 사
      p: 20, // 졸/병
    };

    moves.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;

      // 1. 체크 주는 수 최우선
      const aGivesCheck = this.moveCausesCheck(game, a, color);
      const bGivesCheck = this.moveCausesCheck(game, b, color);
      if (aGivesCheck && !bGivesCheck) return -1;
      if (!aGivesCheck && bGivesCheck) return 1;

      // 2. MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
      if (a.capturedPiece) {
        const victimValue = pieceValues[a.capturedPiece.toLowerCase()] || 0;
        const attackerValue = pieceValues[a.piece.toLowerCase()] || 0;
        aScore = victimValue * 10 - attackerValue;
      }
      if (b.capturedPiece) {
        const victimValue = pieceValues[b.capturedPiece.toLowerCase()] || 0;
        const attackerValue = pieceValues[b.piece.toLowerCase()] || 0;
        bScore = victimValue * 10 - attackerValue;
      }

      // 캡처 점수가 다르면 높은 순
      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // 3. 차/포 이동 우선 (활동적인 기물)
      const aPieceType = a.piece.toLowerCase();
      const bPieceType = b.piece.toLowerCase();

      const activePiecePriority = { r: 3, c: 2, n: 1, e: 0, a: 0, p: 0, k: -1 };
      const aPriority = activePiecePriority[aPieceType] || 0;
      const bPriority = activePiecePriority[bPieceType] || 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // 4. 전진 이동 보너스 (졸/병)
      if (aPieceType === 'p') {
        const aForward = game.isChoPiece(a.piece) ? a.from[0] - a.to[0] : a.to[0] - a.from[0];
        aScore += aForward > 0 ? 5 : 0;
      }
      if (bPieceType === 'p') {
        const bForward = game.isChoPiece(b.piece) ? b.from[0] - b.to[0] : b.to[0] - b.from[0];
        bScore += bForward > 0 ? 5 : 0;
      }

      return bScore - aScore;
    });
  }

  /**
   * 이동이 체크를 주는지 확인
   */
  moveCausesCheck(game, move, color) {
    const gameClone = this.cloneGame(game);
    gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);

    const opponentColor = color === 'cho' ? 'han' : 'cho';
    return gameClone.isInCheck(opponentColor);
  }

  /**
   * 게임 상태 복사 (깊은 복사)
   */
  cloneGame(game) {
    const clone = new JanggiGame();

    // 보드 복사
    clone.board = game.board.map((row) => [...row]);

    // 상태 복사
    clone.currentTurn = game.currentTurn;
    clone.myColor = game.myColor;
    clone.gameOver = game.gameOver;
    clone.lastMove = game.lastMove ? { ...game.lastMove } : null;
    clone.choFormation = game.choFormation;
    clone.hanFormation = game.hanFormation;
    clone.formationsReady = game.formationsReady;

    return clone;
  }
}
