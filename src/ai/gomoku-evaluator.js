// Gomoku Board Evaluation Function
// 오목 보드 상태를 평가하여 점수를 반환 (패턴 기반)

class GomokuEvaluator {
  constructor() {
    // 4가지 방향: 가로, 세로, 대각선 2개
    this.DIRECTIONS = [
      { dr: 0, dc: 1 }, // 가로 →
      { dr: 1, dc: 0 }, // 세로 ↓
      { dr: 1, dc: 1 }, // 대각선 \
      { dr: 1, dc: -1 }, // 대각선 /
    ];
  }

  /**
   * 보드 평가 함수 (AI 관점)
   * @param {GomokuGame} game - 오목 게임 인스턴스
   * @param {string} aiColor - AI 색상 ('black' or 'white')
   * @returns {number} 평가 점수 (양수: AI 유리, 음수: 상대 유리)
   */
  evaluate(game, aiColor) {
    const opponentColor = aiColor === 'black' ? 'white' : 'black';

    let score = 0;

    // 1. 패턴 평가 (80% 비중)
    score += this.evaluatePatterns(game, aiColor);
    score -= this.evaluatePatterns(game, opponentColor) * 0.9; // 공격 우선

    // 2. 위협 탐지 (critical)
    score += this.evaluateThreat(game, aiColor);

    // 3. 위치 가치 (10% 비중)
    score += this.evaluatePositionalAdvantage(game, aiColor);

    return score;
  }

  /**
   * 패턴 평가: 보드 전체의 패턴 점수 계산
   */
  evaluatePatterns(game, color) {
    let score = 0;

    // 모든 칸에 대해 패턴 분석
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (game.board[row][col] === color) {
          // 해당 색상의 돌에서 4방향 패턴 분석
          for (const { dr, dc } of this.DIRECTIONS) {
            const pattern = this.analyzeDirection(game, row, col, color, dr, dc);
            score += this.scorePattern(pattern);
          }
        }
      }
    }

    return score;
  }

  /**
   * 특정 위치에 돌을 놓았을 때의 패턴 평가 (move ordering용)
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {string} color - 돌 색상
   * @returns {number} 해당 위치의 패턴 점수
   */
  evaluatePosition(game, row, col, color) {
    // 임시로 돌을 놓고 평가
    game.board[row][col] = color;

    let score = 0;

    for (const { dr, dc } of this.DIRECTIONS) {
      const pattern = this.analyzeDirection(game, row, col, color, dr, dc);
      score += this.scorePattern(pattern);
    }

    // 임시 돌 제거
    game.board[row][col] = null;
    return score;
  }

  /**
   * 특정 방향으로 패턴 분석
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {number} row - 시작 행
   * @param {number} col - 시작 열
   * @param {string} color - 돌 색상
   * @param {number} dr - 행 방향
   * @param {number} dc - 열 방향
   * @returns {Object} {count: 연속 개수, openEnds: 열린 끝 개수}
   */
  analyzeDirection(game, row, col, color, dr, dc) {
    let count = 1; // 현재 돌 포함
    let openEnds = 0;

    // 정방향 탐색
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === color) {
      count++;
      r += dr;
      c += dc;
    }
    // 정방향 끝이 빈 칸이면 열린 끝
    if (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === null) {
      openEnds++;
    }

    // 역방향 탐색
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === color) {
      count++;
      r -= dr;
      c -= dc;
    }
    // 역방향 끝이 빈 칸이면 열린 끝
    if (r >= 0 && r < 15 && c >= 0 && c < 15 && game.board[r][c] === null) {
      openEnds++;
    }

    return { count, openEnds };
  }

  /**
   * 패턴에 따른 점수 부여
   * @param {Object} pattern - {count, openEnds}
   * @returns {number} 패턴 점수
   */
  scorePattern({ count, openEnds }) {
    // 5개: 즉시 승리
    if (count >= 5) return 100000;

    // 4개
    if (count === 4) {
      if (openEnds === 2) return 50000; // 활사 (Open Four): _XXXX_
      if (openEnds === 1) return 10000; // 사 (Four): XXXX_ or _XXXX
    }

    // 3개
    if (count === 3) {
      if (openEnds === 2) return 5000; // 활삼 (Open Three): _XXX_
      if (openEnds === 1) return 1000; // 삼 (Three): XXX_ or _XXX
    }

    // 2개
    if (count === 2) {
      if (openEnds === 2) return 500; // 활이 (Open Two): _XX_
      if (openEnds === 1) return 100; // 이 (Two): XX_ or _XX
    }

    return 0;
  }

  /**
   * 위협 탐지 및 평가
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {string} aiColor - AI 색상
   * @returns {number} 위협 점수
   */
  evaluateThreat(game, aiColor) {
    const opponentColor = aiColor === 'black' ? 'white' : 'black';

    // 상대방의 최대 위협 탐지
    const opponentMaxThreat = this.findMaxThreat(game, opponentColor);

    // 내 최대 위협 탐지
    const myMaxThreat = this.findMaxThreat(game, aiColor);

    // 상대방 활사: 거의 패배
    if (opponentMaxThreat >= 50000) return -40000;

    // 상대방 사: 막아야 함
    if (opponentMaxThreat >= 10000) return -8000;

    // 내 활사: 거의 승리
    if (myMaxThreat >= 50000) return 45000;

    return 0;
  }

  /**
   * 특정 색상의 최대 위협 점수 찾기
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {string} color - 색상
   * @returns {number} 최대 위협 점수
   */
  findMaxThreat(game, color) {
    let maxScore = 0;

    // 모든 빈 칸에 대해 평가
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (game.board[r][c] === null) {
          const score = this.evaluatePosition(game, r, c, color);
          maxScore = Math.max(maxScore, score);
        }
      }
    }

    return maxScore;
  }

  /**
   * 위치 가치 평가 (중앙 선호, 기존 돌과의 근접성)
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {string} aiColor - AI 색상
   * @returns {number} 위치 가치 점수
   */
  evaluatePositionalAdvantage(game, aiColor) {
    let score = 0;

    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (game.board[row][col] === aiColor) {
          // 중앙 선호 보너스
          score += this.evaluateCenterControl(row, col);

          // 기존 돌과의 근접성 보너스
          score += this.evaluateProximity(game, row, col, aiColor);
        }
      }
    }

    return score * 0.1; // 가중치: 10%
  }

  /**
   * 중앙 제어 점수
   * @param {number} row - 행
   * @param {number} col - 열
   * @returns {number} 중앙 점수
   */
  evaluateCenterControl(row, col) {
    const center = 7; // 15x15 보드의 중앙
    const distance = Math.abs(row - center) + Math.abs(col - center);

    // 중앙에서 멀어질수록 점수 감소
    return Math.max(0, 100 - distance * 5);
  }

  /**
   * 기존 돌과의 근접성 점수
   * @param {GomokuGame} game - 게임 인스턴스
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {string} color - 색상
   * @returns {number} 근접성 점수
   */
  evaluateProximity(game, row, col, color) {
    let score = 0;

    // 주변 5x5 영역 탐색
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;

        const checkRow = row + dr;
        const checkCol = col + dc;

        if (checkRow >= 0 && checkRow < 15 && checkCol >= 0 && checkCol < 15) {
          const stone = game.board[checkRow][checkCol];
          if (stone === color) {
            // 같은 색 돌과 가까울수록 보너스
            const distance = Math.abs(dr) + Math.abs(dc);
            score += Math.max(0, 50 - distance * 10);
          }
        }
      }
    }

    return score;
  }
}
