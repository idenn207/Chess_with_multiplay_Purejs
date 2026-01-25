// Chess AI using Minimax with Alpha-Beta Pruning
// Pure JavaScript 체스 AI 엔진

class ChessAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.depth = this.getDepthByDifficulty(difficulty);
    this.evaluator = new ChessEvaluator();
    this.nodesSearched = 0;
  }

  /**
   * 난이도에 따른 탐색 깊이 반환
   */
  getDepthByDifficulty(difficulty) {
    const depths = {
      easy: 2, // ~0.5초, 초급
      medium: 3, // ~2초, 중급
      hard: 4, // ~5초, 고급
    };
    return depths[difficulty] || 3;
  }

  /**
   * 최선의 수 찾기
   * @param {ChessGame} game - 체스 게임 인스턴스
   * @param {string} color - AI 색상 ('white' or 'black')
   * @returns {Object|null} {from: [r,c], to: [r,c], piece: string, capturedPiece: string|null}
   */
  findBestMove(game, color) {
    this.nodesSearched = 0;
    const startTime = Date.now();

    const moves = game.getAllLegalMoves(color);
    if (moves.length === 0) return null;

    // 이동 순서 정렬 (MVV-LVA: Most Valuable Victim - Least Valuable Attacker)
    this.sortMoves(moves, game);

    let bestMove = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of moves) {
      // 게임 상태 복사 및 이동 실행
      const gameClone = game.cloneGame();
      gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);

      // 턴 변경
      gameClone.currentTurn = color === 'white' ? 'black' : 'white';

      // Minimax with Alpha-Beta Pruning
      const value = this.minimax(gameClone, this.depth - 1, alpha, beta, false, color);

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }

      alpha = Math.max(alpha, value);
    }

    const elapsed = Date.now() - startTime;
    console.log(`AI 탐색 완료: ${this.nodesSearched}개 노드, ${elapsed}ms`);

    return bestMove;
  }

  /**
   * Minimax 알고리즘 (Alpha-Beta Pruning)
   * @param {ChessGame} game - 게임 상태
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

    const moves = game.getAllLegalMoves(currentColor);
    if (moves.length === 0) {
      return 0; // 이동 불가 (무승부)
    }

    // 이동 순서 정렬
    this.sortMoves(moves, game);

    if (isMaximizing) {
      // Max 노드: AI 턴
      let maxEval = -Infinity;

      for (const move of moves) {
        const gameClone = game.cloneGame();
        gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);
        gameClone.currentTurn = currentColor === 'white' ? 'black' : 'white';

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
        const gameClone = game.cloneGame();
        gameClone.movePiece(move.from[0], move.from[1], move.to[0], move.to[1]);
        gameClone.currentTurn = currentColor === 'white' ? 'black' : 'white';

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
   * 이동 순서 정렬 (MVV-LVA)
   * 가치 높은 기물을 잡는 수를 우선 탐색하여 Alpha-Beta 효율 증가
   * @param {Array} moves - 이동 목록
   * @param {ChessGame} game - 게임 인스턴스
   */
  sortMoves(moves, game) {
    moves.sort((a, b) => {
      // 캡처 점수 계산
      const aCapture = a.capturedPiece ? game.getPieceValue(a.capturedPiece) : 0;
      const bCapture = b.capturedPiece ? game.getPieceValue(b.capturedPiece) : 0;

      // 캡처 가치가 다르면 높은 순
      if (aCapture !== bCapture) {
        return bCapture - aCapture;
      }

      // 캡처 가치가 같으면 공격자 가치 낮은 순 (작은 기물로 큰 기물 잡기 선호)
      const aAttacker = game.getPieceValue(a.piece);
      const bAttacker = game.getPieceValue(b.piece);
      return aAttacker - bAttacker;
    });
  }
}
