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
    this.lastMove = null;
  }

  resetBoard() {
    this.board = Array(15)
      .fill(null)
      .map(() => Array(15).fill(null));
    this.currentTurn = 'black';
    this.gameOver = false;
    this.moveHistory = [];
    this.winningLine = [];
    this.lastMove = null;
  }

  reset() {
    this.resetBoard();
    // myColor는 유지
  }

  isValidMove(row, col) {
    if (row < 0 || row >= 15 || col < 0 || col >= 15) return false;
    if (this.board[row][col] !== null) return false;

    // 흑돌(선공)의 경우 금지 규칙 적용
    if (this.currentTurn === 'black') {
      // 삼삼(3-3) 금지
      if (this.isDoubleThree(row, col, 'black')) {
        return false;
      }
      // 장육(6목 이상) 금지
      if (this.isOverline(row, col, 'black')) {
        return false;
      }
    }

    return true;
  }

  /**
   * 장육(6목 이상) 체크: 해당 위치에 돌을 놓으면 6개 이상의 연속된 돌이 생기는지 확인
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {string} color - 돌 색상
   * @returns {boolean} 장육이면 true
   */
  isOverline(row, col, color) {
    const directions = [
      { dr: 0, dc: 1 },  // 가로
      { dr: 1, dc: 0 },  // 세로
      { dr: 1, dc: 1 },  // 대각선 \
      { dr: 1, dc: -1 }, // 대각선 /
    ];

    // 임시로 돌을 놓아봄
    this.board[row][col] = color;

    for (const { dr, dc } of directions) {
      let count = 1;

      // 정방향으로 탐색
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
        count++;
        r += dr;
        c += dc;
      }

      // 역방향으로 탐색
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= 6) {
        // 임시 돌 제거
        this.board[row][col] = null;
        return true;
      }
    }

    // 임시 돌 제거
    this.board[row][col] = null;
    return false;
  }

  /**
   * 삼삼(3-3) 체크: 해당 위치에 돌을 놓으면 열린 삼이 2개 이상 생기는지 확인
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {string} color - 돌 색상
   * @returns {boolean} 삼삼이면 true
   */
  isDoubleThree(row, col, color) {
    const directions = [
      { dr: 0, dc: 1 },  // 가로
      { dr: 1, dc: 0 },  // 세로
      { dr: 1, dc: 1 },  // 대각선 \
      { dr: 1, dc: -1 }, // 대각선 /
    ];

    // 임시로 돌을 놓아봄
    this.board[row][col] = color;

    let openThreeCount = 0;

    for (const { dr, dc } of directions) {
      if (this.isOpenThree(row, col, dr, dc, color)) {
        openThreeCount++;
      }
    }

    // 임시 돌 제거
    this.board[row][col] = null;

    return openThreeCount >= 2;
  }

  /**
   * 열린 삼 체크: 연속 삼 또는 띈 삼(한 칸 빈 삼) 패턴 확인
   * 연속 삼: _XXX_ (양쪽 끝이 열린 연속 3개)
   * 띈 삼: _X_XX_ 또는 _XX_X_ (한 칸 띄어진 3개, 양쪽 끝이 열림)
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {number} dr - 행 방향
   * @param {number} dc - 열 방향
   * @param {string} color - 돌 색상
   * @returns {boolean} 열린 삼이면 true
   */
  isOpenThree(row, col, dr, dc, color) {
    // 연속 삼 체크
    if (this.isContinuousOpenThree(row, col, dr, dc, color)) {
      return true;
    }

    // 띈 삼 체크
    if (this.isBrokenOpenThree(row, col, dr, dc, color)) {
      return true;
    }

    return false;
  }

  /**
   * 연속 열린 삼 체크: _XXX_ 패턴
   */
  isContinuousOpenThree(row, col, dr, dc, color) {
    let count = 1;
    let startR = row, startC = col;
    let endR = row, endC = col;

    // 정방향으로 탐색
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
      count++;
      endR = r;
      endC = c;
      r += dr;
      c += dc;
    }

    // 역방향으로 탐색
    r = row - dr;
    c = col - dc;
    while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === color) {
      count++;
      startR = r;
      startC = c;
      r -= dr;
      c -= dc;
    }

    // 정확히 3개가 아니면 연속 삼이 아님
    if (count !== 3) {
      return false;
    }

    // 양쪽 끝이 비어있는지 확인
    const beforeR = startR - dr;
    const beforeC = startC - dc;
    const afterR = endR + dr;
    const afterC = endC + dc;

    const beforeEmpty = this.isInBounds(beforeR, beforeC) && this.board[beforeR][beforeC] === null;
    const afterEmpty = this.isInBounds(afterR, afterC) && this.board[afterR][afterC] === null;

    return beforeEmpty && afterEmpty;
  }

  /**
   * 띈 삼 체크: _X_XX_ 또는 _XX_X_ 패턴 (한 칸 빈 곳이 있는 열린 삼)
   */
  isBrokenOpenThree(row, col, dr, dc, color) {
    // 해당 방향으로 5칸 범위 내의 패턴을 분석
    // 띈 삼 패턴: _X_XX_ 또는 _XX_X_

    // 시작점을 찾기 위해 역방향으로 4칸까지 탐색
    let startR = row - dr * 4;
    let startC = col - dc * 4;

    // 범위 내로 조정
    while (!this.isInBounds(startR, startC)) {
      startR += dr;
      startC += dc;
    }

    // 6칸 패턴을 검사 (_X_XX_ 또는 _XX_X_)
    for (let i = 0; i < 8; i++) {
      const baseR = startR + dr * i;
      const baseC = startC + dc * i;

      // 6칸 패턴이 보드 범위 내인지 확인
      if (!this.isInBounds(baseR, baseC) || !this.isInBounds(baseR + dr * 5, baseC + dc * 5)) {
        continue;
      }

      // 6칸 패턴 추출
      const pattern = [];
      for (let j = 0; j < 6; j++) {
        const pr = baseR + dr * j;
        const pc = baseC + dc * j;
        pattern.push(this.board[pr][pc]);
      }

      // _X_XX_ 패턴 체크 (빈-돌-빈-돌-돌-빈)
      if (pattern[0] === null && pattern[1] === color && pattern[2] === null &&
          pattern[3] === color && pattern[4] === color && pattern[5] === null) {
        // 현재 위치가 이 패턴에 포함되는지 확인
        for (let j = 1; j <= 4; j++) {
          if (j === 2) continue; // 빈 칸 위치는 건너뜀
          const pr = baseR + dr * j;
          const pc = baseC + dc * j;
          if (pr === row && pc === col) {
            return true;
          }
        }
      }

      // _XX_X_ 패턴 체크 (빈-돌-돌-빈-돌-빈)
      if (pattern[0] === null && pattern[1] === color && pattern[2] === color &&
          pattern[3] === null && pattern[4] === color && pattern[5] === null) {
        // 현재 위치가 이 패턴에 포함되는지 확인
        for (let j = 1; j <= 4; j++) {
          if (j === 3) continue; // 빈 칸 위치는 건너뜀
          const pr = baseR + dr * j;
          const pc = baseC + dc * j;
          if (pr === row && pc === col) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 좌표가 보드 범위 내인지 확인
   */
  isInBounds(row, col) {
    return row >= 0 && row < 15 && col >= 0 && col < 15;
  }

  placeStone(row, col, color) {
    if (!this.isValidMove(row, col)) return false;

    this.board[row][col] = color;
    this.moveHistory.push({ row, col, color });
    this.lastMove = { row, col };

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
        const extendedLine = this.getExtendedLine(row, col, dr, dc, color);

        // 6목 금지는 흑에게만 적용 (백은 6목도 승리)
        if (color === 'black') {
          // 흑: 정확히 5개인지 확인
          if (extendedLine.length === 5) {
            this.winningLine = extendedLine;
            return true;
          }
        } else {
          // 백: 5개 이상이면 모두 승리
          if (extendedLine.length >= 5) {
            this.winningLine = extendedLine.slice(0, 5); // 처음 5개만 winningLine에 저장
            return true;
          }
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
      lastMove: this.lastMove,
    };
  }

  applyMove(moveData) {
    this.board = moveData.board;
    this.currentTurn = moveData.currentTurn;
    this.gameOver = moveData.gameOver;
    this.winningLine = moveData.winningLine || [];
    this.lastMove = moveData.lastMove || null;
  }

  // AI 헬퍼 메서드

  /**
   * 특정 색상의 모든 가능한 수 반환 (탐색 공간 축소)
   * @param {string} color - 'black' 또는 'white'
   * @returns {Array} [{row, col}, ...]
   */
  getAllPossibleMoves(color) {
    const moves = [];

    // 첫 수는 중앙만 반환
    if (this.moveHistory.length === 0) {
      return [{ row: 7, col: 7 }];
    }

    // 기존 돌 주변 2칸 이내만 탐색 (탐색 공간 축소: 225개 → 평균 20-40개)
    const candidates = new Set();

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (this.board[r][c] !== null) {
          // 주변 2칸 추가
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const row = r + dr;
              const col = c + dc;

              if (this.isInBounds(row, col) && this.board[row][col] === null) {
                candidates.add(`${row},${col}`);
              }
            }
          }
        }
      }
    }

    // 유효성 검증 (금지 규칙 체크)
    const originalTurn = this.currentTurn;
    this.currentTurn = color;

    candidates.forEach((key) => {
      const [row, col] = key.split(',').map(Number);
      if (this.isValidMove(row, col)) {
        moves.push({ row, col });
      }
    });

    this.currentTurn = originalTurn;
    return moves;
  }

  /**
   * 게임 상태 깊은 복사
   * @returns {GomokuGame} 복사된 게임 인스턴스
   */
  cloneGame() {
    const clone = new GomokuGame();
    clone.board = this.board.map((row) => [...row]);
    clone.currentTurn = this.currentTurn;
    clone.myColor = this.myColor;
    clone.gameOver = this.gameOver;
    clone.moveHistory = this.moveHistory.map((m) => ({ ...m }));
    clone.winningLine = this.winningLine.map((p) => ({ ...p }));
    clone.lastMove = this.lastMove ? { ...this.lastMove } : null;
    return clone;
  }

  /**
   * 임시 수 실행 (moveHistory 갱신 안 함, AI 탐색용)
   * @param {number} row - 행
   * @param {number} col - 열
   * @param {string} color - 'black' 또는 'white'
   * @returns {boolean} 성공 여부
   */
  simulateMove(row, col, color) {
    if (!this.isValidMove(row, col)) return false;

    this.board[row][col] = color;
    this.lastMove = { row, col };

    if (this.checkWin(row, col, color)) {
      this.gameOver = true;
    } else if (this.isBoardFull()) {
      this.gameOver = true;
    }

    return true;
  }

  /**
   * 임시 수 취소
   * @param {number} row - 행
   * @param {number} col - 열
   */
  undoMove(row, col) {
    this.board[row][col] = null;
    this.gameOver = false;
    this.winningLine = [];
    this.lastMove =
      this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
  }
}
