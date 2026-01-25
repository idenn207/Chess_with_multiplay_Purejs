// Gomoku AI using Minimax with Alpha-Beta Pruning
// Pure JavaScript 오목 AI 엔진

class GomokuAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.depth = this.getDepthByDifficulty(difficulty);
    this.evaluator = new GomokuEvaluator();
    this.nodesSearched = 0;
  }

  /**
   * 난이도에 따른 탐색 깊이 반환
   */
  getDepthByDifficulty(difficulty) {
    const depths = {
      easy: 2, // ~0.3-0.5초, 초급
      medium: 3, // ~1-2초, 중급
      hard: 4, // ~3-6초, 고급
    };
    return depths[difficulty] || 3;
  }

  /**
   * 최선의 수 찾기
   * @param {GomokuGame} game - 오목 게임 인스턴스
   * @param {string} color - AI 색상 ('black' or 'white')
   * @returns {Object|null} {row, col}
   */
  findBestMove(game, color) {
    this.nodesSearched = 0;
    const startTime = Date.now();

    const moves = game.getAllPossibleMoves(color);
    if (moves.length === 0) return null;

    // 이동 순서 정렬 (매우 중요!)
    this.sortMoves(moves, game, color);

    let bestMove = null;
    let bestValue = -Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of moves) {
      // 게임 상태 복사 및 이동 실행
      const gameClone = game.cloneGame();
      gameClone.simulateMove(move.row, move.col, color);

      // 턴 변경
      gameClone.currentTurn = color === 'black' ? 'white' : 'black';

      // Minimax with Alpha-Beta Pruning
      const value = this.minimax(gameClone, this.depth - 1, alpha, beta, false, color);

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }

      alpha = Math.max(alpha, value);
    }

    const elapsed = Date.now() - startTime;
    console.log(`오목 AI 탐색 완료: ${this.nodesSearched}개 노드, ${elapsed}ms`);

    return bestMove;
  }

  /**
   * Minimax 알고리즘 (Alpha-Beta Pruning)
   * @param {GomokuGame} game - 게임 상태
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

    // 게임 종료 확인
    if (game.gameOver) {
      if (game.winningLine.length > 0) {
        // 승리: 매우 큰 점수 (depth 반영하여 빠른 승리 선호)
        const winner = game.board[game.winningLine[0].row][game.winningLine[0].col];
        return winner === aiColor
          ? 100000 + depth * 100 // AI 승리: 빠를수록 좋음
          : -100000 - depth * 100; // AI 패배: 느릴수록 좋음
      }
      return 0; // 무승부 (보드 꽉 참)
    }

    const currentColor = game.currentTurn;
    const moves = game.getAllPossibleMoves(currentColor);
    if (moves.length === 0) return 0; // 이동 불가 (무승부)

    // 이동 순서 정렬
    this.sortMoves(moves, game, currentColor);

    if (isMaximizing) {
      // Max 노드: AI 턴
      let maxEval = -Infinity;

      for (const move of moves) {
        const gameClone = game.cloneGame();
        gameClone.simulateMove(move.row, move.col, currentColor);
        gameClone.currentTurn = currentColor === 'black' ? 'white' : 'black';

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
        gameClone.simulateMove(move.row, move.col, currentColor);
        gameClone.currentTurn = currentColor === 'black' ? 'white' : 'black';

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
   * 이동 순서 정렬
   * 가치 높은 수를 우선 탐색하여 Alpha-Beta 효율 증가
   * @param {Array} moves - 이동 목록
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {string} color - 색상
   */
  sortMoves(moves, game, color) {
    const scoredMoves = moves.map((move) => {
      const { row, col } = move;
      let orderScore = 0;

      // 1. 승리 수 체크 (최우선)
      game.board[row][col] = color;
      if (game.checkWin(row, col, color)) {
        orderScore = 1000000; // 즉시 승리
      }
      game.board[row][col] = null;

      // 2. 수비 수 체크 (상대방 승리 막기)
      const opponentColor = color === 'black' ? 'white' : 'black';
      game.board[row][col] = opponentColor;
      if (game.checkWin(row, col, opponentColor)) {
        orderScore = 900000; // 두 번째 우선
      }
      game.board[row][col] = null;

      // 3. 패턴 평가 (공격 패턴 점수)
      orderScore += this.evaluator.evaluatePosition(game, row, col, color);

      return { move, orderScore };
    });

    // 점수 높은 순으로 정렬
    scoredMoves.sort((a, b) => b.orderScore - a.orderScore);

    // moves 배열 업데이트 (in-place)
    moves.length = 0;
    moves.push(...scoredMoves.map((sm) => sm.move));
  }
}
